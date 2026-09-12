import { chromium } from 'playwright-core';
import http from 'http';
import fs from 'fs';
import path from 'path';

const ROOT = path.resolve('site');
const MIME = { '.html':'text/html', '.css':'text/css', '.js':'application/javascript', '.webp':'image/webp', '.png':'image/png', '.svg':'image/svg+xml', '.json':'application/json', '.woff2':'font/woff2', '.ico':'image/x-icon' };

const server = http.createServer((req, res) => {
  let p = decodeURIComponent(req.url.split('?')[0]);
  if (p === '/' || p === '') p = '/index.html';
  let fp = path.join(ROOT, p);
  if (!fs.existsSync(fp) || fs.statSync(fp).isDirectory()) { res.statusCode = 404; return res.end('nf'); }
  res.setHeader('Content-Type', MIME[path.extname(fp)] || 'application/octet-stream');
  fs.createReadStream(fp).pipe(res);
});

await new Promise(r => server.listen(8123, r));
const exe = process.env.PW_CHROME || '/root/.cache/ms-playwright/chromium-1228/chrome-linux/chrome';
const browser = await chromium.launch({ executablePath: exe, args: ['--no-sandbox','--disable-gpu'] });

async function shot(name, opts) {
  const ctx = await browser.newContext({ viewport: opts.vp, deviceScaleFactor: 1, colorScheme: opts.scheme });
  const page = await ctx.newPage();
  if (opts.theme) await page.addInitScript(t => { try { localStorage.setItem('adoff_theme', t); } catch(e){} }, opts.theme);
  await page.goto('http://localhost:8123/index.html', { waitUntil: 'networkidle', timeout: 20000 });
  await page.waitForTimeout(700);
  await page.screenshot({ path: `sviluppo/reviews/shots/${name}.png`, fullPage: opts.full });
  await ctx.close();
  console.log('shot', name);
}

await shot('home-light-desktop', { vp:{width:1280,height:900}, theme:'light', full:true });
await shot('home-dark-desktop',  { vp:{width:1280,height:900}, theme:'dark',  full:true });
await shot('home-light-mobile',  { vp:{width:390,height:844},  theme:'light', full:true });
await shot('home-hero-light',     { vp:{width:1280,height:820}, theme:'light', full:false });

await browser.close();
server.close();
console.log('DONE');
