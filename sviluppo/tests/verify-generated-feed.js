const { chromium } = require('playwright');
const path = require('path');
const fs = require('fs');

// CONFIGURAZIONE
const EXT_PATH = process.env.EXT_PATH || path.resolve(__dirname, '../../app');
const FEED_PATH = process.env.FEED_PATH || path.resolve(__dirname, '../filter-lists/rules-feed-new.json');
const CHUNK_SIZE = parseInt(process.env.CHUNK_SIZE || '2000', 10);

// Carica il feed dal disco
let feed;
try {
    const raw = fs.readFileSync(FEED_PATH, 'utf8');
    feed = JSON.parse(raw);
} catch (e) {
    console.error('ERRORE: impossibile leggere il feed da', FEED_PATH);
    console.error(e.stack);
    process.exit(1);
}

console.log('Feed caricato:', FEED_PATH);
console.log('Versione:', feed.version || 'N/A');
console.log('Numero regole:', feed.rules ? feed.rules.length : 0);

const rules = feed.rules || [];

async function main() {
    let context;
    let sw;
    let exitCode = 0;
    let okCount = 0;
    let failCount = 0;

    try {
        // AVVIO BROWSER con parametri vincolanti
        context = await chromium.launchPersistentContext('', {
            headless: false,
            args: [
                '--no-first-run',
                '--disable-default-apps',
                '--mute-audio',
                // Isola il test dalla rete: senza questo il service worker scarica il
                // feed LIVE da adoff.app, satura il cap dinamico e i match che vediamo
                // vengono da quello, non dal feed in verifica.
                '--host-resolver-rules=MAP adoff.app 127.0.0.1,MAP api.adoff.app 127.0.0.1,MAP www.adoff.app 127.0.0.1',
                '--disable-extensions-except=' + EXT_PATH,
                '--load-extension=' + EXT_PATH
            ],
            ignoreDefaultArgs: ['--disable-extensions']
        });

        // Prendi il service worker
        const workers = context.serviceWorkers();
        if (workers.length > 0) {
            sw = workers[0];
        } else {
            console.log('Aspetto service worker...');
            sw = await context.waitForEvent('serviceworker', { timeout: 30000 });
        }
        console.log('Service worker attivo');

        // Lascia al service worker il tempo di fallire il suo sync remoto (rete isolata)
        // prima di ripulire: cosi' non ci sovrascrive le dinamiche a meta' test.
        await new Promise(r => setTimeout(r, 8000));

        // STEP 2: BASELINE - rimuovi tutte le regole dinamiche esistenti
        await sw.evaluate(async () => {
            const existing = await chrome.declarativeNetRequest.getDynamicRules();
            if (existing.length > 0) {
                await chrome.declarativeNetRequest.updateDynamicRules({
                    addRules: [],
                    removeRuleIds: existing.map(r => r.id)
                });
            }
        });
        console.log('Regole dinamiche preesistenti rimosse (baseline pulita)');

        // Verifica che la URL non sia gia' bloccata (prova che il blocco viene dal feed)
        const baselineResult = await sw.evaluate(async () => {
            return new Promise((resolve) => {
                chrome.declarativeNetRequest.testMatchOutcome(
                    { url: 'https://0019x.com/ad.js', type: 'script', method: 'get' },
                    (result) => resolve(result)
                );
            });
        });

        const baselineBlocked = baselineResult && baselineResult.matchedRules && baselineResult.matchedRules.length > 0;
        if (baselineBlocked) {
            console.log('AVVISO: https://0019x.com/ad.js risulta gia\' bloccato nella baseline (regola statica?)');
            console.log('  matchedRules:', JSON.stringify(baselineResult.matchedRules));
        } else {
            console.log('Baseline OK: https://0019x.com/ad.js NON bloccato senza feed');
        }

        // STEP 3: APPLICA il feed a blocchi
        let chunkIndex = 0;
        let applyFailed = false;
        let firstFailedChunkRule = null;
        let lastError = null;

        for (let i = 0; i < rules.length; i += CHUNK_SIZE) {
            const chunk = rules.slice(i, i + CHUNK_SIZE);
            chunkIndex++;

            const result = await sw.evaluate(async (chunkRules) => {
                return new Promise((resolve) => {
                    chrome.declarativeNetRequest.updateDynamicRules(
                        { addRules: chunkRules, removeRuleIds: [] },
                        () => {
                            resolve({
                                lastError: chrome.runtime.lastError ? chrome.runtime.lastError.message : null,
                                rulesAdded: chunkRules.length
                            });
                        }
                    );
                });
            }, chunk);

            if (result.lastError) {
                console.log('ERRORE al blocco', chunkIndex, ':', result.lastError);
                applyFailed = true;
                lastError = result.lastError;
                firstFailedChunkRule = chunk[0].id;
                break;
            }
        }

        if (applyFailed) {
            console.log('RISULTATO APPLICAZIONE FEED: FALLITO al blocco', chunkIndex);
            console.log('  Errore:', lastError);
            console.log('  Prima regola del blocco fallito:', firstFailedChunkRule);
            exitCode = 1;
            failCount++;
        } else {
            console.log('RISULTATO APPLICAZIONE FEED: OK,', chunkIndex, 'blocchi applicati');
        }

        // STEP 4: Conta le regole realmente attive
        const activeRules = await sw.evaluate(async () => {
            const rules = await chrome.declarativeNetRequest.getDynamicRules();
            return rules.length;
        });
        console.log('Regole dinamiche attive:', activeRules);

        if (activeRules !== rules.length) {
            console.log('AVVISO: attive (' + activeRules + ') != feed (' + rules.length + ')');
        }

        // STEP 5: TEST DI MATCH
        const testCases = [
            { url: 'https://0019x.com/ads.js', type: 'script', method: 'get', expectedBlocked: true, desc: 'ad script noto' },
            { url: 'https://doubleclick.net/pixel.gif', type: 'image', method: 'get', expectedBlocked: true, desc: 'doubleclick pixel' },
            { url: 'https://www.primevideo.com/', type: 'main_frame', method: 'get', expectedBlocked: false, desc: 'primevideo home' },
            { url: 'https://www.primevideo.com/storefront', type: 'main_frame', method: 'get', expectedBlocked: false, desc: 'primevideo storefront' },
            { url: 'https://www.wikipedia.org/', type: 'main_frame', method: 'get', expectedBlocked: false, desc: 'wikipedia home' },
            { url: 'https://github.com/favicon.ico', type: 'image', method: 'get', expectedBlocked: false, desc: 'github favicon' }
        ];

        for (const tc of testCases) {
            const matchResult = await sw.evaluate(async (test) => {
                return new Promise((resolve) => {
                    chrome.declarativeNetRequest.testMatchOutcome(
                        { url: test.url, type: test.type, method: test.method },
                        (result) => resolve(result)
                    );
                });
            }, tc);

            const isBlocked = matchResult && matchResult.matchedRules && matchResult.matchedRules.length > 0;
            const ok = isBlocked === tc.expectedBlocked;

            if (ok) {
                console.log('OK   ' + tc.url + ' [' + tc.type + '] => ' + (isBlocked ? 'BLOCCATO' : 'permesso') + (isBlocked ? ' (' + JSON.stringify(matchResult.matchedRules.map(r => r.ruleId)) + ')' : ''));
                okCount++;
            } else {
                console.log('FAIL ' + tc.url + ' [' + tc.type + '] => atteso ' + (tc.expectedBlocked ? 'BLOCCATO' : 'permesso') + ', ottenuto ' + (isBlocked ? 'BLOCCATO' : 'permesso') + (isBlocked ? ' (' + JSON.stringify(matchResult.matchedRules.map(r => r.ruleId)) + ')' : ''));
                failCount++;
            }
        }

    } catch (e) {
        console.error('ECCEZIONE:', e.message);
        console.error(e.stack);
        exitCode = 1;
    } finally {
        if (context) {
            await context.close();
        }
        console.log('');
        console.log('RISULTATO: ' + okCount + ' ok, ' + failCount + ' fail');
        process.exit(exitCode === 1 || failCount > 0 ? 1 : 0);
    }
}

main();
