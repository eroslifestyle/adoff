# Continua: AdOff — dopo il rilascio v3.6.14

Stai riprendendo AdOff (estensione ad blocker Manifest V3 + sito adoff.app) in
`/mnt/nvme2/projects/Progetti/ChromePlugin`. Sei l'orchestratore: pianifichi e verifichi con
evidenza letterale, deleghi l'esecuzione a subagent `model="haiku"`. Non scrivi codice di
progetto direttamente.

INIZIA COSÌ, in quest'ordine:
1. Leggi `.claude/TODO.md` — è la lista UNICA consolidata il 2026-09-21 dal merge di tutte le
   sessioni, dei 43 checkpoint, di `PROGRESS.md` e di `sviluppo/seo-tools/TODO-UPGRADES.md`.
   Contiene solo ciò che è aperto; lo storico chiuso è in git.
2. `git status --short` e `git log --oneline -5` (atteso HEAD `173c2432`). Altre sessioni Claude
   possono lavorare sullo stesso repo: aspettati file altrui modificati e fai `git add` mirato.

## Stato
La v3.6.14 è pubblicata su Chrome Web Store (publish OK), Edge Add-ons (submission
`1152921505701944507`) e Firefox AMO (`adoff-3.6.14.xpi` firmato); sito deployato; annuncio
Telegram `message_id 168`. Il cluster SEO streaming è online e completo (24 slug × 15 lingue,
360 pagine, sitemap 996 URL) e **non va ritoccato**.

## Obiettivo
Scegli con l'utente su cosa lavorare fra le voci aperte in `.claude/TODO.md`. Se l'utente non
indica nulla, proponi l'ordine della sezione "1. Prioritario" e chiedi conferma prima di partire
su un filone lungo (SEO/AEO e bonifica segreti sono filoni lunghi, non task singoli).

## Le tre code immediate
1. **Safari** — submit 3.6.14 da Mac con Xcode. `site/adoff-safari.zip` e
   `sviluppo/adoff-safari-store.zip` sono già a 3.6.14 e verificati. Procedura in `CLAUDE.md`,
   sezione "Safari Distribution". **Non eseguibile da questa macchina Linux**: è un promemoria
   per l'utente, non un task da tentare.
2. **Bump Playwright non attribuito** — `package.json`, `sviluppo/autofix/package{,-lock}.json`,
   `sviluppo/reviews/package.json` passano a playwright 1.63.0, con mtime tutti entro 36 secondi
   del 21/09 alle 00:52. Nessuna sessione Claude li rivendica. Capire quale processo automatico
   li ha toccati PRIMA di committarli.
3. **Passphrase di backup del vault fuori dalla macchina** (`secret get vault-backup.PASSPHRASE`):
   oggi se muore la scheda madre il TPM non decifra più nulla e la passphrase è dentro il vault.

## Do NOT (il set completo è nella sezione 9 del TODO)
- MAI `git push`: origin diverge con storie disgiunte, nessuna copia remota sicura.
- Deploy del sito SOLO da dentro `site/` (`cd site/ && npx wrangler pages deploy .`), mai dalla
  root: le Functions non verrebbero compilate e i redirect `/r/...` darebbero 404 in silenzio.
- Non reintrodurre lo slug `netflix-ad-blocker` né menzioni di Netflix nelle pagine SEO del
  cluster. Le occorrenze in `app/` sono domini funzionali del blocking: non si toccano.
- Il dropdown "Where did you find us?" in `onboarding.html` è ECCEZIONE AUTORIZZATA dall'utente
  alla Brand Name Policy: non "correggerlo" negli audit.
- Mai promettere blocco garantito o totale della pubblicità, in nessuna lingua.
- Mai esporre l'handle GitHub personale: le segnalazioni passano da `https://adoff.app/r/issues/new`.
- Non committare i checkpoint (esclusi via `.git/info/exclude`).
- Le decisioni congelate della sezione 8 del TODO (pagine Netflix a mano, sitemap a 996, keyword
  iOS/APK fuori perimetro) non si riaprono di iniziativa.

## Trappole verificate (sezione 10 del TODO — non ripercorrerle)
- **Credenziali: mai leggerle con `source`.** `source "$(secret file <ns>)"` tronca ogni valore
  non quotato che contenga `& | ; < > $ backtick ( )`. È esattamente ciò che ha bloccato Edge per
  giorni: `EDGE_API_KEY` sembrava vuota (`len=0`) e la diagnosi "chiave da rigenerare" era falsa —
  la chiave era integra, 40 caratteri con una `&`. Leggerle con parsing riga per riga in Python.
  Il sintomo rivelatore è l'artefatto `[1]+ Completato VAR=...`. Si somma una seconda trappola: quelle variabili non sono esportate, quindi dopo il `source` bash le vede ma `os.environ` di un processo Python figlio no. Il parsing diretto del file risolve entrambe in un colpo.
- Verificare un asset deployato sull'URL nudo dà falso negativo (edge cache Cloudflare,
  `immutable`): usare l'URL versionato `?v=<hash>`.
- `curl -F` per multipart fallisce con exit 26 in questo ambiente: usare Python `urllib`, oppure
  — per Telegram — passare a `sendPhoto` un URL pubblico invece del file.
- AMO rifiuta il codice offuscato: firmare dalla build `--store`, mai da quella del sito.
- `watch_batch.sh` senza `setsid` muore con la shell dell'agente e sembra uno stallo.

## Risorse
- TODO unico: `.claude/TODO.md` · Questo prompt: `.claude/NEXT-SESSION-PROMPT.md`
- Checkpoint più recente: `.claude/checkpoints/CP_20260921_0716.md` (precede il rilascio 3.6.14)
- Vault: `/home/mrxxx/Obsidian/Memoria/progetti/AdOff/sessioni/2026-09-20-cluster-seo-streaming-video.md`
- Trappola credenziali: `/home/mrxxx/Obsidian/Memoria/universale/CM-Universal/claude-system/sistemi/source-env-non-quotate-troncano-valore-20260921.md`
- Credenziali store: `secret file adoff-stores` (namespace TPM `adoff-stores`) — leggerle con
  parsing, non con `source`
- Filone SEO/AEO in dettaglio: `sviluppo/seo-tools/TODO-UPGRADES.md`

## Fatto quando
Dipende dal filone scelto con l'utente. Regola generale del progetto: ogni modifica a `app/`,
`app-firefox/` o `app-safari/` va propagata ai tre target, buildata, pubblicata su tutti gli store
e annunciata su Telegram nello stesso giro (`CLAUDE.md` → "Deploy Rule"). Nessuna modifica resta
offline.
