const { chromium } = require('playwright');
const path = require('path');
const fs = require('fs');

const EXTENSION_PATH = path.resolve(__dirname, '../../app');
const TARGET_URL = process.env.TARGET_URL || 'https://streamingcommunityz.recipes/it/titles/9423-batman-caped-crusader';
const CLICKS = parseInt(process.env.CLICKS, 10) || 6;
const OUT_DIR = path.resolve(__dirname, 'out');

async function misura(conEstensione) {
  let context;
  try {
    const args = ['--mute-audio'];
    if (conEstensione) {
      args.push('--disable-extensions-except=' + EXTENSION_PATH);
      args.push('--load-extension=' + EXTENSION_PATH);
    }

    context = await chromium.launchPersistentContext('', {
      headless: false,
      viewport: { width: 1366, height: 900 },
      args,
      ignoreDefaultArgs: conEstensione ? ['--disable-extensions'] : undefined
    });

    const page = context.pages()[0];
    await page.goto(TARGET_URL, { waitUntil: 'domcontentloaded', timeout: 45000 });
    await page.waitForTimeout(9000);

    const hostPagina = new URL(TARGET_URL).hostname;

    const iframes = await page.$$('iframe');
    const hostPropri = new Set([hostPagina]);

    for (const iframe of iframes) {
      const src = await iframe.getAttribute('src');
      if (src && src.includes('embed')) {
        try {
          const urlIframe = new URL(src, TARGET_URL);
          hostPropri.add(urlIframe.hostname);
        } catch {
          hostPropri.add(new URL(TARGET_URL).hostname);
        }
      }
    }

    const terzeParti = [];
    const proprie = [];

    context.on('page', async (nuovaPagina) => {
      // L'indirizzo di partenza va letto SUBITO: e' quello che rivela il
      // circuito pubblicitario. Dopo il redirect resta solo la destinazione.
      const urlIniziale = nuovaPagina.url();
      await nuovaPagina.waitForTimeout(1200);
      const urlFinale = nuovaPagina.url();
      nuovaPagina.close();

      const urlCheck = urlFinale || urlIniziale;
      const isEstensione = urlCheck.startsWith('chrome-extension');
      let isPropria = false;

      if (!isEstensione && urlCheck.startsWith('http')) {
        try {
          const hostScheda = new URL(urlCheck).hostname;
          for (const hp of hostPropri) {
            if (hostScheda.endsWith(hp)) {
              isPropria = true;
              break;
            }
          }
        } catch {
          isPropria = false;
        }
      } else if (isEstensione) {
        isPropria = true;
      }

      const voce = { iniziale: urlIniziale.slice(0, 160), finale: urlFinale.slice(0, 160) };

      if (isPropria) {
        proprie.push(voce);
      } else {
        terzeParti.push(voce);
      }
    });

    const iframeEmbed = await page.$('iframe[src*="embed"]');
    let x, y, w, h;

    if (iframeEmbed) {
      const box = await iframeEmbed.boundingBox();
      x = box.x;
      y = box.y;
      w = box.width;
      h = box.height;
    } else {
      x = 0;
      y = 0;
      w = 1366;
      h = 900;
    }

    const centroX = x + w / 2;
    const centroY = y + h / 2;
    const quartoX = x + w / 4;
    const quartoY = y + h / 4;

    for (let i = 0; i < CLICKS; i++) {
      const cx = i % 2 === 0 ? centroX : quartoX;
      const cy = i % 2 === 0 ? centroY : quartoY;
      try {
        await page.mouse.click(cx, cy);
      } catch {
        // click ignorato
      }
      await page.waitForTimeout(2500);
    }

    await page.waitForTimeout(3000);

    const dominiTerzi = [...new Set(terzeParti.map(t => {
      try { return new URL(t.finale || t.iniziale).hostname; } catch { return 'sconosciuto'; }
    }))];

    return {
      terzeParti: terzeParti.length,
      urlTerzeParti: terzeParti.map(t => t.finale || t.iniziale),
      dominiTerzi,
      proprie: proprie.length,
      hostPropri: [...hostPropri]
    };
  } catch (err) {
    return {
      terzeParti: 0,
      urlTerzeParti: [],
      dominiTerzi: [],
      proprie: 0,
      hostPropri: [],
      errore: err.message
    };
  } finally {
    if (context) {
      await context.close();
    }
  }
}

async function main() {
  try {
    if (!fs.existsSync(OUT_DIR)) {
      fs.mkdirSync(OUT_DIR, { recursive: true });
    }

    const senza = await misura(false);
    await new Promise(r => setTimeout(r, 3000));
    const con = await misura(true);

    const risultato = {
      senzaEstensione: {
        terzeParti: senza.terzeParti,
        url: senza.urlTerzeParti,
        domini: senza.dominiTerzi,
        proprie: senza.proprie,
        host: senza.hostPropri,
        errore: senza.errore
      },
      conEstensione: {
        terzeParti: con.terzeParti,
        url: con.urlTerzeParti,
        domini: con.dominiTerzi,
        proprie: con.proprie,
        host: con.hostPropri,
        errore: con.errore
      }
    };

    fs.writeFileSync(
      path.join(OUT_DIR, 'popunder-player.json'),
      JSON.stringify(risultato, null, 2)
    );

    console.log('\n=== CONFRONTO POPUNDER ===');
    console.log(`Senza estensione: ${senza.terzeParti} scheda/e di terze parti`);
    if (senza.dominiTerzi.length) {
      console.log('  Domini:', senza.dominiTerzi.join(', '));
    }
    console.log(`Con estensione:   ${con.terzeParti} scheda/e di terze parti`);
    if (con.dominiTerzi.length) {
      console.log('  Domini:', con.dominiTerzi.join(', '));
    }

    const diff = senza.terzeParti - con.terzeParti;
    if (diff > 0) {
      console.log(`\nCONCLUSIONE: l'estensione riduce le schede di terze parti di ${diff} (${Math.round((diff / Math.max(senza.terzeParti, 1)) * 100)}% in meno)`);
    } else if (diff < 0) {
      console.log(`\nCONCLUSIONE: l'estensione aumenta le schede di terze parti di ${Math.abs(diff)}`);
    } else {
      console.log(`\nCONCLUSIONE: nessuna differenza nel numero di schede di terze parti`);
    }
  } catch (err) {
    console.error('Errore main:', err.message);
    process.exit(1);
  }
}

main();
