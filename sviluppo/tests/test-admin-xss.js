/*
 * Test anti-XSS per la admin console (panel.html + assets/panel-app.js) e
 * per admin-console.html + assets/admin-app.js.
 *
 * Serve site/ su una porta locale, apre le due pagine con Playwright, intercetta
 * le chiamate API e risponde con payload ostili. PASS se:
 *  - nessun payload eseguito (window.__xss_fired resta undefined)
 *  - nessun elemento DOM inatteso creato (niente [onerror]/[onload], niente
 *    <img src="x">, niente <a href="javascript:...">)
 *  - le stringhe malevole compaiono nel DOM COME TESTO (escaper attivo, dati
 *    non scartati silenziosamente).
 *
 * Uso: node sviluppo/tests/test-admin-xss.js   (exit 0 = PASS, 1 = FAIL)
 */

const http = require('http');
const path = require('path');
const fs = require('fs');
const { chromium } = require('playwright');

const PORT = 8791;
const BASE = `http://localhost:${PORT}`;
const SITE = path.join(__dirname, '../../site');

const MIME = {
  '.html': 'text/html; charset=utf-8',
  '.js': 'application/javascript; charset=utf-8',
  '.css': 'text/css; charset=utf-8',
  '.png': 'image/png',
  '.svg': 'image/svg+xml',
  '.json': 'application/json',
};

function startServer() {
  const server = http.createServer((req, res) => {
    // Path sanitizzato: niente traversal fuori da site/
    const urlPath = decodeURIComponent(new URL(req.url, BASE).pathname);
    const safe = path.normalize(urlPath).replace(/^(\.\.[/\\])+/, '');
    const file = path.join(SITE, safe);
    if (!file.startsWith(SITE)) { res.writeHead(403); res.end(); return; }
    fs.readFile(file, (err, data) => {
      if (err) { res.writeHead(404); res.end('not found'); return; }
      res.writeHead(200, { 'Content-Type': MIME[path.extname(file)] || 'application/octet-stream' });
      res.end(data);
    });
  });
  return new Promise(resolve => server.listen(PORT, () => resolve(server)));
}

// Payload ostile: se una qualunque interpolazione non escapata esistesse,
// questi valori eseguirebbero codice nel contesto pagina.
const P = {
  script: '<script>window.__xss_fired=1</script>',
  attr: '" onmouseover="window.__xss_fired=1',
  img: '<img src=x onerror=window.__xss_fired=1>',
  svg: '<svg onload=window.__xss_fired=1></svg>',
  jsurl: 'javascript:window.__xss_fired=1',
  httpurl: 'http://evil.example/x" onmouseover="window.__xss_fired=1',
};

const EVIL_LICENSES = {
  ok: true,
  licenses: [{
    key: P.script,
    email: `x'${P.attr}'@e.com`,
    country: P.img,
    plan: 'Free', status: 'active', devices: 1, maxDevices: 3,
  }],
};

// ── Mock API per admin-console.html: payload ostili in city/country/browser/
// source, GSC coverage/index/sitemap/issues, errori API e URL sitemap. ──
const EVIL_ADMIN = {
  '/admin/stats': {
    ok: true,
    licenses: { total: 1, active: 1, lifetime: 0, expired: 0 },
    sales: { totalSold: 0 }, devices: { total: 0 }, plans: {},
  },
  '/admin/revenue': {
    ok: true,
    revenue: { mrr: 0, last30days: [{ date: '2026-09-12', amount: 0, count: 0 }], byPlan: {} },
  },
  '/admin/analytics': {
    ok: true,
    installs: {
      total: 1, today: 0, last7days: [],
      byCountry: [], bySource: {},
      recentLog: [
        { ts: Date.now(), country: P.svg, city: P.img, browser: P.script, source: P.attr },
      ],
    },
    downloads: { total: 0, today: 0, byBrowser: {} },
    uninstalls: { total: 0, last7days: [], byReason: {}, byBrowser: {}, recentLog: [] },
  },
  '/admin/retention': { ok: true, summary: { activeEnabled: 0, activeDisabled: 0 } },
  '/admin/seo': {
    ok: true, cached: false,
    data: {
      updatedAt: Date.now(),
      gsc: { totals: {}, trend30d: [], topDevice: [], topQuery: [], topPage: [], topCountry: [], topAppearance: [], opportunities: [] },
      ga4: null,
      sitemaps: [{ path: `https://adoff.app/${P.jsurl}`, errors: 0, warnings: 0, contents: [{ type: 'web', submitted: 0, indexed: 0 }] }],
    },
  },
  // POST /admin/seo/url-inspect — coverage issue, sitemap, issues ostili
  '/admin/seo/url-inspect': {
    ok: true,
    result: {
      indexStatusResult: { indexStatus: 'INDEXED', sitemap: P.img, lastCrawlTime: '2026-09-01T00:00:00Z' },
      coverageSummaryResult: { issue: P.svg },
      mobileUsabilityResult: {},
      richResultsResult: {},
      pageFetchState: { failedCronCause: P.script },
    },
  },
  // POST /admin/seo/url-inspect/batch — sitemapUrl non-https + status ostile
  '/admin/seo/url-inspect/batch': {
    ok: true, inspected: 1, total: 1,
    sitemapUrl: P.jsurl,
    results: [{ url: P.httpurl, indexed: false, status: P.img }],
  },
};

