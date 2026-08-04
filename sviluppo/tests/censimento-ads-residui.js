const { chromium } = require('playwright');
const path = require('path');
const fs = require('fs');

const EXTENSION_PATH = path.resolve(__dirname, '../../app');
const TARGET_URL = process.env.TARGET_URL || 'https://streaming-community.red/titles/27865-guarda-batman-caped-crusader-streaming/watching.html';
const OUT_DIR = path.resolve(__dirname, 'out');

const MISURE_STANDARD = [
  [300, 250], [728, 90], [300, 600], [160, 600], [320, 50],
  [970, 250], [336, 280], [468, 60], [250, 250], [120, 600]
];

function prossimaAllaCoppia(w, h, soglia = 10) {
  return MISURE_STANDARD.some(([sw, sh]) =>
    Math.abs(w - sw) <= soglia && Math.abs(h - sh) <= soglia
  );
}

function attesaCasuale(ms) {
  return new Promise(r => setTimeout(r, ms));
}

async function censisci(conEstensione) {
  const argsBase = ['--no-sandbox', '--disable-setuid-sandbox'];
  const argsEst = conEstensione
    ? ['--disable-extensions-except=' + EXTENSION_PATH, '--load-extension=' + EXTENSION_PATH]
    : [];
  const ignoreEst = conEstensione ? ['--disable-extensions'] : [];

  const contesto = await chromium.launchPersistentContext('', {
    headless: false,
    viewport: { width: 1366, height: 900 },
    args: [...argsBase, ...argsEst],
    ignoreDefaultArgs: [...ignoreEst],
    muteAudio: true
  });

  try {
    const ctx = contesto;
    await attesaCasuale(2500);

    const page = ctx.pages()[0];
    await page.goto(TARGET_URL, { waitUntil: 'domcontentloaded', timeout: 45000 });
    await attesaCasuale(6000);

    const vp = page.viewportSize() || { width: 1366, height: 900 };
    await page.mouse.click(vp.width / 2, vp.height / 2);
    await attesaCasuale(4000);
    const inventario = [];

    for (const frame of page.frames()) {
      try {
        const info = await frame.evaluate(() => {
          const vw = window.innerWidth;
          const vh = window.innerHeight;
          const areaViewport = vw * vh;
          const patternAd = /^(.*(ad|ads|banner|promo|sponsor).*)$/i;

          const dimensioniPubblicitarie = [
            [300, 250], [728, 90], [300, 600], [160, 600], [320, 50],
            [970, 250], [336, 280], [468, 60], [250, 250], [120, 600]
          ];

          function prossimaAllaCoppia(w, h) {
            return dimensioniPubblicitarie.some(([dw, dh]) =>
              Math.abs(w - dw) <= 10 && Math.abs(h - dh) <= 10
            );
          }

          const iframe = [];
          document.querySelectorAll('iframe').forEach(el => {
            const rect = el.getBoundingClientRect();
            if (rect.width > 0 && rect.height > 0) {
              iframe.push({
                src: (el.src || '').slice(0, 160),
                w: Math.round(rect.width),
                h: Math.round(rect.height),
                pubblicitaria: prossimaAllaCoppia(rect.width, rect.height)
              });
            }
          });

          const overlay = [];
          document.querySelectorAll('*').forEach(el => {
            const st = window.getComputedStyle(el);
            const rect = el.getBoundingClientRect();
            const pos = st.position;
            const zIdx = parseInt(st.zIndex) || 0;
            const area = rect.width * rect.height;
            const visibile = st.display !== 'none' && st.visibility !== 'hidden' && parseFloat(st.opacity) > 0;

            if ((pos === 'fixed' || pos === 'absolute') && zIdx > 1000 && area > areaViewport * 0.2 && visibile) {
              overlay.push({
                tag: el.tagName,
                id: el.id || '',
                cls: (el.className || '').toString().slice(0, 80),
                w: Math.round(rect.width),
                h: Math.round(rect.height),
                zIndex: zIdx
              });
            }
          });

          let nascostiAd = 0;
          document.querySelectorAll('*').forEach(el => {
            const st = window.getComputedStyle(el);
            if (st.display === 'none') {
              const idCls = (el.id || '') + ' ' + (el.className || '');
              if (patternAd.test(idCls)) {
                nascostiAd++;
              }
            }
          });

          const linkMascherati = [];
          document.querySelectorAll('a[target="_blank"]').forEach(a => {
            const rect = a.getBoundingClientRect();
            const st = window.getComputedStyle(a);
            const area = rect.width * rect.height;
            const invisibile = area === 0 || parseFloat(st.opacity) === 0;
            const copreTroppo = area > areaViewport * 0.3;

            if (invisibile || copreTroppo) {
              linkMascherati.push({
                href: (a.href || '').slice(0, 120),
                w: Math.round(rect.width),
                h: Math.round(rect.height),
                invisibile,
                copreTroppo
              });
            }
          });

          return { iframe, overlay, nascostiAd, linkMascherati };
        });
        info.url = frame.url();
        inventario.push(info);
      } catch (_) {
        inventario.push({
          iframe: [],
          overlay: [],
          nascostiAd: 0,
          linkMascherati: [],
          errore: _.message
        });
      }
    }

    const nomeFile = conEstensione ? 'censimento-con-estensione.png' : 'censimento-senza-estensione.png';
    const pagina = contesto.pages()[0];
    await pagina.screenshot({ path: path.join(OUT_DIR, nomeFile), fullPage: true });

    return inventario;

  } finally {
    await contesto.close();
  }
}

