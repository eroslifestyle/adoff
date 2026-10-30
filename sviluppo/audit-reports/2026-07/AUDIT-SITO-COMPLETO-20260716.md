# Audit completo sito adoff.app — 2026-07-16

**Metodo**: audit statico su 568 pagine HTML (40 root + 15 lingue + vs/ + blog/). Controlli meccanici deterministici (grep/parse cross-sito) + workflow multi-agente (59 agenti Opus, ~6.9M token) che ha letto pagina per pagina root + campione per ogni lingua + audit GUI.

**Fonte di verità (SSOT)** — `data/constants.json`, verificata contro il codice reale dell'estensione (`app/`):
- versione **3.5.36** · regole network **144** · lingue **15** · trial **15 giorni** (`app/src/background.js:13` `TRIAL_DAYS=15`)
- prezzi: mensile **2,99€** · annuale **29,99€** · Premium mensile **4,99€** · Premium annuale founder **29,99€** · Premium annuale standard **49,99€** · rimborso **30gg**
- **NON esiste** piano Lifetime. **NON esistono** i prezzi 19,99 / 24,99 / 2,69 / 5,99 / 3,99 / 9,99 / 67,90 / 129,90.

**Totale problemi catalogati: 565** (128 critical · 176 high · 154 medium · 107 low).
Dettaglio riga-per-riga: `/tmp/adoff_bug_catalog.csv` (esportabile in project se serve).

---

## 🔴 BUG CRITICI — spiegano "pagine che non si aprono / testi che non si leggono / traduzione non funziona"

### C1. Script core con path RELATIVO → nav + footer + i18n = 404 in TUTTE le 13 homepage lingua
**Il bug con più impatto.** Le 13 `<lang>/index.html` caricano i tre script core senza slash iniziale:
```html
<script src="adoff-nav.js"></script>     <!-- da /ar/ → /ar/adoff-nav.js = 404 -->
<script src="adoff-footer.js"></script>  <!-- 404 → footer assente -->
<script src="adoff-i18n.js"></script>    <!-- 404 → LA TRADUZIONE NON PARTE -->
```
Conseguenza: barra di navigazione assente, footer assente, e **i data-i18n restano non tradotti** (spiega "la traduzione non funziona"). I file esistono solo in root (`/adoff-nav.js`).
**File (13)**: `ar de es fr hi id ja ko pl pt ru tr zh` / `index.html`.
**Fix**: aggiungere lo slash iniziale → `src="/adoff-nav.js?v=..."` (come già fa `de/guide.html`, che funziona). Le pagine interne di lingua usano già il path assoluto: incongruenza limitata alle homepage.
> Nota: anche la root `index.html`, `about.html`, `install.html` usano `adoff-nav.js` relativo, ma in root risolve a `/adoff-nav.js` (esiste) → funziona per caso. Da uniformare comunque.

### C2. `pricing.html` → 404 in tutte le cartelle lingua (15 file)
Le homepage lingua linkano `href="pricing.html"` (relativo, 2 CTA: "Scopri Premium" + "Confronta tutti i piani") ma **`<lang>/pricing.html` non esiste** — esiste solo `/pricing.html` root.
**File**: `ar/index es/index fr/index hi/index ja/index ko/index pt/index ru/index tr/index zh/index` + i checker segnalano anche `de/hi/id/pl/pricing.html` come target morto. Anche `premium.html` in root ha lo stesso link a `pricing.html` da verificare.
**Fix**: puntare a `/pricing.html` (root) o creare le pagine prezzi tradotte.

### C3. HTML rotto — commento non chiuso inghiotte l'intera pagina
`ar/license-guide.html`: `<!-- Shared nav injected...` senza `-->` → tutto il markup successivo (hero, plans, FAQ, CTA) finisce dentro il commento → **pagina di fatto vuota**.
**Fix**: chiudere il commento. Controllare le altre `*/license-guide.html` con lo stesso template.

### C4. Piano "Lifetime" / "Founder Lifetime 99€" FANTASMA (66 occorrenze / 45 file)
Piano che **non esiste nel prodotto** compare in JSON-LD e nel corpo, con prezzi vari (99€, 67,90€, 129,90€). Es. `zh/license-guide.html`: "专业终身 €67.90–129.90".
**File**: 45 (tutte le `*/license-guide.html`, `*/best-ad-blocker-2026.html`, `*/guide.html`, + root `pricing.html salesletter.html terms.html account.html`).
**Fix**: rimuovere ogni riferimento Lifetime dal testo e dai JSON-LD.

### C5. Prezzo annuale errato 19,99€ / 24,99€ (42 occ / 25 file, 32 critical)
Prezzo vecchio nel corpo E nei JSON-LD `offers` (impatta la SEO/rich-results con dati falsi). Reale: **29,99€**.
**File**: 78 file contengono `19,99` (grep meccanico); i 25 più gravi hanno il prezzo anche nello structured data.

---

## 🟠 BUG HIGH — incongruenze sistemiche diffuse

### H1. Trial "30 giorni" errato → deve essere 15 (76 occ / 54 file)
**L'incongruenza più diffusa.** ~109 pagine (grep) dicono "30 giorni di prova gratis"; il prodotto reale dà **15 giorni** (`background.js:13`). Da non confondere col rimborso (quello sì 30gg).
**Fix di massa**: sostituire "30 giorni/days/Tage/jours..." riferito al *trial* con 15. Attenzione a non toccare il rimborso 30gg.
> Reliquia: `app/src/background.js:554` ha un commento `// Trial 30 giorni` sopra codice che usa `TRIAL_DAYS`(=15) — commento fuorviante da correggere.

