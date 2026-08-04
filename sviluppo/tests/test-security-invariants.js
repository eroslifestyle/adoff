/**
 * =============================================================================
 * TEST DI REGRESSIONE SICUREZZA - AdOff Extension
 * =============================================================================
 * Scopo: Bloccare il ritorno di 8 bug di sicurezza corretti il 2026-08-04 (commit 621210d).
 * Il test LEGGE i file sorgente reali e verifica invarianti; non duplica la logica.
 * Esecuzione: node sviluppo/tests/test-security-invariants.js dalla root del progetto.
 * Ogni test corrisponde a un bug reale gia' accaduto in produzione.
 * =============================================================================
 */

const fs = require('fs');
const path = require('path');
const crypto = require('crypto');

const ROOT = path.resolve(__dirname, '../..');
const TARGETS = ['app', 'app-firefox', 'app-safari'];

// Costanti di test
const TRIAL_DAYS_ATTESO = 15;
const TRIAL_MS_ATTESO = 15 * 24 * 60 * 60 * 1000;

const CASE_MATCH_DOMINIO = [
  ['google.co.uk', 'google.co', true],
  ['www.google.co.uk', 'google.co', true],
  ['google.com.au', 'google.co', true],
  ['google.co.jp', 'google.co', true],
  ['google.co.evil.tk', 'google.co', false],
  ['googleXco.uk', 'google.co', false],
  ['evilgoogle.co.uk', 'google.co', false],
  ['google.com', 'google.com', true],
  ['www.google.com', 'google.com', true],
  ['youtube.com', 'youtube.com', true],
  ['www.youtube.com', 'youtube.com', true],
  ['youtube.com.malware.tk', 'youtube.com', false],
  ['netflix.com', 'netflix.com', true],
  ['fakenetflix.com', 'netflix.com', false],
  ['raiplay.it', 'raiplay.it', true],
  ['raiplay.it.ads.tk', 'raiplay.it', false],
];

const PROPRIETA_COLLAPSE = ['display', 'height', 'min-height', 'margin', 'padding', 'overflow'];

const FILE_CONDIVISI = [
  'content.js',
  'background.js',
  'stealth.js',
  'license-client.js',
  'popup.js',
  'popup-blocker.js',
  'options.js',
  'i18n.js',
];

// Contatori risultati
let passati = 0;
let falliti = 0;

function stampaRiga(test, messaggio) {
  console.log(`[${test}] ${messaggio}`);
}

function ok(test, nome) {
  passati++;
  stampaRiga('OK', nome);
}

function fail(test, nome, dettaglio) {
  falliti++;
  stampaRiga('FAIL', `${nome}: ${dettaglio}`);
}

function ottieniContenuto(...segments) {
  const percorso = path.join(ROOT, ...segments);
  if (!fs.existsSync(percorso)) {
    return null;
  }
  return fs.readFileSync(percorso, 'utf8');
}

function estraiFunzione(codice, nome) {
  // Non usiamo regex per il body perche' il lazy matching si ferma alla prima
  // graffa chiusa, fallendo con blocchi if/else/switch annidati. Usiamo invece
  // conteggio delle graffe per trovare la fine reale del blocco.
  let posizione = -1;

  // Cerca la dichiarazione nell'ordine: function, const, let
  const functionIdx = codice.indexOf(`function ${nome}`);
  if (functionIdx !== -1) {
    posizione = functionIdx;
  }

  const constIdx = codice.indexOf(`const ${nome}`);
  if (constIdx !== -1 && (posizione === -1 || constIdx < posizione)) {
    posizione = constIdx;
  }

  const letIdx = codice.indexOf(`let ${nome}`);
  if (letIdx !== -1 && (posizione === -1 || letIdx < posizione)) {
    posizione = letIdx;
  }

  if (posizione === -1) {
    return null;
  }

  // Trova l'inizio e la fine dei parametri
  const inizioParams = codice.indexOf('(', posizione);
  if (inizioParams === -1) {
    return null;
  }

  const fineParams = codice.indexOf(')', inizioParams);
  if (fineParams === -1) {
    return null;
  }

  // Trova la graffa aperta dopo i parametri
  const graffaAp = codice.indexOf('{', fineParams);
  if (graffaAp === -1) {
    return null;
  }

  // Conteggio delle graffe per trovare la fine del blocco
  let depth = 1;
  let graffa = graffaAp + 1;

  while (graffa < codice.length && depth > 0) {
    if (codice[graffa] === '{') {
      depth++;
    } else if (codice[graffa] === '}') {
      depth--;
    }
    graffa++;
  }

  const params = codice.substring(inizioParams + 1, fineParams).trim();
  const body = codice.substring(graffaAp + 1, graffa - 1).trim();

  return { params, body };
}

