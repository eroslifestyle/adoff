#!/usr/bin/env node
/**
 * crawl.mjs — Crawler notturno Auto-Fix per AdOff.
 * Uso: node crawl.mjs [--limit N] [--date YYYY-MM-DD] [--dry-run]
 * Output: findings/{date}.json
 */
import { chromium } from 'playwright';
import { readFileSync, writeFileSync, mkdirSync, existsSync } from 'fs';
import { join, dirname } from 'path';
import { fileURLToPath } from 'url';

const __dirname = dirname(fileURLToPath(import.meta.url));
const BASE = __dirname;

const CHROMIUM_PATH = '/home/mrxxx/.cache/ms-playwright/chromium-1223/chrome-linux64/chrome';
const EXT_PATH = '/mnt/backup/Dropbox/1 Programmazione/Progetti/ChromePlugin/app';
const TARGETS_FILE = join(BASE, 'targets.json');
const FINDINGS_DIR = join(BASE, 'findings');

const DATE = (() => {
  const i = process.argv.indexOf('--date');
  return i >= 0 ? process.argv[i + 1] : new Date().toISOString().slice(0, 10);
})();
const LIMIT = (() => { const i = process.argv.indexOf('--limit'); return i >= 0 ? parseInt(process.argv[i + 1]) : null; })();
const DRY_RUN = process.argv.includes('--dry-run');

const AD_NETWORKS = [
  'googlesyndication', 'googleadservices', 'doubleclick', 'googletagmanager',
  'adnxs', 'adsrvr', 'adform', 'criteo', 'taboola', 'outbrain',
  'pubmatic', 'openx', 'rubiconproject', 'smartadserver', 'bidswitch',
  'casalemedia', 'sharethrough', 'spotxchange', 'themediagrid', 'tradedoubler',
  'amazon-adsystem', 'media.net', 'adcolony', 'unity3d', 'applovin',
  'facebook.net/tr', 'connect.facebook.net/signals', 'bat.bing',
  'analytics', 'tracking', 'clicktrack', 'pixel', 'beacon'
];

const CMP_SELECTORS = [
  '#onetrust-banner-sdk', '#onetrust-consent-sdk', '.qc-cmp-ui-container',
  '.cc-window', '#cookie-law-info-bar', '.cookie-banner', '[aria-label*="cookie"]',
  '.privacy-banner', '#CybotCookiebotDialog'
];

function sleep(ms) { return new Promise( r => setTimeout(r, ms)); }

function simpleHash(str) {
  let h = 0;
  for (let i = 0; i < str.length; i++) {
    h = ((h << 5) - h) + str.charCodeAt(i);
    h |= 0;
  }
  return Math.abs(h).toString(16);
}

function normalizeUrl(url) {
  try {
    const u = new URL(url);
    return u.hostname + u.pathname.slice(0, 50);
  } catch { return url; }
}

async function dismissCMP(page) {
  for (const sel of CMP_SELECTORS) {
    try {
      const el = await page.$(sel);
      if (el) {
        const btn = await el.$('button[aria-acceptall], button[title*="Accept"], button:has-text("Accept"), button:has-text("OK")');
        if (btn) { await btn.click(); await sleep(500); return true; }
        const reject = await el.$('button[aria-rejectall], button[title*="Reject"]');
        if (reject) { await reject.click(); await sleep(500); return true; }
      }
    } catch {}
  }
  return false;
}

