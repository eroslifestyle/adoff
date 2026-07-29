'use strict';
const fs = require('fs');
const path = require('path');

// Percorso al file delle regole adblock
const RULES_PATH = path.resolve(__dirname, '../../app/rules/adblock-rules.json');

// Leggi le regole
let rawData;
try {
  rawData = fs.readFileSync(RULES_PATH, 'utf8');
} catch (err) {
  console.error('Impossibile leggere il file delle regole:', err.message);
  process.exit(1);
}

let rulesData;
try {
  rulesData = JSON.parse(rawData);
} catch (err) {
  console.error('Il file delle regole non e\' un JSON valido:', err.message);
  process.exit(1);
}

// Accetta sia un array diretto che un oggetto con proprieta' "rules"
const rules = Array.isArray(rulesData) ? rulesData : (Array.isArray(rulesData.rules) ? rulesData.rules : []);

console.log(`Regole caricate: ${rules.length}`);

// --------------------------------------------------------------------------------
// Funzione di utilita' per convertire un filtro URL (pattern) in una espressione
// regolare che approssima la semantica di declarativeNetRequest.
// --------------------------------------------------------------------------------
function patternToRegex(pattern, ancoraDominio) {
  // In declarativeNetRequest urlFilter e' una SOTTOSTRINGA dell'url, non un
  // match completo: ancorare con ^...$ fa passare qualsiasi test (nessun match).
  let regexStr = pattern.replace(/[.+?{}()|[\]\\$]/g, '\\$&');
  regexStr = regexStr.replace(/\*/g, '.*');
  // '^' e' il separatore DNR: carattere non alfanumerico oppure fine stringa.
  regexStr = regexStr.replace(/\^/g, '(?:[^a-zA-Z0-9._%-]|$)');
  if (ancoraDominio) {
    // '||' ancora all'inizio del dominio: accetta schema e sotto-domini.
    return new RegExp('^[a-z]+://(?:[^/]*\\.)?' + regexStr, 'i');
  }
  return new RegExp(regexStr, 'i');
}

/**
 * Verifica se un urlFilter corrisponde a un URL.
 */
function matchUrlFilter(urlFilter, url) {
  const ancoraDominio = urlFilter.startsWith('||');
  const pattern = ancoraDominio ? urlFilter.slice(2) : urlFilter;
  return patternToRegex(pattern, ancoraDominio).test(url);
}

// --------------------------------------------------------------------------------
// URL di esempio
// --------------------------------------------------------------------------------

/**
 * URL reale di un video YouTube in streaming (contiene i parametri tipici del
 * contenuto legittimo, incluso "ctier=L").
 */
const CONTENUTO = 'https://rr1---sn-hpa7znsz.googlevideo.com/videoplayback?expire=1785387723&ei=a4Xa&ip=2a0d&id=o-AKlcu1&source=youtube&requiressl=yes&cps=441&mh=IA&mm=31%2C26&ms=au%2Conr&mv=m&mvi=1&pl=40&rms=au%2Cau&ctier=L&initcwndbps=677500&siu=1&svpuc=1&ns=vE&sabr=1&rqh=1&mt=1785365592&fvip=1&keepalive=yes&c=WEB&n=ixO28xm&rn=37&alr=yes';

/**
 * Secondo URL di contenuto YouTube, identico al precedente ma senza il
 * parametro "ctier". Entrambi rappresentano flussi video legittimi.
 */
const CONTENUTO_2 = 'https://rr2---sn-abc.googlevideo.com/videoplayback?expire=1&id=xyz&source=youtube&sabr=1&rn=3&c=WEB';

/**
 * URL che devono essere bloccati dalle regole pubblicitarie.
 * Usati per verificare che le regole ad‑block continuino a funzionare.
 */
const ADS = [
  'https://doubleclick.net/pagead/viewthroughconversion/123',
  'https://pagead2.googlesyndication.com/pagead/js/adsbygoogle.js',
  'https://googleadservices.com/pagead/aclk?sa=L',
];

// --------------------------------------------------------------------------------
// Esecuzione dei test
// --------------------------------------------------------------------------------
let passed = 0;
const total = 4;

