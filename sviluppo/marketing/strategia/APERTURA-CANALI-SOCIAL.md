# AdOff — Apertura Canali Social (checklist operativa)

> **Data**: 2026-05-15 · **Fase A** di `STRATEGIA-SOCIAL-CONTENT-2026.md` (task S1)
> **Owner**: Founder (creazione account = manuale, richiede email/telefono di verifica)
> **Obiettivo**: aprire TikTok + Instagram + Facebook Page in modo brand-safe, AI-disclosed, pronti per il tool di scheduling.
> Bio canoniche: `SOCIAL-MEDIA-KIT.md` §1. Spec dimensioni: `sviluppo/marketing/brand/social-media-specs.json`.

---

## 0. Pre-requisiti (prima di toccare qualsiasi piattaforma)

| # | Item | Dettaglio |
|---|---|---|
| 1 | **Email brand dedicata** | ✅ **FATTO 2026-05-15**: `social@adoff.app` attivo (CF Email Routing → `adoffsecurity@proton.me`, inbox Proton anonima già verificata). Usare questa per tutte le registrazioni/recuperi. Outbound `social@adoff.app` già funzionante via Resend (dominio verificato). MAI email personale del founder. |
| 2 | **Numero telefono** | Uno solo, riusabile per le verifiche. Necessario per TikTok/IG (verifica anti-bot). |
| 3 | **Asset visivi pronti** | Vedi tabella §2. Già esistenti nel repo, nessuna produzione necessaria. |
| 4 | **Password manager** | Credenziali salvate, 2FA attiva ovunque (app authenticator, non SMS dove possibile). |
| 5 | **Niente VPN/proxy esotici** | Registrare dalla connessione abituale, IP coerente. Cambi IP improvvisi a registrazione = flag anti-bot. |

**Handle unico cross-piattaforma**: `adoff.app` (= dominio, scelto 2026-05-15, identico su TikTok/IG/FB).
Nota: il punto può richiedere mapping nel tool di scheduling — verificare al collegamento (D2); fallback se l'API lo rifiuta: `adsoff`.

---

## 2. Asset brand da usare (già nel repo)

| Asset | File sorgente | Uso | Dimensione target |
|---|---|---|---|
| **Avatar/foto profilo** | `sviluppo/marketing/assets/avatar-512.png` (logomark "OFF Switch" 2026) | TikTok/IG/FB profile pic | 512×512 (quadrato, safe in cerchio) |
| **Banner FB Page** | `sviluppo/marketing/assets/store-assets/marquee-1400x560.png` | Cover Facebook | ridimensionare a 1640×624 (cover FB) |
| **Fallback banner** | `sviluppo/marketing/assets/store-assets/promo-large-920x680.png` | alternativa cover | crop a ratio cover |
| **Colori brand** | Shield Purple `#7c5cfc` su Deep Space `#0a0a1a` | coerenza visiva profili | — |
| **Font** | Inter | eventuali testi su grafiche | — |

> Nota brand-policy: gli asset esistenti sono già conformi (nessun brand vietato). Per eventuali nuove grafiche profilo usare solo UI sintetica/logo, mai screenshot di piattaforme reali.

---

## 3. TikTok (priorità ALTA — motore di reach)

1. App mobile → registrazione con **email brand** + data di nascita (>18, coerente sempre).
2. **Account Personal** (resta così): nell'app TikTok 2026 NON esiste switch "Creator", e "Business" è VIETATO (richiede ragione sociale/licenza/foto = viola REGOLA ASSOLUTA privacy/identità). Non serve nessuno switch: **TikTok Studio** (già attivo, su qualsiasi account) fornisce analytics + scheduler nativo. Personal = configurazione definitiva.
3. **Username**: `adoff.app` · **Nome visualizzato**: `AdOff`
4. **Foto profilo**: `avatar-512.png`
5. **Bio** (≤80, da SOCIAL-MEDIA-KIT §1 TikTok):
   `Watch anything. Read anything. Zero ads, anywhere ↓`
6. **Link in bio**: `https://adoff.app` (campo sito; se non disponibile su Creator sotto soglia follower, mettere link nella prima riga bio / link-in-bio page).
7. **AI disclosure**: non c'è spazio in bio → inserire la versione **Long** (`SOCIAL-MEDIA-KIT §1 AI Disclosure`) nella **descrizione del primo video pinnato** + nella link-in-bio page.
8. Impostazioni: lingua contenuti **English** (reach globale), 2FA ON, commenti filtrati (filtro parole offensive ON).

---

## 4. Instagram (priorità ALTA — Reels + autorità + bio-link)

1. Registrazione con **email brand** (NON collegare a un profilo FB personale del founder; collegare semmai alla Pagina FB brand creata al §5).
2. **Switch a Professional → Business**: `Impostazioni → Tipo di account → Passa a professionale → Business` → categoria **App di prodotti/Software**.
   - Nota: IG Business **non** richiede documenti societari (a differenza di TikTok) — chiede solo categoria + contatto opzionale. OK procedere. Se in futuro IG richiedesse dati legali, ripiegare su **Creator**.
3. **Username**: `adoff.app` · **Nome**: `AdOff — Ad Blocker`
4. **Foto profilo**: `avatar-512.png`
5. **Bio** (≤150, da SOCIAL-MEDIA-KIT §1 Instagram, AI disclosure inline):
   ```
   Block every ad, everywhere 🚫
   Invisible to anti-adblock · all major browsers · ultraleggera
   15-day free trial, no card
   AI-assisted brand channel
   ```
