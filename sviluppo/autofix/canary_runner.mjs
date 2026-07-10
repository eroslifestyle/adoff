#!/usr/bin/env node
/**
 * canary_runner.mjs - Verifica regression su canary sites.
 * Uso: node canary_runner.mjs [--candidates file.json] [--date YYYY-MM-DD] [--dry-run]
 */
import { chromium } from 'playwright-core';
import { readFileSync, existsSync, mkdirSync } from 'fs';
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
  console.log(`\n=== Canary Regression Suite ===`);
  console.log(`Sites: ${canaries.length}  Candidates: ${CANDIDATES_FILE}`);

  const browser = await chromium.launch({
    executablePath: CHROMIUM_PATH,
    headless: false,
    args: [`--disable-extensions-except=${EXT_PATH}`,`--load-extension=${EXT_PATH}`,
      `--no-sandbox`,`--disable-setuid-sandbox`,`--disable-dev-shm-usage`]
  });

  const results = [];
  for (const site of canaries) {
    console.log(`\n[canary] ${site.domain}`);
    const context = await browser.newContext({ viewport:{width:1280,height:800} });
    const page = await context.newPage();
    const leaks = [];

    page.on('request', req => {
      const u = req.url().toLowerCase();
      const m = AD_NETWORKS.find(n => u.includes(n));
      if (m) leaks.push({ url: req.url().slice(0,80), net: m });
    });

    try {
      await page.goto(`https://${site.domain}`, { waitUntil: 'networkidle', timeout: 25000 });
      await sleep(1500);
    } catch (e) { console.log(`  Nav error: ${e.message.slice(0,60)}`); }
    await context.close();

    const status = leaks.length > 0 ? 'LEAK' : 'PASS';
    console.log(`  ${status}: ${leaks.length} requests bloccate`);
    results.push({ domain: site.domain, status, leaks: leaks.length });
  }

  await browser.close();

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
