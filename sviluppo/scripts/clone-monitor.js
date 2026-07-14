#!/usr/bin/env node
/**
 * AdOff — Clone Monitor (anti-piracy detective)
 *
 * NON impedisce la copia (impossibile per JS on-device): la RILEVA.
 * Tre sorgenti reali con API pubbliche:
 *   1. GitHub Code Search — cerca il CANARY token (sviluppo/canaries.json) nei
 *      repo pubblici. Ogni match fuori dal repo ufficiale AdOff = sorgente clonato.
 *      (Richiede GITHUB_TOKEN: la code-search API GitHub esige autenticazione.)
 *   2. GitHub Repo Search — cerca repo con nome/tagline "adoff" / "ads off".
 *   3. Firefox AMO Search — nuove estensioni con le nostre keyword (potenziali cloni
 *      ripubblicati su AMO). CWS non ha API di ricerca: delega allo scraper Playwright
 *      su leobox se ADOFF_SCRAPER_URL è impostato (riusa l'infra del review-poller).
 *
 * Dedup: stato in sviluppo/.clone-monitor-state.json (non committare).
 * Alert: Telegram (TELEGRAM_BOT_TOKEN + TELEGRAM_CHAT_ID; thread opzionale TG_THREAD_CLONES).
 *
 * Uso:
 *   node sviluppo/scripts/clone-monitor.js            # run completo, alert su findings
 *   node sviluppo/scripts/clone-monitor.js --dry-run  # nessun alert, stampa soltanto
 *   node sviluppo/scripts/clone-monitor.js --report   # alert anche se 0 findings (heartbeat)
 *
 * Env:
 *   GITHUB_TOKEN          (consigliato — abilita code search)
 *   TELEGRAM_BOT_TOKEN    (per alert; se assente → solo stdout)
 *   TELEGRAM_CHAT_ID
 *   TG_THREAD_CLONES      (id topic-thread del supergruppo, opzionale)
 *   ADOFF_SCRAPER_URL     (opzionale: endpoint scraper CWS/Edge su leobox)
 *
 * Cron (esempio, settimanale lunedì 09:00):
 *   0 9 * * 1  cd /path/to/ChromePlugin && node sviluppo/scripts/clone-monitor.js >> sviluppo/logs/clone-monitor.log 2>&1
 */
"use strict";

const fs = require("fs");
const path = require("path");

const PROJECT_ROOT = path.resolve(__dirname, "../..");
const CANARIES_PATH = path.join(PROJECT_ROOT, "sviluppo", "canaries.json");
const STATE_PATH = path.join(PROJECT_ROOT, "sviluppo", ".clone-monitor-state.json");

const args = process.argv.slice(2);
const DRY_RUN = args.includes("--dry-run");
const FORCE_REPORT = args.includes("--report");

// --- Identità ufficiale AdOff: questi NON sono cloni (self-exclude) ---
const OFFICIAL = {
  // Owner GitHub ufficiali (self-exclude). Override via env CLONE_MONITOR_OWNERS="a,b,c".
  githubOwners: (process.env.CLONE_MONITOR_OWNERS || "adoff").split(",").map((s) => s.trim().toLowerCase()).filter(Boolean),
  githubRepoAllow: /adoff\/(adoff|chromeplugin)/i,      // repo ufficiale, se pubblicato
  amoSlug: "adoff",
  amoGuid: (process.env.AMO_EXTENSION_ID || "").toLowerCase(),
};

// --- Keyword di brand per la ricerca per-nome. Solo il token DISTINTIVO "adoff":
//     "ad off"/"ads off" matchano centinaia di progetti generici (rumore puro). ---
const BRAND_KEYWORDS = ["adoff"];

const GITHUB_TOKEN = process.env.GITHUB_TOKEN || "";
const TG_TOKEN = process.env.TELEGRAM_BOT_TOKEN || "";
const TG_CHAT = process.env.TELEGRAM_CHAT_ID || "";
const TG_THREAD = process.env.TG_THREAD_CLONES || "";
const SCRAPER_URL = process.env.ADOFF_SCRAPER_URL || "";

function loadJson(p, fallback) {
  try { return JSON.parse(fs.readFileSync(p, "utf-8")); } catch (_) { return fallback; }
}

function saveState(state) {
  if (DRY_RUN) return;
  fs.writeFileSync(STATE_PATH, JSON.stringify(state, null, 2));
}

