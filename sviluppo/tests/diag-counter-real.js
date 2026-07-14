// Test decisivo: traffico ad reale (fetch verso domini bloccati) + click reale sul toggle.
const { chromium } = require("playwright");
const path = require("path");
const EXT = process.argv[2] ? path.resolve(process.argv[2]) : path.resolve(__dirname, "../../app");

const AD_URLS = [
  "https://doubleclick.net/x.gif",
  "https://googlesyndication.com/pagead/x.js",
  "https://pagead2.googlesyndication.com/pagead/x.js",
  "https://adservice.google.com/x",
  "https://googleadservices.com/x",
];

(async () => {
  const ctx = await chromium.launchPersistentContext("", {
    headless: false,
    args: [`--disable-extensions-except=${EXT}`, `--load-extension=${EXT}`, "--no-first-run"],
  });
  let sw = ctx.serviceWorkers()[0] || await ctx.waitForEvent("serviceworker", { timeout: 15000 }).catch(() => null);
  if (!sw) { console.log("NO SW"); await ctx.close(); process.exit(1); }
  const extId = sw.url().split("/")[2];
  await new Promise((r) => setTimeout(r, 2000));

  // Pagina reale → fetch verso domini ad (vengono bloccati dalle DNR rules)
  const page = await ctx.newPage();
  await page.goto("https://example.com", { waitUntil: "domcontentloaded" }).catch(() => {});
  await page.evaluate(async (urls) => {
    await Promise.all(urls.map((u) => fetch(u, { mode: "no-cors" }).catch(() => {})));
  }, AD_URLS).catch(() => {});
  await new Promise((r) => setTimeout(r, 1500));

  // getMatchedRules dal SW (input del contatore network)
  const matched = await sw.evaluate(async () => {
    try {
      const d = await chrome.declarativeNetRequest.getMatchedRules({});
      return { ok: true, count: (d.rulesMatchedInfo || []).length, ids: (d.rulesMatchedInfo || []).map(r => r.rule.ruleId) };
    } catch (e) { return { ok: false, err: String(e && e.message || e) }; }
  });
  console.log("MATCHED RULES (network counter input):", JSON.stringify(matched));

  // Test incremento contatore cosmetico: invia il messaggio come fa content.js (da una pagina con content script)
  const cosmetic = await sw.evaluate(async () => {
    return await new Promise((res) => {
      const before = 0;
      // simula il flusso: il listener onMessage chiama incrementAdsCounter
      chrome.storage.local.get("adoffAdsBlocked", (b) => {
        const start = b.adoffAdsBlocked || 0;
        // invoca direttamente il path del messaggio via runtime (sender = SW stesso = stesso id)
        chrome.runtime.sendMessage({ action: "incrementAdsBlocked", count: 5 }, () => {
          setTimeout(() => chrome.storage.local.get("adoffAdsBlocked", (a) => res({ start, after: a.adoffAdsBlocked || 0 })), 600);
        });
      });
    });
  });
  console.log("COSMETIC COUNTER (start→after +5):", JSON.stringify(cosmetic));

  // CLICK REALE sul toggle del popup
  const popup = await ctx.newPage();
  const perr = [];
  popup.on("pageerror", (e) => perr.push(e.message));
  await popup.goto(`chrome-extension://${extId}/src/popup.html`);
  await new Promise((r) => setTimeout(r, 1500));
  const beforeClick = await popup.evaluate(() => document.getElementById("globalToggle").checked);
  await popup.click("#globalToggle").catch(async () => { await popup.evaluate(() => document.getElementById("globalToggle").click()); });
  await new Promise((r) => setTimeout(r, 1200));
  const afterClick = await popup.evaluate(() => ({
    checked: document.getElementById("globalToggle").checked,
    status: document.getElementById("toggleStatus").textContent,
  }));
  const afterClickRules = await sw.evaluate(async () => ({
    enabled: await chrome.declarativeNetRequest.getEnabledRulesets(),
    stored: (await chrome.storage.local.get("adoffEnabled")).adoffEnabled,
  }));
  console.log("TOGGLE CLICK before:", beforeClick, "after:", JSON.stringify(afterClick), "rules:", JSON.stringify(afterClickRules));
  console.log("POPUP ERRORS:", JSON.stringify(perr));

  await ctx.close();
})().catch((e) => { console.error("FAIL:", e.message); process.exit(1); });
