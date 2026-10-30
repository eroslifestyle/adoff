// test-dnr-quota-live.js — Misura DNR quota REALI su Chrome vivo con estensione AdOff caricata.
// Legge le costanti da chrome.declarativeNetRequest in esecuzione (nessun numero da docs).
// Prova di carico: aggiunge regole dinamiche in blocchi fino a superare la quota, poi una alla volta.
// Pulisce TUTTE le regole aggiunte alla fine. Non modifica il codice dell'estensione.
//
// Uso: node sviluppo/tests/test-dnr-quota-live.js
// Env: EXT_PATH (default ../../app), BLOCK_SIZE (default 5000)

const { chromium } = require('playwright');
const path = require('path');
const os = require('os');
const fs = require('fs');

const EXT_PATH = process.env.EXT_PATH || path.resolve(__dirname, '../../app');
const BLOCK_SIZE = parseInt(process.env.BLOCK_SIZE) || 5000;
const START_ID = 2000000; // lontano dagli id usati dall'estensione (statici 1-910, feed ~100k)
const SINGLE_PHASE_MAX = BLOCK_SIZE * 2;

function mkRule(id) {
    return {
        id,
        priority: 1,
        action: { type: 'block' },
        condition: { urlFilter: 'dnr-quota-probe.invalid', resourceTypes: ['main_frame'] },
    };
}

async function addRules(sw, rules) {
    // callback-style per compatibilita' max; ritorna {ok, message}
    return await sw.evaluate((rs) => {
        return new Promise((resolve) => {
            try {
                const p = chrome.declarativeNetRequest.updateDynamicRules({ addRules: rs });
                if (p && p.then) {
                    p.then(() => resolve({ ok: true }))
                     .catch((e) => resolve({ ok: false, message: String(e && e.message || e) }));
                } else {
                    chrome.declarativeNetRequest.updateDynamicRules(
                        { addRules: rs },
                        () => {
                            const err = chrome.runtime.lastError;
                            if (err) resolve({ ok: false, message: err.message });
                            else resolve({ ok: true });
                        }
                    );
                }
            } catch (e) {
                resolve({ ok: false, message: String(e && e.message || e) });
            }
        });
    }, rules);
}

async function removeRules(sw, ids) {
    await sw.evaluate((rids) => {
        return new Promise((resolve) => {
            const p = chrome.declarativeNetRequest.updateDynamicRules({ removeRuleIds: rids });
            if (p && p.then) p.then(resolve, () => resolve());
            else chrome.declarativeNetRequest.updateDynamicRules({ removeRuleIds: rids }, () => resolve());
        });
    }, ids);
}

async function getDynCount(sw) {
    return await sw.evaluate(async () => (await chrome.declarativeNetRequest.getDynamicRules()).length);
}

