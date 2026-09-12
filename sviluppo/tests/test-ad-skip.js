'use strict';
// Anti-regressione per il Layer B (playbackRate + skip integrale protetto).
// Analisi statica sui sorgenti reali: playbackRate=16 presente, e nessun seek
// NON protetto. Il seek "chirurgico" senza guardia era la causa di tutti i
// bug di posizione della sessione 2026-07-30 (rimosso il 2026-08-19). Con la
// 3.5.84 e' rientrato in forma protetta: un solo currentTime=, dentro
// skipIntegrale, dietro la guardia mediaMontatoEAnnuncio() che confronta la
// durata del media montato con quella del contenuto e non salta mai senza
// un riferimento certo. T3 verifica che sia rimasto esattamente cosi'.

const fs = require('fs');
const path = require('path');

const stealthPath = path.resolve(__dirname, '../../app/src/stealth.js');
const src = fs.readFileSync(stealthPath, 'utf8');

// Estrai solo la sezione YouTube (da LAYER B a fine activateYoutubeRuntimeKiller)
const start = src.indexOf('// ---- LAYER B:');
const end = src.indexOf('} // fine activateYoutubeRuntimeKiller');
if (start === -1 || end === -1) {
    console.error('Marcatori della sezione YouTube non trovati');
    process.exit(1);
}
const block = src.slice(start, end);

// Rimuovi le righe di commento per l'analisi statica
const codeLines = block.split('\n').filter(l => !l.trim().startsWith('//'));

// Estrae la sezione YouTube di un sorgente qualunque (stesso criterio di sopra).
function extractYtBlock(text) {
    const s = text.indexOf('// ---- LAYER B:');
    const e = text.indexOf('} // fine activateYoutubeRuntimeKiller');
    if (s === -1 || e === -1) return null;
    return text.slice(s, e);
}

// Estrae il corpo (comprese le graffe) di una funzione, bilanciando le graffe.
function extractFunctionBody(text, name) {
    const sigIdx = text.indexOf('function ' + name + '(');
    if (sigIdx === -1) return null;
    const braceStart = text.indexOf('{', sigIdx);
    if (braceStart === -1) return null;
    let depth = 0;
    let i = braceStart;
    for (; i < text.length; i++) {
        if (text[i] === '{') depth++;
        else if (text[i] === '}') { depth--; if (depth === 0) break; }
    }
    return { bodyStart: braceStart, bodyEnd: i, text: text.slice(braceStart, i + 1) };
}

