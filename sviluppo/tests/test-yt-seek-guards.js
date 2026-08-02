'use strict';
// Carichiamo i moduli built-in
const fs   = require('fs');
const path = require('path');

// ---------------------------------------------------------
// 1. Lettura e estrazione del blocco di codice da stealth.js
// ---------------------------------------------------------
// Percorso allo script sorgente (relativo a __dirname)
const stealthPath = path.resolve(__dirname, '../../app/src/stealth.js');
let source;
try {
    source = fs.readFileSync(stealthPath, 'utf8');
} catch (e) {
    console.error('Impossibile leggere stealth.js:', e.message);
    process.exit(1);
}

// Marcatori che delimitano il blocco da estrarre
const START_MARKER = 'let adActive = false;';
const END_MARKER   = '// ---- LAYER C:';

const startIdx = source.indexOf(START_MARKER);
const endIdx   = source.indexOf(END_MARKER);

if (startIdx === -1 || endIdx === -1) {
    console.error('Marcatore non trovato nel file stealth.js.');
    console.error('Assicurati che il file contenga sia "let adActive = false;" '
                  + 'sia "// ---- LAYER C:".');
    process.exit(1);
}

// Estraiamo il testo compreso tra i due marcatori (inizio incluso, fine esclusa)
const block = source.slice(startIdx, endIdx);

// ---------------------------------------------------------
// 2. Definizione delle funzioni di supporto
// ---------------------------------------------------------

/**
 * Carica il modulo stealth restituendo un oggetto con i metodi
 * canSeekAd e instantSkip, iniettando il blocco di codice estratto.
 * @param {object} win - oggetto finestra fittizio
 * @returns {object} {canSeekAd, instantSkip}
 */
function loadModule(win) {
    // Creiamo una Function con i parametri che lo script si aspetta
    return new Function(
        'window', 'document', 'CustomEvent', 'setInterval', 'clearInterval',
        block + '\nreturn {canSeekAd,instantSkip};'
    )(
        win,
        {
            getElementById: () => null,
            createElement: () => ({ style: {}, remove() {} })
        },
        function() {}, // CustomEvent fittizio
        () => 0,       // setInterval fittizio (non usato)
        () => {}       // clearInterval fittizio (non usato)
    );
}

/**
 * Crea un oggetto video simulato con le proprietà necessarie.
 * @param {object} o - valori da sovrascrivere (duration, currentTime, bufferedEnd, …)
 * @returns {object} video fittizio
 */
function mkVideo(o) {
    return {
        duration:      o.duration      || 0,
        currentTime:   o.currentTime   || 0,
        currentSrc:    o.currentSrc    || 'blob:ad',
        playbackRate:  1,
        muted:         false,
        paused:        false,
        buffered: {
            length: 1,
            end: () => o.bufferedEnd || 0
        },
        play: () => Promise.resolve()
    };
}

/**
 * Crea un oggetto player simulato.
 * @param {object} v - video da restituire con querySelector('video')
 * @param {boolean} hasAd - se true, la query per l'overlay annuncio restituisce un oggetto
 * @returns {object} player fittizio
 */
function mkPlayer(v, hasAd) {
    return {
        querySelector: sel => {
            if (sel === 'video') return v;
            if (sel.indexOf('ytp-ad-player-overlay') >= 0 && hasAd) return {};
            return null;
        },
        querySelectorAll: () => [],
        classList: {
            contains: () => false
        },
        appendChild() {}
    };
}

/**
 * Crea un oggetto window simulato con ytInitialPlayerResponse.
 * @param {number|undefined} len - durata del video in secondi
 * @returns {object} window fittizio
 */
function mkWin(len) {
    return {
        ytInitialPlayerResponse: len
            ? { videoDetails: { lengthSeconds: String(len) } }
            : {},
        dispatchEvent() {},
        __adoffYtDiag: {}
    };
}

// ---------------------------------------------------------
// 3. Definizione dei test
// ---------------------------------------------------------
const tests = [
    {
        id: 'T1',
        desc: 'canSeekAd false e instantSkip non lancia',
        run() {
            const m = loadModule(mkWin(600));
            const p = mkPlayer(null, true); // video assente
            const canSeekOk = m.canSeekAd(p, null) === false;
            let instantNoThrow = true;
            try {
                m.instantSkip(p);
            } catch (_) {
                instantNoThrow = false;
            }
            return canSeekOk && instantNoThrow;
        }
    },
    {
        id: 'T2',
        desc: 'anti-regressione 3.5.48, media montato e contenuto non lanuncio',
        run() {
            const m = loadModule(mkWin(150));
            const v = mkVideo({ duration: 150 });
            const p = mkPlayer(v, true);
            // Chiamare 4 volte per soddisfare la guardia di stabilita (>=2 tick con durata identica):
            // l'eventuale false all'ultima chiamata non puo essere dovuto alla stabilita,
            // ma solo ed esclusivamente alla guardia sulla durata uguale a quella del contenuto.
            m.canSeekAd(p, v);
            m.canSeekAd(p, v);
            m.canSeekAd(p, v);
            return m.canSeekAd(p, v) === false;
        }
    },
    {
        id: 'T2b',
        desc: 'controllo positivo T2: durata contenuto diversa dal media, nessun lanuncio',
        run() {
            const m = loadModule(mkWin(600));
            // Durata del contenuto (30) diversa dalla durata del media montato (600):
            // la guardia anti-3.5.48 non scatta perche la differenza supera 1.5s.
            const v = mkVideo({ duration: 30, bufferedEnd: 12 });
            const p = mkPlayer(v, true);
            // Stesse 4 chiamate di T2 per dimostrare che non e il numero di chiamate
            // a causare il false, bensi la guardia sulla durata.
            m.canSeekAd(p, v);
            m.canSeekAd(p, v);
            m.canSeekAd(p, v);
            return m.canSeekAd(p, v) === true;
        }
    },
    {
        id: 'T3',
        desc: 'instantSkip imposta playbackRate 16 e avanza currentTime entro buffer',
        run() {
            const m = loadModule(mkWin(600));
            const v = mkVideo({ duration: 30, currentTime: 0, bufferedEnd: 12 });
            const p = mkPlayer(v, true);
            // Chiamiamo instantSkip 4 volte come richiesto
            for (let i = 0; i < 4; i++) m.instantSkip(p);
            return (
                v.playbackRate === 16 &&
                v.currentTime > 0 &&
                v.currentTime <= 12
            );
        }
    },
    {
        id: 'T4',
        desc: 'mai oltre il bordo del buffer, oltre causava stallo v3.5.46',
        run() {
            const m = loadModule(mkWin(600));
            const v = mkVideo({ duration: 30, currentTime: 0, bufferedEnd: 5 });
            const p = mkPlayer(v, true);
            for (let i = 0; i < 4; i++) m.instantSkip(p);
            return v.currentTime <= 5;
        }
    }
];

// ---------------------------------------------------------
// 4. Esecuzione dei test e reporting
// ---------------------------------------------------------
let passCount = 0;
for (const t of tests) {
    const ok = t.run();
    if (ok) {
        console.log(`PASS ${t.id} ${t.desc}`);
        passCount++;
    } else {
        console.log(`FAIL ${t.id} ${t.desc}`);
    }
}

// Riepilogo finale
console.log(`${passCount}/${tests.length} PASS`);
if (passCount < tests.length) process.exit(1);
