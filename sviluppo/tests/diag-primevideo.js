'use strict';
const { chromium } = require('playwright');
const path = require('path');
const fs = require('fs');

// Percorsi
const EXTENSION_PATH = path.resolve(__dirname, '../../app');
const OUT_DIR = path.resolve(__dirname, 'out');

// Modalità senza estensione
const NOEXT = process.env.NOEXT === '1';
const extLabel = NOEXT ? 'noext' : 'ext';

// Argomenti per il caricamento dell'estensione
const extArgs = NOEXT ? [] : [
  '--disable-extensions-except=' + EXTENSION_PATH,
  '--load-extension=' + EXTENSION_PATH
];

// Opzioni di lancio del browser
const launchOptions = {
  headless: false,
  // MAI channel:"chrome" — il Chrome di sistema NON inietta world:MAIN sotto --load-extension
  args: [
    '--no-first-run',
    '--disable-default-apps',
    '--mute-audio',
    ...extArgs
  ],
  viewport: { width: 1366, height: 900 },
  ignoreDefaultArgs: ['--disable-extensions']
};

(async () => {
  let context;
  try {
    // Avvio del contesto persistente
    context = await chromium.launchPersistentContext('', launchOptions);
    // Attesa per l'inizializzazione
    await new Promise(r => setTimeout(r, 2500));
    const page = context.pages()[0];

    // Collezionatori per eventi
    const requestFailed = [];
    const responseErrors = [];
    const pageErrors = [];
    const consoleErrors = [];

    // Listener sugli eventi della pagina, prima della navigazione
    page.on('requestfailed', req => {
      requestFailed.push({
        url: req.url(),
        method: req.method(),
        resourceType: req.resourceType(),
        error: req.failure() ? req.failure().errorText : 'unknown'
      });
    });

    page.on('response', resp => {
      if (resp.status() >= 400) {
        responseErrors.push({
          url: resp.url(),
          status: resp.status()
        });
      }
    });

    page.on('pageerror', err => {
      pageErrors.push(err.message);
    });

    page.on('console', msg => {
      if (msg.type() === 'error') {
        consoleErrors.push(msg.text());
      }
    });

    // Navigazione verso Prime Video
    let gotoError = null;
    try {
      // URL sovrascrivibile: URL=... per testare route diverse (storefront, detail, ...)
      await page.goto(process.env.URL || 'https://www.primevideo.com/', {
        waitUntil: 'domcontentloaded',
        timeout: 60000
      });
    } catch (e) {
      gotoError = e.message;
    }

    // Attesa per il caricamento completo della pagina
    await new Promise(r => setTimeout(r, 12000));

    // Raccolta informazioni DOM
    const dom = await page.evaluate(() => {
      const title = document.title;
      const href = location.href;
      const readyState = document.readyState;
      const bodyText = document.body ? document.body.innerText.substring(0, 600) : '';
      const elementCount = document.querySelectorAll('*').length;
      const bodyHeight = document.body ? document.body.scrollHeight : 0;
      const stealthAttr = document.documentElement.getAttribute('data-adoff-stealth');
      const imaType = typeof (window.google && window.google.ima);
      const hasVideo = !!document.querySelector('video');
      return {
        title,
        href,
        readyState,
        bodyText,
        elementCount,
        bodyHeight,
        stealthAttr,
        imaType,
        hasVideo
      };
    });

    // Creazione della directory di output, se necessario
    fs.mkdirSync(OUT_DIR, { recursive: true });

    // Screenshot
    const screenshotPath = path.join(OUT_DIR, `primevideo-${process.env.TAG || 'home'}-${extLabel}.png`);
    await page.screenshot({ path: screenshotPath });

    // Report JSON
    const report = {
      gotoError,
      requestFailed,
      responseErrors,
      pageErrors,
      consoleErrors,
      dom
    };
    const reportPath = path.join(OUT_DIR, `primevideo-${process.env.TAG || 'home'}-${extLabel}.json`);
    fs.writeFileSync(reportPath, JSON.stringify(report, null, 2));

    // Riepilogo compatto su console
    console.log(`[Summary] title="${dom.title}" readyState=${dom.readyState} elements=${dom.elementCount}`);
    console.log(`Richieste fallite: ${requestFailed.length}`);
    const first15 = requestFailed.slice(0, 15).map(r => {
      const url = r.url.length > 120 ? r.url.substring(0, 120) + '...' : r.url;
      return `${url} [${r.error}]`;
    });
    if (first15.length) {
      console.log('Prime 15 richieste fallite:');
      first15.forEach(line => console.log('  ' + line));
    } else {
      console.log('Nessuna richiesta fallita.');
    }
    const first10console = consoleErrors.slice(0, 10);
    if (first10console.length) {
      console.log('Primi 10 errori console:');
      first10console.forEach(line => console.log('  ' + line));
    } else {
      console.log('Nessun errore console.');
    }
  } finally {
    if (context) await context.close();
    process.exit(0);
  }
})().catch(err => {
  console.error('Errore grave:', err);
  process.exit(1);
});
