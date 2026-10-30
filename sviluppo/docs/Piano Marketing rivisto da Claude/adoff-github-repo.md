# AdOff — Task M · Repo GitHub (open core) per Claude Code

> **Obiettivo:** pubblicare un repository **open core** che renda ispezionabile il cuore di AdOff (fiducia per la community privacy/smanettoni), **senza** esporre ciò che monetizza o i segreti. Collega al sito come prova di trasparenza (Task D / "codice ispezionabile").
> **Principio:** pubblico ciò che tocca i dati dell'utente; privato ciò che fa guadagnare.

---

## 1. Cosa PUBBLICARE (repo pubblico)
- Codice estensione: `app/`, `app-firefox/`, `app-safari/` → `src/` (background.js, content scripts, options.html/js, popup).
- **Regole e filtri** (`declarativeNetRequest` / rules JSON): è ciò che gli utenti vogliono verificare.
- I 3 `manifest.json`.
- File di progetto utili al build del core (config, script di build NON segreti).
- `README.md`, `PRIVACY.md`, `SECURITY.md`, `LICENSE`, `.gitignore`.

## 2. Cosa NON pubblicare (resta privato)
- **Server di validazione licenze** e relativa logica.
- Integrazione **Stripe**, webhook, chiavi pubbliche/segrete, `.env`.
- **Logica di firma/gating del Pro** lato server, endpoint privati.
- Qualunque **segreto/credenziale**, token, file di deploy con chiavi.
- (Opzionale, a scelta del founder: lo **Stealth anti-detection** — nota: viaggia comunque nel client, quindi nasconderlo dà poco vantaggio.)

## 3. Igiene segreti (FARE PRIMA di rendere pubblico)
- [ ] Creare `.gitignore` che escluda: `.env*`, chiavi (`*.pem`, `*.key`), cartelle server/licenze, file di config con segreti, build artefatti.
- [ ] **Scansionare l'intera cronologia git** per segreti già committati (non basta l'ultimo commit): usare `git filter-repo` o BFG per rimuoverli davvero, poi force-push su una history pulita. In alternativa, **partire da un repo nuovo** copiando solo i file da pubblicare (più sicuro).
- [ ] Verificare che nessun manifest/sorgente contenga URL o token privati.

## 4. Licenza (la vera protezione anti-clone)
- [ ] Usare una licenza **source-available non commerciale** (default suggerito: **PolyForm Noncommercial**; alternativa: **BSL**). Codice ispezionabile, **rivendita/uso commerciale vietati**.
- [ ] **NON** usare MIT/Apache/GPL permissive (consentirebbero cloni commerciali legali).
- [ ] ⚠️ Decisione legale: far validare la licenza scelta a un avvocato prima del commit. Inserire il testo in `LICENSE`.

## 5. File da creare
**README.md** (in IT + EN), contenuto:
- Cos'è AdOff (1 paragrafo) + link al sito.
- **Spiegazione open core:** "Questo repo contiene il core ispezionabile (motore di blocco + regole + tutto ciò che tocca i tuoi dati). Il server licenze e l'integrazione pagamenti sono privati per sicurezza."
- Come ispezionare/buildare il core.
- I 3 impegni (zero log, no acceptable ads, dalla parte dell'utente).
- Founder note breve (Eros) + link alla storia.
- Licenza + come segnalare problemi (rimanda a SECURITY.md).

**PRIVACY.md:** zero-log, filtraggio on-device, spiegazione del **perché** servono i permessi ("read browsing history" / "all sites") e del fatto che **niente lascia il dispositivo**.

**SECURITY.md:** come segnalare vulnerabilità → email **business** (`support@adoff.app`), **non** contatti personali. Tempi di risposta indicativi.

## 6. Issues / PR (partenza soft)
- [ ] Si può partire con **Issues/PR disattivate** se il founder non vuole gestirle subito; l'importante è che il codice sia ispezionabile. Riattivarle quando c'è tempo (aumenta ancora la fiducia).
- [ ] Se attive: aggiungere template minimi per bug e per segnalare un "sito non bloccato".

## 7. Collegamento dal sito
- [ ] Aggiungere/aggiornare la sezione **"Codice ispezionabile"** (vicino alla spiegazione permessi) con il link al repo.
- [ ] Coerenza: il claim "core open / ispezionabile" sul sito deve puntare a un repo realmente pubblico.

## 8. Bonus (più avanti, non bloccante)
- [ ] **Build verificabile:** documentare come ricostruire il pacchetto e confrontarlo con quello pubblicato sugli store (massima fiducia per un prodotto privacy).

## 9. Acceptance criteria (M)
- [ ] Repo pubblico con **solo** il core (niente server licenze, niente Stripe, niente segreti).
- [ ] Nessun segreto nella cronologia git (verificato).
- [ ] `LICENSE` source-available non commerciale presente.
- [ ] `README` (IT+EN), `PRIVACY.md`, `SECURITY.md` (contatti business) presenti.
- [ ] Sito collegato al repo nella sezione "codice ispezionabile".

---

## Guardrail (non negoziabili)
- Mai committare chiavi/segreti, e nemmeno nella history.
- Licenza **source-available**, non permissiva.
- Server licenze + Stripe **sempre privati**.
- Contatti di sicurezza **business**, mai personali.
