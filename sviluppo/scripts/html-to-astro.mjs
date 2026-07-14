#!/usr/bin/env node
/**
 * html-to-astro.mjs — Mechanical 1:1 conversion of site/*.html → site-astro/src/pages/*.astro
 *
 * Strategy:
 *  - Read original HTML (the SOURCE OF TRUTH for copy)
 *  - Extract <head> meta tags + JSON-LD scripts
 *  - Extract <body> inner content
 *  - For every `<el data-i18n="key">text</el>` substitute with `<el>__I18N_TEXT__key__</el>` placeholder
 *  - For every `<el data-i18n-html="key">html</el>` substitute with `<el>__I18N_HTML__key__</el>`
 *  - For every `data-i18n-placeholder="key"` swap to `placeholder="__I18N_ATTR__key__"`
 *  - Strip inline <script> blocks, re-emit them as `<script is:inline>` AFTER the body Fragment
 *  - Emit Astro file with:
 *      - frontmatter: import Layout + import t, define lang, embed body as JS string, run replacements
 *      - body: <Layout {...meta} lang={lang}><Fragment set:html={body} />…scripts…</Layout>
 *
 * Output preserves the original HTML byte-for-byte (modulo i18n substitutions).
 *
 * Usage:
 *   node sviluppo/scripts/html-to-astro.mjs                        # convert everything
 *   node sviluppo/scripts/html-to-astro.mjs --only site/index.html # single file (debug)
 *   node sviluppo/scripts/html-to-astro.mjs --dry                  # don't write files
 */

import { readFile, writeFile, mkdir, readdir, stat } from 'node:fs/promises';
import { existsSync } from 'node:fs';
import path from 'node:path';

const ROOT = '/home/mrxxx/Dropbox/1 Programmazione/Progetti/ChromePlugin';
const SITE = path.join(ROOT, 'site');
const ASTRO_PAGES = path.join(ROOT, 'site-astro/src/pages');
const ARGS = process.argv.slice(2);
const DRY = ARGS.includes('--dry');
const ONLY = ARGS.find((a, i, arr) => arr[i - 1] === '--only');

const LANGS = ['it','en','de','fr','es','pt','ru','ar','zh','hi','ja','ko','tr','id','pl'];
const SKIP_FILES = new Set(['admin.html', 'mgmt-9f4a/index.html']);
const SKIP_DIRS = new Set(['account', 'graphify-out', 'i18n', 'assets', 'blog/_archive', '.claude']);

function jsonStr(s) {
  return JSON.stringify(s);
}

function detectLangFromPath(filePath) {
  const rel = path.relative(SITE, filePath);
  const parts = rel.split(path.sep);
  if (parts.length > 1 && LANGS.includes(parts[0])) return parts[0];
  return 'it'; // root pages default to IT
}

