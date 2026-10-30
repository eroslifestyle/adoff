# Analisi template landing SEO streaming (sola lettura, 2026-09-20)

## 1. Template EN — `site/youtube-ad-blocker.html` (177 righe)

### `<head>` (righe 1–129)

```html
<!DOCTYPE html>
<html lang="en">
<head>
  <script>
    (function(){try{var t=localStorage.getItem("adoff_theme");if(!t&&window.matchMedia&&window.matchMedia("(prefers-color-scheme: dark)").matches)t="dark";if(t==="dark")document.documentElement.setAttribute("data-theme","dark");}catch(e){}})();
  </script>
  <meta charset="UTF-8" />
  <meta name="viewport" content="width=device-width, initial-scale=1.0" />
  <title>YouTube Ad Blocker: Skip Video Ads Without Breaking the Player (2026) | AdOff</title>
  <meta name="description" content="AdOff removes the ad schedule from the player before the page reads it, and fast-forwards anything that slips through at 16x. Honest about what it does and what it cannot do." />
  <meta name="robots" content="index, follow, max-image-preview:large, max-snippet:-1" />
  <link rel="canonical" href="https://adoff.app/youtube-ad-blocker" />
  <link rel="alternate" hreflang="en" href="https://adoff.app/youtube-ad-blocker" />
  <!-- 13 hreflang: ar de es fr hi id it ja ko pl pt ru tr → https://adoff.app/{lang}/youtube-ad-blocker -->
  <link rel="alternate" hreflang="x-default" href="https://adoff.app/youtube-ad-blocker" />
  <meta property="og:type" content="article" />
  <meta property="og:title" content="..." />  <!-- = title -->
  <meta property="og:description" content="..." />  <!-- = description -->
  <meta property="og:image" content="https://adoff.app/assets/og-image.png" />
  <meta property="og:url" content="https://adoff.app/youtube-ad-blocker" />
  <meta name="twitter:card" content="summary_large_image" />
  <meta name="twitter:title|description|image" ... />
  <link rel="icon" href="/assets/icon128.png" type="image/png" />
  <link rel="manifest" href="/manifest.webmanifest" />
  <meta name="theme-color" content="#0a0a1a" />
```
(Nel file reale ogni hreflang/og/twitter è su riga individuale completa — righe 12–43. Compattati qui, nessun contenuto omesso.)

