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
const FP_HEURISTICS_FILE = join(BASE, 'fp-heuristics.json');
const OUTPUT_DIR = join(BASE, 'candidate_rules');
mkdirSync(OUTPUT_DIR, { recursive: true });

// --- Load fp-heuristics.json (default inline if missing) ---
const FP_HEURISTICS = (() => {
  try {
    if (existsSync(FP_HEURISTICS_FILE)) {
      return JSON.parse(readFileSync(FP_HEURISTICS_FILE, 'utf8'));
    }
  } catch {}
  return {
    confidence_networks: { high: [], medium: [] },
    dom_fp_patterns: [],
    dom_fp_selectors_generic: []
  };
})();

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

/**
 * Classify confidence level for an ad network string.
 * Uses substring match (case-insensitive) against fp-heuristics.json.
 */
function classifyConfidence(adNetwork) {
  if (!adNetwork) return 'low';
  const lower = adNetwork.toLowerCase();
  if (FP_HEURISTICS.confidence_networks?.high?.some(n => lower.includes(n.toLowerCase()) || n.toLowerCase().includes(lower))) return 'high';
  if (FP_HEURISTICS.confidence_networks?.medium?.some(n => lower.includes(n.toLowerCase()) || n.toLowerCase().includes(lower))) return 'medium';
  return 'low';
}

/**
 * True if a dom_ad looks like a false positive.
 * Checks: generic selector + FP text pattern, OR degenerate bounding box.
 */
