const { chromium } = require('playwright');
const path = require('path');
const fs = require('fs');

const EXTENSION_PATH = path.resolve(__dirname, '../../app');
const PAGE_URL = process.env.PAGE_URL || 'https://streamingunity.vip/it/titles/9423-batman-caped-crusader';
const OUT_DIR = path.resolve(__dirname, 'out');

const MARCATORI_AD = [
  'ima3', 'imasdk', 'doubleclick', 'googlesyndication', 'vast', 'vmap',
  'adserver', 'adsystem', 'prebid', 'zoneid', 'popunder', 'adtag',
  'advertising', 'adnxs', 'rtmark', 'monetag', 'popads', 'propeller'
];

if (!fs.existsSync(OUT_DIR)) {
  fs.mkdirSync(OUT_DIR, { recursive: true });
}

// FASE 1: estrazione URL embed
async function estraiUrlEmbed() {
  const browser = await chromium.launch();
  const context = await browser.newContext();
  const page = await context.newPage();

  await page.goto(PAGE_URL, { waitUntil: 'networkidle', timeout: 30000 });
  await page.waitForTimeout(8000);

  const frames = page.frames();
  let urlEmbed = null;

  for (const frame of frames) {
    const url = frame.url();
    if (url.includes('embed')) {
      urlEmbed = url;
      break;
    }
  }

  if (!urlEmbed) {
    console.error('ERRORE: frame embed non trovato');
    await context.close();
    await browser.close();
    process.exit(1);
  }

  console.log('Frame embed trovato:', urlEmbed);
  await context.close();
  await browser.close();

  return urlEmbed;
}

// FASE 2: costruzione varianti URL
function costruisciVarianti(urlBase) {
  const url = new URL(urlBase);
  const bypassOn = new URL(urlBase);
  const bypassOff = new URL(urlBase);

  bypassOn.searchParams.set('canBypassAds', '1');
  bypassOff.searchParams.set('canBypassAds', '0');

  return {
    bypassOn: bypassOn.toString(),
    bypassOff: bypassOff.toString()
  };
}

// FASE 3: misura
async function misura(urlEmbed, conEstensione) {
  const args = ['--disable-extensions-except=' + EXTENSION_PATH, '--load-extension=' + EXTENSION_PATH];

  const browser = await chromium.launch({
    args: conEstensione ? args : undefined
  });

  const context = await browser.newContext();
  const page = await context.newPage();

  const richieste = [];
  const schedeAperte = [];

  // Registra richieste
  page.on('request', req => {
    richieste.push({ url: req.url(), resourceType: req.resourceType() });
  });

  // Registra nuove schede
  context.on('page', nuovaPagina => {
    try {
      schedeAperte.push(nuovaPagina.url());
      nuovaPagina.close();
    } catch (_) {}
  });

  try {
    await page.goto(urlEmbed, { waitUntil: 'domcontentloaded', timeout: 30000 });
    await page.waitForTimeout(6000);

    // Avvia riproduzione
    try {
      const playButton = await page.$('button[class*="play"], button[class*="Play"], [aria-label*="play" i], [aria-label*="Play" i]');
      if (playButton) {
        await playButton.click();
      } else {
        const video = await page.$('video');
        if (video) {
          await video.evaluate(v => v.play().catch(() => {}));
        }
      }
    } catch (_) {}

    try {
      await page.click('video', { timeout: 5000 }).catch(() => {});
    } catch (_) {}

    await page.waitForTimeout(20000);

    // Raccogli dati
    let datiVideo = { numeroVideo: 0, videoInfo: [] };
    let googleIma = false;
    let testoDoc = '';

    try {
      datiVideo = await page.evaluate(() => {
        const videos = document.querySelectorAll('video');
        return {
          numeroVideo: videos.length,
          videoInfo: Array.from(videos).map(v => ({
            currentTime: v.currentTime,
            duration: v.duration,
            paused: v.paused
          }))
        };
      });
    } catch (_) {}

    try {
      googleIma = await page.evaluate(() => typeof window.google !== 'undefined' && typeof window.google.ima !== 'undefined');
    } catch (_) {}

    try {
      testoDoc = await page.evaluate(() => document.body ? document.body.innerText.substring(0, 200) : '');
    } catch (_) {}

    // Filtra richieste pubblicitarie
    const richiesteAd = richieste.filter(req =>
      MARCATORI_AD.some(marcatore => req.url.toLowerCase().includes(marcatore))
    );

    return {
      richiesteTotali: richieste.length,
      richiesteAd: richiesteAd.map(r => ({ url: r.url, resourceType: r.resourceType })),
      schedeAperte: schedeAperte.slice(),
      datiVideo,
      googleIma,
      testoDoc
    };

  } finally {
    await context.close();
    await browser.close();
  }
}

// FASE 4: esecuzione comparativa
async function main() {
  const urlEmbed = await estraiUrlEmbed();
  const { bypassOn, bypassOff } = costruisciVarianti(urlEmbed);

  const combinazioni = [
    { nome: 'bypass_attivo_senza_est', url: bypassOn, estensione: false },
    { nome: 'bypass_disattivo_senza_est', url: bypassOff, estensione: false },
    { nome: 'bypass_attivo_con_est', url: bypassOn, estensione: true },
    { nome: 'bypass_disattivo_con_est', url: bypassOff, estensione: true }
  ];

  const risultati = {};

  for (const combo of combinazioni) {
    console.log(`\nMisurazione: ${combo.nome}`);
    const ris = await misura(combo.url, combo.estensione);
    risultati[combo.nome] = ris;
    await new Promise(r => setTimeout(r, 2000));
  }

  // Tabella comparativa
  console.log('\n=== TABELLA COMPARATIVA ===');
  console.log('------------------------------------------------------------');
  console.log('| Configurazione              | Rich.Ad | Sched.Ap | Video | IMA |');
  console.log('------------------------------------------------------------');

  for (const combo of combinazioni) {
    const r = risultati[combo.nome];
    const videoIniziato = r.datiVideo.videoInfo.some(v => v.currentTime > 0);
    console.log(
      `| ${combo.nome.padEnd(27)} | ${String(r.richiesteAd.length).padStart(7)} | ${String(r.schedeAperte.length).padStart(8)} | ${videoIniziato ? 'SI' : 'NO '} | ${r.googleIma ? 'SI ' : 'NO '} |`
    );
  }

  console.log('------------------------------------------------------------');

  // Salvataggio JSON
  const outPath = path.join(OUT_DIR, 'player-bypass-ads.json');
  fs.writeFileSync(outPath, JSON.stringify({ urlEmbed, combinazioni: Object.keys(risultati), risultati }, null, 2));
  console.log('\nRisultati salvati in:', outPath);

  // CONCLUSIONE
  const adBypassOn = risultati['bypass_attivo_senza_est'].richiesteAd.length;
  const adBypassOff = risultati['bypass_disattivo_senza_est'].richiesteAd.length;
  const adConEst = risultati['bypass_disattivo_con_est'].richiesteAd.length;

  console.log('\n=== CONCLUSIONE ===');
  console.log(`Disattivare bypass: richieste pubblicitarie passate da ${adBypassOn} a ${adBypassOff} (${adBypassOff > adBypassOn ? 'INCREMENTO rilevato' : 'nessun incremento'}).`);
  console.log(`Estensione in fase disattivata: richieste passate da ${adBypassOff} a ${adConEst} (${adConEst < adBypassOff ? 'RIDUZIONE rilevata' : 'nessuna riduzione'}).`);
}

main().catch(err => {
  console.error('Errore irreversibile:', err);
  process.exit(1);
});
