# SPEC — riscrittura dei 3 script condivisi del sito

Contesto: `site/adoff-i18n.js`, `site/adoff-nav.js`, `site/adoff-footer.js`.
Vanilla JS ES5, nessun bundler, niente dipendenze. Mantenere lo stile esistente
(IIFE, `var`, commenti in italiano).

## Realtà del filesystem (verificata — NON assumere altro)

- Root `site/*.html`: pagine **canoniche italiane** → `index.html`, `install.html`,
  `support.html`, `guide.html`, `privacy.html`, `terms.html`, `withdrawal.html`,
  `accessibility.html`, `license-guide.html`, `chi-sono.html`, `pricing.html`,
  `salesletter.html`, `affiliati.html`
- Root `site/*.html`: pagine **canoniche inglesi** → `premium.html`, `vpn-policy.html`,
  `community.html`, `press.html`, `how-it-works.html`, `unique-tech.html`,
  `best-ad-blocker-2026.html`, `about.html`, `adblock-detector.html`, `android.html`,
  `android-dns.html`
- `site/{lang}/` per 15 lingue, ma **NON contengono** `premium.html`, `pricing.html`,
  `vpn-policy.html`: quelle esistono solo nella root.
- `site/vs/` e `site/it/vs/` non hanno `index.html`.

## 1. `adoff-i18n.js`

### 1.1 — Il gate "lang === 'it'" va sostituito dal confronto con la lingua SORGENTE

Oggi (righe ~179-185) se la lingua rilevata è `it` la funzione esce senza caricare nulla,
partendo dal presupposto che il testo nel markup sia già italiano. È falso per le pagine
root canoniche inglesi: su `/premium` un utente italiano legge inglese, benché `it.json`
contenga le 145 chiavi `premium.*` tradotte.

Sostituire con: leggere la lingua **dichiarata dal markup** (`document.documentElement.lang`,
default `it` se assente) e uscire solo se coincide con quella rilevata. Altrimenti caricare
e applicare il dizionario, qualunque sia la lingua — italiano incluso.

### 1.2 — `meta.title` / `meta.description` / `og:*` solo sulla homepage

Oggi `applyTranslations` sovrascrive `document.title` con `dict['meta.title']` su **ogni**
pagina, e `meta.title` è il titolo della homepage: `/pricing`, `/premium`, `/install`,
`/support`, `/account` mostrano tutte il titolo della home.

Applicare quel blocco solo quando la pagina è effettivamente la homepage: pathname `/`,
`/index.html`, `/{lang}/` o `/{lang}/index.html`. Su tutte le altre pagine lasciare intatti
titolo, description e og. Gli elementi con `data-i18n` espliciti continuano a essere tradotti
normalmente (il ciclo generico non cambia).

### 1.3 — Esporre l'API per nav e footer

Nav e footer vengono iniettati da script separati **dopo** che le traduzioni sono state
applicate: il loro contenuto non viene mai tradotto. Serve un punto di aggancio.

Esporre `window.AdOffI18n` con:
- `lang` — lingua attiva
- `dict` — dizionario caricato (`null` finché non pronto)
- `ready` — booleano
- `applyTo(rootElement)` — applica le traduzioni ai soli discendenti di `rootElement`
  (stessa logica di `applyTranslations`: `data-i18n` → `textContent`,
  `data-i18n-html` → `innerHTML`, `data-i18n-placeholder` → `placeholder`).
  Deve essere sicura da chiamare anche se il dizionario non è ancora pronto (no-op).

Emettere su `document` l'evento `adoff-i18n-ready` (bubbles, non cancellabile) quando il
dizionario è stato caricato e applicato. Emetterlo **anche** nel caso "nessuna traduzione
necessaria" (lingua sorgente == lingua attiva), così i consumatori non restano appesi.

`applyTo` va estratta rifattorizzando `applyTranslations`, non duplicando la logica.

## 2. `adoff-nav.js`

### 2.1 — Costruzione dei link (righe ~249-258)

Le variabili attuali mandano `Pricing`, `Premium VPN` e `VPN Policy` su `/{lang}/...`,
percorsi che non esistono in nessuna lingua. Inoltre `guideLink` e `privacyLink` trattano
la root come inglese, mentre la riga 104 dello stesso file (`STATIC_IT_ROOT`) la dichiara
italiana: l'utente inglese riceve guida e privacy in italiano.

Tabella corretta, da rispettare esattamente (`lq` = `'?lang=' + lang` per lang ≠ it, altrimenti `''`):

