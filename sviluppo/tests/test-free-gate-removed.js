// Test: il free-gate (30 giorni → account obbligatorio) deve essere RIMOSSO dal codice.
// Modello di prodotto: gratis per tutti, senza account, senza scadenze. Il blocking
// non deve MAI dipendere da stato di licenza/free-gate.
// 1) Le funzioni/chiavi/fetch del gate non esistono più nei sorgenti (static check).
// 2) Nessun percorso di codice in background.js può disabilitare i ruleset DNR o
//    fermare content.js in base a stato di licenza/free-gate (static check sui
//    pattern; l'esecuzione reale del service worker non è praticabile in Node —
//    dichiarato esplicitamente come richiesto).
// 3) Coerenza tra i 3 browser: stessi pattern rimossi in app/, app-firefox/, app-safari/.
// Esecuzione: node sviluppo/tests/test-free-gate-removed.js
const fs = require("fs");
const path = require("path");

const ROOT = path.resolve(__dirname, "..", "..");
const TARGETS = ["app", "app-firefox", "app-safari"];

// Simboli che NON devono più esistere da nessuna parte (funzioni, storage keys, fetch).
const FORBIDDEN_SYMBOLS = [
  "syncFreeLicense",
  "readFreeState",
  "applyFreeGate",
  "checkFreeReminders",
  "adoffFreeExpired",
  "adoffFreeGateStart",
  "adoffFreeGrantEnd",
  "adoffFreeRegistered",
  "adoffFreeToken",
  "adoffFreeRemindersShown",
  "adoffFreeExpiredNotified",
  "/free-license",
  "refreshFreeLicense",
  "regDeadline",
  "regDaysLeft",
  "regExpired",
  "regRemind",
];

// background.js: i soli punti autorizzati a toccare i ruleset DNR. Il gate usava
// toggleNetworkRules(false) da applyFreeGate — quel percorso non deve più esistere.
const DNR_ENABLE_CALLEES = ["toggleNetworkRules", "updateEnabledRulesets", "updateStaticRules", "updateDynamicRules"];

let failures = 0;
function fail(msg) {
  failures++;
  console.error("  FAIL: " + msg);
}
function ok(msg) {
  console.log("  ok: " + msg);
}

function readSrc(parts) {
  return fs.readFileSync(path.join(ROOT, ...parts), "utf8");
}

// ---- 1) Simboli vietati assenti in tutti i target ----
console.log("\n[1] Simboli del free-gate rimossi (funzioni, chiavi storage, fetch)");
for (const target of TARGETS) {
  for (const file of ["background.js", "content.js", "popup.js", "onboarding.js", "options.js", "i18n.js", "onboarding.html", "popup.html"]) {
    const src = readSrc([target, "src", file]);
    for (const sym of FORBIDDEN_SYMBOLS) {
      if (src.includes(sym)) {
        fail(`${target}/src/${file} contiene ancora "${sym}"`);
      }
    }
  }
  ok(`${target}: nessun simbolo del free-gate trovato`);
}

// ---- 2) Nessun percorso di gating: DNR/spento o content fermato dallo stato licenza ----
console.log("\n[2] Nessun percorso può spegnere il blocking per stato licenza/free-gate");
for (const target of TARGETS) {
  const bg = readSrc([target, "src", "background.js"]);
  const content = readSrc([target, "src", "content.js"]);

  // a. toggleNetworkRules deve essere chiamato SOLO dal toggle utente (adoffEnabled),
  //    mai dentro una funzione di gate. Escludiamo la definizione della funzione
  //    ("function toggleNetworkRules(...)") e consideriamo solo le invocazioni.
  const toggleCalls = [...bg.matchAll(/(?<!function\s)toggleNetworkRules\(([^)]*)\)/g)];
  for (const call of toggleCalls) {
    // La chiamata legittima è dentro il listener di storage.onChanged su adoffEnabled.
    const before = bg.slice(Math.max(0, call.index - 200), call.index);
    const nearUserToggle = /adoffEnabled/.test(before) || /refreshBadge/.test(before);
    if (!nearUserToggle) {
      fail(`${target}: toggleNetworkRules chiamata fuori dal listener utente: toggleNetworkRules(${call[1]})`);
    }
  }
  if (!toggleCalls.length) ok(`${target}: toggleNetworkRules senza chiamate di gate`);

  // b. content.js non deve più leggere alcuna chiave di licenza/free per decidere start/stop
  for (const key of ["adoffLicense", "adoffTrial", "adoffFree", "adoffIntegrity"]) {
    if (content.includes(`"${key}`)) {
      fail(`${target}/src/content.js legge ancora "${key}" per il gate`);
    }
  }
  // c. il flag stealth non deve dipendere da nessun isPro/freeExpired
  //    (word boundary: "isProtectedElement" non deve fare match)
  if (/\bfreeExpired\b|\bisPro\b/.test(content)) {
    fail(`${target}/src/content.js contiene ancora logica isPro/freeExpired`);
  }
  ok(`${target}: content.js avvia il blocking senza condizioni di licenza`);
}

// ---- 3) Coerenza tra i 3 browser ----
console.log("\n[3] Coerenza tra i 3 browser (file condivisi identici)");
for (const file of ["background.js", "content.js", "license-client.js", "popup.js", "popup.html", "onboarding.js", "onboarding.html", "i18n.js"]) {
  const base = readSrc(["app", "src", file]);
  for (const target of ["app-firefox", "app-safari"]) {
    const mirror = readSrc([target, "src", file]);
    if (base !== mirror) {
      fail(`${file} diverge tra app/ e ${target}/`);
    }
  }
}
ok("i 3 background.js (e i file condivisi) sono identici");

// ---- Risultato ----
console.log("\n========================================");
if (failures > 0) {
  console.error(`FALLITO: ${failures} azzardo(i) — il free-gate non è completamente rimosso.`);
  process.exit(1);
}
console.log("PASS: free-gate completamente rimosso da tutti i 3 target.");
