'use strict';
// Lettura del file sorgente
const fs = require('fs');
const FILE_PATH = '/mnt/backup/Dropbox/1 Programmazione/Progetti/ChromePlugin/app/src/stealth.js';

let content;
try {
    content = fs.readFileSync(FILE_PATH, 'utf8');
} catch (e) {
    console.error('Impossibile leggere il file: ' + e.message);
    process.exit(1);
}

// Estrazione del blocco tra i marcatori
const START_MARKER = '// A1: Hook ytInitialPlayerResponse';
const END_MARKER = '// A2: Intercept fetch';
const startIdx = content.indexOf(START_MARKER);
const endIdx = content.indexOf(END_MARKER);
if (startIdx === -1) {
    console.error('Marcatore iniziale non trovato: ' + START_MARKER);
    process.exit(1);
}
if (endIdx === -1) {
    console.error('Marcatore finale non trovato: ' + END_MARKER);
    process.exit(1);
}
if (endIdx <= startIdx) {
    console.error('Ordine marcatori non valido');
    process.exit(1);
}
const block = content.slice(startIdx, endIdx).trim();
if (block.length === 0) {
    console.error('Blocco estratto vuoto');
    process.exit(1);
}

// Compilazione del blocco con new Function
// La funzione riceve window, localStorage, isProSync, isVideoCompatMode, stripAdObj
const code = block + '\nreturn {get:()=>window.ytInitialPlayerResponse, set:(v)=>{window.ytInitialPlayerResponse=v;}};';
let compiledFn;
try {
    compiledFn = new Function('window', 'localStorage', 'isProSync', 'isVideoCompatMode', 'stripAdObj', code);
} catch (e) {
    console.error('Errore durante la compilazione del blocco: ' + e.message);
    process.exit(1);
}

// Helper mkEnv: costruisce l'ambiente di test
function mkEnv(opts) {
    opts = opts || {};
    const win = {};
    // Se è fornito un preset, lo assegnamo preventivamente
    if (opts.preset) {
        win.ytInitialPlayerResponse = opts.preset;
    }
    // Mock di localStorage
    const localStorage = {
        getItem: function(k) {
            if (k === '__adoff_nocold' && opts.nocold) {
                return '1';
            }
            return null;
        }
    };
    // Funzioni di configurazione
    const isProSync = function() {
        return opts.pro !== false;
    };
    const isVideoCompatMode = function() {
        return !!opts.compat;
    };
    // Funzione di stripping degli oggetti pubblicitari
    const stripAdObj = function(o) {
        if (o) {
            delete o.adPlacements;
            delete o.adBreakHeartbeatParams;
            delete o.playerAds;
        }
        return o;
    };
    // Creo il modulo con la funzione compilata
    const mod = compiledFn(win, localStorage, isProSync, isVideoCompatMode, stripAdObj);
    return { mod, win };
}

// Helper per creare risposte di test
function respConAds() {
    return {
        adPlacements: [1],
        videoDetails: { lengthSeconds: '600' },
        streamingData: {}
    };
}

function respLive() {
    return {
        adPlacements: [1],
        videoDetails: { isLive: true }
    };
}

// Funzione di esecuzione test
function runTest(id, desc, testFn) {
    const result = testFn();
    console.log((result ? 'PASS' : 'FAIL') + ' ' + id + ': ' + desc);
    return result ? 1 : 0;
}

// Esecuzione dei test
let passed = 0;

passed += runTest('T1', 'cold-load: primo get senza streamingData ne annunci, ma con i metadati', function() {
    // Il cold-load NON restituisce piu' undefined: quello rompeva chiunque
    // leggesse .videoDetails senza guardia (incluso il player di YouTube).
    // Restituisce un oggetto valido ma privo dei dati di riproduzione, cosi'
    // il player e' costretto a richiederli via rete.
    const { mod } = mkEnv({ preset: respConAds() });
    const r = mod.get();
    return !!r && r.videoDetails !== undefined
        && r.streamingData === undefined
        && r.adPlacements === undefined;
});

passed += runTest('T2', 'il secondo get restituisce loggetto (nessuna pagina rotta)', function() {
    const { mod } = mkEnv({ preset: respConAds() });
    const first = mod.get();   // minimale, senza streamingData
    const second = mod.get();  // oggetto completo
    return first.streamingData === undefined && second !== undefined
        && second.streamingData !== undefined;
});

passed += runTest('T3', 'cold-load NON scatta sulle dirette', function() {
    const { mod } = mkEnv({ preset: respLive() });
    return mod.get() !== undefined;
});

passed += runTest('T4', 'kill-switch __adoff_nocold disattiva il cold-load', function() {
    const { mod } = mkEnv({ preset: respConAds(), nocold: true });
    return mod.get() !== undefined;
});

passed += runTest('T5', 'in Free (non Pro) nessun cold-load', function() {
    const { mod } = mkEnv({ preset: respConAds(), pro: false });
    return mod.get() !== undefined;
});

passed += runTest('T6', 'senza annunci nessun cold-load', function() {
    const { mod } = mkEnv({ preset: { videoDetails: { lengthSeconds: '600' } } });
    return mod.get() !== undefined;
});

passed += runTest('T7', 'cold-load anche quando lassegnazione avviene DOPO (via setter)', function() {
    const { mod } = mkEnv({});
    mod.set(respConAds());
    const r = mod.get();
    return !!r && r.streamingData === undefined && r.adPlacements === undefined;
});

// Risultato finale
console.log(passed + '/7 PASS');
if (passed < 7) {
    process.exit(1);
}
