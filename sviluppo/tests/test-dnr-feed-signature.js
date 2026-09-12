#!/usr/bin/env node
/**
 * Test del feed regole remoto: firma ECDSA P-256, validazione temporale,
 * monotonia versione, key rotation, allowlist azioni, apply a due rami
 * (quota reale + rollback). Esercita il modulo REALE dell'estensione
 * (app/src/rules-feed-verify.js).
 *
 * Uso: node sviluppo/tests/test-dnr-feed-signature.js
 * Chiavi: SOLO di test, generate a runtime con WebCrypto.
 */
"use strict";

const assert = require("assert");
const { webcrypto } = require("crypto");
const path = require("path");

// Il modulo usa atob/crypto.subtle → inietta i globali del runtime Node
if (!globalThis.atob) globalThis.atob = (s) => Buffer.from(s, "base64").toString("binary");
if (!globalThis.crypto) Object.defineProperty(globalThis, "crypto", { value: webcrypto });

const feed = require(path.join(__dirname, "..", "..", "app", "src", "rules-feed-verify.js"));

const TEST_BASE_ID = 60000;
const TEST_ID_SPAN = 40000;

function signBytesToBase64(bytes) {
  return Buffer.from(bytes).toString("base64");
}

async function makeFeed({ privateKey, payload, now }) {
  // Firma sui soli 5 campi canonici (senza signature), ordine fisso
  const canonical = JSON.stringify({
    version: payload.version,
    issuedAt: payload.issuedAt,
    expiresAt: payload.expiresAt,
    keyId: payload.keyId,
    rules: payload.rules,
  });
  const sig = await webcrypto.subtle.sign(
    { name: "ECDSA", hash: "SHA-256" },
    privateKey,
    new TextEncoder().encode(canonical)
  );
  return { ...payload, signature: signBytesToBase64(new Uint8Array(sig)) };
}

function makeStoreRules(count) {
  // Simula regole vecchie già presenti nel range riservato
  const ids = [];
  for (let i = 0; i < count; i++) ids.push(TEST_BASE_ID + i);
  return ids.map((id) => ({ id, priority: 1, action: { type: "block" }, condition: { urlFilter: "old" + id } }));
}

/** Simula un registro DNR con add/remove fallibili e tracking completo.
 *  initialIds: array di id numerici OPPURE di regole complete (per il test delta). */
function makeFakeDnr(initialIds, failOnAddAtOffset, removeFailures) {
  const rules = initialIds.map((it) => (typeof it === "number" ? { id: it } : { ...it }));
  let addCalls = 0;
  let removeFails = removeFailures || 0; // quante remove ancora devono fallire (transitorio)
  const ops = { addedIds: [], removedIds: [], removedBeforeFullAdd: false, removeCalls: 0 };
  return {
    ops,
    async getDynamicRules() { return rules.map((r) => ({ ...r })); },
    async updateDynamicRules({ addRules, removeRuleIds }) {
      if (removeRuleIds) {
        if (ops.addedIds.length && addCalls < 2 && failOnAddAtOffset !== undefined) {
          // remove invocata prima che tutti gli add siano completati → bug atomicità
          ops.removedBeforeFullAdd = true;
        }
        ops.removeCalls++;
        if (removeFails > 0) { removeFails--; return "simulated remove failure"; }
        for (const id of removeRuleIds) {
          const i = rules.findIndex((r) => r.id === id);
          if (i >= 0) { ops.removedIds.push(id); rules.splice(i, 1); }
        }
      }
      if (addRules) {
        const offset = addCalls * 2; // chunk di test da 2
        if (failOnAddAtOffset !== undefined && offset >= failOnAddAtOffset) {
          addCalls++;
          return "simulated add failure";
        }
        for (const r of addRules) {
          assert(!rules.some((x) => x.id === r.id), "id duplicato durante add: " + r.id);
          rules.push({ ...r });
          ops.addedIds.push(r.id);
        }
        addCalls++;
      }
      return null;
    },
  };
}

