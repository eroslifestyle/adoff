---
name: piano-free-per-tutti-aggiornamento-2026-08-20
description: Aggiornamento del piano operativo PIANO-FREE-PER-TUTTI con i risultati del rifacimento messaggio, pulizia SEO, rimozione VPN, traduzioni 15 lingue e comunicazione (non ancora pubblicati)
updated: 2026-08-20
metadata:
  type: project
---

# Piano Free per Tutti — Aggiornamento 2026-08-20

File: `/mnt/backup/Dropbox/1 Programmazione/Progetti/ChromePlugin/sviluppo/PIANO-FREE-PER-TUTTI.md`

Aggiornamento della sezione "Piano operativo" (punti 3-7) del piano. I punti 1-2 restano invariati.

**Why:** Il piano "free per tutti" richiede un rifacimento del messaggio, non dell'impianto tecnico, per non perdere hreflang, JSON-LD, critical CSS e accessibilità già fatti.

**How to apply:** Sostituire i punti 3-7 della sezione "Piano operativo" con il testo esatto sotto; mantenere l'indentazione a 3 spazi per le righe di continuazione.

## Piano operativo

3. [x] **Nuovo sito, nucleo** (fatto 2026-08-20, commit `8fcc071` + `0e3dddf`): home, listino,
   installazione, guida, supporto, privacy e termini riscritti col messaggio nuovo — titolo
   "Blocca la pubblicita', gratis", sottotitolo "Video senza interruzioni", formula
   "gratis, senza account e senza limiti". Le tre card dei piani diventano una sola
   "Tutto incluso". Ripuliti anche i dati strutturati: un prezzo stantio nel JSON-LD
   finisce nei risultati di ricerca. Termini e privacy trattati come documenti legali:
   riscritte solo le clausole su piani, trial e rimborso; la privacy ora dichiara il
   trattamento della newsletter.
   Scelta dichiarata: e' stato rifatto il MESSAGGIO, non l'impianto tecnico — rifare
   l'HTML da zero avrebbe buttato hreflang, JSON-LD, critical CSS e il lavoro di
   accessibilita' gia' fatti.
4. [x] **Pagine SEO e `vs/`** (fatto 2026-08-20, commit `b1d04e8`): erano 146 pagine con 527
   claim obsoleti, ora zero su 561 pagine. Nessun URL cambiato, nessuna pagina archiviata.
   Nelle pagine di confronto il prezzo dei CONCORRENTI resta intatto: e' un fatto su di
   loro, e ora e' il nostro vantaggio.
5. [x] **Rimozione VPN** (fatto 2026-08-20, commit `d1de281`): nove pagine spostate in
   `sviluppo/archive/site-vpn-pages/` con `git mv`, ognuna con il suo redirect 301 in
   `site/_redirects` (con e senza `.html`). Tolti menu, footer, listino, indici e sitemap.
   `android.html` NON toccato: li' "VPN" indica il meccanismo di sistema per il DNS.
6. [~] **15 lingue** (in corso, commit `c203384`): tradotte davvero tedesco, francese,
   spagnolo, portoghese, russo, polacco, cinese, giapponese, coreano e arabo. Ogni file
   verificato controllando l'ALFABETO, non il report: 96-99% delle stringhe lunghe usa lo
   script giusto. L'hindi e' stato scartato e rifatto perche' conteneva testo italiano.
   **Restano da completare hindi, turco e indonesiano**: finche' non sono pronte quelle
   lingue mostrano il testo inglese, che il fallback di `t()` serve correttamente.
7. [~] **Comunicazione e pubblicazione**: i testi sono pronti in
   `sviluppo/COMUNICAZIONE-SOSTENITORI.md` (email IT/EN firmate da Eros in prima persona,
   post Telegram in inglese, risposta per il supporto, checklist operativa). Versione
   bumpata a **3.6.0** con l'avviso nel popup che raggiunge tutti gli utenti (commit
   `b31d629`), pacchetti ricostruiti (commit `13f5f61`), disdetta resa funzionante e
   visibile nell'area account (commit `9395789`).
   **NULLA E' STATO PUBBLICATO NE' INVIATO**: sito, store e comunicazione aspettano la
   conferma dell'utente dal browser reale. Il worker va deployato perche' la disdetta e
   la newsletter funzionino.

## Decisioni chiave

- Rifare il MESSAGGIO, non l'impianto tecnico del sito (preserva hreflang, JSON-LD, critical CSS, accessibilità).
- Nessun URL cambiato nelle pagine SEO/`vs/`; nessuna pagina archiviata.
- Prezzo dei concorrenti nelle pagine di confronto lasciato intatto (dato fattuale su di loro).
- 15 lingue target: 10 complete, 3 ancora da completare (hindi, turco, indonesiano); hindi scartato e rifatto perché conteneva testo italiano.

## Contraddizioni / fallimenti

- Hindi prima passata: conteneva testo italiano → scartata e rifatta.
- 96-99% delle stringhe lunghe usa lo script giusto (non 100%): verificato controllando l'ALFABETO, non il report.
- Pagina `android.html`: "VPN" intoccata perché indica il meccanismo DNS di sistema.

## Entità / file / commit rilevati

- File aggiornato: `/mnt/backup/Dropbox/1 Programmazione/Progetti/ChromePlugin/sviluppo/PIANO-FREE-PER-TUTTI.md`
- Archivio pagine VPN: `sviluppo/archive/site-vpn-pages/`
- Redirect: `site/_redirects`
- Comunicazione: `sviluppo/COMUNICAZIONE-SOSTENITORI.md`
- Commit: `8fcc071`, `0e3dddf`, `b1d04e8`, `d1de281`, `c203384`, `b31d629`, `13f5f61`, `9395789`
- Versione plugin: 3.6.0

## Stato pubblicazione

- **Nulla è stato pubblicato né inviato.** Tutto (sito, store, comunicazione) aspetta conferma dell'utente dal browser reale.
- Worker ancora da deployare: senza, disdetta e newsletter non funzionano.