Segue sempre nel `<head>`:
- riga 44: `<link rel="preload" id="adoff-font" ...>` + `<style id="adoff-critical">` — CRITICAL CSS INLINE GIGANTE su una riga minificata (~30KB: design tokens, .btn, .hero, .nav__*, text-align:center globale, table, RTL). **Copiare verbatim da un template esistente, non riscriverlo.**
- `<link rel="preload" href="/style.css?v=be9cdea8" as="style" onload="this.onload=null;this.rel='stylesheet'" />` + `<noscript>` fallback (hash `?v=` da build).
- `<style>` locale (righe 46–65): `.article-page`, `.article-page h1/h2/h3/p/strong/code`, `.answer-box`, `.cta-section` (+ `.cta-section .btn` bianco). Piccolo, per-pagina.
- 3 JSON-LD:
  1. `Article` (headline, description, image, author+publisher Organization AdOff, datePublished/dateModified "2026-09-13", inLanguage "en")
  2. `FAQPage` (4 Question — DEVONO coincidere con gli H3 FAQ nel body)
  3. `BreadcrumbList` (2 ListItem: "AdOff" → https://adoff.app/ + pagina corrente)

### Scheletro `<body>` (righe 130–177)

```html
<body>
  <main>
    <article class="article-page">
      <h1>A YouTube ad blocker that skips video ads — and tells you how</h1>
      <div class="answer-box"><p>...risposta diretta AEO, 3-4 frasi...</p></div>

      <h2>Why blocking YouTube ads by URL does not work</h2><p>...</p>
      <h2>Layer one — remove the ads before they are scheduled</h2><p>...</p>
      <h2>Layer two — fast-forward whatever slips through</h2><p>...</p>
      <h2>Feed, search and banner ads</h2><p>...</p>
      <h2>What AdOff does not promise</h2><p>...</p>
      <h2>Free, with no account</h2><p>...</p>

      <h2>Frequently asked questions</h2>
      <h3>Q1</h3><p>A1</p> ... <h3>Q4</h3><p>A4</p>

      <p>More on this: <a href="/block-video-ads">how video ad blocking works</a>, <a href="/tv-streaming-ad-blocker">ad blocking on catch-up TV services</a>, and <a href="/undetectable-ad-blocker">staying undetected by anti-adblock walls</a>.</p>

      <div class="cta-section">
        <h3>Watch without the interruptions</h3>
        <p>...</p>
        <a href="/install.html" class="btn">Install AdOff — free →</a>
      </div>
    </article>
  </main>
    <script src="/adoff-i18n.js?v=623d521a" defer></script>
  <script src="/adoff-nav.js?v=e75acee8"></script>
  <script src="/adoff-footer.js?v=21299afa"></script>
  <script>if("serviceWorker" in navigator){window.addEventListener("load",()=>{navigator.serviceWorker.register("/sw.js").catch(()=>{})});}</script>
</body>
</html>
```

**NAV e FOOTER NON sono markup HTML**: iniettati a runtime da `adoff-nav.js` (crea `#site-nav` fixed) e `adoff-footer.js` (crea `<footer>`). Le pagine nuove contengono SOLO i 3 `<script>` + service worker, nessun nav/footer inline.

## 2. Template IT — `site/it/youtube-ad-blocker.html` (177 righe, ESISTE)

Struttura identica. Differenze:
- `<html lang="it">`; canonical `https://adoff.app/it/youtube-ad-blocker`; hreflang: `it` → /it/..., `en` → root, x-default → root EN.
- Title/description/og/twitter/H1/H2/H3/FAQ/CTA tutti in italiano, hardcoded (title riga 9: "Ad blocker YouTube: salta le pubblicità video senza rompere il player (2026) | AdOff").
- JSON-LD: `"inLanguage": "it"`, headline/FAQ/Breadcrumb tradotti.
- Critical CSS e 3 script finali identici all'EN.

## 3. i18n: hardcoded o data-i18n?

**HARDCODED.** `grep -c data-i18n` su entrambe = **0**. Evidenza verbatim (`site/it/youtube-ad-blocker.html`):
```
9:  <title>Ad blocker YouTube: salta le pubblicità video senza rompere il player (2026) | AdOff</title>
135:      <h2>Perché bloccare le pubblicità di YouTube per URL non funziona</h2>
```
`adoff-i18n.js` è caricato ma serve solo per lang-detection (?lang=, path, html lang) del nav/footer. (Nota: `support.html` usa `data-i18n`, le landing SEO baked no — sistema misto a livello di sito, ma per le landing il testo è hardcoded.)

## 4. support.html — parametri query string

**NO.** In `support.html` zero occorrenze di `URLSearchParams`/`location.search` (i 4 match in site/*.js sono tutti per `?lang=` o referral). Nessun `?topic=`/`?subject=`/`?s=` per precompilare.
Form `#ticketForm` → POST JSON a `https://api.adoff.app/ticket` + Turnstile. Campi (name=):
- radio `category` (bug|billing|refund|feature|technical|other, required)
- radio `priority` (low|medium|high)
- `name` (required) · `email` (required) · `license` (pattern ADOFF-....) · `subject` (required) · `description` (textarea required, placeholder chiede URL del sito + versione browser) · `browser` (readonly = userAgent) · honeypot `website` (`#_hp_website`)

## 5. Canale segnalazione alternativo

- **`https://adoff.app/r/issues/new`** → 301 → `https://github.com/eroslifestyle/adoff/issues/new` (verificato in `site/_redirects`). Anche `/r/issues` (lista) e `/r/rules` (adblock-rules.json su GitHub).
- In alternativa il form: `https://adoff.app/support.html` con categoria bug/technical.
- Privacy: l'handle GitHub NON va inline nelle pagine — usare l'indirezione `/r/issues/new`.
`_redirects` completo riportato nel file (righe sopra nel repo; include /r/*, vs/*, premium/pricing, blog, /en/* rimosse 2026-08-22; il redirect generico /r/:code → /?ref=:code vive in functions/r/[code].js).

## 6. Copertura pagine esistenti (per NON duplicare)

**youtube-ad-blocker.html** — T: "YouTube Ad Blocker: Skip Video Ads Without Breaking the Player (2026) | AdOff". D: schedule removal + 16x fast-forward. H2: Why blocking by URL does not work · Layer one — remove before scheduled · Layer two — fast-forward slips · Feed, search and banner ads · What AdOff does not promise · Free, with no account · FAQ.

**block-video-ads.html** — T: "How to Block Video Ads on Streaming Platforms (2026) | AdOff". D: SDK-level injection, why URL blocking fails. H2: Why video ads are hardest · Approach one — neutralising the ad SDK · Approach two — stripping the ad schedule · Where this does not apply · Included in the free download · FAQ.

**tv-streaming-ad-blocker.html** — T: "Ad Blocker for Catch-Up TV and Streaming Services (2026) | AdOff". D: IMA SDK stub, 42 broadcaster domains Europe. H2: How SDK neutralisation works · Which services are covered · Why some premium services left alone · What this does not cover · Free, with no account · FAQ.

Angoli GIÀ presi: meccanica YouTube, teoria generale, broadcaster EU. Liberi: piattaforme singole non-YouTube, live/sport, mobile, smart TV, ecc.

## 7. Classi CSS in `site/style.css` (grep reale, non inventate)

- Hero: `.hero`, `.hero__headline`, `.hero__sub`, `.hero__tagline`, `.hero__eyebrow(-dot)`, `.hero__cta-group`, `.hero__trust-strip`, `.hero__note`, `.hero__media`, `.hero__shots(-main/-pop)`, `.hero-v`
- Card/grid: `.bgrid`, `.bcard`, `.feature-card` (+`__icon __title __desc __benefit __pro __pro-chip`, `--stealth`), `.platforms-card` (+`__title __cat __brands __note`), `.tech-card`, `.trust-card__*`, `.pain-card__*`, `.testi-card__*`
- Callout/box: `.stealth__callout`, `.guarantee(_box/_icon/_title/_sub/_list)`, `.cta-box`, `.section-divider`, `.badge(--popular/--save)`. `.answer-box` NON è in style.css: definita inline nel `<style>` per-pagina.
- Tabella: `.compare-table(-wrap)`, `.compare-yes/.compare-no`, `.compare-badge(-wrap)`, `.comp-table`, `.table-wrap`
- FAQ: `.faq`, `.faq-item`, `.faq-question`, `.faq-answer(-inner)`, `.faq-chevron`
- CTA/sezioni: `.btn(--primary/--outline/--ghost/--lg/--xl)`, `.cta-final`, `.final-cta(__headline/__micro/__urgency)`, `.cta-group`, `.install-cta`, `.section-title/.section-label/.section-sub`

NOTA: le 3 landing esistenti usano solo `.article-page` self-contained con stile inline; le classi sopra servono per landing più ricche.

## 8. Pipeline post-creazione

1. `python3 sviluppo/scripts/audit/gen_sitemap.py [--dry-run]` — **rigenera sitemap.xml dall'ALBERO REALE dei file** (ricorsione site/, esclusioni, canonical, lang da `<html lang>`, lastmod da git). NON hardcoded.
2. `sviluppo/scripts/add-hreflang.py` — **NON usare**: hardcoded su ROOT vecchio (`/home/mrxxx/Dropbox/...`) e PAGES lista fissa (4 pagine). Obsoleto.
3. Le hreflang vanno scritte a mano nel `<head>` (15 lingue + x-default, pattern §1), poi `gen_sitemap.py` + commit/push (lastmod = git).

## Verifica
Tutti i dati ricavati da lettura diretta: site/youtube-ad-blocker.html (177 r.), site/it/youtube-ad-blocker.html (177 r.), site/block-video-ads.html, site/tv-streaming-ad-blocker.html, site/support.html, site/_redirects, site/style.css, site/adoff-nav.js, site/adoff-footer.js, sviluppo/scripts/audit/gen_sitemap.py, sviluppo/scripts/add-hreflang.py. Nessun valore inventato; dove non verificato è detto esplicitamente.
