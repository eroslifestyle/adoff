'use strict';

const { chromium } = require('playwright');
const path = require('path');
const fs = require('fs');

// Percorsi
const EXTENSION_PATH = path.resolve(__dirname, '../../app');
const OUT_DIR = path.resolve(__dirname, 'out');

// Crea cartella output se non esiste
fs.mkdirSync(OUT_DIR, { recursive: true });

// Configurazione launch
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
    // Lancia contesto persistente con estensione
    context = await chromium.launchPersistentContext('', launchOptions);

    // Ottieni service worker
    let sw = context.serviceWorkers()[0];
    if (!sw) {
      console.log('Aspetto service worker...');
      sw = await context.waitForEvent('serviceworker', { timeout: 30000 });
    }
    console.log('Service worker trovato:', sw.url());

    // Risultati di tutte le fasi
    const risultati = {};

    // ========== FASE 1: Download feed ==========
    console.log('\n--- FASE 1: Download feed ---');
    try {
      const fase1 = await sw.evaluate(async () => {
        const t0 = Date.now();
        try {
          const res = await fetch('https://adoff.app/rules-feed.json?t=' + Date.now(), { cache: 'no-store' });
          const data = await res.json();
          return {
            ms: Date.now() - t0,
            ok: res.ok,
            status: res.status,
            count: Array.isArray(data.rules) ? data.rules.length : -1,
            version: data.version || 'sconosciuta'
          };
        } catch (e) {
          return { ms: Date.now() - t0, ok: false, error: e.message };
        }
      });

      console.log('Feed scaricato in', fase1.ms, 'ms');
      console.log('Status:', fase1.status || (fase1.ok ? 200 : 'errore'));
      console.log('Regole nel feed:', fase1.count);
      console.log('Versione feed:', fase1.version);
      risultati.fase1 = fase1;
    } catch (e) {
      console.error('Errore FASE 1:', e.message);
      risultati.fase1 = { error: e.message };
    }

    // ========== FASE 2: Applica regole a blocchi ==========
    console.log('\n--- FASE 2: Applicazione regole dinamiche ---');
    try {
      const fase2 = await sw.evaluate(async () => {
        // Riscarica feed
        const feedRes = await fetch('https://adoff.app/rules-feed.json?t=' + Date.now(), { cache: 'no-store' });
        const feedData = await feedRes.json();

        if (!Array.isArray(feedData.rules)) {
          return { error: 'Feed non contiene array di regole' };
        }

        const regoleOriginali = feedData.rules;
        const regoleSanitizzate = [];

        // Sanitizza ogni regola
        for (const rule of regoleOriginali) {
          // Considera solo block o allow
          if (rule.action && (rule.action.type === 'block' || rule.action.type === 'allow')) {
            const regola = {
              id: regoleSanitizzate.length + 60000, // ID progressivo da 60000
              priority: 1,
              action: { type: rule.action.type }
            };

            // Ricostruisci condition con solo campi permessi
            if (rule.action.type === 'block' || rule.action.type === 'allow') {
              const condition = {};

              if (rule.condition) {
                if (rule.condition.urlFilter) condition.urlFilter = rule.condition.urlFilter;
                if (rule.condition.regexFilter) condition.regexFilter = rule.condition.regexFilter;
                if (rule.condition.requestDomains) condition.requestDomains = rule.condition.requestDomains;
                if (rule.condition.initiatorDomains) condition.initiatorDomains = rule.condition.initiatorDomains;
                if (rule.condition.resourceTypes) condition.resourceTypes = rule.condition.resourceTypes;
                if (rule.condition.priority) condition.priority = rule.condition.priority;
              }

              // Priorita' 1-100
              if (condition.priority) {
                regola.priority = Math.min(100, Math.max(1, parseInt(condition.priority) || 1));
                delete condition.priority;
              } else {
                regola.priority = 1;
              }

              regola.condition = condition;
            }

            regoleSanitizzate.push(regola);
          }
        }

        // Applica in chunk da 4000
        const CHUNK_SIZE = 4000;
        let applicati = 0;
        let chunkFallito = -1;
        let errore = null;
        const chunkTotali = Math.ceil(regoleSanitizzate.length / CHUNK_SIZE);

        for (let i = 0; i < chunkTotali; i++) {
          const start = i * CHUNK_SIZE;
          const end = Math.min(start + CHUNK_SIZE, regoleSanitizzate.length);
          const chunk = regoleSanitizzate.slice(start, end);

          try {
            const result = await new Promise((resolve, reject) => {
              chrome.declarativeNetRequest.updateDynamicRules(
                { addRules: chunk },
                (extError) => {
                  if (extError) {
                    reject(new Error(extError.message || extError));
                  } else {
                    resolve({ aggiunti: chunk.length });
                  }
                }
              );
            });
            applicati += result.aggiunti;
            console.log(`Chunk ${i + 1}/${chunkTotali}: ${result.aggiunti} regole applicate (totale: ${applicati})`);
          } catch (chunkErr) {
            chunkFallito = i;
            errore = chunkErr.message;
            console.error(`Chunk ${i + 1} fallito:`, errore);
            break;
          }
        }

        // Ottieni conteggio finale
        const finalRules = await new Promise((resolve) => {
          chrome.declarativeNetRequest.getDynamicRules((rules) => {
            resolve(rules.length);
          });
        });

        return {
          totaliOriginali: regoleOriginali.length,
          sanitizzate: regoleSanitizzate.length,
          applicati,
          chunkFallito,
          errore,
          finaleDinamiche: finalRules
        };
      });

      console.log('Regole totali originali:', fase2.totaliOriginali);
      console.log('Regole sanitizzate:', fase2.sanitizzate);
      console.log('Regole applicate:', fase2.applicati);
      if (fase2.chunkFallito >= 0) {
        console.log('Chunk fallito:', fase2.chunkFallito);
        console.log('Errore:', fase2.errore);
      }
      console.log('Regole dinamiche finali:', fase2.finaleDinamiche);
      risultati.fase2 = fase2;
    } catch (e) {
      console.error('Errore FASE 2:', e.message);
      risultati.fase2 = { error: e.message };
    }

    // ========== FASE 3: Test matchOutcome ==========
    console.log('\n--- FASE 3: Test matchOutcome ---');
    const testUrls = [
      { url: 'https://www.primevideo.com/', type: 'main_frame' },
      { url: 'https://www.primevideo.com/storefront', type: 'main_frame' },
      { url: 'https://www.primevideo.com/detail/ABC123', type: 'main_frame' },
      { url: 'https://atv-ps-eu.primevideo.com/cdp/catalog/GetPlaybackResources', type: 'xmlhttprequest' },
      { url: 'https://m.media-amazon.com/images/I/test.jpg', type: 'image' },
      { url: 'https://d1v5ir2lpwr8os.cloudfront.net/app.js', type: 'script' },
      { url: 'https://fls-eu.amazon.com/1/batch/1/OP/', type: 'xmlhttprequest' },
      { url: 'https://unagi-eu.amazon.com/1/events/com.amazon.csm.csa.prod', type: 'ping' },
      { url: 'https://www.amazon.it/', type: 'main_frame' }
    ];

    try {
      const fase3 = await sw.evaluate(async (tests) => {
        const risultati = [];
        for (const test of tests) {
          try {
            const match = await chrome.declarativeNetRequest.testMatchOutcome(
              { url: test.url, type: test.type },
              { method: 'get' }
            );
            risultati.push({
              url: test.url,
              type: test.type,
              matchedRules: match.matchedRules || []
            });
          } catch (e) {
            risultati.push({
              url: test.url,
              type: test.type,
              matchedRules: [],
              error: e.message
            });
          }
        }
        return risultati;
      }, testUrls);

      // Stampa con evidenziazione BLOCCATO
      fase3.forEach((r) => {
        const bloccato = r.matchedRules && r.matchedRules.length > 0;
        const prefix = bloccato ? 'BLOCCATO -> ' : '';
        const rulesInfo = r.matchedRules.map(mr => `id:${mr.ruleId}`).join(', ') || 'nessuna';
        console.log(`${prefix}${r.url} [${r.type}] -> regole: ${rulesInfo}`);
      });

      risultati.fase3 = fase3;
    } catch (e) {
      console.error('Errore FASE 3:', e.message);
      risultati.fase3 = { error: e.message };
    }

    // ========== FASE 4: Navigazione reale ==========
    console.log('\n--- FASE 4: Navigazione Prime Video ---');
    try {
      const pages = context.pages();
      const page = pages.length > 0 ? pages[0] : await context.newPage();

      // Listener per richieste fallite e errori console
      const failedRequests = [];
      const consoleErrors = [];

      page.on('requestfailed', (req) => {
        failedRequests.push({ url: req.url(), failure: req.failure()?.errorText });
      });

      page.on('console', (msg) => {
        if (msg.type() === 'error') {
          consoleErrors.push(msg.text());
        }
      });

      console.log('Navigazione verso primevideo.com...');
      await page.goto('https://www.primevideo.com/', {
        waitUntil: 'domcontentloaded',
        timeout: 60000
      });

      console.log('Attesa 12 secondi...');
      await page.waitForTimeout(12000);

      // Raccogli dati
      const pageInfo = await page.evaluate(() => {
        return {
          title: document.title,
          elementCount: document.querySelectorAll('*').length,
          bodyHeight: document.body ? document.body.scrollHeight : 0,
          url: window.location.href
        };
      });

      console.log('Titolo:', pageInfo.title);
      console.log('Elementi:', pageInfo.elementCount);
      console.log('Altezza body:', pageInfo.bodyHeight);

      // Screenshot
      const screenshotPath = path.join(OUT_DIR, 'primevideo-feedon.png');
      await page.screenshot({ path: screenshotPath, fullPage: true });
      console.log('Screenshot salvato:', screenshotPath);

      risultati.fase4 = {
        pageInfo,
        screenshot: screenshotPath,
        failedRequests: failedRequests.slice(0, 20), // Limita a 20
        consoleErrors: consoleErrors.slice(0, 20)
      };

    } catch (e) {
      console.error('Errore FASE 4:', e.message);
      risultati.fase4 = { error: e.message };
    }

    // ========== FASE 5: Riepilogo e salvataggio ==========
    console.log('\n--- FASE 5: Riepilogo ---');

    const riepilogo = {
      timestamp: new Date().toISOString(),
      feedDownload: {
        ms: risultati.fase1?.ms,
        ok: risultati.fase1?.ok,
        regole: risultati.fase1?.count,
        versione: risultati.fase1?.version
      },
      applicazione: {
        originali: risultati.fase2?.totaliOriginali,
        sanitizzate: risultati.fase2?.sanitizzate,
        applicate: risultati.fase2?.applicati,
        dinamicheFinali: risultati.fase2?. finaleDinamiche,
        chunkFallito: risultati.fase2?.chunkFallito,
        errore: risultati.fase2?.errore
      },
      matchTest: risultati.fase3?.map(r => ({
        url: r.url,
        type: r.type,
        matchedRules: r.matchedRules?.length || 0,
        blocked: (r.matchedRules?.length || 0) > 0,
        ruleIds: r.matchedRules?.map(mr => mr.ruleId) || []
      })),
      navigazione: {
        titolo: risultati.fase4?.pageInfo?.title,
        url: risultati.fase4?.pageInfo?.url,
        elementi: risultati.fase4?.pageInfo?.elementCount,
        screenshot: risultati.fase4?.screenshot
      }
    };

    // Stampa riepilogo compatto
    console.log('\n=== RIEPILOGO ===');
    console.log(`Feed: ${riepilogo.feedDownload.regole} regole (v${riepilogo.feedDownload.versione}) scaricate in ${riepilogo.feedDownload.ms}ms`);
    console.log(`Applicazione: ${riepilogo.applicazione.applicate}/${riepilogo.applicazione.sanitizzate} regole applicate`);
    console.log(`Match test: ${riepilogo.matchTest.filter(m => m.blocked).length} URL bloccati su ${riepilogo.matchTest.length} testati`);

    const blocchi = riepilogo.matchTest.filter(m => m.blocked);
    if (blocchi.length > 0) {
      console.log('\nURL bloccati:');
      blocchi.forEach(b => {
        console.log(`  BLOCCATO -> ${b.url} [${b.type}] (ruleIds: ${b.ruleIds.join(', ')})`);
      });
    }

    console.log(`\nNavigazione: "${riepilogo.navigazione.titolo}"`);
    console.log(`Screenshot: ${riepilogo.navigazione.screenshot}`);

    // Salva JSON
    const jsonPath = path.join(OUT_DIR, 'primevideo-feed-applied.json');
    fs.writeFileSync(jsonPath, JSON.stringify(riepilogo, null, 2));
    console.log('\nJSON salvato:', jsonPath);

    risultati.riepilogo = riepilogo;

  } catch (error) {
    console.error('Errore generale:', error);
  } finally {
    // Chiusura
    if (context) {
      await context.close();
    }
    process.exit(0);
  }
})();
