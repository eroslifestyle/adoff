const fs = require('fs');
const path = require('path');

const root = path.resolve(__dirname, '../..');

if (process.argv.length < 6) {
  console.log('Uso: node prepare-release.js <versioneAttuale> <versioneNuova> <riga1> <riga2> <riga3>');
  process.exit(1);
}

const [,, versioneAttuale, versioneNuova, riga1, riga2, riga3] = process.argv;
const targets = ['app', 'app-firefox', 'app-safari'];
const errori = [];
const modificati = [];

for (const target of targets) {
  const manifestPath = path.join(root, target, 'manifest.json');
  const nomeManifest = `${target}/manifest.json`;

  if (!fs.existsSync(manifestPath)) {
    errori.push(`File non trovato: ${nomeManifest}`);
    continue;
  }

  let manifest;
  try {
    manifest = JSON.parse(fs.readFileSync(manifestPath, 'utf8'));
  } catch (e) {
    errori.push(`JSON non valido in ${nomeManifest}: ${e.message}`);
    continue;
  }

  if (manifest.version !== versioneAttuale) {
    errori.push(`Versione di ${nomeManifest} e "${manifest.version}", atteso "${versioneAttuale}"`);
  }

  for (const file of ['background.js', 'popup.js']) {
    const codePath = path.join(root, target, 'src', file);
    const nomeFile = `${target}/src/${file}`;

    if (!fs.existsSync(codePath)) {
      errori.push(`File non trovato: ${nomeFile}`);
      continue;
    }

    const contenuto = fs.readFileSync(codePath, 'utf8');
    if (!/CHANGELOGS\s*=\s*\{/.test(contenuto)) {
      errori.push(`File senza dichiarazione "CHANGELOGS {": ${nomeFile}`);
    }
  }
}

if (errori.length > 0) {
  for (const err of errori) console.error(err);
  process.exit(1);
}

for (const target of targets) {
  const manifestPath = path.join(root, target, 'manifest.json');
  const manifest = JSON.parse(fs.readFileSync(manifestPath, 'utf8'));
  manifest.version = versioneNuova;
  fs.writeFileSync(manifestPath, JSON.stringify(manifest, null, 2) + '\n');
  console.log(`Aggiornato: ${target}/manifest.json`);
  modificati.push(`${target}/manifest.json`);

  for (const file of ['background.js', 'popup.js']) {
    const codePath = path.join(root, target, 'src', file);
    const nomeFile = `${target}/src/${file}`;
    const lines = fs.readFileSync(codePath, 'utf8').split('\n');

    let declIndex = -1;
    for (let i = 0; i < lines.length; i++) {
      if (/CHANGELOGS\s*=\s*\{/.test(lines[i])) {
        declIndex = i;
        break;
      }
    }

    if (declIndex === -1 || declIndex + 1 >= lines.length) {
      console.error(`Struttura CHANGELOGS non valida in ${nomeFile}`);
      process.exit(1);
    }

    const versioneGiaPresente = lines.some(line => line.trim().startsWith(`"${versioneNuova}":`));
    if (versioneGiaPresente) {
      console.log(`Versione gia presente (skipped): ${nomeFile}`);
      continue;
    }

    const nextLine = lines[declIndex + 1];
    const indent = nextLine.match(/^(\s*)/)[1];
    const innerIndent = indent + '  ';

    const escapeQuotes = s => s.replace(/"/g, "'");
    const newEntry = [
      indent + `"${versioneNuova}": [`,
      innerIndent + `"${escapeQuotes(riga1)}",`,
      innerIndent + `"${escapeQuotes(riga2)}",`,
      innerIndent + `"${escapeQuotes(riga3)}",`,
      indent + `],`
    ];

    lines.splice(declIndex + 1, 0, ...newEntry);
    fs.writeFileSync(codePath, lines.join('\n'));
    console.log(`Aggiornato: ${nomeFile}`);
    modificati.push(nomeFile);
  }
}

console.log(`\nRiepilogo: ${modificati.length} file modificati.`);
