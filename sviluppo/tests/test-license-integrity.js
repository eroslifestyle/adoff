const fs = require('fs');
const path = require('path');

/*
 * Test per la verifica dell'integrità della licenza.
 *
 * T1 – le tre implementazioni di computeIntegrity sono identiche nel comportamento
 *       Controlla che tutte e tre le versioni (background.js, license-client.js,
 *       content.js) producano lo stesso hash per un insieme di oggetti campione.
 *
 * T2 – l'hash è stabile attraverso un round‑trip JSON
 *       Simula la serializzazione/deserializzazione che avviene in storage;
 *       verifica che l'hash non cambi dopo JSON.stringify + JSON.parse.
 *
 * T3 – ogni scrittura della licenza aggiorna anche l'hash
 *       Cerca tutte le occorrenze di "adoffLicense:" nei file background.js e
 *       license‑client.js; ogni scrittura deve essere accompagnata dalla
 *       modifica/correzione del relativo hash di integrità.
 *
 * T4 – un campo aggiunto invalida l'hash: conferma che il rischio è reale
 *       Dimostra che se si aggiunge un campo (lastValidated) l'hash cambia,
 *       garantendo così che la mancata ricomputazione provochi un riconoscimento
 *       di manomissione.
 */

const BG = path.join(__dirname, '../../app/src/background.js');
const LC = path.join(__dirname, '../../app/src/license-client.js');
const CT = path.join(__dirname, '../../app/src/content.js');

function leggiFile(p) {
    return fs.readFileSync(p, 'utf8');
}

// Estrae il testo della funzione computeIntegrity da un file.
// Cerca la dichiarazione "function computeIntegrity(licData) {" e,
// utilizzando un'espressione regolare, preleva tutto fino alla prima riga
// che contiene solo spazi/tab e una "}" di chiusura.
function estraiComputeIntegrity(contenuto) {
    const marcatore = 'function computeIntegrity(licData) {';
    const inizio = contenuto.indexOf(marcatore);
    if (inizio === -1) return null;
    // Conteggio delle graffe: una regex non-greedy si fermerebbe alla chiusura
    // del ciclo for interno, troncando la funzione e producendo codice invalido.
    let profondita = 0;
    for (let i = inizio; i < contenuto.length; i++) {
        const c = contenuto[i];
        if (c === '{') profondita++;
        else if (c === '}') {
            profondita--;
            if (profondita === 0) return contenuto.slice(inizio, i + 1);
        }
    }
    return null;
}

// Crea una funzione evaluate che, dato il testo della funzione, restituisce
// una funzione (licData) => hash. In caso di errore di sintassi restituisce null.
function creaFn(testo) {
    if (!testo) return null;
    try {
        // La funzione creata ha un parametro licData e, dopo aver definito
        // computeIntegrity, ne restituisce il risultato.
        return new Function('licData', testo + '\nreturn computeIntegrity(licData);');
    } catch (_) {
        return null;
    }
}

// -------------------------------------------------------------------
// Campioni di oggetti licenza usati nei test T1, T2 e T4.
const campioni = [
    { valid: true, plan: 'lifetime', rawKey: 'ADOFF-X' },
    {},
    { a: 1, b: 'due', c: null },
    { valid: true, devices: 2, maxDevices: 10, lastValidated: 123 }
];

// -------------------------------------------------------------------
// T1
function runT1(bg, lc, ct) {
    const fnBg = estraiComputeIntegrity(bg);
    const fnLC = estraiComputeIntegrity(lc);
    const fnCT = estraiComputeIntegrity(ct);

    if (!fnBg) return { ok: false, msg: 'File background.js non contiene computeIntegrity' };
    if (!fnLC) return { ok: false, msg: 'File license-client.js non contiene computeIntegrity' };
    if (!fnCT) return { ok: false, msg: 'File content.js non contiene computeIntegrity' };

    const fBg = creaFn(fnBg);
    const fLC = creaFn(fnLC);
    const fCT = creaFn(fnCT);

    if (!fBg || !fLC || !fCT) return { ok: false, msg: 'Errore di sintassi in una delle implementazioni' };

    for (const obj of campioni) {
        const hBg = fBg(obj);
        const hLC = fLC(obj);
        const hCT = fCT(obj);
        if (hBg !== hLC || hLC !== hCT) {
            return {
                ok: false,
                msg: `Discrepanza per l'oggetto: ${JSON.stringify(obj)}\n` +
                     `  background.js: ${hBg}\n  license-client.js: ${hLC}\n  content.js: ${hCT}`
            };
        }
    }
    return { ok: true, msg: '' };
}

