const { chromium } = require('playwright');
const path = require('path');
const fs = require('fs');

const EXTENSION_PATH = path.resolve(__dirname, '../../app');
const OUT = path.resolve(__dirname, 'out');
fs.mkdirSync(OUT, { recursive: true });

async function run() {
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

  const pages = context.pages();
  const page = pages.length > 0 ? pages[0] : await context.newPage();

  await page.goto('https://proctercommunity.info/film/mutiny-inverti-la-rotta-2026-D12884453x/', {
    waitUntil: 'domcontentloaded',
    timeout: 45000,
  }).catch(() => {});
  await new Promise((r) => setTimeout(r, 4000));
  await page.screenshot({ path: path.join(OUT, 'video-1-detail.png') });

  // click Guarda / play
  try {
    const guarda = await page.$('text=Guarda');
    if (guarda) await guarda.click({ timeout: 2000 }).catch(() => {});
  } catch (e) {}
  await new Promise((r) => setTimeout(r, 3000));

  await page.mouse.wheel(0, 500);
  await new Promise((r) => setTimeout(r, 1000));
  await page.screenshot({ path: path.join(OUT, 'video-1b-scrolled.png') });

  // click the big play button overlay if present
  try {
    await page.mouse.click(683, 620);
  } catch (e) {}
  await new Promise((r) => setTimeout(r, 4000));

  await page.screenshot({ path: path.join(OUT, 'video-2-playing.png') });

  // check video/iframe across all frames
  const frameInfo = [];
  for (const frame of page.frames()) {
    try {
      const info = await frame.evaluate(() => {
        const v = document.querySelector('video');
        return v ? { src: v.currentSrc, playing: !v.paused, t: v.currentTime, w: v.getBoundingClientRect().width } : null;
      });
      if (info) frameInfo.push({ frameUrl: frame.url(), info });
    } catch (e) {}
  }
  console.log('[FRAMES WITH VIDEO]', JSON.stringify(frameInfo));
  console.log('[ALL FRAME URLS]', JSON.stringify(page.frames().map((f) => f.url())));

  // check for any scam overlay
  const overlayText = await page.evaluate(() => document.body.innerText.includes('trading automatizzato') || document.body.innerText.includes('Guadagna fino'));
  console.log('[SCAM OVERLAY PRESENT]', overlayText);

  await context.close();
}

run().catch((e) => { console.error('[FATAL]', e); process.exit(1); });
