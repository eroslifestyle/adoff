/**
 * AdOff — License Client
 * Validazione licenze proprietaria.
 * Doppia validazione: offline (HMAC) + online (API server).
 * Integrity check anti-tampering.
 */
const LicenseClient = (function () {
  "use strict";

  // API endpoint
  const API_URL = "https://api.adoff.app";

  // Intervallo ri-validazione: 24h (era 7gg — troppo permissivo per licenze eliminate dall'admin)
  const REVALIDATE_INTERVAL = 24 * 60 * 60 * 1000;

  // Errori server che indicano licenza definitivamente non valida → invalidare cache.
  // NB: "Device limit reached" NON e' qui (l'utente puo' rimuovere device e riprovare).
  const FATAL_LICENSE_ERRORS = new Set([
    "License not found",
    "License revoked",
    "License expired",
    "Device deactivated",
    "Invalid signature",
    "Invalid expiry",
  ]);

  // Durata trial — deve coincidere col server (TRIAL_DURATION_MS nel worker).
  const TRIAL_DURATION_MS = 30 * 24 * 60 * 60 * 1000;
  const TRIAL_MARGIN_MS = 72 * 60 * 60 * 1000; // 3g di tolleranza per il cap ottimistico

  // Chiave PUBBLICA ECDSA P-256 per verificare i token trial firmati dal server.
  // La privata vive SOLO nel Worker (env.ADOFF_TRIAL_PRIVKEY). Avere questa
  // pubblica NON permette di forgiare token con più giorni di trial.
  const TRIAL_PUBKEY_JWK = {
    kty: "EC", crv: "P-256",
    x: "FnIroHHVzo3v01gENPaA2U70c58sduDD6hGS0EhCATc",
    y: "tAzRBzVK1O8ul76s2euNrqV0L4f1qmEtvcKB_HqpfrY",
  };

  // Storage keys
  const STORAGE = {
    LICENSE: "adoffLicense",
    TRIAL_END: "adoffTrialEnd",
    REFERRAL_DAYS: "adoffReferralDays",
    TRIAL_EXPIRED: "adoffTrialExpired",
    INTEGRITY: "adoffIntegrity",
    TRIAL_TOKEN: "adoffTrialToken",   // token firmato dal server (autorità)
    TRIAL_START: "adoffTrialStart",   // trial_start dal server (per display)
    TRIAL_SEEN: "adoffTrialSeen",     // max now osservato (guardia clock-rollback)
    DEVICE_ID: "adoffDeviceId",
  };

  // =============================================
  // INTEGRITY CHECK (anti-tampering)
  // =============================================

  /**
   * Genera un hash semplice per verificare che i dati license
   * non siano stati modificati manualmente via DevTools.
   * NON e' crittografia — e' una barriera per utenti non tecnici.
   * La vera protezione e' la validazione server-side.
   */
  function computeIntegrity(licData) {
    const raw = JSON.stringify(licData);
    let hash = 0x811c9dc5; // FNV offset basis
    for (let i = 0; i < raw.length; i++) {
      hash ^= raw.charCodeAt(i);
      hash = Math.imul(hash, 0x01000193); // FNV prime
    }
    // Mescola con un salt fisso (offuscato in produzione)
    hash = ((hash >>> 0) ^ 0x5f3759df).toString(36);
    return "ao_" + hash;
  }

  /**
   * Verifica che la licenza in storage non sia stata alterata.
   * Se l'integrity non corrisponde, forza ri-validazione online.
   */
  function verifyIntegrity(licData, storedHash) {
    if (!licData || !licData.valid) return true; // Free/invalid non serve check
    if (!storedHash) return false; // Manca l'hash — probabilmente manomesso
    return computeIntegrity(licData) === storedHash;
  }

  // =============================================
  // TRIAL — server-anchored, verifica firma ECDSA P-256
  // =============================================
  // L'autorità del trial è il server (tabella D1 `trials`). Il client riceve un
  // token firmato e ne verifica la firma con la chiave pubblica embeddata: la
  // scadenza non è falsificabile via DevTools/storage. Lo storage locale è solo
  // cache di display + fallback ottimistico (limitato a una finestra di 30g).

  function b64uToBytes(s) {
    s = s.replace(/-/g, "+").replace(/_/g, "/");
    while (s.length % 4) s += "=";
    const bin = atob(s);
    const out = new Uint8Array(bin.length);
    for (let i = 0; i < bin.length; i++) out[i] = bin.charCodeAt(i);
    return out;
  }

  let _trialPubKeyPromise = null;
  function importTrialPubKey() {
    if (!_trialPubKeyPromise) {
      _trialPubKeyPromise = crypto.subtle.importKey(
        "jwk", TRIAL_PUBKEY_JWK,
        { name: "ECDSA", namedCurve: "P-256" }, false, ["verify"]
      );
    }
    return _trialPubKeyPromise;
  }

  /**
   * Verifica un token trial firmato. Ritorna il payload {deviceId,trialStart,
   * trialEnd,iat,v} solo se la firma è valida E il deviceId coincide con quello
   * locale (impedisce di copiare il token da un'altra installazione).
   * @returns {Promise<object|null>}
   */
  async function verifyTrialToken(token, localDeviceId) {
    if (!token || typeof token !== "string" || token.indexOf(".") < 0) return null;
    try {
      const [payloadB64, sigB64] = token.split(".");
      const pubKey = await importTrialPubKey();
      const ok = await crypto.subtle.verify(
        { name: "ECDSA", hash: "SHA-256" }, pubKey,
        b64uToBytes(sigB64), new TextEncoder().encode(payloadB64)
      );
      if (!ok) return null;
      const payload = JSON.parse(new TextDecoder().decode(b64uToBytes(payloadB64)));
      if (localDeviceId && payload.deviceId && payload.deviceId !== localDeviceId) return null;
      return payload;
    } catch (e) {
      return null;
    }
  }

  function getDeviceId() {
    return new Promise((resolve) => {
      chrome.storage.local.get(STORAGE.DEVICE_ID, (result) => {
        let id = result[STORAGE.DEVICE_ID];
        if (!id) {
          id = (typeof crypto.randomUUID === "function")
            ? crypto.randomUUID()
            : "dev-" + Date.now().toString(36) + Math.random().toString(36).slice(2);
          chrome.storage.local.set({ [STORAGE.DEVICE_ID]: id });
        }
        resolve(id);
      });
    });
  }

  // Fingerprint browser: generato da background.js e salvato in storage da syncTrialBg().
  // Prova ad usarlo; se non esiste ancora (primo avvio prima di background.js),
  // restituisce null — il server tollera l'assenza.
  function getFingerprint() {
    return new Promise((resolve) => {
      chrome.storage.local.get("adoffFingerprint", (result) => {
        resolve(result.adoffFingerprint || null);
      });
    });
  }

  /**
   * Riconcilia il trial col server: ottiene/aggiorna il token firmato.
   * Idempotente: il server fissa trial_start alla prima chiamata e poi ritorna
   * sempre la stessa scadenza. Da chiamare a install, avvio e check periodico.
   * @returns {Promise<{ok:boolean, trialEnd?:number, daysLeft?:number}>}
   */
  async function syncTrial() {
    try {
      const deviceId = await getDeviceId();
      const fingerprint = await getFingerprint();
      const resp = await fetch(API_URL + "/trial", {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({ deviceId, fingerprint }),
      });
      const data = await resp.json();
      if (!data || !data.ok || !data.token) return { ok: false };

      // Verifica la firma del token ricevuto prima di fidarsene.
      const payload = await verifyTrialToken(data.token, deviceId);
      if (!payload) return { ok: false };

      await new Promise((r) => chrome.storage.local.set({
        [STORAGE.TRIAL_TOKEN]: data.token,
        [STORAGE.TRIAL_END]: payload.trialEnd,   // cache display
        [STORAGE.TRIAL_START]: payload.trialStart,
        [STORAGE.TRIAL_SEEN]: Date.now(),
      }, r));

      const now = Date.now();
      return {
        ok: true,
        trialEnd: payload.trialEnd,
        daysLeft: payload.trialEnd > now ? Math.ceil((payload.trialEnd - now) / 86400000) : 0,
      };
    } catch (e) {
      return { ok: false };
    }
  }

  // =============================================
  // STATO LICENZA
  // =============================================

  /**
   * Controlla se l'utente ha accesso Pro/Premium.
   * @returns {Promise<{isPro: boolean, plan: string, tier: string, daysLeft: number|null, source: string}>}
   * tier: "free" | "pro" | "premium"
   */
  async function checkPro() {
    return new Promise((resolve) => {
      chrome.storage.local.get(
        [STORAGE.LICENSE, STORAGE.TRIAL_END, STORAGE.REFERRAL_DAYS,
         STORAGE.TRIAL_EXPIRED, STORAGE.INTEGRITY, "adoffInstallDate",
         STORAGE.TRIAL_TOKEN, STORAGE.TRIAL_SEEN, STORAGE.DEVICE_ID],
        async (result) => {
          const lic = result[STORAGE.LICENSE] || {};
          const trialEnd = result[STORAGE.TRIAL_END] || 0;
          const referralDays = result[STORAGE.REFERRAL_DAYS] || 0;
          const now = Date.now();

          // ponytail: tier derivato dal plan; VPN/Premium gated server-side
          const planToTier = (plan) => {
            if (plan === "premium") return "premium";
            if (["pro", "lifetime", "monthly", "annual", "referral", "trial"].includes(plan)) return "pro";
            return "free";
          };

          // 1. TRIAL — autorità = token firmato dal server (non falsificabile).
          const tokenPayload = result[STORAGE.TRIAL_TOKEN]
            ? await verifyTrialToken(result[STORAGE.TRIAL_TOKEN], result[STORAGE.DEVICE_ID])
            : null;

          if (tokenPayload) {
            if (tokenPayload.trialEnd > now) {
              // Guardia clock-rollback: orologio spostato indietro >2g → ri-sincronizza.
              const seen = result[STORAGE.TRIAL_SEEN] || 0;
              if (now + 2 * 86400000 < seen) {
                syncTrial();
              } else {
                chrome.storage.local.set({ [STORAGE.TRIAL_SEEN]: Math.max(now, seen) });
              }
              const daysLeft = Math.ceil((tokenPayload.trialEnd - now) / 86400000);
              resolve({ isPro: true, plan: "trial", tier: "pro", daysLeft, source: "trial" });
              return;
            }
            // Token valido ma scaduto → marca expired una volta e prosegui alla licenza.
            if (!result[STORAGE.TRIAL_EXPIRED]) {
              chrome.storage.local.set({ [STORAGE.TRIAL_EXPIRED]: true, adoffTrialExpiredAt: now });
            }
          } else {
            // Nessun token valido (primo avvio mai sincronizzato, o token manomesso).
            // Riconcilia col server in background…
            syncTrial();
            // …e nel frattempo applica un fallback OTTIMISTICO limitato: onora il
            // trial locale SOLO entro la finestra legittima (≤3g+margine da ORA).
            // Un valore gonfiato via DevTools oltre il cap viene ignorato → senza
            // token del server non si ottiene mai un trial più lungo di 3 giorni.
            if (!result[STORAGE.TRIAL_EXPIRED] && trialEnd > now
                && trialEnd <= now + TRIAL_DURATION_MS + TRIAL_MARGIN_MS) {
              const daysLeft = Math.ceil((trialEnd - now) / 86400000);
              resolve({ isPro: true, plan: "trial", tier: "pro", daysLeft, source: "trial-optimistic" });
              return;
            }
          }

          // 2. Licenza Pro/Lifetime valida?
          const isValidPlan = ["pro", "lifetime", "monthly", "annual", "premium"].includes(lic.plan);
          if (lic.valid && isValidPlan) {
            // Integrity check — la licenza e' stata manomessa?
            const integrityOk = verifyIntegrity(lic, result[STORAGE.INTEGRITY]);
            if (!integrityOk) {
              // Forza ri-validazione online immediata
              if (lic.rawKey) {
                validateOnline(lic.rawKey).then((onlineResult) => {
                  if (onlineResult.valid) {
                    resolve({ isPro: true, plan: lic.plan, tier: planToTier(lic.plan), daysLeft: null, source: "revalidated" });
                  } else {
                    // Licenza manomessa e non valida server-side
                    saveLicense({ valid: false, plan: "tampered", lastValidated: now });
                    chrome.storage.local.remove(STORAGE.INTEGRITY);
                    resolve({ isPro: false, plan: "free", tier: "free", daysLeft: 0, source: "tamper-revoked" });
                  }
                }).catch(() => {
                  // Offline — non diamo il beneficio del dubbio se l'integrity e' rotta
                  resolve({ isPro: false, plan: "free", tier: "free", daysLeft: 0, source: "integrity-fail-offline" });
                });
                return;
              }
              // Nessuna rawKey — sicuramente manomesso
              resolve({ isPro: false, plan: "free", tier: "free", daysLeft: 0, source: "tamper-no-key" });
              return;
            }

            // Scadenza locale
            if (lic.expires && lic.expires < now / 1000) {
              resolve({ isPro: false, plan: "expired", tier: "free", daysLeft: 0, source: "cache", wasTrialUser: true });
              return;
            }

            // Ri-validazione periodica
            const lastCheck = lic.lastValidated || 0;
            if (now - lastCheck > REVALIDATE_INTERVAL) {
              validateOnline(lic.rawKey).catch(() => {});
            }

            const daysLeft = lic.expires ? Math.ceil((lic.expires * 1000 - now) / 86400000) : null;
            resolve({ isPro: true, plan: lic.plan, tier: planToTier(lic.plan), daysLeft, source: "cache" });
            return;
          }

          // 3. Giorni referral accumulati?
          if (referralDays > 0) {
            const referralEnd = (result[STORAGE.TRIAL_END] || 0) + referralDays * 86400000;
            if (referralEnd > now) {
              const daysLeft = Math.ceil((referralEnd - now) / 86400000);
              resolve({ isPro: true, plan: "referral", tier: "pro", daysLeft, source: "referral" });
              return;
            }
          }

          // 4. Trial scaduto — segna come expired (una sola volta)
          if (trialEnd > 0 && trialEnd <= now && !result[STORAGE.TRIAL_EXPIRED]) {
            chrome.storage.local.set({
              [STORAGE.TRIAL_EXPIRED]: true,
              adoffTrialExpiredAt: now,
            });
          }

          // 5. Free
          const wasTrialUser = trialEnd > 0;
          resolve({ isPro: false, plan: "free", tier: "free", daysLeft: 0, source: "none", wasTrialUser });
        }
      );
    });
  }

  // =============================================
  // ATTIVAZIONE
  // =============================================

  /**
   * Attiva una license key.
   * @param {string} key - La key in formato ADOFF-XXXX-XXXX-XXXX o raw
   * @returns {Promise<{success: boolean, plan?: string, error?: string}>}
   */
  async function activate(key) {
    if (!key || key.trim().length < 10) {
      return { success: false, error: "Key troppo corta" };
    }

    const cleanKey = key.trim();

    try {
      // Include stable device UUID for Netflix-style device tracking
      const { adoffDeviceId } = await new Promise(resolve =>
        chrome.storage.local.get("adoffDeviceId", resolve)
      );
      const resp = await fetch(API_URL + "/activate", {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({ key: cleanKey, deviceId: adoffDeviceId }),
      });

      const data = await resp.json();

      if (data.valid) {
        const licData = {
          valid: true,
          rawKey: cleanKey,
          plan: data.plan,
          expires: data.expires,
          expiresHuman: data.expiresHuman,
          devices: data.devices,
          maxDevices: data.maxDevices,
          lastValidated: Date.now(),
          activatedAt: Date.now(),
        };

        // Salva licenza + integrity hash
        await saveLicense(licData);
        await saveIntegrity(licData);

        return {
          success: true,
          plan: data.plan,
          expires: data.expiresHuman,
        };
      } else {
        return { success: false, error: data.error || "Licenza non valida" };
      }
    } catch (e) {
      return { success: false, error: "Errore di connessione. Controlla la rete e riprova." };
    }
  }

  /**
   * Disattiva la licenza su questo dispositivo.
   */
  async function deactivate() {
    return new Promise((resolve) => {
      chrome.storage.local.get(STORAGE.LICENSE, async (result) => {
        const lic = result[STORAGE.LICENSE];
        if (lic?.rawKey) {
          try {
            await fetch(API_URL + "/deactivate", {
              method: "POST",
              headers: { "Content-Type": "application/json" },
              body: JSON.stringify({ key: lic.rawKey }),
            });
          } catch (_) {}
        }

        chrome.storage.local.remove([STORAGE.LICENSE, STORAGE.INTEGRITY], () => {
          resolve({ success: true });
        });
      });
    });
  }

  // =============================================
  // VALIDAZIONE ONLINE
  // =============================================

  async function validateOnline(rawKey) {
    try {
      const { adoffDeviceId } = await new Promise(resolve =>
        chrome.storage.local.get("adoffDeviceId", resolve)
      );
      const resp = await fetch(API_URL + "/validate", {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({ key: rawKey, deviceId: adoffDeviceId }),
      });

      const data = await resp.json();

      if (data.valid) {
        const licData = {
          valid: true,
          rawKey: rawKey,
          plan: data.plan,
          expires: data.expires,
          expiresHuman: data.expiresHuman,
          devices: data.devices,
          maxDevices: data.maxDevices,
          lastValidated: Date.now(),
        };
        await saveLicense(licData);
        await saveIntegrity(licData);
        return { valid: true };
      } else {
        // Errore fatale (revocata, eliminata, scaduta, device disattivato): invalida cache locale.
        // Esclude errori ritryable (es. "Device limit reached") per non penalizzare l'utente.
        const isFatal = FATAL_LICENSE_ERRORS.has(data.error)
          || data.deactivated || data.deleted || data.expired;
        if (isFatal) {
          let plan = "revoked";
          if (data.deactivated) plan = "deactivated";
          else if (data.deleted || data.error === "License not found") plan = "deleted";
          else if (data.expired || data.error === "License expired") plan = "expired";
          await saveLicense({ valid: false, rawKey, plan, lastValidated: Date.now() });
          chrome.storage.local.remove(STORAGE.INTEGRITY);
          return { valid: false, error: data.error, deactivated: data.deactivated, deleted: data.deleted };
        }
        return { valid: false, error: data.error };
      }
    } catch (e) {
      // EA-8: errore rete — NON promuovere a valid (evita upgrade gratuito).
      // L'utente mantiene lo stato cache esistente; checkPro() ha già risolto prima
      // di chiamare validateOnline in background, quindi valid:null non impatta l'UX.
      return { valid: null, source: "cache-fallback" };
    }
  }

  // =============================================
  // STORAGE HELPERS
  // =============================================

  function saveLicense(licData) {
    return new Promise((resolve) => {
      chrome.storage.local.set({ [STORAGE.LICENSE]: licData }, resolve);
    });
  }

  function saveIntegrity(licData) {
    return new Promise((resolve) => {
      const hash = computeIntegrity(licData);
      chrome.storage.local.set({ [STORAGE.INTEGRITY]: hash }, resolve);
    });
  }

  function getLicense() {
    return new Promise((resolve) => {
      chrome.storage.local.get(STORAGE.LICENSE, (result) => {
        resolve(result[STORAGE.LICENSE] || null);
      });
    });
  }

  // =============================================
  // PUBLIC API
  // =============================================

  return {
    checkPro,
    activate,
    deactivate,
    validateOnline,
    getLicense,
    syncTrial,
    getDeviceId,
  };
})();
