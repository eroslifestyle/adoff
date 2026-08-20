// Test per la rotta GET /portal
// Stile: zero-framework, contatore asserzioni, exit code

const fs = require("fs");
const path = require("path");

// === UTILITY ===
let assertions = 0;
let failures = 0;

function assert(condition, message) {
  assertions++;
  if (!condition) {
    console.log("  FAIL: " + message);
    failures++;
  }
}

function assertContains(source, substring, message) {
  assertions++;
  if (!source.includes(substring)) {
    console.log("  FAIL: " + message);
    failures++;
  }
}

function assertNotContains(source, substring, message) {
  assertions++;
  if (source.includes(substring)) {
    console.log("  FAIL: " + message);
    failures++;
  }
}

// === LETTURA SORGENTE ===
const WORKER_PATH = path.resolve(__dirname, "../license-system/worker.js");
const workerSource = fs.readFileSync(WORKER_PATH, "utf8");

console.log("=== TEST: Portal Route ===\n");

// Test 1: getSessionToken NON deve esistere (era ReferenceError)
console.log("1. ReferenceError fix:");
assertNotContains(
  workerSource,
  "getSessionToken",
  "getSessionToken NON deve esistere nel worker"
);

// Test 2: handlePortalSession usa X-Account-Token header
console.log("\n2. Header authentication:");
const portalFn = workerSource.match(/async function handlePortalSession\([^)]+\)[\s\S]*?^}/m)?.[0] || "";
assertContains(
  portalFn,
  'request.headers.get("X-Account-Token")',
  "handlePortalSession deve usare X-Account-Token header"
);

// Test 3: Route registrata nel dispatch
console.log("\n3. Route nel dispatch:");
assertContains(
  workerSource,
  'path === "/portal"',
  "Route /portal deve essere registrata"
);
assertContains(
  workerSource,
  "handlePortalSession(request, env)",
  "Dispatch deve chiamare handlePortalSession"
);

// Test 4: Ritorno JSON con format=json
console.log("\n4. JSON response branch:");
assertContains(
  portalFn,
  'url.searchParams.get("format") === "json"',
  "Deve controllare ?format=json"
);
assertContains(
  portalFn,
  'request.headers.get("Accept")?.includes("application/json")',
  "Deve controllare Accept: application/json"
);
assertContains(
  portalFn,
  'return jsonResponse({ ok: true, url: data.url })',
  "Deve ritornare { ok: true, url: data.url }"
);

// Test 5: Redirect branch esiste ancora (compatibilita)
console.log("\n5. Redirect branch (compatibilita):");
assertContains(
  portalFn,
  "Response.redirect(data.url, 302)",
  "Redirect 302 deve esistere per compatibilita"
);

// Test 6: sessionGet usato per recover customerId
console.log("\n6. Session recovery:");
assertContains(
  portalFn,
  'await sessionGet(env, "account", sessionToken)',
  "sessionGet per recover customerId dalla sessione"
);

// === RIEPILOGO ===
console.log("\n============================================================");
console.log("RISULTATO: " + assertions + " asserzioni, " + failures + " fallimenti");
console.log("============================================================");

process.exit(failures === 0 ? 0 : 1);
