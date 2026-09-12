const { chromium } = require('playwright');
const path = require('path');
const fs = require('fs');

const EXTENSION_PATH = path.resolve(__dirname, '../../app');
const TARGET_URL = process.env.TARGET_URL || 'https://proctercommunity.info/casa/';
const OUT = path.resolve(__dirname, 'out');
fs.mkdirSync(OUT, { recursive: true });

async function run() {
  const popups = [];
  const requests = [];
  const consoleMsgs = [];

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

  await new Promise((r) => setTimeout(r, 2500));

  context.on('page', async (p) => {
    try {
      await new Promise((r) => setTimeout(r, 800));
      popups.push({ url: p.url() });
    } catch (e) {}
  });

  const pages = context.pages();
  const page = pages.length > 0 ? pages[0] : await context.newPage();

  page.on('console', (msg) => {
    consoleMsgs.push(msg.type() + ': ' + msg.text().slice(0, 200));
  });

  page.on('request', (req) => {
    requests.push({ type: req.resourceType(), url: req.url() });
  });

  console.log('[GOTO]', TARGET_URL);
  try {
    await page.goto(TARGET_URL, { waitUntil: 'domcontentloaded', timeout: 45000 });
  } catch (e) {
    console.error('[goto error]', e.message);
  }

  await new Promise((r) => setTimeout(r, 5000));
  await page.screenshot({ path: path.join(OUT, 'procter-1-loaded.png'), fullPage: false });

  // Probe page structure
  const probe = await page.evaluate(() => ({
    title: document.title,
    iframes: [...document.querySelectorAll('iframe')].map((f) => f.src),
    videos: document.querySelectorAll('video').length,
    bodyText: (document.body ? document.body.innerText : '').slice(0, 300),
  }));
  console.log('[PROBE]', JSON.stringify(probe, null, 1));

  // Try clicking a play button (common selectors)
  const playSelectors = ['.play', '#play', '.jw-icon-playback', 'button.play-btn', '[class*="play"]', 'video'];
  for (const sel of playSelectors) {
    try {
      const el = await page.$(sel);
      if (el) {
        await el.click({ timeout: 2000 }).catch(() => {});
        console.log('[CLICK]', sel);
        break;
      }
    } catch (e) {}
  }

  await new Promise((r) => setTimeout(r, 4000));
  await page.screenshot({ path: path.join(OUT, 'procter-2-afterclick.png'), fullPage: false });

  // Simulate a few more clicks on center of page (where video player usually is)
  for (let i = 0; i < 4; i++) {
    try {
      await page.mouse.click(683, 450);
    } catch (e) {}
    await new Promise((r) => setTimeout(r, 1500));
  }

  await new Promise((r) => setTimeout(r, 2000));
  await page.screenshot({ path: path.join(OUT, 'procter-3-afterclicks.png'), fullPage: false });

  const finalProbe = await page.evaluate(() => ({
    videos: [...document.querySelectorAll('video')].map((v) => ({
      src: v.currentSrc,
      playing: !v.paused,
      t: v.currentTime,
      w: v.getBoundingClientRect().width,
    })),
    iframes: [...document.querySelectorAll('iframe')].map((f) => f.src),
  }));
  console.log('[FINAL PROBE]', JSON.stringify(finalProbe, null, 1));

  console.log('\n--- POPUPS (' + popups.length + ') ---');
  popups.forEach((p, i) => console.log('  [' + i + ']', p.url));

  // Group requests by hostname
  const hosts = {};
  requests.forEach((r) => {
    try {
      const h = new URL(r.url).hostname;
      hosts[h] = (hosts[h] || 0) + 1;
    } catch (e) {}
  });
  console.log('\n--- REQUEST HOSTS (' + Object.keys(hosts).length + ') ---');
  Object.entries(hosts)
    .sort((a, b) => b[1] - a[1])
    .forEach(([h, c]) => console.log('  ' + c + '  ' + h));

  console.log('\n--- CONSOLE (last 30) ---');
  consoleMsgs.slice(-30).forEach((m) => console.log('  ' + m));

  fs.writeFileSync(
    path.join(OUT, 'procter-report.json'),
    JSON.stringify({ popups, hosts, requests: requests.map((r) => r.url), consoleMsgs, probe, finalProbe }, null, 1)
  );

  console.log('\nScreenshots + report saved in', OUT);
  await context.close();
}

run().catch((e) => {
  console.error('[FATAL]', e);
  process.exit(1);
});