async function getJson(url, headers = {}) {
  const res = await fetch(url, { headers: { "User-Agent": "adoff-clone-monitor", ...headers } });
  if (!res.ok) throw new Error(`HTTP ${res.status} ${res.statusText} — ${url}`);
  return res.json();
}

// =============================================
// SORGENTE 1 — GitHub Code Search (canary)
// =============================================
async function searchGithubCanary(canary) {
  if (!GITHUB_TOKEN) {
    return { skipped: "GITHUB_TOKEN assente — code search disabilitata", hits: [] };
  }
  const url = `https://api.github.com/search/code?q=${encodeURIComponent(`"${canary}"`)}&per_page=30`;
  const data = await getJson(url, {
    Authorization: `Bearer ${GITHUB_TOKEN}`,
    Accept: "application/vnd.github.text-match+json",
  });
  const hits = (data.items || [])
    .filter((it) => !OFFICIAL.githubRepoAllow.test(it.repository?.full_name || ""))
    .filter((it) => !OFFICIAL.githubOwners.includes((it.repository?.owner?.login || "").toLowerCase()))
    .map((it) => ({
      id: "ghcode:" + (it.repository?.full_name || "") + ":" + (it.path || ""),
      label: `📄 GitHub code: ${it.repository?.full_name}/${it.path}`,
      url: it.html_url,
    }));
  return { count: data.total_count, hits };
}

// =============================================
// SORGENTE 2 — GitHub Repo Search (nome/brand)
// =============================================
async function searchGithubRepos() {
  const q = encodeURIComponent(BRAND_KEYWORDS.map((k) => `"${k}"`).join(" OR ") + " in:name,description ad blocker");
  const url = `https://api.github.com/search/repositories?q=${q}&per_page=30&sort=updated`;
  const headers = GITHUB_TOKEN ? { Authorization: `Bearer ${GITHUB_TOKEN}` } : {};
  const data = await getJson(url, headers);
  const hits = (data.items || [])
    .filter((r) => !OFFICIAL.githubRepoAllow.test(r.full_name || ""))
    .filter((r) => !OFFICIAL.githubOwners.includes((r.owner?.login || "").toLowerCase()))
    .map((r) => ({
      id: "ghrepo:" + r.full_name,
      label: `📦 GitHub repo: ${r.full_name} (★${r.stargazers_count})${r.description ? " — " + r.description.slice(0, 80) : ""}`,
      url: r.html_url,
    }));
  return { count: data.total_count, hits };
}

// =============================================
// SORGENTE 3 — Firefox AMO Search (competitor/cloni)
// =============================================
async function searchAmo() {
  const hits = [];
  for (const kw of BRAND_KEYWORDS) {
    let data;
    try {
      data = await getJson(`https://addons.mozilla.org/api/v5/addons/search/?q=${encodeURIComponent(kw)}&type=extension&page_size=20`);
    } catch (_) { continue; }
    for (const a of data.results || []) {
      const slug = (a.slug || "").toLowerCase();
      const guid = (a.guid || "").toLowerCase();
      if (slug === OFFICIAL.amoSlug || (OFFICIAL.amoGuid && guid === OFFICIAL.amoGuid)) continue;
      const name = typeof a.name === "object" ? (a.name.en || Object.values(a.name)[0]) : a.name;
      // AMO fa match fuzzy ("adoff"→"...off"): tieni solo se "adoff" è davvero presente.
      const hay = `${slug} ${String(name || "")}`.toLowerCase().replace(/[\s\-_]/g, "");
      if (!hay.includes("adoff")) continue;
      hits.push({
        id: "amo:" + slug,
        label: `🦊 AMO: "${name}" (slug=${slug}, users=${a.average_daily_users || 0})`,
        url: a.url,
      });
    }
  }
  // dedup interno per id
  const seen = new Set();
  return { hits: hits.filter((h) => (seen.has(h.id) ? false : seen.add(h.id))) };
}

// =============================================
// SORGENTE 4 — CWS/Edge via scraper leobox (opzionale)
// =============================================
async function searchScraper() {
  if (!SCRAPER_URL) return { skipped: "ADOFF_SCRAPER_URL assente", hits: [] };
  try {
    const data = await getJson(`${SCRAPER_URL.replace(/\/$/, "")}/clone-scan?q=${encodeURIComponent(BRAND_KEYWORDS.join(","))}`);
    const hits = (data.hits || []).map((h) => ({
      id: "scraper:" + (h.store || "?") + ":" + (h.id || h.url),
      label: `🛒 ${h.store || "store"}: "${h.title || h.id}"`,
      url: h.url,
    }));
    return { hits };
  } catch (e) {
    return { skipped: "scraper error: " + e.message, hits: [] };
  }
}

