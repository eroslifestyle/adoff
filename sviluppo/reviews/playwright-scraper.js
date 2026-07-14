/**
 * AdOff — Playwright scraper per CWS + Edge (testi recensione)
 *
 * Onestà: CWS ed Edge NON espongono i testi via API. Questo scraper apre la pagina
 * store con un browser headless e prova a estrarre le recensioni dal DOM renderizzato.
 * È FRAGILE: si rompe quando i siti cambiano markup; CWS può bloccare headless.
 *
 * Strategia robusta: cerca le recensioni con SELETTORI EURISTICI multipli + heuristics
 * basate su pattern ricorrenti (autore + voto stelle + corpo). Se non trova nulla con
 * un selettore, prova il successivo. In assenza totale, ritorna [] senza esplodere.
 *
 * Output: { cws: [{author, score, body, when, reviewId}], edge: [...] }
 *
 * CLI:
 *   node playwright-scraper.js                # scrape entrambi, JSON su stdout
 *   node playwright-scraper.js --dump cws     # naviga e salva HTML della sezione per debug
 *   node playwright-scraper.js --dump edge    # naviga e salva HTML della sezione per debug
 */
const { chromium } = require("playwright");
const crypto = require("crypto");

const CWS_URL  = "https://chromewebstore.google.com/detail/fcjfpfhdcpbjmihiikbblcokmjnhedhp/reviews";
const EDGE_URL = "https://microsoftedge.microsoft.com/addons/detail/oddekkkjecbnogahoielolemebjlmclk";

function logJSON(action, data) {
  const log = { ts: new Date().toISOString(), action, ...data };
  console.error(JSON.stringify(log));
}

async function newPage(browser) {
  const ctx = await browser.newContext({
    locale: "en-US",
    userAgent: "Mozilla/5.0 (X11; Linux x86_64) AppleWebKit/537.36 (KHTML, like Gecko) Chrome/131.0.0.0 Safari/537.36",
    viewport: { width: 1920, height: 1080 },
  });
  const page = ctx.newPage();
  // Blocca media pesanti per velocità
  await page.route("**/*.{png,jpg,jpeg,gif,webp,svg,woff,woff2,ttf,eot,mp4,webm}", route => route.abort());
  return page;
}

