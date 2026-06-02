(function () {
  "use strict";

  // ---- Costanti storage ----
  const STORAGE_ENABLED    = "adoffEnabled";
  const STORAGE_ADS        = "adoffAdsBlocked";
  const STORAGE_REQ        = "adoffReqBlocked";
  const STORAGE_TRIAL_END  = "adoffTrialEnd";
  const STORAGE_WHITELIST  = "adoffWhitelist";
  const STORAGE_SHOW_BADGE   = "adoffShowBadge";
  const STORAGE_SHOW_COUNTER = "adoffShowCounter";
  const TRIAL_DAYS         = 30;

  // Data limite per badge Founding Member (3 mesi dal lancio)
  const FOUNDER_CUTOFF = new Date("2026-07-01T00:00:00Z").getTime();

  // Serializza i read-modify-write del contatore ads: due messaggi concorrenti
  // potrebbero altrimenti leggere lo stesso valore e perdere un incremento.
  let adsWriteChain = Promise.resolve();
  function incrementAdsCounter(count) {
    adsWriteChain = adsWriteChain.then(() => new Promise((resolve) => {
      chrome.storage.local.get(STORAGE_ADS, (result) => {
        chrome.storage.local.set({ [STORAGE_ADS]: (result[STORAGE_ADS] || 0) + count }, resolve);
      });
    }));
    return adsWriteChain;
  }

  // Changelog per versione (ultime 3 voci per popup)
  const CHANGELOGS = {
    "3.1.0": [
      "Sistema referral: invita amici, guadagna Pro gratis",
      "Prompt recensioni intelligente",
      "Badge Founding Member per early adopter",
    ],
    "3.0.0": [
      "Nuovo design completo",
      "Sistema whitelist avanzato con pausa temporanea",
      "Supporto 6 lingue",
    ],
  };

  // ---- Genera codice referral unico (SEC-2: crypto-secure) ----
  function generateReferralCode() {
    const chars = "ABCDEFGHJKLMNPQRSTUVWXYZ23456789";
    const arr = new Uint8Array(5);
    crypto.getRandomValues(arr);
    return "ADO-" + Array.from(arr, (b) => chars[b % chars.length]).join("");
  }

  // ---- Genera UUID stabile per questo dispositivo ----
  function generateDeviceUuid() {
    if (typeof crypto.randomUUID === "function") {
      return crypto.randomUUID();
    }
    // Fallback per ambienti che non supportano randomUUID
    return "xxxxxxxx-xxxx-4xxx-yxxx-xxxxxxxxxxxx".replace(/[xy]/g, (c) => {
      const r = (Math.random() * 16) | 0;
      return (c === "x" ? r : (r & 0x3) | 0x8).toString(16);
    });
  }

  // Genera e persiste l'UUID del dispositivo al primo avvio
  chrome.storage.local.get("adoffDeviceId", (result) => {
    if (!result.adoffDeviceId) {
      chrome.storage.local.set({ adoffDeviceId: generateDeviceUuid() });
    }
  });

  // ---- Validazione licenza (centralizzata) ----
  // Errori server fatali → invalida cache. "Device limit reached" NON e' qui (ritryable).
  const FATAL_LIC_ERRORS = new Set([
    "License not found",
    "License revoked",
    "License expired",
    "Device deactivated",
    "Invalid signature",
    "Invalid expiry",
  ]);

  async function revalidateLicense(reason) {
    return new Promise((resolve) => {
      chrome.storage.local.get(["adoffLicense", "adoffDeviceId"], async (result) => {
        const lic = result.adoffLicense;
        if (!lic?.valid || !lic?.rawKey) { resolve({ skipped: true }); return; }
        try {
          const resp = await fetch("https://api.adoff.app/validate", {
            method: "POST",
            headers: { "Content-Type": "application/json" },
            body: JSON.stringify({ key: lic.rawKey, deviceId: result.adoffDeviceId }),
          });
          const data = await resp.json();
          if (data.valid) {
            // Aggiorna cache (devices/maxDevices possono essere cambiati)
            chrome.storage.local.set({
              adoffLicense: {
                ...lic,
                valid: true,
                plan: data.plan || lic.plan,
                expires: data.expires ?? lic.expires,
                expiresHuman: data.expiresHuman || lic.expiresHuman,
                devices: data.devices ?? lic.devices,
                maxDevices: data.maxDevices ?? lic.maxDevices,
                lastValidated: Date.now(),
              },
            });
            resolve({ valid: true });
            return;
          }
          // Fatal? → invalida cache
          const isFatal = FATAL_LIC_ERRORS.has(data.error)
            || data.deactivated || data.deleted || data.expired;
          if (isFatal) {
            let plan = "revoked";
            if (data.deactivated) plan = "deactivated";
            else if (data.deleted || data.error === "License not found") plan = "deleted";
            else if (data.expired || data.error === "License expired") plan = "expired";
            chrome.storage.local.set({
              adoffLicense: { valid: false, rawKey: lic.rawKey, plan, lastValidated: Date.now() },
            });
            chrome.storage.local.remove("adoffIntegrity");
            resolve({ valid: false, fatal: true, error: data.error, reason });
            return;
          }
          // Errore non fatale (es. Device limit reached) — non tocchiamo cache
          resolve({ valid: false, fatal: false, error: data.error });
        } catch (_) {
          // Errore rete — mantiene cache esistente
          resolve({ valid: null, network: true });
        }
      });
    });
  }

  // 1) Al riavvio del browser
  chrome.runtime.onStartup.addListener(() => {
    revalidateLicense("startup");
  });

  // 2) Daily alarm — controllo periodico anche con browser sempre aperto
  const ALARM_LIC_CHECK = "adoffLicDailyCheck";
  chrome.alarms.get(ALARM_LIC_CHECK, (existing) => {
    if (!existing) {
      // periodInMinutes 1440 = 24h. delayInMinutes 5 per non saturare al boot.
      chrome.alarms.create(ALARM_LIC_CHECK, { delayInMinutes: 5, periodInMinutes: 24 * 60 });
    }
  });

  // ---- Init storage al primo install ----
  chrome.runtime.onInstalled.addListener((details) => {
    chrome.storage.local.get(null, (result) => {
      const defaults = {};
      if (result[STORAGE_ENABLED] === undefined) defaults[STORAGE_ENABLED] = true;
      if (result[STORAGE_ADS]     === undefined) defaults[STORAGE_ADS]     = 0;
      if (result[STORAGE_REQ]     === undefined) defaults[STORAGE_REQ]     = 0;
      if (result[STORAGE_WHITELIST] === undefined) defaults[STORAGE_WHITELIST] = [];

      // Primo install
      if (details.reason === "install") {
        // Trial 30 giorni
        if (result[STORAGE_TRIAL_END] === undefined) {
          defaults[STORAGE_TRIAL_END] = Date.now() + TRIAL_DAYS * 24 * 60 * 60 * 1000;
        }

        // Data installazione (per Founding Member)
        defaults.adoffInstallDate = Date.now();
        defaults.adoffIsFounder = Date.now() < FOUNDER_CUTOFF;

        // Codice referral unico
        if (!result.adoffReferralCode) {
          defaults.adoffReferralCode = generateReferralCode();
          defaults.adoffReferralCount = 0;
          defaults.adoffReferralDays = 0;
          defaults.adoffReferralHistory = [];
        }

        // Init review prompt
        defaults.adoffReviewPromptCount = 0;
        defaults.adoffReviewDismissed = false;
        defaults.adoffReviewDone = false;
        defaults.adoffMilestones = {};
      }

      // Aggiornamento estensione — flag changelog
      if (details.reason === "update") {
        const currentVersion = chrome.runtime.getManifest().version;
        const seenVersions = result.adoffChangelogSeen || [];
        if (!seenVersions.includes(currentVersion) && CHANGELOGS[currentVersion]) {
          defaults.adoffShowChangelog = true;
          defaults.adoffNewVersion = currentVersion;
        }

        // Se non ha ancora installDate (utente pre-esistente), impostala ora
        if (!result.adoffInstallDate) {
          defaults.adoffInstallDate = Date.now();
          defaults.adoffIsFounder = Date.now() < FOUNDER_CUTOFF;
        }

        // Se non ha referral code, generalo
        if (!result.adoffReferralCode) {
          defaults.adoffReferralCode = generateReferralCode();
          defaults.adoffReferralCount = 0;
          defaults.adoffReferralDays = 0;
          defaults.adoffReferralHistory = [];
        }
      }

      if (Object.keys(defaults).length > 0) {
        chrome.storage.local.set(defaults);
      }
    });

    // Apri pagina onboarding al primo install
    if (details.reason === "install") {
      chrome.tabs.create({ url: "src/onboarding.html" });
    }
  });

  // ---- Badge ----
  function formatBadgeCount(n) {
    if (n >= 1000000) return (n / 1000000).toFixed(0) + "M";
    if (n >= 10000) return (n / 1000).toFixed(0) + "K";
    if (n >= 1000) return (n / 1000).toFixed(1) + "K";
    return String(n);
  }

  // showBadge: mostra il badge (ON/OFF stato). showCounter: mostra il numero di ads.
  // Entrambi rispettano le impostazioni in Opzioni (adoffShowBadge default ON, adoffShowCounter default OFF).
  function updateBadge(isEnabled, totalBlocked, showBadge, showCounter) {
    if (showBadge === false) {
      chrome.action.setBadgeText({ text: "" });
      return;
    }
    if (!isEnabled) {
      chrome.action.setBadgeText({ text: "OFF" });
      chrome.action.setBadgeBackgroundColor({ color: "#e74c3c" });
    } else {
      const text = (showCounter && totalBlocked > 0) ? formatBadgeCount(totalBlocked) : "ON";
      chrome.action.setBadgeText({ text });
      chrome.action.setBadgeBackgroundColor({ color: "#6c5ce7" });
    }
    chrome.action.setBadgeTextColor({ color: "#ffffff" });
  }

  function refreshBadge() {
    chrome.storage.local.get(
      [STORAGE_ENABLED, STORAGE_ADS, STORAGE_REQ, STORAGE_SHOW_BADGE, STORAGE_SHOW_COUNTER],
      (result) => {
        const isEnabled = result[STORAGE_ENABLED] !== false;
        const total = (result[STORAGE_ADS] || 0) + (result[STORAGE_REQ] || 0);
        updateBadge(isEnabled, total, result[STORAGE_SHOW_BADGE] !== false, result[STORAGE_SHOW_COUNTER] !== false);
      }
    );
  }

  refreshBadge();

  chrome.storage.onChanged.addListener((changes) => {
    if (changes[STORAGE_ENABLED] || changes[STORAGE_ADS] || changes[STORAGE_REQ] ||
        changes[STORAGE_SHOW_BADGE] || changes[STORAGE_SHOW_COUNTER]) {
      refreshBadge();
      if (changes[STORAGE_ENABLED]) {
        toggleNetworkRules(changes[STORAGE_ENABLED].newValue !== false);
      }
    }
  });

  // ---- Contatore richieste bloccate (MV3-safe: chrome.alarms + getMatchedRules) ----
  const ALARM_FLUSH_REQ = "adoff-flush-req";
  const STORAGE_LAST_CHECK = "adoffLastReqCheck";

  // Rule IDs che sono tracking/analytics, NON ads reali — non contarli nel badge
  // 4: google-analytics, 5: googletagmanager
  // 20-22: facebook pixel/events/signals
  // 80-90: moatads, doubleverify, ias, scorecardresearch, quantserve, hotjar, mixpanel, segment, amplitude, newrelic, sentry
  // 175-176: youtube stats/qoe (analytics, non ads)
  // 180-181, 183: twitter jot/adsct/analytics
  // 190-191: gemius, addthis
  // 211: analytics.tiktok
  const TRACKING_RULE_IDS = new Set([
    4, 5, 20, 21, 22,
    80, 81, 82, 83, 84, 85, 86, 87, 88, 89, 90,
    175, 176, 180, 181, 183,
    190, 191, 211,
  ]);

  // Crea alarm persistente (sopravvive ai restart del SW)
  chrome.alarms.get(ALARM_FLUSH_REQ, (existing) => {
    if (!existing) {
      chrome.alarms.create(ALARM_FLUSH_REQ, { periodInMinutes: 1 });
    }
  });

  // Ad ogni tick, leggi regole matchate dal timestamp dell'ultimo check
  // Conta SOLO le regole che bloccano ads reali (non tracking/analytics)
  chrome.alarms.onAlarm.addListener((alarm) => {
    if (alarm.name === ALARM_LIC_CHECK) {
      revalidateLicense("daily-alarm");
      return;
    }
    if (alarm.name !== ALARM_FLUSH_REQ) return;

    chrome.storage.local.get([STORAGE_ENABLED, STORAGE_REQ, STORAGE_LAST_CHECK], (result) => {
      const lastCheck = result[STORAGE_LAST_CHECK] || 0;
      const now = Date.now();

      // Protezione disattivata: non contare. Avanza comunque il timestamp
      // cosi' il backlog accumulato in OFF non viene conteggiato al re-enable.
      if (result[STORAGE_ENABLED] === false) {
        chrome.storage.local.set({ [STORAGE_LAST_CHECK]: now });
        return;
      }

      chrome.declarativeNetRequest.getMatchedRules(
        { minTimeStamp: lastCheck },
        (details) => {
          const rules = details.rulesMatchedInfo || [];
          const adCount = rules.filter((r) => !TRACKING_RULE_IDS.has(r.rule.ruleId)).length;
          const updates = { [STORAGE_LAST_CHECK]: now };
          if (adCount > 0) {
            updates[STORAGE_REQ] = (result[STORAGE_REQ] || 0) + adCount;
          }
          chrome.storage.local.set(updates);
        }
      );
    });
  });

  // ---- Toggle network rules ----
  function toggleNetworkRules(enabled) {
    if (enabled) {
      chrome.declarativeNetRequest.updateEnabledRulesets({
        enableRulesetIds: ["adblock_rules"],
      });
    } else {
      chrome.declarativeNetRequest.updateEnabledRulesets({
        disableRulesetIds: ["adblock_rules"],
      });
    }
  }

  // ---- IMA SDK redirect rules (Pro/Trial only) ----
  // Regole dinamiche: redirect imasdk verso stub locale.
  // Attivate solo quando l'utente ha Pro o Trial attivo.
  const IMA_REDIRECT_RULES = [
    { id: 50001, priority: 3, action: { type: "redirect", redirect: { extensionPath: "/stubs/google-ima3.js" } }, condition: { urlFilter: "||imasdk.googleapis.com/js/sdkloader/ima3.js", resourceTypes: ["script"] } },
    { id: 50002, priority: 3, action: { type: "redirect", redirect: { extensionPath: "/stubs/google-ima3.js" } }, condition: { urlFilter: "||imasdk.googleapis.com/js/sdkloader/ima3_dai.js", resourceTypes: ["script"] } },
  ];

  function updateImaRules() {
    chrome.storage.local.get(["adoffLicense", "adoffTrialEnd", "adoffIntegrity"], (result) => {
      const lic = result.adoffLicense || {};
      const trialEnd = result.adoffTrialEnd || 0;
      const isPro = lic.type === "pro" || lic.type === "lifetime" || trialEnd > Date.now();

      if (isPro) {
        // Attiva redirect: IMA SDK → stub (ads video neutralizzate)
        chrome.declarativeNetRequest.updateDynamicRules({
          removeRuleIds: [50001, 50002],
          addRules: IMA_REDIRECT_RULES,
        });
      } else {
        // Free: rimuovi redirect (IMA SDK bloccato dalla regola statica 900)
        chrome.declarativeNetRequest.updateDynamicRules({
          removeRuleIds: [50001, 50002],
        });
      }
    });
  }

  // Aggiorna regole IMA all'avvio e quando la licenza cambia
  updateImaRules();
  chrome.storage.onChanged.addListener((changes) => {
    if (changes.adoffLicense || changes.adoffTrialEnd) {
      updateImaRules();
    }
  });

  // ---- Gestione messaggi: whitelist ----
  chrome.runtime.onMessage.addListener((message, sender, sendResponse) => {
    // EA-6: rifiuta messaggi da estensioni esterne o pagine web
    if (sender.id !== chrome.runtime.id) return false;

    // EM-6: incremento atomico contatore ads bloccati (evita race condition in content.js)
    if (message.action === "incrementAdsBlocked") {
      const count = (typeof message.count === "number" && message.count > 0) ? message.count : 0;
      if (count > 0) {
        incrementAdsCounter(count);
      }
      sendResponse({ ok: true });
      return false;
    }

    if (message.action === "addToWhitelist") {
      const domain = message.domain;
      if (!domain) { sendResponse({ ok: false, error: "missing domain" }); return true; }

      chrome.storage.local.get(STORAGE_WHITELIST, (result) => {
        const list = result[STORAGE_WHITELIST] || [];
        if (!list.includes(domain)) {
          list.push(domain);
          chrome.storage.local.set({ [STORAGE_WHITELIST]: list }, () => {
            sendResponse({ ok: true, whitelist: list });
          });
        } else {
          sendResponse({ ok: true, whitelist: list });
        }
      });
      return true; // risposta asincrona
    }

    if (message.action === "removeFromWhitelist") {
      const domain = message.domain;
      if (!domain) { sendResponse({ ok: false, error: "missing domain" }); return true; }

      chrome.storage.local.get(STORAGE_WHITELIST, (result) => {
        const list = (result[STORAGE_WHITELIST] || []).filter((d) => d !== domain);
        chrome.storage.local.set({ [STORAGE_WHITELIST]: list }, () => {
          sendResponse({ ok: true, whitelist: list });
        });
      });
      return true;
    }

    if (message.action === "getWhitelist") {
      chrome.storage.local.get(STORAGE_WHITELIST, (result) => {
        sendResponse({ ok: true, whitelist: result[STORAGE_WHITELIST] || [] });
      });
      return true;
    }

    if (message.action === "isWhitelisted") {
      const domain = message.domain;
      if (!domain) { sendResponse({ ok: false, whitelisted: false }); return true; }

      chrome.storage.local.get(STORAGE_WHITELIST, (result) => {
        const list = result[STORAGE_WHITELIST] || [];
        // EA-7: matching esatto o subdomain — evita false positive bidirezionali
        const whitelisted = list.some((d) => domain === d || domain.endsWith("." + d));
        sendResponse({ ok: true, whitelisted });
      });
      return true;
    }

    return false;
  });

})();
