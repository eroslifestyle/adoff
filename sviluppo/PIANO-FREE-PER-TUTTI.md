# Piano — AdOff gratuito per tutti (deciso 2026-08-19)

Documento operativo per la transizione a modello interamente gratuito.
Decisioni prese dall'utente in sessione di analisi (20 domande).

## Decisioni dell'utente (vincolanti)

1. **Tutto gratis per tutti**: ogni funzione Premium/Pro sbloccata, nessuna scadenza.
2. **Abbonati attuali → sostenitori**: continuano a pagare volontariamente, con badge dedicato.
   Serve comunicazione esplicita (non deve sembrare un raggiro) e disdetta immediata e visibile.
3. **Sito**: nucleo rifatto da zero + pagine SEO e `vs/` aggiornate al nuovo messaggio
   (NON archiviate: conservano il posizionamento organico costruito in mesi).
4. **Lingue**: tutte e 15. Precauzione concordata: testi scritti e validati in IT+EN,
   propagati alle altre 13 SOLO quando il messaggio e' congelato (via `site/i18n/_matrix.json`).
5. **Contatti**: newsletter semplice (con consenso GDPR) + rimando al canale Telegram.
6. **VPN**: rimossa dal sito; endpoint backend lasciati intatti; branch `feat/premium-vpn` congelato.
7. **Backend invariato**: si tocca solo il gate lato estensione.

## Raccomandazioni accettate (nessuna obiezione dell'utente)

- Sblocco via `adoffPlanTier()` che ritorna sempre `"premium"`: un solo punto, reversibile.
- Trial lasciato girare a vuoto e nascosto dalla UI (smontare la catena del token firmato
  sarebbe un rischio senza guadagno).
- Badge "Tutto attivo" in popup/opzioni invece di rimuovere i riferimenti al piano.
- Pulsante acquisto in `options.js:561` → diventa "Sostieni il progetto" (stesso endpoint
  `/checkout`, messaggio diverso), coerente con la scelta dei sostenitori.
- Founder Lifetime: badge distintivo mantenuto.
- Area account tenuta viva ma defilata finche' ci sono abbonamenti attivi.
- Concorrenti nominati solo nelle pagine `vs/`, mai in home.
- Messaggio: "Blocca la pubblicita', gratis" (titolo) + "Video senza interruzioni" (sottotitolo).
  Formula scelta: "gratis, senza account e senza limiti" — verificabile, non promette l'eternita'.
- Sito e sblocco pubblicati INSIEME: un sito che dice "gratis" mentre l'estensione chiede
  di pagare e' peggio di entrambe le situazioni attuali.

## Piano operativo

1. [x] **Archiviazione**: `site/` copiato in `site-old/` (626 file). Aggiunto a `.gitignore`:
   la storia completa resta nei commit git, la copia serve solo da consultazione rapida.
2. [x] **Sblocco estensione** (fatto 2026-08-20, commit `01a3c30` + `a7d487a`):
   `adoffPlanTier()` ritorna sempre `"premium"` in tutte e 18 le copie, e resta l'unico
   punto da cui passa la decisione — nessun gate e' stato ridotto a costante, cosi' per
   tornare indietro si tocca un posto solo. Aperti i gate che richiedevano anche una
   licenza valida (`background.js` regole IMA, `content.js` stealth/cosmetic,
   `license-client.js` `checkPro()` nel caso senza licenza). I rami sulla licenza
   manomessa restano invariati: li presidiano i test di sicurezza.
   Aggiunta `adoffSupporterKind()` (6 copie): distingue founder/sostenitore per il SOLO
   badge, non governa alcuna funzione. UI ripulita da countdown, scadenze e nomi di piano
   in popup, opzioni e onboarding; badge "Tutto attivo".
   `test-plan-tier-consistency.js` riscritto: presidia "ogni piano da' premium",
   633 asserzioni (erano 415), 6 mutazioni provate e tutte catturate.
   i18n: 6 chiavi nuove in IT ed EN; le altre 13 lingue al punto 6, quando i testi
   saranno congelati.
   **Punto aperto**: il sistema referral promette ancora "30 giorni di Pro" per ogni
   amico che paga. Che senso abbia ora che e' tutto gratuito e' una decisione di
   prodotto, non tecnica: non e' stato toccato.
3. [x] **Nuovo sito, nucleo** (fatto 2026-08-20, commit `8fcc071` + `0e3dddf`): home,
   listino, installazione, guida, supporto, privacy e termini riscritti col messaggio
   nuovo. Le tre card dei piani diventano una sola, "Tutto incluso". Ripuliti anche i dati
   strutturati: un prezzo stantio nel JSON-LD finisce nei risultati di ricerca. Termini e
   privacy trattati da documenti legali — riscritte solo le clausole su piani, trial e
   rimborso; la privacy ora dichiara il trattamento della newsletter.
   Scelta dichiarata: e' stato rifatto il MESSAGGIO, non l'impianto tecnico. Rifare l'HTML
   da zero avrebbe buttato hreflang, JSON-LD, critical CSS e l'accessibilita' gia' fatti.
