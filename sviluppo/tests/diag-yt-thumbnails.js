/**
 * Diagnostica: le thumbnail/cover di YouTube non si caricano più.
 * Carica l'estensione, naviga YouTube, e riporta:
 *  - quali richieste immagine vengono BLOCCATE (e da chi)
 *  - quali <img> thumbnail falliscono il render (naturalWidth === 0)
 */
const { chromium } = require("playwright");
const path = require("path");

const EXTENSION_PATH = path.resolve(__dirname, "../../app");
const WITH_EXT = process.env.NOEXT !== "1";

(async () => {
  const extArgs = WITH_EXT
    ? [`--disable-extensions-except=${EXTENSION_PATH}`, `--load-extension=${EXTENSION_PATH}`]
    : [];
  console.log(`\n### MODALITÀ: ${WITH_EXT ? "CON estensione AdOff" : "SENZA estensione (baseline)"} ###`);
  const context = await chromium.launchPersistentContext("", {
    headless: false,
    channel: "chrome",
    args: [
      ...extArgs,
      "--no-first-run",
      "--disable-default-apps",
      "--mute-audio",
    ],
    viewport: { width: 1366, height: 900 },
    ignoreDefaultArgs: ["--disable-extensions"],
  });

  await new Promise((r) => setTimeout(r, 2500));

  const page = await context.newPage();

  // FORZA stato Pro/Trial: isProEnabled() controlla solo il formato ao_[8hex]
  // → attiva il fetch hook di stealth.js (Layer A) che ricostruisce /player e /next
  if (WITH_EXT && process.env.FORCE_PRO === "1") {
    console.log(">>> FORZO modalità PRO (data-adoff-stealth) — fetch hook ATTIVO");
    await page.addInitScript(() => {
      const set = () => {
        if (document.documentElement) {
          document.documentElement.setAttribute("data-adoff-stealth", "ao_abcdef12");
        } else { requestAnimationFrame(set); }
      };
      set();
      const mo = new MutationObserver(set);
      try { mo.observe(document, { childList: true, subtree: true }); } catch (_) {}
    });
  }

  const pageErrors = [];
  page.on("pageerror", (e) => pageErrors.push(String(e).slice(0, 160)));

  const blockedImg = [];
  page.on("requestfailed", (req) => {
    const url = req.url();
    if (req.resourceType() === "image" || /ytimg|ggpht|googleusercontent/.test(url)) {
      blockedImg.push({ url: url.slice(0, 110), reason: req.failure()?.errorText });
    }
  });

  console.log("\n=== Navigo YouTube homepage ===");
  await page.goto("https://www.youtube.com", { waitUntil: "domcontentloaded", timeout: 25000 });

  // consenso EU — click per coordinate sul bottone "Accetta tutto"
  await page.waitForTimeout(2500);
  await page.mouse.click(813, 808);
  await page.waitForTimeout(4000);
  // se ancora su consent, ri-naviga
  await page.goto("https://www.youtube.com", { waitUntil: "domcontentloaded", timeout: 25000 }).catch(() => {});

  const scanImgs = () => page.evaluate(() => {
    const imgs = Array.from(document.querySelectorAll(
      "ytd-video-renderer img, ytd-rich-item-renderer img, ytd-compact-video-renderer img, " +
      "yt-lockup-view-model img, ytd-thumbnail img, yt-image img, img.yt-core-image"
    ));
    let loaded = 0, broken = 0, empty = 0;
    const brokenSamples = [];
    for (const img of imgs) {
      const src = img.currentSrc || img.src || "";
      const onScreen = img.getBoundingClientRect().top < window.innerHeight + 200 && img.getBoundingClientRect().bottom > -200;
      if (!src || src.startsWith("data:")) { empty++; continue; }
      if (img.complete && img.naturalWidth > 0) loaded++;
      else if (onScreen) {
        broken++;
        if (brokenSamples.length < 10) brokenSamples.push((src || "(no src)").slice(0, 120));
      }
    }
    return { total: imgs.length, loaded, broken, empty, brokenSamples };
  });

  const report = (label, r) => {
    console.log(`\n=== ${label} ===`);
    console.log(`img: ${r.total} | caricate: ${r.loaded} | ROTTE(on-screen): ${r.broken} | vuote/lazy: ${r.empty}`);
    if (r.brokenSamples.length) { console.log("src rotti:"); r.brokenSamples.forEach((s) => console.log("  ✗ " + s)); }
  };

  // A) RISULTATI DI RICERCA (galleria)
  console.log("=== Navigo risultati di ricerca (galleria) ===");
  await page.goto("https://www.youtube.com/results?search_query=lofi", { waitUntil: "domcontentloaded", timeout: 25000 }).catch(() => {});
  await page.waitForTimeout(5000);
  for (let i = 0; i < 4; i++) { await page.mouse.wheel(0, 1200); await page.waitForTimeout(1500); }
  await page.mouse.wheel(0, -4000); await page.waitForTimeout(2500);
  report("RICERCA (galleria)", await scanImgs());
  await page.screenshot({ path: path.resolve(__dirname, "../data-analisi/screenshots/yt-thumb-search.png") });

  // B) WATCH PAGE — sidebar correlati (driven da /youtubei/v1/next, intercettato da stealth.js)
  console.log("\n=== Navigo watch page (sidebar correlati) ===");
  await page.goto("https://www.youtube.com/watch?v=jfKfPfyJRdk", { waitUntil: "domcontentloaded", timeout: 25000 }).catch(() => {});
  await page.waitForTimeout(8000);
  for (let i = 0; i < 3; i++) { await page.mouse.wheel(0, 1000); await page.waitForTimeout(1500); }
  report("WATCH (sidebar correlati)", await scanImgs());
  await page.screenshot({ path: path.resolve(__dirname, "../data-analisi/screenshots/yt-thumb-watch.png") });

  console.log("\n=== RICHIESTE IMMAGINE BLOCCATE (ytimg/ggpht) ===");
  const imgBlocks = blockedImg.filter((b) => /ytimg|ggpht|googleusercontent/.test(b.url));
  if (!imgBlocks.length) console.log("  (nessuna richiesta thumbnail bloccata)");
  const seen = new Set();
  for (const b of imgBlocks) {
    const key = b.url.split("?")[0];
    if (seen.has(key)) continue;
    seen.add(key);
    console.log(`  ✗ [${b.reason}] ${b.url}`);
  }

  const proActive = await page.evaluate(() => document.documentElement.getAttribute("data-adoff-stealth"));
  console.log(`\ndata-adoff-stealth = ${proActive || "(assente → Free)"}`);
  if (pageErrors.length) {
    console.log("ERRORI JS PAGINA:");
    [...new Set(pageErrors)].slice(0, 8).forEach((e) => console.log("  ! " + e));
  } else console.log("Nessun errore JS di pagina.");

  await context.close();
})().catch((e) => { console.error("ERR", e); process.exit(1); });
