# AdOff — Brand Identity

> **Fonte di verità del brand.** Allineato a sito (`site/style.css`), estensione (v3.4.5), pricing Founder (2026-06-01).
> Companion machine-readable: `brand-bible.json`. Logo definitivo: `sviluppo/marketing/assets/avatar-512.png`.
> _Updated: 2026-06-01 — supera la vecchia identità "Shadow Shield"._

---

## 1. Brand Strategy

### Nome
**AdOff** — scritto sempre `AdOff` (camelCase, `Ad` + `Off`, mai "Ad Off", "ADOFF" o "Adoff").
Dominio: **adoff.app**

### Tagline
- **EN:** "Ads? Off!"
- **IT:** "Pubblicità? Spenta."
- Alternativa breve: "Clean browsing, zero noise."

### Mission
Restituire all'utente il controllo della propria esperienza web: eliminare le pubblicità invasive da ogni sito, in modo invisibile ai sistemi anti-adblock, senza raccogliere un solo dato. Privacy-first, zero tracking.

### Valori del brand
1. **Invisibilità** — Opera nell'ombra. L'utente non deve accorgersi dell'estensione, né i siti devono rilevarla.
2. **Velocità** — Navigazione più rapida senza il peso degli ads.
3. **Rispetto** — Zero raccolta dati, zero tracking. Le regole di rete sono pubblicamente verificabili.
4. **Semplicità** — Un toggle. On/Off. Nessuna configurazione complessa.

### Tono di voce
- **Sicuro** — Comunica competenza senza essere tecnico.
- **Minimale** — Poche parole, messaggi diretti, una idea per frase.
- **Premium** — Estetica curata, mai aggressivo o "hacker-style".
- **Onesto** — Niente claim gonfiati, niente testimonianze finte, niente paura indotta.
- **NO**: gergo tecnico gratuito, promesse esagerate, toni aggressivi, fear-mongering.
- **SÌ**: frasi corte, dati concreti ("X ads bloccati"), trasparenza founder.

### Target
- Utenti non-tecnici stufi delle pubblicità invasive (specie video ads pre-roll).
- Professionisti che vogliono navigazione pulita.
- Privacy-conscious che rifiutano il tracking.
- Età 25-55, comfort medio-alto con la tecnologia.

### Founder positioning (autorizzato pubblico)
Identità founder **pubblica per scelta**: nome "Eros", Siracusa, building-in-public su `/chi-sono` e `/about`. Costruisce fiducia (no testimonianze finte → trasparenza reale). _Full handle/cognome/email restano vietati ovunque (vedi §9)._

---

## 2. Color Palette

> Identica ai token `:root` di `site/style.css`. Non inventare colori fuori da questa lista.

### Colori primari
| Nome | Hex | RGB | Token CSS | Uso |
|---|---|---|---|---|
| **Deep Space** | `#0a0a1a` | 10, 10, 26 | `--deep-space` | Background principale |
| **Shield Purple** | `#7c5cfc` | 124, 92, 252 | `--shield-purple` | Accento primario, CTA, badge ON, "Off" nel logo |
| **Pure White** | `#ffffff` | 255, 255, 255 | `--pure-white` | "Ad" nel logo, testo su dark |

### Colori secondari
| Nome | Hex | RGB | Token CSS | Uso |
|---|---|---|---|---|
| **Midnight Blue** | `#12122a` | 18, 18, 42 | `--midnight-blue` | Card, sezioni |
| **Shield Purple Dark** | `#4c3ad4` | 76, 58, 212 | `--shield-purple-dark` | Fine gradiente |
| **Soft Purple** | `#b8a9ff` | 184, 169, 255 | `--soft-purple` | Hover, link, accenti leggeri |
| **Steel Gray** | `#8a8aaa` | 138, 138, 170 | `--steel-gray` | Testo secondario |
| **Success Green** | `#4ade80` | 74, 222, 128 | `--success-green` | Stato attivo, conferme |
| **Alert Red** | `#f43f5e` | 244, 63, 94 | `--alert-red` | Stato disattivo, errori |

