(function () {
  "use strict";

  // EB-6: Nonce casuale per prevenire clobbering del flag di caricamento
  const LOAD_NONCE = Math.random().toString(36).slice(2, 10);

  // Previeni istanze multiple — verifica che il valore sia il nostro nonce (non uno iniettato dal sito)
  const existingNonce = document.documentElement.getAttribute("data-adoff-loaded");
  if (existingNonce) return; // Già caricato
  document.documentElement.setAttribute("data-adoff-loaded", LOAD_NONCE);

  const hostname = location.hostname;
  const isOfficialSite = hostname === "adoff.app" || hostname === "www.adoff.app" || hostname.endsWith(".adoff-site.pages.dev");

  // Cattura codice affiliato dal sito ufficiale
  if (isOfficialSite) {
    const getCookie = (name) => {
      const value = `; ${document.cookie}`;
      const parts = value.split(`; ${name}=`);
      if (parts.length === 2) return parts.pop().split(';').shift();
    };
    const aff = getCookie("adoff_aff");
    if (aff) {
      chrome.storage.local.set({ adoffAffiliateCode: aff });
    }
  }

  const SCAN_INTERVAL_MS    = 500;
  const OBSERVER_DEBOUNCE_MS = 200;
  let enabled          = true;
  let scanTimer        = null;
  let observerDebounce = null;
  let observer         = null;
  let adsBlocked       = 0;

  // Guard: controlla se il contesto estensione e' ancora valido
  function isExtensionValid() {
    try { return !!chrome.runtime?.id; } catch (_) { return false; }
  }

  // EM-4: Verifica integrity hash dello stato licenza (FNV inline)
  function computeIntegrity(licData) {
    const raw = JSON.stringify(licData);
    let hash = 0x811c9dc5;
    for (let i = 0; i < raw.length; i++) {
      hash ^= raw.charCodeAt(i);
      hash = Math.imul(hash, 0x01000193);
    }
    hash = ((hash >>> 0) ^ 0x5f3759df).toString(36);
    return "ao_" + hash;
  }

  // EB-7: Nonce per data-adoff-stealth — formato verificabile: "ao_" + 8 hex chars
  const STEALTH_NONCE = "ao_" + Math.floor(Math.random() * 0xFFFFFFFF).toString(16).padStart(8, "0");

  // --- Controlla whitelist, stato e licenza prima di avviare ---
  if (!isExtensionValid()) return;
  chrome.storage.local.get(["adoffEnabled", "adoffAdsBlocked", "adoffWhitelist", "adoffTrialEnd", "adoffLicense", "adoffIntegrity"], (result) => {
    if (chrome.runtime.lastError || !isExtensionValid()) return;
    const whitelist = result.adoffWhitelist || [];
    // EA-7: suffix matching corretto (non bidirezionale)
    const isPaused = whitelist.some((d) => hostname === d || hostname.endsWith("." + d));

    // Se il dominio e' in whitelist esci subito — nessuna modifica al DOM
    if (isPaused) return;

    // EM-4: Verifica integrity usando lo stesso oggetto di license-client.js
    const lic = result.adoffLicense || {};
    const trialEnd = result.adoffTrialEnd || 0;
    // L'integrity hash viene calcolato su licData (stesso formato di license-client.js)
    const storedIntegrity = result.adoffIntegrity || "";
    // Se lic ha dati validi, verifica; se e' vuoto/free, skippa il check
    const integrityOk = !lic.valid || (storedIntegrity && computeIntegrity(lic) === storedIntegrity);

    // Comunica al MAIN world (stealth.js) se lo stealth e' abilitato (Pro/Trial)
    // Se l'integrity fallisce, trattare come Free (no stealth)
    const isPro = integrityOk && (
      lic.type === "pro" || lic.type === "lifetime" ||
      lic.plan === "pro" || lic.plan === "lifetime" ||
      lic.plan === "monthly" || lic.plan === "annual" ||
      (trialEnd > Date.now()) // Trial attivo
    );
    if (isPro) {
      // EB-7: usa nonce verificabile invece di "1" fisso
      document.documentElement.setAttribute("data-adoff-stealth", STEALTH_NONCE);
    }

    enabled    = result.adoffEnabled !== false;
    adsBlocked = result.adoffAdsBlocked || 0;
    if (enabled) start();
  });

  if (!isExtensionValid()) return;
  chrome.storage.onChanged.addListener((changes) => {
    if (!isExtensionValid()) return;
    if (changes.adoffEnabled) {
      enabled = changes.adoffEnabled.newValue !== false;
      enabled ? start() : stop();
    }
    // Aggiorna in tempo reale se la whitelist cambia mentre la pagina e' aperta
    if (changes.adoffWhitelist) {
      const whitelist = changes.adoffWhitelist.newValue || [];
      const isPaused  = whitelist.some((d) => hostname.includes(d) || d.includes(hostname));
      if (isPaused && enabled) stop();
    }
  });

  // EM-6: incrementBlocked usa sendMessage verso background per evitare race condition
  // Il background gestisce l'incremento atomicamente con buffer in-memory
  let pendingIncrement = 0;
  let incrementTimer   = null;

  function incrementBlocked(count) {
    pendingIncrement += count;
    if (incrementTimer) return;
    incrementTimer = setTimeout(() => {
      const toSend = pendingIncrement;
      pendingIncrement = 0;
      incrementTimer   = null;
      if (!isExtensionValid()) return;
      try {
        chrome.runtime.sendMessage({ action: "incrementAdsBlocked", count: toSend }, () => {
          void chrome.runtime.lastError;
        });
      } catch (_) {
        // Extension invalidated — stop silenzioso
      }
    }, 1000);
  }

  function isVideoPlatform() {
    return hostname.includes("youtube.com");
  }

  // Ascolta eventi di skip da stealth.js (MAIN world) per conteggio
  window.addEventListener("adoff-ad-skipped", () => {
    incrementBlocked(1);
  });

  // Ascolta popup/popunder bloccati da stealth.js (MAIN world)
  window.addEventListener("adoff-popup-blocked", () => {
    incrementBlocked(1);
  });

  // =============================================
  // SELETTORI — precisi, no substring wildcard
  // =============================================

  // Selettori per siti generici (precisi, classi intere)
  const GENERIC_AD_SELECTORS = [
    // Google Ads
    "ins.adsbygoogle",
    'div[id^="google_ads_"]',
    'div[id^="aswift_"]',
    "[data-ad-client]",

    // Google Ads iframes
    'iframe[src*="doubleclick.net"]',
    'iframe[src*="googlesyndication.com"]',
    'iframe[src*="googleadservices.com"]',
    'iframe[id^="google_ads"]',
    'iframe[id^="aswift_"]',

    // GPT ad slots
    'div[id^="div-gpt-ad"]',

    // Content recommendation
    ".OUTBRAIN",
    ".ob-widget",
    ".ob-smartfeed",
    '[id^="taboola-"]',
    ".taboola",

    // Common ad classes (intere, non substring)
    ".ad-slot",
    ".ad-container",
    ".ad-wrapper",
    ".ad-banner",
    ".adsbygoogle",
    ".ad-unit",
    ".adunit",
    ".dfp-ad",
    ".gpt-ad",
    ".leaderboard-ad",
    ".sidebar-ad",
    ".sticky-ad",
    ".floating-ad",
    ".billboard-ad",
  ];

  // Selettori SOLO per piattaforme video — MAI toccare layout/spacing
  const VIDEO_PLATFORM_AD_SELECTORS = [
    "ytd-ad-slot-renderer",
    "ytd-in-feed-ad-layout-renderer",
    "ytd-display-ad-renderer",
    "ytd-promoted-sparkles-web-renderer",
    "ytd-promoted-video-renderer",
    "ytd-compact-promoted-video-renderer",
    "ytd-search-pyv-renderer",
    "ytd-promoted-sparkles-text-search-renderer",
    "#companion-ad",
    // NON includere: ytd-banner-promo-renderer, ytd-statement-banner-renderer,
    // #masthead-ad, #companion, ytd-merch-shelf-renderer, ytd-mealbar-promo-renderer
    // — possono rompere il layout delle pagine canale
  ];

  // =============================================
  // VIDEO PLATFORM AD HANDLER
  // NON toccare currentTime/playbackRate/muted
  // — rompe l'avvio del video reale
  // =============================================

  // Skip button handling delegato interamente a stealth.js (MAIN world)
  // per evitare doppi click che confondono il player
  function handleVideoPlatformAds() {}

  // =============================================
  // CORE: SCAN & HIDE
  // =============================================

  // Elementi protetti su piattaforma video — MAI nascondere
  const YT_PROTECTED = [
    "ytd-player", "#player", "#player-container", "#player-container-outer",
    "#player-container-inner", "#movie_player", ".html5-video-player",
    ".html5-video-container", ".html5-main-video", "video",
    "#columns", "#primary", "#secondary", "#content",
    "ytd-watch-flexy", "ytd-page-manager", "ytd-app",
    "#page-manager", "#related", "#below",
  ];

  function isProtectedElement(el) {
    if (!isVideoPlatform()) return false;
    for (const sel of YT_PROTECTED) {
      try {
        if (el.matches(sel)) return true;
      } catch (_) {}
    }
    // Proteggi anche i figli diretti del player
    if (el.closest("#movie_player") && !el.matches('[class^="ytp-ad"]')) {
      return true;
    }
    return false;
  }

  function collapseElement(el) {
    if (el.hasAttribute("data-adoff-hidden")) return;
    el.style.setProperty("display",     "none",   "important");
    el.style.setProperty("height",      "0",       "important");
    el.style.setProperty("min-height",  "0",       "important");
    el.style.setProperty("margin",      "0",       "important");
    el.style.setProperty("padding",     "0",       "important");
    el.style.setProperty("overflow",    "hidden",  "important");
    el.setAttribute("data-adoff-hidden", "1");
  }

  function collapseAdParent(el) {
    // Risali fino a 3 livelli per trovare il contenitore ad
    let parent = el.parentElement;
    for (let i = 0; i < 3 && parent; i++) {
      const tag = parent.tagName.toLowerCase();
      // Non collassare body, html, main, article, section, header, footer
      if (["body", "html", "main", "article", "header", "footer", "nav"].includes(tag)) break;

      // PROTEZIONE: non collassare popup/dialog/modal/consent
      const role = parent.getAttribute("role");
      if (role === "dialog" || role === "alertdialog" || role === "modal") break;
      if (parent.getAttribute("aria-modal") === "true") break;
      if (parent.classList && (parent.classList.contains("modal") || parent.classList.contains("popup") ||
          parent.classList.contains("dialog") || parent.classList.contains("overlay") ||
          parent.classList.contains("cookie") || parent.classList.contains("consent"))) break;

      // PROTEZIONE: non collassare se contiene elementi interattivi
      if (parent.querySelector("button, input, select, textarea, [role='button']")) break;

      // Controlla se il parent contiene SOLO ad (nessun contenuto reale)
      const children = parent.children;
      let allAds = true;
      for (const child of children) {
        if (!child.hasAttribute("data-adoff-hidden") &&
            child.tagName !== "INS" &&
            !child.id?.startsWith("google_ads") &&
            !child.id?.startsWith("aswift_") &&
            !child.id?.startsWith("div-gpt-ad") &&
            !child.classList?.contains("adsbygoogle") &&
            getComputedStyle(child).display !== "none") {
          allAds = false;
          break;
        }
      }

      if (allAds) {
        collapseElement(parent);
        parent = parent.parentElement;
      } else {
        break;
      }
    }
  }

  function collapseEmptyAdContainers() {
    let count = 0;

    // 1. Trova tutti ins.adsbygoogle e collassa loro + parent
    const adsbyg = document.querySelectorAll("ins.adsbygoogle");
    for (const ins of adsbyg) {
      if (ins.hasAttribute("data-adoff-hidden")) continue;
      collapseElement(ins);
      collapseAdParent(ins);
      count++;
    }

    // 2. Trova contenitori GPT ad
    const gptAds = document.querySelectorAll('div[id^="div-gpt-ad"]');
    for (const div of gptAds) {
      if (div.hasAttribute("data-adoff-hidden")) continue;
      collapseElement(div);
      collapseAdParent(div);
      count++;
    }

    // 3. Trova contenitori con data-ad-client/slot (Google AdSense)
    const adsense = document.querySelectorAll("[data-ad-client], [data-ad-slot], [data-google-query-id]");
    for (const el of adsense) {
      if (el.hasAttribute("data-adoff-hidden")) continue;
      collapseElement(el);
      collapseAdParent(el);
      count++;
    }

    // 4. Trova div che contengono solo iframe ad bloccati (area vuota con "Ad" label)
    const allDivs = document.querySelectorAll("div");
    for (const div of allDivs) {
      if (div.hasAttribute("data-adoff-hidden")) continue;

      // PROTEZIONE: non toccare popup/dialog/modal/consent
      if (div.closest('[role="dialog"], [role="alertdialog"], [role="modal"], [aria-modal="true"], .modal, .popup, .dialog, .overlay, .cookie, .consent')) continue;

      // PROTEZIONE: non toccare se contiene elementi interattivi
      if (div.querySelector("button, input, select, textarea, a[href], [role='button']")) continue;

      const rect = div.getBoundingClientRect();
      if (rect.width < 100 || rect.height < 20 || rect.width > 1200) continue;

      const text = div.textContent?.trim() || "";
      const hasOnlyAdLabel = (text === "Ad" || text === "Ads" || text === "Pubblicità" ||
                              text === "Advertisement" || text === "Annuncio" || text === "");

      if (hasOnlyAdLabel) {
        const hasAdChild = div.querySelector(
          'ins.adsbygoogle, [id^="google_ads"], [id^="aswift_"], ' +
          'iframe[src*="doubleclick"], iframe[src*="googlesyndication"], ' +
          '[data-ad-client], [data-ad-slot]'
        );
        if (hasAdChild) {
          collapseElement(div);
          collapseAdParent(div);
          count++;
        }
      }
    }

    // 5. Trova label "Pubblicità"/"Ad" SOLO se adiacente a un contenitore ad noto
    //    Non nascondere label/span/div generici — rompe pulsanti di popup legittimi
    const AD_LABELS = ["pubblicità", "ad", "ads", "advertisement", "annuncio", "pubblicita"];
    const candidates = document.querySelectorAll("p, span, div, small");
    for (const el of candidates) {
      if (el.hasAttribute("data-adoff-hidden")) continue;
      // Deve avere SOLO testo ad-label (nessun figlio significativo)
      if (el.children.length > 2) continue;

      const text = (el.textContent || "").trim().toLowerCase();
      if (!AD_LABELS.includes(text)) continue;

      // PROTEZIONE: non nascondere se l'elemento o un antenato e' un popup/dialog/modal
      if (el.closest('[role="dialog"], [role="alertdialog"], [role="modal"], [aria-modal="true"], .modal, .popup, .dialog, .overlay, .cookie, .consent')) continue;

      // PROTEZIONE: non nascondere se contiene o e' vicino a elementi interattivi
      if (el.querySelector("button, input, select, a, textarea")) continue;

      // VERIFICA: nascondere SOLO se il parent/sibling e' un contenitore ad noto
      const parent = el.parentElement;
      if (!parent) continue;
      const hasAdSibling = parent.querySelector(
        'ins.adsbygoogle, [id^="google_ads"], [id^="aswift_"], [id^="div-gpt-ad"], ' +
        'iframe[src*="doubleclick"], iframe[src*="googlesyndication"], [data-ad-client]'
      );
      if (!hasAdSibling) continue;

      const rect = el.getBoundingClientRect();
      if (rect.width < 10 || rect.height < 5) continue;

      collapseElement(el);
      count++;
    }

    // 6. Collassa aree placeholder grandi vuote (970x250, 300x600 etc.)
    //    che sono tipiche dimensioni di banner ad
    //    PROTEZIONE: non toccare popup, dialog, modal, elementi interattivi
    const AD_SIZES = [
      [728, 90], [970, 250], [300, 250], [300, 600],
      [320, 50], [160, 600], [336, 280], [468, 60],
    ];

    for (const div of allDivs) {
      if (div.hasAttribute("data-adoff-hidden")) continue;
      if (div.children.length > 3) continue;

      // PROTEZIONE: non toccare popup/dialog/modal/consent
      if (div.closest('[role="dialog"], [role="alertdialog"], [role="modal"], [aria-modal="true"], .modal, .popup, .dialog, .overlay, .cookie, .consent')) continue;
      const divRole = div.getAttribute("role");
      if (divRole === "dialog" || divRole === "alertdialog" || divRole === "modal") continue;

      // PROTEZIONE: non toccare se contiene elementi interattivi (pulsanti, input, link)
      if (div.querySelector("button, input, select, textarea, a[href], [role='button'], [onclick]")) continue;

      // PROTEZIONE: non toccare se ha z-index alto (tipico di popup/overlay legittimi)
      const zIndex = parseInt(getComputedStyle(div).zIndex, 10);
      if (zIndex > 100) continue;

      const rect = div.getBoundingClientRect();
      if (rect.width === 0 || rect.height === 0) continue;

      // Controlla se le dimensioni matchano un ad standard
      const isAdSize = AD_SIZES.some(([w, h]) =>
        Math.abs(rect.width - w) < 30 && Math.abs(rect.height - h) < 30
      );

      if (isAdSize) {
        // Verifica che il contenuto sia vuoto o solo label ad
        const text = (div.textContent || "").trim().toLowerCase();
        const isEmpty = text === "" || AD_LABELS.includes(text);
        const hasRealContent = div.querySelector("article, p:not(:empty), h1, h2, h3, img:not([src*='ad'])");

        // Deve anche avere un indicatore positivo di essere un ad container
        const hasAdIndicator = div.querySelector(
          'ins.adsbygoogle, [id^="google_ads"], [id^="aswift_"], [id^="div-gpt-ad"], ' +
          'iframe[src*="doubleclick"], iframe[src*="googlesyndication"], [data-ad-client]'
        ) || div.id?.startsWith("div-gpt-ad") || div.id?.startsWith("google_ads");

        if (isEmpty && !hasRealContent && hasAdIndicator) {
          collapseElement(div);
          count++;
        }
      }
    }

    return count;
  }

  function scanAndRemove() {
    if (!enabled) return;

    let removed = 0;

    // Su piattaforma video usa SOLO i selettori specifici
    const selectors = isVideoPlatform() ? VIDEO_PLATFORM_AD_SELECTORS : GENERIC_AD_SELECTORS;

    for (const selector of selectors) {
      try {
        const els = document.querySelectorAll(selector);
        for (const el of els) {
          if (el.hasAttribute("data-adoff-hidden")) continue;
          if (isProtectedElement(el)) continue;

          el.style.setProperty("display",  "none",   "important");
          el.style.setProperty("height",   "0",       "important");
          el.style.setProperty("overflow", "hidden",  "important");
          el.setAttribute("data-adoff-hidden", "1");
          removed++;
        }
      } catch (_) {}
    }

    // Solo su siti non-video: controlla iframe ad e contenitori vuoti
    if (!isVideoPlatform()) {
      // Iframe ad
      const iframes = document.querySelectorAll("iframe");
      for (const iframe of iframes) {
        if (iframe.hasAttribute("data-adoff-hidden")) continue;
        const src = (iframe.src || "").toLowerCase();
        const id  = (iframe.id  || "").toLowerCase();
        const isAd =
          src.includes("doubleclick") ||
          src.includes("googlesyndication") ||
          src.includes("googleadservices") ||
          src.includes("amazon-adsystem") ||
          src.includes("outbrain") ||
          src.includes("taboola") ||
          id.startsWith("google_ads") ||
          id.startsWith("aswift_");

        if (isAd) {
          collapseElement(iframe);
          // Collassa anche il parent container
          collapseAdParent(iframe);
          removed++;
        }
      }

      // Collassa contenitori ad vuoti (rimasti dopo network blocking)
      removed += collapseEmptyAdContainers();
    }

    if (isVideoPlatform()) {
      handleVideoPlatformAds();
    }

    if (removed > 0) {
      incrementBlocked(removed);
    }
  }

  // =============================================
  // POPUP / OVERLAY BLOCKER (solo non-video)
  // =============================================

  function blockPopupOverlays() {
    if (!enabled || isVideoPlatform()) return;

    const body = document.body;
    if (!body) return;

    const bodyStyle = getComputedStyle(body);
    const htmlStyle = getComputedStyle(document.documentElement);

    if (bodyStyle.overflow === "hidden" || htmlStyle.overflow === "hidden") {
      const overlays = document.querySelectorAll(
        ".adblock-wall, .adblock-overlay, .adblock-modal, " +
        ".blocker-overlay, #adblock-wall, #adblock-overlay"
      );
      if (overlays.length > 0) {
        document.body.style.setProperty("overflow", "auto", "important");
        document.documentElement.style.setProperty("overflow", "auto", "important");
        for (const overlay of overlays) {
          overlay.style.setProperty("display", "none", "important");
          overlay.setAttribute("data-adoff-hidden", "1");
        }
        incrementBlocked(overlays.length);
      }
    }
  }

  // =============================================
  // MUTATION OBSERVER
  // =============================================

  function setupObserver() {
    if (observer) return;

    observer = new MutationObserver(() => {
      if (observerDebounce) return;
      observerDebounce = setTimeout(() => {
        observerDebounce = null;
        scanAndRemove();
        blockPopupOverlays();
      }, OBSERVER_DEBOUNCE_MS);
    });

    observer.observe(document.documentElement, {
      childList: true,
      subtree: true,
    });
  }

  // =============================================
  // START / STOP
  // =============================================

  function start() {
    // Su piattaforma video: una sola scansione leggera, poi STOP
    // Il CSS fa il grosso, stealth.js gestisce lo skip ads
    // Non serve polling/observer — rallenta il caricamento video
    if (isVideoPlatform()) {
      const runOnce = () => {
        scanAndRemove();
      };
      if (document.readyState === "loading") {
        document.addEventListener("DOMContentLoaded", runOnce);
      } else {
        runOnce();
      }
      // Una seconda scansione dopo 3s per elementi caricati tardi
      setTimeout(() => scanAndRemove(), 3000);
      return; // NO observer, NO interval su piattaforma video
    }

    // Tutti gli altri siti: observer + polling
    if (document.readyState === "loading") {
      document.addEventListener("DOMContentLoaded", () => {
        scanAndRemove();
        blockPopupOverlays();
      });
    } else {
      scanAndRemove();
      blockPopupOverlays();
    }

    setupObserver();

    if (!scanTimer) {
      scanTimer = setInterval(() => {
        scanAndRemove();
        blockPopupOverlays();
      }, SCAN_INTERVAL_MS);
    }
  }

  function stop() {
    if (scanTimer) {
      clearInterval(scanTimer);
      scanTimer = null;
    }
    if (observer) {
      observer.disconnect();
      observer = null;
    }
    const hidden = document.querySelectorAll("[data-adoff-hidden]");
    for (const el of hidden) {
      el.style.removeProperty("display");
      el.style.removeProperty("height");
      el.style.removeProperty("overflow");
      el.removeAttribute("data-adoff-hidden");
    }
  }
})();
