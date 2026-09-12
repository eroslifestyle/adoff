'use strict';
const { chromium } = require('playwright');
const path = require('path');
const fs = require('fs');

// Percorsi
const EXTENSION_PATH = path.resolve(__dirname, '../../app');
const OUT_DIR = path.resolve(__dirname, 'out');

// Modalita estensione o no
const NOEXT = process.env.NOEXT === '1';
const extLabel = NOEXT ? 'noext' : 'ext';
const extArgs = NOEXT
  ? []
  : [
      '--disable-extensions-except=' + EXTENSION_PATH,
      '--load-extension=' + EXTENSION_PATH,
    ];

// Opzioni di lancio del browser
const launchOptions = {
  headless: false,
  args: [
    '--no-first-run',
    '--disable-default-apps',
    '--mute-audio',
    ...extArgs,
  ],
  viewport: { width: 1366, height: 900 },
  ignoreDefaultArgs: ['--disable-extensions'],
};

// Raccolta eventi
let requestFailed = [];
let pageErrors = [];
let consoleErrors = [];

(async () => {
  // Lancio contesto persistente (cartella temporanea)
  const context = await chromium.launchPersistentContext('', launchOptions);
  await new Promise(r => setTimeout(r, 2500));
  const page = context.pages()[0];

  // Impostazione listener prima della navigazione
  page.on('requestfailed', (req) => {
    requestFailed.push({
      url: req.url(),
      resourceType: req.resourceType(),
      error: req.failure().errorText,
    });
  });

  page.on('pageerror', (err) => {
    pageErrors.push(err.message);
  });

  page.on('console', (msg) => {
    if (msg.type() === 'error') {
      consoleErrors.push(msg.text());
    }
  });

  // Navigazione verso la pagina recensioni del Chrome Web Store
  const targetUrl = 'https://chromewebstore.google.com/detail/adoff/fcjfpfhdcpbjmihiikbblcokmjnhedhp/reviews?hl=it';
  let gotoError = null;
  try {
    await page.goto(targetUrl, {
      waitUntil: 'domcontentloaded',
      timeout: 60000,
    });
  } catch (e) {
    gotoError = e.message;
  }

  // Se compare la pagina di consenso Google (inline o redirect), accetta tutto
  let consentFailed = null;
  const onStorePage = page.url().includes('chromewebstore.google.com');
  try {
    await page.getByRole('button', { name: /Accetta tutto|Accept all|Continua|Continue/i }).first().click({ timeout: 5000 });
    await new Promise(r => setTimeout(r, 3000));
  } catch (_) {
    // Nessun consenso da accettare, proseguo
  }

  // Dopo essere tornati sulla pagina store, attendi il primo blocco recensione
  let reviewsWaitTimeout = false;
  if (page.url().includes('chromewebstore.google.com')) {
    try {
      await page.waitForFunction(
        () => {
          const els = Array.from(document.querySelectorAll('[alt],[aria-label]'));
          return els.some((el) => /su 5 stelle/i.test(el.getAttribute('alt') || el.getAttribute('aria-label') || ''));
        },
        { timeout: 30000 }
      );
    } catch (_) {
      reviewsWaitTimeout = true;
    }
  }

  // Attesa generosa per il caricamento completo della pagina
  try {
    await page.waitForLoadState('networkidle', { timeout: 30000 });
  } catch (_) {
    // networkidle potrebbe non completarsi mai su pagine dinamiche
  }
  await page.waitForTimeout(3000);

  // Raccolta informazioni DOM
  const pageTitle = await page.title();
  let h1Text = null;
  try {
    h1Text = await page.locator('h1').first().innerText({ timeout: 3000 });
  } catch (_) {
    h1Text = null;
  }

  // Conta i blocchi recensione: elementi con alt o aria-label che matcha "su 5 stelle"
  const reviewBlocks = await page.evaluate(() => {
    const els = Array.from(document.querySelectorAll('[alt],[aria-label]'));
    return els.filter((el) => /su 5 stelle/i.test(el.getAttribute('alt') || el.getAttribute('aria-label') || '')).length;
  });

  // Primi 5 h3 della pagina (per verifica visiva)
  const reviewAuthors = await page.evaluate(() => {
    return Array.from(document.querySelectorAll('h3')).slice(0, 5).map(h => h.textContent.trim());
  });

  // Testo del contatore valutazioni (elemento che contiene "valutazioni")
  let ratingsText = null;
  try {
    ratingsText = await page.getByText(/valutazioni/i).first().innerText({ timeout: 3000 });
  } catch (_) {
    ratingsText = null;
  }

  // Elementi con display:none calcolata (confronto ext vs noext)
  const hiddenCount = await page.evaluate(() => {
    let count = 0;
    document.querySelectorAll('*').forEach((el) => {
      if (window.getComputedStyle(el).display === 'none') count++;
    });
    return count;
  });

  // Elementi con attributi data-adoff* o classi contenenti "adoff"
  const adoffInjections = await page.evaluate(() => {
    const found = [];
    document.querySelectorAll('*').forEach((el) => {
      // attributi data-adoff
      Array.from(el.attributes).forEach((attr) => {
        if (attr.name.startsWith('data-adoff')) {
          found.push({ tag: el.tagName.toLowerCase(), attr: attr.name, value: attr.value.substring(0, 80) });
        }
      });
      // classi con "adoff"
      if (/\badoff\b/i.test(el.className)) {
        found.push({ tag: el.tagName.toLowerCase(), cls: el.className.substring(0, 80) });
      }
    });
    return found;
  });

  // Stato di window.google (per capire se stealth.js ha alterato il namespace)
  const googleState = await page.evaluate(() => {
    if (!window.google) {
      return { exists: false };
    }
    const keys = Object.keys(window.google).slice(0, 15);
    return { exists: true, type: typeof window.google, keys };
  });

  // Creazione directory di output se non esiste
  fs.mkdirSync(OUT_DIR, { recursive: true });

  // Screenshot full page
  const screenshotPath = path.join(OUT_DIR, 'cws-reviews-' + extLabel + '.png');
  await page.screenshot({ fullPage: true, path: screenshotPath });

  // Report JSON compatto
  const digest = {
    url: page.url(),
    title: pageTitle,
    h1: h1Text,
    reviewBlocks,
    reviewAuthors,
    ratingsText,
    hiddenElements: hiddenCount,
    adoffInjections: adoffInjections.slice(0, 50),
    google: googleState,
    gotoError,
    onStorePage: page.url().includes('chromewebstore.google.com'),
    consentFailed,
    reviewsWaitTimeout,
    requestFailed: requestFailed.slice(0, 15),
    pageErrors: pageErrors.slice(0, 15),
    consoleErrors: consoleErrors.slice(0, 15),
  };

  // Stampa unico oggetto JSON dopo la riga marker
  console.log('=== DIGEST ===');
  console.log(JSON.stringify(digest));

  // Chiusura contesto
  await context.close();
  process.exit(0);
})().catch((err) => {
  console.error('Errore non gestito:', err.message);
  process.exit(1);
});
