'use strict';
// Anti-regressione: la rimozione degli annunci da ytInitialPlayerResponse NON
// deve dipendere dal verdetto Pro al momento del SET.
//
// Il bug (v3.5.44): il setter decideva strip vs passthrough nell'istante in cui
// YouTube assegnava ytInitialPlayerResponse — pochi ms dopo document_start —
// mentre il verdetto Pro arriva da content.js solo dopo storage.get + verifica
// ECDSA, entrambe asincrone. La corsa era persa quasi sempre: adPlacements
// intatti, player che schedula tutti gli annunci.
//
// Il test esegue il blocco A1 ESTRATTO DAL SORGENTE REALE.

const fs = require('fs');
const path = require('path');

const stealthPath = path.resolve(__dirname, '../../app/src/stealth.js');
let src;
try {
    src = fs.readFileSync(stealthPath, 'utf8');
} catch (e) {
    console.error('Errore durante la lettura di stealth.js:', e.message);
    process.exit(1);
}

// ----------------------------------------------------------------------
// Estrazione del blocco reale: da AD_KEYS fino a prima di «A2: Intercept fetch»
// ----------------------------------------------------------------------
const MARK_START = '// Object-level deletion for ytInitialPlayerResponse';
const MARK_END = '// A2: Intercept fetch';
const i = src.indexOf(MARK_START);
const j = src.indexOf(MARK_END);

if (i === -1 || j === -1) {
    console.error('Marcatori del blocco A1 non trovati in stealth.js');
    process.exit(1);
}
const block = src.slice(i, j);

for (const needed of ['stripAdObj', 'ytInitialPlayerResponse', 'Object.defineProperty']) {
    if (!block.includes(needed)) {
        console.error('Il blocco estratto non contiene ' + needed);
        process.exit(1);
    }
}

// ----------------------------------------------------------------------
// Esecuzione del blocco con window/gate simulati
// ----------------------------------------------------------------------
function runBlock(opts) {
    const win = {};
    if (opts.preesistente) win.ytInitialPlayerResponse = makeResponse();

    const gate = { pro: !!opts.proSubito, compat: !!opts.compat };
    const isProSync = () => gate.pro;
    const isVideoCompatMode = () => gate.compat;

    const fn = new Function('window', 'isProSync', 'isVideoCompatMode', block);
    fn(win, isProSync, isVideoCompatMode);
    return { win, gate };
}

function makeResponse() {
    return {
        adPlacements: [{ adPlacementRenderer: {} }],
        playerAds: [{ playerLegacyDesktopWatchAdsRenderer: {} }],
        adSlots: [{}],
        adBreakParams: {},
        adBreakHeartbeatParams: {},
        videoDetails: { videoId: 'LYao0WBD36Y' },
    };
}

const AD_FIELDS = ['adPlacements', 'playerAds', 'adSlots', 'adBreakParams', 'adBreakHeartbeatParams'];

function adFieldsPresent(obj) {
    return AD_FIELDS.filter((k) => obj && k in obj);
}

