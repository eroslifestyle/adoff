# AUDIT FORENSE — sito adoff.app

**Data**: 2026-07-29
**Branch**: `feat/premium-vpn` (nessun merge, nessun deploy, nessun fix applicato)
**Perimetro**: `site/` — 568 file HTML, 15 lingue, script condivisi, deploy Cloudflare Pages
**Metodo**: script automatici esaustivi (Fasi 1-2-4-5) + campione dichiarato con browser reale (Fasi 3-6)
**Script prodotti**: `sviluppo/scripts/audit/` (`resolve.py`, `audit_links.py`, `audit_lang_matrix.py`, `audit_i18n.py`, `audit_untranslated.py`, `audit_congruence.py`, `audit_seo.py`, `audit_runtime.py`, `audit_runtime2.py`, `audit_langswitch.py`) — output in `out/`

**Baseline verificata**: il live è allineato ai sorgenti locali. MD5 identici per `adoff-nav.js`, `adoff-footer.js`, `adoff-i18n.js`, `style.css`, `i18n/de.json`, `sitemap.xml`. Quindi ogni bug trovato nei sorgenti è **anche online adesso**.

---

## 1. EXECUTIVE SUMMARY — le 5 cause radice

I 4 sintomi che hai descritto non sono 4 problemi: sono la superficie di **5 cause**, tutte introdotte o aggravate dal restyling di luglio.

### CR-1 — Cloudflare Pages ha il fallback SPA attivo: ogni link rotto restituisce la homepage con HTTP 200

Il progetto Pages ha `not_found_handling` impostato su single-page-application (impostazione a livello di progetto, **non** nel repo: in `site/` non esistono né `404.html` né `_routes.json`). Conseguenza: qualunque URL inesistente non dà 404, ma **200 + la homepage italiana**.

```
$ curl -sS -o fake.html -w "%{http_code} %{size_download}\n" https://adoff.app/it/questa-non-esiste-xyz
200 25108
$ curl -sS -o root.html https://adoff.app/ && diff -q root.html fake.html
(nessun output → i due file sono IDENTICI)
```

Questa è la causa che rende tutto il resto **invisibile e diagnosticabile solo dall'interno**: nessun 404 nei log, nessun errore in console, Google vede soft-404 ovunque, e l'utente che clicca un link rotto semplicemente "torna alla home" — che è esattamente la sensazione «il menu non funziona».

### CR-2 — Il menu punta a pagine che non esistono in nessuna lingua

`adoff-nav.js` costruisce i link `Pricing`, `Premium VPN` e `VPN Policy` con il pattern `/{lang}/pagina`, ma `premium.html`, `pricing.html` e `vpn-policy.html` **esistono solo nella root**. Non c'è una sola cartella lingua che li contenga:

```
$ ls site/{it,en,de,fr,es,pt,ru,ar,zh,tr,pl,hi,ja,ko,id}/premium.html 2>&1 | head -3
ls: impossibile accedere a 'site/it/premium.html': File o directory non esistente
ls: impossibile accedere a 'site/en/premium.html': File o directory non esistente
ls: impossibile accedere a 'site/de/premium.html': File o directory non esistente
```

Combinato con CR-1: **42 voci di menu su 14 lingue** (tutte tranne EN) portano alla homepage. Riproduzione con browser in locale italiano — cioè l'utente medio del sito:

```
HOME  lang=it | title=AdOff — Blocca la pubblicità senza configurare nulla
   Pricing        -> /it/pricing.html
   Premium VPN    -> /it/premium
   VPN Policy     -> /it/vpn-policy

DOPO CLIC SU «Pricing»:
   URL  : https://adoff.app/it/pricing.html
   title: AdOff — Blocca la pubblicità senza configurare nulla
   h1   : La pubblicità sparisce. Il web torna tuo.
```

L'utente clicca "Prezzi" e resta sulla homepage. Tre voci su otto del menu principale sono così, per il 93% del traffico.

C'è anche una **contraddizione interna nello stesso file**: la riga 104 dichiara `guide`, `privacy`, `terms`, `withdrawal` come pagine con l'italiano nella root (`STATIC_IT_ROOT`), ma le righe 255-256 costruiscono i link trattando la root come inglese. Risultato: l'utente EN che clicca `Guide` riceve la guida **in italiano**, mentre `/en/guide.html` esiste ed è irraggiungibile dal menu.

### CR-3 — Nav e footer sono usciti dal sistema di traduzione

`adoff-nav.js` contiene **zero** attributi `data-i18n`: le etichette sono stringhe inglesi hardcoded. `adoff-footer.js` ne contiene 26, ma con testo di default **italiano** e nessuno che le applichi: il footer viene iniettato da uno script separato e `adoff-i18n.js` non lo ritraduce dopo l'injection.

E soprattutto: `adoff-footer.js` è incluso in **551 pagine**, `adoff-i18n.js` solo in **152**. Le 399 pagine di differenza hanno il footer congelato in italiano per sempre.

Osservato dal vivo su `/de/guide` (pagina tedesca):

```
nav    : Home | Features | Pricing | Premium VPN | VPN Policy | Community | Support | Install   ← inglese
h1     : Benutzerhandbuch                                                                        ← tedesco
footer : L'ad blocker invisibile con stealth anti-detection. Privacy-first, zero dati raccolti.
         PRODOTTO Prezzi Premium VPN Installa Come funziona Guida utente Migliori Ad Blocker 2026 ← italiano
```

Tre lingue nella stessa schermata. Questo è il «tutto confusionario».

