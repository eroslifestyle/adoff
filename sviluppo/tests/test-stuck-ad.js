'use strict';
/**
 * Test per la logica di terminazione degli annunci impiantati (stuck ad).
 * Estrae il blocco di codice da stealth.js e lo esegue in un contesto isolato.
 * Verifica tutti gli scenari previsti.
 */

const fs = require('fs');
const path = require('path');

// --- Lettura del sorgente ---
const stealthPath = path.resolve(__dirname, '../../app/src/stealth.js');
const src = fs.readFileSync(stealthPath, 'utf8');

// --- Estrazione del blocco che contiene la logica di terminazione ---
const marker = '// Terminazione degli annunci che si impiantano';
const startIdx = src.indexOf(marker);
if (startIdx === -1) {
    console.error('Errore: marcatore di inizio blocco non trovato.');
    process.exit(1);
}
const funcIdx = src.indexOf('function resetStuckAdState', startIdx);
if (funcIdx === -1) {
    console.error('Errore: funzione resetStuckAdState non trovata.');
    process.exit(1);
}
const closingIdx = src.indexOf('\n    }', funcIdx);
if (closingIdx === -1) {
    console.error('Errore: chiusura della funzione resetStuckAdState non trovata.');
    process.exit(1);
}
// Includiamo il newline e i 5 caratteri '    }'
const blocco = src.slice(startIdx, closingIdx + 6);

// --- Definizione della classe CustomEvent per i mock ---
class CustomEvent {
    constructor(type, options) {
        this.type = type;
        this.detail = options && options.detail;
    }
}

// --- Factory per ottenere le funzioni istanza dato un window fittizio ---
const fnFactory = new Function(
    'window', 'CustomEvent', 'isFinite', 'Math',
    blocco + '; return { instantSkip, resetStuckAdState };'
);

// --- Mock del DOM e del player ---
/**
 * Crea un insieme fresco di mock per ogni scenario.
 * @param {Object} opts - Opzioni: duration, readyState, paused, ct, conPulsanteSkip
 * @returns {Object} Mock con player, video, events, playCalls, skipButton, window
 */
function makeMocks(opts) {
    opts = opts || {};
    const events = [];
    const win = {
        dispatchEvent(e) {
            events.push(e);
        }
    };
    const playCalls = { n: 0 };
    const video = {
        currentTime: opts.ct || 0,
        duration: opts.duration || 0,
        readyState: opts.readyState || 0,
        paused: !!opts.paused,
        playbackRate: 1,
        play() {
            playCalls.n++;
            return Promise.resolve();
        }
    };
    let skipButton = null;
    if (opts.conPulsanteSkip) {
        skipButton = {
            offsetParent: {},
            clicked: 0,
            click() {
                this.clicked++;
            }
        };
    }
    const player = {
        querySelector(sel) {
            if (sel === 'video') return video;
            return skipButton;
        },
        querySelectorAll() {
            return [];
        }
    };
    return { player, video, events, playCalls, skipButton, window: win };
}

// --- Esecuzione dei test ---
const results = [];

/**
 * Esegue un singolo test.
 * @param {string} id - Identificativo (es. 'T1')
 * @param {string} desc - Descrizione in italiano
 * @param {Object} opts - Opzioni per makeMocks
 * @param {Function} testFn - Funzione che riceve (mocks, instantSkip) e restituisce {pass, expected, got}
 */
function runTest(id, desc, opts, testFn) {
    const mocks = makeMocks(opts);
    // Creiamo fresh istanze delle funzioni con il window del mock
    const { instantSkip, resetStuckAdState } = fnFactory(mocks.window, CustomEvent, isFinite, Math);
    // Azzeriamo lo stato prima dello scenario
    resetStuckAdState();
    const result = testFn(mocks, instantSkip);
    if (result.pass) {
        console.log(`PASS ${id}: ${desc}`);
    } else {
        console.log(`FAIL ${id}: ${desc} | atteso=${result.expected} ottenuto=${result.got}`);
    }
    results.push(result.pass);
}

// Test T1: annuncio che avanza non viene terminato
runTest('T1', 'annuncio che avanza non viene terminato', {
    duration: 15,
    readyState: 4,
    paused: false,
    ct: 1,
    conPulsanteSkip: false
}, (mocks, instantSkip) => {
    for (let i = 0; i < 20; i++) {
        mocks.video.currentTime += 0.5; // avanza prima di ogni chiamata
        instantSkip(mocks.player);
    }
    const pass = mocks.events.length === 0 && mocks.video.currentTime < 14;
    return {
        pass,
        expected: 'events.length === 0 && currentTime < 14',
        got: `events.length=${mocks.events.length}, currentTime=${mocks.video.currentTime}`
    };
});

