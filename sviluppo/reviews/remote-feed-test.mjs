// Test: syncRemoteRules applica il feed remoto in una install reale.
// Verifica che:
//   1. Il service worker chiami fetch(adoff.app/rules-feed.json)
//   2. Le regole remote (id >= 60000) siano in getDynamicRules()
//   3. adoffRemoteRulesCount sia popolato in storage
//
// Usage: xvfb-run -a node remote-feed-test.mjs [extDir]
//   extDir default: ../app  (root del progetto)
//   xvfb-run obbligatorio: SW non esposto in headless
import { chromium } from 'playwright';
import { join } from 'path';

const EXT = process.argv[2] || join(process.cwd(), '..', 'app');

// CDP endpoint del service worker dell'estensione caricata
async function getSwTarget(ctx) {
  const targets = ctx.serviceWorkers();
  if (!targets.length) {
    // Prova con background page
    const bg = ctx.backgroundPages();
    if (bg.length) return bg[0];
    return null;
  }
  return targets[0];
}

async function main() {
  console.log('[i] Loading extension from:', EXT);

  const ctx = await chromium.launchPersistentContext('', {
    headless: false, // xvfb-run rende headed funzionante senza display fisico
    args: [
      `--disable-extensions-except=${EXT}`,
      `--load-extension=${EXT}`,
      '--no-first-run',
      '--no-default-browser-check',
    ],
  });

  // Attendi che il SW si avvii e chiami syncRemoteRules
  let sw = null;
  for (let i = 0; i < 10; i++) {
    await new Promise(r => setTimeout(r, 1000));
    sw = await getSwTarget(ctx);
    if (sw) break;
  }

  if (!sw) {
    console.error('[✗] Service worker non trovato dopo 10s');
    await ctx.close();
    process.exit(1);
  }
  console.log('[+] SW attivo');

  // Aspetta che syncRemoteRules finisca (feed fetch + apply + storage write)
  await new Promise(r => setTimeout(r, 5000));

  // ---- Test 1: storage keys remote-feed ----
  const storage = await sw.evaluate(async () => {
    return new Promise(resolve => {
      chrome.storage.local.get(
        ['adoffRemoteRulesVer', 'adoffRemoteRulesSync', 'adoffRemoteRulesCount'],
        resolve
      );
    });
  });

  console.log('\n=== STORAGE ===');
  if (storage.adoffRemoteRulesCount !== undefined && storage.adoffRemoteRulesCount > 0) {
    console.log(`[✓] adoffRemoteRulesCount = ${storage.adoffRemoteRulesCount}`);
  } else {
    console.log(`[✗] adoffRemoteRulesCount mancante o zero (valore: ${storage.adoffRemoteRulesCount})`);
  }
  if (storage.adoffRemoteRulesVer !== undefined) {
    console.log(`[✓] adoffRemoteRulesVer = ${storage.adoffRemoteRulesVer}`);
  } else {
    console.log('[✗] adoffRemoteRulesVer mancante');
  }
  if (storage.adoffRemoteRulesSync) {
    const age = Math.round((Date.now() - storage.adoffRemoteRulesSync) / 1000);
    console.log(`[✓] adoffRemoteRulesSync = ${age}s fa`);
  } else {
    console.log('[✗] adoffRemoteRulesSync mancante');
  }

  // ---- Test 2: dynamic rules >= 60000 ----
  const dnrRules = await sw.evaluate(async () => {
    return new Promise(resolve => {
      chrome.declarativeNetRequest.getDynamicRules(resolve);
    });
  });

  const remoteRules = dnrRules.filter(r => r.id >= 60000 && r.id < 70000);
  console.log(`\n=== DYNAMIC RULES (id >= 60000) ===`);
  console.log(`    Totali: ${dnrRules.length}, Remote: ${remoteRules.length}`);
  if (remoteRules.length > 0) {
    for (const r of remoteRules.slice(0, 5)) {
      const c = r.condition || {};
      const uf = c.urlFilter || c.regexFilter || (c.requestDomains || []).join(',') || '-';
      console.log(`  [✓] id=${r.id} action=${r.action.type} filter=${uf}`);
    }
    if (remoteRules.length > 5) console.log(`  ... e altri ${remoteRules.length - 5}`);
  } else {
    console.log('[✗] Nessuna regola remote applicata');
  }

  // ---- Verdetto ----
  const ok = (storage.adoffRemoteRulesCount > 0) && (remoteRules.length > 0);
  console.log(`\n=== VERDICT: ${ok ? 'PASS ✓' : 'FAIL ✗'} ===`);

  await ctx.close();
  process.exit(ok ? 0 : 1);
}

main().catch(e => { console.error('[✗]', e); process.exit(1); });
