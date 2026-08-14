/**
 * AdOff — Prova E2E in browser reale: il fix del riconoscimento piano
 * (adoffPlanTier unificato, v3.5.71/3.5.76/3.5.77) sblocca davvero il gate
 * Pro/Premium per i piani "premium_annual" e "annual", e lo tiene chiuso
 * per un utente Free. Nessun mock: estensione reale caricata in Chromium,
 * storage reale, declarativeNetRequest reale, messaggio runtime reale.
 *
 * Esecuzione (richiede xvfb — le estensioni MV3 non caricano in headless puro):
 *   NODE_PATH="$(pwd)/sviluppo/reviews/node_modules" xvfb-run -a node sviluppo/tests/test-plan-gates-e2e.js
 */
const { chromium } = require("playwright");
const path = require("path");
const os = require("os");
const fs = require("fs");
const crypto = require("crypto");
const http = require("http");

const EXT_PATH = path.resolve(__dirname, "..", "..", "app");
const TEST_PAGE_HTML =
  "<!doctype html><html><head><title>t</title></head><body><div id=\"x\">test</div></body></html>";
const STEALTH_POLL_TIMEOUT_MS = 3000;
const STEALTH_POLL_INTERVAL_MS = 100;

let asserted = 0;
let failed = 0;

function check(label, condition, observed) {
  asserted++;
  if (condition) {
    console.log(`  ok   ${label} — ${observed}`);
  } else {
    failed++;
    console.log(`  FAIL ${label} — ${observed}`);
  }
}

// Stessa funzione di app/src/license-client.js (verbatim, righe 74-84).
function computeIntegrity(licData) {
  const raw = JSON.stringify(licData, licData && typeof licData === "object" ? Object.keys(licData).sort() : null);
  let hash = 0x811c9dc5;
  for (let i = 0; i < raw.length; i++) {
    hash ^= raw.charCodeAt(i);
    hash = Math.imul(hash, 0x01000193);
  }
  hash = ((hash >>> 0) ^ 0x5f3759df).toString(36);
  return "ao_" + hash;
}

const CASES = [
  {
    name: "A — premium_annual",
    license: { valid: true, plan: "premium_annual", rawKey: "TESTKEY", lastValidated: Date.now() },
    gateOpen: true,
    badgeContains: "PREMIUM",
  },
  {
    name: "B — annual",
    license: { valid: true, plan: "annual", rawKey: "TESTKEY", lastValidated: Date.now() },
    gateOpen: true,
    badgeContains: "PRO",
  },
  {
    name: "C — free",
    license: { valid: false, plan: "free" },
    gateOpen: false,
    badgeContains: "FREE",
  },
];