function isDomFpSuspect(domAd) {
  if (!domAd) return false;
  const { selector, text, class: cls, box } = domAd;
  // Degenerate bounding box: height or width <= 24px
  if (box && (box.height <= 24 || box.width <= 24)) return true;
  // Generic selector + FP pattern in text or class
  const generics = FP_HEURISTICS.dom_fp_selectors_generic || [];
  const patterns = FP_HEURISTICS.dom_fp_patterns || [];
  if (!generics.length || !patterns.length) return false;
  const isGenericSelector = generics.some(g =>
    selector && (selector === g || (g.endsWith('"]') && selector.includes(g.slice(0, -1))))
  );
  if (!isGenericSelector) return false;
  const combined = ((text || '') + ' ' + (cls || '')).toLowerCase();
  return patterns.some(p => combined.includes(p.toLowerCase()));
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

// Map of brand root -> domains owned by the same organization.
// If source and ad host share a root, it's first-party, not a third-party leak.
// NOTE: Google is intentionally EXCLUDED — doubleclick/googlesyndication serve
// real third-party ads even on Google-owned properties (youtube.com).
const ORG_DOMAINS = {
  bbc: ['bbc.co.uk','bbc.com','bbci.co.uk','bbci'],
  amazon: ['amazon.com','amazon.it','amazon.co.uk','amazon-adsystem.com'],
};

/** Build reverse lookup: domain -> org root */
const DOMAIN_TO_ORG = {};
for (const [org, doms] of Object.entries(ORG_DOMAINS)) {
  for (const d of doms) DOMAIN_TO_ORG[d] = org;
}

/** True if adHost and sourceDomain belong to the same known organization. */
function isSameOrganization(adHost, sourceDomain) {
  if (!adHost || !sourceDomain) return false;
  const adReg = registrableDomain(adHost);
  const srcReg = registrableDomain(sourceDomain);
  const adOrg = DOMAIN_TO_ORG[adReg];
  const srcOrg = DOMAIN_TO_ORG[srcReg];
  return !!(adOrg && srcOrg && adOrg === srcOrg);
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

// Core domains that must NEVER be blocked at eTLD+1 level (would nuke a whole
// search engine / marketplace / publisher). For these we fall back to the
// specific subdomain the ad request came from.
const BROAD_DOMAINS = new Set([
  'bing.com','google.com','google.it','amazon.com','amazon.it','amazon.co.uk',
  'ebay.com','ebay.it','facebook.com','apple.com','microsoft.com',
  'bbc.co.uk','bbc.com','yahoo.com','yandex.com','baidu.com',
]);

/**
 * Generate a DNR urlFilter for the ad network domain (eTLD+1 aware).
 * The sourceDomain goes into the `domains` condition field, NOT urlFilter.
 * For BROAD_DOMAINS, use the full subdomain to avoid blocking whole services.
 */
function generateUrlFilter(adNetwork, sourceDomain, blockedUrl) {
  const adHost = extractDomain(blockedUrl);
  if (adHost) {
    const baseDomain = registrableDomain(adHost);
    // If the eTLD+1 is a core service, target the specific subdomain instead
    if (BROAD_DOMAINS.has(baseDomain)) {
      const cleanHost = adHost.toLowerCase().replace(/^www\./, '');
      return `||${cleanHost}^`;
    }
    if (baseDomain) return `||${baseDomain}^`;
  }
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

        // Skip same-organization (e.g. bbc.com requesting bbci.co.uk, or
        // amazon.it requesting amazon-adsystem.com): not a third-party ad leak.
        const skipSameOrg = isSameOrganization(adHost, sourceDomain);
        if (skipSameOrg) {
          if (VERBOSE) console.log(`  SKIP same-org: ${adHost} ~ ${sourceDomain}`);
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

        const confidence = classifyConfidence(adNet);
        if (VERBOSE) console.log(`  NUOVO: ${adNet} [${confidence}] -> rule ${nextId}: ${urlFilter}`);
        newCandidates.push({
          fingerprint,
          domain: finding.domain,
          ad_network: adNet,
          leak_type: 'network_leak',
          blocked_url: req.url,
          confidence,
          fp_suspect: 0,
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
          blocked_url: req.url,
          confidence
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

        const fpSuspect = isDomFpSuspect(domAd) ? 1 : 0;
        if (VERBOSE) console.log(`  DOM: ${domAd.selector} -> dom_visible_ad fp_suspect=${fpSuspect}`);

        state.leaks[fingerprint] = {
          domain: finding.domain,
          ad_network: 'dom',
          leak_type: 'dom_visible_ad',
          status: 'open',
          rule_id: null,
          selector: domAd.selector,
          created: new Date().toISOString(),
          updated: new Date().toISOString(),
          confidence: 'low',
          fp_suspect: fpSuspect
        };
        alreadyTracked.push({ fingerprint, domain: finding.domain, selector: domAd.selector });
      }
    }
  }

  // Build leaks_detail: full detail for every fingerprint processed in this run
  const leaksDetailMap = new Map();

  // New network candidates
  for (const c of newCandidates) {
    leaksDetailMap.set(c.fingerprint, {
      fingerprint: c.fingerprint,
      domain: c.domain,
      category: null,   // derive from finding
      site_type: null,
      country: null,
      leak_type: c.leak_type,
      ad_network: c.ad_network,
      blocked_url: c.blocked_url,
      selector: null,
      candidate_rule: c.rule,
      confidence: c.confidence,
      fp_suspect: c.fp_suspect,
      screenshot: null   // derive from finding
    });
  }

  // Already-tracked DOMs
  for (const t of alreadyTracked) {
    leaksDetailMap.set(t.fingerprint, {
      fingerprint: t.fingerprint,
      domain: t.domain,
      category: null,
      site_type: null,
      country: null,
      leak_type: 'dom_visible_ad',
      ad_network: 'dom',
      blocked_url: null,
      selector: t.selector,
      candidate_rule: null,
      confidence: 'low',
      fp_suspect: state.leaks[t.fingerprint]?.fp_suspect ?? 0,
      screenshot: null
    });
  }

  // Populate finding-level fields (category, site_type, country, screenshot) from the
  // matching finding for each fingerprint.
  for (const finding of findings) {
    for (const detail of leaksDetailMap.values()) {
      if (detail.domain === finding.domain) {
        if (detail.category === null) detail.category = finding.category || null;
        if (detail.site_type === null) detail.site_type = finding.site_type || null;
        if (detail.country === null) detail.country = finding.country || null;
        if (detail.screenshot === null) detail.screenshot = finding.screenshot || null;
      }
    }
  }

  const leaks_detail = [...leaksDetailMap.values()];

  const result = {
    date: DATE,
    findings_count: findings.length,
    new_candidates: newCandidates.length,
    already_tracked: alreadyTracked.length,
    skipped_duplicates: skippedDuplicates.length,
    validation_errors: validationErrors.length,
    next_id: nextId,
    candidates: newCandidates.map(c => c.rule),
    tracked: [
      ...newCandidates.map(c => ({
        fingerprint: c.fingerprint,
        domain: c.domain,
        ad_network: c.ad_network,
        candidate_rule: c.rule,    // include rule so push_dashboard gets it
      })),
      ...alreadyTracked,
    ],
    errors: validationErrors,
    leaks_detail
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
      newCandidates.forEach(c => console.log(`  [${c.rule.id}] ${c.rule.condition.urlFilter} (${c.ad_network} [${c.confidence}] -> ${c.domain})`));
    }
  } else {
    console.log(`\n=== DRY-RUN: ${newCandidates.length} candidate rules ===`);
    newCandidates.forEach(c => console.log(`  [${c.rule.id}] ${c.rule.condition.urlFilter}`));
  }
}

analyze().catch(e => { console.error(e); process.exit(1); });
