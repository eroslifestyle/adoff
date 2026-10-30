const { chromium } = require('playwright');
const path = require('path');
const fs = require('fs');

// === COSTANTI ===
const EXT_PATH = process.env.EXT_PATH || path.resolve(__dirname, '../../app');
const FEED_PATH = process.env.FEED_PATH || path.resolve(__dirname, '../filter-lists/rules-feed-new.json');
const LIVE_PATH = process.env.LIVE_PATH || path.resolve(__dirname, '../../site/rules-feed.json');
const CHUNK_SIZE = parseInt(process.env.CHUNK_SIZE) || 2000;
const NAV_TIMEOUT = parseInt(process.env.NAV_TIMEOUT) || 25000;
const SETTLE_MS = parseInt(process.env.SETTLE_MS) || 6000;

// === SITI DA TESTARE ===
const SITES = [
    // zero-ads: siti senza ads (circa)
    { url: 'https://www.wikipedia.org/', group: 'zero-ads' },
    { url: 'https://github.com/', group: 'zero-ads' },
    { url: 'https://stackoverflow.com/', group: 'zero-ads' },
    { url: 'https://www.poste.it/', group: 'zero-ads' },
    { url: 'https://www.agenziaentrate.gov.it/', group: 'zero-ads' },
    // con-ads: siti con ads tipici
    { url: 'https://www.repubblica.it/', group: 'con-ads' },
    { url: 'https://www.corriere.it/', group: 'con-ads' },
    { url: 'https://www.ilmeteo.it/', group: 'con-ads' },
    { url: 'https://www.amazon.it/', group: 'con-ads' },
    { url: 'https://www.ebay.it/', group: 'con-ads' },
    { url: 'https://www.subito.it/', group: 'con-ads' },
    { url: 'https://www.tripadvisor.it/', group: 'con-ads' },
];

// === MAPPE GLOBALI ===
let isNewRuleMap = new Map(); // id candidato -> true/false
let idToUrlFilter = new Map(); // id candidato -> urlFilter

