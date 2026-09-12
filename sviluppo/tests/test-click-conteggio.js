const path = require('path');
const { chromium } = require('playwright');

const EXTENSION_PATH = path.resolve(__dirname, '../../app');
const URL = process.env.URL || 'https://streaming-community.red/titles/27865-guarda-batman-caped-crusader-streaming/watching.html';

async function sleep(ms) {
  return new Promise(resolve => setTimeout(resolve, ms));
}

async function getVideoState(frame) {
  try {
    return await frame.evaluate(() => {
      const video = document.querySelector('video');
      if (!video) return null;
      return {
        trovato: true,
        paused: video.paused,
        t: video.currentTime
      };
    });
  } catch (e) {
    return null;
  }
}

async function checkVideoPlaying(page) {
  const frames = page.frames();
  for (const frame of frames) {
    const state = await getVideoState(frame);
    if (state && state.trovato) {
      const isPlaying = !state.paused || state.t > 0.5;
      if (isPlaying) {
        return { isPlaying: true, frameUrl: frame.url().substring(0, 50), state };
      }
    }
  }
  return { isPlaying: false, frameUrl: null, state: null };
}

async function prova(conEstensione) {
  let context = null;
  const tabs = [];

  try {
    const extArgs = conEstensione
      ? ['--disable-extensions-except=' + EXTENSION_PATH, '--load-extension=' + EXTENSION_PATH]
      : [];

    context = await chromium.launchPersistentContext('', {
      headless: false,
      args: [
        ...extArgs,
        '--no-first-run',
        '--disable-default-apps',
        '--mute-audio'
      ],
      viewport: { width: 1280, height: 800 },
      ignoreDefaultArgs: ['--disable-extensions']
    });

    context.on('page', p => {
      const url = p.url();
      // L'onboarding aperto all'install falsava la misura
      if (!/^(chrome-extension:|moz-extension:|about:)/i.test(url)) {
        tabs.push(url);
      }
      try { p.close(); } catch (e) {}
    });

    await sleep(2500);

    const page = context.pages()[0] || await context.newPage();

    try {
      await page.goto(URL, { waitUntil: 'domcontentloaded', timeout: 45000 });
    } catch (e) {
      console.log('goto error:', e.message);
    }

    await sleep(5000);

    const frames = page.frames();
    console.log('\nFrames trovati:');
    frames.forEach((f, i) => {
      const url = f.url() || '';
      console.log(`  ${i}: ${url.substring(0, 90)}`);
    });

    let clickNecessari = null;
    const maxTentativi = 6;

    for (let tentativo = 1; tentativo <= maxTentativi; tentativo++) {
      console.log(`\n--- Tentativo click ${tentativo}/${maxTentativi} ---`);

      const iframe = await page.$('iframe');
      if (iframe) {
        const box = await iframe.boundingBox();
        if (box) {
          await page.mouse.click(box.x + box.width / 2, box.y + box.height / 2);
          console.log(`Click su iframe al centro: ${box.x + box.width / 2}, ${box.y + box.height / 2}`);
        } else {
          await page.mouse.click(640, 400);
          console.log('Click generico: 640, 400 (iframe senza boundingBox)');
        }
      } else {
        await page.mouse.click(640, 400);
        console.log('Click generico: 640, 400 (nessun iframe)');
      }

      await sleep(2500);

      const framesNow = page.frames();
      let videoStates = [];
      for (const frame of framesNow) {
        const state = await getVideoState(frame);
        if (state && state.trovato) {
          videoStates.push({
            frameUrl: (frame.url() || '').substring(0, 50),
            paused: state.paused,
            currentTime: state.t
          });
        }
      }

      console.log(`Stato video frames:`, JSON.stringify(videoStates));
      console.log(`Tabs aperte finora: ${tabs.length}`);

      const videoCheck = await checkVideoPlaying(page);
      if (videoCheck.isPlaying) {
        clickNecessari = tentativo;
        console.log(`\n*** VIDEO PARTITO al click ${tentativo}! ***`);
        break;
      }
    }

    if (clickNecessari === null) {
      console.log('\n*** VIDEO MAI PARTITO dopo 6 tentativi ***');
    }

    return { clickNecessari, tabs };

  } catch (e) {
    console.error('Errore in prova:', e.message);
    return { clickNecessari: null, tabs: [] };

  } finally {
    if (context) {
      try {
        await context.close();
      } catch (e) {
        console.error('Errore chiusura context:', e.message);
      }
    }
  }
}

async function main() {
  console.log('='.repeat(60));
  console.log('TEST CLICK CONTEGGIO VIDEO');
  console.log('='.repeat(60));

  const resultSenza = await prova(false);
  console.log('\n' + '='.repeat(60));
  console.log('SENZA ESTENSIONE - Click necessari:', resultSenza.clickNecessari);
  console.log('Tabs pubblicitarie chiuse:', resultSenza.tabs.length);
  console.log('='.repeat(60));

  await sleep(3000);

  const resultCon = await prova(true);
  console.log('\n' + '='.repeat(60));
  console.log('CON ESTENSIONE - Click necessari:', resultCon.clickNecessari);
  console.log('Tabs pubblicitarie chiuse:', resultCon.tabs.length);
  console.log('URL TAB RESIDUE (con estensione):', JSON.stringify(resultCon.tabs, null, 1));
  console.log('URL TAB (senza estensione):', JSON.stringify(resultSenza.tabs, null, 1));
  console.log('='.repeat(60));

  console.log('\n' + '#'.repeat(60));
  console.log('CONFRONTO FINALE');
  console.log('#'.repeat(60));
  console.log(`Senza estensione: ${resultSenza.clickNecessari !== null ? resultSenza.clickNecessari + ' click' : 'video mai partito'}`);
  console.log(`Con estensione:    ${resultCon.clickNecessari !== null ? resultCon.clickNecessari + ' click' : 'video mai partito'}`);
  console.log(`Differenza tabs pubblicitarie: ${Math.abs(resultSenza.tabs.length - resultCon.tabs.length)}`);
  console.log('#'.repeat(60));
}

main().catch(e => {
  console.error('Errore main:', e.message);
  process.exit(1);
});
