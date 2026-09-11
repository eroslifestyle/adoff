# TODO GLOBALE — AdOff ChromePlugin

## Attivo

- [ ] Verificare su Edge Partner Center quale delle 3 submission inviate in sessione 2026-09-12 è quella "in review" (l'ultima ha le note corrette, ma non verificato via dashboard)
- [ ] Decidere se postare annuncio Telegram @adoffapp per 3.6.11 (Chrome+Firefox live, Edge in review, Safari bloccato — serve Mac/Xcode)
- [ ] Correggere CLAUDE.md progetto: versione dichiarata 3.3.9 è stantia, quella reale è 3.6.11
- [ ] **Scheda store da incollare a mano** nei Developer Dashboard (Chrome Web Store, AMO, Edge): l'API carica il pacchetto, non la descrizione. Finché non è fatto, online resta il claim assoluto vecchio — punto di rischio verso lo store. L'estensione non è cambiata: nessun bump di versione né upload del pacchetto necessari.
- [ ] **Redirect 301 www→apex**: solo dal dashboard Cloudflare (Rules → Redirect Rules, hostname `www.adoff.app` → 301 all'apex). Né `CF_API_TOKEN` né l'OAuth di wrangler hanno il permesso di zona in scrittura (l'OAuth ha solo `zone (read)`).
- [ ] **66 file del sito espongono l'account GitHub personale** `github.com/eroslifestyle` (incluso l'URL di download dell'APK Android). Preesistente; sfuggito perché il pre-deploy check cerca `erosdegrande`, non `eroslifestyle`. Rinominare il repo romperebbe i link di download: decisione dell'utente.
- [ ] **Bug referral `/r/:code` ROTTO**: `adoff.app/r/TESTCODE` redirige a `/?ref=%3Acode` invece del codice reale — Cloudflare Pages non interpola i placeholder nella query string della destinazione (`site/_redirects`, regola invariata da prima della sessione, verificata con `git show 867dc46:site/_redirects`). Le regole statiche `/r/*` funzionano. Fix: Pages Function `site/functions/r/[code].js` o handler nel worker. Dettaglio: checkpoint `CP_20260911_1330.md`.

## Sessione 2026-09-12: audit dashboard admin + release 3.6.11 (adoffEnabled) multi-store

8 bug dashboard diagnosticati e fixati (JSON-parse-error su tabelle D1 mancanti, cohort
disinstallazioni rotta da JOIN su tabella cancellata, tile fuorviante, placeholder falso,
zero auto-refresh, crawler Autofix fermo da luglio riattivato via cron), più un bug bonus
scoperto in verifica live (worker serviva /admin da un alias Cloudflare Pages stale). Poi
release 3.6.11 con nuova feature `adoffEnabled` (traccia se la protezione è attiva/disattivata)
distribuita su Chrome (pubblicato) e Firefox (pubblicato), Edge in review dopo rinnovo chiave
API (con un incidente minore: submission doppia per errore, corretta subito), Safari bloccato
(serve Mac). Checkpoint: `.claude/checkpoints/CP_20260912_0130.md` · vault
`Memoria/progetti/AdOff/sessioni/2026-09-12-audit-dashboard-release-3611-multistore.md`.

**Fatto:**
- [x] 8 bug dashboard admin diagnosticati con causa esatta e fixati (commit `77d1ffc`)
- [x] Bug bonus: dominio Pages stale nel worker (`master.*` invece del canonico) — trovato in verifica live, fixato (commit `bc271a5`)
- [x] Fix Telegram: fallback senza thread se message_thread_id invalido — testato live (commit `ca531bf`)
- [x] Feature `adoffEnabled` end-to-end (3 browser + worker + dashboard), versione 3.6.11 (commit `2aaec7f`)
- [x] Chrome Web Store: pubblicato (upload SUCCESS + publish OK)
- [x] Firefox AMO: pubblicato (web-ext sign riuscito)
- [x] Edge: chiave API rinnovata dall'utente, submission inviata (3 tentativi, l'ultimo con note corrette)

**Aperto:**
- [ ] Verificare su Edge Partner Center quale submission è in review
- [ ] Decidere annuncio Telegram @adoffapp
- [ ] Safari: serve Mac con Xcode
- [ ] CLAUDE.md progetto: versione stantia (3.3.9 → 3.6.11 reale)

**Do NOT:**
- NON toccare Stripe/trial dormiente né `adoffPlanTier()`
- NON ripetere upload CWS se torna "in pending review"
- NON inviare altre POST a Edge submissions "per controllare" — ogni chiamata è reale

---

## Sessione 2026-09-07 (notte): applicate tutte le 8 proposte SEO — health 67 → 100

Chiusura del filone della sera: il run completo dell'agente (health 67) è stato seguito
dall'applicazione di tutte e 8 le proposte in quattro lotti di commit, fino a health 100/100
con 0 finding aperti. Corretti alla radice due bug dello script agente e due falsi positivi
del checker (con test di regressione, suite 6/6). HEAD `3812a03`. Dettaglio: checkpoint
`.claude/checkpoints/CP_20260907_0130.md` · vault
`Memoria/progetti/AdOff/sessioni/seo-aeo-audit-fix-20260906.md` (Fase 7).

**Fatto:**
- Primo run completo dell'agente SEO (`20260906_2123`, 341s, sonnet cloud perché il preflight su `:8774` dava http=000), merge+push+deploy automatici
- Due bug corretti nello script dell'agente: `$PROMPT` mai passato a `claude -p` (commit `b6167e9`) e verifica che scambiava un fix parziale per risolto (`5423048`) — l'id è `sha1(area|title|primo_file)`, quindi correggere una parte delle occorrenze cambiava l'id e il finding sembrava sparito; ora l'identità è `(area, title)`
- Accorpati tre difetti "valore di ritorno scartato" (`a055bd8`): esito di `sendEmail` registrato nel KV del ticket, `tg_send` logga lo status HTTP, la SELECT dei run espone `findings_high`/`proposed_count`/`commit_sha`/`deployed` (colonne che esistevano già e che la UI usava ricevendo undefined)
- Applicate tutte e 8 le proposte in quattro lotti: HIGH `28fb32b` (67→87), MEDIUM `1055b19` (87→96), LOW onpage `21619f4` (96→98), LOW authority `3812a03` (98→100)
- Due falsi positivi del checker corretti ALLA RADICE con test di regressione (suite 6/6): `RULES_NUM_RE` agganciava lo "000" di "30,000 static rules"; `FRESHNESS_RE` copriva solo 6 lingue e il `\b` non funziona fra caratteri CJK
- 88 citazioni esterne da 4 URL distinti, tutti verificati HTTP 200 uno per uno
- Deploy sito (242 file) + worker (via OAuth di wrangler); run `20260907_0122` registrato: health 100, open_findings 0, recently_fixed 9

**Aperto:**
- Redirect 301 www→apex: solo dal dashboard Cloudflare. Né `CF_API_TOKEN` né l'OAuth di wrangler hanno il permesso di zona in scrittura (l'OAuth ha solo `zone (read)`)
- [x] 17 elementi con `data-i18n` contengono un `<a>`: a runtime `adoff-i18n.js` li riscrive via `textContent` e quei link spariscono. Tutti preesistenti — candidato a diventare un check della suite — FATTO 2026-09-08: check `content.i18n_link_destruct` + `content.i18n_html_links` e 95 coppie riparate (commit `7952521`, `94ceabf`, `f86b6a4`)
- Verifica sul campo di `applyTicketReply`: il campo `email: {ok, id, at}` nella reply si vedrà solo alla prossima risposta a un ticket reale

**Do NOT:**
- NON deployare il worker con `CF_API_TOKEN` (ha solo permessi Pages): serve l'OAuth di wrangler, `env -u CLOUDFLARE_API_TOKEN -u CF_API_TOKEN npx wrangler deploy`
- NON riscrivere la prosa del sito per far tacere una regex dell'audit: va corretto il check, con test di regressione
- NON fidarsi di `GET /admin/seo-agent` subito dopo un ingest: ha ~1 minuto di cache e mostra lo stato vecchio

---

## Sessione 2026-09-06 (sera): audit SEO/AEO + redesign agente domenicale

Tre filoni chiusi: email ticket confermata consegnata (Resend `last_event:"delivered"`), audit
/hulk-seo con riparazioni live (492 orfane, hreflang duplicati, testi 15 lingue, chiavi VPN morte),
redesign dell'agente SEO (21 check deterministici + pipeline 5 fasi + stato D1 + sezione admin,
modello ibrido code-max/sonnet testato 2/2). HEAD `77ecce6`. Dettaglio: checkpoint
`.claude/checkpoints/CP_20260906_2115.md` · vault `Memoria/progetti/AdOff/sessioni/seo-aeo-audit-fix-20260906.md`.

