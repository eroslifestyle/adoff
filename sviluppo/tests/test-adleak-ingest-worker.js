// Test ingest harness nel worker: validazione input + idempotenza su runId.
// Mock D1 in-memory: estrae handleAdleakIngest da worker.js via new Function.
const fs = require("fs");
const path = require("path");

const src = fs.readFileSync(path.join(__dirname, "../license-system/worker.js"), "utf8");

function extractFn(name) {
  let start = src.indexOf(`async function ${name}(`);
  if (start === -1) start = src.indexOf(`function ${name}(`);
  if (start === -1) throw new Error(`${name} not found`);
  let depth = 0, i = src.indexOf("{", start);
  for (let j = i; j < src.length; j++) {
    if (src[j] === "{") depth++;
    else if (src[j] === "}") { depth--; if (depth === 0) return src.slice(start, j + 1); }
  }
  throw new Error(`${name} unbalanced`);
}
function extractConst(word) {
  const m = src.match(new RegExp(`const ${word} = ([^;\\n]+);`));
  return m ? m[1] : "undefined";
}

// jsonResponse serve a handleAdleakIngest
const jResp = src.match(/function jsonResponse\(data, status = 200\) \{[\s\S]*?\n\}/)[0];

const factory = new Function(`
  const ADMIN_TOKEN_HEADER = "X-Admin-Token";
  const CORS_HEADERS = {};
  const HARNESS_MAX_DOMAINS = ${extractConst("HARNESS_MAX_DOMAINS")};
  const HARNESS_MAX_STR = ${extractConst("HARNESS_MAX_STR")};
  ${jResp}
  ${extractFn("verifyAdminAuth")}
  ${extractFn("harnessDomainError")}
  ${extractFn("handleAdleakIngest")}
  return handleAdleakIngest;
`);
const handleAdleakIngest = factory();

// --- Mock D1 in-memory con SQL comprensibile alle query usate ---
function mockD1() {
  const runs = new Map();   // run_id -> row
  const results = [];       // rows {run_id, domain, ...}
  const resultsAuto = { id: 0 };
  function prep(sql) {
    const q = sql.replace(/\s+/g, " ").trim();
    const api = {
      bind: (...args) => ({ run: () => exec(q, args), }),
      run: () => exec(q, []),
    };
    return api;
  }
  function exec(q, a) {
    let m;
    if ((m = q.match(/^CREATE (TABLE|INDEX)/))) return { meta: { changes: 0 } };
    if ((m = q.match(/^INSERT INTO harness_runs/))) {
      const row = { run_id: a[0], started_at: a[1], finished_at: a[2], extension_version: a[3], domains_tested: a[4], domains_with_leak: a[5], total_leaks: a[6], created_at: Date.now() };
      runs.set(a[0], row); // ON CONFLICT → replace
      return { meta: { changes: 1 } };
    }
    if ((m = q.match(/^DELETE FROM harness_results WHERE run_id = /))) {
      const before = results.length;
      for (let i = results.length - 1; i >= 0; i--) if (results[i].run_id === a[0]) results.splice(i, 1);
      return { meta: { changes: before - results.length } };
    }
    if ((m = q.match(/^INSERT INTO harness_results/))) {
      results.push({ id: ++resultsAuto.id, run_id: a[0], domain: a[1], http_status: a[2], requests: a[3], leaks: a[4], leak_rules: a[5], detection: a[6], error: a[7] });
      return { meta: { changes: 1 } };
    }
    throw new Error("mock: query non gestita: " + q);
  }
  return {
    prepare: prep,
    async batch(stmts) { for (const s of stmts) await s.run(); },
    _state: { runs, results },
  };
}

const env = {
  ADMIN_TOKEN: "tok-admin",
  DB: null,
};
env.DB = mockD1();

async function call(body) {
  const req = { headers: { get: (h) => (h === "X-Admin-Token" ? env.ADMIN_TOKEN : null) }, json: async () => body };
  return handleAdleakIngest(req, env);
}

