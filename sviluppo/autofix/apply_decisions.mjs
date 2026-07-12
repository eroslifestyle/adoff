#!/usr/bin/env node
/**
 * apply_decisions.mjs - Applica decisioni approvate al rules-feed.
 * Uso: node apply_decisions.mjs [--dry-run] [--auto-only]
 *
 * Legge i leaks con decisione "fix" e li applica al rules-feed.json.
 * --auto-only: processa SOLO leak auto-applicabili (network + confidence high/medium).
 * --dry-run: stampa il diff senza scrivere nulla.
 */
import { readFileSync, writeFileSync, existsSync, mkdirSync, copyFileSync } from 'fs';
import { join, dirname } from 'path';
import { fileURLToPath } from 'url';

const __dirname = dirname(fileURLToPath(import.meta.url));
const BASE = __dirname;

const DRY_RUN = process.argv.includes('--dry-run');
const AUTO_ONLY = process.argv.includes('--auto-only');

const API_URL = 'https://api.adoff.app/admin/autofix/leaks';
const DECISION_URL = 'https://api.adoff.app/admin/autofix/decision';
const ADMIN_TOKEN = process.env.ADMIN_TOKEN;

// Site root (parent of autofix's parent)
const SITE_BASE = join(BASE, '..', '..', 'site');
const RULES_FEED = join(SITE_BASE, 'rules-feed.json');
const SNAPSHOT_DIR = join(BASE, 'snapshots');
const APPLIED_LOG = join(BASE, 'logs', 'applied.json');
const STATE_FILE = join(BASE, 'logs', 'state.json');

mkdirSync(SNAPSHOT_DIR, { recursive: true });
mkdirSync(join(BASE, 'logs'), { recursive: true });

// ── helpers ───────────────────────────────────────────────────────────────────

function loadJson(path) {
  if (!existsSync(path)) return null;
  try { return JSON.parse(readFileSync(path, 'utf8')); }
  catch { return null; }
}

function saveJson(path, data) {
  writeFileSync(path, JSON.stringify(data, null, 2));
}

function isAutoApplicable(leak) {
  return (
    leak.leak_type === 'network_leak' &&
    leak.candidate_rule &&
    (leak.confidence === 'high' || leak.confidence === 'medium')
  );
}

/** Dedup key: urlFilter + domains[] string. */
function ruleDedupKey(rule) {
  return `${rule.condition.urlFilter}||${JSON.stringify(rule.condition.domains || [])}`;
}

// ── fetch leaks ───────────────────────────────────────────────────────────────

async function fetchLeaks() {
  if (!ADMIN_TOKEN) {
    console.error('ERRORE: ADMIN_TOKEN env non impostato.');
    process.exit(1);
  }
  let res;
  try {
    res = await fetch(API_URL, {
      headers: { 'X-Admin-Token': ADMIN_TOKEN }
    });
  } catch (e) {
    console.error(`ERRORE network fetch leaks: ${e.message}`);
    process.exit(1);
  }
  if (!res.ok) {
    console.error(`ERRORE fetch leaks: HTTP ${res.status}`);
    process.exit(1);
  }
  const body = await res.text();
  try { return JSON.parse(body); }
  catch { console.error('Risposta non-JSON'); process.exit(1); }
}

// ── apply ─────────────────────────────────────────────────────────────────────

