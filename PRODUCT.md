# PRODUCT.md — AdOff

## Register

**brand** — il sito `adoff.app` è marketing/landing/sales material multilingua. Il design IS il prodotto. La superficie `app*/src/popup.*` e `options.*` è invece registro **product**, gestita separatamente.

## Product purpose

AdOff è un ad blocker browser (Manifest V3) per Chrome, Firefox, Safari, Edge e Opera. Tagline: *"Ads? Off!"*. Quattro livelli di blocco simultanei (network DNR, cosmetic CSS, IMA SDK universal stub per video ads, stealth anti-detection). Bypassa i wall anti-adblock senza che i siti se ne accorgano.

Il sito serve a:
1. Far installare gratis (CTA primario sempre verso `install.html`)
2. Convertire trial → Pro via Stripe checkout (€2.69/mese · €29.59/anno · €67.90 lifetime, 3 device base)
3. Costruire fiducia sul claim privacy-first (zero telemetria, GDPR by design)

## Users

**Primario** — utenti 25–55 non tecnici, stufi della pubblicità, comfort tech medio. Vogliono "installa e dimentica". Frustrati specificamente da: pre-roll video, banner invasivi, wall "disattiva il tuo ad blocker", browser lenti per script terzi.

**Secondario** — utenti tecnici (developer, sysadmin, ricercatori privacy) che cercano una soluzione MV3 davvero light e zero-telemetria, alternativa a uBlock Origin in via di depcrecazione e AdGuard percepito come pesante.

**Anti-utente** — chi vuole personalizzare 5000 regole, scrivere filter list, contribuire al codice. AdOff non è uBlock: è la "macchina invisibile che funziona già configurata".

## Voice & tone

Sicuro, minimale, premium. Mai hacker-style, mai cringe. Frasi corte, una idea per frase. "Noi" team, "tu" utente diretto. Onesto: dichiariamo limiti reali (es. pre-roll iniziale può partire 1-2s prima dello skip). Umorismo secco, mai grasso. Emoji al massimo 1–2 per pagina lunga, e solo se utili come affordance, NON come decorazione.

**Da fare**:
- Verbi attivi al presente: *"Blocca", "Si nasconde", "Funziona"*
- Numeri come prova (numero di regole, dimensione, anni di trial)
- Frasi a contrasto (problema → soluzione)
- Italiano come lingua sorgente, traduzione 15 lingue gestita da `adoff-i18n.js`

**Da evitare**:
- Superlativi gratuiti: *"rivoluzionario", "incredibile", "il migliore"* (mostrare, non dire)
- Linguaggio hacker o tecno-trionfalista
- Marketing-speak SaaS: *"unlock", "unleash", "supercharge"*
- Em dash (`—`): usare virgole, due punti, parentesi, punti
- Esclamazioni multiple, ALL CAPS per enfasi

## Brand identity (canonica)

Da `sviluppo/marketing/brand/brand-bible.json`:
- Wordmark: "Ad" bianco + "Off" colore accent
- Storico: palette `#7c5cfc` viola "Shield Purple" su `#0a0a1a` "Deep Space" con tipografia Inter+Lexend — il design corrente del sito.
- Decisione di evoluzione (questa sessione): **uscire dal viola-SaaS reflex** mantenendo dark theme. Vedi `DESIGN.md` per la palette nuova e la motivazione.

## Anti-references

Cose che il sito NON deve assomigliare:
- Landing SaaS template generica: gradient viola/blu, hero metric strip "X+ users · 99% uptime · 5-star", cards identiche, glow ovunque
- Crypto/cyberpunk: neon su nero, font monospaziato esibito, slogan tipo *"trustless decentralized future"*
- Vecchio adblock 2010: temi acquosi azzurri, mascotte
- Big tech corporate: tipografia neutra, foto stock di gente che sorride, claim corporate
- Pagine pubblicitarie aggressive: countdown urgency falsi, popup di uscita, scarsity manipolatoria

Cosa il sito DEVE ricordare:
- Una pagina editoriale ben fatta di un publisher serio (lettura curata, gerarchia chiara)
- Lo splash di un'utility software premium degli anni '90 reinterpretata oggi (Things, iA Writer, Bear) — minimalismo ma con personalità tipografica forte

## Vincoli editoriali assoluti (da CLAUDE.md, non negoziabili)

1. **Mai brand famosi nominati nei file di produzione** — YouTube → "piattaforme video"; Google → "motori di ricerca"; Facebook/IG → "social"; Amazon → "e-commerce"; Twitch → "live streaming". Eccezione: stringhe dominio funzionali nel codice (es. `youtube.com` per hostname match) restano.
2. **Mai dati personali developer**: nome, cognome, email personale, città, telefono, P.IVA, account social personali. I documenti legali usano "European Union" generico, contatti offuscati `support [at] adoff [dot] app`, form `support.html` con anti-bot.
3. **"149 KB" purgato** dal copy (decisione 2026-05-18) — usare *"featherlight"*, *"ultra-leggero"*, "una frazione di un'immagine media", senza numero specifico.
4. **Multi-browser sync** — ogni modifica ai file shared (`src/*.js`, `src/*.html`, `src/*.css`, `rules/`, `assets/`) deve essere propagata identica su `app/` (Chrome), `app-firefox/` e `app-safari/`. Non riguarda il sito ma esiste come regola di progetto.
5. **Deploy = immediato** dopo qualsiasi modifica a `site/`, `app*/`. Pre-deploy check obbligatorio: `grep -ri "erosdegrande\|LeoDg\|mailto:support\|youtube\|YouTube" site/ app/src/ app-firefox/src/ app-safari/src/`.

## Strategic principles

- **Honesty over hype** — preferire un claim verificabile a uno emotivo. Es. *"Blocca 130+ tipi di richieste pubblicitarie"* batte *"Blocca tutte le pubblicità del web"*.
- **Premium feel beats feature parity** — non vinciamo elencando feature (chi vince è chi ha più regole). Vinciamo facendo sentire il prodotto come ben fatto.
- **Privacy by design come asset** — *"Zero dati raccolti"* è il vero differenziatore, da usare ovunque ma senza ripetersi: meglio mostrarlo nella struttura (no GA, no Pixel, niente cookie banner) che dichiararlo a parole.
- **Trial come gateway, non come bait** — i 15 giorni di Pro gratis sono un onboarding, non un trucco di conversione: nessuna carta richiesta, scade silenziosamente a Free, niente dark pattern.
- **Sales letter vs editorial** — il sito attuale è una sales letter long-form. La direzione che stiamo prendendo riduce il pathos manipolatorio (countdown, "ogni minuto che aspetti...", "il colpo finale") verso un tono editoriale fermo: il prodotto si difende da solo.