async function testPanel(browser) {
  let failures = 0;
  const page = await browser.newPage();
  await page.route('https://api.adoff.app/**', route => {
    const url = route.request().url();
    let body = { status: 'ok' };
    if (url.includes('/admin/licenses')) body = EVIL_LICENSES;
    if (url.includes('/admin/stats')) {
      body = { ok: true, licenses: { total: 1, active: 1, lifetime: 0, revoked: 0 } };
    }
    route.fulfill({ status: 200, contentType: 'application/json', body: JSON.stringify(body) });
  });

  await page.goto(`${BASE}/panel.html`, { waitUntil: 'load' });
  await page.fill('#adminToken', 'test-token');
  await page.click('#btnConnect');
  await page.waitForFunction(
    email => document.body.textContent.includes(email),
    EVIL_LICENSES.licenses[0].email,
    { timeout: 5000 }
  );

  const xssFired = await page.evaluate(() => window.__xss_fired);
  const keyCell = await page.textContent('#licensesBody tr td:nth-child(2)');
  const emailCell = await page.textContent('#licensesBody tr td:nth-child(3)');

  if (xssFired !== undefined) {
    console.log(`FAIL: payload eseguito (window.__xss_fired = ${xssFired}) — XSS reale`);
    failures++;
  } else {
    console.log('OK: nessun payload eseguito (window.__xss_fired undefined)');
  }
  if (keyCell.trim() === EVIL_LICENSES.licenses[0].key) {
    console.log('OK: key ostile presente come TESTO nel DOM');
  } else {
    console.log(`FAIL: key non resa come testo (got: ${JSON.stringify(keyCell)})`);
    failures++;
  }
  if (emailCell.trim() === EVIL_LICENSES.licenses[0].email) {
    console.log('OK: email ostile presente come TESTO nel DOM');
  } else {
    console.log(`FAIL: email non resa come testo (got: ${JSON.stringify(emailCell)})`);
    failures++;
  }
  await page.close();
  return failures;
}

