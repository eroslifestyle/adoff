// Invariante: tutto è gratuito per tutti — nessuno resta fuori.
// Il tier canonico adoffPlanTier() restituisce SEMPRE "premium" per qualsiasi input,
// indipendentemente dal piano registrato. Questo test verifica che nessun intervento
// accidentale reintroduca logiche di gating.
// Bug storico che il test continua a bloccare (2026-08-14): otto gate duplicavano a
// mano la lista dei piani, ognuno con una lista diversa e incompleta → un abbonato
// con plan "annual" veniva trattato come Free e su YouTube partiva lo spot pre-roll.
// Il test legge i SORGENTI REALI, non duplica la logica.
// Esecuzione: node sviluppo/tests/test-plan-tier-consistency.js
const fs = require("fs");
const path = require("path");

const ROOT = path.resolve(__dirname, "..", "..");
const TARGETS = ["app", "app-firefox", "app-safari"];
const FILES = ["background.js", "content.js", "license-client.js", "options.js", "popup.js", "onboarding.js"];

// Tutti i piani emessi dal server — adoffPlanTier li deve digerire tutti restituendo "premium".
const PLAN_CASES = [
  "monthly", "annual", "referral", "lifetime", "pro", "trial",
  "premium_monthly", "premium_annual", "premium_annual_founder",
  "free", "", "tampered", "expired",
];

// Valori non-stringa — devono anch'essi produrre "premium".
const NON_STRING_CASES = [undefined, null, 0, {}, [], NaN, true];

// Valori di test per adoffSupporterKind(lic) — expected return.
const SUPPORTER_CASES = [
  [{ description: "undefined", value: undefined }, "none"],
  [{ description: "null", value: null }, "none"],
  [{ description: "{}", value: {} }, "none"],
  [{ description: "{valid:false}", value: { valid: false } }, "none"],
  [{ description: "{valid:true,plan:monthly}", value: { valid: true, plan: "monthly" } }, "supporter"],
  [{ description: "{valid:true,plan:annual}", value: { valid: true, plan: "annual" } }, "supporter"],
  [{ description: "{valid:true,plan:pro}", value: { valid: true, plan: "pro" } }, "supporter"],
  [{ description: "{valid:true,plan:referral}", value: { valid: true, plan: "referral" } }, "supporter"],
  [{ description: "{valid:true,plan:lifetime}", value: { valid: true, plan: "lifetime" } }, "founder"],
  [{ description: "{valid:true,plan:premium_annual_founder}", value: { valid: true, plan: "premium_annual_founder" } }, "founder"],
  [{ description: '{valid:true,plan:""}', value: { valid: true, plan: "" } }, "supporter"],
  [{ description: "{valid:true} (plan assente)", value: { valid: true } }, "supporter"],
];

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