// Test T2: annuncio impiantato viene terminato
runTest('T2', 'annuncio impiantato viene terminato', {
    duration: 15,
    readyState: 4,
    paused: false,
    ct: 0,
    conPulsanteSkip: false
}, (mocks, instantSkip) => {
    for (let i = 0; i < 10; i++) {
        instantSkip(mocks.player);
    }
    const targetTime = mocks.video.duration - 0.15;
    const timeOk = Math.abs(mocks.video.currentTime - targetTime) <= 0.01;
    const pass = mocks.events.length === 1 &&
        mocks.events[0].type === 'adoff-stuck-ad-ended' &&
        timeOk;
    return {
        pass,
        expected: `events.length === 1, type === 'adoff-stuck-ad-ended', currentTime ~${targetTime.toFixed(2)}`,
        got: `events.length=${mocks.events.length}, type=${mocks.events[0] ? mocks.events[0].type : 'none'}, currentTime=${mocks.video.currentTime.toFixed(2)}`
    };
});

// Test T3: terminazione avviene una sola volta
runTest('T3', 'terminazione avviene una sola volta', {
    duration: 15,
    readyState: 4,
    paused: false,
    ct: 0,
    conPulsanteSkip: false
}, (mocks, instantSkip) => {
    // Prima serie di chiamate che causano la terminazione
    for (let i = 0; i < 10; i++) {
        instantSkip(mocks.player);
    }
    // Simuliamo il video tornato a 0
    mocks.video.currentTime = 0;
    // Ulteriori chiamate che non devono generare nuovi eventi
    for (let i = 0; i < 10; i++) {
        instantSkip(mocks.player);
    }
    const pass = mocks.events.length === 1;
    return {
        pass,
        expected: 'events.length === 1',
        got: `events.length=${mocks.events.length}`
    };
});

// Test T4: dati non pronti (readyState 0) non causano terminazione
runTest('T4', 'dati non pronti: nessuna terminazione', {
    duration: 15,
    readyState: 0,
    paused: false,
    ct: 0,
    conPulsanteSkip: false
}, (mocks, instantSkip) => {
    for (let i = 0; i < 20; i++) {
        instantSkip(mocks.player);
    }
    const pass = mocks.events.length === 0;
    return {
        pass,
        expected: 'events.length === 0',
        got: `events.length=${mocks.events.length}`
    };
});

// Test T5: annuncio in pausa viene fatto ripartire
runTest('T5', 'annuncio in pausa viene fatto ripartire', {
    duration: 15,
    readyState: 4,
    paused: true,
    ct: 0,
    conPulsanteSkip: false
}, (mocks, instantSkip) => {
    instantSkip(mocks.player);
    const pass = mocks.playCalls.n === 1;
    return {
        pass,
        expected: 'playCalls.n === 1',
        got: `playCalls.n=${mocks.playCalls.n}`
    };
});

// Test T6: pulsante di salto assente non lancia eccezioni
runTest('T6', 'pulsante di salto assente non lancia eccezioni', {
    duration: 15,
    readyState: 4,
    paused: false,
    ct: 0,
    conPulsanteSkip: false
}, (mocks, instantSkip) => {
    let exception = null;
    try {
        for (let i = 0; i < 10; i++) {
            instantSkip(mocks.player);
        }
    } catch (e) {
        exception = e;
    }
    const pass = exception === null;
    return {
        pass,
        expected: 'nessuna eccezione',
        got: exception ? exception.message : 'nessuna eccezione'
    };
});

// Test T7: pulsante di salto presente viene cliccato
runTest('T7', 'pulsante di salto presente viene cliccato', {
    duration: 15,
    readyState: 4,
    paused: false,
    ct: 0,
    conPulsanteSkip: true
}, (mocks, instantSkip) => {
    for (let i = 0; i < 3; i++) {
        mocks.video.currentTime += 0.5;
        instantSkip(mocks.player);
    }
    const pass = mocks.skipButton.clicked === 3;
    return {
        pass,
        expected: 'skipButton.clicked === 3',
        got: `skipButton.clicked=${mocks.skipButton.clicked}`
    };
});

// Test T8: playbackRate viene alzato
runTest('T8', 'playbackRate viene alzato', {
    duration: 15,
    readyState: 4,
    paused: false,
    ct: 0,
    conPulsanteSkip: false
}, (mocks, instantSkip) => {
    instantSkip(mocks.player);
    const pass = mocks.video.playbackRate === 16;
    return {
        pass,
        expected: 'video.playbackRate === 16',
        got: `video.playbackRate=${mocks.video.playbackRate}`
    };
});

// --- Output finale ---
const passed = results.filter(Boolean).length;
console.log(`RISULTATO: ${passed}/8 passati`);
if (passed < 8) {
    process.exit(1);
}