### H2. Versione hardcoded ≠ 3.5.36 (55 occ / 45 file)
Versioni vecchie sparse: **v3.4.6** (42×), 3.3.0, 3.2.7, 3.1.0, 3.5.7, 3.1.8... anche dentro JSON-LD `SoftwareApplication`. Viola la regola Version Congruence.
**Fix**: rimuovere gli hardcode; dove serve un numero, allinearlo a 3.5.36 (o generarlo).

### H3. Conteggio regole errato → 144 (32 occ / 29 file)
"107 regole", "120 rules", "130 precise rules", "107+ regole" invece di **144**.

### H4. Conteggio lingue errato → 15 (23 occ / 20 file)
Diverse pagine (es. `ar/guide.html`) dicono ancora "6 lingue"; reale **15**.

### H5. Pagine intere NON tradotte (testo IT/EN in pagina lingua) — 76 occ / 37 file
Le più gravi, interamente in italiano/inglese sotto `lang` di altra lingua:
- `fr/support.html`, `ru/support.html` → **intera pagina supporto in ITALIANO**
- `tr/license-guide.html`, `ru/license-guide.html`, `fr/license-guide.html` → intero corpo in italiano
- `es/install.html`, `hi/install.html`, `ja/install.html`, `ru/install.html`, `tr/install.html` → step installazione in italiano/inglese
- Mix di 2 lingue: `de/support.html` ("includen"), refusi ("isgannesco" in `affiliati.html`)
**File**: 37 (soprattutto `support.html`, `install.html`, `license-guide.html` per lingua).

### H6. Testo illeggibile per tema light/dark (51 occ / 20 file, 12 critical)
Il tema **default è LIGHT** ma molti componenti hanno colori/sfondi dark hardcoded:
- `premium.html`: prezzi `.plan-card__amount` `color:var(--pure-white)` su `.plan-card` `background:var(--surface)` (=#fff in light) → **prezzi bianco-su-bianco invisibili**.
- `pricing.html:261`: celle "non incluso" `.compare-no` `color:rgba(255,255,255,0.2)` → invisibili in light.
- `install.html`: interi blocchi `<style>` inline con `background:#12122a` ma testo `var(--text)` scuro → scuro-su-scuro in… (contrasto rotto).
- `guide.html`: separatori tabella `border rgba(255,255,255,0.04)` invisibili su bianco.
- `account.html`: bottoni "Accedi con Google/Microsoft" con sfondo fisso + colore tema-aware → testo bianco-su-bianco (dark) o scuro-su-scuro (light).

---

## 🟡 BUG MEDIUM/LOW (sintesi)

- **Cache-buster CSS incoerenti**: `style.css?v=260611a` (598 pag), `v=260520` (258 pag), `v=260714b` (16 pag) → rischio CSS stantio/cache mista. Uniformare a un'unica versione.
- **`/changelog.html` 404** (10 pagine linkano un file inesistente).
- **Ancore `#pricing` / `#features` / `#faq` / `#download` assenti in `index.html`** ma referenziate da 30–49 pagine → click che non atterrano.
- **Prezzi fantasma 5,99 / 3,99 / 9,99** in `*/license-guide.html` e `vs/*vpn*.html`.
- **FAQ accordion senza fallback** (`it/index.html`): risposte `max-height:0`, invisibili senza JS.
- **`uninstall.html`**: retry-banner hardcoded solo in inglese su pagina i18n.
- **`vpn-policy.html`**: contraddizione dispositivi ("one account per device" vs "max 3 dispositivi").
- **`affiliati.html`**: durata cookie incoerente (15gg vs 30gg nella stessa pagina).
- **`blog/annuncio-lancio-adblock-vpn.html`**: placeholder `{{...}}` non risolto.
- **Regola CSS "NUCLEAR CENTER"** (`style.css:2098`) forza `text-align:center !important` su quasi tutto → sbilancia l'hero split desktop.

---

## Pagine più problematiche (per numero di findings)
`install.html` (25) · `guide.html` (13) · `license-guide.html` (13) · `affiliati.html` (13) · `pricing.html` (12) · `press.html` (11) · `pt/guide.html` (11) · `pt/license-guide.html` (11) · `account.html` (11) · `unique-tech.html` (10).

## Ordine di fix consigliato (impatto/sforzo)
1. **C1** (13 slash agli script) — 1 riga × 13 file, sblocca nav/footer/**traduzione** su tutte le home lingua.
2. **C2** (link pricing.html → /pricing.html) — banale, elimina 404 diffusi.
3. **C3** (commento non chiuso) + template license-guide lingua.
4. **H1 trial 30→15** + **C4 Lifetime** + **C5/H2/H3/H4** — sostituzioni di massa guidate da SSOT (idealmente rigenerando da constants.json).
5. **H6** testo illeggibile tema light — fix CSS tema-aware.
6. **H5** ritraduzione support/install/license-guide per lingua.
7. Medium/low: cache-buster unico, changelog.html, ancore index, prezzi vs/.
