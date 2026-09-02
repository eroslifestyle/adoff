// Check della sezione 7 di stealth.js (pause-gate neutralizer).
// La globale `pausetime` va neutralizzata SOLO con la firma del template clone
// (video + modal di registrazione); ovunque altro deve restare intatta.
// Le fixture sono servite su HTTP locale: Chrome non inietta i content script
// sugli URL data:. Run: node sviluppo/tests/test-pausegate-fingerprint.js
const { chromium } = require('playwright');
const http = require('http');
const path = require('path');
const assert = require('assert');
const EXT = path.resolve(__dirname, '../../app');

const CASES = [
  ['firma clone completa (video + #mdl-register)', '<video></video><div id="mdl-register"></div>', true],
  ['firma clone completa (video + #mdl-login)',    '<video></video><div id="mdl-login"></div>',    true],
  ['solo video (sito video normale)',              '<video></video>',                              false],
  ['solo modal Material Design Lite',              '<div id="mdl-login"></div>',                   false],
  ['pagina qualunque',                             '<p>ciao</p>',                                  false],
  ['modal registrazione senza video',              '<div id="mdl-register"><form></form></div>',   false],
];

const server = http.createServer((req, res) => {
  const i = parseInt((req.url || '/0').slice(1), 10) || 0;
  res.writeHead(200, { 'Content-Type': 'text/html' });
  res.end('<!doctype html><html><body>' + (CASES[i] ? CASES[i][1] : '') + '</body></html>');
});

(async () => {
  await new Promise((r) => server.listen(0, '127.0.0.1', r));
  const base = 'http://127.0.0.1:' + server.address().port + '/';

  const ctx = await chromium.launchPersistentContext('', {
    headless: false,
    args: ['--disable-extensions-except=' + EXT, '--load-extension=' + EXT, '--no-first-run', '--mute-audio'],
    viewport: { width: 800, height: 600 }, ignoreDefaultArgs: ['--disable-extensions'],
  });
  await new Promise((r) => setTimeout(r, 2500));
  const page = ctx.pages()[0] || (await ctx.newPage());

  let failures = 0;
  for (let i = 0; i < CASES.length; i++) {
    const [label, , expectNeutralized] = CASES[i];
    await page.goto(base + i, { waitUntil: 'domcontentloaded' }).catch(() => {});
    await new Promise((r) => setTimeout(r, 500));
    const v = await page.evaluate(() => { window.pausetime = 10; return String(window.pausetime); });
    const neutralized = v === 'Infinity';
    const ok = neutralized === expectNeutralized;
    if (!ok) failures++;
    console.log((ok ? 'PASS  ' : 'FAIL  ') + label.padEnd(46) + 'pausetime=' + v);
  }

  await ctx.close();
  server.close();
  assert.strictEqual(failures, 0, failures + ' check falliti');
  console.log('\nTutti i check superati.');
})().catch((e) => { console.error('FALLITO:', e.message); process.exit(1); });
