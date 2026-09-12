const { chromium } = require('playwright');
const path = require('path');
const fs = require('fs');

const EXTENSION_PATH = path.resolve(__dirname, '../../app');
const TARGET_URL =
  process.env.TARGET_URL ||
  'https://streaming-community.archi/titles/34610-guarda-lanterns-streaming.html';
const OUT = path.resolve(__dirname, 'out');
fs.mkdirSync(OUT, { recursive: true });

async function run() {
  const results = [];
  const popups = [];

  const context = await chromium.launchPersistentContext('', {
    headless: false,
    args: [
      '--disable-extensions-except=' + EXTENSION_PATH,
      '--load-extension=' + EXTENSION_PATH,
      '--no-first-run',
      '--disable-default-apps',
      '--mute-audio',
    ],
    viewport: { width: 1366, height: 900 },
    ignoreDefaultArgs: ['--disable-extensions'],
  });
  await new Promise((r) => setTimeout(r, 3000));

  context.on('page', async (p) => {
    await new Promise((r) => setTimeout(r, 800));
    popups.push(p.url());
  });

  const pages = context.pages();
  const page = pages.length > 0 ? pages[0] : await context.newPage();

  const track = (p) => {
    p.on('requestfailed', (req) =>
      results.push({ url: req.url(), ok: false, frame: req.frame()?.url() || '' })
    );
    p.on('requestfinished', (req) =>
      results.push({ url: req.url(), ok: true, frame: req.frame()?.url() || '' })
    );
  };
  track(page);

  await page.goto(TARGET_URL, { waitUntil: 'domcontentloaded', timeout: 45000 }).catch(() => {});
  await new Promise((r) => setTimeout(r, 5000));
  await page.screenshot({ path: path.join(OUT, 'sca-1-title.png') });

  // click Riproduci / Guarda
  for (const sel of ['text=Riproduci', 'text=Guarda', '.play', '[class*="play"]']) {
    try {
      const el = await page.$(sel);
      if (el) {
        await el.click({ timeout: 2500 }).catch(() => {});
        console.log('[CLICK]', sel, '->', page.url());
        break;
      }
    } catch (e) {}
  }
  await new Promise((r) => setTimeout(r, 5000));
  await page.screenshot({ path: path.join(OUT, 'sca-2-afterplay.png') });

  // click center a few times (typical popunder trigger)
  for (let i = 0; i < 4; i++) {
    await page.mouse.click(683, 450).catch(() => {});
    await new Promise((r) => setTimeout(r, 1800));
  }
  await new Promise((r) => setTimeout(r, 2000));
  await page.screenshot({ path: path.join(OUT, 'sca-3-afterclicks.png') });

  // video state across frames
  const frameInfo = [];
  for (const f of page.frames()) {
    try {
      const info = await f.evaluate(() => {
        const v = document.querySelector('video');
        return v
          ? { src: (v.currentSrc || '').slice(0, 120), playing: !v.paused, t: v.currentTime, w: v.getBoundingClientRect().width }
          : null;
      });
      if (info) frameInfo.push({ frame: f.url().slice(0, 120), info });
    } catch (e) {}
  }
  console.log('[VIDEO FRAMES]', JSON.stringify(frameInfo, null, 1));
  console.log('[FRAME URLS]', JSON.stringify(page.frames().map((f) => f.url().slice(0, 120)), null, 1));
  console.log('[POPUPS]', JSON.stringify(popups, null, 1));

  const okHosts = {}, blockedHosts = {};
  results.forEach((r) => {
    let h;
    try { h = new URL(r.url).hostname; } catch (e) { return; }
    (r.ok ? okHosts : blockedHosts)[h] = ((r.ok ? okHosts : blockedHosts)[h] || 0) + 1;
  });
  console.log('\n=== NOT BLOCKED ===');
  Object.entries(okHosts).sort((a,b)=>b[1]-a[1]).forEach(([h,c])=>console.log('  '+c+'  '+h));
  console.log('\n=== BLOCKED ===');
  Object.entries(blockedHosts).sort((a,b)=>b[1]-a[1]).forEach(([h,c])=>console.log('  '+c+'  '+h));

  fs.writeFileSync(path.join(OUT, 'sca-report.json'), JSON.stringify({ results, popups, frameInfo }, null, 1));
  await context.close();
}

run().catch((e) => { console.error('[FATAL]', e); process.exit(1); });
