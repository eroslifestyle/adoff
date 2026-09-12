/**
 * AdOff — Prova E2E in browser reale: il nuovo invariante "tutto gratuito" 
 * (v3.5.84+) significa che OGNI utente — senza licenza, con licenza valida,
 * con trial scaduto, o con licenza manomessa — ha TUTTO ATTIVO:
 *
 *   1. regole di redirect IMA (id 50001 e 50002) PRESENTI
 *   2. regole ad-ping allow (id 50010 e 50011) ASSENTI
 *   3. messaggio "richiediStealthFrame" risponde pro===true con nonce valido
 *   4. content script inietta data-adoff-stealth con nonce valido
 *
 * Il badge ora indica solo il sostegno volontario:
 *   - senza licenza valida      → "Tutto attivo"
 *   - monthly / annual          → "Sostenitore"
 *   - lifetime / founder        → "FOUNDER"
 *
 * Prima presidiava che gli abbonati non restassero senza difese;
 * ora presidia che NESSUNO resti fuori, dato che è tutto gratuito.
 * La regressione critica è il trial scaduto: il vecchio codice declassava
 * l'utente, ora NON deve farlo.
 *
 * Esecuzione (richiede xvfb — le estensioni MV3 non caricano in headless puro):
 *   xvfb-run -a node sviluppo/tests/test-plan-gates-e2e.js
 */
const { chromium } = require('playwright');
const path = require('path');
const os = require('os');
const fs = require('fs');
const crypto = require('crypto');
const http = require('http');

const EXT_PATH = path.resolve(__dirname, '..', '..', 'app');
const TEST_PAGE_HTML =
  '<!doctype html><html><head><title>t</title></head><body><div id="x">test</div></body></html>';
const STEALTH_POLL_TIMEOUT_MS = 3000;
const STEALTH_POLL_INTERVAL_MS = 100;
const SETUP_WAIT_MS = Number(process.env.GATE_SETUP_WAIT_MS ?? 1500);
const RELOAD_WAIT_MS = Number(process.env.GATE_RELOAD_WAIT_MS ?? 500);

let asserted = 0;
let failed = 0;

function check(label, condition, observed) {
  asserted++;
  if (condition) {
    console.log('  ok   ' + label + ' — ' + observed);
  } else {
    failed++;
    console.log('  FAIL ' + label + ' — ' + observed);
  }
}

// Stessa funzione di app/src/license-client.js (verbatim, righe 74-84).
function computeIntegrity(licData) {
  const raw = JSON.stringify(licData, licData && typeof licData === 'object' ? Object.keys(licData).sort() : null);
  let hash = 0x811c9dc5;
  for (let i = 0; i < raw.length; i++) {
    hash ^= raw.charCodeAt(i);
    hash = Math.imul(hash, 0x01000193);
  }
  hash = ((hash >>> 0) ^ 0x5f3759df).toString(36);
  return 'ao_' + hash;
}

// Badge atteso per ogni tipo di licenza
function expectedBadge(license) {
  if (!license) return 'Tutto attivo';
  const plan = license.plan || '';
  if (/founder|lifetime/i.test(plan)) return 'FOUNDER';
  if (plan === 'monthly' || plan === 'annual' || plan === 'premium_annual') return 'Sostenitore';
  return 'Tutto attivo';
}

