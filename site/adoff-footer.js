(function () {
  'use strict';

  // ─── Styles ──────────────────────────────────────────────────────────────────
  var style = document.createElement('style');
  style.textContent = [
    'footer{background:#08081a;border-top:1px solid var(--border,#1e1e3a);padding:60px 24px 28px}',
    '.footer__inner{max-width:1100px;margin:0 auto}',
    '.footer__grid{display:grid;grid-template-columns:1.8fr 1fr 1fr 1fr;gap:48px;padding-bottom:40px;border-bottom:1px solid var(--border,#1e1e3a);margin-bottom:24px}',
    '.footer__brand{display:flex;flex-direction:column;gap:14px}',
    '.footer__brand-name{font-size:1.5rem;font-weight:800;color:#fff;letter-spacing:-0.04em;font-family:Inter,sans-serif}',
    '.footer__brand-name span{color:#7c5cfc}',
    '.footer__brand-name .footer__dot{color:#7c5cfc}',
    '.footer__brand-desc{font-size:0.85rem;color:rgba(136,136,170,0.8);line-height:1.65;max-width:280px}',
    '.footer__tagline{font-size:1rem;font-weight:700;color:#fff;letter-spacing:-0.02em;font-family:Inter,sans-serif}',
    '.footer__tagline span{color:#7c5cfc}',
    '.footer__social{display:flex;gap:12px;margin-top:4px}',
    '.footer__social-link{color:rgba(136,136,170,0.7);transition:color 0.2s;display:flex;align-items:center}',
    '.footer__social-link:hover{color:#7c5cfc}',
    '.footer__col-title{font-size:0.72rem;font-weight:700;letter-spacing:0.12em;text-transform:uppercase;color:rgba(255,255,255,0.5);margin-bottom:18px}',
    '.footer__links{list-style:none !important;margin:0;padding:0;display:flex;flex-direction:column;gap:12px}',
    '.footer__links li{list-style:none;margin:0;padding:0}',
    '.footer__links li::before{display:none !important}',
    '.footer__links a{font-size:0.88rem;color:rgba(136,136,170,0.8);transition:color 0.2s;display:block;text-decoration:none}',
    '.footer__links a:hover{color:#fff}',
    '.footer__bottom{display:flex;align-items:center;justify-content:space-between;flex-wrap:wrap;gap:12px}',
    '.footer__copy{font-size:0.8rem;color:rgba(136,136,170,0.6)}',
    '.footer__bottom-links{display:flex;gap:24px;list-style:none !important;margin:0;padding:0}',
    '.footer__bottom-links li{list-style:none;margin:0;padding:0}',
    '.footer__bottom-links li::before{display:none !important}',
    '.footer__bottom-links a{font-size:0.8rem;color:rgba(136,136,170,0.6);transition:color 0.2s;text-decoration:none}',
    '.footer__bottom-links a:hover{color:rgba(136,136,170,0.9)}',
    '@media(max-width:768px){',
      '.footer__grid{grid-template-columns:1fr 1fr;gap:28px 24px}',
      '.footer__brand-desc{max-width:100%}',
      '.footer__bottom{flex-direction:column;align-items:flex-start;gap:8px}',
    '}'
  ].join('');
  document.head.appendChild(style);

  // ─── Detect language for footer links ────────────────────────────────────────
  var fLang = 'it';
  try { fLang = localStorage.getItem('adoff_lang') || 'it'; } catch(e) {}
  // Also check URL for lang
  var fParams = new URLSearchParams(window.location.search);
  if (fParams.get('lang')) fLang = fParams.get('lang');
  var fPathLang = window.location.pathname.split('/')[1];
  if (fPathLang && fPathLang.length === 2 && /^[a-z]{2}$/.test(fPathLang)) fLang = fPathLang;

  // Dynamic pages (homepage, install, support) use ?lang=
  var fq = (fLang && fLang !== 'it') ? '?lang=' + fLang : '';
  // EN-root static pages (community, press, how-it-works, best-ad-blocker, vs/*)
  function enRoot(page) { return (fLang === 'en' || !fLang) ? '/' + page : '/' + fLang + '/' + page; }
  // IT-root static pages (guide, privacy, terms, withdrawal)
  function itRoot(page) { return (fLang === 'it' || !fLang) ? '/' + page : '/' + fLang + '/' + page; }
  // Landing pages exist only in EN (root) + IT (/it/); route non-IT to the EN page.
  function lp(page) { return (fLang === 'it') ? '/it/' + page : '/' + page; }

  // ─── Build HTML ──────────────────────────────────────────────────────────────
  var html = [
    '<div class="footer__inner">',
      '<div class="footer__grid">',

        '<div class="footer__brand">',
          '<div class="footer__brand-name" aria-label="AdOff">Ad<span>Off</span><span class="footer__dot">.</span></div>',
          '<p class="footer__tagline" data-i18n="footer.tagline">Ads? Off!</p>',
          '<p class="footer__brand-desc" data-i18n="footer.desc">L\'ad blocker invisibile con stealth anti-detection. Privacy-first, zero dati raccolti.</p>',
          '<div class="footer__social">',
            '<a href="https://github.com/eroslifestyle/adoff" target="_blank" rel="noopener" aria-label="GitHub" class="footer__social-link">',
              '<svg width="20" height="20" viewBox="0 0 24 24" fill="currentColor"><path d="M12 0C5.37 0 0 5.37 0 12c0 5.31 3.435 9.795 8.205 11.385.6.105.825-.255.825-.57 0-.285-.015-1.23-.015-2.235-3.015.555-3.795-.735-4.035-1.41-.135-.345-.72-1.41-1.23-1.695-.42-.225-1.02-.78-.015-.795.945-.015 1.62.87 1.845 1.23 1.08 1.815 2.805 1.305 3.495.99.105-.78.42-1.305.765-1.605-2.67-.3-5.46-1.335-5.46-5.925 0-1.305.465-2.385 1.23-3.225-.12-.3-.54-1.53.12-3.18 0 0 1.005-.315 3.3 1.23.96-.27 1.98-.405 3-.405s2.04.135 3 .405c2.295-1.56 3.3-1.23 3.3-1.23.66 1.65.24 2.88.12 3.18.765.84 1.23 1.905 1.23 3.225 0 4.605-2.805 5.625-5.475 5.925.435.375.81 1.095.81 2.22 0 1.605-.015 2.895-.015 3.3 0 .315.225.69.825.57A12.02 12.02 0 0 0 24 12c0-6.63-5.37-12-12-12z"/></svg>',
            '</a>',
          '</div>',
        '</div>',

        '<div>',
          '<p class="footer__col-title" data-i18n="footer.col.product">Prodotto</p>',
          '<ul class="footer__links">',
            '<li><a href="/pricing.html' + fq + '" data-i18n="footer.pricing">Prezzi</a></li>',
            '<li><a href="/premium' + fq + '" data-i18n="footer.premium">Premium VPN</a></li>',
            '<li><a href="/install' + fq + '" data-i18n="footer.install">Installa</a></li>',
            '<li><a href="' + enRoot('how-it-works') + '" data-i18n="footer.howit">Come funziona</a></li>',
            '<li><a href="' + itRoot('guide') + '" data-i18n="footer.guide">Guida utente</a></li>',
            '<li><a href="' + enRoot('best-ad-blocker-2026') + '" data-i18n="footer.best">Migliori Ad Blocker 2026</a></li>',
            '<li><a href="' + (fLang === 'it' ? '/it/adblock-detector' : '/adblock-detector') + '" data-i18n="footer.tool">Test: ad blocker rilevabile?</a></li>',
          '</ul>',
        '</div>',

        '<div>',
          '<p class="footer__col-title" data-i18n="footer.col.compare">Confronto</p>',
          '<ul class="footer__links">',
            '<li><a href="' + lp('vs/ublock-origin') + '" data-i18n="footer.vs.ublock">AdOff vs uBlock Origin</a></li>',
            '<li><a href="' + lp('vs/adblock-plus') + '" data-i18n="footer.vs.abp">AdOff vs AdBlock Plus</a></li>',
            '<li><a href="' + lp('vs/adguard') + '" data-i18n="footer.vs.adguard">AdOff vs AdGuard</a></li>',
          '</ul>',
        '</div>',

        '<div>',
          '<p class="footer__col-title" data-i18n="footer.col.company">Risorse</p>',
          '<ul class="footer__links">',
            '<li><a href="' + enRoot('community') + '" data-i18n="footer.community">Community</a></li>',
            '<li><a href="/blog/' + fq + '" data-i18n="footer.blog">Blog</a></li>',
            '<li><a href="' + lp('vs/') + '" data-i18n="footer.vs.all">Tutti i confronti</a></li>',
            '<li><a href="' + (fLang === 'it' || !fLang ? '/chi-sono.html' : '/about.html' + fq) + '" data-i18n="footer.about">Chi sono</a></li>',
            '<li><a href="' + (fLang === 'it' ? '/it/about-data/' : '/about-data/') + '" data-i18n="footer.aboutdata">Live data</a></li>',
            '<li><a href="/support' + fq + '" data-i18n="footer.support">Supporto</a></li>',
            '<li><a href="' + enRoot('press') + '" data-i18n="footer.press">Press Kit</a></li>',
          '</ul>',
        '</div>',

      '</div>',

      '<div class="footer__bottom">',
        '<span class="footer__copy" data-i18n="footer.copy">&copy; 2026 AdOff. Tutti i diritti riservati.</span>',
        '<ul class="footer__bottom-links">',
          '<li><a href="' + itRoot('privacy') + '" data-i18n="footer.privacy">Privacy Policy</a></li>',
          '<li><a href="' + itRoot('terms') + '" data-i18n="footer.terms">Termini</a></li>',
          '<li><a href="' + itRoot('withdrawal') + '" data-i18n="footer.withdrawal">Recesso</a></li>',
        '</ul>',
      '</div>',
    '</div>'
  ].join('');

  // ─── Inject footer ───────────────────────────────────────────────────────────
  var existing = document.querySelector('footer');
  if (existing) {
    // Replace existing footer content (keep the <footer> tag)
    existing.innerHTML = html;
    // Remove any inline styles that clash with our injected styles
    existing.removeAttribute('style');
    existing.className = '';
  } else {
    // No footer element — create and append before </body>
    var footer = document.createElement('footer');
    footer.innerHTML = html;
    document.body.appendChild(footer);
  }

  // ─── Load AI support chat widget (site-wide) ──────────────────────────────────
  if (!window.__adoffChatLoaded) {
    var loadChat = function (attempt) {
      var cs = document.createElement('script');
      cs.src = '/adoff-chat.js?v=260602a';
      cs.async = true;
      cs.onerror = function () {
        cs.remove();
        if (attempt < 1) setTimeout(function () { loadChat(attempt + 1); }, 1500);
      };
      (document.body || document.documentElement).appendChild(cs);
    };
    loadChat(0);
  }

})();