/** Estrae recensioni euristicamente dal DOM. */
function extractReviews(strategy) {
  // strategy: "cws" | "edge"
  const out = [];

  // Early-exit: se la pagina dichiara esplicitamente "no reviews/ratings", ritorna []
  const pageText = (document.body.innerText || "");
  if (/\b(No ratings|No reviews|Be the first to (rate|review)|Nessuna recensione|0\s*ratings?|0\s*reviews?)\b/i.test(pageText)) {
    return [];
  }

  // Filtri rumore: sezioni "You might also like" / nomi noti di altri ad blocker (raccomandazioni)
  const NOISE_NAMES = /\b(uBlock|AdBlock|AdGuard|Ghostery|Privacy Badger|Stands|AdLock|AdRemover|Total Adblock|Pricetag|PopupOFF)\b/i;
  const NOISE_HEADINGS = /You might also like|Potrebbero interessarti|Consigliati|Recommended|Similar|More extensions|Related/i;

  // Container candidati per le recensioni (scope stretto)
  const containerSelectors = strategy === "cws"
    ? [
        'section[aria-label*="Reviews" i]',
        'div[role="region"][aria-label*="Reviews" i]',
        'div[aria-label*="Reviews" i]',
        '[data-section-id="reviews"]', // possibile nuovo attr
      ]
    : [
        'section[aria-label*="Reviews" i]',
        'div[aria-label*="Reviews" i]',
        'ul[data-bi-name="reviewslist"]', // Fluent UI Edge
        '#reviewsSection',
      ];

  let root = null;
  for (const sel of containerSelectors) {
    const el = document.querySelector(sel);
    if (el && el.innerText && el.innerText.length > 100) { root = el; break; }
  }
  // Niente container "Reviews" preciso → niente recensioni vere. Non scendere a document.body.
  if (!root) return [];

  // Trova "card" recensione: nodi con star-rating + paragrafo testo
  // CWS: div[role="article"] o simile; Edge: <li> in ul[data-bi-name]
  const cardSelectors = strategy === "cws"
    ? ['div[role="article"]', 'div[class*="review"]', 'article']
    : ['li', 'div[class*="review"]', 'article'];

  let cards = [];
  for (const sel of cardSelectors) {
    cards = Array.from(root.querySelectorAll(sel)).filter(c => {
      const t = (c.innerText || "").trim();
      return t.length > 30 && t.length < 4000;
    });
    if (cards.length > 0) break;
  }

  for (const c of cards) {
    const text = (c.innerText || "").trim();

    // Vota: cerca aria-label "5 stars"/"5 su 5"/"5 out of 5" o icone "★" / data-rating
    const ariaScore = c.querySelector('[aria-label*="star" i], [aria-label*="out of" i], [role="img"][aria-label], [data-rating]');
    let score = null;

    if (ariaScore) {
      const ariaLabel = ariaScore.getAttribute("aria-label") || "";
      const dataRating = ariaScore.getAttribute("data-rating");

      if (dataRating) {
        score = parseInt(dataRating);
      } else {
        const m = ariaLabel.match(/(\d)(?:\s*(?:star|stelle|out of|su)|\D)/i);
        if (m) score = parseInt(m[1]);
      }
    }

    if (score === null) {
      // Conta '★' come fallback
      const stars = (text.match(/★/g) || []).length;
      if (stars >= 1 && stars <= 5) score = stars;
    }

    if (score === null || score < 1 || score > 5) continue; // niente voto chiaro → non è una recensione

    // Filtro rumore: card "consigliati" / nomi di prodotti concorrenti
    if (NOISE_HEADINGS.test(text)) continue;
    if (NOISE_NAMES.test(text) && /immediate|installat|content blocker|trackers|miners|fast,? lightweight|remove|block/i.test(text)) continue;

    // Autore: heading/strong/span con maiuscola, lunghezza ragionevole
    let author = "";
    const hEl = c.querySelector("h2,h3,h4,strong,b,[role='heading'],[class*='user'],[class*='author'],[class*='name']");
    if (hEl) author = (hEl.innerText || "").trim().split("\n")[0].slice(0, 80);

    // Fallback: primo span/div non-vuoto (possibile pattern Edge Fluent UI)
    if (!author) {
      const fallback = c.querySelector("span:not(:empty),b:not(:empty)");
      if (fallback) author = (fallback.innerText || "").trim().slice(0, 80);
    }

    // Corpo: il paragrafo più lungo dentro la card, escludendo pulsanti e metadata
    let body = "";
    const paras = Array.from(c.querySelectorAll("p,span,div"))
      .map(n => {
        const txt = (n.innerText || "").trim();
        // Scarta se è buttontext o metadata
        if (n.tagName === 'BUTTON' || n.getAttribute('role') === 'button') return null;
        if (/Helpful|Reported|Agree|Disagree|Report|Follow|Flag/i.test(txt)) return null;
        return txt;
      })
      .filter(s => s && s !== author && !s.startsWith("★") && s.length > 20 && s.length < 2000);

    if (paras.length) body = paras.sort((a, b) => b.length - a.length)[0];

    // Quando: cerca <time> o date string
    let when = "";
    const tEl = c.querySelector("time");
    if (tEl) when = tEl.getAttribute("datetime") || tEl.innerText || "";

    // Dedup nello stesso run: hash SHA1 per robustezza
    const sig = author + "|" + score + "|" + body.slice(0, 100);
    if (out.some(r => (r.author + "|" + r.score + "|" + r.body.slice(0, 100)) === sig)) continue;

    out.push({
      author: author || "anon",
      score,
      body,
      when,
      reviewId: require('crypto').createHash('sha1').update(sig).digest('hex').slice(0, 12)
    });
  }
  return out;
}

async function dismissGoogleConsent(page) {
  // CWS è dietro consent.google.com; se appare, premiamo un bottone di chiusura.
  const title = await page.title();
  const url = page.url();
  if (!/consent\.google\.com|Before you continue|This data|Your privacy/i.test(title + " " + url)) return false;

  try {
    const labels = ["Reject all", "Rifiuta tutto", "Tout refuser", "Alle ablehnen", "Rechazar todo"];
    for (const label of labels) {
      try {
        const btn = await page.locator(`button:has-text("${label}")`).first();
        if (await btn.isVisible({ timeout: 3000 })) {
          await btn.click({ timeout: 5000 });
          await page.waitForLoadState("domcontentloaded", { timeout: 15000 });
          logJSON("consent_dismissed", { label });
          return true;
        }
      } catch (_) {}
    }
  } catch (e) {
    logJSON("consent_dismiss_error", { error: e.message });
  }
  return false;
}

