'use strict';
const fs = require('fs');
const path = require('path');

// ----------------------------------------------------------------------
// Lettura del file sorgente stealth.js
// ----------------------------------------------------------------------
const stealthPath = path.resolve(__dirname, '../../app/src/stealth.js');
let src;
try {
    src = fs.readFileSync(stealthPath, 'utf8');
} catch (e) {
    console.error('Errore durante la lettura di stealth.js:', e.message);
    process.exit(1);
}

// ----------------------------------------------------------------------
// Estrazione del blocco di codice che contiene «instantSkip»
// ----------------------------------------------------------------------
const MARK_START = '// Terminazione immediata';
const MARK_RESET = 'function resetAdSkipState';
const i = src.indexOf(MARK_START);
const j = src.indexOf(MARK_RESET);

if (i === -1 || j === -1) {
    console.error('Marcatori non trovati nel file stealth.js');
    process.exit(1);
}

// Trova la chiusura della funzione resetAdSkipState
const searchFrom = j + MARK_RESET.length;
const k = src.indexOf('\n    }', searchFrom);
if (k === -1) {
    console.error('Chiusura della funzione resetAdSkipState non trovata');
    process.exit(1);
}

// Estrai il blocco (dal marcatore di inizio fino alla chiusura della funzione)
const block = src.slice(i, k + 6);

// Verifica minima che il blocco contenga effettivamente instantSkip
if (!block.includes('instantSkip')) {
    console.error('Il blocco estratto non contiene instantSkip');
    process.exit(1);
}

// ----------------------------------------------------------------------
// Helper per creare mock freschi ad ogni scenario
// ----------------------------------------------------------------------
function makeMocks(opts) {
    const events = [];
    const window = {
        dispatchEvent: e => events.push(e)
    };

    class CustomEvent {
        constructor(type, options) {
            this.type = type;
            this.detail = options && options.detail;
        }
    }

    const playCalls = { n: 0 };

    const video = {
        currentTime: opts.ct,
        duration: opts.duration,
        readyState: opts.readyState,
        paused: !!opts.paused,
        playbackRate: 1,
        // Il buffer copre per default l'intera durata — e' il caso dell'annuncio
        // corto, gia' scaricato per intero. Gli scenari che simulano dati
        // incompleti passano bufEnd esplicito e possono farlo crescere.
        buffered: {
            length: 1,
            end() {
                if (opts.bufEnd !== undefined) return opts.bufEnd;
                return isFinite(opts.duration) ? opts.duration : 0;
            }
        },
        play() {
            playCalls.n++;
            return Promise.resolve();
        }
    };

    const skipButton = opts.conSkip ? {
        offsetParent: {},
        clicked: 0,
        click() { this.clicked++; }
    } : null;

    const player = {
        querySelector(sel) {
            if (sel === 'video') return video;
            // Qualunque altro selettore e' quello del pulsante di salto: nel
            // codice reale e' una lista lunga (.ytp-skip-ad-button, ...), non
            // una stringa breve, quindi non va confrontata per uguaglianza.
            return skipButton;
        },
        querySelectorAll() { return []; }
    };

    return { window, CustomEvent, video, events, playCalls, skipButton, player, opts };
}

// ----------------------------------------------------------------------
// Costruisce le funzioni istanziate con i mock
// ----------------------------------------------------------------------
function buildFunctions(window, CustomEvent, isFinite, Math) {
    const code = block + '; return {instantSkip,resetAdSkipState};';
    // new Function permette di eseguire il blocco come funzione
    const fn = new Function('window', 'CustomEvent', 'isFinite', 'Math', code);
    return fn(window, CustomEvent, isFinite, Math);
}

