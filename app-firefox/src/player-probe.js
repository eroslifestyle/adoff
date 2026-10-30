(function () {
    "use strict";
    // Evita istanze multiple in pagine con script ripetuti
    if (window.__adoffPlayerProbe) return;
    window.__adoffPlayerProbe = true;

    // Non agire nel frame principale (già coperto dal manifest)
    if (window.top === window.self) return;

    // Rileva la presenza di un player multimediale o di un elemento con classi/id noti
    function rilevaPlayer() {
        try {
            if (document.querySelector("video,audio")) return true;
            const selector = "[id*='player'],[class*='player']," +
                             "[id*='jwplayer'],[class*='jwplayer']," +
                             "[id*='videojs'],[class*='videojs']";
            return !!document.querySelector(selector);
        } catch (_) {
            return false;
        }
    }

    // Rimuove osservatori e timeout precedenti, poi richiede e attiva stealth
    let osservatore, timeoutRilevazione;
    function attivaStealth() {
        clearTimeout(timeoutRilevazione);
        if (osservatore) osservatore.disconnect();

        chrome.runtime.sendMessage({ action: "richiediStealthFrame" }, function (r) {
            if (chrome.runtime.lastError) return;
            // Validazione rigorosa del nonce: ao_ + 8 cifre esadecimali minuscole
            const noncePattern = /^ao_[0-9a-f]{8}$/;
            if (r && r.pro === true && noncePattern.test(r.nonce)) {
                document.documentElement.setAttribute("data-adoff-stealth", r.nonce);
                const script = document.createElement("script");
                script.src = chrome.runtime.getURL("src/stealth.js");
                script.onload = function () {
                    script.remove();
                    // Difesa cosmetica: nascondi iframe sovrapposti AL POSTO DEL PLAYER
                    nascondiIframeSovrapposti();
                    // Secondo osservatore per aggiornamenti dinamici
                    let osservatoreStealth;
                    const timeoutStealth = setTimeout(() => osservatoreStealth && osservatoreStealth.disconnect(), 60000);
                    osservatoreStealth = new MutationObserver(function () {
                        nascondiIframeSovrapposti();
                    });
                    osservatoreStealth.observe(document, { childList: true, subtree: true });
                };
                (document.documentElement || document.head || document.body).appendChild(script);
            }
        });
    }

    // Se il player è già presente, attiva subito stealth; altrimenti osserva il DOM
    if (rilevaPlayer()) {
        attivaStealth();
    } else {
        timeoutRilevazione = setTimeout(function () {
            if (osservatore) osservatore.disconnect();
        }, 25000);
        osservatore = new MutationObserver(function () {
            if (rilevaPlayer()) {
                osservatore.disconnect();
                attivaStealth();
            }
        });
        osservatore.observe(document.documentElement, { childList: true, subtree: true });
    }

    // Nasconde iframe che si sovrappongono al video ma hanno origine diversa
    function nascondiIframeSovrapposti() {
        try {
            const video = document.querySelector("video");
            if (!video) return;
            const videoRect = video.getBoundingClientRect();
            const videoArea = videoRect.width * videoRect.height;
            if (videoArea === 0) return;

            const origin = location.origin;
            const iframeList = document.querySelectorAll("iframe");
            iframeList.forEach(iframe => {
                // Salta elementi già processati o src non validi
                if (iframe.hasAttribute("data-adoff-hidden")) return;
                const src = iframe.src;
                if (!src || src.startsWith("about:")) return;

                // Controlla se l'origine è diversa da quella della pagina
                let url;
                try {
                    url = new URL(src, location.href);
                } catch (_) {
                    return;
                }
                if (url.origin === origin) return;

                const iframeRect = iframe.getBoundingClientRect();
                const left = Math.max(videoRect.left, iframeRect.left);
                const right = Math.min(videoRect.right, iframeRect.right);
                const top = Math.max(videoRect.top, iframeRect.top);
                const bottom = Math.min(videoRect.bottom, iframeRect.bottom);
                const width = Math.max(0, right - left);
                const height = Math.max(0, bottom - top);
                const intersezione = width * height;

                // Nascondi se l'intersezione è >= 30% dell'area del video
                if (intersezione >= videoArea * 0.3) {
                    iframe.style.display = "none";
                    iframe.setAttribute("data-adoff-hidden", "1");
                }
            });
        } catch (_) {
            // Non propaga per non rompere lo stealth
        }
    }
})();
