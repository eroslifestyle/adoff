// =============================================
// STEALTH MODE — Runs in MAIN world
// Anti-adblock detection evasion
// =============================================
(function () {
  "use strict";

  const hostname = location.hostname;
  const isVideoPlatform = hostname.includes("youtube.com");

  // Siti dove lo stealth NON deve modificare API native
  // (rompono il funzionamento del sito)
  // NOTA: questo script gira in MAIN world e non ha accesso a chrome.storage,
  // quindi la lista e' hardcoded. La whitelist dinamica e' gestita da content.js
  // (ISOLATED world) che ha accesso a chrome.storage e termina l'esecuzione prima
  // di modificare il DOM se il dominio e' in whitelist.
  const STEALTH_EXCLUDED = [
    "youtube.com",
    "google.com", "google.it", "google.co",
    "gmail.com",
    "facebook.com",
    "instagram.com",
    "twitter.com", "x.com",
    "github.com",
    "reddit.com",
    "amazon.com", "amazon.it",
    "microsoft.com",
    "live.com", "outlook.com",
    "linkedin.com",
    // Travel / booking — SPA pesanti con click programmatici e window.open
    // su flow pagamento/seat-map. Il popup-blocker layer 2/3 rompe la nav.
    "ryanair.com",
    // Streaming ads-free — il player NON serve pubblicita'. IMA stub e stealth
    // override rompono il playback (Netflix manda il player in errore).
    "netflix.com",
  ];

  // Streaming premium con SSAI via Google DAI — il player ha bisogno
  // del vero google.ima per ottenere lo stream stitched. Stealth disattivato.
  const PREMIUM_STREAMING = [
    "paramountplus.com",
  ];

  const isPremiumStreaming = PREMIUM_STREAMING.some((d) => hostname.includes(d));
  const isStealhExcluded = isPremiumStreaming || STEALTH_EXCLUDED.some((d) => hostname.includes(d));

  // =============================================
  // POPUP / POPUNDER BLOCKER (MAIN world, document_start)
  // Vedi commento esteso nello stealth.js di app/ (Chrome).
  // =============================================
  (function popupBlocker() {
    const POPUP_AD_PATTERNS = [
      /popads\.net/i, /popcash\.net/i, /propellerads\.com/i,
      /adsterra\.com/i, /exoclick\.com/i, /juicyads\.com/i,
      /trafficjunky\.(?:com|net)/i, /clickadu\.com/i, /hilltopads\.net/i,
      /onclickadnow\.com/i, /onclkds\.com/i, /clkmon\.com/i,
      /clickdealer\.com/i, /mellowads\.com/i, /smartypop\.com/i,
      /tsyndicate\.com/i, /adskeeper\.com/i, /mgid\.com/i,
      /yllix\.com/i, /revenuehits\.com/i, /bidvertiser\.com/i,
      /adversal\.com/i, /infolinks\.com/i, /popunder/i,
      /\bpopads\b/i, /\bpop-?ads?\b/i, /\bpop-?under\b/i,
      /awsmsndr\.com/i, /clksite\.com/i, /clkrev\.com/i,
      /go\.onelink\.me\/.*\?af_xp/i, /trk\..*\?p=/i,
      /\/4\/\d{6,}/i,
      /\/smartpop/i, /\/popunder\.js/i,
      /^https?:\/\/[a-z0-9-]+\.(?:tk|ml|ga|cf|gq|click|loan|win|men|trade|top|gdn|surf|date|stream|cricket|science|party|review|kim|country|faith|racing|bid|webcam|download|accountant)\//i,
      /pushwhy\.com/i, /pushnam\.com/i, /pushhouse\.com/i,
      /pushtape\.com/i, /pushmaster\.io/i, /push-notification-/i,
      /\bredirect=https?%3A/i, /\bgo=https?%3A/i,
      /\/redirect\.php\?/i, /\/go\.php\?/i, /\/out\.php\?/i,
    ];

    function isPopupAdUrl(u) {
      if (!u || typeof u !== "string") return false;
      if (u === "about:blank" || u === "" || u === "javascript:void(0)") return false;
      return POPUP_AD_PATTERNS.some((re) => re.test(u));
    }

    let lastTrustedClick = 0;
    let windowsThisGesture = 0;
    let gestureTimer = null;

    function markGesture() {
      lastTrustedClick = Date.now();
      windowsThisGesture = 0;
      if (gestureTimer) clearTimeout(gestureTimer);
      gestureTimer = setTimeout(() => { windowsThisGesture = 0; }, 1000);
    }

    const GESTURE_EVENTS = ["click", "auxclick", "pointerdown", "mousedown", "touchstart", "keydown"];
    for (const ev of GESTURE_EVENTS) {
      window.addEventListener(ev, function (e) {
        if (e.isTrusted) markGesture();
      }, true);
    }

    const enableGestureCheck = !isStealhExcluded;

    const origOpen = window.open;
    function safeOpen(url, name, features) {
      try {
        const u = String(url || "");
        if (isPopupAdUrl(u)) {
          try { window.dispatchEvent(new CustomEvent("adoff-popup-blocked", { detail: { url: u } })); } catch (_) {}
          return null;
        }
        if (enableGestureCheck) {
          const sinceClick = Date.now() - lastTrustedClick;
          if (sinceClick > 1500) {
            try { window.dispatchEvent(new CustomEvent("adoff-popup-blocked", { detail: { url: u, reason: "no-gesture" } })); } catch (_) {}
            return null;
          }
          if (windowsThisGesture >= 1) {
            try { window.dispatchEvent(new CustomEvent("adoff-popup-blocked", { detail: { url: u, reason: "multi-window" } })); } catch (_) {}
            return null;
          }
          windowsThisGesture++;
        }
        return origOpen.apply(this, arguments);
      } catch (_) {
        return null;
      }
    }
    try {
      Object.defineProperty(window, "open", {
        value: safeOpen,
        writable: false,
        configurable: false,
      });
    } catch (_) {
      try { window.open = safeOpen; } catch (__) {}
    }

    const origAClick = HTMLAnchorElement.prototype.click;
    HTMLAnchorElement.prototype.click = function () {
      try {
        const href = String(this.href || "");
        if (isPopupAdUrl(href)) {
          try { window.dispatchEvent(new CustomEvent("adoff-popup-blocked", { detail: { url: href, reason: "anchor-click" } })); } catch (_) {}
          return;
        }
        if (enableGestureCheck && (this.target === "_blank" || this.target === "_new")) {
          const sinceClick = Date.now() - lastTrustedClick;
          if (sinceClick > 1500) {
            try { window.dispatchEvent(new CustomEvent("adoff-popup-blocked", { detail: { url: href, reason: "anchor-no-gesture" } })); } catch (_) {}
            return;
          }
        }
      } catch (_) {}
      return origAClick.apply(this, arguments);
    };

    window.addEventListener("adoff-popup-blocked", function () {
      try { document.documentElement.setAttribute("data-adoff-popup-blocked", String(Date.now())); } catch (_) {}
    });
  })();

  // =============================================
  // VIDEO PLATFORM AD ELIMINATION (MAIN world)
  //
  // 3-Layer zero-delay strategy:
  //
  // Layer A: PREVENT — Strip ad config from player responses.
  //   Video ads share the same CDN as content (googlevideo.com),
  //   so network-level blocking is impossible. We strip ad scheduling
  //   data from ytInitialPlayerResponse (first page load) and the
  //   /youtubei/v1/player API (SPA navigation) before the player
  //   reads it. Result: zero ads scheduled, zero delay, zero black screen.
  //
  // Layer B: INSTANT SKIP — Fallback for any ads that slip through.
  //   video.currentTime = video.duration ends the ad instantly.
  //   playbackRate = 16 as insurance if seeking is blocked.
  //   Immediate skip button click, 50ms polling.
  //   NOTE: currentTime on ad video is safe — the player handles
  //   content position restoration internally after ad completion.
  //
  // Layer C: ANTI-DETECTION — ratechange masking, overlay closing.
  // =============================================
  if (isVideoPlatform) {

    // ---- LAYER A: Ad Prevention (strip ad config) ----

    // Mangle ad field names in JSON text — makes them unrecognizable
    // to the player without breaking JSON structure
    const AD_MANGLE = [
      [/"adPlacements"/g, '"xdPlacements"'],
      [/"playerAds"/g, '"playerXds"'],
      [/"adSlots"/g, '"xdSlots"'],
      [/"adBreakParams"/g, '"xdBreakParams"'],
      [/"adBreakHeartbeatParams"/g, '"xdBreakHeartbeatParams"'],
    ];

    function mangleAdFields(text) {
      for (const [re, rep] of AD_MANGLE) text = text.replace(re, rep);
      return text;
    }

    // Object-level deletion for ytInitialPlayerResponse
    const AD_KEYS = [
      "adPlacements", "playerAds", "adSlots",
      "adBreakParams", "adBreakHeartbeatParams",
    ];

    function stripAdObj(obj) {
      if (!obj || typeof obj !== "object") return obj;
      for (const k of AD_KEYS) { if (k in obj) delete obj[k]; }
      if (obj.playerResponse) stripAdObj(obj.playerResponse);
      return obj;
    }

    // A1: Hook ytInitialPlayerResponse before YouTube's inline script sets it
    // Gating runtime: Free passthrough (no strip), Pro/Trial strip.
    // L'hook si installa sempre a document_start per non perdere il primo set;
    // la decisione strip vs passthrough avviene quando YouTube chiama il setter.
    let _ytResp = window.ytInitialPlayerResponse;
    Object.defineProperty(window, "ytInitialPlayerResponse", {
      get() { return _ytResp; },
      set(v) { _ytResp = isStealthEnabled() ? stripAdObj(v) : v; },
      configurable: true,
    });
    if (_ytResp && isStealthEnabled()) _ytResp = stripAdObj(_ytResp);

    // A2: Intercept fetch for player API (SPA navigation)
    //
    // ANTI SABR-BACKOFF: inject `isInlinePlaybackNoAd:true` into the
    // request body. This tells InnerTube NOT to schedule ads, which
    // prevents the server from baking a "backoff" delay (~80% of ad
    // duration) into the GVS stream URL. Without this, even when ads
    // are blocked the user sees long black-screen pauses equal to
    // what the ad would have lasted.
    //
    // Reference: https://iter.ca/post/yt-adblock + uBO Smitty filter.
    function injectNoAd(body) {
      if (typeof body !== "string") return body;
      if (!body.includes('"contentPlaybackContext":{')) return body;
      if (body.includes('"isInlinePlaybackNoAd"')) return body;
      return body.replace(
        '"contentPlaybackContext":{',
        '"contentPlaybackContext":{"isInlinePlaybackNoAd":true,'
      );
    }

    const _origFetch = window.fetch;
    window.fetch = function (input, init) {
      const url = typeof input === "string" ? input : (input?.url || "");
      const isPlayerReq = url.includes("/youtubei/v1/player") ||
                          url.includes("/youtubei/v1/next");

      // Free: passthrough completo sulle player API. Solo Pro/Trial modifica
      // request body (isInlinePlaybackNoAd) e mangle response (adPlacements/...).
      if (!isPlayerReq || !isStealthEnabled()) {
        return _origFetch.call(window, input, init);
      }

      // Inject isInlinePlaybackNoAd in the outbound request body
      if (init && init.body) {
        const newBody = injectNoAd(init.body);
        if (newBody !== init.body) {
          init = Object.assign({}, init, { body: newBody });
        }
      }

      return _origFetch.call(window, input, init).then(function (resp) {
        const clone = resp.clone();
        return clone.text().then(function (txt) {
          try {
            return new Response(mangleAdFields(txt), {
              status: resp.status,
              statusText: resp.statusText,
              headers: resp.headers,
            });
          } catch (_) { return resp; }
        });
      });
    };

    // A3: XHR interception (some legacy YouTube paths use XMLHttpRequest)
    try {
      const _xhrOpen = XMLHttpRequest.prototype.open;
      const _xhrSend = XMLHttpRequest.prototype.send;
      XMLHttpRequest.prototype.open = function (method, url) {
        this._adoffUrl = String(url || "");
        return _xhrOpen.apply(this, arguments);
      };
      XMLHttpRequest.prototype.send = function (body) {
        // Free: passthrough. Pro/Trial inietta isInlinePlaybackNoAd.
        if (isStealthEnabled() && this._adoffUrl &&
            (this._adoffUrl.includes("/youtubei/v1/player") ||
             this._adoffUrl.includes("/youtubei/v1/next"))) {
          body = injectNoAd(body);
        }
        return _xhrSend.call(this, body);
      };
    } catch (_) { /* ignore — XHR may be locked on some pages */ }

    // Layer B/C/Observer — attivati dal ytProChecker solo se Pro/Trial confermato.
    // Definiti come funzione per essere chiamati on-demand quando arriva il gate.
    function activateYoutubeRuntimeKiller() {

    // ---- LAYER B: Instant Skip (fallback for ads that slip through) ----
    //
    // CRITICAL: ad and content share the SAME <video> element on YouTube
    // (MSE source switching). Setting currentTime=duration on the ad video
    // corrupts the content's resume position — the player loses track of
    // where the user was watching. Confirmed by users + April 2026 YouTube bug.
    //
    // Fix: only fast-forward via playbackRate (FadBlock approach), and
    // save/restore the content position around every ad as safety net.

    let adActive = false;
    let wasMuted = false;
    let playerObs = null;
    let skipTimer = null;
    let savedContentTime = 0;     // last known content position (pre-ad)
    let recoveryTimer = null;     // restore-position watchdog
    let positionTracker = null;   // interval that updates savedContentTime

    function instantSkip(player) {
      const video = player.querySelector("video");
      if (video) {
        // SAFE: just speed through the ad. Do NOT set currentTime on the ad
        // video — that breaks YouTube's content position tracking.
        video.playbackRate = 16;
      }
      // Click skip button immediately (no humanized delay — MAIN world)
      const skip = player.querySelector(
        ".ytp-skip-ad-button, .ytp-ad-skip-button, " +
        ".ytp-ad-skip-button-modern, .ytp-ad-skip-button-slot button, " +
        "[id^='skip-button'], .videoAdUiSkipButton"
      );
      if (skip?.offsetParent !== null) skip.click();
      // Close overlay ads
      for (const btn of player.querySelectorAll(
        ".ytp-ad-overlay-close-button, .ytp-ad-overlay-close-container"
      )) { if (btn.offsetParent !== null) btn.click(); }
    }

    function onAdStart(player) {
      if (adActive) { instantSkip(player); return; }
      adActive = true;

      // Cancel any pending recovery from a previous ad
      if (recoveryTimer) { clearTimeout(recoveryTimer); recoveryTimer = null; }

      const video = player.querySelector("video");
      if (video) {
        video._adoffSkipping = true;
        if (!video.muted) { video.muted = true; wasMuted = true; }
      }

      instantSkip(player);

      // Aggressive 50ms polling until ad clears
      if (skipTimer) clearInterval(skipTimer);
      skipTimer = setInterval(function () {
        if (!player.classList.contains("ad-showing") &&
            !player.classList.contains("ad-interrupting")) {
          clearInterval(skipTimer); skipTimer = null; return;
        }
        instantSkip(player);
      }, 50);

      window.dispatchEvent(new CustomEvent("adoff-ad-skipped"));
    }

    function onAdEnd(player) {
      if (!adActive) return;
      adActive = false;
      if (skipTimer) { clearInterval(skipTimer); skipTimer = null; }

      const video = player.querySelector("video");
      if (video) {
        video._adoffSkipping = false;
        video.playbackRate = 1;
        if (wasMuted) { video.muted = false; wasMuted = false; }
      }

      // ---- POSITION RECOVERY ----
      // After the ad, YouTube may resume from the wrong position
      // (known YouTube bug + side-effect of ad source-swap). If the
      // content video lands far from where the user was, we force-restore.
      const target = savedContentTime;
      if (!video || target <= 2) return;

      let attempts = 0;
      const maxAttempts = 30; // ~3s total
      let restored = false;

      function tryRecover() {
        attempts++;
        // Abort if a new ad started
        if (player.classList.contains("ad-showing") ||
            player.classList.contains("ad-interrupting")) {
          recoveryTimer = null;
          return;
        }
        const ct = video.currentTime;
        const dur = video.duration;
        // Wait for content video to be loaded enough
        if (!isFinite(ct) || !isFinite(dur) || dur <= 0) {
          if (attempts < maxAttempts) {
            recoveryTimer = setTimeout(tryRecover, 100);
          } else {
            recoveryTimer = null;
          }
          return;
        }
        // If content position is sane (within 5s of saved), accept it.
        // Tolerance accounts for natural playback during recovery loop.
        if (Math.abs(ct - target) <= 5) {
          recoveryTimer = null;
          return;
        }
        // Position is wrong — force-restore (only once)
        if (!restored && target < dur - 1) {
          restored = true;
          try {
            video.currentTime = target;
          } catch (_) { /* ignore */ }
          // Verify after a tick — YouTube may override us
          recoveryTimer = setTimeout(tryRecover, 200);
          return;
        }
        // Already restored, give up if YouTube keeps overriding
        recoveryTimer = null;
      }

      recoveryTimer = setTimeout(tryRecover, 200);
    }

    // ---- POSITION TRACKER ----
    // Continuously remember the content video's currentTime while NOT in
    // an ad. When an ad starts, savedContentTime holds the user's last
    // real position — used by onAdEnd for recovery.
    if (positionTracker) clearInterval(positionTracker);
    positionTracker = setInterval(function () {
      if (adActive) return;
      const p = document.getElementById("movie_player");
      if (!p) return;
      // Skip if YouTube hasn't classified the player yet
      if (p.classList.contains("ad-showing") ||
          p.classList.contains("ad-interrupting")) return;
      const v = p.querySelector("video");
      if (!v) return;
      const ct = v.currentTime;
      if (!isFinite(ct) || ct <= 1) return;
      savedContentTime = ct;
    }, 500);

    // ---- LAYER C: Anti-detection (insurance) ----

    // Mask ratechange events during ad skip to avoid detection
    const _origAddEvt = HTMLMediaElement.prototype.addEventListener;
    HTMLMediaElement.prototype.addEventListener = function (type, fn, opts) {
      if (type === "ratechange") {
        const wrapped = function (e) {
          if (this._adoffSkipping) return;
          fn.call(this, e);
        };
        return _origAddEvt.call(this, type, wrapped, opts);
      }
      return _origAddEvt.call(this, type, fn, opts);
    };

    // ---- Observer + Polling ----

    function checkPlayer() {
      const p = document.getElementById("movie_player");
      if (!p) return;
      const isAd = p.classList.contains("ad-showing") ||
                   p.classList.contains("ad-interrupting");
      if (isAd) onAdStart(p); else onAdEnd(p);
    }

    function attachObs() {
      const p = document.getElementById("movie_player");
      if (!p) return false;
      if (playerObs) playerObs.disconnect();
      playerObs = new MutationObserver(checkPlayer);
      playerObs.observe(p, { attributes: true, attributeFilter: ["class"] });
      checkPlayer();
      return true;
    }

    (function poll() { if (!attachObs()) setTimeout(poll, 200); })();

    // SPA navigation: re-attach after page transition
    document.addEventListener("yt-navigate-finish", function () {
      setTimeout(attachObs, 100);
    });

    // Fast fallback polling (100ms)
    setInterval(checkPlayer, 100);

    } // fine activateYoutubeRuntimeKiller()

    // Gating Pro/Trial: Layer A e' gia' installato sopra con check runtime
    // (no-op se Free). Qui aspettiamo content.js per attivare Layer B/C.
    let ytProCheckCount = 0;
    const ytProChecker = setInterval(() => {
      ytProCheckCount++;
      if (isStealthEnabled()) {
        clearInterval(ytProChecker);
        activateYoutubeRuntimeKiller();
      } else if (ytProCheckCount >= 20) {
        // Dopo 2s senza segnale Pro/Trial — Free: niente skip runtime,
        // YouTube programma e mostra gli ads normalmente.
        clearInterval(ytProChecker);
      }
    }, 100);

    return;
  }

  // Siti grandi esclusi — le API override rompono i loro script
  if (isStealhExcluded) return;

  // Stealth mode e' SOLO per Pro/Trial
  // content.js (ISOLATED) setta data-adoff-stealth con un nonce nel formato "ao_XXXXXXXX"
  // EB-7: verifica il formato del nonce — un sito malevolo non conosce il formato esatto
  function isStealthEnabled() {
    const val = document.documentElement.getAttribute("data-adoff-stealth") || "";
    // Nonce generato da content.js: "ao_" + 8 caratteri hex lowercase
    return /^ao_[0-9a-f]{8}$/.test(val);
  }

  // Attendi che content.js comunichi lo stato licenza (max 2s)
  let stealthCheckCount = 0;
  const stealthChecker = setInterval(() => {
    stealthCheckCount++;
    if (isStealthEnabled()) {
      clearInterval(stealthChecker);
      activateStealth();
    } else if (stealthCheckCount >= 20) {
      // Dopo 2s senza segnale Pro — stealth disabilitato (versione Free)
      clearInterval(stealthChecker);
    }
  }, 100);

  function activateStealth() {

  // =============================================
  // STEALTH ANTI-ADBLOCK (Solo Pro/Trial)
  // =============================================

  // ---- 1. BAIT ELEMENT PROTECTION ----
  const BAIT_PATTERNS = [
    /\bads?\b/i,
    /\badsbox\b/i,
    /\bad[-_]banner\b/i,
    /\bad[-_]slot\b/i,
    /\bad[-_]?unit\b/i,
    /\bbanner[-_]ad\b/i,
    /\badvert\b/i,
    /\badsbygoogle\b/i,
  ];

  function isBaitClass(str) {
    if (!str) return false;
    return BAIT_PATTERNS.some((re) => re.test(str));
  }

  const origGetComputedStyle = window.getComputedStyle;
  window.getComputedStyle = function (el, pseudo) {
    const style = origGetComputedStyle.call(window, el, pseudo);

    if (el && (isBaitClass(el.className) || isBaitClass(el.id))) {
      try {
        return new Proxy(style, {
          get(target, prop) {
            if (prop === "display") return "block";
            if (prop === "visibility") return "visible";
            if (prop === "opacity") return "1";
            if (prop === "height") return "250px";
            if (prop === "width") return "300px";
            const val = target[prop];
            return typeof val === "function" ? val.bind(target) : val;
          },
        });
      } catch (_) {
        return style;
      }
    }

    return style;
  };

  const origOffsetHeight = Object.getOwnPropertyDescriptor(HTMLElement.prototype, "offsetHeight");
  const origOffsetWidth = Object.getOwnPropertyDescriptor(HTMLElement.prototype, "offsetWidth");

  if (origOffsetHeight) {
    Object.defineProperty(HTMLElement.prototype, "offsetHeight", {
      get() {
        if (isBaitClass(this.className) || isBaitClass(this.id)) return 250;
        return origOffsetHeight.get.call(this);
      },
    });
  }

  if (origOffsetWidth) {
    Object.defineProperty(HTMLElement.prototype, "offsetWidth", {
      get() {
        if (isBaitClass(this.className) || isBaitClass(this.id)) return 300;
        return origOffsetWidth.get.call(this);
      },
    });
  }

  // ---- 2. FETCH / XHR INTERCEPTION ----
  const DETECTION_PATTERNS = [
    /blockadblock/i,
    /fuckadblock/i,
    /detectadblock/i,
    /fundingchoicesmessages/i,
  ];

  function isDetectionUrl(url) {
    if (!url) return false;
    return DETECTION_PATTERNS.some((p) => p.test(url));
  }

  const origFetch = window.fetch;
  window.fetch = function (input, init) {
    const url = typeof input === "string" ? input : (input && input.url) || "";
    if (isDetectionUrl(url)) {
      return Promise.resolve(new Response("", { status: 200, statusText: "OK" }));
    }
    return origFetch.call(window, input, init);
  };

  const origXHROpen = XMLHttpRequest.prototype.open;
  const origXHRSend = XMLHttpRequest.prototype.send;

  XMLHttpRequest.prototype.open = function (method, url) {
    this._ssUrl = url;
    return origXHROpen.apply(this, arguments);
  };

  XMLHttpRequest.prototype.send = function () {
    if (this._ssUrl && isDetectionUrl(this._ssUrl)) {
      Object.defineProperty(this, "readyState", { value: 4, writable: false });
      Object.defineProperty(this, "status", { value: 200, writable: false });
      Object.defineProperty(this, "responseText", { value: "", writable: false });
      if (typeof this.onreadystatechange === "function") this.onreadystatechange();
      if (typeof this.onload === "function") this.onload();
      return;
    }
    return origXHRSend.apply(this, arguments);
  };

  // ---- 3. ADBLOCK VARIABLE SPOOFING ----
  if (!window.adsbygoogle) {
    window.adsbygoogle = { loaded: true, push: function () {}, length: 1 };
  }

  if (!window.googletag) {
    window.googletag = window.googletag || {};
    window.googletag.cmd = window.googletag.cmd || [];
    window.googletag.pubads = function () {
      return {
        addEventListener: function () { return this; },
        setTargeting: function () { return this; },
        refresh: function () {},
        enableSingleRequest: function () { return this; },
        disableInitialLoad: function () {},
        collapseEmptyDivs: function () {},
        getSlots: function () { return []; },
        clear: function () {},
      };
    };
    window.googletag.enableServices = function () {};
    window.googletag.defineSlot = function () {
      return {
        addService: function () { return this; },
        setTargeting: function () { return this; },
        defineSizeMapping: function () { return this; },
        setCollapseEmptyDiv: function () { return this; },
      };
    };
    window.googletag.defineOutOfPageSlot = window.googletag.defineSlot;
    window.googletag.display = function () {};
    window.googletag.destroySlots = function () {};
    window.googletag.sizeMapping = function () {
      return { addSize: function () { return this; }, build: function () { return []; } };
    };
    window.googletag.apiReady = true;
    window.googletag.pubadsReady = true;
  }

  // ---- 4. ANTI-ADBLOCK SCRIPT NEUTRALIZERS ----
  const origCreateElement = document.createElement;
  document.createElement = function (tag) {
    const el = origCreateElement.call(document, tag);
    if (typeof tag === "string" && tag.toLowerCase() === "script") {
      const origSetSrc = Object.getOwnPropertyDescriptor(HTMLScriptElement.prototype, "src");
      if (origSetSrc && origSetSrc.set) {
        let _src = "";
        Object.defineProperty(el, "src", {
          get() { return _src; },
          set(val) {
            _src = val;
            const lower = String(val).toLowerCase();
            if (lower.includes("blockadblock") || lower.includes("fuckadblock") ||
                lower.includes("detectadblock") || lower.includes("anti-adblock")) {
              return;
            }
            origSetSrc.set.call(this, val);
          },
          configurable: true,
        });
      }
    }
    return el;
  };

  // ---- 5. SCROLL LOCK PREVENTION ----
  // Blocca overflow:hidden su body/html SOLO se causato da un wall anti-adblock
  // NON bloccare se ci sono popup/dialog/modal legittimi aperti
  const origSetProperty = CSSStyleDeclaration.prototype.setProperty;
  CSSStyleDeclaration.prototype.setProperty = function (prop, val, priority) {
    if (prop === "overflow" && val === "hidden") {
      const target = this;
      if (target === document.body?.style || target === document.documentElement?.style) {
        // Verifica che ci sia un wall anti-adblock VISIBILE
        const walls = document.querySelectorAll(
          '[class*="adblock"], [id*="adblock"], [class*="blocker-overlay"]'
        );
        const hasVisibleWall = Array.from(walls).some((w) => {
          const r = w.getBoundingClientRect();
          return r.width > 0 && r.height > 0;
        });
        // NON bloccare se ci sono popup/dialog/modal legittimi aperti
        const hasLegitPopup = document.querySelector(
          '[role="dialog"], [role="alertdialog"], [aria-modal="true"], ' +
          '.modal.show, .modal.active, .popup.active, .fancybox-is-open, ' +
          '.swal2-shown, .mfp-ready, [data-modal-open]'
        );
        if (hasVisibleWall && !hasLegitPopup) return;
      }
    }
    return origSetProperty.call(this, prop, val, priority);
  };

  // ---- 6. MUTATION PROTECTION ----
  const origAppendChild = Node.prototype.appendChild;
  Node.prototype.appendChild = function (child) {
    if (child && child.tagName === "SCRIPT") {
      const src = String(child.src || "");
      const text = child.textContent || "";
      const srcLower = src.toLowerCase();
      // EM-5: pattern piu' specifico per rilevare script anti-adblock reali
      // Evita falsi positivi su articoli/contenuti che menzionano "adblock"
      const isAntiAdblockSrc = (
        srcLower.includes("blockadblock") ||
        srcLower.includes("fuckadblock") ||
        srcLower.includes("detectadblock") ||
        srcLower.includes("anti-adblock")
      );
      const isAntiAdblock = (
        (text.includes("adblock") || text.includes("ad-block") || text.includes("adblocker")) &&
        (text.includes("detected") || text.includes("disable") || text.includes("whitelist")) &&
        text.length < 5000 // Gli script anti-adblock sono piccoli, gli articoli sono grandi
      );
      if (isAntiAdblockSrc || isAntiAdblock) {
        return child;
      }
    }
    return origAppendChild.call(this, child);
  };

  } // fine activateStealth()

})();
