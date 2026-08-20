// Test per la rotta POST /newsletter
// Stile: zero-framework, contatore asserzioni, exit code

const fs = require("fs");
const path = require("path");

// === UTILITY ===
let assertions = 0;
let failures = 0;

function assert(condition, message) {
  assertions++;
  if (!condition) {
    console.log(`  FAIL: ${message}`);
    failures++;
  }
}

function assertContains(source, substring, message) {
  assertions++;
  if (!source.includes(substring)) {
    console.log(`  FAIL: ${message}`);
    failures++;
  }
}

function assertNotContains(source, substring, message) {
  assertions++;
  if (source.includes(substring)) {
    console.log(`  FAIL: ${message}`);
    failures++;
  }
}

// === LETTURA SORGENTE ===
const WORKER_PATH = path.resolve(__dirname, "../license-system/worker.js");
const workerSource = fs.readFileSync(WORKER_PATH, "utf8");

console.log("=== TEST: Newsletter Route ===\n");

// Test 1: Route registrata nel dispatch
console.log("1. Route nel dispatch:");
assertContains(
  workerSource,
  'path === "/newsletter" && request.method === "POST"',
  'Route /newsletter POST deve essere registrata'
);
assertContains(
  workerSource,
  "handleNewsletter(body, request, env)",
  'Dispatch deve chiamare handleNewsletter'
);

// Test 2: Honeypot
console.log("\n2. Honeypot:");
assertContains(
  workerSource,
  'body.website !== undefined && !(typeof body.website === "string" && body.website.trim() === "")',
  'Honeypot robusto: body.website non-stringa attiva il bot trap'
);
assertContains(
  workerSource,
  'return jsonResponse({ ok: true })',
  'Honeypot ritorna ok:true senza scrivere'
);
assertContains(
  workerSource,
  "body.website",
  "Campo website usato per honeypot"
);

// Test 3: Consenso obbligatorio
console.log("\n3. Consenso obbligatorio:");
assertContains(
  workerSource,
  "body.consent !== true",
  "Check consenso !== true presente"
);
assertContains(
  workerSource,
  '{ ok: false, error: "Consenso esplicito richiesto" }, 400',
  "Errore consenso esplicito"
);

// Test 4: Validazione email
console.log("\n4. Validazione email:");
assertContains(
  workerSource,
  'rawEmail || typeof rawEmail !== "string"',
  "Check tipo email"
);
assertContains(
  workerSource,
  "email.length > 254",
  "Check lunghezza max 254"
);
assertContains(
  workerSource,
  "/[\\x00-\\x1f\\x7f]/.test(email)",
  "Check caratteri null/control"
);
assertContains(
  workerSource,
  "!EMAIL_RE.test(email)",
  "Check formato email con regex"
);

// Test 5: Prepared statement con binding (NO concatenazione)
console.log("\n5. Prepared statement:");
assertContains(
  workerSource,
  "env.DB.prepare(",
  "Usa env.DB.prepare"
);
assertContains(
  workerSource,
  "ON CONFLICT(email) DO UPDATE SET",
  "Upsert con ON CONFLICT"
);
assertContains(
  workerSource,
  ".bind(",
  "Binding parametri"
);
assertNotContains(
  workerSource,
  "INSERT INTO newsletter VALUES (\'" + "",
  "NO concatenazione stringhe per email"
);

// Test 6: On conflict gestisce riattivazione
console.log("\n6. Riattivazione su re-iscrizione:");
assertContains(
  workerSource,
  "unsubscribed_at = NULL",
  "ON CONFLICT azzera unsubscribed_at"
);

// Test 7: Turnstile — chiamato SEMPRE quando configurato
console.log("\n7. Turnstile (SEMPRE quando configurato — no bypass):");
assertContains(
  workerSource,
  "env.TURNSTILE_SECRET_KEY) {\n    if (!await verifyTurnstile",
  "Turnstile chiamato SEMPRE quando TURNSTILE_SECRET_KEY è configurato"
);
// NON deve esserci piu' la condizione && body.turnstileToken dopo TURNSTILE_SECRET_KEY
assertNotContains(
  workerSource,
  "env.TURNSTILE_SECRET_KEY && body.turnstileToken",
  "NON deve esserci bypass via && body.turnstileToken"
);

// Test 7b: Honeypot robusto — qualsiasi tipo non-stringa è sospetto
console.log("\n7b. Honeypot robusto (nessun TypeError):");
assertContains(
  workerSource,
  'typeof body.website === "string" && body.website.trim() === ""',
  "Honeypot check con typeof string"
);
// NON deve esserci il vecchio pattern body.website && body.website.trim() (causava TypeError)
assertNotContains(
  workerSource,
  'body.website && body.website.trim() !== ""',
  "NON deve chiamare trim() su valore non verificato stringa"
);

// Test 7c: Body guard — null/number/string/array rifiutati con 400
console.log("\n7c. Body guard (null/number/string/array -> 400):");
assertContains(
  workerSource,
  'typeof body !== "object" || Array.isArray(body)',
  "Rifiuta array"
);
assertContains(
  workerSource,
  '!body || typeof body !== "object"',
  "Rifiuta null e primitive"
);
assertContains(
  workerSource,
  '{ ok: false, error: "Richiesta non valida" }, 400',
  "Body non-oggetto ritorna 400 Richiesta non valida"
);

// Test 8: Rate limit
console.log("\n8. Rate limit:");
assertContains(
  workerSource,
  "checkRateLimit(ip)",
  "Usa checkRateLimit esistente"
);

// Test 9: Gestione errori DB
console.log("\n9. Gestione errori DB:");
assertContains(
  workerSource,
  'console.error("Newsletter DB error:"',
  "Log errore DB"
);
assertContains(
  workerSource,
  '{ ok: false, error: "Errore interno" }, 500',
  "Risposta errore 500 generico"
);

// Test 10: Risposta successo
console.log("\n10. Risposta successo:");
assertContains(
  workerSource,
  'return jsonResponse({ ok: true })',
  "Risposta ok:true finale"
);

// === RIEPILOGO ===
console.log("\n============================================================");
console.log(`RISULTATO: ${assertions} asserzioni, ${failures} fallimenti`);
console.log("============================================================");

process.exit(failures === 0 ? 0 : 1);