Il colpevole è identificato con precisione. Il commit `b822897` (2026-07-14, *"feat(v3.5.36): trial 15gg + pricing rework (no Lifetime) + site restyling (**WIP, redesign pending**)"*, 24 file, +4226/−2373) ha riscritto il nav da zero **rimuovendo tutti i suoi 18 `data-i18n`** e aggiungendo i link `premium`/`vpn-policy` per-lingua:

```
$ for c in 51f788e b822897; do echo "$c data-i18n=$(git show $c:site/adoff-nav.js | grep -c 'data-i18n')"; done
51f788e data-i18n=18      ← 2026-07-09, prima del restyling
b822897 data-i18n=0       ← 2026-07-14, dopo
```

Un commit marcato "WIP, redesign pending" è finito in produzione.

### CR-4 — Il deploy è stato fatto bypassando lo script che avrebbe bloccato tutto

Esiste `sviluppo/scripts/deploy-site.sh` con `set -euo pipefail`, che prima di pubblicare esegue il gate i18n ed esclude gli artefatti di sviluppo. **Quel gate oggi fallisce**:

```
$ python3 sviluppo/scripts/i18n_manager.py check; echo "EXIT REALE = $?"
✗ HARD: 2001 data-i18n key(s) used in HTML but absent from matrix:
SUMMARY: hard_failures=2001 · untranslated_cells=0
EXIT REALE = 1
```

Con exit 1 e `set -e`, `deploy-site.sh` si sarebbe fermato. Il sito è online lo stesso ⇒ è stato pubblicato con `wrangler pages deploy site/` diretto. La prova indipendente: `deploy-site.sh` esclude esplicitamente `graphify-out/` e `CLAUDE.md` (il commento cita la stessa regressione già avvenuta il 2026-06-13), e quei file **sono online adesso**:

```
$ curl -sS -o /dev/null -w "%{http_code} %{size_download} %{content_type}\n" https://adoff.app/graphify-out/graph.json
200 3993796 application/json
$ curl -sS https://adoff.app/CLAUDE.md | head -c 60
## graphify

This project has a knowledge graph at graphify-out/
```

> **CORREZIONE (2026-07-29, in fase di fix).** La prima stesura di questa sezione diceva
> «nessun dato personale, nessuna email, nessun segreto». Quella verifica aveva coperto solo
> `graph.json` e `GRAPH_REPORT.md`: **non** il contenuto di `/CLAUDE.md`, che invece espone lo
> username Linux e la struttura della home directory, tre volte:
>
> ```
> $ curl -sS https://adoff.app/CLAUDE.md | grep -nE "mrxxx|/home/"
> 15:Pagina progetto: `/home/mrxxx/Obsidian/Memoria/progetti/site/site.md`. Regole complete: `~/.claude/CLAUDE.md` …
> 20:3. Append `/home/mrxxx/Obsidian/Memoria/log.md`: `## [YYYY-MM-DD HH:MM] <op> | <slug>`.
> 21:4. Aggiorna `/home/mrxxx/Obsidian/Memoria/INDICE.md` se nuove pagine.
> ```
>
> Violazione diretta della regola di privacy del progetto. Nessuna credenziale esposta, ma il
> perimetro dell'esposizione era più ampio di quanto scritto: la ricerca sistematica dei file
> non-web nella root di deploy ha trovato **altri 8 artefatti interni serviti con HTTP 200**:
>
> | path online | byte | cosa è |
> |---|---|---|
> | `/CLAUDE.md` | 1 529 | istruzioni interne + percorsi home |
> | `/.claude/gen-pricing-pages.py` | 13 781 | script interno di generazione pagine |
> | `/.claude/settings.json` | 813 | configurazione hook |
> | `/AUDIT_ES_TUTEO_REPORT.md` | 6 737 | report interno di audit linguistico |
> | `/i18n/AUDIT_AR_PRICING_2026-05-20.md` | 11 424 | report interno |
> | `/i18n/AUDIT_HI_FAQ_STEALTH_2026-05-20.md` | 8 330 | report interno |
> | `/i18n/AUDIT_ID_FORMAL_LANGUAGE.md` | 7 680 | report interno |
> | `/i18n/TRANSLATION_REPORT_PT.md` | 2 847 | report interno |
> | `/i18n/README.md` | 2 782 | doc interna |
>
> Nessuno di questi contiene credenziali (verificato) e solo `/CLAUDE.md` contiene percorsi
> personali. Tutti spostati fuori da `site/` durante il fix. **L'esposizione resta attiva online
> finché non si ridispiega**: rimuoverli dal repo non li rimuove da produzione.

Il resto dell'esposizione è struttura interna: 4 MB di knowledge graph, senza credenziali (`sk_live`, `acct_1`, `api_key`: 0 match su `graph.json`).

Nota strutturale sul gate: `_matrix.json` conosce 656 chiavi, le pagine ne usano 2262. La "single source" i18n è scollegata dalla realtà da tempo, per questo il gate è diventato un ostacolo da aggirare invece che una rete di sicurezza.

### CR-5 — La traduzione è per metà finta: i dizionari contengono inglese e italiano al posto delle lingue

Il commit `c6c5bfc` *"fix(i18n): add EN fallback to all 13 language files (852 keys each)"* ha copiato le stringhe inglesi **dentro** i dizionari nazionali. Non è un fallback a runtime: è testo inglese scritto dentro `de.json`, `ja.json`, `ar.json`. Sommato all'italiano mai tradotto, resta circa metà del sito effettivamente localizzato:

| lingua | chiavi usate | = stringa EN | = stringa IT | realmente tradotte |
|---|---|---|---|---|
| de | 2252 | 1105 | 903 | 1126 (50%) |
| fr | 2252 | 1111 | 922 | 1107 (49%) |
| es | 2252 | 1224 | 944 | 995 (44%) |
| ja | 2252 | 1098 | 897 | 1134 (50%) |
| ar | 2252 | 1098 | 897 | 1134 (50%) |

Esempio verificabile — le 145 chiavi `premium.*` in `de.json` sono **al 100% identiche a `en.json`**:

```
premium.bundle.adblockDesc
   de: 'Ad blocking, video ads, Stealth anti-detection — everything AdOff Pro does.'
   en: 'Ad blocking, video ads, Stealth anti-detection — everything AdOff Pro does.'
