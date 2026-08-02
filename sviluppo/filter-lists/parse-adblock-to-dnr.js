#!/usr/bin/env node

const fs = require('fs');
const path = require('path');

const {
  abpToUrlFilter,
  hostsDomainToUrlFilter,
  isValidUrlFilter,
  describeInvalid
} = require('./abp-urlfilter');

const AD_TYPES = ['script', 'image', 'stylesheet', 'font', 'object', 'xmlhttprequest', 'websocket', 'media', 'ping', 'other'];

const UNSUPPORTED_OPTIONS = ['scriptlet', 'csp=', 'redirect', 'removeparam', 'replace', 'rewrite'];

const INPUT_FILES = [
  'easylist_adservers.txt',
  'easylist_adservers_popup.txt',
  'easylist_specific_block.txt',
  'easylist_general_block.txt',
  'easylist_thirdparty.txt',
  'easyprivacy_general.txt',
  'easyprivacy_specific.txt',
  'stevenblack_hosts.txt'
];

const RULE_TYPE_MAP = {
  script: 'script',
  image: 'image',
  stylesheet: 'stylesheet',
  xmlhttprequest: 'xmlhttprequest',
  subdocument: 'sub_frame',
  media: 'media',
  font: 'font',
  websocket: 'websocket',
  ping: 'ping',
  other: 'other'
};

function parseABPLine(line) {
  if (!line || line.startsWith('!') || line.startsWith('[')) {
    return { valid: false, reason: 'comment/header' };
  }

  if (line.includes('##') || line.includes('#@#') || line.includes('#?#') || line.includes('#$#')) {
    return { valid: false, reason: 'cosmetic' };
  }

  const lastDollar = line.lastIndexOf('$');
  let pattern = line;
  let opts = '';

  if (lastDollar !== -1) {
    pattern = line.substring(0, lastDollar);
    opts = line.substring(lastDollar + 1);
  }

  let isAllow = false;
  if (pattern.startsWith('@@')) {
    isAllow = true;
    pattern = pattern.substring(2);
  }

  const optsParts = opts ? opts.split(',') : [];

  // Estrai initiatorDomains da domain= opzioni
  const initiatorDomains = [];
  for (const part of optsParts) {
    if (part.startsWith('domain=')) {
      const domains = part.substring(7).split('|');
      for (const d of domains) {
        if (!d.startsWith('~')) {
          initiatorDomains.push(d);
        }
      }
    }
  }

  // Verifica opzioni non supportate
  for (const opt of optsParts) {
    for (const unsupported of UNSUPPORTED_OPTIONS) {
      if (opt.includes(unsupported)) {
        return { valid: false, reason: 'unsupported-opt' };
      }
    }
    if (opt === 'third-party' || opt === '3p') {
      // DNR lo supporterebbe con condition.domainType='thirdParty'
      // Rinviato per non gonfiare il feed oltre il cap
      return { valid: false, reason: 'third-party' };
    }
  }

  // Mappa resource types
  const resourceTypes = [];
  for (const opt of optsParts) {
    const normalized = opt.split('=')[0];
    if (RULE_TYPE_MAP[normalized]) {
      resourceTypes.push(RULE_TYPE_MAP[normalized]);
    }
  }

  if (resourceTypes.length === 0) {
    resourceTypes.push(...AD_TYPES);
  }

  const urlFilter = abpToUrlFilter(pattern);

  if (!urlFilter) {
    return { valid: false, reason: 'invalid-pattern' };
  }

  if (!isValidUrlFilter(urlFilter)) {
    return { valid: false, reason: describeInvalid(urlFilter) };
  }

  const condition = { urlFilter, resourceTypes };
  if (initiatorDomains.length > 0) {
    condition.initiatorDomains = initiatorDomains;
  }

  return {
    valid: true,
    isAllow,
    condition
  };
}

function parseHostsLine(line) {
  if (!line || line.startsWith('#')) {
    return { valid: false, reason: 'comment/empty' };
  }

  const match = line.match(/^(0\.0\.0\.0|127\.0\.0\.1)\s+(\S+)/);
  if (!match) {
    return { valid: false, reason: 'invalid-format' };
  }

  const dominio = match[2].toLowerCase();

  if (['localhost', 'localhost.localdomain', 'local', 'broadcasthost', '0.0.0.0'].includes(dominio)) {
    return { valid: false, reason: 'localhost/reserved' };
  }

  const urlFilter = hostsDomainToUrlFilter(dominio);

  if (!urlFilter) {
    return { valid: false, reason: 'invalid-domain' };
  }

  if (!isValidUrlFilter(urlFilter)) {
    return { valid: false, reason: describeInvalid(urlFilter) };
  }

  return {
    valid: true,
    isAllow: false,
    condition: { urlFilter, resourceTypes: AD_TYPES }
  };
}

