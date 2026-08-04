const fs = require('fs');
const path = require('path');

const manifests = [
    'app/manifest.json',
    'app-firefox/manifest.json',
    'app-safari/manifest.json'
];

// Validazione esistenza file prima di ogni scrittura
for (const m of manifests) {
    if (!fs.existsSync(path.resolve(m))) {
        console.error(`File manifest non trovato: ${m}`);
        process.exit(1);
    }
}

// Elaborazione
for (const m of manifests) {
    const fullPath = path.resolve(m);
    let manifest;

    try {
        manifest = JSON.parse(fs.readFileSync(fullPath, 'utf8'));
    } catch (e) {
        console.error(`Errore lettura ${m}: ${e.message}`);
        process.exit(1);
    }

    let csAdded = false;
    let resAdded = false;

    // Pattern per tutti gli url: ricavato dalla prima voce esistente
    const tuttiUrl = manifest.content_scripts?.[0]?.matches?.[0] || '<all_urls>';

    // 1. Content script
    const csEsiste = (manifest.content_scripts || []).some(cs =>
        (cs.js || []).includes('src/player-probe.js')
    );

    if (!csEsiste) {
        const nuovaVoce = {
            matches: [tuttiUrl],
            js: ['src/player-probe.js'],
            run_at: 'document_start',
            all_frames: true
        };

        manifest.content_scripts = manifest.content_scripts || [];
        const idxBlocker = manifest.content_scripts.findIndex(cs =>
            (cs.js || []).includes('src/popup-blocker.js')
        );

        if (idxBlocker >= 0) {
            manifest.content_scripts.splice(idxBlocker + 1, 0, nuovaVoce);
        } else {
            manifest.content_scripts.push(nuovaVoce);
        }
        csAdded = true;
    }

    // 2. Risorsa accessibile
    if (!manifest.web_accessible_resources) {
        manifest.web_accessible_resources = [{
            resources: ['src/stealth.js'],
            matches: [tuttiUrl]
        }];
        resAdded = true;
    } else {
        const voceTutti = manifest.web_accessible_resources.find(r =>
            (r.matches || []).includes(tuttiUrl)
        );

        if (voceTutti) {
            if (!(voceTutti.resources || []).includes('src/stealth.js')) {
                voceTutti.resources.push('src/stealth.js');
                resAdded = true;
            }
        } else {
            manifest.web_accessible_resources.push({
                resources: ['src/stealth.js'],
                matches: [tuttiUrl]
            });
            resAdded = true;
        }
    }

    // 3. Scrittura idempotente
    fs.writeFileSync(fullPath, JSON.stringify(manifest, null, 2) + '\n');

    const numCs = (manifest.content_scripts || []).length;
    console.log(`--- ${m} ---`);
    console.log(`Content script: ${csAdded ? 'aggiunto' : 'gia presente'}`);
    console.log(`Risorsa: ${resAdded ? 'aggiunta' : 'gia presente'}`);
    console.log(`Voci content_scripts: ${numCs}`);
}
