const http = require('http');
const path = require('path');
const { chromium } = require('playwright');

const EXTENSION_PATH = path.resolve(__dirname, '../../app');
const PORT = 8149;

let server;
let context;

function startServer() {
  return new Promise((resolve, reject) => {
    server = http.createServer((req, res) => {
      try {
        if (req.url.startsWith('/frame')) {
          res.writeHead(200, { 'Content-Type': 'text/html' });
          res.end('<h1>IFRAME</h1>');
        } else {
          res.writeHead(200, { 'Content-Type': 'text/html' });
          res.end('<h1>MAIN</h1><iframe src="/frame" width=400 height=300></iframe>');
        }
      } catch (e) {
        try { res.end(); } catch (_) {}
      }
    });
    server.on('error', reject);
    server.listen(PORT, () => resolve());
  });
}

async function check(name, expectAllowed, ctxName, url, withGesture, page, results) {
  try {
    let ctx;
    if (ctxName === 'iframe') {
      ctx = page.frames().find(f => f.url().includes('/frame'));
      if (!ctx) throw new Error('iframe not found');
    } else {
      ctx = page;
    }

    let got;
    if (!withGesture) {
      got = await ctx.evaluate(u => {
        try {
          const w = window.open(u);
          if (w) {
            try { w.close(); } catch (e) {}
            return true;
          }
          return false;
        } catch (e) {
          return false;
        }
      }, url);
    } else {
      await ctx.evaluate(u => {
        window.__res = null;
        document.addEventListener('click', () => {
          try {
            const w = window.open(u);
            if (w) {
              try { w.close(); } catch (e) {}
              window.__res = true;
            } else {
              window.__res = false;
            }
          } catch (e) {
            window.__res = false;
          }
        }, { once: true });
      }, url);
      // Se il contesto è iframe, clicchiamo dentro l'iframe
      // altrimenti il listener di gesto dell'iframe non si aggiorna e il test passerebbe per il motivo sbagliato
      if (ctxName === 'iframe') {
        let box = null;
        try { const h = await page.$('iframe'); if (h) box = await h.boundingBox(); } catch (e) {}
        if (box) { await page.mouse.click(box.x + box.width/2, box.y + box.height/2); }
        else { await page.mouse.click(600, 400); }
      } else {
        await page.mouse.click(600, 400);
      }
      await new Promise(r => setTimeout(r, 600));
      got = await ctx.evaluate(() => window.__res);
    }

    results.push({ name, ctxName, expectAllowed, got, pass: got === expectAllowed });
  } catch (e) {
    results.push({ name, ctxName, expectAllowed, got: false, pass: false, error: e.message });
  }
}

async function run() {
  try {
    await startServer();

    context = await chromium.launchPersistentContext('', {
      headless: false,
      args: [
        '--disable-extensions-except=' + EXTENSION_PATH,
        '--load-extension=' + EXTENSION_PATH,
        '--no-first-run',
        '--disable-default-apps',
        '--mute-audio'
      ],
      viewport: { width: 1200, height: 800 },
      ignoreDefaultArgs: ['--disable-extensions']
    });

    await new Promise(r => setTimeout(r, 2500));

    const page = await context.newPage();
    await page.goto('http://127.0.0.1:' + PORT + '/');
    await new Promise(r => setTimeout(r, 2000));

    // Dopo il goto: chiude solo le tab APERTE DAI TEST, non la pagina di test.
    context.on('page', p => { try { p.close(); } catch (e) {} });

    const results = [];

    const checks = [
      ['Layer1 ad network', false, 'main', 'https://popads.net/xyz', false],
      ['Layer1 TLD abuso', false, 'main', 'https://abc123.xyz/promo', false],
      ['Layer2 senza gesto', false, 'main', 'https://example.com/', false],
      ['same-site permesso', true, 'main', '/frame', false],
      ['Layer1 dentro IFRAME', false, 'iframe', 'https://popads.net/xyz', false],
      ['Layer2 dentro IFRAME', false, 'iframe', 'https://example.com/', false],
      ['TLD legittimo con gesto', true, 'main', 'https://negozio.store/', true],
      ['ad network con gesto', false, 'main', 'https://popcash.net/x', true],
      ['IFRAME terze parti CON gesto (caso player)', false, 'iframe', 'https://tracker-esempio.com/promo', true],
      ['IFRAME verso il sito ospite CON gesto', true, 'iframe', 'http://127.0.0.1:' + PORT + '/frame', true]
    ];

    for (const [name, expectAllowed, ctxName, url, withGesture] of checks) {
      await check(name, expectAllowed, ctxName, url, withGesture, page, results);
      await new Promise(r => setTimeout(r, 400));
    }

    console.log('\n+------+--------+----------+--------+--------+');
    console.log('| PASS | NAME                          | CTX  | EXPECTED | GOT |');
    console.log('+------+--------+----------+--------+--------+');
    let passed = 0;
    for (const r of results) {
      const passStr = r.pass ? 'PASS' : 'FAIL';
      const nameStr = r.name.padEnd(30).substring(0, 30);
      const ctxStr = (r.ctxName || '').padEnd(5);
      const expStr = r.expectAllowed ? 'permesso' : 'bloccato';
      const gotStr = r.got === null || r.got === undefined ? 'err' : r.got ? 'permesso' : 'bloccato';
      console.log(`| ${passStr} | ${nameStr} | ${ctxStr} | ${expStr.padEnd(8)} | ${gotStr.padEnd(5)} |`);
      if (r.pass) passed++;
    }
    console.log('+------+--------+----------+--------+--------+');
    console.log(`\n${passed}/${results.length} test passati\n`);

    if (passed < results.length) {
      process.exitCode = 1;
    }
  } catch (e) {
    console.error('Fatal error:', e.message);
    process.exitCode = 1;
  } finally {
    try { if (context) await context.close(); } catch (e) {}
    try { if (server) server.close(); } catch (e) {}
  }
}

run();