async function scrapeStore(browser, url, strategy, retries = 1) {
  const page = await newPage(browser);
  const result = { url, ok: false, reviews: [], error: null, navTitle: "", count: 0 };

  try {
    logJSON("scrape_start", { strategy, url });

    // Navigation con retry su timeout
    let navSuccess = false;
    for (let i = 0; i <= retries; i++) {
      try {
        await page.goto(url, { waitUntil: "domcontentloaded", timeout: 30000 });
        navSuccess = true;
        break;
      } catch (e) {
        if (i === retries) throw e;
        logJSON("scrape_nav_retry", { strategy, attempt: i + 1, error: e.message });
        await page.reload({ waitUntil: "domcontentloaded" });
      }
    }
    if (!navSuccess) throw new Error("Navigation failed after retries");

    await page.waitForTimeout(1500);

    if (await dismissGoogleConsent(page)) {
      await page.waitForTimeout(2000);
    }

    // Le recensioni spesso compaiono dopo render → attendi
    await page.waitForTimeout(2000);

    // Prova a scrollare verso una eventuale sezione "Reviews"
    try {
      await page.evaluate(() => {
        const h = Array.from(document.querySelectorAll('h1,h2,h3,[role="heading"]'))
          .find(x => /review|recension|valutaz|rating/i.test(x.innerText || ""));
        if (h) h.scrollIntoView({ block: "center" });
      });
      await page.waitForTimeout(1000);
    } catch (_) {}

    result.navTitle = await page.title();
    result.reviews = await page.evaluate(extractReviews, strategy);
    result.count = result.reviews.length;
    result.ok = true;

    logJSON("scrape_success", { strategy, count: result.count });
  } catch (e) {
    result.error = e.message;
    logJSON("scrape_error", { strategy, error: e.message });
  } finally {
    await page.context().close();
  }
  return result;
}

async function dumpReviewsSection(browser, url, outFile) {
  const page = await newPage(browser);
  try {
    await page.goto(url, { waitUntil: "domcontentloaded", timeout: 45000 });
    await page.waitForTimeout(4000);
    await page.evaluate(() => {
      const h = Array.from(document.querySelectorAll('h1,h2,h3,[role="heading"]'))
        .find(x => /review|recension|valutaz/i.test(x.innerText || ""));
      if (h) h.scrollIntoView({ block: "center" });
    });
    await page.waitForTimeout(1500);
    const html = await page.content();
    require("fs").writeFileSync(outFile, html);
    console.log("HTML salvato in", outFile, "(" + html.length + " bytes), title:", await page.title());
  } finally {
    await page.context().close();
  }
}

async function main() {
  const args = process.argv.slice(2);
  const dumpIdx = args.indexOf("--dump");
  const browser = await chromium.launch({
    headless: true,
    args: ["--no-sandbox", "--disable-dev-shm-usage"]
  });

  try {
    if (dumpIdx !== -1) {
      const target = args[dumpIdx + 1];
      if (target === "cws") {
        await dumpReviewsSection(browser, CWS_URL, "/tmp/cws-page.html");
      } else if (target === "edge") {
        await dumpReviewsSection(browser, EDGE_URL, "/tmp/edge-page.html");
      } else {
        console.error("usage: --dump cws|edge");
      }
      return;
    }

    // Scrape parallelo
    const [cws, edge] = await Promise.all([
      scrapeStore(browser, CWS_URL, "cws"),
      scrapeStore(browser, EDGE_URL, "edge"),
    ]);

    process.stdout.write(JSON.stringify({ cws, edge }, null, 2) + "\n");
  } catch (e) {
    logJSON("main_error", { error: e.message });
    process.exit(1);
  } finally {
    await browser.close();
  }
}

if (require.main === module) {
  main().catch(e => {
    logJSON("fatal_error", { error: e.message });
    process.exit(1);
  });
}

module.exports = { scrapeStore, logJSON, CWS_URL, EDGE_URL };
