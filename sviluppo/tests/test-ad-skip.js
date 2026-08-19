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
        desc: 'nessun seek chirurgico residuo (rimosso il 2026-08-19, causava salti di posizione su player MSE)',
        check() {
            const seekLines = codeLines
                .filter(l => /currentTime\s*=/.test(l) && !/(?:===|!==|==|!=)/.test(l));
            if (seekLines.length > 0) {
                return "trovate " + seekLines.length + " assegnazioni a currentTime: " + seekLines.map(l => l.trim()).join('; ') + " (il seek e' stato rimosso, non deve rientrare)";
            }
            return null;
        }
    },
    {
        id: 'T3b',
        desc: 'nessuna guardia/logica di seek residua (canSeekAd, bufEnd, getContentDuration, stableTicks)',
        check() {
            const residual = codeLines.filter(l =>
                /canSeekAd|getContentDuration|stableTicks|bufEnd/.test(l)
            );
            if (residual.length > 0) {
                return "trovati " + residual.length + " riferimenti al meccanismo di seek rimosso: " + residual.map(l => l.trim()).join('; ');
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