// ----------------------------------------------------------------------
// Definizione dei 9 scenari di test
// ----------------------------------------------------------------------
const scenarios = [
    {
        id: 'T1',
        desc: '1 chiamata con durata 15, readyState 4, video non in pausa',
        opts: { ct: 0, duration: 15, readyState: 4, paused: false, conSkip: false },
        calls: 1,
        after: null,
        check(m) {
            if (m.events.length !== 1) return 'events.length atteso 1, ottenuto ' + m.events.length;
            if (m.events[0].type !== 'adoff-ad-ended') return 'tipo evento atteso adoff-ad-ended, ottenuto ' + m.events[0].type;
            if (!(Math.abs(m.video.currentTime - 14.85) < 0.01)) return 'currentTime atteso ~14.85, ottenuto ' + m.video.currentTime;
            return null;
        }
    },
    {
        id: 'T2',
        desc: '5 chiamate con durata NaN, readyState 0',
        opts: { ct: 0, duration: NaN, readyState: 0, paused: false, conSkip: false },
        calls: 5,
        after: null,
        check(m) {
            if (m.events.length !== 0) return 'events.length atteso 0, ottenuto ' + m.events.length;
            return null;
        }
    },
    {
        id: 'T3',
        desc: '5 chiamate reimpostando currentTime a 0 dopo ogni chiamata',
        opts: { ct: 0, duration: 15, readyState: 4, paused: false, conSkip: false },
        calls: 5,
        after(m) { m.video.currentTime = 0; },
        check(m) {
            if (m.events.length !== 1) return 'events.length atteso 1, ottenuto ' + m.events.length;
            return null;
        }
    },
    {
        id: 'T4',
        desc: 'Sequenza: instantSkip, resetAdSkipState, currentTime=0, instantSkip',
        opts: { ct: 0, duration: 15, readyState: 4, paused: false, conSkip: false },
        manualSequence: true,
        check(m) {
            if (m.events.length !== 2) return 'events.length atteso 2, ottenuto ' + m.events.length;
            return null;
        }
    },
    {
        id: 'T5',
        desc: 'Video in pausa, 1 chiamata deve invocare play',
        opts: { ct: 0, duration: 15, readyState: 4, paused: true, conSkip: false },
        calls: 1,
        after: null,
        check(m) {
            if (m.playCalls.n !== 1) return 'playCalls.n atteso 1, ottenuto ' + m.playCalls.n;
            return null;
        }
    },
    {
        id: 'T6',
        desc: '5 chiamate con durata Infinity, nessun evento',
        opts: { ct: 100, duration: Infinity, readyState: 4, paused: false, conSkip: false },
        calls: 5,
        after: null,
        check(m) {
            if (m.events.length !== 0) return 'events.length atteso 0, ottenuto ' + m.events.length;
            return null;
        }
    },
    {
        id: 'T7',
        desc: 'conSkip false, 5 chiamate non devono lanciare eccezioni',
        opts: { ct: 0, duration: 15, readyState: 4, paused: false, conSkip: false },
        calls: 5,
        after: null,
        check() {
            return null; // Il solo fatto di non lanciare eccezioni è verificato nel runner
        }
    },
    {
        id: 'T8',
        desc: 'conSkip true, 3 chiamate devono invocare click 3 volte',
        opts: { ct: 0, duration: 15, readyState: 4, paused: false, conSkip: true },
        calls: 3,
        after: null,
        check(m) {
            if (m.skipButton === null) return 'skipButton è null';
            if (m.skipButton.clicked !== 3) return 'skipButton.clicked atteso 3, ottenuto ' + m.skipButton.clicked;
            return null;
        }
    },
    {
        id: 'T9',
        desc: '1 chiamata deve impostare playbackRate a 16',
        opts: { ct: 0, duration: 15, readyState: 4, paused: false, conSkip: false },
        calls: 1,
        after: null,
        check(m) {
            if (m.video.playbackRate !== 16) return 'playbackRate atteso 16, ottenuto ' + m.video.playbackRate;
            return null;
        }
    },
    {
        // Il bug osservato: annuncio da 40s con buffer fermo a 12s. Seekando a
        // 39.85 il player clampa al bordo del buffer e resta ad aspettare i
        // segmenti mancanti — spinner al posto del salto.
        id: 'T10',
        desc: 'buffer corto: il salto non deve superare i dati scaricati',
        opts: { ct: 0, duration: 40, readyState: 4, paused: false, conSkip: false, bufEnd: 12 },
        calls: 3,
        after: null,
        check(m) {
            if (m.video.currentTime > 12) {
                return 'seek a ' + m.video.currentTime + ': oltre il buffer (12), il player si blocchera';
            }
            if (!(Math.abs(m.video.currentTime - 11.75) < 0.01)) {
                return 'currentTime atteso ~11.75 (bordo buffer meno margine), ottenuto ' + m.video.currentTime;
            }
            if (m.events.length !== 0) {
                return 'annuncio dato per terminato con il buffer a 12 su 40: non lo e';
            }
            return null;
        }
    },
    {
        // Il buffer cresce mentre l'annuncio scorre accelerato: il polling deve
        // inseguirlo fino alla fine vera.
        id: 'T11',
        desc: 'buffer che cresce: il salto lo insegue fino a terminare l annuncio',
        opts: { ct: 0, duration: 40, readyState: 4, paused: false, conSkip: false, bufEnd: 12 },
        calls: 1,
        after(m) { m.opts.bufEnd = 40; },
        callsDopo: 1,
        check(m) {
            if (!(Math.abs(m.video.currentTime - 39.85) < 0.01)) {
                return 'currentTime atteso ~39.85 dopo la crescita del buffer, ottenuto ' + m.video.currentTime;
            }
            if (m.events.length !== 1) {
                return 'events.length atteso 1 a fine annuncio, ottenuto ' + m.events.length;
            }
            return null;
        }
    }
];

