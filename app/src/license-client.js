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

  // Storage keys
  const STORAGE = {
    LICENSE: "adoffLicense",
    TRIAL_END: "adoffTrialEnd",
    REFERRAL_DAYS: "adoffReferralDays",
    TRIAL_EXPIRED: "adoffTrialExpired",
    INTEGRITY: "adoffIntegrity",
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
  // ANTI-TAMPERING: Trial guard
  // =============================================

  /**
   * Verifica che il trial end non sia stato spostato nel futuro.
   * Confronta con installDate + TRIAL_DAYS.
   */
  function isTrialTampered(trialEnd, installDate) {
    if (!trialEnd || !installDate) return false;
    const maxTrialEnd = installDate + 31 * 24 * 60 * 60 * 1000; // 30gg + 1gg margine
    return trialEnd > maxTrialEnd;
  }

  // =============================================
  // STATO LICENZA
  // =============================================

  /**
   * Controlla se l'utente ha accesso Pro.
   * @returns {Promise<{isPro: boolean, plan: string, daysLeft: number|null, source: string}>}
   */
  async function checkPro() {
    return new Promise((resolve) => {
      chrome.storage.local.get(
        [STORAGE.LICENSE, STORAGE.TRIAL_END, STORAGE.REFERRAL_DAYS,
         STORAGE.TRIAL_EXPIRED, STORAGE.INTEGRITY, "adoffInstallDate"],
        (result) => {
          const lic = result[STORAGE.LICENSE] || {};
          const trialEnd = result[STORAGE.TRIAL_END] || 0;
          const referralDays = result[STORAGE.REFERRAL_DAYS] || 0;
          const installDate = result.adoffInstallDate || 0;
          const now = Date.now();

          // Anti-tampering: trial spostato nel futuro?
          if (trialEnd > now && isTrialTampered(trialEnd, installDate)) {
            // Resetta il trial alla data corretta
            const correctEnd = installDate + 30 * 24 * 60 * 60 * 1000;
            chrome.storage.local.set({ [STORAGE.TRIAL_END]: correctEnd });
            if (correctEnd <= now) {
              resolve({ isPro: false, plan: "free", daysLeft: 0, source: "tamper-detected", wasTrialUser: true });
              return;
            }
          }

          // 1. Trial attivo?
          if (trialEnd > now) {
            const daysLeft = Math.ceil((trialEnd - now) / 86400000);
            resolve({ isPro: true, plan: "trial", daysLeft, source: "trial" });
            return;
          }

          // 2. Licenza Pro/Lifetime valida?
          const isValidPlan = ["pro", "lifetime", "monthly", "annual"].includes(lic.plan);
          if (lic.valid && isValidPlan) {
            // Integrity check — la licenza e' stata manomessa?
            const integrityOk = verifyIntegrity(lic, result[STORAGE.INTEGRITY]);
            if (!integrityOk) {
              // Forza ri-validazione online immediata
              if (lic.rawKey) {
                validateOnline(lic.rawKey).then((onlineResult) => {
                  if (onlineResult.valid) {
                    resolve({ isPro: true, plan: lic.plan, daysLeft: null, source: "revalidated" });
                  } else {
                    // Licenza manomessa e non valida server-side
                    saveLicense({ valid: false, plan: "tampered", lastValidated: now });
                    chrome.storage.local.remove(STORAGE.INTEGRITY);
                    resolve({ isPro: false, plan: "free", daysLeft: 0, source: "tamper-revoked" });
                  }
                }).catch(() => {
                  // Offline — non diamo il beneficio del dubbio se l'integrity e' rotta
                  resolve({ isPro: false, plan: "free", daysLeft: 0, source: "integrity-fail-offline" });
                });
                return;
              }
              // Nessuna rawKey — sicuramente manomesso
              resolve({ isPro: false, plan: "free", daysLeft: 0, source: "tamper-no-key" });
              return;
            }

            // Scadenza locale
            if (lic.expires && lic.expires < now / 1000) {
              resolve({ isPro: false, plan: "expired", daysLeft: 0, source: "cache", wasTrialUser: true });
              return;
            }

            // Ri-validazione periodica
            const lastCheck = lic.lastValidated || 0;
            if (now - lastCheck > REVALIDATE_INTERVAL) {
              validateOnline(lic.rawKey).catch(() => {});
            }

            const daysLeft = lic.expires ? Math.ceil((lic.expires * 1000 - now) / 86400000) : null;
            resolve({ isPro: true, plan: lic.plan, daysLeft, source: "cache" });
            return;
          }

          // 3. Giorni referral accumulati?
          if (referralDays > 0) {
            const referralEnd = (result[STORAGE.TRIAL_END] || 0) + referralDays * 86400000;
            if (referralEnd > now) {
              const daysLeft = Math.ceil((referralEnd - now) / 86400000);
              resolve({ isPro: true, plan: "referral", daysLeft, source: "referral" });
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
          resolve({ isPro: false, plan: "free", daysLeft: 0, source: "none", wasTrialUser });
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
  };
})();