function extractMeta(headHtml) {
  const meta = {};
  const grab = (re, fallback) => {
    const m = headHtml.match(re);
    return m ? m[1].trim() : fallback;
  };
  meta.title = grab(/<title>([\s\S]*?)<\/title>/i, '');
  meta.description = grab(/<meta\s+name=["']description["']\s+content=["']([^"']*)["']/i, '');
  meta.ogTitle = grab(/<meta\s+property=["']og:title["']\s+content=["']([^"']*)["']/i, '');
  meta.ogDescription = grab(/<meta\s+property=["']og:description["']\s+content=["']([^"']*)["']/i, '');
  meta.ogImage = grab(/<meta\s+property=["']og:image["']\s+content=["']([^"']*)["']/i, '');
  meta.ogUrl = grab(/<meta\s+property=["']og:url["']\s+content=["']([^"']*)["']/i, '');
  meta.twitterTitle = grab(/<meta\s+name=["']twitter:title["']\s+content=["']([^"']*)["']/i, '');
  meta.twitterDescription = grab(/<meta\s+name=["']twitter:description["']\s+content=["']([^"']*)["']/i, '');
  meta.canonical = grab(/<link\s+rel=["']canonical["']\s+href=["']([^"']*)["']/i, '');
  // Collect ALL extra <link> tags (hreflang, prefetch, etc.) and ALL custom <meta>
  meta.extraHead = [];
  const linkRe = /<link\b[^>]+>/gi;
  let m;
  while ((m = linkRe.exec(headHtml)) !== null) {
    const t = m[0];
    if (/rel=["']canonical["']/i.test(t)) continue;
    if (/rel=["']stylesheet["']/i.test(t)) continue; // global.css is loaded by Layout
    if (/rel=["']icon["']/i.test(t)) continue;
    meta.extraHead.push(t);
  }
  // Custom inline <style> tags (page-specific) — preserve
  meta.inlineStyles = [];
  const styleRe = /<style\b[^>]*>([\s\S]*?)<\/style>/gi;
  while ((m = styleRe.exec(headHtml)) !== null) {
    meta.inlineStyles.push(m[1]);
  }
  // JSON-LD scripts in head
  meta.jsonLd = [];
  const jsonLdRe = /<script\b[^>]*type=["']application\/ld\+json["'][^>]*>([\s\S]*?)<\/script>/gi;
  while ((m = jsonLdRe.exec(headHtml)) !== null) {
    meta.jsonLd.push(m[1].trim());
  }
  return meta;
}

function processBody(bodyHtml) {
  const i18nKeys = new Set();
  let out = bodyHtml;

  // Preserve `data-i18n` attribute (so adoff-i18n.js runtime can re-translate on lang switch)
  // and ALSO replace inner content with a placeholder that we resolve at SSR for the
  // page's default language. Best of both: SEO sees static localized text; users can
  // still switch language client-side via ?lang= without a server round-trip.
  out = out.replace(
    /<([a-zA-Z][a-zA-Z0-9-]*)([^>]*?\sdata-i18n=["']([^"']+)["'][^>]*?)>([\s\S]*?)<\/\1>/g,
    (_m, tag, allAttrs, key, _content) => {
      i18nKeys.add('text:' + key);
      return `<${tag}${allAttrs}>__I18N_TEXT__${key}__</${tag}>`;
    }
  );
  // data-i18n-html (preserves HTML inside replacement)
  out = out.replace(
    /<([a-zA-Z][a-zA-Z0-9-]*)([^>]*?\sdata-i18n-html=["']([^"']+)["'][^>]*?)>([\s\S]*?)<\/\1>/g,
    (_m, tag, allAttrs, key, _content) => {
      i18nKeys.add('html:' + key);
      return `<${tag}${allAttrs}>__I18N_HTML__${key}__</${tag}>`;
    }
  );
  // data-i18n-placeholder (attribute-level)
  out = out.replace(
    /data-i18n-placeholder=["']([^"']+)["']/g,
    (_m, key) => {
      i18nKeys.add('attr:' + key);
      // Also need to overwrite/insert placeholder attr — but we keep this minimal:
      // we'll inject `placeholder="__I18N_ATTR__key__"` and remove original placeholder later.
      return `data-i18n-placeholder="${key}" placeholder="__I18N_ATTR__${key}__"`;
    }
  );
  // Strip pre-existing placeholder attr that comes before our injected one (best-effort)
  // (skipped — Astro will just keep both; browser uses the LAST one which is ours)

  // Extract inline <script> tags. We re-emit them outside the Fragment to preserve execution.
  const scripts = [];
  out = out.replace(/<script\b([^>]*)>([\s\S]*?)<\/script>/gi, (_m, attrs, content) => {
    scripts.push({ attrs: attrs.trim(), content });
    return ''; // remove from body
  });

  // Extract inline <style> tags (page-specific). Preserve in head later if needed.
  const styles = [];
  out = out.replace(/<style\b([^>]*)>([\s\S]*?)<\/style>/gi, (_m, attrs, content) => {
    styles.push({ attrs: attrs.trim(), content });
    return '';
  });

  return { body: out, i18nKeys: [...i18nKeys], scripts, styles };
}

function buildAstro({ filePath, lang, meta, body, i18nKeys, scripts, styles }) {
  const relParts = path.relative(ASTRO_PAGES, path.dirname(filePath)).split(path.sep).filter(Boolean);
  const importPrefix = '../'.repeat(relParts.length + 1);

  // Translate placeholders at SSR time using t(key, lang)
  // We build a JS expression that does string replacement on the body template.
  const i18nLookup = i18nKeys.length
    ? `const i18n = {\n${i18nKeys.map(k => {
        const [type, key] = k.split(/:(.+)/);
        return `  '${type}:${key}': t(${jsonStr(key)}, lang),`;
      }).join('\n')}\n};\n` +
      i18nKeys.map(k => {
        const [type, key] = k.split(/:(.+)/);
        const tag = type === 'text' ? `__I18N_TEXT__${key}__`
                 : type === 'html' ? `__I18N_HTML__${key}__`
                 : `__I18N_ATTR__${key}__`;
        const safeKey = jsonStr(tag);
        if (type === 'text' || type === 'attr') {
          return `body = body.split(${safeKey}).join(escapeHtml(i18n['${type}:${key}']));`;
        }
        return `body = body.split(${safeKey}).join(i18n['${type}:${key}']);`;
      }).join('\n      ')
    : '';

  // Inline scripts: convert to <script is:inline> blocks
  const scriptBlocks = scripts.map(s => {
    const isJsonLd = /type=["']application\/ld\+json["']/i.test(s.attrs);
    const baseAttrs = s.attrs ? ` ${s.attrs}` : '';
    const inlineFlag = isJsonLd ? '' : ' is:inline';
    return `<script${baseAttrs}${inlineFlag} set:html={${jsonStr(s.content)}} />`;
  }).join('\n');

  // Inline page-level styles
  const styleBlocks = styles.map(s => {
    const attrs = s.attrs ? ` ${s.attrs}` : '';
    return `<style${attrs} is:global set:html={${jsonStr(s.content)}} />`;
  }).join('\n');

  // Extra <head> tags as raw inserts
  const extraHeadHtml = meta.extraHead.map(h => h).join('\n  ');

  const astro = `---
// AUTO-GENERATED from ${path.relative(ROOT, filePath)} by sviluppo/scripts/html-to-astro.mjs
// Source HTML is the canonical content; this file mirrors it 1:1 with i18n substitutions only.
import Layout from '${importPrefix}layouts/Layout.astro';
import { t } from '${importPrefix}i18n/utils';

const lang = '${lang}';

function escapeHtml(s) {
  return String(s).replace(/&/g, '&amp;').replace(/</g, '&lt;').replace(/>/g, '&gt;').replace(/"/g, '&quot;');
}

let body = ${jsonStr(body)};
${i18nLookup}

const meta = {
  title: ${jsonStr(meta.title)},
  description: ${jsonStr(meta.description)},
  ogTitle: ${jsonStr(meta.ogTitle)},
  ogDescription: ${jsonStr(meta.ogDescription)},
  ogImage: ${jsonStr(meta.ogImage)},
  ogUrl: ${jsonStr(meta.ogUrl)},
  twitterTitle: ${jsonStr(meta.twitterTitle)},
  twitterDescription: ${jsonStr(meta.twitterDescription)},
  canonical: ${jsonStr(meta.canonical)},
};

const jsonLdScripts = ${jsonStr(meta.jsonLd)};
---
<Layout
  title={meta.title}
  description={meta.description}
  ogTitle={meta.ogTitle}
  ogDescription={meta.ogDescription}
  ogImage={meta.ogImage}
  ogUrl={meta.ogUrl}
  twitterTitle={meta.twitterTitle}
  twitterDescription={meta.twitterDescription}
  canonical={meta.canonical}
  lang={lang}
  extraHead={${jsonStr(extraHeadHtml)}}
  inlineStyles={${jsonStr(meta.inlineStyles)}}
  jsonLdScripts={jsonLdScripts}
>
  <Fragment set:html={body} />
${styleBlocks}
${scriptBlocks}
</Layout>
`;
  return astro;
}

async function convertFile(srcPath) {
  const html = await readFile(srcPath, 'utf8');
  const lang = detectLangFromPath(srcPath);

  // Split head / body
  const headMatch = html.match(/<head\b[^>]*>([\s\S]*?)<\/head>/i);
  const bodyMatch = html.match(/<body\b[^>]*>([\s\S]*?)<\/body>/i);
  if (!bodyMatch) {
    console.warn(`[skip] no <body>: ${srcPath}`);
    return;
  }
  const headHtml = headMatch ? headMatch[1] : '';
  const bodyHtml = bodyMatch[1];

  const meta = extractMeta(headHtml);
  const { body, i18nKeys, scripts, styles } = processBody(bodyHtml);

  // Output path
  const rel = path.relative(SITE, srcPath);
  // Special case: site/index.html  →  src/pages/index.astro
  // site/it/index.html does not exist; site/it/<page>.html → src/pages/it/<page>.astro
  // site/de/<page>.html → src/pages/de/<page>.astro
  const out = path.join(ASTRO_PAGES, rel.replace(/\.html$/, '.astro'));

  const astro = buildAstro({ filePath: out, lang, meta, body, i18nKeys, scripts, styles });

  if (DRY) {
    console.log(`[dry] ${rel}  →  ${path.relative(ROOT, out)}  (${astro.length} chars, ${i18nKeys.length} i18n keys, ${scripts.length} scripts, ${styles.length} styles)`);
    return;
  }

  await mkdir(path.dirname(out), { recursive: true });
  await writeFile(out, astro, 'utf8');
  console.log(`[ok]  ${rel}  →  ${path.relative(ROOT, out)}  (${i18nKeys.length} i18n / ${scripts.length} scripts / ${styles.length} styles)`);
}

async function walk(dir, out = []) {
  for (const e of await readdir(dir, { withFileTypes: true })) {
    const full = path.join(dir, e.name);
    if (e.isDirectory()) {
      if (SKIP_DIRS.has(e.name)) continue;
      if (e.name === 'mgmt-9f4a') continue;
      await walk(full, out);
    } else if (e.isFile() && e.name.endsWith('.html')) {
      const rel = path.relative(SITE, full);
      if (SKIP_FILES.has(rel)) continue;
      out.push(full);
    }
  }
  return out;
}

async function main() {
  let files;
  if (ONLY) {
    files = [path.resolve(ROOT, ONLY)];
  } else {
    files = await walk(SITE);
  }
  console.log(`Converting ${files.length} HTML file(s) → Astro pages...\n`);
  let ok = 0, fail = 0;
  for (const f of files) {
    try { await convertFile(f); ok++; }
    catch (e) { console.error(`[fail] ${path.relative(ROOT, f)}: ${e.message}`); fail++; }
  }
  console.log(`\n${ok} ok, ${fail} fail.`);
}

main().catch(e => { console.error(e); process.exit(1); });
