/**
 * AdOff — Verifica e apply del feed regole remoto (strategia a due rami).
 *
 * Modulo condiviso: caricato dai service worker (Chrome/Safari via importScripts,
 * Firefox come primo script di background.scripts) e dal test Node
 * (sviluppo/tests/test-dnr-feed-signature.js) così il test esercita il codice REALE.
 *
 * Formato payload canonico atteso (firmato dal backend):
 *   { version: number, issuedAt: number, expiresAt: number,
 *     keyId: string, rules: [...], signature: string (base64 ECDSA P-256) }
 * Bytes firmati: canonicalFeedJson(payload) — i 5 campi SENZA signature,
 * serializzati ESATTAMENTE in quest'ordine. Vedi docs/RULES-FEED-PROTOCOL.md.
 *
 * Apply: NON esiste "update atomico" DNR vera e propria alla quota reale
 * (l'API non supporta transazioni). Strategia a due rami espliciti:
 *  - Ramo A (headroom sufficiente per la transizione): apply differenziale —
 *    add dei soli cambiamenti, poi remove dei vecchi non piu' presenti; rollback
 *    completo se qualunque fase fallisce.
 *  - Ramo B (headroom insufficiente): rifiuto PRIMA di toccare qualunque regola.
 * Dettagli in docs/RULES-FEED-PROTOCOL.md.
 */
