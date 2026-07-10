(function () {
  "use strict";

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

  function loadGenerali() {
    chrome.storage.local.get(
      ["adoffEnabled", "adoffShowBadge", "adoffShowCounter"],
      (r) => {
        settingEnabled.checked = r.adoffEnabled !== false;
        settingBadge.checked   = r.adoffShowBadge !== false;
        settingCounter.checked = r.adoffShowCounter !== false;
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

  // Auth state elements (solo 2 stati: Pro attivo o No license)
  const stateProActive   = document.getElementById("stateProActive");
  const stateNotLoggedIn = document.getElementById("stateNotLoggedIn");

  /**
   * Normalizza l'oggetto licenza: il trial vive nella chiave storage
   * separata `adoffTrialEnd`, mentre `adoffLicense` contiene solo le
   * licenze Pro/Lifetime acquistate. Deriva `type`/`trialEndsAt` per la UI.
   * @param {object|undefined} lic
   * @param {number|undefined} trialEnd
   * @returns {object}
   */
  function normalizeLicense(lic, trialEnd) {
    const out = Object.assign({}, lic);
    const plan = out.plan || "";
    const hasValidPro = out.valid &&
      (plan === "pro" || plan === "lifetime" || plan === "monthly" || plan === "annual");
    if (hasValidPro) {
      out.type = plan === "lifetime" ? "lifetime" : "pro";
    } else if (trialEnd && trialEnd > Date.now()) {
      out.type = "trial";
      out.trialEndsAt = trialEnd;
    } else {
      out.type = "free";
    }
    return out;
  }

  /** Calcola giorni trial rimasti. */
  function trialDaysLeft() {
    if (!license.trialEndsAt) return 0;
    return Math.max(0, Math.ceil((license.trialEndsAt - Date.now()) / 86_400_000));
  }

  /**
   * Nasconde tutti gli stati auth e mostra solo quello richiesto.
   * @param {'pro'|'trial'|'none'} state
   */
  function showAuthState(state) {
    stateProActive.style.display = state === "pro" ? "block" : "none";
    const trialEl = document.getElementById("stateTrialActive");
    if (trialEl) trialEl.style.display = state === "trial" ? "block" : "none";
    stateNotLoggedIn.style.display = state === "none" ? "block" : "none";
    pricingCard.style.display = state !== "pro" ? "block" : "none";
  }

  /**
   * Aggiorna il badge header in base al piano corrente.
   * @param {string} t — 'pro'|'lifetime'|'trial'|'free'
   */
  function updateHeaderBadge(t) {
    if (t === "pro" || t === "lifetime") {
      headerLicenseBadge.textContent = "PRO";
      headerLicenseBadge.className = "license-badge-header pro";
    } else if (t === "trial") {
      headerLicenseBadge.textContent = "TRIAL " + trialDaysLeft() + "gg";
      headerLicenseBadge.className = "license-badge-header trial";
    } else {
      headerLicenseBadge.textContent = "FREE";
      headerLicenseBadge.className = "license-badge-header free";
    }
  }

  /** Render sezione licenza con 3 stati: Pro attivo / Trial attivo / No license. */
  function renderLicenseSection() {
    const plan  = license.plan || "";
    const isPro = license.valid &&
      (plan === "pro" || plan === "lifetime" || plan === "monthly" || plan === "annual");
    const isTrial = !isPro && license.type === "trial" && license.trialEndsAt && license.trialEndsAt > Date.now();
    const t = isPro ? (plan === "lifetime" ? "lifetime" : "pro") : (isTrial ? "trial" : (license.type || "free"));

    updateHeaderBadge(t);

    if (isPro) {
      // Stato B: Pro attivo
      showAuthState("pro");
      const expText = license.expiresHuman === "LIFETIME" || !license.expiresHuman
        ? "Mai (Lifetime)"
        : license.expiresHuman;
      document.getElementById("proStatePlan").textContent    = plan.charAt(0).toUpperCase() + plan.slice(1);
      document.getElementById("proStateExpiry").textContent  = expText;
      document.getElementById("proStateEmail").textContent   = license.email || "—";

      // Barra dispositivi
      const maxDev  = license.maxDevices || 3;
      const usedDev = license.devices || 0;
      const pct     = Math.min(100, Math.round((usedDev / maxDev) * 100));
      const barFill = document.getElementById("proDevicesBar");
      const devCount = document.getElementById("proDevicesCount");
      if (barFill) barFill.style.width = pct + "%";
      if (devCount) devCount.textContent = usedDev + "/" + maxDev;

    } else if (isTrial) {
      // Stato T: Trial attivo
      showAuthState("trial");
      renderTrialState();
    } else {
      // Stato A: No license — solo input codice licenza
      showAuthState("none");
    }
  }

  /** Render dettagli stato trial: countdown giorni, barra progresso, scadenza. */
  function renderTrialState() {
    const daysLeft = trialDaysLeft();
    const TRIAL_TOTAL_DAYS = 15;
    const daysUsed = Math.max(0, Math.min(TRIAL_TOTAL_DAYS, TRIAL_TOTAL_DAYS - daysLeft));
    const pct = Math.round((daysLeft / TRIAL_TOTAL_DAYS) * 100);

    const badge = document.getElementById("trialBadge");
    const countdownEl = document.getElementById("trialCountdownDays");
    const expiryEl = document.getElementById("trialExpiryDate");
    const barFill = document.getElementById("trialProgressBar");
    const barLabel = document.getElementById("trialProgressLabel");

    if (badge) badge.textContent = daysLeft + " GG";
    if (countdownEl) {
      // Mostra "X giorni rimasti" in formato grande
      const num = document.createElement("span");
      num.style.fontSize = "28px";
      num.style.fontWeight = "700";
      num.textContent = daysLeft;
      const lbl = document.createElement("span");
      lbl.style.fontSize = "12px";
      lbl.style.opacity = "0.7";
      lbl.style.marginLeft = "6px";
      lbl.textContent = daysLeft === 1 ? "giorno" : "giorni";
      countdownEl.textContent = "";
      countdownEl.appendChild(num);
      countdownEl.appendChild(lbl);
    }
    if (expiryEl && license.trialEndsAt) {
      const d = new Date(license.trialEndsAt);
      // Formato locale dd/mm/yyyy hh:mm
      const pad = n => String(n).padStart(2, "0");
      expiryEl.textContent = pad(d.getDate()) + "/" + pad(d.getMonth()+1) + "/" + d.getFullYear() +
        " " + pad(d.getHours()) + ":" + pad(d.getMinutes());
    }
    if (barFill) {
      barFill.style.width = pct + "%";
      // Colore graduale: verde >7gg, giallo 3-7gg, rosso <=2gg
      if (daysLeft <= 2) barFill.style.background = "#ef4444";
      else if (daysLeft <= 7) barFill.style.background = "#f59e0b";
      else barFill.style.background = "#3b82f6";
    }
    if (barLabel) barLabel.textContent = daysUsed + "/" + TRIAL_TOTAL_DAYS + " gg usati";
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

  btnResetStats.addEventListener("click", () => {
    if (!confirm("Resettare le statistiche?")) return;
    chrome.storage.local.set({ adoffAdsBlocked: 0, adoffReqBlocked: 0 }, () => {
      renderStats(0, 0);
      showToast("Statistiche azzerate.", "success");
    });
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

  // ===== FAQ / AIUTO =====

  const FAQ_DB = [
    {
      keywords: ["come funziona", "cosa fa", "blocca", "pubblicita", "ads"],
      q: "Come funziona AdOff?",
      a: "AdOff blocca le pubblicita' su 3 livelli:<br><b>1. Rete</b> — Blocca le richieste HTTP verso i server pubblicitari prima che raggiungano il browser.<br><b>2. Pagina</b> — Nasconde gli elementi pubblicitari dal DOM con CSS e JavaScript.<br><b>3. Stealth</b> — Evade i sistemi anti-adblock rendendo AdOff invisibile ai siti.",
    },
    {
      keywords: ["sito non funziona", "non carica", "rotto", "pagina bianca", "errore sito", "problema sito"],
      q: "Un sito non funziona con AdOff attivo",
      a: "Se un sito ha problemi:<br>1. Clicca l'icona AdOff e usa <b>\"Pausa qui\"</b> per disattivarlo solo su quel sito.<br>2. Ricarica la pagina.<br>3. Se il problema persiste anche con AdOff in pausa, il problema non e' causato dall'estensione.<br><br>Puoi anche aggiungere il sito alla <b>whitelist permanente</b> nelle Opzioni > Siti esclusi.<br><br>&#9888; <a href='#' data-scroll-to='reportCard'><b>Segnalaci il sito</b></a> usando il form qui sotto — lo correggeremo!",
    },
    {
      keywords: ["video", "streaming", "video ads", "pre-roll", "skip"],
      q: "Le piattaforme video mostrano ancora ads",
      a: "Le piattaforme video aggiornano frequentemente il loro sistema pubblicitario. AdOff include un modulo dedicato per le piattaforme video che:<br>- Blocca i video ads pre-roll e mid-roll<br>- Rimuove gli overlay pubblicitari<br>- Nasconde i banner sponsorizzati<br><br>Se vedi ancora ads, <b>ricarica la pagina</b>. Se il problema persiste, potrebbe servire un aggiornamento di AdOff — controlla che sia l'ultima versione.<br><br>&#9888; <a href='#' data-scroll-to='reportCard'><b>Segnalaci il problema</b></a> e lo risolveremo al piu' presto.",
    },
    {
      keywords: ["whitelist", "escludi", "escludere", "pausa", "disattiva", "sito escluso"],
      q: "Come escludo un sito dal blocco?",
      a: "Hai due modi:<br><b>1. Dal popup</b> — Clicca l'icona AdOff, poi \"Pausa qui\". Scegli la durata: sessione, 1 ora, 1 giorno, o permanente.<br><b>2. Dalle opzioni</b> — Vai in Opzioni > Siti esclusi. Digita il dominio e clicca \"Aggiungi\".<br><br>I siti esclusi non ricevono nessun blocco da AdOff.",
    },
    {
      keywords: ["free", "pro", "differenza", "piano", "premium", "gratis", "pagamento", "youtube", "video", "tv", "broadcaster"],
      q: "Che differenza c'e' tra Free e Pro?",
      a: "La versione <b>Free</b> blocca gli ads sui siti web: banner, display, pop-up/popunder, tracker e network pubblicitari. Funziona su tutti i siti, senza limiti di tempo.<br><br>La versione <b>Pro</b> aggiunge:<br>- <b>Blocco ads sui video</b>: piattaforme video e player dei broadcaster TV (servizi streaming TV europei come quelli di Italia, UK, Germania, Francia, Spagna, Portogallo)<br>- <b>Stealth Mode</b>: invisibilita' ai sistemi anti-adblock — niente piu' wall \"disabilita adblock\"<br>- Aggiornamenti prioritari per nuovi formati ads<br>- Supporto dedicato<br>- Badge Pro nell'estensione",
    },
    {
      keywords: ["privacy", "dati", "tracciamento", "raccolta", "personali", "telemetria"],
      q: "AdOff raccoglie i miei dati?",
      a: "No. AdOff <b>non raccoglie nessun dato personale</b>. Non tracciamo i siti che visiti, non inviamo telemetria, non usiamo analytics.<br><br>Tutto funziona in locale sul tuo browser. Le uniche informazioni salvate sono le tue impostazioni (toggle, whitelist, contatori) nello storage locale dell'estensione.",
    },
    {
      keywords: ["lento", "rallenta", "performance", "pesante", "memoria", "cpu", "ram"],
      q: "AdOff rallenta il browser?",
      a: "No. AdOff e' progettato per essere ultra-leggero:<br>- Usa <b>declarativeNetRequest</b> (API nativa di Chrome) per il blocco rete — zero overhead<br>- I CSS di hiding vengono iniettati una sola volta<br>- Il content script usa MutationObserver ottimizzato<br><br>Anzi, bloccando richieste e ads, le pagine caricano <b>piu' velocemente</b>.",
    },
    {
      keywords: ["anti-adblock", "rilevato", "detected", "disabilita adblock", "muro", "wall", "anti adblock"],
      q: "Un sito rileva AdOff e chiede di disabilitarlo",
      a: "AdOff include un modulo <b>stealth anti-detection</b> che evade la maggior parte dei sistemi anti-adblock.<br><br>Se un sito ti chiede comunque di disabilitare l'adblock:<br>1. <b>Ricarica la pagina</b> — a volte il timing e' cruciale.<br>2. Se non basta, usa \"Pausa qui\" per quel sito specifico.<br>3. &#9888; <a href='#' data-scroll-to='reportCard'><b>Segnalaci il sito</b></a> — aggiorneremo il filtro!",
    },
    {
      keywords: ["licenza", "attiva", "attivare", "chiave", "key", "codice", "pro attivazione"],
      q: "Come attivo la licenza Pro?",
      a: "1. Acquista una licenza su <b>adoff.app</b><br>2. Riceverai una chiave nel formato XXXX-XXXX-XXXX-XXXX<br>3. Vai in Opzioni > Piano & Licenza<br>4. Inserisci la chiave e clicca \"Attiva\"<br><br>La licenza si attiva istantaneamente.",
    },
    {
      keywords: ["disinstalla", "disinstallare", "rimuovi", "rimuovere", "elimina"],
      q: "Come disinstallo AdOff?",
      a: "1. Vai su <b>chrome://extensions/</b><br>2. Trova AdOff nella lista<br>3. Clicca \"Rimuovi\"<br>4. Conferma la rimozione<br><br>Tutti i dati locali vengono cancellati automaticamente.",
    },
    {
      keywords: ["aggiorna", "aggiornamento", "update", "versione", "nuova versione"],
      q: "Come aggiorno AdOff?",
      a: "Se hai installato AdOff dal Chrome Web Store, gli aggiornamenti sono <b>automatici</b>.<br><br>Per forzare un aggiornamento:<br>1. Vai su chrome://extensions/<br>2. Attiva \"Modalita' sviluppatore\"<br>3. Clicca \"Aggiorna\"<br><br>Versione corrente: <b>v" + VERSION + "</b>",
    },
    {
      keywords: ["cookie", "banner cookie", "gdpr", "consenso", "cookie wall"],
      q: "AdOff blocca i cookie banner?",
      a: "AdOff include filtri CSS per nascondere molti cookie banner comuni. Tuttavia, i cookie banner cambiano molto da sito a sito.<br><br>Se ne vedi uno che non viene bloccato, segnalacelo nella sezione <b>Suggerimenti</b> indicando il sito e saremo felici di aggiungere il filtro.",
    },
  ];

  const chatMessages = document.getElementById("chatMessages");
  const chatInput    = document.getElementById("chatInput");
  const btnChatSend  = document.getElementById("btnChatSend");
  const faqTopics    = document.getElementById("faqTopics");

  /**
   * EA-5: Sanitizza HTML permettendo solo tag sicuri in allowlist.
   * Rimuove tutti i tag non in allowlist e tutti gli attributi event handler.
   * @param {string} html
   * @returns {string}
   */
  function sanitizeHtml(html) {
    const ALLOWED_TAGS = ["b", "br", "a", "strong", "ol", "li", "p", "code"];
    // Rimuovi tag non in allowlist (tag e loro contenuto di chiusura)
    return html
      // Rimuovi tutti gli attributi on* (event handler injection)
      .replace(/\s+on\w+\s*=\s*(?:"[^"]*"|'[^']*'|[^\s>]*)/gi, "")
      // Rimuovi attributi javascript: negli href
      .replace(/href\s*=\s*(?:"javascript:[^"]*"|'javascript:[^']*')/gi, 'href="#"')
      // Rimuovi tag non in allowlist (tag aperti e chiusi)
      .replace(/<\/?([a-zA-Z][a-zA-Z0-9]*)\b[^>]*>/gi, (match, tag) => {
        if (ALLOWED_TAGS.includes(tag.toLowerCase())) return match;
        return "";
      });
  }

  /**
   * Converte testo semplice (risposta AI) in HTML con link cliccabili.
   * Escape anti-XSS, poi markdown [label](url) + URL nudi + dominio adoff.app.
   * L'output passa comunque da sanitizeHtml in addChatMessage.
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

  /**
   * Aggiunge un messaggio alla chat.
   * @param {string} text — testo o HTML (solo per bot, sanitizzato)
   * @param {'bot'|'user'} sender
   */
  function addChatMessage(text, sender) {
    const bubble = document.createElement("div");
    bubble.className = "chat-bubble " + sender;
    if (sender === "user") {
      // EA-5: Messaggi utente sempre come testo puro
      bubble.textContent = text;
    } else {
      // EA-5: Messaggi bot sanitizzati (contengono HTML intenzionale)
      bubble.innerHTML = sanitizeHtml(text);
      // EM-7: Event delegation per link interni dopo inserimento
      bubble.querySelectorAll("a[data-scroll-to]").forEach((link) => {
        link.addEventListener("click", (evt) => {
          evt.preventDefault();
          const target = document.getElementById(link.dataset.scrollTo);
          if (target) target.scrollIntoView({ behavior: "smooth" });
        });
      });
    }
    chatMessages.appendChild(bubble);
    chatMessages.scrollTop = chatMessages.scrollHeight;
  }

  /**
   * Cerca la migliore risposta FAQ per la query.
   * @param {string} query
   * @returns {object|null}
   */
  function findFaqMatch(query) {
    const words = query.toLowerCase()
      .replace(/[^\w\s\u00C0-\u024F]/g, "")
      .split(/\s+/)
      .filter((w) => w.length > 2);

    if (words.length === 0) return null;

    let bestMatch = null;
    let bestScore = 0;

    for (const faq of FAQ_DB) {
      let score = 0;
      for (const word of words) {
        for (const kw of faq.keywords) {
          if (kw.includes(word) || word.includes(kw)) {
            score += 1;
          }
        }
      }
      if (score > bestScore) {
        bestScore = score;
        bestMatch = faq;
      }
    }

    return bestScore >= 1 ? bestMatch : null;
  }

  // ===== AI SUPPORT CHAT (backend /chat — LLM locale, escalation a umano) =====
  const AI_CHAT_API   = "https://api.adoff.app/chat";
  const AI_CHAT_LANGS = ["it", "en", "de", "fr", "es", "pt"];
  const EMAIL_RX      = /^[^\s@]+@[^\s@]+\.[^\s@]+$/;
  let aiChatSid   = "";
  let aiChatBusy  = false;
  let aiPendingMsg = null; // messaggio in attesa di email per l'escalation

  function aiLang() {
    let l = "en";
    try { l = (i18n.getLang && i18n.getLang()) || "en"; } catch (e) {}
    l = String(l).slice(0, 2).toLowerCase();
    return AI_CHAT_LANGS.includes(l) ? l : "en";
  }

  function addTyping() {
    const b = document.createElement("div");
    b.className = "chat-bubble bot";
    b.id = "aiChatTyping";
    b.textContent = "…";
    chatMessages.appendChild(b);
    chatMessages.scrollTop = chatMessages.scrollHeight;
  }
  function removeTyping() { const t = document.getElementById("aiChatTyping"); if (t) t.remove(); }

  /** Fallback offline: usa il FAQ locale se il backend AI non risponde. */
  function offlineFallback(query) {
    const match = findFaqMatch(query);
    if (match) { addChatMessage("<b>" + match.q + "</b><br><br>" + match.a, "bot"); return; }
    addChatMessage(
      "Non riesco a contattare l'assistente in questo momento. " +
      "Riprova o <a href='https://adoff.app/support' target='_blank' rel='noopener'>contattaci qui</a>.",
      "bot"
    );
  }

  /** Gestisce una domanda dell'utente: chiede all'AI, fallback FAQ locale. */
  async function handleFaqQuestion(query) {
    query = (query || "").trim();
    if (!query || aiChatBusy) return;
    addChatMessage(query, "user");

    // Se attendevamo un'email per l'escalation e l'utente l'ha scritta
    let email = "";
    if (aiPendingMsg && EMAIL_RX.test(query)) {
      email = query;
      query = aiPendingMsg;
      aiPendingMsg = null;
    }

    aiChatBusy = true;
    addTyping();
    const ctrl = new AbortController();
    const to = setTimeout(() => ctrl.abort(), 30000);
    try {
      const payload = { message: query, lang: aiLang(), turnstileToken: "extension" };
      if (aiChatSid) payload.sessionId = aiChatSid;
      if (email) payload.email = email;
      const res = await fetch(AI_CHAT_API, {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify(payload),
        signal: ctrl.signal,
      });
      clearTimeout(to);
      const d = await res.json();
      removeTyping(); aiChatBusy = false;
      if (d && d.sessionId) aiChatSid = d.sessionId;
      if (!d || !d.ok) { offlineFallback(query); return; }
      addChatMessage(linkifyText(d.reply || ""), "bot");
      if (d.fallback) { offlineFallback(query); return; }
      if (d.needEmail) { aiPendingMsg = query; } // il prossimo input (email) creera' il ticket
    } catch (e) {
      clearTimeout(to);
      removeTyping(); aiChatBusy = false;
      offlineFallback(query);
    }
  }

  btnChatSend.addEventListener("click", () => {
    handleFaqQuestion(chatInput.value);
    chatInput.value = "";
  });

  chatInput.addEventListener("keydown", (e) => {
    if (e.key === "Enter") {
      handleFaqQuestion(chatInput.value);
      chatInput.value = "";
    }
  });

  // Click su chip FAQ — invia la domanda completa (testo del chip) all'AI
  faqTopics.querySelectorAll(".faq-chip").forEach((chip) => {
    chip.addEventListener("click", () => {
      handleFaqQuestion((chip.textContent || chip.dataset.q || "").trim());
    });
  });

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

        // Popola UI (elementi opzionali — il markup referral varia tra layout)
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
