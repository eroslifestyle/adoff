# Come ho trasformato Claude Opus 4.7 in un Trader 24/7

**Canale:** Nate Herk | AI Automation
**Video:** https://www.youtube.com/watch?v=6MC1XqZSltw
**Durata:** 33:15
**Trascritto con:** Whisper (base) — speech-to-text, tradotto in italiano

---

## Introduzione

Claude Opus 4.6 e' finalmente arrivato e mi ha fatto riflettere. Guardando i benchmark, ho notato che nell'analisi finanziaria genetica c'e' un salto del 4% rispetto a Opus 4.6. Circa una settimana fa ho pubblicato un video dove io e Sommen abbiamo fatto trading di azioni per 30 giorni con i nostri agenti OpenClaw. Il mio agente era configurato con Opus 4.6 e sono riuscito a battere l'S&P del circa 8%.

Dopo questa sfida, volevo continuare a far girare il mio agente per vedere se riusciva a battere l'S&P, ma ora voglio aggiornarlo alla versione 4.7.

**L'obiettivo di questo video:** come costruire un agente di trading AI 24/7 con Opus 4.7 dentro Claude Code, senza toccare OpenClaw o Hermes. Tutto grazie a una nuova funzionalita' del team Anthropic chiamata **Routines**.

**4.7 + Routines = agente AI 24/7.** Opus 4.7 e' stato costruito per lavoro agentico a pieno regime, giudizio sull'ambiguita' e output auto-verificanti.

---

## Cosa stiamo costruendo?

Un progetto Claude Code che gira su schedule con diverse routine giornaliere:

- **Ricerca di mercato** pre-apertura
- **Esecuzione trade** via Alpaca API
- **Journaling** — scrive contesto nei file per imparare
- **Report giornaliero** su ClickUp

**Obiettivo:** battere l'S&P 500. Niente crypto o day trading aggressivo. Investimento a lungo termine.

**Risultati primi 30 giorni:** con $10,000, ha battuto l'S&P dell'8%.

---

## Stack Tecnologico

| Componente | Strumento |
|---|---|
| Scheduler | Claude Code Routines |
| Modello AI | Opus 4.7 |
| Skill | Custom (ricerca, decisioni, trade, log) |
| Broker | Alpaca API |
| Ricerca | Perplexity API |
| Notifiche | ClickUp |

---

## Configurazione degli strumenti

### Alpaca

1. Vai su Alpaca.market e registrati
2. Clicca su Trading API
3. Avrai un conto paper trading (100K virtuali)
4. Per soldi reali: apri un nuovo conto (verifica richiede qualche giorno)
5. Nella sezione destra trovi le API keys: servono **Key** e **Secret**
6. Salva entrambe — il secret scompare dopo la chiusura del dialog

### ClickUp

Vai in Impostazioni → ClickUp API → copia il token

### Perplexity

Vai in All Settings → API Platform → copia la API key

### Claude Desktop App

Scarica da "Cloud Desktop app download". Serve un abbonamento a pagamento ($20/mese o piano Max).

---

## Modello Mentale: la chiave di tutto

La strategia di trading e' una parte del lavoro, ma l'**architettura della memoria** e' fondamentale.

Ogni volta che una routine si attiva, Claude Code si sveglia **essenzialmente senza stato**. Non sa nulla.

**Come si fa a far agire un agente stateless in modo disciplinato, ricordare le regole e imparare nel tempo?**

Con i **file** e il **contesto**.

Ogni routine:
1. Si sveglia
2. Legge i file di memoria
3. Fa il suo lavoro
4. Scrive le lezioni importanti per la sessione successiva

### Budget di Contesto

Tratta i token come soldi. Ogni routine ha circa 200,000 token. Istruzioni di sistema, file strategia, log trade, API, ricerca — tutto consuma token.

**Perche' Claude Code Routines invece di automazione standard?** Perche' con le routines ottieni la piena autonomia del loop agentico. L'agente ragiona, cerca, decide — non esegue solo uno script lineare.

---

## Step 1: Strategia

Pensa a questo come insegnare a un bambino ad andare in bicicletta. Non puoi buttarlo sulla bici e aspettarti magia.

**Inizia con il paper trading** se non ti senti sicuro. Questo NON e' un consiglio finanziario.

Hai bisogno di una strategia. Scrivi:
- Quanto spesso controlli le notizie?
- Quali segnali ti fanno comprare o vendere?
- Il tuo istinto e la tua routine di trading

Nel tempo, l'agente impara dai suoi errori e migliora.

### Benchmark GenTik Financial Analysis (64.4%)

Questo benchmark significa che il modello e' bravo ad **analizzare un'azienda** — digerire i bilanci e scrivere tesi fondamentali coerenti. **NON** e' un indicatore per il day trading. Si applica a strategie **long term, swing o fondamentali**, non al day trading.

