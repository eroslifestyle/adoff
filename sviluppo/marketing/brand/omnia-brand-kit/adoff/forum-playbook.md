# AdOff — Forum & Discussion Playbook

> Audience qui = **tech/privacy-conscious**, NON il consumer dei social visual. Qui si può
> usare profondità tecnica (MV3, stealth, declarativeNetRequest, open-source) e privacy/zero-tracking.
> Regola d'oro: **value-first, mai brand in apertura, niente spam.** Il link arriva solo dopo valore reale.

## Regole di autonomia (da strategy.yaml)
- **Quora** → risposte **auto-pubblicabili** (più tollerante).
- **Reddit / Hacker News** → **SOLO umano** (rischio ban/reputazione). L'AI prepara bozze, tu pubblichi.
- **IndieHackers / Habr / V2EX** → AI fa bozze → tu pubblichi.
- **Commenti**: semplici = auto; complessi/delicati = umano.

## Canali, target e modalità

### Reddit (23 lingue) — SOLO umano
- **Subreddit target** (value-first, no brand in apertura): privacy, ad-blocking/streaming, cordcutting, browser, tech-help.
- **Modalità**:
  - Commenti utili su thread "le pub sullo streaming sono insopportabili / come bloccarle" → dai la soluzione tecnica, cita AdOff solo se pertinente e con contesto.
  - Post originali in sub di nicchia: taglio onesto, esperienza, niente toni markettari.
  - **AMA tecnico** occasionale (come funziona lo stealth anti-detection).
- **Do**: trasparenza ("sono il dev"), valore prima del link. **Don't**: drop-link, ripetere lo stesso messaggio, brand in title.

### Hacker News (en) — SOLO umano
- **Show HN** tecnico: MV3 + declarativeNetRequest + stealth IMA stub; perché gli altri vengono rilevati e AdOff no; open-source rules.
- Partecipare a thread privacy/adblock con commenti competenti.
- **Build-in-public**: metriche, scelte architetturali, lezioni.

### IndieHackers (en) — bozza → umano
- Build-in-public: numeri (install, retention), decisioni di prodotto, lezioni da founder.
- Tono onesto, niente hype.

### Quora (5 lingue) — AUTO
- Rispondere a domande: "come bloccare le pub sui video/streaming", "è legale?", "qual è il miglior modo per togliere le pub", "privacy nel browser".
- Risposta lunga e utile → menzione AdOff naturale a fine.
- Lingue prioritarie: IT, EN (poi ES/FR/DE).

### Habr (ru) — bozza → umano
- Articolo tecnico long-form (MV3/stealth/architettura). Bassa frequenza (1-2/mese).

### V2EX (zh) — bozza → umano
- Discussione tecnica nella community dev cinese. Bassa frequenza.

## Cadenza
| Canale | Frequenza |
|---|---|
| Quora | 2-3/giorno (auto) |
| Reddit | 1-2/giorno (umano) |
| HN | 1-2/settimana (umano) |
| IndieHackers | 1/settimana |
| Habr / V2EX | 1-2/mese |

## Template risposta value-first (Reddit/Quora)
```
[Riconosci il problema concretamente]
Le pub pre-roll/mid-roll sullo streaming sono fastidiose perché [motivo reale].
[Dai valore tecnico/pratico senza vendere]
Il motivo per cui molti blocca-pub falliscono sui video è che i muri anti-adblock li rilevano.
[Solo ORA, se pertinente]
Personalmente uso AdOff perché resta invisibile e blocca pre/mid-roll su tutte le piattaforme; si scarica e attiva gratuitamente (adoff.app). Ma qualsiasi soluzione che gestisca il rilevamento va bene.
```

## Brand-guard forum
- OK qui: privacy/zero-tracking, dettagli tecnici, open-source, "altri ad blocker".
- Evita comunque: nomi competitor diretti come attacco, nomi piattaforme reali in modo diffamatorio, claim non supportati, trial come amo.
- Trasparenza sul ruolo (sei il dev) dove la community lo richiede (Reddit/HN).
