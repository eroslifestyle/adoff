/*
 * Test anti-XSS per la admin console (panel.html + assets/panel-app.js).
 *
 * Serve site/ su una porta locale, apre panel.html con Playwright, intercetta
 * le chiamate API e risponde con payload ostili. PASS se:
 *  - nessun payload eseguito (window.__xss_fired resta undefined)
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
const EVIL_LICENSES = {
  ok: true,
  licenses: [{
    key: '<script>window.__xss_fired=1</script>',
    email: "x'-alert(1)-'@e.com",
    country: '"><img src=x onerror=window.__xss_fired=1>',
    plan: 'Free', status: 'active', devices: 1, maxDevices: 3,
  }],
};

async function main() {
  const server = await startServer();
  const browser = await chromium.launch();
  let failures = 0;

  try {
    const page = await browser.newPage();
    // Intercetta TUTTE le chiamate API: health (per il connect), stats, licenses.
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

    // Connect: apiUrl ha gia' il valore giusto nell'HTML, basta il token.
    await page.fill('#adminToken', 'test-token');
    await page.click('#btnConnect');
    // Attende che la riga col payload ostile sia renderizzata. textContent,
    // non innerText: innerText normalizza e non contiene l'email letterale.
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

    // I dati ostili devono essere VISIBILI come testo: prova che il renderer
    // li ha escapati/inscatolati, non scartati (un renderer rotto chebutta
    // i dati farebbe passare questo test solo se saltiamo questo check).
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
  } catch (e) {
    console.log('FAIL: errore durante il test:', e.message);
    failures++;
  } finally {
    await browser.close();
    server.close();
  }

  if (failures) { console.log(`\nRESULT: FAIL (${failures} check falliti)`); process.exit(1); }
  console.log('\nRESULT: PASS');
}

main();