// ----------------------------------------------------------------------
// Esecuzione dei test
// ----------------------------------------------------------------------
const results = [];

for (const scenario of scenarios) {
    const mocks = makeMocks(scenario.opts);
    let instantSkip, resetAdSkipState;

    try {
        const fns = buildFunctions(mocks.window, mocks.CustomEvent, isFinite, Math);
        instantSkip = fns.instantSkip;
        resetAdSkipState = fns.resetAdSkipState;
    } catch (e) {
        results.push('FAIL ' + scenario.id + ': ' + scenario.desc + ' | errore costruzione: ' + e.message);
        continue;
    }

    // Reset dello stato ad inizio di ogni scenario
    try {
        resetAdSkipState();
    } catch (e) {
        results.push('FAIL ' + scenario.id + ': ' + scenario.desc + ' | errore resetAdSkipState: ' + e.message);
        continue;
    }

    let exception = null;
    try {
        if (scenario.manualSequence) {
            // Scenario T4: sequenza manuale
            instantSkip(mocks.player);
            resetAdSkipState();
            mocks.video.currentTime = 0;
            instantSkip(mocks.player);
        } else {
            for (let c = 0; c < scenario.calls; c++) {
                instantSkip(mocks.player);
                if (scenario.after) scenario.after(mocks);
            }
            // Chiamate ulteriori dopo la modifica applicata da «after»: servono
            // agli scenari in cui il buffer cresce fra un tentativo e l'altro.
            for (let c = 0; c < (scenario.callsDopo || 0); c++) {
                instantSkip(mocks.player);
            }
        }
    } catch (e) {
        exception = e;
    }

    // T7 deve completare senza eccezioni
    if (scenario.id === 'T7') {
        if (exception) {
            results.push('FAIL ' + scenario.id + ': ' + scenario.desc + ' | atteso nessuna eccezione, ottenuto: ' + exception.message);
            continue;
        }
    } else {
        if (exception) {
            results.push('FAIL ' + scenario.id + ': ' + scenario.desc + ' | eccezione: ' + exception.message);
            continue;
        }
    }

    const err = scenario.check(mocks);
    if (err) {
        results.push('FAIL ' + scenario.id + ': ' + scenario.desc + ' | ' + err);
    } else {
        results.push('PASS ' + scenario.id + ': ' + scenario.desc);
    }
}

// ----------------------------------------------------------------------
// Output dei risultati e codice di uscita
// ----------------------------------------------------------------------
for (const line of results) {
    console.log(line);
}

const passed = results.filter(r => r.startsWith('PASS')).length;
console.log('RISULTATO: ' + passed + '/' + scenarios.length + ' passati');
if (passed < scenarios.length) {
    process.exit(1);
}
