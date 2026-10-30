// Verifica che stealth.js tolga il popup anti-adblock della piattaforma video senza
// alterare i campi firmati (bkaEnforcementMessageViewModel) e che il listener
// onAbnormalityDetected resti inerte.
// Uso: node sviluppo/tests/stealth-enforcement.test.mjs
import vm from "node:vm";
import fs from "node:fs";
import assert from "node:assert/strict";

const src = fs.readFileSync(new URL("../../app/src/stealth.js", import.meta.url), "utf8");
const POPUP = { auxiliaryUi: { messageRenderers: {
  bkaEnforcementMessageViewModel: { displayType: "ENFORCEMENT_MESSAGE_VIEW_MODEL_DISPLAY_TYPE_PLAYER" },
  enforcementMessageViewModel: { displayType: "X" } } },
  adPlacements: [{}], videoDetails: { lengthSeconds: "100" } };

const store = { __adoff_pro: "1" };
const win = {
  location: { hostname: "www.youtube.com", href: "https://www.youtube.com/watch?v=x" },
  localStorage: { getItem: (k) => store[k] ?? null, setItem() {} },
  document: { documentElement: { getAttribute: () => null, setAttribute() {} },
    addEventListener() {}, querySelector: () => null, querySelectorAll: () => [], getElementById: () => null },
  fetch: async () => new Response(JSON.stringify(POPUP)),
  setInterval: () => 0, clearInterval() {}, setTimeout: () => 0, clearTimeout() {},
  addEventListener() {}, MutationObserver: class { observe() {} },
  XMLHttpRequest: class { open() {} send() {} },
  Response, Request, URLSearchParams, JSON, Object, Promise, Proxy, Reflect, console,
};
win.window = win;
vm.createContext(win);
try { vm.runInContext(src, win); } catch (e) { console.warn("runtime parziale:", e.message); }

win.ytInitialPlayerResponse = structuredClone(POPUP);
const ipr = win.ytInitialPlayerResponse;
// campo firmato (trackingParam): deve restare identico, o la piattaforma da' errore 282054944
assert.deepEqual(ipr.auxiliaryUi.messageRenderers.bkaEnforcementMessageViewModel, POPUP.auxiliaryUi.messageRenderers.bkaEnforcementMessageViewModel);
assert.equal(ipr.auxiliaryUi.messageRenderers.enforcementMessageViewModel, undefined);
assert.equal(ipr.adPlacements, undefined);

win.ytInitialData = { overlay: { enforcementMessageViewModel: {} }, contents: {} };
assert.equal(win.ytInitialData.overlay.enforcementMessageViewModel, undefined);
assert.ok(win.ytInitialData.contents);

const txt = await (await win.fetch("https://www.youtube.com/youtubei/v1/get_watch", { method: "POST", body: "{}" })).text();
assert.ok(!txt.includes('"enforcementMessageViewModel"'));
assert.ok(txt.includes('"bkaEnforcementMessageViewModel"'));
assert.ok(!txt.includes('"adPlacements"'));
// il listener di onAbnormalityDetected non viene mai registrato
let registrato = false;
await new Promise((done) => Promise.resolve({ addEventListener: (t) => { if (t === "onAbnormalityDetected") registrato = true; } })
  .then(function (p) { p.addEventListener("onAbnormalityDetected", () => {}); }).then(done));
assert.equal(registrato, false);
console.log("OK: popup rimosso da initialPlayerResponse, initialData, get_watch");