// Cerca function <funcName> nel sorgente e restituisce l'intervallo {defIdx, open, end}
// oppure null se non trovata.
function funcRange(src, funcName) {
  const defIdx = src.indexOf("function " + funcName);
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
const planTierBodies = new Set();

/* ============================================================
   1. adoffPlanTier — 18 file, 6 file × 3 target
   ============================================================ */

for (const t of TARGETS) {
  for (const f of FILES) {
    const p = path.join(ROOT, t, "src", f);
    const src = fs.readFileSync(p, "utf8");
    const dep = depths(src);

    checks++;
    const r = funcRange(src, "adoffPlanTier");
    if (!r) { console.log(`FAIL ${t}/${f}: adoffPlanTier assente`); fail++; continue; }
    if (src.indexOf("function adoffPlanTier", r.defIdx + 1) >= 0) {
      console.log(`FAIL ${t}/${f}: definizione duplicata nello stesso file`); fail++; continue;
    }
    const defDepth = dep[r.defIdx];
    const body = src.slice(r.defIdx, r.end + 1);
    planTierBodies.add(body.replace(/^[ \t]+/gm, ""));

    // Ogni USO deve stare a profondità >= a quella della definizione.
    const re = /adoffPlanTier\s*\(/g;
    let m, uses = 0, bad = 0;
    while ((m = re.exec(src))) {
      if (m.index > r.defIdx && m.index < r.end) continue;         // dentro la definizione
      if (m.index === r.defIdx + "function ".length) continue;   // nome nella definizione
      uses++;
      if (dep[m.index] < defDepth) bad++;
    }
    checks++;
    if (uses === 0) { console.log(`FAIL ${t}/${f}: funzione definita ma mai usata`); fail++; continue; }
    if (bad > 0) { console.log(`FAIL ${t}/${f}: ${bad}/${uses} usi fuori dallo scope (ReferenceError a runtime)`); fail++; continue; }

    // Corpo deve restituire "premium" per TUTTI i piani emessi dal server.
    const fn = new Function(body + "; return adoffPlanTier;")();
    for (const plan of PLAN_CASES) {
      checks++;
      const got = fn(plan);
      if (got !== "premium") { console.log(`FAIL ${t}/${f}: plan "${plan}" -> "${got}", atteso "premium"`); fail++; }
    }
    // Valori non-stringa devono anch'essi produrre "premium".
    for (const v of NON_STRING_CASES) {
      checks++;
      if (fn(v) !== "premium") { console.log(`FAIL ${t}/${f}: ${JSON.stringify(v)} -> "${fn(v)}", atteso "premium"`); fail++; }
    }
    console.log(`ok   ${t}/${f}  scope-depth=${defDepth}  usi=${uses}`);
  }
}

// Corpo identico in tutti i 18 file.
checks++;
if (planTierBodies.size !== 1) {
  console.log(`FAIL: ${planTierBodies.size} varianti diverse di adoffPlanTier (devono essere identiche)`);
  [...planTierBodies].forEach((b, i) => console.log(`--- variante ${i + 1} ---\n${b}`));
  fail++;
} else {
  console.log("ok   corpo adoffPlanTier identico in tutti i file e target");
}

/* ============================================================
   2. Nessuna lista/confronto di piani hardcoded fuori dalla
      funzione canonica (LEAKS — mantenuti dai test precedenti)
   ============================================================ */
const LEAKS = [
  [/\[[^\]]*"(?:monthly|annual)"[^\]]*\]\s*\.includes/, "lista di piani in .includes()"],
  [/(?:plan|type)\s*===\s*"(?:monthly|annual|premium)"/, "confronto diretto su un nome di piano"],
  [/\.startsWith\("premium"\)/, "prefix-match premium fuori dalla funzione canonica"],
];
for (const t of TARGETS) {
  for (const f of FILES) {
    const src = fs.readFileSync(path.join(ROOT, t, "src", f), "utf8");
    const r = funcRange(src, "adoffPlanTier");
    if (!r) continue;
    const outside = src.slice(0, r.defIdx) + src.slice(r.end + 1);
    for (const [re, what] of LEAKS) {
      checks++;
      if (re.test(outside)) { console.log(`FAIL ${t}/${f}: ${what}`); fail++; }
    }
  }
}

/* ============================================================
   3. Nessun gate ridotto a costante booleana
      (|| true / && true / const isPro = true ...)
   ============================================================ */
const GATE_CONST_PATTERNS = [
  [/\|\| true/, "`|| true` semplifica il gate"],
  [/\&\& true/, "`&& true` semplifica il gate"],
  [/true \|\|/, "`true ||` semplifica il gate"],
  [/true \&\&/, "`true &&` semplifica il gate"],
  [/(?:const|let|var)\s+(isPro|isPremium|isValidPlan|hasValidPro)\s*=\s*true/, "`const isX = true` fora il gate"],
];
for (const t of TARGETS) {
  for (const f of FILES) {
    const src = fs.readFileSync(path.join(ROOT, t, "src", f), "utf8");
    // Normalizza whitespace multi-riga: tab/space/newline -> spazio singolo.
    // Così "const pro =\n  (\n    true ||" diventa "const pro = ( true ||" su una riga.
    const flat = src.replace(/[\t ]+/g, " ").replace(/\n/g, " ");
    for (const pair of GATE_CONST_PATTERNS) {
      const re = pair[0], what = pair[1];
      checks++;
      if (re.test(flat)) { console.log(`FAIL ${t}/${f}: ${what}`); fail++; }
    }
  }
}

