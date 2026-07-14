#!/usr/bin/env node
/**
 * AdOff — Production Build Script (Multi-Browser)
 *
 * Modalita' di build:
 *   SITE (default): Terser minify + watermark steganografico → download diretto dal sito
 *   STORE (--store): solo Terser minify → Chrome Web Store (CWS policy compliance)
 *   --obfuscate: riattiva l'offuscamento (OPT-IN, deprecato di default — vedi nota sotto)
 *
 * NOTA OFFUSCAMENTO (2026-06, piano marketing TASK D): l'offuscamento e' disattivato di
 * default perche' la build CWS e' gia' leggibile (pubblicamente scaricabile) → offuscare il
 * download del sito non protegge l'IP. La protezione anti-clone e' la licenza legale
 * (source-available) + il license server privato, non l'offuscamento. Codice ispezionabile
 * = leva di fiducia. Watermark steganografico mantenuto per tracciare eventuali cloni.
 *
 * Funzionalita':
 *   1. Terser minification (codice leggibile) per tutti i file
 *   2. Watermarking steganografico per tracciare cloni (build non-DEV)
 *   3. Runtime integrity check iniettato nei file critici
 *   4. Supporto multi-browser: Chrome, Firefox, Safari, Edge, Opera
 *   5. Offuscamento differenziato (3 livelli) disponibile solo con --obfuscate
 *
 * Uso:
 *   node sviluppo/scripts/build.js                   # SITE: minify + watermark → site/
 *   node sviluppo/scripts/build.js --store           # STORE: solo minify → per CWS upload
 *   node sviluppo/scripts/build.js --obfuscate       # SITE + offuscamento (opt-in, deprecato)
 *   node sviluppo/scripts/build.js --target chrome   # Solo Chrome
 *   node sviluppo/scripts/build.js --target firefox  # Solo Firefox
 *   node sviluppo/scripts/build.js --target safari   # Solo Safari (poi xcrun safari-web-extension-converter)
 *   node sviluppo/scripts/build.js --no-watermark    # Skip watermark
 *   node sviluppo/scripts/build.js --dev             # Dev: minify veloce per test
 *
 * Output:
 *   SITE mode:  sviluppo/adoff-chrome-prod.zip  → copiato in site/adoff-chrome.zip
 *   STORE mode: sviluppo/adoff-chrome-store.zip → upload manuale su CWS
 */
"use strict";

const fs = require("fs");
const path = require("path");
const { execSync } = require("child_process");
const JavaScriptObfuscator = require("javascript-obfuscator");
const { minify } = require("terser");
const AdmZip = require("adm-zip");

// =============================================
// CONFIG
// =============================================

const PROJECT_ROOT = path.resolve(__dirname, "../..");
const SITE_CHROME_ZIP = path.join(PROJECT_ROOT, "site", "adoff-chrome.zip");
const SITE_FIREFOX_ZIP = path.join(PROJECT_ROOT, "site", "adoff-firefox.zip");
const SITE_SAFARI_ZIP = path.join(PROJECT_ROOT, "site", "adoff-safari.zip");

const args = process.argv.slice(2);
const NO_WATERMARK = args.includes("--no-watermark");
const DEV_MODE = args.includes("--dev");
const STORE_MODE = args.includes("--store");  // CWS-safe: solo Terser, zero obfuscation
// Offuscamento OPT-IN (deprecato di fatto): la versione CWS è già leggibile,
// quindi offuscare il download del sito non protegge l'IP (vedi piano marketing TASK D).
// Default: SITE = solo Terser minify + watermark steganografico. Passa --obfuscate per riattivarlo.
const OBFUSCATE = args.includes("--obfuscate");

// Target parsing: --target chrome | --target firefox | (default: all)
const targetIdx = args.indexOf("--target");
const SINGLE_TARGET = targetIdx !== -1 ? args[targetIdx + 1] : null;

