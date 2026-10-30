// Deep i18n / language-switch audit of the LIVE adoff.app site.
// Navigates like a human (real Chromium), waits for the i18n render,
// records the served <html lang>, title, hero text, language leaks, 404s,
// and exercises the real language-switcher dropdown.
//
// Run: node sviluppo/tests/i18n-deep-audit.mjs
import pw from '/mnt/backup/Dropbox/1 Programmazione/Progetti/ChromePlugin/sviluppo/marketing/demo/node_modules/playwright/index.js';
const { chromium } = pw;
import { writeFileSync } from 'node:fs';

const BASE = 'https://adoff.app';
const LANGS = ['it','en','de','fr','es','pt','ru','ar','zh','hi','ja','ko','tr','id','pl'];
const LOCALE = { it:'it-IT', en:'en-US', de:'de-DE', fr:'fr-FR', es:'es-ES', pt:'pt-PT', ru:'ru-RU', ar:'ar-SA', zh:'zh-CN', hi:'hi-IN', ja:'ja-JP', ko:'ko-KR', tr:'tr-TR', id:'id-ID', pl:'pl-PL' };

// Marker words that, if found on a page NOT of that language, signal a leak.
const LEAK_MARKERS = {
  it: ['Niente pubblicità', 'Funziona su ogni sito', 'Senza configurare', 'Scarica gratis', 'Chi sono'],
  en: ['Works on every site', 'Without configuring', 'Install Free', 'No ads, not even'],
};

// The destinations the nav exposes, expressed as a logical page key.
// We resolve the real URL per language using the SAME logic as adoff-nav.js.
const NAV_PAGES = ['home','unique-tech','support','about','guide','community','install','press','how-it-works','privacy','terms'];

function resolveUrl(page, lang) {
  const lq = lang !== 'it' ? `?lang=${lang}` : '';
  switch (page) {
    case 'home':        return `${BASE}/${lq}`;
    case 'unique-tech': return lang === 'en' ? `${BASE}/unique-tech.html` : `${BASE}/${lang}/unique-tech.html`;
    case 'support':     return `${BASE}/support${lq}`;
    case 'about':       return lang === 'it' ? `${BASE}/chi-sono.html` : `${BASE}/about.html${lq}`;
    case 'guide':       return lang === 'it' ? `${BASE}/guide` : `${BASE}/${lang}/guide`;
    case 'community':   return lang === 'en' ? `${BASE}/community` : `${BASE}/${lang}/community`;
    case 'install':     return `${BASE}/install${lq}`;
    case 'press':       return lang === 'en' ? `${BASE}/press` : `${BASE}/${lang}/press`;
    case 'how-it-works':return lang === 'en' ? `${BASE}/how-it-works` : `${BASE}/${lang}/how-it-works`;
    case 'privacy':     return lang === 'en' ? `${BASE}/privacy` : `${BASE}/${lang}/privacy`;
    case 'terms':       return lang === 'en' ? `${BASE}/terms` : `${BASE}/${lang}/terms`;
    default: return `${BASE}/${lq}`;
  }
}

function leaksFor(lang) {
  // a page in `lang` leaks if it contains markers of a DIFFERENT language
  const out = [];
  for (const [mlang, words] of Object.entries(LEAK_MARKERS)) {
    if (mlang === lang) continue;
    out.push([mlang, words]);
  }
  return out;
}

async function auditPage(browser, url, lang, page) {
  const ctx = await browser.newContext({ viewport: { width: 1280, height: 900 }, locale: LOCALE[lang] || 'en-US' });
  const p = await ctx.newPage();
  const rec = { lang, page, url, status: null, htmlLang: null, title: null, h1: null, leaks: [], err: null };
  try {
    const resp = await p.goto(url, { waitUntil: 'domcontentloaded', timeout: 25000 });
    rec.status = resp ? resp.status() : null;
    // wait for i18n to settle (it sets data-i18n-ready, capped 2s in the app)
    await p.waitForTimeout(2300);
    rec.htmlLang = await p.evaluate(() => document.documentElement.getAttribute('lang'));
    rec.title = (await p.title()).slice(0, 90);
    rec.h1 = await p.evaluate(() => {
      const h = document.querySelector('h1');
      return h ? h.innerText.replace(/\s+/g, ' ').trim().slice(0, 90) : null;
    });
    const bodyText = await p.evaluate(() => document.body.innerText);
    for (const [mlang, words] of leaksFor(lang)) {
      for (const w of words) {
        if (bodyText.includes(w)) { rec.leaks.push(`${mlang}:"${w}"`); break; }
      }
    }
  } catch (e) {
    rec.err = String(e.message || e).slice(0, 120);
  } finally {
    await p.close();
    await ctx.close();
  }
  return rec;
}