---

## Step 2: Lo Scaffold del Progetto

1. Apri una nuova cartella
2. Apri Claude Code (preferibilmente in VS Code per vedere tutti i file)
3. Migra la strategia dal vecchio agente (o scrivi la tua da zero)
4. Lascia che Claude Code organizzi il progetto

Ho migrato tutto dal mio agente OpenClaw: strategia, segnali, sub-agenti, learnings. Ho chiesto a Claude Code di ingerire queste informazioni e organizzare il progetto nel modo migliore.

**Consiglio:** piu' contesto e dettagli dai ora, meglio e'. Fai un brain dump completo.

---

## Step 3: Guard Rails (Limiti di Sicurezza)

Prima di lavorare sulla logica di trading:

- Inizia in **paper mode**, passa a soldi reali quando ti senti sicuro
- **Max 5% del portfolio** per posizione
- **Cap perdita giornaliero**
- Definisci cosa NON fare (es: niente opzioni, max 3 nuove posizioni a settimana)
- **Guarda ogni singola esecuzione** — leggi la cronologia delle conversazioni
- Aggiusta prompt, impostazioni e file di contesto continuamente
- Sviluppa **skill** per ricerca e trading — invocale esplicitamente per consistenza

> Costruisci l'aereo mentre stai volando.

---

## Step 4: Migrazione

Usando Plan mode in Claude Code:
- File di memoria organizzati
- Script creati
- Comandi configurati
- CLAUDE.md aggiornato (~156 righe)

L'agente ("Bull") e' stato riportato in vita con tutta la sua conoscenza.

---

## Step 5: Le 5 Routine Giornaliere

| Routine | Orario | Scopo |
|---|---|---|
| **Pre-market** | 6:00 | Ricerca, catalizzatori, idee di trade |
| **Market Open** | 8:30 | Esegui trade pianificati, imposta trailing stop 10% |
| **Midday** | 12:00 | Taglia perdite -7%, stringi stop sui vincitori |
| **Market Close** | 15:00 | Report fine giornata, aggiorna memoria |
| **Weekly Review** | Venerdi' 16:00 | Analisi settimanale completa, auto-valutazione |

Solo nei **giorni feriali** (mercato aperto).

Ogni prompt deve:
1. **Leggere i file** prima di fare qualsiasi cosa
2. Fare il lavoro (ricerca, trade, analisi)
3. **Aggiornare tutti i file di memoria**
4. Prendere le API key dalle **variabili d'ambiente** (non da file .env)

---

## Step 6: Routine Locali vs Remote

| Tipo | Dove gira | Requisiti | Computer spento? |
|---|---|---|---|
| **Locale** | Sulla tua macchina | Nessuno | NO — si ferma |
| **Remoto** | Nel cloud | Repository GitHub | SI — continua |

Per le routine remote:
- Clona il repo nel cloud
- Lavora sulla copia
- **Deve fare push delle modifiche** al repo principale
- Altrimenti la prossima sessione non raccoglie le modifiche

---

## Step 7: Configurazione Environment

Nella Claude Desktop App:

1. Vai su Nuova Routine → Remote
2. Crea un **Cloud Environment** (es: "trading")
3. Configura le API key: Alpaca, Perplexity, ClickUp
4. Dai **accesso di rete completo**
5. Abilita **"Allow unrestricted branch pushes"** nei permessi

**Importante:** i nomi delle API key devono corrispondere **esattamente lettera per lettera** con le variabili d'ambiente.

---

## Step 8: Testing

Fai sempre un "Run Now" almeno un paio di volte prima di affidarti alle esecuzioni schedulate.

### Risultati del test

- Weekly review eseguita con successo
- Commit pushati su GitHub da Claude
- Notifiche inviate a ClickUp con:
  - Stato portfolio
  - Confronto vs S&P
  - Trade effettuati
  - Auto-valutazione (C per la settimana)
- Saldo Alpaca confermato: $9,859

---

## Costi e Limiti di Sessione

4 automazioni al giorno non consumano necessariamente tutti i limiti di sessione. La chiave e' **gestire il contesto**. Usare le routines e' molto piu' economico che fare la stessa cosa via API.

---

## La Lezione Nascosta

> **I file non sono solo memoria — sono la personalita' e la disciplina dell'agente.**

Con OpenClaw hai il file `sold.md`, `agents.md` e altri. La chiave e' orchestrare i file nel modo giusto perche' l'agente possa accedere a quelli corretti quando ne ha bisogno.

---

## Risorse

- PDF gratuito di 13 pagine disponibile nella community School di Nate (link nella descrizione del video)
- Repository GitHub: trading-routine (privato)

---

*Trascrizione automatica da audio — possibili imprecisioni nei nomi propri e termini tecnici.*
