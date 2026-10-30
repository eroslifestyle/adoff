/**
 * Shadow Shield — Test Suite Automatizzata
 * Usa Playwright con Chrome reale + estensione caricata
 *
 * Eseguire: node sviluppo/tests/test-extension.js
 */

const { chromium } = require("playwright");
const path = require("path");

const EXTENSION_PATH = path.resolve(__dirname, "../../");
const CHROME_PATH = "C:\\Program Files\\Google\\Chrome\\Application\\chrome.exe";
const SCREENSHOT_DIR = path.resolve(__dirname, "../data-analisi/screenshots");

const TIMEOUT = 15000;
let passed = 0;
let failed = 0;
let warnings = 0;
const results = [];

// =============================================
// UTILITIES
// =============================================

function log(icon, msg) {
  const ts = new Date().toLocaleTimeString("it-IT");
  console.log(`  ${icon} [${ts}] ${msg}`);
}

async function takeScreenshot(page, name) {
  const fs = require("fs");
  if (!fs.existsSync(SCREENSHOT_DIR)) {
    fs.mkdirSync(SCREENSHOT_DIR, { recursive: true });
  }
  const filePath = path.join(SCREENSHOT_DIR, `${name}.png`);
  await page.screenshot({ path: filePath, fullPage: false });
  log("📸", `Screenshot: ${filePath}`);
}

function recordResult(testName, status, detail) {
  results.push({ test: testName, status, detail });
  if (status === "PASS") {
    passed++;
    log("✅", `PASS: ${testName}`);
  } else if (status === "FAIL") {
    failed++;
    log("❌", `FAIL: ${testName} — ${detail}`);
  } else {
    warnings++;
    log("⚠️", `WARN: ${testName} — ${detail}`);
  }
}

// =============================================
// TEST FUNCTIONS
// =============================================

async function testExtensionLoaded(context) {
  const testName = "Estensione caricata in Chrome";
  try {
    // In Chromium con extension, il service worker e' attivo
    let bgPage = context.serviceWorkers()[0];
    if (!bgPage) {
      // Attendi il service worker
      bgPage = await context.waitForEvent("serviceworker", { timeout: 5000 });
    }
    if (bgPage) {
      recordResult(testName, "PASS", "Service worker attivo");
    } else {
      recordResult(testName, "FAIL", "Service worker non trovato");
    }
  } catch (e) {
    recordResult(testName, "FAIL", e.message);
  }
}

async function testYouTubeVideoPlays(page) {
  const testName = "YouTube — Video si carica e riproduce";
  try {
    await page.goto("https://www.youtube.com/watch?v=dQw4w9WgXcQ", {
      waitUntil: "domcontentloaded",
      timeout: TIMEOUT,
    });
    await page.waitForTimeout(3000);

    // Verifica che il video player esista e sia visibile
    const player = await page.$("video.html5-main-video, video.video-stream");
    if (!player) {
      recordResult(testName, "FAIL", "Elemento <video> non trovato");
      return;
    }

    const box = await player.boundingBox();
    if (!box || box.width < 300 || box.height < 150) {
      recordResult(testName, "FAIL", `Video troppo piccolo: ${box ? `${box.width}x${box.height}` : "non visibile"}`);
      await takeScreenshot(page, "yt-video-size-fail");
      return;
    }

    // Verifica che il video stia effettivamente riproducendo
    const videoState = await page.evaluate(() => {
      const v = document.querySelector("video.html5-main-video, video.video-stream");
      if (!v) return null;
      return {
        width: v.videoWidth,
        height: v.videoHeight,
        paused: v.paused,
        currentTime: v.currentTime,
        duration: v.duration,
        readyState: v.readyState,
      };
    });

    if (videoState && videoState.readyState >= 2) {
      recordResult(testName, "PASS", `Video ${box.width.toFixed(0)}x${box.height.toFixed(0)}, readyState=${videoState.readyState}`);
    } else {
      recordResult(testName, "WARN", `Video presente ma readyState=${videoState?.readyState || "N/A"}`);
    }

    await takeScreenshot(page, "yt-video-playing");
  } catch (e) {
    recordResult(testName, "FAIL", e.message);
  }
}

