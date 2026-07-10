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

  // ---- deviceId STABILE e PERSISTENTE (anti-abuso trial) ----
  // adoffDeviceId è la chiave del trial server-anchored. In chrome.storage.local
  // verrebbe azzerato a ogni disinstalla/reinstalla → nuovo deviceId → nuovo
  // trial ("free a vita"). Lo persistiamo ANCHE in chrome.storage.sync, che
  // sopravvive a disinstalla/reinstalla sullo stesso profilo browser (sync del
  // Google account). Su reinstall il deviceId viene RIPRISTINATO dal sync → il
  // server riconosce lo stesso device e restituisce il trial ORIGINALE (anche
  // scaduto). Ritorna {id, restored}: restored=true ⇒ device già visto
  // (reinstall) ⇒ NIENTE trial ottimistico fresco.
  function getStableDeviceId() {
    return new Promise((resolve) => {
      chrome.storage.local.get("adoffDeviceId", (loc) => {
        if (loc && loc.adoffDeviceId) {
          try {
            chrome.storage.sync.get("adoffDeviceId", (s) => {
              if (!s || !s.adoffDeviceId) {
                try { chrome.storage.sync.set({ adoffDeviceId: loc.adoffDeviceId }); } catch (_) {}
              }
            });
          } catch (_) { /* sync non disponibile */ }
          return resolve({ id: loc.adoffDeviceId, restored: false });
        }
        const finalize = (id, restored) => resolve({ id, restored });
        try {
          chrome.storage.sync.get("adoffDeviceId", (s) => {
            if (s && s.adoffDeviceId) {
              chrome.storage.local.set({ adoffDeviceId: s.adoffDeviceId });
              return finalize(s.adoffDeviceId, true);   // RESTORED ⇒ reinstall
            }
            const id = generateDeviceUuid();             // device NUOVO
            chrome.storage.local.set({ adoffDeviceId: id });
            try { chrome.storage.sync.set({ adoffDeviceId: id }); } catch (_) {}
            finalize(id, false);
          });
        } catch (_) {
          const id = generateDeviceUuid();
          chrome.storage.local.set({ adoffDeviceId: id });
          finalize(id, false);
        }
      });
    });
  }

  // Init: risolve/persiste il deviceId stabile al primo avvio.
  getStableDeviceId();

  // ---- TRIAL — server-anchored, verifica firma ECDSA P-256 ----
  // L'autorità del trial è il server (endpoint /trial → tabella D1). Il service
  // worker verifica il token firmato con la chiave pubblica: la scadenza non è
  // falsificabile via DevTools/storage. Vedi license-client.js (stessa logica).
  const API_URL = "https://api.adoff.app";
  const TRIAL_DURATION_MS = TRIAL_DAYS * 24 * 60 * 60 * 1000;
  const TRIAL_MARGIN_MS = 24 * 60 * 60 * 1000;
  const TRIAL_PUBKEY_JWK = {
    kty: "EC", crv: "P-256",
    x: "FnIroHHVzo3v01gENPaA2U70c58sduDD6hGS0EhCATc",
    y: "tAzRBzVK1O8ul76s2euNrqV0L4f1qmEtvcKB_HqpfrY",
  };

  function trialB64uToBytes(s) {
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

  async function verifyTrialToken(token, localDeviceId) {
    if (!token || typeof token !== "string" || token.indexOf(".") < 0) return null;
    try {
      const [payloadB64, sigB64] = token.split(".");
      const pubKey = await importTrialPubKey();
      const ok = await crypto.subtle.verify(
        { name: "ECDSA", hash: "SHA-256" }, pubKey,
        trialB64uToBytes(sigB64), new TextEncoder().encode(payloadB64)
      );
      if (!ok) return null;
      const payload = JSON.parse(new TextDecoder().decode(trialB64uToBytes(payloadB64)));
      if (localDeviceId && payload.deviceId && payload.deviceId !== localDeviceId) return null;
      return payload;
    } catch (_) {
      return null;
    }
  }

  // Trial attivo? Autorità = token firmato; fallback ottimistico limitato a ≤30g da ora.
  async function isTrialActive(result, now) {
    const payload = result.adoffTrialToken
      ? await verifyTrialToken(result.adoffTrialToken, result.adoffDeviceId)
      : null;
    if (payload) return payload.trialEnd > now;
    const te = result.adoffTrialEnd || 0;
    return !result.adoffTrialExpired && te > now
      && te <= now + TRIAL_DURATION_MS + TRIAL_MARGIN_MS;
  }

  // Riconcilia il trial col server (idempotente). Salva il token firmato.
  async function syncTrialBg() {
    try {
      const { id: deviceId } = await getStableDeviceId();

      const resp = await fetch(API_URL + "/trial", {
        method: "POST",
        credentials: "include",   // invia/riceve il cookie àncora (anti-reinstall)
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({ deviceId }),
      });
      const data = await resp.json();
      if (!data || !data.ok || !data.token) return;

      // Il server può tornare un deviceId DIVERSO (l'id del cookie àncora, su
      // reinstall). Adottalo come canonico: serve a far combaciare la verifica
      // firma del token e a usare l'id persistente per le sync future.
      let canonicalId = deviceId;
      if (data.deviceId && data.deviceId !== deviceId) {
        canonicalId = data.deviceId;
        chrome.storage.local.set({ adoffDeviceId: canonicalId });
        try { chrome.storage.sync.set({ adoffDeviceId: canonicalId }); } catch (_) {}
      }

      const payload = await verifyTrialToken(data.token, canonicalId);
      if (!payload) return; // firma non valida → non fidarsi

      chrome.storage.local.set({
        adoffTrialToken: data.token,
        adoffTrialEnd: payload.trialEnd,
        adoffTrialStart: payload.trialStart,
        adoffTrialSeen: Date.now(),
      });
    } catch (_) { /* offline — riprova al prossimo trigger */ }
  }

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

  // Imposta la pagina di survey post-disinstallazione (cattura il "perché ci disinstalli").
  // Passa versione + stato Pro/Trial come query param così la pagina li include nel POST.
  function updateUninstallURL() {
    try {
      chrome.storage.local.get(["adoffLicense", STORAGE_TRIAL_END], (r) => {
        const now = Date.now();
        const lic = r && r.adoffLicense;
        const hasLicense = !!(lic && lic.valid);
        const trialOn = typeof r[STORAGE_TRIAL_END] === "number" && now < r[STORAGE_TRIAL_END];
        const wasPro = (hasLicense || trialOn) ? "1" : "0";
        const v = chrome.runtime.getManifest().version;
        const url = "https://adoff.app/uninstall.html?v=" + encodeURIComponent(v) + "&pro=" + wasPro;
        if (chrome.runtime.setUninstallURL) chrome.runtime.setUninstallURL(url);
      });
    } catch (_) { /* best-effort, non bloccante */ }
  }
  updateUninstallURL();

  // 1) Al riavvio del browser
  chrome.runtime.onStartup.addListener(() => {
    revalidateLicense("startup");
    syncTrialBg();
    updateUninstallURL();
    syncRemoteRules();
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
  chrome.runtime.onInstalled.addListener(async (details) => {
    // Risolve il deviceId stabile (ripristina da sync se è un reinstall) PRIMA
    // di decidere se concedere il trial ottimistico.
    const dev = await getStableDeviceId();
    chrome.storage.local.get(null, (result) => {
      const defaults = {};
      if (result[STORAGE_ENABLED] === undefined) defaults[STORAGE_ENABLED] = true;
      if (result[STORAGE_ADS]     === undefined) defaults[STORAGE_ADS]     = 0;
      if (result[STORAGE_REQ]     === undefined) defaults[STORAGE_REQ]     = 0;
      if (result[STORAGE_WHITELIST] === undefined) defaults[STORAGE_WHITELIST] = [];

      // Primo install
      if (details.reason === "install") {
        // Trial 30 giorni — SOLO se device genuinamente nuovo. Se il deviceId è
        // stato RIPRISTINATO dal sync (reinstall sullo stesso profilo) NON si
        // concede un trial fresco: syncTrialBg ripristina lo stato reale dal
        // server (anche scaduto). Anti-abuso "free a vita via reinstall".
        if (!dev.restored) {
          if (result[STORAGE_TRIAL_END] === undefined) {
            defaults[STORAGE_TRIAL_END] = Date.now() + TRIAL_DAYS * 24 * 60 * 60 * 1000;
          }
          // Data installazione (per Founding Member) — persistita anche in sync.
          defaults.adoffInstallDate = Date.now();
          defaults.adoffIsFounder = Date.now() < FOUNDER_CUTOFF;
          try { chrome.storage.sync.set({ adoffInstallDate: defaults.adoffInstallDate }); } catch (_) {}
        } else {
          // Reinstall: ripristina installDate/founder dal sync (NIENTE trial fresco;
          // adoffTrialEnd resta undefined → l'autorità è il server via syncTrialBg).
          try {
            chrome.storage.sync.get("adoffInstallDate", (s) => {
              if (s && s.adoffInstallDate) {
                chrome.storage.local.set({
                  adoffInstallDate: s.adoffInstallDate,
                  adoffIsFounder: s.adoffInstallDate < FOUNDER_CUTOFF,
                });
              }
            });
          } catch (_) { /* sync non disponibile */ }
        }

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

    // Ancora/riconcilia il trial col server. Su "update" questo RIPRISTINA la
    // scadenza autorevole dal server anche se lo storage locale fosse stato
    // azzerato → il countdown non si resetta mai più tra un aggiornamento e l'altro.
    syncTrialBg();
    updateUninstallURL();

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
      syncTrialBg();
      updateUninstallURL();
      syncRemoteRules();
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
  // Streaming premium con SSAI via Google DAI: il content stream passa da
  // ima3_dai.js, quindi il redirect IMA allo stub va escluso SOLO su questi
  // domini (mirror dell'esclusione sulle static rules 220/900). Isolato: ogni
  // altro provider continua a ricevere il redirect identico.
  const PREMIUM_STREAMING_INITIATORS = ["paramountplus.com"];
  const IMA_REDIRECT_RULES = [
    { id: 50001, priority: 3, action: { type: "redirect", redirect: { extensionPath: "/stubs/google-ima3.js" } }, condition: { urlFilter: "||imasdk.googleapis.com/js/sdkloader/ima3.js", resourceTypes: ["script"], excludedInitiatorDomains: PREMIUM_STREAMING_INITIATORS } },
    { id: 50002, priority: 3, action: { type: "redirect", redirect: { extensionPath: "/stubs/google-ima3.js" } }, condition: { urlFilter: "||imasdk.googleapis.com/js/sdkloader/ima3_dai.js", resourceTypes: ["script"], excludedInitiatorDomains: PREMIUM_STREAMING_INITIATORS } },
  ];

  function updateImaRules() {
    chrome.storage.local.get(
      ["adoffLicense", "adoffTrialEnd", "adoffTrialToken", "adoffTrialExpired",
       "adoffDeviceId", "adoffIntegrity", STORAGE_ENABLED],
      async (result) => {
      const lic = result.adoffLicense || {};
      const enabled = result[STORAGE_ENABLED] !== false;
      const trialOk = await isTrialActive(result, Date.now());
      const isPro = lic.type === "pro" || lic.type === "lifetime"
        || (lic.valid && ["pro", "lifetime", "monthly", "annual"].includes(lic.plan))
        || trialOk;

      // Il redirect si attiva SOLO se Pro/Trial E protezione attiva.
      // Se l'utente disattiva AdOff il redirect va rimosso, altrimenti
      // imasdk resterebbe rediretto allo stub anche a protezione spenta.
      if (isPro && enabled) {
        chrome.declarativeNetRequest.updateDynamicRules({
          removeRuleIds: [50001, 50002],
          addRules: IMA_REDIRECT_RULES,
        });
      } else {
        chrome.declarativeNetRequest.updateDynamicRules({
          removeRuleIds: [50001, 50002],
        });
      }

      // ---- YouTube ad rules: Pro/Trial ONLY (anti SABR-backoff) ----
      // In Free, bloccare a metà gli ad di YouTube fa scattare il SABR-backoff
      // (schermo nero ~80% durata ad) SENZA la mitigazione injectNoAd (Pro-only)
      // → esperienza rotta. Quindi le regole YT-specifiche sono attive SOLO con
      // Pro/Trial: Free = YouTube intatto (ad normali, player fluido). Completa
      // il design v3.3.6 "YouTube = solo Pro". Feature-detect updateStaticRules
      // (Chrome 111+): se assente (browser vecchio) degrada senza regressione.
      const YT_AD_RULE_IDS = [170, 171, 172, 173, 174, 175, 176, 179];
      try {
        if (chrome.declarativeNetRequest.updateStaticRules) {
          const ytOn = isPro && enabled;
          chrome.declarativeNetRequest.updateStaticRules({
            rulesetId: "adblock_rules",
            [ytOn ? "enableRuleIds" : "disableRuleIds"]: YT_AD_RULE_IDS,
          }).catch(() => { /* ignore */ });
        }
      } catch (_) { /* updateStaticRules non supportato — degrada */ }
    });
  }

  // ---- Whitelist allow rules (sito in pausa = nativo) ----
  // La pausa non basta a fermare content.js: serve esentare il dominio
  // anche a livello rete (blocchi statici + redirect IMA). allowAllRequests
  // sul main_frame del dominio esenta l'intero albero di richieste (inclusi
  // gli iframe del player). priority alta per battere redirect(3) e block(1).
  const WL_ALLOW_BASE_ID = 51000;
  const WL_ALLOW_MAX     = 1000;
  function updateWhitelistAllowRules() {
    chrome.storage.local.get(STORAGE_WHITELIST, (result) => {
      const list = (result[STORAGE_WHITELIST] || []).filter(Boolean).slice(0, WL_ALLOW_MAX);
      chrome.declarativeNetRequest.getDynamicRules((existing) => {
        const oldIds = (existing || [])
          .filter((r) => r.id >= WL_ALLOW_BASE_ID && r.id < WL_ALLOW_BASE_ID + WL_ALLOW_MAX)
          .map((r) => r.id);
        const addRules = list.map((domain, i) => ({
          id: WL_ALLOW_BASE_ID + i,
          priority: 2000,
          action: { type: "allowAllRequests" },
          condition: { requestDomains: [domain], resourceTypes: ["main_frame", "sub_frame"] },
        }));
        chrome.declarativeNetRequest.updateDynamicRules({ removeRuleIds: oldIds, addRules });
      });
    });
  }

  // ---- Remote rule-feed (MV3-native: declarativeNetRequest dynamic rules) ----
  // Mantiene i filtri freschi senza aspettare la review dello store: il service
  // worker scarica un JSON firmato-per-origine da adoff.app e lo applica a runtime.
  // SICUREZZA: solo azioni block/allow (mai redirect/modifyHeaders da fonte remota),
  // id forzati in un range riservato, condition ricostruita con soli campi safe.
  const REMOTE_RULES_URL = "https://adoff.app/rules-feed.json";
  const REMOTE_RULES_BASE_ID = 60000;
  const REMOTE_RULES_MAX = 5000;
  const REMOTE_RULES_FETCH_TIMEOUT_MS = 8000;
  const SAFE_REMOTE_ACTIONS = ["block", "allow"];
  const SAFE_REMOTE_RESOURCE_TYPES = [
    "main_frame", "sub_frame", "script", "image", "stylesheet",
    "xmlhttprequest", "media", "font", "object", "ping", "websocket", "other",
  ];

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
    const prio = Number.isInteger(raw.priority) ? Math.min(Math.max(raw.priority, 1), 100) : 1;
    return { id: assignedId, priority: prio, action: { type: action.type }, condition: safeCond };
  }

  function clearRemoteRules() {
    chrome.declarativeNetRequest.getDynamicRules((existing) => {
      const oldIds = (existing || [])
        .filter((r) => r.id >= REMOTE_RULES_BASE_ID && r.id < REMOTE_RULES_BASE_ID + REMOTE_RULES_MAX)
        .map((r) => r.id);
      if (oldIds.length) chrome.declarativeNetRequest.updateDynamicRules({ removeRuleIds: oldIds });
    });
  }

  async function syncRemoteRules() {
    let enabled = true;
    try {
      const st = await chrome.storage.local.get(STORAGE_ENABLED);
      enabled = st[STORAGE_ENABLED] !== false;
    } catch (_) { /* default enabled */ }
    if (!enabled) { clearRemoteRules(); return; }

    let data = null;
    try {
      const ctrl = new AbortController();
      const t = setTimeout(() => ctrl.abort(), REMOTE_RULES_FETCH_TIMEOUT_MS);
      const res = await fetch(REMOTE_RULES_URL + "?t=" + Date.now(), { signal: ctrl.signal, cache: "no-store" });
      clearTimeout(t);
      if (!res.ok) return;
      data = await res.json();
    } catch (_) {
      return; // offline / errore di rete → mantieni le regole correnti, nessun crash
    }
    if (!data || !Array.isArray(data.rules)) return;

    const addRules = [];
    for (const raw of data.rules.slice(0, REMOTE_RULES_MAX)) {
      const r = sanitizeRemoteRule(raw, REMOTE_RULES_BASE_ID + addRules.length);
      if (r) addRules.push(r);
    }

    chrome.declarativeNetRequest.getDynamicRules((existing) => {
      const oldIds = (existing || [])
        .filter((r) => r.id >= REMOTE_RULES_BASE_ID && r.id < REMOTE_RULES_BASE_ID + REMOTE_RULES_MAX)
        .map((r) => r.id);
      chrome.declarativeNetRequest.updateDynamicRules({ removeRuleIds: oldIds, addRules }, () => {
        if (chrome.runtime.lastError) return;
        chrome.storage.local.set({
          adoffRemoteRulesVer: data.version || 0,
          adoffRemoteRulesSync: Date.now(),
          adoffRemoteRulesCount: addRules.length,
        });
      });
    });
  }

  // Aggiorna regole IMA + whitelist + feed remoto all'avvio e quando cambiano gli stati rilevanti
  updateImaRules();
  updateWhitelistAllowRules();
  syncRemoteRules();
  chrome.storage.onChanged.addListener((changes) => {
    if (changes.adoffLicense || changes.adoffTrialEnd || changes.adoffTrialToken || changes[STORAGE_ENABLED]) {
      updateImaRules();
    }
    if (changes[STORAGE_ENABLED]) {
      syncRemoteRules();
    }
    if (changes[STORAGE_WHITELIST]) {
      updateWhitelistAllowRules();
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