**Fatto:**
- [x] Email TK-20260906-90D03425 confermata consegnata; gap `applyTicketReply`/KV annotato
- [x] Audit + fix live: linking interno, sitemap 516 URL, 13 citazioni esterne, 74 conteggi, 214 file i18n, 4048 chiavi VPN rimosse
- [x] Suite 21 check (`sviluppo/seo-tools/seo_audit.py`), pipeline 5 fasi, endpoint worker, sezione admin "Agente SEO"
- [x] Modello ibrido: preflight `:8774` → code-max locale, altrimenti sonnet; test live 2/2

**Aperto:**
- [x] Primo run COMPLETO dell'agente (non `--dry-run`): AUTO=1, PROPOSE=8 attesi — fatto: run `20260906_2123`, 341s, health 67, deploy ok
- [ ] Redirect 301 www→apex: da fare a mano dal dashboard (Redirect Rule di zona; `_redirects` non matcha l'hostname)
- [x] Residui health 67/100: 10 orfane, 93 title fuori range, 66 pagine senza data, 88/91 senza citazioni — fatto: tutte e 8 le proposte applicate, health 100/100, 0 finding
- [x] Registrare stato consegna email nel KV — fatto, commit `a055bd8`

**Do NOT:**
- NON toccare Stripe/trial dormiente né `adoffPlanTier()`; NON dire che qualcosa richiede pagamento
- NON deployare console admin senza `--branch master`; alert solo via `POST /admin/notify` (mai TELEGRAM_CHAT_ID pubblico)
- NON rinominare/cancellare chiavi i18n senza verifica su TUTTO il sito (HTML + JS); MAI `<a>` dentro `data-i18n`

---

## Sessione 2026-09-06: ticket TK-20260906-90D03425 → chat AI ripristinata + resilienza

Partito da "è arrivato un messaggio da un utente sul supporto, non lo trovo"; finito con la
chat AI del sito ripristinata dopo 15 giorni di silenzio (chiave LiteLLM revocata + modello
inesistente), sei interventi di resilienza e una review che ha trovato 5 difetti nel lavoro
stesso. Dettaglio: `.claude/checkpoints/CP_20260906_1140.md` · vault
`Memoria/progetti/AdOff/log/adoff-admin-cache-e-chat-ai-giu-20260906.md`.

**Fatto (2026-09-06):**
- [x] Ticket TK-20260906-90D03425 trovato, risposto e chiuso
- [x] 6 ticket di test del 22/08 chiusi
- [x] Console admin: TTL nel router pagine (11 sezioni mostravano dati congelati)
- [x] Chat AI ripristinata dopo 15 giorni di silenzio (chiave LiteLLM revocata + modello inesistente)
- [x] Monitor chat + alert Telegram via worker, timer 30 min
- [x] Fallback LLM a cascata, /admin/health, dead-man switch
- [x] preflight.py pre-deploy, ensure-llm-key.py auto-riparazione
- [x] Log sui fallimenti muti (sendEmail + 2 punti Stripe)
- [x] System prompt corretto (prometteva un piano a pagamento inesistente)
- [x] Review del lavoro: 5 difetti trovati e corretti
- [x] 10 commit pushati su main (9f29b1d → a1df67f); test: test_ttl_router.js 5/5, test_monitor_chat.py 8/8, preflight 0 errori

**Aperto (2026-09-06):**
- [x] Verificare che la risposta email al ticket TK-20260906-90D03425 sia stata consegnata (ok:true non prova la consegna) — CONFERMATA: `last_event:"delivered"` (sessione sera)
- [x] /admin/health usa CHAT_MAX_TOKENS pieno (650) per un ping: ridurre a un budget minimo, ~96 completion/giorno sprecate — fatto (commit `1e2c226`)
- [x] Valutare se la chat debba dipendere da Ollama sul PC locale (PC spento = chat giù, il dead-man avvisa entro ~4h) — fatto (monitor a 5 min)

---

## Sessione 2026-09-03: riallineamento comunicazione al modello 100% gratuito

Causa: il canale Telegram automatico e vari documenti/pagine promettevano ancora il vecchio
modello freemium (Free + Pro/Premium a pagamento, Trial 15gg), ma il prodotto è già gratis al
100% per tutti (verificato nel codice: `adoffPlanTier()` ritorna sempre `"premium"`, il vecchio
sistema Trial/Licenza/Stripe resta dormiente per reversibilità, la pricing card è oggi una
donazione volontaria). Dettaglio completo: `.claude/checkpoints/CP_20260903_2352.md` e vault
`Memoria/progetti/chromeplugin/sessioni/sessione-20260903-modello-gratis-comunicazione.md`.

**Fatto (tutto verificato con git status/diff):**
- [x] Fix bug separato: `onboarding.html` si riapriva a ogni avvio Chrome — guardia `adoffOnboardingShown`, pubblicato v3.6.7 su CWS+AMO (Edge fallito, vedi aperto)
- [x] Automazione Telegram (`telegram_daily_post.py`+`daily_card.py`): tema "trial-value"→"free-forever", testato
- [x] `constants.json`: aggiunto `free_model`, vecchi campi pricing/trial_days deprecati
- [x] 19 documenti `sviluppo/marketing/{automation,strategia}/` ripuliti da prezzi/Pro/Premium/trial
- [x] `CLAUDE.md` progetto riscritto (Architecture/Modello di accesso/Storage Keys/Pricing) sui fatti verificati nel codice
- [x] `audit_congruence.py` ricalibrato (ogni trial/prezzo/Lifetime è ora un problema, non solo un disallineamento numerico)
- [x] `gen-guide-prices.py` disattivato con guardia esplicita
- [x] Sito pubblico (15 lingue, ~130 pagine + `site/i18n/*.json`) ripulito da trial/Pro/Premium/Lifetime-in-vendita; trovato e corretto un bug pre-esistente di text-corruption ("frees" al posto di "30/90/14 giorni", recuperato da git history) e una contaminazione linguistica pre-esistente (italiano incollato in RU/TR/FR/root)
- [x] Deploy sito su Cloudflare Pages, verificato live
- [x] Commit `53f40b3`, `ac74191`, `16dad42`, `28e7378` su `main`, pushati

**Aperto:**
- [ ] **Edge Add-ons**: API key scaduta — rigenerare da Partner Center, aggiornare `~/.secrets/adoff-stores.env`, ripubblicare
- [ ] **Safari**: richiede Xcode su Mac
- [ ] Verificare se `make_worklists.py`/`fix_stale_numbers.py`/`guard_safari.py` (leggono `constants.json`) hanno bisogno dello stesso ricalibramento fatto su `audit_congruence.py` — non controllati
- [ ] Residuo minore sito dopo audit finale: TRIALWORD 98, PAIDLANG 23, LIFETIME 67 occorrenze — perlopiù legittimo (clausole storiche, dati competitor, frasi negate) ma non tutte verificate una per una
- [ ] Due categorie di audit MAI affrontate (fuori scope pricing): VER (152 occ. versione stantia tipo "v3.5.67") e RULES (218 occ. conteggio regole stantio, es. "144" invece di 172)

**Lezioni:**
- Un subagent Haiku ha dichiarato 18 file "corretti" con zero modifiche reali su disco (verificato con `git status`) — MAI fidarsi del report di un subagent senza verifica diretta git status/diff/grep, specialmente se menziona scorciatoie tipo "pattern batch senza leggere ogni file"
- Un subagent ha fatto `git add -A`/commit da solo inglobando 244 file estranei (nessun segreto dentro, verificato) — MAI delegare git add/commit a un subagent, farlo sempre a mano nel main

**Do NOT:**
- NON toccare `adoffPlanTier()` in `background.js`/`content.js` — è il gate universale di sblocco attivo, non un bug
- NON cancellare le clausole storiche su licenze Lifetime/Pro acquistate in passato nei testi legali
- NON riscrivere la history git condivisa (niente force-push) — il commit `16dad42` con file estranei è già pushato, accettato così

---

## Release 3.6.4-3.6.5 (2026-08-23): copy 100% gratis + fix bug video 16x

**Fatto:**
- [x] Copy allineata al modello "100% gratuito": rimossi tutti i residui Free/Pro/Trial dal sito (41 pagine, 15 lingue) e store-listing
- [x] Conteggio regole corretto a 153 (trovati e corretti 138/144/146 stantii)
- [x] Bug fix reali emersi durante il processo: SyntaxError in admin-console.html, traduzioni infiltrate in 6 lingue, riferimento trial 30gg residuo in turco
- [x] Bug video: playbackRate bloccato a 16x dopo skip ad — causa `adActive` non resettato, fix in `onAdEnd`
- [x] Suite test esistente `test-yt-quality-reload.js`: 96/96 PASS

**Bug trovati e corretti:**
- SyntaxError JS in `site/admin-console.html`: `${e."?" "⭐" : "–"}` invece di `${e.wasPro ? "⭐" : "–"}`
- Traduzioni italiane infiltrate in hindi/indonesiano/russo/portoghese/turco/tedesco
- Riferimento trial 30 giorni residuo in turco

**Aperto:**
- [ ] **Chrome Web Store v3.6.5**: in coda di revisione, pubblicazione automatica impostata, NON ancora live
- [ ] **Edge**: API key scaduta (rigenerare da Partner Center)
- [ ] **Safari**: richiede Xcode su Mac
- [ ] **Telegram**: NON postato — aspettare CWS live
- [ ] `privacy.html`/`terms.html`: da riscrivere con testo verificato sul modello "sostegno volontario legacy" per vecchi abbonati Stripe
- [ ] Problema APERTO non risolto: gate video difese si accende in modo intermittente (problema nonce service worker)

**Lezioni:**
- Subagent che dichiarano "fatto" senza verificare: sempre controllare con `git diff`/Read diretto
- Fix minimo che ripristina solo il sintomo visivo senza resettare tutto lo stato correlato fallisce su sequenze reali (ad multipli)

---

## Release 3.6.3 (2026-08-23): sistema di messaggistica in-estensione

Piano completo: `~/.claude/plans/iridescent-foraging-zephyr.md` (STATO AVANZAMENTO in cima, fonte di verità cross-sessione). Backend (`worker.js`, thread `MSG-`, D1, traduzione, retention) era già stato completato e deployato in una sessione precedente (commit `0dc2d22`). Questa sessione ha completato tutto il resto.

**Fatto:**
- [x] Tab Messaggi nel pannello admin (`sviluppo/license-system/admin.html`) — nav+page+modal+JS, pattern identico a Supporto/Suggerimenti (commit `471c9e7`)
- [x] `sviluppo/ai-autopilot/scripts/support-triage.sh` esteso per generare bozze automatiche anche sui thread `MSG-` (oggi copriva solo `TK-`), stesso meccanismo bozza→Telegram→ok già attivo lato worker (commit `471c9e7`)
- [x] UI estensione completa: `options.html/js/css` (tab Aiuto→Messaggi, chatbox mono-turno sostituita da thread persistente con storico+allegati+email-gate), `popup.html/js/css` (card rapida con badge), `background.js` (alarm `adoffMessagesPoll` ogni 20 min), `i18n.js` (12 chiavi × 15 lingue) — propagato identico su Chrome/Firefox/Safari, testato dal vivo con Playwright (zero errori console) (commit `d480713`)
- [x] R2 abilitato dallutente da dashboard → bucket `adoff-support-attachments` creato, binding `ADOFF_ATTACHMENTS` in `wrangler.toml`, worker ridistribuito, verificato end-to-end (commit `844b376`)
- [x] Version bump 3.6.2→3.6.3 su tutti e 3 i manifests
- [x] Build produzione (SITE+STORE) + deploy sito (commit `92e63d6`)
- [x] Firefox AMO: firmato (canale unlisted) e scaricato xpi firmato Mozilla
- [x] Chrome Web Store: upload SUCCESS (v3.6.3 in bozza)
- [x] **Trovato e risolto**: `site/admin-console.html` disallineato da `sviluppo/license-system/admin.html` — risincronizzato e deployato (commit `7e01799`)

**4 bug reali trovati e corretti PRIMA di considerare il lavoro finito:**
1. `admin.html`: bottoni Segna risolto/Riapri rimossi (avrebbero spedito email vere)
2. `background.js` (3 browser): alarm `adoffMessagesPoll` annidato nel blocco licenza — spostato fuori
3. `i18n.js`: traduzioni CJK/arabo cirillico in caratteri latini (solo EN era corretto)
4. `background.js` (solo Chrome): mancava `async` nel listener `chrome.alarms.onAlarm` — SyntaxError reale

**Aperto — richiede azione manuale dellutente:**
- [x] **Chrome Web Store**: Privacy practices compilate, v3.6.5 inviata per revisione (in coda, pubblicazione automatica impostata, non ancora live)
- [ ] **Edge Add-ons**: API key scaduta — rigenerare da Partner Center
- [ ] **Safari**: richiede Xcode su Mac
- [ ] **Annuncio Telegram**: non pubblicato — aspettare sblocco CWS
- [ ] `app/src/background.js.bak` — file orfano, chiarire se rimuovere
- [ ] File sparsi non tracciati in root (`package.json`, `results.jsonl`, `.png`)

**Lezioni di questa sessione:**
- Verificare SEMPRE gli errori `node --check` che i subagent liquidano come normali
- `sviluppo/license-system/admin.html` NON aggiorna `adoff.app/admin.html` in produzione — serve sync manuale
- `wrangler pages deploy site/` senza `--branch` non aggiorna `master.adoff-site.pages.dev`
- Controllare sempre stato reale AMO prima di riutilizzare un numero di versione
- Privacy practices CWS e R2 non hanno endpoint API — azioni dashboard-only

---

## Release 3.6.1 — sessione 2 (2026-08-22): bonifica menu i18n + CSP + repo GitHub

Un generatore di pagine rieseguito con template vecchio aveva sovrascritto 240
pagine statiche (guide/privacy/community/vs/* × 15 lingue) DOPO il commit
`081fda8` di oggi, reintroducendo tre regressioni insieme.

**Fatto:**
- [x] Menu tradotto solo in inglese su 240 pagine: mancava l'include di `adoff-i18n.js` — aggiunto (commit `b9a04f3`)
- [x] Link "Prezzi/Premium" fantasma tornato nel menu: query-string di `adoff-nav.js`/`footer.js`/`i18n.js` incoerenti tra pagine, ognuna bloccata un anno dalla cache `immutable` di Cloudflare — normalizzate tutte su `?v=e75acee8`/`?v=21299afa`/`?v=623d521a` (commit `b9a04f3`)
- [x] CSS critico inline + font-preload perso sulle stesse 240 pagine (regressione LCP) — ripristinato da HEAD (commit `b9a04f3`)
- [x] CSP bloccava ogni richiesta Google Analytics (`connect-src` non includeva `google-analytics.com`) — fix (commit `731d996`)
- [x] Descrizione repo GitHub aggiornata al modello free reale (30gg poi account gratuito, non piu' "open core" generico)
- [x] README.md (IT+EN): aggiunta sezione "Sempre gratis/Always free" allineata al commit `87551e2` (commit `1726984`)

**Aperto:**
- [ ] **Il sito dichiara ancora "senza account e senza scadenze"** in piu' punti (es. FAQ homepage) — falso rispetto al codice reale (`applyFreeGate()`, 30 giorni poi serve un account gratuito, commit `87551e2`). Serve un audit copy su tutte le 15 lingue per allinearla al vero modello ("gratis per sempre, account gratuito dopo 30gg").
- [ ] **894 chiavi in `en.json` identiche a `it.json`** (valore italiano non tradotto sotto una chiave EN, es. `account.accedi = "Accedi"`) — serve audit dedicato (fonte: vault AdOff, sessione 2026-08-20).

---

## Release 3.6.1 + bonifica sito (2026-08-21)

Rilasciata 3.6.1, bonificato il sito dai residui dei vecchi piani a pagamento.

**Fatto:**
- [x] Service worker: HTML network-first, VERSION v3 (era cache-first con v2 pinnata)
- [x] CDN Cloudflare: token nav/footer bumpato da v=260730 a v=260821 su 627 file
- [x] Pagina /pricing eliminata con redirect 301 verso /
- [x] 82 link in 76 file ripuntati alla pagina di installazione della lingua corretta
- [x] Copyright con escape non decodificati su 21 chiavi dizionario
- [x] Bonifica claim sui tre strati: dizionari (240 file, 15 lingue), template (9), pagine a mano (guide, license-guide, about-data, press, salesletter, vs/)
- [x] Difetto generatore: replace con limite 1 (prose_i18n.py riga 173) — rimosso il limite
- [x] Recupero 1033 chiavi perse da 16 file JSON (backup `prose-backup-20260821/`)
- [x] ZIP ricostruiti per allineamento 3.6.1
- [x] Firefox AMO ripubblicato in 6 lingue (de, en-US, es-ES, fr, it, pt-BR)

**Filone recensioni (stessa release, sessione parallela — checkpoint `CP_20260822_0009.md`):**
- [x] Escluso il blocco CWS: listing indicizzato su `chromewebstore.google.com/search/adoff`, badge buona reputazione, 53 utenti, 5 valutazioni 5/5, API `uploadState: NOT_FOUND`
- [x] Escluso che AdOff rompa la pagina recensioni: `sviluppo/tests/diag-cws-reviews.js` con e senza estensione da' metriche identiche (commit `94fd1ee`)
- [x] Bug — `detectReviewUrl()` usava `chrome.runtime.id`: negli install da ZIP l'ID e' locale, il link portava a una pagina store inesistente. Ora `CWS_ITEM_ID` hardcoded (commit `4764ab3`)
- [x] Bug — il prompt recensione chiedeva 100 ads cosmetic + 10 giorni e non compariva mai. Ora 30 blocchi (ads + richieste di rete) + 3 giorni (commit `5582ed4`)
- [x] Bug — `amo-sign.sh` notificava come errore una submission AMO riuscita (commit `a9b08e1`)
- [x] Gate `node sviluppo/tests/test-security-invariants.js`: 95 passati / 0 falliti

**Aperto:**
- [ ] **Recensioni** — farsi dare il sintomo esatto da chi non riesce a recensire (pulsante assente vs messaggio d'errore) e il browser. Expected outcome: una causa fra (a) browser non-Chrome, (b) account Google non autorizzato, (c) profilo Chrome diverso
- [ ] Se la causa e' (a): estendere `detectReviewUrl()` a Opera/Brave/Vivaldi, che oggi ricadono sul link Chrome
- [ ] Valutare se degradare lo ZIP a fallback in fondo a `site/install.html`: ogni install da ZIP e' una recensione persa per sempre (Google la consente solo agli install da store)
- [ ] Chrome Web Store ed Edge: schede da aggiornare a mano (API copre solo il pacchetto)
- [ ] Due pagine account (`/account` e `/account/`): da consolidare senza spezzare il referral
- [ ] Codice prezzi morto in options.js/html: `PRICES` riga 45, `purchasePlan()` riga 484, `#pricingCard` riga 359 — richiede release
- [ ] 2176 stringhe non tradotte su pagine pubbliche

**Da non ripetere:**
- Il gate `test-security-invariants.js` va eseguito PRIMA del deploy, non dopo. Questa volta e' passato (95/95) ma l'ordine era sbagliato.
- Un test che misura 0 dove ci sono 4 elementi non e' verde, e' una trappola: le stelline dello store sono esposte via `aria-label`, non `alt`.
- Per le card PIL usare `anchor="mm"` con coordinate fisse: `textbbox` non corrisponde ai pixel disegnati e produce testi sovrapposti.

---

## Release 3.6.0 — PUBBLICATA (2026-08-20) — AdOff e' gratuito per tutti

Ogni funzione sbloccata per chiunque: nessun piano, nessuna scadenza, nessun account.
Piano completato: `sviluppo/PIANO-FREE-PER-TUTTI.md` (tutti e sette i punti).

- [x] Estensione sbloccata: `adoffPlanTier()` sempre "premium" in 18 copie, unico punto di decisione
- [x] Sito riscritto: nucleo, 146 pagine SEO ripulite da 527 claim obsoleti, stessi URL
- [x] VPN rimossa dal sito: 9 pagine archiviate con redirect 301
- [x] 15 lingue allineate: ~8.200 celle tradotte in `site/i18n/_matrix.json`
- [x] Worker: rotta `POST /newsletter` + tabella su D1, riparato il portale di disdetta
- [x] Chrome Web Store: upload SUCCESS, publish OK
- [x] Edge Add-ons: submission accettata (202)
- [x] Firefox AMO: 3.6.0 caricata, stato `unreviewed`
- [x] adoff.app: deploy completato, i 3 ZIP sono a 3.6.0
- [x] Email ai 4 sostenitori (Resend) + post Telegram @adoffapp (message_id 133)
- [x] Verificare l'esito delle review: Chrome pubblicata, AMO respinto (rifatto e ripubblicato)
- [x] Provare l'iscrizione newsletter dal browser reale: iscrizione registrata su D1

### Da non ripetere (imparato in questa release)
- Il worker si prova con `wrangler dev --local` PRIMA del deploy: un errore di
  inizializzazione passa `node --check` e passa i test statici, ma rompe ogni rotta in
  produzione. E' successo: 500 ovunque, rollback con `wrangler rollback <version-id>`.
- Non si rimuovono elementi o id dall'HTML dell'estensione: `options.js` ne cerca 39, uno
  senza guardia. Si cambiano i testi e si usa `display:none`.
- Il database D1 si chiama `adoff-db`; Resend rifiuta `urllib` di Python (errore 1010): curl.

### Chiarito: gate Pro intermittente
Il meccanismo era che `pro` dipendeva dal piano letto da storage e il banco faceva
letture secche dopo attese fisse. Dalla 3.6.0 `adoffPlanTier()` ritorna sempre
"premium" quindi l'esito non dipende piu' dal timing. Misurato 6 esecuzioni su 6
verdi, due delle quali con le attese azzerate. LIMITE ONESTO: il bug non e' mai stato
riprodotto neanche sul build 3.5.84, quindi la spiegazione poggia sulla lettura del
codice e non su una riproduzione. Chiuso come "compreso ma non riprodotto".
Checkpoint: `.claude/checkpoints/CP_20260819_1230.md`


> **Consolidato 2026-08-11.** Merge sessione fix piano Premium YouTube + release v3.5.70.
> Stato prodotto: **3.5.70** — CWS in review, Edge in review, AMO public, sito live su feat/premium-vpn. Branch `feat/premium-vpn`, HEAD `4eed2be` pushato.
> Esiste un gate di test obbligatorio: `node sviluppo/tests/test-security-invariants.js` deve dare 58 su 58 prima di ogni deploy.

---

## ✅ FATTO — storico per release

### v3.5.70 — fix piano Premium non riconosciuto dal gate YouTube (11/08)

**Root cause**: il commit `4e74d73` (14/07/2026) aveva introdotto il piano licenza `"premium"` (VPN+Premium, EUR 4,99/mese) SOLO in `checkPro()` di `license-client.js` (popup — funzionava), ma NON nei 3 gate che attivano DAVVERO lo stealth/IMA-stub/regole-network su YouTube:
- `content.js` righe ~141-145 (variabile `isPro`, OR inline di `lic.plan === "..."`)
- `background.js` righe ~880-882 (funzione `updateImaRules()`, array `.includes()`)
- `background.js` righe ~1174-1180 (handler messaggio `isProForContent`, due array `.includes()`)

Su YouTube il blocco ads per design e' attivo SOLO per Pro/Trial (anti SABR-backoff, "Free = YouTube intatto"), quindi un utente Premium — visto come Pro nel popup ma Free in questi 3 gate — vedeva tutte le pubblicita'.

**Fix**: aggiunto `"premium"` in tutti e 3 i punti di gating, propagato su tutti e 3 i target browser (Chrome, Firefox, Safari) — 9 file modificati, ogni modifica verificata con `git diff` letterale.

- [x] Version bump 3.5.70 su tutti i manifest.json + changelog
- [x] Build produzione (`node sviluppo/scripts/build.js --store` e senza `--store`)
- [x] Commit `4eed2be` "fix(license): piano Premium non riconosciuto dal gate YouTube (3.5.70)" su feat/premium-vpn, pushato
- [x] Deploy sito: `wrangler pages deploy site/ --project-name adoff-site` → successo
- [x] Chrome Web Store: upload via API → `uploadState: SUCCESS`, in review
- [x] Microsoft Edge: upload draft + publish → 202 Accepted, in review (submission id `cf630582-d1a6-4a76-a056-bd3c9fd54420`)
- [x] Firefox AMO: `web-ext sign` timeout 240s MA server ha accettato; verificato via API: `current_version: "3.5.70"`, `status: "public"`
- [x] Annuncio Telegram @adoffapp (sempre in inglese) con changelog
- [ ] **Safari/Mac App Store**: da fare su Mac con Xcode

### v3.5.69 — fix login Google multi-sottodominio (09/08)

Login Google e OAuth bloccati su siti multi-sottodominio (es. minitmax.io). Root cause: `isSameSiteUrl` confrontava sottodomini esatti invece di registrable domain. Fix con `new URL()` + confronto `hostname` + `eTLD+1`. Commit `798c0f0`, pushato e pubblicato su tutti i canali.

### v3.5.68 — video a un clic fallback (08/08)

Rimossa riemissione CONTENT_RESUME_REQUESTED che causava il toggle (4o click richiesto). Aggiunto fallback play()/pause() per gestire iframe dei player. Commit `ee60852`.

### v3.5.61 — audit riga per riga + due bypass Pro chiusi (04/08)

Audit integrale dei quattro core. Sei bug confermati. Due critici: attributo DOM `data-adoff-loaded` accettava qualsiasi valore (patch: `window.__adoffContentLoaded` isolato ISOLATED world); `isTrialActive()` in content.js aveva fallback su `adoffTrialEnd` scrivibile da DevTools (patch: solo token firmato ECDSA). Test anti-regressione 58 asserzioni validato con mutation testing. Commit `621210d`.

### v3.5.60 — popunder streaming-community.red (04/08)

Root cause: popup blocker viveva in stealth.js senza `all_frames`, girava solo nel frame principale. I popunder partono dall'iframe del player. Fix: estrazione in `popup-blocker.js` con `all_frames: true`, regole DNR Monetag alla fonte, difese aggressive solo dentro iframe non fidati. Zero popunder confermati. Commit `e0df48e`, `82051ec`, `49c51f8`.

### v3.5.59 — rule-feed mai applicato (02/08)

Client: 35.143 regole a una sola `updateDynamicRules()` atomica, sfondava il limite e falliva silenziosamente. Feed: 35.000 regole con sintassi regex in `urlFilter` (accetta solo ABP), inerti. Fix: chunking + cap `MAX_NUMBER_OF_DYNAMIC_RULES` (30.000), throttle 6h, normalizzazione ABP, generatore riscritto. Da 0 a 29.900 regole in 3s. Commit `c10120d`, `5da1a0a`.

### v3.5.58 — SABR YouTube risolto (02/08)

Root cause: SABR (Server-Side Ad Insertion) — YouTube non serve piu' URL diretti, ogni segmento passa dal server che decide. Nessun adblock MV3 puo' bloccarlo senza seek. Soluzione: cold-load (oggetto senza streamingData forza richiesta intercettabile), hook JSON.stringify, qualita' 144p durante l'annuncio, ricarica di soccorso. Confermato dall'utente. Commit `7d52b88`.

### v3.5.54 — overlay SSAI + playbackRate (31/07)

Overlay invisibile nero brandizzato durante `ad-showing` (z-index 999999). Cattura e ripristino playbackRate. Deploy CWS, AMO listed, Edge, sito, Telegram msg 93. Commit `8914ab8`.

### v3.5.45-3.5.53 — saga YouTube (30/07)

Race condition Layer A (strip perdeva la corsa), instant-skip ripristinato (3.5.43), RIMOSSO IL SEEK (3.5.52, forma FadBlock pura), Layer A strip ricorsivo (3.5.53: adBreaks/adConfig strippati, midroll -80%, preroll eliminati).

### v3.5.41 — REGOLA 178 RIMOSSA (29/07)

Regola 178 bloccava lo stream del contenuto (`ctier=L` = content tier, non ad marker). Schermo nero 10-15s. Regole 144→143. Commit `79bd308`.

### v3.5.44 — BUG CRITICO LICENZE (29/07)

Ogni pagante declassato a Free a ogni avvio. `revalidateLicense()` aggiornava `lastValidated` senza ricalcolare `adoffIntegrity`. Gate in content.js lo vedeva come manomesso. Commit `xxx`.

### v3.5.38 — anti-detection (28/07)

Merge-accessor su `googletag`/`adsbygoogle`: i siti sovrascrivevano lo spoof. Ora 18 chiavi stabili. Wall investing.com sparito. Commit `xxx`, pushato e pubblicato.

---

## 🔴 BLOCCANTI (soldi / produzione)

- [ ] **Refill wallet VPNresellers: ~24,74 USD → 100+ USD.** A ~1,99 USD/account copre ~12 attivazioni. Oltre soglia: provisioning VPN fallisce → incasso senza consegna. Azione dell'utente. Saldo verificabile via API con `VPNRESELLERS_API_KEY` gia' impostato.
  - refs: `CP_20260729_1757` §To-Do 1, `PROGRESS-vpn-premium.md`

---

## 🟠 RELEASE E CANALI

- [x] **v3.5.70** — CWS in review, Edge in review, AMO public (3.5.70.xpi), sito live su feat/premium-vpn, Telegram msg 114.
- [ ] **Safari/Mac App Store v3.5.70** — richiede Mac con Xcode. Da fare quando disponibile.
  - Comando: `node sviluppo/scripts/build.js --target safari`
  - Poi da Mac: aggiornare progetto Xcode + Product → Archive → Distribute App → App Store Connect
  - Done when: submission visibile su App Store Connect
- [ ] **Monitorare review Microsoft Edge** — submission id `cf630582-d1a6-4a76-a056-bd3c9fd54420`, in review. Nessuna azione finche' non arriva notifica.

---

## 🟡 TECNICI — decisioni e verifiche aperte

- [ ] **Decidere il destino dell'interruttore "Compatibilita' piattaforme video".** Oggi disarma la protezione YouTube. La causa per cui era nato (regola 178) non esiste piu'. Rischio: utente lo lascia acceso dopo debug e crede che AdOff sia rotto.
- [ ] **Hash integrita' licenza fragile.** `adoffIntegrity` calcolato su TUTTO l'oggetto licenza: qualunque campo aggiunto lo invalida. Valutare hash su sottoinsieme stabile (`rawKey`, `plan`, `expires`). Decisione prima del prossimo cambio schema.
- [ ] **Regola 179** (`videoplayback*oad=`, Pro-only) mai verificata: stessa famiglia della 178 rimossa. Se lo schermo nero ricomparisse in Pro, e' il sospetto numero uno.
- [ ] **`validate_site.py:46` falso positivo** su 233 file: segnala "trial 30gg" mentre il prodotto fa 15. E' la regola del validatore a essere sbagliata, non il sito.
- [x] **Cron SEO gira nella directory sbagliata**: `~/Dropbox/…` (quasi vuota) invece di `/mnt/backup/…`. Keyword research fallita da 5 settimane. — risolto 2026-09-06, commit `7f3a4df`
- [ ] **`constants.json` allineato a 3.5.70** nel prossimo giro di build sito.

---

## 🟢 SITO / SEO / CONTENUTI

- [ ] **Cluster keyword gap: YouTube / Chrome / Android / Twitch / "gratis"** — 581 keyword raccolte, 80 gap. Da coprire con contenuto nuovo.
- [ ] **4 pagine con testo italiano non tradotto**: `fr/license-guide`, `ru/license-guide`, `tr/license-guide`, `tr/adblock-detector`.
- [ ] **`mockup.webp` ha "v3.1.0"** stampato dentro — da rigenerare.
- [ ] **GA4 historical data** — crescono col tempo, nessuna azione.

---

## 🔒 CONGELATI (bloccati da dipendenze)

- **Premium FASE 2**: VPN mobile + Kill-switch + DNS Guard freemium — bloccato dal refill wallet.
- **Premium FASE 3**: SEO guide / FAQ AEO / analytics / anti-churn / GO-LIVE checklist — bloccato da FASE 2.
- **Premium FASE 3**: canali Telegram EN / email Pro / social / in-app — bloccato da FASE 2.

---

## ⛔ DO NOT — vincoli permanenti

> Documentazione completa architettura video 3.5.84: `Memoria/progetti/AdOff/decisioni/architettura-video-3584.md`.

- **MAI duplicare a mano la lista dei nomi di piano** — usare sempre `adoffPlanTier()`. Otto gate con liste diverse tenevano gli abbonati `annual` e `premium_*` senza NESSUNA difesa attiva (fix 3.5.77, presidiato da `sviluppo/tests/test-plan-tier-consistency.js`).
- **MAI congelare il range di qualita' sul massimo** (`setPlaybackQualityRange(max, max)`): manda in stallo il player quando parte un annuncio privo di quella risoluzione → schermo nero perenne (regressione 3.5.80, corretta in 3.5.81). Il range va tenuto aperto verso il basso.
- **MAI abbassare la qualita' fuori da `abbassaQualitaAnnuncio`**: l'abbassamento e' lecito SOLO per la durata dell'annuncio, e SOLO perche' esiste `forzaQualitaMassima` che rialza. Senza quel presidio si torna al "144p persistente" della 3.5.57.
- **MAI seekare senza la guardia su `videoDetails.lengthSeconds`**: se `video.duration` coincide con la durata del contenuto, il media montato E' il contenuto (YouTube marca `ad-showing` PRIMA di scambiare la sorgente) e saltare manda avanti il video dell'utente. Nove versioni di bug hanno questa causa. Senza riferimento sulla durata del contenuto → nessun seek.
- **NON dedurre "e' SSAI" da una differenza di durata**: con vero SSAI il player non marca nemmeno `ad-showing`. La deduzione affrettata ha prodotto la guardia invertita della 3.5.83, che saltava dentro il contenuto.
- **MAI reintrodurre `video.currentTime =` in `activateYoutubeRuntimeKiller`.** Regola d'oro: 9 versioni di bug (3.5.46→3.5.51) nate dal seek.
- **MAI merge di `feat/premium-vpn` su `main`.** `main` e' il repo pubblico open-core (`github.com/eroslifestyle/adoff`), fermo a 3.5.36.
- **NON riattivare lo stall watchdog (Layer D)** — faceva seek.
- **NON rimuovere l'instant-skip (`playbackRate=16`)** — e' l'unico fallback per gli annunci che superano il Layer A.
- **NON usare `wrangler pages deploy site/` diretto** — bypassa il gate i18n. E serve `--branch main` esplicito per production.
- **NON deployare senza OK esplicito dell'utente.**
- **MAI passare l'intero feed a una sola `updateDynamicRules()`** e **mai usare `MAX_NUMBER_OF_DYNAMIC_AND_SESSION_RULES` (5.000)**.
- **NON pubblicare `site/rules-feed.json` senza normalizzazione ABP**.
- **NON rimuovere Safari dalle pagine del sito**.
- **NON toccare `app/src/graphify-out/`** (era 84 MB nel posto sbagliato).
- **NON forzare il commit di `.claude/checkpoints/` con `-f`**.
- **NON rilassare le guardie di `translate_batch.py`** senza verifica dei tag HTML.
- **NON aprire le vendite Premium prima del refill wallet.**
- **MAI rimuovere il try/catch annidato attorno a `window.open = safeOpen`** in `popup-blocker.js`.
- **NON applicare `configurable: false` su `window.open`**.
- **MAI aggiungere alla blacklist Layer 1 TLD usati da siti legittimi (.pro .store .shop .online .live .link .work .press)**.
- **NON mettere `all_frames` su `stealth.js`**.
- **NON bloccare `v.vidxgo.co` con una regola di rete** — e' il player.

---

## ❌ FAILED APPROACHES — non riprovare

**Video / YouTube**
- **Seek su player MSE YouTube** (6 versioni di guardie): la causa era il seek stesso.
- **Guardia sul cambio di durata** per distinguere annuncio da contenuto: `ad-showing` viene marcato prima dello scambio di sorgente.
- **Hardcoded `playbackRate = 1` in `onAdEnd`**: scartava la velocita' scelta dall'utente. Fix con `savedRate`.
- **403 su `googlevideo.com`**: NON e' un bug AdOff. Sono su `itag=18` deprecato.
- **Test diag-yt-skipads.js** (forza Pro via nonce): non probante, player headless non parte mai per autoplay policy.

**Video / YouTube (2026-08-19)**
- **`eSsai`/`saltaAnnuncioCucito` (3.5.83)**: guardia invertita, saltava quando il media montato era il contenuto. Rimosso in 3.5.84.
- **Alzare la qualita' UNA SOLA VOLTA per video** (prima stesura di `forzaQualitaMassima`): YouTube riapplica la propria preferenza dopo di noi, quindi serve un controllo continuo con throttle.
- **Il fast-forward a 16x come soluzione all'attesa**: non salta l'annuncio, lo SCARICA (16 secondi di stream per secondo reale) — l'attesa e' di rete e nessuna taratura la elimina. Resta valido solo come ripiego.

**Store / deploy**
- **`web-ext sign --channel listed`** → timeout infinito. Usare API REST diretta AMO.
- **AMO upload senza `channel`** → HTTP 400.
- **Upload CWS mentre review precedente aperta** → `ITEM_NOT_UPDATABLE`.
- **`GET /submissions/draft/package` su Edge** → 404: l'endpoint non esiste.
- **Cache purge Cloudflare via token scope Pages/D1** → `10000 Authentication error`.

**Test**
- **Playwright con `channel:"chrome"`**: non inietta content script in `world:MAIN`. Usare `chromium` bundled + `xvfb`.
- **Contare schede aperte senza escludere URL chrome-extension**: la pagina di onboarding viene scambiata per un popunder.
- **Verificare file generati solo con `node --check`**: i delimitatori markdown passano il check e falliscono a runtime.

---

## 📎 Riferimenti

| Cosa | Dove |
|---|---|
| Checkpoint piu' recente | `.claude/checkpoints/CP_20260811_0717.md` |
| Vault progetto | `~/Obsidian/Memoria/progetti/chromeplugin/` |
| Pagina vault unificata | `~/Obsidian/Memoria/progetti/chromeplugin/_INDEX.md` |
| Secrets store | `~/.secrets/adoff-stores.env` |
| Piano VPN Premium | `.claude/PROGRESS-vpn-premium.md`, `.claude/PLAN-vpn-dns-redesign.md` |
