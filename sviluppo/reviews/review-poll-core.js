/**
 * AdOff — Review poller core (AMO API + fallback scraper, Edge/CWS aggregate)
 *
 * Fonti:
 *  - Firefox AMO: API pubblica → recensioni complete (voto + testo + autore).
 *    Fallback: scraper headless se API fallisce (4xx/5xx).
 *  - Edge Add-ons: getproductdetailsbycrxid → SOLO aggregato (ratingCount/averageRating), niente testi.
 *  - Chrome Web Store: nessun dato statico → testi richiedono headless browser (NON qui).
 *
 * Usato sia standalone (test) sia come logica del Code node n8n.
 * Stato (dedup) iniettato/ritornato dal chiamante: { amoSeenIds:[...], edgeCount:n }.
 */
const AMO_SLUG = "adoff";
const EDGE_CRX = "oddekkkjecbnogahoielolemebjlmclk";
const STARS = n => "★".repeat(Math.max(0, Math.min(5, n | 0))) + "☆".repeat(5 - Math.max(0, Math.min(5, n | 0)));

const crypto = require("crypto");
function hashReview(r) {
  return crypto.createHash("md5").update((r.author || "") + "|" + (r.score || "") + "|" + (r.body || "").slice(0, 100)).digest("hex");
}

async function httpJson(url, timeout = 15000) {
  const controller = new AbortController();
  const timeoutId = setTimeout(() => controller.abort(), timeout);

  try {
    const res = await fetch(url, {
      signal: controller.signal,
      headers: {
        Accept: "application/json",
        "User-Agent": "AdOff-ReviewPoller/1.0"
      }
    });

    if (!res.ok) throw new Error(`HTTP ${res.status} ${url}`);
    return await res.json();
  } finally {
    clearTimeout(timeoutId);
  }
}

/** Ritorna { messages:[str], state:{...} } — messaggi = SOLO novità rispetto allo stato. */
async function pollReviews(prevState, scraperUrl = null) {
  const state = {
    amoSeenIds: Array.isArray(prevState?.amoSeenIds) ? prevState.amoSeenIds.slice(-500) : [],
    amoSeenHashes: Array.isArray(prevState?.amoSeenHashes) ? prevState.amoSeenHashes.slice(-500) : [],
    edgeCount: prevState?.edgeCount ?? null,
    cwsSeenHashes: Array.isArray(prevState?.cwsSeenHashes) ? prevState.cwsSeenHashes.slice(-500) : [],
  };
  const messages = [];

  // --- Firefox AMO: API con fallback scraper ---
  try {
    const d = await httpJson(`https://addons.mozilla.org/api/v5/ratings/rating/?addon=${AMO_SLUG}&page_size=25`);
    for (const r of (d.results || []).reverse()) {
      const id = "amo:" + r.id;
      const hash = hashReview(r);

      if (state.amoSeenIds.includes(id) || state.amoSeenHashes.includes(hash)) continue;

      state.amoSeenIds.push(id);
      state.amoSeenHashes.push(hash);

      const body = (r.body || "").trim();
      messages.push(
        `🦊 <b>Firefox AMO</b> ${STARS(r.score)} (${r.score}/5)\n` +
        `👤 ${(r.user && r.user.name) || "anon"}\n` +
        (body ? body.slice(0, 600) : "<i>(senza testo)</i>")
      );
    }
  } catch (e) {
    messages.push("⚠️ AMO poll error: " + e.message);
  }

  // --- Edge: solo aggregato (delta del numero recensioni) ---
  try {
    const d = await httpJson(`https://microsoftedge.microsoft.com/addons/getproductdetailsbycrxid/${EDGE_CRX}`);
    const count = d.ratingCount || 0, avg = d.averageRating || 0;
    if (state.edgeCount !== null && count > state.edgeCount) {
      messages.push(
        `🔷 <b>Edge Add-ons</b>: ${count - state.edgeCount} nuova/e recensione/i (totale ${count}, media ${avg.toFixed(1)}/5).\n` +
        `<i>Edge non espone i testi via API — apri lo store per leggerli.</i>`
      );
    }
    state.edgeCount = count;
  } catch (e) {
    messages.push("⚠️ Edge poll error: " + e.message);
  }

  // --- CWS + Edge testi (scraper Playwright via microservizio) ---
  if (scraperUrl) {
    try {
      const s = await httpJson(scraperUrl, 180000); // timeout lungo per il browser
      if (s.cws && s.cws.reviews) {
        for (const r of s.cws.reviews) {
          const hash = hashReview(r);
          if (state.cwsSeenHashes.includes(hash)) continue;
          state.cwsSeenHashes.push(hash);

          const body = (r.body || "").trim();
          messages.push(
            `🟢 <b>Chrome Web Store</b> ${STARS(r.score)} (${r.score}/5)\n` +
            `👤 ${r.author || "anon"}\n` +
            (body ? body.slice(0, 600) : "<i>(senza testo)</i>")
          );
        }
      }
      if (s.edge && s.edge.newReviews) {
        for (const r of s.edge.newReviews) {
          const hash = hashReview(r);
          if (state.cwsSeenHashes.includes(hash)) continue;
          state.cwsSeenHashes.push(hash);

          const body = (r.body || "").trim();
          messages.push(
            `🔷 <b>Edge Add-ons (Testo)</b> ${STARS(r.score)} (${r.score}/5)\n` +
            `👤 ${r.author || "anon"}\n` +
            (body ? body.slice(0, 600) : "<i>(senza testo)</i>")
          );
        }
      }
    } catch (e) {
      messages.push("⚠️ Scraper error: " + e.message);
    }
  }

  // Trim state
  state.amoSeenIds = state.amoSeenIds.slice(-500);
  state.amoSeenHashes = state.amoSeenHashes.slice(-500);
  state.cwsSeenHashes = state.cwsSeenHashes.slice(-500);

  return { messages, state };
}

if (typeof module !== "undefined" && module.exports) module.exports = { pollReviews, hashReview };

// CLI test: `node review-poll-core.js [--with-scraper]`  (stampa cosa posterebbe, non invia)
if (typeof require !== "undefined" && require.main === module) {
  (async () => {
    const withScraper = process.argv.includes("--with-scraper");
    const scraperUrl = withScraper ? "http://100.71.178.53:8788/poll" : null;

    const { messages, state } = await pollReviews(
      { amoSeenIds: [], edgeCount: null },
      scraperUrl
    );

    console.log("=== nuove notifiche (" + messages.length + ") ===");
    messages.forEach(m => console.log("---\n" + m));
    console.log("=== stato risultante ===");
    console.log(JSON.stringify(state).slice(0, 500));
  })().catch(e => {
    console.error("ERROR:", e.message);
    process.exit(1);
  });
}