// T1: Verifica che nessuna regola di tipo "block" faccia match con l'URL del
//     contenuto video YouTube (quello con ctier).
//     Se una regola matcha, significa che potrebbe bloccare il video reale,
//     causando una schermata nera e un loop di retry.
let t1Fail = [];
for (const rule of rules) {
  if (rule.action && rule.action.type === 'block') {
    const cond = rule.condition;
    if (cond) {
      const filters = cond.urlFilter ? [cond.urlFilter] : (Array.isArray(cond.urlFilters) ? cond.urlFilters : []);
      for (const filter of filters) {
        if (matchUrlFilter(filter, CONTENUTO)) {
          const hasExclusions = Array.isArray(cond.excludedInitiatorDomains) && cond.excludedInitiatorDomains.length > 0;
          t1Fail.push({ id: rule.id, filter, hasExclusions });
          break;
        }
      }
    }
  }
}
if (t1Fail.length === 0) {
  console.log('PASS T1: il contenuto youtube (ctier) non e\' stato bloccato da nessuna regola.');
  passed++;
} else {
  console.log('FAIL T1: le seguenti regole bloccano il contenuto youtube (ctier):');
  for (const v of t1Fail) {
    const excl = v.hasExclusions ? ' (ha excludedInitiatorDomains)' : '';
    console.log(`  - id: ${v.id}, filtro: ${v.filter}${excl}`);
  }
}

// T2: Come T1, ma con l'URL del contenuto senza il parametro "ctier".
//     Serve a garantire che il blocco non avvenga nemmeno per flussi che non
//     presentano quel marcatore.
let t2Fail = [];
for (const rule of rules) {
  if (rule.action && rule.action.type === 'block') {
    const cond = rule.condition;
    if (cond) {
      const filters = cond.urlFilter ? [cond.urlFilter] : (Array.isArray(cond.urlFilters) ? cond.urlFilters : []);
      for (const filter of filters) {
        if (matchUrlFilter(filter, CONTENUTO_2)) {
          const hasExclusions = Array.isArray(cond.excludedInitiatorDomains) && cond.excludedInitiatorDomains.length > 0;
          t2Fail.push({ id: rule.id, filter, hasExclusions });
          break;
        }
      }
    }
  }
}
if (t2Fail.length === 0) {
  console.log('PASS T2: il contenuto youtube (senza ctier) non e\' stato bloccato da nessuna regola.');
  passed++;
} else {
  console.log('FAIL T2: le seguenti regole bloccano il contenuto youtube (senza ctier):');
  for (const v of t2Fail) {
    const excl = v.hasExclusions ? ' (ha excludedInitiatorDomains)' : '';
    console.log(`  - id: ${v.id}, filtro: ${v.filter}${excl}`);
  }
}

// T3: Verifica che le regole pubblicitarie siano ancora efficaci.
//     Ogni URL in ADS deve essere bloccato da almeno una regola.
let t3Fail = [];
for (const adUrl of ADS) {
  let matched = false;
  for (const rule of rules) {
    if (rule.action && rule.action.type === 'block') {
      const cond = rule.condition;
      if (cond) {
        const filters = cond.urlFilter ? [cond.urlFilter] : (Array.isArray(cond.urlFilters) ? cond.urlFilters : []);
        for (const filter of filters) {
          if (matchUrlFilter(filter, adUrl)) {
            matched = true;
            break;
          }
        }
      }
      if (matched) break;
    }
  }
  if (!matched) {
    t3Fail.push(adUrl);
  }
}
if (t3Fail.length === 0) {
  console.log('PASS T3: tutti gli URL pubblicitari sono bloccati da almeno una regola.');
  passed++;
} else {
  console.log('FAIL T3: i seguenti URL pubblicitari non sono stati bloccati da nessuna regola:');
  for (const u of t3Fail) {
    console.log(`  - ${u}`);
  }
}

// T4: Rileva regole di blocco che靶向 (target) "videoplayback" senza marcare
//     esplicitamente la richiesta come annuncio. Un filtro su videoplayback
//     che non contiene almeno uno dei marcatori tipici di annuncio colpira'
//     inevitabilmente anche il contenuto legittimo.
//     Marcatori cercati: 'oad=', 'adformat', '/ad/', 'ad_break'.
const adMarkers = ['oad=', 'adformat', '/ad/', 'ad_break'];
let t4Fail = [];
for (const rule of rules) {
  if (rule.action && rule.action.type === 'block') {
    const cond = rule.condition;
    if (cond) {
      const filter = cond.urlFilter;
      if (filter && filter.includes('videoplayback')) {
        const lowerFilter = filter.toLowerCase();
        const hasMarker = adMarkers.some(m => lowerFilter.includes(m.toLowerCase()));
        if (!hasMarker) {
          t4Fail.push({ id: rule.id, filter });
        }
      }
    }
  }
}
if (t4Fail.length === 0) {
  console.log('PASS T4: nessuna regola block su videoplayback senza marcatore annuncio.');
  passed++;
} else {
  console.log('FAIL T4: le seguenti regole bloccano videoplayback senza marcatore annuncio:');
  for (const v of t4Fail) {
    console.log(`  - id: ${v.id}, filtro: ${v.filter}`);
  }
}

// Output finale
console.log(`\nRISULTATO: ${passed}/${total} passati`);
if (passed < total) {
  process.exit(1);
}
