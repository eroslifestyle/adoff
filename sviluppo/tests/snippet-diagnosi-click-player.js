// ============================================================================
// ISTRUZIONI:
// 1) Incollare questo codice nella Console di DevTools
// 2) Se il player e' in un iframe, selezionare prima il contesto dell'iframe
//    dal menu a tendina in alto a sinistra della Console
// 3) Cliccare su "play" piu' volte finche' il video non parte
// 4) Digitare adoffPlayReport() per visualizzare il report diagnostico
// ============================================================================

(function () {
  'use strict';
  try {
    // Stato globale
    window.__adoffClicks = [];
    window.__adoffBlk = [];
    window.__adoffOpens = [];
    var clickN = 0;

    // Rileva il contesto (frame principale o iframe)
    var inIframe = false;
    try {
      inIframe = window.top !== window.self;
    } catch (e) {
      inIframe = true;
    }
    console.log(
      inIframe
        ? 'Contesto: dentro un IFRAME (location: ' + location.hostname + ')'
        : 'Contesto: FRAME PRINCIPALE (location: ' + location.hostname + ')'
    );

    // Listener per evento custom 'adoff-popup-blocked'
    window.addEventListener('adoff-popup-blocked', function (e) {
      window.__adoffBlk.push({
        reason: (e.detail && e.detail.reason) || 'n/d',
        t: Date.now()
      });
    });

    // Listener per eventi 'message' (comunicazione da iframe)
    window.addEventListener('message', function (e) {
      if (e.data && e.data.__adoffPopupBlocked) {
        window.__adoffBlk.push({
          reason: 'da-iframe',
          t: Date.now()
        });
      }
    });

    // Alcuni player rendono window.open non scrivibile, quindi proviamo prima
    // l'assegnazione diretta e poi Object.defineProperty come fallback
    var origOpen = window.open;
    var trackOpen = function (url) {
      window.__adoffOpens.push({
        url: String(url).slice(0, 200),
        t: Date.now()
      });
      return origOpen.apply(window, arguments);
    };
    try {
      window.open = trackOpen;
    } catch (e) {
      try {
        Object.defineProperty(window, 'open', {
          value: trackOpen,
          writable: true,
          configurable: true
        });
      } catch (e2) {
        console.warn('Impossibile tracciare window.open: proprietà protetta. I popup non verranno conteggiati, ma la diagnosi prosegue.');
      }
    }

    // Listener click su document in capture phase, passive
    document.addEventListener(
      'click',
      function (e) {
        if (!e.isTrusted) {
          return;
        }

        clickN++;
        var t0 = Date.now();

        // Elemento colpito dal click
        var hitEl = null;
        try {
          hitEl = document.elementFromPoint(e.clientX, e.clientY);
        } catch (err) {}

        // Costruisci stringa identificativa dell'elemento
        var tag = hitEl ? hitEl.tagName.toLowerCase() : '';
        var id = hitEl && hitEl.id ? '#' + hitEl.id : '';
        var cls = '';
        if (hitEl && hitEl.className && typeof hitEl.className === 'string' && hitEl.className.trim() !== '') {
          cls = '.' + hitEl.className.trim().split(/\s+/)[0];
        }
        var hit = tag + id + cls;

        // Verifica se l'elemento copre il video
        var vid = document.querySelector('video');
        var coversVideo = false;
        try {
          if (vid && hitEl && hitEl !== vid && !vid.contains(hitEl)) {
            var vidRect = vid.getBoundingClientRect();
            var elRect = hitEl.getBoundingClientRect();
            if (
              elRect.left < vidRect.right &&
              elRect.right > vidRect.left &&
              elRect.top < vidRect.bottom &&
              elRect.bottom > vidRect.top
            ) {
              coversVideo = true;
            }
          }
        } catch (err) {}

        // Info sul link piu' vicino
        var isAnchor = false;
        var anchorTarget = '';
        var anchorHost = '';
        var anc = null;
        try {
          if (hitEl && hitEl.closest) {
            anc = hitEl.closest('a');
          }
        } catch (err) {}
        if (anc) {
          isAnchor = true;
          anchorTarget = anc.target || '';
          try {
            var tmpA = document.createElement('a');
            tmpA.href = anc.href;
            anchorHost = tmpA.hostname;
          } catch (err) {}
        }

        // Dimensioni e opacita' dell'elemento colpito
        var area = 0;
        var opacity = '';
        try {
          if (hitEl) {
            var rect = hitEl.getBoundingClientRect();
            area = Math.round(rect.width * rect.height);
          }
        } catch (err) {}
        try {
          if (hitEl) {
            opacity = getComputedStyle(hitEl).opacity || '';
          }
        } catch (err) {}

        // Stato del video PRIMA del click
        var pausedPrima = null;
        var timePrima = null;
        try {
          if (vid) {
            pausedPrima = vid.paused;
            timePrima = vid.currentTime;
          }
        } catch (err) {}

        // Registra il click
        var rec = {
          n: clickN,
          t0: t0,
          hit: hit,
          coversVideo: coversVideo,
          isAnchor: isAnchor,
          anchorTarget: anchorTarget,
          anchorHost: anchorHost,
          opacity: opacity,
          area: area,
          pausedPrima: pausedPrima,
          timePrima: timePrima,
          pausedDopo: null,
          timeDopo: null,
          partito: false,
          bloccatiDaAdOff: 0,
          motivi: '',
          openTentate: 0
        };
        window.__adoffClicks.push(rec);

        // Verifica stato DOPO 900ms
        setTimeout(function () {
          var vidNow = null;
          try {
            vidNow = document.querySelector('video');
          } catch (err) {}

          try {
            if (vidNow) {
              rec.pausedDopo = vidNow.paused;
              rec.timeDopo = vidNow.currentTime;

              // Il video e' partito se era in pausa e ora non lo e',
              // oppure se il tempo e' avanzato di almeno 0.3s
              if (pausedPrima === true && rec.pausedDopo === false) {
                rec.partito = true;
              } else if (rec.timeDopo - timePrima >= 0.3) {
                rec.partito = true;
              }
            }
          } catch (err) {}

          // Conta eventi di blocco AdOff nel range t0 - t0+900
          var bloccati = [];
          for (var i = 0; i < window.__adoffBlk.length; i++) {
            if (window.__adoffBlk[i].t >= t0 && window.__adoffBlk[i].t <= t0 + 900) {
              bloccati.push(window.__adoffBlk[i]);
            }
          }
          rec.bloccatiDaAdOff = bloccati.length;
          var motiviArr = [];
          for (var j = 0; j < bloccati.length; j++) {
            motiviArr.push(bloccati[j].reason);
          }
          rec.motivi = motiviArr.join(', ');

          // Conta tentativi di open nel range t0 - t0+900
          var aperti = 0;
          for (var k = 0; k < window.__adoffOpens.length; k++) {
            if (window.__adoffOpens[k].t >= t0 && window.__adoffOpens[k].t <= t0 + 900) {
              aperti++;
            }
          }
          rec.openTentate = aperti;
        }, 900);
      },
      true, // capture
      { passive: true }
    );

    // Funzione di report
    window.adoffPlayReport = function () {
      console.table(window.__adoffClicks, [
        'n',
        'hit',
        'coversVideo',
        'isAnchor',
        'anchorHost',
        'opacity',
        'area',
        'bloccatiDaAdOff',
        'motivi',
        'openTentate',
        'partito'
      ]);

      // Trova il primo click che ha fatto partire il video
      var primo = null;
      for (var i = 0; i < window.__adoffClicks.length; i++) {
        if (window.__adoffClicks[i].partito === true) {
          primo = window.__adoffClicks[i];
          break;
        }
      }

      if (!primo) {
        console.log('VERDETTO: il video non e\' mai partito durante l\'osservazione');
        return window.__adoffClicks;
      }

      console.log('Click serviti per avviare il video: ' + primo.n);

      // Analizza i click precedenti quello che ha fatto partire
      var precedenti = window.__adoffClicks.slice(0, primo.n - 1);
      var almenoUnoCoperto = false;
      var primoCoperto = null;

      for (var j = 0; j < precedenti.length; j++) {
        if (precedenti[j].coversVideo) {
          almenoUnoCoperto = true;
          if (!primoCoperto) {
            primoCoperto = precedenti[j];
          }
        }
      }

      if (almenoUnoCoperto) {
        console.log(precedenti.length + ' click intercettati da elemento sovrapposto al player. Primo: ' + primoCoperto.hit);
      }

      var almenoUnoBloccato = false;
      for (var k = 0; k < precedenti.length; k++) {
        if (precedenti[k].bloccatiDaAdOff > 0) {
          almenoUnoBloccato = true;
          break;
        }
      }

      if (almenoUnoBloccato) {
        console.log('Motivi blocchi AdOff: ' + primo.motivi);
        console.log('possibile interferenza dell\'estensione');
      }

      if (!almenoUnoCoperto && !almenoUnoBloccato) {
        console.log('AdOff non ha bloccato nulla su quei click: i click li consuma il sito, non l\'estensione');
      }

      return window.__adoffClicks;
    };

    console.log('[AdOff] Snippet diagnostico installato. Clicca play, poi digita adoffPlayReport()');
  } catch (err) {
    console.error('[AdOff] Errore nello snippet diagnostico:', err);
  }
})();
