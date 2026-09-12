#!/usr/bin/env node
/**
 * Test del feed regole remoto: firma ECDSA P-256, scadenza, monotonia
 * versione, allowlist azioni, apply atomico con rollback.
 * Esercita il modulo REALE dell'estensione (app/src/rules-feed-verify.js).
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

/** Simula un registro DNR con add/remove fallibili. */
function makeFakeDnr(initialIds, failOnAddAtOffset) {
  const rules = initialIds.map((id) => ({ id }));
  let addCalls = 0;
  const ops = { addedIds: [], removedIds: [], removedBeforeFullAdd: false };
  return {
    ops,
    async getDynamicRules() { return rules.map((r) => ({ ...r })); },
    async updateDynamicRules({ addRules, removeRuleIds }) {
      if (removeRuleIds) {
        if (ops.addedIds.length && addCalls < 2 && failOnAddAtOffset !== undefined) {
          // remove invocata prima che tutti gli add siano completati → bug atomicità
          ops.removedBeforeFullAdd = true;
        }
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
  const NOW = 1700000000000;
  const goodRule = { action: { type: "block" }, condition: { urlFilter: "||ads.example.com^", resourceTypes: ["script"] } };

  const basePayload = { version: 5, issuedAt: NOW - 1000, expiresAt: NOW + 86400000, keyId: "test-key-1", rules: [goodRule] };

  // 1. Payload valido, fresco, monotono → accettato
  {
    const p = await makeFeed({ privateKey: kp.privateKey, payload: basePayload, now: NOW });
    const r = await feed.verifyRulesFeedSignature(p, {
      publicKeyJwk: await webcrypto.subtle.exportKey("jwk", kp.publicKey),
      storedVersion: 4, now: NOW,
    });
    assert.deepStrictEqual(r, { ok: true }, "payload valido deve passare: " + JSON.stringify(r));
  }

  // 2. Firma invalida (altra chiave) → rifiutato
  {
    const kp2 = await webcrypto.subtle.generateKey({ name: "ECDSA", namedCurve: "P-256" }, true, ["sign", "verify"]);
    const p = await makeFeed({ privateKey: kp2.privateKey, payload: basePayload, now: NOW });
    const r = await feed.verifyRulesFeedSignature(p, {
      publicKeyJwk: await webcrypto.subtle.exportKey("jwk", kp.publicKey),
      storedVersion: 4, now: NOW,
    });
    assert.strictEqual(r.ok, false, "firma con chiave sbagliata deve fallire");
    assert.ok(/firma/.test(r.error));
  }

  // 3. Payload manomesso (regola cambiata dopo la firma) → rifiutato
  {
    const p = await makeFeed({ privateKey: kp.privateKey, payload: basePayload, now: NOW });
    p.rules = [{ action: { type: "block" }, condition: { urlFilter: "||evil.example^" } }];
    const r = await feed.verifyRulesFeedSignature(p, {
      publicKeyJwk: await webcrypto.subtle.exportKey("jwk", kp.publicKey),
      storedVersion: 4, now: NOW,
    });
    assert.strictEqual(r.ok, false, "payload manomesso deve fallire");
  }

  // 4. expiresAt scaduto → rifiutato
  {
    const p = await makeFeed({ privateKey: kp.privateKey, payload: { ...basePayload, expiresAt: NOW - 1 }, now: NOW });
    const r = await feed.verifyRulesFeedSignature(p, {
      publicKeyJwk: await webcrypto.subtle.exportKey("jwk", kp.publicKey),
      storedVersion: 4, now: NOW,
    });
    assert.strictEqual(r.ok, false);
    assert.ok(/scadut/.test(r.error), "errore deve menzionare scadenza");
  }

  // 5. version <= storedVersion (replay/rollback) → rifiutato
  for (const v of [4, 3, 0]) {
    const p = await makeFeed({ privateKey: kp.privateKey, payload: { ...basePayload, version: v }, now: NOW });
    const r = await feed.verifyRulesFeedSignature(p, {
      publicKeyJwk: await webcrypto.subtle.exportKey("jwk", kp.publicKey),
      storedVersion: 4, now: NOW,
    });
    assert.strictEqual(r.ok, false, "version " + v + " <= 4 deve fallire");
    assert.ok(/monoton|versione/.test(r.error));
  }

  // 6. Campi mancanti → rifiutato
  for (const key of ["version", "issuedAt", "expiresAt", "keyId", "rules", "signature"]) {
    const p = { ...basePayload };
    delete p[key];
    const r = await feed.verifyRulesFeedSignature(p, {
      publicKeyJwk: await webcrypto.subtle.exportKey("jwk", kp.publicKey),
      storedVersion: 0, now: NOW,
    });
    assert.strictEqual(r.ok, false, "payload senza " + key + " deve fallire");
  }

  // 7. Allowlist: redirect e modifyHeaders → rifiutati; main_frame senza dominio → rifiutato
  for (const badRule of [
    { action: { type: "redirect", redirect: { url: "https://evil.example" } }, condition: { urlFilter: "x" } },
    { action: { type: "modifyHeaders" }, condition: { urlFilter: "x" } },
    { action: { type: "block" }, condition: { urlFilter: "x", resourceTypes: ["main_frame"] } },
  ]) {
    const p = await makeFeed({ privateKey: kp.privateKey, payload: { ...basePayload, rules: [badRule] }, now: NOW });
    const r = await feed.verifyRulesFeedSignature(p, {
      publicKeyJwk: await webcrypto.subtle.exportKey("jwk", kp.publicKey),
      storedVersion: 4, now: NOW,
    });
    assert.strictEqual(r.ok, false, "regola non ammessa deve rifiutare il feed: " + JSON.stringify(badRule.action));
  }

  // 8. Chiave pubblica non configurata (placeholder) → rifiuto chiaro
  {
    const p = await makeFeed({ privateKey: kp.privateKey, payload: basePayload, now: NOW });
    const r = await feed.verifyRulesFeedSignature(p, { publicKeyJwk: null, storedVersion: 4, now: NOW });
    assert.strictEqual(r.ok, false);
    assert.ok(/non configurata/.test(r.error));
  }

  // 9. Apply atomico OK: i vecchi id vengono sostituiti, nuova versione applicata
  {
    const dnr = makeFakeDnr(makeStoreRules(3).map((r) => r.id));
    const payload = { ...basePayload, rules: [goodRule, goodRule] };
    const res = await feed.applyAtomic(payload, {
      baseId: TEST_BASE_ID, idSpan: TEST_ID_SPAN, maxRules: 4900, chunkSize: 2,
      getDynamicRules: () => dnr.getDynamicRules(),
      updateDynamicRules: dnr.updateDynamicRules,
    });
    assert.strictEqual(res.ok, true, "apply deve riuscire: " + res.error);
    assert.strictEqual(res.applied, 2);
    const after = await dnr.getDynamicRules();
    assert.strictEqual(after.length, 2, "le 3 regole vecchie sostituite da 2 nuove");
    assert.ok(after.every((r) => r.urlFilter !== undefined || r.condition), "regole ricostruite safe");
  }

  // 10. Fallimento add a metà: NESSUNA remove eseguita, ruleset precedente intatto
  {
    const oldRules = makeStoreRules(3);
    const dnr = makeFakeDnr(oldRules.map((r) => r.id), 2); // fallisce al 2° chunk (da 2)
    const payload = { ...basePayload, rules: [goodRule, goodRule, goodRule] };
    const res = await feed.applyAtomic(payload, {
      baseId: TEST_BASE_ID, idSpan: TEST_ID_SPAN, maxRules: 4900, chunkSize: 2,
      getDynamicRules: () => dnr.getDynamicRules(),
      updateDynamicRules: dnr.updateDynamicRules,
    });
    assert.strictEqual(res.ok, false, "apply deve fallire");
    // Le uniche remove ammesse sono il rollback dei chunk NUOVI parziali,
    // mai le regole vecchie (quelle restano finché l'add non è completo).
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

  console.log("TUTTI I TEST PASSATI (11 gruppi, modulo reale rules-feed-verify.js)");
}

run().catch((e) => { console.error("TEST FALLITO:", e.message); process.exit(1); });
