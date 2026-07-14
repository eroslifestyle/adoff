/**
 * test-final-v3.js — AdOff Extension Live Test
 * Testa: YouTube play, Corriere, Aranzulla, Siracusanews
 */
const { chromium } = require("playwright");
const path = require("path");
const fs = require("fs");

const EXTENSION_PATH = path.resolve(__dirname, "../../");
const SCREENSHOT_DIR = path.resolve(__dirname, "../data-analisi/screenshots");
if (!fs.existsSync(SCREENSHOT_DIR)) fs.mkdirSync(SCREENSHOT_DIR, { recursive: true });

const results = [];

function record(name, pass, detail) {
  const status = pass ? "PASS" : "FAIL";
  results.push({ name, status, detail });
  console.log(`  [${status}] ${name}${detail ? " — " + detail : ""}`);
}

async function acceptConsent(page) {
  try {
    const btns = await page.$$("button");
    for (const b of btns) {
      const t = await b.textContent().catch(() => "");
      if (
        t.includes("Accetta tutto") ||
        t.includes("Accept all") ||
        t.includes("Accetto") ||
        t.includes("Accetta") ||
        t.includes("Agree")
      ) {
        await b.click();
        await page.waitForTimeout(1500);
        return true;
      }
    }
    // Fallback: cerca selettori comuni
    for (const sel of [
      "#didomi-notice-agree-button",
      ".iubenda-cs-accept-btn",
      '[aria-label*="Accept"]',
      '[aria-label*="Accetta"]',
    ]) {
      const el = await page.$(sel);
      if (el) {
        await el.click();
        await page.waitForTimeout(1500);
        return true;
      }
    }
  } catch (_) {}
  return false;
}

