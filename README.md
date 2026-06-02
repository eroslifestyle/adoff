<div align="center">

# AdOff — Ads? Off!

**Universal, privacy-first ad blocker — open core, inspectable.**
**Ad blocker universale e privacy-first — core open e ispezionabile.**

[adoff.app](https://adoff.app) · [Privacy](PRIVACY.md) · [Open Core model](OPEN-CORE-MODEL.md) · [Security](SECURITY.md) · [License](LICENSE)

</div>

---

## 🇮🇹 Italiano

**AdOff** è un'estensione browser (Manifest V3) che blocca la pubblicità su tutti
i siti, restando invisibile ai sistemi anti-adblock. Funziona su Chrome, Firefox,
Safari, Edge e Opera. Sito ufficiale e download: **[adoff.app](https://adoff.app)**.

### Perché questo repository è pubblico

Un ad blocker è JavaScript che gira **sul tuo dispositivo** e ti chiede un permesso
forte ("accesso ai dati su tutti i siti"). Per un prodotto del genere, **la fiducia
si dimostra col codice**, non si chiede. Qui trovi il **core ispezionabile**: il
motore di blocco, le regole di filtro e tutto ciò che tocca i tuoi dati. Quello che
ci permette di guadagnare — il **license server** e l'integrazione pagamenti —
resta privato, perché è la nostra protezione, non un dato dell'utente.

> Principio: **pubblico ciò che tocca i tuoi dati; privato ciò che fa guadagnare.**
> Dettagli completi: **[OPEN-CORE-MODEL.md](OPEN-CORE-MODEL.md)**.

### I nostri 3 impegni

1. **Zero log.** Nessun dato di navigazione lascia il tuo browser. Filtraggio
   interamente on-device. → [PRIVACY.md](PRIVACY.md)
2. **No "acceptable ads" a pagamento.** Non vendiamo whitelist agli inserzionisti.
3. **Dalla parte dell'utente.** Il permesso "tutti i siti" serve solo a rimuovere
   gli annunci in-page; il codice ispezionabile lo dimostra.

### Cosa c'è in questo repo

| Cartella | Contenuto |
|---|---|
| `app/` | Estensione Chrome / Edge / Opera (MV3, `service_worker`) |
| `app-firefox/` | Estensione Firefox (MV3, `background.scripts` + gecko) |
| `app-safari/` | Estensione Safari (MV3, min 16.4) |
| `*/rules/adblock-rules.json` | Regole `declarativeNetRequest` (network blocking) |
| `*/src/` | Service worker, content script, CSS cosmetico, popup, opzioni, i18n |

### Come ispezionare ed eseguire il core

Il core è **JavaScript leggibile**: nessun passo di build è necessario per
leggerlo o provarlo.

- **Chrome / Edge / Opera** → `chrome://extensions` → *Modalità sviluppatore* →
  *Carica estensione non pacchettizzata* → seleziona la cartella `app/`.
- **Firefox** → `about:debugging` → *Questo Firefox* → *Carica componente
  aggiuntivo temporaneo* → seleziona un file dentro `app-firefox/`.
- **Safari** → `xcrun safari-web-extension-converter app-safari/` (richiede
  macOS + Xcode), poi build/run da Xcode.

### Licenza

[**FSL-1.1-Apache-2.0**](LICENSE) (Functional Source License). Puoi leggere,
usare (anche in azienda), modificare e ridistribuire il codice; l'unica cosa
vietata è il **"Competing Use"** (offrire un prodotto/servizio commerciale
concorrente). Ogni versione diventa automaticamente **Apache 2.0** dopo 2 anni.

### Segnalare problemi

- **Vulnerabilità di sicurezza** → [SECURITY.md](SECURITY.md)
- **Sito non bloccato / bug** → tramite il form su [adoff.app](https://adoff.app)

### Founder

AdOff è costruito da **Eros**, indie developer, da Siracusa. La storia:
[adoff.app/chi-sono](https://adoff.app/chi-sono).

---

## 🇬🇧 English

**AdOff** is a Manifest V3 browser extension that blocks ads on every website while
staying invisible to anti-adblock systems. It runs on Chrome, Firefox, Safari, Edge
and Opera. Official site and downloads: **[adoff.app](https://adoff.app)**.

### Why this repository is public

An ad blocker is JavaScript running **on your device**, asking for a powerful
permission ("access your data on all sites"). For a product like that, **trust is
proven with code, not claimed**. Here you'll find the **inspectable core**: the
blocking engine, the filter rules, and everything that touches your data. What lets
us earn a living — the **license server** and payment integration — stays private,
because that's our protection, not your data.

> Principle: **public is what touches your data; private is what makes money.**
> Full details: **[OPEN-CORE-MODEL.md](OPEN-CORE-MODEL.md)**.

### Our 3 commitments

1. **Zero logs.** No browsing data leaves your browser. Filtering is fully
   on-device. → [PRIVACY.md](PRIVACY.md)
2. **No paid "acceptable ads".** We don't sell whitelists to advertisers.
3. **On the user's side.** The "all sites" permission only serves in-page ad
   removal; the inspectable code proves it.

### What's in this repo

| Folder | Contents |
|---|---|
| `app/` | Chrome / Edge / Opera extension (MV3, `service_worker`) |
| `app-firefox/` | Firefox extension (MV3, `background.scripts` + gecko) |
| `app-safari/` | Safari extension (MV3, min 16.4) |
| `*/rules/adblock-rules.json` | `declarativeNetRequest` rules (network blocking) |
| `*/src/` | Service worker, content script, cosmetic CSS, popup, options, i18n |

### How to inspect and run the core

The core is **readable JavaScript** — no build step is needed to read or try it.

- **Chrome / Edge / Opera** → `chrome://extensions` → *Developer mode* →
  *Load unpacked* → pick the `app/` folder.
- **Firefox** → `about:debugging` → *This Firefox* → *Load Temporary Add-on* →
  pick a file inside `app-firefox/`.
- **Safari** → `xcrun safari-web-extension-converter app-safari/` (requires
  macOS + Xcode), then build/run from Xcode.

### License

[**FSL-1.1-Apache-2.0**](LICENSE) (Functional Source License). You may read, use
(including at a company), modify and redistribute the code; the only thing
forbidden is **"Competing Use"** (offering a competing commercial product or
service). Every release automatically becomes **Apache 2.0** after 2 years.

### Reporting issues

- **Security vulnerabilities** → [SECURITY.md](SECURITY.md)
- **Site not blocked / bugs** → via the contact form at [adoff.app](https://adoff.app)

### Founder

AdOff is built by **Eros**, an indie developer, from Siracusa, Italy. The story:
[adoff.app/chi-sono](https://adoff.app/chi-sono).
