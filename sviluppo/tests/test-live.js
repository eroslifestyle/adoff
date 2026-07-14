const { chromium } = require("playwright");
const path = require("path");
const fs = require("fs");
const SDIR = "sviluppo/data-analisi/screenshots";
fs.mkdirSync(SDIR, { recursive: true });

(async () => {
  console.log("\n=== BRUTE-FORCE LIVE TEST ===\n");
  const EXT = path.resolve(__dirname, "../..");
  const ctx = await chromium.launchPersistentContext("", {
    headless: false,
    channel: "chrome",
    args: [
      "--disable-extensions-except=" + EXT,
      "--load-extension=" + EXT,
      "--no-first-run",
      "--mute-audio",
    ],
    viewport: { width: 1280, height: 800 },
    ignoreDefaultArgs: ["--disable-extensions"],
  });
  await new Promise((r) => setTimeout(r, 3000));

  const page = await ctx.newPage();
  await page.goto("https://www.youtube.com/watch?v=dQw4w9WgXcQ", {
    waitUntil: "domcontentloaded",
    timeout: 20000,
  });
  await page.waitForTimeout(3000);

  // Accept consent
  try {
    const btns = await page.$$("button");
    for (const b of btns) {
      const t = await b.textContent().catch(() => "");
      if (t.includes("Accetta tutto") || t.includes("Accept all")) {
        await b.click();
        break;
      }
    }
  } catch (_) {}
  await page.waitForTimeout(4000);

  // Play
  await page.evaluate(() => {
    const v = document.querySelector("video");
    if (v) v.play().catch(() => {});
  });
  await page.waitForTimeout(3000);

  // [1] Video plays
  console.log("[1] VIDEO PLAY");
  const vInfo = await page.evaluate(() => {
    const v = document.querySelector("video");
    return v
      ? { w: v.getBoundingClientRect().width, t: v.currentTime, playing: !v.paused }
      : null;
  });
  console.log(
    "  " +
      (vInfo?.playing && vInfo.t > 1 ? "PASS" : "FAIL") +
      ": " +
      JSON.stringify(vInfo)
  );

  // [2] Panel
  console.log("\n[2] DOWNLOAD PANEL");
  await page.waitForTimeout(3000);
  let panelExists = await page.evaluate(
    () => !!document.getElementById("ss-download-panel")
  );
  console.log("  Panel after 3s: " + panelExists);
  if (!panelExists) {
    await page.waitForTimeout(5000);
    panelExists = await page.evaluate(
      () => !!document.getElementById("ss-download-panel")
    );
    console.log("  Panel after 8s: " + panelExists);
  }
  await page.screenshot({ path: SDIR + "/LIVE-panel.png" });

  // [3] Stream extraction test
  console.log("\n[3] STREAM EXTRACTION");
  const streams = await page.evaluate(async () => {
    const videoId = new URLSearchParams(location.search).get("v");
    const results = { video: [], audio: [], subs: [], method: "none" };

    // HTML page extraction
    try {
      const resp = await fetch(location.href);
      const html = await resp.text();
      const match = html.match(
        /var ytInitialPlayerResponse\s*=\s*(\{.+?\})\s*;/s
      );
      if (match) {
        const data = JSON.parse(match[1]);
        const fmts = [
          ...(data.streamingData?.formats || []),
          ...(data.streamingData?.adaptiveFormats || []),
        ];
        for (const f of fmts) {
          if (f.mimeType?.startsWith("video/") && f.url)
            results.video.push({
              q: f.qualityLabel || f.quality,
              h: f.height,
              a: !!f.audioQuality,
            });
          if (f.mimeType?.startsWith("audio/") && f.url)
            results.audio.push({ br: f.averageBitrate });
        }
        const tracks =
          data.captions?.playerCaptionsTracklistRenderer?.captionTracks || [];
        results.subs = tracks.map((t) => t.languageCode);
        if (results.video.length > 0) results.method = "page-html";
      }
    } catch (e) {
      results.err1 = e.message;
    }

    // API fallback
    if (results.video.length === 0) {
      const clients = [
        {
          clientName: "TVHTML5_SIMPLY_EMBEDDED_PLAYER",
          clientVersion: "2.0",
        },
        {
          clientName: "ANDROID",
          clientVersion: "19.29.37",
          androidSdkVersion: 30,
        },
      ];
      for (const client of clients) {
        try {
          const resp = await fetch(
            "https://www.youtube.com/youtubei/v1/player?prettyPrint=false",
            {
              method: "POST",
              headers: { "Content-Type": "application/json" },
              body: JSON.stringify({
                videoId,
                context: {
                  client: { ...client, hl: "it" },
                  thirdParty: { embedUrl: "https://www.youtube.com" },
                },
              }),
            }
          );
          const data = await resp.json();
          const fmts = [
            ...(data.streamingData?.formats || []),
            ...(data.streamingData?.adaptiveFormats || []),
          ];
          for (const f of fmts) {
            if (f.url && f.mimeType?.startsWith("video/"))
              results.video.push({ q: f.qualityLabel, h: f.height, c: client.clientName });
            if (f.url && f.mimeType?.startsWith("audio/"))
              results.audio.push({ br: f.averageBitrate, c: client.clientName });
          }
          if (results.video.length > 0) {
            results.method = client.clientName;
            break;
          }
        } catch (e) {
          results.err2 = e.message;
        }
      }
    }

    return results;
  });

  console.log("  Method: " + streams.method);
  console.log("  Video: " + streams.video.length + " streams");
  if (streams.video.length > 0) {
    const qs = streams.video
      .map((v) => v.q + (v.a === false ? "(no-a)" : ""))
      .join(", ");
    console.log("  Qualities: " + qs);
  }
  console.log("  Audio: " + streams.audio.length + " streams");
  console.log(
    "  Subs: " + (streams.subs.length > 0 ? streams.subs.join(", ") : "none")
  );
  if (streams.err1) console.log("  Err1: " + streams.err1);
  if (streams.err2) console.log("  Err2: " + streams.err2);

  // [4] Test download fetch
  if (streams.video.length > 0) {
    console.log("\n[4] DOWNLOAD FETCH TEST");
    const dlTest = await page.evaluate(async (vid) => {
      // Re-fetch per ottenere un URL reale
      try {
        const resp = await fetch(location.href);
        const html = await resp.text();
        const match = html.match(
          /var ytInitialPlayerResponse\s*=\s*(\{.+?\})\s*;/s
        );
        if (!match) return { error: "no player response" };
        const data = JSON.parse(match[1]);
        const fmts = [
          ...(data.streamingData?.formats || []),
          ...(data.streamingData?.adaptiveFormats || []),
        ];
        const first = fmts.find((f) => f.url && f.mimeType?.startsWith("video/"));
        if (!first) return { error: "no url in formats" };

        // HEAD request
        const headResp = await fetch(first.url, { method: "HEAD" });
        return {
          status: headResp.status,
          type: headResp.headers.get("content-type"),
          size: headResp.headers.get("content-length"),
        };
      } catch (e) {
        return { error: e.message };
      }
    }, null);
    console.log("  " + JSON.stringify(dlTest));
    if (dlTest.status === 200) {
      console.log("  PASS: download URL accessible!");
      const sizeMB = dlTest.size
        ? (parseInt(dlTest.size) / 1048576).toFixed(1) + " MB"
        : "unknown";
      console.log("  Size: " + sizeMB);
    } else {
      console.log("  FAIL: " + (dlTest.error || "HTTP " + dlTest.status));
    }
  }

  await page.screenshot({ path: SDIR + "/LIVE-final.png" });

  // SUMMARY
  console.log("\n=== SUMMARY ===");
  console.log("Video plays: " + (vInfo?.playing ? "YES" : "NO"));
  console.log("Panel: " + (panelExists ? "YES" : "NO"));
  console.log("Streams: V=" + streams.video.length + " A=" + streams.audio.length);
  console.log("Max quality: " + (streams.video[0]?.q || "none"));
  console.log(
    "Download works: " +
      (streams.video.length > 0 ? "STREAMS AVAILABLE" : "NO STREAMS")
  );

  await ctx.close();
})().catch((e) => console.error("FATAL:", e));
