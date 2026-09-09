# AdOff ad-leak harness

Risponde (senza raccogliere dati dagli utenti) a: *su quali siti reali AdOff non blocca gli annunci, o viene rilevata come ad blocker?* Genera il dato direttamente invece di tracciare le persone.

## Come misura

- **Ad-leak (segnale primario, di rete)**: carica la pagina con AdOff attiva; una richiesta che matcha l'`urlFilter`/`regexFilter` di una regola `block` di `app/rules/adblock-rules.json` ma **completa con successo** = leak. Nel riepilogo ogni leak cita la regola che avrebbe dovuto scattare. Le regole di tracking escluse dal contatore (rule IDs 4,5,20-22,80-90,175-176,180-181,183,190-191,211) sono riportate ma marcate `[tracking, escluso dal conteggio]`.
- **Anti-adblock detection (flag separato)**: dopo il caricamento cerca overlay/banner visibili con formule multilingua ("ad blocker", "disattiva", "werbeblocker", "блокировщик", …). Non è mescolato col conteggio leak.
- **A/B (opzionale, `--ab`)**: rilegge lo stesso dominio in un contesto senza estensione, per distinguere "il sito non ha annunci" da "AdOff li ha bloccati".

## Uso

```bash
cd sviluppo/adleak-harness
node adleak.mjs                              # tutti i domini in domains.txt (default 20)
node adleak.mjs youtube.com repubblica.it    # solo alcuni domini
node adleak.mjs --ab                         # con confronto A/B no-extension
node adleak.mjs --domains lista-grande.txt --concurrency 4 --timeout-ms 60000
node adleak.mjs --no-extension example.com   # solo contesto pulito (controllo)
```

Requisiti: niente di nuovo. Usa Playwright già presente in `sviluppo/marketing/demo/node_modules` (syrmlink `node_modules`) e il Chromium già scaricato in `~/.cache/ms-playwright`. Gira **headless** (`headless: true`, niente display/xvfb necessario). Il lancio browser riprende il pattern di `sviluppo/marketing/demo/capture-demo.mjs`: `launchPersistentContext` + `--disable-extensions-except` + `--load-extension` sull'estensione reale di `app/`.

## Output

- JSON completo con timestamp in `results/adleak-<timestamp>.json`.
- Riepilogo a schermo: per dominio → stato HTTP, richieste totali, numero di leak (ads reali vs tracking-esclusi), regole coinvolte con esempi URL, eventuali banner anti-adblock, confronto A/B.
- Un sito in errore (DNS, timeout) viene registrato con la causa e **non ferma la corsa**; i domini falliti compaiono nel riepilogo e nel JSON.

## Limiti noti

- Il matching DNR è una reimplementazione fedele ma semplificata di declarativeNetRequest: copre `urlFilter` (ancore `||`, `|`, `^`, `*`), `regexFilter`, `initiatorDomains`/`excludedInitiatorDomains`, tipi di risorsa e l'unica regola `allow`. Non modella `priority` tra regole parzialmente sovrapposte né domini di initiator non-principali (iframe cross-origin come initiator).
- Il matching usa il dominio top-level come initiator: richieste partite da iframe di terze parti vengono attribuite al sito principale (falso positivo raro).
- La detection anti-adblock è euristica su testo visibile: può perdere banner in canvas/immagini o con formule non in lista.
- I siti con consenso cookie (Choices/Google) possono caricare meno ads finché il consenso non viene dato: l'A/B rende comunque confrontabili le due misure perché patisce lo stesso limite.
- Headless può essere rilevato da alcuni bot-detector; se un sito mostra comportamenti anomali, provare con `headless: false` in `adleak.mjs`.
