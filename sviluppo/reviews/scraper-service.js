/**
 * AdOff — Micro HTTP service che espone lo scraper Playwright (CWS+Edge) a n8n.
 *   GET  /health                → {ok:true, uptime, busy}
 *   GET  /poll                  → { cws:{reviews:[...], navTitle, ok, count}, edge:{...} } (scrape + dedup state)
 *   GET  /poll?store=cws|edge   → scrape solo uno store
 *   GET  /dump?store=cws|edge   → salva HTML per debug in /tmp/
 *   GET  /state                 → ritorna stato dedup corrente
 *
 * Stato (dedup) in /var/lib/adoff-scraper-state.json: { cwsSeenHashes:[...], edgeSeenHashes:[...] }.
 * Concurrency guard: 1 scrape alla volta (le pagine sono lente).
 *
 *   PORT=8788 node scraper-service.js
 */
const http = require("http");
const fs = require("fs");
const url = require("url");
const crypto = require("crypto");
const { chromium } = require("playwright");
const { scrapeStore, logJSON, CWS_URL, EDGE_URL } = require("./playwright-scraper");

const PORT = parseInt(process.env.PORT || "8788");
const STATE = process.env.STATE_FILE || "/var/lib/adoff-scraper-state.json";
const START_TIME = Date.now();

function hashReview(r) {
  return crypto.createHash("md5").update((r.author || "") + "|" + (r.score || "") + "|" + (r.body || "").slice(0, 100)).digest("hex");
}

function loadState() {
  try {
    return JSON.parse(fs.readFileSync(STATE, "utf8"));
  } catch {
    return { cwsSeenHashes: [], edgeSeenHashes: [] };
  }
}

function saveState(s) {
  s.cwsSeenHashes = (s.cwsSeenHashes || []).slice(-500);
  s.edgeSeenHashes = (s.edgeSeenHashes || []).slice(-500);

  // Atomic write: tmp file + rename
  const tmpFile = STATE + ".tmp";
  fs.writeFileSync(tmpFile, JSON.stringify(s), "utf8");
  fs.renameSync(tmpFile, STATE);

  logJSON("state_saved", { cws: s.cwsSeenHashes.length, edge: s.edgeSeenHashes.length });
}

let busy = false;

async function pollOnce(stores = ["cws", "edge"]) {
  const browser = await chromium.launch({
    headless: true,
    args: ["--no-sandbox", "--disable-dev-shm-usage"]
  });

  try {
    const tasks = {};
    if (stores.includes("cws")) tasks.cws = scrapeStore(browser, CWS_URL, "cws");
    if (stores.includes("edge")) tasks.edge = scrapeStore(browser, EDGE_URL, "edge");

    const results = await Promise.all(Object.values(tasks));
    const [cws, edge] = [tasks.cws ? results[0] : null, tasks.edge ? results[1] : null];

    const st = loadState();

    if (cws) {
      cws.newReviews = cws.reviews.filter(r => !st.cwsSeenHashes.includes(hashReview(r)));
      cws.newReviews.forEach(r => st.cwsSeenHashes.push(hashReview(r)));
    }

    if (edge) {
      edge.newReviews = edge.reviews.filter(r => !st.edgeSeenHashes.includes(hashReview(r)));
      edge.newReviews.forEach(r => st.edgeSeenHashes.push(hashReview(r)));
    }

    saveState(st);

    return {
      ...(cws ? { cws } : {}),
      ...(edge ? { edge } : {}),
      stateSize: {
        cws: st.cwsSeenHashes.length,
        edge: st.edgeSeenHashes.length
      },
      timestamp: new Date().toISOString()
    };
  } finally {
    await browser.close();
  }
}

const server = http.createServer(async (req, res) => {
  const parsedUrl = url.parse(req.url, true);
  const pathname = parsedUrl.pathname;
  const query = parsedUrl.query;

  // CORS
  res.setHeader("Access-Control-Allow-Origin", "*");
  res.setHeader("Content-Type", "application/json");

  try {
    if (pathname === "/health") {
      res.writeHead(200);
      return res.end(JSON.stringify({
        ok: true,
        uptime: Math.floor((Date.now() - START_TIME) / 1000),
        busy
      }));
    }

    if (pathname === "/state") {
      const st = loadState();
      res.writeHead(200);
      return res.end(JSON.stringify(st));
    }

    if (pathname === "/poll") {
      if (busy) {
        res.writeHead(429);
        return res.end(JSON.stringify({ ok: false, error: "scrape in progress" }));
      }

      busy = true;
      const stores = query.store ? [query.store] : ["cws", "edge"];

      try {
        const result = await pollOnce(stores);
        res.writeHead(200);
        res.end(JSON.stringify(result));
      } catch (e) {
        logJSON("poll_error", { error: e.message });
        res.writeHead(500);
        res.end(JSON.stringify({ ok: false, error: e.message }));
      } finally {
        busy = false;
      }
      return;
    }

    if (pathname === "/dump") {
      if (!query.store || !["cws", "edge"].includes(query.store)) {
        res.writeHead(400);
        return res.end(JSON.stringify({ error: "usage: /dump?store=cws|edge" }));
      }

      busy = true;
      try {
        const browser = await chromium.launch({
          headless: true,
          args: ["--no-sandbox", "--disable-dev-shm-usage"]
        });

        try {
          const storeUrl = query.store === "cws" ? CWS_URL : EDGE_URL;
          const page = await (await browser.newContext()).newPage();

          try {
            await page.goto(storeUrl, { waitUntil: "domcontentloaded", timeout: 30000 });
            await page.waitForTimeout(3000);

            const html = await page.content();
            const outFile = `/tmp/${query.store}-page-${Date.now()}.html`;
            fs.writeFileSync(outFile, html);

            res.writeHead(200);
            res.end(JSON.stringify({ ok: true, file: outFile, size: html.length }));
          } finally {
            await page.context().close();
          }
        } finally {
          await browser.close();
        }
      } catch (e) {
        logJSON("dump_error", { error: e.message });
        res.writeHead(500);
        res.end(JSON.stringify({ ok: false, error: e.message }));
      } finally {
        busy = false;
      }
      return;
    }

    res.writeHead(404);
    res.end(JSON.stringify({ error: "not found. available: /health, /poll, /dump, /state" }));
  } catch (e) {
    logJSON("http_error", { error: e.message });
    res.writeHead(500);
    res.end(JSON.stringify({ ok: false, error: e.message }));
  }
});

server.listen(PORT, "0.0.0.0", () => {
  logJSON("service_start", { port: PORT, state_file: STATE });
  console.log(`AdOff scraper service listening on :${PORT} (state: ${STATE})`);
});
