// AdOff — Review Poller (n8n Code node, runOnceForAllItems)
// Sorgenti: Firefox AMO (API + fallback scraper) + Edge (delta aggregato + scraper testi)
// + CWS (scraper via microservizio HTTP).
// Stato (dedup): workflow static data. Telegram: thread 24 (Recensioni).
// Token/chat: da $env (TELEGRAM_BOT_TOKEN, TELEGRAM_CHAT_ID in /opt/n8n/.env).

const AMO_SLUG = "adoff";
const EDGE_CRX = "oddekkkjecbnogahoielolemebjlmclk";
const THREAD = 24;
const SCRAPER_URL = $env.ADOFF_SCRAPER_URL || "http://100.71.178.53:8788/poll";

const stars = n => "★".repeat(Math.max(0, Math.min(5, n | 0))) + "☆".repeat(5 - Math.max(0, Math.min(5, n | 0)));

function hashReview(r) {
  const crypto = require("crypto");
  return crypto.createHash("md5").update((r.author || "") + "|" + (r.score || "") + "|" + (r.body || "").slice(0, 100)).digest("hex");
}

const token = $env.TELEGRAM_BOT_TOKEN;
const chat = $env.TELEGRAM_CHAT_ID;
const sd = $getWorkflowStaticData("global");

// Init state
if (!Array.isArray(sd.amoSeenIds)) sd.amoSeenIds = [];
if (!Array.isArray(sd.amoSeenHashes)) sd.amoSeenHashes = [];
if (!Array.isArray(sd.cwsSeenHashes)) sd.cwsSeenHashes = [];
if (!Array.isArray(sd.edgeSeenHashes)) sd.edgeSeenHashes = [];
if (sd.edgeCount === undefined) sd.edgeCount = null;

const messages = [];

// Firefox AMO — API con fallback
try {
  const d = await this.helpers.httpRequest({ url: `https://addons.mozilla.org/api/v5/ratings/rating/?addon=${AMO_SLUG}&page_size=25`, json: true });
  for (const r of (d.results || []).reverse()) {
    const id = "amo:" + r.id;
    const hash = hashReview(r);

    if (sd.amoSeenIds.includes(id) || sd.amoSeenHashes.includes(hash)) continue;

    sd.amoSeenIds.push(id);
    sd.amoSeenHashes.push(hash);

    const body = (r.body || "").trim();
    messages.push(`🦊 <b>Firefox AMO</b> ${stars(r.score)} (${r.score}/5)\n👤 ${(r.user && r.user.name) || "anon"}\n${body ? body.slice(0, 600) : "<i>(senza testo)</i>"}`);
  }
} catch (e) { messages.push("⚠️ AMO poll error: " + e.message); }

// Edge — aggregato (delta numero recensioni)
try {
  const d = await this.helpers.httpRequest({ url: `https://microsoftedge.microsoft.com/addons/getproductdetailsbycrxid/${EDGE_CRX}`, json: true });
  const count = d.ratingCount || 0, avg = d.averageRating || 0;
  if (sd.edgeCount !== null && count > sd.edgeCount) {
    messages.push(`🔷 <b>Edge Add-ons</b>: ${count - sd.edgeCount} nuova/e recensione/i (totale ${count}, media ${avg.toFixed(1)}/5).\n<i>Edge non espone i testi via API — usa lo scraper per leggerli.</i>`);
  }
  sd.edgeCount = count;
} catch (e) { messages.push("⚠️ Edge aggregate error: " + e.message); }

// Scraper Playwright (testi CWS + Edge) — microservizio HTTP
try {
  const s = await this.helpers.httpRequest({ url: SCRAPER_URL, json: true, timeout: 180000 });

  // CWS
  if (s.cws && s.cws.reviews) {
    for (const r of s.cws.reviews) {
      const hash = hashReview(r);
      if (sd.cwsSeenHashes.includes(hash)) continue;
      sd.cwsSeenHashes.push(hash);

      const body = (r.body || "").trim();
      messages.push(`🟢 <b>Chrome Web Store</b> ${stars(r.score)} (${r.score}/5)\n👤 ${r.author || "anon"}\n${body ? body.slice(0, 600) : "<i>(senza testo)</i>"}`);
    }
  }

  // Edge (da scraper, testi)
  if (s.edge && s.edge.newReviews) {
    for (const r of s.edge.newReviews) {
      const hash = hashReview(r);
      if (sd.edgeSeenHashes.includes(hash)) continue;
      sd.edgeSeenHashes.push(hash);

      const body = (r.body || "").trim();
      messages.push(`🔷 <b>Edge Add-ons (Testo)</b> ${stars(r.score)} (${r.score}/5)\n👤 ${r.author || "anon"}\n${body ? body.slice(0, 600) : "<i>(senza testo)</i>"}`);
    }
  }
} catch (e) { messages.push("⚠️ Scraper error: " + e.message); }

// Trim state
sd.amoSeenIds = sd.amoSeenIds.slice(-500);
sd.amoSeenHashes = sd.amoSeenHashes.slice(-500);
sd.cwsSeenHashes = sd.cwsSeenHashes.slice(-500);
sd.edgeSeenHashes = sd.edgeSeenHashes.slice(-500);

// Invio Telegram (thread 24)
let posted = 0;
for (const text of messages) {
  try {
    await this.helpers.httpRequest({
      method: "POST",
      url: `https://api.telegram.org/bot${token}/sendMessage`,
      body: {
        chat_id: chat,
        message_thread_id: THREAD,
        text,
        parse_mode: "HTML",
        disable_web_page_preview: true
      },
      json: true,
    });
    posted++;
  } catch (e) {
    // log error ma continua con i messaggi seguenti
  }
}

return [{
  json: {
    checked: true,
    newReviews: messages.length,
    posted,
    edgeCount: sd.edgeCount,
    amoSeenCount: sd.amoSeenIds.length,
    cwsSeenCount: sd.cwsSeenHashes.length,
    edgeSeenCount: sd.edgeSeenHashes.length,
    timestamp: new Date().toISOString()
  }
}];
