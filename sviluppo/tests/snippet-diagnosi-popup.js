(function() {
  'use strict';

  try {
    window.__adoffDiag = {
      opens: [],
      anchors: [],
      blocked: [],
      fromIframes: [],
      navs: []
    };

    // 1. Wrap window.open
    try {
      var _origOpen = window.open;
      window.open = function(url, name, specs) {
        try {
          var err = new Error();
          window.__adoffDiag.opens.push({
            url: String(url).slice(0, 300),
            t: Date.now(),
            stack: (err.stack || '').split('\n').slice(1, 5).join(' <- ')
          });
        } catch(e) {}
        return _origOpen.apply(window, arguments);
      };
    } catch(e) {}

    // 2. Click listener for anchors
    try {
      document.addEventListener('click', function(e) {
        try {
          if (typeof e.target.closest === 'function') {
            var a = e.target.closest('a');
            if (a) {
              var href = a.href || '';
              var thirdParty = false;
              try {
                if (href) {
                  var h = document.createElement('a');
                  h.href = href;
                  thirdParty = h.hostname !== location.hostname;
                }
              } catch(e) {}
              var rect = a.getBoundingClientRect();
              window.__adoffDiag.anchors.push({
                href: href.slice(0, 300),
                target: a.target,
                thirdParty: thirdParty,
                area: Math.round((rect.width || 0) * (rect.height || 0)),
                opacity: getComputedStyle(a).opacity,
                t: Date.now()
              });
            }
          }
        } catch(e) {}
      }, true);
    } catch(e) {}

    // 3. AdOff blocked events listener
    try {
      window.addEventListener('adoff-popup-blocked', function(e) {
        try {
          window.__adoffDiag.blocked.push(e.detail || {});
        } catch(e) {}
      });
    } catch(e) {}

    // 4. Message listener from iframes
    try {
      window.addEventListener('message', function(e) {
        try {
          if (e.data && e.data.__adoffPopupBlocked) {
            window.__adoffDiag.fromIframes.push({
              url: e.data.url,
              origin: e.origin,
              t: Date.now()
            });
          }
        } catch(e) {}
      });
    } catch(e) {}

    // 5. beforeunload navigation tracking
    try {
      window.addEventListener('beforeunload', function() {
        try {
          window.__adoffDiag.navs.push({
            to: 'unload',
            from: location.href,
            t: Date.now()
          });
        } catch(e) {}
      });
    } catch(e) {}

    // 6. Report function
    window.adoffReport = function() {
      var d = window.__adoffDiag;
      var suspicious = [];
      var thirdPartyBlank = [];

      try {
        if (d.anchors.length) {
          d.anchors.forEach(function(a, i) {
            if (a.opacity === '0' || a.area > 200000) {
              suspicious.push(Object.assign({ idx: i }, a));
            }
            if (a.target === '_blank' && a.thirdParty) {
              thirdPartyBlank.push(Object.assign({ idx: i }, a));
            }
          });
        }

        console.log('%c[AdOff Diagnosi] Riepilogo', 'font-weight:bold;font-size:14px;color:#e74c3c');
        console.log('--- window.open (' + d.opens.length + ') ---');
        if (d.opens.length) {
          console.table(d.opens.map(function(o) { return { url: o.url, quando: new Date(o.t).toLocaleTimeString() }; }));
        } else {
          console.log('Nessuna window.open osservata');
        }

        console.log('--- Anchor cliccati (' + d.anchors.length + ') ---');
        if (d.anchors.length) {
          console.table(d.anchors.map(function(a) { return { href: a.href, target: a.target, terze: a.thirdParty, area: a.area, opacity: a.opacity }; }));
        }

        console.log('--- Terze parti target=_blank (' + thirdPartyBlank.length + ') ---');
        if (thirdPartyBlank.length) {
          console.table(thirdPartyBlank);
        } else {
          console.log('Nessun anchor terze parti _blank');
        }

        console.log('--- Sospetti overlay (' + suspicious.length + ') ---');
        if (suspicious.length) {
          console.table(suspicious);
        } else {
          console.log('Nessun overlay sospetto (opacity=0 o area>200k)');
        }

        console.log('--- Blocchi AdOff top frame (' + d.blocked.length + ') ---');
        if (d.blocked.length) {
          console.table(d.blocked);
        } else {
          console.log('Nessun blocco AdOff segnalato');
        }

        console.log('--- Blocchi da iframe (' + d.fromIframes.length + ') ---');
        if (d.fromIframes.length) {
          console.table(d.fromIframes);
        } else {
          console.log('Nessun blocco da iframe');
        }

        console.log('--- Navigazioni (' + d.navs.length + ') ---');
        if (d.navs.length) {
          console.table(d.navs);
        } else {
          console.log('Nessuna navigazione intercettata');
        }

        console.log('%c[AdOff] Oggetto grezzo __adoffDiag:', 'font-weight:bold', d);
        return d;
      } catch(e) {
        console.error('[AdOff] Errore report:', e);
        return d;
      }
    };

    // 7. Confirm install
    console.log('%c[AdOff Diagnosi] Installato!', 'font-weight:bold;color:#27ae60');
    console.log('Usa il sito normalmente, poi digita adoffReport() per il riepilogo.');

  } catch(e) {
    console.error('[AdOff Diagnosi] Errore installazione:', e);
  }

})();