```

Confermato dal vivo su `/premium?lang=de`: 183 elementi `data-i18n` nella pagina, `h1` = *"Stop the ads. Hide your IP address. One subscription."* — inglese.

---

## 2. TABELLA BUG

Severità: **P0** blocca/rompe il sito · **P1** rompe una funzione · **P2** incongruenza di contenuto · **P3** cosmetico/SEO minore.

| ID | Sev | Area | File:riga | Descrizione | Evidenza | Fix proposto |
|---|---|---|---|---|---|---|
| B01 | P0 | Infra | progetto CF Pages (non nel repo) | Fallback SPA: ogni URL inesistente → HTTP 200 + homepage IT. Maschera tutti i 404, genera soft-404 SEO su tutto il sito | `curl /it/questa-non-esiste-xyz` → `200 25108`, `diff` con `/` → identici | Impostare `not_found_handling` su 404 e aggiungere `site/404.html` |
| B02 | P0 | Nav | [adoff-nav.js:251-253](site/adoff-nav.js#L251-L253) | `Pricing`/`Premium VPN`/`VPN Policy` → `/{lang}/…` che non esiste in nessuna lingua. 42 voci di menu rotte su 14 lingue | matrice nav: `404!` su 14 lingue × 3 voci; clic reale su Pricing (locale it-IT) resta sulla homepage | Far puntare le 3 voci alla root (`/pricing.html`, `/premium`, `/vpn-policy`) + `?lang=` |
| B03 | P0 | CSS | 48 pagine, es. [it/guide.html:34](site/it/guide.html#L34), [de/guide.html:34](site/de/guide.html#L34) | `<link rel="stylesheet" href="style.css">` **relativo**: da `/de/guide` risolve a `/de/style.css`, che il fallback SPA serve come `text/html`. Il browser rifiuta il CSS → pagina senza stile | console: `Refused to apply style from 'https://adoff.app/de/style.css?v=260714b' because its MIME type ('text/html') is not a supported stylesheet MIME type`; `body font-family: "Times New Roman"`, `background: rgba(0,0,0,0)`; screenshot `out/shots/guide_DE_(CSS_rotto).png` | Sostituire con `/style.css?v=…` (assoluto) nelle 48 pagine |
| B04 | P0 | i18n | [adoff-nav.js:268-330](site/adoff-nav.js#L268-L330) | Nav senza alcun `data-i18n`: etichette inglesi hardcoded su tutte le 552 pagine, in tutte le lingue | `grep -c 'data-i18n' site/adoff-nav.js` → `0`; su `/de/guide` il nav è inglese | Reintrodurre i `data-i18n` (esistevano fino a `51f788e`) e applicarli dopo l'injection |
| B05 | P0 | i18n | [adoff-footer.js:66-117](site/adoff-footer.js#L66-L117) | Footer con 26 `data-i18n` e default italiano, mai tradotto: 551 pagine lo includono, solo 152 caricano `adoff-i18n.js` → 399 pagine con footer italiano fisso | su `/de/guide` e `/ar/privacy`: `PRODOTTO Prezzi Installa Come funziona Guida utente…` | Far applicare le traduzioni dopo l'injection (evento o chiamata diretta) e includere `adoff-i18n.js` ovunque |
| B06 | P0 | SEO/UX | [adoff-i18n.js:99-101](site/adoff-i18n.js#L99-L101) | `document.title = dict['meta.title']` applicato **senza condizione su ogni pagina**: `meta.title` è il titolo della HOMEPAGE. Tutte le pagine runtime-tradotte ereditano titolo e description della home | `/pricing`, `/premium`, `/install`, `/support`, `/account` mostrano tutte `AdOff Ad Blocker \| Free + Pro Video Blocking \| 15 Days Free`; `/premium?lang=de` → `AdOff, bester unsichtbarer Ad Blocker` | Applicare `meta.title` solo se la pagina non ne definisce uno proprio, o usare chiavi per-pagina |
| B07 | **P0** | Deploy / Privacy | processo + 11 path dentro `site/` | Deploy eseguito bypassando `deploy-site.sh`: `graphify-out/` (4 MB), `CLAUDE.md`, `.claude/` e 6 report interni serviti da adoff.app. **`/CLAUDE.md` espone username Linux e struttura della home** — violazione della regola di privacy del progetto. Severità alzata da P1 a P0 rispetto alla prima stesura | `curl /CLAUDE.md \| grep -nE "mrxxx\|/home/"` → 3 righe `/home/mrxxx/Obsidian/…`; `curl /.claude/gen-pricing-pages.py` → `200 13781`; `curl /.claude/settings.json` → `200 813`; `curl /graphify-out/graph.json` → `200 3993796`. Nessuna credenziale (verificato) | Spostare tutto fuori da `site/` (**fatto**: → `sviluppo/graphify-site/`, `sviluppo/site-internal-docs/`), poi ripubblicare via `deploy-site.sh`. **Finché non si ridispiega, l'esposizione resta online** |
| B08 | P1 | Gate | `sviluppo/scripts/i18n_manager.py` + `site/i18n/_matrix.json` | Il gate fallisce con 2001 hard failures perché `_matrix.json` ha 656 chiavi contro le 2262 usate: la "single source" non è più la sorgente | `EXIT REALE = 1`, `hard_failures=2001` | Rigenerare `_matrix.json` dalle chiavi realmente usate, poi rendere il gate bloccante di nuovo |
| B09 | P1 | Nav | [adoff-nav.js:104](site/adoff-nav.js#L104) vs [255-256](site/adoff-nav.js#L255-L256) | Contraddizione interna: `STATIC_IT_ROOT` dichiara guide/privacy IT-root, i link builder trattano la root come EN. L'utente EN riceve guida e privacy **in italiano**; `/en/guide.html` esiste ma è irraggiungibile | `guide.html` → `<html lang="it">`, titolo *"Guida Utente"*; `en/guide.html` → `<html lang="en">` | Usare `itRoot()`/`enRoot()` come già fa il footer |
| B10 | P1 | Nav | 16 pagine: 10 × `vs/*.html` + `about-data/`, `account/`, `admin-console`, `it/about-data/`, `mgmt-9f4a/`, `panel.html` | Nav e footer **legacy hardcoded**, non i componenti condivisi: 4 voci italiane, nessun selettore lingua, nessun toggle tema | `/vs/ublock-origin`: `linkNuovi=0 linkLegacy=4`, voci `['Funzionalità','Prezzi','Installa','Supporto']`; switcher lingua assente (`#snLangBtn` non esiste); screenshot `out/shots/vs_uBlock_(nav_legacy).png` | Migrare le 10 pagine `vs/` agli script condivisi |
| B11 | P1 | Link | [adoff-footer.js:102](site/adoff-footer.js#L102) | «Tutti i confronti» → `/vs/` (e `/it/vs/` per IT): nessuna delle due directory ha `index.html`. Rotto in tutte e 15 le lingue | `ls site/vs/index.html` → non esiste; `curl /vs/` → `200 25108` (homepage) | Creare `vs/index.html` o puntare a una pagina indice esistente |
| B12 | P1 | i18n | dizionari `site/i18n/*.json` | ~1100 chiavi per lingua contengono la stringa **inglese**, ~900 quella **italiana**: solo il 44-50% è realmente tradotto | 145/145 chiavi `premium.*` in `de.json` identiche a `en.json`; `/premium?lang=de` h1 inglese | Ritradurre a partire dalle chiavi realmente usate (2252), non dalle 2645 del dizionario |
| B13 | P1 | i18n | pagine sotto `/{lang}/` senza `adoff-i18n.js` (399) | Il selettore lingua cambia l'URL ma non il contenuto | `/de/ad-blocker-brave` + clic FR → URL `?lang=fr`, `<html lang>` resta `de`, testo invariato | Includere `adoff-i18n.js` ovunque, o instradare lo switcher alla pagina statica corrispondente |
| B14 | P1 | i18n | `it.json` (18 chiavi), `ru.json` (2) | Valori **vuoti** su chiavi realmente renderizzate → il testo sparisce | `about.main.about_me = ''`, `about.about_sub.the_real_person_behind_adoff = ''`; `ru`: `pricing.free.f6`, `pricing.free.f8` | Popolare o rimuovere le chiavi |
| B15 | P2 | Contenuto | 104 pagine su 15 lingue | Trial dichiarato **30 giorni**; il reale è **15** (`app/src/background.js:13 TRIAL_DAYS = 15`) — 170 occorrenze al netto di rimborso e cookie affiliato | `es/free-ad-blocker.html`: *"prueba gratuita de 30 días"*; `id/ad-blocker-brave.html:65`: *"uji coba 30 hari"*; `ko/adblock-detector.html:83`: *"30일 Pro 체험"* | Allineare a 15 in tutte le lingue (le pagine root sono già corrette) |
| B16 | P2 | Contenuto | 69 pagine, 189 occorrenze | Piano **Lifetime** ancora venduto: rimosso il 2026-07-16 (`constants.json`) | `es/press.html:483` *"Pro Vitalicio, **99 EUR** pago único"*; `en.json` `faq.a4` *"The Founder Lifetime is a limited launch offer: €99 once"*; `de.json`, `it.json` idem | Rimuovere Lifetime da pagine e dizionari |
| B17 | P2 | Contenuto | 20 pagine, 69 occorrenze | Prezzi superati: €29.59, €2,47, €2.69, €5.99, €59.99 vs listino attuale (2,99 / 19,99 / 24,99 / 4,99 / 29,99 / 49,99) | `en/salesletter.html:1808` *"Poi €29.59/anno"*; `id/license-guide.html:530` *"€2.69 - €5.99"*; `en/press.html:483` *"EUR 2.69 / month"* | Allineare a `site/data/constants.json` |
| B18 | P2 | Contenuto | 60 pagine, 107 occorrenze | Versione stantia: 3.3.0 (×32), 3.4.6 (×30), 3.3.1 (×16), v3.1.0 (×15), 3.5.7 (×14) vs reale **3.5.38** | `ar/guide.html:49` *"AdOff v3.1.0 — 19 aprile 2026"* (visibile nello screenshot DE); `it.json`/`en.json` `install.dl.info` = *"Versione 3.4.6"* | Rendere la versione dinamica o rigenerarla dal manifest al build |
| B19 | P2 | i18n | HTML | 2001 chiavi `data-i18n` usate nell'HTML non esistono in `_matrix.json`; 32 non esistono nemmeno in `it.json` | output gate; `audit_i18n.py` sezione A | Rigenerare la matrice, poi eliminare le 32 chiavi fantasma |
| B20 | P2 | i18n | 9 pagine root runtime-tradotte | Chiavi assenti da **tutti** i dizionari → testo che resta in italiano in ogni lingua | `ublock-origin-alternative.html`: 8 chiavi mancanti × 14 lingue; `android-ad-blocker.html`: 5; `ad-blocker-chrome.html`: 4; `guide.html`: 4 | Aggiungere le chiavi mancanti |
| B21 | P2 | A11y/SEO | 42 file HTML | Attributo `<html lang>` assente — incluse **tutte le 20 pagine di `it/`**, `pricing.html`, `chi-sono.html`, 9 pagine `vs/` | `pricing.html:2` → `<html>`; `it/guide.html:2` → `<html>` | Aggiungere `lang` corretto |
| B22 | P2 | SEO | 86 riferimenti | `hreflang` verso pagine inesistenti: `/{lang}/android-dns` e `/{lang}/android` per 14 lingue | `android-dns.html:13-27`; `ls site/it/android-dns.html` → non esiste | Creare le pagine o rimuovere gli hreflang |
| B23 | P2 | SEO | `site/sitemap.xml` | 13 URL morti (`/{lang}/about-data/` per 12 lingue) e **266 pagine pubbliche assenti** su 308 URL totali | `curl /de/about-data/` → homepage; assenti `/about`, `/accessibility`, `/android`, tutte le `/ar/*` … | Rigenerare il sitemap dall'albero reale |
| B24 | P2 | SEO | 43 pagine | `<meta name="description">` assente | `about.html`, `accessibility.html`, `adblock-detector.html`, `account.html`, … | Aggiungere description uniche |
| B25 | P2 | SEO | 18 pagine | `<link rel="canonical">` assente | `affiliati.html`, `de/salesletter.html`, `es/salesletter.html`, `fr/salesletter.html`, `hi/salesletter.html`, `account.html` … | Aggiungere canonical |
| B26 | P2 | SEO | 4 pagine | Canonical che punta a un'altra pagina invece che a sé | `it/privacy.html` → `https://adoff.app/privacy` (che è la privacy root); idem `it/terms.html`, `it/withdrawal.html`, `ja/license-guide.html` | Correggere il self-canonical |
| B27 | P2 | SEO | 148 pagine | Open Graph incompleti: 148 senza `og:image`, 93 senza `og:description`, 46 senza `og:title` | `audit_seo.py` sezione OPEN GRAPH | Completare i meta OG |
| B28 | P2 | SEO | 22 pagine | Titoli duplicati già nei sorgenti (5× salesletter, 5× *"AdOff, Invisible Ad Blocker 2026"*, 4× support, 3× install) — indipendenti da B06 | `es/index.html` e `es/install.html` condividono lo stesso titolo | Titoli unici per pagina |
| B29 | P2 | Immagini | 21 pagine | Immagini 404: `/assets/icon-48.png` (10 pagine `vs/`, in `assets/` esistono solo `icon128.png`/`.webp`) e `{lang}/assets/icon128.png` relativo su 11 `install.html` | `vs/ublock-origin.html:56`; Playwright: `IMMAGINI ROTTE: ['/assets/icon-48.png']` | Correggere i percorsi / aggiungere l'asset |
| B30 | P3 | Tema | `blog/index.html` | Il blog usa la palette **dark** hardcoded mentre il resto del sito è light di default | `/blog/` → `body background rgb(10,10,26)`, testo `rgb(226,226,240)`; le altre pagine `rgb(247,247,251)` | Uniformare al tema condiviso |
| B31 | P3 | Layout | `pl/install.html` | Unica pagina di lingua senza `adoff-footer.js` | `grep -rL 'adoff-footer.js'` la elenca fra le pagine di contenuto | Aggiungere lo script |
| B32 | P3 | Contenuto | pagine `vs/` | Safari indicato fra i browser disponibili; `constants.json` lo classifica `browsers_coming_soon` | `vs/ublock-origin.html`: *"Disponibile per Chrome, Firefox, Safari, Edge"* (screenshot) | Allineare l'elenco browser |
| B33 | P3 | Contenuto | titoli tradotti | Separatore corrotto: `·` reso come `,` | `de/guide.html` title: *"Benutzerhandbuch **,** AdOff Werbeblocker"*; `en/guide.html`: *"User Guide **,** AdOff Ad Blocker"* | Ripristinare il separatore |

---

## 3. MATRICE LINK — voce di menu × lingua

Legenda: `ok` corretto · `404!` soft-404 (serve la homepage IT) · `LANG` pagina esistente ma in un'altra lingua · `nolg` pagina senza `<html lang>` · `rt` tradotta a runtime via `?lang=`

### Nav (`adoff-nav.js`)

| VOCE | de | en | es | fr | id | it | ja | ko | pl | pt | tr | zh | ar | hi | ru |
|---|---|---|---|---|---|---|---|---|---|---|---|---|---|---|---|
| logo / Home / Features | rt | rt | rt | rt | rt | ok | rt | rt | rt | rt | rt | rt | rt | rt | rt |
| **Pricing** | **404!** | LANG | **404!** | **404!** | **404!** | **404!** | **404!** | **404!** | **404!** | **404!** | **404!** | **404!** | **404!** | **404!** | **404!** |
| **Premium VPN** | **404!** | ok | **404!** | **404!** | **404!** | **404!** | **404!** | **404!** | **404!** | **404!** | **404!** | **404!** | **404!** | **404!** | **404!** |
| **VPN Policy** | **404!** | ok | **404!** | **404!** | **404!** | **404!** | **404!** | **404!** | **404!** | **404!** | **404!** | **404!** | **404!** | **404!** | **404!** |
| Community | ok | ok | ok | ok | ok | nolg | ok | ok | ok | ok | ok | ok | ok | ok | ok |
| Support / Install / CTA | rt | rt | rt | rt | rt | ok | rt | rt | rt | rt | rt | rt | rt | rt | rt |
| Guide (mobile) | ok | **LANG** | ok | ok | ok | nolg | ok | ok | ok | ok | ok | ok | ok | ok | ok |
| Privacy (mobile) | ok | **LANG** | ok | ok | ok | ok | ok | ok | ok | ok | ok | ok | ok | ok | ok |

### Footer (`adoff-footer.js`)

| VOCE | de | en | es | fr | id | it | ja | ko | pl | pt | tr | zh | ar | hi | ru |
|---|---|---|---|---|---|---|---|---|---|---|---|---|---|---|---|
| Prezzi / Premium VPN / Blog / Chi sono | rt | rt | rt | rt | rt | LANG/nolg | rt | rt | rt | rt | rt | rt | rt | rt | rt |
| Installa / Supporto | rt | rt | rt | rt | rt | ok | rt | rt | rt | rt | rt | rt | rt | rt | rt |
| Come funziona | ok | ok | ok | ok | ok | nolg | ok | ok | ok | ok | ok | ok | ok | ok | ok |
| Guida utente | ok | ok | ok | ok | ok | ok | ok | ok | ok | ok | ok | ok | ok | ok | ok |
| Migliori Ad Blocker 2026 | ok | ok | ok | ok | ok | nolg | ok | ok | ok | ok | ok | ok | ok | ok | ok |
| **Test detector** | **LANG** | ok | **LANG** | **LANG** | **LANG** | nolg | **LANG** | **LANG** | **LANG** | **LANG** | **LANG** | **LANG** | **LANG** | **LANG** | **LANG** |
| **vs uBlock Origin** | **nolg** | **nolg** | **nolg** | **nolg** | **nolg** | ok | **nolg** | **nolg** | **nolg** | **nolg** | **nolg** | **nolg** | **nolg** | **nolg** | **nolg** |
| **vs AdBlock Plus** | **LANG** | ok | **LANG** | **LANG** | **LANG** | ok | **LANG** | **LANG** | **LANG** | **LANG** | **LANG** | **LANG** | **LANG** | **LANG** | **LANG** |
| **vs AdGuard** | **nolg** | **nolg** | **nolg** | **nolg** | **nolg** | ok | **nolg** | **nolg** | **nolg** | **nolg** | **nolg** | **nolg** | **nolg** | **nolg** | **nolg** |
| Community | ok | ok | ok | ok | ok | nolg | ok | ok | ok | ok | ok | ok | ok | ok | ok |
| **Tutti i confronti** | **404!** | **404!** | **404!** | **404!** | **404!** | **404!** | **404!** | **404!** | **404!** | **404!** | **404!** | **404!** | **404!** | **404!** | **404!** |
| **Live data** | **LANG** | ok | **LANG** | **LANG** | **LANG** | ok | **LANG** | **LANG** | **LANG** | **LANG** | **LANG** | **LANG** | **LANG** | **LANG** | **LANG** |
| Press Kit | ok | ok | ok | ok | ok | nolg | ok | ok | ok | ok | ok | ok | ok | ok | ok |
| Privacy / Termini / Recesso | ok | ok | ok | ok | ok | ok | ok | ok | ok | ok | ok | ok | ok | ok | ok |

**Totali su 480 combinazioni voce × lingua**: `OK` 174 · `RUNTIME` 168 · `LANG-MISMATCH` 42 · `NO-LANG-ATTR` 39 · `SOFT404` 57.

### Link statici (tutti i 568 HTML)

14 748 link estratti: **13 732 OK**, 257 esterni, 572 non navigabili, **187 soft-404**. I 187 rotti si concentrano in:

| target rotto | occorrenze | pagine | nota |
|---|---|---|---|
| `/{lang}/style.css`, `/blog/style.css`, `/it/blog/style.css` | 48 | 48 | **B03 — il CSS** |
| `/assets/icon-48.png` | 10 | 10 | pagine `vs/` |
| `/{lang}/assets/icon128.png` | 11 | 11 | `install.html` di 11 lingue |
| `/{lang}/android-dns`, `/{lang}/android` | 28 | 2 | hreflang (B22) |
| `/oauth/google/start`, `/oauth/microsoft/start` | 2 | 1 | `account.html:238,242` |

---

## 4. MATRICE i18n

### 4a. Qualità reale delle traduzioni (2252 chiavi effettivamente renderizzate)

| lingua | = stringa EN | = stringa IT | sovrapposte | realmente tradotte | % |
|---|---|---|---|---|---|
| en | — | 1472 | — | 780 | 34% |
| de | 1105 | 903 | 882 | 1126 | 50% |
| fr | 1111 | 922 | 888 | 1107 | 49% |
| es | 1224 | 944 | 911 | 995 | 44% |
| pt | 1124 | 957 | 896 | 1067 | 47% |
| ru | 1100 | 900 | 880 | 1130 | 50% |
| ar | 1098 | 897 | 877 | 1134 | 50% |
| zh | 1133 | 929 | 907 | 1097 | 48% |
| tr | 1104 | 918 | 883 | 1113 | 49% |
| pl | 1104 | 905 | 884 | 1127 | 50% |
| hi | 1114 | 913 | 879 | 1104 | 49% |
| ja | 1098 | 897 | 877 | 1134 | 50% |
| ko | 1100 | 899 | 879 | 1132 | 50% |
| id | 1104 | 913 | 884 | 1119 | 49% |

La riga `en` va letta al contrario: 1472 chiavi hanno lo stesso valore in `it.json` e `en.json`, quindi **una delle due lingue è sbagliata**. Il campione mostra entrambi i casi: `account.crea_account = "Crea account"` (italiano servito agli inglesi) e `accessibility.accessibility.statement = "Accessibility Statement"` (inglese servito agli italiani).

### 4b. Italiano residuo servito a utenti stranieri

Misura conservativa (solo stringhe ≥25 caratteri con margine ≥2 marker, più le stringhe brevi con lessico italiano certo):

| lingua | italiano certo (lunghe) | italiano certo (brevi) | non classificate |
|---|---|---|---|
| de | 99 | 77 | 718 |
| fr | 103 | — | 733 |
| es | 103 | — | 753 |
| ja / ar / ko / ru / pl / id | 99 | — | ~716-728 |

Esempi verificati:
- `affiliati.adoff.non.e.responsabile.per.perdita.di.` → *"AdOff non e' responsabile per perdita di commissioni…"* — identico in de, ja, ar
- `card_title.revenue_ultimi_30_giorni` → *"Revenue ultimi 30 giorni"*
- `before_after.con_adoff` → *"✅ Con AdOff"* (pagina pubblica)
- `hi/license-guide.html:334` → *"prova gratuita di 30 giorni"* — **italiano dentro la pagina hindi**

### 4c. Chiavi mancanti / vuote / orfane

| controllo | risultato |
|---|---|
| chiavi usate nell'HTML ma assenti da `it.json` | **32** |
| chiavi usate assenti dai dizionari per le 9 pagine root runtime | `ublock-origin-alternative` 8 · `android-ad-blocker` 5 · `ad-blocker-chrome` 4 · `guide` 4 · `ad-blocker-brave` 3 · `lightweight-ad-blocker` 3 · `private-ad-blocker` 3 · `affiliati` 1 · `android-dns` 1 — **× 14 lingue** |
| valori vuoti su chiavi renderizzate | `it` **18** · `ru` **2** · altre 0 |
| chiavi del footer runtime mancanti in **tutte** le 15 lingue | **4**: `footer.tagline`, `footer.premium`, `footer.blog`, `footer.vs.all` |
| chiavi orfane (mai usate) | **393** su 2645 (14%) |
| chiavi ignote a `_matrix.json` | **2001** |

### 4d. Comportamento reale dello switcher lingua

| partenza | clic | esito | verdetto |
|---|---|---|---|
| `/de/guide` | fr | → `/fr/guide`, `lang=fr`, testo francese | OK |
| `/it/guide` | de | → `/de/guide`, `lang=de`, testo tedesco | OK |
| `/` | de | → `/?lang=de`, testo tedesco | OK |
| `/de/ad-blocker-brave` | fr | → `/de/ad-blocker-brave?lang=fr`, `lang` resta `de`, **testo invariato** | **ROTTO** |
| `/premium` | de | → `/premium?lang=de`, titolo della homepage tedesca, **h1 e corpo in inglese** | **ROTTO** |
| `/vs/ublock-origin` | de | **selettore lingua assente** | **ROTTO** |

---

## 5. PIANO DI FIX ORDINATO

### Blocco 0 — sbloccare la diagnosi (prima di ogni altra cosa)

| # | Fix | Rischio | Dipendenze |
|---|---|---|---|
| 0.1 | Disattivare il fallback SPA su CF Pages + aggiungere `site/404.html` | **Medio-alto**: i link oggi rotti passano da "torna alla home" a 404 visibile. È l'effetto voluto, ma va fatto **insieme** al Blocco 1, non prima | nessuna |

Senza 0.1 ogni fix successivo resta non verificabile: non esiste modo di distinguere una pagina che funziona da una che non esiste.

### Blocco 1 — ripristinare la navigazione (P0, stesso deploy del Blocco 0)

| # | Fix | Rischio | Dipendenze |
|---|---|---|---|
| 1.1 | `adoff-nav.js:251-253` → far puntare Pricing/Premium/VPN Policy alla root | Basso, 3 righe | — |
| 1.2 | `adoff-nav.js:255-256` → usare la convenzione IT-root di riga 104 per guide/privacy | Basso | 1.1 |
| 1.3 | `adoff-footer.js:102` → «Tutti i confronti» verso una pagina esistente, o creare `vs/index.html` | Basso | — |
| 1.4 | 48 pagine: `href="style.css"` → `href="/style.css?v=…"` | Basso, meccanico e verificabile | — |
| 1.5 | `adoff-i18n.js:99-101` → non sovrascrivere `<title>`/description se la pagina ne ha già uno proprio | **Medio**: tocca tutte le pagine runtime-tradotte, va verificato su un campione per lingua | — |

Dopo il Blocco 1, riesecuzione di `audit_links.py` + `audit_lang_matrix.py`: i soft-404 di nav e footer devono scendere da 57 a 0.

### Blocco 2 — riunificare le lingue (P0/P1)

| # | Fix | Rischio | Dipendenze |
|---|---|---|---|
| 2.1 | Reintrodurre i `data-i18n` nel nav (recuperabili da `git show 51f788e:site/adoff-nav.js`) | Basso | 1.1, 1.2 |
| 2.2 | Applicare le traduzioni **dopo** l'injection di nav e footer | **Medio**: è il punto di race attuale, va risolto con un ordine esplicito, non con un timeout | 2.1 |
| 2.3 | Includere `adoff-i18n.js` nelle 399 pagine che hanno il footer ma non il loader | Medio, tocca molti file ma è meccanico | 2.2 |
| 2.4 | Aggiungere le 4 chiavi footer mancanti in tutte le lingue + le chiavi delle 9 pagine root | Basso | 2.2 |
| 2.5 | Migrare le 10 pagine `vs/` (+6 interne) agli script condivisi | Medio | 2.1 |

### Blocco 3 — ripristinare il guard-rail (P1) — prima di qualunque nuovo deploy

| # | Fix | Rischio | Dipendenze |
|---|---|---|---|
| 3.1 | Rimuovere `graphify-out/` e `CLAUDE.md` dal sito pubblicato | Basso | — |
| 3.2 | Rigenerare `_matrix.json` dalle 2262 chiavi realmente usate | Medio: è la riconciliazione di due sorgenti divergenti | — |
| 3.3 | Tornare a deployare **solo** via `deploy-site.sh`, con il gate bloccante | Basso una volta fatto 3.2 | 3.2 |

### Blocco 4 — contenuti (P2)

| # | Fix | Rischio | Dipendenze |
|---|---|---|---|
| 4.1 | Trial 30 → 15 giorni su 104 pagine (attenzione a non toccare rimborso 30gg e cookie affiliato 30gg, che sono corretti) | **Medio**: la disambiguazione va fatta a mano o con regex verificata caso per caso | — |
| 4.2 | Rimuovere il piano Lifetime da 69 pagine e dai dizionari | Basso | — |
| 4.3 | Allineare i prezzi superati su 20 pagine | Basso | — |
| 4.4 | Versione dinamica dal manifest (60 pagine) | Basso | — |
| 4.5 | Popolare le 18+2 chiavi vuote | Basso | — |

### Blocco 5 — traduzione reale (P1, il più costoso)

| # | Fix | Rischio | Dipendenze |
|---|---|---|---|
| 5.1 | Ritradurre ~1100 chiavi per lingua che oggi contengono inglese, e ~900 che contengono italiano | Alto per volume, basso per rischio tecnico. Va fatto **dopo** 3.2, altrimenti si traduce anche una parte delle 393 chiavi orfane | 3.2, 4.x |

### Blocco 6 — SEO e rifiniture (P2/P3)

Sitemap rigenerato (B23), hreflang (B22), canonical (B25, B26), description (B24), OG (B27), `<html lang>` sulle 42 pagine (B21), immagini (B29), tema blog (B30), separatore titoli (B33).

**Ordine consigliato di deploy**: `Blocco 0+1 insieme` → verifica → `Blocco 2` → verifica → `Blocco 3` → poi 4, 6 e infine 5.

---

## 6. NON VERIFICATO

Elenco onesto di ciò che non ho controllato e perché.

1. **L'impostazione `not_found_handling` nella dashboard Cloudflare Pages.** Il comportamento di catch-all è dimostrato empiricamente (200 + homepage su path arbitrari, contenuto byte-identico), ma non ho accesso alla dashboard per leggere il valore della configurazione. La causa potrebbe in teoria essere un'altra (un Worker in rotta sul dominio), anche se `site/` non contiene né `_routes.json` né `_worker.js`.

2. **Fasi 3 e 6 sono campionarie, come da mandato.** Campione dichiarato: 12 pagine nel primo giro (`home IT`, `home EN`, `/de/guide`, `/ja/how-it-works`, `/ar/privacy`, `/vs/ublock-origin`, `/blog/how-to-block-ads-on-chrome`, `/install`, `/it/guide`, `/account`, `/pricing`, `/premium`), 8 nel secondo, 6 casi di switcher lingua. Le altre ~550 pagine non sono state aperte in un browser reale: per quelle valgono solo i risultati statici delle Fasi 1-2-4-5.

3. **Rendering mobile e responsive.** Testato solo a 1280×900. Nessun test a viewport mobile, quindi non ho dati sull'overflow orizzontale nelle 48 pagine senza CSS (dove il layout è comunque già compromesso a desktop).

4. **Accessibilità WCAG.** Non ho eseguito axe-core. Le 42 pagine senza `<html lang>` sono una violazione WCAG 3.1.1 nota, ma non ho rimisurato lo stato complessivo rispetto all'audit precedente.

5. **Il toggle dark/light in funzione.** Ho verificato che il pulsante esiste (`themeToggle: true` su tutte le pagine col nav condiviso) e che il tema di default è light, ma non ho testato il ciclo completo di commutazione né la persistenza in `localStorage` fra pagine.

6. **La classificazione automatica delle stringhe italiano/inglese è euristica.** I numeri della sezione 4b sono un limite inferiore verificato per campione, non una misura esatta; la colonna "non classificate" (~720 per lingua, in prevalenza stringhe brevi) contiene sicuramente altro materiale non tradotto che non ho contato.

7. **Il timeout di `/account`.** Al primo giro `networkidle` non è mai stato raggiunto in 45 s; al secondo giro, con `domcontentloaded`, la pagina ha risposto 200 regolarmente. Non ho isolato quale richiesta resti pendente — potrebbe essere un long-poll legittimo o una richiesta appesa.

8. **Errori console non spiegati**: `%c%d font-size:0;color:transparent NaN` ricorrente su `/account` e `/support`. Non ne ho tracciato l'origine.

9. **Il worker API (`api.adoff.app`)** e il flusso di checkout Stripe sono fuori dal perimetro «sito» e non sono stati toccati.

10. **`FAILED_APPROACHES.md` non esiste** in `.claude/`. `PROGRESS.md` documenta alle righe 110-114 e 146 che nav e footer *erano* stati resi language-aware con `data-i18n` nella sessione del 2026-04-21: lo stato attuale è quindi una **regressione** rispetto a un lavoro già fatto, non una funzionalità mai implementata. Nessun approccio fallito documentato da evitare.

---

## Nota a margine — divergenza documentale

`CLAUDE.md` (sezione *Pricing*) dichiara **«Trial: 30gg gratis Pro»**. La verità del codice è 15 giorni (`app/src/background.js:13`, `TRIAL_DAYS = 15`), coerente con `site/data/constants.json` (`trial_days: 15`) e con il commit `b822897` *"trial 15gg"*. Ho usato 15 come riferimento per B15. Anche `CLAUDE.md` va aggiornato, altrimenti la prossima sessione ripristinerà il claim sbagliato.
