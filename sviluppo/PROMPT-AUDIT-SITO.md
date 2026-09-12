# PROMPT — Audit forense totale sito adoff.app

> Da incollare in una nuova chat. Creato 2026-07-29.

---

# MISSIONE: AUDIT FORENSE TOTALE DEL SITO adoff.app — trovare OGNI bug, riga per riga

## Contesto
Progetto: /mnt/backup/Dropbox/1 Programmazione/Progetti/ChromePlugin
Branch attuale: feat/premium-vpn (NON fare merge su main, NON deployare senza mio OK esplicito)
Sito: cartella `site/` → deployata su Cloudflare Pages, dominio https://adoff.app

Struttura reale verificata:
- 568 file .html totali in site/
- 40 HTML nella root site/ (IT canonico) + 15 cartelle lingua: it/ en/ de/ fr/ es/ pt/ ru/ ar/ zh/ tr/ pl/ hi/ ja/ ko/ id/ (20-28 HTML ciascuna)
- Sottocartelle: vs/ (14 HTML comparative), blog/, account/, about-data/, mgmt-9f4a/, data/, assets/, i18n/
- Script condivisi generati a RUNTIME: site/adoff-nav.js (menu+dropdown lingue, 21KB), site/adoff-footer.js, site/adoff-i18n.js, site/adoff-chat.js, site/affiliate-tracking.js
- i18n: site/i18n/{ar,de,en,es,fr,hi,id,it,ja,ko,pl,pt,ru,tr,zh}.json + _matrix.json (single source) + _same_ok.json
- Tool i18n: sviluppo/scripts/i18n_manager.py, prose_i18n.py, gen-lang-homepages.py, add-hreflang.py
- Deploy: sviluppo/scripts/deploy-site.sh (wrangler pages deploy site/ --project-name adoff-site)
- Numeri SSOT: site/data/constants.json

## Sintomi riportati dall'utente (da riprodurre e spiegare, non da assumere)
1. "Il sito non funziona" — comportamento generale rotto
2. NESSUN link del menu principale funziona / il menu non è allineato con la realtà (voci che puntano a pagine inesistenti, o pagine esistenti non raggiungibili)
3. Le lingue non funzionano su TUTTE le pagine (switcher lingua, testi non tradotti, chiavi mancanti, mix IT/EN)
4. Impressione generale: "è tutto confusionario"

## REGOLA D'ORO — zero allucinazioni
Ogni singolo bug che riporti DEVE avere:
- percorso file:riga esatto
- comando/URL di riproduzione con OUTPUT LETTERALE incollato (curl, grep, log console Playwright)
- distinzione netta tra "verificato sul LIVE (adoff.app)" e "verificato sui SORGENTI LOCALI"
Se non l'hai verificato, scrivi "(non verificato)". Mai dedurre. Mai dire "dovrebbe". Nessun bug inventato, nessun bug omesso.

## METODO — fasi obbligatorie, in ordine

### FASE 0 — Inventario e baseline
- Genera la mappa completa dei file: ogni .html locale → URL pubblico atteso (attenzione: il sito usa URL extensionless, verifica come Cloudflare Pages risolve /pagina vs /pagina.html vs /pagina/)
- Fetch del LIVE: scarica https://adoff.app/ e le pagine chiave, confronta con il sorgente locale. Il live è allineato all'ultimo deploy? (git log su site/ + data ultimo deploy)
- Verifica se esiste divergenza tra branch feat/premium-vpn e ciò che è pubblicato

### FASE 1 — AUDIT LINK (il sintomo #2)
- Estrai TUTTI gli href/src da tutti i 568 HTML + quelli generati dinamicamente in adoff-nav.js e adoff-footer.js (sono costruiti per concatenazione con variabili tipo `communityLink`, `guideLink`, `installLink`, `premiumLink`, `pricingLink`, `privacyLink`, `supportLink`, `vpnPolicyLink`, `'/' + lq`: risolvi la logica di costruzione per OGNI lingua, non solo IT)
- Per ciascun link: esiste il file locale corrispondente? risponde 200 sul live? redirect? 404?
- Casi da cercare esplicitamente: prefisso lingua sbagliato o doppio (/it/it/), link assoluti che rompono nella sottocartella lingua, ancore #features/#pricing verso sezioni che non esistono in quella pagina/lingua, trailing slash incoerenti, link a pagine cancellate/rinominate, link esterni morti
- Verifica coerenza voce-menu ↔ pagina reale: il menu promette qualcosa che la pagina non contiene?

