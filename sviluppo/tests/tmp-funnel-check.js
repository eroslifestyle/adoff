const { chromium } = require('playwright');
const path = require('path');
const EXT = path.resolve('/mnt/nvme2/projects/Progetti/ChromePlugin/app');
const OUT = '/mnt/nvme2/projects/Progetti/ChromePlugin/sviluppo/tests/out';

(async () => {
  const ctx = await chromium.launchPersistentContext('', {
    headless: false,
    args: ['--disable-extensions-except=' + EXT, '--load-extension=' + EXT, '--no-first-run', '--mute-audio'],
    viewport: { width: 1366, height: 900 }, ignoreDefaultArgs: ['--disable-extensions'],
  });
  await new Promise(r => setTimeout(r, 3000));
  const page = ctx.pages()[0] || await ctx.newPage();
  const blocked = [], passed = [];
  page.on('requestfailed', r => blocked.push(r.url()));
  page.on('requestfinished', r => passed.push(r.url()));

  // 1) il film parte?
  await page.goto('https://proctercommunity.info/film/mutiny-inverti-la-rotta-2026-D12884453x/orologio/#video-player',
    { waitUntil: 'domcontentloaded', timeout: 45000 }).catch(()=>{});
  await new Promise(r => setTimeout(r, 4000));
  await page.mouse.click(683, 620).catch(()=>{});
  await new Promise(r => setTimeout(r, 6000));
  for (const f of page.frames()) {
    const v = await f.evaluate(() => { const e = document.querySelector('video');
      return e ? { playing: !e.paused, t: +e.currentTime.toFixed(2), ready: e.readyState } : null; }).catch(()=>null);
    if (v) console.log('[VIDEO a 6s]', JSON.stringify(v));
  }

  // 2) il funnel scam e' raggiungibile?
  const r1 = await page.goto('https://topnox-inpus.com/?s=4&t1=1957&t4=DEAL&t2=',
    { waitUntil: 'domcontentloaded', timeout: 20000 }).catch(e => ({ err: e.message }));
  console.log('[topnox-inpus]', r1 && r1.err ? 'BLOCCATO (' + r1.err.split('\n')[0] + ')' : 'RAGGIUNTO status=' + (r1 && r1.status && r1.status()));

  const r2 = await page.goto('https://virtuous-entryway.life/l/mcnt/?c=x&p=1957&cc=IT',
    { waitUntil: 'domcontentloaded', timeout: 20000 }).catch(e => ({ err: e.message }));
  console.log('[virtuous-entryway]', r2 && r2.err ? 'BLOCCATO (' + r2.err.split('\n')[0] + ')' : 'RAGGIUNTO status=' + (r2 && r2.status && r2.status()));

  await page.screenshot({ path: OUT + '/funnel-blocked.png' }).catch(()=>{});
  console.log('[scam host bloccati]', blocked.filter(u => /topnox|virtuous/.test(u)).length);
  await ctx.close();
})().catch(e => { console.error(e); process.exit(1); });
