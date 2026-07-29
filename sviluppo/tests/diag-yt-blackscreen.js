const { chromium } = require('playwright');
const path = require('path');
const fs = require('fs');

const EXT_PATH = path.resolve(__dirname, '../../app');
const WITH_EXT = process.env.NOEXT !== '1';
// FREE=1 → estensione caricata ma gate Pro NON forzato (passthrough: niente strip).
// Serve a confrontare "strip attivo" vs "ads regolari" sullo stesso ambiente.
const FORCE_PRO = process.env.FREE !== '1';
const VIDEO_URL = process.env.VIDEO_URL || 'https://www.youtube.com/watch?v=vP9NStX3xf4';

async function main() {
  // Argomenti browser
  const browserArgs = [
    '--mute-audio',
    '--no-first-run',
    '--disable-default-apps',
    // SENZA questo il video si auto-mette in pausa dopo pochi decimi (policy
    // autoplay di Chromium senza gesto utente) e la misura del ritardo di
    // partenza diventa insensata: sembra "mai partito" anche quando va tutto bene.
    '--autoplay-policy=no-user-gesture-required'
  ];
  if (WITH_EXT) {
    browserArgs.push('--disable-extensions-except=' + EXT_PATH);
    browserArgs.push('--load-extension=' + EXT_PATH);
  } else {
    browserArgs.push('--disable-extensions');
  }

  const context = await chromium.launchPersistentContext('', {
    headless: false,
    args: browserArgs,
    ignoreDefaultArgs: ['--disable-extensions'],
    viewport: { width: 1366, height: 900 }
  });

  // PRO_STORAGE=1 → scrive una licenza Pro nello storage dell'estensione via
  // service worker. Serve per riprodurre il bug davvero: le regole di RETE
  // 170-176 sono Pro-only e le attiva il background, non stealth.js. Forzare
  // solo data-adoff-stealth inganna il MAIN world ma lascia le regole spente.
  if (WITH_EXT && process.env.PRO_STORAGE === '1') {
    let sw = context.serviceWorkers()[0];
    if (!sw) sw = await context.waitForEvent('serviceworker', { timeout: 15000 }).catch(() => null);
    if (sw) {
      await sw.evaluate(() => new Promise((res) => {
        chrome.storage.local.set({ adoffLicense: { type: 'pro', valid: true, plan: 'pro' }, adoffEnabled: true }, res);
      })).catch(() => {});
      console.log('[setup] licenza Pro scritta nello storage (regole di rete attive)');
      await new Promise((r) => setTimeout(r, 2500));
    } else {
      console.log('[setup] ATTENZIONE: service worker non raggiunto, regole di rete NON attive');
    }
  }

  const page = context.pages()[0];

  // Init script per iniettare attributo stealth con estensione
  if (WITH_EXT && FORCE_PRO) {
    await page.addInitScript(() => {
      const attr = 'data-adoff-stealth';
      const val = 'ao_abcdef12';
      const apply = () => {
        if (document.documentElement.getAttribute(attr) !== val) {
          document.documentElement.setAttribute(attr, val);
        }
      };
      const loop = () => {
        apply();
        requestAnimationFrame(loop);
      };
      loop();
    });
  }

  // Strutture per raccogliere dati
  const apiReqs = []; // { ep, hasCPC, hasNoAd, bodyType, isBinary }
  const playerResp = { adPlacements: false, playerAds: false, adSlots: false, xdPlacements: false, len: 0 };
  let gvsCount = 0;
  const gvsFirst = { ump: false, sabr: false, dur: null };
  // Conta gli interventi del watchdog anti-stallo (Layer D).
  // In riproduzione sana devono essere ZERO: ogni intervento e' un seek forzato.
  await page.addInitScript(() => {
    window.__adoffStalls = [];
    window.addEventListener('adoff-stall-recovered', (e) => window.__adoffStalls.push(e.detail));
  });

  const pageErrors = [];

  // Listener richieste
  page.on('request', req => {
    const url = req.url();
    const match = url.match(/\/youtubei\/v1\/(player|next)/);
    if (match) {
      const entry = { ep: match[0], hasCPC: false, hasNoAd: false, bodyType: 'none', isBinary: false };
      try {
        const pd = req.postData();
        if (pd) {
          entry.bodyType = 'string';
          entry.hasCPC = pd.includes('"contentPlaybackContext"');
          entry.hasNoAd = pd.includes('"isInlinePlaybackNoAd"');
        } else {
          const buf = req.postDataBuffer();
          if (buf && buf.length > 0) {
            entry.isBinary = true;
            entry.bodyType = 'binary';
          }
        }
      } catch (e) {}
      apiReqs.push(entry);
    }
    // googlevideo
    if (url.includes('googlevideo.com/videoplayback')) {
      gvsCount++;
      if (gvsCount === 1) {
        try {
          const u = new URL(url);
          gvsFirst.ump = u.searchParams.get('ump') === '1';
          gvsFirst.sabr = u.searchParams.get('sabr') === '1';
          gvsFirst.dur = u.searchParams.get('dur');
        } catch (e) {}
      }
    }
  });

  // Listener risposte /youtubei/v1/player
  page.on('response', async resp => {
    if (resp.url().includes('/youtubei/v1/player')) {
      try {
        const buf = await resp.buffer();
        const text = buf.toString('utf8');
        playerResp.adPlacements = text.includes('"adPlacements"');
        playerResp.playerAds = text.includes('"playerAds"');
        playerResp.adSlots = text.includes('"adSlots"');
        playerResp.xdPlacements = text.includes('"xdPlacements"');
        playerResp.len = buf.length;
      } catch (e) {}
    }
  });

  page.on('pageerror', err => pageErrors.push(err.message));

  // Naviga su youtube.com e accetta cookie
  await page.goto('https://www.youtube.com', { waitUntil: 'domcontentloaded' });
  await page.waitForTimeout(2500);
  await page.mouse.click(813, 808);
  await page.waitForTimeout(3000);

  // Inizio misurazione
  const T0 = Date.now();
  await page.goto(VIDEO_URL, { waitUntil: 'domcontentloaded' });

  const maxTime = 45000;
  const interval = 250;
  let elapsed = 0;
  let timeToPlay = null;
  let blackScreenMs = null;
  let readyStateAt2 = null;
  const samples = [];
  const changedSamples = [];

  // Funzione per ottenere snapshot del video
  const getSnapshot = async () => {
    return await page.evaluate(() => {
      const v = document.querySelector('#movie_player video') || document.querySelector('video');
      if (!v) return null;
      return {
        ct: v.currentTime,
        paused: v.paused,
        rs: v.readyState,
        buffered: v.buffered.length ? v.buffered.end(0) : 0,
        ad: v.classList.contains('ad-showing') || v.classList.contains('ad-interrupting'),
        rate: v.playbackRate
      };
    });
  };

  // Tentativo di click manuale dopo 5 secondi se il video è fermo
  setTimeout(async () => {
    if (!timeToPlay) {
      const snap = await getSnapshot();
      if (snap && snap.paused && snap.ct === 0) {
        try {
          await page.click('#movie_player', { timeout: 2000 });
          console.log('>>> Play forzato manualmente (autoplay policy)');
        } catch (e) {}
      }
    }
  }, 5000);

  // Campionamento
  while (elapsed <= maxTime) {
    const t = Date.now() - T0;
    const snap = await getSnapshot();
    if (snap) {
      if (readyStateAt2 === null && snap.rs >= 2) readyStateAt2 = t;
      if (timeToPlay === null && snap.ct > 1.0) {
        timeToPlay = t;
        blackScreenMs = readyStateAt2 !== null ? timeToPlay - readyStateAt2 : null;
      }
      const sample = { t, ct: Math.round(snap.ct * 10) / 10, paused: snap.paused, rs: snap.rs, ad: snap.ad };
      samples.push(sample);
      const prev = changedSamples.length > 0 ? changedSamples[changedSamples.length - 1] : null;
      if (!prev || prev.paused !== sample.paused || prev.rs !== sample.rs || prev.ad !== sample.ad || prev.ct !== sample.ct) {
        if (changedSamples.length < 25) changedSamples.push(sample);
      }
      if (timeToPlay !== null) break;
    } else {
      samples.push({ t, ct: 0, paused: true, rs: 0, ad: false });
    }
    await new Promise(r => setTimeout(r, interval));
    elapsed = Date.now() - T0;
  }

  // Output leggibile
  console.log('MODE:', !WITH_EXT ? 'BASELINE senza estensione' : (FORCE_PRO ? 'CON estensione (Pro: strip attivo)' : 'CON estensione (Free: passthrough, ads regolari)'));
  console.log('TIME TO FIRST PLAY:', timeToPlay !== null ? timeToPlay + 'ms' : 'MAI PARTITO in 45s');
  console.log('blackScreenMs:', blackScreenMs !== null ? blackScreenMs + 'ms' : 'N/A');
  console.log('--- Primi 25 campioni cambiati ---');
  console.table(changedSamples);

  // Aggrega richieste API
  const agg = {};
  for (const req of apiReqs) {
    if (!agg[req.ep]) agg[req.ep] = { ep: req.ep, n: 0, hasCPC: 0, hasNoAd: 0, isBinary: 0 };
    const a = agg[req.ep];
    a.n++;
    if (req.hasCPC) a.hasCPC++;
    if (req.hasNoAd) a.hasNoAd++;
    if (req.isBinary) a.isBinary++;
  }
  console.log('--- Request bodies aggregati per endpoint ---');
  console.table(Object.values(agg));
  console.log('--- Response /youtubei/v1/player ---');
  console.table([playerResp]);
  console.log('--- googlevideo ---');
  console.log('Numero richieste:', gvsCount);
  console.log('Prima richiesta ump=1:', gvsFirst.ump, '| sabr=1:', gvsFirst.sabr, '| dur:', gvsFirst.dur);
  const stalls = await page.evaluate(() => window.__adoffStalls || []).catch(() => []);
  console.log('--- Watchdog anti-stallo (Layer D) ---');
  console.log('Interventi:', stalls.length, stalls.length ? JSON.stringify(stalls) : '(nessuno: nessun falso positivo)');

  console.log('--- Errori JS ---');
  if (pageErrors.length === 0) console.log('Nessun errore');
  else pageErrors.forEach(e => console.log('PAGEERROR:', e));

  // Scrittura JSON
  const outDir = path.join(__dirname, '../tests/out');
  fs.mkdirSync(outDir, { recursive: true });
  const jsonOut = {
    withExt: WITH_EXT,
    timeToPlay,
    blackScreenMs,
    samples,
    apiReqs: Object.values(agg),
    playerResp,
    gvs: { count: gvsCount, first: gvsFirst },
    pageErrors
  };
  const jsonFile = path.join(outDir, `yt-blackscreen-${!WITH_EXT ? 'noext' : (FORCE_PRO ? 'ext-pro' : 'ext-free')}.json`);
  fs.writeFileSync(jsonFile, JSON.stringify(jsonOut, null, 2));
  console.log('JSON scritto in', jsonFile);

  await context.close();
}

main().catch(err => {
  console.error('ERR:', err);
  process.exit(1);
});
