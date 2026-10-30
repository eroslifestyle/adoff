const fs = require('fs');
const path = require('path');

const TARGETS = ['app', 'app-firefox', 'app-safari'];
const OLD_VERSION = '3.5.61';
const NEW_VERSION = '3.5.62';
const CHANGELOG_KEY = 'CHANGELOGS';
const CHANGELOG_ENTRY = [
  '    "3.5.62": [',
  '      "Protezione attiva anche dentro i player incorporati",',
  '      "Blocco degli annunci a comparsa indipendente dal sito",',
  '      "Riconoscimento dei circuiti pubblicitari che cambiano indirizzo"',
  '    ],'
];

// Helper: verifica esistenza file
function fileExists(filePath) {
  try {
    return fs.statSync(filePath).isFile();
  } catch {
    return false;
  }
}

// Helper: legge e parse JSON
function readJSON(filePath) {
  const content = fs.readFileSync(filePath, 'utf8');
  try {
    return JSON.parse(content);
  } catch (e) {
    throw new Error(`JSON non valido in ${filePath}: ${e.message}`);
  }
}

// Helper: legge file come testo
function readText(filePath) {
  return fs.readFileSync(filePath, 'utf8');
}

// Helper: scrive file JSON con indentazione 2 spazi e newline finale
function writeJSON(filePath, data) {
  fs.writeFileSync(filePath, JSON.stringify(data, null, 2) + '\n');
}

// Helper: scrive file di testo
function writeText(filePath, content) {
  fs.writeFileSync(filePath, content, 'utf8');
}

// Fase di validazione
function validate() {
  for (const target of TARGETS) {
    const manifestPath = path.join(target, 'manifest.json');
    const bgPath = path.join(target, 'src', 'background.js');
    const popupPath = path.join(target, 'src', 'popup.js');

    // Verifica manifest.json
    if (!fileExists(manifestPath)) {
      console.error(`Errore: manca ${manifestPath}`);
      process.exit(1);
    }

    // Verifica background.js e popup.js
    for (const file of [bgPath, popupPath]) {
      if (!fileExists(file)) {
        console.error(`Errore: manca ${file}`);
        process.exit(1);
      }
    }

    // Verifica versione manifest
    const manifest = readJSON(manifestPath);
    if (manifest.version !== OLD_VERSION) {
      console.error(`Errore: versione non ${OLD_VERSION} in ${manifestPath} (attuale: ${manifest.version})`);
      process.exit(1);
    }

    // Verifica CHANGELOGS in background.js e popup.js
    for (const file of [bgPath, popupPath]) {
      const content = readText(file);
      const changelogLine = content
        .split('\n')
        .find(line => line.includes(`const ${CHANGELOG_KEY}`) && line.includes('{'));
      if (!changelogLine) {
        console.error(`Errore: manca dichiarazione di const ${CHANGELOG_KEY} in ${file}`);
        process.exit(1);
      }
    }
  }
}

// Fase di scrittura
function updateFiles() {
  let modifiedCount = 0;

  for (const target of TARGETS) {
    const manifestPath = path.join(target, 'manifest.json');
    const bgPath = path.join(target, 'src', 'background.js');
    const popupPath = path.join(target, 'src', 'popup.js');

    // 1. Aggiorna manifest.json
    const manifest = readJSON(manifestPath);
    manifest.version = NEW_VERSION;
    writeJSON(manifestPath, manifest);
    console.log(`[OK] ${manifestPath}: versione aggiornata a ${NEW_VERSION}`);

    // 2. Aggiorna background.js e popup.js
    for (const file of [bgPath, popupPath]) {
      const content = readText(file);
      const lines = content.split('\n');

      // Trova la riga con CHANGELOGS e la riga successiva (per indentazione)
      let changelogLineIndex = -1;
      for (let i = 0; i < lines.length; i++) {
        if (lines[i].includes(`const ${CHANGELOG_KEY}`) && lines[i].includes('{')) {
          changelogLineIndex = i;
          break;
        }
      }

      if (changelogLineIndex === -1) continue; // Non dovrebbe accadere, ma per sicurezza

      const nextLine = lines[changelogLineIndex + 1];
      const indentMatch = nextLine.match(/^(\s*)/);
      const baseIndent = indentMatch ? indentMatch[1] : '';
      const innerIndent = baseIndent + '  ';

      // Costruisci entry con indentazione corretta
      const entryLines = [
        baseIndent + '  "3.5.62": [',
        innerIndent + '"Protezione attiva anche dentro i player incorporati",',
        innerIndent + '"Blocco degli annunci a comparsa indipendente dal sito",',
        innerIndent + '"Riconoscimento dei circuiti pubblicitari che cambiano indirizzo"',
        baseIndent + '  ],'
      ];

      // Controlla se 3.5.62 è già presente
      if (content.includes('"3.5.62":')) {
        console.log(`[SKIPPED] ${file}: voce 3.5.62 già presente`);
        continue;
      }

      // Inserisci l'entry subito dopo la riga CHANGELOGS
      lines.splice(changelogLineIndex + 1, 0, ...entryLines);

      writeText(file, lines.join('\n'));
      console.log(`[OK] ${file}: voce 3.5.62 inserita`);
      modifiedCount++;
    }
  }

  console.log(`\nRiepilogo: ${modifiedCount} file di codice modificati`);
}

// Esecuzione
validate();
updateFiles();
