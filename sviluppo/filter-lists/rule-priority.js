'use strict';

const fs = require('fs');

/**
 * @typedef {Object} TierLevel
 * @property {number} ALLOW - Priorità massima: regole allow sono anti-falso-positivo
 * @property {number} LIVE - Regole già in produzione oggi
 * @property {number} CURATED - Liste curates (senza 'hosts' nel nome)
 * @property {number} BULK - Pattern generici da hosts (meno affidabili)
 */

/** @type {TierLevel} */
const TIER = Object.freeze({
  ALLOW: 0,
  LIVE: 1,
  CURATED: 2,
  BULK: 3
});

// Pattern che indicano reti pubblicitarie note: premiamo chi le targettiza
// Perché: doubleclick/googlesyndication ecc sono ad alto impatto e BASSO rischio
// di falsi positivi, quindi regole che li menzionano sono più "sicure" da tenere
const AD_NETWORK_PATTERNS = [
  'doubleclick',
  'googlesyndication',
  'googleadservices',
  'adnxs',
  'adsystem',
  'amazon-adsystem',
  'criteo',
  'taboola',
  'outbrain',
  'pubmatic',
  'rubiconproject',
  'openx',
  'adform',
  'smartadserver',
  'teads',
  'ads.',
  'adserver',
  'banner',
  'popunder',
  'analytics',
  'tracking'
];

/**
 * Legge il feed JSON delle regole live e restituisce l'insieme degli urlFilter attivi.
 * Se il file non esiste o il parsing fallisce, restituisce un Set vuoto (non lancia).
 * Serve a garantire continuità: le regole già in produzione non devono sparire.
 * 
 * @param {string} feedPath - Percorso al file feed JSON
 * @returns {Set<string>} - Set di urlFilter presenti nel feed live
 */
/**
 * Chiave canonica per confrontare urlFilter scritti in modi equivalenti.
 * Il feed storico usa "||dominio", il generatore emette "||dominio^": stessa
 * regola, stringhe diverse. Senza questa normalizzazione il tier LIVE non
 * riconosce quasi nulla e la continuita' col feed in produzione va persa.
 * @param {string} f
 * @returns {string}
 */
function canonicalFilter(f) {
  return String(f || '').toLowerCase().replace(/^\|\|/, '').replace(/\^$/, '');
}

function loadLiveFilters(feedPath) {
  const liveFilters = new Set();

  try {
    const content = fs.readFileSync(feedPath, 'utf8');
    const feed = JSON.parse(content);

    // Il feed ha struttura { rules: [ { condition: { urlFilter } } ] }
    if (feed && Array.isArray(feed.rules)) {
      for (const rule of feed.rules) {
        if (rule.condition?.urlFilter) {
          liveFilters.add(canonicalFilter(rule.condition.urlFilter));
        }
      }
    }
  } catch {
    // Errore di I/O o JSON malformato: torniamo Set vuoto
    // Il chiamante gestirà il caso "nessuna regola live"
  }

  return liveFilters;
}

/**
 * Calcola tier e weight per una regola. Il tier determina la priorità assoluta,
 * il weight ordina DENTRO lo stesso tier (più basso = più importante).
 * 
 * Criteri tier:
 * - ALLOW: regole allow sono eccezioni anti-falso-positivo; tagliarle rompe i siti
 * - LIVE: già in produzione oggi, garantiamo continuità
 * - CURATED: liste curates (no 'hosts'), qualità più alta
 * - BULK: pattern da hosts, generici e potenzialmente rumorosi
 * 
 * Criteri weight:
 * - || (ancora di dominio) = più precisa
 * - no wildcard = più specifica
 * - no initiatorDomains = globale, più impattante
 * - urlFilter corto = troppo generico, rischioso (+20, cioè penalità)
 * - contiene rete pubblicitaria nota = alto impatto, basso FP (-15)
 * 
 * @param {Object} rule - Regola declarativeNetRequest
 * @param {Set<string>} liveFilters - Set di urlFilter già in produzione
 * @returns {{tier: number, weight: number}} - Livello e peso per l'ordinamento
 */
