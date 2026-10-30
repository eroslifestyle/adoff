#!/usr/bin/env node
/**
 * canary_runner.mjs - Verifica regression su canary sites CON candidate rules applicate.
 * Inietta le candidate rules nel DNR via service worker, poi naviga i canary.
 * Uso: node canary_runner.mjs [--candidates file.json] [--date YYYY-MM-DD] [--dry-run]
 */
import { chromium } from 'playwright-core';
import { readFileSync, existsSync } from 'fs';
import { join, dirname } from 'path';
import { fileURLToPath } from 'url';

const __dirname = dirname(fileURLToPath(import.meta.url));
const BASE = __dirname;

const CHROMIUM_PATH = '/home/mrxxx/.cache/ms-playwright/chromium-1223/chrome-linux64/chrome';
const EXT_PATH = '/mnt/backup/Dropbox/1 Programmazione/Progetti/ChromePlugin/app';
const CANARY_FILE = join(BASE, 'canary.json');
const CANDIDATES_FILE = (() => {
  const i = process.argv.indexOf('--candidates');
  return i >= 0 ? process.argv[i + 1] : join(BASE, 'candidate_rules', `${new Date().toISOString().slice(0,10)}.json`);
})();
const DRY_RUN = process.argv.includes('--dry-run');

const AD_NETWORKS = ['googlesyndication','googleadservices','doubleclick','googletagmanager',
  'adnxs','adsrvr','adform','criteo','taboola','outbrain','pubmatic','openx',
  'rubiconproject','smartadserver','bidswitch','casalemedia','sharethrough',
  'amazon-adsystem','media.net','adcolony','unity3d','applovin','facebook.net/tr',
  'connect.facebook.net/signals','bat.bing'];

const sleep = ms => new Promise(r => setTimeout(r, ms));

async function runCanary() {
  if (!existsSync(CANARY_FILE)) {
    console.error('canary.json non trovato'); process.exit(1);
  }
  const canaries = JSON.parse(readFileSync(CANARY_FILE, 'utf8')).canary_sites;

  let candidates = [];
  if (existsSync(CANDIDATES_FILE)) {
    candidates = JSON.parse(readFileSync(CANDIDATES_FILE, 'utf8')).candidates || [];
  }
  console.log(`\n=== Canary Regression Suite ===`);
  console.log(`Sites: ${canaries.length}  Candidates: ${candidates.length}  File: ${CANDIDATES_FILE}`);

  if (DRY_RUN) {
    console.log('DRY-RUN: nessun browser, mostra solo candidate rules');
    candidates.forEach(c => console.log(`  [${c.id}] ${c.condition?.urlFilter} domains=${JSON.stringify(c.condition?.domains)}`));
    return true;
  }

  // launchPersistentContext required for MV3 extension with service worker
  const context = await chromium.launchPersistentContext('', {
    executablePath: CHROMIUM_PATH,
    headless: false,
    args: [`--disable-extensions-except=${EXT_PATH}`,`--load-extension=${EXT_PATH}`,
      `--no-sandbox`,`--disable-setuid-sandbox`,`--disable-dev-shm-usage`]
  });

  // Wait for service worker to be available
  console.log('Attendo service worker...');
  let sw = context.serviceWorkers()[0];
  if (!sw) {
    try { sw = await context.waitForEvent('serviceworker', { timeout: 8000 }); }
    catch { console.error('Service worker non disponibile'); await context.close(); process.exit(1); }
  }
  await sleep(2000);

  // Inject candidate rules into DNR via the service worker.
  // Remap IDs to a temporary range (65000+) to avoid collision with the
  // remote feed rules (60000+) that the extension already loaded.
  // Strip underscore-prefixed custom fields (_fingerprint, _domain) — Chrome DNR
  // only accepts the standard declarativeNetRequest rule schema.
  const CANARY_BASE_ID = 65000;
  const remapped = candidates.map((c, i) => {
    const cleaned = Object.fromEntries(
      Object.entries(c).filter(([k]) => !k.startsWith('_'))
    );
    return { ...cleaned, id: CANARY_BASE_ID + i };
  });

  if (remapped.length > 0) {
    console.log(`Inietto ${remapped.length} candidate rules nel DNR (range 65000+)...`);
    const injectResult = await sw.evaluate(async (rules) => {
      return new Promise((resolve) => {
        try {
          chrome.declarativeNetRequest.updateDynamicRules({ addRules: rules }, () => {
            if (chrome.runtime.lastError) {
              resolve({ ok: false, error: chrome.runtime.lastError.message });
            } else {
              chrome.declarativeNetRequest.getDynamicRules((all) => {
                const injected = all.filter(r => r.id >= 65000).length;
                resolve({ ok: true, injected, total: all.length });
              });
            }
          });
        } catch (e) { resolve({ ok: false, error: e.message }); }
      });
    }, remapped);
    console.log(`  Inject result: ${JSON.stringify(injectResult)}`);
    if (!injectResult.ok) {
      console.error(`  ERRORE iniezione candidate rules: ${injectResult.error}`);
      await context.close();
      process.exit(1);
    }
  }

  const results = [];
  for (const site of canaries) {
    console.log(`\n[canary] ${site.domain}`);
    const page = await context.newPage();
    const leaks = [];

    page.on('request', req => {
      const u = req.url().toLowerCase();
      const m = AD_NETWORKS.find(n => u.includes(n));
      if (m) { leaks.push({ url: req.url(), net: m }); console.log(`    [LEAK] ${m}: ${req.url().slice(0,120)}`); }
    });

    try {
      await page.goto(`https://${site.domain}`, { waitUntil: 'domcontentloaded', timeout: 25000 });
      await sleep(1500);
    } catch (e) { console.log(`  Nav error: ${e.message.slice(0,60)}`); }
    await page.close();

    const status = leaks.length > 0 ? 'LEAK' : 'PASS';
    console.log(`  ${status}: ${leaks.length} ad-network requests`);
    results.push({ domain: site.domain, status, leaks: leaks.length });
  }

  await context.close();

  const passed = results.filter(r => r.status === 'PASS').length;
  const failed = results.filter(r => r.status === 'LEAK').length;
  console.log(`\n=== CANARY RESULT: ${passed} PASS, ${failed} FAILED ===`);
  if (failed > 0) {
    console.log('FAILED canaries:');
    results.filter(r => r.status === 'LEAK').forEach(r => console.log(`  ${r.domain}: ${r.leaks} leaks`));
  }
  return failed === 0;
}

runCanary()
  .then(ok => { process.exit(ok ? 0 : 1); })
  .catch(e => { console.error(e); process.exit(1); });