function estraiCorpoAsyncFunction(codice, nome) {
  const inizio = codice.indexOf(`async function ${nome}`);
  if (inizio === -1) return null;

  let braceCount = 0;
  let started = false;
  let fine = -1;

  for (let i = inizio; i < codice.length; i++) {
    if (codice[i] === '{') {
      braceCount++;
      started = true;
    } else if (codice[i] === '}') {
      braceCount--;
      if (started && braceCount === 0) {
        fine = i;
        break;
      }
    }
  }

  if (fine === -1) return null;
  const firma = codice.substring(inizio, inizio + codice.substring(inizio).indexOf('{') + 1);
  const corpo = codice.substring(inizio + firma.length, fine);
  return corpo.trim();
}

// =============================================================================
// TEST 1: matchDominio
// =============================================================================
function testaMatchDominio() {
  console.log('\n=== TEST 1: matchDominio ===');

  for (const target of TARGETS) {
    const fileStealth = ottieniContenuto(target, 'src', 'stealth.js');
    const fileBlocker = ottieniContenuto(target, 'src', 'popup-blocker.js');

    for (const [nome, contenuto] of [['stealth.js', fileStealth], ['popup-blocker.js', fileBlocker]]) {
      if (!contenuto) {
        fail('T1', `${target}/${nome}`, 'File non trovato');
        continue;
      }

      const fn = estraiFunzione(contenuto, 'matchDominio');
      if (!fn) {
        fail('T1', `${target}/${nome}`, 'Funzione matchDominio non trovata');
        continue;
      }

      try {
        const funzione = new Function(fn.params, fn.body);
        let tuttoOk = true;

        for (const [host, dominio, atteso] of CASE_MATCH_DOMINIO) {
          const risultato = funzione(host, dominio);
          if (risultato !== atteso) {
            fail('T1', `${target}/${nome} match(${host}, ${dominio})`, `Atteso ${atteso}, ottenuto ${risultato}`);
            tuttoOk = false;
          }
        }

        if (tuttoOk) {
          ok('T1', `${target}/${nome}`);
        }
      } catch (e) {
        fail('T1', `${target}/${nome}`, `Errore eval: ${e.message}`);
      }
    }
  }
}

// =============================================================================
// TEST 2: nessun matching per sottostringa
// =============================================================================
function testaNoSubstringMatch() {
  console.log('\n=== TEST 2: No substring matching sui domini ===');

  for (const target of TARGETS) {
    const srcDir = path.join(ROOT, target, 'src');
    if (!fs.existsSync(srcDir)) {
      fail('T2', target, 'Directory src non trovata');
      continue;
    }

    const fileJs = fs.readdirSync(srcDir).filter(f => f.endsWith('.js'));

    for (const file of fileJs) {
      const contenuto = ottieniContenuto(target, 'src', file);

      if (contenuto.includes('hostname.includes(d)')) {
        fail('T2', `${target}/${file}`, 'Trovato hostname.includes(d)');
      } else if (contenuto.includes('d.includes(hostname)')) {
        fail('T2', `${target}/${file}`, 'Trovato d.includes(hostname)');
      } else {
        ok('T2', `${target}/${file}`);
      }
    }
  }
}

