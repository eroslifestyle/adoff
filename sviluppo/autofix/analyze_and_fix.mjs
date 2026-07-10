#!/usr/bin/env node
/**
 * analyze_and_fix.mjs - Analizza findings e genera candidate rules.
 * Uso: node analyze_and_fix.mjs [--date YYYY-MM-DD] [--dry-run] [--verbose]
 */
import { readFileSync, writeFileSync, existsSync, mkdirSync } from 'fs';
import { join, dirname } from 'path';
import { fileURLToPath } from 'url';
import { createHash } from 'crypto';

const __dirname = dirname(fileURLToPath(import.meta.url));
const BASE = __dirname;

const DATE = (() => {
  const i = process.argv.indexOf('--date');
  return i >= 0 ? process.argv[i + 1] : new Date().toISOString().slice(0, 10);
})();
const DRY_RUN = process.argv.includes('--dry-run');
const VERBOSE = process.argv.includes('--verbose');

const FINDINGS_FILE = join(BASE, 'findings', `${DATE}.json`);
const STATE_FILE = join(BASE, 'logs', 'state.json');
const OUTPUT_DIR = join(BASE, 'candidate_rules');
mkdirSync(OUTPUT_DIR, { recursive: true });

const AD_NETWORKS_PATTERNS = [
  { net: 'googlesyndication', tld: 'doubleclick.net|gstatic.com|googleadservices.com' },
  { net: 'adnxs', tld: 'adnxs.com' },
  { net: 'criteo', tld: 'criteo.com|criteo.net' },
  { net: 'taboola', tld: 'taboola.com|taboolaunch.com' },
  { net: 'outbrain', tld: 'outbrain.com|outbrainimg.com' },
  { net: 'amazon-adsystem', tld: 'amazon-adsystem.com|amazon-adsystem' },
  { net: 'pubmatic', tld: 'pubmatic.com' },
  { net: 'openx', tld: 'openx.net' },
  { net: 'rubiconproject', tld: 'rubiconproject.com' },
  { net: 'smartadserver', tld: 'smartadserver.com' },
  { net: 'facebook.net', tld: 'facebook.net' },
  { net: 'bat.bing', tld: 'bat.bing.com' },
  { net: 'adform', tld: 'adform.net' },
  { net: 'adsrvr', tld: 'adsrvr.org' },
  { net: 'casalemedia', tld: 'casalemedia.com' },
  { net: 'sharethrough', tld: 'sharethrough.com' },
  { net: 'spotxchange', tld: 'spotxchange.com' },
  { net: 'themediagrid', tld: 'themediagrid.com' },
  { net: 'tradedoubler', tld: 'tradedoubler.com' },
  { net: 'media.net', tld: 'media.net' },
  { net: 'unity3d', tld: 'unity3d.com|unityads.unity3d.com' },
  { net: 'applovin', tld: 'applovin.com|applovin' },
  { net: 'adcolony', tld: 'adcolony.com' },
];

// Chrome DNR valid resourceTypes — xmlhttprequest confirmed in production rules
const VALID_RESOURCE_TYPES = ['main_frame','sub_frame','stylesheet','script','image','font','xmlhttprequest','media','websocket','ping','object','other'];
const VALID_ACTION_TYPES = ['block','allow'];

// === HELPERS ===
function sha256(str) {
  return createHash('sha256').update(str).digest('hex').slice(0, 12);
}

function loadState() {
  if (!existsSync(STATE_FILE)) return { version: 1, leaks: {} };
  try {
    return JSON.parse(readFileSync(STATE_FILE, 'utf8'));
  } catch { return { version: 1, leaks: {} }; }
}

function saveState(state) {
  writeFileSync(STATE_FILE, JSON.stringify(state, null, 2));
}

function findAdNetwork(url) {
  const l = url.toLowerCase();
  for (const p of AD_NETWORKS_PATTERNS) {
    if (l.includes(p.net)) return p.net;
  }
  return null;
}

function extractDomain(url) {
  try {
    const u = new URL(url.includes('://') ? url : 'https://' + url);
    return u.hostname;
  } catch { return url; }
}

// Common second-level TLDs (public suffixes). Taking the last 2 labels would
// yield "co.uk" for foo.bar.co.uk — catastrophic if used as urlFilter.
const MULTI_PART_TLDS = new Set([
  'co.uk','org.uk','ac.uk','gov.uk','net.uk','sch.uk','nhs.uk',
  'com.au','net.au','org.au','edu.au','gov.au',
  'co.nz','net.nz','org.nz','govt.nz',
  'co.jp','or.jp','ne.jp','ac.jp','go.jp',
  'co.kr','or.kr','ne.kr','go.kr',
  'com.br','net.br','org.br','gov.br','edu.br',
  'co.in','net.in','org.in','gov.in','ac.in',
  'com.cn','net.cn','org.cn','gov.cn',
  'com.hk','net.hk','org.hk','gov.hk',
  'com.tw','net.tw','org.tw',
  'com.mx','org.mx','gob.mx',
  'co.za','net.za','org.za','web.za',
  'co.il','org.il','net.il','ac.il',
  'com.ar','com.tr','com.sg','com.my','com.ph','com.vn','com.id',
  'eu.org','pp.ru',
]);