// Invariante "nessun seek NON protetto" su un target. Ritorna null se ok,
// altrimenti il messaggio d'errore.
function checkSeekProtetto(targetName, filePath) {
    const text = fs.readFileSync(filePath, 'utf8');
    const ytBlock = extractYtBlock(text);
    if (!ytBlock) return targetName + ': marcatori sezione YouTube non trovati';

    const skipFn = extractFunctionBody(ytBlock, 'skipIntegrale');
    if (!skipFn) return targetName + ': funzione skipIntegrale non trovata';

    // a) ogni assegnazione a currentTime cade dentro skipIntegrale
    const seekRegex = /currentTime\s*=/g;
    const outside = [];
    let m;
    while ((m = seekRegex.exec(ytBlock)) !== null) {
        const afterChar = ytBlock[m.index + m[0].length];
        if (afterChar === '=') continue; // == o === (confronto, non assegnazione)
        if (m.index < skipFn.bodyStart || m.index > skipFn.bodyEnd) outside.push(m.index);
    }
    if (outside.length > 0) {
        return targetName + ': ' + outside.length + ' assegnazioni a currentTime fuori da skipIntegrale';
    }

    // b) la guardia e' la prima istruzione utile di skipIntegrale
    const bodyLines = skipFn.text.split('\n')
        .map(l => l.trim())
        .filter(l => l && l !== '{' && l !== '}' && l !== 'try {' && !l.startsWith('//'));
    if (!bodyLines[0] || !/^if\s*\(!mediaMontatoEAnnuncio\(video\)\)\s*return false;$/.test(bodyLines[0])) {
        return targetName + ': la guardia mediaMontatoEAnnuncio non e\' la prima istruzione utile di skipIntegrale (trovato: "' + (bodyLines[0] || '') + '")';
    }

    // c) mediaMontatoEAnnuncio confronta video.duration con durataContenuto() e nega senza riferimento
    const guardFn = extractFunctionBody(ytBlock, 'mediaMontatoEAnnuncio');
    if (!guardFn) return targetName + ': funzione mediaMontatoEAnnuncio non trovata';
    if (!/video\.duration/.test(guardFn.text) || !/durataContenuto\(\)/.test(guardFn.text)) {
        return targetName + ': mediaMontatoEAnnuncio non confronta video.duration con durataContenuto()';
    }
    if (!/if\s*\(!dc\)\s*return false;/.test(guardFn.text)) {
        return targetName + ': mediaMontatoEAnnuncio non ritorna false quando il riferimento sul contenuto manca';
    }

    // d) canSeekAd/getContentDuration non esistono piu' come funzioni vive
    if (/function\s+canSeekAd\s*\(/.test(ytBlock) || /function\s+getContentDuration\s*\(/.test(ytBlock)) {
        return targetName + ': canSeekAd/getContentDuration esistono ancora come funzioni vive';
    }

    return null;
}

const scenarios = [
    {
        id: 'T1',
        desc: 'playbackRate=16 presente (fast-forward durante annuncio)',
        check() {
            return codeLines.some(l => /playbackRate\s*=\s*16/.test(l))
                ? null : 'playbackRate=16 non trovato nel codice attivo';
        }
    },
    {
        id: 'T2',
        desc: 'playbackRate=1 al termine annuncio (onAdEnd reset)',
        check() {
            return codeLines.some(l => /playbackRate\s*=\s*1/.test(l))
                ? null : 'playbackRate=1 (reset post-annuncio) non trovato';
        }
    },
    {
        id: 'T3',
        desc: "nessun seek NON protetto: l'unico currentTime= sta dentro skipIntegrale, dietro la guardia mediaMontatoEAnnuncio() (seek rimosso il 2026-08-19 per i salti di posizione su player MSE, rientrato in forma protetta con la 3.5.84)",
        check() {
            const targets = [
                { name: 'chrome', file: stealthPath },
                { name: 'firefox', file: path.resolve(__dirname, '../../app-firefox/src/stealth.js') },
                { name: 'safari', file: path.resolve(__dirname, '../../app-safari/src/stealth.js') },
            ];
            const errors = targets.map(t => checkSeekProtetto(t.name, t.file)).filter(Boolean);
            return errors.length ? errors.join(' | ') : null;
        }
    },
    {
        id: 'T3b',
        desc: 'nessuna guardia/logica di seek non protetta residua (canSeekAd, bufEnd, getContentDuration, stableTicks)',
        check() {
            const residual = codeLines.filter(l =>
                /canSeekAd|getContentDuration|stableTicks|bufEnd/.test(l)
            );
            if (residual.length > 0) {
                return "trovati " + residual.length + " riferimenti al meccanismo di seek non protetto: " + residual.map(l => l.trim()).join('; ');
            }
            return null;
        }
    },
    {
        id: 'T4',
        desc: 'pulsante skip clickato (selettore skip-ad presente)',
        check() {
            return codeLines.some(l => /skip.*\.click\(\)/.test(l))
                ? null : 'click del pulsante skip non trovato';
        }
    },
    {
        id: 'T5',
        desc: 'NESSUN position recovery (era la fonte dei bug)',
        check() {
            const recovery = codeLines.filter(l =>
                /savedContentTime|tryRecover|tryPrerollReset|positionTracker/.test(l)
            );
            return recovery.length
                ? `trovati ${recovery.length} riferimenti a position recovery: ${recovery.map(l => l.trim()).join('; ')}`
                : null;
        }
    },
    {
        id: 'T6',
        desc: 'NESSUN stall watchdog ( Layer D rimosso)',
        check() {
            const stall = codeLines.filter(l =>
                /stallTimer|stallRecoveries|STALL_/.test(l)
            );
            return stall.length
                ? `trovati ${stall.length} riferimenti allo stall watchdog`
                : null;
        }
    },
];

const results = [];
for (const s of scenarios) {
    let err;
    try { err = s.check(); }
    catch (e) { err = 'eccezione: ' + e.message; }
    results.push((err ? 'FAIL ' : 'PASS ') + s.id + ': ' + s.desc + (err ? ' | ' + err : ''));
}

for (const line of results) console.log(line);
const passed = results.filter(r => r.startsWith('PASS')).length;
console.log('RISULTATO: ' + passed + '/' + scenarios.length + ' passati');
if (passed < scenarios.length) process.exit(1);