async function main() {
    let context;
    let sw = null;

    try {
        // ============================================================
        // PASSO 1: Identificazione regole NUOVE
        // ============================================================
        console.log('\n=== PASSO 1: Analisi feed ===');

        let candidateRules, liveRules;
        try {
            // I feed sono oggetti { version, updated, ruleCount, rules }, non array.
            candidateRules = JSON.parse(fs.readFileSync(FEED_PATH, 'utf8')).rules || [];
            liveRules = JSON.parse(fs.readFileSync(LIVE_PATH, 'utf8')).rules || [];
        } catch (e) {
            console.error('ERRORE: Impossibile leggere i feed', e.message);
            process.exit(1);
        }

        // Costruisci chiavi canoniche (minuscolo, senza || iniziale, senza ^ finale)
        const canonicalKey = (urlFilter) => {
            let key = urlFilter.toLowerCase();
            if (key.startsWith('||')) key = key.slice(2);
            if (key.endsWith('^')) key = key.slice(0, -1);
            return key;
        };

        // Set delle chiavi live
        const liveKeys = new Set();
        for (const rule of liveRules) {
            if (rule.id && rule.action?.type === 'block' && rule.condition?.urlFilter) {
                liveKeys.add(canonicalKey(rule.condition.urlFilter));
            }
        }

        // Identifica regole nuove
        let newCount = 0;
        for (const rule of candidateRules) {
            if (rule.id && rule.action?.type === 'block' && rule.condition?.urlFilter) {
                const key = canonicalKey(rule.condition.urlFilter);
                idToUrlFilter.set(rule.id, rule.condition.urlFilter);
                const isNew = !liveKeys.has(key);
                isNewRuleMap.set(rule.id, isNew);
                if (isNew) newCount++;
            }
        }

        console.log(`Regole totali nel candidato: ${candidateRules.length}`);
        console.log(`Regole NUOVE (non in produzione): ${newCount}`);

        // ============================================================
        // PASSO 2: Browser con estensione
        // ============================================================
        console.log('\n=== PASSO 2: Avvio browser ===');

        context = await chromium.launchPersistentContext('', {
            headless: false,
            args: [
                '--no-first-run',
                '--disable-default-apps',
                '--mute-audio',
                '--host-resolver-rules=MAP adoff.app 127.0.0.1,MAP api.adoff.app 127.0.0.1,MAP www.adoff.app 127.0.0.1',
                '--disable-extensions-except=' + EXT_PATH,
                '--load-extension=' + EXT_PATH
            ],
            ignoreDefaultArgs: ['--disable-extensions']
        });

        // Prendi service worker
        const serviceWorkers = context.serviceWorkers();
        if (serviceWorkers.length > 0) {
            sw = serviceWorkers[0];
        } else {
            sw = await context.waitForEvent('serviceworker', { timeout: 30000 });
        }
        console.log('Service worker disponibile');

        // Aspetta 8 secondi per stabilizzazione
        console.log('Attesa 8s per stabilizzazione SW...');
        await new Promise(r => setTimeout(r, 8000));

        // Rimuovi tutte le regole dinamiche esistenti
        await sw.evaluate(() => {
            return new Promise((resolve) => {
                chrome.declarativeNetRequest.getDynamicRules(rules => {
                    const ids = rules.map(r => r.id);
                    chrome.declarativeNetRequest.updateDynamicRules(
                        { removeRuleIds: ids },
                        resolve
                    );
                });
            });
        });
        console.log('Regole dinamiche esistenti rimosse');

        // Applica feed candidato a chunk
        const candidateBlockRules = candidateRules.filter(r => r.action?.type === 'block');
        let appliedCount = 0;
        let chunkError = null;

        for (let i = 0; i < candidateBlockRules.length; i += CHUNK_SIZE) {
            const chunk = candidateBlockRules.slice(i, i + CHUNK_SIZE);
            const result = await sw.evaluate((rules) => {
                return new Promise((resolve) => {
                    chrome.declarativeNetRequest.updateDynamicRules(
                        { addRules: rules },
                        (err) => resolve({ err: chrome.runtime.lastError, count: rules.length })
                    );
                });
            }, chunk);

            if (result.err) {
                chunkError = result.err;
                console.log(`ERRORE al chunk ${i / CHUNK_SIZE + 1}: ${result.err}`);
                break;
            }
            appliedCount += result.count;
        }

        // Verifica regole attive
        const activeRules = await sw.evaluate(() => {
            return new Promise((resolve) => {
                chrome.declarativeNetRequest.getDynamicRules(resolve);
            });
        });
        console.log(`Regole attive dopo applicazione: ${activeRules.length} (previste: ${appliedCount})`);

        if (chunkError) {
            console.log('WARNING: Alcuni chunk non sono stati applicati');
        }

        // ============================================================
        // PASSO 3: Navigazione siti
        // ============================================================
        console.log('\n=== PASSO 3: Navigazione siti ===');

        // Traduzione resourceType Playwright -> DNR
        const translateResourceType = (type) => {
            const map = {
                'document': 'main_frame',
                'stylesheet': 'stylesheet',
                'script': 'script',
                'image': 'image',
                'font': 'font',
                'xhr': 'xmlhttprequest',
                'fetch': 'xmlhttprequest',
                'media': 'media',
                'websocket': 'websocket'
            };
            return map[type] || 'other';
        };

        // Risultati raccolti per sito
        const results = {};

        for (const site of SITES) {
            console.log(`\n--- Navigazione: ${site.url} (${site.group}) ---`);

            const blockedRequests = [];
            let pageErrors = 0;
            let consoleErrors = 0;
            let navigated = false;

            try {
                const page = await context.newPage();

                // Lista per raccogliere i dati delle richieste bloccate
                const pendingBlocks = [];

                // Listener per richieste bloccate dall'estensione
                page.on('requestfailed', req => {
                    const failure = req.failure();
                    if (failure && failure.errorText && failure.errorText.includes('ERR_BLOCKED_BY_CLIENT')) {
                        // Approssimazione eTLD+1: confronta ultimi 2 segmenti hostname
                        const pageHost = new URL(site.url).hostname;
                        const reqHost = req.url().startsWith('http') ? new URL(req.url()).hostname : '';
                        const isFirstParty = (() => {
                            const pageParts = pageHost.split('.').slice(-2);
                            const reqParts = reqHost.split('.').slice(-2);
                            return pageParts[0] === reqParts[0] && pageParts[1] === reqParts[1];
                        })();

                        blockedRequests.push({
                            url: req.url(),
                            resourceType: req.resourceType(),
                            isFirstParty: isFirstParty
                        });
                    }
                });

                // Contatori errori
                page.on('pageerror', () => pageErrors++);
                page.on('console', msg => {
                    if (msg.type() === 'error') consoleErrors++;
                });

                await page.goto(site.url, { waitUntil: 'domcontentloaded', timeout: NAV_TIMEOUT });
                navigated = true;
                await new Promise(r => setTimeout(r, SETTLE_MS));
                await page.close();

            } catch (e) {
                console.log(`SKIP ${site.url}: ${e.message}`);
                navigated = false;
            }

            results[site.url] = {
                group: site.group,
                navigated,
                blocked: blockedRequests,
                pageErrors,
                consoleErrors
            };

            console.log(`  Bloccate: ${blockedRequests.length}, PageErrors: ${pageErrors}, ConsoleErrors: ${consoleErrors}`);
        }

        // ============================================================
        // PASSO 4: Attribuzione
        // ============================================================
        console.log('\n=== PASSO 4: Attribuzione regole ===');

        // Attributo esteso con dettagli regola
        for (const siteUrl of Object.keys(results)) {
            const result = results[siteUrl];

            for (const block of result.blocked) {
                // testMatchOutcome: method DENTRO l'oggetto request
                const dnrType = translateResourceType(block.resourceType);

                const matchResult = await sw.evaluate(
                    ({ url, type, method }) => {
                        return new Promise((resolve) => {
                            chrome.declarativeNetRequest.testMatchOutcome(
                                { url, type, method },
                                (result) => {
                                    if (chrome.runtime.lastError) {
                                        resolve({ error: chrome.runtime.lastError.message, matchedRules: [] });
                                    } else {
                                        // testMatchOutcome restituisce { matchedRules: [...] }
                                        // direttamente: non esiste alcun matchResults[0].
                                        const rules = result?.matchedRules || [];
                                        resolve({
                                            // Solo le regole del feed: gli id del ruleset
                                            // statico si sovrappongono a quelli dinamici e
                                            // attribuirebbero al feed blocchi che non sono suoi.
                                            matchedRules: rules
                                              .filter(r => r.rulesetId === '_dynamic')
                                              .map(r => r.ruleId),
                                            tutte: rules.map(r => `${r.rulesetId}:${r.ruleId}`)
                                        });
                                    }
                                }
                            );
                        });
                    },
                    { url: block.url, type: dnrType, method: 'get' }
                );

                block.matchedRuleIds = matchResult.matchedRules || [];

                // Sospectto falso positivo?
                // Critero: first-party OPPURE tipo document/stylesheet/font
                const isSuspiciousType = ['document', 'stylesheet', 'font'].includes(block.resourceType);
                block.isSuspicious = block.isFirstParty || isSuspiciousType;

                // Attribuzione a regola nuova o live
                block.newRules = [];
                block.liveRules = [];

                for (const rid of block.matchedRuleIds) {
                    if (isNewRuleMap.has(rid)) {
                        if (isNewRuleMap.get(rid)) {
                            block.newRules.push(rid);
                        } else {
                            block.liveRules.push(rid);
                        }
                    }
                }
            }
        }

        // ============================================================
        // PASSO 5: Report finale
        // ============================================================
        console.log('\n============================================================');
        console.log('REPORT FINALE');
        console.log('============================================================\n');

        // Riepilogo per sito
        console.log('--- Riepilogo per sito ---');
        for (const siteUrl of Object.keys(results)) {
            const r = results[siteUrl];
            const suspicious = r.blocked.filter(b => b.isSuspicious).length;
            console.log(`${siteUrl}: ${r.blocked.length} bloccate, ${suspicious} sospette`);
        }

        // Sospetti da regole NUOVE (questo e' il dato che conta)
        console.log('\n============================================================');
        console.log('SOSPETTI FALSI POSITIVI DA REGOLE NUOVE');
        console.log('============================================================');
        let totalSuspiciousNew = 0;

        for (const siteUrl of Object.keys(results)) {
            const r = results[siteUrl];
            for (const block of r.blocked) {
                if (block.isSuspicious && block.newRules.length > 0) {
                    totalSuspiciousNew++;
                    for (const rid of block.newRules) {
                        const urlFilter = idToUrlFilter.get(rid) || 'N/A';
                        console.log(`Sito: ${siteUrl}`);
                        console.log(`  URL: ${block.url}`);
                        console.log(`  Tipo: ${block.resourceType}, FirstParty: ${block.isFirstParty}`);
                        console.log(`  Regola ID: ${rid}, urlFilter: ${urlFilter}`);
                        console.log('');
                    }
                }
            }
        }

        if (totalSuspiciousNew === 0) {
            console.log('Nessun sospetto falso positivo da regole nuove trovato.');
        }

        // Sospetti da regole GIA' in produzione (informativo)
        console.log('\n============================================================');
        console.log('SOSPETTI DA REGOLE GIA IN PRODUZIONE (informativo)');
        console.log('============================================================');

        for (const siteUrl of Object.keys(results)) {
            const r = results[siteUrl];
            for (const block of r.blocked) {
                if (block.isSuspicious && block.newRules.length === 0 && block.liveRules.length > 0) {
                    for (const rid of block.liveRules) {
                        const urlFilter = idToUrlFilter.get(rid) || 'N/A';
                        console.log(`Sito: ${siteUrl} | URL: ${block.url} | Tipo: ${block.resourceType} | Regola: ${rid} (${urlFilter})`);
                    }
                }
            }
        }

        // Sospetti senza regola attribuita
        console.log('\n============================================================');
        console.log('SOSPETTI SENZA REGOLA ATTRIBUITA');
        console.log('============================================================');
        let orphans = 0;
        for (const [site, r] of Object.entries(results)) {
            for (const b of r.blocked) {
                if (b.isSuspicious && b.newRules.length === 0 && b.liveRules.length === 0) {
                    orphans++;
                    console.log(`  ${site} | ${b.url} | ${b.resourceType} | ${b.isFirstParty} | ${JSON.stringify(b.matchedRuleIds)}`);
                }
            }
        }
        if (orphans === 0) {
            console.log('  nessuno');
        }

        // Verdetto
        console.log('\n============================================================');
        const visitedCount = Object.values(results).filter(r => r.navigated).length;
        console.log(`VERDETTO: ${totalSuspiciousNew} sospetti da regole nuove su ${visitedCount} siti visitati`);
        console.log('============================================================\n');

        // Exit code
        if (totalSuspiciousNew > 0) {
            process.exit(1);
        }

    } catch (e) {
        console.error('ERRORE GENERALE:', e);
        process.exit(1);
    } finally {
        if (context) {
            await context.close();
        }
    }
}

main();