### Gradienti
- **Shield Gradient**: `linear-gradient(135deg, #7c5cfc 0%, #4c3ad4 100%)` — bottoni, badge, CTA.
- **Background Glow**: `radial-gradient(circle at 50% 0%, #1a1a3e 0%, #0a0a1a 70%)` — sfondo hero/popup.

### Accessibilità
- Testo body su dark = `#e2e2f0` (non bianco puro: migliore comfort).
- Testo dim minimo = `#80809a` (~4.8:1 su `--bg`, WCAG AA). Mai più chiaro per testo informativo.

---

## 3. Typography

### Logo / Wordmark
**Lexend ExtraBold (800)** — `sviluppo/marketing/brand/fonts/Lexend-ExtraBold.ttf`.
Letter-spacing negativo (tight). È il font del wordmark "AdOff" nel logo/avatar. Sorgente deterministica: `generate-wordmark.py`.

### Font primario UI / web
**Inter** (variable, open source) — `site/assets/fonts/InterVariable.woff2`.
- Weights: 400 (Regular), 500 (Medium), 600 (SemiBold), 700 (Bold).
- Uso: tutto il testo di interfaccia (sito, popup, options, onboarding).

### Font monospace (dati/numeri)
**JetBrains Mono** — contatori, statistiche, numeri ("ads bloccati", "X/100 Founder").

### Scala tipografica (UI estensione)
| Elemento | Size | Weight | Tracking |
|---|---|---|---|
| Titolo brand | 18px | 700 | -0.02em |
| Sottotitolo | 11px | 400 | 0.04em (uppercase) |
| Label | 14px | 500 | 0 |
| Body | 13px | 400 | 0 |
| Stat number | 24px | 700 | -0.02em |
| Stat label | 10px | 400 | 0.02em |
| Footer | 10px | 400 | 0 |

---

## 4. Logo

### Asset definitivo
`sviluppo/marketing/assets/avatar-512.png` (+ `avatar-1024.png` per alta risoluzione).
**MAI usare** `icon128.png`, `logo-512.png` o `logo-512-transparent.png` come logo brand: sono vecchi/funzionali.

### Concept
Wordmark **"AdOff"** su **sfera Deep Space** con glow viola radiale:
- `Ad` in **Pure White** `#ffffff`
- `Off` in **Shield Purple** `#7c5cfc`
- Font **Lexend ExtraBold**, letter-spacing tight.
- Fondo: sfera `#0a0a1a` + glow `rgba(124,92,252,0.22) → transparent` (identico a `hero::before`).

Principio: **identità social = identità del sito = identità store**. Nessun marchio inventato, nessuna variazione cromatica.

### Versioni
1. **Avatar/Logo pieno** — wordmark su sfera (social, store tile, marketing).
2. **Icona estensione** — `app/assets/icon*.png` (toolbar browser).
   > ⚠️ Stato 2026-06-01: l'icona estensione in toolbar è ancora la vecchia "Ad-barrato", NON allineata al wordmark. Da rigenerare da `avatar-512` + rebuild quando confermato.

### Dimensioni
| Uso | Dimensione |
|---|---|
| Chrome toolbar | 16 · 19 · 32 · 38 px |
| Extension page | 48 px |
| Web Store icon | 128 px (+ 300×300 store) |
| Store tile / promo | 440×280, 920×680, 1400×560 px |
| Store screenshot | 1280×800 px |
| Avatar social | 512 / 1024 px |

---

## 5. Iconografia

- **Outline** (stroke 1.5-2px) per icone UI; **Filled** per stato attivo/selezionato.
- Corner radius: 2px.
- Colore: Steel Gray (inattivo) · Shield Purple (attivo) · Pure White (hover).
- Icone core: scudo (ON/OFF), occhio barrato (stealth), grafico barre (stats), toggle, checkmark/X.

---

## 6. UI Components

### Card
Background Midnight Blue `#12122a` · radius 12px · padding 14px · border opzionale 1px `rgba(124,92,252,0.18)`.

### Toggle Switch
Track OFF `#333346` · Track ON Shield Purple · Thumb Pure White · 44×24px.

