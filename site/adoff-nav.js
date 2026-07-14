(function () {
  'use strict';

  // ─── Theme (light/dark) — applicato PRIMA di tutto per ridurre il flash ─────
  function getTheme() {
    try { return localStorage.getItem('adoff_theme'); } catch (e) { return null; }
  }
  function applyTheme(t) {
    if (t === 'dark') {
      document.documentElement.setAttribute('data-theme', 'dark');
    } else {
      document.documentElement.removeAttribute('data-theme');
    }
  }
  function initTheme() {
    var saved = getTheme();
    if (saved) {
      applyTheme(saved);
    } else if (window.matchMedia && window.matchMedia('(prefers-color-scheme: dark)').matches) {
      applyTheme('dark');
    }
    // se nessuno dei due: resta light (default)
  }
  function toggleTheme() {
    var isDark = document.documentElement.getAttribute('data-theme') === 'dark';
    var next = isDark ? 'light' : 'dark';
    applyTheme(next);
    try { localStorage.setItem('adoff_theme', next); } catch (e) {}
  }
  initTheme();

  // ─── Google Analytics 4 (gtag) — iniettato centralmente su tutte le pagine ───
  (function loadGa4() {
    var GA4_MEASUREMENT_ID = 'G-RSF32N97JC';
    if (window.gtag || document.querySelector('script[data-adoff-ga4]')) return;
    var s = document.createElement('script');
    s.async = true;
    s.src = 'https://www.googletagmanager.com/gtag/js?id=' + GA4_MEASUREMENT_ID;
    s.setAttribute('data-adoff-ga4', '1');
    document.head.appendChild(s);
    window.dataLayer = window.dataLayer || [];
    window.gtag = function () { window.dataLayer.push(arguments); };
    window.gtag('js', new Date());
    window.gtag('config', GA4_MEASUREMENT_ID);
  })();

  // ─── Supported languages (15) ───────────────────────────────────────────────
  var LANGS = [
    { code: 'de', label: 'Deutsch', flag: '🇩🇪' },
    { code: 'en', label: 'English', flag: '🇬🇧' },
    { code: 'es', label: 'Español', flag: '🇪🇸' },
    { code: 'fr', label: 'Français', flag: '🇫🇷' },
    { code: 'id', label: 'Indonesia', flag: '🇮🇩' },
    { code: 'it', label: 'Italiano', flag: '🇮🇹' },
    { code: 'ja', label: '日本語', flag: '🇯🇵' },
    { code: 'ko', label: '한국어', flag: '🇰🇷' },
    { code: 'pl', label: 'Polski', flag: '🇵🇱' },
    { code: 'pt', label: 'Português', flag: '🇵🇹' },
    { code: 'tr', label: 'Türkçe', flag: '🇹🇷' },
    { code: 'zh', label: '中文', flag: '🇨🇳' },
    { code: 'ar', label: 'العربية', flag: '🇸🇦' },
    { code: 'hi', label: 'हिन्दी', flag: '🇮🇳' },
    { code: 'ru', label: 'Русский', flag: '🇷🇺' },
  ];

  function detectLang() {
    var codes = LANGS.map(function(l) { return l.code; });
    // 1. URL param (highest priority)
    var params = new URLSearchParams(window.location.search);
    var p = params.get('lang');
    if (p && codes.indexOf(p) !== -1) {
      try { localStorage.setItem('adoff_lang', p); } catch(e) {}
      return p;
    }
    // 2. URL path prefix (e.g. /ko/how-it-works.html → "ko")
    var pathLang = window.location.pathname.split('/')[1];
    if (pathLang && pathLang.length === 2 && codes.indexOf(pathLang) !== -1) {
      try { localStorage.setItem('adoff_lang', pathLang); } catch(e) {}
      return pathLang;
    }
    // 3. <html lang> attribute
    var htmlLang = document.documentElement.lang;
    if (htmlLang && codes.indexOf(htmlLang) !== -1 && htmlLang !== 'it') {
      return htmlLang;
    }
    // 4. localStorage (user's previous choice)
    try {
      var stored = localStorage.getItem('adoff_lang');
      if (stored && codes.indexOf(stored) !== -1) return stored;
    } catch(e) {}
    // 5. Browser language (fallback)
    var nav = (navigator.language || navigator.userLanguage || 'en').toLowerCase();
    for (var i = 0; i < LANGS.length; i++) {
      if (nav.startsWith(LANGS[i].code)) return LANGS[i].code;
    }
    return 'en';
  }

  // Pages with static translations in /{lang}/ subdirectories
  // EN-root: English version is at root /, other langs at /{lang}/
  var STATIC_EN_ROOT = ['how-it-works', 'unique-tech', 'best-ad-blocker-2026', 'community', 'press', 'vs/ublock-origin', 'vs/adblock-plus', 'vs/adguard'];
  // IT-root: Italian version is at root /, other langs (incl EN) at /{lang}/
  var STATIC_IT_ROOT = ['guide', 'privacy', 'terms', 'withdrawal'];

  function switchLang(lang) {
    try { localStorage.setItem('adoff_lang', lang); } catch(e) {}

    // Detect current page name — strip leading /, lang prefix, trailing .html, trailing /
    var path = window.location.pathname;
    var page = path.replace(/^\//, '').replace(/^[a-z]{2}\//, '').replace(/\.html$/, '').replace(/\/$/, '');
    if (!page || page === '') page = 'index';

    // EN-root pages: EN at root, others at /{lang}/
    var isEnRoot = STATIC_EN_ROOT.some(function(p) { return page === p; });
    if (isEnRoot) {
      if (lang === 'en') {
        window.location.href = '/' + page;
      } else {
        window.location.href = '/' + lang + '/' + page;
      }
      return;
    }

    // IT-root pages: IT at root, others (incl EN) at /{lang}/
    var isItRoot = STATIC_IT_ROOT.some(function(p) { return page === p; });
    if (isItRoot) {
      if (lang === 'it') {
        window.location.href = '/' + page;
      } else {
        window.location.href = '/' + lang + '/' + page;
      }
      return;
    }

    // For all other pages (homepage, support, install, etc.), use ?lang= param
    var params = new URLSearchParams(window.location.search);
    params.set('lang', lang);
    // Build clean URL without hash — prevents scrolling to #pricing/#features on reload
    window.location.href = window.location.pathname + '?' + params.toString();
  }

  var activeLang = detectLang();
  var activeLangObj = LANGS.find(function (l) { return l.code === activeLang; }) || LANGS[1];

  // ─── Styles ──────────────────────────────────────────────────────────────────
  var style = document.createElement('style');
  style.textContent = [
    '#site-nav{position:fixed;top:0;left:0;right:0;z-index:9999;background:var(--nav-bg);backdrop-filter:blur(12px);-webkit-backdrop-filter:blur(12px);border-bottom:1px solid var(--border)}',
    '#site-nav .sn-inner{max-width:1100px;margin:0 auto;display:flex;align-items:center;justify-content:space-between;padding:0 24px;height:60px}',
    '#site-nav .sn-logo{display:flex;align-items:baseline;gap:0;text-decoration:none;font-size:21px;font-weight:800;letter-spacing:-0.04em;color:var(--text);flex-shrink:0;font-family:Inter,-apple-system,BlinkMacSystemFont,sans-serif}',
    '#site-nav .sn-logo:hover{color:var(--text)}',
    '#site-nav .sn-logo span{color:var(--accent)}',
    '#site-nav .sn-logo .sn-dot{color:var(--accent);margin-left:1px}',
    '#site-nav .sn-links{display:flex;align-items:center;gap:4px;list-style:none;margin:0;padding:0}',
    '#site-nav .sn-links li{margin:0;padding:0}',
    '#site-nav .sn-links a{color:var(--text-muted);font-size:14px;font-weight:500;text-decoration:none;padding:6px 12px;border-radius:8px;transition:color .2s,background .2s;white-space:nowrap;display:block}',
    '#site-nav .sn-links a:hover{color:var(--text);background:var(--accent-soft)}',
    '#site-nav .sn-links a.sn-cta{background:var(--accent);color:var(--text-on-accent);padding:7px 16px;border-radius:8px;font-weight:700}',
    '#site-nav .sn-links a.sn-cta:hover{background:var(--accent-dim);color:var(--text-on-accent)}',

    /* Premium dropdown */
    '#site-nav .sn-premium-wrap{position:relative}',
    '#site-nav .sn-premium-btn{color:var(--text-muted);font-size:14px;font-weight:500;text-decoration:none;padding:6px 12px;border-radius:8px;transition:color .2s,background .2s;background:transparent;border:none;cursor:pointer;font-family:inherit;display:flex;align-items:center;gap:4px;white-space:nowrap}',
    '#site-nav .sn-premium-btn:hover{color:var(--text);background:var(--accent-soft)}',
    '#site-nav .sn-premium-wrap.open .sn-premium-btn{color:var(--text)}',
    '#site-nav .sn-premium-arrow{font-size:10px;transition:transform .2s;opacity:0.7}',
    '#site-nav .sn-premium-wrap.open .sn-premium-arrow{transform:rotate(180deg)}',
    '#site-nav .sn-premium-dd{display:none;position:absolute;top:calc(100% + 6px);left:50%;transform:translateX(-50%);background:var(--surface);border:1px solid var(--border);border-radius:10px;min-width:180px;box-shadow:0 8px 24px rgba(20,20,45,0.12);overflow:hidden;z-index:100}',
    '#site-nav .sn-premium-wrap.open .sn-premium-dd{display:block}',
    '#site-nav .sn-premium-dd a{display:block;padding:12px 16px;color:var(--text-muted);font-size:14px;font-weight:500;text-decoration:none;transition:all .15s}',
    '#site-nav .sn-premium-dd a:hover{background:var(--accent-soft);color:var(--text)}',
    '#site-nav .sn-premium-dd a:first-child{border-radius:10px 10px 0 0}',
    '#site-nav .sn-premium-dd a:last-child{border-radius:0 0 10px 10px}',

    '#site-nav .sn-right{display:flex;align-items:center;gap:12px;flex-shrink:0}',

    /* Theme toggle (in nav, sizing/layout definiti in style.css .theme-toggle) */
    '#site-nav .sn-links .theme-toggle{margin:0}',

    /* GitHub badge */
    '#site-nav .sn-github{display:inline-flex;align-items:center;gap:6px;background:var(--surface-2);border:1px solid var(--border);color:var(--text-muted);font-size:13px;font-weight:500;padding:6px 12px;border-radius:8px;text-decoration:none;transition:all .2s}',
    '#site-nav .sn-github:hover{background:var(--border);color:var(--text)}',
    '#site-nav .sn-github svg{fill:currentColor}',

    /* Language dropdown */
    '#site-nav .sn-lang-wrap{position:relative}',
    '#site-nav .sn-lang-btn{background:var(--accent-soft);border:1px solid var(--accent);color:var(--accent-light);font-size:13px;font-weight:600;padding:6px 14px;border-radius:8px;cursor:pointer;transition:all .2s;font-family:inherit;display:flex;align-items:center;gap:6px;white-space:nowrap}',
    '#site-nav .sn-lang-btn:hover{border-color:var(--accent);color:var(--accent-light)}',
    '#site-nav .sn-lang-btn .sn-arrow{font-size:10px;transition:transform .2s}',
    '#site-nav .sn-lang-wrap.open .sn-lang-btn{border-color:var(--accent);color:var(--accent-light)}',
    '#site-nav .sn-lang-wrap.open .sn-arrow{transform:rotate(180deg)}',
    '#site-nav .sn-lang-dd{display:none;position:absolute;top:calc(100% + 6px);right:0;background:var(--surface);border:1px solid var(--border);border-radius:10px;min-width:160px;box-shadow:0 8px 24px rgba(20,20,45,0.12);overflow:hidden;z-index:100}',
    '#site-nav .sn-lang-wrap.open .sn-lang-dd{display:block}',
    '#site-nav .sn-lang-dd button{display:flex;align-items:center;gap:10px;width:100%;background:transparent;border:none;border-bottom:1px solid var(--border-subtle);color:var(--text-muted);font-size:13px;font-weight:500;padding:10px 14px;cursor:pointer;transition:all .15s;font-family:inherit;text-align:left}',
    '#site-nav .sn-lang-dd button:last-child{border-bottom:none}',
    '#site-nav .sn-lang-dd button:hover{background:var(--accent-soft);color:var(--text)}',
    '#site-nav .sn-lang-dd button.active{color:var(--accent);font-weight:700}',
    '#site-nav .sn-lang-dd .sn-flag{font-size:18px}',

    /* Hamburger */
    '#site-nav .sn-burger{display:none;background:none;border:none;cursor:pointer;padding:6px;flex-direction:column;gap:5px;flex-shrink:0}',
    '#site-nav .sn-burger span{display:block;width:22px;height:2px;background:var(--text-muted);border-radius:2px;transition:all .3s}',

    /* Mobile menu */
    '#site-nav .sn-mobile{display:none;border-top:1px solid var(--border);padding:12px 16px 16px}',
    '#site-nav .sn-mobile a{display:block;color:var(--text-muted);font-size:15px;font-weight:500;text-decoration:none;padding:10px 12px;border-radius:8px;transition:color .2s,background .2s}',
    '#site-nav .sn-mobile a:hover{color:var(--text);background:var(--accent-soft)}',
    '#site-nav .sn-mobile a.sn-cta{background:var(--accent);color:var(--text-on-accent);font-weight:700;margin-top:8px;text-align:center}',
    '#site-nav .sn-mobile a.sn-github{background:var(--surface-2);border:1px solid var(--border);margin-top:8px;text-align:center;justify-content:center}',
    '#site-nav .sn-mobile .sn-mobile-theme{padding:10px 12px}',
    '#site-nav .sn-mobile .sn-mobile-lang{padding:10px 12px;display:flex;flex-wrap:wrap;gap:6px}',
    '#site-nav .sn-mobile .sn-mobile-lang button{background:transparent;border:1px solid var(--border);color:var(--text-muted);font-size:12px;font-weight:600;padding:5px 10px;border-radius:6px;cursor:pointer;transition:all .2s;font-family:inherit;display:flex;align-items:center;gap:4px}',
    '#site-nav .sn-mobile .sn-mobile-lang button.active{background:var(--accent-soft);border-color:var(--accent);color:var(--accent-light)}',

    /* Body offset */
    'body{padding-top:60px !important}',

    /* Responsive */
    '@media(max-width:900px){',
      '#site-nav .sn-links{display:none}',
      '#site-nav .sn-burger{display:flex}',
      '#site-nav.open .sn-mobile{display:block}',
      '#site-nav.open .sn-burger span:nth-child(1){transform:translateY(7px) rotate(45deg)}',
      '#site-nav.open .sn-burger span:nth-child(2){opacity:0}',
      '#site-nav.open .sn-burger span:nth-child(3){transform:translateY(-7px) rotate(-45deg)}',
    '}'
  ].join('');
  document.head.appendChild(style);

  // ─── Build dropdown options ──────────────────────────────────────────────────
  var ddItems = '';
  var mobileItems = '';
  for (var i = 0; i < LANGS.length; i++) {
    var l = LANGS[i];
    var cls = l.code === activeLang ? ' active' : '';
    ddItems += '<button class="' + cls + '" data-lang="' + l.code + '"><span class="sn-flag">' + l.flag + '</span>' + l.label + '</button>';
    mobileItems += '<button class="' + cls + '" data-lang="' + l.code + '">' + l.flag + ' ' + l.code.toUpperCase() + '</button>';
  }

  // ─── Build HTML ──────────────────────────────────────────────────────────────
  var root = document.getElementById('site-nav');
  if (!root) {
    root = document.createElement('div');
    root.id = 'site-nav';
    document.body.insertBefore(root, document.body.firstChild);
  }

  // Build language-aware links
  var lq = (activeLang && activeLang !== 'it') ? '?lang=' + activeLang : '';
  var premiumLink = '/premium' + lq;
  var communityLink = (activeLang === 'en' || !activeLang) ? '/community' : '/' + activeLang + '/community';
  var supportLink = '/support' + lq;

  // GitHub SVG icon
  var githubSvg = '<svg height="16" width="16" viewBox="0 0 24 24" xmlns="http://www.w3.org/2000/svg"><path d="M12 0C5.37 0 0 5.37 0 12c0 5.31 3.435 9.795 8.205 11.385.6.105.825-.255.825-.57 0-.285-.015-1.23-.015-2.235-3.015.555-3.795-.735-4.035-1.41-.135-.345-.72-1.41-1.23-1.695-.42-.225-1.02-.78-.015-.795.945-.015 1.62.87 1.845 1.23 1.08 1.815 2.805 1.305 3.495.99.105-.78.42-1.305.765-1.605-2.67-.3-5.46-1.335-5.46-5.925 0-1.305.465-2.385 1.23-3.225-.12-.3-.54-1.53.12-3.18 0 0 1.005-.315 3.3 1.23.96-.27 1.98-.405 3-.405s2.04.135 3 .405c2.295-1.56 3.3-1.23 3.3-1.23.66 1.65.24 2.88.12 3.18.765.84 1.23 1.905 1.23 3.225 0 4.605-2.805 5.625-5.475 5.925.435.375.81 1.095.81 2.22 0 1.605-.015 2.895-.015 3.3 0 .315.225.69.825.57A12.02 12.02 0 0 0 24 12c0-6.63-5.37-12-12-12z"/></svg>';

  root.innerHTML = [
    '<div class="sn-inner">',
      '<a href="/' + lq + '" class="sn-logo" aria-label="AdOff">',
        'Ads? <span>Off</span><span class="sn-dot">!</span>',
      '</a>',
      '<ul class="sn-links">',
        '<li><a href="/' + lq + '">Home</a></li>',
        '<li><a href="/' + lq + '#features">Features</a></li>',
        '<li><a href="' + premiumLink + '">Premium</a></li>',
        '<li><a href="/' + lq + '#pricing">Pricing</a></li>',
        '<li><a href="' + communityLink + '">Community</a></li>',
        '<li><a href="' + supportLink + '">Support</a></li>',
        '<li>',
          '<a href="https://github.com/eroslifestyle/adoff" class="sn-github" target="_blank" rel="noopener noreferrer" aria-label="GitHub">',
            githubSvg,
            'GitHub',
          '</a>',
        '</li>',
        '<li>',
          '<button class="theme-toggle" id="snThemeToggle" type="button" aria-label="Toggle theme">',
            '<span class="ico-sun">☀️</span><span class="ico-moon">🌙</span>',
          '</button>',
        '</li>',
        '<li><div class="sn-lang-wrap" id="snLangWrap">',
          '<button class="sn-lang-btn" id="snLangBtn">',
            activeLangObj.flag + ' ' + activeLangObj.code.toUpperCase() + ' <span class="sn-arrow">&#9660;</span>',
          '</button>',
          '<div class="sn-lang-dd" id="snLangDd">' + ddItems + '</div>',
        '</div></li>',
        '<li><a href="/' + lq + '#pricing" class="sn-cta">Install Free</a></li>',
      '</ul>',
      '<div class="sn-right">',
        '<button class="sn-burger" aria-label="Menu">',
          '<span></span><span></span><span></span>',
        '</button>',
      '</div>',
    '</div>',
    '<div class="sn-mobile">',
      '<a href="/' + lq + '">Home</a>',
      '<a href="/' + lq + '#features">Features</a>',
      '<a href="' + premiumLink + '">Premium</a>',
      '<a href="/' + lq + '#pricing">Pricing</a>',
      '<a href="' + communityLink + '">Community</a>',
      '<a href="' + supportLink + '">Support</a>',
      '<a href="https://github.com/eroslifestyle/adoff" class="sn-github" target="_blank" rel="noopener noreferrer">',
        githubSvg,
        ' GitHub',
      '</a>',
      '<a href="/' + lq + '#pricing" class="sn-cta">Install Free</a>',
      '<div class="sn-mobile-theme">',
        '<button class="theme-toggle" id="snThemeToggleMobile" type="button" aria-label="Toggle theme">',
          '<span class="ico-sun">☀️</span><span class="ico-moon">🌙</span>',
        '</button>',
      '</div>',
      '<div class="sn-mobile-lang">' + mobileItems + '</div>',
    '</div>'
  ].join('');

  // ─── Event handlers ─────────────────────────────────────────────────────────
  var langWrap = document.getElementById('snLangWrap');
  var langBtn = document.getElementById('snLangBtn');
  var burger = root.querySelector('.sn-burger');
  var themeToggles = root.querySelectorAll('.theme-toggle');

  // Theme toggle (desktop + mobile)
  for (var t = 0; t < themeToggles.length; t++) {
    themeToggles[t].addEventListener('click', function (e) {
      e.stopPropagation();
      toggleTheme();
    });
  }

  // Toggle language dropdown
  langBtn.addEventListener('click', function (e) {
    e.stopPropagation();
    langWrap.classList.toggle('open');
  });

  // Language selection (dropdown + mobile)
  root.addEventListener('click', function (e) {
    var btn = e.target.closest('[data-lang]');
    if (btn) {
      switchLang(btn.getAttribute('data-lang'));
    }
  });

  // Hamburger toggle
  burger.addEventListener('click', function (e) {
    e.stopPropagation();
    root.classList.toggle('open');
  });

  // Close on outside click
  document.addEventListener('click', function (e) {
    if (!root.contains(e.target)) {
      root.classList.remove('open');
      langWrap.classList.remove('open');
    }
  });

})();
