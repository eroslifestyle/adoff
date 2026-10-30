# TODO AdOff — lista unica

> Consolidata il 2026-09-21 dal merge di: `.claude/TODO.md` (152 voci chiuse archiviate), 43 checkpoint in `.claude/checkpoints/`, `.claude/PROGRESS.md`, `sviluppo/seo-tools/TODO-UPGRADES.md`, marcatori TODO/FIXME nel codice, e il rientro della sessione gemella `chromeplugin-30`.
> **Questo file contiene SOLO ciò che è ancora aperto.** Lo storico delle voci chiuse resta in git (ultimo stato completo: commit `173c2432`) e nei checkpoint.
> HEAD al momento del merge: `173c2432`. Versione pubblicata: **3.6.14** (Chrome Web Store, Edge Add-ons, Firefox AMO, sito).

---

## Attivo (2026-10-05) — disinstallazioni + SEO vs/blog
- [ ] **Survey disinstallazione migliore**: opzione motivo "detected/rilevato" + campo dominio problematico in `site/uninstall.html`; worker `UNINSTALL_REASONS`/`reasonLabels`; 15 lingue; deploy sito+worker. (serve esecutore vivo)
- [ ] **Outlook/Edge "sito rotto"**: riprodurre in Edge su outlook.com. Stealth già escluso (`app/src/stealth.js:58`) → sospetto filtro cosmetico. 1 feedback vago, non toccare selettori alla cieca.
- [ ] **Detection su videosite**: trovare sito-target concreto dai feedback, poi hardening stealth iterativo.
- [ ] **vs/ IT→EN**: finalizzare pilota `vs/brave` (non committato) + completare cyberghost/ghostery/privacyspy/adblock; poi 13 lingue + 12 articoli blog con coder-next-ablit (:4000 OpenAI).
- [x] 2026-10-05 Fix D1 `uninstall_events` + deploy worker (versions deploy) + backfill 22 — e2382c7b
- [x] 2026-10-05 coder-next-ablit motore traduzione (translate_cluster) — c5e1513b
- [x] 2026-10-05 doc deploy worker in CLAUDE.md — e83360d0

## 1. Prioritario

- [x] **2026-10-30 — Pubblicato su origin/main** (conferma esplicita di Eros): snapshot orfano `6c41062c` = albero di `c8ccf94f` (v3.6.18), include 3.6.15-3.6.18. Scan: valori reali dei segreti del vault cercati nell'albero, solo identificativi pubblici trovati.
- [x] **2026-09-27 — Indagine deploy-site.sh CHIUSA**: root cause = `prose_i18n.py apply-all` + `i18n_manager.py build` rigeneravano da master stantii (gitignored, indietro 172-350 valori/lingua). Fix: site/ fonte unica, `sync-all`/`sync` riallineano i master prima del build; weekly_seo_agent.sh e seo_apply_watcher.sh deployano via deploy-site.sh. Backup master: `sviluppo/archive/prose-master-backup-20260927.tar.gz`. Commit 0b98836b, ebc67493.
- [x] **2026-09-27 — Pagine legacy risolte**: `en/salesletter.html` e `license-guide.html` eliminate con 301 (commit `cf8bf409`); `mgmt-9f4a` conservata (serve al reset password admin, `worker.js:4887`); `en/withdrawal` conservata (appendice legale IT obbligatoria).
- [ ] **Release Safari 3.6.15 da Mac con Xcode** (non rilasciata su Safari nella sessione 2026-09-26).
- [ ] **Quotare i valori nel file env del vault `adoff-stores`**: `source "$(secret file adoff-stores)"` nudo stampa errori/frammenti (righe 26,27,29,40,91 non quotate; EDGE_API_KEY contiene `&`).
- [ ] **Safari — submit 3.6.14 da Mac con Xcode.** Unica coda di rilascio aperta. `site/adoff-safari.zip` e `sviluppo/adoff-safari-store.zip` sono già a 3.6.14 e verificati. Procedura in `CLAUDE.md` → "Safari Distribution". Non eseguibile da Linux.
- [ ] **Copiare la passphrase di backup del vault FUORI da questa macchina** (`secret get vault-backup.PASSPHRASE`). Dipendenza circolare: se muore la scheda madre, il TPM non decifra più nulla e la passphrase è dentro il vault stesso.
- [ ] **Ruotare `TELEGRAM_BOT_TOKEN` e `GEMINI_API_KEY`** (2026-10-30) — dettaglio nel vault Memoria, sessione 2026-10-30-ticket-xbqg77-biquge-ad-server.
- [ ] **`EDGE_API_KEY` SCADUTA (verificato 2026-10-30: 401 anche su GET operations)** → Eros la rigenera da Partner Center → Microsoft Edge → Publish API, poi `secret set adoff-stores.EDGE_API_KEY` e `deploy-stores.sh edge` per 3.6.18. Nota: con `source` nudo la chiave risulta VUOTA (il `&`); usare parsing Python/shlex.