### Badge (ON/OFF)
ON = Shield Purple + testo bianco · OFF = Alert Red + testo bianco · font 700, 10px.

### Bottoni
- **Primary**: Shield Gradient, testo bianco, radius 10px, hover Soft Purple glow.
- **Secondary**: transparent, bordo Shield Purple, testo Shield Purple.

---

## 7. Voice & Vocabulary (sintesi — dettaglio in `brand-bible.json`)

- **Usa**: block, stealth, invisible, privacy, zero tracking, anti-detection, off, clean, fast, universal, free trial.
- **Evita brand competitor** nel codice/asset (uBlock → "other ad blockers", ecc.).
- **Mai dire**: "100% ad-free", "guarantee", "best in the world", "kill ads".
- **Claim sicuri**: blocca 138 regole / 130+ ad network (Free) · stealth anti-detection (Pro) · stop video ads su piattaforme streaming (Pro) · Chrome/Firefox/Safari/Edge/Opera · 30 giorni Pro gratis · zero data collection.

---

## 8. Store Presence

### Fatti ufficiali (single source — allineare ovunque)
- **138 regole** declarativeNetRequest · **15 lingue** · **5 browser** (Chrome, Firefox, Safari, Edge, Opera).
- **Trial: 30 giorni** Pro gratis (no carta).
- **Versione corrente: 3.4.5**.

### Descrizione Chrome Web Store (max 132 char)
"Blocca pubblicità su tutti i siti. Invisibile ai sistemi anti-adblock. Navigazione veloce e pulita."

### Descrizione estesa
AdOff elimina le pubblicità invasive da ogni sito web — banner, pop-up, tracker e altro. Opera in modo invisibile: i siti non rilevano la sua presenza. Un solo toggle per una navigazione pulita, veloce e senza distrazioni. Con Pro, blocca anche i video ads sulle piattaforme di streaming.

- Blocca banner, popup, tracker e display ads (Free)
- Video ads su piattaforme streaming (Pro)
- Invisibile ai sistemi anti-adblock (Pro)
- Zero raccolta dati — privacy totale
- Funziona su tutti i siti web, 5 browser
- Interfaccia minimale: un toggle, zero configurazione

### Pricing (modello Founder — 2026-06-01)
| Piano | Prezzo |
|---|---|
| Mensile | **2,99 €/mese** |
| Annuale — Founder (primi 100, a vita) | **19,99 €/anno** |
| Annuale — standard (dopo i 100) | **24,99 €/anno** |
| Founder Lifetime (limitato) | **99 €** una tantum |

Counter reale "Posti Founder X/100" dal backend. Piano UNICO. Vecchi tier device (2,69/29,59/67,90) = SUPERATI.

### Keywords Store
ad blocker, block ads, remove ads, video ad blocker, privacy, clean browsing, anti-adblock, popup blocker.

---

## 9. Don'ts (regole assolute)

- MAI rosso/arancione come colore primario (associato ad "allarme").
- MAI teschi, hacker imagery, terminologia aggressiva.
- MAI promettere "100% delle ads bloccate" / "guarantee".
- MAI mostrare ads di esempio o **loghi di terze parti** in icone/screenshot/asset.
- MAI nomi di brand competitor per comparazione diretta nel codice/asset.
- MAI dati personali founder oltre quelli autorizzati: vietati cognome completo, handle pieno, email personale, città nei legali, P.IVA, ID interni Stripe/Cloudflare.
- MAI testimonianze finte o `aggregateRating` inventati (rimossi 2026-06-01: pivot onestà).
- MAI loghi vecchi (`icon128`/`logo-512`) come logo brand → usare `avatar-512.png`.

> **Deroga marketing (autorizzata 2026-05-28)**: nella COPY di `site/` e `docs/store-listing.md` i nomi piattaforma (YouTube, Twitch, ecc.) sono ammessi in forma **nominativa/testuale** per le keyword SEO — mai come logo, mai claim di affiliazione. Nel CODICE estensione restano vietati (solo sinonimi).
