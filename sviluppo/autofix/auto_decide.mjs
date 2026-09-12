#!/usr/bin/env node
/**
 * auto_decide.mjs - Decisione automatica basata su euristiche.
 * Uso: node auto_decide.mjs [--date YYYY-MM-DD] [--dry-run]
 *
 * Euristiche:
 * - ads_high_confidence + candidate_rule → auto-fix
 * - analytics_low_confidence → auto-ignore
 * - dom_suspect_fp_pattern → auto-ignore
 * - candidate_rule NULL + confidence low → auto-defer
 * - candidate_rule valido + confidence medium → auto-defer
 */
import { readFileSync, writeFileSync, existsSync } from 'fs';
import { join, dirname } from 'path';
import { fileURLToPath } from 'url';

const __dirname = dirname(fileURLToPath(import.meta.url));
const BASE = __dirname;

const DATE = (() => {
  const i = process.argv.indexOf('--date');
  return i >= 0 ? process.argv[i + 1] : new Date().toISOString().slice(0, 10);
})();
const DRY_RUN = process.argv.includes('--dry-run');

const ADMIN_TOKEN = process.env.ADMIN_TOKEN;
const API_URL = 'https://api.adoff.app/admin/autofix/decision';

const AUTO_DECISIONS_FILE = join(BASE, 'logs', `auto-decisions-${DATE}.json`);

// Euristiche di classificazione
const AUTO_DECISION_RULES = [
  // AUTO-FIX: ads ad alta confidenza con regola DNR valida
  {
    name: 'fix_high_confidence_ads',
    condition: (l) =>
      (l.confidence === 'high') &&
      l.candidate_rule &&
      l.candidate_rule !== null &&
      !l.candidate_rule.includes('"fp_suspect":1'),
    action: 'fix',
    note: 'Auto-fix: confidence=high + candidate rule disponibile'
  },
  // AUTO-FIX: doubleclick/googlesyndication su domini noti ads (amazon, youtube, news)
  {
    name: 'fix_known_ad_networks',
    condition: (l) => {
      const domain = (l.domain || '').toLowerCase();
      const network = (l.ad_network || '').toLowerCase();
      const knownAdDomains = ['amazon', 'youtube', 'facebook', 'twitter', 'instagram', 'tiktok', 'reddit', 'porn', 'gambling', 'casino'];
      const isKnownAdSite = knownAdDomains.some(d => domain.includes(d));
      const isAdNetwork = ['doubleclick', 'googlesyndication', 'adnxs', 'criteo', 'pubmatic', 'openx', 'rubicon'].some(n => network.includes(n));
      return isKnownAdSite && isAdNetwork && l.confidence !== 'low';
    },
    action: 'fix',
    note: 'Auto-fix: ad-network su sito noto pubblicitario'
  },
  // AUTO-IGNORE: analytics/tracking bassa confidenza
  {
    name: 'ignore_analytics_tracking',
    condition: (l) => {
      const network = (l.ad_network || '').toLowerCase();
      const analytics = ['analytics', 'googletagmanager', 'gtag', 'scorecardresearch', 'bat.bing', 'beacon', 'tracking', 'facebook.net', 'connect.facebook'];
      return analytics.some(a => network.includes(a)) && l.confidence === 'low';
    },
    action: 'ignore',
    note: 'Auto-ignore: analytics/tracking bassa confidenza'
  },
  // AUTO-IGNORE: DOM sospetti pattern FP
  {
    name: 'ignore_dom_fp_suspect',
    condition: (l) => l.fp_suspect === 1,
    action: 'ignore',
    note: 'Auto-ignore: DOM sospetto falso-positivo'
  },
  // AUTO-IGNORE: DOM class-based selector generico
  {
    name: 'ignore_generic_dom_selectors',
    condition: (l) => {
      const lt = (l.leak_type || '').toLowerCase();
      const sel = (l.selector || '').toLowerCase();
      if (!lt.startsWith('dom') && !lt.includes('dom')) return false;
      const genericPatterns = ['ad-', 'ads-', 'advert', 'banner', 'sponsor'];
      return genericPatterns.some(p => sel.includes(p)) && !sel.includes('[');
    },
    action: 'ignore',
    note: 'Auto-ignore: selettore DOM generico (probabile FP)'
  },
  // AUTO-DEFER: confidence low senza candidate rule
  {
    name: 'defer_low_conf_no_rule',
    condition: (l) => l.confidence === 'low' && (!l.candidate_rule || l.candidate_rule === null),
    action: 'defer',
    note: 'Auto-defer: bassa confidenza, nessuna regola candidate'
  },
  // AUTO-DEFER: confidence medium
  {
    name: 'defer_medium_confidence',
    condition: (l) => l.confidence === 'medium' && (!l.candidate_rule || l.candidate_rule === null),
    action: 'defer',
    note: 'Auto-defer: media confidenza'
  },
];

