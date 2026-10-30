#!/usr/bin/env node
/**
 * Merge generated rules with existing AdOff rules
 * Target: ~25K rules max (Chrome limit for static rules)
 */

const fs = require('fs');
const path = require('path');

const FILTER_DIR = __dirname;
const APP_DIR = path.join(FILTER_DIR, '../../app');
const RULES_FILE = path.join(APP_DIR, 'rules/adblock-rules.json');
const NEW_RULES_FILE = path.join(FILTER_DIR, 'generated-rules.json');
const OUTPUT_FILE = path.join(FILTER_DIR, 'merged-rules.json');

const MAX_RULES = 25000; // Chrome static rules limit

console.log('\n=== Merge AdBlock Rules ===\n');

// Load existing rules
const existing = JSON.parse(fs.readFileSync(RULES_FILE, 'utf8'));
const existingRules = existing.rules || existing;
console.log(`Existing rules: ${existingRules.length}`);

// Load new generated rules
const generated = JSON.parse(fs.readFileSync(NEW_RULES_FILE, 'utf8'));
const newRules = generated.rules;
console.log(`Generated rules: ${newRules.length}`);

// Convert "trigger" to "condition" (AdOff format)
function convertRule(rule) {
  const r = {
    id: rule.id,
    priority: 1,
    action: rule.action,
    condition: {
      urlFilter: rule.trigger.urlFilter,
      resourceTypes: rule.trigger.resourceTypes
    }
  };
  if (rule.trigger.initiatorDomains) {
    r.condition.initiatorDomains = rule.trigger.initiatorDomains;
  }
  return r;
}

// Convert existing rules to same format
const allRules = [...existingRules];

// Add converted new rules
let added = 0;
const seenUrls = new Set(existingRules.map(r => r.condition?.urlFilter || r.trigger?.urlFilter));

for (const rule of newRules) {
  if (allRules.length >= MAX_RULES) break;
  const converted = convertRule(rule);
  if (!seenUrls.has(converted.condition.urlFilter)) {
    allRules.push(converted);
    seenUrls.add(converted.condition.urlFilter);
    added++;
  }
}

console.log(`Added from generated: ${added}`);
console.log(`Total rules: ${allRules.length}`);

// Re-index IDs
allRules.forEach((r, i) => r.id = i + 1);

// Write output
fs.writeFileSync(OUTPUT_FILE, JSON.stringify(allRules, null, 2));
console.log(`\nOutput: ${OUTPUT_FILE}`);
console.log(`Size: ${(fs.statSync(OUTPUT_FILE).size / 1024).toFixed(1)} KB`);
