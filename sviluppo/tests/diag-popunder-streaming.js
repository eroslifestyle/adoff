const { chromium } = require('playwright');
const path = require('path');

const EXTENSION_PATH = path.resolve(__dirname, '../../app');
const TARGET_URL = process.env.TARGET_URL || 'https://streaming-community.red/';
const CLICKS = parseInt(process.env.CLICKS, 10) || 6;
const WITH_EXT = process.env.NOEXT !== '1';

async function run() {
  let context;
  const popups = [];
  const thirdPartyDocRequests = [];

  const extArgs = WITH_EXT
    ? ['--disable-extensions-except=' + EXTENSION_PATH, '--load-extension=' + EXTENSION_PATH]
    : [];

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

    await new Promise(r => setTimeout(r, 2500));

    const initScript = `
      (function() {
        try {
          window.__adoffDiag = {
            openCalls: [],
            anchorClicks: [],
            blocked: [],
            navAttempts: [],
            formSubmits: []
          };

          var _origOpen = window.open;
          window.open = function() {
            try {
              window.__adoffDiag.openCalls.push({
                url: arguments[0] || '',
                frameUrl: location.href,
                stack: new Error().stack.split(String.fromCharCode(10)).slice(1, 4).join(' | ')
              });
            } catch(e) {}
            return _origOpen.apply(window, arguments);
          };

          document.addEventListener('adoff-popup-blocked', function(e) {
            try {
              window.__adoffDiag.blocked.push(e.detail);
            } catch(err) {}
          }, true);

          document.addEventListener('click', function(e) {
            try {
              var anchor = e.target.closest('a[target="_blank"]');
              if (anchor) {
                var href = anchor.href || '';
                var isThird = false;
                try {
                  var targetHost = location.hostname;
                  var linkUrl = new URL(href, location.href);
                  isThird = linkUrl.hostname !== targetHost && href.indexOf('://') !== -1;
                } catch(u) {}
                window.__adoffDiag.anchorClicks.push({
                  href: href,
                  isThirdParty: isThird,
                  frameUrl: location.href
                });
              }
            } catch(err) {}
          }, true);

          var _origFormSubmit;
          try {
            _origFormSubmit = HTMLFormElement.prototype.submit;
            HTMLFormElement.prototype.submit = function() {
              try {
                window.__adoffDiag.formSubmits.push({
                  action: this.action || '',
                  target: this.target || '',
                  frameUrl: location.href
                });
              } catch(err) {}
              return _origFormSubmit.apply(this, arguments);
            };
          } catch(fErr) {}

          window.__adoffDiag.__ready = true;
        } catch(e) {
          console.error('[adoff-diag init error]', e);
        }
      })();
    `;

    context.addInitScript(initScript);

    context.on('page', async (p) => {
      try {
        const initial = p.url();
        await new Promise(r => setTimeout(r, 800));
        const final = p.url();
        popups.push({ initial, final });
        await p.close();
      } catch (e) {
        console.error('[popup handler error]', e.message);
      }
    });

    const pages = context.pages();
    const page = pages.length > 0 ? pages[0] : await context.newPage();

    page.on('request', (req) => {
      try {
        if (req.resourceType() === 'document') {
          const url = req.url();
          let reqHost;
          try {
            reqHost = new URL(url).hostname;
          } catch (e) {
            return;
          }
          let targetHost;
          try {
            targetHost = new URL(TARGET_URL).hostname;
          } catch (e) {
            targetHost = '';
          }
          if (reqHost !== targetHost && !url.startsWith('data:') && !url.startsWith('about:')) {
            thirdPartyDocRequests.push({ url, from: req.frame().url() });
          }
        }
      } catch (e) {}
    });

    try {
      await page.goto(TARGET_URL, { waitUntil: 'domcontentloaded', timeout: 45000 });
    } catch (e) {
      console.error('[goto error]', e.message);
    }

    await new Promise(r => setTimeout(r, 4000));

    try {
      const probe = await page.evaluate(() => ({
        url: location.href,
        title: document.title,
        htmlLen: document.documentElement.outerHTML.length,
        links: document.querySelectorAll('a').length,
        iframes: document.querySelectorAll('iframe').length,
        body: (document.body ? document.body.innerText : '').slice(0, 300)
      }));
      console.log('[PROBE]', JSON.stringify(probe, null, 1));
    } catch (e) {
      console.error('[probe error]', e.message);
    }
    for (let i = 0; i < CLICKS; i++) {
      try {
        await page.mouse.click(683, 450);
      } catch (e) {
        console.error('[click error]', e.message);
      }
      await new Promise(r => setTimeout(r, 1500));
    }

    await new Promise(r => setTimeout(r, 2000));

    let topDiag = {};
    let topMarkers = {};
    let iframeResults = [];

    try {
      topDiag = await page.evaluate(() => {
        return JSON.parse(JSON.stringify(window.__adoffDiag || {}));
      });
    } catch (e) {
      console.error('[top diag eval error]', e.message);
    }

    try {
      topMarkers = await page.evaluate(() => {
        return {
          openPatched: window.open.name === 'safeOpen',
          anchorPatched: !!(HTMLAnchorElement.prototype.click.__adoffPatched),
          stealthAttr: (document.documentElement.getAttribute('data-adoff-stealth') || 'not-set')
        };
      });
    } catch (e) {
      console.error('[top markers eval error]', e.message);
    }

    try {
      const frames = page.frames();
      for (const frame of frames) {
        try {
          const frameUrl = (frame.url() || '').slice(0, 100);
          const markers = await frame.evaluate(() => {
            try {
              return {
                openPatched: window.open.name === 'safeOpen',
                anchorPatched: !!(HTMLAnchorElement.prototype.click.__adoffPatched),
                stealthAttr: (document.documentElement.getAttribute('data-adoff-stealth') || 'not-set')
              };
            } catch (e) {
              return { openPatched: null, anchorPatched: null, stealthAttr: 'eval-err' };
            }
          });
          iframeResults.push({ url: frameUrl, markers });
        } catch (e) {
          iframeResults.push({ url: 'frame-err', markers: {} });
        }
      }
    } catch (e) {
      console.error('[iframe eval error]', e.message);
    }

    const popupDomains = [...new Set(
      popups.map(p => {
        try {
          return new URL(p.final || p.initial).hostname;
        } catch (e) {
          return p.final || p.initial;
        }
      }).filter(Boolean)
    )];

    console.log('\n========== ADoff Diag Report ==========');
    console.log('Extension loaded:', WITH_EXT);
    console.log('Target URL:', TARGET_URL);
    console.log('Clicks performed:', CLICKS);
    console.log('--- POPUPS ---');
    console.log('Total new tabs opened:', popups.length);
    console.log('Unique popup domains:', popupDomains.length);
    popupDomains.forEach(d => console.log('  -', d));
    if (popups.length > 0) {
      console.log('Popup details:');
      popups.forEach((p, i) => console.log('  [' + i + '] initial=' + p.initial + ' final=' + p.final));
    }
    console.log('--- BLOCKED ---');
    console.log('Blocked count:', topDiag.blocked ? topDiag.blocked.length : 0);
    if (topDiag.blocked && topDiag.blocked.length > 0) {
      topDiag.blocked.forEach((b, i) => console.log('  [' + i + '] url=' + b.url + ' reason=' + b.reason));
    }
    console.log('--- TOP FRAME MARKERS ---');
    console.log('  openPatched:', topMarkers.openPatched);
    console.log('  anchorPatched:', topMarkers.anchorPatched);
    console.log('  stealthAttr:', topMarkers.stealthAttr);
    console.log('--- IFRAME MARKERS ---');
    console.log('  iframe count:', iframeResults.length);
    iframeResults.forEach((r, i) => {
      console.log('  [' + i + '] url=' + r.url);
      console.log('      openPatched=' + r.markers.openPatched + ' anchorPatched=' + r.markers.anchorPatched + ' stealthAttr=' + r.markers.stealthAttr);
    });
    console.log('--- openCalls ---');
    console.log('  count:', topDiag.openCalls ? topDiag.openCalls.length : 0);
    if (topDiag.openCalls) {
      topDiag.openCalls.slice(0, 20).forEach((o, i) => {
        console.log('  [' + i + '] url=' + o.url + ' frameUrl=' + (o.frameUrl || '').slice(0, 80));
        console.log('      stack=' + (o.stack || '').slice(0, 150));
      });
    }
    console.log('--- anchorClicks ---');
    console.log('  count:', topDiag.anchorClicks ? topDiag.anchorClicks.length : 0);
    if (topDiag.anchorClicks) {
      topDiag.anchorClicks.slice(0, 20).forEach((a, i) => {
        console.log('  [' + i + '] href=' + a.href + ' thirdParty=' + a.isThirdParty + ' frameUrl=' + (a.frameUrl || '').slice(0, 80));
      });
    }
    console.log('--- formSubmits ---');
    console.log('  count:', topDiag.formSubmits ? topDiag.formSubmits.length : 0);
    if (topDiag.formSubmits) {
      topDiag.formSubmits.forEach((f, i) => console.log('  [' + i + '] action=' + f.action + ' target=' + f.target));
    }
    console.log('--- thirdPartyDocRequests ---');
    console.log('  count:', thirdPartyDocRequests.length);
    thirdPartyDocRequests.slice(0, 15).forEach((r, i) => console.log('  [' + i + '] url=' + r.url.slice(0, 100) + ' from=' + (r.from || '').slice(0, 80)));
    console.log('========== End Report ==========\n');

  } catch (e) {
    console.error('[FATAL]', e.message);
    console.error(e.stack);
  } finally {
    if (context) {
      try {
        await context.close();
      } catch (e) {
        console.error('[close error]', e.message);
      }
    }
  }
}

run();
