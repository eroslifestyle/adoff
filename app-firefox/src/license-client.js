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
    INTEGRITY: "adoffIntegrity",
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
    const raw = JSON.stringify(licData, licData && typeof licData === "object" ? Object.keys(licData).sort() : null);
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
          // Email mascherata dal server (es. "er***@gmail.com"): serve al pannello
          // per far riconoscere l'account. Senza questo campo la riga "Account"
          // restava vuota anche con licenza valida.
          email: data.email || null,
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
          // Email mascherata dal server (es. "er***@gmail.com"): serve al pannello
          // per far riconoscere l'account. Senza questo campo la riga "Account"
          // restava vuota anche con licenza valida.
          email: data.email || null,
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
      // L'utente mantiene lo stato cache esistente (validateOnline gira solo
      // su richiesta della UI, mai come gate: non impatta l'UX).
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
    activate,
    deactivate,
    validateOnline,
    getLicense,
  };
})();
