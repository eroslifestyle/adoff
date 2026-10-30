'use strict';

const { chromium } = require("/mnt/backup/Dropbox/1 Programmazione/Progetti/ChromePlugin/sviluppo/reviews/node_modules/playwright");

(async () => {
  let browser; // Dichiarazione del browser per poterlo chiudere nel blocco finally

  try {
    // ── 1. Lancio di Chromium in modalità headless ──────────────────────────
    browser = await chromium.launch({
      headless: true,
      args: ["--no-sandbox", "--mute-audio"]
      // NON usiamo l'opzione channel:"chrome"
    });

    // ── 2. Creazione di una nuova pagina ──────────────────────────────────────
    const page = await browser.newPage();

    // ── 3. Navigazione verso il video YouTube ────────────────────────────────
    await page.goto("https://www.youtube.com/watch?v=Rn8eJxrybQ8", {
      waitUntil: "domcontentloaded",
      timeout: 60000 // 60 secondi di timeout per il caricamento della pagina
    });

    // ── 4. Attesa per l'inizializzazione del player ───────────────────────────
    await page.waitForTimeout(8000); // 8 secondi per dare tempo al player di avviarsi

    // ── 5. Raccolta delle informazioni nella pagina ──────────────────────────
    const risultato = await page.evaluate(() => {
      // Riferimento rapido a ytInitialPlayerResponse
      const playerResponse = window.ytInitialPlayerResponse;
      const streamingData = playerResponse?.streamingData;
      const adaptiveFormats = streamingData?.adaptiveFormats;
      const formats = streamingData?.formats;

      // Conteggio dei formati adattivi
      const adaptiveFormatsTotali = Array.isArray(adaptiveFormats) ? adaptiveFormats.length : 0;
      const adaptiveFormatsConUrl = Array.isArray(adaptiveFormats)
        ? adaptiveFormats.filter(f => typeof f.url === 'string' && f.url.length > 0).length
        : 0;

      // Conteggio dei formati normali
      const formatsTotali = Array.isArray(formats) ? formats.length : 0;
      const formatsConUrl = Array.isArray(formats)
        ? formats.filter(f => typeof f.url === 'string' && f.url.length > 0).length
        : 0;

      // Chiavi di primo livello che corrispondono alla regex /^(ad|xd)|Ads/i
      const chiaviTopLevel = playerResponse
        ? Object.keys(playerResponse).filter(k => /^(ad|xd)|Ads/i.test(k))
        : [];

      // Presenza di annunci
      const haAdPlacements = !!(playerResponse?.adPlacements);
      const haPlayerAds = !!(playerResponse?.playerAds);

      // Informazioni sul client (nome e versione)
      const client = window.ytcfg?.data_?.INNERTUBE_CONTEXT?.client;
      const clientName = client?.name;
      const clientVersion = client?.version;

      // URL di streaming ABR lato server e parametri DRM
      const serverAbrStreamingUrl = !!(streamingData?.serverAbrStreamingUrl);
      const poTokenRichiesto = !!(streamingData?.drmParams) || serverAbrStreamingUrl;

      // Risultato da restituire
      return {
        haPlayerResponse: !!playerResponse,
        serverAbrStreamingUrl,
        adaptiveFormatsTotali,
        adaptiveFormatsConUrl,
        formatsTotali,
        formatsConUrl,
        chiaviTopLevel,
        haAdPlacements,
        haPlayerAds,
        clientName,
        clientVersion,
        poTokenRichiesto
      };
    });

    // ── 6. Stampa del risultato in formato JSON leggibile ────────────────────
    console.log(JSON.stringify(risultato, null, 2));

  } catch (err) {
    // ── 7. Gestione degli errori ────────────────────────────────────────────
    console.error("Errore durante l'esecuzione dello script:", err);
    process.exit(1);
  } finally {
    // ── 8. Chiusura del browser ─────────────────────────────────────────────
    if (browser) {
      await browser.close();
    }
  }
})();
