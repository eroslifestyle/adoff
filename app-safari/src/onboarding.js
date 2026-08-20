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

  // Detect browser
function detectBrowser() {
  const ua = navigator.userAgent;
  if (ua.includes("OPR") || ua.includes("Opera")) return "opera";
  if (ua.includes("Edg")) return "edge";
  if (ua.includes("Brave")) return "brave";
  if (ua.includes("Firefox")) return "firefox";
  if (ua.includes("Safari") && !ua.includes("Chrome") && !ua.includes("Chromium")) return "safari";
  return "chrome";
}

// Apply browser-specific pin instructions
function applyBrowserSteps(browser) {
  const step1 = document.querySelector('[data-i18n="onb.step1"]');
  const step1d = document.querySelector('[data-i18n="onb.step1d"]');
  const step3 = document.querySelector('[data-i18n="onb.step3"]');
  const step3d = document.querySelector('[data-i18n="onb.step3d"]');

  // Override with browser-specific keys if they exist
  const keyMap = {
    firefox: { s1: "onb.step1.firefox", s1d: "onb.step1d.firefox", s3: "onb.step3.firefox", s3d: "onb.step3d.firefox" },
    opera: { s1: "onb.step1.opera", s1d: "onb.step1d.opera", s3: "onb.step3.opera", s3d: "onb.step3d.opera" },
    edge: { s1: "onb.step1.edge", s1d: "onb.step1d.edge", s3: "onb.step3", s3d: "onb.step3d" },
    brave: { s1: "onb.step1", s1d: "onb.step1d", s3: "onb.step3", s3d: "onb.step3d" },
    safari: { s1: "onb.step1.safari", s1d: "onb.step1d.safari", s3: "onb.step3.safari", s3d: "onb.step3d.safari" },
    chrome: { s1: "onb.step1", s1d: "onb.step1d", s3: "onb.step3", s3d: "onb.step3d" },
  };

  const keys = keyMap[browser] || keyMap.chrome;
  // Fallback intelligente: se la traduzione torna la chiave letterale, usa il default chrome
  const tr = (k, fallbackKey) => {
    const v = i18n.t(k);
    return (v === k) ? i18n.t(fallbackKey) : v;
  };
  if (step1) step1.textContent = tr(keys.s1, "onb.step1");
  if (step1d) step1d.textContent = tr(keys.s1d, "onb.step1d");
  if (step3) step3.textContent = tr(keys.s3, "onb.step3");
  if (step3d) step3d.textContent = tr(keys.s3d, "onb.step3d");
}

// Initialize source select and handle attribution
function initSourceSelect() {
  if (!chrome.storage || !chrome.storage.local) return;

  const selectEl = document.getElementById("sourceSelect");
  if (!selectEl) return;

  // Apply translations to translatable option elements
  const translatableOptions = document.querySelectorAll("option[data-i18n]");
  for (const opt of translatableOptions) {
    const key = opt.getAttribute("data-i18n");
    const translated = i18n.t(key);
    if (translated && translated !== key) {
      opt.textContent = translated;
    }
  }

  // Listen for source selection
  selectEl.addEventListener("change", () => {
    const value = selectEl.value;

    // Validate format: src-<code> (2-20 alphanumeric + underscore)
    if (!value || !/^src-[a-z0-9_]{2,20}$/.test(value)) {
      return;
    }

    // Store the selected source
    chrome.storage.local.set({ adoffInstallSource: value });

    // Fire-and-forget attribution beacon (one-time)
    chrome.storage.local.get("adoffSourceReported", (r) => {
      if (r.adoffSourceReported) return;

      const ATTRIBUTION_API = "https://api.adoff.app/attribution/install";
      fetch(ATTRIBUTION_API, {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({ source: value })
      }).catch(() => {});

      chrome.storage.local.set({ adoffSourceReported: true });
    });
  });
}

// Init: translate page then apply browser-specific instructions
i18n.init(() => {
  i18n.applyToDOM();
  applyBrowserSteps(detectBrowser());
  initSourceSelect();
  renderTrialCountdown();
  renderVersion();
});

// Trial non piu' mostrato: tutto e' gratis e attivo.
function renderTrialCountdown() {
  const trialMsg = document.getElementById("trialMsg");
  const countdown = document.getElementById("trialCountdown");
  if (trialMsg) {
    trialMsg.innerHTML = "";
    const span = document.createElement("span");
    span.setAttribute("data-i18n", "onb.allFree");
    span.textContent = i18n && i18n.t ? i18n.t("onb.allFree") : "Every feature is on, free, no account needed.";
    trialMsg.appendChild(span);
  }
  if (countdown) countdown.style.display = "none";
}

// Render versione corrente da manifest (no hardcoded)
function renderVersion() {
  try {
    const v = chrome.runtime.getManifest().version;
    const el = document.getElementById("versionLabel");
    if (el) el.textContent = "AdOff v" + v;
  } catch (_) {
    // Fallback se non in chrome runtime context
  }
}

// Close tab button
document.getElementById("startBtn").addEventListener("click", () => {
  try { chrome.tabs.getCurrent((tab) => { if (tab) chrome.tabs.remove(tab.id); }); } catch (_) {}
  try { window.close(); } catch (_) {}
});
