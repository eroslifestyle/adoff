# Inventario site/ per nuove landing SEO

Data: 2026-09-13 · Metodo: solo lettura (bash grep/ls + Read di gen_sitemap.py e adoff-i18n.js)

## 1. File .html root di site/ (conteggio parole testo visibile, sed strip tag)

| File | Parole | File | Parole |
|---|---|---|---|
| 404.html | 637 | lightweight-ad-blocker.html | 1107 |
| about.html | 622 | manifest-v3-ad-blocker.html | 1054 |
| accessibility.html | 903 | panel.html | 1392 |
| account.html | 1802 | press.html | 1909 |
| adblock-detector.html | 2213 | privacy.html | 1948 |
| ad-blocker-brave.html | 1080 | private-ad-blocker.html | 1073 |
| ad-blocker-chrome.html | 1113 | salesletter.html | 4029 |
| ad-blocker-firefox.html | 1489 | success.html | 678 |
| ad-blocker-safari.html | 1462 | support.html | 679 |
| admin-console.html | 990 | terms.html | 1408 |
| affiliati.html | 1298 | ublock-origin-alternative.html | 1456 |
| android-ad-blocker.html | 1524 | undetectable-ad-blocker.html | 1494 |
| android-dns.html | 1372 | uninstall.html | 1548 |
| android.html | 907 | unique-tech.html | 2788 |
| best-ad-blocker-2026.html | 4153 | withdrawal.html | 1271 |
| block-video-ads.html | 1089 | how-it-works.html | 2736 |
| bypass-anti-adblock.html | 1374 | index.html | 1409 |
| chi-sono.html | 597 | install.html | 4427 |
| community.html | 1405 | license-guide.html | 1552 |
| free-ad-blocker.html | 1165 | guide.html | 2082 |

Totale: 40 file.

## 2. Sottocartelle e conteggio .html

Cartelle lingua (28 .html ciascuna, salvo indicazione):
ar/ 28 · de/ 28 · en/ 8 · es/ 28 · fr/ 28 · hi/ 28 · id/ 28 · it/ 23 · ja/ 28 · ko/ 28 · pl/ 28 · pt/ 28 · ru/ 28 · tr/ 28 · zh/ 28

Altre cartelle (non lingua): about-data/ 1 · account/ 1 · assets/ 0 · blog/ 4 · data/ 0 · functions/ 0 · i18n/ (JSON dizionari, no .html) · mgmt-9f4a/ 1 · vendor/ 0 · vs/ 9

## 3. Pagine dedicate a piattaforme video/streaming

Una sola pagina dedicata in root:

- **block-video-ads.html** — title: `How to Block Video Ads on Streaming Platforms (2026) | AdOff` — canonical: `https://adoff.app/block-video-ads`

Nessuna pagina specifica per YouTube, Twitch, Vimeo o Dailymotion (né nei nomi file né nei <title>). Le altre pagine menzionano piattaforme nel corpo ma nessun title lenomina. Gap SEO evidente: query "block ads on youtube" ecc. non hanno pagina dedicata.

## 4. block-video-ads.html — versioni lingua

Sì, esistono sottocartelle corrispondenti. Presenti in 14 lingue:
`ar de es fr hi id it ja ko pl pt ru tr zh` → tutti i `site/<lang>/block-video-ads.html` esistono.
NON esiste `site/en/block-video-ads.html`: la variante inglese è la root stessa (pattern: root = en/x-default).

## 5. hreflang di ad-blocker-firefox.html

Dichiara solo 2 hreflang, entrambi puntano a sé stessa (la root inglese):
- `hreflang="en"` → https://adoff.app/ad-blocker-firefox
- `hreflang="x-default"` → https://adoff.app/ad-blocker-firefox

File dichiarati mancanti su disco: **nessuno** — la pagina non dichiara alcuna variante lingua (non esiste it/ad-blocker-firefox.html, e non viene dichiarata). Le altre pagine browser (chrome/safari/brave) hanno lo stesso pattern (verificato firefox solo, su richiesta).

## 6. gen_sitemap.py — come scopre le URL

`sviluppo/scripts/audit/gen_sitemap.py` (208 righe): **scansione filesystem**, non lista hardcoded. Fa `SITE.rglob("*.html")` (riga 131), esclude pagine tecniche (`EXCLUDE_EXACT`: 404, account, admin-console, panel, success, uninstall, salesletter; prefissi `mgmt-9f4a/`, `account/`), legge la lingua dal tag `<html lang>` (fallback: cartella, poi "it"), e raggruppa per chiave-pagina. Esclude una pagina se il suo canonical dichiara un'URL diversa (righe 144-151) e dedupa cluster: se root e cartella-lingua hanno stessa lingua vince la root (es. /guide it batte /it/guide it). `x-default` = variante EN del cluster; lastmod = data ultimo commit git del file. **Conclusione: una nuova pagina entra in sitemap automaticamente al prossimo run dello script** — basta non finire negli exclude e avere canonical coerente; va rilanciato `python3 sviluppo/scripts/audit/gen_sitemap.py` a ogni aggiunta (non è automatico a runtime).

## 7. adoff-i18n.js — comportamento data-i18n su pagina nuova

Meccanica: `loadDict()` fetcha `/i18n/<lang>.json` (riga 207); `applyTo()` scorre gli elementi `[data-i18n]` e applica la traduzione **solo se la chiave esiste nel dizionario**:

```js
// adoff-i18n.js riga 89
if (dict[key] !== undefined) el.textContent = dict[key];
```

**Una pagina nuova senza chiavi i18n NON si rompe: degrada mostrando il testo inline del sorgente** — la guard `!== undefined` (riga 89) lascia intatto l'elemento quando la chiave manca. Anti-FOUC: all'avvio viene iniettato `html:not([data-i18n-ready]) body { visibility: hidden }` (riga 30), ma il velo si alza in 3 modi: (1) se `lang === sourceLang` (lingua rilevata = `<html lang>` della pagina) markReady immediato (riga 225); (2) dopo il load del dizionario (successo o catch); (3) safety timeout di 2s (riga 42: `setTimeout(markReady, 2000)`). Quindi una pagina inglese con `<html lang="en">` non ha nemmeno flash; una pagina sorgente-IT visitata da utente EN mostrerebbe brevemente l'IT poi traduce nav/footer, e il contenuto senza chiavi resta nel testo sorgente. Nota: `document.documentElement.lang/dir` vengono comunque sovrascritti alla lingua rilevata (righe 219-220), e i meta title/description sono sostituiti solo in homepage (riga 106).

## Sintesi per nuove landing

- Nessuna pagina piattaforma-specifica esiste: gap aperto su youtube/twitch/vimeo/dailymotion.
- Pattern collaudato da copiare: root EN + 14 sottocartelle lingua (come block-video-ads), hreflang minimal (en + x-default → root).
- Nuova pagina → sitemap automatica rilanciando gen_sitemap.py.
- Nuova pagina funziona senza chiavi i18n (testo inline resta); per tradurre nav/footer serve solo il dizionario esistente, nessuna modifica a adoff-i18n.js.
