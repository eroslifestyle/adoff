# 🎨 AdOff — BRAND HUB (tutto in un posto solo)

> **Questa è la cartella unica di tutta l'identità visiva AdOff.** Loghi, identità, immagini social, video, screenshot store, foto: tutto qui, organizzato per cartelle numerate.
> Creato 2026-06-02 centralizzando ciò che prima era sparso in `assets/`, `brand/`, `smm-templates/`, `social-video/`, `demo/`, `store-assets/`, `seeding/`.
> **Regola**: i file *finali/usabili* stanno qui. Gli *strumenti* che li creano stanno nell'**officina** (vedi in fondo).

---

## 📁 Cartelle

### 1-IDENTITA — chi siamo (colori, font, voce)
- `brand-bible.json` — **fonte di verità**: palette, font, tono di voce, pricing, regole, pubblico (massa non tecnica)
- `BRAND-IDENTITY.md` — identità brand leggibile
- `social-media-specs.json` — specifiche formati social
- `font/` — Lexend (Bold, ExtraBold, var) — i font del brand

**Palette**: `#0a0a1a` deep space · `#7c5cfc → #4c3ad4` viola · `#b8a9ff` soft · `#ffffff` · `#4ade80` green
**Font**: Lexend ExtraBold (titoli) · Inter (testo) · JetBrains Mono (numeri)

### 2-LOGHI — il marchio
- `avatar-512.png` / `avatar-1024.png` — **LOGO UFFICIALE** (sfera viola + wordmark AdOff)
- `logo-512.png` / `logo-512-transparent.png` — varianti
- `icon16/19/32/38/48/128.png` — icone estensione (formati)
- `tiktok-app-icon-1024.png/.jpg` — icona profilo social

### 3-IMMAGINI-SOCIAL — grafiche per i post
- `C-quote-multinationals-atm.png` — quote "non sei il bancomat" ✅
- `D-founder-counter.png` — contatore Founder ✅
- `F-lock-for-your-data.png` — serratura→dati ✅ (la migliore)
- `G-brand-card-ads-off.png` — brand card "Ads? Off." ✅
- `E-stats-numbers-base.png` — stat-card (base, da rifilare)
- `concepts/` — **foto-concept FLUX** (basi 9:16 + 16:9) — *nota: scartate (sembravano finte), tenute per riferimento*
- `social/` — concept declinati nei formati esatti (story/ig/x/fb)

### 4-VIDEO — i video demo (i più importanti) 🎬
- **`REEL-completo-video__story-it.mp4`** ⭐ — il **reel narrato completo** (storia + voce + musica + effetti, 21s)
- `video__*` — scenario "premi play / video parte" (story 1080×1920 · ig 1080×1350 · x 1600×900 · IT + `__en`)
- `wall__*` — scenario "muro anti-adblock sparisce" (stessi formati, IT + EN)
- `recipe__*` — scenario "sito invaso → solo la ricetta" (stessi formati, IT + EN)
- `video__*__audio-demo.mp4` — primo test audio

> Naming: `{scenario}__{formato}{__en}.mp4` · scenari: video/wall/recipe · formati: story-1080x1920 (Reel/Story), ig-1080x1350 (post IG), x-1600x900 (X) · `__en` = inglese, niente = italiano.

### 5-SCREENSHOT-STORE — per gli store
- `screenshot1-6_*.png` — screenshot Chrome Web Store / AMO
- `promo_*`, `marquee-*`, `store-tile-*`, `promo-large-*` — tile promozionali
- `store-icon-128.png`, `logo-300x300.png` — icone store
- `captions-amo-en.txt`, `Business-Plan-Veil.pdf`

### 6-SEEDING-PH — Product Hunt / outreach
- `ph-1..4-*.png` — gallery Product Hunt (1270×760)
- `tool-*.png`, `home-en.png`, `landing-undetectable.png` — screenshot tool/sito per seeding
- `at-icon-256.png`, `ph-thumbnail-240.png`

### 7-COVER — copertine profili
- `Copertina_Facebook.png`, `fb-cover-1640x624.png`

### _ARCHIVIO-TEST — scarti/esperimenti (non usare)
22 file di test/prova (flux-test, zimage, e2e, turbo, ecc.). Tenuti per sicurezza, non cancellati. **Si possono eliminare quando vuoi.**

---

## 🔧 OFFICINA (dove gli asset si CREANO — fuori da questo hub, restano dove sono)

Questi NON sono asset finali ma strumenti/motori (hanno codice, git, dipendenze → spostarli romperebbe tutto):

| Cartella | Cosa fa |
|---|---|
| `../demo/` | Genera i **video demo reali** (pagine HTML scenario + Playwright + estensione AdOff) |
| `../video-engine/` | Engine Remotion + RunPod studio + TTS (ha un suo `.git`) — clip bank in `output/bank/` |
| `../automation/` | Content-factory n8n, hook-bank, caption-prompt |
| `../carousel-gen/` | Generatori carosello FLUX/SDXL |
| `../brand/` | Generatori icone/wordmark (`generate-*.py`) + strategie commerciali + omnia-kit + sdcpp-source |

## 📄 Documenti strategici (in `../`)
- `adoff-smm-calendario.md` — piano editoriale
- `adoff-concepts-copy.md` — copy 3 concept IT/EN
- `strategia/` — strategia social, bibbia, piani

---

*Centralizzato 2026-06-02. Se aggiungi un asset finale, mettilo nella cartella numerata giusta. Se è un test, in `_ARCHIVIO-TEST/`.*
