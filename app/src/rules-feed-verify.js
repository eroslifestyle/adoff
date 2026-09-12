/**
 * AdOff — Verifica e apply atomico del feed regole remoto.
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
   * Verifica struttura, scadenza, monotonia della versione e firma ECDSA P-256.
   * Ritorna { ok: true } oppure { ok: false, error }. NON tocca nessuno stato:
   * in caso di fallimento il caller mantiene il ruleset precedente.
   *
   * @param {object} payload Feed scaricato.
   * @param {object} opts { publicKeyJwk, storedVersion, now }
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
    if (expiresAt < now) return err("feed scaduto (expiresAt " + expiresAt + " < " + now + ")");
    const storedVersion = opts && Number.isInteger(opts.storedVersion) ? opts.storedVersion : 0;
    if (version <= storedVersion) return err("versione non monotona (" + version + " <= " + storedVersion + ", replay/rollback)");
    const allow = validateRulesAllowlist(rules);
    if (!allow.ok) return allow;

    const jwk = opts && opts.publicKeyJwk;
    if (!jwk || jwk.kty !== "EC" || !jwk.x || !jwk.y) {
      return err("chiave pubblica non configurata (RULES_FEED_PUBLIC_KEY_JWK placeholder)");
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

  /** Primo ID libero nel range riservato [baseId, baseId+idSpan). */
  function nextFreeId(used, baseId, idSpan) {
    let id = baseId;
    while (id < baseId + idSpan && used.has(id)) id++;
    used.add(id);
    return id;
  }

  /**
   * Apply ATOMICO del feed: aggiunge tutte le nuove regole (ID nuovi, mai
   * confliggenti con i vecchi) in chunk PRIMA di rimuovere qualsiasi regola
   * vecchia. Se un add fallisce, rollback dei chunk parziali gia' aggiunti e
   * NESSUNA remove: il ruleset precedente resta intatto.
   *
   * @param {object} payload Feed gia' verificato (firma/scadenza/monotonia).
   * @param {object} helpers { baseId, idSpan, maxRules, chunkSize,
   *                           getDynamicRules(): Promise<rules[]>,
   *                           updateDynamicRules({addRules?, removeRuleIds?}): Promise<err|null> }
   * @returns {Promise<{ok: boolean, applied?: number, error?: string}>}
   */
  async function applyAtomic(payload, helpers) {
    const baseId = helpers.baseId;
    const idSpan = helpers.idSpan;
    const maxRules = helpers.maxRules;
    const chunkSize = helpers.chunkSize || 2000;
    try {
      const existing = await helpers.getDynamicRules();
      const oldIds = (existing || [])
        .filter((r) => r.id >= baseId && r.id < baseId + idSpan)
        .map((r) => r.id);
      const used = new Set(oldIds);

      const addRules = [];
      let skipped = 0;
      for (const raw of (payload.rules || [])) {
        if (addRules.length >= maxRules) { skipped++; continue; }
        // Sanitize con id placeholder: l'id definitivo lo assegno solo se la regola e' ammessa
        const probe = sanitizeRemoteRule(raw, 0);
        if (!probe) continue;
        probe.id = nextFreeId(used, baseId, idSpan);
        addRules.push(probe);
      }
      if (skipped > 0) {
        console.warn("[adoff] Feed troncato: " + addRules.length + " regole applicabili, " + skipped + " oltre cap");
      }

      // Fase 1: TUTTI gli add (chunked) prima di toccare i vecchi
      const addedIds = [];
      for (let off = 0; off < addRules.length; off += chunkSize) {
        const chunk = addRules.slice(off, off + chunkSize);
        const err = await helpers.updateDynamicRules({ addRules: chunk });
        if (err) {
          // Rollback dei parziali: i vecchi restano, lo stato torna al precedente
          if (addedIds.length) await helpers.updateDynamicRules({ removeRuleIds: addedIds });
          return { ok: false, error: "add fallito: " + err };
        }
        for (const r of chunk) addedIds.push(r.id);
      }

      // Fase 2: add completo riuscito → ora rimuovi i vecchi
      if (oldIds.length) {
        const err = await helpers.updateDynamicRules({ removeRuleIds: oldIds });
        if (err) return { ok: false, error: "remove fallita: " + err, applied: addedIds.length };
      }
      return { ok: true, applied: addedIds.length };
    } catch (e) {
      return { ok: false, error: "applyAtomic: " + (e && e.message ? e.message : String(e)) };
    }
  }

  return {
    SAFE_REMOTE_ACTIONS,
    SAFE_REMOTE_RESOURCE_TYPES,
    sanitizeRemoteRule,
    validateRulesAllowlist,
    verifyRulesFeedSignature,
    applyAtomic,
    canonicalFeedJson,
  };
});