let failures = 0;
function check(name, cond, extra) {
  if (cond) console.log("PASS", name);
  else { failures++; console.log("FAIL", name, extra || ""); }
}

(async () => {
  const good = {
    runId: "run-2026-09-09-a", startedAt: 1e12, finishedAt: 1e12 + 60000,
    extensionVersion: "3.3.9",
    domains: [
      { domain: "x.com", httpStatus: 200, requests: 115, leaks: 0, leakRules: [1, 5], detection: false, error: null },
      { domain: "y.it", httpStatus: 200, requests: 90, leaks: 3, leakRules: [900], detection: true, error: null },
    ],
  };

  // 1. auth
  let r = await handleAdleakIngest({ headers: { get: () => null }, json: async () => good }, env);
  check("no-token -> 401", r.status === 401, `got ${r.status}`);

  // 2. body validi
  r = await call(good);
  check("ingest ok -> 200", r.status === 200, `got ${r.status}`);
  check("1 run memorizzato", env.DB._state.runs.size === 1);
  check("2 risultati", env.DB._state.results.length === 2);
  check("total_leaks=3", env.DB._state.runs.get("run-2026-09-09-a").total_leaks === 3);

  // 3. idempotenza: reingest stesso runId con domini diversi → replace, non duplica
  const reingest = { ...good, domains: [{ domain: "z.net", httpStatus: 200, requests: 10, leaks: 1, leakRules: [], detection: false, error: null }] };
  r = await call(reingest);
  check("reingest ok -> 200", r.status === 200);
  check("run non duplicato", env.DB._state.runs.size === 1);
  check("risultati sostituiti (1, non 3)", env.DB._state.results.length === 1 && env.DB._state.results[0].domain === "z.net",
    JSON.stringify(env.DB._state.results.map(x => x.domain)));

  // 4. body invalidi → 400
  const bads = [
    ["no runId", { ...good, runId: "" }],
    ["no domains", { ...good, domains: [] }],
    ["domains non array", { ...good, domains: "x" }],
    ["detection non bool", { ...good, domains: [{ domain: "a.com", requests: 1, leaks: 0, detection: "yes" }] }],
    ["leaks negativo", { ...good, domains: [{ domain: "a.com", requests: 1, leaks: -1, detection: false }] }],
    ["requests mancante", { ...good, domains: [{ domain: "a.com", leaks: 0, detection: false }] }],
    ["startedAt stringa", { ...good, startedAt: "now" }],
    ["versione mancante", { ...good, extensionVersion: "" }],
  ];
  for (const [name, b] of bads) {
    r = await call(b);
    check(`400 su ${name}`, r.status === 400, `got ${r.status}`);
  }

  // 5. rate-limit admin (soglia 120): simula 121 richieste dallo stesso IP
  const ADMIN_RL_MAX = Number(extractConst("ADMIN_RATE_LIMIT_MAX"));
  const rlSrc = `const ADMIN_RATE_LIMIT_WINDOW = ${extractConst("ADMIN_RATE_LIMIT_WINDOW")}; const ADMIN_RATE_LIMIT_MAX = ${ADMIN_RL_MAX}; const ADMIN_RL_BUCKET = new Map(); ${src.match(/function checkAdminRateLimit\(ip\) \{[\s\S]*?\n\}/)[0]}; return checkAdminRateLimit;`;
  const checkAdminRateLimit = new Function(rlSrc)();
  let blockedAt = -1;
  for (let i = 1; i <= 200; i++) { if (!checkAdminRateLimit("1.2.3.4")) { blockedAt = i; break; } }
  check(`rate limit admin blocca a ${ADMIN_RL_MAX + 1}`, blockedAt === ADMIN_RL_MAX + 1, `blockedAt=${blockedAt}`);

  console.log(failures === 0 ? "\nTUTTI I TEST PASSANO" : `\n${failures} TEST FALLITI`);
  process.exit(failures === 0 ? 0 : 1);
})();
