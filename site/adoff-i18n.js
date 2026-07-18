/**
 * AdOff i18n loader v2 — anti-FOUC + persistent + link-rewriting
 *
 * Goals:
 *  - Detect language ONCE per session, persist in localStorage
 *  - Hide body until language applied (no IT flash for non-IT users)
 *  - Apply translations from /i18n/{lang}.json
 *  - Rewrite all internal links to preserve ?lang= param
 *  - Run as early as possible (must be loaded in <head>)
 *
 * Strategy:
 *  - On <head> load: inject CSS rule `html:not([data-i18n-ready]) body { visibility:hidden }`
 *  - Detect language synchronously (cached lang first)
 *  - For IT (default text in HTML): mark ready immediately
 *  - For non-IT: fetch JSON, apply, then mark ready
 */
(function () {
  'use strict';

  var SUPPORTED = ['it','en','de','fr','es','pt','ru','ar','zh','hi','ja','ko','tr','id','pl'];
  var STATIC_EN_ROOT = ['how-it-works','unique-tech','best-ad-blocker-2026','community','press','vs/ublock-origin','vs/adblock-plus','vs/adguard'];
  var STATIC_IT_ROOT = ['guide','privacy','terms','withdrawal'];
  var I18N_BASE = '/i18n/';

  // === Anti-FOUC CSS — inject as early as possible ===
  try {
    var st = document.createElement('style');
    st.setAttribute('data-i18n-fouc','1');
    st.textContent = 'html:not([data-i18n-ready]) body { visibility: hidden !important; }';
    (document.head || document.documentElement).appendChild(st);
  } catch (e) {}

  function markReady() {
    try {
      document.documentElement.setAttribute('data-i18n-ready', '1');
      var f = document.querySelector('style[data-i18n-fouc]');
      if (f) f.remove();
    } catch (e) {}
  }
  // Safety: never block UI more than 2s
  setTimeout(markReady, 2000);

  function detectLang() {
    try {
      var p = new URLSearchParams(window.location.search).get('lang');
      console.log('[i18n] URL param lang:', p);
      if (p && SUPPORTED.indexOf(p) !== -1) {
        try { localStorage.setItem('adoff_lang', p); } catch (e) {}
        console.log('[i18n] Using URL param lang:', p);
        return p;
      }
    } catch (e) {}
    var pathLang = window.location.pathname.split('/')[1];
    if (pathLang && pathLang.length === 2 && SUPPORTED.indexOf(pathLang) !== -1) {
      try { localStorage.setItem('adoff_lang', pathLang); } catch (e) {}
      return pathLang;
    }
    // localStorage BEFORE <html lang> so user choice persists across pages
    try {
      var stored = localStorage.getItem('adoff_lang');
      if (stored && SUPPORTED.indexOf(stored) !== -1) return stored;
    } catch (e) {}
    var htmlLang = document.documentElement.lang;
    if (htmlLang && SUPPORTED.indexOf(htmlLang) !== -1 && htmlLang !== 'it') {
      try { localStorage.setItem('adoff_lang', htmlLang); } catch (e) {}
      return htmlLang;
    }
    var nav = (navigator.language || navigator.userLanguage || 'en').toLowerCase().slice(0, 2);
    if (SUPPORTED.indexOf(nav) !== -1) {
      try { localStorage.setItem('adoff_lang', nav); } catch (e) {}
      return nav;
    }
    return 'en';
  }

  function applyTranslations(dict, lang) {
    if (!dict) return;
    var textEls = document.querySelectorAll('[data-i18n]');
    for (var i = 0; i < textEls.length; i++) {
      var el = textEls[i];
      var key = el.getAttribute('data-i18n');
      if (dict[key] !== undefined) el.textContent = dict[key];
    }
    var htmlEls = document.querySelectorAll('[data-i18n-html]');
    for (var j = 0; j < htmlEls.length; j++) {
      var hel = htmlEls[j];
      var hkey = hel.getAttribute('data-i18n-html');
      if (dict[hkey] !== undefined) hel.innerHTML = dict[hkey];
    }
    var placeholderEls = document.querySelectorAll('[data-i18n-placeholder]');
    for (var k = 0; k < placeholderEls.length; k++) {
      var pel = placeholderEls[k];
      var pkey = pel.getAttribute('data-i18n-placeholder');
      if (dict[pkey] !== undefined) pel.placeholder = dict[pkey];
    }
    document.documentElement.dir = (lang === 'ar') ? 'rtl' : 'ltr';
    document.documentElement.lang = lang;
    if (dict['meta.title']) document.title = dict['meta.title'];
    var metaDesc = document.querySelector('meta[name="description"]');
    if (metaDesc && dict['meta.description']) metaDesc.setAttribute('content', dict['meta.description']);
    var ogTitle = document.querySelector('meta[property="og:title"]');
    if (ogTitle && dict['meta.og.title']) ogTitle.setAttribute('content', dict['meta.og.title']);
    var ogDesc = document.querySelector('meta[property="og:description"]');
    if (ogDesc && dict['meta.og.description']) ogDesc.setAttribute('content', dict['meta.og.description']);
  }

  /**
   * Rewrite all internal links (<a href="..."> + <button onclick="checkout(...)">)
   * to preserve current language as ?lang= or /{lang}/ depending on page type.
   * Runs after DOM ready.
   */
  function rewriteLinks(lang) {
    if (!lang || lang === 'it') return; // IT is default, no rewrite needed
    var origin = window.location.origin;
    var anchors = document.querySelectorAll('a[href]');
    for (var i = 0; i < anchors.length; i++) {
      var a = anchors[i];
      var href = a.getAttribute('href');
      if (!href) continue;
      // skip absolute external links + anchors + mailto + tel
      if (/^(https?:)?\/\//.test(href) && href.indexOf(origin) !== 0) continue;
      if (href.indexOf('#') === 0) continue;
      if (/^(mailto:|tel:|javascript:)/.test(href)) continue;
      // strip leading origin for normalization
      var clean = href.replace(origin, '');
      // already has ?lang= or /{lang}/ prefix
      if (/[?&]lang=/.test(clean)) continue;
      var firstSeg = clean.replace(/^\//, '').split('/')[0];
      if (firstSeg && firstSeg.length === 2 && SUPPORTED.indexOf(firstSeg) !== -1) continue;

      // pages that have /{lang}/ static path (EN-root or IT-root)
      var page = clean.replace(/^\//, '').replace(/\.html$/, '').replace(/[?#].*$/, '');
      // Story page pair: chi-sono.html (IT) <-> about.html (EN) for all non-IT langs.
      if (page === 'chi-sono') {
        a.setAttribute('href', '/about.html');
        continue;
      }
      var isStaticEN = STATIC_EN_ROOT.indexOf(page) !== -1;
      var isStaticIT = STATIC_IT_ROOT.indexOf(page) !== -1;

      if (isStaticEN || isStaticIT) {
        // EN-root: EN at root, others at /{lang}/; IT-root: IT at root, others at /{lang}/
        var newHref;
        if (isStaticEN && lang === 'en') newHref = '/' + page;
        else if (isStaticIT && lang === 'it') newHref = '/' + page;
        else newHref = '/' + lang + '/' + page;
        // preserve hash
        var hash = clean.indexOf('#');
        if (hash >= 0) newHref += clean.substring(hash);
        a.setAttribute('href', newHref);
        continue;
      }
      // dynamic pages: add ?lang=
      var sep = clean.indexOf('?') >= 0 ? '&' : '?';
      a.setAttribute('href', clean + sep + 'lang=' + lang);
    }
  }

  function loadDict(lang) {
    return fetch(I18N_BASE + lang + '.json', { cache: 'force-cache' })
      .then(function (r) {
        if (!r.ok) throw new Error('i18n fetch ' + r.status);
        return r.json();
      });
  }

  function init() {
    var lang = detectLang();
    console.log('[i18n] Detected lang:', lang);
    if (lang === 'it') {
      document.documentElement.lang = 'it';
      document.documentElement.dir = 'ltr';
      markReady();
      // No link rewrite for IT (it's root path)
      return;
    }
    console.log('[i18n] Loading dict for:', lang);
    loadDict(lang).then(function (dict) {
      console.log('[i18n] Dict loaded, applying translations');
      applyTranslations(dict, lang);
      if (document.readyState === 'loading') {
        document.addEventListener('DOMContentLoaded', function () { rewriteLinks(lang); });
      } else {
        rewriteLinks(lang);
      }
      markReady();
    }).catch(function () {
      // Fallback to EN
      if (lang !== 'en') {
        loadDict('en').then(function (dict) {
          applyTranslations(dict, 'en');
          if (document.readyState === 'loading') {
            document.addEventListener('DOMContentLoaded', function () { rewriteLinks('en'); });
          } else {
            rewriteLinks('en');
          }
          markReady();
        }).catch(markReady);
      } else {
        markReady();
      }
    });
  }

  if (document.readyState === 'loading') {
    document.addEventListener('DOMContentLoaded', init);
  } else {
    init();
  }
})();
