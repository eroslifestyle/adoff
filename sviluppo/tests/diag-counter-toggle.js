// Diagnostica: contatore blocchi + toggle disattivazione totale (v3.5.6).
// Carica l'estensione unpacked, cattura errori SW + popup, testa toggle→ruleset.
const { chromium } = require("playwright");
const path = require("path");

const EXT = process.argv[2] ? path.resolve(process.argv[2]) : path.resolve(__dirname, "../../app");

(async () => {
  const ctx = await chromium.launchPersistentContext("", {
    headless: false,
    args: [
      `--disable-extensions-except=${EXT}`,
      `--load-extension=${EXT}`,
      "--no-first-run",
    ],
  });

  const swErrors = [];
  ctx.on("weberror", (e) => swErrors.push("PAGE_ERR: " + e.error().message));

  // Attendi il service worker
  let sw = ctx.serviceWorkers()[0];
  if (!sw) sw = await ctx.waitForEvent("serviceworker", { timeout: 15000 }).catch(() => null);
  if (!sw) { console.log("NO SERVICE WORKER"); await ctx.close(); process.exit(1); }
  sw.on("console", (m) => { if (m.type() === "error") swErrors.push("SW_CONSOLE_ERR: " + m.text()); });

  const extId = sw.url().split("/")[2];
  console.log("EXT ID:", extId);

  // Lascia partire init/alarms
  await new Promise((r) => setTimeout(r, 2500));

  // Stato iniziale ruleset + storage (dal SW)
  const before = await sw.evaluate(async () => {
    const enabledRulesets = await chrome.declarativeNetRequest.getEnabledRulesets();
    const store = await chrome.storage.local.get(["adoffEnabled", "adoffAdsBlocked", "adoffReqBlocked"]);
    // test getMatchedRules (contatore) — deve NON lanciare con declarativeNetRequestFeedback
    let gmrOk = false, gmrErr = "";
    try { await chrome.declarativeNetRequest.getMatchedRules({}); gmrOk = true; }
    catch (e) { gmrErr = String(e && e.message || e); }
    return { enabledRulesets, store, gmrOk, gmrErr };
  });
  console.log("BEFORE:", JSON.stringify(before));

  // Simula il toggle OFF (come fa il popup: set adoffEnabled=false)
  await sw.evaluate(async () => { await chrome.storage.local.set({ adoffEnabled: false }); });
  await new Promise((r) => setTimeout(r, 1200)); // lascia girare storage.onChanged→toggleNetworkRules
  const afterOff = await sw.evaluate(async () => {
    return { enabledRulesets: await chrome.declarativeNetRequest.getEnabledRulesets() };
  });
  console.log("AFTER OFF (atteso enabledRulesets vuoto):", JSON.stringify(afterOff));

  // Re-enable
  await sw.evaluate(async () => { await chrome.storage.local.set({ adoffEnabled: true }); });
  await new Promise((r) => setTimeout(r, 1200));
  const afterOn = await sw.evaluate(async () => {
    return { enabledRulesets: await chrome.declarativeNetRequest.getEnabledRulesets() };
  });
  console.log("AFTER ON (atteso [adblock_rules]):", JSON.stringify(afterOn));

  // Apri il popup e cattura errori console
  const popupErrs = [];
  const popup = await ctx.newPage();
  popup.on("console", (m) => { if (m.type() === "error") popupErrs.push(m.text()); });
  popup.on("pageerror", (e) => popupErrs.push("PAGEERR: " + e.message));
  await popup.goto(`chrome-extension://${extId}/src/popup.html`);
  await new Promise((r) => setTimeout(r, 2000));
  const popupState = await popup.evaluate(() => ({
    toggleExists: !!document.getElementById("globalToggle"),
    toggleChecked: document.getElementById("globalToggle")?.checked,
    adsText: document.getElementById("adsBlocked")?.textContent,
    reqText: document.getElementById("reqBlocked")?.textContent,
    toggleStatus: document.getElementById("toggleStatus")?.textContent,
  }));
  console.log("POPUP STATE:", JSON.stringify(popupState));
  console.log("POPUP ERRORS:", JSON.stringify(popupErrs));
  console.log("SW/PAGE ERRORS:", JSON.stringify(swErrors));

  await ctx.close();
})().catch((e) => { console.error("TEST FAIL:", e.message); process.exit(1); });
