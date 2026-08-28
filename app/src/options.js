(function () {
  "use strict";
  // Tier canonico del piano. Da quando AdOff e' gratuito per tutti questa
  // funzione ritorna sempre "premium": ogni funzione e' sbloccata senza
  // licenza e senza scadenza. La firma resta invariata perche' i chiamanti
  // passano ancora il nome del piano, e per poter tornare indietro toccando
  // un punto solo. Il grado di sostenitore NON si deduce da qui: usa
  // adoffSupporterKind(). Invariante presidiato da
  // sviluppo/tests/test-plan-tier-consistency.js.
  function adoffPlanTier() {
    return "premium";
  }

  // Grado di sostenitore, per il solo badge della UI: chi ha una licenza
  // valida continua a pagare volontariamente. Non governa NESSUNA funzione,
  // che ormai e' sbloccata per tutti (vedi adoffPlanTier).
  function adoffSupporterKind(lic) {
    if (!lic || lic.valid !== true) return "none";
    const plan = typeof lic.plan === "string" ? lic.plan : "";
    if (plan.includes("founder") || plan === "lifetime") return "founder";
    return "supporter";
  }

  // ===== COSTANTI =====
  const TYPE_LABELS = {
    permanent: "Permanente",
    session:   "Sessione",
    "1hour":   "1 ora",
    "1day":    "1 giorno",
  };

  // Versione SEMPRE letta dal manifest (single source of truth) — mai hardcoded
  const VERSION = (function () {
    try {
      const rt = (typeof chrome !== "undefined" && chrome.runtime) ? chrome.runtime
               : (typeof browser !== "undefined" && browser.runtime) ? browser.runtime : null;
      return rt && rt.getManifest ? rt.getManifest().version : "";
    } catch (_e) {
      return "";
    }
  })();
  const API_URL = "https://api.adoff.app";

  // Prezzi per piano+dispositivi
  const PRICES = {
    monthly:  { 3: "€2.69", 5: "€3.99", 10: "€5.99" },
    annual:   { 3: "€29.59", 5: "€39.99", 10: "€59.99" },
    lifetime: { 3: "€67.90", 5: "€89.90", 10: "€129.90" },
  };

  // Rilevazione Firefox
  const IS_FIREFOX = typeof browser !== "undefined" && typeof browser.tabs !== "undefined";

  // ===== STATO LOCALE =====
  let whitelist = [];
  let license   = { type: "free" };

  // ===== TOAST =====

  let toastTimer = null;

  /**
   * Mostra un toast temporaneo.
   * @param {string} message
   * @param {'success'|'error'|''} type
   */
  function showToast(message, type) {
    let el = document.getElementById("toast");
    if (!el) {
      el = document.createElement("div");
      el.id = "toast";
      el.className = "toast";
      document.body.appendChild(el);
    }
    el.textContent = message;
    el.className = "toast " + (type || "");
    el.classList.add("show");
    if (toastTimer) clearTimeout(toastTimer);
    toastTimer = setTimeout(() => el.classList.remove("show"), 2800);
  }

  // ===== NAVIGAZIONE ===== //

  const navItems = document.querySelectorAll(".nav-item");
  const sections = document.querySelectorAll(".section");

  /**
   * Attiva una sezione e aggiorna il nav.
   * @param {string} sectionId
   */
  function activateSection(sectionId) {
    navItems.forEach((n) => {
      n.classList.toggle("active", n.dataset.section === sectionId);
    });
    sections.forEach((s) => {
      s.classList.toggle("active", s.id === "sec-" + sectionId);
    });
  }

  navItems.forEach((item) => {
    item.addEventListener("click", (e) => {
      e.preventDefault();
      activateSection(item.dataset.section);
    });
  });

  // ===== UTILITY =====

  /**
   * Formatta numero grande.
   * @param {number} n
   * @returns {string}
   */
  function formatCount(n) {
    if (n >= 1_000_000) return (n / 1_000_000).toFixed(1) + "M";
    if (n >= 1_000)     return (n / 1_000).toFixed(1) + "K";
    return String(n);
  }

  /**
   * Formatta timestamp come data leggibile.
   * @param {number} ts
   * @returns {string}
   */
  function formatDate(ts) {
    if (!ts) return "—";
    return new Date(ts).toLocaleDateString("it-IT", {
      day: "2-digit",
      month: "2-digit",
      year: "2-digit",
    });
  }

  /**
   * Scarica un file JSON.
   * @param {object} data
   * @param {string} filename
   */
  function downloadJSON(data, filename) {
    const blob = new Blob([JSON.stringify(data, null, 2)], { type: "application/json" });
    const url  = URL.createObjectURL(blob);
    const a    = document.createElement("a");
    a.href = url;
    a.download = filename;
    a.click();
    setTimeout(() => URL.revokeObjectURL(url), 5000);
  }

  /**
   * Pulisce le pause scadute.
   * @param {Array} list
   * @returns {Array}
   */
  function cleanExpired(list) {
    const now = Date.now();
    return list.filter((e) => {
      if (e.type === "permanent" || e.type === "session") return true;
      return e.until && e.until > now;
    });
  }

  // ===== GENERALI =====

  const settingEnabled = document.getElementById("settingEnabled");
  const settingBadge   = document.getElementById("settingBadge");
  const settingCounter = document.getElementById("settingCounter");
  const settingVideoCompat = document.getElementById("settingVideoCompat");

  function loadGenerali() {
    chrome.storage.local.get(
      ["adoffEnabled", "adoffShowBadge", "adoffShowCounter", "adoffYtCompat"],
      (r) => {
        settingEnabled.checked = r.adoffEnabled !== false;
        settingBadge.checked   = r.adoffShowBadge !== false;
        settingCounter.checked = r.adoffShowCounter !== false;
        // Default OFF: la modalita' compatibilita' e' una via di fuga, non lo standard
        if (settingVideoCompat) settingVideoCompat.checked = r.adoffYtCompat === true;
      }
    );
  }

  settingEnabled.addEventListener("change", () => {
    chrome.storage.local.set({ adoffEnabled: settingEnabled.checked });
  });

  settingBadge.addEventListener("change", () => {
    chrome.storage.local.set({ adoffShowBadge: settingBadge.checked });
  });

  settingCounter.addEventListener("change", () => {
    chrome.storage.local.set({ adoffShowCounter: settingCounter.checked });
  });

  if (settingVideoCompat) {
    settingVideoCompat.addEventListener("change", () => {
      chrome.storage.local.set({ adoffYtCompat: settingVideoCompat.checked });
    });
  }

  // ===== PRIVACY NAV OPT-IN =====

  const navOptInToggle = document.getElementById("navOptInToggle");

  // Load toggle state on page load
  chrome.storage.local.get("adoffNavOptIn", (r) => {
    if (navOptInToggle) {
      navOptInToggle.checked = r.adoffNavOptIn === true;
    }
  });

  // Handle toggle changes
  if (navOptInToggle) {
    navOptInToggle.addEventListener("change", () => {
      const optIn = navOptInToggle.checked;
      chrome.storage.local.set({ adoffNavOptIn: optIn });
      chrome.runtime.sendMessage({ action: "navConsentChanged", optIn: optIn });
    });
  }

  // ===== WHITELIST =====

  const addSiteInput  = document.getElementById("addSiteInput");
  const btnAddSite    = document.getElementById("btnAddSite");
  const whitelistBody = document.getElementById("whitelistBody");
  const whitelistEmpty = document.getElementById("whitelistEmpty");
  const btnImportWl   = document.getElementById("btnImportWl");
  const btnExportWl   = document.getElementById("btnExportWl");
  const importWlFile  = document.getElementById("importWlFile");

  /** Render tabella whitelist. */
  function renderWhitelist() {
    whitelistBody.innerHTML = "";
    const active = cleanExpired(whitelist);
    if (active.length === 0) {
      whitelistEmpty.style.display = "block";
      return;
    }
    whitelistEmpty.style.display = "none";

    active.forEach((entry, idx) => {
      const tr = document.createElement("tr");

      // Badge tipo
      let badgeClass = "wl-type-badge ";
      const badgeText = TYPE_LABELS[entry.type] || entry.type;
      if (entry.type === "permanent") badgeClass += "permanent";
      else if (entry.type === "session") badgeClass += "session";
      else badgeClass += "timed";

      // EA-2: Costruzione DOM con textContent per prevenire XSS
      const tdDomain = document.createElement("td");
      const spanDomain = document.createElement("span");
      spanDomain.className = "wl-domain";
      spanDomain.textContent = entry.domain;
      tdDomain.appendChild(spanDomain);

      const tdType = document.createElement("td");
      const spanType = document.createElement("span");
      spanType.className = badgeClass;
      spanType.textContent = badgeText;
      tdType.appendChild(spanType);

      const tdDate = document.createElement("td");
      const spanDate = document.createElement("span");
      spanDate.className = "wl-date";
      spanDate.textContent = formatDate(entry.addedAt);
      tdDate.appendChild(spanDate);

      const tdAction = document.createElement("td");
      const btnRemove = document.createElement("button");
      btnRemove.className = "btn-remove";
      btnRemove.dataset.idx = String(idx);
      btnRemove.title = "Rimuovi";
      btnRemove.textContent = "\u2715";
      tdAction.appendChild(btnRemove);

      tr.appendChild(tdDomain);
      tr.appendChild(tdType);
      tr.appendChild(tdDate);
      tr.appendChild(tdAction);
      whitelistBody.appendChild(tr);
    });

    // Event delegation rimozione
    whitelistBody.querySelectorAll(".btn-remove").forEach((btn) => {
      btn.addEventListener("click", () => {
        const i = parseInt(btn.dataset.idx, 10);
        const active2 = cleanExpired(whitelist);
        const toRemove = active2[i];
        whitelist = whitelist.filter((e) => e !== toRemove);
        chrome.storage.local.set({ adoffWhitelist: whitelist }, renderWhitelist);
      });
    });
  }

  /** Aggiunge sito alla whitelist permanente. */
  function addSite(domain) {
    domain = domain.trim().replace(/^https?:\/\//, "").split("/")[0].toLowerCase();
    if (!domain) return;

    const alreadyExists = whitelist.some((e) => e.domain === domain);
    if (alreadyExists) {
      showToast("Sito gia' in lista.", "error");
      return;
    }

    whitelist.push({
      domain,
      type: "permanent",
      addedAt: Date.now(),
    });
    chrome.storage.local.set({ adoffWhitelist: whitelist }, () => {
      renderWhitelist();
      showToast("Sito aggiunto.", "success");
    });
  }

  btnAddSite.addEventListener("click", () => {
    addSite(addSiteInput.value);
    addSiteInput.value = "";
  });

  addSiteInput.addEventListener("keydown", (e) => {
    if (e.key === "Enter") {
      addSite(addSiteInput.value);
      addSiteInput.value = "";
    }
  });

  // Export whitelist
  btnExportWl.addEventListener("click", () => {
    downloadJSON({ whitelist }, "adoff-whitelist.json");
    showToast("Whitelist esportata.", "success");
  });

  // Import whitelist
  btnImportWl.addEventListener("click", () => importWlFile.click());

  importWlFile.addEventListener("change", () => {
    const file = importWlFile.files[0];
    if (!file) return;
    const reader = new FileReader();
    reader.onload = (e) => {
      try {
        const data = JSON.parse(e.target.result);
        if (!Array.isArray(data.whitelist)) throw new Error("Formato non valido");

        // EC-3: Validazione entry whitelist
        const VALID_TYPES = ["permanent", "session", "1hour", "1day"];
        const validEntries = data.whitelist.filter((entry) => {
          if (typeof entry.domain !== "string") return false;
          if (entry.domain.length === 0 || entry.domain.length > 255) return false;
          if (!VALID_TYPES.includes(entry.type)) return false;
          return true;
        });

        whitelist = validEntries;
        chrome.storage.local.set({ adoffWhitelist: whitelist }, () => {
          renderWhitelist();
          const skipped = data.whitelist.length - validEntries.length;
          if (skipped > 0) {
            showToast(`Whitelist importata. ${skipped} entr${skipped === 1 ? "y" : "ies"} non valid${skipped === 1 ? "a" : "e"} ignorat${skipped === 1 ? "a" : "e"}.`, "");
          } else {
            showToast("Whitelist importata.", "success");
          }
        });
      } catch (_) {
        showToast("File non valido.", "error");
      }
      importWlFile.value = "";
    };
    reader.readAsText(file);
  });

  // ===== LICENZA & AUTH =====

  const headerLicenseBadge = document.getElementById("headerLicenseBadge");
  const pricingCard        = document.getElementById("pricingCard");
  const proUpsellBanner    = document.getElementById("proUpsellBanner");
  const btnBannerClose     = document.getElementById("btnBannerClose");
  const proShowcaseSection = document.getElementById("proShowcaseSection");

  // Banner CTA account+Telegram: sempre visibile ad ogni apertura, chiusura solo per la sessione corrente
  if (btnBannerClose && proUpsellBanner) {
    btnBannerClose.addEventListener("click", () => {
      proUpsellBanner.style.display = "none";
    });
  }

  // Pro showcase: mostra solo se NON Pro/Trial
  function updateShowcaseVisibility(type) {
    if (!proShowcaseSection) return;
    const isProOrTrial = type === "pro" || type === "lifetime" || type === "trial";
    proShowcaseSection.style.display = isProOrTrial ? "none" : "block";
  }

  // Auth state elements (solo 2 stati: Pro attivo o No license)
  const stateProActive   = document.getElementById("stateProActive");
  const stateNotLoggedIn = document.getElementById("stateNotLoggedIn");

  /**
   * Normalizza l'oggetto licenza: il trial vive nella chiave storage
   * separata `adoffTrialEnd`, mentre `adoffLicense` contiene solo le
   * licenze Pro/Lifetime/Premium acquistate. Deriva `type`/`trialEndsAt` per la UI.
   * @param {object|undefined} lic
   * @param {number|undefined} trialEnd
   * @returns {object}
   */
  function normalizeLicense(lic, trialEnd) {
    const out = Object.assign({}, lic);
    // Il tipo passa dalla funzione canonica: è lì che si decide, ed è lì
    // che si tornerebbe indietro. Oggi vale sempre "premium".
    out.type = adoffPlanTier(out.plan);
    return out;
  }

  /**
   * Nasconde tutti gli stati auth e mostra solo quello richiesto.
   * @param {'pro'|'trial'|'none'|'premium'} state
   */
  function showAuthState(state) {
    stateProActive.style.display = state === "pro" || state === "premium" ? "block" : "none";
    const trialEl = document.getElementById("stateTrialActive");
    if (trialEl) trialEl.style.display = state === "trial" ? "block" : "none";
    stateNotLoggedIn.style.display = state === "none" ? "block" : "none";
    pricingCard.style.display = state !== "pro" && state !== "premium" ? "block" : "none";
    const t = state === "premium" ? "premium" : state === "pro" ? "pro" : state === "trial" ? "trial" : "free";
    updateShowcaseVisibility(t);
  }

  /**
   * Badge header. Non esistono piu' livelli di piano: tutto e' attivo per
   * tutti. Il badge distingue solo chi sostiene volontariamente il progetto.
   */
  function updateHeaderBadge() {
    const kind = adoffSupporterKind(license);
    if (kind === "founder") {
      headerLicenseBadge.textContent = i18n.t("popup.founder");
    } else if (kind === "supporter") {
      headerLicenseBadge.textContent = i18n.t("badge.supporter");
    } else {
      headerLicenseBadge.textContent = i18n.t("badge.allActive");
    }
    headerLicenseBadge.className = "license-badge-header premium";
  }

  /** Render sezione licenza: ora tutti sono premium, senza scadenza. */
  function renderLicenseSection() {
    updateHeaderBadge();


    // Premium section visibility
    const premiumShowcase = document.getElementById("premiumShowcaseSection");
    const premiumActive = document.getElementById("premiumActiveCard");
    if (premiumShowcase) premiumShowcase.style.display = "none";
    if (premiumActive) premiumActive.style.display = "block";

    // Tutti gli utenti vedono la sezione premium attivo
    showAuthState(adoffPlanTier(license.plan));
    // Il piano mostrato: chi ha licenza vede il suo piano, altrimenti "Tutto attivo"
    const planNameEl = document.getElementById("premiumPlanName");
    if (planNameEl) {
      planNameEl.textContent = i18n.t("badge.allActive");
    }
    // Nessuna scadenza: il supporto e' volontario
    const expiryEl = document.getElementById("premiumExpiry");
    if (expiryEl) expiryEl.textContent = i18n.t("badge.noExpiry");
    return;
  }

  /** Trial non piu' mostrato: tutto e' attivo di default. */
  function renderTrialState() {
    const el = document.getElementById("stateTrialActive");
    if (el) el.style.display = "none";
  }



  /**
   * Apre la pagina account su adoff.app per gestione account.
   */
  function openAccountPage() {
    chrome.tabs.create({ url: "https://adoff.app/account.html" });
  }

  /**
   * Avvia il checkout Stripe per il piano scelto.
   * @param {string} plan
   * @param {number} devices
   */
  async function purchasePlan(plan, devices) {
    try {
      // Recupera codice affiliato + sorgente self-reported (se presenti)
      const storage = await new Promise(resolve => chrome.storage.local.get(["adoffAffiliateCode", "adoffInstallSource"], resolve));
      const affiliate = storage.adoffAffiliateCode || null;
      const source = storage.adoffInstallSource || null;

      const controller = new AbortController();
      const tid = setTimeout(() => controller.abort(), 10000);
      const resp = await fetch(API_URL + "/checkout", {
        method:  "POST",
        headers: { "Content-Type": "application/json" },
        body:    JSON.stringify({ plan, devices, lang: "auto", affiliate, source }),
        signal:  controller.signal,
      }).then(r => r.json()).finally(() => clearTimeout(tid));

      if (resp.url) {
        chrome.tabs.create({ url: resp.url });
      } else {
        showToast("Errore checkout. Riprova.", "error");
      }
    } catch (_) {
      showToast("Errore di connessione. Riprova.", "error");
    }
  }

  /**
   * Attiva una raw license key tramite LicenseClient e aggiorna lo stato.
   * @param {string} rawKey
   */
  async function activateLicenseKeyRaw(rawKey) {
    try {
      if (typeof LicenseClient !== "undefined" && typeof LicenseClient.activate === "function") {
        await LicenseClient.activate(rawKey);
      }
    } catch (_) { /* best effort */ }
    chrome.storage.local.get("adoffLicense", (stored) => {
      license = stored.adoffLicense || license;
      renderLicenseSection();
    });
  }

  /**
   * Valida e attiva una license key tramite LicenseClient (Stato A).
   * @param {string} key
   */
  async function activateLicenseKey(key) {
    key = key.trim().toUpperCase();
    const licenseFeedback = document.getElementById("licenseFeedback");
    const btnActivateLicense = document.getElementById("btnActivateLicense");
    const pattern = /^(ADOFF-)?[A-Z0-9]{4}-[A-Z0-9]{4}-[A-Z0-9]{4}(-[A-Z0-9]{4})?$/;
    if (!pattern.test(key)) {
      licenseFeedback.textContent = "Formato chiave non valido (es. ADOFF-XXXX-XXXX-XXXX).";
      licenseFeedback.className   = "license-feedback error";
      return;
    }
    if (/^[A-Z0-9]{4}-[A-Z0-9]{4}-[A-Z0-9]{4}$/.test(key)) key = "ADOFF-" + key;

    btnActivateLicense.disabled = true;
    licenseFeedback.textContent = "Attivazione in corso...";
    licenseFeedback.className   = "license-feedback";

    try {
      if (typeof LicenseClient === "undefined" || typeof LicenseClient.activate !== "function") {
        throw new Error("LicenseClient non disponibile");
      }
      const result = await LicenseClient.activate(key);
      if (result.success) {
        chrome.storage.local.get("adoffLicense", (stored) => {
          license = stored.adoffLicense || {
            valid: true, type: "pro", plan: result.plan || "Pro",
            rawKey: key, activatedAt: Date.now(),
          };
          licenseFeedback.textContent = "Licenza attivata con successo!";
          licenseFeedback.className   = "license-feedback success";
          renderLicenseSection();
          showToast("Licenza attivata.", "success");
        });
      } else {
        licenseFeedback.textContent = result.error || "Attivazione fallita. Verifica la chiave.";
        licenseFeedback.className   = "license-feedback error";
      }
    } catch (_) {
      licenseFeedback.textContent = "Errore di connessione. Riprova o contattaci su adoff.app/support.";
      licenseFeedback.className   = "license-feedback error";
    } finally {
      btnActivateLicense.disabled = false;
    }
  }

  // ===== LICENSE UI WIRING =====

  // License key activation (Stato A - No license)
  const btnActivateLicenseEl = document.getElementById("btnActivateLicense");
  const licenseKeyInputEl    = document.getElementById("licenseKeyInput");
  if (btnActivateLicenseEl) {
    btnActivateLicenseEl.addEventListener("click", () => activateLicenseKey(licenseKeyInputEl.value));
  }
  if (licenseKeyInputEl) {
    licenseKeyInputEl.addEventListener("keydown", (e) => {
      if (e.key === "Enter") activateLicenseKey(licenseKeyInputEl.value);
    });
  }

  // Gestisci dispositivi (Stato B - Pro attivo)
  const btnManageDevices = document.getElementById("btnManageDevices");
  if (btnManageDevices) {
    btnManageDevices.addEventListener("click", openAccountPage);
  }

  // Stato T - Trial attivo: scroll a pricing per upgrade
  const btnTrialUpgrade = document.getElementById("btnTrialUpgrade");
  if (btnTrialUpgrade) {
    btnTrialUpgrade.addEventListener("click", () => {
      const pc = document.getElementById("pricingCard");
      if (pc) pc.scrollIntoView({ behavior: "smooth", block: "start" });
    });
  }
  const btnTrialHaveKey = document.getElementById("btnTrialHaveKey");
  if (btnTrialHaveKey) {
    btnTrialHaveKey.addEventListener("click", () => {
      // Mostra lo stato "No license" temporaneamente per far inserire la key
      showAuthState("none");
      const input = document.getElementById("licenseKeyInput");
      if (input) { input.focus(); input.scrollIntoView({ behavior: "smooth", block: "center" }); }
    });
  }

  // Refresh countdown trial ogni 60 secondi se siamo nello stato trial
  setInterval(() => {
    if (license && license.type === "trial" && license.trialEndsAt) {
      const stillTrial = license.trialEndsAt > Date.now();
      if (stillTrial) {
        renderTrialState();
        updateHeaderBadge("trial");
      } else {
        // Trial scaduto durante la sessione: rileggi storage
        chrome.storage.local.get(["adoffLicense", "adoffTrialEnd"], (r) => {
          license = normalizeLicense(r.adoffLicense || {}, r.adoffTrialEnd);
          renderLicenseSection();
        });
      }
    }
  }, 60_000);

  // Disattiva su questo device (Stato B)
  const btnDeactivateDevice = document.getElementById("btnDeactivateDevice");
  if (btnDeactivateDevice) {
    btnDeactivateDevice.addEventListener("click", async () => {
      if (!confirm("Rimuovere AdOff Pro da questo dispositivo?")) return;
      try {
        if (typeof LicenseClient !== "undefined" && typeof LicenseClient.deactivate === "function") {
          await LicenseClient.deactivate();
        } else {
          // Fallback: cancella licenza locale
          await new Promise(resolve => chrome.storage.local.remove("adoffLicense", resolve));
        }
      } catch (_) { /* best effort */ }
      license = { type: "free" };
      renderLicenseSection();
      showToast("Dispositivo rimosso.", "success");
    });
  }

  // Pricing device selector (Stato A — main pricing card)
  document.querySelectorAll("#pricingCard .pricing-device-btn").forEach((btn) => {
    btn.addEventListener("click", () => {
      document.querySelectorAll("#pricingCard .pricing-device-btn").forEach(b => b.classList.remove("active"));
      btn.classList.add("active");
      const devices = parseInt(btn.dataset.devices, 10);
      // Aggiorna prezzi nella pricing card principale
      document.getElementById("priceMonthly").textContent  = PRICES.monthly[devices]  || PRICES.monthly[3];
      document.getElementById("priceAnnual").textContent   = PRICES.annual[devices]   || PRICES.annual[3];
      document.getElementById("priceLifetime").textContent = PRICES.lifetime[devices] || PRICES.lifetime[3];
    });
  });

  // Buy buttons nella pricing card principale
  document.querySelectorAll("#pricingCard .pricing-buy-btn").forEach((btn) => {
    btn.addEventListener("click", () => {
      const plan = btn.dataset.plan;
      const activeDevBtn = document.querySelector("#pricingCard .pricing-device-btn.active");
      const devices = activeDevBtn ? parseInt(activeDevBtn.dataset.devices, 10) : 3;
      purchasePlan(plan, devices);
    });
  });

  // ===== STATISTICHE =====

  const statAds = document.getElementById("statAds");
  const statReq = document.getElementById("statReq");
  const btnResetStats = document.getElementById("btnResetStats");

  function renderStats(ads, req) {
    statAds.textContent = formatCount(ads);
    statReq.textContent = formatCount(req);
  }
  const statsChart = document.getElementById("statsChart");
  const statsChartMeta = document.getElementById("statsChartMeta");
  const statsTabs = document.querySelectorAll(".stats-tab");

  let currentPeriod = "today";
  let chartData = { labels: [], ads: [], req: [] };

  // Formatta data ISO "YYYY-MM-DD" → label leggibile
  function fmtDate(iso) {
    const d = new Date(iso + "T00:00:00");
    return d.toLocaleDateString(undefined, { day: "2-digit", month: "short" });
  }

  // Prepara dati per un periodo
  function prepareChartData(daily, period) {
    const today = new Date().toISOString().slice(0, 10);
    const labels = [], ads = [], req = [];

    if (!daily || Object.keys(daily).length === 0) {
      return { labels, ads, req };
    }

    const sorted = Object.keys(daily).sort();
    let startDate = null;

    if (period === "today") {
      startDate = today;
    } else if (period === "week") {
      const d = new Date(); d.setDate(d.getDate() - 6);
      startDate = d.toISOString().slice(0, 10);
    } else if (period === "month") {
      const d = new Date(); d.setDate(d.getDate() - 29);
      startDate = d.toISOString().slice(0, 10);
    } else if (period === "year") {
      const d = new Date(); d.setDate(d.getDate() - 364);
      startDate = d.toISOString().slice(0, 10);
    } else { // all
      startDate = sorted[0] || today;
    }

    // ponytail: sparse sampling per grafici lunghi (mantiene forma senza 90 punti)
    const days = sorted.filter(d => d >= startDate && d <= today);
    const step = period === "year" || period === "all"
      ? Math.max(1, Math.floor(days.length / 30))
      : 1;

    for (let i = 0; i < days.length; i += step) {
      const day = days[i];
      labels.push(fmtDate(day));
      ads.push(daily[day]?.ads || 0);
      req.push(daily[day]?.req || 0);
    }
    return { labels, ads, req };
  }

  // Disegna curva smooth sul canvas
  function drawChart(canvas, labels, ads, req) {
    const ctx = canvas.getContext("2d");
    const W = canvas.width = canvas.offsetWidth * 2;
    const H = canvas.height = canvas.offsetHeight * 2;
    ctx.scale(2, 2);
    const w = canvas.offsetWidth;
    const h = canvas.offsetHeight;

    ctx.clearRect(0, 0, w, h);

    const maxVal = Math.max(1, ...ads, ...req);
    const padX = 8, padY = 8;
    const chartW = w - padX * 2;
    const chartH = h - padY * 2;

    function scaleX(i) { return padX + (i / Math.max(1, labels.length - 1)) * chartW; }
    function scaleY(v)  { return padY + chartH - (v / maxVal) * chartH; }

    function fillCurve(vals, color) {
      ctx.beginPath();
      vals.forEach((v, i) => {
        const x = scaleX(i), y = scaleY(v);
        if (i === 0) ctx.moveTo(x, scaleY(0));
        ctx.lineTo(x, y);
      });
      ctx.lineTo(scaleX(vals.length - 1), scaleY(0));
      ctx.closePath();
      ctx.fillStyle = color;
      ctx.fill();
    }

    function strokeCurve(vals, color, width) {
      if (vals.length < 2) return;
      ctx.beginPath();
      ctx.strokeStyle = color;
      ctx.lineWidth = width;
      ctx.lineJoin = "round";
      ctx.lineCap = "round";
      vals.forEach((v, i) => {
        const x = scaleX(i), y = scaleY(v);
        if (i === 0) ctx.moveTo(x, y);
        else {
          const px = scaleX(i - 1), py = scaleY(vals[i - 1]);
          const mx = (px + x) / 2;
          ctx.bezierCurveTo(mx, py, mx, y, x, y);
        }
      });
      ctx.stroke();
    }

    fillCurve(req, "rgba(114, 82, 248, 0.08)");
    fillCurve(ads, "rgba(52, 152, 219, 0.12)");
    strokeCurve(req, "#7252f8", 1.5);
    strokeCurve(ads, "#3498db", 2);

    function drawDots(vals, color) {
      vals.forEach((v, i) => {
        if (v === 0) return;
        ctx.beginPath();
        ctx.arc(scaleX(i), scaleY(v), 3, 0, Math.PI * 2);
        ctx.fillStyle = color;
        ctx.fill();
      });
    }
    drawDots(ads, "#3498db");
    drawDots(req, "#7252f8");

    ctx.strokeStyle = "rgba(0,0,0,0.06)";
    ctx.lineWidth = 1;
    for (let t = 0; t <= 4; t++) {
      const y = padY + (chartH / 4) * t;
      ctx.beginPath();
      ctx.moveTo(padX, y);
      ctx.lineTo(w - padX, y);
      ctx.stroke();
    }

    const labelStep = Math.max(1, Math.floor(labels.length / 6));
    ctx.fillStyle = "rgba(100,100,100,0.6)";
    ctx.font = "10px system-ui, sans-serif";
    ctx.textAlign = "center";
    labels.forEach((l, i) => {
      if (i % labelStep === 0 || i === labels.length - 1) {
        ctx.fillText(l, scaleX(i), h - 2);
      }
    });
  }

  function loadAndRenderChart(period) {
    chrome.storage.local.get("adoffDailyStats", (result) => {
      const daily = result.adoffDailyStats || {};
      const data = prepareChartData(daily, period);
      chartData = data;

      if (data.labels.length === 0) {
        statsChartMeta.textContent = "";
        statsChartMeta.setAttribute("data-honest", "Nessuno storico disponibile. I dati appariranno da domani.");
        const ctx = statsChart.getContext("2d");
        ctx.clearRect(0, 0, statsChart.offsetWidth, statsChart.offsetHeight);
        return;
      }

      const firstDay = data.labels[0];
      const lastDay = data.labels[data.labels.length - 1];
      const totalPeriodAds = data.ads.reduce((a, b) => a + b, 0);
      const totalPeriodReq = data.req.reduce((a, b) => a + b, 0);
      statsChartMeta.textContent = `Dal ${firstDay} al ${lastDay} · ${formatCount(totalPeriodAds)} ads · ${formatCount(totalPeriodReq)} richieste`;
      statsChartMeta.removeAttribute("data-honest");
      drawChart(statsChart, data.labels, data.ads, data.req);
    });
  }

  // Tab switching
  statsTabs.forEach((tab) => {
    tab.addEventListener("click", () => {
      statsTabs.forEach((t) => t.classList.remove("active"));
      tab.classList.add("active");
      currentPeriod = tab.dataset.period;
      loadAndRenderChart(currentPeriod);
    });
  });

  // Re-render on window resize
  window.addEventListener("resize", () => {
    if (document.getElementById("sec-statistiche")?.style.display !== "none") {
      loadAndRenderChart(currentPeriod);
    }
  });

  btnResetStats.addEventListener("click", () => {
    if (!confirm("Resetta le statistiche?")) return;
    chrome.storage.local.set({ adoffAdsBlocked: 0, adoffReqBlocked: 0, adoffDailyStats: {} }, () => {
      renderStats(0, 0);
      chartData = { labels: [], ads: [], req: [] };
      loadAndRenderChart(currentPeriod);
      showToast("Statistiche azzerate.", "success");
    });
  });

  // Load initial stats
  chrome.storage.local.get(["adoffAdsBlocked", "adoffReqBlocked", "adoffDailyStats"], (r) => {
    renderStats(r.adoffAdsBlocked || 0, r.adoffReqBlocked || 0);
    loadAndRenderChart(currentPeriod);
  });

  // ===== AVANZATE =====

  const btnExportAll  = document.getElementById("btnExportAll");
  const btnImportAll  = document.getElementById("btnImportAll");
  const importAllFile = document.getElementById("importAllFile");
  const btnResetAll   = document.getElementById("btnResetAll");

  /** Esporta tutte le impostazioni come JSON. */
  btnExportAll.addEventListener("click", () => {
    chrome.storage.local.get(null, (all) => {
      downloadJSON(all, "adoff-backup.json");
      showToast("Backup esportato.", "success");
    });
  });

  /** Importa impostazioni da file JSON. */
  btnImportAll.addEventListener("click", () => importAllFile.click());

  importAllFile.addEventListener("change", () => {
    const file = importAllFile.files[0];
    if (!file) return;
    const reader = new FileReader();
    reader.onload = (e) => {
      try {
        const raw = JSON.parse(e.target.result);

        // EC-1: Filtra campi sensibili di licenza prima dell'import
        const LICENSE_FIELDS_BLOCKED = [
          "adoffLicense", "adoffIntegrity", "adoffTrialEnd", "adoffTrialExpired", "license",
        ];
        let licenseFieldFound = false;
        const data = {};
        for (const [k, v] of Object.entries(raw)) {
          if (LICENSE_FIELDS_BLOCKED.some((blocked) => k === blocked || k.startsWith(blocked))) {
            licenseFieldFound = true;
          } else {
            data[k] = v;
          }
        }

        chrome.storage.local.set(data, () => {
          if (licenseFieldFound) {
            showToast("Impostazioni importate. Le impostazioni di licenza non possono essere importate per sicurezza.", "");
          } else {
            showToast("Impostazioni importate. Ricarica per applicare.", "success");
          }
          importAllFile.value = "";
          loadAll(); // Ricarica stato
        });
      } catch (_) {
        showToast("File non valido.", "error");
        importAllFile.value = "";
      }
    };
    reader.readAsText(file);
  });

  /** Resetta tutto. */
  btnResetAll.addEventListener("click", () => {
    if (!confirm("Cancellare TUTTE le impostazioni e la licenza? Questa operazione e' irreversibile.")) return;
    chrome.storage.local.clear(() => {
      whitelist = [];
      license   = { type: "free" };
      loadAll();
      showToast("Reset completato.", "success");
    });
  });

  // ===== CARICAMENTO GLOBALE =====

  /** Carica tutto lo storage e aggiorna tutti i pannelli. */
  function loadAll() {
    chrome.storage.local.get(null, (r) => {
      // Whitelist
      const raw = Array.isArray(r.adoffWhitelist) ? r.adoffWhitelist : [];
      whitelist = cleanExpired(raw);
      if (whitelist.length !== raw.length) {
        chrome.storage.local.set({ adoffWhitelist: whitelist });
      }

      // Licenza — il trial vive in `adoffTrialEnd` (chiave separata),
      // `adoffLicense` contiene solo Pro/Lifetime acquistate.
      license = normalizeLicense(r.adoffLicense || r.license, r.adoffTrialEnd);

      // Render sections
      loadGenerali();
      renderWhitelist();
      renderLicenseSection();
      renderStats(r.adoffAdsBlocked || 0, r.adoffReqBlocked || 0);
      loadSuggestions();
      loadReferral();
      loadThemes(r.adoffTheme);
      loadImageSwap(r.adoffImageSwap);

      // Background revalidate: se l'utente ha una licenza attiva, ricontrolla col server.
      // Permette il rilevamento quasi immediato di licenze revocate/eliminate dall'admin
      // senza aspettare REVALIDATE_INTERVAL.
      if (license && license.valid && license.rawKey
          && typeof LicenseClient !== "undefined"
          && typeof LicenseClient.validateOnline === "function") {
        LicenseClient.validateOnline(license.rawKey).then(() => {
          chrome.storage.local.get("adoffLicense", (s) => {
            const fresh = s.adoffLicense || {};
            if (fresh.valid !== license.valid || fresh.plan !== license.plan) {
              license = fresh;
              renderLicenseSection();
            }
          });
        }).catch(() => {});
      }
    });
  }

  
  // ===== MESSAGGI (thread persistente col supporto AdOff) =====

  const MSG_API          = "https://api.adoff.app/messages";
  const MSG_LANGS        = ["it", "en", "de", "fr", "es", "pt"];
  const MSG_EMAIL_RX     = /^[^\s@]+@[^\s@]+\.[^\s@]+$/;
  const MSG_ATTACH_TYPES = ["image/jpeg", "image/png", "image/webp"];
  const MSG_ATTACH_MAX_BYTES = 5 * 1024 * 1024;

  const msgEmailGate     = document.getElementById("msgEmailGate");
  const msgEmailInput    = document.getElementById("msgEmailInput");
  const btnMsgEmailSave  = document.getElementById("btnMsgEmailSave");
  const msgThreadArea    = document.getElementById("msgThreadArea");
  const msgMessages      = document.getElementById("msgMessages");
  const msgInput         = document.getElementById("msgInput");
  const btnMsgSend       = document.getElementById("btnMsgSend");
  const msgAttachInput   = document.getElementById("msgAttachInput");
  const msgAttachPreview = document.getElementById("msgAttachPreview");
  const faqTopics        = document.getElementById("faqTopics");

  let msgBusy = false;
  let msgLoaded = false;
  let msgPendingAttachment = null; // { base64, type }

  /**
   * EA-5: Sanitizza HTML permettendo solo tag sicuri in allowlist.
   * Rimuove tutti i tag non in allowlist e tutti gli attributi event handler.
   * @param {string} html
   * @returns {string}
   */
  function sanitizeHtml(html) {
    const ALLOWED_TAGS = ["b", "br", "a", "strong", "ol", "li", "p", "code"];
    return html
      .replace(/\s+on\w+\s*=\s*(?:"[^"]*"|'[^']*'|[^\s>]*)/gi, "")
      .replace(/href\s*=\s*(?:"javascript:[^"]*"|'javascript:[^']*')/gi, 'href="#"')
      .replace(/<\/?([a-zA-Z][a-zA-Z0-9]*)\b[^>]*>/gi, (match, tag) => {
        if (ALLOWED_TAGS.includes(tag.toLowerCase())) return match;
        return "";
      });
  }

  /**
   * Converte testo semplice (risposta AI/admin) in HTML con link cliccabili.
   * Escape anti-XSS, poi markdown [label](url) + URL nudi + dominio adoff.app.
   * L'output passa comunque da sanitizeHtml in addMsgBubble.
   * @param {string} text
   * @returns {string}
   */
  function linkifyText(text) {
    var s = String(text)
      .replace(/&/g, "&amp;").replace(/</g, "&lt;").replace(/>/g, "&gt;").replace(/"/g, "&quot;");
    s = s.replace(/\[([^\]]+)\]\((https?:\/\/[^\s)]+)\)/g, function (_, label, url) {
      return '<a href="' + url + '" target="_blank" rel="noopener noreferrer">' + label + "</a>";
    });
    s = s.replace(/(^|[^"=\/>])(https?:\/\/[^\s<]+)/g, function (m, pre, url) {
      var trail = ""; var mm = url.match(/[.,;:!?)]+$/); if (mm) { trail = mm[0]; url = url.slice(0, -trail.length); }
      return pre + '<a href="' + url + '" target="_blank" rel="noopener noreferrer">' + url + "</a>" + trail;
    });
    s = s.replace(/(^|[\s(>])((?:www\.)?adoff\.app[^\s<]*)/g, function (m, pre, dom) {
      var trail = ""; var mm = dom.match(/[.,;:!?)]+$/); if (mm) { trail = mm[0]; dom = dom.slice(0, -trail.length); }
      return pre + '<a href="https://' + dom + '" target="_blank" rel="noopener noreferrer">' + dom + "</a>" + trail;
    });
    return s.replace(/\n/g, "<br>");
  }

  function msgLang() {
    let l = "en";
    try { l = (i18n.getLang && i18n.getLang()) || "en"; } catch (e) {}
    l = String(l).slice(0, 2).toLowerCase();
    return MSG_LANGS.includes(l) ? l : "en";
  }

  function addMsgBubble(text, sender, attachmentUrl) {
    const bubble = document.createElement("div");
    bubble.className = "chat-bubble " + (sender === "user" ? "user" : "bot");
    if (sender === "user") {
      bubble.textContent = text || "";
    } else {
      bubble.innerHTML = sanitizeHtml(linkifyText(text || ""));
      bubble.querySelectorAll("a[data-scroll-to]").forEach((link) => {
        link.addEventListener("click", (evt) => {
          evt.preventDefault();
          const target = document.getElementById(link.dataset.scrollTo);
          if (target) target.scrollIntoView({ behavior: "smooth" });
        });
      });
    }
    if (attachmentUrl) {
      const img = document.createElement("img");
      img.src = attachmentUrl;
      img.className = "chat-attachment-img";
      bubble.appendChild(img);
    }
    msgMessages.appendChild(bubble);
    msgMessages.scrollTop = msgMessages.scrollHeight;
  }

  function renderMsgThread(messages) {
    msgMessages.innerHTML = "";
    if (!messages || !messages.length) {
      addMsgBubble(i18n.t("msg.greeting"), "bot");
      return;
    }
    messages.forEach((m) => addMsgBubble(m.text, m.sender, m.attachmentUrl));
  }

  function showMsgEmailGate() {
    msgEmailGate.style.display = "flex";
    msgThreadArea.style.display = "none";
  }

  function showMsgThreadArea() {
    msgEmailGate.style.display = "none";
    msgThreadArea.style.display = "block";
  }

  async function loadMessagesTab() {
    if (msgLoaded) return;
    msgLoaded = true;
    const stored = await new Promise((resolve) => {
      chrome.storage.local.get(["adoffUserEmail", "adoffMsgThreadId", "adoffMsgThreadToken"], resolve);
    });
    if (!stored.adoffUserEmail) { showMsgEmailGate(); return; }
    showMsgThreadArea();
    if (!stored.adoffMsgThreadId || !stored.adoffMsgThreadToken) { renderMsgThread([]); return; }
    try {
      const url = MSG_API + "/" + encodeURIComponent(stored.adoffMsgThreadId) +
        "?token=" + encodeURIComponent(stored.adoffMsgThreadToken);
      const res = await fetch(url);
      const d = await res.json();
      if (d && d.ok) {
        renderMsgThread(d.messages);
        chrome.storage.local.set({ adoffUnreadMessages: 0 });
      } else {
        renderMsgThread([]);
      }
    } catch (e) {
      renderMsgThread([]);
    }
  }

  btnMsgEmailSave.addEventListener("click", () => {
    const email = (msgEmailInput.value || "").trim().toLowerCase();
    if (!MSG_EMAIL_RX.test(email)) { showToast(i18n.t("msg.emailInvalid"), "error"); return; }
    chrome.storage.local.set({ adoffUserEmail: email }, () => {
      msgLoaded = false;
      loadMessagesTab();
    });
  });

  function readFileAsBase64(file) {
    return new Promise((resolve, reject) => {
      const reader = new FileReader();
      reader.onload = () => resolve(String(reader.result).split(",")[1] || "");
      reader.onerror = () => reject(reader.error);
      reader.readAsDataURL(file);
    });
  }

  function clearMsgAttachment() {
    msgPendingAttachment = null;
    msgAttachInput.value = "";
    msgAttachPreview.style.display = "none";
    msgAttachPreview.innerHTML = "";
  }

  msgAttachInput.addEventListener("change", async () => {
    const file = msgAttachInput.files[0];
    if (!file) return;
    if (!MSG_ATTACH_TYPES.includes(file.type)) {
      showToast(i18n.t("msg.attachTypeError"), "error");
      msgAttachInput.value = "";
      return;
    }
    if (file.size > MSG_ATTACH_MAX_BYTES) {
      showToast(i18n.t("msg.attachSizeError"), "error");
      msgAttachInput.value = "";
      return;
    }
    try {
      const base64 = await readFileAsBase64(file);
      msgPendingAttachment = { base64, type: file.type };
      msgAttachPreview.innerHTML = "";
      msgAttachPreview.style.display = "flex";
      const thumb = document.createElement("img");
      thumb.src = "data:" + file.type + ";base64," + base64;
      thumb.className = "chat-attachment-thumb";
      const removeBtn = document.createElement("button");
      removeBtn.textContent = "×";
      removeBtn.className = "chat-attachment-remove";
      removeBtn.addEventListener("click", clearMsgAttachment);
      msgAttachPreview.appendChild(thumb);
      msgAttachPreview.appendChild(removeBtn);
    } catch (e) {
      showToast(i18n.t("msg.attachTypeError"), "error");
      clearMsgAttachment();
    }
  });

  async function sendMessage(rawText) {
    const text = (rawText != null ? rawText : msgInput.value).trim();
    if (!text || msgBusy) return;
    const stored = await new Promise((resolve) => {
      chrome.storage.local.get(["adoffUserEmail", "adoffMsgThreadId"], resolve);
    });
    if (!stored.adoffUserEmail) { showMsgEmailGate(); return; }

    msgBusy = true;
    const attachment = msgPendingAttachment;
    addMsgBubble(text, "user", attachment ? ("data:" + attachment.type + ";base64," + attachment.base64) : null);
    if (rawText == null) msgInput.value = "";

    const payload = { email: stored.adoffUserEmail, text, lang: msgLang(), turnstileToken: "extension" };
    if (stored.adoffMsgThreadId) payload.threadId = stored.adoffMsgThreadId;
    if (attachment) { payload.attachmentBase64 = attachment.base64; payload.attachmentType = attachment.type; }

    const ctrl = new AbortController();
    const to = setTimeout(() => ctrl.abort(), 30000);
    try {
      const res = await fetch(MSG_API, {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify(payload),
        signal: ctrl.signal,
      });
      clearTimeout(to);
      const d = await res.json();
      msgBusy = false;
      if (!d || !d.ok) {
        showToast(i18n.t("msg.sendError"), "error");
        if (rawText == null) msgInput.value = text;
        return;
      }
      clearMsgAttachment();
      chrome.storage.local.set({ adoffMsgThreadId: d.threadId, adoffMsgThreadToken: d.threadToken });
      if (d.reply) addMsgBubble(d.reply, "bot");
    } catch (e) {
      clearTimeout(to);
      msgBusy = false;
      showToast(i18n.t("msg.sendError"), "error");
      if (rawText == null) msgInput.value = text;
    }
  }

  btnMsgSend.addEventListener("click", () => sendMessage());
  msgInput.addEventListener("keydown", (e) => { if (e.key === "Enter") sendMessage(); });

  faqTopics.querySelectorAll(".faq-chip").forEach((chip) => {
    chip.addEventListener("click", () => sendMessage((chip.textContent || "").trim()));
  });

  const msgNavItem = document.querySelector('.nav-item[data-section="aiuto"]');
  if (msgNavItem) msgNavItem.addEventListener("click", loadMessagesTab);
  if (location.hash === "#aiuto") loadMessagesTab();
// ===== SEGNALAZIONE SITO (TELEGRAM) =====

  // Backend AdOff (license-api): ticket -> KV + notifica Telegram
  const WORKER_BASE     = "https://api.adoff.app";
  const REPORT_ENDPOINT = WORKER_BASE + "/ticket";
  const SUGGEST_ENDPOINT = WORKER_BASE + "/ticket";

  // Anti-abuse: limiti
  const MAX_REPORTS_PER_HOUR = 3;
  const COOLDOWN_MS          = 2000; // 2s prima di abilitare il bottone

  const reportUrl       = document.getElementById("reportUrl");
  const reportDesc      = document.getElementById("reportDesc");
  const reportEmail     = document.getElementById("reportEmail");
  const reportHoneypot  = document.getElementById("reportWebsite");
  const btnSendReport   = document.getElementById("btnSendReport");
  const reportFeedback  = document.getElementById("reportFeedback");
  const captchaQuestion = document.getElementById("captchaQuestion");
  const captchaAnswer   = document.getElementById("captchaAnswer");
  const reportLimitInfo = document.getElementById("reportLimitInfo");
  let reportType        = "broken";
  let captchaA          = 0;
  let captchaB          = 0;
  let formOpenedAt      = 0;

  const REPORT_TYPE_LABELS = {
    broken:        "Sito non funziona",
    "ads-visible": "Ads ancora visibili",
    antiblock:     "Anti-adblock",
    other:         "Altro",
  };

  // --- CAPTCHA math ---

  /** Genera un nuovo captcha matematico. */
  function generateCaptcha() {
    captchaA = Math.floor(Math.random() * 20) + 1;
    captchaB = Math.floor(Math.random() * 15) + 1;
    // Alterna tra + e x per variare
    if (Math.random() > 0.5) {
      captchaQuestion.textContent = captchaA + " + " + captchaB;
      captchaQuestion.dataset.answer = String(captchaA + captchaB);
    } else {
      // Usa numeri piccoli per la moltiplicazione
      const a = Math.floor(Math.random() * 9) + 2;
      const b = Math.floor(Math.random() * 9) + 2;
      captchaQuestion.textContent = a + " \u00D7 " + b;
      captchaQuestion.dataset.answer = String(a * b);
    }
    captchaAnswer.value = "";
  }

  /** Verifica la risposta captcha. */
  function verifyCaptcha() {
    const userAnswer = captchaAnswer.value.trim();
    const expected   = captchaQuestion.dataset.answer;
    return userAnswer === expected;
  }

  // --- Rate limiting ---

  /**
   * Controlla se l'utente puo' inviare un'altra segnalazione.
   * @param {function} cb — callback con (canSend, remaining)
   */
  function checkRateLimit(cb) {
    chrome.storage.local.get("adoffReportTimestamps", (r) => {
      const now = Date.now();
      const oneHourAgo = now - 3600000;
      const timestamps = (Array.isArray(r.adoffReportTimestamps) ? r.adoffReportTimestamps : [])
        .filter((t) => t > oneHourAgo);
      const remaining = MAX_REPORTS_PER_HOUR - timestamps.length;
      cb(remaining > 0, remaining);
    });
  }

  /** Registra un nuovo invio nel rate limiter. */
  function recordSend() {
    chrome.storage.local.get("adoffReportTimestamps", (r) => {
      const now = Date.now();
      const oneHourAgo = now - 3600000;
      const timestamps = (Array.isArray(r.adoffReportTimestamps) ? r.adoffReportTimestamps : [])
        .filter((t) => t > oneHourAgo);
      timestamps.push(now);
      chrome.storage.local.set({ adoffReportTimestamps: timestamps });
    });
  }

  /** Aggiorna il contatore segnalazioni rimaste. */
  function updateLimitInfo() {
    checkRateLimit((canSend, remaining) => {
      if (remaining <= 1) {
        reportLimitInfo.textContent = remaining + " segnalazione rimasta quest'ora.";
        reportLimitInfo.className = "report-limit-info warn";
      } else {
        reportLimitInfo.textContent = remaining + " segnalazioni rimaste quest'ora.";
        reportLimitInfo.className = "report-limit-info";
      }
    });
  }

  // --- Cooldown bottone ---

  /** Abilita il bottone dopo COOLDOWN_MS. */
  function startButtonCooldown() {
    btnSendReport.disabled = true;
    formOpenedAt = Date.now();
    setTimeout(() => {
      btnSendReport.disabled = false;
    }, COOLDOWN_MS);
  }

  // Toggle tipo segnalazione
  document.querySelectorAll(".report-type-btn").forEach((btn) => {
    btn.addEventListener("click", () => {
      document.querySelectorAll(".report-type-btn").forEach((b) => b.classList.remove("active"));
      btn.classList.add("active");
      reportType = btn.dataset.type;
    });
  });

  // --- Filtro anti-spam testo ---

  // Pattern tastiera comuni (keyboard mashing)
  const KEYBOARD_PATTERNS = [
    "qwert", "asdfg", "zxcvb", "qazws", "poiuy", "lkjhg", "mnbvc",
    "12345", "09876", "aaaaa", "bbbbb", "abcde", "fghij",
  ];

  /**
   * Calcola il rapporto di vocali nel testo (testo reale ~35-50%).
   * @param {string} text
   * @returns {number} 0-1
   */
  function vowelRatio(text) {
    const letters = text.replace(/[^a-zA-Z\u00C0-\u024F]/g, "");
    if (letters.length < 3) return 0.5;
    const vowels = letters.match(/[aeiouAEIOUàèéìòùäëïöü]/g);
    return (vowels ? vowels.length : 0) / letters.length;
  }

  /**
   * Calcola l'entropia di Shannon del testo (caratteri unici vs totali).
   * Testo normale ~3.5-4.5 bit, spam/gibberish <2.0
   * @param {string} text
   * @returns {number}
   */
  function shannonEntropy(text) {
    if (text.length < 2) return 0;
    const freq = {};
    for (const ch of text.toLowerCase()) {
      freq[ch] = (freq[ch] || 0) + 1;
    }
    let entropy = 0;
    const len = text.length;
    for (const count of Object.values(freq)) {
      const p = count / len;
      entropy -= p * Math.log2(p);
    }
    return entropy;
  }

  /**
   * Controlla se il testo contiene caratteri ripetuti eccessivamente.
   * @param {string} text
   * @returns {boolean} true se spam
   */
  function hasExcessiveRepetition(text) {
    // Stesso carattere 4+ volte di fila: "aaaa", "!!!!"
    if (/(.)\1{3,}/i.test(text)) return true;
    // Stessa sequenza di 2-3 char ripetuta 3+ volte: "hahaha", "lalala"
    if (/(.{2,3})\1{2,}/i.test(text)) return true;
    return false;
  }

  /**
   * Controlla se il testo contiene pattern di keyboard mashing.
   * @param {string} text
   * @returns {boolean} true se spam
   */
  function hasKeyboardMashing(text) {
    const lower = text.toLowerCase().replace(/\s/g, "");
    return KEYBOARD_PATTERNS.some((p) => lower.includes(p));
  }

  /**
   * Controlla se le parole sono ripetute troppo.
   * @param {string} text
   * @returns {boolean} true se spam
   */
  function hasRepeatedWords(text) {
    const words = text.toLowerCase().split(/\s+/).filter((w) => w.length > 2);
    if (words.length < 4) return false;
    const unique = new Set(words);
    // Se >60% delle parole sono duplicati
    return (unique.size / words.length) < 0.4;
  }

  /**
   * Verifica se un URL ha formato plausibile.
   * @param {string} url
   * @returns {boolean}
   */
  function isPlausibleUrl(url) {
    // Deve contenere almeno un punto e nessun spazio
    if (!url.includes(".") || url.includes(" ")) return false;
    // Non puo' essere solo numeri/simboli
    if (!/[a-zA-Z]/.test(url)) return false;
    // TLD almeno 2 caratteri
    const parts = url.replace(/^https?:\/\//, "").split(".");
    const tld = parts[parts.length - 1].split("/")[0];
    return tld.length >= 2 && tld.length <= 20;
  }

  /**
   * Controlla se questa segnalazione e' un duplicato di una gia' inviata.
   * @param {string} url
   * @param {string} type
   * @param {function} cb — callback con (isDuplicate)
   */
  function checkDuplicate(url, type, cb) {
    chrome.storage.local.get("adoffReports", (r) => {
      const reports = Array.isArray(r.adoffReports) ? r.adoffReports : [];
      const oneDayAgo = Date.now() - 86400000;
      const isDup = reports.some((rep) =>
        rep.url === url && rep.type === type && rep.sentAt > oneDayAgo
      );
      cb(isDup);
    });
  }

  /**
   * Valida il testo contro tutti i filtri anti-spam.
   * @param {string} url
   * @param {string} desc
   * @returns {{valid: boolean, reason: string}}
   */
  function validateReportText(url, desc) {
    // --- Validazione URL ---
    if (!isPlausibleUrl(url)) {
      return { valid: false, reason: "URL non valido. Inserisci un dominio reale (es. example.com)." };
    }
    if (hasExcessiveRepetition(url)) {
      return { valid: false, reason: "URL non valido." };
    }
    if (hasKeyboardMashing(url)) {
      return { valid: false, reason: "URL non valido. Inserisci un sito reale." };
    }

    // --- Validazione descrizione (se presente) ---
    if (desc && desc.length > 0) {
      if (hasExcessiveRepetition(desc)) {
        return { valid: false, reason: "La descrizione contiene testo ripetuto. Scrivi una descrizione reale." };
      }
      if (hasKeyboardMashing(desc)) {
        return { valid: false, reason: "La descrizione sembra contenere testo casuale." };
      }
      if (hasRepeatedWords(desc)) {
        return { valid: false, reason: "La descrizione contiene troppe parole ripetute." };
      }
      // Entropia troppo bassa (testo tipo "aaa bbb ccc")
      if (desc.length > 10 && shannonEntropy(desc) < 2.0) {
        return { valid: false, reason: "La descrizione non sembra un testo reale." };
      }
      // Rapporto vocali anomalo (testo tipo "bcdfghjk" o "aeiouaeiou")
      const vr = vowelRatio(desc);
      if (desc.length > 10 && (vr < 0.1 || vr > 0.8)) {
        return { valid: false, reason: "La descrizione non sembra un testo reale." };
      }
    }

    return { valid: true, reason: "" };
  }

  /**
   * Invia una segnalazione a Telegram (con tutte le protezioni anti-bot).
   */
  async function sendReport() {
    const url = reportUrl.value.trim();

    // 1. Honeypot check — se compilato e' un bot
    if (reportHoneypot.value) {
      // Finge successo per non rivelare la protezione
      reportFeedback.textContent = "Segnalazione inviata! Grazie.";
      reportFeedback.className = "report-feedback success";
      return;
    }

    // 2. Timing check — troppo veloce = bot
    if (Date.now() - formOpenedAt < COOLDOWN_MS) {
      reportFeedback.textContent = "Attendi qualche secondo...";
      reportFeedback.className = "report-feedback error";
      return;
    }

    // 3. URL check
    if (!url) {
      reportFeedback.textContent = "Inserisci l'URL del sito.";
      reportFeedback.className = "report-feedback error";
      return;
    }

    // 4. Anti-spam text validation
    const desc = reportDesc.value.trim();
    const email = reportEmail.value.trim();
    const textCheck = validateReportText(url, desc);
    if (!textCheck.valid) {
      reportFeedback.textContent = textCheck.reason;
      reportFeedback.className = "report-feedback error";
      return;
    }

    // 5. Duplicate check
    checkDuplicate(url, reportType, (isDup) => {
      if (isDup) {
        reportFeedback.textContent = "Hai gia' segnalato questo sito oggi. Grazie!";
        reportFeedback.className = "report-feedback error";
        return;
      }
      proceedWithSend(url, desc, email);
    });
  }

  /**
   * Prosegue con l'invio dopo tutte le validazioni.
   */
  async function proceedWithSend(url, desc, email) {
    // 6. CAPTCHA check
    if (!verifyCaptcha()) {
      reportFeedback.textContent = "Risposta errata. Risolvi il calcolo per continuare.";
      reportFeedback.className = "report-feedback error";
      document.querySelector(".captcha-row").classList.add("error");
      setTimeout(() => document.querySelector(".captcha-row").classList.remove("error"), 500);
      generateCaptcha();
      return;
    }

    // 7. Rate limit check
    checkRateLimit(async (canSend, remaining) => {
      if (!canSend) {
        reportFeedback.textContent = "Limite raggiunto. Riprova tra un'ora.";
        reportFeedback.className = "report-feedback error";
        return;
      }

      // Blocca doppio invio
      btnSendReport.disabled = true;
      reportFeedback.textContent = "Invio in corso...";
      reportFeedback.className = "report-feedback sending";

      // EB-4: Fetch con AbortController e timeout 10s
      const reportController = new AbortController();
      const reportTimeoutId = setTimeout(() => reportController.abort(), 10000);
      try {
        const res = await fetch(REPORT_ENDPOINT, {
          method: "POST",
          headers: { "Content-Type": "application/json" },
          body: JSON.stringify({
            category: reportType,
            name: email ? email.split("@")[0] : "anon",
            email: email || "noreply+report@adoff.app",
            subject: "[Estensione] " + (REPORT_TYPE_LABELS[reportType] || reportType) + " — " + url,
            description: (desc || "(nessuna descrizione)") + "\n\nURL: " + url + "\nVersione: " + VERSION,
            browser: navigator.userAgent,
            turnstileToken: "extension",
          }),
          signal: reportController.signal,
        });
        clearTimeout(reportTimeoutId);

        if (res.status === 429) {
          reportFeedback.textContent = "Troppe segnalazioni. Riprova tra un'ora.";
          reportFeedback.className = "report-feedback error";
          btnSendReport.disabled = false;
          return;
        }

        if (res.ok) {
          reportFeedback.textContent = "Segnalazione inviata! Grazie.";
          reportFeedback.className = "report-feedback success";
          reportUrl.value   = "";
          reportDesc.value  = "";
          reportEmail.value = "";
          showToast("Segnalazione inviata!", "success");

          // Registra nel rate limiter
          recordSend();
          updateLimitInfo();

          // Salva anche localmente
          chrome.storage.local.get("adoffReports", (r) => {
            const reports = Array.isArray(r.adoffReports) ? r.adoffReports : [];
            reports.unshift({ url, type: reportType, desc, sentAt: Date.now() });
            chrome.storage.local.set({ adoffReports: reports });
          });

          // Rigenera captcha per il prossimo invio
          generateCaptcha();
          startButtonCooldown();
        } else {
          throw new Error("HTTP " + res.status);
        }
      } catch (err) {
        clearTimeout(reportTimeoutId);
        reportFeedback.textContent = "Errore di connessione. Riprova o contattaci su adoff.app/support.";
        reportFeedback.className = "report-feedback error";
        btnSendReport.disabled = false;
      }
    });
  }

  btnSendReport.addEventListener("click", sendReport);

  // Init protezioni
  generateCaptcha();
  startButtonCooldown();
  updateLimitInfo();

  // ===== SUGGERIMENTI =====

  const TYPE_ICONS = { feature: "\uD83D\uDCA1", bug: "\uD83D\uDC1B", improvement: "\u26A1" };
  const TYPE_NAMES = { feature: "Funzionalita'", bug: "Bug", improvement: "Miglioramento" };

  let suggestions   = [];
  let suggestType   = "feature";
  const suggestTitle   = document.getElementById("suggestTitle");
  const suggestDesc    = document.getElementById("suggestDesc");
  const suggestEmail   = document.getElementById("suggestEmail");
  const btnSubmitSuggest = document.getElementById("btnSubmitSuggest");
  const suggestList    = document.getElementById("suggestList");
  const suggestEmpty   = document.getElementById("suggestEmpty");

  // --- Anti-bot suggerimenti (honeypot + captcha + time-trap + rate-limit) ---
  const suggestHoneypot   = document.getElementById("suggestWebsite");
  const suggestCaptchaQ   = document.getElementById("suggestCaptchaQuestion");
  const suggestCaptchaA   = document.getElementById("suggestCaptchaAnswer");
  const suggestLimitInfo  = document.getElementById("suggestLimitInfo");
  const SUGGEST_MAX_PER_HOUR = 3;
  const SUGGEST_COOLDOWN_MS  = 2000; // tempo minimo prima di poter inviare
  let suggestFormOpenedAt    = 0;

  /** Genera un captcha matematico per il form suggerimenti. */
  function generateSuggestCaptcha() {
    if (!suggestCaptchaQ) return;
    if (Math.random() > 0.5) {
      const a = Math.floor(Math.random() * 20) + 1;
      const b = Math.floor(Math.random() * 15) + 1;
      suggestCaptchaQ.textContent = a + " + " + b;
      suggestCaptchaQ.dataset.answer = String(a + b);
    } else {
      const a = Math.floor(Math.random() * 9) + 2;
      const b = Math.floor(Math.random() * 9) + 2;
      suggestCaptchaQ.textContent = a + " × " + b;
      suggestCaptchaQ.dataset.answer = String(a * b);
    }
    if (suggestCaptchaA) suggestCaptchaA.value = "";
  }

  /** Verifica la risposta captcha suggerimenti. */
  function verifySuggestCaptcha() {
    if (!suggestCaptchaQ || !suggestCaptchaA) return true; // markup assente: non bloccare
    return suggestCaptchaA.value.trim() === suggestCaptchaQ.dataset.answer;
  }

  /** Rate-limit locale invii suggerimenti. cb(canSend, remaining). */
  function checkSuggestRateLimit(cb) {
    chrome.storage.local.get("adoffSuggestTimestamps", (r) => {
      const oneHourAgo = Date.now() - 3600000;
      const ts = (Array.isArray(r.adoffSuggestTimestamps) ? r.adoffSuggestTimestamps : [])
        .filter((t) => t > oneHourAgo);
      const remaining = SUGGEST_MAX_PER_HOUR - ts.length;
      cb(remaining > 0, remaining);
    });
  }

  /** Registra un invio suggerimento nel rate limiter locale. */
  function recordSuggestSend() {
    chrome.storage.local.get("adoffSuggestTimestamps", (r) => {
      const oneHourAgo = Date.now() - 3600000;
      const ts = (Array.isArray(r.adoffSuggestTimestamps) ? r.adoffSuggestTimestamps : [])
        .filter((t) => t > oneHourAgo);
      ts.push(Date.now());
      chrome.storage.local.set({ adoffSuggestTimestamps: ts });
    });
  }

  /** Aggiorna info limite + abilita/disabilita il bottone. */
  function updateSuggestLimitInfo() {
    checkSuggestRateLimit((canSend, remaining) => {
      if (suggestLimitInfo) {
        if (remaining <= 1) {
          suggestLimitInfo.textContent = Math.max(0, remaining) + " suggerimento rimasto quest'ora.";
          suggestLimitInfo.className = "report-limit-info warn";
        } else {
          suggestLimitInfo.textContent = remaining + " suggerimenti rimasti quest'ora.";
          suggestLimitInfo.className = "report-limit-info";
        }
      }
      if (!canSend) btnSubmitSuggest.disabled = true;
    });
  }

  /** Valida il testo del suggerimento contro i filtri anti-spam condivisi. */
  function validateSuggestText(title, desc) {
    if (hasExcessiveRepetition(title) || hasKeyboardMashing(title)) {
      return { valid: false, reason: "Il titolo non sembra un testo reale." };
    }
    if (desc && desc.length > 0) {
      if (hasExcessiveRepetition(desc) || hasKeyboardMashing(desc) || hasRepeatedWords(desc)) {
        return { valid: false, reason: "La descrizione sembra contenere testo casuale o ripetuto." };
      }
      if (desc.length > 10 && shannonEntropy(desc) < 2.0) {
        return { valid: false, reason: "La descrizione non sembra un testo reale." };
      }
      const vr = vowelRatio(desc);
      if (desc.length > 10 && (vr < 0.1 || vr > 0.8)) {
        return { valid: false, reason: "La descrizione non sembra un testo reale." };
      }
    }
    return { valid: true, reason: "" };
  }

  /** Inizializza l'anti-bot del form suggerimenti (captcha + cooldown + limite). */
  function initSuggestAntibot() {
    generateSuggestCaptcha();
    btnSubmitSuggest.disabled = true;
    suggestFormOpenedAt = Date.now();
    setTimeout(() => { btnSubmitSuggest.disabled = false; updateSuggestLimitInfo(); }, SUGGEST_COOLDOWN_MS);
    updateSuggestLimitInfo();
  }

  // Tipo suggerimento toggle
  document.querySelectorAll(".suggest-type-btn").forEach((btn) => {
    btn.addEventListener("click", () => {
      document.querySelectorAll(".suggest-type-btn").forEach((b) => b.classList.remove("active"));
      btn.classList.add("active");
      suggestType = btn.dataset.type;
    });
  });

  /** Render lista suggerimenti. */
  function renderSuggestions() {
    suggestList.innerHTML = "";
    if (suggestions.length === 0) {
      suggestEmpty.style.display = "block";
      return;
    }
    suggestEmpty.style.display = "none";

    suggestions.forEach((s, idx) => {
      const div = document.createElement("div");
      div.className = "suggest-item";

      // EA-3: Costruzione DOM con textContent per prevenire XSS
      const spanIcon = document.createElement("span");
      spanIcon.className = "suggest-item-type";
      spanIcon.textContent = TYPE_ICONS[s.type] || "\uD83D\uDCA1";

      const divBody = document.createElement("div");
      divBody.className = "suggest-item-body";

      const divTitle = document.createElement("div");
      divTitle.className = "suggest-item-title";
      divTitle.textContent = s.title;
      divBody.appendChild(divTitle);

      if (s.desc) {
        const divDesc = document.createElement("div");
        divDesc.className = "suggest-item-desc";
        divDesc.textContent = s.desc;
        divBody.appendChild(divDesc);
      }

      const divMeta = document.createElement("div");
      divMeta.className = "suggest-item-meta";
      divMeta.textContent = (TYPE_NAMES[s.type] || s.type) + " \u2014 " + formatDate(s.createdAt);
      divBody.appendChild(divMeta);

      const spanStatus = document.createElement("span");
      spanStatus.className = "suggest-item-status sent";
      spanStatus.textContent = "Inviato";

      const btnDelete = document.createElement("button");
      btnDelete.className = "suggest-item-delete";
      btnDelete.dataset.idx = String(idx);
      btnDelete.title = "Elimina";
      btnDelete.textContent = "\u2715";

      div.appendChild(spanIcon);
      div.appendChild(divBody);
      div.appendChild(spanStatus);
      div.appendChild(btnDelete);
      suggestList.appendChild(div);
    });

    suggestList.querySelectorAll(".suggest-item-delete").forEach((btn) => {
      btn.addEventListener("click", () => {
        const i = parseInt(btn.dataset.idx, 10);
        suggestions.splice(i, 1);
        chrome.storage.local.set({ adoffSuggestions: suggestions }, renderSuggestions);
      });
    });
  }

  /** Invia un nuovo suggerimento. */
  btnSubmitSuggest.addEventListener("click", async () => {
    const title = suggestTitle.value.trim();
    if (!title) {
      showToast("Inserisci un titolo per il suggerimento.", "error");
      return;
    }

    const desc = suggestDesc.value.trim();

    // --- Anti-bot ---
    // 1. Honeypot: se compilato e' un bot. Finge successo per non rivelare la protezione.
    if (suggestHoneypot && suggestHoneypot.value) {
      suggestTitle.value = ""; suggestDesc.value = ""; suggestEmail.value = "";
      showToast("Suggerimento inviato!", "success");
      return;
    }
    // 2. Time-trap: invio troppo rapido = bot.
    if (Date.now() - suggestFormOpenedAt < SUGGEST_COOLDOWN_MS) {
      showToast("Attendi qualche secondo prima di inviare.", "error");
      return;
    }
    // 3. Captcha.
    if (!verifySuggestCaptcha()) {
      showToast("Verifica matematica errata. Riprova.", "error");
      generateSuggestCaptcha();
      return;
    }
    // 4. Filtro anti-spam contenuto.
    const v = validateSuggestText(title, desc);
    if (!v.valid) {
      showToast(v.reason, "error");
      return;
    }
    // 5. Rate-limit locale.
    const canSend = await new Promise((resolve) => checkSuggestRateLimit((ok) => resolve(ok)));
    if (!canSend) {
      showToast("Hai raggiunto il limite di suggerimenti per quest'ora. Riprova piu' tardi.", "error");
      return;
    }

    // Disabilita durante invio
    btnSubmitSuggest.disabled = true;

    // Invia al Worker → Telegram topic "Suggerimenti"
    // EB-4: Fetch con AbortController e timeout 10s
    const suggestController = new AbortController();
    const suggestTimeoutId = setTimeout(() => suggestController.abort(), 10000);
    try {
      const sEmail = suggestEmail.value.trim();
      const res = await fetch(SUGGEST_ENDPOINT, {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({
          category: "suggestion",
          priority: "low",
          name: sEmail ? sEmail.split("@")[0] : "anon",
          email: sEmail || "noreply+suggest@adoff.app",
          subject: "[Suggerimento/" + suggestType + "] " + title,
          description: (desc || "(nessuna descrizione)") + "\n\nVersione: " + VERSION,
          browser: navigator.userAgent,
          turnstileToken: "extension",
        }),
        signal: suggestController.signal,
      });
      clearTimeout(suggestTimeoutId);

      if (res.status === 429) {
        showToast("Troppe richieste. Riprova tra un'ora.", "error");
        btnSubmitSuggest.disabled = false;
        return;
      }

      if (!res.ok) {
        const err = await res.json().catch(() => ({}));
        showToast(err.error || "Errore nell'invio.", "error");
        btnSubmitSuggest.disabled = false;
        return;
      }
    } catch (err) {
      clearTimeout(suggestTimeoutId);
      // Salva comunque localmente se offline
      console.error("Suggest send error:", err);
    }

    // Salva localmente
    suggestions.unshift({
      type: suggestType,
      title,
      desc,
      createdAt: Date.now(),
    });

    // Anti-bot: registra l'invio e rigenera il captcha
    recordSuggestSend();
    generateSuggestCaptcha();

    chrome.storage.local.set({ adoffSuggestions: suggestions }, () => {
      suggestTitle.value = "";
      suggestDesc.value  = "";
      suggestEmail.value = "";
      renderSuggestions();
      showToast("Suggerimento inviato!", "success");
      updateSuggestLimitInfo();
    });

    btnSubmitSuggest.disabled = false;
  });

  /** Carica suggerimenti dallo storage. */
  function loadSuggestions() {
    chrome.storage.local.get("adoffSuggestions", (r) => {
      suggestions = Array.isArray(r.adoffSuggestions) ? r.adoffSuggestions : [];
      renderSuggestions();
    });
    initSuggestAntibot();
  }

  // ===== REFERRAL =====

  const referralLinkInput = document.getElementById("referralLink");
  const referralCodeEl    = document.getElementById("referralCode");
  const btnCopyReferral   = document.getElementById("btnCopyReferral");
  const btnShareWhatsApp  = document.getElementById("btnShareWhatsApp");
  const btnShareTelegram  = document.getElementById("btnShareTelegram");
  const btnShareEmail     = document.getElementById("btnShareEmail");
  const refCountEl        = document.getElementById("refCount");
  const refDaysEarnedEl   = document.getElementById("refDaysEarned");
  const refDaysLeftEl     = document.getElementById("refDaysLeft");
  const referralHistoryEl = document.getElementById("referralHistory");
  const referralEmptyEl   = document.getElementById("referralEmpty");

  const REFERRAL_BASE_URL = "https://adoff.app/r/";
  const REFERRAL_SHARE_TEXT = "Blocca tutte le pubblicita' gratis con AdOff! Installa da qui: ";

  function loadReferral() {
    chrome.storage.local.get(
      ["adoffReferralCode", "adoffReferralCount", "adoffReferralDays", "adoffReferralHistory", "adoffTrialEnd"],
      (r) => {
        const code = r.adoffReferralCode || "---";
        const count = r.adoffReferralCount || 0;
        const daysEarned = r.adoffReferralDays || 0;
        const history = r.adoffReferralHistory || [];
        const trialEnd = r.adoffTrialEnd || 0;
        const now = Date.now();

        // Calcola giorni rimasti da referral
        const referralEnd = trialEnd + daysEarned * 86400000;
        const daysLeft = referralEnd > now ? Math.ceil((referralEnd - now) / 86400000) : 0;

        // Popola UI (elementi opzionali: il redesign HTML puo' ometterne alcuni)
        const fullLink = REFERRAL_BASE_URL + code;
        if (referralLinkInput) referralLinkInput.value = fullLink;
        if (referralCodeEl) referralCodeEl.textContent = code;
        if (refCountEl) refCountEl.textContent = String(count);
        if (refDaysEarnedEl) refDaysEarnedEl.textContent = String(daysEarned);
        if (refDaysLeftEl) refDaysLeftEl.textContent = String(daysLeft);

        // Storico
        renderReferralHistory(history);

        // Sync stats from server (referral system) — fire-and-forget, offline-safe
        if (code && /^ADO-[A-Z0-9]{5,8}$/.test(code)) {
          fetch("https://api.adoff.app/referral/stats?code=" + encodeURIComponent(code))
            .then((resp) => resp.json())
            .then((data) => {
              if (!data.ok) return;
              const updates = {};
              if (typeof data.count === "number") updates.adoffReferralCount = data.count;
              if (typeof data.daysEarned === "number") updates.adoffReferralDays = data.daysEarned;
              if (Array.isArray(data.history)) updates.adoffReferralHistory = data.history;
              chrome.storage.local.set(updates, () => {
                if (refCountEl) refCountEl.textContent = String(data.count || 0);
                if (refDaysEarnedEl) refDaysEarnedEl.textContent = String(data.daysEarned || 0);
                // Ricalcola daysLeft con dati freschi
                const freshEnd = trialEnd + (data.daysEarned || 0) * 86400000;
                const freshLeft = freshEnd > now ? Math.ceil((freshEnd - now) / 86400000) : 0;
                if (refDaysLeftEl) refDaysLeftEl.textContent = String(freshLeft);
                renderReferralHistory(data.history || []);
              });
            })
            .catch(() => { /* offline — keep cached values */ });
        }
      }
    );
  }

  // Handler bottone "Collega al tuo account"
  const btnLinkReferralAccount = document.getElementById("btnLinkReferralAccount");
  if (btnLinkReferralAccount) {
    btnLinkReferralAccount.addEventListener("click", () => {
      chrome.storage.local.get("adoffReferralCode", (r) => {
        const code = r.adoffReferralCode || "";
        if (!code) return;
        const url = "https://adoff.app/account/?link_referral=" + encodeURIComponent(code);
        chrome.tabs.create({ url });
      });
    });
  }

  function renderReferralHistory(history) {
    if (!referralHistoryEl) return;
    referralHistoryEl.innerHTML = "";
    if (!history || history.length === 0) {
      if (referralEmptyEl) referralEmptyEl.style.display = "block";
      return;
    }
    if (referralEmptyEl) referralEmptyEl.style.display = "none";

    history.forEach((entry) => {
      const div = document.createElement("div");
      div.className = "referral-history-item";

      // EA-4: Costruzione DOM con textContent per prevenire XSS
      const spanDate = document.createElement("span");
      spanDate.className = "referral-history-date";
      spanDate.textContent = formatDate(entry.date);

      const spanDays = document.createElement("span");
      spanDays.className = "referral-history-days";
      spanDays.textContent = "+" + entry.daysEarned + " giorni";

      div.appendChild(spanDate);
      div.appendChild(spanDays);
      referralHistoryEl.appendChild(div);
    });
  }

  // Copia link
  if (btnCopyReferral) {
    btnCopyReferral.addEventListener("click", () => {
      referralLinkInput.select();
      navigator.clipboard.writeText(referralLinkInput.value).then(() => {
        showToast("Link copiato!", "success");
      }).catch(() => {
        document.execCommand("copy");
        showToast("Link copiato!", "success");
      });
    });
  }

  // Condivisione (elementi opzionali - possono non esistere)
  if (btnShareWhatsApp) {
    btnShareWhatsApp.addEventListener("click", () => {
      const url = "https://wa.me/?text=" + encodeURIComponent(REFERRAL_SHARE_TEXT + referralLinkInput.value);
      chrome.tabs.create({ url });
    });
  }

  if (btnShareTelegram) {
    btnShareTelegram.addEventListener("click", () => {
      const url = "https://t.me/share/url?url=" + encodeURIComponent(referralLinkInput.value) +
        "&text=" + encodeURIComponent(REFERRAL_SHARE_TEXT);
      chrome.tabs.create({ url });
    });
  }

  if (btnShareEmail) {
    btnShareEmail.addEventListener("click", () => {
      const subject = encodeURIComponent("Prova AdOff - blocca tutte le pubblicita'");
      const body = encodeURIComponent(REFERRAL_SHARE_TEXT + referralLinkInput.value);
      chrome.tabs.create({ url: "mailto:?subject=" + subject + "&body=" + body });
    });
  }

  // --- LOGICA UNIFICATA GUADAGNA ---
  const btnShowInvite = document.getElementById("btnShowInvite");
  const btnShowAffiliate = document.getElementById("btnShowAffiliate");
  const inviteContent = document.getElementById("referralInviteContent");
  const affiliateContent = document.getElementById("referralAffiliateContent");

  if (btnShowInvite && btnShowAffiliate && inviteContent && affiliateContent) {
    btnShowInvite.addEventListener("click", () => {
      btnShowInvite.className = "btn btn-primary";
      btnShowAffiliate.className = "btn btn-ghost";
      inviteContent.style.display = "block";
      affiliateContent.style.display = "none";
    });

    btnShowAffiliate.addEventListener("click", () => {
      btnShowInvite.className = "btn btn-ghost";
      btnShowAffiliate.className = "btn btn-primary";
      inviteContent.style.display = "none";
      affiliateContent.style.display = "block";
    });
  }

  // Registrazione Affiliato — apre la pagina account sul sito
  const btnRegisterAffiliate = document.getElementById("btnRegisterAffiliate");
  if (btnRegisterAffiliate) {
    btnRegisterAffiliate.addEventListener("click", () => {
      chrome.tabs.create({ url: "https://adoff.app/account.html#affiliate" });
    });
  }

  // Copy affiliate link
  const btnCopyAffLink = document.getElementById("btnCopyAffLink");
  if (btnCopyAffLink) {
    btnCopyAffLink.addEventListener("click", () => {
      const el = document.getElementById("affiliateLink");
      if (el && el.value) {
        el.select();
        navigator.clipboard.writeText(el.value).then(() => showToast("Link copiato!", "success"));
      }
    });
  }

  // ===== LINGUA =====
  const langSelect = document.getElementById("settingLang");
  if (langSelect) {
    // Carica lingua salvata
    chrome.storage.local.get("adoffLang", (result) => {
      langSelect.value = result.adoffLang || "auto";
    });

    langSelect.addEventListener("change", () => {
      const lang = langSelect.value;
      i18n.setLang(lang);
      i18n.applyToDOM();
      showToast(i18n.t("opt.saved"));
    });
  }

  // ponytail: CSS-only approach — scope restricted to extension UI, no real theming engine needed

  // ===== TEMI =====
  const THEMES = [
    { id: "default",  name: "Dark",     badge: "free", bg: "#0a0a1a", bg2: "#12122a", text: "#ffffff", accent: "#7c5cfc" },
    { id: "midnight", name: "Midnight", badge: "free", bg: "#0d1117", bg2: "#161b22", text: "#c9d1d9", accent: "#1f6feb" },
    { id: "forest",   name: "Forest",   badge: "free", bg: "#0f1a14", bg2: "#162119", text: "#d4e8d0", accent: "#2ea043" },
    { id: "ocean",    name: "Ocean",    badge: "pro",  bg: "#0a1520", bg2: "#0f1e2e", text: "#c0d8f0", accent: "#1d9bf0" },
    { id: "sunset",   name: "Sunset",   badge: "pro",  bg: "#1a0f0a", bg2: "#251510", text: "#f0d8c0", accent: "#f97316" },
    { id: "lavender", name: "Lavender", badge: "pro",  bg: "#12101a", bg2: "#1a1625", text: "#e0d8f0", accent: "#b794f4" },
  ];

  function buildThemePreview(theme) {
    return `<div class="theme-preview" style="background:${theme.bg}">
      <div class="theme-preview-bar" style="background:${theme.bg2}">
        <div class="theme-preview-icon" style="background:${theme.accent}"></div>
        <div class="theme-preview-text" style="background:${theme.text};opacity:0.3"></div>
      </div>
      <div class="theme-preview-card" style="background:${theme.bg2}"></div>
      <div class="theme-preview-bar" style="background:${theme.bg2};height:10px">
        <div class="theme-preview-text" style="background:${theme.text};opacity:0.15;max-width:50%"></div>
      </div></div>`;
  }

  function applyTheme(theme) {
    const root = document.documentElement;
    root.style.setProperty("--th-bg", theme.bg);
    root.style.setProperty("--th-bg2", theme.bg2);
    root.style.setProperty("--th-text", theme.text);
    root.style.setProperty("--th-accent", theme.accent);
  }

  function resetThemeVars() {
    const root = document.documentElement;
    ["--th-bg","--th-bg2","--th-text","--th-accent"].forEach(v => root.style.removeProperty(v));
  }

  function loadThemes(savedThemeId) {
    const grid = document.getElementById("themesGrid");
    const upsell = document.getElementById("themesProUpsell");
    if (!grid) return;
    grid.innerHTML = "";
    const isPro = license && (license.valid || (license.source === "trial" && license.plan === "trial"));

    THEMES.forEach((theme) => {
      const locked = theme.badge === "pro" && !isPro;
      const active = savedThemeId === theme.id;
      const card = document.createElement("div");
      card.className = "theme-card" + (active ? " active" : "") + (locked ? " locked" : "");
      card.dataset.themeId = theme.id;
      const badgeText = locked ? `<span class="theme-badge ${theme.badge}">&#128274;</span>`
        : `<span class="theme-badge ${active ? "active-badge" : theme.badge}">${active ? "&#10003;" : (theme.badge === "pro" ? "Pro" : "Free")}</span>`;
      card.innerHTML = `${locked ? `<span class="theme-pro-icon">&#128274;</span>` : ""}${buildThemePreview(theme)}<span class="theme-name">${theme.name}</span>${badgeText}`;
      if (!locked) card.addEventListener("click", () => saveTheme(theme.id));
      grid.appendChild(card);
    });

    const activeName = document.getElementById("themeActiveName");
    if (activeName) {
      const t = THEMES.find(th => th.id === (savedThemeId || "default"));
      activeName.textContent = t ? t.name : "Dark";
    }
    if (upsell) upsell.style.display = isPro ? "none" : "block";
    if (savedThemeId) { const t = THEMES.find(th => th.id === savedThemeId); if (t) applyTheme(t); }
  }

  function saveTheme(themeId) {
    chrome.storage.local.set({ adoffTheme: themeId });
    const t = THEMES.find(th => th.id === themeId);
    if (t) { resetThemeVars(); applyTheme(t); }
    loadThemes(themeId);
    showToast("Tema applicato!", "success");
  }

  // ===== IMAGE SWAP =====
  const IMAGE_CATEGORIES = [
    { id: "cats",     name: "Cats",     icon: "&#128008;", pro: true  },
    { id: "dogs",     name: "Dogs",     icon: "&#128054;", pro: true  },
    { id: "nature",   name: "Nature",   icon: "&#127795;", pro: false },
    { id: "abstract", name: "Abstract", icon: "&#127912;", pro: true  },
    { id: "space",    name: "Space",    icon: "&#127756;", pro: true  },
    { id: "food",     name: "Food",     icon: "&#127839;", pro: true  },
  ];

  function loadImageSwap(savedCategory) {
    const toggle = document.getElementById("settingImageSwap");
    const catCard = document.getElementById("imageSwapCategoryCard");
    const catGrid = document.getElementById("imageCategoriesGrid");
    const upsell = document.getElementById("imageSwapProUpsell");
    if (!toggle) return;
    const isPro = license && (license.valid || (license.source === "trial" && license.plan === "trial"));
    const currentVal = savedCategory || "off";

    // ponytail: stub wired — content.js integration TODO when invasive changes needed
    // Stub: setting persists to storage; cosmetic wire in content.js deferred per handoff note.

    chrome.storage.local.get("adoffImageSwap", (r) => {
      const val = r.adoffImageSwap || "off";
      toggle.checked = val !== "off";
      if (catCard) catCard.style.display = isPro && val !== "off" ? "block" : "none";
      if (upsell) upsell.style.display = isPro ? "none" : "block";
      if (!catGrid) return;
      catGrid.innerHTML = "";
      IMAGE_CATEGORIES.forEach((cat) => {
        const locked = cat.pro && !isPro;
        const active = val === cat.id;
        const el = document.createElement("div");
        el.className = "image-category-card" + (active ? " active" : "") + (locked ? " locked" : "");
        el.innerHTML = `<div class="image-category-icon">${cat.icon}</div><div class="image-category-name">${cat.name}</div><div class="image-category-check">&#10003;</div>`;
        if (!locked) el.addEventListener("click", () => {
          chrome.storage.local.set({ adoffImageSwap: cat.id });
          loadImageSwap(cat.id);
          showToast("Salvato!");
        });
        catGrid.appendChild(el);
      });
    });

    toggle.addEventListener("change", () => {
      if (!isPro) { toggle.checked = false; showUpgradeUpsell(); return; }
      const val = toggle.checked ? (savedCategory || "nature") : "off";
      chrome.storage.local.set({ adoffImageSwap: val });
      if (val !== "off") loadImageSwap(val);
    });
  }

  function showUpgradeUpsell() {
    const upsell = document.getElementById("imageSwapProUpsell");
    if (upsell) { upsell.style.display = "block"; upsell.scrollIntoView({ behavior: "smooth", block: "center" }); }
  }

  // ===== INIT =====
  i18n.init(() => {
    i18n.applyToDOM();
    loadAll();

    // Versione nella sezione Info — dal manifest, sempre congruente
    const versionEl = document.getElementById("infoVersion");
    if (versionEl && VERSION) {
      versionEl.textContent = "v" + VERSION;
    }

    // Deep link da hash URL (es. options.html#aiuto)
    const hash = window.location.hash.replace("#", "");
    if (hash) {
      activateSection(hash);
    }
  });
})();