async function runCase(kase, port) {
  console.log(`\n=== Caso ${kase.name} ===`);
  const userDataDir = fs.mkdtempSync(path.join(os.tmpdir(), "adoff-plangate-"));

  const context = await chromium.launchPersistentContext(userDataDir, {
    headless: false,
    args: [
      `--disable-extensions-except=${EXT_PATH}`,
      `--load-extension=${EXT_PATH}`,
      "--no-sandbox",
      "--disable-dev-shm-usage",
    ],
    viewport: { width: 1200, height: 800 },
  });

  try {
    // Blocca ogni chiamata al backend reale: senza questo il trial o la
    // ri-validazione online potrebbero sovrascrivere lo stato che iniettiamo.
    await context.route("**://*.adoff.app/**", (r) => r.abort());
    await context.route("**/trial**", (r) => r.abort());

    let sw = context.serviceWorkers()[0];
    if (!sw) {
      sw = await context.waitForEvent("serviceworker", { timeout: 15000 });
    }
    const extId = sw.url().split("/")[2];

    const optionsPage = await context.newPage();
    await optionsPage.goto(`chrome-extension://${extId}/src/options.html`, { timeout: 15000 });

    const deviceId = crypto.randomUUID();
    const integrity = computeIntegrity(kase.license);

    await optionsPage.evaluate(
      ({ license, integrity, deviceId }) => {
        return new Promise((resolve) => {
          chrome.storage.local.remove(["adoffTrialToken"], () => {
            chrome.storage.local.set(
              {
                adoffLicense: license,
                adoffIntegrity: integrity,
                adoffEnabled: true,
                adoffTrialExpired: true,
                adoffTrialEnd: 0,
                adoffDeviceId: deviceId,
              },
              resolve
            );
          });
        });
      },
      { license: kase.license, integrity, deviceId }
    );

    // Il listener onChanged in background.js triggera updateImaRules() già ora;
    // attendiamo che l'update asincrono delle regole dinamiche sia completato.
    await optionsPage.waitForTimeout(1500);
    await optionsPage.reload({ timeout: 15000 });
    await optionsPage.waitForTimeout(500);

    // ---- A1: regole dinamiche declarativeNetRequest ----
    const dynamicRules = await sw.evaluate(() => chrome.declarativeNetRequest.getDynamicRules());
    const ruleIds = dynamicRules.map((r) => r.id);
    const has50010 = ruleIds.includes(50010);
    const has50011 = ruleIds.includes(50011);
    const has50001 = ruleIds.includes(50001);
    const has50002 = ruleIds.includes(50002);

    if (kase.gateOpen) {
      check("A1 regola 50010 (ad-ping allow) assente", !has50010, `presente=${has50010}`);
      check("A1 regola 50011 (ad-ping allow) assente", !has50011, `presente=${has50011}`);
      check("A1 regola 50001 (redirect IMA) presente", has50001, `presente=${has50001}`);
      check("A1 regola 50002 (redirect IMA) presente", has50002, `presente=${has50002}`);
    } else {
      check("A1 regola 50010 (ad-ping allow) presente", has50010, `presente=${has50010}`);
      check("A1 regola 50011 (ad-ping allow) presente", has50011, `presente=${has50011}`);
      check("A1 regola 50001 (redirect IMA) assente", !has50001, `presente=${has50001}`);
      check("A1 regola 50002 (redirect IMA) assente", !has50002, `presente=${has50002}`);
    }

    // ---- A2: gate del nonce (messaggio "richiediStealthFrame") ----
    // NOTA TECNICA: chrome.runtime.sendMessage inviato DAL service worker
    // VERSO se' stesso non stabilisce mai la connessione (limite Chrome MV3,
    // verificato empiricamente: "Could not establish connection. Receiving
    // end does not exist." anche col listener correttamente registrato).
    // Il messaggio va quindi inviato da un'altra pagina della stessa estensione
    // (qui la pagina options gia' aperta) — il listener che risponde resta
    // comunque quello del service worker in background.js, che e' cio' che
    // il test deve verificare.
    const nonceResp = await optionsPage.evaluate(() => chrome.runtime.sendMessage({ action: "richiediStealthFrame" }));
    const noncePattern = /^ao_[0-9a-f]{8}$/;
    if (kase.gateOpen) {
      check("A2 pro===true", nonceResp.pro === true, JSON.stringify(nonceResp));
      check(
        "A2 nonce formato valido",
        typeof nonceResp.nonce === "string" && noncePattern.test(nonceResp.nonce),
        JSON.stringify(nonceResp)
      );
    } else {
      check("A2 pro===false", nonceResp.pro === false, JSON.stringify(nonceResp));
    }

    // ---- A3: badge licenza nella pagina options ----
    const badgeText = await optionsPage.evaluate(() => {
      const el = document.getElementById("headerLicenseBadge");
      return el ? el.textContent : null;
    });
    check(
      `A3 badge contiene "${kase.badgeContains}"`,
      typeof badgeText === "string" && badgeText.includes(kase.badgeContains),
      `badgeText="${badgeText}"`
    );

    // ---- A4: attivazione stealth nel content script (pagina http reale) ----
    const stealthPage = await context.newPage();
    await stealthPage.goto(`http://127.0.0.1:${port}/`, { waitUntil: "load", timeout: 15000 });
    let stealthAttr = null;
    const stealthDeadline = Date.now() + STEALTH_POLL_TIMEOUT_MS;
    while (Date.now() < stealthDeadline) {
      stealthAttr = await stealthPage.evaluate(() =>
        document.documentElement.getAttribute("data-adoff-stealth")
      );
      if (stealthAttr !== null) break;
      await stealthPage.waitForTimeout(STEALTH_POLL_INTERVAL_MS);
    }
    if (kase.gateOpen) {
      check(
        "A4 stealth attivato (data-adoff-stealth con nonce valido)",
        typeof stealthAttr === "string" && noncePattern.test(stealthAttr),
        `data-adoff-stealth="${stealthAttr}"`
      );
    } else {
      check(
        "A4 stealth NON attivato (nessun data-adoff-stealth)",
        stealthAttr === null,
        `data-adoff-stealth="${stealthAttr}"`
      );
    }
    await stealthPage.close();

    await optionsPage.close();
  } finally {
    await context.close();
    fs.rmSync(userDataDir, { recursive: true, force: true });
  }
}

(async () => {
  const server = http.createServer((_req, res) => {
    res.writeHead(200, { "Content-Type": "text/html" });
    res.end(TEST_PAGE_HTML);
  });
  await new Promise((resolve) => server.listen(0, "127.0.0.1", resolve));
  const port = server.address().port;

  try {
    for (const kase of CASES) {
      try {
        await runCase(kase, port);
      } catch (e) {
        failed++;
        asserted++;
        console.log(`  FAIL ${kase.name} — eccezione: ${e.stack || e.message}`);
      }
    }
  } finally {
    await new Promise((resolve) => server.close(resolve));
  }

  console.log(`\n${asserted} asserzioni, ${failed} fallimenti`);
  process.exit(failed === 0 ? 0 : 1);
})();
