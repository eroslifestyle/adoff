'use strict';
// Anti-regressione architetturale FadBlock (Layer A + Layer B), sui 3 target.
//
// Layer A (isAdKey/stripAdObj): strip preventivo dei campi ad-scheduling dalla
// risposta player PRIMA che il player la legga. adaptiveFormats (qualita'
// video) e' esplicitamente escluso -- e' la difesa piu' stabile del progetto,
// non deve mai regredire.
//
// Layer B (instantSkip): fallback per gli annunci che superano il Layer A.
// SOLO playbackRate=16 dietro un overlay opaco + click sul bottone skip.
// Banditi in questa funzione:
//   - seek (currentTime =): l'annuncio e il contenuto condividono lo stesso
//     <video> (MSE source switching); seekare causava salti di posizione.
//     Rimosso in v3.5.52, rientrato per errore in v3.5.55, ri-rimosso il
//     2026-08-19. Regola d'oro del progetto: MAI seekare currentTime su un
//     player MSE che condivide il <video> tra ad e contenuto.
//   - reload (loadVideoById): ripartiva da un punto casuale del contenuto.
//   - forzatura qualita' verso il basso (setPlaybackQuality/Range su "tiny"):
//     degradava il video del contenuto dopo l'annuncio. L'API si usa
//     legittimamente per ALZARE la qualita' (forzaQualitaMassima) -- T3
//     presidia "mai per abbassare", non "mai usarla".
//
// Verifica leggendo i sorgenti reali (fs), non un mock dell'architettura.

const fs = require('fs');
const path = require('path');

const TARGETS = [
    ['chrome', path.resolve(__dirname, '../../app/src/stealth.js')],
    ['firefox', path.resolve(__dirname, '../../app-firefox/src/stealth.js')],
    ['safari', path.resolve(__dirname, '../../app-safari/src/stealth.js')],
];

// Estrae il corpo di `function name(...) { ... }` contando le graffe,
// non con una regex sull'intero file (evita falsi positivi/negativi su
// codice fuori dalla funzione).
function extractFunctionBody(src, name) {
    const sig = 'function ' + name + '(';
    const start = src.indexOf(sig);
    if (start < 0) return null;
    const braceStart = src.indexOf('{', start);
    if (braceStart < 0) return null;
    let depth = 0;
    for (let i = braceStart; i < src.length; i++) {
        if (src[i] === '{') depth++;
        else if (src[i] === '}') {
            depth--;
            if (depth === 0) return src.slice(braceStart + 1, i);
        }
    }
    return null;
}

// Come extractFunctionBody ma ritorna anche gli offset [start,end) del
// corpo, per verificare che un match testuale ricada dentro la funzione.
function extractFunctionRange(src, name) {
    const sig = 'function ' + name + '(';
    const start = src.indexOf(sig);
    if (start < 0) return null;
    const braceStart = src.indexOf('{', start);
    if (braceStart < 0) return null;
    let depth = 0;
    for (let i = braceStart; i < src.length; i++) {
        if (src[i] === '{') depth++;
        else if (src[i] === '}') {
            depth--;
            if (depth === 0) return { start: braceStart + 1, end: i };
        }
    }
    return null;
}