// =============================================
// TELEGRAM ALERT
// =============================================
async function sendTelegram(text) {
  if (DRY_RUN || !TG_TOKEN || !TG_CHAT) return false;
  const body = { chat_id: TG_CHAT, text, parse_mode: "HTML", disable_web_page_preview: true };
  if (TG_THREAD) body.message_thread_id = Number(TG_THREAD);
  try {
    const res = await fetch(`https://api.telegram.org/bot${TG_TOKEN}/sendMessage`, {
      method: "POST",
      headers: { "Content-Type": "application/json" },
      body: JSON.stringify(body),
    });
    return res.ok;
  } catch (_) { return false; }
}

// =============================================
// MAIN
// =============================================
(async () => {
  const canaries = loadJson(CANARIES_PATH, null);
  if (!canaries || !canaries.project_canary) {
    console.error("⚠️  canaries.json mancante o senza project_canary. Esegui prima una build (build.js).");
    process.exit(1);
  }
  const CANARY = canaries.project_canary;
  const firstRun = !fs.existsSync(STATE_PATH);
  const state = loadJson(STATE_PATH, { seen: [] });
  const seen = new Set(state.seen);

  console.log(`[clone-monitor] canary=${CANARY} dry=${DRY_RUN}`);

  const sources = await Promise.allSettled([
    searchGithubCanary(CANARY),
    searchGithubRepos(),
    searchAmo(),
    searchScraper(),
  ]);

  const allHits = [];
  const notes = [];
  for (const s of sources) {
    if (s.status === "rejected") { notes.push("⚠️ " + s.reason?.message); continue; }
    if (s.value.skipped) notes.push("ℹ️ " + s.value.skipped);
    for (const h of s.value.hits || []) allHits.push(h);
  }

  const fresh = allHits.filter((h) => !seen.has(h.id));
  fresh.forEach((h) => seen.add(h.id));

  // Le repo/AMO match per-keyword sono "potenziali", il canary è "certo".
  const canaryHits = fresh.filter((h) => h.id.startsWith("ghcode:"));
  const otherHits = fresh.filter((h) => !h.id.startsWith("ghcode:"));

  console.log(`[clone-monitor] hits totali=${allHits.length} nuovi=${fresh.length} (canary=${canaryHits.length})`);
  fresh.forEach((h) => console.log("  • " + h.label + " → " + h.url));
  notes.forEach((n) => console.log("  " + n));

  // Primo run = baseline: registra lo stato esistente senza allarmare (evita burst iniziale).
  if (firstRun && !FORCE_REPORT) {
    console.log(`[clone-monitor] primo run: baseline di ${fresh.length} risultati salvata (nessun alert).`);
    saveState({ seen: [...seen].slice(-2000), lastRun: new Date().toISOString() });
    return;
  }

  if (fresh.length > 0 || FORCE_REPORT) {
    let msg = `🛡️ <b>AdOff Clone Monitor</b>\n`;
    if (canaryHits.length) {
      msg += `\n🚨 <b>${canaryHits.length} match CANARY</b> (codice sorgente COPIATO — alta confidenza):\n`;
      canaryHits.forEach((h) => { msg += `• ${h.label}\n${h.url}\n`; });
      msg += `\n→ Estrai watermark dal clone (verify-watermark.js) e prepara DMCA.\n`;
    }
    if (otherHits.length) {
      msg += `\n👀 <b>${otherHits.length} potenziali</b> (nome/keyword — da verificare a mano):\n`;
      otherHits.slice(0, 15).forEach((h) => { msg += `• ${h.label}\n${h.url}\n`; });
    }
    if (!fresh.length) msg += `\n✅ Nessun nuovo match. (heartbeat)\n`;
    if (notes.length) msg += `\n<i>${notes.join(" · ")}</i>`;
    const sent = await sendTelegram(msg);
    console.log(sent ? "[clone-monitor] alert Telegram inviato" : "[clone-monitor] alert NON inviato (dry-run o token mancante)");
  }

  saveState({ seen: [...seen].slice(-2000), lastRun: new Date().toISOString() });
})().catch((e) => { console.error("[clone-monitor] errore fatale:", e); process.exit(1); });
