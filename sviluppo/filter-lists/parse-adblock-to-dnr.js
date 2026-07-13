#!/usr/bin/env node
/**
 * AdBlock Plus filter to Chrome declarativeNetRequest (DNR) rules converter
 * Converts ABP filter syntax to DNR-compatible rules for Manifest V3 extensions
 */

const fs = require('fs');
const path = require('path');

// DNR resource types
const AD_TYPES = ['script', 'image', 'stylesheet', 'font', 'object', 'xmlhttprequest', 'websocket', 'other'];

// Stats
const stats = { total: 0, rules: 0, skipped: 0, reasons: {} };

/**
 * Convert ABP pattern to DNR urlFilter
 */
function convertPattern(pattern) {
  let result = pattern
    .replace(/[.+?${}()|[\]\\]/g, '\\$&')
    .replace(/\*/g, '*');
  
  // Handle || at start (any protocol, any subdomain)
  if (result.startsWith('\\|\\|')) {
    const domain = result.slice(4);
    result = `^https?://([^/]+\\.)*${domain.replace(/\^.*/, '')}`;
  }
  
  // Handle ^ separator
  result = result.replace(/\^/g, '[^\\w\\d\\-.%+]');
  
  // Escape dots in domains
  result = result.replace(/\\\./g, '.');
  
  return result.length <= 500 ? result : null;
}

/**
 * Parse a filter line into DNR rule
 */
function parseLine(line, source) {
  const t = line.trim();
  if (!t || t.startsWith('!')) return null;
  if (t.includes('##') || t.includes('#@#')) {
    stats.skipped++; stats.reasons['cosmetic'] = (stats.reasons['cosmetic']||0)+1; return null;
  }
  if (t.includes('$') && (t.includes('scriptlet') || t.includes('csp') || t.includes('redirect'))) {
    stats.skipped++; stats.reasons['unsupported-opt'] = (stats.reasons['unsupported-opt']||0)+1; return null;
  }
  
  const isAllow = t.startsWith('@@');
  const filter = isAllow ? t.slice(2) : t;
  
  // Extract pattern (before $)
  let pattern = filter;
  let domains = null;
  if (filter.includes('$')) {
    const idx = filter.lastIndexOf('$');
    pattern = filter.slice(0, idx);
    const opts = filter.slice(idx+1);
    if (opts.includes('domain=')) {
      const m = opts.match(/domain=([^,]+)/);
      if (m) domains = m[1].split('|').filter(d => !d.startsWith('~'));
    }
    if (opts.includes('third-party')) {
      // Third-party constraint - skip for simplicity
      stats.skipped++; stats.reasons['third-party'] = (stats.reasons['third-party']||0)+1; return null;
    }
  }
  
  const urlFilter = convertPattern(pattern);
  if (!urlFilter) {
    stats.skipped++; stats.reasons['invalid-pattern'] = (stats.reasons['invalid-pattern']||0)+1; return null;
  }
  
  const rule = {
    id: 0,
    action: { type: isAllow ? 'allow' : 'block' },
    trigger: {
      urlFilter: urlFilter.replace(/\\\^/g, '[^\\w\\d\\-.%+]+').replace(/\\\*/g, '*'),
      resourceTypes: isAllow ? undefined : AD_TYPES
    }
  };
  
  if (domains && domains.length > 0) {
    rule.trigger.initiatorDomains = domains;
  }
  
  stats.rules++;
  return rule;
}

/**
 * Parse hosts file format
 */
function parseHostsLine(line, source) {
  const t = line.trim();
  if (!t || t.startsWith('#')) return null;
  if (t.match(/^(0\.0\.0\.0|127\.0\.0\.1)\s+(\S+)/)) {
    const parts = t.split(/\s+/);
    const domain = parts[1];
    if (domain && !domain.includes('localhost') && domain.includes('.')) {
      stats.rules++;
      return {
        id: 0,
        action: { type: 'block' },
        trigger: {
          urlFilter: domain.replace(/\./g, '\\.'),
          resourceTypes: AD_TYPES
        }
      };
    }
  }
  return null;
}

/**
 * Main
 */
function main() {
  const dir = __dirname;
  const files = [
    'easylist_adservers.txt',
    'easylist_adservers_popup.txt',
    'easylist_specific_block.txt',
    'easylist_general_block.txt',
    'easylist_thirdparty.txt',
    'easyprivacy_general.txt',
    'easyprivacy_specific.txt',
    'stevenblack_hosts.txt'
  ];
  
  const allRules = [];
  let startId = 1000;
  
  console.log('\n=== ABP to DNR Converter ===\n');
  
  for (const file of files) {
    const fp = path.join(dir, file);
    if (!fs.existsSync(fp)) {
      console.log(`  ${file}: NOT FOUND`);
      continue;
    }
    
    const content = fs.readFileSync(fp, 'utf8');
    const lines = content.split('\n');
    let fileRules = 0;
    
    for (const line of lines) {
      stats.total++;
      let rule;
      if (file === 'stevenblack_hosts.txt') {
        rule = parseHostsLine(line, file);
      } else {
        rule = parseLine(line, file);
      }
      if (rule) {
        rule.id = startId++;
        allRules.push(rule);
        fileRules++;
      }
    }
    
    console.log(`  ${file}: ${fileRules} rules`);
  }
  
  // Deduplicate
  const seen = new Set();
  const unique = allRules.filter(r => {
    const key = `${r.action.type}:${r.trigger.urlFilter}`;
    if (seen.has(key)) return false;
    seen.add(key);
    return true;
  });
  
  // Write output
  const output = {
    extensionVersion: "3.5.31",
    generatedAt: new Date().toISOString(),
    totalProcessed: stats.total,
    uniqueRules: unique.length,
    rules: unique
  };
  
  const outFile = path.join(dir, 'generated-rules.json');
  fs.writeFileSync(outFile, JSON.stringify(output, null, 2));
  
  // Log
  const log = `=== Conversion Log ===
Date: ${new Date().toISOString()}
Total lines: ${stats.total}
Block/Allow rules: ${stats.rules}
Skipped: ${stats.skipped}
Unique rules: ${unique.length}
Skipped reasons: ${JSON.stringify(stats.reasons)}
Output: ${outFile}
`;
  fs.writeFileSync(path.join(dir, 'conversion-log.txt'), log);
  
  console.log(`\nResults: ${unique.length} unique rules (from ${allRules.length} raw)`);
  console.log(`Skipped: ${stats.skipped}`);
  console.log(`Output: ${outFile}`);
}

main();
