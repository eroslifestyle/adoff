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
  // Siti broadcasting — ricevono IMA stub (blocco video ads)
  const BROADCASTER_SITES = [
    // IT
    "raiplay.it", "rai.it",
    "mediasetinfinity.mediaset.it", "mediaset.it",
    "la7.it", "discoveryplus.com",
    // EN
    "bbc.co.uk", "bbc.com",
    "itv.com", "itvx.com",
    "channel4.com", "channel5.com", "my5.tv",
    "pbs.org", "pluto.tv", "tubi.tv",
    // DE
    "zdf.de", "ard.de", "ardmediathek.de",
    "rtl.de", "rtlplus.de", "joyn.de",
    "servustv.com", "orf.at",
    // FR
    "france.tv", "tf1.fr",
    "6play.fr", "m6.fr",
    "arte.tv", "mycanal.fr",
    // ES
    "rtve.es", "atresplayer.com",
    "mitele.es", "lasexta.com",
    // PT
    "rtp.pt", "tvi.pt", "sic.pt",
    "globoplay.globo.com", "globo.com",
    // CH
    "srf.ch", "rsi.ch", "rts.ch",
  ];

  const STEALTH_EXCLUDED = [
    // Big tech — stealth API overrides rompono questi siti
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

  // Streaming premium con SSAI via Google DAI — il content stream
  // arriva attraverso DAI, quindi google.ima.dai.api.StreamManager DEVE
  // funzionare nativamente. IMA stub e stealth disabilitati su questi siti.
  const PREMIUM_STREAMING = [
    "paramountplus.com",
    "parampunt.com",
  ];

  const isBroadcaster = BROADCASTER_SITES.some((d) => hostname.includes(d));
  const isPremiumStreaming = PREMIUM_STREAMING.some((d) => hostname.includes(d));
  const isStealhExcluded = isBroadcaster || isPremiumStreaming || STEALTH_EXCLUDED.some((d) => hostname.includes(d));

  // =============================================
  // POPUP / POPUNDER BLOCKER (MAIN world, document_start)
  //
  // Blocca le finestre/tab pubblicitarie aperte dai siti di streaming
  // pirata, aggregatori, mirror video. Tre layer di difesa:
  //
  //   Layer 1 — URL blacklist: pattern di popunder ad networks noti
  //             (ExoClick, PopAds, TrafficJunky, AdsTerra, ...) e
  //             TLD/path cloaking comuni nei redirect a pagamento.
  //   Layer 2 — User-gesture verification: window.open() chiamato
  //             senza click utente recente (<1s, isTrusted) viene
  //             bloccato. I popunder usano timer/eventi sintetici.
  //   Layer 3 — Multi-window throttle: piu' di 1 window.open per
  //             gesture e' signature popunder ("aprire 3 tab al click
  //             su play"). Blocchiamo dalla seconda in poi.
  //
  // Disabilitato sui big tech (STEALTH_EXCLUDED) e broadcaster
  // (BROADCASTER_SITES, PREMIUM_STREAMING) dove popup legittimi
  // sono attesi (auth OAuth, dialog, payment, share). Layer 1 (URL
  // blacklist) resta attivo ovunque — quegli URL non sono mai voluti.
  // =============================================
  (function popupBlocker() {
    // Layer 1 — URL blacklist (sempre attivo, anche su big tech)
    const POPUP_AD_PATTERNS = [
      // Popunder ad networks
      /popads\.net/i, /popcash\.net/i, /propellerads\.com/i,
      /adsterra\.com/i, /exoclick\.com/i, /juicyads\.com/i,
      /trafficjunky\.(?:com|net)/i, /clickadu\.com/i, /hilltopads\.net/i,
      /onclickadnow\.com/i, /onclkds\.com/i, /clkmon\.com/i,
      /clickdealer\.com/i, /mellowads\.com/i, /smartypop\.com/i,
      /tsyndicate\.com/i, /adskeeper\.com/i, /mgid\.com/i,
      /yllix\.com/i, /revenuehits\.com/i, /bidvertiser\.com/i,
      /adversal\.com/i, /infolinks\.com/i, /popunder/i,
      /\bpopads\b/i, /\bpop-?ads?\b/i, /\bpop-?under\b/i,
      // Cloaking/redirect comuni nei popunder
      /awsmsndr\.com/i, /clksite\.com/i, /clkrev\.com/i,
      /go\.onelink\.me\/.*\?af_xp/i, /trk\..*\?p=/i,
      /\/4\/\d{6,}/i,               // ExoClick zone tracker path
      /\/smartpop/i, /\/popunder\.js/i,
      // Pattern domini TLD a basso costo + query tracker (cloak)
      /^https?:\/\/[a-z0-9-]+\.(?:tk|ml|ga|cf|gq|click|loan|win|men|trade|top|gdn|surf|date|stream|cricket|science|party|review|kim|country|faith|cricket|racing|bid|webcam|download|accountant)\//i,
      // Push-notification ad networks ("vuoi ricevere notifiche?")
      /pushwhy\.com/i, /pushnam\.com/i, /pushhouse\.com/i,
      /pushtape\.com/i, /pushmaster\.io/i, /push-notification-/i,
      // Generic cloak redirects
      /\bredirect=https?%3A/i, /\bgo=https?%3A/i,
      /\/redirect\.php\?/i, /\/go\.php\?/i, /\/out\.php\?/i,
    ];

    function isPopupAdUrl(u) {
      if (!u || typeof u !== "string") return false;
      // about:blank popup poi assegna location → check parziale
      if (u === "about:blank" || u === "" || u === "javascript:void(0)") return false;
      return POPUP_AD_PATTERNS.some((re) => re.test(u));
    }

    // Layer 2/3 — gesture tracking
    let lastTrustedClick = 0;
    let windowsThisGesture = 0;
    let gestureTimer = null;

    function markGesture() {
      lastTrustedClick = Date.now();
      windowsThisGesture = 0;
      if (gestureTimer) clearTimeout(gestureTimer);
      gestureTimer = setTimeout(() => { windowsThisGesture = 0; }, 1000);
    }

    // Capture phase: registriamo il gesture PRIMA che il sito lo intercetti
    const GESTURE_EVENTS = ["click", "auxclick", "pointerdown", "mousedown", "touchstart", "keydown"];
    for (const ev of GESTURE_EVENTS) {
      window.addEventListener(ev, function (e) {
        if (e.isTrusted) markGesture();
      }, true);
    }

    // Disabilita Layer 2/3 sui big tech / broadcaster / streaming premium
    // dove popup legittimi sono attesi
    const enableGestureCheck = !isStealhExcluded;

    const origOpen = window.open;
    function safeOpen(url, name, features) {
      try {
        const u = String(url || "");
        // Layer 1: sempre attivo
        if (isPopupAdUrl(u)) {
          try { window.dispatchEvent(new CustomEvent("adoff-popup-blocked", { detail: { url: u } })); } catch (_) {}
          return null;
        }
        // Layer 2/3: solo se non big tech
        if (enableGestureCheck) {
          const sinceClick = Date.now() - lastTrustedClick;
          // window.open senza gesto utente recente (>1.5s) → popunder
          if (sinceClick > 1500) {
            try { window.dispatchEvent(new CustomEvent("adoff-popup-blocked", { detail: { url: u, reason: "no-gesture" } })); } catch (_) {}
            return null;
          }
          // 2+ finestre nello stesso click → popunder signature
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
    // Manteniamo la prototype chain originale
    try {
      Object.defineProperty(window, "open", {
        value: safeOpen,
        writable: false,
        configurable: false,
      });
    } catch (_) {
      try { window.open = safeOpen; } catch (__) {}
    }

    // HTMLAnchorElement.click() programmatico verso ad networks
    // (popunder spesso fa: a = document.createElement('a'); a.href=ad; a.target='_blank'; a.click())
    const origAClick = HTMLAnchorElement.prototype.click;
    HTMLAnchorElement.prototype.click = function () {
      try {
        const href = String(this.href || "");
        if (isPopupAdUrl(href)) {
          try { window.dispatchEvent(new CustomEvent("adoff-popup-blocked", { detail: { url: href, reason: "anchor-click" } })); } catch (_) {}
          return;
        }
        // target=_blank programmatico senza gesto recente
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

    // Notifica content.js (ISOLATED) per incrementare contatore + badge
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

    // Kill-switch compatibilita': se attivo, NON tocchiamo la config ads della
    // pagina (niente strip, niente mangle, niente inject) e lasciamo che la
    // piattaforma programmi gli annunci normalmente — vengono poi bruciati a
    // runtime dal Layer B. Serve quando lo strip fa reagire il server con
    // attese/buffering al posto dell'annuncio.
    // Letto da localStorage perche' qui siamo a document_start e serve una
    // lettura SINCRONA: content.js lo scrive al load precedente.
    function isVideoCompatMode() {
      try { if (localStorage.getItem("__adoff_vc") === "1") return true; } catch (_) { /* negato */ }
      return document.documentElement?.getAttribute("data-adoff-vcompat") === "1";
    }

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
    //
    // CRITICO — la decisione NON va presa nel setter. YouTube assegna
    // ytInitialPlayerResponse da uno script inline pochi ms dopo document_start,
    // mentre il verdetto Pro arriva da content.js solo dopo storage.get +
    // verifica ECDSA del token trial (entrambe asincrone). Decidendo nel set si
    // perde quella corsa quasi sempre: gli adPlacements passano intatti e il
    // player schedula tutti gli annunci. Lo strip e' quindi PIGRO, valutato al
    // get: il player legge la config molto piu' tardi (playerBootstrap), quando
    // il gate e' arrivato. isProSync legge in piu' il canale localStorage
    // sincrono, che copre anche una lettura anticipata.
    let _ytResp = window.ytInitialPlayerResponse;
    let _ytStripped = false;

    function stripYtRespIfPro() {
      if (_ytStripped || !_ytResp) return;
      if (!isProSync() || isVideoCompatMode()) return;
      stripAdObj(_ytResp);
      _ytStripped = true;
    }

    Object.defineProperty(window, "ytInitialPlayerResponse", {
      get() { stripYtRespIfPro(); return _ytResp; },
      set(v) { _ytResp = v; _ytStripped = false; stripYtRespIfPro(); },
      configurable: true,
    });
    stripYtRespIfPro();

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
      if (!isPlayerReq || !isProSync() || isVideoCompatMode()) {
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
        if (isProSync() && !isVideoCompatMode() && this._adoffUrl &&
            (this._adoffUrl.includes("/youtubei/v1/player") ||
             this._adoffUrl.includes("/youtubei/v1/next"))) {
          body = injectNoAd(body);
        }
        return _xhrSend.call(this, body);
      };
    } catch (_) { /* ignore — XHR may be locked on some pages */ }

    // Layer B/C/Observer — attivati dal proChecker solo se Pro/Trial confermato.
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

    // Terminazione immediata dell'annuncio: vedi il commento dentro instantSkip.
    const AD_END_OFFSET_SEC = 0.15;
    const AD_END_MIN_READY_STATE = 1;   // bastano i metadati: serve solo duration

    let adEndForced = false;            // una sola terminazione per annuncio

    function instantSkip(player) {
      const video = player.querySelector("video");
      if (video) {
        // Un annuncio in pausa non finisce mai.
        if (video.paused) {
          try {
            const p = video.play();
            if (p && typeof p.catch === "function") p.catch(() => {});
          } catch (_) { /* ignore */ }
        }
        // Portare currentTime alla fine e' l'unico modo affidabile di terminare
        // un annuncio: il pulsante di salto spesso non esiste (annunci non
        // saltabili) e playbackRate viene rimesso a 1 dal player, quindi
        // accelerare non basta. La posizione del contenuto viene poi
        // ripristinata dal recupero gia' presente (savedContentTime + onAdEnd).
        if (!adEndForced && video.readyState >= AD_END_MIN_READY_STATE &&
            isFinite(video.duration) && video.duration > 0) {
          const ctPrima = video.currentTime;
          adEndForced = true;
          try {
            video.currentTime = Math.max(0, video.duration - AD_END_OFFSET_SEC);
          } catch (_) { /* seek negato dal player */ }
          window.dispatchEvent(new CustomEvent("adoff-ad-ended", {
            detail: { adDuration: video.duration, ctPrima },
          }));
        }
        // Rete di sicurezza se il seek viene bloccato o annullato dal player.
        video.playbackRate = 16;
      }
      const skip = player.querySelector(
        ".ytp-skip-ad-button, .ytp-ad-skip-button, " +
        ".ytp-ad-skip-button-modern, .ytp-ad-skip-button-slot button, " +
        "[id^='skip-button'], .videoAdUiSkipButton"
      );
      // skip && ... : con solo skip?.offsetParent, se il pulsante non esiste la
      // condizione e' vera (undefined !== null) e skip.click() lancia TypeError.
      if (skip && skip.offsetParent !== null) skip.click();
      for (const btn of player.querySelectorAll(
        ".ytp-ad-overlay-close-button, .ytp-ad-overlay-close-container"
      )) { if (btn.offsetParent !== null) btn.click(); }
    }

    function resetAdSkipState() {
      adEndForced = false;
    }

    function onAdStart(player) {
      if (adActive) { instantSkip(player); return; }
      adActive = true;
      resetAdSkipState();  // nuovo annuncio: riarma il rilevatore di impianto

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
      resetAdSkipState();
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

    // ---- LAYER D: Anti-stall watchdog ----

    // Costanti watchdog Anti-stall
    const STALL_CHECK_INTERVAL_MS = 500, STALL_THRESHOLD_TICKS = 3, STALL_MAX_RECOVERIES = 5,
          STALL_MIN_PROGRESS_SEC = 0.05, STALL_BUFFER_AHEAD_SEC = 0.5, STALL_SEEK_NUDGE_SEC = 0.1,
          STALL_HARD_SEEK_SEC = 0.5, STALL_HARD_AFTER_RECOVERIES = 3;

    // Stato watchdog
    let stallTicks = 0, stallLastCt = -1, stallRecoveries = 0, stallTimer = null;

    // Interval principale
    if (stallTimer) clearInterval(stallTimer);
    stallTimer = setInterval(() => {
        const player = document.getElementById('movie_player');
        if (!player) return;
        const video = player.querySelector('video');
        if (!video) return;
        // Annuncio attivo: Layer B gestisce già
        if (player.classList.contains('ad-showing') || player.classList.contains('ad-interrupting')) {
            stallTicks = 0;
            stallLastCt = video.currentTime;
            return;
        }
        // Pausa o video finito: non intervenire
        if (video.paused || video.ended) {
            stallTicks = 0;
            stallLastCt = video.currentTime;
            return;
        }
        // isFinite ESCLUDE le dirette (duration = Infinity): un seek su live rompe lo stream
        if (!isFinite(video.duration) || video.duration <= 0) return;
        if (video.readyState < 2) { stallTicks = 0; return; } // metadati non caricati
        const ct = video.currentTime;
        if (Math.abs(ct - stallLastCt) > STALL_MIN_PROGRESS_SEC) { // video avanza
            stallTicks = 0;
            stallLastCt = ct;
            return;
        }
        stallTicks++;
        stallLastCt = ct;
        if (stallTicks < STALL_THRESHOLD_TICKS) return; // ancora sotto soglia
        if (stallRecoveries >= STALL_MAX_RECOVERIES) return; // budget esaurito
        // ---- Stallo confermato, recovery ----
        stallRecoveries++;
        stallTicks = 0;
        const bufEnd = video.buffered.length ? video.buffered.end(video.buffered.length - 1) : 0;
        const hasBufferAhead = (bufEnd - ct) > STALL_BUFFER_AHEAD_SEC;
        try {
            if (stallRecoveries >= STALL_HARD_AFTER_RECOVERIES && typeof player.seekTo === 'function') {
                player.seekTo(ct + STALL_HARD_SEEK_SEC, true);
            } else if (hasBufferAhead) {
                video.currentTime = Math.min(ct + STALL_SEEK_NUDGE_SEC, bufEnd - 0.05);
            } else if (typeof player.playVideo === 'function') {
                player.playVideo();
            } else {
                video.play().catch(() => {});
            }
        } catch (e) {}
        window.dispatchEvent(new CustomEvent('adoff-stall-recovered', { detail: { ct, hasBufferAhead, attempt: stallRecoveries } }));
    }, STALL_CHECK_INTERVAL_MS);

    // Reset su cambio video
    document.addEventListener('yt-navigate-finish', () => {
        stallRecoveries = 0; stallTicks = 0; stallLastCt = -1;
    });

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

    // Su YouTube niente IMA stub (YouTube non usa IMA SDK) ne' stealth
    // anti-adblock (youtube.com e' in STEALTH_EXCLUDED). Esce dall'IIFE
    // dopo aver installato Layer A; il proChecker piu' in basso non viene
    // mai raggiunto perche' YouTube e' video platform.
    // NOTA: gating Pro/Trial e' implementato dentro Layer A (runtime check)
    // e tramite il proChecker che chiama activateYoutubeRuntimeKiller().
    let ytProCheckCount = 0;
    const ytProChecker = setInterval(() => {
      ytProCheckCount++;
      if (isProEnabled()) {
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

  // =============================================
  // IMA SDK STUB (MAIN world) — Solo Pro/Trial
  //
  // Blocca video ads su QUALSIASI sito che usa Google IMA SDK.
  // Inietta un fake google.ima che emette CONTENT_RESUME_REQUESTED
  // immediatamente → zero ads, player funzionante.
  // Gated: si attiva solo se content.js segnala Pro/Trial via nonce.
  // =============================================

  // Verifica Pro/Trial via nonce di content.js
  function isProEnabled() {
    const val = document.documentElement.getAttribute("data-adoff-stealth") || "";
    return /^ao_[0-9a-f]{8}$/.test(val);
  }

  // Verdetto Pro leggibile in modo SINCRONO a document_start.
  // Il nonce sopra arriva tardi (storage.get + verifica ECDSA sono asincrone),
  // ma la config ads di una piattaforma video va decisa subito. content.js
  // pubblica il verdetto in localStorage al load precedente — stesso canale e
  // stesso limite (una ricarica) gia' adottati per __adoff_vc.
  // Usata SOLO dal Layer A: IMA stub e stealth anti-adblock restano sul nonce.
  function isProSync() {
    if (isProEnabled()) return true;
    try { return localStorage.getItem("__adoff_pro") === "1"; } catch (_) { return false; }
  }

  function injectImaStub() {

    class _EventHandler {
      constructor() { this._m = new Map(); }
      addEventListener(e, fn) {
        for (const t of (Array.isArray(e) ? e : [e])) {
          if (!this._m.has(t)) this._m.set(t, new Set());
          this._m.get(t).add(fn);
        }
      }
      removeEventListener(e, fn) {
        for (const t of (Array.isArray(e) ? e : [e])) {
          const s = this._m.get(t); if (s) s.delete(fn);
        }
      }
      _fire(evt) {
        const s = this._m.get(evt.type);
        if (s) for (const fn of s) { try { fn(evt); } catch (_) {} }
      }
    }

    const T = {
      AD_BREAK_READY: "adBreakReady", AD_BUFFERING: "adBuffering",
      AD_CAN_PLAY: "adCanPlay", AD_ERROR: "adError",
      AD_METADATA: "adMetadata", AD_PROGRESS: "adProgress",
      ALL_ADS_COMPLETED: "allAdsCompleted", CLICK: "click",
      COMPLETE: "complete",
      CONTENT_PAUSE_REQUESTED: "contentPauseRequested",
      CONTENT_RESUME_REQUESTED: "contentResumeRequested",
      DURATION_CHANGE: "durationChange", FIRST_QUARTILE: "firstQuartile",
      IMPRESSION: "impression", INTERACTION: "interaction",
      LINEAR_CHANGED: "linearChanged", LOADED: "loaded", LOG: "log",
      MIDPOINT: "midpoint", PAUSED: "pause", RESUMED: "resume",
      SKIPPABLE_STATE_CHANGED: "skippableStateChanged", SKIPPED: "skip",
      STARTED: "start", THIRD_QUARTILE: "thirdQuartile",
      USER_CLOSE: "userClose", VIDEO_CLICKED: "videoClicked",
      VIDEO_ICON_CLICKED: "videoIconClicked",
      VIEWABLE_IMPRESSION: "viewableImpression",
      VOLUME_CHANGED: "volumeChange", VOLUME_MUTED: "mute",
    };

    // AdPodInfo: alcuni player (es. RTI/Mediaset) chiamano ad.getAdPodInfo()
    // dentro l'handler di OGNI evento, incluso CONTENT_RESUME_REQUESTED. Se
    // manca, il listener lancia prima di riprendere il contenuto e il video
    // non parte. Idem per getAdIdValue/getAdIdRegistry e getUniversalAdIds()
    // che deve restituire oggetti con metodi accessor, non proprieta'.
    class _AdPodInfo {
      getAdPosition() { return 1; } getIsBumper() { return false; }
      getMaxDuration() { return -1; } getPodIndex() { return 0; }
      getTimeOffset() { return 0; } getTotalAds() { return 1; }
    }

    class _Ad {
      getAdId() { return ""; } getAdSystem() { return ""; }
      getAdIdValue() { return ""; } getAdIdRegistry() { return ""; }
      getCreativeId() { return ""; } getDuration() { return 0.1; }
      getHeight() { return 0; } getWidth() { return 0; }
      getSkipTimeOffset() { return -1; } getTitle() { return ""; }
      getMediaUrl() { return null; } getCompanionAds() { return []; }
      getWrapperAdIds() { return []; } getWrapperAdSystems() { return []; }
      getWrapperCreativeIds() { return []; }
      getTraffickingParameters() { return {}; }
      getTraffickingParametersString() { return ""; }
      getUniversalAdIds() { return [{ getAdIdRegistry() { return "unknown"; }, getAdIdValue() { return "unknown"; }, adIdRegistry: "unknown", adIdValue: "unknown" }]; }
      getVastMediaBitrate() { return 0; }
      isLinear() { return true; } isSkippable() { return true; }
      getAdvertiserName() { return ""; } getContentType() { return ""; }
      getDescription() { return ""; } getSurveyUrl() { return null; }
      getMinSuggestedDuration() { return 0; }
      getAdPodInfo() { return new _AdPodInfo(); }
    }

    class _AdEvent {
      constructor(type) { this.type = type; }
      getAd() { return new _Ad(); }
      getAdData() { return {}; }
    }
    _AdEvent.Type = T;

    class _AdError {
      constructor(m, c, t) { this._m = m || ""; this._c = c || 1009; this._t = t || "adLoadError"; }
      getErrorCode() { return this._c; } getMessage() { return this._m; }
      getInnerError() { return null; } getType() { return this._t; }
      getVastErrorCode() { return this._c; }
    }
    _AdError.ErrorCode = { UNKNOWN_ERROR: 900, VAST_EMPTY_RESPONSE: 1009 };
    _AdError.Type = { AD_LOAD: "adLoadError", AD_PLAY: "adPlayError" };

    class _AdErrorEvent {
      constructor(e) { this.type = T.AD_ERROR; this._e = e || new _AdError(); }
      getError() { return this._e; } getUserRequestContext() { return {}; }
    }
    _AdErrorEvent.Type = { AD_ERROR: T.AD_ERROR };

    class _AdsManager extends _EventHandler {
      constructor() { super(); this._vol = 1; }
      init() {}
      start() {
        // Emetti lifecycle completo → player riprende immediatamente
        requestAnimationFrame(() => {
          const seq = [
            T.LOADED, T.STARTED, T.CONTENT_PAUSE_REQUESTED,
            T.AD_BUFFERING, T.IMPRESSION, T.FIRST_QUARTILE,
            T.MIDPOINT, T.THIRD_QUARTILE, T.COMPLETE,
            T.ALL_ADS_COMPLETED, T.CONTENT_RESUME_REQUESTED,
          ];
          for (const t of seq) this._fire(new _AdEvent(t));
        });
      }
      collapse() {} destroy() {} discardAdBreak() {} expand() {}
      focus() {} pause() {} resize() {} resume() {} skip() {} stop() {}
      configureAdsManager() {} updateAdsRenderingSettings() {}
      getAdSkippableState() { return false; }
      getCuePoints() { return []; }
      getCurrentAd() { return new _Ad(); }
      getRemainingTime() { return 0; }
      getVolume() { return this._vol; }
      setVolume(v) { this._vol = v; }
      isCustomClickTrackingUsed() { return false; }
      isCustomPlaybackUsed() { return false; }
    }

    class _AdsManagerLoadedEvent {
      constructor(m) { this.type = "adsManagerLoaded"; this._m = m; }
      getAdsManager() { return this._m; }
      getUserRequestContext() { return {}; }
    }
    _AdsManagerLoadedEvent.Type = { ADS_MANAGER_LOADED: "adsManagerLoaded" };

    class _AdsLoader extends _EventHandler {
      constructor() { super(); }
      contentComplete() {} destroy() {}
      getSettings() { return new _ImaSdkSettings(); }
      getVersion() { return "3.746.0"; }
      requestAds() {
        requestAnimationFrame(() => {
          this._fire(new _AdsManagerLoadedEvent(new _AdsManager()));
        });
      }
    }

    class _AdDisplayContainer {
      constructor(el) {
        if (el) {
          const d = document.createElement("div");
          d.style.cssText = "display:none!important";
          try { el.appendChild(d); } catch (_) {}
        }
      }
      initialize() {} destroy() {}
    }

    class _ImaSdkSettings {
      getCompanionBackfill() { return ""; }
      getDisableCustomPlaybackForIOS10Plus() { return false; }
      getDisableFlashAds() { return true; }
      getFeatureFlags() { return {}; }
      getLocale() { return "en"; }
      getNumRedirects() { return 0; }
      getPlayerType() { return "Unknown"; }
      getPlayerVersion() { return "0.0.0"; }
      getPpid() { return ""; }
      getVersion() { return "3.746.0"; }
      isCookiesEnabled() { return true; }
      isVpaidAllowed() { return true; }
      setAutoPlayAdBreaks() {} setCompanionBackfill() {}
      setCookiesEnabled() {} setDisableCustomPlaybackForIOS10Plus() {}
      setDisableFlashAds() {} setFeatureFlags() {} setLocale() {}
      setNumRedirects() {} setPlayerType() {} setPlayerVersion() {}
      setPpid() {} setSessionId() {} setStreamCorrelator() {}
      setVpaidAllowed() {} setVpaidMode() {}
    }

    class _AdsRenderingSettings {}
    class _AdsRequest {
      constructor() { this.adTagUrl = ""; this.adsResponse = ""; }
      setAdWillAutoPlay() {} setAdWillPlayMuted() {} setContinuousPlayback() {}
    }

    const imaStub = {
      Ad: _Ad,
      AdDisplayContainer: _AdDisplayContainer,
      AdError: _AdError,
      AdErrorEvent: _AdErrorEvent,
      AdEvent: _AdEvent,
      AdsLoader: _AdsLoader,
      AdsManager: _AdsManager,
      AdsManagerLoadedEvent: _AdsManagerLoadedEvent,
      AdsRenderingSettings: _AdsRenderingSettings,
      AdsRequest: _AdsRequest,
      CompanionAdSelectionSettings: function () {},
      CompanionBackfillMode: { ALWAYS: "always", ON_MASTER_AD: "on_master_ad" },
      ImaSdkSettings: _ImaSdkSettings,
      OmidAccessMode: { DOMAIN: "domain", FULL: "full", LIMITED: "limited" },
      OmidVerificationVendor: { GOOGLE: 1, MOAT: 2, DOUBLEVERIFY: 3, INTEGRAL_AD_SCIENCE: 4 },
      UiElements: { AD_ATTRIBUTION: "adAttribution", COUNTDOWN: "countdown" },
      VERSION: "3.746.0",
      ViewMode: { FULLSCREEN: "fullscreen", NORMAL: "normal" },
      settings: new _ImaSdkSettings(),
      dai: { api: {
        Ad: function () {},
        AdPodInfo: function () {},
        StreamEvent: { Type: {} },
        StreamManager: class extends _EventHandler {
          contentTimeForStreamTime(t) { return t; }
          getStreamId() { return ""; }
          onTimedMetadata() {} processMetadata() {}
          requestStream() {} reset() {}
          streamTimeForContentTime(t) { return t; }
        },
        StreamRequest: function () {},
        VODStreamRequest: function () {},
        LiveStreamRequest: function () {},
      }},
    };

    // Inietta PRIMA di qualsiasi altro script — Object.defineProperty
    // impedisce che il vero IMA SDK sovrascriva il nostro stub
    window.google = window.google || {};
    Object.defineProperty(window.google, "ima", {
      get() { return imaStub; },
      set() { /* blocca sovrascrittura */ },
      configurable: false,
    });

  }
  // Fine definizione injectImaStub

  // =============================================
  // PRO/TRIAL GATE — IMA stub + Stealth
  //
  // Attende che content.js (ISOLATED) setti data-adoff-stealth
  // con un nonce verificabile. Se Pro/Trial:
  //   1. Inietta IMA stub (tutti i siti)
  //   2. Attiva stealth anti-adblock (solo siti non-esclusi)
  // Se Free: niente IMA stub, niente stealth.
  // =============================================
  let proCheckCount = 0;
  const proChecker = setInterval(() => {
    proCheckCount++;
    if (isProEnabled()) {
      clearInterval(proChecker);
      // Premium streaming (SSAI/DAI): no stub, no stealth — il player
      // ha bisogno del vero google.ima per ottenere lo stream
      if (isPremiumStreaming) return;
      // Stealth anti-adblock solo su siti non-esclusi e non-broadcaster
      if (!isBroadcaster && !isStealhExcluded) {
        activateStealth();
        // IMA stub iniettato DOPO stealth per non interferire col player
        injectImaStub();
      }
    } else if (proCheckCount >= 20) {
      // Dopo 2s senza segnale Pro — versione Free, niente IMA/stealth
      clearInterval(proChecker);
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
  // Spoof resistente alla sovrascrittura: i siti riassegnano window.googletag
  // dopo document_start; l'accessor fa merge invece di replace cosi' i marker
  // (apiReady/pubadsReady/_loaded_) non spariscono mai.

  // Build googletag stub with all required properties
  function buildGoogletagStub(existing) {
    var stub = {
      cmd: {
        push: function(f) {
          try {
            if (typeof f === "function") {
              f();
            }
          } catch (_) {}
          return 1;
        },
        length: 0
      },
      pubads: function() {
        return {
          addEventListener: function() { return this; },
          setTargeting: function() { return this; },
          refresh: function() {},
          enableSingleRequest: function() { return this; },
          disableInitialLoad: function() {},
          collapseEmptyDivs: function() {},
          getSlots: function() { return []; },
          clear: function() {}
        };
      },
      enableServices: function() {},
      defineSlot: function() {
        return {
          addService: function() { return this; },
          setTargeting: function() { return this; },
          defineSizeMapping: function() { return this; },
          setCollapseEmptyDiv: function() { return this; }
        };
      },
      defineOutOfPageSlot: function() {
        return {
          addService: function() { return this; },
          setTargeting: function() { return this; },
          defineSizeMapping: function() { return this; },
          setCollapseEmptyDiv: function() { return this; }
        };
      },
      display: function() {},
      destroySlots: function() {},
      sizeMapping: function() {
        return {
          addSize: function() { return this; },
          build: function() { return []; }
        };
      },
      apiReady: true,
      pubadsReady: true,
      _loaded_: true,
      _loadStarted_: true,
      _vars_: {},
      _b_: {},
      secureSignalProviders: [],
      encryptedSignalProviders: [],
      evalScripts: function() {},
      getVersion: function() { return "2024"; }
    };

    // Execute any pending commands from existing cmd array
    if (existing && existing.cmd && existing.cmd.length > 0) {
      for (var i = 0; i < existing.cmd.length; i++) {
        try {
          if (typeof existing.cmd[i] === "function") {
            existing.cmd[i]();
          }
        } catch (_) {}
      }
    }

    // Merge existing properties
    if (existing && typeof existing === "object") {
      Object.assign(stub, existing);
    }

    // cmd DEVE restare l'array-like che esegue subito: il merge qui sopra lo
    // riporterebbe all'array del sito, e le callback non partirebbero mai.
    stub.cmd = {
      push: function(f) {
        try {
          if (typeof f === "function") { f(); }
        } catch (_) {}
        return 1;
      },
      length: 0
    };

    // Ensure critical properties are always set
    stub.apiReady = true;
    stub.pubadsReady = true;
    stub._loaded_ = true;

    return stub;
  }

  // Initialize and protect window.googletag
  var _gtag = buildGoogletagStub(window.googletag);
  try {
    Object.defineProperty(window, "googletag", {
      configurable: true,
      get: function() {
        return _gtag;
      },
      set: function(v) {
        if (v && typeof v === "object") {
          try {
            _gtag = buildGoogletagStub(Object.assign({}, _gtag, v));
          } catch (_) {}
        }
        return true;
      }
    });
  } catch (_) {
    window.googletag = _gtag;
  }

  // Build adsbygoogle stub with all required properties
  function buildAdsbygoogleStub(existing) {
    var stub = {
      loaded: true,
      push: function() { return 1; },
      length: 1
    };

    // Merge existing properties
    if (existing && typeof existing === "object") {
      Object.assign(stub, existing);
    }

    return stub;
  }

  // Initialize and protect window.adsbygoogle
  var _adsbygoogle = buildAdsbygoogleStub(window.adsbygoogle);
  try {
    Object.defineProperty(window, "adsbygoogle", {
      configurable: true,
      get: function() {
        return _adsbygoogle;
      },
      set: function(v) {
        if (v && typeof v === "object") {
          try {
            _adsbygoogle = buildAdsbygoogleStub(Object.assign({}, _adsbygoogle, v));
          } catch (_) {}
        }
        return true;
      }
    });
  } catch (_) {
    window.adsbygoogle = _adsbygoogle;
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
      const isAntiAdblockSrc = (
        srcLower.includes("blockadblock") ||
        srcLower.includes("fuckadblock") ||
        srcLower.includes("detectadblock") ||
        srcLower.includes("anti-adblock")
      );
      const isAntiAdblock = (
        (text.includes("adblock") || text.includes("ad-block") || text.includes("adblocker")) &&
        (text.includes("detected") || text.includes("disable") || text.includes("whitelist")) &&
        text.length < 5000
      );
      if (isAntiAdblockSrc || isAntiAdblock) {
        return child;
      }
    }
    try {
      return origAppendChild.call(this, child);
    } catch (_) {
      // Sandboxed iframe (about:blank senza allow-scripts) — passthrough silenzioso
      return child;
    }
  };

  } // fine activateStealth()

})();
