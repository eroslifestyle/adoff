const { chromium } = require('playwright');
const fs = require('fs');
const path = require('path');
const crypto = require('crypto');

const EXT_DIR = process.argv[2] || 'app';
const TMP_EXT_DIR = '/tmp/adoff-gate-test-ext';

function sleep(ms) {
  return new Promise(resolve => setTimeout(resolve, ms));
}

async function main() {
  const failures = [];

  // 1. Genera coppia di chiavi ECDSA P-256
  const keyPair = await crypto.webcrypto.subtle.generateKey(
    { name: 'ECDSA', namedCurve: 'P-256' },
    true,
    ['sign', 'verify']
  );

  const publicJwk = await crypto.webcrypto.subtle.exportKey('jwk', keyPair.publicKey);

  // 2. Copia ricorsivamente l'estensione
  if (fs.existsSync(TMP_EXT_DIR)) {
    fs.rmSync(TMP_EXT_DIR, { recursive: true, force: true });
  }
  fs.cpSync(EXT_DIR, TMP_EXT_DIR, { recursive: true });

  // Chrome rifiuta le cartelle che iniziano con "_" (riservate): se l'originale
  // ha un _metadata lasciato da un caricamento precedente, la copia non parte.
  fs.rmSync(path.join(TMP_EXT_DIR, '_metadata'), { recursive: true, force: true });

  // 3. Sostituisci x e y in background.js
  const bgFilePath = path.join(TMP_EXT_DIR, 'src', 'background.js');
  let bgContent = fs.readFileSync(bgFilePath, 'utf8');

  const regexpX = /(\n\s*x:\s*)"[^"]*"/;
  const regexpY = /(\n\s*y:\s*)"[^"]*"/;

  const newContent = bgContent
    .replace(regexpX, `$1"${publicJwk.x}"`)
    .replace(regexpY, `$1"${publicJwk.y}"`);

  if (!newContent.includes(`x: "${publicJwk.x}"`) || !newContent.includes(`y: "${publicJwk.y}"`)) {
    console.error('ERRORE: Sostituzione chiavi fallita');
    process.exit(1);
  }

  fs.writeFileSync(bgFilePath, newContent, 'utf8');

  // Verifica post-scrittura
  const verifyContent = fs.readFileSync(bgFilePath, 'utf8');
  if (!verifyContent.includes(`x: "${publicJwk.x}"`) || !verifyContent.includes(`y: "${publicJwk.y}"`)) {
    console.error('ERRORE: Verifica chiavi fallita dopo scrittura');
    process.exit(1);
  }

  // 4. makeToken
  function makeToken(payloadObj) {
    const payloadB64 = Buffer.from(JSON.stringify(payloadObj)).toString('base64url');

    return crypto.webcrypto.subtle.sign(
      { name: 'ECDSA', hash: 'SHA-256' },
      keyPair.privateKey,
      new TextEncoder().encode(payloadB64)
    ).then(signature => {
      const sigB64 = Buffer.from(signature).toString('base64url');
      return payloadB64 + '.' + sigB64;
    });
  }

  // 5. Launch PersistentContext
  const tmpCtxDir = fs.mkdtempSync(path.join('/tmp', 'adoff-ctx-'));
  const context = await chromium.launchPersistentContext(tmpCtxDir, {
    headless: false,
    args: [
      '--disable-extensions-except=' + TMP_EXT_DIR,
      '--load-extension=' + TMP_EXT_DIR
    ]
  });

  // Attendi service worker
  const serviceWorkers = context.serviceWorkers();
  let sw = serviceWorkers.length > 0 ? serviceWorkers[0] : null;

  if (!sw) {
    sw = await context.waitForEvent('serviceworker', { timeout: 10000 });
  }

  const extensionId = new URL(sw.url()).hostname;
  console.error('Extension ID:', extensionId);

  // All'installazione il background scrive i suoi default: partire prima
  // significa misurare uno stato che sta ancora cambiando.
  await sleep(2000);

  // 6. setState
  async function setState(storageObject) {
    await sw.evaluate(async (obj) => {
      await new Promise((resolve) => {
        chrome.storage.local.set(obj, resolve);
      });
    }, storageObject);
  }

  // 7. readState
  async function readState() {
    return await sw.evaluate(async () => {
      const badgeText = await chrome.action.getBadgeText({});
      const rulesets = await chrome.declarativeNetRequest.getEnabledRulesets();
      const storage = await new Promise(resolve => {
        chrome.storage.local.get('adoffFreeExpired', resolve);
      });
      return {
        badgeText,
        rulesets,
        adoffFreeExpired: storage.adoffFreeExpired
      };
    });
  }

  // Helper per eseguire scenario
  async function runScenario(name, deviceId, tokenPayload, adoffEnabledInitial, adoffEnabledFinal, expected) {
    const now = Date.now();

    // Prepara token
    const tokenData = { ...tokenPayload, deviceId, iat: now };
    const token = await makeToken(tokenData);

    // Imposta stato iniziale con adoffEnabled false
    await setState({
      adoffFreeToken: token,
      adoffDeviceId: deviceId,
      adoffEnabled: false,
      adoffFreeExpired: false
    });

    await sleep(1200);

    // Cambia adoffEnabled a true per far scattare il gate
    await setState({ adoffEnabled: adoffEnabledFinal });
    await sleep(1200);

    const state = await readState();

    const result = {
      scenario: name,
      expected: expected,
      actual: {
        adoffFreeExpired: state.adoffFreeExpired,
        hasAdblockRuleset: state.rulesets.includes('adblock_rules'),
        badgeText: state.badgeText
      }
    };

    console.log(JSON.stringify(result));

    // Verifica
    const checks = [
      { cond: state.adoffFreeExpired === expected.adoffFreeExpired, msg: 'adoffFreeExpired' },
      { cond: state.rulesets.includes('adblock_rules') === expected.hasAdblockRuleset, msg: 'hasAdblockRuleset' },
      { cond: expected.badgeNotGate
          ? (state.badgeText !== '!' && !/^\d+g$/.test(state.badgeText))
          : state.badgeText === expected.badgeText, msg: 'badgeText' }
    ];

    for (const check of checks) {
      if (!check.cond) {
        failures.push(`${name}: ${check.msg}`);
        break;
      }
    }
  }

  // SCENARIO A - Scaduto
  const deviceIdFixed = '11111111-1111-4111-8111-111111111111';
  const nowA = Date.now();
  await runScenario(
    'A',
    deviceIdFixed,
    {
      kind: 'free',
      gateStart: nowA - 40 * 86400000,
      grantEnd: nowA - 10 * 86400000,
      registered: false,
      v: 1
    },
    false,
    true,
    {
      adoffFreeExpired: true,
      hasAdblockRuleset: false,
      badgeText: '!'
    }
  );

  // SCENARIO B - In scadenza
  const nowB = Date.now();
  const grantEndB = nowB + 3 * 86400000;
  await runScenario(
    'B',
    deviceIdFixed,
    {
      kind: 'free',
      gateStart: nowB - 86400000,
      grantEnd: grantEndB,
      registered: false,
      v: 1
    },
    false,
    true,
    {
      adoffFreeExpired: false,
      hasAdblockRuleset: true,
      badgeText: '3g'
    }
  );

  // SCENARIO C - Registrato
  const nowC = Date.now();
  const grantEndC = nowC + 300 * 86400000;
  await runScenario(
    'C',
    deviceIdFixed,
    {
      kind: 'free',
      gateStart: nowC - 86400000,
      grantEnd: grantEndC,
      registered: true,
      v: 1
    },
    false,
    true,
    {
      adoffFreeExpired: false,
      hasAdblockRuleset: true,
      badgeNotGate: true
    }
  );

  await context.close();

  // Pulizia
  fs.rmSync(tmpCtxDir, { recursive: true, force: true });

  // Risultato finale
  if (failures.length === 0) {
    console.log('PASS');
    process.exit(0);
  } else {
    console.log('FAIL');
    console.error('Falliti:', failures);
    process.exit(1);
  }
}

main().catch(err => {
  console.error('ERRORE:', err.message);
  process.exit(1);
});