## 2. Sicurezza e segreti

- [ ] ~15 file di credenziali in chiaro residui sotto `~/.secrets/`: `adoff-gsc-sa.json`, `loquil-smb.cred`, `mt5-autologin.ini`, `keyok-finance-hub-legacy/`, `migrati-dropbox/*.env`.
- [ ] Convertire i consumatori fuori da AdOff/keyok al vault: `mt5-autologin.ini` (Trading), `dump_topics.py:18` (Loquil), `~/.config/rclone/rclone.conf` (credenziali Google inline).
- [ ] Template `.env` vuoti da compilare; `gsc_query.py` race/atexit; mirror Dropbox dei segreti.
- [ ] Rotazione Telegram / Stripe / CWS OAuth — **differita su decisione dell'utente (2026-09-12)**, non è una dimenticanza.
- [ ] Trasferire il repo a una org GitHub brandizzata (chiude il leak dell'handle personale) + le 6 righe corrispondenti in `site/_redirects`.
- [ ] Decidere il destino dei `.bak` che contengono il vecchio free-gate, incluso `app/src/background.js.bak` orfano; e dei file sparsi non tracciati nella root.

## 3. Store e schede

- [ ] Schede store da incollare a mano (Chrome Web Store, AMO, Edge) — testi pronti, manca l'azione manuale.
- [ ] Redirect 301 `www` → apex dalla dashboard Cloudflare (richiede permessi sulla zona).

## 4. Sito, SEO, AEO

- [ ] **Keyword gap: 449 query scoperte**, di cui 80 già raggruppate. Raggrupparle per intento e pianificare la fase di drafting.
- [ ] **Ri-misurare l'AEO dopo l'indicizzazione del cluster**: `AEO_QUERIES=25 aeo_probe.py`. Nota strategica da `TODO-UPGRADES.md`: siamo 0/25 nel retrieval, e ottimizzare la citabilità è inutile finché non si entra nel retrieval — quello è il collo di bottiglia da attaccare per primo.
- [ ] Filone AEO/SEO da `sviluppo/seo-tools/TODO-UPGRADES.md` (12 voci, file da leggere per il dettaglio): outreach verso siti editoriali, presidio della scheda CWS come canale di citazione, indicizzazione via URL Inspection API, multi-backend AEO (perplexity/claude), trend settimana-su-settimana, `authority_signals` ignorato nel report Telegram, `tg_send` non verifica l'esito reale, retention dei backup di `site/`, decisione aperta su `origin/main` disconnesso.
- [ ] 3 stringhe ancora in italiano dentro `en.json` (`guide.ricevi_la_chiave...`, `section.inserisci_la_chiave...`, `section.ricevi_la_tua_chiave...`) — 50 chiavi corrette il 2026-09-21, resta da fare per le rimanenti.
- [ ] Aggiungere al README della pipeline la nota su `watch_batch.sh`: va lanciato staccato, `nohup setsid bash sviluppo/seo-tools/watch_batch.sh >/dev/null 2>&1 &`.
- [ ] Riscrivere `privacy.html` e `terms.html` secondo il modello "sostegno volontario" (non più piani a pagamento).
- [ ] Consolidare le due pagine `/account` duplicate.
- [ ] Sottomettere la sitemap a Bing.
- [ ] SEO server-side `?lang=` per Googlebot.

## 5. Estensione (codice)

- [ ] Codice prezzi morto in `options.js`: `PRICES:45`, `purchasePlan:484`, `#pricingCard:359` — il modello è gratis al 100%, valutare cosa resta utile per il flusso di donazione.
- [ ] Recensioni: capire il sintomo esatto di chi non riesce a lasciarla; estendere `detectReviewUrl` a Opera/Brave/Vivaldi; degradare il link ZIP in `install.html`.
- [ ] `adoffIntegrity`: hash anti-tampering fragile — con la licenza dormiente potrebbe essere moot, da decidere.
- [ ] Interruttore "Compatibilità piattaforme video": decidere se resta o va.
- [ ] Testare la quota DNR reale su un browser vivo (mai verificato).
- [ ] Verificare la regola 179 (mai verificata).
- [ ] `mockup.webp` mostra ancora "v3.1.0" — se il file esiste ancora, rigenerarlo.
- [ ] JWK del rules-feed = `null` in `app*/src/background.js:893-897` (tutti e tre i target): "sostituire con il JWK reale quando il backend firma". Dormiente finché `REMOTE_RULES_ENABLED` resta `false` — **non riattivare il feed remoto senza firma ECDSA verificata.**
- [ ] Smoke test della admin console dopo il deploy; verify di `applyTicketReply` su un ticket email reale.

## 6. Igiene documentale

- [ ] `CLAUDE.md` afferma che `docs/` è stata rimossa, ma la cartella esiste e contiene `RULES-FEED-PROTOCOL.md`. Allineare l'uno o l'altra.

## 7. Da verificare prima di riaprire (probabilmente già superate)

Queste voci vengono da documenti datati e con ogni probabilità sono chiuse dai fatti recenti. Non lavorarci senza prima verificare che siano ancora reali.

- [ ] Upload store in 15 lingue — `sviluppo/store-listing.md` documenta solo en-US e it per CWS/Edge (AMO già pubblicata); nessuna evidenza che le 15 lingue siano caricate.

## 8. Decisioni congelate — non riaprire di iniziativa

- **15 pagine `tv-streaming-ad-blocker`** (root + 14 lingue) nominano Netflix nel corpo del testo. Sono HTML scritti a mano, fuori dai 24 slug del cluster, il bake non le rigenera. Il claim è onesto ("AdOff li esclude deliberatamente"). **Decisione dell'utente del 2026-09-21: lasciarle, rivalutare a freddo.** Toglierle significherebbe riscrivere la clausola in 15 lingue.
- **Dropdown "Where did you find us?"** in `onboarding.html` (tutti e tre i target): elenca Reddit, TikTok, Instagram, Facebook, X, YouTube, Mastodon, Bluesky come testo visibile. **Eccezione autorizzata dall'utente (2026-09-21) alla Brand Name Policy**: uso nominativo puro per identificare il canale di acquisizione. Non va "corretto" dagli audit.
- **Sitemap a 996 URL, non oltre 1000.** Il valore di partenza citato nel piano (731) era obsoleto: era già 987. Non è un bug, non inseguire il numero tondo.
- **Keyword iOS/APK fuori dal perimetro SEO** (decisione 2026-09-20).
- **Un caso in `streaming-cluster/REVIEW-NEEDED.md`**: `video-player-not-working-with-ad-blocker.id` ha perso uno `<strong>` in traduzione. Accettato di proposito.

## 9. Do NOT

- **MAI `git push`**: `origin` diverge con storie disgiunte, non esiste una copia remota sicura.
- **Deploy del sito SOLO da dentro `site/`** (`cd site/ && npx wrangler pages deploy . --project-name adoff-site`), mai dalla root: da lì wrangler non compila `site/functions/` e i redirect `/r/...` danno 404 in silenzio, mentre il sito sembra aggiornarsi normalmente.
- **Mai reintrodurre lo slug `netflix-ad-blocker`** né menzioni di Netflix nelle pagine SEO del cluster. Le occorrenze in `app/` sono domini funzionali del blocking: non si toccano.
- **Mai promettere blocco garantito o totale della pubblicità**, in nessuna lingua.
- **Mai esporre l'handle GitHub personale**: le segnalazioni passano da `https://adoff.app/r/issues/new`.
- **`git add` sempre mirato** — più sessioni lavorano sullo stesso repo.
- **Non committare i checkpoint** (esclusi via `.git/info/exclude`).
- **Non modificare uno `.sh` mentre è in esecuzione** (bash lo rilegge incrementalmente).
- **La lista del popup blocker è `NEUTRAL_SITES` soltanto**: mai unirla con `STEALTH_EXCLUDED`.
- **Non fermare i worker con `pkill -f translate_cluster.py`**: uccide anche la shell padre.
- **Non riattivare il rules-feed remoto** senza firma ECDSA verificata (`REMOTE_RULES_ENABLED` resta `false`).

## Attivo (nuovo 2026-09-27)

- [x] **2026-09-27 (11:00-13:00) — Pipeline SEO testata con run reali** (in anticipo sul 04/10). Correzioni: branch con data e ora (`3736a360`); conteggio AEO in log/commit/Telegram (`6307cc22`); run isolato in git worktree `sviluppo/.worktrees/seo-<TS>` con merge `--ff-only` e deploy dello stato committato dal worktree (`02f05f30`). Bug corretti: `WORK_ROOT` non assegnata con `set -u`; FAKE_FIX consumava domande AEO; symlink `.state` finito dentro la cartella (contiene file tracciato `report_20260712.md`) → deploy dal worktree fallito per `critical.css` mancante. Test superati: run completo 11:31 (6 AEO, 4 pagine, numeri coerenti); test A collisione (merge rifiutato, branch conservato, nessun deploy, sporco intatto); test B successo (merge ff + deploy dal worktree, 404 sporco del checkout principale né committato né pubblicato). Commit di test annullati con revert (`2df5afcc`, `2fd7916a`) e ridepoyati. Branch superati eliminati: `seo/auto-20260913`, `seo/auto-20260927`. Il cron di domenica 04/10 08:00 gira sulla nuova pipeline con worktree.
- [x] **2026-09-27 — Console admin /mgmt-9f4a protetta a due livelli**: token legacy a tempo costante nel worker (8bc5d76f), header no-referrer/noindex/no-store, Basic Auth via `site/functions/mgmt-9f4a/_middleware.js` (e7656817), Cloudflare Access app "AdOff admin" con IdP One-time PIN e policy "Solo owner". Verificato 302 al login.
- [ ] **2026-09-28: verificare totale giornaliero scritture KV** (GraphQL `kvOperationsAdaptiveGroups`, actionType write). Atteso sotto 150 dopo il fix 4b2553c9 (misura oraria: 54-62/ora stanotte → 2 nell'ora 18 UTC).
- [ ] **2026-10-04 08:00: primo run del cron della pipeline SEO con worktree** — controllare log in `sviluppo/seo-tools/.state`, Telegram, branch `seo/auto-*`.
- [ ] (opzionale) Rigenerare la Global API Key (è stata incollata in chat il 2026-09-27) e creare un token API dedicato (Access Edit + Workers Routes Edit + Account Analytics Read) per non usare la Global Key.
- [ ] test-adleak-ingest-worker.js fallisce anche PRIMA delle modifiche del 27/09 — preesistente, da indagare.
- [ ] Off-page manuale: AlternativeTo, Product Hunt, Reddit (r/chrome r/privacy r/adblock), awesome-list GitHub, G2/SaaSHub — **testi pronti** in `sviluppo/marketing/strategia/OFFPAGE-SUBMISSIONS-20260927.md` (commit 186bb900). Da decidere lato utente: URL store Edge/Safari da inserire, se citare Safari, awesome-list solo con repo pubblico; refuso "uitti" a riga 140 da correggere.
- [ ] 16 query AEO dinamiche (Android EN/ES/PT/RU) + "best ad blocker extension for Safari" — le lavora la pipeline

## Completati

- [x] 2026-09-27 (pomeriggio) — Incidente deploy-site.sh chiuso: site/ fonte unica, master prose/i18n riallineati via sync — 0b98836b/ebc67493; testi off-page pronti — 186bb900; deploy verificato (exit 0 ~20s, Functions compilate, /r/TEST123 302); residui italiani in 4 pagine EN tradotti (how-it-works, vs/adblock-plus, free-ad-blocker, catch-up-tv-ad-blocker-italy).
- [x] 2026-09-27 — Report SEO/AEO applicato (FAQ AEO, link i18n, title/meta, numeri stantii) — af838492/9dcb5de8
- [x] 2026-09-27 — Pipeline weekly SEO resa esecutiva — d49001bf
- [x] 2026-09-27 — deploy-site.sh compila Functions + watcher SEO senza push su origin — 53d5ac0c

## 10. Trappole e approcci falliti — non riprovare

- **Credenziali del vault e `source`.** `source "$(secret file <ns>)"` **tronca silenziosamente** ogni valore non quotato che contenga metacaratteri di shell (`& | ; < > $ backtick ( )`). `EDGE_API_KEY` è lunga 40 caratteri e contiene una `&`: dopo il `source` misurava `len=0` e l'API rispondeva "The Authorization header is malformed", da cui la diagnosi sbagliata "chiave vuota, va rigenerata". Il sintomo che smaschera il caso è l'artefatto di job in background: `[1]+ Completato EDGE_API_KEY=cRX`. **Leggere le credenziali con parsing riga per riga (regex in Python), non con `source`.** Nel file env del vault nessuna variabile è quotata, quindi vale per tutte. **Seconda trappola, complementare:** quelle variabili non sono nemmeno esportate — dopo il `source` bash le vede ma `os.environ` di un processo Python figlio no (verificato: `${#CWS_CLIENT_ID}` dà 72 in bash, `False` in Python). Servono `export`, o meglio il parsing diretto del file. Vault: `[[source-env-non-quotate-troncano-valore-20260921]]`.
- **Verificare un asset deployato sull'URL nudo** (es. `/adoff-footer.js`): falso negativo garantito, Cloudflare lo serve dalla edge cache con `immutable` e `age` di ore. Verificare sull'URL versionato `?v=<hash>` che le pagine referenziano davvero.
- **`curl -F "file=@..."` per l'upload multipart**: exit 26 in questo ambiente anche con file perfettamente leggibile. Funziona via Python `urllib` con multipart costruito a mano. Per Telegram c'è una scorciatoia migliore: passare a `sendPhoto` un **URL pubblico** (`https://adoff.app/assets/og-image.png`) invece del file — niente multipart del tutto.
- **`lp()` nel footer**: non gestisce la lingua assente e produce un path malformato. Usare `enRoot()`.
- **Retry LLM ripetuto per far combaciare i tag HTML**: non converge, quattro tentativi identici falliti. La riparazione va resa deterministica nello script.
- **`watch_batch.sh` senza `setsid`**: muore con la shell della sessione agente, e sembra uno stallo della pipeline mentre invece sta producendo regolarmente.
- **`CLAUDE.md` diceva che Firefox usa una "versione ridotta" di `stealth.js`**: falso, i tre `stealth.js` sono identici byte per byte. Propagare sempre il file intero ai tre target.
- **AMO rifiuta il codice offuscato**: firmare sempre dalla build `--store` (`node sviluppo/scripts/build.js --store --target firefox`), mai dalla build del sito.
- **Non rilasciare con un numero di versione già pubblicato** (caso 3.6.12, già uscita il 14 settembre).