function scoreRule(rule, liveFilters) {
  let tier;
  let weight = 100;

  // ALLOW ha sempre priorità massima
  // Perché: un allow è una whitelist site-specific; se l'utente ha chiesto
  // di NON bloccare qualcosa su un sito, tagliare l'allow = sito rotto
  if (rule.action?.type === 'allow') {
    tier = TIER.ALLOW;
  } else if (liveFilters.has(canonicalFilter(rule.condition?.urlFilter))) {
    // LIVE: la regola è già attiva in produzione
    // Perché: se funziona oggi, rimuoverla domani riattiva la pubblicità
    // che l'utente ha già imparato a non vedere
    tier = TIER.LIVE;
  } else if (rule._source && !rule._source.includes('hosts')) {
    // CURATED: liste curate non contengono 'hosts' nel nome
    // Perché: liste come EasyList, EasyPrivacy hanno manutenzione attiva,
    // regole più mirate e meno falsi positivi rispetto ai bulk hosts
    tier = TIER.CURATED;
  } else {
    // BULK: pattern generici da file hosts
    // Perché: i file hosts tipo StevenBlack generano molte regole broad,
    // alta probabilità di falsi positivi, li teniamo per ultimi
    tier = TIER.BULK;
  }

  const urlFilter = rule.condition?.urlFilter || '';

  // Ancoraggio di dominio (||): indica targettizzazione precisa del dominio
  // Perché: ||example.com è molto più specifico di example.com o *example.com*
  if (urlFilter.startsWith('||')) {
    weight -= 30;
  }

  // Nessuna wildcard: regola statica, più prevedibile
  // Perché: * è jolly, rende la regola meno deterministica; no wildcard = precisione
  if (!urlFilter.includes('*')) {
    weight -= 10;
  }

  // Nessun initiatorDomains: regola globale, vale su tutti i siti
  // Perché: una regola globale ha più impatto (e più rischio), quindi è più importante
  if (!rule.condition?.initiatorDomains || rule.condition.initiatorDomains.length === 0) {
    weight -= 10;
  }

  // Pattern troppo corto (meno di 8 char senza metacaratteri)
  // Perché: urlFilter come "ad" o "ads" sono iper-generici, rischio alto di FP,
  // quindi li penalizziamo con +20 (weight più alto = meno prioritario)
  const cleanLength = urlFilter.replace(/[\|\^\*]/g, '').length;
  if (cleanLength > 0 && cleanLength < 8) {
    weight += 20;
  }

  // Contiene rete pubblicitaria nota: alto impatto, basso rischio FP
  // Perché: bloccare doubleclick/googlesyndication/adnxs etc rimuove pubblicità
  // reale con probabilità quasi zero di rompere contenuto legittimo
  for (const pattern of AD_NETWORK_PATTERNS) {
    if (urlFilter.includes(pattern)) {
      weight -= 15;
      break; // Una penalità è sufficiente
    }
  }

  return { tier, weight };
}

/**
 * Ordina le regole per priorità decrescente: (tier ASC, weight ASC, indice ASC).
 * L'ordinamento è STABILE: a parità di tier e weight mantiene l'ordine originale.
 * Non muta l'array in ingresso, restituisce una NUOVA lista.
 * Il troncamento (es. max 29000 regole) è a carico del chiamante.
 * 
 * @param {Object[]} rules - Array di regole declarativeNetRequest
 * @param {Set<string>} liveFilters - Set di urlFilter già in produzione
 * @returns {Object[]} - Nuovo array ordinato per priorità
 */