function classifyLeak(leak) {
  for (const rule of AUTO_DECISION_RULES) {
    try {
      if (rule.condition(leak)) {
        return { action: rule.action, note: rule.note, rule: rule.name };
      }
    } catch (e) {
      // Skip rule on error
    }
  }
  return null; // No auto-decision
}

async function main() {
  console.log(`\n=== AUTO-DECIDE ${DATE} ===`);
  console.log(`Dry-run: ${DRY_RUN}`);

  if (DRY_RUN) {
    console.log('⚠️ Modalità dry-run: nessuna decisione verra salvata\n');
  }

  // Leggi findings del giorno
  const findingsFile = join(BASE, 'findings', `${DATE}.json`);
  if (!existsSync(findingsFile)) {
    console.log(`⚠️ File findings non trovato: ${findingsFile}`);
    console.log('Nessun leak da processare.');
    return;
  }

  const findings = JSON.parse(readFileSync(findingsFile, 'utf8'));
  const findingsData = Array.isArray(findings) ? findings : (findings.findings || []);

  if (!findingsData.length) {
    console.log('⚠️ Nessun finding nel file.');
    return;
  }

  // Classifica ogni leak
  const decisions = [];
  const stats = { fix: 0, ignore: 0, defer: 0, no_auto: 0 };

  for (const f of findingsData) {
    const leaks = f.leaks || (f.findings || []);
    for (const leak of leaks) {
      // Costruisci fingerprint
      const hash = createHash(leak);
      const lt = leak.leak_type || 'network_leak';
      const network = leak.ad_network || '';
      const url = leak.blocked_url || leak.url || '';
      const domain = f.domain || leak.domain || '';
      const sel = leak.selector || '';

      const leakData = {
        fingerprint: hash,
        domain,
        leak_type: lt,
        ad_network: network,
        blocked_url: url,
        selector: sel,
        confidence: leak.confidence || 'low',
        fp_suspect: leak.fp_suspect || 0,
        candidate_rule: leak.candidate_rule || null,
        screenshot: leak.screenshot || null,
      };

      const decision = classifyLeak(leakData);

      if (decision) {
        decisions.push({
          ...decision,
          fingerprint: hash,
          domain,
          network,
          confidence: leakData.confidence,
        });
        stats[decision.action]++;
        console.log(`  ${decision.action.toUpperCase()} ${domain} ${network} — ${decision.note}`);
      } else {
        stats.no_auto++;
        console.log(`  SKIP  ${domain} ${network} — richiede decisione manuale`);
      }
    }
  }

  console.log(`\n📊 Riepilogo auto-decisioni:`);
  console.log(`  ✅ Auto-fix:    ${stats.fix}`);
  console.log(`  ❌ Auto-ignore: ${stats.ignore}`);
  console.log(`  ⏸ Auto-defer:  ${stats.defer}`);
  console.log(`  ⏭ Nessuna auto: ${stats.no_auto}`);
  console.log(`  📦 Totale:      ${stats.fix + stats.ignore + stats.defer + stats.no_auto}`);

  if (DRY_RUN) {
    console.log('\n⚠️ Dry-run: decisioni non salvate.');
    // Salva comunque per debug
    writeFileSync(AUTO_DECISIONS_FILE, JSON.stringify({ date: DATE, dry_run: true, decisions, stats }, null, 2));
    return;
  }

  // Invia decisioni all'API
  if (decisions.length === 0) {
    console.log('\n✅ Nessuna auto-decisione da inviare.');
    return;
  }

  console.log(`\n📤 Invio ${decisions.length} decisioni all'API...`);

  const payload = {
    decisions: decisions.map(d => ({
      fingerprint: d.fingerprint,
      action: d.action,
      note: `[AUTO] ${d.note}`,
    }))
  };

  console.log(`URL: ${API_URL}`);
  console.log(`Payload: ${JSON.stringify(payload, null, 2).slice(0, 500)}...`);

  try {
    const resp = await fetch(API_URL, {
      method: 'POST',
      headers: {
        'Content-Type': 'application/json',
        'X-Admin-Token': ADMIN_TOKEN || '',
      },
      body: JSON.stringify(payload),
    });

    const result = await resp.json();
    console.log(`HTTP ${resp.status}:`, result);

    if (result.ok) {
      console.log(`\n✅ ${result.saved || decisions.length} decisioni salvate in D1.`);
      writeFileSync(AUTO_DECISIONS_FILE, JSON.stringify({ date: DATE, decisions, stats, result }, null, 2));
    } else {
      console.log(`\n❌ Errore: ${result.error}`);
    }
  } catch (e) {
    console.error(`\n❌ Errore fetch: ${e.message}`);
  }
}

function createHash(leak) {
  const { createHash } = require('crypto');
  const input = `${leak.domain || ''}|${leak.leak_type || ''}|${leak.ad_network || ''}|${leak.blocked_url || leak.url || ''}|${leak.selector || ''}`;
  return createHash('md5').update(input).digest('hex').slice(0, 12);
}

main().catch(e => { console.error(e); process.exit(1); });
