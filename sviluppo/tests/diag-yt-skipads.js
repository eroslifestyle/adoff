/**
 * Diagnostica sistema SKIP ADS su una watch page reale.
 * Verifica che gli hook di stealth.js combacino ancora con l'API YouTube:
 *  - request body /player e /next: contiene "contentPlaybackContext"? e "isInlinePlaybackNoAd"?
 *  - response /player: contiene ancora "adPlacements"/"playerAds" (strip fallito) o "xdPlacements" (mangle ok)?
 *  - timeline classi del #movie_player (ad-showing / ad-interrupting)
 *  - evoluzione video.currentTime + playbackRate (blocco / perdita continuità)
 *  - errori JS
 */
const { chromium } = require("playwright");
const path = require("path");

const EXTENSION_PATH = path.resolve(__dirname, "../../app");
const VIDEO = process.env.VIDEO_URL || "https://www.youtube.com/watch?v=vP9NStX3xf4";
const WATCH_SECONDS = parseInt(process.env.WATCH_SECONDS || "60", 10);
const WITH_EXT = process.env.NOEXT !== "1";

(async () => {
  console.log(`### ${WITH_EXT ? "CON estensione (Pro forzato)" : "BASELINE senza estensione"} ###`);
  const extArgs = WITH_EXT
    ? [`--disable-extensions-except=${EXTENSION_PATH}`, `--load-extension=${EXTENSION_PATH}`]
    : [];
  // IMPORTANTE: niente channel:"chrome" — il Chrome di sistema NON inietta i
  // content script world:MAIN sotto --load-extension. Si usa il chromium bundled.
  const context = await chromium.launchPersistentContext("", {
    headless: false,
    args: [
      ...extArgs,
      "--no-first-run", "--disable-default-apps", "--mute-audio",
    ],
    viewport: { width: 1366, height: 900 },
    ignoreDefaultArgs: ["--disable-extensions"],
  });
  await new Promise((r) => setTimeout(r, 2500));

  const page = await context.newPage();

  // Forza Pro (isProEnabled controlla solo formato ao_[8hex]).
  // Lo setto il PRIMA possibile per non perdere la gara con ytInitialPlayerResponse.
  if (WITH_EXT) {
    await page.addInitScript(() => {
      try { document.documentElement && document.documentElement.setAttribute("data-adoff-stealth", "ao_abcdef12"); } catch (_) {}
      const set = () => { try { if (document.documentElement) document.documentElement.setAttribute("data-adoff-stealth", "ao_abcdef12"); } catch (_) {} requestAnimationFrame(set); };
      set();
    });
  }

  const pageErrors = [];
  page.on("pageerror", (e) => pageErrors.push(String(e).slice(0, 160)));

  // Cattura request bodies verso le API player/next
  const apiReqs = [];
  page.on("request", (req) => {
    const u = req.url();
    if (/\/youtubei\/v1\/(player|next|browse)/.test(u)) {
      const body = req.postData() || "";
      apiReqs.push({
        ep: u.match(/v1\/(\w+)/)[1],
        hasCPC: body.includes('"contentPlaybackContext"'),
        hasNoAd: body.includes('"isInlinePlaybackNoAd"'),
        len: body.length,
      });
    }
  });

  // Cattura response /player (cerca campi ad)
  const playerResp = [];
  page.on("response", async (resp) => {
    const u = resp.url();
    if (/\/youtubei\/v1\/player/.test(u)) {
      try {
        const t = await resp.text();
        playerResp.push({
          adPlacements: t.includes('"adPlacements"'),
          playerAds: t.includes('"playerAds"'),
          xdPlacements: t.includes('"xdPlacements"'),  // = mangle riuscito
          adSlots: t.includes('"adSlots"'),
          len: t.length,
        });
      } catch (_) {}
    }
  });

  // consenso (click coordinate)
  console.log("Navigo:", VIDEO);
  await page.goto("https://www.youtube.com", { waitUntil: "domcontentloaded", timeout: 25000 }).catch(() => {});
  await page.waitForTimeout(2500);
  await page.mouse.click(813, 808);
  await page.waitForTimeout(3000);

  await page.goto(VIDEO, { waitUntil: "domcontentloaded", timeout: 25000 }).catch(() => {});
  await page.waitForTimeout(1500);

  // Sonda: i nostri hook sono attivi nel MAIN world?
  const hooks = await page.evaluate(() => {
    const fsrc = (window.fetch && window.fetch.toString()) || "";
    const asrc = (HTMLMediaElement.prototype.addEventListener && HTMLMediaElement.prototype.addEventListener.toString()) || "";
    return {
      proAttr: document.documentElement.getAttribute("data-adoff-stealth"),
      fetchPatched: /isPlayerReq|isProEnabled|mangleAdFields|_origFetch/.test(fsrc),
      ratechangePatched: /_adoffSkipping/.test(asrc),
    };
  }).catch(() => ({}));
  console.log("HOOKS:", JSON.stringify(hooks));

  // Timeline player
  const timeline = [];
  let lastKey = "";
  let maxRate = 0, adClearedAt = null, adFirstAt = null;
  for (let i = 0; i < WATCH_SECONDS * 2; i++) {
    const s = await page.evaluate(() => {
      const p = document.getElementById("movie_player");
      if (!p) return { noPlayer: true };
      const v = p.querySelector("video");
      const cls = p.className.split(/\s+/).filter((c) => /ad-showing|ad-interrupting/.test(c));
      return {
        ad: cls.join(",") || "-",
        ct: v ? +v.currentTime.toFixed(1) : null,
        rate: v ? v.playbackRate : null,
        paused: v ? v.paused : null,
        rs: v ? v.readyState : null,
        dur: v && isFinite(v.duration) ? +v.duration.toFixed(0) : null,
        skipBtn: !!p.querySelector(".ytp-skip-ad-button, .ytp-ad-skip-button, .ytp-ad-skip-button-modern, .ytp-ad-skip-button-slot button, [id^='skip-button'], .videoAdUiSkipButton"),
        adText: !!p.querySelector(".ytp-ad-text, .ytp-ad-simple-ad-badge, .ytp-ad-player-overlay"),
      };
    }).catch(() => ({ err: true }));
    if (s.rate > maxRate) maxRate = s.rate;
    const isAd = /ad-showing|ad-interrupting/.test(s.ad || "");
    if (isAd && adFirstAt === null) adFirstAt = i / 2;
    if (!isAd && adFirstAt !== null && adClearedAt === null) adClearedAt = i / 2;
    const key = `${s.ad}|${s.rate}|${s.paused}|${s.skipBtn}|${s.adText}`;
    if (key !== lastKey) {
      timeline.push({ t: (i / 2).toFixed(1), ...s });
      lastKey = key;
    }
    await page.waitForTimeout(500);
  }
  console.log(`\nSINTESI: adFirst=${adFirstAt}s adCleared=${adClearedAt === null ? "MAI (bloccato)" : adClearedAt + "s"} maxPlaybackRate=${maxRate}`);

  console.log("\n=== REQUEST BODIES (player/next/browse) ===");
  const agg = {};
  for (const r of apiReqs) {
    const k = r.ep;
    agg[k] = agg[k] || { n: 0, cpc: 0, noad: 0 };
    agg[k].n++; if (r.hasCPC) agg[k].cpc++; if (r.hasNoAd) agg[k].noad++;
  }
  for (const [ep, a] of Object.entries(agg)) {
    console.log(`  /${ep}: ${a.n} req | contentPlaybackContext: ${a.cpc}/${a.n} | isInlinePlaybackNoAd INIETTATO: ${a.noad}/${a.n}`);
  }

  console.log("\n=== RESPONSE /player (campi ad) ===");
  if (!playerResp.length) console.log("  (nessuna response /player catturata)");
  playerResp.forEach((r, i) => console.log(`  #${i}: adPlacements=${r.adPlacements} playerAds=${r.playerAds} adSlots=${r.adSlots} | xdPlacements(mangle ok)=${r.xdPlacements} | ${r.len}b`));

  console.log("\n=== TIMELINE PLAYER (cambi di stato) ===");
  timeline.forEach((s) => console.log(`  t=${s.t}s ad=${s.ad} ct=${s.ct} rate=${s.rate} dur=${s.dur} skipBtn=${s.skipBtn} adText=${s.adText}`));

  console.log("\n=== ERRORI JS ===");
  if (!pageErrors.length) console.log("  nessuno");
  else [...new Set(pageErrors)].slice(0, 10).forEach((e) => console.log("  ! " + e));

  await page.screenshot({ path: path.resolve(__dirname, "../data-analisi/screenshots/yt-skipads-diag.png") });
  await context.close();
})().catch((e) => { console.error("ERR", e); process.exit(1); });