async function main() {
    const userDataDir = fs.mkdtempSync(path.join(os.tmpdir(), 'adoff-dnr-quota-'));
    const context = await chromium.launchPersistentContext(userDataDir, {
        headless: false,
        args: [
            '--no-first-run',
            '--disable-default-apps',
            '--mute-audio',
            '--disable-extensions-except=' + EXT_PATH,
            '--load-extension=' + EXT_PATH,
        ],
        ignoreDefaultArgs: ['--disable-extensions'],
    });

    try {
        let sw = context.serviceWorkers()[0]
            || await context.waitForEvent('serviceworker', { timeout: 30000 });
        // assicura che sia lo SW dell'estensione
        for (let i = 0; i < 10 && !sw.url().startsWith('chrome-extension://'); i++) {
            sw = await context.waitForEvent('serviceworker', { timeout: 10000 }).catch(() => sw);
        }
        console.log('[SW]', sw.url());
        await new Promise((r) => setTimeout(r, 5000)); // stabilizzazione

        // ---- PUNTO 2: valori letterali dalle API ----
        const probe = await sw.evaluate(async () => {
            const d = chrome.declarativeNetRequest;
            const out = {
                browser: navigator.userAgent,
                MAX_NUMBER_OF_DYNAMIC_RULES: (typeof d.MAX_NUMBER_OF_DYNAMIC_RULES !== 'undefined') ? d.MAX_NUMBER_OF_DYNAMIC_RULES : null,
                MAX_NUMBER_OF_DYNAMIC_AND_SESSION_RULES: (typeof d.MAX_NUMBER_OF_DYNAMIC_AND_SESSION_RULES !== 'undefined') ? d.MAX_NUMBER_OF_DYNAMIC_AND_SESSION_RULES : null,
                MAX_NUMBER_OF_STATIC_RULESETS: (typeof d.MAX_NUMBER_OF_STATIC_RULESETS !== 'undefined') ? d.MAX_NUMBER_OF_STATIC_RULESETS : null,
                GUARANTEED_MINIMUM_STATIC_RULES: (typeof d.GUARANTEED_MINIMUM_STATIC_RULES !== 'undefined') ? d.GUARANTEED_MINIMUM_STATIC_RULES : null,
                enabledRulesets: await d.getEnabledRulesets(),
                dynamicRulesCount: (await d.getDynamicRules()).length,
                sessionRulesCount: d.getSessionRules ? (await d.getSessionRules()).length : null,
            };
            return out;
        });
        console.log('PROBE ' + JSON.stringify(probe, null, 2));

        // ---- PUNTO 3: prova di carico ----
        const baseline = probe.dynamicRulesCount;
        let nextId = START_ID;
        let addedIds = [];
        let breakResult = null;
        let lastGoodCount = baseline;

        console.log(`[LOAD] baseline dynamic=${baseline}, blocchi da ${BLOCK_SIZE}`);
        // fase blocchi
        while (true) {
            const ids = [];
            for (let i = 0; i < BLOCK_SIZE; i++) ids.push(nextId++);
            const res = await addRules(sw, ids.map(mkRule));
            if (res.ok) {
                addedIds.push(...ids);
                lastGoodCount = await getDynCount(sw);
                console.log(`[LOAD] blocco ok -> dynamic=${lastGoodCount}`);
            } else {
                console.log(`[LOAD] blocco FALLITO (id ${ids[0]}..${ids[ids.length - 1]}): ${res.message}`);
                breakResult = { phase: 'block', attemptedIds: ids, countBeforeAttempt: lastGoodCount, message: res.message };
                break;
            }
            // safety: non superare mai abbondantemente la quota dichiarata
            if (lastGoodCount > (probe.MAX_NUMBER_OF_DYNAMIC_RULES || 0) + BLOCK_SIZE) break;
        }

        // fase edge-probe esatta: riempi fino alla capacita' dichiarata dalla costante,
        // dimezzando il chunk se l'API rifiuta; poi +1 per catturare l'errore al confine.
        if (breakResult) {
            const declaredMax = probe.MAX_NUMBER_OF_DYNAMIC_RULES || 0;
            let remaining = declaredMax - lastGoodCount;
            while (remaining > 0) {
                const ids = [];
                for (let i = 0; i < remaining; i++) ids.push(nextId++);
                const res = await addRules(sw, ids.map(mkRule));
                if (res.ok) {
                    addedIds.push(...ids);
                    lastGoodCount = await getDynCount(sw);
                    console.log(`[LOAD] edge +${remaining} ok -> dynamic=${lastGoodCount}`);
                    break;
                }
                await removeRules(sw, ids);
                nextId -= remaining;
                remaining = Math.floor(remaining / 2);
                console.log(`[LOAD] edge +${ids.length} FALLITO, dimezzo a ${remaining}`);
            }
            // conferma il confine: +1 oltre il massimo deve fallire
            const oneMore = [nextId++];
            const resFail = await addRules(sw, [mkRule(oneMore[0])]);
            if (!resFail.ok) {
                breakResult.exactCountAtFailure = lastGoodCount; // conteggio max raggiunto
                breakResult.singleErrorMessage = `+1 regola a count=${lastGoodCount} -> "${resFail.message}"`;
            } else {
                addedIds.push(...oneMore);
                lastGoodCount = await getDynCount(sw);
                breakResult.exactCountAtFailure = lastGoodCount;
                breakResult.singleErrorMessage = `+1 a count=${lastGoodCount} PASSATA (quota piu' alta della costante?)`;
            }
        }

        const load = {
            maxCountReached: lastGoodCount,
            baseline,
            breakPointCount: breakResult ? breakResult.exactCountAtFailure : null,
            breakPointMessage: breakResult ? (breakResult.singleErrorMessage || breakResult.message) : null,
            neverBroke: !breakResult,
        };
        console.log('LOAD ' + JSON.stringify(load, null, 2));

        // ---- pulizia: rimuovi OGNI id tentato (anche dei blocchi falliti, per sicurezza) ----
        const allAttempted = addedIds.slice();
        if (breakResult) allAttempted.push(...breakResult.attemptedIds);
        if (breakResult && breakResult.exactFailingId) allAttempted.push(breakResult.exactFailingId);
        // rimozione in chunk (limiti arg size)
        for (let i = 0; i < allAttempted.length; i += 10000) {
            await removeRules(sw, allAttempted.slice(i, i + 10000));
        }
        const after = await getDynCount(sw);
        console.log(`[CLEANUP] dynamic=${after} (baseline ${baseline})`);
        console.log('CLEANUP ' + JSON.stringify({ after, baseline, removedAttempted: allAttempted.length }));
    } finally {
        await context.close();
    }
}

main().catch((e) => { console.error('FATAL', e); process.exit(1); });