// Browser targets configuration
const TARGETS = {
  chrome: {
    appDir: path.join(PROJECT_ROOT, "app"),
    buildDir: path.join(PROJECT_ROOT, "sviluppo", "build-chrome"),
    hasStubs: true,
    extraFiles: [],
  },
  firefox: {
    appDir: path.join(PROJECT_ROOT, "app-firefox"),
    buildDir: path.join(PROJECT_ROOT, "sviluppo", "build-firefox"),
    hasStubs: false,
    extraFiles: ["stealth-injector.js"],  // Firefox-specific: MAIN world workaround
  },
  safari: {
    appDir: path.join(PROJECT_ROOT, "app-safari"),
    buildDir: path.join(PROJECT_ROOT, "sviluppo", "build-safari"),
    hasStubs: true,  // Safari 16.4+ supporta MAIN world e web_accessible_resources come Chrome
    extraFiles: [],
  },
};

// Helper per ZIP name (calcolato a runtime dopo parsing args)
function getZipName(target) {
  const suffix = STORE_MODE ? "-store.zip" : "-prod.zip";
  return `adoff-${target}${suffix}`;
}

// Edge e Opera usano lo stesso pacchetto Chrome (Chromium-based)
// I ZIP per Edge/Opera sono generati con getZipName("edge") / getZipName("opera") se necessario
TARGETS.edge = { ...TARGETS.chrome };
TARGETS.opera = { ...TARGETS.chrome };

const manifest = JSON.parse(
  fs.readFileSync(path.join(TARGETS.chrome.appDir, "manifest.json"), "utf-8")
);
const VERSION = manifest.version;

// =============================================
// CANARY TOKENS (anti-clone — searchable honeytoken)
// =============================================
//
// A differenza del watermark steganografico (zero-width, prova "questa build è
// mia" ma NON ricercabile), il canary è un token VISIBILE e univoco iniettato in
// ogni file JS spedito. Serve al monitoraggio automatico: clone-monitor.js cerca
// questo token su GitHub Code Search / web. Zero hit legittimi attesi → ogni hit
// che non sia il nostro repo è un clone. Registry persistente in canaries.json.
const crypto = require("crypto");
const CANARIES_PATH = path.join(PROJECT_ROOT, "sviluppo", "canaries.json");
const LEGAL_URL = "https://adoff.app/legal";

function loadOrCreateCanaries() {
  if (fs.existsSync(CANARIES_PATH)) {
    try { return JSON.parse(fs.readFileSync(CANARIES_PATH, "utf-8")); } catch (_) { /* rigenera */ }
  }
  const token = "adoff_src_" + crypto.randomBytes(6).toString("hex");
  const reg = {
    project_canary: token,            // STABILE — non cambiarlo: è la query di ricerca cloni
    legal_url: LEGAL_URL,
    created: new Date().toISOString(),
    note: "Token honeypot anti-clone. Iniettato in ogni JS spedito. Cercalo su GitHub/web: ogni match fuori dal repo ufficiale AdOff è un clone. NON committare in repo pubblico se vuoi mantenerlo segreto al cloner (vedi clone-monitor.js).",
    builds: [],
  };
  fs.writeFileSync(CANARIES_PATH, JSON.stringify(reg, null, 2));
  return reg;
}

const CANARIES = loadOrCreateCanaries();
const PROJECT_CANARY = CANARIES.project_canary;

// =============================================
// WATERMARKING STEGANOGRAFICO
// =============================================

/**
 * Genera un build ID univoco e lo codifica in zero-width characters.
 * Inserito come commento invisibile nei file JS — permette di
 * identificare la build se un competitor clona il codice.
 *
 * Zero-width chars usati:
 *   U+200B (ZWSP)  = bit 0
 *   U+200C (ZWNJ)  = bit 1
 *   U+200D (ZWJ)   = separatore byte
 *   U+FEFF (BOM)   = marker inizio/fine
 */
function generateBuildId() {
  const ts = Date.now().toString(36);
  const rand = Math.random().toString(36).slice(2, 6);
  return `${ts}-${rand}`;
}

