'use strict';
// Anti-regressione per i due meccanismi anti-tempo-morto della v3.5.57:
//  A) qualita' forzata al minimo durante l'annuncio (un ad a 144p si scarica
//     in una frazione del tempo, quindi il fast-forward a 16x diventa davvero
//     istantaneo invece di aspettare la rete);
//  B) ricarica del video con loadVideoById se dopo 1,5s l'annuncio resiste
//     (la nuova richiesta player passa dai nostri hook e puo' arrivare pulita).
// Esegue davvero il codice estratto dal sorgente, con player e video finti.

const fs = require('fs');
const path = require('path');

const SRC = path.resolve(__dirname, '../../app/src/stealth.js');
const src = fs.readFileSync(SRC, 'utf8');

const a = src.indexOf('let adActive = false;');
const b = src.indexOf('// ---- LAYER C:');
if (a < 0 || b < 0) {
    console.error('Marcatori della sezione Layer B non trovati: il test non puo\' validare nulla');
    process.exit(1);
}
const blocco = src.slice(a, b);

function load() {
    const win = {
        ytInitialPlayerResponse: { videoDetails: { lengthSeconds: '600' } },
        dispatchEvent() {},
        __adoffYtDiag: {}
    };
    const doc = {
        getElementById: () => null,
        createElement: () => ({ style: {}, remove() {} })
    };
    return new Function('window', 'document', 'CustomEvent', 'setInterval', 'clearInterval',
        blocco + '\nreturn {onAdStart,onAdEnd};')(win, doc, function () {}, setInterval, clearInterval);
}

function mk(o) {
    const v = {
        duration: 30, currentTime: 0, currentSrc: 'blob:ad', playbackRate: 1,
        muted: false, paused: false,
        buffered: { length: 1, end: () => 12 },
        play: () => Promise.resolve()
    };
    const p = {
        querySelector: s => s === 'video' ? v : (s.includes('ytp-ad-player-overlay') ? {} : null),
        querySelectorAll: () => [],
        classList: { contains: () => o.ad !== false },
        appendChild() {},
        getPlaybackQuality: () => 'hd1080',
        setPlaybackQuality: q => o.log.push('setQ:' + q),
        setPlaybackQualityRange: x => o.log.push('setRange:' + x)
    };
    // Un player che non espone le API di ricarica non deve far esplodere nulla.
    if (!o.senzaApi) {
        p.getVideoData = () => ({ video_id: 'VID123' });
        p.loadVideoById = x => o.log.push('load:' + x.videoId + '@' + x.startSeconds);
    }
    return { p, v };
}

(async () => {
    let pass = 0, tot = 0;
    const t = (id, d, ok) => {
        tot++;
        if (ok) { pass++; console.log('PASS ' + id + ': ' + d); }
        else console.log('FAIL ' + id + ': ' + d);
    };

    // T1 — la qualita' scende all'inizio dell'annuncio: e' cio' che rende
    // efficace il fast-forward, perche' i byte da scaricare crollano.
    {
        const o = { log: [], ad: true }; const { p } = mk(o); const m = load();
        m.onAdStart(p);
        t('T1', 'qualita\' forzata al minimo durante l\'annuncio',
            o.log.some(x => x === 'setRange:tiny' || x === 'setQ:tiny'));
        m.onAdEnd(p);
    }

    // T2 — e va ripristinata, altrimenti l'utente si ritrova il contenuto a 144p.
    {
        const o = { log: [], ad: true }; const { p } = mk(o); const m = load();
        m.onAdStart(p); o.log.length = 0; m.onAdEnd(p);
        t('T2', 'qualita\' ripristinata a fine annuncio', o.log.some(x => x.includes('hd1080')));
    }

    // T3 — se l'annuncio resiste oltre 1,5s si ricarica il video.
    {
        const o = { log: [], ad: true }; const { p } = mk(o); const m = load();
        m.onAdStart(p);
        await new Promise(r => setTimeout(r, 1900));
        t('T3', 'ricarica del video se l\'annuncio resiste oltre 1,5s',
            o.log.some(x => x.startsWith('load:VID123')));
        m.onAdEnd(p);
    }

    // T4 — ma NON si ricarica se l'annuncio e' finito da solo: una ricarica
    // a sproposito interromperebbe il contenuto gia' ripartito.
    {
        const o = { log: [], ad: true }; const { p } = mk(o); const m = load();
        m.onAdStart(p);
        await new Promise(r => setTimeout(r, 200));
        o.ad = false; m.onAdEnd(p);
        await new Promise(r => setTimeout(r, 1900));
        t('T4', 'nessuna ricarica se l\'annuncio finisce prima',
            !o.log.some(x => x.startsWith('load:')));
    }

    // T5 — player senza le API di ricarica: nessuna eccezione.
    {
        const o = { log: [], ad: true, senzaApi: true }; const { p } = mk(o); const m = load();
        let err = null;
        try { m.onAdStart(p); await new Promise(r => setTimeout(r, 1900)); } catch (e) { err = e; }
        t('T5', 'nessun errore se il player non espone le API di ricarica', !err);
        m.onAdEnd(p);
    }

    console.log(pass + '/' + tot + ' PASS');
    process.exit(pass === tot ? 0 : 1);
})();
