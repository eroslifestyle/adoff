'use strict';
// Anti-regressione per il Layer B minimale (solo playbackRate, nessun seek).
// Analisi statica sul sorgente reale: verifica che non ci siano seek e che
// playbackRate=16 sia presente. Il seek (currentTime=) era la causa di tutti
// i bug di posizione della sessione 2026-07-30.

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
        desc: 'ogni seek è protetto da canSeekAd',
        // Il seek è tornato per eliminare i tempi morti del fast‑forward (a 16x il player deve comunque scaricare l'annuncio, quindi l'attesa resta) e le guardie sono ciò che lo rende sicuro.
        check() {
            // Trova righe con assegnazione a currentTime (escludendo confronti)
            const seekLines = codeLines
                .map((l, i) => ({ line: l, idx: i }))
                .filter(({ line }) => /currentTime\s*=/.test(line) && !/(?:===|!==|==|!=)/.test(line));
            if (seekLines.length === 0) {
                return "nessuna assegnazione a currentTime trovata: il seek chirurgico deve esistere per eliminare i tempi morti del fast‑forward (a 16x il player deve comunque scaricare l'annuncio, quindi l'attesa resta)";
            }
            if (seekLines.length > 1) {
                return "trovate " + seekLines.length + " assegnazioni a currentTime: " + seekLines.map(s => s.line.trim()).join('; ') + " (deve essercene esattamente una, quella dentro instantSkip)";
            }
            // Esattamente un seek: verifica che la guardia canSeekAd lo preceda
            const seekIdx = seekLines[0].idx;
            const guardIdx = codeLines.findIndex(l => /canSeekAd\s*\(/.test(l) && !/function\s+canSeekAd/.test(l) && /\bif\s*\(/.test(l));
            if (guardIdx === -1) {
                return "nessuna chiamata a canSeekAd( nel blocco: il seek deve essere protetto da una guardia";
            }
            if (!(guardIdx < seekIdx)) {
                return "seek precede la guardia canSeekAd: la protezione deve essere verificata prima del seek";
            }
            return null;
        }
    },
    {
        id: 'T3b',
        desc: 'il target del seek è limitato dal buffer',
        // Limitare il target al fine del buffer impedisce stalli infiniti (v3.5.46)
        check() {
            const hasTargetLimit = codeLines.some(l => /Math\.min\s*\(/.test(l) && /bufEnd/.test(l));
            if (!hasTargetLimit) {
                return "nel blocco manca il calcolo del target con Math.min( che limiti il seek a bufEnd: un seek oltre buffered.end causava lo stallo infinito della v3.5.46";
            }
            return null;
        }
    },
    {
        id: 'T3c',
        desc: 'le guardie anti-regressione sono presenti',
        // Le guardie anti-regressione assicurano che il seek non causi comportamenti indesiderati
        check() {
            const required = [
                { pattern: /180/, name: 'confronto con 180 (nessun annuncio supera i 180s)' },
                { pattern: /ytp-ad-player-overlay/, name: 'ytp-ad-player-overlay (il DOM dell\'annuncio deve esistere)' },
                { pattern: /contentSrc/, name: 'contentSrc (confronto con la sorgente del contenuto)' },
                { pattern: /stableTicks/, name: 'stableTicks (stabilità della durata su più tick)' },
                { pattern: /getContentDuration/, name: 'getContentDuration (anti-regressione 3.5.48)' }
            ];
            const missing = required
                .filter(r => !codeLines.some(l => r.pattern.test(l)))
                .map(r => r.name);
            if (missing.length > 0) {
                return "mancano le seguenti guardie anti-regressione: " + missing.join('; ');
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