function encodeSteganographic(text) {
  const ZERO = "\u200B";
  const ONE = "\u200C";
  const SEP = "\u200D";
  const MARKER = "\uFEFF";

  let encoded = MARKER;
  for (let i = 0; i < text.length; i++) {
    const byte = text.charCodeAt(i);
    for (let bit = 7; bit >= 0; bit--) {
      encoded += (byte >> bit) & 1 ? ONE : ZERO;
    }
    if (i < text.length - 1) encoded += SEP;
  }
  encoded += MARKER;
  return encoded;
}

function injectWatermark(code, buildId, filename) {
  const payload = `adoff:${buildId}:${filename}`;
  const stego = encodeSteganographic(payload);
  // Iniettato come "commento" dentro una stringa inutilizzata in una IIFE
  const watermark = `void(${JSON.stringify(stego)});`;
  // Inserito dopo il primo "use strict" o all'inizio
  const strictIdx = code.indexOf('"use strict"');
  if (strictIdx !== -1) {
    const insertAt = code.indexOf(";", strictIdx) + 1;
    return code.slice(0, insertAt) + watermark + code.slice(insertAt);
  }
  return watermark + code;
}

/**
 * Inietta un canary token VISIBILE e ricercabile in testa al file.
 * Doppia forma per resistere a chi strippa i commenti:
 *   1) banner commento (deterrente legale + ricercabile)
 *   2) stringa no-op (sopravvive anche se il clone rimuove i commenti)
 * Iniettato DOPO minify/obfuscate, come il watermark, così non viene rimosso.
 */
function injectCanary(code, filename) {
  const banner = `/*! ${PROJECT_CANARY} | AdOff source-available © ${new Date().getFullYear()} | clone? ${LEGAL_URL} */\n`;
  const noop = `void("${PROJECT_CANARY}");`;
  return banner + noop + code;
}

/**
 * Decodifica un watermark steganografico (utility per verifica).
 * Uso: node -e "require('./build.js')" — oppure vedi decodeSteganographic export.
 */
function decodeSteganographic(encoded) {
  const ZERO = "\u200B";
  const ONE = "\u200C";
  const SEP = "\u200D";
  const MARKER = "\uFEFF";

  const start = encoded.indexOf(MARKER);
  const end = encoded.lastIndexOf(MARKER);
  if (start === -1 || end === -1 || start === end) return null;

  const payload = encoded.slice(start + 1, end);
  const bytes = payload.split(SEP);
  let result = "";
  for (const byte of bytes) {
    let charCode = 0;
    const bits = byte.replace(new RegExp(`[^${ZERO}${ONE}]`, "g"), "");
    for (let i = 0; i < bits.length; i++) {
      charCode = (charCode << 1) | (bits[i] === ONE ? 1 : 0);
    }
    if (charCode > 0) result += String.fromCharCode(charCode);
  }
  return result;
}

// =============================================
// RUNTIME INTEGRITY CHECK
// =============================================

/**
 * Genera codice di integrity check che verifica che le funzioni
 * critiche non siano state sostituite a runtime.
 * Iniettato all'inizio dei file stealth.js e content.js.
 */
function generateIntegrityCheck() {
  return `
(function(){
  var _ic=function(f,n){try{var s=f.toString();if(s.indexOf("[native code]")!==-1)return;if(s.length<20)return;var h=0;for(var i=0;i<s.length;i++){h=((h<<5)-h)+s.charCodeAt(i);h|=0;}return h;}catch(e){return 0;}};
  var _checks={"dp":Object.defineProperty,"gcs":window.getComputedStyle,"ce":document.createElement};
  setTimeout(function(){
    for(var k in _checks){
      if(typeof _checks[k]!=="function"){
        document.documentElement.removeAttribute("data-adoff-stealth");
        document.documentElement.removeAttribute("data-adoff-loaded");
        return;
      }
    }
  },3000);
})();`;
}

// =============================================
// OBFUSCATION PROFILES (CWS-safe)
// =============================================

