// Live diagnostic: load AdOff extension, open target YouTube video, measure
// whether the <video> actually renders video (videoWidth>0) or audio-only,
// and inspect the /youtubei/v1/player response for ad/enforcement fields.
//
// Usage: xvfb-run -a node yt-live-test.mjs [videoId] [extDir]
import { chromium } from 'playwright';
import { mkdtempSync } from 'fs';
import { tmpdir } from 'os';
import { join } from 'path';

const VIDEO_ID = process.argv[2] || 'U1mKZIxis6A';
const EXT = process.argv[3] || join(process.cwd(), '..', '..', 'app');
const URL = `https://www.youtube.com/watch?v=${VIDEO_ID}`;
const profile = mkdtempSync(join(tmpdir(), 'adoff-yt-'));

const ctx = await chromium.launchPersistentContext(profile, {
  headless: false,
  args: [
    `--disable-extensions-except=${EXT}`,
    `--load-extension=${EXT}`,
    '--no-first-run',
    '--no-default-browser-check',
  ],
});

const page = ctx.pages()[0] || await ctx.newPage();

const playerResponses = [];
const consoleErrors = [];
page.on('console', (m) => {
  if (m.type() === 'error') consoleErrors.push(m.text().slice(0, 200));
});

// Capture the player API response body
page.on('response', async (resp) => {
  const u = resp.url();
  if (u.includes('/youtubei/v1/player') && !u.includes('ad_break')) {
    try {
      const txt = await resp.text();
      playerResponses.push({
        url: u.slice(0, 80),
        len: txt.length,
        hasAdPlacements: /"adPlacements"/.test(txt),
        hasXdPlacements: /"xdPlacements"/.test(txt),   // mangled = our fix hit it
        hasBkaEnforce: /"bkaEnforcementMessageViewModel"/.test(txt),
        hasXkaEnforce: /"xkaEnforcementMessageViewModel"/.test(txt), // mangled
        hasEnforce: /"enforcementMessageViewModel"/.test(txt),
        hasServerAbr: /"serverAbrStreamingUrl"/.test(txt),
        hasAdaptiveFormats: /"adaptiveFormats"/.test(txt),
        hasFormats: /"formats"\s*:/.test(txt),
        playabilityStatus: (txt.match(/"playabilityStatus":\{"status":"([^"]+)"/) || [])[1] || '?',
      });
    } catch (_) { /* body consumed */ }
  }
});

console.log(`[i] ext=${EXT}`);
console.log(`[i] opening ${URL}`);
try {
  await page.goto(URL, { waitUntil: 'domcontentloaded', timeout: 45000 });
} catch (e) { console.log('[!] goto:', String(e).slice(0, 120)); }

// give trial activation + player time
await page.waitForTimeout(12000);

// try to start playback
try {
  await page.evaluate(() => {
    const v = document.querySelector('video');
    if (v) { v.muted = false; v.play().catch(() => {}); }
    const btn = document.querySelector('.ytp-large-play-button, button.ytp-play-button');
    if (btn) btn.click();
  });
} catch (_) {}
await page.waitForTimeout(6000);

const state = await page.evaluate(() => {
  const v = document.querySelector('video');
  const wall = document.body.innerText.includes('blocchi degli annunci') ||
               document.body.innerText.includes('Ad blockers are not allowed');
  const errBox = document.querySelector('.ytp-error, yt-player-error-message-renderer');
  const errText = errBox ? errBox.innerText.slice(0, 120) : '';
  return {
    hasVideoEl: !!v,
    videoWidth: v ? v.videoWidth : -1,
    videoHeight: v ? v.videoHeight : -1,
    currentTime: v ? +v.currentTime.toFixed(1) : -1,
    duration: v ? (isFinite(v.duration) ? +v.duration.toFixed(1) : 'Inf') : -1,
    paused: v ? v.paused : null,
    readyState: v ? v.readyState : -1,
    wallVisible: wall,
    errText,
    trialFlag: document.documentElement.getAttribute('data-adoff-stealth') || '(none)',
    aoyt: (() => { try { return localStorage.getItem('__aoyt'); } catch { return '?'; } })(),
  };
});

console.log('\n=== PLAYER RESPONSES ===');
for (const r of playerResponses) console.log(JSON.stringify(r));
console.log('\n=== PLAYBACK STATE ===');
console.log(JSON.stringify(state, null, 2));
console.log('\n=== CONSOLE ERRORS (first 12) ===');
for (const e of consoleErrors.slice(0, 12)) console.log(' -', e);

const verdict = !state.hasVideoEl ? 'NO_VIDEO_EL'
  : state.wallVisible ? 'WALL_STILL_THERE'
  : state.errText ? 'PLAYER_ERROR'
  : state.videoWidth > 0 ? 'VIDEO_OK'
  : 'AUDIO_ONLY_NO_VIDEO';
console.log('\n=== VERDICT:', verdict, '===');

await ctx.close();
process.exit(0);
