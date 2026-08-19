(function () {
  "use strict";
  // Tier canonico del piano. UNICA fonte di verita sui nomi di piano emessi dal
  // server (worker.js): monthly | annual | referral | premium_monthly |
  // premium_annual | premium_annual_founder | trial | lifetime | free.
  // Ogni copia deve restare IDENTICA: sviluppo/tests/test-plan-tier-consistency.js
  // fallisce se una diverge o se ricompare una lista di piani hardcoded.
  function adoffPlanTier(plan) {
    if (typeof plan === "string" && plan.startsWith("premium")) return "premium";
    if (["pro", "lifetime", "monthly", "annual", "referral", "trial"].includes(plan)) return "pro";
    return "free";
  }


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

  /** Aggiorna il badge licenza nell'header — 3 livelli: Free / Pro / Premium. */
  function renderLicenseBadge() {
    const t = license.type || "free";
    if (t === "premium") {
      licenseBadge.textContent = "PREMIUM";
      licenseBadge.className = "license-badge premium";
    } else if (t === "pro" || t === "lifetime") {
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

  /** Mostra sezione Premium per utenti non-Premium. */
  function renderPremiumUpsell(isPremium) {
    const banner = document.getElementById("premiumBanner");
    const section = document.getElementById("premiumSection");
    if (isPremium) {
      banner.style.display = "none";
      section.style.display = "block";
      const badge = document.getElementById("premiumBadge");
      badge.textContent = "ATTIVO";
      badge.className = "premium-badge active";
      section.querySelector(".premium-cta").style.display = "none";
    } else {
      banner.style.display = "flex";
      section.style.display = "none";
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
   * licenze Pro/Lifetime/Premium acquistate. Deriva `type`/`trialEndsAt` per la UI.
   * @param {object|undefined} lic
   * @param {number|undefined} trialEnd
   * @returns {object}
   */
  function normalizeLicense(lic, trialEnd, trialBlocked) {
    const out = Object.assign({}, lic);
    const plan = out.plan || "";
    if (adoffPlanTier(plan) === "premium") {
      out.type = "premium";
    } else {
      const hasValidPro = out.valid && adoffPlanTier(plan) === "pro" && plan !== "trial";
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
      

      "3.5.81": [
        "Risolto il blocco su schermo nero durante gli annunci",
        "L'annuncio puo' essere riprodotto a qualsiasi risoluzione, il contenuto resta al massimo"
      ],
      "3.5.80": [
        "Il video parte sempre alla massima risoluzione disponibile",
        "Recuperata la qualita' bassa che era rimasta memorizzata dalle versioni precedenti"
      ],
      "3.5.79": [
        "Risolti i salti di posizione: il video non riparte piu' da un punto sbagliato dopo un annuncio",
        "La qualita' del video non viene piu' abbassata durante gli annunci: resta sempre quella scelta",
        "Rimossa la ricarica di soccorso che poteva far ripartire il video dall'inizio"
      ],
      "3.5.78": [
        "Fix: all'avvio di un video la qualita' poteva restare bassa dopo l'annuncio, facendo perdere l'alta definizione",
        "La qualita' viene ora rilevata mentre scorre il contenuto, non durante l'annuncio"
      ],
      "3.5.77": [
        "Fix: gli abbonamenti annuali e Premium non venivano riconosciuti in alcune schermate e su alcune piattaforme video, riattivando gli annunci",
        "Riconoscimento del piano unificato in un unico punto, identico su tutti i browser"
      ],
      "3.5.76": [
        "Reintegrato il fix dell'hash di integrita' della licenza perso accidentalmente nel merge della 3.5.75",
        "Senza questo fix il blocco pubblicita' su YouTube restava disattivato per tutti gli abbonati Pro, Lifetime e Premium",
        "Verificata la presenza del fix su tutti i file dell'estensione per Chrome, Firefox e Safari"
      ],
      "3.5.75": [
        "Risolto il bug che impediva il caricamento dell'estensione su Chrome: un campo deprecato nelle regole faceva rifiutare l'intero ruleset",
        "Le regole dei negozi (936/937) usano ora excludedInitiatorDomains al posto del campo excludedDomains non piu' supportato",
        "Verificato il ruleset completo: nessun altro campo deprecato presente su Chrome, Firefox e Safari"
      ],      "3.5.71": [
        "Corretto il riconoscimento del piano Premium: ora i piani premium_monthly, premium_annual e premium_annual_founder attivano correttamente il blocco pubblicita' su YouTube",
        "Il controllo usa ora un match prefisso (startsWith premium) invece di un match esatto che non scattava mai con i nomi reali dei piani",
        "Verificato su tutti e tre i browser (Chrome, Firefox, Safari)",
      ],
      "3.5.70": [
        "Risolto un problema che su YouTube mostrava di nuovo tutte le pubblicita' agli abbonati Premium",
        "Il riconoscimento dell'abbonamento Premium ora funziona anche sulle piattaforme video",
        "Nessun impatto sugli altri piani: Pro, Trial e Free restano invariati",
      ],
      "3.5.69": [
        "Risolto il blocco dei login con Google e di altri provider su alcuni siti",
        "I siti con piu' sottodomini vengono riconosciuti correttamente",
        "Verificato che non indebolisce il blocco dei popunder",
      ],
      "3.5.68": [
        "Ridotti a uno solo i clic necessari per avviare o fermare il video",
        "Rimossa la restituzione del gesto che causava un passaggio di stato di troppo",
        "Verificato sul sito reale e sui lettori video puliti",
      ],
      "3.5.67": [
        "Bloccato il caricatore pubblicitario servito dal sito stesso e non dal suo circuito",
        "La difesa contro le finestre aperte dai riquadri raggiunge ora gli utenti",
        "Riconosciuti i circuiti anche quando cambiano indirizzo con un sottodominio",
      ],
      "3.5.66": [
        "Bloccate le finestre pubblicitarie aperte da un riquadro creato al momento",
        "Riconosciuti i circuiti anche quando cambiano indirizzo con un sottodominio",
        "Le difese seguono il lettore dentro i riquadri di altri siti",
      ],
      "3.5.65": [
        "Il comando arriva al lettore al primo clic anche quando la pubblicita' prova a rubarlo",
        "Riconosciuti i collegamenti invisibili stesi sopra il video anche fuori dai lettori incorporati",
        "Un clic dell'utente resta una sola azione: nessun comando ripetuto",
      ],
      "3.5.64": [
        "Protezione confermata contro le finestre che si aprono al clic sul play",
        "Riconoscimento dei circuiti pubblicitari dal loro indirizzo",
        "Difesa attiva anche dentro i lettori video incorporati",
      ],
      "3.5.63": [
        "Blocco delle finestre pubblicitarie che si aprono al primo clic",
        "Riconoscimento dei circuiti di affiliazione dal loro indirizzo",
        "Difesa piu' severa sui link invisibili sovrapposti al video",
      ],
      "3.5.62": [
      "Protezione attiva anche dentro i player incorporati",
      "Blocco degli annunci a comparsa indipendente dal sito",
      "Riconoscimento dei circuiti pubblicitari che cambiano indirizzo"
      ],
    "3.5.61": [
      "Protezione piu' solida contro i siti che provano a disattivarla",
      "Riconoscimento dei domini piu' rigoroso",
      "Il ripristino del layout a protezione spenta ora e' completo",
    ],
    "3.5.60": [
      "Blocco popunder da iframe di player video",
      "Correzione crash stub IMA durante navigazione",
      "Aggiornamento automatico filtri dal server",
    ],
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
    renderPremiumUpsell(adoffPlanTier(license.plan) === "premium");
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

  i18n.init(() => {
    i18n.applyToDOM();
    loadState();

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