// ----------------------------------------------------------------------
// Scenari
// ----------------------------------------------------------------------
const scenarios = [
    {
        id: 'T1',
        desc: 'gate Pro arriva DOPO il set ma prima della lettura — il bug reale',
        run: () => {
            const { win, gate } = runBlock({ proSubito: false });
            win.ytInitialPlayerResponse = makeResponse();  // YouTube assegna: gate non ancora arrivato
            gate.pro = true;                               // content.js completa storage.get + ECDSA
            const letto = win.ytInitialPlayerResponse;     // il player legge a playerBootstrap
            const rimasti = adFieldsPresent(letto);
            if (rimasti.length) {
                return 'campi ad sopravvissuti alla lettura: ' + rimasti.join(', ');
            }
            if (!letto.videoDetails) return 'videoDetails perso: lo strip ha rimosso troppo';
            return null;
        },
    },
    {
        id: 'T2',
        desc: 'gate Pro gia' + "'" + ' attivo al set — strip immediato',
        run: () => {
            const { win } = runBlock({ proSubito: true });
            win.ytInitialPlayerResponse = makeResponse();
            const rimasti = adFieldsPresent(win.ytInitialPlayerResponse);
            return rimasti.length ? 'campi ad non rimossi: ' + rimasti.join(', ') : null;
        },
    },
    {
        id: 'T3',
        desc: 'Free (gate mai attivo) — passthrough, nessuna modifica',
        run: () => {
            const { win } = runBlock({ proSubito: false });
            win.ytInitialPlayerResponse = makeResponse();
            const rimasti = adFieldsPresent(win.ytInitialPlayerResponse);
            return rimasti.length === AD_FIELDS.length
                ? null
                : 'in Free la config va lasciata intatta, mancano: ' +
                  AD_FIELDS.filter((k) => !rimasti.includes(k)).join(', ');
        },
    },
    {
        id: 'T4',
        desc: 'compatibilita' + "'" + ' attiva — passthrough anche con Pro',
        run: () => {
            const { win } = runBlock({ proSubito: true, compat: true });
            win.ytInitialPlayerResponse = makeResponse();
            const rimasti = adFieldsPresent(win.ytInitialPlayerResponse);
            return rimasti.length === AD_FIELDS.length
                ? null
                : 'in compatibilita' + "'" + ' la config va lasciata intatta';
        },
    },
    {
        id: 'T5',
        desc: 'valore preesistente all' + "'" + 'hook, gate tardivo — strip alla lettura',
        run: () => {
            const { win, gate } = runBlock({ proSubito: false, preesistente: true });
            gate.pro = true;
            const rimasti = adFieldsPresent(win.ytInitialPlayerResponse);
            return rimasti.length ? 'campi ad sopravvissuti: ' + rimasti.join(', ') : null;
        },
    },
    {
        id: 'T6',
        desc: 'strutturale: il setter non deve decidere il gate',
        run: () => {
            const m = block.match(/set\s*\(\s*v\s*\)\s*\{([^}]*)\}/);
            if (!m) return 'setter di ytInitialPlayerResponse non trovato';
            const corpo = m[1];
            if (/isProSync|isProEnabled|isVideoCompatMode/.test(corpo)) {
                return 'il setter consulta il gate: e' + "'" + ' la race del bug originale, ' +
                       'la decisione va rinviata alla lettura';
            }
            return null;
        },
    },
    {
        id: 'T7',
        desc: 'il Layer A usa il gate sincrono, non solo il nonce tardivo',
        run: () => {
            if (!/function isProSync/.test(src)) return 'isProSync non definita in stealth.js';
            if (!/localStorage\.getItem\("__adoff_pro"\)/.test(src)) {
                return 'isProSync non legge il canale sincrono __adoff_pro';
            }
            const contentPath = path.resolve(__dirname, '../../app/src/content.js');
            const csrc = fs.readFileSync(contentPath, 'utf8');
            if (!/setItem\("__adoff_pro"/.test(csrc)) {
                return 'content.js non pubblica __adoff_pro: il canale resta sempre vuoto';
            }
            return null;
        },
    },
];

// ----------------------------------------------------------------------
// Esecuzione
// ----------------------------------------------------------------------
const results = [];
for (const s of scenarios) {
    let err;
    try {
        err = s.run();
    } catch (e) {
        err = 'eccezione: ' + e.message;
    }
    results.push((err ? 'FAIL ' : 'PASS ') + s.id + ': ' + s.desc + (err ? ' | ' + err : ''));
}

for (const line of results) console.log(line);

const passed = results.filter((r) => r.startsWith('PASS')).length;
console.log('RISULTATO: ' + passed + '/' + scenarios.length + ' passati');
if (passed < scenarios.length) process.exit(1);
