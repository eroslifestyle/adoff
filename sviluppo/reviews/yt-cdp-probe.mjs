// Deep probe: confirm AdOff Layer A is actually active (adPlacements stripped,
// enforcement mangled) on the logged-in session, then exercise SPA navigation.
import { chromium } from 'playwright';

const VIDEO_ID = process.argv[2] || 'U1mKZIxis6A';
const browser = await chromium.connectOverCDP('http://localhost:9222');
const ctx = browser.contexts()[0];
const page = await ctx.newPage();

const players = [];
page.on('response', async (resp) => {
  const u = resp.url();
  if (u.includes('/youtubei/v1/player') && !u.includes('ad_break')) {
    try {
      const t = await resp.text();
      players.push({
        adPlacements: /"adPlacements"/.test(t),
        xdPlacements: /"xdPlacements"/.test(t),
        bkaEnforce: /"bkaEnforcementMessageViewModel"/.test(t),
        xkaEnforce: /"xkaEnforcementMessageViewModel"/.test(t),
        serverAbr: /"serverAbrStreamingUrl"/.test(t),
        status: (t.match(/"playabilityStatus":\{"status":"([^"]+)"/) || [])[1] || '?',
      });
    } catch (_) {}
  }
});

await page.goto('https://www.youtube.com/', { waitUntil: 'domcontentloaded', timeout: 60000 });
await page.evaluate(() => { try { localStorage.setItem('__aoyt', String(Date.now() + 86400000)); } catch {} });
await page.waitForTimeout(1500);
await page.goto(`https://www.youtube.com/watch?v=${VIDEO_ID}`, { waitUntil: 'domcontentloaded', timeout: 60000 });
await page.waitForTimeout(11000);

const cold = await page.evaluate(() => {
  const r = window.ytInitialPlayerResponse;
  const v = document.querySelector('video');
  return {
    aoytSet: (() => { try { return !!localStorage.getItem('__aoyt'); } catch { return '?'; } })(),
    yiprExists: !!r,
    yipr_hasAdPlacements: !!(r && r.adPlacements),        // expect FALSE if Layer A stripped it
    yipr_hasXdPlacements: !!(r && r.xdPlacements),
    yipr_hasEnforce: !!(r && r.auxiliaryUi && r.auxiliaryUi.messageRenderers &&
      (r.auxiliaryUi.messageRenderers.bkaEnforcementMessageViewModel ||
       r.auxiliaryUi.messageRenderers.enforcementMessageViewModel)), // expect FALSE
    yipr_status: r && r.playabilityStatus && r.playabilityStatus.status,
    videoW: v ? v.videoWidth : -1,
    readyState: v ? v.readyState : -1,
  };
});
console.log('=== COLD LOAD PROBE ===');
console.log(JSON.stringify(cold, null, 2));

// SPA navigation to a related video → triggers /youtubei/v1/player fetch + injectNoAd
console.log('\n[i] SPA nav to a related video...');
try {
  await page.evaluate(() => {
    const a = document.querySelector('a#thumbnail[href*="watch"], ytd-compact-video-renderer a[href*="watch"]');
    if (a) a.click();
  });
  await page.waitForTimeout(9000);
} catch (e) { console.log('spa nav err', String(e).slice(0,80)); }

const spa = await page.evaluate(() => {
  const v = document.querySelector('video');
  const body = document.body.innerText;
  return {
    url: location.href.slice(0, 60),
    videoW: v ? v.videoWidth : -1,
    currentTime: v ? +v.currentTime.toFixed(1) : -1,
    readyState: v ? v.readyState : -1,
    wall: /blocchi degli annunci|Ad blockers are not allowed/.test(body),
    problem: /Si è verificato un problema|Riprova più tardi|An error occurred/.test(body),
  };
});
console.log('\n=== AFTER SPA NAV ===');
console.log(JSON.stringify(spa, null, 2));
console.log('\n=== /player FETCHES (SPA) ===');
for (const p of players) console.log(JSON.stringify(p));

await page.close();
await browser.close();
process.exit(0);