/**
 * 3 profili di obfuscazione, tutti CWS-safe:
 *
 * HIGH: stealth.js, license-client.js — secret sauce massima
 *   String array + encoding + rotation + name mangling
 *
 * MEDIUM: content.js, background.js — logica importante
 *   String array + name mangling (no encoding — performance)
 *
 * LOW: popup.js, options.js, onboarding.js — UI, poco sensibile
 *   Solo terser minification (massima performance, zero rischio CWS)
 */

const PROFILES = {
  high: {
    compact: true,
    controlFlowFlattening: false,       // CWS-safe: disabilitato
    deadCodeInjection: false,            // CWS-safe: disabilitato
    selfDefending: false,                // CWS-safe: disabilitato
    identifierNamesGenerator: "mangled-shuffled",
    renameGlobals: false,
    renameProperties: false,
    stringArray: true,
    stringArrayCallsTransform: true,
    stringArrayCallsTransformThreshold: 0.75,
    stringArrayEncoding: ["base64"],
    stringArrayIndexShift: true,
    stringArrayRotate: true,
    stringArrayShuffle: true,
    stringArrayThreshold: 0.75,
    stringArrayWrappersCount: 2,
    stringArrayWrappersType: "variable",
    splitStrings: true,
    splitStringsChunkLength: 8,
    transformObjectKeys: false,
    unicodeEscapeSequence: false,
  },

  medium: {
    compact: true,
    controlFlowFlattening: false,
    deadCodeInjection: false,
    selfDefending: false,
    identifierNamesGenerator: "mangled",
    renameGlobals: false,
    renameProperties: false,
    stringArray: true,
    stringArrayCallsTransform: false,
    stringArrayEncoding: [],              // No encoding — piu' veloce
    stringArrayIndexShift: true,
    stringArrayRotate: true,
    stringArrayShuffle: true,
    stringArrayThreshold: 0.5,
    stringArrayWrappersCount: 1,
    stringArrayWrappersType: "variable",
    splitStrings: false,
    transformObjectKeys: false,
    unicodeEscapeSequence: false,
  },

  // LOW = solo terser, niente javascript-obfuscator
  low: null,
};

// Mappa file → profilo
const FILE_PROFILES = {
  "stealth.js":        "high",
  "license-client.js": "high",
  "content.js":        "medium",
  "background.js":     "medium",
  "popup.js":          "low",
  "options.js":        "low",
  "onboarding.js":     "low",
  "i18n.js":           "low",
};

// File che ricevono integrity check
const INTEGRITY_FILES = ["stealth.js", "content.js"];

// =============================================
// BUILD PIPELINE
// =============================================

// =============================================
// PROCESS SINGLE TARGET
// =============================================