function somma(inventario, chiave) {
  return inventario.reduce((acc, f) => acc + (f[chiave] ? f[chiave].length : 0), 0);
}

function overlayIn(inventario) {
  return new Set(inventario.flatMap(f => f.overlay.map(o => o.tag + '|' + o.id + '|' + o.w + 'x' + o.h)));
}

function iframePubbIn(inventario) {
  return new Set(inventario.flatMap(f => f.iframe.filter(i => i.pubblicitaria).map(i => i.w + 'x' + i.h + '|' + i.src)));
}

async function main() {
  fs.mkdirSync(OUT_DIR, { recursive: true });

  const senza = await censisci(false);
  const con = await censisci(true);

  const riepilogo = { senza, con };
  fs.writeFileSync(path.join(OUT_DIR, 'censimento.json'), JSON.stringify(riepilogo, null, 2));

  const frameSenza = senza.length;
  const frameCon = con.length;
  const totIframeSenza = somma(senza, 'iframe');
  const totIframeCon = somma(con, 'iframe');
  const pubbSenza = somma(senza, 'iframe');
  const pubbCon = somma(con, 'iframe');
  // Solo quelli di misura pubblicitaria: sommare tutti gli iframe faceva
  // contare come pubblicitario anche il player a piena pagina.
  const iframePubSenza = iframePubbIn(senza).size;
  const iframePubCon = iframePubbIn(con).size;
  const overlaySenza = somma(senza, 'overlay');
  const overlayCon = somma(con, 'overlay');
  const linkMasSenza = somma(senza, 'linkMascherati');
  const linkMasCon = somma(con, 'linkMascherati');

  const setOverlaySenza = overlayIn(senza);
  const setOverlayCon = overlayIn(con);
  const residuiOverlay = [...setOverlaySenza].filter(x => !setOverlayCon.has(x));
  const presentiEntrambiOverlay = [...setOverlaySenza].filter(x => setOverlayCon.has(x));

  const setIframeSenza = iframePubbIn(senza);
  const setIframeCon = iframePubbIn(con);
  const residuiIframe = [...setIframeSenza].filter(x => !setIframeCon.has(x));
  const presentiEntrambiIframe = [...setIframeSenza].filter(x => setIframeCon.has(x));

  console.log('\n=== RIEPILOGO CENSIMENTO ===\n');
  console.log('SENZA estensione:');
  console.log('  Frame analizzati:', frameSenza);
  console.log('  Iframe totali:', totIframeSenza);
  console.log('  Iframe dimensione pubblicitaria:', iframePubSenza);
  console.log('  Overlay sospetti:', overlaySenza);
  console.log('  Link mascherati:', linkMasSenza);
  console.log('\nCON estensione:');
  console.log('  Frame analizzati:', frameCon);
  console.log('  Iframe totali:', totIframeCon);
  console.log('  Iframe dimensione pubblicitaria:', iframePubCon);
  console.log('  Overlay sospetti:', overlayCon);
  console.log('  Link mascherati:', linkMasCon);
  console.log('\n=== DIFFERENZE ===\n');
  console.log('Residui (presenti senza, assenti con):');
  console.log('  Iframe pubblicitari:', residuiIframe.length);
  console.log('  Overlay sospetti:', residuiOverlay.length);
  console.log('\nPresenti in ENTRAMBE (lavorare su questi):');
  console.log('  Iframe pubblicitari:', presentiEntrambiIframe.length, presentiEntrambiIframe.slice(0, 5));
  console.log('  Overlay sospetti:', presentiEntrambiOverlay.length, presentiEntrambiOverlay.slice(0, 5));
}

main().catch(console.error);
