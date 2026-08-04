'use strict';

const fs = require('fs');
const path = require('path');

// I path partono dalla root del progetto, non dalla cartella dello script.
const ROOT = path.resolve(__dirname, '..', '..');
const SOURCE = path.join(ROOT, 'app/rules/adblock-rules.json');
const FIREFOX = path.join(ROOT, 'app-firefox/rules/adblock-rules.json');
const SAFARI = path.join(ROOT, 'app-safari/rules/adblock-rules.json');

if (!fs.existsSync(SOURCE)) {
    console.error('File sorgente non trovato:', SOURCE);
    process.exit(1);
}

const raw = fs.readFileSync(SOURCE, 'utf8');
const rules = JSON.parse(raw);

const before = rules.length;
const withRegex = rules.filter(r => r.condition && r.condition.regexFilter).length;

const existingIds = new Set(rules.map(r => r.id));
const newIds = [934, 935, 936, 937];
const conflict = newIds.filter(id => existingIds.has(id));
if (conflict.length > 0) {
    console.log('Regole gia presenti, nessuna modifica. ID gia esistenti:', conflict.join(', '));
    process.exit(1);
}

/*
 * Queste quattro regole bloccano parametri di tracciamento che identificano
 * i circuiti pubblicitari dai quali originano i popunder. Tali parametri
 * sono presenti nell'indirizzo di partenza del popunder e non nella pagina
 * finale, quindi individuano il circuito indipendentemente dal dominio che
 * lo ospita, che varia frequentemente. Non riguardano chi visita di
 * proposito quei negozi: una navigazione intenzionale non include quei
 * parametri nell'URL.
 */
const newRules = [
    {
        id: 934,
        priority: 1,
        action: { type: 'block' },
        condition: {
            regexFilter: '[?&]pid=pprworker',
            resourceTypes: ['main_frame', 'sub_frame']
        }
    },
    {
        id: 935,
        priority: 1,
        action: { type: 'block' },
        condition: {
            regexFilter: '[?&]cps_sk=[A-Za-z0-9]',
            resourceTypes: ['main_frame', 'sub_frame']
        }
    },
    {
        id: 936,
        priority: 1,
        action: { type: 'block' },
        condition: {
            regexFilter: '[?&]aff_short_key=',
            resourceTypes: ['main_frame', 'sub_frame']
        }
    },
    {
        id: 937,
        priority: 1,
        action: { type: 'block' },
        condition: {
            regexFilter: '[?&]aff_plateform=',
            resourceTypes: ['main_frame', 'sub_frame']
        }
    }
];

rules.push(...newRules);

const output = JSON.stringify(rules, null, 2) + '\n';

fs.writeFileSync(SOURCE, output);
fs.writeFileSync(FIREFOX, output);
fs.writeFileSync(SAFARI, output);

const after = rules.length;
const withRegexAfter = rules.filter(r => r.condition && r.condition.regexFilter).length;

console.log('Regole:', before, '->', after);
console.log('Con regexFilter:', withRegex, '->', withRegexAfter);
console.log('Aggiunti ID:', newIds.join(', '));