// Test the REAL switcher: from a starting page, open dropdown, click target lang,
// confirm navigation + served lang.
async function auditSwitcher(browser, startUrl, fromLang, toLang) {
  const ctx = await browser.newContext({ locale: LOCALE[fromLang] || 'en-US' });
  const p = await ctx.newPage();
  const rec = { test: 'switcher', from: fromLang, to: toLang, startUrl, finalUrl: null, htmlLang: null, ok: false, err: null };
  try {
    await p.goto(startUrl, { waitUntil: 'domcontentloaded', timeout: 25000 });
    await p.waitForTimeout(1500);
    // open dropdown
    await p.click('#snLangBtn', { timeout: 5000 });
    await p.waitForTimeout(300);
    await p.click(`#snLangDd button[data-lang="${toLang}"]`, { timeout: 5000 });
    await p.waitForTimeout(2500);
    rec.finalUrl = p.url();
    rec.htmlLang = await p.evaluate(() => document.documentElement.getAttribute('lang'));
    // also read i18n active lang if present
    const activeLang = await p.evaluate(() => {
      try { return localStorage.getItem('adoff_lang'); } catch(e) { return null; }
    });
    rec.activeLang = activeLang;
    rec.ok = (rec.htmlLang === toLang);
  } catch (e) {
    rec.err = String(e.message || e).slice(0, 120);
  } finally {
    await p.close();
    await ctx.close();
  }
  return rec;
}

async function pool(items, worker, concurrency = 6) {
  const results = [];
  let idx = 0;
  async function run() {
    while (idx < items.length) {
      const my = idx++;
      results[my] = await worker(items[my], my);
    }
  }
  await Promise.all(Array.from({ length: concurrency }, run));
  return results;
}

(async () => {
  const browser = await chromium.launch({ headless: true, executablePath: '/home/mrxxx/.cache/ms-playwright/chromium-1223/chrome-linux64/chrome' });

  // 1) page audit across all langs (isolated context + native locale per lang)
  const jobs = [];
  for (const lang of LANGS) for (const page of NAV_PAGES) jobs.push({ lang, page, url: resolveUrl(page, lang) });
  console.error(`Auditing ${jobs.length} page-loads...`);
  const pageResults = await pool(jobs, (j) => auditPage(browser, j.url, j.lang, j.page), 6);

  // 2) switcher audit: from IT home and from EN home, switch to a sample of langs
  const switchTargets = ['en','de','fr','zh','ar','ru','ja'];
  const swJobs = [];
  for (const to of switchTargets) swJobs.push({ start: `${BASE}/`, from: 'it', to });
  swJobs.push({ start: `${BASE}/?lang=en`, from: 'en', to: 'it' });
  swJobs.push({ start: `${BASE}/en/how-it-works`, from: 'en', to: 'de' });
  swJobs.push({ start: `${BASE}/de/guide`, from: 'de', to: 'fr' });
  console.error(`Testing ${swJobs.length} switcher transitions...`);
  const swResults = await pool(swJobs, (j) => auditSwitcher(browser, j.start, j.from, j.to), 4);

  await browser.close();

  const report = { base: BASE, ts: process.env.AUDIT_TS || 'now', pages: pageResults, switcher: swResults };
  writeFileSync('/mnt/backup/Dropbox/1 Programmazione/Progetti/ChromePlugin/sviluppo/tests/i18n-audit-result.json', JSON.stringify(report, null, 2));

  // ── console summary ──
  const bad = pageResults.filter(r => r.status !== 200 || r.err || r.leaks.length || (r.htmlLang && r.htmlLang !== r.lang && !(r.lang==='it' && r.htmlLang==='it')));
  console.log('\n===== PAGE ISSUES =====');
  for (const r of pageResults) {
    const flags = [];
    if (r.status !== 200) flags.push(`HTTP_${r.status}`);
    if (r.err) flags.push(`ERR:${r.err}`);
    if (r.htmlLang !== r.lang) flags.push(`LANG_SERVED=${r.htmlLang}(want ${r.lang})`);
    if (r.leaks.length) flags.push(`LEAK[${r.leaks.join(',')}]`);
    if (flags.length) console.log(`✗ ${r.lang.padEnd(3)} ${r.page.padEnd(14)} ${flags.join(' | ')}  <${r.url}>`);
  }
  console.log(`\n${bad.length}/${pageResults.length} page-loads with issues.`);

  console.log('\n===== SWITCHER =====');
  for (const s of swResults) {
    const mark = s.ok ? '✓' : '✗';
    console.log(`${mark} ${s.from}→${s.to}  active=${s.activeLang} htmlLang=${s.htmlLang} final=${(s.finalUrl||'').replace(BASE,'')} ${s.err?('ERR:'+s.err):''}`);
  }
})();