const rules = [];
let ruleId = 1000;
let totalProcessed = 0;
const discarded = {};
const perFileStats = {};
const seenRules = new Set();

for (const file of INPUT_FILES) {
  const filePath = path.join(__dirname, file);

  if (!fs.existsSync(filePath)) {
    console.log(`  ${file}: NOT FOUND`);
    continue;
  }

  const content = fs.readFileSync(filePath, 'utf8');
  const lines = content.split('\n');
  const isHosts = file === 'stevenblack_hosts.txt';

  let fileTotal = 0;
  let fileParsed = 0;
  let fileDiscarded = 0;

  for (const line of lines) {
    fileTotal++;
    totalProcessed++;

    const trimmed = line.trim();
    if (!trimmed) continue;

    let result;
    if (isHosts) {
      result = parseHostsLine(trimmed);
    } else {
      result = parseABPLine(trimmed);
    }

    if (!result.valid) {
      fileDiscarded++;
      discarded[result.reason] = (discarded[result.reason] || 0) + 1;
      continue;
    }

    fileParsed++;
    const ruleKey = `${result.isAllow ? 'allow' : 'block'}:${result.condition.urlFilter}`;

    if (seenRules.has(ruleKey)) {
      continue;
    }
    seenRules.add(ruleKey);

    const rule = {
      id: ruleId++,
      priority: 1,
      action: { type: result.isAllow ? 'allow' : 'block' },
      condition: result.condition,
      // Lista di provenienza: serve a build-rules-feed.js per la priorita' pre-cap.
      // Viene rimosso prima di scrivere il feed (DNR rifiuta proprieta' sconosciute).
      _source: file
    };

    if (result.isAllow) {
      delete rule.condition.resourceTypes;
    }

    rules.push(rule);
  }

  perFileStats[file] = { total: fileTotal, parsed: fileParsed, discarded: fileDiscarded };
  console.log(`  ${file}: ${fileParsed} rules, ${fileDiscarded} discarded`);
}

// Deduplicazione finale
const finalRules = [];
const finalSeen = new Set();

for (const rule of rules) {
  const key = `${rule.action.type}:${rule.condition.urlFilter}`;
  if (!finalSeen.has(key)) {
    finalSeen.add(key);
    finalRules.push(rule);
  }
}

// Controllo sanita'
let startingPipeCount = 0;
for (const rule of finalRules) {
  if (rule.condition.urlFilter.startsWith('||')) {
    startingPipeCount++;
  }
}

const percentage = finalRules.length > 0 ? ((startingPipeCount / finalRules.length) * 100).toFixed(1) : 0;

if (finalRules.length > 0 && startingPipeCount / finalRules.length < 0.5) {
  console.error(`ERRORE: output sospetto, il generatore sta emettendo pattern anomali`);
  console.error(`Percentuale urlFilter con '||': ${percentage}%`);
  process.exit(1);
}

// Output file
const outputRules = {
  generatedAt: new Date().toISOString(),
  totalProcessed,
  uniqueRules: finalRules.length,
  rules: finalRules
};

const jsonPath = path.join(__dirname, 'generated-rules.json');
fs.writeFileSync(jsonPath, JSON.stringify(outputRules, null, 2));

const logLines = [
  `Conversion Log`,
  `==============`,
  `Generated: ${outputRules.generatedAt}`,
  ``,
  `Totale righe processate: ${totalProcessed}`,
  `Regole prodotte: ${finalRules.length}`,
  `Scartate: ${totalProcessed - finalRules.length}`,
  ``,
  `Motivi scarto (JSON):`,
  JSON.stringify(discarded, null, 2),
  ``,
  `Uniche: ${finalRules.length}`,
  ``,
  `Percentuale urlFilter con '||': ${percentage}%`,
  ``,
  `Dettaglio per file:`,
  ...Object.entries(perFileStats).map(([file, stats]) =>
    `  ${file}: tot=${stats.total}, parseate=${stats.parsed}, scartate=${stats.discarded}`
  )
];

const logPath = path.join(__dirname, 'conversion-log.txt');
fs.writeFileSync(logPath, logLines.join('\n'));

console.log('');
console.log('=== RIEPILOGO ===');
console.log(`Totale righe: ${totalProcessed}`);
console.log(`Regole uniche: ${finalRules.length}`);
console.log(`Scartate: ${totalProcessed - finalRules.length}`);
console.log('');
console.log('=== MOTIVI SCARTO ===');
for (const [reason, count] of Object.entries(discarded)) {
  console.log(`  ${reason}: ${count}`);
}
console.log('');
console.log(`UrlFilter con '||': ${percentage}%`);
console.log('');
console.log(`Output: ${jsonPath}`);
console.log(`Log: ${logPath}`);