// Rimuove i commenti (// e /* */) prima di ogni asserzione: un test non deve
// mai poter passare perche' una stringa compare solo in un commento.
function stripComments(src) {
    return src
        .replace(/\/\*.*?\*\//g, ' ')
        .replace(/\/\/.*$/gm, '');
}

// Assegnazione a currentTime (esclude ==, ===, >=, <=, !=).
const CURRENT_TIME_ASSIGN = /(?<![=!<>])\bcurrentTime\b\s*=(?!=)/;

// Estrae "let qualitaAlzataPer = null;" + la funzione forzaQualitaMassima
// che la chiude, cosi' il test funzionale puo' eseguire il vero codice del
// sorgente (non un suo doppione) con lo stato di modulo intatto.
function extractQualityFuncSrc(strippedSrc) {
    const marker = 'let qualitaAlzataPer = null;';
    const idx = strippedSrc.indexOf(marker);
    if (idx < 0) return null;
    const sig = 'function forzaQualitaMassima(';
    const fnStart = strippedSrc.indexOf(sig, idx);
    if (fnStart < 0) return null;
    const braceStart = strippedSrc.indexOf('{', fnStart);
    if (braceStart < 0) return null;
    let depth = 0;
    for (let i = braceStart; i < strippedSrc.length; i++) {
        if (strippedSrc[i] === '{') depth++;
        else if (strippedSrc[i] === '}') {
            depth--;
            if (depth === 0) return strippedSrc.slice(idx, i + 1);
        }
    }
    return null;
}

// Costruisce una istanza di forzaQualitaMassima con closure persistente su
// qualitaAlzataPer, per poterla chiamare piu' volte nello stesso test (T14).
function buildForzaQualitaMassima(funcSrc) {
    const factory = new Function(funcSrc + '\nreturn forzaQualitaMassima;');
    return factory();
}

let pass = 0, tot = 0;
function t(target, id, desc, ok) {
    tot++;
    const label = '[' + target + '] ' + id;
    if (ok) { pass++; console.log('PASS ' + label + ': ' + desc); }
    else console.log('FAIL ' + label + ': ' + desc);
}

for (const [target, file] of TARGETS) {
    const raw = fs.readFileSync(file, 'utf8');
    const src = stripComments(raw);

    const body = extractFunctionBody(src, 'instantSkip');
    t(target, 'T1', 'instantSkip non seeka currentTime',
        body !== null && !CURRENT_TIME_ASSIGN.test(body));

    t(target, 'T2', 'nessun reload video (loadVideoById)',
        !raw.includes('loadVideoById'));

    // T3: la qualita' si puo' solo ALZARE, mai abbassare.
    const LOW_QUALITY_CALL = /setPlaybackQuality(Range)?\s*\(\s*["']tiny["']/g;
    const noLowQualityCall = !LOW_QUALITY_CALL.test(src);
    const noForzaQualitaMinima = !src.includes('forzaQualitaMinima');
    const massimaRange = extractFunctionRange(src, 'forzaQualitaMassima');
    const QUALITY_CALL = /setPlaybackQuality(Range)?\s*\(/g;
    let allCallsInsideMassima = massimaRange !== null;
    let match;
    while ((match = QUALITY_CALL.exec(src)) !== null) {
        if (match.index < massimaRange.start || match.index >= massimaRange.end) {
            allCallsInsideMassima = false;
        }
    }
    t(target, 'T3', 'la qualita\' si puo\' solo alzare, mai abbassare',
        noLowQualityCall && noForzaQualitaMinima && allCallsInsideMassima);

    t(target, 'T4', 'playbackRate = 16 assegnato dentro instantSkip (unico fallback Layer B)',
        body !== null && /\bplaybackRate\s*=\s*16\b/.test(body));

    t(target, 'T5', 'overlay skip attivato e disattivato (setSkipOverlay true/false)',
        /setSkipOverlay\s*\([^)]*,\s*true\s*\)/.test(src) &&
        /setSkipOverlay\s*\([^)]*,\s*false\s*\)/.test(src));

    t(target, 'T6', 'savedRate assegnato e riusato nel ripristino',
        /\bsavedRate\s*=\s*video\.playbackRate/.test(src) &&
        /video\.playbackRate\s*=\s*savedRate/.test(src));

    t(target, 'T7', 'wasMuted presente (ripristino audio a fine annuncio)',
        src.includes('wasMuted'));

    t(target, 'T8', 'click sul pulsante skip presente',
        src.includes('.ytp-ad-skip-button') && src.includes('skip.click()'));

    const isAdKeyBody = extractFunctionBody(src, 'isAdKey');
    t(target, 'T9', 'Layer A intatto: isAdKey con /^ad[A-Z]/ e adaptiveFormats escluso',
        isAdKeyBody !== null &&
        isAdKeyBody.includes('/^ad[A-Z]/') &&
        /adaptiveFormats/.test(isAdKeyBody));

    const forzaQualitaBody = extractFunctionBody(src, 'forzaQualitaMassima');
    t(target, 'T10', 'forzaQualitaMassima definita e usa getAvailableQualityLevels',
        forzaQualitaBody !== null && forzaQualitaBody.includes('getAvailableQualityLevels'));

    const checkPlayerBody = extractFunctionBody(src, 'checkPlayer');
    const onAdStartBody = extractFunctionBody(src, 'onAdStart');
    t(target, 'T11', 'forzaQualitaMassima(p) chiamata in checkPlayer, NON in onAdStart',
        checkPlayerBody !== null && /forzaQualitaMassima\s*\(\s*p\s*\)/.test(checkPlayerBody) &&
        onAdStartBody !== null && !/forzaQualitaMassima/.test(onAdStartBody));

    t(target, 'T12', 'qualitaAlzataPer azzerata nel listener yt-navigate-finish',
        /yt-navigate-finish[\s\S]{0,400}?qualitaAlzataPer\s*=\s*null/.test(src));

    // T13-T15: esecuzione funzionale del codice reale (non un doppione).
    const funcSrc = extractQualityFuncSrc(src);

    let t13ok = false;
    if (funcSrc) {
        const calls = [];
        const fn13 = buildForzaQualitaMassima(funcSrc);
        fn13({
            getAvailableQualityLevels: function () { return ['hd2160', 'hd1080', 'hd720', 'tiny', 'auto']; },
            getVideoData: function () { return { video_id: 'vid1' }; },
            setPlaybackQuality: function (q) { calls.push(q); },
            setPlaybackQualityRange: function () {},
        });
        t13ok = calls.includes('hd2160') && !calls.includes('auto') && !calls.includes('tiny');
    }
    t(target, 'T13', 'con livelli [hd2160,hd1080,hd720,tiny,auto] chiama setPlaybackQuality("hd2160")', t13ok);

    let t14ok = false;
    if (funcSrc) {
        const calls = [];
        const fn14 = buildForzaQualitaMassima(funcSrc);
        const player = {
            getAvailableQualityLevels: function () { return ['hd2160', 'hd1080', 'hd720']; },
            getVideoData: function () { return { video_id: 'vid1' }; },
            setPlaybackQuality: function (q) { calls.push(q); },
            setPlaybackQualityRange: function () {},
        };
        fn14(player);
        const afterFirst = calls.length;
        fn14(player);
        t14ok = afterFirst > 0 && calls.length === afterFirst;
    }
    t(target, 'T14', 'stesso video_id chiamato due volte: la seconda non fa nulla', t14ok);

    let t15ok = false;
    if (funcSrc) {
        const calls = [];
        const fn15 = buildForzaQualitaMassima(funcSrc);
        try {
            fn15({
                getAvailableQualityLevels: function () { return []; },
                getVideoData: function () { return { video_id: 'vid1' }; },
                setPlaybackQuality: function (q) { calls.push(q); },
                setPlaybackQualityRange: function () {},
            });
            t15ok = calls.length === 0;
        } catch (_) {
            t15ok = false;
        }
    }
    t(target, 'T15', 'lista livelli vuota: nessuna eccezione e nessuna chiamata a setPlaybackQuality', t15ok);
}

console.log(pass + '/' + tot + ' PASS');
process.exit(pass === tot ? 0 : 1);