function sortByPriority(rules, liveFilters) {
  // Pre-calcoliamo gli score UNA SOLA VOLTA prima di ordinare.
  // Con 132.000 regole il comparatore verrebbe eseguito milioni di volte
  // se chiamassimo scoreRule() ad ogni confronto.
  const indexed = rules.map((rule, index) => {
    const { tier, weight } = scoreRule(rule, liveFilters);
    return { rule, originalIndex: index, tier, weight };
  });

  indexed.sort((a, b) => {
    // 1) Tier crescente: ALLOW(0) < LIVE(1) < CURATED(2) < BULK(3)
    if (a.tier !== b.tier) {
      return a.tier - b.tier;
    }

    // 2) Weight crescente: weight piu' basso = piu' importante
    if (a.weight !== b.weight) {
      return a.weight - b.weight;
    }

    // 3) Indice originale: stabilizza l'ordinamento
    return a.originalIndex - b.originalIndex;
  });

  return indexed.map(item => item.rule);
}

/**
 * Genera un riepilogo testuale delle regole ordinate.
 * Mostra per ogni tier: totale regole e quante sopravvivono al cap.
 * Utile per logging e decisioni di debug.
 *
 * @param {Object[]} sortedRules - Array di regole gia' ordinate (da sortByPriority)
 * @param {number} cap - Numero massimo di regole (es. MAX_NUMBER_OF_DYNAMIC_RULES)
 * @param {Set<string>} [liveFilters=new Set()] - Set di urlFilter gia' in produzione
 * @returns {string} - Rappresentazione testuale multi-riga del riepilogo
 */
function summarize(sortedRules, cap, liveFilters = new Set()) {
  const tierNames = ['ALLOW', 'LIVE', 'CURATED', 'BULK'];
  const totalByTier = { ALLOW: 0, LIVE: 0, CURATED: 0, BULK: 0 };
  const survivingByTier = { ALLOW: 0, LIVE: 0, CURATED: 0, BULK: 0 };

  // Contiamo totali e sopravvissuti per ogni tier
  sortedRules.forEach((rule, index) => {
    const { tier } = scoreRule(rule, liveFilters);
    totalByTier[tierNames[tier]]++;
    if (index < cap) {
      survivingByTier[tierNames[tier]]++;
    }
  });

  const lines = [];
  lines.push(`Riepilogo regole (cap: ${cap}):`);
  lines.push('-'.repeat(40));

  for (const name of tierNames) {
    const total = totalByTier[name];
    const surviving = survivingByTier[name];
    const cut = total - surviving;
    lines.push(`  ${name}: ${surviving}/${total} (tagliate: ${cut})`);
  }

  lines.push('-'.repeat(40));
  const totalRules = sortedRules.length;
  lines.push(`  TOTALE: ${Math.min(totalRules, cap)}/${totalRules}`);

  return lines.join('\n');
}

const DEFAULT_QUOTAS = Object.freeze({ CURATED: 0.6, LIVE: 0.4 });

/**
 * Seleziona le regole da mantenere nel feed distribuendo il budget tra tier.
 * ALLOW sono sempre incluse (eccezioni anti-falso-positivo, tagliarne una rompe un sito).
 * Il budget residuo viene diviso tra CURATED e LIVE secondo le quote definite.
 * L'avanzo di un tier passa all'altro per non sprecare posti.
 * @param {Array} rules - Regole da filtrare
 * @param {Object} liveFilters - Filtri live per calcolare i pesi
 * @param {number} cap - Numero massimo di regole da selezionare
 * @param {Object} quotas - Quote di distribuzione (default: DEFAULT_QUOTAS)
 * @returns {Array} Regole selezionate, ordinate per tier/weight/indice, max lunghezza cap
 */
