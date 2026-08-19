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
//   - forzatura qualita' (setPlaybackQuality/setPlaybackQualityRange):
//     degradava il video del contenuto dopo l'annuncio.
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

// Rimuove i commenti (// e /* */) prima di ogni asserzione: un test non deve
// mai poter passare perche' una stringa compare solo in un commento.
function stripComments(src) {
    return src
        .replace(/\/\*.*?\*\//g, ' ')
        .replace(/\/\/.*$/gm, '');
}

// Assegnazione a currentTime (esclude ==, ===, >=, <=, !=).
const CURRENT_TIME_ASSIGN = /(?<![=!<>])\bcurrentTime\b\s*=(?!=)/;

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

    t(target, 'T3', 'nessuna forzatura qualita\' (setPlaybackQuality)',
        !raw.includes('setPlaybackQuality'));

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
}

console.log(pass + '/' + tot + ' PASS');
process.exit(pass === tot ? 0 : 1);
