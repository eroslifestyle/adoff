#!/usr/bin/env node
/**
 * Sync all marketing copy to "trial = 30 days" (SSOT: app/src/background.js: TRIAL_DAYS = 30).
 *
 * Bulk find/replace across site/, app/, app-firefox/, app-safari/, llms*.txt, amo-metadata.json.
 *
 * Trial unit translations (it/en/fr/es/pt/de/ru/ar/zh/hi/ja/ko/tr/id/pl):
 *   giorni, gg, days, day, jours, días, dias, Tage, дней, يومًا, يوم, 天, 日(間), 일, दिन, gün, hari, dni
 *
 * Skip rules:
 *   - referral bonus "+15 giorni Pro gratis", "+15 days" etc — the +X bonus reward
 *     is a separate concept from the trial; leave untouched.
 *   - earn/gain/receive verbs ("ricevi 15", "earn 15", "gana 15", ...) → likely referral
 *
 * Usage:
 *   node sviluppo/scripts/sync-trial-30-days.mjs [--apply]
 *   Default = dry-run (preview only). --apply writes changes.
 */

import { readFile, writeFile } from 'node:fs/promises';
import { globSync } from 'node:fs';
import path from 'node:path';

const ROOT = '/home/mrxxx/Dropbox/1 Programmazione/Progetti/ChromePlugin';
const APPLY = process.argv.includes('--apply');

const TARGETS = [
  'site/*.html',
  'site/*/*.html',
  'site/*/vs/*.html',
  'site/blog/*.html',
  'site/*/blog/*.html',
  'site/i18n/*.json',
  'site/llms*.txt',
  'app/src/*.html',
  'app/src/i18n.js',
  'app-firefox/src/*.html',
  'app-firefox/src/i18n.js',
  'app-firefox/amo-metadata.json',
  'app-safari/src/*.html',
  'app-safari/src/i18n.js',
];

// Match: "15" followed by an optional separator and a day unit in 15 languages.
// Capture groups: 1=separator, 2=unit.
const DAY_UNIT = '(?:giorni|gg|days?|jours|d[ií]as?|Tage|дней|يوم(?:ًا)?|天|日間?|일|दिन|gün|hari|dni)';
const PATTERN = new RegExp(`(^|[^+\\d])15(\\s*[-‑]?\\s*)(${DAY_UNIT})`, 'g');

// Skip if the match is preceded by referral verbs within 30 chars.
const REFERRAL_LOOKBACK = /(?:ricevi|earn|gain|gana|ganha|gewinn\w*|получ\w+|bonus|reward|extra|\+ ?)\s*$/i;

function shouldSkipMatch(beforeText) {
  return REFERRAL_LOOKBACK.test(beforeText);
}

function replaceInText(text) {
  let changed = 0;
  const out = text.replace(PATTERN, (m, lead, sep, unit, offset) => {
    const start = Math.max(0, offset - 30);
    const before = text.slice(start, offset + lead.length);
    if (shouldSkipMatch(before)) return m;
    changed++;
    return `${lead}30${sep}${unit}`;
  });
  return { out, changed };
}

async function main() {
  let totalFiles = 0;
  let totalChanges = 0;
  const changedFiles = [];

  for (const pat of TARGETS) {
    const files = globSync(path.join(ROOT, pat));
    for (const f of files) {
      let raw;
      try { raw = await readFile(f, 'utf8'); } catch { continue; }
      const { out, changed } = replaceInText(raw);
      if (changed > 0) {
        totalFiles++;
        totalChanges += changed;
        changedFiles.push({ file: path.relative(ROOT, f), changes: changed });
        if (APPLY) await writeFile(f, out, 'utf8');
      }
    }
  }

  console.log(`\n${APPLY ? '[APPLIED]' : '[DRY-RUN]'} Files with changes: ${totalFiles} | Total replacements: ${totalChanges}\n`);
  changedFiles.sort((a, b) => b.changes - a.changes);
  for (const x of changedFiles.slice(0, 50)) {
    console.log(`  ${x.changes.toString().padStart(3)}× ${x.file}`);
  }
  if (changedFiles.length > 50) console.log(`  ... and ${changedFiles.length - 50} more files`);
  if (!APPLY) console.log(`\nRun with --apply to write changes.`);
}

main().catch(e => { console.error(e); process.exit(1); });