async function buildTarget(targetName, config, buildId) {
  const { appDir, buildDir, hasStubs, extraFiles } = config;

  if (!fs.existsSync(appDir)) {
    console.log(`  SKIP: ${targetName} (directory ${appDir} non trovata)`);
    return null;
  }

  console.log(`\n--- ${targetName.toUpperCase()} ---`);

  // 1. Pulisci e crea struttura build
  // Eliminazione cross-platform diretta (no residui -old-*).
  if (fs.existsSync(buildDir)) {
    try {
      fs.rmSync(buildDir, { recursive: true, force: true });
    } catch (err) {
      // Fallback (es. lock Windows/Dropbox): rinomina e tenta rimozione in background.
      const oldDir = buildDir + "-old-" + Date.now();
      try {
        fs.renameSync(buildDir, oldDir);
        const rmCmd = process.platform === "win32"
          ? `powershell -Command "Remove-Item -Recurse -Force '${oldDir.replace(/\//g, "\\\\")}'"`
          : `rm -rf '${oldDir}'`;
        execSync(`${rmCmd} &`, { stdio: "ignore" });
      } catch (_) {
        console.log(`  WARN: ${buildDir} bloccata, uso directory esistente`);
        // Continua comunque — sovrascriverà i file
      }
    }
  }
  fs.mkdirSync(path.join(buildDir, "src"), { recursive: true });
  fs.mkdirSync(path.join(buildDir, "rules"), { recursive: true });
  fs.mkdirSync(path.join(buildDir, "assets"), { recursive: true });
  if (hasStubs) fs.mkdirSync(path.join(buildDir, "stubs"), { recursive: true });

  // 2. Copia file statici
  copyFile("manifest.json", appDir, buildDir);
  copyDir("rules", appDir, buildDir);
  copyDir("assets", appDir, buildDir);

  // Stubs (solo Chrome — Firefox usa web_accessible_resources su src/)
  if (hasStubs) {
    const stubSrc = path.join(appDir, "stubs", "google-ima3.js");
    if (fs.existsSync(stubSrc)) {
      let stubCode = fs.readFileSync(stubSrc, "utf-8");
      if (OBFUSCATE && !DEV_MODE && !STORE_MODE) {
        console.log("  Obfuscate: stubs/google-ima3.js [HIGH]");
        const result = JavaScriptObfuscator.obfuscate(stubCode, PROFILES.high);
        stubCode = result.getObfuscatedCode();
      } else {
        const label = STORE_MODE ? "STORE" : (DEV_MODE ? "DEV" : "SITE");
        console.log(`  Minify: stubs/google-ima3.js [${label}]`);
        const result = await minify(stubCode, { compress: true, mangle: true });
        stubCode = result.code;
      }
      // Watermark steganografico + canary ricercabile: in ogni build non-DEV (traccia cloni)
      if (!NO_WATERMARK && !DEV_MODE) {
        stubCode = injectWatermark(stubCode, buildId, "google-ima3.js");
        stubCode = injectCanary(stubCode, "google-ima3.js");
      }
      fs.writeFileSync(path.join(buildDir, "stubs", "google-ima3.js"), stubCode);
    }
  }

  // Docs (Firefox AMO richiede docs/ se presente)
  const docsDir = path.join(appDir, "docs");
  if (fs.existsSync(docsDir)) {
    fs.mkdirSync(path.join(buildDir, "docs"), { recursive: true });
    copyDir("docs", appDir, buildDir);
  }

  // Copia CSS e HTML
  const srcDir = path.join(appDir, "src");
  for (const file of fs.readdirSync(srcDir)) {
    if (file.endsWith(".css") || file.endsWith(".html")) {
      fs.copyFileSync(path.join(srcDir, file), path.join(buildDir, "src", file));
    }
  }

  // 3. Processa file JS
  const stats = { original: 0, output: 0 };

  // Determina file JS da processare (base + extra per questo target)
  const allJsFiles = { ...FILE_PROFILES };
  for (const extra of extraFiles) {
    if (!allJsFiles[extra]) allJsFiles[extra] = "medium";  // Default profile per file extra
  }

  for (const [filename, profile] of Object.entries(allJsFiles)) {
    const srcPath = path.join(appDir, "src", filename);
    const dstPath = path.join(buildDir, "src", filename);

    if (!fs.existsSync(srcPath)) continue;

    let code = fs.readFileSync(srcPath, "utf-8");
    const origSize = Buffer.byteLength(code, "utf-8");
    stats.original += origSize;

    // Inietta integrity check (pre-obfuscation)
    if (INTEGRITY_FILES.includes(filename) && !DEV_MODE) {
      code = generateIntegrityCheck() + "\n" + code;
    }

    if (OBFUSCATE && !DEV_MODE && !STORE_MODE && profile !== "low") {
      // Offuscamento solo se esplicitamente richiesto (--obfuscate). Deprecato di default.
      const lvl = profile.toUpperCase();
      console.log(`  Obfuscate: ${filename} [${lvl}]`);
      const result = JavaScriptObfuscator.obfuscate(code, PROFILES[profile]);
      code = result.getObfuscatedCode();
    } else {
      // Default: solo Terser minification (codice leggibile, ispezionabile).
      // STORE_MODE: CWS richiede codice leggibile · DEV_MODE: test veloce · SITE: trasparenza.
      const label = STORE_MODE ? "STORE" : (DEV_MODE ? "DEV" : "SITE");
      console.log(`  Minify: ${filename} [${label}]`);
      const result = await minify(code, {
        compress: { dead_code: true, drop_console: false, passes: 2 },
        mangle: { toplevel: false },
        output: { comments: false },
      });
      code = result.code;
    }

    // Inietta watermark + canary DOPO obfuscazione/minify (sopravvivono intatti)
    if (!NO_WATERMARK && !DEV_MODE) {
      code = injectWatermark(code, buildId, filename);
      code = injectCanary(code, filename);
    }

    const outSize = Buffer.byteLength(code, "utf-8");
    stats.output += outSize;
    const ratio = ((outSize / origSize) * 100).toFixed(0);
    console.log(`    ${(origSize / 1024).toFixed(1)}KB → ${(outSize / 1024).toFixed(1)}KB (${ratio}%)`);

    fs.writeFileSync(dstPath, code);
  }

  // Copia file AMO metadata (Firefox)
  const amoFile = path.join(appDir, "amo-metadata.json");
  if (fs.existsSync(amoFile)) {
    fs.copyFileSync(amoFile, path.join(buildDir, "amo-metadata.json"));
  }

  return stats;
}