/** Extract the registrable (eTLD+1) domain, handling multi-part TLDs. */
function registrableDomain(hostname) {
  if (!hostname) return null;
  const host = hostname.toLowerCase().replace(/^www\./, '');
  const parts = host.split('.');
  if (parts.length >= 3) {
    const lastTwo = parts.slice(-2).join('.');
    if (MULTI_PART_TLDS.has(lastTwo)) return parts.slice(-3).join('.');
  }
  if (parts.length >= 2) return parts.slice(-2).join('.');
  return host;
}

function validateRule(rule, domains) {
  const errors = [];
  if (!rule.id || rule.id < 60000) errors.push(`id must be >= 60000, got ${rule.id}`);
  if (!rule.priority || rule.priority < 1) errors.push('priority must be >= 1');
  if (!rule.action || !VALID_ACTION_TYPES.includes(rule.action.type)) {
    errors.push(`action.type must be one of ${VALID_ACTION_TYPES.join(',')}`);
  }
  if (!rule.condition || !rule.condition.urlFilter) errors.push('condition.urlFilter required');
  if (rule.condition.urlFilter && rule.condition.urlFilter.includes(' ')) {
    errors.push('urlFilter cannot contain spaces');
  }
  // SAFETY GUARDRAIL: reject overly-broad urlFilters (pure TLDs, public suffixes)
  if (rule.condition && rule.condition.urlFilter) {
    const core = rule.condition.urlFilter.replace(/[\^|*]/g, '').trim();
    const coreParts = core.split('.');
    const isMultiPartTld = coreParts.length <= 2 && (
      MULTI_PART_TLDS.has(core) ||                       // "co.uk"
      MULTI_PART_TLDS.has(coreParts.slice(-2).join('.')) // "foo.co.uk" handled by registrable, "co.uk" leaks
    );
    const looksLikeTld = coreParts.length < 2 ||         // "com" alone
      (coreParts.length === 1 && core.length <= 4);
    if (isMultiPartTld || looksLikeTld) {
      errors.push(`UNSAFE urlFilter too broad: "${rule.condition.urlFilter}" (would block a TLD)`);
    }
  }
  if (rule.condition && rule.condition.resourceTypes) {
    const invalid = rule.condition.resourceTypes.filter(t => !VALID_RESOURCE_TYPES.includes(t));
    if (invalid.length) errors.push(`invalid resourceTypes: ${invalid.join(',')}`);
  }
  if (domains && domains.length > 0) {
    if (!Array.isArray(domains)) errors.push('domains must be an array');
    else if (!domains.every(d => typeof d === 'string' && d.length > 0)) errors.push('domains must be non-empty strings');
  }
  return errors;
}

/**
 * Generate a DNR urlFilter for the ad network domain (eTLD+1 aware).
 * The sourceDomain goes into the `domains` condition field, NOT urlFilter.
 */
function generateUrlFilter(adNetwork, sourceDomain, blockedUrl) {
  const adHost = extractDomain(blockedUrl);
  const baseDomain = adHost ? registrableDomain(adHost) : null;
  if (baseDomain) return `||${baseDomain}^`;
  return `||${adNetwork}^`;
}

/** Build the full rule condition, adding domains[] when sourceDomain is given. */
function buildRuleCondition(urlFilter, sourceDomain) {
  const cond = { urlFilter, resourceTypes: ['script', 'xmlhttprequest', 'image', 'sub_frame'] };
  if (sourceDomain) cond.domains = [sourceDomain];
  return cond;
}