async function main() {
  console.log(`\n=== Apply Decisions ===`);
  console.log(`Dry-run: ${DRY_RUN}, Auto-only: ${AUTO_ONLY}`);

  if (!DRY_RUN && !ADMIN_TOKEN) {
    console.error('ERRORE: ADMIN_TOKEN richiesto (usa --dry-run per testare senza).');
    process.exit(1);
  }

  // ── 1. Load current feed ──
  if (!existsSync(RULES_FEED)) {
    console.error(`ERRORE: ${RULES_FEED} non trovato.`);
    process.exit(1);
  }
  const feed = loadJson(RULES_FEED);
  const existingKeys = new Set(feed.rules.map(ruleDedupKey));

  // ── 2. Snapshot pre-modifica ──
  const ts = new Date().toISOString().replace(/[:.]/g, '-');
  const snapshotPath = join(SNAPSHOT_DIR, `rules-feed-${ts}.json`);
  if (!DRY_RUN) {
    copyFileSync(RULES_FEED, snapshotPath);
    console.log(`Snapshot: ${snapshotPath}`);
  } else {
    console.log(`[DRY] Snapshot skipped`);
  }

  // ── 3. Fetch leaks ──
  const leaksData = await fetchLeaks();
  // API returns { ok, counts, buckets: { ads_real, tracking, dom_fp }, ... }
  let allLeaks;
  if (Array.isArray(leaksData)) {
    allLeaks = leaksData;
  } else if (leaksData.buckets) {
    const b = leaksData.buckets;
    allLeaks = [
      ...(b.ads_real || []),
      ...(b.tracking || []),
      ...(b.dom_fp || []),
    ];
  } else {
    allLeaks = leaksData.leaks || [];
  }
  console.log(`Leaks totali dal server: ${allLeaks.length}`);

  // Filter: decision === 'fix' && applied !== true
  const toApply = allLeaks.filter(l => l.decision === 'fix' && l.applied !== true);
  console.log(`Leaks con decision=fix&applied≠1: ${toApply.length}`);

  // ── 4. Categorize ──
  const autoCandidates = [];   // network + confidence high/medium + has rule
  const manualCandidates = []; // has rule but AUTO_ONLY or confidence low
  const noRuleCandidates = []; // DOM leaks without candidate_rule

  for (const leak of toApply) {
    if (!leak.candidate_rule) {
      noRuleCandidates.push(leak);
      continue;
    }
    if (AUTO_ONLY) {
      if (isAutoApplicable(leak)) autoCandidates.push(leak);
      else manualCandidates.push(leak);
    } else {
      // Process all with candidate_rule
      if (isAutoApplicable(leak)) autoCandidates.push(leak);
      else manualCandidates.push(leak);
    }
  }

  console.log(`Auto-applicabili: ${autoCandidates.length}`);
  console.log(`Manuali (o skipped con --auto-only): ${manualCandidates.length}`);
  console.log(`Senza candidate_rule: ${noRuleCandidates.length}`);

  // ── 5. Build rule list (without id) ──
  const newRules = [];
  const alreadyInFeed = [];
  const appliedFps = [];

  for (const leak of autoCandidates) {
    const rule = { ...leak.candidate_rule };
    delete rule.id; // feed uses no id
    const key = ruleDedupKey(rule);
    if (existingKeys.has(key)) {
      alreadyInFeed.push(key);
    } else {
      newRules.push(rule);
      existingKeys.add(key);
      appliedFps.push(leak.fingerprint);
    }
  }

  if (DRY_RUN) {
    console.log(`\n[DRY-RUN] Regole che sarebbero aggiunte: ${newRules.length}`);
    console.log(`[DRY-RUN] Gia' presenti nel feed: ${alreadyInFeed.length}`);
    if (newRules.length > 0) {
      console.log('\nNuove regole:');
      newRules.forEach(r => console.log(`  ${r.condition.urlFilter} [${r.condition.domains?.join(', ')}]`));
    }
  } else {
    // ── 6. Write updated feed ──
    feed.rules = [...feed.rules, ...newRules];
    feed.updated = new Date().toISOString().slice(0, 10);
    feed._autofix = {
      date: new Date().toISOString(),
      applied_by: 'claude',
      count: newRules.length
    };
    saveJson(RULES_FEED, feed);
    console.log(`\nFeed aggiornato: +${newRules.length} regole (totale ${feed.rules.length})`);
    console.log(`Feed: ${RULES_FEED}`);

    // ── 7. Update local state ──
    const state = loadJson(STATE_FILE) || { version: 1, leaks: {} };
    const now = new Date().toISOString();
    for (const fp of appliedFps) {
      if (state.leaks[fp]) {
        state.leaks[fp].status = 'fixed';
        state.leaks[fp].updated = now;
      }
    }
    saveJson(STATE_FILE, state);

    // ── 8. Log applied ──
    const appliedLog = loadJson(APPLIED_LOG) || {};
    const dateKey = new Date().toISOString().slice(0, 10);
    appliedLog[dateKey] = appliedFps;
    saveJson(APPLIED_LOG, appliedLog);

    // ── 9. Notify applied ──
    console.log(`\nMARCA-APPLIED: endpoint /admin/autofix/decision con applied=1 non ancora implementato nel worker.`);
    console.log(`Fingerprints applicati (scritti localmente): ${appliedFps.length}`);
    console.log(`Log: ${APPLIED_LOG}`);
  }

  // ── 10. Summary ──
  console.log(`\n=== SUMMARY ===`);
  console.log(`Applicati: ${autoCandidates.length}`);
  console.log(`Saltati (manuali/no-rule): ${manualCandidates.length + noRuleCandidates.length}`);
  console.log(`Totale regole feed: ${DRY_RUN ? '?' : feed.rules.length}`);
  if (manualCandidates.length > 0) {
    console.log('\nRegole che richiedono intervento manuale:');
    manualCandidates.forEach(l => console.log(`  [${l.confidence}] ${l.domain} -> ${l.leak_type}`));
  }
}

main().catch(e => { console.error(e); process.exit(1); });
