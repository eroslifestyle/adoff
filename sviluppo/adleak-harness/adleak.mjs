#!/usr/bin/env node
// AdOff ad-leak harness — misura su quali siti reali l'estensione non blocca gli annunci
// o viene rilevata come ad blocker. ZERO dati utente: i domini sono nella lista locale.
//
// Criterio primario (rete): una richiesta che matcha l'urlFilter/regexFilter di una regola
// `block` di adblock-rules.json ma completa con successo = ad-leak.
// Criterio secondario (DOM): overlay visibile con formule anti-adblock multilingua = detection flag.
//
// Lancio browser: stesso pattern di sviluppo/marketing/demo/capture-demo.mjs
// (launchPersistentContext + --disable-extensions-except + --load-extension + executablePath).
//
// Uso: node adleak.mjs [--domains file] [--out dir] [--concurrency N] [--timeout-ms N]
//                      [--ab] [--no-extension] [dominio1 dominio2 ...]

import { chromium } from 'playwright';
import fs from 'fs';
import path from 'path';

const ROOT = path.resolve(import.meta.dirname, '..', '..'); // ChromePlugin/
const APP = process.env.ADOFF_APP || path.join(ROOT, 'app');
const RULES = path.join(APP, 'rules', 'adblock-rules.json');
const HERE = import.meta.dirname;
const DEFAULTS = {
  domains: path.join(HERE, 'domains.txt'),
  out: path.join(HERE, 'results'),
  concurrency: 2,
  timeoutMs: 45000,
  settleMs: 5000,
  ab: false,
};

