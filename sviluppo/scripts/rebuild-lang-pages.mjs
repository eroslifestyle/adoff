#!/usr/bin/env node
/**
 * Rebuild static /{lang}/index.html pages from root index.html + i18n/{lang}.json
 *
 * Why: static lang pages were copies created weeks ago and have diverged from root
 * (missing sl.works section, missing pricing.compareBadge, old layout). When users
 * select a language from the nav dropdown they land on /{lang}/index.html and see
 * an outdated page — looks like the site is "mixed Italian and English".
 *
 * Strategy:
 *  1. Read root site/index.html as the source of truth (IT defaults).
 *  2. For each language XX, read site/i18n/XX.json.
 *  3. Pre-apply translations: every <element data-i18n="key">DEFAULT</element>
 *     becomes <element data-i18n="key">TRANSLATED</element> (in-place text swap).
 *     Same for data-i18n-html (innerHTML) and data-i18n-placeholder (attr).
 *  4. Patch <html lang="it"> → <html lang="XX"> and dir="rtl" for AR.
 *  5. Patch <title>, meta description, og:title, og:description from JSON meta.*.
 *  6. Rewrite internal href to keep ?lang=XX or /XX/ prefix per nav rules.
 *  7. Write to site/XX/index.html.
 *
 * Also: ensures the 4 new keys (pricing.refundNote, testi.date{Apr,Mar,Feb})
 * are present in every JSON, adding sensible per-language translations if missing.
 */

import { readFile, writeFile, mkdir } from 'node:fs/promises';
import { existsSync } from 'node:fs';
import path from 'node:path';
import { fileURLToPath } from 'node:url';

const __dirname = path.dirname(fileURLToPath(import.meta.url));
const SITE = path.resolve(__dirname, '../../site');
const I18N = path.join(SITE, 'i18n');

const LANGS = ['en','de','fr','es','pt','ru','ar','zh','hi','ja','ko','tr','id','pl'];
const STATIC_EN_ROOT = new Set(['how-it-works','unique-tech','best-ad-blocker-2026','community','press','vs/ublock-origin','vs/adblock-plus','vs/adguard']);
const STATIC_IT_ROOT = new Set(['guide','privacy','terms','withdrawal']);