async function testYouTubeAdsBlocked(page) {
  const testName = "YouTube — Elementi ad nascosti";
  try {
    const adElements = await page.evaluate(() => {
      const selectors = [
        "ytd-ad-slot-renderer",
        "ytd-promoted-sparkles-web-renderer",
        "ytd-display-ad-renderer",
        "#masthead-ad",
        "#companion-ad",
        ".ytp-ad-module",
        ".ytp-ad-overlay-container",
      ];
      const found = [];
      for (const sel of selectors) {
        const els = document.querySelectorAll(sel);
        for (const el of els) {
          const style = getComputedStyle(el);
          found.push({
            selector: sel,
            visible: style.display !== "none" && style.visibility !== "hidden",
          });
        }
      }
      return found;
    });

    const visibleAds = adElements.filter((a) => a.visible);
    if (visibleAds.length === 0) {
      recordResult(testName, "PASS", `${adElements.length} elementi ad trovati, tutti nascosti`);
    } else {
      recordResult(testName, "FAIL", `${visibleAds.length} elementi ad ancora visibili: ${visibleAds.map((a) => a.selector).join(", ")}`);
    }
  } catch (e) {
    recordResult(testName, "FAIL", e.message);
  }
}

async function testYouTubeNavigation(page) {
  const testName = "YouTube — Navigazione tra video funziona";
  try {
    // Clicca su un video suggerito nella sidebar
    const suggested = await page.$("ytd-compact-video-renderer a#thumbnail, ytd-rich-item-renderer a#thumbnail");
    if (!suggested) {
      recordResult(testName, "WARN", "Nessun video suggerito trovato per test navigazione");
      return;
    }

    await suggested.click();
    await page.waitForTimeout(4000);

    // Verifica che il nuovo video si sia caricato
    const player = await page.$("video.html5-main-video, video.video-stream");
    if (!player) {
      recordResult(testName, "FAIL", "Video non trovato dopo navigazione");
      await takeScreenshot(page, "yt-nav-fail");
      return;
    }

    const box = await player.boundingBox();
    if (box && box.width > 300 && box.height > 150) {
      recordResult(testName, "PASS", `Video caricato dopo navigazione: ${box.width.toFixed(0)}x${box.height.toFixed(0)}`);
    } else {
      recordResult(testName, "FAIL", `Video troppo piccolo dopo navigazione: ${box ? `${box.width}x${box.height}` : "N/A"}`);
      await takeScreenshot(page, "yt-nav-size-fail");
    }

    await takeScreenshot(page, "yt-after-navigation");
  } catch (e) {
    recordResult(testName, "FAIL", e.message);
  }
}

async function testGenericSite(page, url, siteName) {
  const testName = `${siteName} — Pagina carica senza errori`;
  try {
    const response = await page.goto(url, {
      waitUntil: "domcontentloaded",
      timeout: TIMEOUT,
    });

    if (!response || response.status() >= 400) {
      recordResult(testName, "FAIL", `HTTP ${response?.status() || "no response"}`);
      return;
    }

    await page.waitForTimeout(2000);

    // Verifica che la pagina abbia contenuto
    const bodyText = await page.evaluate(() => document.body?.innerText?.length || 0);
    if (bodyText < 100) {
      recordResult(testName, "FAIL", `Pagina quasi vuota (${bodyText} chars)`);
      await takeScreenshot(page, `${siteName.toLowerCase()}-empty`);
      return;
    }

    recordResult(testName, "PASS", `Pagina caricata (${bodyText} chars di testo)`);
    await takeScreenshot(page, `${siteName.toLowerCase()}-loaded`);
  } catch (e) {
    recordResult(testName, "FAIL", e.message);
  }
}

