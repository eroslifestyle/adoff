const fs = require('fs');
const path = require('path');

const MAX_RULES = 29000;
const DEFAULT_FEED = 'site/rules-feed.json';

// Marcatori che indicano sintassi regex invece di ABP
const REGEX_MARKERS = /\[\\[\^]|\\w|https?:\/\//;
// Estrae dominio dopo ')*' fino a fine stringa
const DOMAIN_EXTRACT = /\)\*([A-Za-z0-9][A-Za-z0-9.\-]*\.[A-Za-z]{2,})$/;
// Verifica se gia in formato ABP valido
const ABP_PATTERN = /^\|\|/;

function isPlausibleDomain(d) {
  return d && d.includes('.') && !d.includes(' ') && d.length <= 253;
}

function parseVersion(v) {
  if (!v) return null;
  const parts = v.split('.');
  if (parts.length < 4) return null;
  return { date: parts.slice(0, 3).join('.'), n: parseInt(parts[3], 10) };
}

const feedPath = path.resolve(process.argv[2] || DEFAULT_FEED);
const backupPath = feedPath + '.bak';

console.log('File input:', feedPath);

if (!fs.existsSync(feedPath)) {
  console.error('ERRORE: file non trovato');
  process.exit(1);
}

const sizeBefore = fs.statSync(feedPath).size;

// Backup se non esiste
if (!fs.existsSync(backupPath)) {
  fs.copyFileSync(feedPath, backupPath);
  console.log('Backup salvato:', backupPath);
}

const raw = fs.readFileSync(feedPath, 'utf8');
const feed = JSON.parse(raw);

const rules = feed.regole || feed.rules || [];
let totalIniziali = rules.length;
let convertite = 0;
let giaValide = 0;
let nonConvertibili = 0;

const seen = new Set();
const risultato = [];

for (const rule of rules) {
  const f = rule.condition?.urlFilter || '';
  
  if (seen.has(f)) continue;
  seen.add(f);
  
  // Gia sintassi ABP valida
  if (ABP_PATTERN.test(f) || !REGEX_MARKERS.test(f)) {
    giaValide++;
    risultato.push(rule);
    continue;
  }
  
  // Prova a estrarre dominio e convertire
  const m = f.match(DOMAIN_EXTRACT);
  if (m && isPlausibleDomain(m[1])) {
    const nuovo = '||' + m[1];
    if (!seen.has(nuovo)) {
      seen.add(nuovo);
      convertite++;
      risultato.push({
        ...rule,
        condition: { ...rule.condition, urlFilter: nuovo }
      });
    }
  } else {
    nonConvertibili++;
  }
}

const duplicateRimosse = totalIniziali - (convertite + giaValide + nonConvertibili);

// Troncamento
let troncate = 0;
if (risultato.length > MAX_RULES) {
  troncate = risultato.length - MAX_RULES;
  risultato.length = MAX_RULES;
}

// Riassegna ID progressivi
risultato.forEach((r, i) => { r.id = i + 1; });

// Aggiorna header
// Formato versione storico del feed: YYYY.MM.DD.N (punti, non trattini)
const today = new Date().toISOString().slice(0, 10).replace(/-/g, ".");
const oldVersion = parseVersion(feed.version);
let newN = 1;
if (oldVersion && oldVersion.date === today) {
  newN = oldVersion.n + 1;
}

feed.version = `${today}.${newN}`;
feed.ruleCount = risultato.length;
feed.updated = new Date().toISOString();

// Scrive output
if (feed.regole) {
  feed.regole = risultato;
} else {
  feed.rules = risultato;
}

// Compatto, non pretty-print: il feed viene scaricato dal service worker a ogni sync
fs.writeFileSync(feedPath, JSON.stringify(feed));

const sizeAfter = fs.statSync(feedPath).size;
const newVer = feed.version;

console.log('\n=== REPORT ===');
console.log('Totale iniziale:', totalIniziali);
console.log('Convertite da regex:', convertite);
console.log('Gia valide ABP:', giaValide);
console.log('Non convertibili:', nonConvertibili);
console.log('Duplicate rimosse:', duplicateRimosse);
console.log('Troncate (limite', MAX_RULES + '):', troncate);
console.log('Totale finale:', risultato.length);
console.log('Versione:', newVer);
console.log('Dimensione:',
  (sizeBefore / 1024 / 1024).toFixed(2) + ' MB -> ' +
  (sizeAfter / 1024 / 1024).toFixed(2) + ' MB'
);