// New keys to ensure present (audit 2026-05-29)
const NEW_KEYS = {
  it: { 'pricing.refundNote': 'Rimborso 30 giorni · senza domande',
        'testi.dateApr': 'Aprile 2026', 'testi.dateMar': 'Marzo 2026', 'testi.dateFeb': 'Febbraio 2026' },
  en: { 'pricing.refundNote': '30-day refund · no questions asked',
        'testi.dateApr': 'April 2026', 'testi.dateMar': 'March 2026', 'testi.dateFeb': 'February 2026' },
  de: { 'pricing.refundNote': '30 Tage Rückerstattung · keine Fragen',
        'testi.dateApr': 'April 2026', 'testi.dateMar': 'März 2026', 'testi.dateFeb': 'Februar 2026' },
  fr: { 'pricing.refundNote': 'Remboursement 30 jours · sans questions',
        'testi.dateApr': 'Avril 2026', 'testi.dateMar': 'Mars 2026', 'testi.dateFeb': 'Février 2026' },
  es: { 'pricing.refundNote': 'Reembolso 30 días · sin preguntas',
        'testi.dateApr': 'Abril 2026', 'testi.dateMar': 'Marzo 2026', 'testi.dateFeb': 'Febrero 2026' },
  pt: { 'pricing.refundNote': 'Reembolso de 30 dias · sem perguntas',
        'testi.dateApr': 'Abril de 2026', 'testi.dateMar': 'Março de 2026', 'testi.dateFeb': 'Fevereiro de 2026' },
  ru: { 'pricing.refundNote': 'Возврат в течение 30 дней · без вопросов',
        'testi.dateApr': 'Апрель 2026', 'testi.dateMar': 'Март 2026', 'testi.dateFeb': 'Февраль 2026' },
  ar: { 'pricing.refundNote': 'استرداد خلال 30 يومًا · بدون أسئلة',
        'testi.dateApr': 'أبريل 2026', 'testi.dateMar': 'مارس 2026', 'testi.dateFeb': 'فبراير 2026' },
  zh: { 'pricing.refundNote': '30 天退款 · 无需理由',
        'testi.dateApr': '2026 年 4 月', 'testi.dateMar': '2026 年 3 月', 'testi.dateFeb': '2026 年 2 月' },
  hi: { 'pricing.refundNote': '30-दिन वापसी · बिना सवाल',
        'testi.dateApr': 'अप्रैल 2026', 'testi.dateMar': 'मार्च 2026', 'testi.dateFeb': 'फरवरी 2026' },
  ja: { 'pricing.refundNote': '30 日間返金 · 質問なし',
        'testi.dateApr': '2026年4月', 'testi.dateMar': '2026年3月', 'testi.dateFeb': '2026年2月' },
  ko: { 'pricing.refundNote': '30일 환불 · 묻지 않음',
        'testi.dateApr': '2026년 4월', 'testi.dateMar': '2026년 3월', 'testi.dateFeb': '2026년 2월' },
  tr: { 'pricing.refundNote': '30 gün iade · soru sorulmaz',
        'testi.dateApr': 'Nisan 2026', 'testi.dateMar': 'Mart 2026', 'testi.dateFeb': 'Şubat 2026' },
  pl: { 'pricing.refundNote': '30 dni na zwrot · bez pytań',
        'testi.dateApr': 'Kwiecień 2026', 'testi.dateMar': 'Marzec 2026', 'testi.dateFeb': 'Luty 2026' },
  id: { 'pricing.refundNote': 'Pengembalian 30 hari · tanpa pertanyaan',
        'testi.dateApr': 'April 2026', 'testi.dateMar': 'Maret 2026', 'testi.dateFeb': 'Februari 2026' },
};

function escapeReg(s) { return s.replace(/[.*+?^${}()|[\]\\]/g, '\\$&'); }
function htmlEscape(s) {
  return String(s)
    .replace(/&/g, '&amp;').replace(/</g, '&lt;').replace(/>/g, '&gt;')
    .replace(/"/g, '&quot;');
}

async function ensureKeys() {
  for (const lang of [...LANGS, 'it']) {
    const file = path.join(I18N, `${lang}.json`);
    if (!existsSync(file)) { console.warn(`[skip] missing ${file}`); continue; }
    const raw = await readFile(file, 'utf8');
    const dict = JSON.parse(raw);
    let changed = false;
    const additions = NEW_KEYS[lang] || NEW_KEYS.en;
    for (const [k, v] of Object.entries(additions)) {
      if (dict[k] === undefined || dict[k] === null || dict[k] === '') {
        dict[k] = v; changed = true;
      }
    }
    if (changed) {
      await writeFile(file, JSON.stringify(dict, null, 2) + '\n', 'utf8');
      console.log(`[json] ${lang}.json: keys synced`);
    }
  }
}

function applyTranslations(html, dict) {
  let out = html;
  // 1) data-i18n="key" → replace text content of THAT element
  out = out.replace(
    /(<([a-zA-Z][a-zA-Z0-9-]*)\b[^>]*\bdata-i18n="([^"]+)"[^>]*>)([\s\S]*?)(<\/\2>)/g,
    (m, openTag, _tag, key, _inner, closeTag) => {
      const t = dict[key];
      if (t === undefined) return m;
      return `${openTag}${htmlEscape(t)}${closeTag}`;
    }
  );
  // 2) data-i18n-html="key" → replace innerHTML (no escape)
  out = out.replace(
    /(<([a-zA-Z][a-zA-Z0-9-]*)\b[^>]*\bdata-i18n-html="([^"]+)"[^>]*>)([\s\S]*?)(<\/\2>)/g,
    (m, openTag, _tag, key, _inner, closeTag) => {
      const t = dict[key];
      if (t === undefined) return m;
      return `${openTag}${t}${closeTag}`;
    }
  );
  // 3) data-i18n-placeholder="key" → patch placeholder attr on same tag
  out = out.replace(
    /(<[^>]*?\bdata-i18n-placeholder="([^"]+)"[^>]*?)(\s*\/?>)/g,
    (m, head, key, tail) => {
      const t = dict[key];
      if (t === undefined) return m;
      const withoutPh = head.replace(/\s+placeholder="[^"]*"/, '');
      return `${withoutPh} placeholder="${htmlEscape(t)}"${tail}`;
    }
  );
  return out;
}