async function testAdElementsHidden(page, siteName) {
  const testName = `${siteName} — Ad elements nascosti`;
  try {
    const adCheck = await page.evaluate(() => {
      const adSelectors = [
        "ins.adsbygoogle",
        'div[id^="google_ads_"]',
        'div[id^="div-gpt-ad"]',
        'iframe[src*="doubleclick.net"]',
        'iframe[src*="googlesyndication.com"]',
        ".OUTBRAIN",
        '[id^="taboola-"]',
        ".ad-slot",
        ".ad-container",
        ".ad-banner",
      ];
      let total = 0;
      let hidden = 0;
      for (const sel of adSelectors) {
        const els = document.querySelectorAll(sel);
        for (const el of els) {
          total++;
          const style = getComputedStyle(el);
          if (style.display === "none" || style.visibility === "hidden" || el.hasAttribute("data-ss-hidden")) {
            hidden++;
          }
        }
      }
      return { total, hidden };
    });

    if (adCheck.total === 0) {
      recordResult(testName, "PASS", "Nessun elemento ad trovato (network blocking attivo)");
    } else if (adCheck.hidden === adCheck.total) {
      recordResult(testName, "PASS", `${adCheck.total} elementi ad trovati, tutti nascosti`);
    } else {
      recordResult(testName, "WARN", `${adCheck.total - adCheck.hidden}/${adCheck.total} elementi ad ancora visibili`);
    }
  } catch (e) {
    recordResult(testName, "FAIL", e.message);
  }
}

async function testAntiAdblockNotDetected(page, siteName) {
  const testName = `${siteName} — Anti-adblock non rilevato`;
  try {
    const detected = await page.evaluate(() => {
      const body = document.body?.innerHTML?.toLowerCase() || "";
      const detectionPhrases = [
        "disattiva il tuo ad blocker",
        "disable your ad blocker",
        "ad blocker detected",
        "adblock detected",
        "please disable",
        "disabilita adblock",
        "blocco pubblicità rilevato",
        "whitelist this site",
        "turn off your ad blocker",
      ];
      const found = detectionPhrases.filter((phrase) => body.includes(phrase));

      // Controlla anche overlay/modal visibili
      const walls = document.querySelectorAll(
        ".adblock-wall, .adblock-overlay, .adblock-modal, #adblock-wall, #adblock-overlay"
      );
      let visibleWalls = 0;
      for (const w of walls) {
        if (getComputedStyle(w).display !== "none") visibleWalls++;
      }

      return { phrases: found, visibleWalls };
    });

    if (detected.phrases.length === 0 && detected.visibleWalls === 0) {
      recordResult(testName, "PASS", "Nessun rilevamento anti-adblock");
    } else {
      const detail = [];
      if (detected.phrases.length > 0) detail.push(`frasi trovate: ${detected.phrases.join(", ")}`);
      if (detected.visibleWalls > 0) detail.push(`${detected.visibleWalls} wall visibili`);
      recordResult(testName, "FAIL", detail.join(" | "));
      await takeScreenshot(page, `${siteName.toLowerCase()}-antiblock`);
    }
  } catch (e) {
    recordResult(testName, "FAIL", e.message);
  }
}

async function testPopupUI(context) {
  const testName = "Popup UI — Si apre e mostra controlli";
  try {
    // Trova l'extension ID dal service worker URL
    const sw = context.serviceWorkers()[0];
    if (!sw) {
      recordResult(testName, "WARN", "Service worker non disponibile per test popup");
      return;
    }

    const swUrl = sw.url();
    const extId = swUrl.split("/")[2];

    const popupPage = await context.newPage();
    await popupPage.goto(`chrome-extension://${extId}/src/popup.html`, { timeout: 5000 });
    await popupPage.waitForTimeout(1000);

    // Verifica elementi UI
    const toggle = await popupPage.$("#toggle");
    const status = await popupPage.$("#status");
    const adsBlocked = await popupPage.$("#adsBlocked");

    if (toggle && status && adsBlocked) {
      const statusText = await status.innerText();
      const isChecked = await toggle.isChecked();
      recordResult(testName, "PASS", `Toggle: ${isChecked ? "ON" : "OFF"}, Status: "${statusText}"`);
    } else {
      recordResult(testName, "FAIL", "Elementi UI mancanti nel popup");
    }

    await takeScreenshot(popupPage, "popup-ui");
    await popupPage.close();
  } catch (e) {
    recordResult(testName, "FAIL", e.message);
  }
}