async function testAdminConsole(browser) {
  let failures = 0;
  const page = await browser.newPage();
  await page.route('https://api.adoff.app/**', route => {
    const url = route.request().url();
    const base = url.split('?')[0];
    const ep = Object.keys(EVIL_ADMIN).sort((a, b) => b.length - a.length).find(k => base.includes(k));
    if (ep) {
      return route.fulfill({ status: 200, contentType: 'application/json', body: JSON.stringify(EVIL_ADMIN[ep]) });
    }
    // Outreach: errore API ostile (messaggio d'errore da risposta non fidata)
    if (base.includes('/admin/outreach')) {
      return route.fulfill({ status: 200, contentType: 'application/json', body: JSON.stringify({ ok: false, error: P.attr }) });
    }
    return route.fulfill({ status: 200, contentType: 'application/json', body: JSON.stringify({ ok: true }) });
  });

  await page.goto(`${BASE}/admin-console.html`, { waitUntil: 'load' });
  await page.fill('#loginUser', 'admin');
  await page.fill('#loginPass', 'password');
  await page.click('#btnLogin');

  // 1) Stats page: city/country/browser/source ostili nella tabella installazioni
  await page.waitForFunction(
    city => (document.querySelector('#stInstallLog') || {}).textContent?.includes(city),
    P.img,
    { timeout: 8000 }
  );
  const logText = await page.textContent('#stInstallLog');
  // source (attr) non è in questa tabella: è verificato come testo nell'errore outreach al passo 4
  for (const [name, payload] of [['img', P.img], ['svg', P.svg], ['script', P.script]]) {
    if (logText.includes(payload)) console.log(`OK: installLog rende ${name} come TESTO`);
    else { console.log(`FAIL: installLog non contiene ${name} come testo`); failures++; }
  }

  // 2) GSC URL inspect: coverage issue / sitemap / issues ostili (tab SEO nascosta: aprila)
  await page.click('.stat-tab[data-stats-tab="seo"]');
  await page.fill('#seo-inspect-url', 'https://adoff.app/');
  await page.click('#btnInspectSeoUrl');
  await page.waitForFunction(
    svg => (document.querySelector('#seo-inspect-result') || {}).textContent?.includes(svg),
    P.svg,
    { timeout: 8000 }
  );
  const inspectText = await page.textContent('#seo-inspect-result');
  for (const [name, payload] of [['issue/svg', P.svg], ['sitemap/img', P.img], ['issues/script', P.script]]) {
    if (inspectText.includes(payload)) console.log(`OK: url-inspect rende ${name} come TESTO`);
    else { console.log(`FAIL: url-inspect non contiene ${name} come testo`); failures++; }
  }

  // 3) Batch sitemap: URL javascript: NON deve diventare href; status ostile come testo
  await page.click('#btnBatchInspect');
  await page.waitForFunction(
    () => ((document.querySelector('#seo-batch-results') || {}).textContent || '').includes('URL ispezionate'),
    null,
    { timeout: 8000 }
  );
  const batchText = await page.textContent('#seo-batch-results');
  const domChecks = await page.evaluate(imgPayload => ({
    jsAnchors: document.querySelectorAll('a[href^="javascript:"]').length,
    xImgs: document.querySelectorAll('img[src="x"]').length,
    onerrorNodes: document.querySelectorAll('[onerror],[onload]').length,
    fallbackShown: (document.querySelector('#seo-batch-results') || {}).textContent?.includes('(link non valido)'),
    statusAsText: (document.querySelector('#seo-batch-results') || {}).textContent?.includes(imgPayload),
  }), P.img);
  if (domChecks.jsAnchors === 0) console.log('OK: nessun <a href="javascript:..."> nel DOM');
  else { console.log(`FAIL: ${domChecks.jsAnchors} anchor javascript: presenti`); failures++; }
  if (domChecks.xImgs === 0) console.log('OK: nessun <img src="x"> creato come elemento');
  else { console.log(`FAIL: ${domChecks.xImgs} <img src="x"> nel DOM`); failures++; }
  if (domChecks.onerrorNodes === 0) console.log('OK: nessun nodo con attributo onerror/onload');
  else { console.log(`FAIL: ${domChecks.onerrorNodes} nodi con onerror/onload`); failures++; }
  if (domChecks.fallbackShown) console.log('OK: URL sitemap ostile → fallback "link non valido" mostrato');
  else { console.log('FAIL: fallback "link non valido" non mostrato'); failures++; }
  if (domChecks.statusAsText) console.log('OK: batch status ostile presente come TESTO');
  else { console.log('FAIL: batch status non reso come testo'); failures++; }

  // 4) Errore API ostile (outreach) mostrato come testo
  await page.click('.nav-item[data-page="outreach"]');
  await page.waitForFunction(
    attr => (document.querySelector('#outreachList') || {}).textContent?.includes(attr),
    P.attr,
    { timeout: 8000 }
  );
  console.log('OK: errore API ostile mostrato come TESTO in #outreachList');

  const fired = await page.evaluate(() => window.__xss_fired);
  if (fired !== undefined) { console.log(`FAIL: payload eseguito in admin-console (__xss_fired=${fired})`); failures++; }
  else console.log('OK: admin-console nessun payload eseguito');

  await page.close();
  return failures;
}

async function main() {
  const server = await startServer();
  const browser = await chromium.launch();
  let failures = 0;

  console.log('=== panel.html ===');
  failures += await testPanel(browser);

  console.log('=== admin-console.html ===');
  failures += await testAdminConsole(browser);

  await browser.close();
  server.close();

  if (failures) { console.log(`\nRESULT: FAIL (${failures} check falliti)`); process.exit(1); }
  console.log('\nRESULT: PASS');
}

main();