async function crawl() {
  mkdirSync(FINDINGS_DIR, { recursive: true });

  if (!existsSync(TARGETS_FILE)) {
    console.error('ERRORE: targets.json non trovato. Esegui prima build_target_list.py');
    process.exit(1);
  }
  const targets = JSON.parse(readFileSync(TARGETS_FILE, 'utf8')).targets;
  const targetsToCrawl = LIMIT ? targets.slice(0, LIMIT) : targets;

  console.log(`=== AdOff Crawler ${DATE} ===`);
  console.log(`Siti: ${targetsToCrawl.length} / ${targets.length} totali, Dry-run: ${DRY_RUN}`);

  const browser = await chromium.launch({
    executablePath: CHROMIUM_PATH,
    headless: false,
    args: [
      `--disable-extensions-except=${EXT_PATH}`,
      `--load-extension=${EXT_PATH}`,
      `--no-sandbox`, `--disable-setuid-sandbox`, `--disable-dev-shm-usage`,
      `--lang=it-IT`,
    ]
  });

  const AD_CSS_PATTERNS = [
    'advertisement', 'sponsor', 'sponsored', 'promotion', 'banner-ad',
    '[class*="ad-"]', '[id*="ad-"]', '[class*=" Ads"]', '[id*=" GoogleAds"]'
  ];

  const findings = [];
  let processed = 0;

  for (const target of targetsToCrawl) {
    processed++;
    const url = target.site_type === 'video' && target.domain === 'youtube.com'
      ? 'https://www.youtube.com/watch?v=dQw4w9WgXcQ'
      : `https://${target.domain}`;

    console.log(`\n[${processed}/${targetsToCrawl.length}] ${target.domain} (${target.category})`);

    if (DRY_RUN) {
      console.log(`  DRY-RUN: salterei ${url}`);
      continue;
    }

    const context = await browser.newContext({
      viewport: { width: 1280, height: 800 },
      userAgent: 'Mozilla/5.0 (X11; Linux x86_64) AppleWebKit/537.36 Chrome/122.0.0.0 Safari/537.36',
      ignoreHTTPSErrors: true,
    });

    const page = await context.newPage();
    const blockedUrls = [];
    const domAds = [];

    page.on('request', req => {
      const urlLower = req.url().toLowerCase();
      const matched = AD_NETWORKS.find(net => urlLower.includes(net));
      if (matched) {
        blockedUrls.push({ url: normalizeUrl(req.url()), network: matched, method: req.method() });
      }
    });

    const detectDomAds = async () => {
      for (const sel of AD_CSS_PATTERNS) {
        try {
          const els = await page.$$(sel);
          for (const el of els) {
            const box = await el.boundingBox();
            const visible = box && box.width > 10 && box.height > 10;
            if (visible) {
              const text = (await el.innerText().catch(() => '')).slice(0, 100);
              const cls = (await el.getAttribute('class').catch(() => '')).slice(0, 100);
              domAds.push({ selector: sel, text, class: cls, box });
            }
          }
        } catch {}
      }
    };

    let screenshotPath = null;
    try {
      await page.goto(url, { waitUntil: 'networkidle', timeout: 30000 });
      await sleep(1000);
      const cmpDismissed = await dismissCMP(page);
      if (cmpDismissed) console.log(`  CMP dismissed`);
      if (target.site_type === 'video' || target.site_type === 'player') {
        console.log(`  Attendo video ads...`);
        await sleep(5000);
      }
      await detectDomAds();
      const screenshotDir = join(FINDINGS_DIR, 'screenshots', DATE);
      mkdirSync(screenshotDir, { recursive: true });
      screenshotPath = join(screenshotDir, `${target.domain.replace(/\./g, '_')}.png`);
      await page.screenshot({ path: screenshotPath, fullPage: false });
      console.log(`  Screenshot salvato`);
    } catch (e) {
      console.log(`  ERRORE: ${e.message.slice(0, 80)}`);
    }

    await context.close();

    const leakTypes = [];
    if (blockedUrls.length > 0) leakTypes.push('network_leak');
    if (domAds.length > 0) leakTypes.push('dom_visible_ad');

    if (leakTypes.length === 0) {
      console.log(`  Nessun leak`);
    } else {
      console.log(`  LEAK: ${leakTypes.join(', ')}`);
      findings.push({
        domain: target.domain,
        category: target.category,
        site_type: target.site_type,
        country: target.country,
        ts: new Date().toISOString(),
        leak_types: leakTypes,
        blocked_urls: blockedUrls.slice(0, 20),
        dom_ads: domAds.slice(0, 10),
        screenshot: screenshotPath,
        fingerprint: simpleHash(`${target.domain}:${leakTypes.join(':')}`)
      });
    }
  }

  await browser.close();

  if (!DRY_RUN) {
    const findingsFile = join(FINDINGS_DIR, `${DATE}.json`);
    const allFindings = existsSync(findingsFile)
      ? JSON.parse(readFileSync(findingsFile, 'utf8'))
      : { date: DATE, runs: [] };

    allFindings.runs.push({
      ts: new Date().toISOString(),
      targets_count: targetsToCrawl.length,
      findings,
      targets_fingerprint: JSON.parse(readFileSync(TARGETS_FILE)).fingerprint
    });

    writeFileSync(findingsFile, JSON.stringify(allFindings, null, 2));
    console.log(`\n=== RISULTATO ===`);
    console.log(`Siti testati: ${targetsToCrawl.length}`);
    console.log(`Leak trovati: ${findings.length}`);
    console.log(`Output: ${findingsFile}`);
    if (findings.length > 0) {
      findings.forEach(f => console.log(`  ${f.domain}: ${f.leak_types.join(', ')}`));
    }
  } else {
    console.log(`\n=== DRY-RUN COMPLETE: avrei testato ${targetsToCrawl.length} siti ===`);
  }
}

crawl().catch(e => { console.error(e); process.exit(1); });
