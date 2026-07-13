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

  // ---- Fingerprint browser resilient (lazy/cached, zero deps, Web Crypto API) ----
  // Combina canvas + audio + screen + platform + WebGL + timezone/language.
  // Fallback: hash SHA-256 di adoffDeviceId se tutto fallisce.
  var _cachedFingerprint = null;

  async function generateResilientFingerprint() {
    if (_cachedFingerprint !== null) return _cachedFingerprint;
    try {
      var components = [];
      var fallbackDeviceId = null;

      // Leggi deviceId per fallback
      try {
        fallbackDeviceId = await new Promise(function(r) {
          chrome.storage.local.get("adoffDeviceId", r);
        }).then(function(r) { return r.adoffDeviceId; });
      } catch (_) {}

      // Canvas 2D fingerprint
      try {
        var canvas = document.createElement("canvas");
        canvas.width = 200;
        canvas.height = 50;
        var ctx = canvas.getContext("2d");
        if (ctx) {
          ctx.textBaseline = "top";
          ctx.font = "14px Arial";
          ctx.fillStyle = "#f60";
          ctx.fillRect(125, 1, 62, 20);
          ctx.fillStyle = "#069";
          ctx.fillText("AdOff", 2, 15);
          ctx.fillStyle = "rgba(102,204,0,0.7)";
          ctx.fillText("fingerprint", 4, 27);
          var dataUrl = canvas.toDataURL();
          var canvasHash = await crypto.subtle.digest(
            "SHA-256",
            new TextEncoder().encode(dataUrl)
          );
          components.push(btoaFromBytes(canvasHash));
        }
      } catch (_) {}

      // AudioContext fingerprint
      try {
        var AudioCtx = window.AudioContext || window.webkitAudioContext;
        if (AudioCtx) {
          var ac = new AudioCtx();
          var oscillator = ac.createOscillator();
          var analyser = ac.createAnalyser();
          var gainNode = ac.createGain();
          gainNode.gain.value = 0;
          oscillator.type = "triangle";
          oscillator.frequency.value = 12345;
          oscillator.connect(analyser);
          analyser.connect(gainNode);
          gainNode.connect(ac.destination);
          oscillator.start(0);
          var bins = new Float32Array(analyser.frequencyBinCount);
          analyser.getFloatFrequencyData(bins);
          var audioSummary = bins.slice(0, 32).map(function(b) { return b.toFixed(3); }).join(",");
          var audioHash = await crypto.subtle.digest(
            "SHA-256",
            new TextEncoder().encode(audioSummary)
          );
          components.push(btoaFromBytes(audioHash));
          try { oscillator.stop(); } catch (_) {}
          try { ac.close(); } catch (_) {}
        }
      } catch (_) {}

      // Screen
      try {
        components.push([
          screen.width, screen.height, screen.colorDepth, screen.pixelDepth
        ].join("x"));
      } catch (_) {}

      // Platform + hardwareConcurrency
      try {
        components.push(navigator.platform || "");
        components.push(String(navigator.hardwareConcurrency || 0));
      } catch (_) {}

      // WebGL renderer (UNMASKED_RENDERER + UNMASKED_VENDOR)
      try {
        var gl = document.createElement("canvas").getContext("webgl")
             || document.createElement("canvas").getContext("experimental-webgl");
        if (gl) {
          var ext = gl.getExtension("WEBGL_debug_renderer_info");
          if (ext) {
            var vendor = gl.getParameter(ext.UNMASKED_VENDOR_WEBGL) || "";
            var renderer = gl.getParameter(ext.UNMASKED_RENDERER_WEBGL) || "";
            components.push(vendor + "|" + renderer);
          }
        }
      } catch (_) {}

      // Timezone + Language
      try {
        var ro = Intl.DateTimeFormat().resolvedOptions();
        components.push(ro.timeZone || "");
        components.push(navigator.language || "");
        components.push((navigator.languages || []).slice(0, 3).join(","));
      } catch (_) {}

      // Combina e hash
      var combined = components.join("||");
      var hash = await crypto.subtle.digest(
        "SHA-256",
        new TextEncoder().encode(combined)
      );
      _cachedFingerprint = btoaFromBytes(hash);
      return _cachedFingerprint;
    } catch (_) {
      // Fallback finale: hash del deviceId o stringa statica
      try {
        var did = await new Promise(function(r) {
          chrome.storage.local.get("adoffDeviceId", r);
        }).then(function(res) { return res.adoffDeviceId; });
        if (did) {
          var fbHash = await crypto.subtle.digest(
            "SHA-256",
            new TextEncoder().encode("fallback-fp:" + did)
          );
          _cachedFingerprint = btoaFromBytes(fbHash);
          return _cachedFingerprint;
        }
      } catch (_2) {}
      _cachedFingerprint = null;
      return null;
    }
  }

  // Helper: Uint8Array → base64
  function btoaFromBytes(bytes) {
    if (typeof bytes === "object" && bytes.constructor.name === "Uint8Array") {
      var bin = "";
      for (var i = 0; i < bytes.length; i++) bin += String.fromCharCode(bytes[i]);
      return btoa(bin);
    }
    // ArrayBuffer
    var arr = new Uint8Array(bytes);
    var bin = "";
    for (var j = 0; j < arr.length; j++) bin += String.fromCharCode(arr[j]);
    return btoa(bin);
  }

  // Genera e persiste l'UUID del dispositivo al primo avvio
  chrome.storage.local.get("adoffDeviceId", (result) => {
    if (!result.adoffDeviceId) {
      chrome.storage.local.set({
        adoffDeviceId: generateDeviceUuid(),
        adoffInstallDate: Date.now(),
      });
    }
  });

  // ---- Tracking server-side (install, heartbeat, uninstall) ----

  // Identifica il source di installazione dal browser.
  function getBrowserSource() {
    const ua = navigator.userAgent;
    if (ua.includes("Firefox")) return "firefox";
    if (ua.includes("Edg/")) return "edge";
    if (ua.includes("OPR/") || ua.includes("Opera")) return "opera";
    if (ua.includes("Safari") && !ua.includes("Chrome")) return "safari";
    return "chrome";
  }

  // Traccia installazione al server (device-level).
  async function trackInstall(adoffDeviceId, plan = "free") {
    try {
      const manifest = chrome.runtime.getManifest();
      const version = manifest.version;
      const { adoffReferralCode } = await new Promise(r => chrome.storage.local.get("adoffReferralCode", r));
      await fetch(`${API_BASE}/track/install`, {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({
          deviceId: adoffDeviceId,
          source: getBrowserSource(),
          ref: adoffReferralCode || "",
          plan,
          version,
          timezone: Intl.DateTimeFormat().resolvedOptions().timeZone,
          fingerprint: await generateResilientFingerprint(),
        }),
      });
    } catch (e) {
      console.error("[AdOff] trackInstall error:", e);
    }
  }

  // Heartbeat periodico per tracking real-time retention.
  async function trackHeartbeat(adoffDeviceId, installTs) {
    try {
      const manifest = chrome.runtime.getManifest();
      const { adoffLicense, adoffTrialEnd } = await new Promise(r => chrome.storage.local.get(["adoffLicense", "adoffTrialEnd"]));
      const now = Date.now();
      const isProTrial = !!(adoffLicense?.key || (adoffTrialEnd && adoffTrialEnd > now));
      const plan = isProTrial ? "pro" : "free";
      await fetch(`${API_BASE}/track/heartbeat`, {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({
          deviceId: adoffDeviceId,
          plan,
          version: manifest.version,
          installTs: installTs || now,
        }),
      });
    } catch (e) {
      console.error("[AdOff] trackHeartbeat error:", e);
    }
  }

  // Traccia disinstallazione al server.
  async function trackUninstall(adoffDeviceId, reason, comment, wasPro, version) {
    try {
      await fetch(`${API_BASE}/track/uninstall`, {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({
          deviceId: adoffDeviceId,
          reason,
          comment: comment || "",
          wasPro: wasPro || false,
          version,
        }),
      });
    } catch (e) {
      console.error("[AdOff] trackUninstall error:", e);
    }
  }

  // ---- TRIAL — server-anchored, verifica firma ECDSA P-256 ----
  // L'autorità del trial è il server (endpoint /trial → tabella D1). Il service
  // worker verifica il token firmato con la chiave pubblica: la scadenza non è
  // falsificabile via DevTools/storage. Vedi license-client.js (stessa logica).
  const API_BASE = "https://api.adoff.app";
  const HEARTBEAT_INTERVAL_MS = 60 * 60 * 1000; // 1 ora
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

  // Trial attivo? Autorità = token firmato dal server (anti-furbo).
  // NON c'è più fallback locale — solo il server decide la scadenza.
  async function isTrialActive(result, now) {
    const payload = result.adoffTrialToken
      ? await verifyTrialToken(result.adoffTrialToken, result.adoffDeviceId)
      : null;
    // Se il token è valido e non scaduto → trial attivo
    // Se non c'è token o è scaduto → trial NON attivo (no fallback)
    if (payload) return payload.trialEnd > now;
    // Nessun fallback: il server dice scaduto = scaduto
    return false;
  }

  // Sincronizza trial col server — autorità SERVER per il countdown.
  // Chiama POST /trial con {deviceId, fingerprint} come JSON body.
  async function syncTrialBg() {
    try {
      const { adoffDeviceId } = await new Promise((r) =>
        chrome.storage.local.get("adoffDeviceId", r));
      const deviceId = adoffDeviceId || generateDeviceUuid();
      if (!adoffDeviceId) chrome.storage.local.set({ adoffDeviceId: deviceId });

      const fingerprint = await generateResilientFingerprint();
      const resp = await fetch(`${API_BASE}/trial`, {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({ deviceId, fingerprint }),
      });
      if (!resp.ok) return;
      const data = await resp.json();
      if (!data) return;

      // Gestione trial bloccato dal server (anti-abuse)
      if (data.allowed === false) {
        chrome.storage.local.set({
          adoffTrialBlocked: true,
          adoffTrialBlockedFallback: data.fallback || "account",
          adoffTrialBlockedMsg: data.message || "Trial già usato",
        });
        return;
      }

      // Salva source se account-linked
      if (data.source === "account-linked") {
        chrome.storage.local.set({ adoffTrialSource: "account-linked" });
      }

      // Se c'è un token firmato, verificare e salvare
      if (data.token) {
        const payload = await verifyTrialToken(data.token, deviceId);
        if (!payload) return; // firma non valida → non fidarsi
        chrome.storage.local.set({
          adoffTrialToken: data.token,
          adoffTrialEnd: payload.trialEnd,
          adoffTrialStart: payload.trialStart,
          adoffTrialSeen: Date.now(),
          adoffTrialExpired: !data.active,
          adoffTrialBlocked: false,
        });
        return;
      }

      // Trial attivo ma senza token (account-linked) — salva dates dal server
      if (data.trialStart && data.trialEnd) {
        chrome.storage.local.set({
          adoffTrialEnd: data.trialEnd,
          adoffTrialStart: data.trialStart,
          adoffTrialSeen: Date.now(),
          adoffTrialExpired: false,
          adoffTrialBlocked: false,
        });
      }
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
  // Passa deviceId come query param così il server può de-anonimizzare il survey.
  function updateUninstallURL() {
    try {
      chrome.storage.local.get(["adoffLicense", STORAGE_TRIAL_END, "adoffDeviceId"], (r) => {
        const now = Date.now();
        const lic = r && r.adoffLicense;
        const hasLicense = !!(lic && lic.valid);
        const trialOn = typeof r[STORAGE_TRIAL_END] === "number" && now < r[STORAGE_TRIAL_END];
        const wasPro = (hasLicense || trialOn) ? "1" : "0";
        const v = chrome.runtime.getManifest().version;
        const deviceId = r.adoffDeviceId || "";
        const url = `${API_BASE}/track/uninstall?deviceId=${encodeURIComponent(deviceId)}&v=${encodeURIComponent(v)}&pro=${wasPro}`;
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

      // Track install al server (solo al primo install)
      if (details.reason === "install") {
        chrome.storage.local.get(["adoffDeviceId", STORAGE_TRIAL_END], (r2) => {
          const isTrial = !!(r2[STORAGE_TRIAL_END] && r2[STORAGE_TRIAL_END] > Date.now());
          trackInstall(r2.adoffDeviceId, isTrial ? "trial" : "free");
          // Avvia alarm heartbeat (1 ora)
          chrome.alarms.create("adoffHeartbeat", { periodInMinutes: 60 });
        });
        chrome.tabs.create({ url: "src/onboarding.html" });
      }
    });

    // Ancora/riconcilia il trial col server. Su "update" questo RIPRISTINA la
    // scadenza autorevole dal server anche se lo storage locale fosse stato
    // azzerato → il countdown non si resetta mai più tra un aggiornamento e l'altro.
    syncTrialBg();
    updateUninstallURL();
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
    if (alarm.name === "adoffHeartbeat") {
      chrome.storage.local.get(["adoffDeviceId", "adoffInstallDate"], (r) => {
        if (r.adoffDeviceId) {
          trackHeartbeat(r.adoffDeviceId, r.adoffInstallDate);
        }
      });
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
  // Paramount+ SSAI: excludedInitiatorDomains esclude il redirect IMA su
  // piattaforme che usano Google DAI con stream ads-server-side (mirror
  // dell'esclusione sulle static rules 220/900). Isolato per categoria.
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
  const REMOTE_RULES_MAX = 35000;
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
