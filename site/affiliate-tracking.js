/**
 * AdOff Affiliate Tracking Script
 * Salva il codice referral in un cookie quando presente nell'URL (?ref=CODE)
 */
(function() {
    const COOKIE_NAME = 'adoff_aff';
    const COOKIE_DAYS = 30;

    function setCookie(name, value, days) {
        let expires = "";
        if (days) {
            const date = new Date();
            date.setTime(date.getTime() + (days * 24 * 60 * 60 * 1000));
            expires = "; expires=" + date.toUTCString();
        }
        document.cookie = name + "=" + (value || "") + expires + "; path=/; SameSite=Lax";
    }

    function getCookie(name) {
        const nameEQ = name + "=";
        const ca = document.cookie.split(';');
        for (let i = 0; i < ca.length; i++) {
            let c = ca[i];
            while (c.charAt(0) == ' ') c = c.substring(1, c.length);
            if (c.indexOf(nameEQ) == 0) return c.substring(nameEQ.length, c.length);
        }
        return null;
    }

    function getQueryParam(name) {
        const urlParams = new URLSearchParams(window.location.search);
        return urlParams.get(name);
    }

    // Esecuzione al caricamento
    const refCode = getQueryParam('ref');
    if (refCode) {
        setCookie(COOKIE_NAME, refCode, COOKIE_DAYS);
        console.log('AdOff Affiliate detected:', refCode);
        
        // Pulizia URL (opzionale, per rimuovere ?ref=... dalla barra degli indirizzi)
        const newUrl = window.location.protocol + "//" + window.location.host + window.location.pathname;
        window.history.replaceState({path: newUrl}, '', newUrl);
    }
})();
