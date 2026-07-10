#!/usr/bin/env node
/**
 * report.mjs - Genera e invia report giornaliero Auto-Fix.
 * Uso: node report.mjs [--date YYYY-MM-DD] [--telegram] [--dry-run]
 */
import { readFileSync, writeFileSync, existsSync, mkdirSync, appendFileSync } from 'fs';
import { join, dirname } from 'path';
import { fileURLToPath } from 'url';

const __dirname = dirname(fileURLToPath(import.meta.url));
const BASE = __dirname;

const DATE = (() => {
  const i = process.argv.indexOf('--date');
  return i >= 0 ? process.argv[i + 1] : new Date().toISOString().slice(0, 10);
})();
const SEND_TELEGRAM = process.argv.includes('--telegram');
const DRY_RUN = process.argv.includes('--dry-run');

const FINDINGS_FILE = join(BASE, 'findings', `${DATE}.json`);
const CANDIDATES_FILE = join(BASE, 'candidate_rules', `${DATE}.json`);
const STATE_FILE = join(BASE, 'logs', 'state.json');
const LOG_DIR = join(BASE, 'logs');
const LOG_JSONL_FILE = join(LOG_DIR, `${DATE}.jsonl`);

async function sendTelegram(message) {
  if (DRY_RUN) { console.log('[TG dry-run]', message); return; }
  const token = process.env.TELEGRAM_BOT_TOKEN || '';
  const chatId = process.env.TELEGRAM_CHANNEL_ID || '-1004293812042';
  if (!token) { console.log('TELEGRAM_BOT_TOKEN non impostato'); return; }
  try {
    const res = await fetch(`https://api.telegram.org/bot${token}/sendMessage`, {
      method: 'POST',
      headers: { 'Content-Type': 'application/json' },
      body: JSON.stringify({ chat_id: chatId, text: message, parse_mode: 'HTML' })
    });
    const data = await res.json();
    if (!data.ok) console.log('Telegram error:', data.description);
  } catch (e) { console.log('Telegram failed:', e.message); }
}

function loadState() {
  if (!existsSync(STATE_FILE)) return { leaks: {} };
  try { return JSON.parse(readFileSync(STATE_FILE, 'utf8')); }
  catch { return { leaks: {} }; }
}

function loadFindingsCount() {
  if (!existsSync(FINDINGS_FILE)) return 0;
  try {
    const fd = JSON.parse(readFileSync(FINDINGS_FILE, 'utf8'));
    const latest = fd.runs?.[fd.runs.length - 1];
    return latest?.findings?.length ?? 0;
  } catch { return 0; }
}

function loadCandidatesCount() {
  if (!existsSync(CANDIDATES_FILE)) return 0;
  try {
    const cd = JSON.parse(readFileSync(CANDIDATES_FILE, 'utf8'));
    return cd.new_candidates || 0;
  } catch { return 0; }
}

async function report() {
  const state = loadState();
  const leaks = Object.values(state.leaks);
  const open = leaks.filter(l => l.status === 'open').length;
  const fixed = leaks.filter(l => l.status === 'fixed').length;
  const total = leaks.length;

  const findingsCount = loadFindingsCount();
  const candidatesCount = loadCandidatesCount();
  const canaryPassed = existsSync(join(BASE, 'logs', `canary_${DATE}.passed`));

  const msg = [
    `🛡️ <b>AdOff Auto-Fix Report ${DATE}</b>`,
    ``,
    `📊 Nightly Run:`,
    `  • Sites tested: ${findingsCount > 0 ? findingsCount : '?'}`,
    `  • Candidates generated: ${candidatesCount}`,
    `  • Canary suite: ${canaryPassed ? '✅ PASS' : '❌ FAIL'}`,
    ``,
    `📈 Leak Status:`,
    `  • Total tracked: ${total}`,
    `  • Open: ${open}`,
    `  • Fixed: ${fixed}`,
    ``,
    `🤖 Auto-fix ${candidatesCount > 0 ? 'ACTIVE' : 'shadow mode'}`
  ].join('\n');

  // Scrivi log JSONL
  if (!existsSync(LOG_DIR)) mkdirSync(LOG_DIR, { recursive: true });
  const logEntry = {
    date: DATE, ts: new Date().toISOString(),
    findings_count: findingsCount, candidates: candidatesCount,
    canary_passed: canaryPassed,
    leaks: { total, open, fixed }
  };
  appendFileSync(LOG_JSONL_FILE, JSON.stringify(logEntry) + '\n');
  console.log('Log:', LOG_JSONL_FILE);

  if (SEND_TELEGRAM) {
    await sendTelegram(msg);
    console.log('Telegram sent');
  } else {
    console.log('\n=== REPORT ===');
    console.log(msg);
  }
}

report().catch(e => { console.error(e); process.exit(1); });
