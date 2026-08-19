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

// Estrae "let ultimoControlloQualita = 0;" + la funzione forzaQualitaMassima
// che la chiude, cosi' il test funzionale puo' eseguire il vero codice del
// sorgente (non un suo doppione) con lo stato di modulo intatto.
function extractQualityFuncSrc(strippedSrc) {
    const marker = 'let ultimoControlloQualita = 0;';
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
// ultimoControlloQualita, per poterla chiamare piu' volte nello stesso test.
function buildForzaQualitaMassima(funcSrc) {
    const factory = new Function(funcSrc + '\nreturn forzaQualitaMassima;');
    return factory();
}

// Come buildForzaQualitaMassima ma restituisce anche abbassaQualitaAnnuncio.
// funcSrc (estratto da extractQualityFuncSrc) contiene gia' entrambe le
// funzioni in testo, perche' abbassaQualitaAnnuncio e' dichiarata tra il
// marker e forzaQualitaMassima: condividono lo stato di modulo
// (qualitaAlzataPer), necessario per T24/T25.
function buildQualityFns(funcSrc) {
    const factory = new Function(funcSrc +
        '\nreturn { abbassaQualitaAnnuncio: typeof abbassaQualitaAnnuncio === "function" ? abbassaQualitaAnnuncio : null, forzaQualitaMassima: forzaQualitaMassima };');
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

    // T3: la qualita' si abbassa SOLO dentro abbassaQualitaAnnuncio (unica
    // finestra, per la durata dell'annuncio); ovunque altro si puo' solo
    // ALZARE. "tiny" come MINIMO di un range (bordo basso aperto, vedi
    // forzaQualitaMassima/abbassaQualitaAnnuncio) resta legittimo ovunque: non
    // abbassa nulla, allarga il range verso il basso per non bloccare
    // l'annuncio o il contenuto su una risoluzione assente (fix 3.5.81). E'
    // vietato: setPlaybackQuality diretto a "tiny" fuori da
    // abbassaQualitaAnnuncio, o un range il cui MASSIMO (secondo argomento)
    // sia "tiny" -- quello si' abbasserebbe il tetto ovunque si trovi.
    const abbassaRange = extractFunctionRange(src, 'abbassaQualitaAnnuncio');
    const DIRECT_LOW_QUALITY = /setPlaybackQuality(?!Range)\s*\(\s*["']tiny["']/g;
    let directLowQualityOk = true;
    let dlqMatch;
    while ((dlqMatch = DIRECT_LOW_QUALITY.exec(src)) !== null) {
        const insideAbbassa = abbassaRange !== null &&
            dlqMatch.index >= abbassaRange.start && dlqMatch.index < abbassaRange.end;
        if (!insideAbbassa) { directLowQualityOk = false; break; }
    }
    const RANGE_MAX_TINY = /setPlaybackQualityRange\s*\([^,]+,\s*["']tiny["']\s*\)/g;
    const noRangeMaxTiny = !RANGE_MAX_TINY.test(src);
    const noForzaQualitaMinima = !src.includes('forzaQualitaMinima');
    t(target, 'T3', 'la qualita\' si abbassa SOLO dentro abbassaQualitaAnnuncio, altrove solo alzare',
        abbassaRange !== null && directLowQualityOk && noRangeMaxTiny && noForzaQualitaMinima);

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

    t(target, 'T12', 'ultimoControlloQualita azzerata nel listener yt-navigate-finish',
        /yt-navigate-finish[\s\S]{0,400}?ultimoControlloQualita\s*=\s*0/.test(src));

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

    // T14: throttle a parte (0 all'istanziazione della closure, quindi la
    // prima chiamata passa sempre), verifica l'invariante centrale della
    // correzione: se la qualita' e' scesa sotto il massimo -- YouTube la
    // riapplica anche a video gia' avviato -- va rialzata, non ignorata.
    let t14ok = false;
    if (funcSrc) {
        const calls = [];
        const fn14 = buildForzaQualitaMassima(funcSrc);
        fn14({
            getAvailableQualityLevels: function () { return ['hd2160', 'hd1080', 'tiny', 'auto']; },
            getPlaybackQuality: function () { return 'tiny'; },
            setPlaybackQuality: function (q) { calls.push(q); },
            setPlaybackQualityRange: function () {},
        });
        t14ok = calls.includes('hd2160');
    }
    t(target, 'T14', 'qualita\' scesa sotto il massimo: viene rialzata anche a video gia\' avviato', t14ok);

    let t16ok = false;
    if (funcSrc) {
        const calls = [];
        const fn16 = buildForzaQualitaMassima(funcSrc);
        fn16({
            getAvailableQualityLevels: function () { return ['hd2160', 'hd1080', 'tiny', 'auto']; },
            getPlaybackQuality: function () { return 'hd2160'; },
            setPlaybackQuality: function (q) { calls.push(q); },
            setPlaybackQualityRange: function () {},
        });
        t16ok = calls.length === 0;
    }
    t(target, 'T16', 'qualita\' gia\' al massimo: nessuna chiamata a setPlaybackQuality', t16ok);

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

    // T17: il range non viene mai congelato sul massimo (causa dello stallo
    // 3.5.80: un annuncio senza quella risoluzione mandava il player in
    // stallo dietro l'overlay nero).
    t(target, 'T17', 'forzaQualitaMassima non congela il range: mai setPlaybackQualityRange(migliore, migliore), il minimo resta "tiny"',
        forzaQualitaBody !== null &&
        !/setPlaybackQualityRange\s*\(\s*migliore\s*,\s*migliore\s*\)/.test(forzaQualitaBody) &&
        /setPlaybackQualityRange\s*\(\s*["']tiny["']\s*,\s*migliore\s*\)/.test(forzaQualitaBody));

    // T18: onAdStart riapre il range a qualunque risoluzione prima dello skip
    // (ora tramite abbassaQualitaAnnuncio, che dalla 3.5.82 gestisce anche
    // l'abbassamento a "tiny"), cosi' l'annuncio trova sempre una traccia
    // compatibile.
    const abbassaQualitaAnnuncioBody = extractFunctionBody(src, 'abbassaQualitaAnnuncio');
    t(target, 'T18', 'onAdStart riapre il range con ("tiny","highres") tramite abbassaQualitaAnnuncio',
        onAdStartBody !== null && /abbassaQualitaAnnuncio\s*\(\s*player\s*\)/.test(onAdStartBody) &&
        abbassaQualitaAnnuncioBody !== null &&
        /setPlaybackQualityRange\s*\(\s*["']tiny["']\s*,\s*["']highres["']\s*\)/.test(abbassaQualitaAnnuncioBody));

    // T19: rete di sicurezza sull'overlay -- non deve mai restare a vita.
    const onAdEndBody = extractFunctionBody(src, 'onAdEnd');
    t(target, 'T19', 'overlayTimer + OVERLAY_MAX_MS: armato in onAdStart, azzerato in onAdEnd',
        src.includes('let overlayTimer = null;') &&
        src.includes('const OVERLAY_MAX_MS') &&
        onAdStartBody !== null && /overlayTimer\s*=\s*setTimeout/.test(onAdStartBody) &&
        onAdEndBody !== null && /overlayTimer\s*=\s*null/.test(onAdEndBody));

    // T20: funzionale -- con livelli [hd2160,hd1080,tiny,auto], il PRIMO
    // argomento di setPlaybackQualityRange deve essere "tiny", mai il
    // migliore: il basso resta sempre raggiungibile anche durante un annuncio.
    let t20ok = false;
    if (funcSrc) {
        const rangeCalls = [];
        const fn20 = buildForzaQualitaMassima(funcSrc);
        fn20({
            getAvailableQualityLevels: function () { return ['hd2160', 'hd1080', 'tiny', 'auto']; },
            getPlaybackQuality: function () { return 'tiny'; },
            setPlaybackQuality: function () {},
            setPlaybackQualityRange: function (min, max) { rangeCalls.push([min, max]); },
        });
        t20ok = rangeCalls.length === 1 && rangeCalls[0][0] === 'tiny';
    }
    t(target, 'T20', 'chiamata reale a setPlaybackQualityRange: primo argomento sempre "tiny"', t20ok);

    // T21: abbassaQualitaAnnuncio esiste ed e' chiamata SOLO da onAdStart --
    // mai da checkPlayer ne' dal ramo contenuto.
    const abbassaOccorrenze = (src.match(/abbassaQualitaAnnuncio\s*\(/g) || []).length;
    t(target, 'T21', "abbassaQualitaAnnuncio esiste ed e' chiamata solo da onAdStart",
        abbassaQualitaAnnuncioBody !== null &&
        onAdStartBody !== null && /abbassaQualitaAnnuncio\s*\(\s*player\s*\)/.test(onAdStartBody) &&
        checkPlayerBody !== null && !/abbassaQualitaAnnuncio/.test(checkPlayerBody) &&
        abbassaOccorrenze === 2);

    // T22: il range va riaperto PRIMA di abbassare la qualita' (anti-stallo):
    // altrimenti un annuncio privo del livello corrente resta bloccato.
    let t22ok = false;
    if (abbassaQualitaAnnuncioBody !== null) {
        const rangeMatch = /setPlaybackQualityRange\s*\(\s*["']tiny["']\s*,\s*["']highres["']\s*\)/.exec(abbassaQualitaAnnuncioBody);
        const qualityMatch = /setPlaybackQuality\s*\(\s*["']tiny["']\s*\)/.exec(abbassaQualitaAnnuncioBody);
        t22ok = rangeMatch !== null && qualityMatch !== null && rangeMatch.index < qualityMatch.index;
    }
    t(target, 'T22', "abbassaQualitaAnnuncio riapre il range (tiny,highres) prima di abbassare", t22ok);

    // T23: azzera la guardia per-video, altrimenti dopo l'annuncio
    // forzaQualitaMassima crederebbe il rialzo gia' fatto (vedi T25).
    t(target, 'T23', "abbassaQualitaAnnuncio azzera qualitaAlzataPer",
        abbassaQualitaAnnuncioBody !== null && /qualitaAlzataPer\s*=\s*null/.test(abbassaQualitaAnnuncioBody));

    // T24: funzionale -- il player finto riceve davvero setPlaybackQuality("tiny")
    // e un setPlaybackQualityRange il cui SECONDO argomento e' "highres".
    let t24ok = false;
    if (funcSrc) {
        const built24 = buildQualityFns(funcSrc);
        if (built24.abbassaQualitaAnnuncio) {
            const calls = [];
            const rangeCalls = [];
            built24.abbassaQualitaAnnuncio({
                setPlaybackQuality: function (q) { calls.push(q); },
                setPlaybackQualityRange: function (min, max) { rangeCalls.push([min, max]); },
            });
            t24ok = calls.includes('tiny') &&
                rangeCalls.length > 0 && rangeCalls[rangeCalls.length - 1][1] === 'highres';
        }
    }
    t(target, 'T24', 'abbassaQualitaAnnuncio: player riceve setPlaybackQuality("tiny") e range con 2° arg "highres"', t24ok);

    // T25: sequenza completa, anti-regressione del "144p persistente" (3.5.57).
    // Un annuncio a 16x puo' durare meno del throttle di forzaQualitaMassima
    // (2s): la prima chiamata arma il throttle sul video corrente, poi
    // l'annuncio abbassa la qualita' e SUBITO DOPO (dentro la finestra di
    // throttle) forzaQualitaMassima deve comunque rialzare al massimo.
    let t25ok = false;
    if (funcSrc) {
        const built25 = buildQualityFns(funcSrc);
        if (built25.abbassaQualitaAnnuncio && built25.forzaQualitaMassima) {
            let quality = 'hd2160';
            const fakeVideo = { currentSrc: 'blob:adoff-test-video' };
            const player = {
                querySelector: function () { return fakeVideo; },
                getAvailableQualityLevels: function () { return ['hd2160', 'hd1080', 'tiny', 'auto']; },
                getPlaybackQuality: function () { return quality; },
                setPlaybackQuality: function (q) { quality = q; },
                setPlaybackQualityRange: function () {},
            };
            built25.forzaQualitaMassima(player);      // gia' al massimo: arma il throttle
            built25.abbassaQualitaAnnuncio(player);    // ANNUNCIO: qualita' scende a tiny
            built25.forzaQualitaMassima(player);       // subito dopo, dentro il throttle: deve rialzare
            t25ok = quality === 'hd2160';
        }
    }
    t(target, 'T25', "sequenza abbassaQualitaAnnuncio->forzaQualitaMassima: torna a hd2160 anche dentro il throttle", t25ok);
}

console.log(pass + '/' + tot + ' PASS');
process.exit(pass === tot ? 0 : 1);
