'use strict';
const { chromium } = require('playwright');
const path = require('path');
const fs = require('fs');

// Percorso dell'estensione e directory di output
const EXTENSION_PATH = path.resolve(__dirname, '../../app');
const OUT_DIR = path.resolve(__dirname, 'out');
fs.mkdirSync(OUT_DIR, { recursive: true });

// Opzioni di lancio del browser
const launchOptions = {
  headless: false,
  args: [
    '--no-first-run',
    '--disable-default-apps',
    '--mute-audio',
    `--disable-extensions-except=${EXTENSION_PATH}`,
    `--load-extension=${EXTENSION_PATH}`
  ],
  viewport: { width: 1366, height: 900 },
  ignoreDefaultArgs: ['--disable-extensions']
};

(async () => {
  let context;
  try {
    // Avvia un contesto persistente (così il service worker resta attivo)
    context = await chromium.launchPersistentContext('', launchOptions);
    console.log('Contesto avviato.');

    // 1. Ottieni il service worker dell'estensione
    let sw = (await context.serviceWorkers())[0];
    if (!sw) {
      console.log('Attendo il service worker dell\'estensione...');
      sw = await context.waitForEvent('serviceworker', { timeout: 30000 });
      console.log('Service worker rilevato.');
    } else {
      console.log('Service worker già attivo.');
    }

    // Helper per pause
    const sleep = ms => new Promise(r => setTimeout(r, ms));

    // 2. Poll fino a che non abbiamo le regole remote caricate
    const startMs = Date.now();
    let feedApplied = false;
    let feedCount = 0;
    let feedVer = null;
    let feedSync = false;
    let adoffRemoteRulesCount = 0;

    console.log('Verifico il caricamento delle regole remote (timeout 120s)...');
    while (true) {
      try {
        const storage = await sw.evaluate(() => new Promise(res => chrome.storage.local.get(
          ['adoffRemoteRulesCount', 'adoffRemoteRulesVer', 'adoffRemoteRulesSync'],
          res
        )));
        adoffRemoteRulesCount = storage.adoffRemoteRulesCount || 0;
        feedVer = storage.adoffRemoteRulesVer;
        feedSync = storage.adoffRemoteRulesSync;
        console.log(`[poll] adoffRemoteRulesCount=${adoffRemoteRulesCount}`);
      } catch (e) {
        console.error('[poll] errore evaluate:', e.message);
        adoffRemoteRulesCount = 0;
      }
      if (adoffRemoteRulesCount > 0) break;
      if (Date.now() - startMs > (Number(process.env.FEED_WAIT_MS) || 120000)) {
        console.warn('[poll] Timeout raggiunto senza regole remote.');
        break;
      }
      await sleep(3000);
    }
    feedApplied = adoffRemoteRulesCount > 0;
    feedCount = adoffRemoteRulesCount;
    const elapsedMs = Date.now() - startMs;
    console.log(`Regole remote applicate: ${feedApplied} (count=${feedCount}, ver=${feedVer}, elapsed=${elapsedMs}ms)`);

    // 3. Conta le regole dinamiche effettive
    let dynamicRuleCount = null;
    let dynamicRuleError = null;
    try {
      const dynResult = await sw.evaluate(() => new Promise(res => {
        chrome.declarativeNetRequest.getDynamicRules(rs => {
          const lastErr = chrome.runtime.lastError;
          res({ count: rs.length, error: lastErr ? lastErr.message : null });
        });
      }));
      dynamicRuleCount = dynResult.count;
      dynamicRuleError = dynResult.error;
      console.log(`[dynamicRules] count=${dynamicRuleCount}`);
    } catch (e) {
      console.error('[dynamicRules] errore evaluate:', e.message);
      dynamicRuleError = e.message;
    }

    // 4. Definisci i casi di test
    const testCases = [
      { url: 'https://www.primevideo.com/', type: 'main_frame' },
      { url: 'https://www.primevideo.com/storefront', type: 'main_frame' },
      { url: 'https://atv-ps-eu.primevideo.com/cdp/catalog/GetPlaybackResources', type: 'xmlhttprequest' },
      { url: 'https://m.media-amazon.com/images/I/test.jpg', type: 'image' },
      { url: 'https://d1v5ir2lpwr8os.cloudfront.net/app.js', type: 'script' },
      { url: 'https://fls-eu.amazon.com/1/batch/1/OP/', type: 'xmlhttprequest' },
      { url: 'https://unagi-eu.amazon.com/1/events/com.amazon.csm.csa.prod', type: 'ping' },
      { url: 'https://www.amazon.it/', type: 'main_frame' },
      // Controprova: presente SOLO nel feed remoto — se non matcha, il feed e inerte
      { url: 'https://0019x.com/x.js', type: 'script' },
      { url: 'https://popads.net/pop.js', type: 'script' }
    ];

    // Esegui testMatchOutcome per ogni caso
    const results = [];
    for (const c of testCases) {
      let caseResult;
      try {
        const res = await sw.evaluate(async (c) => {
          return new Promise((res) => {
            try {
              chrome.declarativeNetRequest.testMatchOutcome(
                { url: c.url, type: c.type, method: 'get' },
                (r) => {
                  const lastErr = chrome.runtime.lastError;
                  res({
                    matchedRules: (r && r.matchedRules) || null,
                    lastError: lastErr ? lastErr.message : null
                  });
                }
              );
            } catch (e) {
              res({ error: e.message });
            }
          });
        }, c);
        if (res.error) {
          caseResult = { url: c.url, type: c.type, error: res.error };
        } else {
          caseResult = { url: c.url, type: c.type, matchedRules: res.matchedRules };
        }
      } catch (e) {
        caseResult = { url: c.url, type: c.type, error: e.message };
      }
      results.push(caseResult);
    }

    // 5. Stampa tabella compatta
    const truncate = (str, max) => (str.length <= max ? str : str.slice(0, max - 3) + '...');
    console.log('\n=== Risultati testMatchOutcome ===');
    for (const r of results) {
      const urlTrunc = truncate(r.url, 80);
      if (r.error) {
        console.log(`ERR   ${r.type} ${urlTrunc} - ${r.error}`);
      } else if (r.matchedRules && r.matchedRules.length > 0) {
        const ruleDetails = r.matchedRules
          .map(rule => `id=${rule.ruleId},priority=${rule.priority}`)
          .join(' ');
        console.log(`BLOCCATO -> ${r.type} ${urlTrunc} matchedRules=${r.matchedRules.length} [${ruleDetails}]`);
      } else {
        console.log(`      OK  ${r.type} ${urlTrunc} -`);
      }
    }

    // 6. Salva report JSON
    const report = {
      feedApplied,
      feedCount,
      feedVer,
      feedSync,
      dynamicRuleCount,
      dynamicRuleError,
      elapsedMs,
      results
    };
    const reportPath = path.join(OUT_DIR, 'primevideo-dnr-match.json');
    fs.writeFileSync(reportPath, JSON.stringify(report, null, 2));
    console.log(`\nReport salvato in: ${reportPath}`);

  } catch (err) {
    console.error('Errore irreversibile:', err);
  } finally {
    if (context) await context.close();
    process.exit(0);
  }
})();
