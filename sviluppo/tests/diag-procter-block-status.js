const { chromium } = require('playwright');
const path = require('path');
const fs = require('fs');

const EXTENSION_PATH = path.resolve(__dirname, '../../app');
const TARGET_URL = process.env.TARGET_URL || 'https://proctercommunity.info/casa/';
const OUT = path.resolve(__dirname, 'out');
fs.mkdirSync(OUT, { recursive: true });

async function run() {
  const results = [];

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

  page.on('requestfailed', (req) => {
    results.push({ url: req.url(), status: 'BLOCKED/' + (req.failure()?.errorText || '?') });
  });
  page.on('requestfinished', (req) => {
    results.push({ url: req.url(), status: 'OK' });
  });

  await page.goto(TARGET_URL, { waitUntil: 'domcontentloaded', timeout: 45000 }).catch(() => {});
  await new Promise((r) => setTimeout(r, 5000));

  // click "Guarda"
  try {
    const guarda = await page.$('text=Guarda');
    if (guarda) await guarda.click({ timeout: 2000 }).catch(() => {});
  } catch (e) {}
  await new Promise((r) => setTimeout(r, 4000));

  for (let i = 0; i < 4; i++) {
    await page.mouse.click(683, 450).catch(() => {});
    await new Promise((r) => setTimeout(r, 1500));
  }
  await new Promise((r) => setTimeout(r, 2000));

  await page.screenshot({ path: path.join(OUT, 'procter-status.png') });

  const notBlockedHosts = {};
  const blockedHosts = {};
  results.forEach((r) => {
    let h;
    try { h = new URL(r.url).hostname; } catch (e) { return; }
    if (r.status === 'OK') notBlockedHosts[h] = (notBlockedHosts[h] || 0) + 1;
    else blockedHosts[h] = (blockedHosts[h] || 0) + 1;
  });

  console.log('=== NOT BLOCKED (loaded OK) ===');
  Object.entries(notBlockedHosts).sort((a,b)=>b[1]-a[1]).forEach(([h,c]) => console.log('  ' + c + '  ' + h));
  console.log('\n=== BLOCKED ===');
  Object.entries(blockedHosts).sort((a,b)=>b[1]-a[1]).forEach(([h,c]) => console.log('  ' + c + '  ' + h));

  fs.writeFileSync(path.join(OUT, 'procter-block-status.json'), JSON.stringify(results, null, 1));
  await context.close();
}

run().catch((e) => { console.error('[FATAL]', e); process.exit(1); });