6. **Link**: campo sito → `https://adoff.app` (o link-in-bio page con disclosure Long + download).
7. Collega la Pagina FB brand (§5) quando esiste → abilita pubblicazione cross e tool scheduling Meta.
8. Impostazioni: 2FA ON, commenti — filtro parole predefinito ON, "Consenti messaggi" solo da follower.

---

## 5. Facebook Page (priorità MEDIA — legittimità + mirror Reel)

> Serve una **Pagina** (non profilo personale). La Pagina può essere creata da un profilo personale del founder come admin, ma **nessun dato personale va esposto pubblicamente** sulla Pagina.

1. `facebook.com/pages/create` → **Nome Pagina**: `AdOff` → Categoria: **Software** (+ tag `Product/Service`).
2. **Username/vanity**: `@adoff.app` (`Impostazioni → Username Pagina`).
3. **Foto profilo**: `avatar-512.png` · **Copertina**: `marquee-1400x560.png` ridimensionato a 1640×624.
4. **Intro/bio breve** (≤101, da SOCIAL-MEDIA-KIT §1 FB):
   `Block every ad, everywhere. Invisible to anti-adblock. Free 15-day Pro trial. adoff.app`
5. **Informazioni → Ulteriori informazioni**: incollare il testo **About lungo** (con AI disclosure) da SOCIAL-MEDIA-KIT §1 Facebook.
6. **Sito web**: `https://adoff.app` · **Email contatto pubblica**: NON inserire (usare solo link al form supporto del sito).
7. **Ruoli Pagina**: admin = account founder, ma profilo personale impostato privato. Niente nome/cognome nella Pagina.
8. Impostazioni: 2FA sull'account admin, moderazione commenti (blocklist parole) ON.

---

## 6. Ordine & timing (seasoning leggero — NON warming Reddit 21gg)

| Giorno | Azione |
|---|---|
| D1 | Pre-requisiti §0 + creazione **TikTok** (profilo completo, bio, link, 1 video pinnato con disclosure Long) |
| D1 | Creazione **Facebook Page** (completa) |
| D2 | Creazione **Instagram** + collegamento alla FB Page |
| D2 | TikTok: scheduling via **TikTok Studio nativo** (web, scheduler integrato ~10gg, qualsiasi account, zero API/Business). IG/FB: tool terzo solo se non richiede dati societari, altrimenti scheduler nativo Meta Business Suite |
| D2–D9 | **Seasoning**: 2-3 post organici per canale (mix pilastri A/B dalla Bibbia), profilo "vivo", nessun push di lancio |
| D10 | Canali pronti → inizio Fase B (calendario editoriale pieno) |

Seasoning ≠ warming Reddit: i social tollerano account nuovi che pubblicano contenuto proprio. Il rischio qui è l'inautenticità (engagement-bot), non la novità. Bastano 7-10 giorni di profilo completo + post regolari.

---

## 7. Checklist finale pre-scheduling (gate Fase B)

- [x] 3 account con username `adoff.app` (o fallback documentato) coerenti
- [x] TikTok = **Personal** (no switch Creator nell'app; Business vietato) + TikTok Studio attivo · IG Business (no docs) · FB Page
- [x] Avatar `avatar-512.png` identico ovunque
- [x] Bio da SOCIAL-MEDIA-KIT §1 (TikTok/IG/FB) incollate verbatim
- [x] AI disclosure presente: IG inline + FB About + TikTok pinned/link page
- [x] Zero dati personali founder esposti (Pagina FB, ruoli, contatti)
- [x] Zero brand vietati nei testi/grafiche profilo
- [x] Link `https://adoff.app` attivo su tutti e 3
- [x] 2FA attiva su tutti gli account + credenziali in password manager
- [x] TikTok Studio nativo accessibile + test schedulazione 1 post OK (IG/FB: scheduler nativo o tool senza dati societari)
- [~] Seasoning 7-10gg in corso (≥2 post organici/canale) — parte con la content bank S6

**S1 DONE 2026-05-16** — TikTok(Personal+Studio) · Facebook Page · Instagram(Business, FB-linked, sito). Completata la checklist → S1 DONE → procedere a S2-S6 (pipeline contenuti) e Fase B.

---

## 8. Scheduling — DECISIONE PRESA (2026-05-15)

**Standard: scheduler nativi delle piattaforme** (zero dati societari, zero rischio identità, zero costo):

| Canale | Scheduling |
|---|---|
| **TikTok** | **TikTok Studio** (web) — scheduler nativo integrato, ~10gg avanti, qualsiasi tipo account, nessuna API/Business/verifica |
| **Instagram/Facebook** | **Meta Business Suite** scheduler nativo (Pagina FB + IG collegati) — nativo, gratis, nessun dato societario |

I tool terzi (Buffer/Metricool/Postiz) restano **opzionali futuri**, da adottare solo se: (a) non richiedono ragione sociale/licenza, (b) supportano account Creator. Mai esporre identità per uno scheduler.

**Motivo del cambio**: il flusso TikTok Business richiede ragione sociale + licenza + 6 foto societarie → viola la REGOLA ASSOLUTA privacy/identità. Business **escluso** su TikTok. Vedi decisione in claude-memory `dec-no-business-tiktok-privacy`.

---

*Documento creato 2026-05-15. Esegui in ordine §0 → §7. Aggiorna la checklist §7 man mano. A completamento, segna S1 DONE in STRATEGIA-SOCIAL-CONTENT-2026.md.*
