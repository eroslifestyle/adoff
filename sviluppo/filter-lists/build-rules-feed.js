#!/usr/bin/env node

/**
 * build-rules-feed.js
 * Costruisce il rule-feed per l'estensione Chrome MV3
 */

const fs = require('fs');
const path = require('path');
const { isValidUrlFilter, describeInvalid } = require('./abp-urlfilter');
const { selectWithQuotas, summarizeSelection, loadLiveFilters } = require('./rule-priority');

// === COSTANTI ===
const MAX_RULES = 29000;
const VALIDATION_THRESHOLD = 0.05; // 5%
const INITIAL_ID = 1;

/**
 * Ottiene la stringa data corrente YYYY.MM.DD
 * @returns {string}
 */
function getTodayDateString() {
  const now = new Date();
  const yyyy = now.getFullYear();
  const mm = String(now.getMonth() + 1).padStart(2, '0');
  const dd = String(now.getDate()).padStart(2, '0');
  return `${yyyy}.${mm}.${dd}`;
}

/**
 * Parsa gli argomenti da riga di comando
 * @returns {{ input: string, output: string, dryRun: boolean }}
 */
/**
 * Parsa gli argomenti da riga di comando
 * @returns {{ input: string, output: string, dryRun: boolean, live: string }}
 */
function parseArgs() {
  const args = process.argv.slice(2);
  const result = {
    input: path.join(__dirname, 'generated-rules.json'),
    output: path.join(__dirname, '..', '..', 'site', 'rules-feed.json'),
    dryRun: false,
    // Il feed attualmente in produzione e' la fonte del tier LIVE della
    // prioritizzazione, e va tenuto sganciato da --out cosi' si puo'
    // generare un feed di prova altrove senza perdere il confronto con
    // quello vivo.
    live: path.join(__dirname, '..', '..', 'site', 'rules-feed.json')
  };

  for (let i = 0; i < args.length; i++) {
    if (args[i] === '--in' && args[i + 1]) {
      result.input = args[++i];
    } else if (args[i] === '--out' && args[i + 1]) {
      result.output = args[++i];
    } else if (args[i] === '--live' && args[i + 1]) {
      result.live = args[++i];
    } else if (args[i] === '--dry-run') {
      result.dryRun = true;
    }
  }

  return result;
}

/**
 * Carica le regole sorgente da file JSON
 * @param {string} inputPath
 * @returns {Array<Object>}
 */
function loadRules(inputPath) {
  if (!fs.existsSync(inputPath)) {
    console.error(`ERRORE: file non trovato: ${inputPath}`);
    process.exit(1);
  }
  const content = fs.readFileSync(inputPath, 'utf8');
  const data = JSON.parse(content);
  if (!Array.isArray(data.rules)) {
    console.error(`ERRORE: formato file non valido, expected { rules: [...] }`);
    process.exit(1);
  }
  return data.rules;
}

/**
 * Valida le regole usando isValidUrlFilter
 * @param {Array<Object>} rules
 * @returns {{ valid: Array<Object>, invalidExamples: Array<string> }}
 */
function validateRules(rules) {
  const valid = [];
  const invalidExamples = [];

  for (const rule of rules) {
    const urlFilter = rule.condition?.urlFilter;
    if (isValidUrlFilter(urlFilter)) {
      valid.push(rule);
    } else {
      // Serve il pattern, non solo il motivo: senza non si risale al bug a monte.
      invalidExamples.push(`[${describeInvalid(urlFilter)}] ${String(urlFilter).slice(0, 80)}`);
    }
  }

  return { valid, invalidExamples };
}

/**
 * Rimuove duplicati basati su condition.urlFilter (prima occorrenza vince)
 * @param {Array<Object>} rules
 * @returns {{ rules: Array<Object>, duplicateCount: number }}
 */
