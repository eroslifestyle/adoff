# AdOff — Modello Open Core / Source-Available

> Questo documento spiega cosa è ispezionabile, cosa resta privato, e perché.
> Per una panoramica rapida del repository vedi il [README](README.md); la
> licenza è [FSL-1.1-Apache-2.0](LICENSE).

## In una riga

Il **core gratuito** di AdOff è ispezionabile; la **monetizzazione** è protetta
dal **license server privato** + dalla **cadenza di aggiornamento** + dalla
**licenza legale** ([FSL-1.1-Apache-2.0](LICENSE), source-available
anti-concorrenza), **non** dall'offuscamento del codice.

## La licenza in chiaro (FSL-1.1-Apache-2.0)

Chiunque può **leggere, usare (anche in azienda), modificare e ridistribuire**
il codice. L'unica cosa vietata è il **"Competing Use"**: offrire AdOff (o
qualcosa con funzionalità uguale/sostanzialmente simile) come **prodotto o
servizio commerciale concorrente**. Ogni versione diventa automaticamente
**Apache 2.0** (open source pieno, senza restrizioni) **dopo 2 anni** dal
rilascio. Abbiamo scelto FSL invece di PolyForm Noncommercial proprio per non
vietare l'uso business legittimo del prodotto: vogliamo bloccare i **cloni
commerciali**, non i clienti.

> ⚠️ Onestà intellettuale (dalla ricerca): per un'estensione browser la clausola
> Competing-Use è soprattutto un **deterrente + segnale di posizionamento**, non
> una barriera tecnica. Il JS gira leggibile sul dispositivo e gli store vietano
> l'offuscamento → il codice è comunque ispezionabile. La protezione reale contro
> i cloni è il **DMCA takedown allo store** (sostenuto da watermark + canary) e il
> **moat architetturale** (server + ritmo update), non la causa legale.

## Perché un ad blocker dovrebbe essere ispezionabile

Un'estensione browser è JavaScript che gira sul dispositivo dell'utente:
chiunque può scompattare il pacchetto (`.crx`/`.xpi`) e leggerne il codice.
Tenere il codice chiuso/offuscato **non** ferma i cloni (il codice è già
esposto) e in un prodotto che chiede permessi invasivi ("accedi ai dati su
tutti i siti") **fa perdere fiducia**. I prodotti credibili della categoria
(es. uBlock Origin) sono ispezionabili proprio per questo. Quindi:
trasformiamo l'ispezionabilità da costo a **leva di fiducia**.

## Cosa è ispezionabile (free core)

- **Network blocking** — `declarativeNetRequest` + `rules/adblock-rules.json`.
- **Cosmetic filtering** — `src/ads-hide.css` + `src/content.js`.
- **Service worker / background** — `src/background.js`.
- **UI** — popup, opzioni, onboarding, i18n.

La build pubblicata sul Chrome Web Store è **leggibile** (minify, niente
offuscamento) per policy CWS: di fatto il core è già pubblicamente
ispezionabile. Anche il download diretto dal sito è leggibile.

## Cosa resta privato (il vero fossato)

Il valore difendibile non è la segretezza del client, ma:

1. **License server** (deployato su `api.adoff.app`): logica di firma/validazione
   licenze, entitlement Pro, pagamenti. **Non** è incluso nel pacchetto
   dell'estensione né in questo repository.
2. **Ritmo di aggiornamento delle regole**: la cura continua (settimanale)
   contro anti-adblock e neutralizzazione video = il valore ricorrente reale.
3. **Brand, listing store con recensioni reali, mailing list, supporto.**

## Pro / Stealth / video neutralization

Sono feature a pagamento. Anche se il loro codice è leggibile (lo è già su
CWS), la **monetizzazione** è garantita dal license server + dalla licenza
legale, **non** dall'offuscamento. Un clone che copia il codice viola la
clausola Competing-Use (rivendita/prodotto concorrente vietati) e comunque non
ha accesso al license server né al ritmo di aggiornamento.

## Anti-clone (rilevare, non impedire)

Impedire la copia di JS che gira on-device è impossibile; quindi i cloni li
**rileviamo** e li facciamo **rimuovere**. Le build distribuite includono
marcatori tamper-evident che provano la provenienza, e monitoriamo
periodicamente store e repository pubblici alla ricerca di copie non
autorizzate. Un clone confermato porta a un **DMCA takedown allo store**
(Chrome/AMO/Edge rimuovono in giorni); la licenza FSL fornisce la
legittimazione, i marcatori la prova.

> I dettagli operativi del rilevamento restano privati, per ovvi motivi.

## Nessun segreto nel client

Per design, il codice client **non** contiene chiavi private, token o
endpoint privati. La validazione crittografica avviene lato server.

## Struttura repository (separazione core ↔ server)

Questo repository pubblico contiene **solo il core ispezionabile**:

```
app/ , app-firefox/ , app-safari/   → core ispezionabile (ciò che spedisci)
LICENSE                             → FSL-1.1-Apache-2.0
PRIVACY.md                          → statement privacy tecnico
OPEN-CORE-MODEL.md                  → questo documento
README.md , SECURITY.md             → panoramica + disclosure sicurezza
```

> Restano fuori per design — nel repo privato di sviluppo: il **license server**,
> il tooling **anti-clone**, gli script di build interni e qualsiasi credenziale.
