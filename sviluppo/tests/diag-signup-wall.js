const { chromium } = require('playwright');
const path = require('path');
const fs = require('fs');

const EXTENSION_PATH = path.resolve(__dirname, '../../app');
const TARGET_URL =
  process.env.TARGET_URL ||
  'https://proctercommunity.info/film/mutiny-inverti-la-rotta-2026-D12884453x/orologio/#video-player';
const OUT = path.resolve(__dirname, 'out');
const WITH_EXT = process.env.NOEXT !== '1';
fs.mkdirSync(OUT, { recursive: true });

// testo che identifica il muro di registrazione scam
const WALL_RE = /account GRATUITO|Devi creare un account|Continua a guardare GRATIS|Registrazione rapida/i;

async function run() {
  const reqs = [];
  const popups = [];

  const extArgs = WITH_EXT
    ? ['--disable-extensions-except=' + EXTENSION_PATH, '--load-extension=' + EXTENSION_PATH]
    : [];

  const context = await chromium.launchPersistentContext('', {
    headless: false,
    args: [...extArgs, '--no-first-run', '--disable-default-apps', '--mute-audio'],
    viewport: { width: 1366, height: 900 },
    ignoreDefaultArgs: ['--disable-extensions'],
  });
  await new Promise((r) => setTimeout(r, 3000));

  context.on('page', async (p) => {
    await new Promise((r) => setTimeout(r, 600));
    popups.push(p.url());
  });

  const page = context.pages()[0] || (await context.newPage());
  page.on('requestfinished', (r) => reqs.push({ url: r.url(), ok: true, type: r.resourceType() }));
  page.on('requestfailed', (r) => reqs.push({ url: r.url(), ok: false, type: r.resourceType() }));

  await page.goto(TARGET_URL, { waitUntil: 'domcontentloaded', timeout: 45000 }).catch(() => {});
  await new Promise((r) => setTimeout(r, 5000));

  // click reale sul player per avviare (e per far scattare il muro)
  await page.mouse.click(683, 620).catch(() => {});
  await new Promise((r) => setTimeout(r, 6000));
  await page.screenshot({ path: path.join(OUT, 'wall-1.png') });

  // ---- cerca il muro in ogni frame e dumpane la struttura ----
  const found = [];
  for (const f of page.frames()) {
    const hit = await f
      .evaluate((reSrc) => {
        const RE = new RegExp(reSrc, 'i');
        const out = [];
        // risali dall'elemento di testo al contenitore overlay
        const walk = document.createTreeWalker(document.body, NodeFilter.SHOW_ELEMENT);
        let n;
        while ((n = walk.nextNode())) {
          const own = Array.from(n.childNodes)
            .filter((c) => c.nodeType === 3)
            .map((c) => c.textContent)
            .join(' ');
          if (!RE.test(own)) continue;
          // sali fino a un contenitore con posizionamento fisso/assoluto
          let el = n, depth = 0, container = n;
          while (el && depth < 12) {
            const cs = getComputedStyle(el);
            if (cs.position === 'fixed' || (cs.position === 'absolute' && parseInt(cs.zIndex || '0') > 100)) {
              container = el;
              break;
            }
            el = el.parentElement; depth++;
          }
          const cs = getComputedStyle(container);
          out.push({
            tag: container.tagName,
            id: container.id || null,
            cls: container.className && container.className.toString ? container.className.toString().slice(0, 200) : null,
            pos: cs.position,
            z: cs.zIndex,
            html: container.outerHTML.slice(0, 900),
          });
          break;
        }
        // link di uscita presenti nel documento
        const links = Array.from(document.querySelectorAll('a[href]'))
          .map((a) => a.href)
          .filter((h) => !/proctercommunity\.info/.test(h) && /^https?:/.test(h))
          .slice(0, 15);
        return { out, links, url: location.href };
      }, WALL_RE.source)
      .catch(() => null);
    if (hit && (hit.out.length || hit.links.length)) found.push({ frame: f.url().slice(0, 100), ...hit });
  }
  console.log('[WALL FOUND]', JSON.stringify(found, null, 1).slice(0, 4000));

  // stato video
  for (const f of page.frames()) {
    const v = await f
      .evaluate(() => {
        const el = document.querySelector('video');
        return el ? { playing: !el.paused, t: +el.currentTime.toFixed(2), ready: el.readyState } : null;
      })
      .catch(() => null);
    if (v) console.log('[VIDEO]', f.url().slice(0, 70), JSON.stringify(v));
  }

  console.log('[POPUPS]', JSON.stringify(popups));

  const okH = {}, blkH = {};
  reqs.forEach((r) => {
    let h; try { h = new URL(r.url).hostname; } catch (e) { return; }
    (r.ok ? okH : blkH)[h] = ((r.ok ? okH : blkH)[h] || 0) + 1;
  });
  console.log('\n=== PASSATE ===');
  Object.entries(okH).sort((a,b)=>b[1]-a[1]).forEach(([h,c])=>console.log('  '+c+'  '+h));
  console.log('\n=== BLOCCATE ===');
  Object.entries(blkH).sort((a,b)=>b[1]-a[1]).forEach(([h,c])=>console.log('  '+c+'  '+h));

  fs.writeFileSync(path.join(OUT, 'wall-report.json'), JSON.stringify({ found, popups, reqs }, null, 1));
  await context.close();
}

run().catch((e) => { console.error('[FATAL]', e); process.exit(1); });