function patchMeta(html, dict, lang) {
  let out = html;
  // <html lang="..." dir="..."> at the very top
  out = out.replace(
    /<html\b([^>]*)>/,
    (m, attrs) => {
      let a = attrs
        .replace(/\s+lang="[^"]*"/g, '')
        .replace(/\s+dir="[^"]*"/g, '');
      const dir = (lang === 'ar') ? ' dir="rtl"' : '';
      return `<html lang="${lang}"${dir}${a}>`;
    }
  );
  // <title>
  if (dict['meta.title']) {
    out = out.replace(/<title>[\s\S]*?<\/title>/, `<title>${htmlEscape(dict['meta.title'])}</title>`);
  }
  // meta description
  if (dict['meta.description']) {
    out = out.replace(
      /(<meta\s+name="description"\s+content=")[^"]*(")/,
      `$1${htmlEscape(dict['meta.description'])}$2`
    );
  }
  if (dict['meta.og.title']) {
    out = out.replace(
      /(<meta\s+property="og:title"\s+content=")[^"]*(")/,
      `$1${htmlEscape(dict['meta.og.title'])}$2`
    );
  }
  if (dict['meta.og.description']) {
    out = out.replace(
      /(<meta\s+property="og:description"\s+content=")[^"]*(")/,
      `$1${htmlEscape(dict['meta.og.description'])}$2`
    );
  }
  // Twitter card meta (was missing, leaking IT)
  const twitterTitle = dict['meta.twitter.title'] || dict['meta.og.title'] || dict['meta.title'];
  if (twitterTitle) {
    out = out.replace(
      /(<meta\s+name="twitter:title"\s+content=")[^"]*(")/,
      `$1${htmlEscape(twitterTitle)}$2`
    );
  }
  const twitterDesc = dict['meta.twitter.description'] || dict['meta.og.description'] || dict['meta.description'];
  if (twitterDesc) {
    out = out.replace(
      /(<meta\s+name="twitter:description"\s+content=")[^"]*(")/,
      `$1${htmlEscape(twitterDesc)}$2`
    );
  }
  return out;
}

/**
 * Translate hardcoded Italian strings inside <script type="application/ld+json">
 * blocks (FAQPage / Product / SoftwareApplication SEO data).
 *
 * Strategy: build a reverse index from the Italian dict (value → key), then for
 * every JSON-LD string property, look up its Italian value and, if found,
 * replace with the target-language translation.
 *
 * SEO impact: Google Search uses these snippets for rich results in each market.
 * Leaving them in Italian on a /zh/ page costs visibility in Chinese search.
 */
function translateJsonLd(html, targetDict, itDict) {
  if (!targetDict || !itDict || targetDict === itDict) return html;
  // Build reverse index from it.json: text → key
  const reverse = new Map();
  for (const [k, v] of Object.entries(itDict)) {
    if (typeof v !== 'string' || v.length < 8) continue;
    reverse.set(v, k);
  }
  return html.replace(
    /<script\b[^>]*type="application\/ld\+json"[^>]*>([\s\S]*?)<\/script>/g,
    (match, jsonText) => {
      // Translate values of "name", "text", "description", "headline" string properties.
      const translated = jsonText.replace(
        /("(?:name|text|description|headline|alternateName|sameAs|articleBody|abstract|disambiguatingDescription)"\s*:\s*")([^"\\]*(?:\\.[^"\\]*)*)(")/g,
        (m, head, val, tail) => {
          // Decode common JSON escapes for lookup
          const decoded = val.replace(/\\"/g, '"').replace(/\\\\/g, '\\').replace(/\\n/g, '\n');
          const key = reverse.get(decoded);
          if (!key) return m;
          const tr = targetDict[key];
          if (typeof tr !== 'string') return m;
          const encoded = tr.replace(/\\/g, '\\\\').replace(/"/g, '\\"').replace(/\n/g, '\\n');
          return head + encoded + tail;
        }
      );
      return match.replace(jsonText, translated);
    }
  );
}

function rewriteLinks(html, lang) {
  // Rewrite internal href to preserve lang context per adoff-i18n.js conventions.
  // Skip external, anchors, mailto, tel, javascript, and already-prefixed paths.
  return html.replace(/href="([^"]+)"/g, (m, href) => {
    if (!href) return m;
    if (/^(https?:)?\/\//i.test(href)) return m;
    if (href.startsWith('#') || /^(mailto:|tel:|javascript:)/i.test(href)) return m;
    if (/[?&]lang=/.test(href)) return m;
    const clean = href.replace(/^\//, '');
    const firstSeg = clean.split('/')[0];
    if (firstSeg && firstSeg.length === 2 && [...LANGS, 'it'].includes(firstSeg)) return m;
    const page = clean.replace(/\.html$/, '').replace(/[?#].*$/, '');
    const isStaticEN = STATIC_EN_ROOT.has(page);
    const isStaticIT = STATIC_IT_ROOT.has(page);
    let newHref;
    if (isStaticEN || isStaticIT) {
      if (isStaticEN && lang === 'en') newHref = `/${page}`;
      else if (isStaticIT && lang === 'it') newHref = `/${page}`;
      else newHref = `/${lang}/${page}`;
      const hashIdx = clean.indexOf('#');
      if (hashIdx >= 0) newHref += clean.substring(hashIdx);
    } else {
      const sep = clean.indexOf('?') >= 0 ? '&' : '?';
      newHref = '/' + clean + sep + 'lang=' + lang;
    }
    return `href="${newHref}"`;
  });
}

async function rebuildLang(rootHtml, lang, itDict) {
  const dictPath = path.join(I18N, `${lang}.json`);
  if (!existsSync(dictPath)) { console.warn(`[skip] no JSON for ${lang}`); return; }
  const dict = JSON.parse(await readFile(dictPath, 'utf8'));
  let out = rootHtml;
  out = applyTranslations(out, dict);
  out = patchMeta(out, dict, lang);
  out = translateJsonLd(out, dict, itDict);
  out = rewriteLinks(out, lang);
  // Add a banner comment so anyone editing knows the file is generated
  out = out.replace(
    /<head>/,
    `<head>\n  <!-- AUTO-GENERATED from root /index.html + /i18n/${lang}.json by sviluppo/scripts/rebuild-lang-pages.mjs. Do not edit by hand. -->`
  );
  const outDir = path.join(SITE, lang);
  if (!existsSync(outDir)) await mkdir(outDir, { recursive: true });
  await writeFile(path.join(outDir, 'index.html'), out, 'utf8');
  console.log(`[lang] ${lang}/index.html rebuilt (${out.length} bytes)`);
}

async function main() {
  console.log('=== Sync new i18n keys across 15 JSONs ===');
  await ensureKeys();
  console.log('\n=== Rebuild static /{lang}/index.html pages ===');
  const rootHtml = await readFile(path.join(SITE, 'index.html'), 'utf8');
  const itDict = JSON.parse(await readFile(path.join(I18N, 'it.json'), 'utf8'));
  for (const lang of LANGS) await rebuildLang(rootHtml, lang, itDict);
  console.log('\nDone.');
}

main().catch(err => { console.error(err); process.exit(1); });