// -------------------------------------------------------------------
// T2
function runT2(lc) {
    const fnLC = estraiComputeIntegrity(lc);
    if (!fnLC) return { ok: false, msg: 'File license-client.js non contiene computeIntegrity' };
    const fLC = creaFn(fnLC);
    if (!fLC) return { ok: false, msg: 'Errore di sintassi in license-client.js' };

    for (const obj of campioni) {
        const h1 = fLC(obj);
        const h2 = fLC(JSON.parse(JSON.stringify(obj)));
        if (h1 !== h2) {
            return {
                ok: false,
                msg: `Hash non stabile per l'oggetto: ${JSON.stringify(obj)}\n` +
                     `  Prima: ${h1}\n  Dopo round‑trip: ${h2}`
            };
        }
    }
    return { ok: true, msg: '' };
}

// -------------------------------------------------------------------
// T3
// Cerca ogni "adoffLicense:" e verifica che nella finestra di ±200/500 caratteri
// sia presente almeno una menzione dell'hash di integrità.
function trovaViolazioni(contenuto, nomeFile) {
    const violazioni = [];
    const cerca = 'adoffLicense:';
    let idx = 0;
    while ((idx = contenuto.indexOf(cerca, idx)) !== -1) {
        const inizioFinestra = Math.max(0, idx - 200);
        const fineFinestra = Math.min(contenuto.length, idx + 500);
        const finestra = contenuto.substring(inizioFinestra, fineFinestra);
        const ok = finestra.includes('adoffIntegrity') ||
                   finestra.includes('saveIntegrity') ||
                   finestra.includes('remove("adoffIntegrity")');
        if (!ok) {
            const primaParte = contenuto.substring(0, idx);
            const numRiga = (primaParte.match(/\n/g) || []).length + 1;
            const frammento = contenuto.substring(idx, idx + 80);
            violazioni.push({ file: nomeFile, riga: numRiga, frammento });
        }
        idx += cerca.length;
    }
    return violazioni;
}

function runT3(bg, lc) {
    const violBg = trovaViolazioni(bg, 'background.js');
    const violLC = trovaViolazioni(lc, 'license-client.js');
    const tutte = [...violBg, ...violLC];
    if (tutte.length === 0) return { ok: true, msg: '' };
    const dettagli = tutte.map(v =>
        `  ${v.file}, riga ${v.riga}: ${v.frammento}`).join('\n');
    return { ok: false, msg: `Violazioni trovate:\n${dettagli}` };
}

// -------------------------------------------------------------------
// T4
function runT4(lc) {
    const fnLC = estraiComputeIntegrity(lc);
    if (!fnLC) return { ok: false, msg: 'File license-client.js non contiene computeIntegrity' };
    const fLC = creaFn(fnLC);
    if (!fLC) return { ok: false, msg: 'Errore di sintassi in license-client.js' };

    const h1 = fLC({ valid: true, plan: 'pro' });
    const h2 = fLC({ valid: true, plan: 'pro', lastValidated: 999 });
    if (h1 === h2) {
        return {
            ok: false,
            msg: `I due hash sono uguali nonostante l'aggiunta di un campo!\n` +
                 `  Senza lastValidated: ${h1}\n  Con lastValidated: ${h2}`
        };
    }
    return { ok: true, msg: '' };
}

// -------------------------------------------------------------------
// Esecuzione dei test
const bg = leggiFile(BG);
const lc = leggiFile(LC);
const ct = leggiFile(CT);

const risultati = [];

function esito(nome, esito) {
    if (esito.ok) {
        risultati.push(`PASS ${nome}`);
    } else {
        risultati.push(`FAIL ${nome}`);
        if (esito.msg) risultati.push(esito.msg);
    }
}

esito('T1: le tre implementazioni di computeIntegrity sono identiche nel comportamento', runT1(bg, lc, ct));
esito('T2: l hash e stabile attraverso un round-trip JSON', runT2(lc));
esito('T3: ogni scrittura della licenza aggiorna anche l hash', runT3(bg, lc));
esito('T4: un campo aggiunto invalida l hash: conferma che il rischio e reale', runT4(lc));

const passati = risultati.filter(r => r.startsWith('PASS')).length;
risultati.push(`RISULTATO: ${passati}/4 passati`);

risultati.forEach(r => console.log(r));

process.exit(passati < 4 ? 1 : 0);
