# PIANO — Cleanup miscuglio sito vecchio/nuovo (restyling coerente)

**Branch**: feat/premium-vpn · **Data**: 2026-07-20
**Decisioni utente (40-AQ)**: Trial = **15 giorni** ovunque · Premium VPN annuale = **Founder €29,99 primo anno → poi €49,99** · Scope = **tutto (nav+footer+testi)** poi build+deploy.

## Fatti accertati (verificati)
- Nav canonico = `adoff-nav.js` (brand "Ads? Off!"), si aggancia a `#site-nav`; se assente crea nav nuovo come primo figlio del body.
- Footer canonico = `adoff-footer.js`: se trova un `<footer>` esistente **ne sostituisce il contenuto** (righe 124-130). Basta includerlo.
- i18n runtime: `adoff-i18n.js` → IT dall'HTML, altre lingue da `/i18n/{lang}.json`. SSOT tool = `_matrix.json` + `sviluppo/scripts/i18n_manager.py`.
- Reali: **144 regole** (non 138/130), **versione 3.5.36**.
- Rimborso 30 giorni = LEGITTIMO (garanzia), NON toccare. Solo "trial 30" → 15.

## FIX STRUTTURALI (nav/footer)

### 1. `unique-tech.html` — nav doppia (ALTA, è lo screenshot rotto)
- Righe 134-139: rimuovere `<header class="topbar">…</header>` (con brand "AdOff" vecchio + `<nav id="topbarNav">`).
- Sostituire con: `<nav id="site-nav"></nav>` (placeholder corretto). Script nav/footer già inclusi (righe 473-474).

### 2. `affiliati.html` — pagina orfana (ALTA)
- Aggiungere `<nav id="site-nav"></nav>` subito dopo `<body>` (riga 265).
- Aggiungere prima di `</body>` gli script: `adoff-nav.js`, `adoff-footer.js`, `adoff-i18n.js` (footer si autocrea).

### 3. `android.html` — footer vecchio hardcoded (MEDIA)
- Includere `adoff-footer.js` (righe ~348-358 footer statico verrà sostituito automaticamente). Nav già ok.

### 4. `success.html`, `uninstall.html`, `account.html` — footer mancante (MEDIA/BASSA)
- Includere `adoff-footer.js` prima di `</body>` (crea footer). account.html: valutare se app-like (basso impatto).

### 5. `admin-console.html`, `panel.html` — pannelli interni (BASSA)
- NON pubbliche/marketing. Lasciare come sono (topbar interna funzionale). Solo fix versione (vedi sotto).

## FIX TESTUALI (versione/prezzi/trial/regole)

### 6. Versione stale → 3.5.36
- `guide.html:297` "AdOff v3.1.0. Ultimo aggiornamento…" → 3.5.36 + data aggiornata.
- `press.html:470` e `:600` "3.4.6" → 3.5.36.
- `accessibility.html:87` "version 3.5.7" → 3.5.36.
- `best-ad-blocker-2026.html:116,128` JSON-LD "3.4.6" → 3.5.36.
- `admin-console.html:1967` "v3.5.3" → 3.5.36 (basso, admin).

### 7. Prezzo Premium VPN — pricing.html (ALTA)
- `pricing.html:445` `ctaFounder`: "Founder €49,99/anno" → **"Founder €29,99 il primo anno"**.
- `pricing.html:446` `ctaStandard`: resta "Standard €49,99/anno" (corretto).
- Allineare `premium.html:854` (già dice €29,99→€49,99, verificare congruenza).
- Aggiornare chiavi i18n `pricing.vpn.ctaFounder` in `_matrix.json` + `i18n/*.json`.

### 8. Trial 30 → 15 giorni (solo trial, NON rimborso)
- HTML `install.html:979` `install.compare.pro` "trial 30gg" → "trial 15gg".
- i18n `install.compare.pro`, `install.safari.s6.success` (it.json:1509-1510 + tutte le lingue), `meta.description.install`, `faq.a10`, `faq.a2`, `best_ad_blocker_2026.*` (it.json:640,829,830,938).
- `unique-tech.html:468` "30 giorni di accesso Pro" → "15 giorni".

### 9. Regole 130 → 144
- `free-ad-blocker.html:114` "130 network rules" → 144 (+ i18n it.json:938).
- `lightweight-ad-blocker.html:103,120,132` "around 130" → 144.
- (nota: alcune pagine dicono "138" — anche quelle → 144 per congruenza; verificare con grep globale.)

## PROPAGAZIONE i18n
Per ogni fix testuale con `data-i18n`: aggiornare la chiave in **tutte** le 15 lingue (`i18n/*.json`) + `_matrix.json`. Usare `i18n_manager.py` se supporta update mirato, altrimenti sed/patch per chiave. Rimborso "30 giorni" NON toccato.

## BUILD & DEPLOY
- NON serve build estensione (solo `site/`). 
- Pre-deploy check: grep leak PII + brand nel codice, grep version literal, congruenza 144/3.5.36/15gg/prezzi.
- Deploy: `wrangler pages deploy site/ --project-name adoff-site` (via OAuth: `wrangler login` + `CLOUDFLARE_ACCOUNT_ID`).
- Aggiornare CLAUDE.md: "138 regole" → 144 (documento stantio).
- Commit conventional + push su feat/premium-vpn.

## VERIFICA FINALE
- Rifetch di unique-tech / affiliati / pricing / guide / press live → nav coerente, prezzi/versione giusti.
- Rilanciare l'audit subagent per confermare 0 bug residui.

## DO NOT
- NON toccare "rimborso/garanzia 30 giorni" (legittimo).
- NON rimuovere le chiavi changelog storiche (dati storici).
- NON esporre PII/brand-logo di terze parti negli asset.
- NON committare su main (siamo su feat/premium-vpn).
