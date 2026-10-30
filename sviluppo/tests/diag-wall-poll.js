const { chromium } = require('playwright');
const path = require('path');
const fs = require('fs');

const EXTENSION_PATH = path.resolve(__dirname, '../../app');
const TARGET_URL =
  process.env.TARGET_URL ||
  'https://proctercommunity.info/film/mutiny-inverti-la-rotta-2026-D12884453x/orologio/#video-player';
const OUT = path.resolve(__dirname, 'out');
const WITH_EXT = process.env.NOEXT !== '1';
const POLL_SECONDS = parseInt(process.env.POLL, 10) || 75;
fs.mkdirSync(OUT, { recursive: true });

const WALL_RE = 'account GRATUITO|creare un account per continuare|Continua a guardare GRATIS|Registrazione rapida|abbonamento . riservato';

async function run() {
  const reqs = [];
  const navs = [];

  const extArgs = WITH_EXT
    ? ['--disable-extensions-except=' + EXTENSION_PATH, '--load-extension=' + EXTENSION_PATH]
    : [];
  const context = await chromium.launchPersistentContext('', {
    headless: false,
    args: [...extArgs, '--no-first-run', '--mute-audio'],
    viewport: { width: 1366, height: 900 },
    ignoreDefaultArgs: ['--disable-extensions'],
  });
  await new Promise((r) => setTimeout(r, 3000));

  context.on('page', async (p) => {
    await new Promise((r) => setTimeout(r, 600));
    navs.push({ kind: 'popup', url: p.url() });
  });

  const page = context.pages()[0] || (await context.newPage());
  page.on('requestfinished', (r) => reqs.push({ t: Date.now(), url: r.url(), ok: true }));
  page.on('requestfailed', (r) => reqs.push({ t: Date.now(), url: r.url(), ok: false }));
  page.on('framenavigated', (f) => {
    if (f === page.mainFrame()) navs.push({ kind: 'nav', url: f.url() });
  });

  await page.goto(TARGET_URL, { waitUntil: 'domcontentloaded', timeout: 45000 }).catch(() => {});
  await new Promise((r) => setTimeout(r, 4000));
  await page.mouse.click(683, 620).catch(() => {}); // avvia il player
  const t0 = Date.now();

  let wallAt = null, wallDump = null;
  for (let s = 0; s < POLL_SECONDS; s++) {
    await new Promise((r) => setTimeout(r, 1000));
    let hit = null;
    for (const f of page.frames()) {
      hit = await f
        .evaluate((reSrc) => {
          const RE = new RegExp(reSrc, 'i');
          if (!RE.test(document.body ? document.body.innerText : '')) return null;
          const walk = document.createTreeWalker(document.body, NodeFilter.SHOW_ELEMENT);
          let n;
          while ((n = walk.nextNode())) {
            const own = Array.from(n.childNodes).filter((c) => c.nodeType === 3).map((c) => c.textContent).join(' ');
            if (!RE.test(own)) continue;
            let el = n, d = 0, cont = n;
            while (el && d < 14) {
              const cs = getComputedStyle(el);
              if (cs.position === 'fixed' || (cs.position === 'absolute' && parseInt(cs.zIndex || '0') > 50)) { cont = el; break; }
              el = el.parentElement; d++;
            }
            const cs = getComputedStyle(cont);
            return {
              tag: cont.tagName, id: cont.id || null,
              cls: (cont.className && cont.className.toString) ? cont.className.toString().slice(0, 200) : null,
              pos: cs.position, z: cs.zIndex,
              html: cont.outerHTML.slice(0, 1500),
              anchors: Array.from(cont.querySelectorAll('a[href]')).map((a) => a.href).slice(0, 10),
              iframeSrcs: Array.from(document.querySelectorAll('iframe')).map((i) => i.src).slice(0, 10),
            };
          }
          return null;
        }, WALL_RE)
        .catch(() => null);
      if (hit) { hit.frame = f.url().slice(0, 120); break; }
    }
    if (hit) { wallAt = ((Date.now() - t0) / 1000).toFixed(1); wallDump = hit; break; }
  }

  console.log('[WALL COMPARSO DOPO]', wallAt ? wallAt + 's' : 'MAI (entro ' + POLL_SECONDS + 's)');
  if (wallDump) console.log('[WALL]', JSON.stringify(wallDump, null, 1).slice(0, 3000));

  await page.screenshot({ path: path.join(OUT, 'wall-poll-' + (WITH_EXT ? 'ext' : 'noext') + '.png') });

  for (const f of page.frames()) {
    const v = await f.evaluate(() => {
      const el = document.querySelector('video');
      return el ? { playing: !el.paused, t: +el.currentTime.toFixed(2), ready: el.readyState } : null;
    }).catch(() => null);
    if (v) console.log('[VIDEO]', f.url().slice(0, 70), JSON.stringify(v));
  }
  console.log('[NAV/POPUP]', JSON.stringify(navs, null, 1).slice(0, 1500));

  // richieste negli ultimi 12s prima della comparsa del muro
  if (wallAt) {
    const cut = t0 + parseFloat(wallAt) * 1000;
    console.log('\n[RICHIESTE NEI 12s PRIMA DEL MURO]');
    reqs.filter((r) => r.t > cut - 12000 && r.t <= cut + 1500)
      .forEach((r) => console.log('  ' + (r.ok ? 'OK ' : 'BLK') + ' ' + r.url.slice(0, 130)));
  }

  fs.writeFileSync(path.join(OUT, 'wall-poll-report.json'), JSON.stringify({ wallAt, wallDump, navs, reqs }, null, 1));
  await context.close();
}

run().catch((e) => { console.error('[FATAL]', e); process.exit(1); });