async function run() {
  const kp = await webcrypto.subtle.generateKey(
    { name: "ECDSA", namedCurve: "P-256" }, true, ["sign", "verify"]);
  const jwk = await webcrypto.subtle.exportKey("jwk", kp.publicKey);
  const NOW = 1700000000000;
  const goodRule = { action: { type: "block" }, condition: { urlFilter: "||ads.example.com^", resourceTypes: ["script"] } };

  const basePayload = { version: 5, issuedAt: NOW - 1000, expiresAt: NOW + 86400000, keyId: "test-key-1", rules: [goodRule] };
  const verifyOpts = (extra) => ({ publicKeyJwk: jwk, storedVersion: 4, now: NOW, ...extra });

  // 1. Payload valido, fresco, monotono → accettato
  {
    const p = await makeFeed({ privateKey: kp.privateKey, payload: basePayload, now: NOW });
    const r = await feed.verifyRulesFeedSignature(p, verifyOpts());
    assert.deepStrictEqual(r, { ok: true }, "payload valido deve passare: " + JSON.stringify(r));
  }

  // 2. Firma invalida (altra chiave) → rifiutato
  {
    const kp2 = await webcrypto.subtle.generateKey({ name: "ECDSA", namedCurve: "P-256" }, true, ["sign", "verify"]);
    const p = await makeFeed({ privateKey: kp2.privateKey, payload: basePayload, now: NOW });
    const r = await feed.verifyRulesFeedSignature(p, verifyOpts());
    assert.strictEqual(r.ok, false, "firma con chiave sbagliata deve fallire");
    assert.ok(/firma/.test(r.error));
  }

  // 3. Payload manomesso (regola cambiata dopo la firma) → rifiutato
  {
    const p = await makeFeed({ privateKey: kp.privateKey, payload: basePayload, now: NOW });
    p.rules = [{ action: { type: "block" }, condition: { urlFilter: "||evil.example^" } }];
    const r = await feed.verifyRulesFeedSignature(p, verifyOpts());
    assert.strictEqual(r.ok, false, "payload manomesso deve fallire");
  }

  // 4. expiresAt scaduto → rifiutato
  {
    const p = await makeFeed({ privateKey: kp.privateKey, payload: { ...basePayload, expiresAt: NOW - 1 }, now: NOW });
    const r = await feed.verifyRulesFeedSignature(p, verifyOpts());
    assert.strictEqual(r.ok, false);
    assert.ok(/scadut/.test(r.error), "errore deve menzionare scadenza");
  }

  // 5. version <= storedVersion (replay/rollback) → rifiutato
  for (const v of [4, 3, 0]) {
    const p = await makeFeed({ privateKey: kp.privateKey, payload: { ...basePayload, version: v }, now: NOW });
    const r = await feed.verifyRulesFeedSignature(p, verifyOpts());
    assert.strictEqual(r.ok, false, "version " + v + " <= 4 deve fallire");
    assert.ok(/monoton|versione/.test(r.error));
  }

  // 5b. Stato resettato (storedVersion assente → baseline 0): version 1 passa, version 0 no
  {
    const p1 = await makeFeed({ privateKey: kp.privateKey, payload: { ...basePayload, version: 1 }, now: NOW });
    const r1 = await feed.verifyRulesFeedSignature(p1, { publicKeyJwk: jwk, now: NOW }); // storedVersion assente = reset
    assert.strictEqual(r1.ok, true, "dopo reset, primo feed valido (version 1) deve passare");
    const p0 = await makeFeed({ privateKey: kp.privateKey, payload: { ...basePayload, version: 0 }, now: NOW });
    const r0 = await feed.verifyRulesFeedSignature(p0, { publicKeyJwk: jwk, now: NOW });
    assert.strictEqual(r0.ok, false, "version 0 non puo' mai essere un primo feed valido");
  }

  // 6. Campi mancanti → rifiutato
  for (const key of ["version", "issuedAt", "expiresAt", "keyId", "rules", "signature"]) {
    const p = { ...basePayload };
    delete p[key];
    const r = await feed.verifyRulesFeedSignature(p, verifyOpts());
    assert.strictEqual(r.ok, false, "payload senza " + key + " deve fallire");
  }

  // 7. Allowlist: redirect e modifyHeaders → rifiutati; main_frame senza dominio → rifiutato
  for (const badRule of [
    { action: { type: "redirect", redirect: { url: "https://evil.example" } }, condition: { urlFilter: "x" } },
    { action: { type: "modifyHeaders" }, condition: { urlFilter: "x" } },
    { action: { type: "block" }, condition: { urlFilter: "x", resourceTypes: ["main_frame"] } },
  ]) {
    const p = await makeFeed({ privateKey: kp.privateKey, payload: { ...basePayload, rules: [badRule] }, now: NOW });
    const r = await feed.verifyRulesFeedSignature(p, verifyOpts());
    assert.strictEqual(r.ok, false, "regola non ammessa deve rifiutare il feed: " + JSON.stringify(badRule.action));
  }

  // 8. Chiave pubblica non configurata (placeholder) → rifiuto chiaro
  {
    const p = await makeFeed({ privateKey: kp.privateKey, payload: basePayload, now: NOW });
    const r = await feed.verifyRulesFeedSignature(p, { publicKeyJwk: null, storedVersion: 4, now: NOW });
    assert.strictEqual(r.ok, false);
    assert.ok(/non configurata/.test(r.error));
  }

  // 9. Apply Ramo A OK: differenziale, vecchi sostituiti, nuova versione applicata
  {
    const dnr = makeFakeDnr(makeStoreRules(3).map((r) => r.id));
    const payload = { ...basePayload, rules: [goodRule, goodRule] };
    const res = await feed.applyAtomic(payload, {
      baseId: TEST_BASE_ID, idSpan: TEST_ID_SPAN, maxRules: 4900, realQuota: 30000, chunkSize: 2,
      getDynamicRules: () => dnr.getDynamicRules(),
      updateDynamicRules: dnr.updateDynamicRules,
    });
    assert.strictEqual(res.ok, true, "apply deve riuscire: " + res.error);
    assert.strictEqual(res.branch, "A");
    assert.strictEqual(res.applied, 2);
    const after = await dnr.getDynamicRules();
    assert.strictEqual(after.length, 2, "le 3 regole vecchie sostituite da 2 nuove");
    assert.ok(after.every((r) => r.condition), "regole ricostruite safe");
  }

  // 10. Fallimento add a metà: rollback dei parziali, ruleset precedente intatto
  {
    const oldRules = makeStoreRules(3);
    const dnr = makeFakeDnr(oldRules.map((r) => r.id), 2); // fallisce al 2° chunk (da 2)
    const payload = { ...basePayload, rules: [goodRule, goodRule, goodRule] };
    const res = await feed.applyAtomic(payload, {
      baseId: TEST_BASE_ID, idSpan: TEST_ID_SPAN, maxRules: 4900, realQuota: 30000, chunkSize: 2,
      getDynamicRules: () => dnr.getDynamicRules(),
      updateDynamicRules: dnr.updateDynamicRules,
    });
    assert.strictEqual(res.ok, false, "apply deve fallire");
    const oldIds = oldRules.map((r) => r.id);
    assert.ok(dnr.ops.removedIds.every((id) => !oldIds.includes(id)),
      "nessuna regola vecchia rimossa dopo un add fallito");
    assert.strictEqual(dnr.ops.removedBeforeFullAdd, false);
    const after = await dnr.getDynamicRules();
    assert.deepStrictEqual(after.map((r) => r.id).sort((a, b) => a - b), oldRules.map((r) => r.id).sort((a, b) => a - b),
      "il ruleset precedente deve restare intatto (rollback dei parziali)");
  }

  // 11. sanitizeRemoteRule: condition vuota e regola malformata scartate
  assert.strictEqual(feed.sanitizeRemoteRule(null, 1), null);
  assert.strictEqual(feed.sanitizeRemoteRule({ action: { type: "block" } }, 1), null);
  assert.strictEqual(feed.sanitizeRemoteRule({ action: { type: "block" }, condition: {} }, 1), null);

  // 12. Quota quasi satura → Ramo A applica correttamente (headroom sufficiente)
  {
    const dnr = makeFakeDnr(makeStoreRules(100).map((r) => r.id));
    // 30.000 quota reale, 100 altre regole fuori range → headroom 29.900
    const payload = { ...basePayload, rules: Array(200).fill(goodRule) };
    const res = await feed.applyAtomic(payload, {
      baseId: TEST_BASE_ID, idSpan: TEST_ID_SPAN, maxRules: 4900, realQuota: 30100, chunkSize: 50,
      getDynamicRules: () => dnr.getDynamicRules(),
      updateDynamicRules: dnr.updateDynamicRules,
    });
    assert.strictEqual(res.ok, true, "Ramo A con headroom sufficiente: " + res.error);
    const after = await dnr.getDynamicRules();
    assert.strictEqual(after.length, 200, "100 vecchie sostituite da 200 nuove");
  }

  // 13. Range ID completamente saturo → fallimento esplicito, nessuna modifica
  {
    // 40.000 regole nel range = idSpan satura: il feed chiede regole nuove
    const satIds = [];
    for (let i = 0; i < TEST_ID_SPAN; i++) satIds.push(TEST_BASE_ID + i);
    const dnr = makeFakeDnr(satIds);
    const payload = { ...basePayload, rules: Array(5).fill({ ...goodRule, condition: { urlFilter: "||brandnew" + Date.now() + ".example^" } }) };
    const res = await feed.applyAtomic(payload, {
      baseId: TEST_BASE_ID, idSpan: TEST_ID_SPAN, maxRules: 4900, realQuota: 100000, chunkSize: 2,
      getDynamicRules: () => dnr.getDynamicRules(),
      updateDynamicRules: dnr.updateDynamicRules,
    });
    assert.strictEqual(res.ok, false, "range saturo deve fallire esplicitamente");
    assert.strictEqual(dnr.ops.addedIds.length, 0, "nessun add eseguito");
    assert.strictEqual(dnr.ops.removedIds.length, 0, "nessuna remove eseguita");
    assert.strictEqual((await dnr.getDynamicRules()).length, TEST_ID_SPAN, "ruleset intatto");
  }

  // 14. Boundary esatto: ultimo ID valido baseId+idSpan-1 usato, mai baseId+idSpan
  {
    // Range con un solo id libero: proprio l'ultimo (baseId+idSpan-1)
    const ids = [];
    for (let i = 0; i < TEST_ID_SPAN - 1; i++) ids.push(TEST_BASE_ID + i);
    const dnr = makeFakeDnr(ids);
    const payload = { ...basePayload, rules: [goodRule] };
    const res = await feed.applyAtomic(payload, {
      baseId: TEST_BASE_ID, idSpan: TEST_ID_SPAN, maxRules: 4900, realQuota: 100000, chunkSize: 10,
      getDynamicRules: () => dnr.getDynamicRules(),
      updateDynamicRules: dnr.updateDynamicRules,
    });
    assert.strictEqual(res.ok, true, "l'ultimo id libero nel range deve essere usabile: " + res.error);
    const after = await dnr.getDynamicRules();
    const maxId = Math.max(...after.map((r) => r.id));
    assert.strictEqual(maxId, TEST_BASE_ID + TEST_ID_SPAN - 1, "l'id allocato e' l'ultimo valido del range");
    assert.ok(maxId < TEST_BASE_ID + TEST_ID_SPAN, "mai un id >= baseId+idSpan");
  }

  // 15. Scenario del brief: 30.000 vecchie + 29.900 nuove, quota reale → Ramo B (rifiuto)
  {
    const oldIds = [];
    for (let i = 0; i < 30000; i++) oldIds.push(TEST_BASE_ID + i);
    const dnr = makeFakeDnr(oldIds);
    const payload = { ...basePayload, rules: Array(29900).fill(goodRule) };
    const res = await feed.applyAtomic(payload, {
      baseId: TEST_BASE_ID, idSpan: TEST_ID_SPAN, maxRules: 30000, realQuota: 30000, chunkSize: 2000,
      getDynamicRules: () => dnr.getDynamicRules(),
      updateDynamicRules: dnr.updateDynamicRules,
    });
    assert.strictEqual(res.ok, false, "quota insufficiente deve rifiutare (Ramo B)");
    assert.strictEqual(res.reason, "quota");
    assert.ok(/quota insufficiente/.test(res.error));
    assert.strictEqual(dnr.ops.addedIds.length, 0, "zero add (zero modifiche)");
    assert.strictEqual(dnr.ops.removedIds.length, 0, "zero remove");
    assert.strictEqual((await dnr.getDynamicRules()).length, 30000, "feed precedente intatto");
  }

  // 16. Remove fallita dopo add riuscito → rollback COMPLETO (vecchie intatte, zero nuove)
  // NB: il fallimento e' transitorio (1 remove fallisce, la rollback remove
  // riesce) — simula un errore DNR puntuale tipo QUOTA, non un registro rotto.
  {
    const oldRules = makeStoreRules(3);
    const dnr = makeFakeDnr(oldRules.map((r) => r.id), undefined, 1); // la 1a remove fallisce
    const payload = { ...basePayload, rules: [goodRule, goodRule] };
    const res = await feed.applyAtomic(payload, {
      baseId: TEST_BASE_ID, idSpan: TEST_ID_SPAN, maxRules: 4900, realQuota: 30000, chunkSize: 2,
      getDynamicRules: () => dnr.getDynamicRules(),
      updateDynamicRules: dnr.updateDynamicRules,
    });
    assert.strictEqual(res.ok, false, "apply deve fallire dopo remove fallita");
    assert.ok(/rollback/.test(res.error));
    const after = await dnr.getDynamicRules();
    const oldIdSet = new Set(oldRules.map((r) => r.id));
    for (const r of after) {
      assert.ok(oldIdSet.has(r.id), "restano SOLO le vecchie regole, non id nuovi: " + r.id);
    }
    assert.strictEqual(after.length, oldRules.length, "count identico al feed precedente (rollback completo)");
  }

  // 17. Doppia applicazione stesso feed (stessa versione) → rifiutata, nessuna modifica
  {
    const p = await makeFeed({ privateKey: kp.privateKey, payload: basePayload, now: NOW });
    const first = await feed.verifyRulesFeedSignature(p, verifyOpts());
    assert.strictEqual(first.ok, true);
    const second = await feed.verifyRulesFeedSignature(p, verifyOpts({ storedVersion: 5 }));
    assert.strictEqual(second.ok, false, "stessa versione applicata 2 volte = non monotona");
    assert.ok(/monoton|versione/.test(second.error));
  }

  // 18. keyId sconosciuto (mappa chiavi senza quel keyId) → rifiutato
  {
    const p = await makeFeed({ privateKey: kp.privateKey, payload: basePayload, now: NOW });
    const r = await feed.verifyRulesFeedSignature(p, {
      keys: { "altra-chiave": { jwk, status: "active" } },
      storedVersion: 4, now: NOW,
    });
    assert.strictEqual(r.ok, false);
    assert.ok(/sconosciuto/.test(r.error));
  }

  // 19. Key rotation: active e deprecated verificano, chiave assente no
  {
    const kpNew = await webcrypto.subtle.generateKey({ name: "ECDSA", namedCurve: "P-256" }, true, ["sign", "verify"]);
    const jwkNew = await webcrypto.subtle.exportKey("jwk", kpNew.publicKey);
    const keys = {
      "test-key-1": { jwk, status: "deprecated" },
      "test-key-2": { jwk: jwkNew, status: "active" },
    };
    const pOld = await makeFeed({ privateKey: kp.privateKey, payload: basePayload, now: NOW });
    const rOld = await feed.verifyRulesFeedSignature(pOld, { keys, storedVersion: 4, now: NOW });
    assert.strictEqual(rOld.ok, true, "chiave deprecated ancora accettata (grace period)");
    const pNew = await makeFeed({ privateKey: kpNew.privateKey, payload: { ...basePayload, keyId: "test-key-2" }, now: NOW });
    const rNew = await feed.verifyRulesFeedSignature(pNew, { keys, storedVersion: 4, now: NOW });
    assert.strictEqual(rNew.ok, true, "chiave active accettata");
    const pGhost = await makeFeed({ privateKey: kpNew.privateKey, payload: { ...basePayload, keyId: "chiave-rimossa" }, now: NOW });
    const rGhost = await feed.verifyRulesFeedSignature(pGhost, { keys, storedVersion: 4, now: NOW });
    assert.strictEqual(rGhost.ok, false, "keyId rimosso dalla mappa = rifiutato");
  }

  // 20. issuedAt nel futuro oltre MAX_CLOCK_SKEW_MS → rifiutato; entro → accettato
  {
    const skew = feed.MAX_CLOCK_SKEW_MS;
    const pFuture = await makeFeed({ privateKey: kp.privateKey, payload: { ...basePayload, issuedAt: NOW + skew + 1 }, now: NOW });
    const rFuture = await feed.verifyRulesFeedSignature(pFuture, verifyOpts());
    assert.strictEqual(rFuture.ok, false, "issuedAt oltre lo skew deve essere rifiutato");
    assert.ok(/futuro|skew/.test(rFuture.error));
    const pOk = await makeFeed({ privateKey: kp.privateKey, payload: { ...basePayload, issuedAt: NOW + skew - 1 }, now: NOW });
    const rOk = await feed.verifyRulesFeedSignature(pOk, verifyOpts());
    assert.strictEqual(rOk.ok, true, "issuedAt entro lo skew accettato");
  }

  // 21. expiresAt - issuedAt oltre MAX_FEED_AGE_MS → rifiutato; sotto → accettato
  {
    const maxAge = feed.MAX_FEED_AGE_MS;
    const pLong = await makeFeed({ privateKey: kp.privateKey, payload: { ...basePayload, issuedAt: NOW, expiresAt: NOW + maxAge + 1 }, now: NOW });
    const rLong = await feed.verifyRulesFeedSignature(pLong, verifyOpts());
    assert.strictEqual(rLong.ok, false, "durata oltre MAX_FEED_AGE_MS rifiutata");
    assert.ok(/durata/.test(rLong.error));
    const pFine = await makeFeed({ privateKey: kp.privateKey, payload: { ...basePayload, issuedAt: NOW, expiresAt: NOW + maxAge }, now: NOW });
    const rFine = await feed.verifyRulesFeedSignature(pFine, verifyOpts());
    assert.strictEqual(rFine.ok, true, "durata esattamente MAX_FEED_AGE_MS accettata");
  }

  // 22. expiresAt <= issuedAt → rifiutato (anche se expiresAt nel futuro)
  {
    const p = await makeFeed({ privateKey: kp.privateKey, payload: { ...basePayload, issuedAt: NOW + 10000, expiresAt: NOW + 5000 }, now: NOW });
    const r = await feed.verifyRulesFeedSignature(p, verifyOpts());
    assert.strictEqual(r.ok, false);
    assert.ok(/expiresAt <= issuedAt/.test(r.error));
  }

  // 23. Delta: regole identiche NON ritoccate (nessun add/remove per il rame invariato)
  {
    const dnr = makeFakeDnr(makeStoreRules(3)); // regole COMPLETE (con body) per il match del delta
    // Feed = stesso body delle vecchie + 1 nuova → toAdd solo la nuova
    const oldBody = { action: { type: "block" }, condition: { urlFilter: "old" + TEST_BASE_ID } };
    const payload = { ...basePayload, rules: [oldBody, goodRule] };
    const res = await feed.applyAtomic(payload, {
      baseId: TEST_BASE_ID, idSpan: TEST_ID_SPAN, maxRules: 4900, realQuota: 30000, chunkSize: 10,
      getDynamicRules: () => dnr.getDynamicRules(),
      updateDynamicRules: dnr.updateDynamicRules,
    });
    assert.strictEqual(res.ok, true, "delta apply: " + res.error);
    assert.strictEqual(dnr.ops.addedIds.length, 1, "solo 1 add (le 2 identiche restano)");
    assert.strictEqual(dnr.ops.removedIds.length, 2, "solo 2 remove (le non matchate)");
  }

  console.log("TUTTI I TEST PASSATI (23 gruppi, modulo reale rules-feed-verify.js)");
}

run().catch((e) => { console.error("TEST FALLITO:", e.message); process.exit(1); });