function deduplicateRules(rules) {
  const seen = new Set();
  const unique = [];

  for (const rule of rules) {
    const urlFilter = rule.condition?.urlFilter;
    if (!seen.has(urlFilter)) {
      seen.add(urlFilter);
      unique.push(rule);
    }
  }

  return {
    rules: unique,
    duplicateCount: rules.length - unique.length
  };
}

/**
 * Tronca regole se superano MAX_RULES
 * Il client applica le regole a blocchi di 2000 con cap letto a runtime
 * da chrome.declarativeNetRequest.MAX_NUMBER_OF_DYNAMIC_RULES (30000) meno margine;
 * 29000 sta sotto quel limite. NON usa MAX_NUMBER_OF_DYNAMIC_AND_SESSION_RULES (5000).
 * @param {Array<Object>} rules
 * @returns {{ rules: Array<Object>, truncatedCount: number }}
 */
function truncateRules(rules) {
  if (rules.length <= MAX_RULES) {
    return { rules, truncatedCount: 0 };
  }
  return {
    rules: rules.slice(0, MAX_RULES),
    truncatedCount: rules.length - MAX_RULES
  };
}

/**
 * Riassegna id progressivi da INITIAL_ID
 * @param {Array<Object>} rules
 * @returns {Array<Object>}
 */
function reassignIds(rules) {
  return rules.map((rule, index) => {
    // _source e' metadato interno di prioritizzazione: DNR rifiuta le proprieta'
    // sconosciute e farebbe fallire l'intero blocco di updateDynamicRules().
    const { _source, ...clean } = rule;
    return { ...clean, id: INITIAL_ID + index };
  });
}

/**
 * Calcola la prossima versione YYYY.MM.DD.N
 * Se esiste gia' con data odierna, incrementa N; altrimenti N = 1
 * @param {string} today
 * @param {string|undefined} existingVersion
 * @returns {string}
 */
function getNextVersion(today, existingVersion) {
  if (!existingVersion) {
    return `${today}.1`;
  }

  const parts = existingVersion.split('.');
  if (parts.length !== 4) {
    return `${today}.1`;
  }

  const existingDate = `${parts[0]}.${parts[1]}.${parts[2]}`;
  if (existingDate === today) {
    return `${today}.${parseInt(parts[3], 10) + 1}`;
  }

  return `${today}.1`;
}

/**
 * Scrive il feed su file in formato compatto
 * @param {string} outputPath
 * @param {Object} feed
 */
function writeFeed(outputPath, feed) {
  const dir = path.dirname(outputPath);
  if (!fs.existsSync(dir)) {
    fs.mkdirSync(dir, { recursive: true });
  }
  fs.writeFileSync(outputPath, JSON.stringify(feed));
}

/**
 * Verifica il file scritto: JSON valido, ruleCount corretto, urlFilter validi
 * @param {string} outputPath
 * @param {number} expectedRuleCount
 * @param {number} expectedVersion
 */
function verifyFeed(outputPath, expectedRuleCount, expectedVersion) {
  const content = fs.readFileSync(outputPath, 'utf8');
  const feed = JSON.parse(content);

  if (feed.ruleCount !== expectedRuleCount) {
    console.error(`ERRORE verifica: ruleCount mismatch (atteso ${expectedRuleCount}, letto ${feed.ruleCount})`);
    process.exit(1);
  }

  if (feed.rules.length !== expectedRuleCount) {
    console.error(`ERRORE verifica: rules.length mismatch (atteso ${expectedRuleCount}, letto ${feed.rules.length})`);
    process.exit(1);
  }

  if (feed.version !== expectedVersion) {
    console.error(`ERRORE verifica: version mismatch (attesa ${expectedVersion}, letta ${feed.version})`);
    process.exit(1);
  }

  for (const rule of feed.rules) {
    if (!isValidUrlFilter(rule.condition?.urlFilter)) {
      console.error(`ERRORE verifica: urlFilter invalido nella regola id=${rule.id}`);
      process.exit(1);
    }
  }
}

/**
 * Stampa il report finale
 * @param {Object} stats
 */
