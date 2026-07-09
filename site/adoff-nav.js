(function () {
  'use strict';

  // ─── Google Analytics 4 (gtag) — iniettato centralmente su tutte le pagine ───
  // Un solo punto d'inserimento (adoff-nav.js è caricato da ~541 pagine) evita di
  // toccare ogni singolo HTML. Caricamento async: non blocca il rendering.
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
    '#site-nav{position:fixed;top:0;left:0;right:0;z-index:9999;background:rgba(10,10,26,0.97);backdrop-filter:blur(12px);-webkit-backdrop-filter:blur(12px);border-bottom:1px solid #2a2a4a}',
    '#site-nav .sn-inner{max-width:1100px;margin:0 auto;display:flex;align-items:center;justify-content:space-between;padding:0 24px;height:60px}',
    '#site-nav .sn-logo{display:flex;align-items:baseline;gap:0;text-decoration:none;font-size:21px;font-weight:800;letter-spacing:-0.04em;color:#fff;flex-shrink:0;font-family:Inter,-apple-system,BlinkMacSystemFont,sans-serif}',
    '#site-nav .sn-logo:hover{color:#fff}',
    '#site-nav .sn-logo span{color:#7c5cfc}',
    '#site-nav .sn-logo .sn-dot{color:#7c5cfc;margin-left:1px}',
    '#site-nav .sn-links{display:flex;align-items:center;gap:4px;list-style:none;margin:0;padding:0}',
    '#site-nav .sn-links li{margin:0;padding:0}',
    '#site-nav .sn-links a{color:#8a8aaa;font-size:14px;font-weight:500;text-decoration:none;padding:6px 12px;border-radius:8px;transition:color .2s,background .2s;white-space:nowrap;display:block}',
    '#site-nav .sn-links a:hover{color:#fff;background:rgba(124,92,252,0.12)}',
    '#site-nav .sn-links a.sn-cta{background:#7c5cfc;color:#fff;padding:7px 16px;border-radius:8px;font-weight:700}',
    '#site-nav .sn-links a.sn-cta:hover{background:#b8a9ff;color:#0a0a1a}',
    '#site-nav .sn-right{display:flex;align-items:center;gap:12px;flex-shrink:0}',

    /* Language dropdown */
    '#site-nav .sn-lang-wrap{position:relative}',
    '#site-nav .sn-lang-btn{background:rgba(124,92,252,0.1);border:1px solid #7c5cfc;color:#b8a9ff;font-size:13px;font-weight:600;padding:6px 14px;border-radius:8px;cursor:pointer;transition:all .2s;font-family:inherit;display:flex;align-items:center;gap:6px;white-space:nowrap}',
    '#site-nav .sn-lang-btn:hover{border-color:#7c5cfc;color:#b8a9ff}',
    '#site-nav .sn-lang-btn .sn-arrow{font-size:10px;transition:transform .2s}',
    '#site-nav .sn-lang-wrap.open .sn-lang-btn{border-color:#7c5cfc;color:#b8a9ff}',
    '#site-nav .sn-lang-wrap.open .sn-arrow{transform:rotate(180deg)}',
    '#site-nav .sn-lang-dd{display:none;position:absolute;top:calc(100% + 6px);right:0;background:#12122a;border:1px solid #2a2a4a;border-radius:10px;min-width:160px;box-shadow:0 8px 24px rgba(0,0,0,0.5);overflow:hidden;z-index:100}',
    '#site-nav .sn-lang-wrap.open .sn-lang-dd{display:block}',
    '#site-nav .sn-lang-dd button{display:flex;align-items:center;gap:10px;width:100%;background:transparent;border:none;border-bottom:1px solid #1a1a36;color:#8a8aaa;font-size:13px;font-weight:500;padding:10px 14px;cursor:pointer;transition:all .15s;font-family:inherit;text-align:left}',
    '#site-nav .sn-lang-dd button:last-child{border-bottom:none}',
    '#site-nav .sn-lang-dd button:hover{background:rgba(124,92,252,0.1);color:#fff}',
    '#site-nav .sn-lang-dd button.active{color:#7c5cfc;font-weight:700}',
    '#site-nav .sn-lang-dd .sn-flag{font-size:18px}',

    /* Hamburger */
    '#site-nav .sn-burger{display:none;background:none;border:none;cursor:pointer;padding:6px;flex-direction:column;gap:5px;flex-shrink:0}',
    '#site-nav .sn-burger span{display:block;width:22px;height:2px;background:#8a8aaa;border-radius:2px;transition:all .3s}',

    /* Mobile menu */
    '#site-nav .sn-mobile{display:none;border-top:1px solid #2a2a4a;padding:12px 16px 16px}',
    '#site-nav .sn-mobile a{display:block;color:#8a8aaa;font-size:15px;font-weight:500;text-decoration:none;padding:10px 12px;border-radius:8px;transition:color .2s,background .2s}',
    '#site-nav .sn-mobile a:hover{color:#fff;background:rgba(124,92,252,0.12)}',
    '#site-nav .sn-mobile a.sn-cta{background:#7c5cfc;color:#fff;font-weight:700;margin-top:8px;text-align:center}',
    '#site-nav .sn-mobile .sn-mobile-lang{padding:10px 12px;display:flex;flex-wrap:wrap;gap:6px}',
    '#site-nav .sn-mobile .sn-mobile-lang button{background:transparent;border:1px solid #2a2a4a;color:#8a8aaa;font-size:12px;font-weight:600;padding:5px 10px;border-radius:6px;cursor:pointer;transition:all .2s;font-family:inherit;display:flex;align-items:center;gap:4px}',
    '#site-nav .sn-mobile .sn-mobile-lang button.active{background:rgba(124,92,252,0.18);border-color:#7c5cfc;color:#b8a9ff}',

    /* Body offset */
    'body{padding-top:60px !important}',

    /* Responsive */
    '@media(max-width:768px){',
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
  var lq = (activeLang && activeLang !== 'it') ? '?lang=' + activeLang : ''; // query for dynamic pages
  var lp = (activeLang && activeLang !== 'it') ? '/' + activeLang : ''; // prefix for IT-root static pages
  var base = '/' + lq; // homepage with lang

  // Static page links: EN-root use /{lang}/, IT-root use /{lang}/, guide/community etc.
  var guideLink = (activeLang === 'it' || !activeLang) ? '/guide' : '/' + activeLang + '/guide';
  var communityLink = (activeLang === 'en' || !activeLang) ? '/community' : '/' + activeLang + '/community';
  var supportLink = '/support' + lq;
  // About page: IT → /chi-sono.html, all other languages → /about.html (English)
  var aboutLink = (activeLang === 'it' || !activeLang) ? '/chi-sono.html' : '/about.html' + lq;

  root.innerHTML = [
    '<div class="sn-inner">',
      '<a href="/' + lq + '" class="sn-logo" aria-label="AdOff">',
        'Ad<span>Off</span><span class="sn-dot">.</span>',
      '</a>',
      '<ul class="sn-links">',
        '<li><a href="/' + lq + '#features"><span data-i18n="nav.features">Features</span></a></li>',
        '<li><a href="' + (activeLang === 'en' ? '/unique-tech.html' : '/' + activeLang + '/unique-tech.html') + '"><span data-i18n="nav.unique">Why AdOff</span></a></li>',
        '<li><a href="/' + lq + '#pricing"><span data-i18n="nav.pricing">Pricing</span></a></li>',
        '<li><a href="/' + lq + '#faq"><span data-i18n="nav.faq">FAQ</span></a></li>',
        '<li><a href="' + supportLink + '"><span data-i18n="nav.support">Support</span></a></li>',
        '<li><a href="' + aboutLink + '"><span data-i18n="nav.about">Chi sono</span></a></li>',
        '<li><a href="' + guideLink + '"><span data-i18n="nav.guide">Guide</span></a></li>',
        '<li><a href="' + communityLink + '"><span data-i18n="nav.community">Community</span></a></li>',
        '<li><div class="sn-lang-wrap" id="snLangWrap">',
          '<button class="sn-lang-btn" id="snLangBtn">',
            activeLangObj.flag + ' ' + activeLangObj.code.toUpperCase() + ' <span class="sn-arrow">&#9660;</span>',
          '</button>',
          '<div class="sn-lang-dd" id="snLangDd">' + ddItems + '</div>',
        '</div></li>',
        '<li><a href="/' + lq + '#pricing" class="sn-cta" data-i18n="nav.cta">Install Free</a></li>',
      '</ul>',
      '<div class="sn-right">',
        '<button class="sn-burger" aria-label="Menu">',
          '<span></span><span></span><span></span>',
        '</button>',
      '</div>',
    '</div>',
    '<div class="sn-mobile">',
      '<a href="/' + lq + '#features" data-i18n="nav.features">Features</a>',
      '<a href="' + (activeLang === 'en' ? '/unique-tech.html' : '/' + activeLang + '/unique-tech.html') + '" data-i18n="nav.unique">Why AdOff</a>',
      '<a href="/' + lq + '#pricing" data-i18n="nav.pricing">Pricing</a>',
      '<a href="/' + lq + '#faq" data-i18n="nav.faq">FAQ</a>',
      '<a href="' + supportLink + '" data-i18n="nav.support">Support</a>',
      '<a href="' + aboutLink + '" data-i18n="nav.about">Chi sono</a>',
      '<a href="' + guideLink + '" data-i18n="nav.guide">Guide</a>',
      '<a href="' + communityLink + '" data-i18n="nav.community">Community</a>',
      '<a href="/' + lq + '#pricing" class="sn-cta" data-i18n="nav.cta">Install Free</a>',
      '<div class="sn-mobile-lang">' + mobileItems + '</div>',
    '</div>'
  ].join('');

  // ─── Event handlers ─────────────────────────────────────────────────────────
  var langWrap = document.getElementById('snLangWrap');
  var langBtn = document.getElementById('snLangBtn');
  var burger = root.querySelector('.sn-burger');

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
