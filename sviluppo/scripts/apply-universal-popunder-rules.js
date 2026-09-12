const fs = require('fs');
const path = require('path');

const SOURCE_FILE = 'app/rules/adblock-rules.json';
const TARGETS = [
    'app/rules/adblock-rules.json',
    'app-firefox/rules/adblock-rules.json',
    'app-safari/rules/adblock-rules.json'
];

const rules = JSON.parse(fs.readFileSync(SOURCE_FILE, 'utf8'));

const beforeCount = rules.length;
const beforeRegexCount = rules.filter(r => r.condition.regexFilter).length;

// Cerca la regola 931 per sostituzione
const ruleIndex = rules.findIndex(r => r.id === 931);
if (ruleIndex === -1) {
    console.error('Regola con id 931 non trovata in', SOURCE_FILE);
    process.exit(1);
}

// Controlla se gli id 932-934 esistono già
const existingNewIds = [932, 933, 934].filter(id => rules.some(r => r.id === id));
if (existingNewIds.length > 0) {
    console.error('Id', existingNewIds.join(', '), 'esistono già.bloccato per idempotenza.');
    process.exit(1);
}

// Sostituzione regola 931: da singolo sottodominio a pattern per intera famiglia di domini
// Il punto e' scritto come classe [.] e non come sequenza di escape: evita del
// tutto il doppio livello di escape stringa-JS + regex, dove sbagliare e' facile.
rules[ruleIndex] = {
    id: 931,
    priority: 1,
    action: { type: 'block' },
    condition: {
        regexFilter: '^https?://ay[0-9]{1,5}[.]com/',
        resourceTypes: ['script', 'xmlhttprequest', 'sub_frame', 'ping', 'main_frame']
    }
};

const modifiedIds = [931];

// Aggiunge due regole per pattern popunder comuni ad network
rules.push(
    // Popunder con path numerico: /[1-2 cifre]/[7+ cifre] - es. crn77.com/4/11028335
    {
        id: 932,
        priority: 1,
        action: { type: 'block' },
        condition: {
            regexFilter: '^https?://[^/]+/[0-9]{1,2}/[0-9]{7,}$',
            resourceTypes: ['main_frame', 'sub_frame']
        }
    },
    // Popunder con parametro zoneid a 3+ cifre - es. ?zoneid=12345
    {
        id: 933,
        priority: 1,
        action: { type: 'block' },
        condition: {
            regexFilter: '[?&]zoneid=[0-9]{3,}',
            resourceTypes: ['script', 'sub_frame', 'xmlhttprequest', 'main_frame']
        }
    }
);

const afterCount = rules.length;
const afterRegexCount = rules.filter(r => r.condition.regexFilter).length;

// Scrive su tutti i target
for (const target of TARGETS) {
    const dir = path.dirname(target);
    if (!fs.existsSync(dir)) {
        fs.mkdirSync(dir, { recursive: true });
    }
    fs.writeFileSync(target, JSON.stringify(rules, null, 2) + '\n');
}

// Resoconto finale
console.log('Regole totali:   ' + beforeCount + ' -> ' + afterCount);
console.log('regexFilter:     ' + beforeRegexCount + ' -> ' + afterRegexCount);
console.log('Modificati:      ' + modifiedIds.join(', '));
console.log('Aggiunti:        932, 933');
console.log('Scritti in:      ' + TARGETS.join(', '));