// === MAIN ===
async function analyze() {
  console.log(`\n=== AdOff Analyzer ${DATE} ===`);
  console.log(`Dry-run: ${DRY_RUN}, Verbose: ${VERBOSE}`);

  if (!existsSync(FINDINGS_FILE)) {
    console.error(`ERRORE: ${FINDINGS_FILE} non trovato. Esegui prima crawl.mjs`);
    process.exit(1);
  }

  const findingsData = JSON.parse(readFileSync(FINDINGS_FILE, 'utf8'));
  const latestRun = findingsData.runs[findingsData.runs.length - 1];
  if (!latestRun) { console.error('Nessun run trovato'); process.exit(1); }

  const findings = latestRun.findings || [];
  console.log(`Findings da analizzare: ${findings.length}`);

  const state = loadState();

  const newCandidates = [];
  const alreadyTracked = [];
  const skippedDuplicates = [];
  const validationErrors = [];

  const usedIds = Object.values(state.leaks)
    .filter(l => l.rule_id && l.rule_id >= 60000)
    .map(l => l.rule_id);
  let nextId = usedIds.length ? Math.max(...usedIds) + 1 : 60001;

  for (const finding of findings) {
    if (VERBOSE) console.log(`\nAnalizzo: ${finding.domain} (${finding.leak_types.join(', ')})`);

    if (finding.leak_types.includes('network_leak')) {
      for (const req of (finding.blocked_urls || [])) {
        const adNet = req.network || findAdNetwork(req.url);
        if (!adNet) {
          if (VERBOSE) console.log(`  SKIP: network sconosciuta in ${req.url}`);
          continue;
        }

        const fingerprint = sha256(`${finding.domain}:${adNet}:network_leak`);

        if (state.leaks[fingerprint]) {
          const existing = state.leaks[fingerprint];
          if (VERBOSE) console.log(`  SKIP: fingerprint ${fingerprint} gia' in stato '${existing.status}'`);
          skippedDuplicates.push({ fingerprint, domain: finding.domain, status: existing.status });
          continue;
        }

        // Skip if the blocked URL is the same domain as the source page (first-party)
        const adHost = extractDomain(req.url);
        const sourceDomain = finding.domain;
        const skipFirstParty = adHost && (adHost === sourceDomain || adHost.endsWith('.' + sourceDomain));
        if (skipFirstParty) {
          if (VERBOSE) console.log(`  SKIP first-party: ${adHost} == ${sourceDomain}`);
          continue;
        }

        const urlFilter = generateUrlFilter(adNet, sourceDomain, req.url);
        const rule = {
          id: nextId,
          priority: 1,
          action: { type: 'block' },
          condition: buildRuleCondition(urlFilter, finding.domain)
        };

        const errors = validateRule(rule, [finding.domain]);
        if (errors.length) {
          if (VERBOSE) console.log(`  ERRORE validazione: ${errors.join(', ')}`);
          validationErrors.push({ fingerprint, errors, rule });
          continue;
        }

        if (VERBOSE) console.log(`  NUOVO: ${adNet} -> rule ${nextId}: ${urlFilter}`);
        newCandidates.push({
          fingerprint,
          domain: finding.domain,
          ad_network: adNet,
          leak_type: 'network_leak',
          blocked_url: req.url,
          rule
        });

        state.leaks[fingerprint] = {
          domain: finding.domain,
          ad_network: adNet,
          leak_type: 'network_leak',
          status: 'open',
          rule_id: nextId,
          created: new Date().toISOString(),
          updated: new Date().toISOString(),
          blocked_url: req.url
        };
        nextId++;
      }
    }

    if (finding.leak_types.includes('dom_visible_ad')) {
      for (const domAd of (finding.dom_ads || [])) {
        const fingerprint = sha256(`${finding.domain}:${domAd.selector}:dom_visible_ad`);

        if (state.leaks[fingerprint]) {
          skippedDuplicates.push({ fingerprint, domain: finding.domain, status: state.leaks[fingerprint].status });
          continue;
        }

        if (VERBOSE) console.log(`  DOM: ${domAd.selector} -> dom_visible_ad (no DNR rule)`);

        state.leaks[fingerprint] = {
          domain: finding.domain,
          ad_network: 'dom',
          leak_type: 'dom_visible_ad',
          status: 'open',
          rule_id: null,
          selector: domAd.selector,
          created: new Date().toISOString(),
          updated: new Date().toISOString()
        };
        alreadyTracked.push({ fingerprint, domain: finding.domain, selector: domAd.selector });
      }
    }
  }

  const result = {
    date: DATE,
    findings_count: findings.length,
    new_candidates: newCandidates.length,
    already_tracked: alreadyTracked.length,
    skipped_duplicates: skippedDuplicates.length,
    validation_errors: validationErrors.length,
    next_id: nextId,
    candidates: newCandidates.map(c => c.rule),
    tracked: [...newCandidates.map(c => ({ fingerprint: c.fingerprint, domain: c.domain, ad_network: c.ad_network })), ...alreadyTracked],
    errors: validationErrors
  };

  if (!DRY_RUN) {
    const outFile = join(OUTPUT_DIR, `${DATE}.json`);
    writeFileSync(outFile, JSON.stringify(result, null, 2));
    saveState(state);
    console.log(`\n=== RISULTATO ===`);
    console.log(`New candidates: ${newCandidates.length}`);
    console.log(`Already tracked: ${alreadyTracked.length}`);
    console.log(`Skipped (dup): ${skippedDuplicates.length}`);
    console.log(`Validation errors: ${validationErrors.length}`);
    console.log(`Next ID: ${nextId}`);
    console.log(`Output: ${outFile}`);
    console.log(`State: ${STATE_FILE}`);

    if (newCandidates.length > 0) {
      console.log('\nNuove candidate rules:');
      newCandidates.forEach(c => console.log(`  [${c.rule.id}] ${c.rule.condition.urlFilter} (${c.ad_network} -> ${c.domain})`));
    }
  } else {
    console.log(`\n=== DRY-RUN: ${newCandidates.length} candidate rules ===`);
    newCandidates.forEach(c => console.log(`  [${c.rule.id}] ${c.rule.condition.urlFilter}`));
  }
}

analyze().catch(e => { console.error(e); process.exit(1); });