(function (root, factory) {
  const api = factory();
  if (typeof module !== "undefined" && module.exports) module.exports = api;
  root.AdoffRulesFeedVerify = api;
})(typeof globalThis !== "undefined" ? globalThis : self, function () {
  "use strict";

  const SAFE_REMOTE_ACTIONS = ["block", "allow"];
  const SAFE_REMOTE_RESOURCE_TYPES = [
    "main_frame", "sub_frame", "script", "image", "stylesheet",
    "xmlhttprequest", "media", "font", "object", "ping", "websocket", "other",
  ];

  // E) Validazione temporale: issuedAt non oltre questo skews nel futuro...
  const MAX_CLOCK_SKEW_MS = 5 * 60 * 1000; // 5 minuti
  // ...e durata massima di vita del feed (issuedAt → expiresAt).
  const MAX_FEED_AGE_MS = 48 * 60 * 60 * 1000; // 48 ore

  function base64ToBytes(b64) {
    const bin = atob(b64);
    const bytes = new Uint8Array(bin.length);
    for (let i = 0; i < bin.length; i++) bytes[i] = bin.charCodeAt(i);
    return bytes;
  }

  /** Rappresentazione canonica firmata: 5 campi, ordine fisso, senza signature. */
  function canonicalFeedJson(payload) {
    return JSON.stringify({
      version: payload.version,
      issuedAt: payload.issuedAt,
      expiresAt: payload.expiresAt,
      keyId: payload.keyId,
      rules: payload.rules,
    });
  }

  /** Corpo confrontabile di una regola (tutto tranne l'id). */
  function ruleBody(r) {
    return JSON.stringify({ priority: r.priority, action: r.action, condition: r.condition });
  }

  /**
   * Ricostruisce una regola DNR con soli campi safe. Restituisce null se la
   * regola non e' ammissibile (azione non in allowlist, condition vuota,
   * main_frame senza restrizioni di dominio).
   */
  function sanitizeRemoteRule(raw, assignedId) {
    if (!raw || typeof raw !== "object") return null;
    const action = raw.action && typeof raw.action === "object" ? raw.action : null;
    if (!action || !SAFE_REMOTE_ACTIONS.includes(action.type)) return null;
    const cond = raw.condition && typeof raw.condition === "object" ? raw.condition : null;
    if (!cond) return null;
    const safeCond = {};
    if (typeof cond.urlFilter === "string") safeCond.urlFilter = cond.urlFilter.slice(0, 500);
    if (typeof cond.regexFilter === "string") safeCond.regexFilter = cond.regexFilter.slice(0, 500);
    if (Array.isArray(cond.requestDomains)) safeCond.requestDomains = cond.requestDomains.slice(0, 200);
    if (Array.isArray(cond.initiatorDomains)) safeCond.initiatorDomains = cond.initiatorDomains.slice(0, 200);
    if (Array.isArray(cond.resourceTypes)) {
      const rt = cond.resourceTypes.filter((t) => SAFE_REMOTE_RESOURCE_TYPES.includes(t));
      if (rt.length) safeCond.resourceTypes = rt;
    }
    if (!safeCond.urlFilter && !safeCond.regexFilter && !safeCond.requestDomains) return null;
    // main_frame = puo' bloccare la navigazione intera di un sito: esige una
    // restrizione di dominio esplicita, mai un blocco ad ampio raggio.
    if (safeCond.resourceTypes && safeCond.resourceTypes.includes("main_frame") &&
        !safeCond.requestDomains && !safeCond.initiatorDomains) {
      return null;
    }
    const prio = Number.isInteger(raw.priority) ? Math.min(Math.max(raw.priority, 1), 100) : 1;
    return { id: assignedId, priority: prio, action: { type: action.type }, condition: safeCond };
  }

  /** Pre-check su TUTTO il feed: anche una sola regola fuori allowlist rifiuta il payload. */
  function validateRulesAllowlist(rules) {
    for (let i = 0; i < rules.length; i++) {
      const raw = rules[i];
      const action = raw && typeof raw === "object" && raw.action && typeof raw.action === "object"
        ? raw.action : null;
      if (!action) return { ok: false, error: "rule " + i + ": action mancante" };
      if (!SAFE_REMOTE_ACTIONS.includes(action.type)) {
        return { ok: false, error: "rule " + i + ": azione non ammessa '" + String(action.type) + "' (solo block/allow)" };
      }
      const cond = raw && raw.condition && typeof raw.condition === "object" ? raw.condition : null;
      const rt = cond && Array.isArray(cond.resourceTypes) ? cond.resourceTypes : [];
      if (rt.includes("main_frame")) {
        const hasDomains = (Array.isArray(cond.requestDomains) && cond.requestDomains.length > 0) ||
                           (Array.isArray(cond.initiatorDomains) && cond.initiatorDomains.length > 0);
        if (!hasDomains) {
          return { ok: false, error: "rule " + i + ": main_frame senza restrizioni di dominio" };
        }
      }
    }
    return { ok: true };
  }

  /**
   * D) Key rotation: risolve il JWK dal keyId. Con opts.keys (mappa
   * { [keyId]: { jwk, status } }) accetta chiavi "active" e "deprecated"
   * (grace period di rotazione); rifiuta keyId assenti dalla mappa (chiavi
   * rimosse = rifiutate). Senza opts.keys, fallback legacy a opts.publicKeyJwk.
   */
  function resolveKeyJwk(opts, keyId) {
    if (opts && opts.keys && typeof opts.keys === "object") {
      const entry = opts.keys[keyId];
      if (!entry || typeof entry !== "object") {
        return { error: "keyId sconosciuto: '" + keyId + "' (non presente nella mappa chiavi)" };
      }
      if (entry.status !== "active" && entry.status !== "deprecated") {
        return { error: "keyId '" + keyId + "': status non valido '" + String(entry.status) + "'" };
      }
      return { jwk: entry.jwk };
    }
    return { jwk: opts ? opts.publicKeyJwk : null };
  }

  /**
   * Verifica struttura, validita' temporale, monotonia della versione e firma
   * ECDSA P-256. Ritorna { ok: true } oppure { ok: false, error }. NON tocca
   * nessuno stato: in caso di fallimento il caller mantiene il ruleset precedente.
   *
   * Monotonia / reset di stato: se lo storage e' vuoto o mai inizializzato la
   * baseline e' storedVersion = 0, quindi il primo feed valido deve avere
   * version > 0 (version 0 e' rifiutata dalla monotonia). Un reset dello
   * storage riporta la baseline a 0: un feed con version 1 verrebbe riaccettato
   * — comportamento accettato e documentato (il reset e' un'azione locale
   * dell'utente, non un vettore remoto).
   *
   * @param {object} payload Feed scaricato.
   * @param {object} opts { keys | publicKeyJwk, storedVersion, now }
   */
  async function verifyRulesFeedSignature(payload, opts) {
    const now = opts && Number.isInteger(opts.now) ? opts.now : Date.now();
    const err = (m) => ({ ok: false, error: m });
    if (!payload || typeof payload !== "object") return err("payload malformato");
    const { version, issuedAt, expiresAt, keyId, rules, signature } = payload;
    if (!Number.isInteger(version) || version < 0) return err("version malformato");
    if (!Number.isInteger(issuedAt)) return err("issuedAt malformato");
    if (!Number.isInteger(expiresAt)) return err("expiresAt malformato");
    if (typeof keyId !== "string" || !keyId) return err("keyId mancante");
    if (!Array.isArray(rules)) return err("rules non e' un array");
    if (typeof signature !== "string" || !signature) return err("signature mancante");
    if (expiresAt <= issuedAt) return err("expiresAt <= issuedAt");
    if (issuedAt > now + MAX_CLOCK_SKEW_MS) {
      return err("issuedAt troppo nel futuro (clock skew oltre " + MAX_CLOCK_SKEW_MS + "ms)");
    }
    if (expiresAt - issuedAt > MAX_FEED_AGE_MS) {
      return err("durata feed oltre il massimo (" + MAX_FEED_AGE_MS + "ms)");
    }
    if (expiresAt < now) return err("feed scaduto (expiresAt " + expiresAt + " < " + now + ")");
    const storedVersion = opts && Number.isInteger(opts.storedVersion) ? opts.storedVersion : 0;
    if (version <= storedVersion) return err("versione non monotona (" + version + " <= " + storedVersion + ", replay/rollback)");
    const allow = validateRulesAllowlist(rules);
    if (!allow.ok) return allow;

    const keyRes = resolveKeyJwk(opts, keyId);
    if (keyRes.error) return err(keyRes.error);
    const jwk = keyRes.jwk;
    if (!jwk || jwk.kty !== "EC" || !jwk.x || !jwk.y) {
      return err("chiave pubblica non configurata (placeholder jwk: null in RULES_FEED_KEYS)");
    }
    try {
      const key = await crypto.subtle.importKey(
        "jwk", jwk, { name: "ECDSA", namedCurve: "P-256" }, false, ["verify"]);
      const data = new TextEncoder().encode(canonicalFeedJson(payload));
      const valid = await crypto.subtle.verify(
        { name: "ECDSA", hash: "SHA-256" }, key, base64ToBytes(signature), data);
      return valid ? { ok: true } : err("firma non valida");
    } catch (e) {
      return err("crypto: " + (e && e.message ? e.message : String(e)));
    }
  }

  /**
   * B) Primo ID libero in [baseId, baseId+idSpan), o null se il range e' saturo.
   * MAI un id >= baseId+idSpan: il chiamante deve fallire esplicitamente.
   */
  function nextFreeId(used, baseId, idSpan) {
    let id = baseId;
    while (id < baseId + idSpan && used.has(id)) id++;
    if (id >= baseId + idSpan) return null;
    used.add(id);
    return id;
  }

  /**
   * Delta reale tra il nuovo feed sanificato e le regole esistenti nel range.
   * Le regole identiche (stesso corpo) mantengono l'id e NON vengono toccate.
   * L'id nei probe e' un placeholder (0): viene assegnato solo all'add.
   */
  function computeDelta(payloadRules, inRange, maxRules) {
    const used = new Set(inRange.map((r) => r.id));
    const oldByBody = new Map();
    for (const r of inRange) {
      const body = ruleBody(r);
      if (!oldByBody.has(body)) oldByBody.set(body, r.id);
    }
    const newRules = [];
    let skipped = 0;
    for (const raw of (payloadRules || [])) {
      if (newRules.length >= maxRules) { skipped++; continue; }
      const probe = sanitizeRemoteRule(raw, 0);
      if (!probe) continue;
      newRules.push(probe);
    }
    const toAdd = [];
    const matchedOldIds = new Set();
    for (const r of newRules) {
      const body = ruleBody(r);
      const oldId = oldByBody.get(body);
      if (oldId !== undefined && !matchedOldIds.has(oldId)) { matchedOldIds.add(oldId); continue; }
      toAdd.push(r);
    }
    const toRemoveIds = inRange.map((r) => r.id).filter((id) => !matchedOldIds.has(id));
    return { used, toAdd, toRemoveIds, matchedCount: matchedOldIds.size, skipped };
  }

  /**
   * Apply del feed con strategia a due rami (vedi header del file):
   *  - Ramo A: headroom sufficiente per tenere vecchie+nuove durante la
   *    transizione → apply differenziale (add dei cambiamenti in chunk con id
   *    in-range, verifica, poi remove dei vecchi). Add fallito → rollback dei
   *    chunk parziali. Remove fallita dopo add riuscito → rollback COMPLETO
   *    (rimosse anche le regole appena aggiunte): mai vecchie+nuove insieme
   *    come stato finale di errore.
   *  - Ramo B: headroom insufficiente → rifiuto PRIMA di toccare qualunque
   *    regola (reason: "quota"), il feed precedente resta intatto.
   *
   * @param {object} payload Feed gia' verificato (firma/scadenza/monotonia).
   * @param {object} helpers { baseId, idSpan, maxRules, chunkSize,
   *   realQuota (quota REALE del browser, da realDynamicQuota() in background.js),
   *   getDynamicRules(): Promise<rules[]>,
   *   updateDynamicRules({addRules?, removeRuleIds?}): Promise<err|null> }
   * @returns {Promise<{ok: boolean, applied?: number, branch?: string, reason?: string, error?: string}>}
   */
  async function applyAtomic(payload, helpers) {
    const baseId = helpers.baseId;
    const idSpan = helpers.idSpan;
    const chunkSize = helpers.chunkSize || 2000;
    try {
      // A) Quota REALE obbligatoria: senza il numero vero si rifiuta conservativamente
      const realQuota = helpers.realQuota;
      if (!Number.isInteger(realQuota) || realQuota <= 0) {
        return { ok: false, reason: "quota", error: "quota reale non disponibile (realQuota mancante): rifiuto conservativo" };
      }
      const existing = (await helpers.getDynamicRules()) || [];
      const inRange = existing.filter((r) => r.id >= baseId && r.id < baseId + idSpan);
      const otherCount = existing.length - inRange.length;
      const headroom = realQuota - otherCount;
      const delta = computeDelta(payload.rules, inRange, helpers.maxRules);
      if (delta.skipped > 0) {
        console.warn("[adoff] Feed troncato: " + delta.toAdd.length + " regole nuove, " + delta.skipped + " oltre cap");
      }

      // RAMO B: il picco di transizione (vecchie in range + tutte le nuove) non
      // ci sta nel headroom → rifiuto esplicito, zero modifiche.
      const peak = inRange.length + delta.toAdd.length;
      if (peak > headroom) {
        return { ok: false, reason: "quota",
          error: "quota insufficiente per applicare il feed senza gap di sicurezza (headroom " + headroom + ", picco transizione " + peak + ")" };
      }
      const freeIds = idSpan - delta.used.size;
      if (delta.toAdd.length > freeIds) {
        return { ok: false, reason: "ids",
          error: "range id esaurito: servono " + delta.toAdd.length + " nuovi id, liberi " + freeIds };
      }

      // RAMO A: differenziale — prima gli add (id sempre in range), poi le remove
      const addedIds = [];
      const rollbackAdds = async () => {
        if (addedIds.length) await helpers.updateDynamicRules({ removeRuleIds: addedIds });
      };
      for (let off = 0; off < delta.toAdd.length; off += chunkSize) {
        const chunk = delta.toAdd.slice(off, off + chunkSize);
        for (const r of chunk) {
          const id = nextFreeId(delta.used, baseId, idSpan);
          if (id === null) { await rollbackAdds(); return { ok: false, error: "range id esaurito durante l'allocazione" }; }
          r.id = id;
        }
        const err = await helpers.updateDynamicRules({ addRules: chunk });
        if (err) { await rollbackAdds(); return { ok: false, error: "add fallito: " + err }; }
        for (const r of chunk) addedIds.push(r.id);
      }
      if (delta.toRemoveIds.length) {
        const err = await helpers.updateDynamicRules({ removeRuleIds: delta.toRemoveIds });
        if (err) {
          await rollbackAdds();
          return { ok: false, error: "remove fallita (rollback completo eseguito): " + err };
        }
      }
      return { ok: true, branch: "A", applied: delta.matchedCount + delta.toAdd.length };
    } catch (e) {
      return { ok: false, error: "applyAtomic: " + (e && e.message ? e.message : String(e)) };
    }
  }

  return {
    SAFE_REMOTE_ACTIONS,
    SAFE_REMOTE_RESOURCE_TYPES,
    MAX_CLOCK_SKEW_MS,
    MAX_FEED_AGE_MS,
    sanitizeRemoteRule,
    validateRulesAllowlist,
    resolveKeyJwk,
    verifyRulesFeedSignature,
    applyAtomic,
    canonicalFeedJson,
  };
});