// =============================================
// CREATE ZIP (adm-zip — cross-platform, forward-slash standard)
// =============================================
// CRITICAL: Chrome Web Store richiede path con forward-slash. PowerShell
// Compress-Archive su Windows usa backslash che CWS non risolve correttamente
// (errore "Could not load <file> for script"). adm-zip genera ZIP standard.

function createZip(srcDir, zipPath) {
  if (fs.existsSync(zipPath)) fs.unlinkSync(zipPath);

  try {
    const zip = new AdmZip();
    addDirToZip(zip, srcDir, "");
    zip.writeZip(zipPath);
    return true;
  } catch (err) {
    console.error(`  ZIP error: ${err.message}`);
    return false;
  }
}

function addDirToZip(zip, dirPath, zipParentPath) {
  const entries = fs.readdirSync(dirPath, { withFileTypes: true });
  for (const entry of entries) {
    if (entry.name === ".DS_Store" || entry.name === "Thumbs.db") continue;
    const fullPath = path.join(dirPath, entry.name);
    // Forward-slash per ZIP standard (cross-platform)
    const zipPath = zipParentPath ? `${zipParentPath}/${entry.name}` : entry.name;
    if (entry.isDirectory()) {
      addDirToZip(zip, fullPath, zipPath);
    } else {
      const content = fs.readFileSync(fullPath);
      zip.addFile(zipPath, content);
    }
  }
}

// =============================================
// MAIN BUILD
// =============================================

// Verifica che i file che DEVONO essere identici tra i 3 target non siano divergenti.
// Esclusi (differenze legittime): manifest.json, stealth.js (Firefox più leggero),
// stealth-injector.js (solo Firefox), background.js (Firefox può differire per alarm).
function checkSync() {
  const crypto = require("crypto");
  const SHARED_FILES = [
    "src/content.js", "src/popup.js", "src/popup.html", "src/popup.css",
    "src/options.js", "src/options.html", "src/options.css", "src/onboarding.js",
    "src/license-client.js", "src/i18n.js", "src/ads-hide.css",
    "rules/adblock-rules.json",
  ];
  const dirs = { chrome: "app", firefox: "app-firefox", safari: "app-safari" };
  const md5 = (p) => fs.existsSync(p) ? crypto.createHash("md5").update(fs.readFileSync(p)).digest("hex") : null;
  const drift = [];
  for (const f of SHARED_FILES) {
    const h = {};
    for (const [t, d] of Object.entries(dirs)) h[t] = md5(path.join(PROJECT_ROOT, d, f));
    if (h.chrome && (h.firefox !== h.chrome || h.safari !== h.chrome)) {
      drift.push(`${f} — chrome≠${h.firefox !== h.chrome ? "firefox " : ""}${h.safari !== h.chrome ? "safari" : ""}`.trim());
    }
  }
  if (drift.length) {
    console.log("\n  ⚠️  SYNC DRIFT — file condivisi divergenti tra target (propaga prima del deploy):");
    drift.forEach((d) => console.log(`     - ${d}`));
    console.log("");
  } else {
    console.log("  Sync check: file condivisi identici sui 3 target ✓");
  }
}