// =============================================================================
// TEST 3: gate anti-doppia-istanza
// =============================================================================
function testaGateAntiDoppiaIstanza() {
  console.log('\n=== TEST 3: Gate anti-doppia-istanza sul DOM ===');

  for (const target of TARGETS) {
    const contenuto = ottieniContenuto(target, 'src', 'content.js');

    if (!contenuto) {
      fail('T3', target, 'content.js non trovato');
      continue;
    }

    const haGetAttribute = contenuto.includes("getAttribute('data-adoff-loaded')") ||
                           contenuto.includes('getAttribute("data-adoff-loaded")');
    const haGateWindow = contenuto.includes('__adoffContentLoaded');

    if (haGetAttribute) {
      fail('T3', target, 'Trovato getAttribute data-adoff-loaded (vulnerabile)');
    } else if (!haGateWindow) {
      fail('T3', target, 'Manca gate su window __adoffContentLoaded');
    } else {
      ok('T3', target);
    }
  }
}

// =============================================================================
// TEST 4: nessun fallback trial bypassabile
// =============================================================================
function testaNoTrialBypass() {
  console.log('\n=== TEST 4: No fallback trial bypassabile ===');

  for (const target of TARGETS) {
    const contentJs = ottieniContenuto(target, 'src', 'content.js');
    const backgroundJs = ottieniContenuto(target, 'src', 'background.js');

    for (const [nome, contenuto] of [['content.js', contentJs], ['background.js', backgroundJs]]) {
      if (!contenuto) {
        fail('T4', `${target}/${nome}`, 'File non trovato');
        continue;
      }

      const corpo = estraiCorpoAsyncFunction(contenuto, 'isTrialActive');
      if (!corpo) {
        fail('T4', `${target}/${nome}`, 'Funzione isTrialActive non trovata');
        continue;
      }

      if (corpo.includes('adoffTrialEnd')) {
        fail('T4', `${target}/${nome}`, 'Trovato accesso a adoffTrialEnd in isTrialActive');
      } else {
        ok('T4', `${target}/${nome}`);
      }
    }
  }
}

// =============================================================================
// TEST 5: coerenza durata trial
// =============================================================================
function testaCoerenzaTrial() {
  console.log('\n=== TEST 5: Coerenza durata trial ===');

  const bgApp = ottieniContenuto('app', 'src', 'background.js');
  const lcApp = ottieniContenuto('app', 'src', 'license-client.js');

  if (!bgApp) {
    fail('T5', 'app/background.js', 'File non trovato');
  } else {
    const matchTrialDays = bgApp.match(/TRIAL_DAYS\s*=\s*(\d+)/);
    if (!matchTrialDays) {
      fail('T5', 'app/background.js', 'TRIAL_DAYS non trovato');
    } else {
      const trialDays = parseInt(matchTrialDays[1], 10);
      if (trialDays !== TRIAL_DAYS_ATTESO) {
        fail('T5', 'app/background.js TRIAL_DAYS', `Atteso ${TRIAL_DAYS_ATTESO}, ottenuto ${trialDays}`);
      } else {
        ok('T5', 'app/background.js TRIAL_DAYS');
      }
    }
  }

  if (!lcApp) {
    fail('T5', 'app/license-client.js', 'File non trovato');
  } else {
    // L'espressione e' scritta come "15 * 24 * 60 * 60 * 1000": va valutata,
    // non letta come primo numero (leggere solo "15" dava un falso positivo).
    const matchTrialMs = lcApp.match(/TRIAL_DURATION_MS\s*=\s*([\d\s*]+);/);
    if (!matchTrialMs) {
      fail('T5', 'app/license-client.js', 'TRIAL_DURATION_MS non trovato');
    } else {
      const trialMs = matchTrialMs[1].split('*').reduce((a, n) => a * parseInt(n.trim(), 10), 1);
      if (trialMs !== TRIAL_MS_ATTESO) {
        fail('T5', 'app/license-client.js TRIAL_DURATION_MS', `Atteso ${TRIAL_MS_ATTESO}, ottenuto ${trialMs}`);
      } else {
        ok('T5', 'app/license-client.js TRIAL_DURATION_MS');
      }
    }
  }
}