async function testToggleDisable(context) {
  const testName = "Toggle OFF — Disattiva protezione";
  try {
    const sw = context.serviceWorkers()[0];
    if (!sw) {
      recordResult(testName, "WARN", "Service worker non disponibile");
      return;
    }

    const swUrl = sw.url();
    const extId = swUrl.split("/")[2];

    const popupPage = await context.newPage();
    await popupPage.goto(`chrome-extension://${extId}/src/popup.html`, { timeout: 5000 });
    await popupPage.waitForTimeout(500);

    // Toggle OFF
    await popupPage.click("#toggle");
    await popupPage.waitForTimeout(500);

    const statusText = await popupPage.$("#status").then((el) => el?.innerText());
    const isOff = statusText?.toLowerCase().includes("disattivo");

    if (isOff) {
      recordResult(testName, "PASS", "Toggle OFF funziona");
    } else {
      recordResult(testName, "FAIL", `Status dopo toggle: "${statusText}"`);
    }

    // Toggle ON di nuovo
    await popupPage.click("#toggle");
    await popupPage.waitForTimeout(500);
    await popupPage.close();
  } catch (e) {
    recordResult(testName, "FAIL", e.message);
  }
}

// =============================================
// MAIN
// =============================================

(async () => {
  console.log("\n========================================");
  console.log("  SHADOW SHIELD — Test Suite v2.0.0");
  console.log("========================================\n");

  let context;
  try {
    // Lancia Chrome con l'estensione
    log("🚀", "Avvio Chrome con Shadow Shield...");
    context = await chromium.launchPersistentContext("", {
      headless: false,
      channel: "chrome",
      args: [
        `--disable-extensions-except=${EXTENSION_PATH}`,
        `--load-extension=${EXTENSION_PATH}`,
        "--no-first-run",
        "--disable-default-apps",
        "--disable-popup-blocking",
        "--disable-translate",
        "--mute-audio",
      ],
      viewport: { width: 1280, height: 800 },
      ignoreDefaultArgs: ["--disable-extensions"],
    });

    log("✅", "Chrome avviato con estensione caricata\n");

    // Attendi service worker
    await new Promise((r) => setTimeout(r, 2000));

    // ---- TEST 1: Estensione caricata ----
    console.log("── Test 1: Estensione ──");
    await testExtensionLoaded(context);

    // ---- TEST 2: Popup UI ----
    console.log("\n── Test 2: Popup UI ──");
    await testPopupUI(context);
    await testToggleDisable(context);

    // ---- TEST 3: YouTube ----
    console.log("\n── Test 3: YouTube ──");
    const ytPage = await context.newPage();
    await testYouTubeVideoPlays(ytPage);
    await testYouTubeAdsBlocked(ytPage);
    await testYouTubeNavigation(ytPage);
    await ytPage.close();

    // ---- TEST 4: Siti generici ----
    const testSites = [
      { url: "https://www.corriere.it", name: "Corriere" },
      { url: "https://www.repubblica.it", name: "Repubblica" },
      { url: "https://www.gazzetta.it", name: "Gazzetta" },
      { url: "https://edition.cnn.com", name: "CNN" },
    ];

    for (let i = 0; i < testSites.length; i++) {
      const site = testSites[i];
      console.log(`\n── Test ${4 + i}: ${site.name} ──`);
      const page = await context.newPage();
      await testGenericSite(page, site.url, site.name);
      await testAdElementsHidden(page, site.name);
      await testAntiAdblockNotDetected(page, site.name);
      await page.close();
    }

  } catch (e) {
    console.error("\n❌ ERRORE CRITICO:", e.message);
  } finally {
    // ---- REPORT ----
    console.log("\n========================================");
    console.log("  RISULTATI");
    console.log("========================================");
    console.log(`  ✅ PASS:     ${passed}`);
    console.log(`  ❌ FAIL:     ${failed}`);
    console.log(`  ⚠️  WARN:     ${warnings}`);
    console.log(`  📊 TOTALE:   ${results.length}`);
    console.log("----------------------------------------");

    for (const r of results) {
      const icon = r.status === "PASS" ? "✅" : r.status === "FAIL" ? "❌" : "⚠️";
      console.log(`  ${icon} ${r.test}`);
      if (r.detail) console.log(`     └─ ${r.detail}`);
    }

    console.log("\n========================================");
    if (failed === 0) {
      console.log("  🎉 TUTTI I TEST PASSATI!");
    } else {
      console.log(`  ⚠️  ${failed} TEST FALLITI — correzioni necessarie`);
    }
    console.log(`  📸 Screenshots in: sviluppo/data-analisi/screenshots/`);
    console.log("========================================\n");

    if (context) {
      await context.close();
    }
  }
})();
