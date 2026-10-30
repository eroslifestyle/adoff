# Pipeline cluster streaming — README operativo

*Creato il 2026-09-21. Si rivolge a chi riprende questa pipeline fra settimane senza ricordarsene nulla: un altro agente o l'autore stesso. Deve poter capire cosa fa, lanciarla, riprenderla dopo un'interruzione, e sapere dove si rompe.*

## Cosa produce

Un cluster di 24 pagine SEO sul tema streaming/video ad blocking, ciascuna in 15 lingue (italiano e inglese come sorgenti, più 13 tradotte: de, es, fr, pt, ru, ja, zh, ko, tr, pl, id, ar, hi), pubblicate su adoff.app. I sorgenti sono JSON in `sviluppo/seo-tools/streaming-cluster/content/` con nome `<slug>.<lang>.json`. Le pagine HTML finali stanno in `site/`: l'inglese in root (`site/<slug>.html`), le altre lingue in `site/<lang>/<slug>.html`. Il target completo è 360 file JSON (24 slug × 15 lingue).

## Gli strumenti, nell'ordine in cui girano

**`sviluppo/seo-tools/translate_cluster.py`** — traduce i sorgenti en/it nelle altre lingue tramite LLM locale (chiave letta da `~/.claude/secrets/local-llm.env`). È resume-safe: per ogni coppia slug/lingua controlla se `content/<slug>.<lang>.json` esiste ed è valido e in tal caso lo salta, quindi riprendere significa semplicemente rilanciare. Traduce per unità (titoli, sezioni, FAQ separate), mai il JSON intero. Flag reali: `--langs` (lista separata da virgole, default tutte), `--slugs`, `--model`, `--dry-run`, `--limit N`, `--selfcheck`. La lista degli slug deriva dal glob `CONTENT.glob("*.en.json")` (riga 560).

**`sviluppo/seo-tools/repair_cluster_lengths.py`** — riparazione deterministica delle lunghezze, senza LLM. Corregge answer/description/title oltre i limiti per lingua (limiti dedicati per CJK) tagliando a confine di frase o di parola. Concurrency-safe: salta i file non ancora JSON validi. Flag: `--dry-run`, `--verbose`, `--selfcheck`. I casi in cui è intervenuta finiscono in `streaming-cluster/REVIEW-NEEDED.md`.

**`sviluppo/seo-tools/bake_streaming_cluster.py`** — bake meccanico: legge i template `site/youtube-ad-blocker.html` (en) e `site/it/youtube-ad-blocker.html` (it), ne estrae verbatim le parti invarianti (CSS, preload, script) e le ricombina col JSON per produrre tutte le pagine. Rigetta i fuori-limite residui. Flag: `--dry-run`, `--only SLUG`, `--selfcheck`. A fine esecuzione stampa la sezione `ERRORI (n)`.

**`sviluppo/scripts/audit/gen_sitemap.py`** — rigenera la sitemap del sito.

**`sviluppo/seo-tools/finalize_cluster.sh`** — l'orchestratore. Attende la fine dei `translate_cluster.py` (poll ogni 120 s, timeout 20 ore), ritenta i falliti fino a 2 passate (si ferma se una passata non produce file nuovi), lancia repair, bake, sitemap, fa commit (mai push: origin divergente), esegue il deploy solo se il bake segnala zero errori, e verifica nel log di deploy la presenza di `Compiled Worker successfully` e `Uploading Functions bundle`. È idempotente. Log su `streaming-cluster/finalize.log`.

**`sviluppo/seo-tools/watch_batch.sh`** — osservatore passivo (descritto sotto). Non fa parte della catena: lo si lancia a fianco per vedere come va.

## Come si lancia e come si riprende

La pipeline è pensata per girare a lungo e sopravvivere alle interruzioni. I worker di traduzione si lanciano in parallelo, uno per gruppo di lingue, con `python3 sviluppo/seo-tools/translate_cluster.py --langs de,es,fr,...`; due o più worker su gruppi di lingue disgiunti non si contendono gli stessi file. Riprendere dopo un crash o un'interruzione significa rilanciare lo stesso comando: i file già prodotti e validi vengono saltati. Quando tutti i worker hanno finito, `finalize_cluster.sh` porta a termine il resto (retry, repair, bake, sitemap, commit, deploy, verifica).

Il deploy del sito va eseguito **da dentro `site/`**:

```
cd site/ && npx wrangler pages deploy . --project-name adoff-site
```

Il perché è critico: lanciato dalla project root, wrangler non compila `site/functions/` — il deploy sembra andato a buon fine perché il sito si aggiorna normalmente, ma in produzione i path gestiti dalle Functions danno 404 senza che nulla lo segnali. Così si ri-rompe il redirect referral `/r/CODICE` (Function in `site/functions/r/[code].js`). Da dentro `site/`, wrangler compila e uploada il bundle Functions; `finalize_cluster.sh` verifica proprio quelle due righe nel log di deploy e segnala "SOSPETTO" se mancano.

## I punti fragili