### FASE 2 — AUDIT i18n (il sintomo #3)
- Come funziona la traduzione a runtime: leggi adoff-i18n.js e adoff-nav.js e documenta il meccanismo reale (fetch /i18n/{lang}.json? attributi data-i18n? localStorage? path-based?)
- Per OGNI lingua: chiavi presenti in _matrix.json/it.json ma MANCANTI nel file lingua → elenco completo
- Attributi data-i18n presenti negli HTML ma senza chiave corrispondente nel JSON (e viceversa: chiavi orfane)
- Testo IT/EN hardcoded nelle pagine delle altre lingue (stringhe non tradotte lasciate nel markup)
- Lo switcher lingua: dove porta realmente per ogni combinazione pagina×lingua? Rompe? Perde la pagina corrente e torna in home?
- Verifica caricamento file JSON: percorso relativo vs assoluto dalle sottocartelle (/i18n/xx.json fetchato da /de/pagina funziona?), 404 di rete, errori CORS/CSP
- Verifica `<html lang>`, dir="rtl" per ar, hreflang, canonical su tutte le pagine

### FASE 3 — ERRORI RUNTIME JS
- Apri con Playwright (chromium bundled + xvfb, NON channel:"chrome") un campione rappresentativo: home IT, home EN, 3 lingue diverse, 1 pagina vs/, 1 pagina blog/, install, guide, account, pricing/premium
- Cattura: console.error/warning, exception non gestite, richieste di rete fallite (4xx/5xx), script che non caricano, ordine di caricamento sbagliato, doppie inizializzazioni di nav/footer, race condition tra i18n e rendering nav
- Se il menu non funziona: isola la riga esatta in adoff-nav.js che lancia l'eccezione o produce l'href sbagliato

### FASE 4 — CONGRUENZA CONTENUTI (il "confusionario")
Confronta tutto il testo pubblicato con la realtà del prodotto (CLAUDE.md + site/data/constants.json + app/manifest.json):
- Versione estensione dichiarata vs manifest reale
- Prezzi: piano mensile/annuale/Founder/Lifetime, tier Premium+VPN — cerca prezzi vecchi o contraddittori tra pagine e tra lingue
- Durata trial (30 giorni?) — cerca "15" residui
- Numero regole di blocco (grep -c '"id"' app/rules/adblock-rules.json = N) vs claim nelle pagine
- Numero lingue, numero browser supportati, feature promesse ma inesistenti
- Contraddizioni tra pagine sorelle e tra la stessa pagina in lingue diverse
- Residui di vecchio design mescolati al nuovo (nav/footer legacy hardcoded in alcune pagine invece degli script condivisi)

### FASE 5 — SEO / INFRASTRUTTURA
- sitemap.xml: include pagine morte? esclude pagine vive?
- robots.txt, _headers, canonical duplicati/errati, hreflang reciproci mancanti, meta title/description vuoti o duplicati, OG/Twitter card rotte, immagini 404

### FASE 6 — RENDERING / CSS / A11y
- Tema light default + toggle dark: rotto su qualche pagina? FOUC? classi non applicate?
- Layout rotti, testo invisibile (colore inline residuo), overflow mobile, CSS 404
- Regressioni a11y sui punti già sistemati in passato

## OUTPUT RICHIESTO
Un unico file: `sviluppo/audit-reports/2026-07/REPORT-AUDIT-SITO-<YYYYMMDD>.md`, contenente:
1. **Executive summary** — le 5 cause radice che spiegano i 4 sintomi (non un elenco di sintomi: le CAUSE)
2. **Tabella bug completa**, ordinata per severità: `ID | Severità (P0 blocca il sito / P1 rompe una funzione / P2 incongruenza / P3 cosmetico) | Area | File:riga | Descrizione | Evidenza (output letterale) | Fix proposto`
3. **Matrice link**: ogni link del menu × ogni lingua → stato (OK / 404 / redirect / mismatch)
4. **Matrice i18n**: lingua × chiavi mancanti / stringhe non tradotte (numeri esatti + esempi)
5. **Piano di fix ordinato**: cosa fixare per primo, dipendenze tra fix, rischio di ogni fix
6. **Sezione "non verificato"**: cosa non sei riuscito a controllare e perché

## VINCOLI
- NON applicare fix durante l'audit. Prima consegna il report, poi aspetta la mia approvazione del piano.
- NON deployare nulla. NON toccare main. NON fare merge.
- Non fidarti dei report di sub-agenti/tool: rivalida nel main con output letterale prima di scriverlo nel report.
- Se un problema è già documentato in .claude/PROGRESS.md o FAILED_APPROACHES, dillo e non riproporre l'approccio fallito.
- Lavora in modo esaustivo: 568 pagine × 15 lingue. Non campionare la Fase 1 e la Fase 2 — quelle devono essere complete e automatizzate con script (mettili in sviluppo/scripts/audit/). Campiona solo la Fase 3 e la Fase 6, dichiarando il campione.