// Casi: tutti TUTTO ATTIVO (pro=true, stealth attivo, regole IMA presenti, ad-ping assenti)
const CASES = [
  // A: nessuna licenza — a freddo (primo avvio)
  {
    name: 'A — nessuna licenza (a freddo)',
    license: null,
    trialExpired: false,
    tamperIntegrity: false,
  },
  // B: nessuna licenza — dopo reload (verifica che nulla si richiuda)
  {
    name: 'B — nessuna licenza (dopo reload)',
    license: null,
    trialExpired: false,
    tamperIntegrity: false,
    doReload: true,
  },
  // C: monthly
  {
    name: 'C — monthly',
    license: { valid: true, plan: 'monthly', rawKey: 'TESTKEY', lastValidated: Date.now() },
    trialExpired: false,
    tamperIntegrity: false,
  },
  // D: annual
  {
    name: 'D — annual',
    license: { valid: true, plan: 'annual', rawKey: 'TESTKEY', lastValidated: Date.now() },
    trialExpired: false,
    tamperIntegrity: false,
  },
  // E: lifetime
  {
    name: 'E — lifetime',
    license: { valid: true, plan: 'lifetime', rawKey: 'TESTKEY', lastValidated: Date.now() },
    trialExpired: false,
    tamperIntegrity: false,
  },
  // F: premium_annual_founder
  {
    name: 'F — premium_annual_founder',
    license: { valid: true, plan: 'premium_annual_founder', rawKey: 'TESTKEY', lastValidated: Date.now() },
    trialExpired: false,
    tamperIntegrity: false,
  },
  // G: trial scaduto — REGRESSIONE CRITICA: il vecchio codice declassava
  {
    name: 'G — trial scaduto',
    license: null,
    trialExpired: true,
    tamperIntegrity: false,
  },
  // H: licenza manomessa (integrity sbagliato) — declassato a free
  // NOTA: il codice attuale ritorna pro=false perché l'integrity non corrisponde.
  // Questo È il comportamento corretto: integrità significa che i dati non sono stati
  // manomessi, quindi se manomessi => trattato come free (tutto attivo comunque).
  {
    name: 'H — licenza manomessa',
    license: { valid: true, plan: 'monthly', rawKey: 'TAMPERED', lastValidated: Date.now() },
    trialExpired: false,
    tamperIntegrity: true,
    treatAsFree: true,  // integrity sbagliato = trattato come free
  },
];

async function setupStorage(page, kase, deviceId) {
  const integrity = kase.tamperIntegrity ? 'ao_TAMPERED' : computeIntegrity(kase.license);
  const storage = {
    adoffEnabled: true,
    adoffDeviceId: deviceId,
    adoffIntegrity: integrity,
  };
  if (kase.trialExpired) {
    storage.adoffTrialExpired = true;
    storage.adoffTrialEnd = 0;
  }
  if (kase.license) {
    storage.adoffLicense = kase.license;
  }

  await page.evaluate(
    (s) => {
      return new Promise((resolve) => {
        chrome.storage.local.clear(() => {
          chrome.storage.local.set(s, resolve);
        });
      });
    },
    storage
  );
}