function printReport(stats) {
  console.log(`Totale iniziale: ${stats.initialCount}`);
  console.log(`Scartate (urlFilter invalido): ${stats.invalidCount}`);
  if (stats.invalidExamples.length > 0) {
    console.log(`  Primi 10 esempi:`);
    stats.invalidExamples.slice(0, 10).forEach(ex => console.log(`    - ${ex}`));
  }
  console.log(`Duplicate rimosse: ${stats.duplicateCount}`);
  console.log(`Troncate: ${stats.truncatedCount}`);
  console.log(`Totale finale: ${stats.finalCount}`);
  console.log(`Versione: ${stats.version}`);
  console.log(`Dimensione: ${(stats.fileSizeBytes / (1024 * 1024)).toFixed(3)} MB`);
  console.log(`Output: ${stats.outputPath}`);
}

// === MAIN ===
const args = parseArgs();
console.log('=== BUILD RULES FEED ===\n');

// Step 1: carica le regole sorgente
const sourceRules = loadRules(args.input);
const initialCount = sourceRules.length;
console.log(`Caricate ${initialCount} regole da: ${args.input}`);

// Step 2: validazione urlFilter
const { valid, invalidExamples } = validateRules(sourceRules);
const validCount = valid.length;
const invalidCount = initialCount - validCount;

// GATE DI VALIDAZIONE: se > 5% invalide, esci con errore
if (invalidCount > initialCount * VALIDATION_THRESHOLD) {
  console.error('\nERRORE: il generatore a monte sta producendo urlFilter non validi');
  console.error(`Esempi (primi 10):`);
  invalidExamples.slice(0, 10).forEach(ex => console.error(`  - ${ex}`));
  process.exit(1);
}

// Step 3: dedup per urlFilter
const { rules: dedupedRules, duplicateCount } = deduplicateRules(valid);

// Step 3-bis: prioritizza PRIMA del cap, altrimenti si tronca in ordine di file
// e si buttano regole utili tenendone di irrilevanti.
const liveFilters = loadLiveFilters(args.live);
console.log(`Feed live di riferimento: ${liveFilters.size} urlFilter (${args.live})`);
const truncatedRules = selectWithQuotas(dedupedRules, liveFilters, MAX_RULES);
const truncatedCount = dedupedRules.length - truncatedRules.length;
console.log('\nSelezione per tier (quote 60% curate / 40% continuita):');
console.log(summarizeSelection(truncatedRules, dedupedRules, liveFilters));
if (truncatedCount > 0) {
  console.log(`Attenzione: ${truncatedCount} regole scartate per superamento cap (${MAX_RULES})`);
}

// Step 5: riassegna id progressivi
const finalRules = reassignIds(truncatedRules);
const finalCount = finalRules.length;

// Step 6: calcola versione
const today = getTodayDateString();
let existingVersion;
if (!args.dryRun && fs.existsSync(args.output)) {
  try {
    const existing = JSON.parse(fs.readFileSync(args.output, 'utf8'));
    existingVersion = existing.version;
  } catch {
    existingVersion = undefined;
  }
}
const version = getNextVersion(today, existingVersion);

// Costruisci feed
const feed = {
  version,
  updated: new Date().toISOString(),
  ruleCount: finalCount,
  rules: finalRules
};

// Calcola dimensione per report
let fileSizeBytes;
if (args.dryRun) {
  fileSizeBytes = Buffer.byteLength(JSON.stringify(feed));
} else {
  writeFeed(args.output, feed);
  fileSizeBytes = fs.statSync(args.output).size;
  // Step finale: verifica
  verifyFeed(args.output, finalCount, version);
}

// Stampa report
console.log('\n--- REPORT ---');
printReport({
  initialCount,
  invalidCount,
  invalidExamples,
  duplicateCount,
  truncatedCount,
  finalCount,
  version,
  fileSizeBytes,
  outputPath: args.output
});

if (args.dryRun) {
  console.log('\n[DRY-RUN] Nessun file scritto');
}
