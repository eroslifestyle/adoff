# AdOff — Marketing Hub (INDEX)

> **Hub unico** di tutto il social/marketing/content. Creato 2026-05-16 (riorganizzazione globale).
> Convenzione: la cartella indica l'area → i nomi file restano descrittivi senza prefisso ridondante.

## Struttura

```
sviluppo/marketing/
├── strategia/      Documenti strategici autoritativi
├── keywords/       Ricerca keyword SEO multilingua
├── brand/          Identità canonica + generatori asset
├── assets/         Output visivi (avatar, cover, loghi, immagini)
├── video-engine/   Remotion (template video brand-safe + render)
├── automation/     Content Factory n8n (≥5 contenuti/giorno) — DA COSTRUIRE
└── archive/        Documenti superseded / progetti vecchi
```

## strategia/ — fonti autoritative

| File | Ruolo |
|---|---|
| `STRATEGIA-SOCIAL-CONTENT-2026.md` | **AUTORITATIVO** — strategia social unica (principi, assorbe gli archiviati) |
| `PIANO-MARKETING-PRODUZIONE-2026.md` | **AUTORITATIVO esecuzione** — produzione+pubblicazione: cadenza, copy, multilingua, anti-ban |
| `APERTURA-CANALI-SOCIAL.md` | Checklist operativa apertura canali (S1 DONE) |
| `SOCIAL-MEDIA-KIT.md` | Bio/copy/hook copy-paste per piattaforma (canonico) |
| `ADOFF-BIBBIA-MARKETING.md` | Bibbia: storytelling/messaggi/dati verificati per ogni contenuto |
| `NOTEBOOKLM-VIDEO-SCRIPT.md` | Script video promo |

## brand/ — identità canonica

| File | Ruolo |
|---|---|
| `BRAND-IDENTITY.md` | Palette, font (Lexend), wordmark, avatar/cover spec |
| `brand-bible.json` · `social-media-specs.json` | Dati strutturati brand + dimensioni social |
| `generate-wordmark.py` | Avatar wordmark site-style → `../assets/avatar-*` |
| `generate-fb-cover.py` | Cover Facebook brand-exact → `../assets/fb-cover-*` |
| `generate-adoff-icons.py` · `generate-brand-assets.py` | Legacy icone estensione (path patchati post-reorg) |
| `fonts/Lexend-var.ttf` | Font display brand |

## assets/ — output visivi
`avatar-512/1024/preview.png` · `fb-cover-1640x624.png` + preview · loghi · `store-assets/` · immagini varie. Riferiti dai doc operativi.

## video-engine/ — Remotion
Template parametrici brand-safe: `src/brand.tsx` (tema), `src/BeforeAfter.tsx` (Video A), `src/HookCard.tsx` (Video B), `src/Root.tsx`. Output in `output/`. Render: `npx remotion render <id> output/<n>.mp4`.
> Nota: `node_modules` locale (~920 MB) rigenerabile con `npm install` se eliminato. In produzione il render gira su leobox. (Path orfano `sviluppo/video-tiktok-remotion/` rimosso il 2026-05-28.)

## automation/ — Content Factory (da costruire)
n8n su leobox: cron → hook bank (Bibbia) → LLM Qwen (script/caption) → render Remotion template → store/log → digest Telegram. Requisito: **≥5 contenuti/giorno**. Publish: scheduler nativi (decisione A/B in sospeso).

## archive/
`MARKETING-STRATEGY.md` (obsoleta), `STRATEGIA-LANCIO-AUTOMATIZZATO.md` (superseded), `video-tiktok-old/` (vecchio engine pre-Remotion).
