#!/usr/bin/env node
/**
 * Post-validation per la wave di traduzione automatica.
 * Per ogni file site/{lang}/<page>.html, verifica:
 *   - delta size vs IT source (cap minimo per evitare copy-rename)
 *   - H1 non contiene parole italiane specifiche
 *   - lang attr corretto sul <html>
 *
 * Output: report con file FAKE da rifare + GOOD da tenere.
 *
 * Run: node sviluppo/scripts/translation-quality-check.mjs
 */

import { readFile, stat } from 'node:fs/promises';
import { existsSync } from 'node:fs';

const ROOT = '/home/mrxxx/Dropbox/1 Programmazione/Progetti/ChromePlugin/site';
const LANGS = ['en','de','fr','es','pt','ru','ar','zh','hi','ja','ko','tr','id','pl'];
const PAGES = [
  'install','support','license-guide','salesletter',
  'adblock-detector','block-video-ads','bypass-anti-adblock',
  'lightweight-ad-blocker','manifest-v3-ad-blocker',
  'private-ad-blocker','undetectable-ad-blocker',
];

// Italian-specific words that MUST NOT appear in H1/H2 of a non-IT page
const IT_RED_FLAGS = /\b(installa|come funziona|funziona davvero|senza pubblicità|nemmeno|adesso|niente più|prima e dopo|piano gratuito|prova gratis|pubblicità video|annunci video)\b/i;

// Compactness adjustment: CJK/RTL/Indic languages are denser than IT
const SIZE_MIN_RATIO = { ja: 0.40, zh: 0.40, ko: 0.40, ar: 0.55, hi: 0.55 };
const SIZE_MIN_DEFAULT = 0.65;

async function readSafe(p) {
  if (!existsSync(p)) return null;
  return readFile(p, 'utf8');
}

function extractH1(html) {
  const m = html.match(/<h1\b[^>]*>([\s\S]*?)<\/h1>/i);
  return m ? m[1].replace(/<[^>]+>/g, '').trim().slice(0, 120) : '';
}

function extractLangAttr(html) {
  const m = html.match(/<html\b[^>]*lang=["']([a-z-]+)["']/i);
  return m ? m[1] : '';
}

async function main() {
  const itSizes = {};
  for (const page of PAGES) {
    const p = `${ROOT}/${page}.html`;
    if (existsSync(p)) itSizes[page] = (await stat(p)).size;
  }

  const rows = [];
  for (const lang of LANGS) {
    for (const page of PAGES) {
      const target = `${ROOT}/${lang}/${page}.html`;
      const ok = existsSync(target);
      if (!ok) { rows.push({ lang, page, status: 'MISSING' }); continue; }
      const sz = (await stat(target)).size;
      const expected = itSizes[page];
      const ratio = expected ? sz / expected : 0;
      const minR = SIZE_MIN_RATIO[lang] ?? SIZE_MIN_DEFAULT;
      const html = await readSafe(target);
      const h1 = extractH1(html || '');
      const langAttr = extractLangAttr(html || '');
      const issues = [];
      if (langAttr !== lang) issues.push(`lang=${langAttr || 'missing'}`);
      if (ratio < minR) issues.push(`size ${(ratio*100).toFixed(0)}%`);
      if (IT_RED_FLAGS.test(h1)) issues.push('IT in H1');
      const status = issues.length === 0 ? 'OK' : 'FAKE';
      rows.push({ lang, page, status, h1, ratio: (ratio*100).toFixed(0)+'%', issues: issues.join(', ') });
    }
  }

  const ok = rows.filter(r => r.status === 'OK').length;
  const fake = rows.filter(r => r.status === 'FAKE').length;
  const missing = rows.filter(r => r.status === 'MISSING').length;
  console.log(`Total: ${rows.length} | OK: ${ok} | FAKE: ${fake} | MISSING: ${missing}`);
  console.log('\n=== FAKE files (to redo) ===');
  for (const r of rows.filter(x => x.status === 'FAKE')) {
    console.log(`  ${r.lang}/${r.page}.html  [${r.issues}]  H1="${r.h1.slice(0,60)}"`);
  }
  console.log('\n=== Per-language coverage ===');
  for (const lang of LANGS) {
    const langRows = rows.filter(r => r.lang === lang);
    const ok = langRows.filter(r => r.status === 'OK').length;
    console.log(`  ${lang}: ${ok}/${PAGES.length} good`);
  }
}

main().catch(e => { console.error(e); process.exit(1); });