// =============================================================================
// TEST 6: stop() ripristina tutte le proprieta'
// =============================================================================
function testaStopRipristina() {
  console.log('\n=== TEST 6: stop() ripristina tutte le proprieta\' ===');

  for (const target of TARGETS) {
    const contenuto = ottieniContenuto(target, 'src', 'content.js');

    if (!contenuto) {
      fail('T6', target, 'content.js non trovato');
      continue;
    }

    const fn = estraiFunzione(contenuto, 'stop');
    if (!fn) {
      fail('T6', target, 'Funzione stop() non trovata');
      continue;
    }

    let tuttoOk = true;
    for (const prop of PROPRIETA_COLLAPSE) {
      if (!fn.body.includes(prop)) {
        fail('T6', `${target} stop()`, `Manca ripristino di ${prop}`);
        tuttoOk = false;
      }
    }

    if (tuttoOk) {
      ok('T6', target);
    }
  }
}

// =============================================================================
// TEST 7: build esclude backup
// =============================================================================
function testaBuildEscludeBackup() {
  console.log('\n=== TEST 7: Build esclude file backup ===');

  const buildScript = ottieniContenuto('sviluppo', 'scripts', 'build.js');

  if (!buildScript) {
    fail('T7', 'sviluppo/scripts/build.js', 'File non trovato');
    return;
  }

  const estensioniBackup = ['bak', 'orig', 'rej', 'tmp', 'swp'];
  const corpoCopyDir = estraiFunzione(buildScript, 'copyDir');

  if (!corpoCopyDir) {
    fail('T7', 'copyDir', 'Funzione copyDir non trovata');
    return;
  }

  let tuttoOk = true;
  for (const ext of estensioniBackup) {
    if (!corpoCopyDir.body.includes(ext)) {
      fail('T7', `copyDir filtro ${ext}`, 'Estensione non filtrata');
      tuttoOk = false;
    }
  }

  if (tuttoOk) {
    ok('T7', 'copyDir filtra backup');
  }
}

// =============================================================================
// TEST 8: sincronizzazione multi-browser
// =============================================================================
function calcolaMd5(contenuto) {
  return crypto.createHash('md5').update(contenuto).digest('hex');
}

function testaSincronizzazioneBrowser() {
  console.log('\n=== TEST 8: Sincronizzazione multi-browser ===');

  const hashPerFile = {};

  for (const file of FILE_CONDIVISI) {
    const hashPerTarget = {};

    for (const target of TARGETS) {
      const contenuto = ottieniContenuto(target, 'src', file);
      if (!contenuto) {
        fail('T8', `${target}/${file}`, 'File non trovato');
        return;
      }
      hashPerTarget[target] = calcolaMd5(contenuto);
    }

    hashPerFile[file] = hashPerTarget;
  }

  for (const file of FILE_CONDIVISI) {
    const hashes = Object.values(hashPerFile[file]);
    const primo = hashes[0];
    const tuttiUguali = hashes.every(h => h === primo);

    if (tuttiUguali) {
      ok('T8', file);
    } else {
      const dettagli = Object.entries(hashPerFile[file])
        .map(([t, h]) => `${t}: ${h.substring(0, 8)}...`)
        .join(' | ');
      fail('T8', file, `Hash diversi: ${dettagli}`);
    }
  }
}

