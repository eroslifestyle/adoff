'use strict';
const { chromium } = require('playwright');
const path = require('path');
const fs = require('fs');

// Percorsi
const EXTENSION_PATH = path.resolve(__dirname, '../../app');
const OUT_DIR = path.resolve(__dirname, 'out');

// Modalità estensione o no
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
let navigations = [];
let newPages = [];

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

  context.on('page', (p) => {
    newPages.push(p.url());
  });

  page.on('framenavigated', (frame) => {
    if (frame === page.mainFrame()) {
      navigations.push(frame.url());
    }
  });

  // Navigazione verso Prime Video
  let gotoError = null;
  try {
    await page.goto('https://www.primevideo.com/', {
      waitUntil: 'domcontentloaded',
      timeout: 60000,
    });
  } catch (e) {
    gotoError = e.message;
  }

  // Attesa per il caricamento della pagina
  await page.waitForTimeout(6000);

  // Accettazione cookie
  let cookieClicked = false;
  const cookieSelectors = [
    'input[data-cel-widget="sp-cc-accept"]',
    '#sp-cc-accept',
  ];
  for (const sel of cookieSelectors) {
    try {
      await page.locator(sel).first().click({ timeout: 5000 });
      cookieClicked = true;
      break;
    } catch (_) {
      // continua con il prossimo selettore
    }
  }
  if (!cookieClicked) {
    try {
      await page.getByText('Accetta', { exact: true }).first().click({ timeout: 5000 });
      cookieClicked = true;
    } catch (_) {
      // nessun banner cookie rilevato
    }
  }

  // Attesa prima del click su Accedi
  await page.waitForTimeout(4000);

  // Click su link/bottone di accesso
  let signinClicked = false;
  try {
    await page.getByText(/Accedi/i).first().click({ timeout: 8000 });
    signinClicked = true;
  } catch (_) {
    // pulsante non trovato o non cliccabile
  }

  // Attesa per eventuali reindirizzamenti
  await page.waitForTimeout(10000);

  // Raccolta informazioni DOM
  const pageUrl = page.url();
  const title = await page.title();
  const readyState = await page.evaluate(() => document.readyState);
  const elementCount = await page.locator('*').count();
  const bodyText = (await page.locator('body').innerText()).substring(0, 400);
  // Rileva attributi personalizzati (es. inject dell'estensione)
  const stealthAttr = await page.evaluate(() => {
    const attrs = [...document.documentElement.attributes]
      .filter((a) => a.name.startsWith('data-'))
      .map((a) => a.name + '=' + a.value)
      .join(', ');
    return attrs || 'none';
  });
  const reachedSignin = pageUrl.includes('signin') || pageUrl.includes('ap/');

  // Creazione directory di output se non esiste
  fs.mkdirSync(OUT_DIR, { recursive: true });

  // Screenshot
  const screenshotPath = path.join(
    OUT_DIR,
    `primevideo-login-${extLabel}.png`
  );
  await page.screenshot({ path: screenshotPath });

  // Report JSON
  const report = {
    gotoError,
    cookieClicked,
    signinClicked,
    navigations,
    newPages,
    requestFailed,
    pageErrors,
    consoleErrors,
    dom: {
      url: pageUrl,
      title,
      readyState,
      elementCount,
      bodyText,
      stealthAttr,
      reachedSignin,
    },
  };
  const jsonPath = path.join(
    OUT_DIR,
    `primevideo-login-${extLabel}.json`
  );
  fs.writeFileSync(jsonPath, JSON.stringify(report, null, 2));

  // Riepilogo console
  console.log('=== Riepilogo ===');
  console.log('URL finale:', pageUrl);
  console.log('Raggiunto SignIn:', reachedSignin);
  console.log('Cookie accettato:', cookieClicked);
  console.log('SignIn cliccato:', signinClicked);
  console.log('Navigazioni:', navigations);
  console.log('Nuove pagine/tab:', newPages);
  console.log(
    'Richieste fallite (totale ' + requestFailed.length + '):',
    requestFailed.slice(0, 10)
  );
  console.log(
    'Errori console (totale ' + consoleErrors.length + '):',
    consoleErrors.slice(0, 8)
  );

  // Chiusura contesto e uscita
  await context.close();
  process.exit(0);
})().catch((err) => {
  console.error('Errore non gestito:', err);
  process.exit(1);
});