async function build() {
  console.log(`\n=== AdOff v${VERSION} — Production Build (Multi-Browser) ===\n`);
  checkSync();
  const modeLabel = STORE_MODE ? "STORE (CWS-safe, minify)" : (DEV_MODE ? "DEV (minify only)" : (OBFUSCATE ? "SITE (obfuscation + watermark)" : "SITE (minify + watermark)"));
  console.log(`  Mode:      ${modeLabel}`);
  console.log(`  Watermark: ${NO_WATERMARK || STORE_MODE ? "OFF" : "ON"}`);
  console.log(`  Target:    ${SINGLE_TARGET || "ALL (chrome + firefox + safari)"}`);

  const buildId = generateBuildId();
  if (!NO_WATERMARK) {
    console.log(`  Build ID:  ${buildId}`);
  }

  // Determina quali target buildare
  // Edge e Opera usano lo stesso pacchetto Chrome, quindi buildiamo chrome + firefox + safari
  const targetsToBuild = SINGLE_TARGET
    ? { [SINGLE_TARGET]: TARGETS[SINGLE_TARGET] }
    : { chrome: TARGETS.chrome, firefox: TARGETS.firefox, safari: TARGETS.safari };

  const allStats = { original: 0, output: 0 };
  const results = {};

  for (const [name, config] of Object.entries(targetsToBuild)) {
    if (!config) {
      console.log(`\n  ERRORE: target '${name}' non valido. Validi: chrome, firefox, safari, edge, opera`);
      continue;
    }
    const stats = await buildTarget(name, config, buildId);
    if (stats) {
      allStats.original += stats.original;
      allStats.output += stats.output;
      results[name] = stats;
    }
  }

  // 4. Crea ZIP per ogni target
  console.log("\n--- Creazione ZIP ---");
  for (const [name, config] of Object.entries(targetsToBuild)) {
    if (!results[name]) continue;
    const zipName = getZipName(name);
    const zipPath = path.join(PROJECT_ROOT, "sviluppo", zipName);
    if (createZip(config.buildDir, zipPath)) {
      const zipSize = fs.statSync(zipPath).size;
      console.log(`  ${name}: ${(zipSize / 1024).toFixed(0)}KB → ${zipName}`);
    } else {
      console.log(`  ${name}: WARN — build dir pronta in ${config.buildDir}`);
    }
  }

  // Copia ZIP in site/ per download diretto — SOLO per build SITE (con obfuscation)
  // La build STORE (CWS) non va sul sito, va solo su Chrome Web Store
  if (!STORE_MODE) {
    if (results.chrome) {
      const chromeZip = path.join(PROJECT_ROOT, "sviluppo", getZipName("chrome"));
      if (fs.existsSync(chromeZip)) {
        fs.copyFileSync(chromeZip, SITE_CHROME_ZIP);
        console.log(`  Copiato → site/adoff-chrome.zip`);
      }
    }
    if (results.firefox) {
      const firefoxZip = path.join(PROJECT_ROOT, "sviluppo", getZipName("firefox"));
      if (fs.existsSync(firefoxZip)) {
        fs.copyFileSync(firefoxZip, SITE_FIREFOX_ZIP);
        console.log(`  Copiato → site/adoff-firefox.zip`);
      }
    }
    if (results.safari) {
      const safariZip = path.join(PROJECT_ROOT, "sviluppo", getZipName("safari"));
      if (fs.existsSync(safariZip)) {
        fs.copyFileSync(safariZip, SITE_SAFARI_ZIP);
        console.log(`  Copiato → site/adoff-safari.zip`);
      }
    }
  } else {
    console.log(`  STORE mode: ZIP non copiati in site/ (usare per CWS upload)`);
  }

  // 5. Salva build manifest
  const buildMode = STORE_MODE ? "store" : (DEV_MODE ? "dev" : "site");
  const buildManifest = {
    version: VERSION,
    buildId: (NO_WATERMARK || STORE_MODE) ? "none" : buildId,
    timestamp: new Date().toISOString(),
    mode: buildMode,
    targets: Object.keys(results),
    profiles: Object.entries(FILE_PROFILES).map(([f, p]) => `${f}: ${(DEV_MODE || STORE_MODE) ? "minify" : p}`),
    watermark: !NO_WATERMARK && !DEV_MODE,
    canary: (!NO_WATERMARK && !DEV_MODE) ? PROJECT_CANARY : "none",
    integrity: !DEV_MODE,
    obfuscation: OBFUSCATE && !STORE_MODE && !DEV_MODE,
    sizes: {
      originalJS: `${(allStats.original / 1024).toFixed(1)}KB`,
      outputJS: `${(allStats.output / 1024).toFixed(1)}KB`,
      ratio: allStats.original > 0 ? `${((allStats.output / allStats.original) * 100).toFixed(0)}%` : "N/A",
    },
  };
  fs.writeFileSync(
    path.join(PROJECT_ROOT, "sviluppo", "build-manifest.json"),
    JSON.stringify(buildManifest, null, 2)
  );

  // Registra la build nel canary registry (storico per audit anti-clone)
  if (!NO_WATERMARK && !DEV_MODE) {
    CANARIES.builds = (CANARIES.builds || []).slice(-49);  // mantieni ultime 50
    CANARIES.builds.push({ buildId, version: VERSION, mode: buildMode, date: new Date().toISOString() });
    fs.writeFileSync(CANARIES_PATH, JSON.stringify(CANARIES, null, 2));
  }

  // Summary
  console.log(`\n=== Build completata ===`);
  console.log(`  Target:        ${Object.keys(results).join(", ")}`);
  console.log(`  JS originale:  ${buildManifest.sizes.originalJS}`);
  console.log(`  JS output:     ${buildManifest.sizes.outputJS} (${buildManifest.sizes.ratio})`);
  console.log(`  Build ID:      ${buildManifest.buildId}`);
  console.log(`\n  Prossimi passi:`);
  if (results.chrome) {
    console.log(`    Chrome: testa da sviluppo/build-chrome/ poi carica ${getZipName("chrome")}`);
  }
  if (results.firefox) {
    console.log(`    Firefox: testa da sviluppo/build-firefox/ poi carica ${getZipName("firefox")}`);
  }
  if (results.safari) {
    console.log(`    Safari: usa xcrun safari-web-extension-converter sviluppo/build-safari/ (richiede Xcode)`);
  }
  console.log(`    Edge/Opera: usano lo stesso ZIP Chrome`);
  if (!NO_WATERMARK && !DEV_MODE) {
    console.log(`    Verifica watermark: node sviluppo/scripts/verify-watermark.js <file.js>`);
  }
  console.log("");
}

// =============================================
// UTILITY
// =============================================

function copyFile(relativePath, appDir, buildDir) {
  const src = path.join(appDir, relativePath);
  const dst = path.join(buildDir, relativePath);
  if (fs.existsSync(src)) {
    fs.copyFileSync(src, dst);
  }
}

function copyDir(relativePath, appDir, buildDir) {
  const src = path.join(appDir, relativePath);
  const dst = path.join(buildDir, relativePath);
  if (!fs.existsSync(src)) return;
  if (!fs.existsSync(dst)) fs.mkdirSync(dst, { recursive: true });
  for (const file of fs.readdirSync(src)) {
    const srcFile = path.join(src, file);
    const dstFile = path.join(dst, file);
    if (fs.statSync(srcFile).isFile()) {
      fs.copyFileSync(srcFile, dstFile);
    }
  }
}

// =============================================
// RUN
// =============================================

build().catch((err) => {
  console.error("\nERRORE BUILD:", err.message);
  process.exit(1);
});

// Export per uso come modulo (verifica watermark)
module.exports = { decodeSteganographic, encodeSteganographic };