// =============================================================================
// TEST 9: Regole di rete non appuntate a domini a rotazione
// =============================================================================
// Le regole popunder erano legate a un dominio con numero fisso.
// Quando il numero cambia la regola diventa inerte senza segnalazione.
// Questo test impedisce la regressione.
// =============================================================================
function testaRegoleNonPinnate() {
  console.log('\n=== TEST 9: Regole di rete non appuntate a domini a rotazione ===');

  const fileRules = TARGETS.map(t => path.join(t, 'rules', 'adblock-rules.json'));
  const contents = [];

  // Legge tutti i file di regole
  // Normalizzazione: il file è un array JSON al primo livello.
  // Senza questa normalizzazione .rules sarebbe undefined e il test sarebbe cieco.
  for (let i = 0; i < fileRules.length; i++) {
    const file = fileRules[i];
    try {
      const parsed = JSON.parse(fs.readFileSync(file, 'utf8'));
      contents.push(Array.isArray(parsed) ? parsed : (parsed.rules || []));
    } catch (e) {
      fail('T9', file, `Impossibile leggere: ${e.message}`);
      return;
    }
  }

  // a) Nessun urlFilter deve appuntare un dominio di famiglia numerata
  // Pattern: lettere+ cifre+ . tld (es. abc123.example.com)
  const reDominioNumerato = /^(\|\|)?[a-zA-Z]{2,}\d+\.[a-zA-Z]{2,}$/;
  for (let i = 0; i < contents.length; i++) {
    const rules = contents[i];
    let trovato = false;
    for (const rule of rules) {
      if (rule.action && rule.action.type === 'block' && rule.condition && rule.condition.urlFilter) {
        const filtro = rule.condition.urlFilter;
        if (reDominioNumerato.test(filtro)) {
          fail('T9a', fileRules[i], `Regola ${rule.id} appunta dominio numerato: ${filtro}`);
          trovato = true;
        }
      }
    }
    // OK: nessun dominio numerato pinnato in questo file
    if (!trovato) {
      ok('T9a', fileRules[i], 'Nessun dominio numerato pinnato');
    }
  }

  // b) Regole 931, 932, 933 devono avere regexFilter e NON urlFilter
  for (let i = 0; i < contents.length; i++) {
    const rules = contents[i];
    const idsAttesi = [931, 932, 933];
    for (const idAtteso of idsAttesi) {
      const rule = rules.find(r => r.id === idAtteso);
      if (!rule) {
        fail('T9b', fileRules[i], `Manca regola id=${idAtteso}`);
      } else if (rule.condition) {
        const haRegex = !!rule.condition.regexFilter;
        const haUrl = !!rule.condition.urlFilter;
        if (!haRegex) {
          fail('T9b', fileRules[i], `Regola ${idAtteso} manca regexFilter`);
        } else if (haUrl) {
          fail('T9b', fileRules[i], `Regola ${idAtteso} ha urlFilter (incompatibile con regexFilter)`);
        } else {
          // OK: regola presente con regexFilter e senza urlFilter
          ok('T9b', fileRules[i], `Regola ${idAtteso} ha regexFilter e nessun urlFilter`);
        }
      } else {
        fail('T9b', fileRules[i], `Regola ${idAtteso} senza condition`);
      }
    }
  }

  // c) Ogni regexFilter richiede resourceTypes non vuoto
  for (let i = 0; i < contents.length; i++) {
    const rules = contents[i];
    let difettose = 0;
    for (const rule of rules) {
      if (rule.condition && rule.condition.regexFilter) {
        const rt = rule.condition.resourceTypes;
        if (!rt || rt.length === 0) {
          fail('T9c', fileRules[i], `Regola ${rule.id} ha regexFilter senza resourceTypes`);
          difettose++;
        }
      }
    }
    // OK: tutte le regexFilter hanno resourceTypes valorizzati
    if (difettose === 0) {
      ok('T9c', fileRules[i], 'Tutti i regexFilter hanno resourceTypes');
    }
  }

  // d) Id univoci dentro ogni file
  for (let i = 0; i < contents.length; i++) {
    const rules = contents[i];
    const ids = rules.map(r => r.id).filter(id => id !== undefined);
    const unici = new Set(ids);
    if (ids.length !== unici.size) {
      const duplicati = ids.filter((id, idx) => ids.indexOf(id) !== idx);
      fail('T9d', fileRules[i], `Id duplicati: ${[...new Set(duplicati)].join(', ')}`);
    } else {
      // OK: id univoci in questo file
      ok('T9d', fileRules[i], 'Id univoci');
    }
  }

  // e) I tre file devono essere identici
  if (contents[0] && contents[1] && contents[2]) {
    const c0 = JSON.stringify(contents[0], null, 0);
    const c1 = JSON.stringify(contents[1], null, 0);
    const c2 = JSON.stringify(contents[2], null, 0);
    if (c0 !== c1) {
      fail('T9e', fileRules[0], `File diverso da ${fileRules[1]}`);
    }
    if (c0 !== c2) {
      fail('T9e', fileRules[0], `File diverso da ${fileRules[2]}`);
    }
    // OK: tutti e tre i file sono identici
    if (c0 === c1 && c0 === c2) {
      ok('T9e', 'Tre target identici');
    }
  }
}
// =============================================================================
// TEST 10 - La mappa è una lista manuale: un file mancante non produce alcun
// avviso, il pacchetto esce silenziosamente incompleto.
// =============================================================================
function testaBuildIncludeContentScript() {
  console.log('\n=== TEST 10: Ogni content script finisce nel pacchetto ===');

  // Legge build.js una sola volta fuori dal ciclo
  const buildJsPath = path.join(ROOT, 'sviluppo', 'scripts', 'build.js');
  let buildJsContent;
  try {
    buildJsContent = fs.readFileSync(buildJsPath, 'utf8');
  } catch (e) {
    fail('T10', 'sviluppo/scripts/build.js', 'impossibile leggere: ' + e.message);
    return;
  }

  for (const target of TARGETS) {
    const manifestPath = path.join(ROOT, target, 'manifest.json');
    let manifest;
    try {
      manifest = JSON.parse(fs.readFileSync(manifestPath, 'utf8'));
    } catch (e) {
      fail('T10', target, 'non leggo manifest.json - ' + e.message);
      continue;
    }

    const entries = manifest.content_scripts || [];
    for (const entry of entries) {
      const files = entry.js || [];
      for (const src of files) {
        const fileName = path.basename(src);
        const quoted = `"${fileName}"`;
        if (buildJsContent.includes(quoted)) {
          ok('T10', `${target}/${fileName}`);
        } else {
          fail('T10', `${target}/${fileName}`, 'content script dichiarato nel manifest ma assente dalla mappa dei profili di build.js: non verrebbe copiato nel pacchetto');
        }
      }
    }
  }
}

// =============================================================================
// MAIN
// =============================================================================
function main() {
  console.log('='.repeat(70));
  console.log('ADOFF SECURITY INVARIANTS TEST');
  console.log('Root: ' + ROOT);
  console.log('Targets: ' + TARGETS.join(', '));
  console.log('='.repeat(70));

  testaMatchDominio();
  testaNoSubstringMatch();
  testaGateAntiDoppiaIstanza();
  testaNoTrialBypass();
  testaCoerenzaTrial();
  testaStopRipristina();
  testaBuildEscludeBackup();
  testaSincronizzazioneBrowser();
  testaRegoleNonPinnate();
  testaBuildIncludeContentScript();

  console.log('\n' + '='.repeat(70));
  console.log(`RIEPILOGO: ${passati} passati / ${falliti} falliti`);
  console.log('='.repeat(70));

  process.exit(falliti > 0 ? 1 : 0);
}

main();