**Il modello di traduzione reintroduce entità rimosse.** Caso reale del 2026-09-20/21: dopo aver eliminato lo slug `netflix-ad-blocker`, due traduzioni scritte DOPO il commit di rimozione contenevano di nuovo quel brand, con in più una FAQ inventata e un link verso lo slug ormai inesistente — mentre i sorgenti inglesi erano puliti. Ripulire il sorgente non basta: serve il controllo in validazione, perché il traduttore può ricreare dal contesto ciò che hai tolto.

**La validazione deve coprire tutti i campi generati.** La funzione `validate()` di `translate_cluster.py` applica la lista `FORBIDDEN` (che include "netflix", "100%", "guaranteed", "garantito", "garantisce") a diversi campi. Fino al commit `c552b847` NON copriva i campi `q`/`a` delle FAQ — ed è esattamente lì che l'invenzione del caso precedente si era annidata. Lezione: quando aggiungi un campo generato al formato JSON, aggiungilo anche alla validazione.

**Modificare gli script mentre la pipeline gira.** Modificare un `.py` è sicuro in sé: ogni worker lo invoca come processo nuovo e prende il codice aggiornato. Ma i processi GIÀ in esecuzione mantengono in memoria il codice vecchio: un fix alla validazione non si applica retroattivamente ai worker vivi, quindi dopo un fix va ricontrollato tutto ciò che è stato prodotto nel frattempo. Modificare `finalize_cluster.sh` mentre gira è invece pericoloso: bash legge gli script incrementalmente e può eseguire metà riga vecchia e metà nuova.

**Eliminare uno slug.** Va rimosso PRIMA il sorgente `.en.json` (e il `.it.json`), perché la lista degli slug deriva dal glob dei file `.en.json`: cancellare solo le traduzioni le farebbe semplicemente rigenerare alla prossima esecuzione.

**Il gate di deploy dipende dal formato di stampa del bake.** `finalize_cluster.sh` estrae il numero di errori con `grep -oP 'ERRORI \(\K[0-9]+'` sull'output del bake (riga 84). Se cambia il formato di quella riga in `bake_streaming_cluster.py`, il grep non matcha più, `bake_errors` vale 0 per default, e il gate smette di proteggere in silenzio: nessun errore apparente, deploy comunque eseguito. Se tocchi la stampa del bake, tocca anche quel grep.

**Trovare i processi della pipeline.** Si legge `/proc/<pid>/cmdline` (come fa `watch_batch.sh`). Non usare `pkill -f translate_cluster.py`: matcherebbe anche la shell (o l'agente) che lo ha lanciato e la ucciderebbe.

## L'osservatore: watch_batch.sh

Aggiunto il 2026-09-21. È passivo e di sola lettura: l'unico file che scrive è `streaming-cluster/progress.log`. Ogni minuto scrive una riga con il conteggio file su target 360, il delta, il ritmo come media mobile sugli ultimi delta, i file mancanti e l'ETA. Ogni cinque giri esegue i controlli qualità: termini vietati ("netflix", uscita se più di 5 file contaminati), JSON malformati (uscita immediata, bloccante per il bake), residui di prompt LLM nel testo, copertura per lingua, righe FAIL nei `worker-*.log` e in `finalize.log`, worker vivi con le loro lingue (letti da `/proc`, mai `pgrep`). Va lanciato staccato dalla shell dell'agente, altrimenti muore con essa:
`nohup setsid bash sviluppo/seo-tools/watch_batch.sh >/dev/null 2>&1 &`.

Esce quando vede `RIEPILOGO FINALE` in `finalize.log` (batch concluso), quando muoiono tutti i processi della pipeline, per stallo di 25 minuti senza file nuovi, o subito su problema bloccante. A ogni uscita scrive un riepilogo finale con copertura e conteggi.

## Quanti worker

Misura del 2026-09-21 su un campione di 19 pagine: i secondi mediani per singola chiamata LLM restano intorno a 9 sia con 2 sia con 4 worker attivi (9,52 e 9,60), mentre con un worker solo scendono a 6,70. Un costo per chiamata costante al crescere della concorrenza indica che il server di inferenza fa batching continuo: parallelizzare è quindi un guadagno quasi lineare, e un worker solo renderebbe circa un terzo. Limite onesto della misura: due sole pagine nei casi a 1 e 2 worker, quindi solido solo il tratto 3-4 worker. Oltre i 4-5 worker il throughput satura: il batching aiuta finché ci sono slot liberi sul server.

## Vincoli editoriali (in ogni lingua)

Mai promettere blocco garantito o totale della pubblicità — la lista `FORBIDDEN` del traduttore lo verifica, ma anche la scrittura manuale deve rispettarlo. Niente menzioni del brand Netflix nelle pagine SEO; le occorrenze in `app/` sono domini funzionali del blocking (URL filter rules) e non si toccano. Mai esporre l'handle GitHub personale: le segnalazioni passano da `https://adoff.app/r/issues/new`.

## Dove guardare quando qualcosa va storto

`streaming-cluster/finalize.log` per l'esito complessivo della catena (retry, bake, deploy, verifica Functions). `progress.log` per ritmo, ETA ed esiti dei controlli qualità. `worker-*.log` per i fallimenti di singole pagine. `REVIEW-NEEDED.md` per i casi in cui la riparazione deterministica delle lunghezze ha dovuto intervenire.
