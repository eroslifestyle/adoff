(function () {
  "use strict";

  // ===== COSTANTI =====
  const PAUSE_LABELS = {
    session:   "Solo questa visita",
    "1hour":   "1 ora",
    "1day":    "1 giorno",
    permanent: "Sempre",
  };

  // ===== STATO LOCALE =====
  let currentHost = null;
  let whitelist    = [];
  let license      = { type: "free" };

  // ===== ELEMENTI DOM =====
  const globalToggle   = document.getElementById("globalToggle");
  const toggleStatus   = document.getElementById("toggleStatus");
  const adsBlockedEl   = document.getElementById("adsBlocked");
  const reqBlockedEl   = document.getElementById("reqBlocked");
  const currentSiteEl  = document.getElementById("currentSite");
  const licenseBadge   = document.getElementById("licenseBadge");
  const licenseBanner  = document.getElementById("licenseBanner");
  const pauseActive    = document.getElementById("pauseActive");
  const pauseActiveLabel = document.getElementById("pauseActiveLabel");
  const btnResume      = document.getElementById("btnResume");
  const pauseInactive  = document.getElementById("pauseInactive");
  const btnPause       = document.getElementById("btnPause");
  const pauseDropdown  = document.getElementById("pauseDropdown");
  const optionsLink    = document.getElementById("optionsLink");

  // Nuovi elementi
  const trialBlockedBanner = document.getElementById("trialBlockedBanner");
  const founderBadge      = document.getElementById("founderBadge");
  const changelogBanner   = document.getElementById("changelogBanner");
  const changelogTitle    = document.getElementById("changelogTitle");
  const changelogList     = document.getElementById("changelogList");
  const changelogClose    = document.getElementById("changelogClose");
  const reviewPrompt      = document.getElementById("reviewPrompt");
  const reviewStep1       = document.getElementById("reviewStep1");
  const reviewStepYes     = document.getElementById("reviewStepYes");
  const reviewStepNo      = document.getElementById("reviewStepNo");
  const btnSentimentYes   = document.getElementById("btnSentimentYes");
  const btnSentimentNo    = document.getElementById("btnSentimentNo");
  const btnReview         = document.getElementById("btnReview");
  const btnReviewLater    = document.getElementById("btnReviewLater");
  const btnReviewSupport  = document.getElementById("btnReviewSupport");
  const btnReviewNoThanks = document.getElementById("btnReviewNoThanks");

  // ===== UTILITY =====

  /**
   * Formatta numero per display compatto.
   * @param {number} n
   * @returns {string}
   */
  function formatCount(n) {
    if (n >= 1_000_000) return (n / 1_000_000).toFixed(1) + "M";
    if (n >= 1_000)     return (n / 1_000).toFixed(1) + "K";
    return String(n);
  }

  /**
   * Rimuove le pause scadute dalla whitelist.
   * @param {Array} list
   * @returns {Array}
   */
  function cleanExpiredPauses(list) {
    const now = Date.now();
    return list.filter((entry) => {
      if (entry.type === "permanent" || entry.type === "session") return true;
      return entry.until && entry.until > now;
    });
  }

  /**
   * Calcola timestamp "until" in base al tipo di pausa.
   * @param {string} type
   * @returns {number|null}
   */
  function calcUntil(type) {
    const now = Date.now();
    if (type === "1hour") return now + 60 * 60 * 1000;
    if (type === "1day")  return now + 24 * 60 * 60 * 1000;
    return null;
  }

  /**
   * Trova la entry di pausa attiva per il sito corrente.
   * @returns {object|null}
   */
  function getActivePause() {
    if (!currentHost) return null;
    const now = Date.now();
    return whitelist.find((e) => {
      if (e.domain !== currentHost) return false;
      if (e.type === "permanent" || e.type === "session") return true;
      return e.until && e.until > now;
    }) || null;
  }

  // ===== RENDER UI =====

  /** Aggiorna il toggle globale e lo status text. */
  function renderToggle(isEnabled) {
    globalToggle.checked = isEnabled;
    toggleStatus.textContent = isEnabled ? "Attivo" : "In pausa";
    toggleStatus.className = "toggle-status " + (isEnabled ? "active" : "inactive");
  }

  /** Aggiorna i contatori. */
  function renderStats(ads, req) {
    adsBlockedEl.textContent = formatCount(ads);
    reqBlockedEl.textContent = formatCount(req);
  }

  /** Aggiorna il badge licenza nell'header. */
  function renderLicenseBadge() {
    const t = license.type || "free";
    if (t === "pro" || t === "lifetime") {
      licenseBadge.textContent = "PRO";
      licenseBadge.className = "license-badge pro";
    } else if (t === "trial") {
      const daysLeft = calcTrialDaysLeft();
      licenseBadge.textContent = daysLeft > 0 ? `TRIAL ${daysLeft}gg` : "TRIAL";
      licenseBadge.className = "license-badge trial";
    } else {
      licenseBadge.textContent = "FREE";
      licenseBadge.className = "license-badge free";
    }
  }

  /** Aggiorna il banner licenza sotto il sito. */
  function renderLicenseBanner() {
    const t = license.type || "free";
    if (t === "pro" || t === "lifetime" || t === "trial_blocked") {
      licenseBanner.style.display = "none";
      return;
    }
    licenseBanner.style.display = "block";
    // EA-1: costruzione DOM sicura, niente innerHTML con dati dinamici
    licenseBanner.textContent = "";
    if (t === "trial") {
      const d = calcTrialDaysLeft();
      licenseBanner.className = "license-banner trial";
      const icon = document.createTextNode("\u23F3 Trial attivo \u2014 ");
      const strong = document.createElement("strong");
      const daysSpan = document.createElement("span");
      daysSpan.textContent = d + " giorni rimasti";
      strong.appendChild(daysSpan);
      licenseBanner.appendChild(icon);
      licenseBanner.appendChild(strong);
    } else {
      licenseBanner.className = "license-banner free";
      const icon = document.createTextNode("\u2728 FREE \u2014 ");
      const link = document.createElement("a");
      link.href = "#";
      link.textContent = "Prova Pro 30 giorni gratis";
      link.addEventListener("click", (e) => {
        e.preventDefault();
        chrome.runtime.openOptionsPage();
      });
      licenseBanner.appendChild(icon);
      licenseBanner.appendChild(link);
    }
  }

  /** Mostra il banner trial bloccato. */
  function renderTrialBlockedBanner() {
    if (license.type !== "trial_blocked") {
      trialBlockedBanner.style.display = "none";
      return;
    }
    trialBlockedBanner.style.display = "flex";
  }

  /**
   * Normalizza l'oggetto licenza: il trial vive nella chiave storage
   * separata `adoffTrialEnd`, mentre `adoffLicense` contiene solo le
   * licenze Pro/Lifetime acquistate. Deriva `type`/`trialEndsAt` per la UI.
   * @param {object|undefined} lic
   * @param {number|undefined} trialEnd
   * @returns {object}
   */
  function normalizeLicense(lic, trialEnd, trialBlocked) {
    const out = Object.assign({}, lic);
    const plan = out.plan || "";
    const hasValidPro = out.valid &&
      (plan === "pro" || plan === "lifetime" || plan === "monthly" || plan === "annual");
    if (hasValidPro) {
      out.type = plan === "lifetime" ? "lifetime" : "pro";
    } else if (trialBlocked) {
      out.type = "trial_blocked";
    } else if (trialEnd && trialEnd > Date.now()) {
      out.type = "trial";
      out.trialEndsAt = trialEnd;
    } else {
      out.type = "free";
    }
    return out;
  }

  /**
   * Calcola i giorni rimasti del trial.
   * @returns {number}
   */
  function calcTrialDaysLeft() {
    if (!license.trialEndsAt) return 0;
    const diff = license.trialEndsAt - Date.now();
    return Math.max(0, Math.ceil(diff / 86_400_000));
  }

  /** Aggiorna la sezione pausa per sito. */
  function renderPauseSection() {
    const pause = getActivePause();
    if (pause) {
      pauseActive.style.display = "flex";
      pauseInactive.style.display = "none";
      pauseActiveLabel.textContent =
        "In pausa — " + (PAUSE_LABELS[pause.type] || pause.type);
    } else {
      pauseActive.style.display = "none";
      pauseInactive.style.display = "block";
      pauseDropdown.style.display = "none";
    }
  }

  // ===== FOUNDER BADGE =====

  function renderFounderBadge(data) {
    if (data.adoffIsFounder) {
      founderBadge.style.display = "inline-block";
    }
  }

  // ===== CHANGELOG BANNER =====

  // Changelogs (stesso del background.js)
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

  function renderChangelog(data) {
    if (!data.adoffShowChangelog || !data.adoffNewVersion) return;
    const items = CHANGELOGS[data.adoffNewVersion];
    if (!items || items.length === 0) return;

    changelogTitle.textContent = "Novita' v" + data.adoffNewVersion;
    changelogList.innerHTML = "";
    items.forEach((item) => {
      const li = document.createElement("li");
      li.textContent = item;
      changelogList.appendChild(li);
    });
    changelogBanner.style.display = "block";
  }

  function dismissChangelog() {
    changelogBanner.style.display = "none";
    chrome.storage.local.get(["adoffChangelogSeen", "adoffNewVersion"], (r) => {
      const seen = r.adoffChangelogSeen || [];
      if (r.adoffNewVersion && !seen.includes(r.adoffNewVersion)) {
        seen.push(r.adoffNewVersion);
      }
      chrome.storage.local.set({
        adoffShowChangelog: false,
        adoffChangelogSeen: seen,
      });
    });
  }

  changelogClose.addEventListener("click", dismissChangelog);

  // ===== REVIEW PROMPT =====

  // Deep-link alla pagina recensioni dello store giusto, in base al browser rilevato.
  const SUPPORT_URL = "https://adoff.app/support.html";
  function detectReviewUrl() {
    const ua = navigator.userAgent || "";
    if (/Firefox\//.test(ua)) return "https://addons.mozilla.org/firefox/addon/adoff/reviews/";
    if (/Edg\//.test(ua))     return "https://microsoftedge.microsoft.com/addons/detail/00a23227-cb9a-415c-88bb-4e9636f7e94b";
    return "https://chromewebstore.google.com/detail/" + chrome.runtime.id + "/reviews";
  }

  // Trigger su USO ATTIVO: almeno 100 ads bloccate (proxy d'uso reale) e 10 giorni dall'install.
  const REVIEW_MIN_ADS = 100;
  const REVIEW_MIN_DAYS = 10;
  const REVIEW_COOLDOWN_DAYS = 7;   // un solo promemoria dopo ~7 giorni
  const REVIEW_MAX_PROMPTS = 2;     // 1 prompt + 1 reminder, poi mai più

  function shouldShowReviewPrompt(data) {
    const adsBlocked = data.adoffAdsBlocked || 0;
    const installDate = data.adoffInstallDate || 0;
    const promptCount = data.adoffReviewPromptCount || 0;
    const dismissed = data.adoffReviewDismissed || false;
    const done = data.adoffReviewDone || false;
    const lastPrompt = data.adoffReviewLastPrompt || 0;
    const now = Date.now();

    if (done || dismissed) return false;
    if (promptCount >= REVIEW_MAX_PROMPTS) return false;
    if (adsBlocked < REVIEW_MIN_ADS) return false;

    const daysSinceInstall = (now - installDate) / 86400000;
    if (daysSinceInstall < REVIEW_MIN_DAYS) return false;

    const daysSinceLastPrompt = (now - lastPrompt) / 86400000;
    if (lastPrompt > 0 && daysSinceLastPrompt < REVIEW_COOLDOWN_DAYS) return false;

    return true;
  }

  function renderReviewPrompt(data) {
    if (!shouldShowReviewPrompt(data)) return;

    // Mostra sempre lo step 1 (sentiment) all'apertura del prompt.
    reviewStep1.style.display = "";
    reviewStepYes.style.display = "none";
    reviewStepNo.style.display = "none";
    reviewPrompt.style.display = "block";

    // Conta il prompt mostrato (per il limite 1 + 1 reminder).
    chrome.storage.local.set({
      adoffReviewPromptCount: (data.adoffReviewPromptCount || 0) + 1,
      adoffReviewLastPrompt: Date.now(),
    });
  }

  // Step 1 → ramo positivo / negativo
  btnSentimentYes.addEventListener("click", () => {
    reviewStep1.style.display = "none";
    reviewStepYes.style.display = "";
  });
  btnSentimentNo.addEventListener("click", () => {
    reviewStep1.style.display = "none";
    reviewStepNo.style.display = "";
  });

  // Ramo positivo: deep-link recensioni dello store giusto
  btnReview.addEventListener("click", () => {
    chrome.tabs.create({ url: detectReviewUrl() });
    chrome.storage.local.set({ adoffReviewDone: true });
    reviewPrompt.style.display = "none";
  });
  btnReviewLater.addEventListener("click", () => {
    reviewPrompt.style.display = "none"; // ricompare dopo il cooldown, fino a MAX_PROMPTS
  });

  // Ramo negativo: offre aiuto, NON blocca lo store
  btnReviewSupport.addEventListener("click", () => {
    chrome.tabs.create({ url: SUPPORT_URL });
    chrome.storage.local.set({ adoffReviewDismissed: true });
    reviewPrompt.style.display = "none";
  });
  btnReviewNoThanks.addEventListener("click", () => {
    chrome.storage.local.set({ adoffReviewDismissed: true });
    reviewPrompt.style.display = "none";
  });

  /** Esegue il render completo. */
  function renderAll(data) {
    const isEnabled = data.adoffEnabled !== false;
    renderToggle(isEnabled);
    renderStats(data.adoffAdsBlocked || 0, data.adoffReqBlocked || 0);
    renderLicenseBadge();
    renderLicenseBanner();
    renderTrialBlockedBanner();
    renderPauseSection();
    renderFounderBadge(data);
    renderChangelog(data);
    renderReviewPrompt(data);

    // ---- Mobile banner ----
    (function showMobileBanner() {
      var banner = document.getElementById("mobileBanner");
      if (!banner) return;
      // Show the banner to all users (free and Pro) after 1.5s
      setTimeout(function() {
        banner.style.display = "flex";
      }, 1500);
    })();
  }

  // ===== CARICAMENTO DATI =====

  function loadState() {
    chrome.tabs.query({ active: true, currentWindow: true }, (tabs) => {
      if (tabs[0] && tabs[0].url) {
        try {
          currentHost = new URL(tabs[0].url).hostname || null;
        } catch (_) {
          currentHost = null;
        }
      }
      currentSiteEl.textContent = currentHost || "—";

      chrome.storage.local.get(null, (result) => {
        // EM-9: chiave storage allineata con background.js (adoffWhitelist)
        // Pulisci pause scadute
        const raw = Array.isArray(result.adoffWhitelist) ? result.adoffWhitelist : [];
        whitelist = cleanExpiredPauses(raw);
        if (whitelist.length !== raw.length) {
          chrome.storage.local.set({ adoffWhitelist: whitelist });
        }

        license = normalizeLicense(result.adoffLicense || result.license, result.adoffTrialEnd, result.adoffTrialBlocked);
        renderAll(result);
      });
    });
  }

  // ===== TOGGLE GLOBALE =====

  globalToggle.addEventListener("change", () => {
    const enabled = globalToggle.checked;
    chrome.storage.local.set({ adoffEnabled: enabled });
    renderToggle(enabled);
  });

  // ===== PAUSA DROPDOWN =====

  btnPause.addEventListener("click", (e) => {
    e.stopPropagation();
    const isOpen = pauseDropdown.style.display !== "none";
    pauseDropdown.style.display = isOpen ? "none" : "block";
  });

  document.addEventListener("click", () => {
    pauseDropdown.style.display = "none";
  });

  // Selezione tipo pausa
  pauseDropdown.querySelectorAll(".dropdown-item").forEach((item) => {
    item.addEventListener("click", () => {
      if (!currentHost) return;
      const type = item.dataset.type;
      const entry = {
        domain: currentHost,
        type,
        until: calcUntil(type),
        addedAt: Date.now(),
      };

      // Rimuovi eventuali pause precedenti per questo sito
      whitelist = whitelist.filter((e) => e.domain !== currentHost);
      whitelist.push(entry);

      chrome.storage.local.set({ adoffWhitelist: whitelist }, () => {
        pauseDropdown.style.display = "none";
        renderPauseSection();
      });
    });
  });

  // Riattiva sito (rimuovi dalla whitelist)
  btnResume.addEventListener("click", () => {
    if (!currentHost) return;
    whitelist = whitelist.filter((e) => e.domain !== currentHost);
    chrome.storage.local.set({ adoffWhitelist: whitelist }, () => {
      renderPauseSection();
    });
  });

  // ===== LINK OPZIONI & AIUTO =====

  optionsLink.addEventListener("click", (e) => {
    e.preventDefault();
    chrome.runtime.openOptionsPage();
  });

  const helpLink = document.getElementById("helpLink");
  helpLink.addEventListener("click", (e) => {
    e.preventDefault();
    chrome.tabs.create({ url: chrome.runtime.getURL("src/options.html#aiuto") });
  });

  // ===== INIT =====
  // ===== VPN -----
  const API = "https://api.adoff.app";

  async function vpnFetch(path, opts = {}) {
    try {
      const r = await fetch(API + path, {
        headers: { "Content-Type": "application/json" },
        ...opts,
      });
      return r.ok ? await r.json() : { error: r.status };
    } catch (e) { return { error: e.message }; }
  }

  let vpnServers = [];
  let vpnConnected = false;
  let vpnAccountId = null;

  function setVpnStatus(state, label) {
    const el = document.getElementById("vpnStatus");
    el.textContent = label;
    el.className = "vpn-status" + (state ? " " + state : "");
  }

  function setVpnBtn(label, cls, disabled) {
    const btn = document.getElementById("btnVpnToggle");
    btn.textContent = label;
    btn.className = "vpn-btn" + (cls ? " " + cls : "");
    btn.disabled = !!disabled;
  }

  async function loadVpnState() {
    // Leggi account salvato + check premium
    const stored = await new Promise(r => chrome.storage.local.get(["adoffVpnAccountId"], r));
    vpnAccountId = stored.adoffVpnAccountId || null;
    vpnConnected = false;
    setVpnStatus("", "Disconnesso");
    setVpnBtn("Connetti", "connect", false);
    document.getElementById("vpnTrialInfo").textContent = "";
    document.getElementById("vpnTrialInfo").className = "vpn-trial-info";
    document.getElementById("vpnUpsell").style.display = "none";
  }

  async function initVpn() {
    const pro = await LicenseClient.checkPro();
    if (!pro.isPro) {
      document.getElementById("vpnServerRow").style.display = "none";
      setVpnBtn("Connetti", "connect", true);
      setVpnStatus("", "Free");
      const ti = document.getElementById("vpnTrialInfo");
      ti.textContent = "Solo Pro";
      ti.className = "vpn-trial-info free";
      document.getElementById("vpnUpsell").style.display = "flex";
      return;
    }
    // Carica server
    const sel = document.getElementById("vpnServerSelect");
    sel.innerHTML = '<option value="">Caricamento...</option>';
    const res = await vpnFetch("/vpn/servers");
    if (res.error || !res.ok) { sel.innerHTML = '<option value="">Errore server</option>'; return; }
    vpnServers = res.servers || [];
    sel.innerHTML = '<option value="">Seleziona server</option>';
    vpnServers.forEach(s => {
      const o = document.createElement("option");
      o.value = s.id;
      o.textContent = s.city ? `${s.city} (${s.country})` : `${s.name} (${s.country})`;
      sel.appendChild(o);
    });
    // Ripristina stato
    if (vpnAccountId) {
      setVpnStatus("", "Pronto");
      setVpnBtn("Connetti", "connect", false);
    } else {
      setVpnStatus("", "Pronto");
      setVpnBtn("Connetti", "connect", false);
    }
  }

  async function toggleVpn() {
    const btn = document.getElementById("btnVpnToggle");
    if (vpnConnected) {
      // Disconnetti
      btn.disabled = true;
      setVpnBtn("...", "connect", true);
      if (vpnAccountId) {
        await vpnFetch("/vpn/disable", { method: "POST", body: JSON.stringify({ accountId: vpnAccountId }) });
      }
      vpnConnected = false;
      setVpnStatus("", "Disconnesso");
      setVpnBtn("Connetti", "connect", false);
      btn.disabled = false;
    } else {
      // Connetti
      const sel = document.getElementById("vpnServerSelect");
      const serverId = sel.value;
      if (!serverId) { setVpnStatus("connecting", "Seleziona server"); return; }
      btn.disabled = true;
      setVpnStatus("connecting", "Connessione...");
      setVpnBtn("...", "connect", true);

      try {
        // 1. Crea account se non esiste
        if (!vpnAccountId) {
          const cr = await vpnFetch("/vpn/create", { method: "POST", body: JSON.stringify({ email: "user@adoff.app" }) });
          if (cr.error || !cr.ok) throw new Error(cr.error || "Create failed");
          vpnAccountId = cr.accountId;
          await new Promise(p => chrome.storage.local.set({ adoffVpnAccountId: vpnAccountId }, p));
        }
        // 2. Abilita
        const er = await vpnFetch("/vpn/enable", { method: "POST", body: JSON.stringify({ accountId: vpnAccountId }) });
        if (er.error) throw new Error(er.error);
        // 3. Get config
        const cfg = await vpnFetch(`/vpn/config?accountId=${encodeURIComponent(vpnAccountId)}&serverId=${encodeURIComponent(serverId)}`);
        if (cfg.error || !cfg.ok) throw new Error(cfg.error || "Config failed");
        // 4. Scarica config (WireGuard .conf)
        const conf = cfg.config || cfg.wireguard_config || cfg;
        const blob = new Blob([typeof conf === "string" ? conf : JSON.stringify(conf, null, 2)], { type: "text/plain" });
        const url = URL.createObjectURL(blob);
        const a = document.createElement("a");
        a.href = url;
        a.download = "adoff-vpn.conf";
        a.click();
        URL.revokeObjectURL(url);

        vpnConnected = true;
        setVpnStatus("connected", "Connesso");
        setVpnBtn("Disconnetti", "disconnect", false);
        const ti = document.getElementById("vpnTrialInfo");
        ti.textContent = "Apri WireGuard";
        ti.className = "vpn-trial-info";
      } catch (e) {
        setVpnStatus("", "Errore");
        setVpnBtn("Connetti", "connect", false);
        btn.disabled = false;
      }
    }
  }

  document.getElementById("btnVpnToggle").addEventListener("click", toggleVpn);
  // ----- fine VPN

  i18n.init(() => {
    i18n.applyToDOM();
    loadState();
    loadVpnState().then(initVpn);

    // Versione dal manifest (single source of truth) — sempre congruente
    try {
      const rt = (typeof chrome !== "undefined" && chrome.runtime) ? chrome.runtime
               : (typeof browser !== "undefined" && browser.runtime) ? browser.runtime : null;
      const versionEl = document.getElementById("popupVersion");
      if (rt && rt.getManifest && versionEl) {
        versionEl.textContent = "v" + rt.getManifest().version;
      }
    } catch (_e) { /* noop */ }
  });
})();