function selectWithQuotas(rules, liveFilters, cap, quotas = DEFAULT_QUOTAS) {
  if (!rules || !rules.length || cap <= 0) return [];

  // 1. Calcola tier e weight di ogni regola, tiene traccia dell'indice originale
  const scored = rules.map((rule, idx) => {
    const { tier, weight } = scoreRule(rule, liveFilters);
    return { rule, tier, weight, idx };
  });

  // 2. Raggruppa per tier e ordina ogni gruppo per weight asc, poi indice asc
  // scoreRule restituisce tier NUMERICO: va indicizzato via TIER, non per nome.
  const groups = { ALLOW: [], CURATED: [], LIVE: [], BULK: [] };
  const TIER_NAME = { [TIER.ALLOW]: 'ALLOW', [TIER.LIVE]: 'LIVE', [TIER.CURATED]: 'CURATED', [TIER.BULK]: 'BULK' };
  scored.forEach(item => {
    groups[TIER_NAME[item.tier]].push(item);
  });

  Object.values(groups).forEach(arr => arr.sort((a, b) => a.weight - b.weight || a.idx - b.idx));

  const result = [];

  // 3. ALLOW entrano SEMPRE tutte, fuori quota: sono l'eccezione anti-falso-positivo
  const allowRules = groups.ALLOW;
  result.push(...allowRules);

  // Sottrae il numero di ALLOW dal cap; se gia' sfora, tronca e ritorna
  let remaining = cap - allowRules.length;
  if (remaining <= 0) return result.slice(0, cap).map(item => item.rule);

  // 4. Calcola budget per tier secondo le quote
  // Math.round per non perdere posti con numeri dispari (es. cap=5 -> 3+2)
  const curatedBudget = Math.round(remaining * quotas.CURATED);
  const liveBudget = remaining - curatedBudget;

  // 5. Se un tier ha meno regole del suo budget, l'avanzo passa all'altro tier
  const curatedSelected = groups.CURATED.slice(0, curatedBudget);
  const liveSelected = groups.LIVE.slice(0, liveBudget);

  // Ricalcola avanzi reali per trasferirli
  const curatedSurplus = curatedBudget - curatedSelected.length;
  const liveSurplus = liveBudget - liveSelected.length;

  // Applica selezione con avanzi trasferiti
  if (curatedSurplus > 0) {
    liveSelected.push(...groups.LIVE.slice(liveBudget, liveBudget + curatedSurplus));
  } else if (liveSurplus > 0) {
    curatedSelected.push(...groups.CURATED.slice(curatedBudget, curatedBudget + liveSurplus));
  }

  result.push(...curatedSelected, ...liveSelected);

  // 6. Se ancora avanza budget, riempilo con le regole BULK migliori
  remaining = cap - result.length;
  if (remaining > 0) {
    result.push(...groups.BULK.slice(0, remaining));
  }

  // 7. Ordina risultato finale: tier asc, weight asc, indice asc
  result.sort((a, b) => a.tier - b.tier || a.weight - b.weight || a.idx - b.idx);
  // Srotola i wrapper: il chiamante vuole le regole, non gli oggetti di scoring.
  return result.slice(0, cap).map(item => item.rule);
}

/**
 * Riepiloga la selezione per ogni tier.
 * @param {Array} selected - Regole selezionate
 * @param {Array} all - Tutte le regole disponibili
 * @param {Object} liveFilters - Filtri live per calcolare i tier
 * @returns {string} Riga per tier nel formato '  NOME: selezionate/disponibili'
 */
function summarizeSelection(selected, all, liveFilters) {
  const names = ['ALLOW', 'LIVE', 'CURATED', 'BULK'];
  const count = list => {
    const acc = [0, 0, 0, 0];
    for (const rule of list) acc[scoreRule(rule, liveFilters).tier]++;
    return acc;
  };
  const totali = count(all);
  const scelte = count(selected);
  return names
    .map((name, tier) => `  ${name}: ${scelte[tier]}/${totali[tier]}`)
    .join('\n');
}

module.exports = { sortByPriority, selectWithQuotas, summarizeSelection, scoreRule, loadLiveFilters, summarize, TIER, DEFAULT_QUOTAS };
