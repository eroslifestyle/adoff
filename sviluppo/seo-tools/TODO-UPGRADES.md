# TODO — Upgrade pipeline SEO/AEO

> Stato al 2026-09-13. Base: commit `7d192f86` (`feat(seo): riepilogo AEO/keyword settimanale su ogni run`).
> Dati del primo run completo: health 100/100, 0 finding, **AEO 0/25 (campione pieno, 0 errori)**, 580 keyword, **80 gap**, query di punta `adoff` (6 click / 38 impression).

## P1 — Il problema di business (la visibilita' AEO e' a zero)

- [ ] **AEO 0/25: invisibili nel retrieval, non "poco citabili".** Diagnosi CHIUSA con campione pieno il 2026-09-13: 25 query, **0 errori**, 0 retrieval vuoti, e `retrieval_hit=False` su **25 su 25**. Non e' un artefatto di misura ne' un problema di formato: adoff.app non compare proprio fra i risultati da cui gli assistenti pescano. **Conseguenza operativa: schema markup, FAQ strutturate e ottimizzazioni di "citabilita'" sono inutili adesso** — ottimizzerebbero una pagina che nessuno recupera. Serve prima esistere nel retrieval.
- [ ] **La superficie di citazione sono i siti editoriali, non i concorrenti.** Chi viene citato al posto nostro sulle 25 query: adblockplus.org (11x), adguard.com (6x), chromewebstore.google.com (6x), getadblock.com (5x), **allaboutcookies.org (5x)**, ghostery.com (4x), **pcmag.com (3x)**, adlock.com (2x). I due in grassetto non sono ad blocker: sono recensioni/listicle. Essere incluso in quelle comparazioni e' la via piu' diretta alla citazione, ed e' un lavoro di PR/outreach, non di codice.
- [ ] **Presidiare la Chrome Web Store come canale di citazione.** `chromewebstore.google.com` compare 6 volte su 25: gli assistenti citano la scheda store, non il sito. Verificare che la scheda AdOff sia ottimizzata per le query dove lo store viene citato (titolo, descrizione, keyword) — e' un canale gia' esistente e gratuito.
- [ ] **80 keyword senza una pagina che risponda.** Sono il bacino di crescita organica. Oggi il report le elenca grezze cosi' come escono da Google Autocomplete (`ad blocker add on`, `ad blocker adguard`, ...): vanno raggruppate per intento e filtrate, altrimenti "prossime guide da scrivere" resta una lista inutilizzabile.
- [ ] **Nessun contenuto viene mai prodotto.** La pipeline misura e ripara il sito esistente, ma non scrive le guide che colmerebbero i gap. Valutare una fase di drafting (anche solo bozze in `site/` da rivedere a mano) — oggi il collo di bottiglia e' umano.

## P2 — Buchi nella misurazione

- [ ] **Indicizzazione non misurata.** `gsc_query.py` espone solo `clicks`/`impressions`/`ctr`/`position`; non sa quante pagine sono indicizzate o escluse, perche' servirebbe l'API **URL Inspection** di Search Console (non ancora usata). Senza quel dato non sappiamo se il problema e' che non ci indicizzano o che non ci cliccano.
- [ ] **`authority_signals.py` gira ma non lo legge nessuno.** Produce `.state/authority_report.json` (menzioni offsite, `todoCount`, target) e ora viene invocato dal run settimanale, ma il riepilogo Telegram lo ignora. Aggiungere una riga sulle menzioni offsite: e' il segnale che spiega la visibilita' AEO.
- [x] ~~Solo 6 query sondate per l'AEO.~~ FATTO 2026-09-13: campione configurabile via `AEO_QUERIES` (default 25), errori di rete ora distinti dalle non-citazioni (`errorCount`), test di regressione in `sviluppo/tests/test-aeo-error-vs-empty.py`.
- [ ] **Un solo backend AEO.** Oggi gira `local` (DuckDuckGo + `fast-max` locale). `aeo_probe.py` supporta anche `claude` e `perplexity`: misurare su piu' assistenti darebbe un quadro reale di chi cita e chi no (come nel formato di riferimento, che distingue per assistente). Attenzione: `perplexity` richiede `PERPLEXITY_API_KEY` ed e' a pagamento.
- [ ] **Nessun trend settimana-su-settimana.** Ogni run e' una fotografia isolata: health, AEO, gap non vengono confrontati col run precedente. Storicizzare i valori chiave e mostrare le variazioni (`0/6 -> 2/6`) renderebbe il report azionabile invece che descrittivo.

## P3 — Robustezza e debito tecnico

- [ ] **L'invio Telegram non e' verificato davvero.** `tg_send` considera riuscito qualunque `http=200` dal worker `api.adoff.app/admin/notify`; se poi Telegram rifiuta il messaggio (parsing Markdown, lunghezza), l'errore vive solo nei log del worker Cloudflare e qui non lo vediamo. Propagare l'esito reale di Telegram nella risposta del worker.
- [ ] **`origin/main` resta disconnesso.** Lo script committa in locale e non pusha piu' (fix del 2026-09-13): `origin/main` e' uno snapshot sanificato a 1 commit orfano, senza antenato comune col main locale. Decisione ancora aperta: tenerlo come sola vetrina pubblica o riallineare. Finche' non e' decisa, la storia reale vive solo su questa macchina — **non c'e' copia remota del lavoro**.
- [ ] **`gsc_query.py`: cleanup non signal-safe.** Il JSON temporaneo in `/dev/shm` viene rimosso con `atexit`, che non scatta su SIGTERM/SIGKILL, e il filename e' fisso (race tra run concorrenti). Rischio basso (file 0600, sparisce al reboot), ma va sistemato con un `trap` e un nome univoco.
- [ ] **Preflight ristretto a `site/`.** Ora il run non e' piu' bloccato da lavoro non committato altrove. Verificare nel tempo che il cambio di branch della fase 3 non trascini modifiche non committate di `sviluppo/` (finora non e' successo, ma non e' garantito per costruzione).
- [ ] **Il backup di `site/` non viene mai ruotato.** Ogni run crea un backup da ~7,5 MB; nessuna pulizia automatica. Verificare la crescita e aggiungere una retention.

## Fatto (2026-09-13)

- [x] Preflight non blocca piu' il run per file sporchi fuori da `site/`.
- [x] Il riepilogo settimanale viene prodotto **su ogni percorso di uscita**, anche con 0 finding (prima non usciva mai nel caso piu' comune).
- [x] `aeo_probe.py`, `keyword_research.py`, `authority_signals.py` ora sono invocati dal run settimanale (prima mai: report fermi a giugno/luglio).
- [x] Il riepilogo usa i contatori del run corrente, non piu' i `verify.json` stantii del run precedente.
- [x] Il contenuto del riepilogo viene scritto nel log anche nei run reali (prima solo in dry-run).
- [x] Deploy sganciato dal push su `origin/main`, che falliva per costruzione e bloccava la pubblicazione ogni settimana.
- [x] Campione AEO configurabile (`AEO_QUERIES`, default 25) e piu' gentile col rate-limit (sleep 1.5s, 3 retry con backoff).
- [x] Gli errori di retrieval non vengono piu' contati come "non citazioni": `errorCount` nel JSON e `(+N in errore)` nel report. Senza questo, un "0/25" da throttling sarebbe stato indistinguibile da un'assenza reale.
