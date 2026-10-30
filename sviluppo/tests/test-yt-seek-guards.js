'use strict';
const fs   = require('fs');
const path = require('path');

const stealthPath = path.resolve(__dirname, '../../app/src/stealth.js');
let source;
try {
    source = fs.readFileSync(stealthPath, 'utf8');
} catch (e) {
    console.error('Impossibile leggere stealth.js:', e.message);
    process.exit(1);
}

const START_MARKER = 'let adActive = false;';
const END_MARKER   = '// ---- LAYER C:';

const startIdx = source.indexOf(START_MARKER);
const endIdx   = source.indexOf(END_MARKER);

if (startIdx === -1 || endIdx === -1) {
    console.error('Marcatore non trovato nel file stealth.js.');
    process.exit(1);
}

const block = source.slice(startIdx, endIdx);

function loadModule(win) {
    return new Function(
        'window', 'document', 'CustomEvent', 'setInterval', 'clearInterval',
        block + '\nreturn {durataContenuto,mediaMontatoEAnnuncio,skipIntegrale};'
    )(
        win,
        { getElementById: () => null, createElement: () => ({ style: {}, remove() {} }) },
        function() {},
        () => 0,
        () => {}
    );
}

function mkVideo(o) {
    return {
        duration:      o.duration      || 0,
        currentTime:   o.currentTime   || 0,
        currentSrc:    o.currentSrc    || 'blob:ad',
        playbackRate:  1,
        muted:         false,
        paused:        false,
        buffered: { length: 1, end: () => o.bufferedEnd || 0 },
        play: () => Promise.resolve()
    };
}

function mkPlayer(v) {
    return {
        querySelector: sel => sel === 'video' ? v : null,
        querySelectorAll: () => [],
        classList: { contains: () => false },
        appendChild() {}
    };
}

function mkWin(len) {
    return {
        ytInitialPlayerResponse: len !== undefined
            ? { videoDetails: { lengthSeconds: String(len) } }
            : {},
        dispatchEvent() {},
        __adoffYtDiag: { adSkipIntegrali: 0 }
    };
}

const tests = [
    {
        id: 'T1',
        desc: 'nessun video: mediaMontatoEAnnuncio(null) === false',
        run() {
            const m = loadModule(mkWin(600));
            let noThrow = true;
            let mmeaResult = false;
            let siResult = false;
            try {
                mmeaResult = m.mediaMontatoEAnnuncio(null);
                siResult = m.skipIntegrale(mkPlayer(null), null);
            } catch (_) { noThrow = false; }
            return noThrow && mmeaResult === false && siResult === false;
        }
    },
    {
        id: 'T2',
        desc: 'anti-regressione: durata uguale (150=150) => false',
        run() {
            const m = loadModule(mkWin(150));
            const v = mkVideo({ duration: 150, currentTime: 0 });
            const p = mkPlayer(v);
            const mmea = m.mediaMontatoEAnnuncio(v);
            const si = m.skipIntegrale(p, v);
            return mmea === false && si === false && v.currentTime === 0;
        }
    },
    {
        id: 'T3',
        desc: 'nessun riferimento: ytInitialPlayerResponse senza videoDetails => false',
        run() {
            const m = loadModule(mkWin());
            const v = mkVideo({ duration: 30, currentTime: 0 });
            const p = mkPlayer(v);
            const mmea = m.mediaMontatoEAnnuncio(v);
            const si = m.skipIntegrale(p, v);
            return mmea === false && si === false && v.currentTime === 0;
        }
    },
    {
        id: 'T4',
        desc: 'controllo positivo: contenuto 600s, media 30s => true, skipIntegrale seek a 29.9',
        run() {
            const m = loadModule(mkWin(600));
            const v = mkVideo({ duration: 30, currentTime: 0 });
            const p = mkPlayer(v);
            const mmea = m.mediaMontatoEAnnuncio(v);
            const si = m.skipIntegrale(p, v);
            return mmea === true && si === true && Math.abs(v.currentTime - 29.9) < 0.01;
        }
    },
    {
        id: 'T5',
        desc: 'mai all indietro: currentTime gia a 29.95 => false',
        run() {
            const m = loadModule(mkWin(600));
            const v = mkVideo({ duration: 30, currentTime: 29.95 });
            const p = mkPlayer(v);
            const si = m.skipIntegrale(p, v);
            return si === false && v.currentTime >= 29.95;
        }
    },
    {
        id: 'T6',
        desc: 'differenza entro soglia: contenuto 150s, media 151s (diff=1 <= 2) => false',
        run() {
            const m = loadModule(mkWin(150));
            const v = mkVideo({ duration: 151, currentTime: 0 });
            const p = mkPlayer(v);
            const mmea = m.mediaMontatoEAnnuncio(v);
            return mmea === false;
        }
    }
];

let passCount = 0;
for (const t of tests) {
    const ok = t.run();
    if (ok) {
        console.log('PASS ' + t.id + ' ' + t.desc);
        passCount++;
    } else {
        console.log('FAIL ' + t.id + ' ' + t.desc);
    }
}

console.log(passCount + '/' + tests.length + ' PASS');
if (passCount < tests.length) process.exit(1);
