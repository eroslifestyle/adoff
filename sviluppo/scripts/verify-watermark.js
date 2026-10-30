#!/usr/bin/env node
/**
 * AdOff — Watermark Verifier
 *
 * Cerca e decodifica watermark steganografici nei file JS.
 * Utile per verificare se un competitor ha clonato il nostro codice.
 *
 * Uso:
 *   node sviluppo/scripts/verify-watermark.js <file.js>
 *   node sviluppo/scripts/verify-watermark.js sviluppo/build/src/stealth.js
 *   node sviluppo/scripts/verify-watermark.js competitor-extension/content.js
 */
"use strict";

const fs = require("fs");
const path = require("path");

const ZERO = "\u200B";
const ONE = "\u200C";
const SEP = "\u200D";
const MARKER = "\uFEFF";

function decodeSteganographic(encoded) {
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

function findWatermarks(code) {
  const results = [];
  let searchFrom = 0;

  while (true) {
    const start = code.indexOf(MARKER, searchFrom);
    if (start === -1) break;
    const end = code.indexOf(MARKER, start + 1);
    if (end === -1) break;

    const segment = code.slice(start, end + 1);
    const decoded = decodeSteganographic(segment);
    if (decoded && decoded.startsWith("adoff:")) {
      const parts = decoded.split(":");
      results.push({
        raw: decoded,
        buildId: parts[1] || "unknown",
        filename: parts[2] || "unknown",
        position: start,
      });
    }
    searchFrom = end + 1;
  }

  return results;
}

// =============================================
// CLI
// =============================================

const filePath = process.argv[2];

if (!filePath) {
  console.log("Uso: node verify-watermark.js <file.js>");
  console.log("");
  console.log("Cerca watermark steganografici AdOff in un file JavaScript.");
  console.log("Utile per verificare se un'estensione concorrente contiene nostro codice.");
  process.exit(1);
}

const resolvedPath = path.resolve(filePath);
if (!fs.existsSync(resolvedPath)) {
  console.error(`File non trovato: ${resolvedPath}`);
  process.exit(1);
}

const code = fs.readFileSync(resolvedPath, "utf-8");
const watermarks = findWatermarks(code);

// Conta anche zero-width chars generici (indizio di watermark anche se non decodificabile)
const zwCount = (code.match(/[\u200B\u200C\u200D\uFEFF]/g) || []).length;

console.log(`\n=== AdOff Watermark Verifier ===\n`);
console.log(`  File: ${resolvedPath}`);
console.log(`  Size: ${(Buffer.byteLength(code, "utf-8") / 1024).toFixed(1)}KB`);
console.log(`  Zero-width chars trovati: ${zwCount}`);
console.log("");

if (watermarks.length > 0) {
  console.log(`  WATERMARK TROVATI: ${watermarks.length}\n`);
  for (const wm of watermarks) {
    console.log(`  Build ID:  ${wm.buildId}`);
    console.log(`  File orig: ${wm.filename}`);
    console.log(`  Posizione: char ${wm.position}`);
    console.log(`  Raw:       ${wm.raw}`);
    console.log("");
  }
  console.log("  QUESTO FILE CONTIENE CODICE ADOFF.");
  console.log("  Conservare questo output come prova di clonazione.");
} else if (zwCount > 10) {
  console.log("  Nessun watermark AdOff decodificato, ma ci sono");
  console.log(`  ${zwCount} caratteri zero-width — potrebbe essere stato`);
  console.log("  parzialmente offuscato o modificato.");
} else {
  console.log("  Nessun watermark AdOff trovato.");
}

console.log("");
