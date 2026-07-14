# AdOff — Dossier Submission Benchmark Indipendenti (S-OPS-3)

> Obiettivo: ottenere uno **score oggettivo di terze parti** citabile in sito/blog/outreach
> (come fa uBlock Origin con i suoi benchmark). Riferimento: PIANO-OPERATIVO-COMPETITOR-2026 §2.3.
> Azione manuale del founder — qui checklist + materiali pronti.

## 1. Target benchmark (in ordine di priorità)

| # | Servizio | URL | Cosa misura | Azione | Submission |
|---|---|---|---|---|---|
| 1 | Ad Block Tester | https://adblock-tester.com/ | Score 0-100 su blocco ads/tracker/annoyance | Installare AdOff (Pro) → eseguire il test live → screenshot score | Self-service: il sito calcola lo score; nessun form. Per essere **listato** nella loro pagina "/ad-blockers/" inviare richiesta via contatto sito |
| 2 | Cover Your Tracks (EFF) | https://coveryourtracks.eff.org/ | Protezione fingerprinting/tracker | Eseguire con AdOff attivo → salvare report | Nessuna submission, solo evidenza citabile |
| 3 | d3ward toolz | https://d3ward.github.io/toolz/adblock.html | % blocco su lista ampia ad/tracker | Eseguire con AdOff → screenshot % | Nessuna submission, evidenza citabile (molto usato su Reddit) |
| 4 | Adblock Tester (CPM Star/legacy) | https://adblock-tester.com/ alt mirror | idem #1 | ridondanza | — |

> Priorità reale: **#1 (listing) + #3 (d3ward, citatissimo dalla community)**. #2 come bonus privacy.

## 2. Pre-check prima del test (per massimizzare lo score)

- [ ] Build STORE/SITE aggiornata installata (versione corrente dei `manifest.json`).
- [ ] Pro/Trial attivo (Stealth + video skip + cookie banner ON) — i benchmark testano anche annoyance/cosmetic.
- [ ] `adblock-rules.json` aggiornato (130+ regole) caricato correttamente.
- [ ] Nessuna whitelist/pausa attiva sul dominio di test.
- [ ] Browser pulito (no altre estensioni adblock attive che falsino il risultato).
- [ ] Ripetere su Chrome **e** Firefox (due score separati, entrambi citabili).

## 3. Evidenze da raccogliere (asset citabili)

- [ ] Screenshot full-page score #1 (Chrome) + #1 (Firefox).
- [ ] Screenshot % d3ward #3 (Chrome) + (Firefox).
- [ ] Screenshot EFF Cover Your Tracks (verdetto "strong protection").
- [ ] Salvare in `sviluppo/data-analisi/benchmark/AAAA-MM-GG/` con naming `adblock-tester-chrome.png` ecc.
- [ ] Annotare data + versione AdOff testata (per ripetibilità/changelog).

## 4. Submission per il listing (Ad Block Tester #1)

Email/form di contatto del sito. Bozza (brand AdOff, zero identità founder — coerente con
draft §3.2 PIANO-OPERATIVO):

> Oggetto: AdOff — richiesta inclusione nella lista ad blocker
>
> Salve, AdOff è un ad blocker Manifest V3 (Chrome/Edge/Brave/Firefox/Safari) con blocco
> universale + stealth anti-detection. Abbiamo eseguito il vostro test: score allegato
> (screenshot). Chiediamo l'inclusione di AdOff nella vostra pagina comparativa, con i
> dati che ritenete corretti dopo verifica indipendente. Sito: adoff.app — Team AdOff

## 5. Uso degli score (dopo raccolta)

- Inserire il numero in: blog cornerstone "honest ad blocker" (sezione prova), hero/pricing
  trust-strip (es. "Score X/100 — test indipendente"), pitch outreach Tier B/C/D.
- **Solo numeri reali misurati**, mai gonfiati (coerente con positioning trasparenza §1).
- Ripetere il benchmark a ogni release maggiore → trend citabile nel changelog/blog.

## 6. Stato

- [ ] Test eseguiti (founder)
- [ ] Evidenze archiviate in `sviluppo/data-analisi/benchmark/`
- [ ] Listing richiesto a Ad Block Tester
- [ ] Score integrato in sito/blog/outreach

*Creato 2026-05-17. Azione manuale: richiede installazione estensione + esecuzione test
nel browser (non automatizzabile lato repo).*
