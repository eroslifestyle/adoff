// Connect to a running Chrome (logged-in profile) over CDP and diagnose the
// audio-only / no-video failure on the target video, with AdOff 3.5.15 active.
import { chromium } from 'playwright';

const VIDEO_ID = process.argv[2] || 'U1mKZIxis6A';
const URL = `https://www.youtube.com/watch?v=${VIDEO_ID}`;

const browser = await chromium.connectOverCDP('http://localhost:9222');
const ctx = browser.contexts()[0];
const page = await ctx.newPage();

const players = [];
const errs = [];
page.on('console', (m) => { if (m.type() === 'error') errs.push(m.text().slice(0, 180)); });
page.on('response', async (resp) => {
  const u = resp.url();
  if (u.includes('/youtubei/v1/player') && !u.includes('ad_break')) {
    try {
      const t = await resp.text();
      players.push({
        len: t.length,
        adPlacements: /"adPlacements"/.test(t),
        xdPlacements: /"xdPlacements"/.test(t),
        bkaEnforce: /"bkaEnforcementMessageViewModel"/.test(t),
        xkaEnforce: /"xkaEnforcementMessageViewModel"/.test(t),
        enforce: /"enforcementMessageViewModel"/.test(t),
        serverAbr: /"serverAbrStreamingUrl"/.test(t),
        adaptiveFormats: /"adaptiveFormats"/.test(t),
        directVideoUrl: /"adaptiveFormats":\[\{[^}]*"url":/.test(t),
        status: (t.match(/"playabilityStatus":\{"status":"([^"]+)"/) || [])[1] || '?',
        reason: (t.match(/"playabilityStatus":\{[^}]*"reason":"([^"]+)"/) || [])[1] || '',
      });
    } catch (_) {}
  }
});

// Force the Pro/Trial gate ON (same flag stealth.js MAIN-world reads), so
// Layer A (strip adPlacements + mangle enforcement) is active = faithful to
// the user's Pro/Trial session where the audio-only failure appears.
console.log('[i] priming youtube.com origin to force stealth ON');
await page.goto('https://www.youtube.com/', { waitUntil: 'domcontentloaded', timeout: 60000 });
await page.evaluate(() => {
  try { localStorage.setItem('__aoyt', String(Date.now() + 86400000)); } catch (_) {}
});
await page.waitForTimeout(1500);

console.log('[i] opening', URL);
await page.goto(URL, { waitUntil: 'domcontentloaded', timeout: 60000 });
await page.waitForTimeout(13000);
try {
  await page.evaluate(() => {
    const v = document.querySelector('video');
    if (v) v.play().catch(() => {});
    const b = document.querySelector('.ytp-large-play-button, button.ytp-play-button');
    if (b) b.click();
  });
} catch (_) {}
await page.waitForTimeout(7000);

const s = await page.evaluate(() => {
  const v = document.querySelector('video');
  const body = document.body.innerText;
  let loggedIn = null, clientName = '', potoken = null;
  try { loggedIn = window.ytcfg && ytcfg.get && ytcfg.get('LOGGED_IN'); } catch {}
  try { potoken = !!(window.ytcfg && /poToken|sessionPoToken/i.test(JSON.stringify(ytcfg.data_ || {}))); } catch {}
  const errBox = document.querySelector('.ytp-error, yt-player-error-message-renderer, .ytp-error-content');
  return {
    loggedIn,
    potokenHinted: potoken,
    hasVideoEl: !!v,
    videoWidth: v ? v.videoWidth : -1,
    videoHeight: v ? v.videoHeight : -1,
    currentTime: v ? +v.currentTime.toFixed(1) : -1,
    duration: v ? (isFinite(v.duration) ? +v.duration.toFixed(1) : 'Inf') : -1,
    paused: v ? v.paused : null,
    readyState: v ? v.readyState : -1,
    muted: v ? v.muted : null,
    wallVisible: /blocchi degli annunci|Ad blockers are not allowed/.test(body),
    problemError: /Si è verificato un problema|An error occurred|Riprova più tardi/.test(body),
    errText: errBox ? errBox.innerText.slice(0, 140) : '',
    stealthFlag: document.documentElement.getAttribute('data-adoff-stealth') || '(none)',
  };
});

console.log('\n=== /player RESPONSES ===');
for (const p of players) console.log(JSON.stringify(p));
if (!players.length) console.log('(nessuna fetch /player — cold-load da ytInitialPlayerResponse in HTML)');
console.log('\n=== STATE ===');
console.log(JSON.stringify(s, null, 2));
console.log('\n=== CONSOLE ERRORS (first 15) ===');
for (const e of errs.slice(0, 15)) console.log(' -', e);

const verdict = !s.hasVideoEl ? 'NO_VIDEO_EL'
  : s.wallVisible ? 'WALL'
  : (s.problemError || s.errText) ? 'PLAYER_ERROR'
  : s.videoWidth > 0 ? 'VIDEO_OK'
  : 'AUDIO_ONLY_NO_VIDEO';
console.log('\n=== VERDICT:', verdict, '| loggedIn=' + s.loggedIn, '===');

await page.close();
await browser.close();
process.exit(0);
