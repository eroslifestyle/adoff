// Test live: AdOff sulla piattaforma video. Rileva popup anti-adblock e stallo del player.
// Uso: [INJECT=1] node sviluppo/tests/live/yt-enforcement.mjs [extDir|none] [url]
// INJECT=1 simula un account flaggato: aggiunge il popup alle risposte /player.
import { chromium } from "playwright";
import path from "node:path";
import os from "node:os";
import fs from "node:fs";

const EXT_ARG = process.argv[2] || "app";
const EXT_DIR = EXT_ARG === "none" ? "none" : path.resolve(EXT_ARG);
const TARGET_URL = process.argv[3] || "https://www.youtube.com/watch?v=SU2QcMOIT6c";
const SAMPLES = 15;
const SAMPLE_MS = 2000;
const CHROME = process.env.CHROME_BIN || os.homedir() + "/.cache/ms-playwright/chromium-1248/chrome-linux64/chrome";
const FAKE_POPUP = '{"auxiliaryUi":{"messageRenderers":{' +
  '"bkaEnforcementMessageViewModel":{"displayType":"ENFORCEMENT_MESSAGE_VIEW_MODEL_DISPLAY_TYPE_PLAYER"},' +
  '"enforcementMessageViewModel":{"displayType":"ENFORCEMENT_MESSAGE_VIEW_MODEL_DISPLAY_TYPE_POPUP"}}},';

const profile = fs.mkdtempSync(path.join(os.tmpdir(), "adoff-yt-"));
const extArgs = EXT_DIR === "none" ? [] : [`--disable-extensions-except=${EXT_DIR}`, `--load-extension=${EXT_DIR}`];
const ctx = await chromium.launchPersistentContext(profile, {
  executablePath: CHROME, headless: false, locale: "it-IT",
  args: ["--autoplay-policy=no-user-gesture-required", ...extArgs],
});
const page = ctx.pages()[0] || await ctx.newPage();

if (process.env.INJECT) {
  await page.route((u) => u.pathname === "/youtubei/v1/player", async (route) => {
    const r = await route.fetch();
    const body = (await r.text()).replace(/^\s*\{/, FAKE_POPUP);
    const headers = { ...r.headers() };
    delete headers["content-length"]; delete headers["content-encoding"];
    await route.fulfill({ status: r.status(), headers, body });
  });
}

await page.goto("https://www.youtube.com/");
await page.locator('button:has-text("Accetta tutto"), button:has-text("Accept all")').first().click({ timeout: 8000 }).catch(() => {});
await page.goto(TARGET_URL, { waitUntil: "commit" }).catch(() => {});

const timeline = [];
for (let i = 0; i < SAMPLES; i++) {
  await page.waitForTimeout(SAMPLE_MS);
  timeline.push(await page.evaluate(() => {
    const v = document.querySelector("video");
    const p = document.getElementById("movie_player");
    return {
      t: v ? +v.currentTime.toFixed(1) : null,
      dur: v && isFinite(v.duration) ? +v.duration.toFixed(0) : null,
      paused: v ? v.paused : null,
      ad: !!document.querySelector(".ad-showing"),
      popup: !!document.querySelector("ytd-enforcement-message-view-model"),
      state: p?.getPlayerState?.(),
    };
  }));
}
const final = await page.evaluate(() => ({
  playerMsgKeys: Object.keys(document.getElementById("movie_player")?.getPlayerResponse?.()?.auxiliaryUi?.messageRenderers || {}),
  errorScreen: !!document.getElementById("movie_player")?.getPlayerResponse?.()?.playabilityStatus?.errorScreen,
  nonce: document.documentElement.getAttribute("data-adoff-stealth"),
  diag: window.__adoffYtDiag || null,
}));
await page.screenshot({ path: path.join(path.dirname(new URL(import.meta.url).pathname), `yt-last-${path.basename(EXT_DIR)}.png`) });
console.log(JSON.stringify({ ext: EXT_DIR, inject: !!process.env.INJECT, final }));
for (const s of timeline) console.log(JSON.stringify(s));
await ctx.close();