// --- CLI ---
const args = process.argv.slice(2);
const opts = { ...DEFAULTS, domainsList: [] };
for (let i = 0; i < args.length; i++) {
  if (args[i] === '--domains') opts.domains = args[++i];
  else if (args[i] === '--out') opts.out = args[++i];
  else if (args[i] === '--concurrency') opts.concurrency = Math.max(1, +args[++i] || 1);
  else if (args[i] === '--timeout-ms') opts.timeoutMs = +args[++i] || DEFAULTS.timeoutMs;
  else if (args[i] === '--settle-ms') opts.settleMs = +args[++i] || DEFAULTS.settleMs;
  else if (args[i] === '--ab') opts.ab = true;
  else if (args[i] === '--no-extension') opts.noExt = true;
  else if (!args[i].startsWith('--')) opts.domainsList.push(args[i].replace(/^https?:\/\//, '').split('/')[0]);
}

// --- Oracolo: carica le regole DNR ---
const dnrRules = JSON.parse(fs.readFileSync(RULES, 'utf8'));
const TRACKING_EXCLUDED_IDS = new Set([4, 5, 20, 21, 22, 80, 81, 82, 83, 84, 85, 86, 87, 88, 89, 90, 175, 176, 180, 181, 183, 190, 191, 211]);
const blockRules = dnrRules.filter(r => r.action.type === 'block');
const allowRules = dnrRules.filter(r => r.action.type === 'allow');
const netTypes = new Set(['script', 'image', 'xmlhttprequest', 'sub_frame', 'media', 'font', 'stylesheet', 'ping', 'websocket', 'other', 'main_frame']);

// Matching DNR semplificato ma fedele: ||host, |left anchor, | right anchor, separatore ^, wildcard *
function urlFilterToRegExp(f) {
  let re = '';
  for (let i = 0; i < f.length; i++) {
    const c = f[i];
    if (c === '|' && f[i + 1] === '|') { i++; re += '^[a-z][a-z0-9+.-]*://([^/?#]*\\.)?'; }
    else if (c === '|' && i === 0) re += '^';
    else if (c === '|' && i === f.length - 1) re += '$';
    else if (c === '^') re += '([^a-zA-Z0-9._%\\-]|$)';
    else if (c === '*') re += '.*';
    else re += c.replace(/[.+?{}()[\]\\]/g, '\\$&');
  }
  return new RegExp(re, 'i');
}

//(regex per urlFilter precompilata una volta)
const compiled = dnrRules.map(r => {
  const c = r.condition;
  let filter = null;
  if (c.urlFilter) filter = urlFilterToRegExp(c.urlFilter);
  else if (c.regexFilter) filter = new RegExp(c.regexFilter, c.isUrlFilterCaseSensitive ? '' : 'i');
  return { r, filter, excluded: new Set(c.excludedInitiatorDomains || []), included: c.initiatorDomains || null };
});

const PLAYABLE = new Set(['script', 'image', 'xmlhttprequest', 'sub_frame', 'media', 'font', 'stylesheet', 'ping', 'websocket', 'other']);

function dnrMatch(url, resourceType, initiatorDomain) {
  for (const { r, filter, excluded, included } of compiled) {
    if (r.action.type === 'allow') continue; // gestito dopo
    const c = r.condition;
    if (!c.resourceTypes.includes('main_frame') && !PLAYABLE.has(resourceType)) continue;
    if (!c.resourceTypes.includes(resourceType === 'document' ? 'main_frame' : resourceType)) continue;
    if (included && !included.includes(initiatorDomain)) continue;
    if (excluded.has(initiatorDomain)) continue;
    if (filter && !filter.test(url)) continue;
    return r;
  }
  // allow rule: se una allow matcha dopo un block candidate, DNR dà precedenza alla allow con priorità >=.
  return null;
}

// Nel DNR le allow vincono a parità di priorità più alta; qui l'unica allow (rule 910, GTM broadcaster)
// deve neutralizzare i block che matchano lo stesso URL.
function blockedBy(url, resourceType, initiatorDomain) {
  const hit = dnrMatch(url, resourceType, initiatorDomain);
  if (!hit) return null;
  for (const ar of allowRules) {
    const c = ar.condition;
    if (!c.resourceTypes.includes(resourceType === 'document' ? 'main_frame' : resourceType)) continue;
    if (!dnrMatchAllow(ar, url, initiatorDomain)) continue;
    return null; // allow vince
  }
  return hit;
}
function dnrMatchAllow(ar, url, initiatorDomain) {
  const c = ar.condition;
  const { filter, excluded, included } = (ar._c ||= { filter: c.urlFilter ? urlFilterToRegExp(c.urlFilter) : c.regexFilter ? new RegExp(c.regexFilter, 'i') : null, excluded: new Set(c.excludedInitiatorDomains || []), included: c.initiatorDomains || null });
  if (included && !included.includes(initiatorDomain)) return false;
  if (excluded.has(initiatorDomain)) return false;
  if (filter && !filter.test(url)) return false;
  return true;
}

// --- Formule anti-adblock multilingua (per l'overlay detection) ---
const ADBLOCK_PATTERNS = [
  /ad[-\s]?block/i, /adblock/i, /ad\s?blocker/i, /disable.{0,20}(ad|advertisement)/i,
  /disattiva.{0,20}(ad|pubblicit)/i, /blocco.{0,10}pubblicit/i, /annunci.{0,20}(bloccat|disattivat)/i,
  /werbeblocker/i, /werbung.{0,20}(deaktiv|blockier)/i, /bloqueador\s?de\s?anuncios/i, /desactiva.{0,20}(adblock|bloqueador)/i,
  /bloqueador|\bpublicit(é|e)s?.{0,20}bloqu/i, /блокировщик/i, /отключите.{0,20}блок/i,
  /广告拦截/i, /拦截广告/i, /reklam.{0,10}engel/i, /reklamlar.{0,15}(engel|kapat)/i,
  /reklam.{0,10}blok/i, /adblok/i, /اعلام/i, /أدبلوك/i,
];

async function detectAdblockBanner(page) {
  return page.evaluate((patternsSrc) => {
    const patterns = patternsSrc.map(s => new RegExp(s.src, s.flags));
    const hits = [];
    const candidates = [...document.querySelectorAll('body *')].slice(0, 4000);
    for (const el of candidates) {
      const cs = getComputedStyle(el);
      if (cs.display === 'none' || cs.visibility === 'hidden' || +cs.opacity === 0) continue;
      const r = el.getBoundingClientRect();
      if (r.width < 100 || r.height < 50) continue;
      const pos = cs.position;
      if (pos !== 'fixed' && pos !== 'absolute' && +cs.zIndex < 100 && pos !== 'sticky') {
        // non-overlay: accetta solo se copre gran parte dello schermo (full-page gate)
        if (r.height < window.innerHeight * 0.5) continue;
      }
      const text = (el.innerText || '').slice(0, 400);
      if (!text || text.length > 600) continue;
      for (const p of patterns) {
        if (p.test(text)) { hits.push({ tag: el.tagName, cls: String(el.className).slice(0, 100), snippet: text.slice(0, 160), matched: p.source }); break; }
      }
    }
    return hits.slice(0, 5);
  }, ADBLOCK_PATTERNS.map(p => ({ src: p.source, flags: p.flags })));
}

// --- Visita di un dominio ---
async function visitDomain(domain, { withExtension, browserOpts, opts }) {
  const ctx = await chromium.launchPersistentContext(
    `/tmp/adleak-${withExtension ? 'ext' : 'plain'}-${Date.now()}-${Math.floor(Math.random() * 1e6)}`,
    { ...browserOpts, args: withExtension ? [...browserOpts.args, `--disable-extensions-except=${APP}`, `--load-extension=${APP}`] : browserOpts.args }
  );
  const result = { domain, withExtension, leakCount: 0, leaks: [], detection: [], requestsTotal: 0, error: null, httpStatus: null };
  try {
    const page = await ctx.newPage();
    page.setDefaultTimeout(opts.timeoutMs);
    const initiator = domain;
    page.on('requestfinished', async (req) => {
      try {
        result.requestsTotal++;
        const rt = req.resourceType();
        if (!netTypes.has(rt)) return;
        const u = req.url();
        const rule = blockedBy(u, rt, initiator);
        if (rule) {
          result.leaks.push({ ruleId: rule.id, urlFilter: rule.condition.urlFilter || rule.condition.regexFilter, resourceType: rt, url: u.slice(0, 200), trackingExcluded: TRACKING_EXCLUDED_IDS.has(rule.id) });
        }
      } catch { /* response may be gone */ }
    });
    const resp = await page.goto(`https://${domain}`, { waitUntil: 'domcontentloaded', timeout: opts.timeoutMs });
    result.httpStatus = resp ? resp.status() : null;
    await page.waitForTimeout(opts.settleMs);
    if (withExtension) {
      try { result.detection = await detectAdblockBanner(page); } catch (e) { /* page navigated away */ }
    }
  } catch (e) {
    result.error = String(e && e.message || e).slice(0, 300);
  } finally {
    await ctx.close().catch(() => {});
  }
  result.leakCount = result.leaks.length;
  return result;
}

// --- Main ---
const stamp = new Date().toISOString().replace(/[:.]/g, '-').slice(0, 19);
fs.mkdirSync(opts.out, { recursive: true });

let domains = opts.domainsList;
if (!domains.length) {
  domains = fs.readFileSync(opts.domains, 'utf8').split('\n').map(l => l.trim()).filter(l => l && !l.startsWith('#'));
}
if (!domains.length) { console.error('Nessun dominio da testare'); process.exit(1); }

const exe = ['/home/mrxxx/.cache/ms-playwright/chromium-1234/chrome-linux64/chrome',
             '/home/mrxxx/.cache/ms-playwright/chromium-1228/chrome-linux64/chrome',
             '/home/mrxxx/.cache/ms-playwright/chromium-1223/chrome-linux64/chrome'].find(p => fs.existsSync(p));
if (!exe) { console.error('Chromium Playwright non trovato in ~/.cache/ms-playwright'); process.exit(1); }

const browserOpts = {
  headless: true, // headless=new in Chromium supporta --load-extension dal 2024+
  executablePath: exe,
  viewport: { width: 1280, height: 900 },
  args: ['--no-first-run', '--no-default-browser-check', '--disable-blink-features=AutomationControlled'],
};

console.log(`AdOff ad-leak harness — ${domains.length} domini, estensione: ${opts.noExt ? 'NO' : 'SI'} (${APP})`);
const jobs = [];
for (const d of domains) jobs.push({ domain: d, withExtension: !opts.noExt });
if (opts.ab) for (const d of domains) jobs.push({ domain: d, withExtension: false });

const results = [];
let idx = 0;
async function worker(wid) {
  while (idx < jobs.length) {
    const job = jobs[idx++];
    process.stdout.write(`[${wid}] ${job.domain}${job.withExtension ? '' : ' (no-ext)'} ... `);
    const t0 = Date.now();
    const r = await visitDomain(job.domain, { withExtension: job.withExtension, browserOpts, opts });
    console.log(`${r.error ? 'ERRORE: ' + r.error.slice(0, 80) : `ok ${r.leakCount} leak, ${r.detection.length} detection`} (${((Date.now() - t0) / 1000).toFixed(1)}s)`);
    results.push(r);
  }
}
await Promise.all(Array.from({ length: opts.concurrency }, (_, i) => worker(i + 1)));

const run = { timestamp: new Date().toISOString(), extensionPath: APP, rulesFile: RULES, options: opts, results };
const outFile = path.join(opts.out, `adleak-${stamp}.json`);
fs.writeFileSync(outFile, JSON.stringify(run, null, 2));

// --- Riepilogo leggibile ---
console.log('\n=== RIEPILOGO ===');
const byDomain = new Map();
for (const r of results) {
  const k = r.domain;
  if (!byDomain.has(k)) byDomain.set(k, {});
  const slot = byDomain.get(k);
  if (r.withExtension) Object.assign(slot, { ext: r });
  else slot.plain = r;
}
for (const [d, s] of byDomain) {
  const ext = s.ext;
  if (!ext) continue;
  const status = ext.error ? `ERRORE: ${ext.error.slice(0, 100)}` : `http ${ext.httpStatus}, ${ext.requestsTotal} richieste`;
  console.log(`\n# ${d} — ${status}`);
  if (ext.error) continue;
  const leaks = ext.leaks;
  const counted = leaks.filter(l => !l.trackingExcluded);
  console.log(`  leak: ${leaks.length} (${counted.length} ads reali, ${leaks.length - counted.length} tracking-esclusi)`);
  const byRule = new Map();
  for (const l of leaks) {
    if (!byRule.has(l.ruleId)) byRule.set(l.ruleId, { f: l.urlFilter, n: 0, urls: [] });
    byRule.get(l.ruleId).n++;
    if (byRule.get(l.ruleId).urls.length < 2) byRule.get(l.ruleId).urls.push(l.url);
  }
  for (const [id, v] of [...byRule].sort((a, b) => b[1].n - a[1].n)) {
    const t = TRACKING_EXCLUDED_IDS.has(id) ? ' [tracking, escluso dal conteggio]' : '';
    console.log(`  - rule ${id}${t}: ${v.f} (${v.n}x) es. ${v.urls[0]}`);
  }
  if (ext.detection.length) for (const det of ext.detection) console.log(`  DETECTION: [${det.tag}.${det.cls}] "${det.snippet}" (pattern: ${det.matched})`);
  if (s.plain && !s.plain.error) console.log(`  A/B no-ext: ${s.plain.leaks.length} leak potenziali, ${s.plain.requestsTotal} richieste`);
}
console.log(`\nJSON completo: ${outFile}`);
