const { chromium } = require('playwright');
const path = require('path');

const TARGET = process.env.TARGET_URL || 'https://streaming-community.red/';
const WITH_EXT = process.env.NOEXT !== '1';

async function run() {
  let context = null;
  const popups = [];

  const extArgs = WITH_EXT ? [
    `--disable-extensions-except=${path.resolve(__dirname, '../../app')}`,
    `--load-extension=${path.resolve(__dirname, '../../app')}`
  ] : [];

  try {
    context = await chromium.launchPersistentContext('', {
      headless: false,
      args: [
        ...extArgs,
        '--no-first-run',
        '--disable-default-apps',
        '--mute-audio'
      ],
      viewport: { width: 1366, height: 900 },
      ignoreDefaultArgs: ['--disable-extensions']
    });

    await new Promise((r) => setTimeout(r, 2500));

    context.addInitScript(() => {
      try {
        window.__adoffDiag = {
          openCalls: [],
          anchorClicks: [],
          blocked: [],
          navAttempts: []
        };

        const origOpen = window.open.bind(window);
        window.open = function(url, ...args) {
          try {
            window.__adoffDiag.openCalls.push({
              url: url || '',
              frameUrl: location.href
            });
          } catch (e) {}
          return origOpen(url, ...args);
        };

        document.addEventListener('adoff-popup-blocked', (e) => {
          try {
            window.__adoffDiag.blocked.push(e.detail);
          } catch (err) {}
        }, true);

        document.addEventListener('click', (e) => {
          try {
            const anchor = e.target.closest('a');
            if (anchor) {
              const hostname = location.hostname;
              let targetHostname;
              try {
                targetHostname = new URL(anchor.href).hostname;
              } catch (err) {
                targetHostname = 'invalid';
              }
              window.__adoffDiag.anchorClicks.push({
                href: anchor.href,
                target: anchor.target || '_self',
                thirdParty: targetHostname !== hostname && targetHostname !== 'invalid'
              });
            }
          } catch (err) {}
        }, true);

        const origAssign = window.location.assign.bind(window.location);
        window.location.assign = function(url) {
          try {
            window.__adoffDiag.navAttempts.push({
              url: url,
              frameUrl: location.href,
              method: 'assign'
            });
          } catch (e) {}
          return origAssign(url);
        };

        const origReplace = window.location.replace.bind(window.location);
        window.location.replace = function(url) {
          try {
            window.__adoffDiag.navAttempts.push({
              url: url,
              frameUrl: location.href,
              method: 'replace'
            });
          } catch (e) {}
          return origReplace(url);
        };
      } catch (err) {
        console.error('[adoff-diag-init]', err.message);
      }
    });

    context.on('page', async (page) => {
      try {
        const initialUrl = page.url();
        await page.waitForTimeout(1200);
        const finalUrl = page.url();
        let openerUrl = null;
        try {
          const opener = page.opener();
          if (opener) {
            openerUrl = opener.url();
          }
        } catch (e) {}
        popups.push({
          initial: initialUrl,
          final: finalUrl,
          opener: openerUrl,
          timestamp: Date.now()
        });
        await page.close().catch(() => {});
      } catch (err) {
        console.error('[popup-handler]', err.message);
      }
    });

    const page = context.pages()[0] || await context.newPage();

    console.log('\n========== FASE 1: HOME ==========');
    await page.goto(TARGET, { waitUntil: 'domcontentloaded', timeout: 45000 });
    await page.waitForTimeout(4000);
    console.log('[HOME] URL:', page.url());
    console.log('[HOME] Popup count:', popups.length);

    console.log('\n========== FASE 2: TITOLO ==========');
    const titleLinks = await page.$$eval('a[href*="/titles/"]', els => els.map(e => e.href)).catch(() => []);
    console.log('[TITOLO] Trovati link:', titleLinks.length);
    
    if (titleLinks.length > 0) {
      const titleHref = titleLinks[0];
      console.log('[TITOLO] Click su:', titleHref);
      
      for (let i = 0; i < 3; i++) {
        try {
          await page.click(`a[href="/titles/${titleHref.split('/titles/')[1]}"]`, { timeout: 8000 });
        } catch (e) {
          try {
            const links = await page.$$('a[href*="/titles/"]');
            if (links.length > 0) await links[0].click();
          } catch (err) {}
        }
        await page.waitForTimeout(3000);
        console.log('[TITOLO] Tentativo', i + 1, '- URL:', page.url());
        if (page.url() !== TARGET) break;
      }
    }
    console.log('[TITOLO] Popup count:', popups.length);

    console.log('\n========== FASE 3: PLAYER ==========');
    await page.waitForTimeout(3000);
    
    const frames = page.frames();
    console.log('[PLAYER] Iframes trovati:', frames.length);
    frames.forEach((f, i) => {
      try {
        const url = f.url() || '';
        console.log(`[PLAYER] Frame ${i}: ${url.substring(0, 120)}`);
      } catch (e) {
        console.log(`[PLAYER] Frame ${i}: <access denied>`);
      }
    });

    for (let i = 0; i < 4; i++) {
      await page.mouse.click(683, 450);
      await page.waitForTimeout(2000);
      console.log('[PLAYER] Mouse click', i + 1);
    }

    const playerSelectors = ['iframe', '.play', '#player', 'video'];
    for (const sel of playerSelectors) {
      try {
        const el = await page.$(sel);
        if (el) {
          await el.click().catch(() => {});
          await page.waitForTimeout(1500);
          console.log('[PLAYER] Click su selettore:', sel);
        }
      } catch (e) {}
    }
    console.log('[PLAYER] Popup count:', popups.length);

    console.log('\n========== DIAGNOSTIC REPORT ==========');
    console.log('URL finale:', page.url());
    console.log('Totale tab aperte:', popups.length);
    
    const domainCounts = {};
    popups.forEach(p => {
      try {
        const domain = new URL(p.final).hostname;
        domainCounts[domain] = (domainCounts[domain] || 0) + 1;
      } catch (e) {
        domainCounts['unknown'] = (domainCounts['unknown'] || 0) + 1;
      }
    });
    console.log('Domini tab:', domainCounts);

    const allDiags = [];
    const mainDiag = await page.evaluate(() => window.__adoffDiag).catch(() => null);
    if (mainDiag) allDiags.push({ frame: 'top', url: page.url(), diag: mainDiag });

    const allFrames = page.frames();
    for (let i = 0; i < allFrames.length; i++) {
      try {
        const frameUrl = allFrames[i].url() || '';
        const diag = await allFrames[i].evaluate(() => window.__adoffDiag).catch(() => null);
        if (diag) {
          allDiags.push({
            frame: `frame-${i}`,
            url: frameUrl.substring(0, 120),
            diag
          });
        }
        const openPatched = await allFrames[i].evaluate(() => window.open.name === 'safeOpen').catch(() => false);
        const anchorPatched = await allFrames[i].evaluate(() => HTMLAnchorElement.prototype.click.__adoffPatched === true).catch(() => false);
        const stealthAttr = await allFrames[i].evaluate(() => document.body?.dataset?.adoffStealth).catch(() => null);
        console.log(`[FRAME] ${i}: patchedOpen=${openPatched}, patchedAnchor=${anchorPatched}, stealth=${stealthAttr}, url=${frameUrl.substring(0, 120)}`);
      } catch (e) {
        console.log(`[FRAME] ${i}: <error: ${e.message}>`);
      }
    }

    let totalBlocked = 0;
    allDiags.forEach(d => {
      totalBlocked += (d.diag.blocked?.length || 0);
    });
    console.log('Totale blocked AdOff:', totalBlocked);
    
    console.log('\n--- openCalls ---');
    allDiags.forEach(d => {
      (d.diag.openCalls || []).forEach(c => {
        console.log(`[OPEN] ${d.frame}: ${c.url} @ ${c.frameUrl}`);
      });
    });

    console.log('\n--- anchorClicks (thirdParty) ---');
    allDiags.forEach(d => {
      (d.diag.anchorClicks || []).filter(a => a.thirdParty).forEach(a => {
        console.log(`[ANCHOR-3P] ${d.frame}: ${a.href} -> ${a.target}`);
      });
    });

    console.log('\n--- navAttempts ---');
    allDiags.forEach(d => {
      (d.diag.navAttempts || []).forEach(n => {
        console.log(`[NAV] ${d.frame}: ${n.method} -> ${n.url} @ ${n.frameUrl}`);
      });
    });

    console.log('\n--- Tab Details ---');
    popups.forEach((p, i) => {
      console.log(`[TAB ${i+1}] init: ${p.initial.substring(0,100)} -> final: ${p.final.substring(0,100)}, opener: ${p.opener?.substring(0,100) || '?'}`);
    });

  } catch (err) {
    console.error('[ERROR]', err.message);
    console.error(err.stack);
  } finally {
    if (context) {
      await context.close().catch(() => {});
    }
    console.log('\n[END] Script completato');
  }
}

run().catch(e => {
  console.error('[FATAL]', e);
  process.exit(1);
});