/* ============================================================
   4. Nessun gate subordinato alla validità della licenza
      (license.valid && adoffPlanTier / lic.valid && adoffPlanTier ...)
   ============================================================ */
const VALID_GATE_PATTERNS = [
  [/\.valid\s*&&\s*adoffPlanTier/, "adoffPlanTier subordinato a .valid — tutti devono essere sbloccati"],
  [/\.valid\s*&&\s*adoffSupporterKind/, "adoffSupporterKind subordinato a .valid — deve funzionare anche senza licenza"],
];
for (const t of TARGETS) {
  for (const f of FILES) {
    const src = fs.readFileSync(path.join(ROOT, t, "src", f), "utf8");
    for (const [re, what] of VALID_GATE_PATTERNS) {
      checks++;
      if (re.test(src)) { console.log(`FAIL ${t}/${f}: ${what}`); fail++; }
    }
  }
}

/* ============================================================
   5. adoffSupporterKind — esattamente 6 file: popup.js e options.js
      dei tre target
   ============================================================ */
const SUPPORTER_FILES = ["popup.js", "options.js"];
const supporterBodies = new Set();
let supporterFileCount = 0;

for (const t of TARGETS) {
  for (const f of SUPPORTER_FILES) {
    const p = path.join(ROOT, t, "src", f);
    const src = fs.readFileSync(p, "utf8");
    const dep = depths(src);

    checks++;
    supporterFileCount++;
    const r = funcRange(src, "adoffSupporterKind");
    if (!r) { console.log(`FAIL ${t}/${f}: adoffSupporterKind assente`); fail++; continue; }
    if (src.indexOf("function adoffSupporterKind", r.defIdx + 1) >= 0) {
      console.log(`FAIL ${t}/${f}: definizione duplicata di adoffSupporterKind`); fail++; continue;
    }
    const body = src.slice(r.defIdx, r.end + 1);
    supporterBodies.add(body.replace(/^[ \t]+/gm, ""));

    // Corpo deve comportarsi correttamente.
    const fn = new Function(body + "; return adoffSupporterKind;")();
    for (const [{ description, value }, expected] of SUPPORTER_CASES) {
      checks++;
      const got = fn(value);
      if (got !== expected) { console.log(`FAIL ${t}/${f}: adoffSupporterKind(${description}) -> "${got}", atteso "${expected}"`); fail++; }
    }
    console.log(`ok   ${t}/${f}  adoffSupporterKind`);
  }
}

// Deve esistere esattamente in 6 file.
checks++;
if (supporterFileCount !== 6) {
  console.log(`FAIL: adoffSupporterKind trovata in ${supporterFileCount} file (atteso 6)`); fail++;
} else {
  console.log("ok   adoffSupporterKind presente esattamente in 6 file");
}

// Corpo identico nelle 6 copie.
checks++;
if (supporterBodies.size !== 1) {
  console.log(`FAIL: ${supporterBodies.size} varianti diverse di adoffSupporterKind`);
  [...supporterBodies].forEach((b, i) => console.log(`--- variante ${i + 1} ---\n${b}`));
  fail++;
} else {
  console.log("ok   corpo adoffSupporterKind identico in tutti i file");
}

// Non deve esistere in nessun altro file (background.js, content.js, license-client.js, onboarding.js).
for (const t of TARGETS) {
  for (const f of FILES) {
    if (SUPPORTER_FILES.includes(f)) continue;
    const src = fs.readFileSync(path.join(ROOT, t, "src", f), "utf8");
    checks++;
    if (/function adoffSupporterKind/.test(src)) {
      console.log(`FAIL ${t}/${f}: adoffSupporterKind non deve esistere qui`); fail++;
    }
  }
}

/* ============================================================
   Riepilogo
   ============================================================ */
console.log(`\n${checks} asserzioni, ${fail} fallimenti`);
process.exit(fail === 0 ? 0 : 1);