4. [x] **Pagine SEO e `vs/`** (fatto 2026-08-20, commit `b1d04e8`): erano 146 pagine con
   527 claim obsoleti, ora zero su 561 pagine. Nessun URL cambiato, nessuna pagina
   archiviata. Nelle pagine di confronto il prezzo dei CONCORRENTI resta intatto: e' un
   fatto su di loro, e ora e' il nostro vantaggio.
5. [x] **Rimozione VPN** (fatto 2026-08-20, commit `d1de281`): nove pagine spostate in
   `sviluppo/archive/site-vpn-pages/` con `git mv`, ognuna con il suo redirect 301 in
   `site/_redirects`. Tolti menu, footer, listino, indici e sitemap. `android.html` NON
   toccato: li' "VPN" indica il meccanismo di sistema per il DNS, non il nostro prodotto.
6. [x] **15 lingue** (fatto 2026-08-20, commit `c203384` + `f8ee2dd` + `81e6f54`): tradotte
   tutte e tredici — tedesco, francese, spagnolo, portoghese, russo, polacco, cinese,
   giapponese, coreano, arabo, hindi, turco, indonesiano. Circa 8.200 celle di matrice.
   Ogni file accettato solo dopo aver verificato l'ALFABETO delle stringhe lunghe (93-99%),
   non il report dell'agente: e' cosi' che e' emerso un file "hindi" scritto in italiano,
   zero devanagari su 278 stringhe, scartato e rifatto.
   Trappola chiusa: le chiavi il cui testo INGLESE era cambiato restavano con la vecchia
   traduzione e nessun controllo le segnalava, perche' non risultavano "non tradotte".
7. [x] **Comunicazione sostenitori + pubblicazione** (fatto 2026-08-20): tutto pubblicato.
   - **Worker**: deployato (`e272c7bd`), tabella `newsletter` creata su `adoff-db`.
     Il primo deploy aveva ROTTO la produzione — 500 su ogni rotta, anche le
     preesistenti — per una guardia finita dentro `fetch` e replicata in 27 punti:
     `body` in TDZ. Rollback immediato, causa trovata con `wrangler dev --local`,
     rotte riscritte e rideployate. **Lezione: il worker si prova in locale PRIMA.**
   - **Store**: Chrome Web Store pubblicata (status OK), Edge submission accettata
     (202), Firefox AMO 3.6.0 caricata e in review. Su AMO il primo tentativo era
     riuscito nonostante l'errore nel polling: verificare lo stato prima di riprovare.
   - **Sito**: deployato, gate i18n superato, 396 file. Redirect VPN attivi
     (`/premium` → home, `/vs/nordvpn` → `/vs/`, `/vpn-policy` → `/privacy`).
   - **Comunicazione**: email inviate ai **4 sostenitori** via Resend (ognuna col suo
     id di consegna), post pubblicato su `@adoffapp` (message_id 133).
     Nota: Resend rifiuta le richieste da `urllib` di Python con errore Cloudflare
     1010 — va usato `curl`.

   Testi in `sviluppo/COMUNICAZIONE-SOSTENITORI.md`; sequenza in
   `sviluppo/scripts/pubblica-3.6.0.sh`. Storico:
   `sviluppo/COMUNICAZIONE-SOSTENITORI.md` (email IT/EN firmate da Eros in prima persona,
   post Telegram in inglese, risposta per il supporto, checklist operativa). Versione
   bumpata a **3.6.0** con l'avviso nel popup che raggiunge tutti gli utenti (`b31d629`),
   pacchetti ricostruiti (`13f5f61`), disdetta resa funzionante e visibile nell'area
   account (`9395789`).
   **NULLA E' STATO PUBBLICATO NE' INVIATO**: sito, store e comunicazione aspettano la
   conferma dell'utente dal browser reale. Il worker va deployato perche' disdetta e
   newsletter funzionino.

## Avvertenze messe agli atti

- **La gratuita' e' irreversibile nei fatti**: tecnicamente si torna indietro con una riga, ma
  chi ha ottenuto le funzioni gratis non tornera' a pagarle. Riattivare i limiti verrebbe
  letto come un tradimento. L'utente e' stato avvisato e ha confermato.
- Il punto 2 tocca il sistema licenze, cioe' l'area dove il 2026-08-19 sono stati trovati otto
  gate divergenti che lasciavano gli abbonati senza difese (fix 3.5.77). Stessa cautela,
  stessi test.

## Stato del prodotto al momento della decisione

Versione 3.5.84 pubblicata su Chrome Web Store, Firefox AMO, Edge (in review), adoff.app e
Telegram. Suite verde: ad-skip 7/7, quality-reload 96/96, security-invariants 95/95,
plan-tier 415 asserzioni, cold-load 8/8, license-integrity 4/4.

Punto aperto ereditato: gate Pro intermittente (1 fallimento su 4 nel banco). Diventa
irrilevante per gli utenti se tutto e' gratis, ma resta un difetto da capire.
Dettaglio in `.claude/checkpoints/CP_20260819_1230.md`.