async function runCase(kase, port) {
  console.log('\n=== Caso ' + kase.name + ' ===');
  const userDataDir = fs.mkdtempSync(path.join(os.tmpdir(), 'adoff-plangate-'));

  const context = await chromium.launchPersistentContext(userDataDir, {
    headless: false,
    args: [
      '--disable-extensions-except=' + EXT_PATH,
      '--load-extension=' + EXT_PATH,
      '--no-sandbox',
      '--disable-dev-shm-usage',
    ],
    viewport: { width: 1200, height: 800 },
  });

  try {
    // Blocca chiamate al backend reale
    await context.route('**://*.adoff.app/**', (r) => r.abort());
    await context.route('**/trial**', (r) => r.abort());

    let sw = context.serviceWorkers()[0];
    if (!sw) {
      sw = await context.waitForEvent('serviceworker', { timeout: 15000 });
    }
    const extId = sw.url().split('/')[2];

    const optionsPage = await context.newPage();
    await optionsPage.goto('chrome-extension://' + extId + '/src/options.html', { timeout: 15000 });

    const deviceId = crypto.randomUUID();
    await setupStorage(optionsPage, kase, deviceId);

    // Attesa per update asincrono delle regole
    await optionsPage.waitForTimeout(SETUP_WAIT_MS);
    await optionsPage.reload({ timeout: 15000 });
    await optionsPage.waitForTimeout(RELOAD_WAIT_MS);

    // Reload extra per il caso B
    if (kase.doReload) {
      await optionsPage.reload({ timeout: 15000 });
      await optionsPage.waitForTimeout(RELOAD_WAIT_MS);
    }

    // ---- A1: regole dinamiche declarativeNetRequest ----
    const dynamicRules = await sw.evaluate(() => chrome.declarativeNetRequest.getDynamicRules());
    const ruleIds = dynamicRules.map((r) => r.id);
    const has50010 = ruleIds.includes(50010);
    const has50011 = ruleIds.includes(50011);
    const has50001 = ruleIds.includes(50001);
    const has50002 = ruleIds.includes(50002);

    // NUOVO INVARIANTE: TUTTI hanno IMA presenti e ad-ping assenti (eccetto licenza manomessa)
    const isFree = kase.treatAsFree || (!kase.license);
    if (isFree) {
      // Free = tutto attivo (trial scaduto o nessuna licenza)
      check('A1 regola 50010 (ad-ping allow) assente', !has50010, 'presente=' + has50010);
      check('A1 regola 50011 (ad-ping allow) assente', !has50011, 'presente=' + has50011);
      check('A1 regola 50001 (redirect IMA) presente', has50001, 'presente=' + has50001);
      check('A1 regola 50002 (redirect IMA) presente', has50002, 'presente=' + has50002);
    } else {
      // Licensed = tutto attivo
      check('A1 regola 50010 (ad-ping allow) assente', !has50010, 'presente=' + has50010);
      check('A1 regola 50011 (ad-ping allow) assente', !has50011, 'presente=' + has50011);
      check('A1 regola 50001 (redirect IMA) presente', has50001, 'presente=' + has50001);
      check('A1 regola 50002 (redirect IMA) presente', has50002, 'presente=' + has50002);
    }

    // ---- A2: gate del nonce (messaggio "richiediStealthFrame") ----
    const nonceResp = await optionsPage.evaluate(() => chrome.runtime.sendMessage({ action: 'richiediStealthFrame' }));
    const noncePattern = /^ao_[0-9a-f]{8}$/;

    // NUOVO INVARIANTE: TUTTI hanno pro===true
    check('A2 pro===true', nonceResp.pro === true, JSON.stringify(nonceResp));
    check('A2 nonce valido', typeof nonceResp.nonce === 'string' && noncePattern.test(nonceResp.nonce), JSON.stringify(nonceResp));

    // ---- A3: badge licenza nella pagina options ----
    const badgeText = await optionsPage.evaluate(() => {
      const el = document.getElementById('headerLicenseBadge');
      return el ? el.textContent : null;
    });
    const expected = expectedBadge(kase.license);
    check(
      'A3 badge contiene "' + expected + '"',
      typeof badgeText === 'string' && badgeText.includes(expected),
      'badgeText="' + badgeText + '"'
    );

    // ---- A4: attivazione stealth nel content script (pagina http reale) ----
    const stealthPage = await context.newPage();
    await stealthPage.goto('http://127.0.0.1:' + port + '/', { waitUntil: 'load', timeout: 15000 });
    let stealthAttr = null;
    const stealthDeadline = Date.now() + STEALTH_POLL_TIMEOUT_MS;
    while (Date.now() < stealthDeadline) {
      stealthAttr = await stealthPage.evaluate(() =>
        document.documentElement.getAttribute('data-adoff-stealth')
      );
      if (stealthAttr !== null) break;
      await stealthPage.waitForTimeout(STEALTH_POLL_INTERVAL_MS);
    }
    // NUOVO INVARIANTE: TUTTI hanno stealth attivo
    check('A4 stealth attivato', typeof stealthAttr === 'string' && noncePattern.test(stealthAttr), 'data-adoff-stealth="' + stealthAttr + '"');
    await stealthPage.close();

    await optionsPage.close();
  } finally {
    await context.close();
    fs.rmSync(userDataDir, { recursive: true, force: true });
  }
}

(async () => {
  const server = http.createServer((_req, res) => {
    res.writeHead(200, { 'Content-Type': 'text/html' });
    res.end(TEST_PAGE_HTML);
  });
  await new Promise((resolve) => server.listen(0, '127.0.0.1', resolve));
  const port = server.address().port;

  try {
    for (const kase of CASES) {
      try {
        await runCase(kase, port);
      } catch (e) {
        failed++;
        asserted++;
        console.log('  FAIL ' + kase.name + ' — eccezione: ' + (e.stack || e.message));
      }
    }
  } finally {
    await new Promise((resolve) => server.close(resolve));
  }

  console.log('\n' + asserted + ' asserzioni, ' + failed + ' fallimenti');
  process.exit(failed === 0 ? 0 : 1);
})();
