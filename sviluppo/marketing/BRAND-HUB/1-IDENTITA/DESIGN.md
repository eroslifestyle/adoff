# Design System: AdOff — Web (adoff.app)

**Version:** 3.0.0 · **Updated:** 2026-07-14
**Authority:** questo file + `brand-bible.json`. Il sito (`site/style.css`) implementa questi token.
**Calibrato su:** reference concorrenza approvati dall'utente — [adblockplus.org](https://adblockplus.org/) e [getadblock.com](https://getadblock.com/it/): luminosi, puliti, orientati alla conversione di massa.

---

## 1. Visual Theme & Atmosphere

**Airy, luminous, trustworthy.** Il sito abbandona il dark-cupo precedente (giudicato "generico/tetro") per un look **chiaro come la concorrenza diretta**: fondo bianco/quasi-bianco, ampi spazi, gerarchia forte. Il viola brand (Shield Purple) resta la firma, ma come **accento** ad alto contrasto — non come atmosfera dominante.

**Dual-mode:** LIGHT è il default. Un toggle in navbar (☀/🌙) attiva DARK, che riusa la palette "deep space" storica del brand. La scelta persiste (`localStorage`) e rispetta `prefers-color-scheme` al primo accesso.

Mood-words: *pulito, rassicurante, veloce, onesto*. Zero effetti "tech-bro", zero rainbow, zero glow eccessivo. Il "wow" nasce da **contenuto reale** (before/after autentico, dolore anti-adblock risolto), non da orpelli.

---

## 2. Color Palette & Roles

### Marca (invarianti in entrambi i temi)
- **Shield Purple** (`#7c5cfc`) — azione primaria (CTA), accenti, wordmark "Off".
- **Shield Purple Dark** (`#4c3ad4`) — hover/gradiente CTA.
- **Shield Purple Light** (`#b8a9ff`) — accenti su fondo scuro, link in dark mode.
- **Success Green** (`#22a565` light / `#4ade80` dark) — spunte, garanzie, stato "pulito".
- **Alert Red** (`#e23054` light / `#f43f5e` dark) — stato "ads/tracker", lato "Without".

### LIGHT (default) — token semantici
- **Background** (`#f7f7fb`) — fondo pagina, arioso quasi-bianco.
- **Surface** (`#ffffff`) — card, navbar, box.
- **Surface-2** (`#eef0f7`) — sezioni alternate, fasce.
- **Text** (`#1a1a2e`) — testo primario, titoli (contrasto ~14:1).
- **Text-muted** (`#5a5a72`) — sottotitoli, corpo secondario (~7:1, WCAG AA).
- **Border** (`rgba(124,92,252,0.16)`) — bordi card sottili viola-tinti.

### DARK — token semantici (palette brand storica)
- **Background** (`#0a0a1a`) Deep Space · **Surface** (`#12122a`) Midnight Blue · **Surface-2** (`#1a1a36`).
- **Text** (`#e2e2f0`) · **Text-muted** (`#8a8aaa`) · **Border** (`rgba(124,92,252,0.18)`).

> I nomi dei token (`--bg`, `--surface`, `--text`, `--border`, `--accent`…) sono identici nei due temi: cambia solo il valore sotto `[data-theme]`. Così ogni pagina eredita il tema senza modifiche.

---

## 3. Typography Rules

- **Display/headings:** "Inter" self-hosted, weight **800**, `letter-spacing: -0.025em`, `line-height: 1.1`. (Lexend è il logo-font di marca ma non è disponibile in woff2 sul sito; Inter 800 rende la stessa energia geometrica ed è già ottimizzato con `font-display`.)
- **Hero H1:** `clamp(2.4rem, 5.5vw, 4rem)` — grande, dominante, come i reference.
- **Body:** "Inter" 400/500, 17px, `line-height: 1.65`, colore `--text-muted` per il corpo secondario.
- **Section label:** 0.78rem, uppercase, `letter-spacing: 0.14em`, colore accento — cappello sopra ogni titolo di sezione.
- **Numeri:** `font-variant-numeric: tabular-nums` (prezzi, contatori).

---

## 4. Component Stylings

- **Buttons:** pill-ish (`border-radius: 12px`, i CTA hero `999px`).
  - *Primary:* fondo Shield Purple, testo bianco, ombra viola morbida al hover, lieve `translateY(-1px)`.
  - *Outline:* bordo viola, testo accento, fondo trasparente → riempimento tenue al hover.
  - *Ghost/link:* solo testo accento.
- **Cards:** angoli generosamente arrotondati (`--radius` 12–18px), fondo `--surface`, bordo `--border` sottile, ombra "whisper-soft" in light / assente in dark. Hover: bordo accento + micro-lift.
- **Before/After (`.ba`):** due colonne affiancate — sinistra "Without" tinta rossa tenue, destra "With" tinta verde tenue; su mobile impilano. Usa l'asset reale `screenshot2_before_after.png`. Onesto: contatori "8 ads → 0 ads".
- **Wall-killer (`.wall`):** sezione a impatto — grande titolo "Niente più muri «Disattiva il tuo AdBlock»", con badge del muro barrato. È il dolore #1 dell'utente.
- **Stat/trust-strip:** riga di spunte verdi (`✓ gratis  ✓ 15 giorni Pro  ✓ nessuna carta`) sotto il CTA hero.
- **Inputs/forms:** bordo `--border`, fondo `--surface`, focus ring accento.

---

## 5. Layout Principles

- **Container:** `min(64rem, 92vw)` centrato; `--container-wide` per hero/before-after.
- **Whitespace generoso:** sezioni `clamp(72px, 9vw, 116px)` verticali. Arioso come i reference — mai denso.
- **Hero split:** testo a sinistra (headline + CTA + trust-strip), mockup prodotto reale a destra; impila su mobile.
- **Ritmo sezioni:** alternanza `--bg` / `--surface-2` per separare visivamente senza righe dure.
- **Griglia benefit:** 3×2 desktop → 1 colonna mobile.
- **Motion:** `.reveal` fade-up on-scroll, `--ease cubic-bezier(0.2,0.8,0.2,1)`. Rispetta `prefers-reduced-motion`.

---

## 6. Do NOT (vincoli di marca e prodotto)

- ⛔ Numeri/testimonial finti — solo dati reali verificabili (honesty pivot).
- ⛔ Loghi di terze parti in asset/icone/screenshot — nomi piattaforme ammessi **solo in testo**.
- ⛔ Piano Lifetime (rimosso). Pricing congelato: Pro €2,99/mese · €29,99/anno · Premium VPN €4,99/mese.
- ⛔ Trial = 15 giorni, **solo Pro**; la VPN non ha trial (solo rimborso 30gg).
- ✅ Founder "Eros" + Siracusa ammessi (già pubblici). Cognome/email/handle personale vietati.
