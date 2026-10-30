/**
 * Test YouTube Downloader — verifica che il pannello appaia
 * e che le API di estrazione funzionino
 */
const { chromium } = require("playwright");
const path = require("path");
const fs = require("fs");

const EXTENSION_PATH = path.resolve(__dirname, "../../");
const SCREENSHOT_DIR = path.resolve(__dirname, "../data-analisi/screenshots");
if (!fs.existsSync(SCREENSHOT_DIR)) fs.mkdirSync(SCREENSHOT_DIR, { recursive: true });

(async () => {
  console.log("\n=== YouTube Downloader Test ===\n");

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
    viewport: { width: 1280, height: 900 },
    ignoreDefaultArgs: ["--disable-extensions"],
  });

  await new Promise((r) => setTimeout(r, 2000));

  const page = await context.newPage();

  // Accetta cookie YouTube se necessario
  console.log("[1] Apertura video YouTube...");
  await page.goto("https://www.youtube.com/watch?v=dQw4w9WgXcQ", {
    waitUntil: "domcontentloaded",
    timeout: 20000,
  });

  // Accetta consent se presente
  await page.waitForTimeout(2000);
  try {
    const consent = await page.$('button[aria-label*="Accept"], button:has-text("Accetta"), button:has-text("Accept all")');
    if (consent) await consent.click();
  } catch (_) {}

  await page.waitForTimeout(5000);

  // TEST 1: Pannello download presente
  console.log("\n[2] Verifico pannello download...");
  const panel = await page.$("#ss-download-panel");
  if (panel) {
    console.log("  ✅ Pannello download trovato");

    const box = await panel.boundingBox();
    if (box) {
      console.log(`  Posizione: ${box.x.toFixed(0)},${box.y.toFixed(0)} — ${box.width.toFixed(0)}x${box.height.toFixed(0)}`);
    }

    // Verifica bottoni
    const btnVideo = await page.$("#ss-dl-video");
    const btnAudio = await page.$("#ss-dl-audio");
    const btnSrt = await page.$("#ss-dl-srt");

    console.log(`  Bottone Video: ${btnVideo ? "✅" : "❌"}`);
    console.log(`  Bottone Audio: ${btnAudio ? "✅" : "❌"}`);
    console.log(`  Bottone SRT:   ${btnSrt ? "✅" : "❌"}`);

    // Badge PREMIUM
    const badge = await page.$(".ss-dl-badge");
    if (badge) {
      const badgeText = await badge.innerText();
      console.log(`  Badge: "${badgeText}" ✅`);
    }
  } else {
    console.log("  ❌ Pannello download NON trovato");
    console.log("  (Potrebbe essere il cookie consent di YouTube che blocca)");
  }

  await page.screenshot({ path: path.join(SCREENSHOT_DIR, "yt-downloader-panel.png") });
  console.log("  📸 Screenshot: yt-downloader-panel.png");

  // TEST 2: Estrazione stream (senza effettuare download)
  console.log("\n[3] Test estrazione stream...");
  const streamTest = await page.evaluate(async () => {
    const results = { video: false, audio: false, srt: false, details: {} };

    try {
      // Cerca ytInitialPlayerResponse
      let playerData = null;
      const scripts = document.querySelectorAll("script");
      for (const script of scripts) {
        const text = script.textContent;
        if (text.includes("ytInitialPlayerResponse")) {
          const match = text.match(/ytInitialPlayerResponse\s*=\s*(\{.+?\});/s);
          if (match) {
            playerData = JSON.parse(match[1]);
            break;
          }
        }
      }

      if (!playerData) {
        // Fallback: innertube API
        const resp = await fetch("https://www.youtube.com/youtubei/v1/player", {
          method: "POST",
          headers: { "Content-Type": "application/json" },
          body: JSON.stringify({
            videoId: "dQw4w9WgXcQ",
            context: {
              client: { clientName: "WEB", clientVersion: "2.20240101.00.00" },
            },
          }),
        });
        playerData = await resp.json();
      }

      if (playerData) {
        // Video streams
        const formats = [
          ...(playerData.streamingData?.formats || []),
          ...(playerData.streamingData?.adaptiveFormats || []),
        ];

        const videoStreams = formats.filter((f) => f.mimeType?.startsWith("video/") && f.url);
        const audioStreams = formats.filter((f) => f.mimeType?.startsWith("audio/") && f.url);

        results.video = videoStreams.length > 0;
        results.audio = audioStreams.length > 0;
        results.details.videoCount = videoStreams.length;
        results.details.audioCount = audioStreams.length;
        results.details.videoQualities = videoStreams.map((f) => f.qualityLabel || f.quality).join(", ");

        // Subtitles
        const tracks = playerData.captions?.playerCaptionsTracklistRenderer?.captionTracks || [];
        results.srt = tracks.length > 0;
        results.details.srtLangs = tracks.map((t) => t.languageCode).join(", ");
        results.details.title = playerData.videoDetails?.title || "N/A";
      }
    } catch (e) {
      results.details.error = e.message;
    }

    return results;
  });

  console.log(`  Titolo video: ${streamTest.details.title || "N/A"}`);
  console.log(`  Video streams: ${streamTest.video ? "✅" : "❌"} (${streamTest.details.videoCount || 0} formati)`);
  if (streamTest.details.videoQualities) {
    console.log(`    Qualita': ${streamTest.details.videoQualities}`);
  }
  console.log(`  Audio streams: ${streamTest.audio ? "✅" : "❌"} (${streamTest.details.audioCount || 0} formati)`);
  console.log(`  Sottotitoli:   ${streamTest.srt ? "✅" : "❌"} (lingue: ${streamTest.details.srtLangs || "nessuna"})`);

  if (streamTest.details.error) {
    console.log(`  ❌ Errore: ${streamTest.details.error}`);
  }

  // TEST 3: Navigazione SPA — pannello si rinietta
  console.log("\n[4] Test navigazione SPA...");
  const navLink = await page.$("ytd-compact-video-renderer a");
  if (navLink) {
    await navLink.click();
    await page.waitForTimeout(5000);

    const panelAfterNav = await page.$("#ss-download-panel");
    console.log(`  Pannello dopo navigazione: ${panelAfterNav ? "✅" : "❌"}`);

    await page.screenshot({ path: path.join(SCREENSHOT_DIR, "yt-downloader-after-nav.png") });
    console.log("  📸 Screenshot: yt-downloader-after-nav.png");
  } else {
    console.log("  ⚠️ Nessun link per test navigazione");
  }

  console.log("\n=== Test completati ===\n");
  await context.close();
})();
