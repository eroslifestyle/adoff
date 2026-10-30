# Piano — Sistema Auto-Fix Ad-Leak & Uninstall-Reason Notturno

## Obiettivo
Sistema autonomo che ogni notte alle 00:00 (Europe/Rome) intercetta i bug dietro le
motivazioni di disinstallazione (a partire da "ads ancora visibili"), li analizza in
dettaglio, genera e deploya fix, con guardrail forti e reporting completo.

## Vincolo dominante (VERIFICATO)
La privacy policy pubblica (15 lingue, riga 142 di site/privacy.html) dichiara:
"AdOff NON raccoglie cronologia/URL dei siti visitati". => NIENTE raccolta silenziosa
di domini. Tutto ciò che riguarda dati-utente passa da **opt-in esplicito**.

## Scoperta bloccante (VERIFICATA)
`syncRemoteRules()` + `REMOTE_RULES_URL=https://adoff.app/rules-feed.json` (id 60000+,
solo block/allow, no store review) esistono SOLO nella copia in conflitto Dropbox del
22/06, NON nel background.js ATTIVO di nessuno dei 3 target. Il canale di hotfix è
progettato ma NON in produzione. => Va rimesso in linea PRIMA di tutto (Fase 0).

---

## Decisioni utente (raccolte in planning — 15 domande)
1. Privacy: **solo consenso esplicito opt-in**
2. Fonte dati: **ibrido crawler + survey**
3. Crawler: **leobox / Playwright locale** (riusa harness sviluppo/reviews, chromium bundled + xvfb)
4. Lista siti: **top per paese/categoria (da GSC/D1) + domini dai survey** (auto-arricchente)
5. Autonomia: **auto-fix + deploy senza conferma** (con guardrail sotto)
6. Guardrail (TUTTI): regression test-suite canary + rollback/snapshot + cap giornaliero + notifica TG post-deploy
7. Canale fix: **ibrido** — hotfix via remote rule-feed ogni notte, consolidamento nel manifest a batch settimanale
8. Detection ad sfuggita (TUTTE): request ad-network non bloccata + elemento DOM visibile + video ad non skippato + screenshot/diff visivo
9. LLM: **solo Opus/Claude** per analisi e generazione regole
10. Survey UX: **campo opzionale "su quale sito?" + checkbox consenso** (nulla parte senza spunta)
11. Scope motivazioni: **tutte e 4** (ads visibili + sito rotto + complicato + rallenta), pipeline estendibile
12. Reporting (TUTTI): tab admin dedicata + report Telegram giornaliero + log file versionato
13. Free/Pro: **crawler testa in modalità Pro**; leak da utenti Free = segnale marketing/upsell (report separato), NON bug da fixare
14. Rete crawler: **parti con Mullvad multi-location (gratis, IP protetto)**; crawler **proxy-agnostico** (endpoint/cred da config) per aggiungere proxy residenziali per-paese dopo, se serve geo-fedeltà
15. Profondità crawl: **scenari mirati per tipo sito** (video→apri video+attendi pre-roll · news→apri articolo · streaming→avvia player · e-commerce/blog/forum→pagina interna)
16. Scala: **rotazione adattiva** (ogni notte: top-N prioritari + fetta a rotazione del resto → copertura completa in più giorni senza saturare)
17. Siti sensibili: **SOLO allowlist di categorie sicure** (news, video, streaming, blog, e-commerce, forum); banking/salute/adult/login-gated mai visitati
18. Verifica fix: **A/B nello stesso giro** (leak con feed attuale vs feed+candidata; valida se il leak sparisce E la canary regge)
19. Dedup/stato: **stato per-leak con fingerprint** (dominio+ad-network+tipo → open/fixed/regressed in D1); non ri-apre i fixed salvo regressione
20. Storage stato: **ibrido D1 (verità) + KV snapshot** pre-calcolato per dashboard veloce (pattern GSC)
21. leobox→worker: **POST autenticato** a `/admin/autofix/ingest` (admin token, riusa pattern esistente); il worker scrive D1+KV
22. Fonte verità feed: **doppio — repo/Pages primario + worker/KV fallback** (git versionato, rollback=revert; worker serve copia di riserva)
23. Refresh feed client: **ogni ~6-12h + allo startup** (allineato all'alarm giornaliero esistente)
24. Lista ad-network: **derivata dalle regole AdOff + rules-feed, integrata con liste pubbliche** (EasyList/EasyPrivacy) come riferimento, auto-aggiornabile
25. Kill-switch: **flag KV `autofix:enabled` + comando Telegram** (fermata istantanea da ovunque) + dashboard
26. Escalation: **alert Telegram dopo N notti fallite (es. 2) + apertura automatica task** (voce in TODO.md/PROGRESS.md per leak irrisolti)
27. i18n survey: **tutte e 15 le lingue** via sistema i18n centralizzato (site/i18n/_matrix.json + i18n_manager)
28. Update legale: **privacy 15 lingue + changelog** (clausola diagnostica volontaria: dominio-only, opt-in, cancellabile, data revisione) — PRIMA di raccogliere qualsiasi dominio
29. Batch settimanale: **semi-automatico con approvazione** (prepara diff feed→manifest + build, ma release store parte solo su tuo OK)
30. Cookie-banner/CMP: **auto-dismiss best-effort** (selettori CMP noti; se fallisce → registra 'blocked-by-cmp' e passa oltre)
31. Rollout iniziale: **shadow mode le prime notti** (rileva+genera+valida canary MA non deploya, solo report; poi accendi auto-deploy)
32. Costruzione: **tutte le fasi in sequenza (0→6)**, via **workflow multi-agente (ultracode)** — richiede parola "ultracode" nel prompt di avvio

---

## Architettura

```
                       ┌─────────────── leobox (00:00 cron) ───────────────┐
  [survey opt-in]      │  1. build target-list (top-siti + domini survey)   │
  utente uninstall ───▶│  2. crawler Playwright (AdOff installata, xvfb)     │
  worker D1            │     rileva: net-req / DOM / video-ad / screenshot   │
       │               │  3. Opus: analizza leak → genera candidate rules    │
       │               │  4. GUARDRAIL: canary regression + cap N/notte      │
       │               │  5. snapshot + apply su rules-feed.json             │
       │               │  6. deploy CF Pages (feed live) + rollback-on-fail   │
       │               │  7. report: admin API + Telegram + log versionato   │
       └──────────────▶└────────────────────────────────────────────────────┘
```

---

## Fasi

### FASE 0 — Ripristino canale hotfix (PREREQUISITO bloccante)
- Reintegrare `syncRemoteRules()` + `REMOTE_RULES_URL` + `REMOTE_RULES_BASE_ID=60000`
  nel background.js ATTIVO di **tutti e 3** i target (Chrome/Firefox/Safari).
- Recuperare la logica dalla copia in conflitto del 22/06 (validandola, non copiando cieco).
- Verificare che il client scarti redirect/modifyHeaders (solo block/allow, come da _comment).
- Test: feed con 1 regola nota → syncRemoteRules la applica in una install reale (Playwright).
- Bump versione 3 manifest + build + deploy store (batch) — questo È il primo "batch consolidation".

### FASE 1 — Survey opt-in arricchito (raccolta dominio consensuale)
- **site/uninstall.html**: quando reason = "ads_visible" (e per gli altri motivi rilevanti),
  mostrare campo opzionale "Su quale sito hai ancora visto pubblicità?" + checkbox
  "☐ Invia questo indirizzo per aiutarci a risolvere" (default OFF).
- **worker.js handleUninstall**: accettare campo `problem_domain` SOLO se `consent === true`;
  normalizzare a registrable domain (no path/query/subdomain-tracking); scartare se assente consenso.
- Nuova colonna/tabella D1: `adleak_reports (domain, reason, version, country, ts)`.
- **Privacy policy update** (15 lingue): clausola "Diagnostica volontaria — se acconsenti
  esplicitamente, puoi inviarci il solo nome di dominio di un sito problematico".
- Guardrail privacy: onore stretto del consenso, dominio-only, no per-utente linkage.

### FASE 2 — Crawler notturno (leobox / Playwright)
- Dir nuova: `sviluppo/autofix/` (fuori da app/, mai deployata nell'estensione).
- `build_target_list.py`: unisce (a) top-siti per paese/categoria dai paesi attivi (GSC/D1)
  (b) domini dai survey opt-in (adleak_reports). Ogni target etichettato con **categoria**
  e **tipo-sito**. **Allowlist categorie sicure** (news, video, streaming, blog, e-commerce,
  forum): tutto ciò che non rientra è scartato a priori (banking/salute/adult/login-gated).
  **Rotazione adattiva**: output `targets.json` = top-N prioritari + fetta a rotazione del resto.
- **Rete**: crawler **proxy-agnostico** — legge exit/proxy da config (`net.json`). Fase 1
  usa Mullvad multi-location (rotazione exit-node, IP sempre protetto); slot per proxy
  residenziali per-paese aggiungibili dopo senza toccare il codice.
- `crawl.mjs` (Playwright, chromium bundled da sviluppo/reviews, xvfb headed, AdOff caricata
  **in modalità Pro** — trial/token attivo offline, così testiamo il prodotto pieno incluso IMA-stub):
  - **scenari mirati per tipo-sito**: video→apri un video e attendi il pre-roll · news→apri
    un articolo · streaming→avvia il player · e-commerce/blog/forum→apri una pagina interna.
  - **auto-dismiss CMP best-effort**: chiude i cookie-banner/consenso comuni (selettori CMP
    noti); se non riesce → marca 'blocked-by-cmp' e passa oltre (non falsa i risultati).
  - raccoglie i 4 segnali di detection (network non-bloccate verso ad-network noti · elementi
    DOM ad residui · video-ad non skippato · screenshot+diff visivo).
  - output `findings/<date>.json`: {domain, category, site_type, leak_type, evidence,
    request_urls, dom_selectors, screenshot_path}.
- **Nota Free/Pro**: il crawler testa in Pro → ogni leak trovato è un bug reale del prodotto
  pieno. I lamenti "ads_visible" provenienti da survey di utenti **Free** vengono marcati a
  parte (segnale marketing/upsell, non entrano nella pipeline di fix — vedi Fase 5).

### FASE 3 — Analisi + generazione fix (Opus)
- `analyze_and_fix.mjs/.py`: passa i findings a Opus con contesto (regole attuali,
  formato rules-feed, id range 60000+, solo block/allow, ad-network list derivata).
- Opus produce: (a) diagnosi per-leak (b) candidate rule(s) block/allow (c) confidence.
- Per leak di tipo "sito rotto" (reason broken_site): Opus propone una regola ALLOW o
  la rimozione/whitelist di una regola troppo aggressiva (rovescio dell'ad-leak).
- Anti-allucinazione: ogni candidate rule validata sintatticamente contro lo schema DNR.
- **Fingerprint leak** = hash(dominio + ad-network/selettore + leak_type); usato per dedup/stato.

### FASE 4 — Guardrail + deploy (auto, con reti di sicurezza)
- **A/B nello stesso giro**: per ogni candidata, il crawler ri-testa il sito (i) con feed
  attuale → leak presente (ii) con feed+candidata → leak deve sparire. Valida SOLO se il
  leak si chiude E nessun canary si rompe.
- **Canary regression suite** (`canary.json`): siti-noti-funzionanti per categoria; ri-testati
  CON le candidate; se un canary si rompe → scarta quella regola + avvisa.
- **Cap giornaliero**: max N (default 5, shadow-mode 2) regole nuove/modificate per notte.
- **Stato per-leak** (D1 `autofix_leaks`): fingerprint → open/fixed/regressed; non ri-genera
  ciò che è già fixed salvo regressione rilevata.
- **Snapshot**: salva rules-feed.json corrente + hash prima di ogni modifica (sviluppo/autofix/snapshots/).
- **Apply**: append/merge regole approvate in site/rules-feed.json (bump version+updated).
- **Deploy**: `wrangler pages deploy site/` (feed live) + push copia a worker/KV (fallback).
- **Rollback automatico**: giro successivo ri-verifica; se regressione → ripristina snapshot + avvisa.
- **Kill-switch**: prima di ogni deploy controlla flag KV `autofix:enabled`; se OFF → solo report.
- **Shadow mode** (prime notti): esegue rileva→genera→valida-canary→A/B MA salta il deploy;
  produce solo report per verifica qualità. Si disattiva accendendo l'auto-deploy.
- **Escalation**: leak 'open'/canary 'regressed' per ≥N notti (default 2) → alert Telegram
  prioritario + apertura voce automatica in .claude/TODO.md.
- **Batch settimanale** (separato, semi-auto): prepara diff feed→adblock-rules.json dei 3 target
  + build, ma la release store parte solo su approvazione esplicita (release = irreversibile/pubblica).

### FASE 5 — Reporting (3 canali)
- **Ingest**: leobox pusha i risultati del giro a `POST /admin/autofix/ingest` (admin token,
  dietro Mullvad); il worker scrive D1 (verità) + rigenera KV snapshot per la dashboard.
- **Admin dashboard**: nuova tab "Auto-Fix / Ad-Leak" in site/admin.html + endpoint worker
  (`/admin/autofix/status`): siti testati, leak trovati, regole deployate, rollback, trend.
  **Due pannelli separati**: (a) **Bug reali** (leak in modalità Pro dal crawler → auto-fix);
  (b) **Segnale marketing** (survey "ads_visible" da utenti Free = aspettativa video-block non
  soddisfatta → onboarding/upsell, non bug). Dati da KV/D1 popolati dal giro notturno
  (push da leobox via endpoint admin-auth).
- **Telegram**: report giornaliero in topic dedicato (N siti testati / N fix / N rollback /
  highlight + conteggio segnale-Free separato).
- **Log versionato**: `sviluppo/autofix/logs/<date>.jsonl` + storico diff regole per audit.

### FASE 6 — Orchestrazione & scheduling
- `autofix_nightly.sh`: entrypoint unico (build-list → crawl → analyze → guardrail → deploy → report),
  con `flock` (come gli altri cron del progetto).
- Cron: `0 0 * * *` Europe/Rome (00:00). Log err in sviluppo/logs/.
- Kill-switch + dry-run flag per test senza deploy reale.

---

## File toccati / creati (stima)
- MODIFICA: app/src/background.js + app-firefox + app-safari (Fase 0, syncRemoteRules)
- MODIFICA: site/uninstall.html, worker.js (handleUninstall + admin endpoint + D1 schema)
- MODIFICA: site/privacy.html (+ 14 lingue), site/admin.html (tab), site/rules-feed.json (runtime)
- NUOVI: sviluppo/autofix/{build_target_list.py, crawl.mjs, analyze_and_fix, guardrails, autofix_nightly.sh, targets.json, canary.json, net.json (config proxy/exit), category-allowlist.json, snapshots/, findings/, logs/}
- Cron entry + crontab

## Ordine di esecuzione (deciso: TUTTE le fasi in sequenza)
Fase 0 → 1 → 2 → 3 → 4 → 5 → 6, costruite in sequenza in un'unica campagna.
**Modalità build: workflow multi-agente (ultracode)** — fan-out per fasi indipendenti
(es. i18n survey ∥ tab admin ∥ crawler ∥ worker endpoint), verifica evidence-gate nel main,
propagazione ai 3 target, deploy. Richiede la parola "ultracode" nel prompt di avvio.
**Shadow mode attivo di default** finché non accendi l'auto-deploy.

## Sequenza di consegna valore
- Fase 0 sblocca il canale hotfix (senza cui nulla si deploya).
- Fase 1 attiva il survey opt-in → raccolta segnali umani da subito.
- Fasi 2-4 sono il cuore autonomo (crawler + Opus + guardrail), in shadow mode all'inizio.
- Fasi 5-6 danno visibilità e scheduling.

## Rischi / Do-NOT
- NON raccogliere domini senza checkbox consenso spuntata (viola privacy pubblica).
- NON deployare regole che falliscono la canary suite.
- NON superare il cap giornaliero (anti rule-sprawl).
- NON auto-consolidare nel manifest store ogni notte (solo batch settimanale).
- Crawler SOLO in sviluppo/autofix/, mai dentro app/ (non deve finire nell'estensione).
- Rispettare id range 60000+ del feed (non collidere con 50001/50002 IMA, 51000+ whitelist).
- NON visitare siti fuori dall'allowlist di categorie sicure (mai banking/salute/adult/login-gated).
- NON esporre mai l'IP reale di leobox: crawler esce SEMPRE via Mullvad (o proxy configurato),
  mai connessione diretta (regola permanente [[leobox_always_protected_invisible]]).
- NON trattare i lamenti "ads_visible" di utenti Free come bug: il video-block è Pro-only by design.
- Proxy residenziali = spesa + eccezione alla regola Mullvad → attivarli solo su decisione esplicita.