(async () => {
  console.log("\n=== AdOff Extension — Final Test V3 ===\n");

  const context = await chromium.launchPersistentContext("", {
    headless: false,
    channel: "chrome",
    args: [
      `--disable-extensions-except=${EXTENSION_PATH}`,
      `--load-extension=${EXTENSION_PATH}`,
      "--no-first-run",
      "--disable-default-apps",
      "--mute-audio",
    ],
    viewport: { width: 1280, height: 800 },
    ignoreDefaultArgs: ["--disable-extensions"],
  });

  // Attendi avvio estensione
  await new Promise((r) => setTimeout(r, 3000));

  // ─── TEST 1: YouTube Play ───────────────────────────────────────────────────
  console.log("[TEST 1] YouTube — video play + dimensioni");
  {
    const page = await context.newPage();
    try {
      await page.goto("https://www.youtube.com/watch?v=dQw4w9WgXcQ", {
        waitUntil: "domcontentloaded",
        timeout: 25000,
      });
      await page.waitForTimeout(3000);

      // Accetta consent
      const consented = await acceptConsent(page);
      if (consented) await page.waitForTimeout(2000);

      // Forza play
      await page.evaluate(() => {
        const v = document.querySelector("video");
        if (v) v.play().catch(() => {});
      });
      await page.waitForTimeout(4000);

      const vInfo = await page.evaluate(() => {
        const v = document.querySelector("video");
        if (!v) return null;
        const rect = v.getBoundingClientRect();
        return {
          width: Math.round(rect.width),
          height: Math.round(rect.height),
          currentTime: v.currentTime,
          paused: v.paused,
        };
      });

      if (!vInfo) {
        record("YouTube video element", false, "nessun elemento video trovato");
      } else {
        record(
          "YouTube currentTime avanza",
          vInfo.currentTime > 0.5,
          `currentTime=${vInfo.currentTime.toFixed(2)}s`
        );
        record(
          "YouTube video width > 600",
          vInfo.width > 600,
          `width=${vInfo.width}px`
        );
        record(
          "YouTube video in play",
          !vInfo.paused,
          vInfo.paused ? "paused" : "playing"
        );
      }

      await page.screenshot({ path: path.join(SCREENSHOT_DIR, "v3-youtube.png") });
      console.log("  Screenshot: v3-youtube.png");
    } catch (e) {
      record("YouTube caricamento", false, e.message);
    }
    await page.close();
  }

  // ─── TEST 2: Corriere.it ────────────────────────────────────────────────────
  console.log("\n[TEST 2] Corriere.it — caricamento pagina");
  {
    const page = await context.newPage();
    try {
      const response = await page.goto("https://www.corriere.it", {
        waitUntil: "domcontentloaded",
        timeout: 20000,
      });
      await page.waitForTimeout(3000);
      await acceptConsent(page);
      await page.waitForTimeout(1500);

      const status = response ? response.status() : 0;
      const url = page.url();
      record(
        "Corriere.it carica",
        status >= 200 && status < 400,
        `HTTP ${status}`
      );
      record(
        "Corriere.it URL corretto",
        url.includes("corriere.it"),
        url
      );

      await page.screenshot({ path: path.join(SCREENSHOT_DIR, "v3-corriere.png") });
      console.log("  Screenshot: v3-corriere.png");
    } catch (e) {
      record("Corriere.it caricamento", false, e.message);
    }
    await page.close();
  }

  // ─── TEST 3: Aranzulla.it ───────────────────────────────────────────────────
  console.log("\n[TEST 3] Aranzulla.it — carica senza redirect");
  {
    const page = await context.newPage();
    try {
      const response = await page.goto(
        "https://www.aranzulla.it/come-creare-un-sito-web-gratis-11099.html",
        { waitUntil: "domcontentloaded", timeout: 20000 }
      );
      await page.waitForTimeout(3000);
      await acceptConsent(page);
      await page.waitForTimeout(1500);

      const status = response ? response.status() : 0;
      const url = page.url();
      const isAranzulla = url.includes("aranzulla.it");
      const isRedirected = !isAranzulla;

      record(
        "Aranzulla.it carica",
        status >= 200 && status < 400,
        `HTTP ${status}`
      );
      record(
        "Aranzulla.it no redirect esterno",
        isAranzulla,
        isRedirected ? `redirect a: ${url}` : "rimane su aranzulla.it"
      );

      // Verifica contenuto della pagina
      const hasContent = await page.evaluate(() => {
        const h1 = document.querySelector("h1");
        return h1 ? h1.textContent.trim().length > 0 : false;
      });
      record("Aranzulla.it ha contenuto (h1)", hasContent, "");

      await page.screenshot({ path: path.join(SCREENSHOT_DIR, "v3-aranzulla.png") });
      console.log("  Screenshot: v3-aranzulla.png");
    } catch (e) {
      record("Aranzulla.it caricamento", false, e.message);
    }
    await page.close();
  }

  // ─── TEST 4: Siracusanews.it — NO redirect Facebook ────────────────────────
  console.log("\n[TEST 4] Siracusanews.it — NO redirect a Facebook");
  {
    const page = await context.newPage();

    // Monitora tutti i navigation events
    const navigations = [];
    page.on("framenavigated", (frame) => {
      if (frame === page.mainFrame()) {
        navigations.push(frame.url());
      }
    });

    try {
      await page.goto("https://www.siracusanews.it", {
        waitUntil: "domcontentloaded",
        timeout: 25000,
      });
      await page.waitForTimeout(4000);

      const finalUrl = page.url();
      const redirectedToFacebook =
        navigations.some((u) => u.includes("facebook.com")) ||
        finalUrl.includes("facebook.com");
      const redirectedToFbLogin =
        navigations.some((u) => u.includes("fb.com") || u.includes("facebook")) ||
        finalUrl.includes("fb.com");

      record(
        "Siracusanews.it NON redirige a Facebook",
        !redirectedToFacebook && !redirectedToFbLogin,
        redirectedToFacebook
          ? `REDIRECT RILEVATO → ${finalUrl}`
          : `URL finale: ${finalUrl}`
      );

      record(
        "Siracusanews.it carica (no FB)",
        finalUrl.includes("siracusanews.it"),
        finalUrl
      );

      // Mostra tutte le navigazioni avvenute
      if (navigations.length > 1) {
        console.log(`  Navigazioni rilevate (${navigations.length}):`);
        navigations.forEach((u, i) => console.log(`    [${i}] ${u}`));
      }

      await page.screenshot({ path: path.join(SCREENSHOT_DIR, "v3-siracusa.png") });
      console.log("  Screenshot: v3-siracusa.png");
    } catch (e) {
      // Se l'errore è per navigazione bloccata, può essere un PASS (redirect bloccato dall'estensione)
      const finalUrl = page.url();
      const fbBlocked =
        e.message.includes("net::ERR") &&
        (navigations.some((u) => u.includes("facebook")) || finalUrl.includes("facebook"));
      if (fbBlocked) {
        record(
          "Siracusanews.it NON redirige a Facebook",
          true,
          "redirect bloccato dall'estensione"
        );
      } else {
        record("Siracusanews.it caricamento", false, e.message);
      }
      try {
        await page.screenshot({ path: path.join(SCREENSHOT_DIR, "v3-siracusa.png") });
      } catch (_) {}
    }
    await page.close();
  }

  // ─── CHIUDI CONTEXT ─────────────────────────────────────────────────────────
  await context.close();

  // ─── REPORT FINALE ──────────────────────────────────────────────────────────
  console.log("\n" + "=".repeat(50));
  console.log("  REPORT FINALE — AdOff Extension Test V3");
  console.log("=".repeat(50));

  let passed = 0;
  let failed = 0;
  const maxLen = Math.max(...results.map((r) => r.name.length));

  for (const r of results) {
    const padded = r.name.padEnd(maxLen);
    const detail = r.detail ? `  (${r.detail})` : "";
    console.log(`  ${r.status === "PASS" ? "PASS" : "FAIL"}  ${padded}${detail}`);
    if (r.status === "PASS") passed++;
    else failed++;
  }

  console.log("=".repeat(50));
  console.log(`  Totale: ${passed} PASS  /  ${failed} FAIL  /  ${results.length} test`);
  console.log(`  Screenshots in: sviluppo/data-analisi/screenshots/`);
  console.log("=".repeat(50) + "\n");

  process.exit(failed > 0 ? 1 : 0);
})().catch((e) => {
  console.error("\nFATAL:", e.message);
  process.exit(1);
});
