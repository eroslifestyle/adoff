'use strict';
// Cold-load DISATTIVATO PERMANENTEMENTE dalla v3.5.73 (causava 403 su googlevideo.com
// per parametri firmati invalidati + degrado qualita' video, vedi coldLoadDisabilitato()
// in app/src/stealth.js). Questi test presidiano quella decisione: T1/T2/T7 verificano
// che il get restituisca SEMPRE l'oggetto completo (con streamingData), ripulito dei
// campi pubblicitari; T8 e' la guardia che fallisce se coldLoadDisabilitato() smette
// di ritornare true. T3-T6 restano invariati (casi in cui il cold-load non scatterebbe
// comunque anche se fosse riattivato).
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

passed += runTest('T1', 'col cold-load disattivato, il primo get restituisce loggetto completo con streamingData', function() {
    // coldLoadDisabilitato() ritorna sempre true (v3.5.73): il get non regala
    // piu' un oggetto minimale senza streamingData, restituisce sempre
    // l'oggetto pieno, solo ripulito dei campi pubblicitari.
    const { mod } = mkEnv({ preset: respConAds() });
    const r = mod.get();
    return !!r && r.videoDetails !== undefined
        && r.streamingData !== undefined
        && r.adPlacements === undefined;
});

passed += runTest('T2', 'ogni get ripetuto ritorna lo stesso oggetto completo (nessun minimale)', function() {
    const { mod } = mkEnv({ preset: respConAds() });
    const first = mod.get();
    const second = mod.get();
    return first !== undefined && first.streamingData !== undefined
        && second !== undefined && second.streamingData !== undefined;
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

passed += runTest('T7', 'anche quando lassegnazione avviene DOPO (via setter), il get ritorna loggetto completo', function() {
    const { mod } = mkEnv({});
    mod.set(respConAds());
    const r = mod.get();
    return !!r && r.streamingData !== undefined && r.adPlacements === undefined;
});

passed += runTest('T8', 'guardia: coldLoadDisabilitato() deve ritornare true (riattivarlo causa 403 googlevideo + degrado qualita, regressione 3.5.73)', function() {
    const m = content.match(/function\s+coldLoadDisabilitato\s*\(\s*\)\s*{([\s\S]*?)\n\s*}/);
    if (!m) {
        console.error('coldLoadDisabilitato() non trovata nel sorgente');
        return false;
    }
    const body = m[1];
    const ok = /return\s+true\s*;/.test(body) && !/return\s+false\s*;/.test(body);
    if (!ok) {
        console.error('ATTENZIONE: coldLoadDisabilitato() non ritorna piu\' true incondizionatamente. '
            + 'Riattivare il cold-load causa 403 su googlevideo.com (parametri firmati invalidati) '
            + 'e degrado della qualita video (regressione 3.5.73). Vedi app/src/stealth.js.');
    }
    return ok;
});

// Risultato finale
console.log(passed + '/8 PASS');
if (passed < 8) {
    process.exit(1);
}
