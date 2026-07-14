# AdOff — Privacy (developer statement)

> Documento tecnico per il repository. La privacy policy legale pubblica per
> gli utenti è su https://adoff.app/privacy (questo file ne è il complemento
> tecnico, allineato ma non sostitutivo).

## Principio: zero-log, tutto on-device

AdOff è un ad blocker che opera **interamente sul dispositivo dell'utente**.
Nessun dato di navigazione lascia il browser.

## Cosa AdOff NON fa

- **Non** raccoglie cronologia di navigazione.
- **Non** invia telemetria sui siti visitati.
- **Non** usa analytics di terze parti dentro l'estensione.
- **Non** vende, affitta o condivide dati personali.
- **Non** applica "acceptable ads" a pagamento.

## Cosa viene salvato (solo in locale, `chrome.storage.local`)

Impostazioni e contatori dell'utente, con prefisso `adoff*`: stato on/off,
whitelist siti, contatori ads bloccati, dati trial/licenza, lingua,
referral, milestone. Restano sul dispositivo.

## Perché AdOff chiede "accesso ai dati su tutti i siti"

Un ad blocker **deve** poter leggere la pagina per individuare e rimuovere
gli annunci e applicare i filtri cosmetici. Questo avviene **localmente**:
la lettura serve al blocking in-page, **nessun contenuto della pagina viene
trasmesso** ai server AdOff. Il codice del core è ispezionabile proprio per
dimostrarlo (vedi [OPEN-CORE-MODEL.md](OPEN-CORE-MODEL.md)).

## Comunicazioni di rete (le uniche)

- **Validazione licenza Pro**: l'estensione contatta il license server
  (`api.adoff.app`) per validare la chiave. Vengono trasmessi solo i dati
  minimi necessari alla validazione (chiave/licenza, identificativo device
  derivato), **mai** la cronologia o il contenuto delle pagine.
- **Suggerimenti/segnalazioni**: inviati solo quando l'utente compila e invia
  esplicitamente il form (con protezione anti-bot). Contengono ciò che
  l'utente scrive + user agent + versione.

## Dati sensibili nel codice client

Nessun segreto (chiavi private, token, endpoint privati) è incluso nel codice
client. La validazione crittografica delle licenze è firmata e verificata
**lato server**; il client esegue solo controlli pubblici.

## GDPR & dichiarazioni store

- **Base legale**: l'unico trattamento di dati personali è la validazione della
  licenza Pro (chiave + email + device id derivato), su **esecuzione del
  contratto** (art. 6.1.b GDPR). Nessun consenso a marketing richiesto per usare
  l'estensione. Titolare nell'Unione Europea; contatto solo via form anti-bot.
- **Nessuna raccolta dati di navigazione** → ai fini AMO il manifest Firefox
  dichiara `browser_specific_settings.gecko.data_collection_permissions.required
  = ["none"]` (mandato AMO nov 2025). Coerente con la Zero-Log Policy.
- **Permesso "all sites"**: necessario al blocking in-page, mai usato per
  trasmettere contenuto delle pagine. Il codice ispezionabile lo dimostra.
- **GDPR by design come leva**: la trasparenza (zero-log + codice ispezionabile +
  privacy policy chiara) è il vero vantaggio competitivo della categoria, non
  l'offuscamento.

_Ultimo aggiornamento: 2026-06-02._
