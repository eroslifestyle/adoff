// Invariante: il tier del piano è calcolato da UNA sola funzione canonica,
// definita nello scope giusto, identica in tutti i file e in tutti i target.
// Bug reale che questo test blocca (2026-08-14): otto gate duplicavano a mano la
// lista dei piani, ognuno con una lista diversa e incompleta → un abbonato con
// plan "annual" o "premium_*" veniva trattato come Free e su YouTube partiva lo
// spot pre-roll. Il test legge i SORGENTI REALI, non duplica la logica.
// Esecuzione: node sviluppo/tests/test-plan-tier-consistency.js
const fs = require("fs");
const path = require("path");

const ROOT = path.resolve(__dirname, "..", "..");
const TARGETS = ["app", "app-firefox", "app-safari"];
const FILES = ["background.js", "content.js", "license-client.js", "options.js", "popup.js", "onboarding.js"];

// Piani realmente emessi da sviluppo/license-system/worker.js + tier atteso.
const EXPECTED = {
  monthly: "pro", annual: "pro", referral: "pro", lifetime: "pro",
  pro: "pro", trial: "pro",
  premium_monthly: "premium", premium_annual: "premium",
  premium_annual_founder: "premium",
  free: "free", "": "free", tampered: "free", expired: "free",
};

// Profondità di graffe ignorando stringhe, template literal e commenti.
function depths(src) {
  const out = new Array(src.length).fill(0);
  let d = 0, i = 0;
  while (i < src.length) {
    const c = src[i], n = src[i + 1];
    if (c === "/" && n === "/") { while (i < src.length && src[i] !== "\n") i++; continue; }
    if (c === "/" && n === "*") { i += 2; while (i < src.length && !(src[i] === "*" && src[i + 1] === "/")) i++; i += 2; continue; }
    if (c === '"' || c === "'" || c === "`") {
      const q = c; i++;
      while (i < src.length && src[i] !== q) { if (src[i] === "\\") i++; i++; }
      i++; continue;
    }
    if (c === "{") d++;
    if (c === "}") d--;
    out[i] = d;
    i++;
  }
  return out;
}

function funcRange(src) {
  const defIdx = src.indexOf("function adoffPlanTier");
  if (defIdx < 0) return null;
  const open = src.indexOf("{", defIdx);
  let d = 0, end = open;
  for (let i = open; i < src.length; i++) {
    if (src[i] === "{") d++;
    else if (src[i] === "}") { d--; if (d === 0) { end = i; break; } }
  }
  return { defIdx, open, end };
}

let fail = 0, checks = 0;
const bodies = new Set();

for (const t of TARGETS) {
  for (const f of FILES) {
    const p = path.join(ROOT, t, "src", f);
    const src = fs.readFileSync(p, "utf8");
    const dep = depths(src);

    checks++;
    const r = funcRange(src);
    if (!r) { console.log(`FAIL ${t}/${f}: definizione assente`); fail++; continue; }
    if (src.indexOf("function adoffPlanTier", r.defIdx + 1) >= 0) {
      console.log(`FAIL ${t}/${f}: definizione duplicata nello stesso file`); fail++; continue;
    }
    const defDepth = dep[r.defIdx];
    const body = src.slice(r.defIdx, r.end + 1);
    bodies.add(body.replace(/^[ \t]+/gm, ""));

    // Ogni USO deve stare a profondità >= a quella della definizione, altrimenti
    // a runtime è ReferenceError (node --check NON lo rileva).
    const re = /adoffPlanTier\s*\(/g;
    let m, uses = 0, bad = 0;
    while ((m = re.exec(src))) {
      if (m.index > r.defIdx && m.index < r.end) continue;
      if (m.index === r.defIdx + "function ".length) continue;
      uses++;
      if (dep[m.index] < defDepth) bad++;
    }
    checks++;
    if (uses === 0) { console.log(`FAIL ${t}/${f}: funzione definita ma mai usata`); fail++; continue; }
    if (bad > 0) { console.log(`FAIL ${t}/${f}: ${bad}/${uses} usi fuori dallo scope della definizione (ReferenceError a runtime)`); fail++; continue; }

    const fn = new Function(body + "; return adoffPlanTier;")();
    for (const [plan, tier] of Object.entries(EXPECTED)) {
      checks++;
      const got = fn(plan);
      if (got !== tier) { console.log(`FAIL ${t}/${f}: plan "${plan}" -> "${got}", atteso "${tier}"`); fail++; }
    }
    for (const v of [undefined, null, 0, {}, []]) {
      checks++;
      if (fn(v) !== "free") { console.log(`FAIL ${t}/${f}: valore non-stringa ${JSON.stringify(v)} non mappa a "free"`); fail++; }
    }
    console.log(`ok   ${t}/${f}  scope-depth=${defDepth}  usi=${uses}`);
  }
}

// Nessuna lista/confronto di piani hardcoded fuori dalla funzione canonica.
const LEAKS = [
  [/\[[^\]]*"(?:monthly|annual)"[^\]]*\]\s*\.includes/, "lista di piani in .includes()"],
  [/(?:plan|type)\s*===\s*"(?:monthly|annual|premium)"/, "confronto diretto su un nome di piano"],
  [/\.startsWith\("premium"\)/, "prefix-match premium fuori dalla funzione canonica"],
];
for (const t of TARGETS) {
  for (const f of FILES) {
    const src = fs.readFileSync(path.join(ROOT, t, "src", f), "utf8");
    const r = funcRange(src);
    if (!r) continue;
    const outside = src.slice(0, r.defIdx) + src.slice(r.end + 1);
    for (const [re, what] of LEAKS) {
      checks++;
      if (re.test(outside)) { console.log(`FAIL ${t}/${f}: ${what}`); fail++; }
    }
  }
}

checks++;
if (bodies.size !== 1) {
  console.log(`FAIL: ${bodies.size} varianti diverse della funzione canonica (devono essere identiche)`);
  [...bodies].forEach((b, i) => console.log(`--- variante ${i + 1} ---\n${b}`));
  fail++;
} else {
  console.log("ok   corpo della funzione identico in tutti i file e target");
}

console.log(`\n${checks} asserzioni, ${fail} fallimenti`);
process.exit(fail === 0 ? 0 : 1);
