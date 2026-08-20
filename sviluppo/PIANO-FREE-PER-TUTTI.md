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
3. [ ] **Nuovo sito, nucleo**: home, installazione, guida, supporto, privacy, termini.
   Tono diretto, pubblico non esperto, zero gergo tecnico.
4. [ ] **Pagine SEO e `vs/`**: aggiornate al messaggio "gratis", stessi URL, nessuna perdita
   di posizionamento.
5. [ ] **Rimozione VPN**: pagine in `old/`, riferimenti tolti da nav, footer, pricing.
6. [ ] **15 lingue**: propagazione via `_matrix.json` quando i testi sono congelati.
7. [ ] **Comunicazione sostenitori** + pubblicazione coordinata sito ed estensione.

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