| voce | it | en | altra lingua xx |
|---|---|---|---|
| Home / Features / CTA | `/` | `/?lang=en` | `/?lang=xx` |
| Pricing | `/pricing.html` | `/pricing.html?lang=en` | `/pricing.html?lang=xx` |
| Premium VPN | `/premium` | `/premium` | `/premium?lang=xx` |
| VPN Policy | `/vpn-policy` | `/vpn-policy` | `/vpn-policy?lang=xx` |
| Community | `/it/community` | `/community` | `/xx/community` |
| Support | `/support.html` | `/support.html?lang=en` | `/support.html?lang=xx` |
| Install | `/install.html` | `/install.html?lang=en` | `/install.html?lang=xx` |
| Guide | `/guide.html` | `/en/guide.html` | `/xx/guide.html` |
| Privacy | `/privacy.html` | `/en/privacy.html` | `/xx/privacy.html` |

Nota: `premium` e `vpn-policy` sono canoniche inglesi, quindi per `en` non prendono `?lang=`;
per `it` nemmeno, perché `adoff-i18n.js` ora traduce anche verso l'italiano (punto 1.1).
`guide` e `privacy` sono canoniche italiane: per `it` root nuda, per tutti gli altri `/{lang}/`.

Riusare le funzioni di convenzione già presenti nel footer (`enRoot` / `itRoot`) invece di
ripetere ternari sparsi: una sola fonte di verità per le due convenzioni.

### 2.2 — Reintrodurre le etichette traducibili

Il nav non ha più alcun `data-i18n`: le etichette sono inglese hardcoded su tutte le 552
pagine, in tutte le lingue. Erano presenti fino al commit `51f788e` e sono state perse in
`b822897`. Recuperare le chiavi da lì: `nav.features`, `nav.pricing`, `nav.support`,
`nav.guide`, `nav.community`, `nav.cta`.

Aggiungere `data-i18n` a ogni etichetta del nav, sia desktop che mobile. Chiavi da usare
(quelle già esistenti nei dizionari vanno riusate, le nuove vanno aggiunte al punto 4):

`nav.home`, `nav.features`, `nav.pricing`, `nav.premium`, `nav.premiumVpn`,
`nav.vpnPolicy`, `nav.community`, `nav.support`, `nav.install`, `nav.guide`,
`nav.privacy`, `nav.cta`

Il testo di default nel markup resta l'inglese attuale.

### 2.3 — Tradurre dopo l'injection

Subito dopo aver assegnato `root.innerHTML`, tradurre il nav appena creato:
chiamare `window.AdOffI18n.applyTo(root)` se il dizionario è già pronto, e in ogni caso
registrarsi su `adoff-i18n-ready` per riapplicare quando arriva. Deve funzionare in
entrambi gli ordini di caricamento (i18n prima o dopo il nav) e non deve rompersi se
`adoff-i18n.js` non è presente nella pagina.

## 3. `adoff-footer.js`

### 3.1 — «Tutti i confronti» (riga ~102)

`lp('vs/')` produce `/vs/` (e `/it/vs/` per l'italiano): nessuna delle due directory ha un
`index.html`, quindi il link è rotto in tutte e 15 le lingue. Farlo puntare a
`/vs/index.html` una volta creata quella pagina (task separato); nel frattempo il link deve
comunque risolvere: usare `/vs/` e basta, senza prefisso di lingua.

### 3.2 — Tradurre dopo l'injection

Il footer ha già 26 attributi `data-i18n` ma nessuno li applica: viene iniettato dopo che
`adoff-i18n.js` ha già girato, e 399 delle 551 pagine che lo includono non caricano nemmeno
`adoff-i18n.js`. Risultato: footer italiano fisso su pagine tedesche, arabe, giapponesi.

Stessa soluzione del nav: dopo l'injection chiamare `window.AdOffI18n.applyTo(footerEl)` e
registrarsi su `adoff-i18n-ready`. Robusto rispetto all'ordine di caricamento e all'assenza
di `adoff-i18n.js`.

### 3.3 — Coerenza con il nav

`fLang` nel footer è calcolato con una logica propria che ignora `<html lang>` e ha default
`'it'`. Deve usare la stessa lingua del nav: se `window.AdOffI18n.lang` è disponibile usare
quella, altrimenti mantenere il calcolo attuale come fallback.

## 4. Chiavi i18n da aggiungere

Quattro chiavi del footer sono referenziate dal markup ma **non esistono in nessuno dei 15
dizionari**: `footer.tagline`, `footer.premium`, `footer.blog`, `footer.vs.all`.
Vanno aggiunte a tutti e 15 i file `site/i18n/*.json`, con le nuove chiavi `nav.*` del
punto 2.2. Questo è un task separato dalla modifica degli script: qui va solo tenuto conto
che i nomi delle chiavi devono coincidere.

## Vincoli

- Nessuna dipendenza esterna, nessun framework, ES5.
- Non rompere il tema chiaro/scuro, GA4, il dropdown lingua, l'hamburger mobile, il
  dropdown Premium: sono già funzionanti.
- `switchLang()` (righe 106-141) resta invariata: è già corretta.
- Non toccare `STATIC_EN_ROOT` / `STATIC_IT_ROOT`: sono le liste giuste, il bug era che i
  link builder non le usavano.
