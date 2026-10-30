'use strict';
const { chromium } = require('playwright');
const path = require('path');
const fs = require('fs');

const EXTENSION_PATH = path.resolve(__dirname, '../../app');
const OUT_DIR = path.resolve(__dirname, 'out');
const NOEXT = process.env.NOEXT === '1';
const extLabel = NOEXT ? 'noext' : 'ext';

async function main() {
  let context;
  const requestFailed = [];
  const responseErrors = [];
  const pageErrors = [];

  const extArgs = NOEXT
    ? []
    : [
        `--disable-extensions-except=${EXTENSION_PATH}`,
        `--load-extension=${EXTENSION_PATH}`,
      ];

  const launchOptions = {
    headless: false,
    // MAI channel:"chrome" — il Chrome di sistema NON inietta world:MAIN sotto --load-extension
    args: [
      '--no-first-run',
      '--disable-default-apps',
      '--mute-audio',
      ...extArgs,
    ],
    viewport: { width: 1366, height: 900 },
    ignoreDefaultArgs: ['--disable-extensions'],
  };

  try {
    context = await chromium.launchPersistentContext('', launchOptions);

    // 2500 ms after launch
    await new Promise(r => setTimeout(r, 2500));

    const page = context.pages()[0];

    // ---- listeners ----
    page.on('requestfailed', req => {
      requestFailed.push({
        url: req.url().length > 120 ? req.url().slice(0, 120) + '...' : req.url(),
        failure: req.failure() ? req.failure().errorText : 'unknown',
      });
    });

    page.on('response', resp => {
      if (resp.status() >= 400) {
        responseErrors.push({
          url: resp.url(),
          status: resp.status(),
        });
      }
    });

    page.on('pageerror', err => {
      pageErrors.push(err.message);
    });

    // ---- init script (only when extension is loaded) ----
    if (!NOEXT) {
      await page.addInitScript(() => {
        const attr = 'data-adoff-stealth';
        const val = 'ao_abcdef12';
        // Deve essere presente PRIMA che stealth.js giri (document_start):
        // set immediato + loop rAF per resistere a rewrite del DOM.
        const set = () => {
          try {
            if (document.documentElement) document.documentElement.setAttribute(attr, val);
          } catch (_) {}
          requestAnimationFrame(set);
        };
        set();
      });
    }

    const targetUrl = process.env.URL || 'https://it.investing.com/equities/spcx-usd-perpetual-futures';
    console.log('==== NAVIGATE ====');
    console.log(targetUrl);
    console.log('==================');

    await page.goto(targetUrl, {
      timeout: 45000,
      waitUntil: 'domcontentloaded',
    });

    // 6 s after load
    // Il wall puo' comparire in ritardo: polling fino a WAIT_MS
    const WAIT_MS = parseInt(process.env.WAIT_MS || '25000', 10);
    const t0 = Date.now();
    while (Date.now() - t0 < WAIT_MS) {
      const found = await page.evaluate(() => {
        const el = Array.from(document.querySelectorAll('div,section,dialog,aside'))
          .find(e => /ad\s?block/i.test(e.textContent || '') && e.getBoundingClientRect().height > 80);
        return el ? (el.className || el.tagName) : null;
      });
      if (found) { console.log(`>>> WALL COMPARSO dopo ${Date.now() - t0}ms -> ${found}`); break; }
      await page.mouse.wheel(0, 600).catch(() => {});
      await new Promise(r => setTimeout(r, 1500));
    }

    // ---- diagnostic evaluation ----
    const diag = await page.evaluate(() => {
      const adTechVars = [
        'googletag','adsbygoogle','pbjs','apstag','criteo_pubtag',
        'Taboola','_taboola','outbrain','OBR','ADAGIO','rubicon',
        'prebid','__tcfapi','googlefc','fundingchoices'
      ];
      const adTechInfo = {};
      for (const name of adTechVars) {
        const g = window[name];
        if (g !== undefined) {
          const type = typeof g;
          const entry = { type };
          if (type === 'object') {
            entry.keys = Object.keys(g).slice(0, 10);
          }
          adTechInfo[name] = entry;
        } else {
          adTechInfo[name] = null;
        }
      }

      // all <script src>
      const scripts = Array.from(document.querySelectorAll('script[src]')).map(s => ({
        src: s.src.length > 100 ? s.src.slice(0, 100) + '...' : s.src,
        hasOnerror: s.hasAttribute('onerror'),
      }));

      // ad‑blocker wall detection
      const wallElements = [];
      const reWall = /ad\s?blocker/i;
      const all = document.querySelectorAll('*');
      for (const el of all) {
        if (el.children.length === 0) {
          const txt = el.textContent || '';
          if (reWall.test(txt)) {
            const ancestors = [];
            let parent = el.parentElement;
            for (let i = 0; i < 3 && parent; i++) {
              ancestors.push(parent.className || '');
              parent = parent.parentElement;
            }
            wallElements.push({
              tagName: el.tagName,
              id: el.id || '',
              className: el.className || '',
              outerHTML: el.outerHTML.length > 300
                ? el.outerHTML.slice(0, 300) + '...'
                : el.outerHTML,
              ancestors,
            });
          }
        }
      }

      const bodyOverflow = document.body ? document.body.style.overflow : '';
      const docOverflow = document.documentElement ? document.documentElement.style.overflow : '';
      const finalHref = window.location.href;

      return {
        adTechInfo,
        scripts,
        wallElements,
        bodyOverflow,
        docOverflow,
        finalHref,
      };
    });

    // ensure output directory exists
    fs.mkdirSync(OUT_DIR, { recursive: true });
    const screenshotPath = path.join(OUT_DIR, `investing-${extLabel}.png`);
    await page.screenshot({ path: screenshotPath });
    console.log('==== SCREENSHOT ====');
    console.log(screenshotPath);
    console.log('===================');

    // group requestFailed by hostname
    const byHost = {};
    for (const item of requestFailed) {
      let host = 'unknown';
      try {
        host = new URL(item.url).hostname;
      } catch (_) {}
      if (!byHost[host]) byHost[host] = { count: 0, items: [] };
      byHost[host].count++;
      byHost[host].items.push(item);
    }

    console.log('==== REQUEST FAILED (grouped by host) ====');
    console.log(JSON.stringify(byHost, null, 2));

    console.log('==== RESPONSE ERRORS (status >= 400) ====');
    console.log(JSON.stringify(responseErrors, null, 2));

    console.log('==== PAGE ERRORS ====');
    console.log(JSON.stringify(pageErrors, null, 2));

    console.log('==== DIAGNOSTIC OBJECT ====');
    console.log(JSON.stringify(diag, null, 2));

  } catch (err) {
    console.error('FATAL ERROR:', err);
  } finally {
    if (context) {
      await context.close();
    }
  }
}

main().catch(console.error);
