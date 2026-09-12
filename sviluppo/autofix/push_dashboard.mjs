#!/usr/bin/env node
/**
 * push_dashboard.mjs - Invia leaks al backend AdOff dashboard.
 * Uso: node push_dashboard.mjs [--date YYYY-MM-DD] [--dry-run]
 */
import { readFileSync, writeFileSync, existsSync } from 'fs';
import { join, dirname } from 'path';
import { fileURLToPath } from 'url';

const __dirname = dirname(fileURLToPath(import.meta.url));
const BASE = __dirname;

const DATE = (() => {
  const i = process.argv.indexOf('--date');
  return i >= 0 ? process.argv[i + 1] : new Date().toISOString().slice(0, 10);
})();
const DRY_RUN = process.argv.includes('--dry-run');

const CANDIDATES_FILE = join(BASE, 'candidate_rules', `${DATE}.json`);
const STATE_FILE = join(BASE, 'logs', 'state.json');
const PAYLOAD_LOG = join(BASE, 'logs', `dashboard-payload-${DATE}.json`);

const ADMIN_TOKEN = process.env.ADMIN_TOKEN;
const API_URL = 'https://api.adoff.app/admin/autofix/ingest';

// ── helpers ───────────────────────────────────────────────────────────────────

function loadJson(path) {
  if (!existsSync(path)) return null;
  try { return JSON.parse(readFileSync(path, 'utf8')); }
  catch { return null; }
}

/** Read screenshot as base64, capped at maxBytes. */
function screenshotB64(fp, path, maxBytes = 4 * 1024 * 1024) {
  if (!path || !existsSync(path)) return null;
  try {
    const buf = readFileSync(path);
    if (buf.length > maxBytes) {
      console.warn(`  SKIP screenshot ${fp}: ${buf.length} bytes > ${maxBytes} cap`);
      return null;
    }
    return buf.toString('base64');
  } catch {
    return null;
  }
}

// ── build leaks[] ─────────────────────────────────────────────────────────────

function buildLeaks(candidatesData, stateData) {
  const tracked = stateData?.leaks || {};
  const detailMap = new Map();

  // Index by fingerprint from candidates data
  if (candidatesData?.leaks_detail) {
    for (const d of candidatesData.leaks_detail) {
      detailMap.set(d.fingerprint, d);
    }
  }

  // Union: all fingerprints from state
  const leaks = [];
  const now = new Date().toISOString();

  for (const [fp, trackedEntry] of Object.entries(tracked)) {
    const detail = detailMap.get(fp) || {};
    leaks.push({
      fingerprint: fp,
      domain: detail.domain ?? trackedEntry.domain ?? null,
      category: detail.category ?? trackedEntry.category ?? null,
      site_type: detail.site_type ?? trackedEntry.site_type ?? null,
      country: detail.country ?? trackedEntry.country ?? null,
      leak_type: detail.leak_type ?? trackedEntry.leak_type ?? null,
      ad_network: detail.ad_network ?? trackedEntry.ad_network ?? null,
      blocked_url: detail.blocked_url ?? trackedEntry.blocked_url ?? null,
      selector: detail.selector ?? trackedEntry.selector ?? null,
      candidate_rule: detail.candidate_rule ?? null,
      confidence: detail.confidence ?? trackedEntry.confidence ?? 'low',
      fp_suspect: detail.fp_suspect ?? trackedEntry.fp_suspect ?? 0,
      screenshot: detail.screenshot ?? null,
      last_seen: now
    });
  }

  return leaks;
}

// ── main ──────────────────────────────────────────────────────────────────────

async function main() {
  console.log(`\n=== Push Dashboard ${DATE} ===`);
  console.log(`Dry-run: ${DRY_RUN}`);

  if (!DRY_RUN && !ADMIN_TOKEN) {
    console.error('ERRORE: ADMIN_TOKEN env non impostato. Usa --dry-run per testare senza.');
    process.exit(1);
  }

  const candidatesData = loadJson(CANDIDATES_FILE);
  const stateData = loadJson(STATE_FILE);

  if (!candidatesData) {
    console.error(`ERRORE: ${CANDIDATES_FILE} non trovato. Eseguire prima analyze_and_fix.mjs.`);
    process.exit(1);
  }
  if (!stateData) {
    console.error(`ERRORE: ${STATE_FILE} non trovato.`);
    process.exit(1);
  }

  const leaks = buildLeaks(candidatesData, stateData);
  console.log(`Leaks da inviare: ${leaks.length}`);

  // Attach screenshots (base64)
  const shots = {};
  for (const leak of leaks) {
    if (leak.screenshot) {
      const b64 = screenshotB64(leak.fingerprint, leak.screenshot);
      if (b64) shots[leak.fingerprint] = b64;
    }
  }
  console.log(`Screenshot allegati: ${Object.keys(shots).length}`);

  const payload = { leaks, shots };

  if (DRY_RUN) {
    writeFileSync(PAYLOAD_LOG, JSON.stringify(payload, null, 2));
    console.log(`Payload salvato (dry-run): ${PAYLOAD_LOG}`);
    console.log(`Ingest: skipped`);
    return;
  }

  let res;
  try {
    res = await fetch(API_URL, {
      method: 'POST',
      headers: {
        'Content-Type': 'application/json',
        'X-Admin-Token': ADMIN_TOKEN
      },
      body: JSON.stringify(payload)
    });
  } catch (e) {
    console.error(`ERRORE network: ${e.message}`);
    process.exit(1);
  }

  const body = await res.text();
  let ingested = 0;
  try { const j = JSON.parse(body); ingested = j.ingested ?? 0; } catch {}

  console.log(`HTTP ${res.status}`);
  console.log(`Ingested: ${ingested}/${leaks.length}`);

  if (!res.ok) {
    console.error(`ERRORE risposta: ${body.slice(0, 300)}`);
    process.exit(1);
  }
}

main().catch(e => { console.error(e); process.exit(1); });
