'use strict';
(function() {
  try {
    if (window.__adoffPopupBlockerInstalled) return;
    window.__adoffPopupBlockerInstalled = true;
  } catch(e) {
    return;
  }

  try {
    const hostname = location.hostname;

    function getTopHost() {
      try {
        if (location.ancestorOrigins && location.ancestorOrigins.length) {
          const last = location.ancestorOrigins[location.ancestorOrigins.length - 1];
          return new URL(last).hostname;
        }
      } catch(e) {}
      try {
        if (window.top === window.self) {
          return location.hostname;
        }
      } catch(e) {}
      try {
        if (document.referrer) {
          return new URL(document.referrer).hostname;
        }
      } catch(e) {}
      return '';
    }

    const topHost = getTopHost();

    const SAFE_SITES = [
      'youtube.com', 'raiplay.it', 'rai.it', 'mediasetinfinity.mediaset.it', 'mediaset.it', 'la7.it', 'discoveryplus.com',
      'bbc.co.uk', 'bbc.com', 'itv.com', 'itvx.com', 'channel4.com', 'channel5.com', 'my5.tv', 'pbs.org', 'pluto.tv', 'tubi.tv',
      'zdf.de', 'ard.de', 'ardmediathek.de', 'rtl.de', 'rtlplus.de', 'joyn.de', 'servustv.com', 'orf.at', 'france.tv',
      'tf1.fr', '6play.fr', 'm6.fr', 'arte.tv', 'mycanal.fr', 'rtve.es', 'atresplayer.com', 'mitele.es', 'lasexta.com',
      'rtp.pt', 'tvi.pt', 'sic.pt', 'globoplay.globo.com', 'globo.com', 'srf.ch', 'rsi.ch', 'rts.ch', 'google.com',
      'google.it', 'google.co', 'gmail.com', 'facebook.com', 'instagram.com', 'twitter.com', 'x.com', 'github.com',
      'reddit.com', 'amazon.com', 'amazon.it', 'microsoft.com', 'live.com', 'outlook.com', 'linkedin.com', 'ryanair.com',
      'netflix.com', 'paramountplus.com', 'parampunt.com', 'primevideo.com',
      'accounts.google.com', 'login.microsoftonline.com', 'appleid.apple.com', 'paypal.com', 'stripe.com',
      'checkout.stripe.com', 'auth0.com', 'okta.com', 'onelogin.com', 'duosecurity.com', 'recaptcha.net',
      'hcaptcha.com', 'gstatic.com', 'bankid.com', 'id.apple.com'
    ];

    // il matching per sottostringa faceva passare youtube.com.malware.tk come contesto sicuro disattivando il blocco popunder
    const matchDominio = (host, d) => {
      if (d === 'google.co') return /(^|\.)google\.[a-z]{2,3}(\.[a-z]{2})?$/.test(host);
      return host === d || host.endsWith('.' + d);
    };
    const isSafeContext = SAFE_SITES.some(d => matchDominio(hostname, d) || matchDominio(topHost, d));

    // siamo dentro un iframe?
    // i player video di terze parti non hanno motivi legittimi di aprire schede verso domini terzi;
    // li' il popunder passa anche con un click vero perche' il Layer 3 concede la prima finestra per ogni gesto.
    let isInIframe = false;
    try { isInIframe = window.top !== window.self; } catch (e) { isInIframe = true; }

    const POPUP_AD_PATTERNS = [
      /popads\.net/i, /popcash\.net/i, /propellerads\.com/i, /adsterra\.com/i, /exoclick\.com/i, /juicyads\.com/i,
      /trafficjunky\.(?:com|net)/i, /clickadu\.com/i, /hilltopads\.net/i, /onclickadnow\.com/i, /onclkds\.com/i,
      /clkmon\.com/i, /clickdealer\.com/i, /mellowads\.com/i, /smartypop\.com/i, /tsyndicate\.com/i, /adskeeper\.com/i,
      /mgid\.com/i, /yllix\.com/i, /revenuehits\.com/i, /bidvertiser\.com/i, /adversal\.com/i, /infolinks\.com/i,
      /popunder/i, /\bpopads\b/i, /\bpop-?ads?\b/i, /\bpop-?under\b/i, /awsmsndr\.com/i, /clksite\.com/i, /clkrev\.com/i,
      /\/smartpop/i, /\/popunder\.js/i, /pushwhy\.com/i, /pushnam\.com/i, /pushhouse\.com/i, /pushtape\.com/i,
      /pushmaster\.io/i, /push-notification-/i, /\bredirect=https?%3A/i, /\bgo=https?%3A/i, /\/redirect\.php\?/i,
      /\/go\.php\?/i, /\/out\.php\?/i, /\/4\/[0-9]{6,}/i, /adcash\.com/i, /adnxs\.com/i, /popmyads\.com/i, /adsupply\.com/i,
      /zeropark\.com/i, /voluum\.com/i, /trackvoluum\.com/i, /adspyglass\.com/i, /adnium\.com/i, /ero-advertising/i,
      /plugrush\.com/i, /trafficstars\.com/i, /tsyndicate/i, /adsco\.re/i, /luckyads/i, /waframedia/i,
      /adnetworkperformance/i, /galaksion\.com/i, /adprofex\.com/i, /richpush/i, /datspush/i, /propush\.me/i,
      /pushground\.com/i, /kadam\.net/i, /adstart\.pro/i, /admaven\.com/i, /adf\.ly/i, /shorte\.st/i, /ouo\.io/i,
      /linkvertise\.com/i,
      // Monetag / PropellerAds / RTmark — rilevati in campo su siti di streaming
      /rtmark\.net/i, /monetag/i, /propellerclick/i, /onclickperformance/i,
      /^https?:\/\/ay\d+\.com/i,        // dominio a rotazione Monetag (ay267.com...)
      /[?&]zoneid=\d+/i,                // marcatore zona ad network nei popunder
      // TLD ad alto abuso. NON aggiungere TLD usati anche da siti legittimi
      // (.pro .store .shop .online .site .live .link .work .press .space .fun):
      // il Layer 1 e' attivo anche sui siti sicuri → falsi positivi.
      /^https?:\/\/[a-z0-9-]+\.(?:tk|ml|ga|cf|gq|click|loan|win|men|trade|top|gdn|surf|date|stream|cricket|science|party|review|kim|country|faith|racing|bid|webcam|download|accountant|xyz|club|icu|buzz|cyou|rest|quest|monster|sbs|lol|autos|bond|cfd|makeup|skin|hair|mom|beauty|su)\//i,
      /[?&](?:url|u|to|goto|dest|target|out|link)=https?%3A/i
    ];

    function isPopupAdUrl(u) {
      if (typeof u !== 'string' || !u) return false;
      if (u === 'about:blank' || u === 'javascript:void(0)') return false;
      return POPUP_AD_PATTERNS.some(p => p.test(u));
    }

    let lastTrustedClick = 0;
    let windowsThisGesture = 0;
    let gestureTimer = null;
    const GESTURE_WINDOW_MS = 5000;
    const enableGestureCheck = !isSafeContext;

    function markGesture(e) {
      if (!e.isTrusted) return;
      lastTrustedClick = Date.now();
      windowsThisGesture = 0;
      if (gestureTimer) clearTimeout(gestureTimer);
      gestureTimer = setTimeout(function() {
        windowsThisGesture = 0;
      }, 1000);
    }

    ['click', 'auxclick', 'pointerdown', 'mousedown', 'touchstart', 'keydown'].forEach(function(evt) {
      window.addEventListener(evt, markGesture, { capture: true, passive: true });
    });

    function isSameSiteUrl(u) {
      try {
        const parsed = new URL(u, location.href);
        const targetHost = parsed.hostname;
        const selfHost = location.hostname;
        if (targetHost === selfHost) return true;
        if (targetHost.endsWith('.' + selfHost)) return true;
        if (selfHost.endsWith('.' + targetHost)) return true;
        if (targetHost === topHost) return true;
        if (targetHost.endsWith('.' + topHost)) return true;
        if (topHost.endsWith('.' + targetHost)) return true;
        return false;
      } catch(e) {
        return false;
      }
    }

    function notifyBlocked(url, reason) {
      try {
        window.dispatchEvent(new CustomEvent('adoff-popup-blocked', {
          detail: { url: url, reason: reason }
        }));
      } catch(e) {}
      try {
        if (window.top !== window.self) {
          window.top.postMessage({
            __adoffPopupBlocked: true,
            url: String(url).slice(0, 200)
          }, '*');
        }
      } catch(e) {}
    }

    const origOpen = window.open;
    function safeOpen(url, name, features) {
      try {
        url = String(url || '');
        if (isPopupAdUrl(url)) {
          notifyBlocked(url, 'popup-ad');
          return null;
        }
        if (!url || url === 'about:blank' || isSameSiteUrl(url)) {
          return origOpen.apply(this, arguments);
        }
        // dentro un iframe non fidato una scheda verso un dominio terzo e' un popunder
        // anche col click vero; i widget legittimi che aprono popup sono gia' coperti da SAFE_SITES.
        if (isInIframe && enableGestureCheck) {
          notifyBlocked(url, 'iframe-thirdparty');
          return null;
        }
        if (enableGestureCheck) {
          if (Date.now() - lastTrustedClick > GESTURE_WINDOW_MS) {
            notifyBlocked(url, 'no-gesture');
            return null;
          }
          if (windowsThisGesture >= 1) {
            notifyBlocked(url, 'multi-window');
            return null;
          }
          windowsThisGesture++;
        }
        return origOpen.apply(this, arguments);
      } catch(e) {
        return null;
      }
    }

    try {
      Object.defineProperty(window, 'open', {
        value: safeOpen,
        writable: true,
        configurable: true
      });
    } catch(e) {
      // Alcuni player rendono window.open read-only per difendersi dagli adblocker.
      // Se anche l'assegnazione lancia, il resto del blocker (patch anchor e
      // listener anti-overlay) deve comunque installarsi.
      try { window.open = safeOpen; } catch (_) {}
    }

    try {
      if (!HTMLAnchorElement.prototype.click.__adoffPatched) {
        const origAClick = HTMLAnchorElement.prototype.click;
        HTMLAnchorElement.prototype.click = function() {
          try {
            if (isPopupAdUrl(this.href)) {
              notifyBlocked(this.href, 'anchor-click');
              return;
            }
            const target = this.target;
            const isPopup = target === '_blank' || target === '_new';
            if (enableGestureCheck && isPopup && !isSameSiteUrl(this.href)) {
              if (Date.now() - lastTrustedClick > GESTURE_WINDOW_MS) {
                notifyBlocked(this.href, 'anchor-no-gesture');
                return;
              }
            }
          } catch(e) {}
          return origAClick.apply(this, arguments);
        };
        HTMLAnchorElement.prototype.click.__adoffPatched = true;
      }
    } catch(e) {}
    // I click reali su <a target="_blank"> negli iframe non vengono gestiti da window.open
    // ma direttamente dal browser, quindi vanno intercettati qui per bloccare i popup overlay
    // Si blocca SOLO se l'anchor e' sospetto (invisibile o che copre mezzo schermo)
    // altrimenti si romperebbero i link legittimi dentro gli iframe di widget di terze parti
    if (isInIframe && enableGestureCheck) {
        document.addEventListener('click', function(e) {
            try {
                if (!e.isTrusted) return;
                var a = e.target && typeof e.target.closest === 'function' ? e.target.closest('a') : null;
                if (!a) return;
                var t = a.target;
                if (t !== '_blank' && t !== '_new') return;
                var href = String(a.href || '');
                if (!href || isSameSiteUrl(href)) return;
                var r = a.getBoundingClientRect();
                var area = (r.width||0)*(r.height||0);
                var op = '';
                try { op = getComputedStyle(a).opacity; } catch(e2) {}
                var vw = (window.innerWidth||0)*(window.innerHeight||0);
                var sospetto = (op === '0') || (vw > 0 && area >= vw*0.5);
                if (!sospetto) return;
                e.preventDefault();
                // NIENTE stopPropagation: preventDefault basta a non aprire la
                // scheda, mentre fermare la propagazione toglie il click anche
                // ai listener del player e il video non parte.
                notifyBlocked(href, 'iframe-anchor-overlay');
            } catch (err) {}
        }, true);
    }

    window.addEventListener('adoff-popup-blocked', function() {
      try {
        document.documentElement.setAttribute('data-adoff-popup-blocked', String(Date.now()));
      } catch(e) {}
    }, { capture: true });

  } catch(e) {}
})();
