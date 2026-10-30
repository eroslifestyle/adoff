# Prompt standalone per nuove chat — AdOff Premium VPN

> Ogni blocco qui sotto è un prompt COMPLETO da incollare in una CHAT NUOVA (da zero).
> Nessun contesto di sessioni precedenti richiesto: ogni prompt è autosufficiente.
> Design congelato: `.claude/PLAN-vpn-dns-redesign.md` · Stato: `.claude/PROGRESS-vpn-premium.md`

---

## ► SETUP GIT (esegui UNA VOLTA prima di lanciare le chat)

Crea il branch di integrazione e un worktree isolato per ogni chat, così le chat lavorano in parallelo senza pestarsi i piedi sul working tree. Ogni worktree è una cartella separata con il suo branch.

```bash
cd "/mnt/backup/Dropbox/1 Programmazione/Progetti/ChromePlugin"

# 1) branch di integrazione (da master)
git checkout master && git pull
git checkout -b feat/premium-vpn

# 2) un worktree + branch per ogni chat (cartelle sorelle in ../)
git worktree add ../adoff-worker   -b feat/premium-vpn-worker   feat/premium-vpn
git worktree add ../adoff-ext      -b feat/premium-vpn-ext      feat/premium-vpn
git worktree add ../adoff-mobile   -b feat/premium-vpn-mobile   feat/premium-vpn
git worktree add ../adoff-desktop  -b feat/premium-vpn-desktop  feat/premium-vpn
git worktree add ../adoff-site     -b feat/premium-vpn-site     feat/premium-vpn
git worktree add ../adoff-test     -b feat/premium-vpn-test     feat/premium-vpn

git worktree list   # verifica
```

Poi apri ogni chat con la sua working dir = il worktree corrispondente:
- Chat 1 Worker → `../adoff-worker`  · Chat 2 Estensione → `../adoff-ext`
- Chat 3 Mobile → `../adoff-mobile`  · Chat 4 Desktop → `../adoff-desktop`
- Chat 5 Sito → `../adoff-site`     · Chat 6 Test → `../adoff-test`
- Chat 7 Merge → la cartella principale (branch `feat/premium-vpn`)

**Ordine di lancio**: prima Chat 1 (crea `API-CONTRACT-vpn.md`) e Chat 5 (crea `SPEC-checkout-premium.md`); poi 2/3/4/6 in parallelo; infine Chat 7 per il merge.

> **Nota**: i file `.claude/PLAN-*`, `PROGRESS-*`, `API-CONTRACT-*` vivono nel branch `feat/premium-vpn`. Se un worktree non li vede, fai `git merge feat/premium-vpn` nel worktree per allinearlo, oppure leggi i file dalla cartella principale (stesso disco). A fine lavoro, cleanup: `git worktree remove ../adoff-<area>`.
>
> **Alternativa senza worktree** (più semplice, seriale): salta il setup, lavora tutti nella cartella principale creando solo i branch `feat/premium-vpn-<area>` e cambiando branch tra una chat e l'altra. In quel caso NON lanciare le chat in parallelo (una alla volta per branch).

---

## ► CHAT 1 — WORKER (backend, spina dorsale)

```
Progetto AdOff — estensione ad-blocker + tier VPN "Premium". Working dir: /mnt/backup/Dropbox/1 Programmazione/Progetti/ChromePlugin

Sto riprogettando il sistema VPN. Le decisioni complete sono già scritte: leggi PRIMA .claude/PLAN-vpn-dns-redesign.md (soprattutto le sezioni "Schema licenza & pagamenti", "Anti-abuso / sicurezza", "Controllo costi VPN", "FASE 0") e .claude/PROGRESS-vpn-premium.md. Rispetta quelle decisioni come contratto.

Il tuo compito è la FASE 0 lato backend. Tocca SOLO questi file: sviluppo/license-system/worker.js, un nuovo modulo sviluppo/license-system/vpn-module.js, sviluppo/license-system/wrangler.toml.

Contesto tecnico verificato:
- Il worker parla con VPNresellers.com API v4.1 (base https://api.vpnresellers.com/v4_1, project_id=102, secret env.VPNRESELLERS_API_KEY). Costo $1,99/account/mese, 1 account = 10 connessioni simultanee.
- La logica VPN è oggi nel worker.js intorno alle righe 7960-8285 (handleVpnServers/Profile/GetConfig/CreateAccount/DeleteAccount/EnableDisable, vpnApiCall).
- Esiste già un sistema di token firmato ECDSA P-256 (trial anti-crack): riusa importTrialMobilePubKey / crypto.subtle.verify.

Cosa fare:
1. Estrai la logica VPN dal worker.js in un modulo vpn-module.js importato dal worker.
2. Gating server-side su OGNI /vpn/*: verifica il token licenza Premium ECDSA (tier=premium attivo) prima di agire; senza token valido → 403. Aggiungi nonce/timestamp anti-replay. (Oggi gli endpoint sono pubblici = falla: chiunque li chiama via curl.)
3. BUG da fixare: /vpn/create — il client manda solo "email" ma l'handler pretende username+password → genera username+password lato worker. Lega l'account al deviceId del token (1 account per licenza).
4. BUG da fixare: /verify-mobile-license risponde 405 (registrato solo per POST, ma il client mobile lo chiama in GET) → registralo anche per GET.
5. Rate-limit stretto su /vpn/create. Audit log D1 di create/enable/disable (chi/quando/accountId, MAI il traffico).
6. Cron Trigger Cloudflare giornaliero (wrangler.toml): disable account VPN inattivi >7 giorni + con abbonamento scaduto; auto-riattivazione trasparente alla riconnessione se Premium valido.
7. Scrivi .claude/API-CONTRACT-vpn.md documentando ogni endpoint /vpn/* (path, metodo, header auth, body, response JSON) — serve alle altre parti del progetto.

Vincoli: mai segreti hardcoded; mai loggare traffico/IP/siti utente (solo stato connessione per billing). Commit piccoli e frequenti. NON deployare in produzione senza mia conferma esplicita. Aggiorna la sezione FASE 0 in .claude/PROGRESS-vpn-premium.md quando finisci un blocco.
```

---

## ► CHAT 2 — ESTENSIONE (browser)

```
Progetto AdOff — estensione ad-blocker MV3 (Chrome/Firefox/Safari) + nuovo tier "Premium". Working dir: /mnt/backup/Dropbox/1 Programmazione/Progetti/ChromePlugin

Sto riprogettando la VPN. Decisioni complete: leggi PRIMA .claude/PLAN-vpn-dns-redesign.md (sezioni "VPN browser", "Struttura codice" per il badge, "Schema licenza") e .claude/PROGRESS-vpn-premium.md. Se esiste .claude/API-CONTRACT-vpn.md, leggilo.

Fatto tecnico chiave: nel browser MV3 una VPN NON può instradare traffico (VPNresellers espone solo WireGuard, chrome.proxy vuole proxy HTTP/SOCKS). Quindi la VPN va RIMOSSA dall'estensione e sostituita con un upsell verso le app native.

Il tuo compito (FASE 1 estensione). Tocca SOLO: app/src/ e propaga le stesse modifiche a app-firefox/src/ e app-safari/src/ (regola del progetto: i file condivisi devono restare identici tra i 3 target, salvo differenze strutturali note di firefox/safari).

Cosa fare:
1. RIMUOVI la UI VPN dal popup (in app/src/popup.js c'è vpnFetch/loadVpnState/toggleVpn intorno alle righe 488-626, + HTML in popup.html e CSS in popup.css). Elimina server select, connect/disconnect, download del file .conf.
2. Sostituisci con un UPSELL "AdOff Premium": (a) banner discreto nel popup ("VPN disponibile sulle app AdOff" + link download), (b) una sezione "AdOff Premium" con CTA al checkout, (c) una voce in options.
3. Badge licenza a 3 livelli: Free / Pro / Premium (Premium con icona/colore distinto). Aggiorna app/src/license-client.js perché esponga il tier (pro|premium) letto dal token licenza.
4. Rispetta la Version Congruence: la versione si legge a runtime da chrome.runtime.getManifest().version, mai hardcoded.

Vincoli: propaga OGNI modifica ai 3 target. Rispetta la Brand Name Policy (niente brand di terze parti nel codice). Commit piccoli. NON fare build/deploy senza mia conferma. Aggiorna la sezione FASE 1 (estensione) in .claude/PROGRESS-vpn-premium.md.
```

---

## ► CHAT 3 — MOBILE (Flutter/Android)

```
Progetto AdOff — app mobile Flutter (Android) con DNS-blocking + futura VPN. Working dir dell'app: /mnt/backup/Dropbox/1 Programmazione/Progetti/ChromePlugin/AdOff (il progetto principale è la cartella genitore).

Decisioni complete: leggi PRIMA ../.claude/PLAN-vpn-dns-redesign.md (sezioni "File structure mobile", "DNS Guard mobile", "Kill-switch", "Bug mobile license") e ../.claude/PROGRESS-vpn-premium.md. Se esiste ../.claude/API-CONTRACT-vpn.md, leggilo.

Stato attuale: l'app fa DNS-blocking via android.net.VpnService locale (TUN loopback, filtra query DNS su porta 53 contro una blocklist di ~349 domini in android/app/src/main/assets/blocklist.txt, upstream Cloudflare 1.1.1.1). Non nasconde l'IP, non cifra. Bridge Flutter↔Kotlin via MethodChannel "app.adoff/vpn".

Il tuo compito. Tocca SOLO la cartella AdOff/.

1. FIX (Fase 0): lib/services/license_service.dart chiama GET /api/verify-mobile-license. Aggiungi la verifica della firma ECDSA P-256 lato client Dart (oggi si fida ciecamente della risposta server) e controlla che payload.deviceId == deviceId locale.
2. DNS Guard freemium: espandi la blocklist statica da ~349 domini a migliaia importando liste pubbliche (EasyList / AdGuard DNS filter) in assets/blocklist.txt, + aggiungi un aggiornamento remoto (scarica una blocklist aggiornabile dal server, stesso pattern del rules-feed dell'estensione). Blocking base gratis, feature avanzate riservate a Pro.
3. FASE 2 (dopo che il test protocollo è deciso — vedi API-CONTRACT/TEST-REPORT): estendi VpnService.kt da DNS-filter locale a tunnel reale verso i server VPNresellers (WireGuard o OpenVPN secondo il test). Aggiungi kill-switch (blocca il traffico se la VPN cade) e il gating Premium (token verificato).
4. Allinea AdOff/README.md al codice reale (oggi dichiara Phase 3 come TODO ma è già implementata).

Vincoli: mai loggare traffico/IP utente. Commit piccoli. Aggiorna la sezione FASE 0/2 (mobile) in ../.claude/PROGRESS-vpn-premium.md.
```

---

## ► CHAT 4 — APP DESKTOP (nuova, Tauri)

```
Progetto AdOff. Working dir: /mnt/backup/Dropbox/1 Programmazione/Progetti/ChromePlugin

Devo creare una NUOVA app desktop VPN cross-platform (Windows/Mac/Linux) per il tier Premium di AdOff. Decisioni: leggi PRIMA .claude/PLAN-vpn-dns-redesign.md (sezioni "App desktop AdOff VPN", "UX scelta server", "Kill-switch", "Feature avanzate VPN") e .claude/PROGRESS-vpn-premium.md. Se esiste .claude/API-CONTRACT-vpn.md, leggilo.

Reference UX (da studiare, NON da copiare come backend): il progetto /mnt/backup/Dropbox/1 Programmazione/Progetti/vpn-tray (leggi il suo README.md e vpn-tray.py) è un applet tray Linux con ottima UX di scelta server (menu paese→città, web picker filtrato, fast-connect random, country-lock, auto-rotation). Riusa quella UX, ma il backend è VPNresellers (via gli endpoint /vpn/* del worker AdOff), NON Tailscale.

Il tuo compito. Crea tutto in una NUOVA cartella AdOff-desktop/. NON toccare nessun file esistente del progetto.

1. Stack Tauri (Rust + frontend web). Scaffold app desktop cross-platform.
2. UX: scelta server paese→città, web picker filtrato, fast-connect (server ottimale per latenza), country-lock, auto-rotation. Backend = endpoint /vpn/* del worker AdOff (vedi API-CONTRACT).
3. Verifica licenza Premium con lo stesso token ECDSA usato altrove. Kill-switch via firewall rules. Connessione lazy (on-demand).
4. Feature Premium: auto-rotation server + fast-connect + country-lock.

Vincoli: tutto isolato in AdOff-desktop/. Mai segreti hardcoded. Commit piccoli. Se non compila ancora, marca chiaramente lo stato WIP. Aggiorna la sezione FASE 2 (desktop) in .claude/PROGRESS-vpn-premium.md.
```

---

## ► CHAT 5 — SITO / PRICING / MESSAGING

```
Progetto AdOff. Working dir: /mnt/backup/Dropbox/1 Programmazione/Progetti/ChromePlugin

Devo aggiornare sito e pricing per il nuovo tier "Premium" (adblock + VPN). Decisioni complete: leggi PRIMA .claude/PLAN-vpn-dns-redesign.md (sezioni "Modello economico", "Prezzi Premium", "Strategia & brand", "Messaging", "Posizionamento competitor", "Legale VPN", "Presentazione valore") e .claude/PROGRESS-vpn-premium.md.

Il tuo compito (FASE 1+3 sito). Tocca SOLO site/ e docs/. NON toccare il worker (sviluppo/license-system/worker.js).

Prezzi Premium da usare: mensile €4,99 · annuale Founder €29,99 (primi 100, solo 1° anno) → €49,99 standard. Pro adblock base resta invariato (€2,99/mese, trial 30gg). NO Lifetime con VPN. Founder Premium = pool separato "X/100". Multi-valuta con prezzi fissi psicologici.

Cosa fare:
1. Landing /premium in 15 lingue (usa il sistema i18n esistente site/i18n/_matrix.json): bundle adblock+VPN, pain-point (privacy + ads insieme), onestà piattaforme (VPN sulle app, non nel browser), bundle value ("adblock+VPN a meno di una VPN da sola"), CTA "inizia gratis" (trial adblock come entry).
2. Aggiungi il tier Premium alle pagine pricing + aggiorna docs/PRICING-PLAN.md e site/data/constants.json (SSOT) — ma marca "PENDING test E2E": non è live finché i test non passano.
3. Pagine vs/ competitor (riusa il sistema vs/ SEO esistente): vs NordVPN/Proton, vs AdGuard VPN, vs Brave.
4. Documento "VPN Policy" dedicato: no-log, giurisdizione EU generica, cosa si traccia (solo stato connessione per billing, mai il traffico), P2P.
5. Scrivi .claude/SPEC-checkout-premium.md: la spec del checkout Stripe Premium (SKU, price_data inline, gating Founder, multi-valuta, PayPal + Apple/Google Pay + crypto USDT/USDC via BTCPay/Coinbase, upgrade Pro→Premium con proration) — la implementerà chi lavora sul worker.

Vincoli: rispetta la Privacy & Identity Protection (mai dati personali/PII in produzione) e la Brand Name Policy (nomi piattaforme ammessi solo nella copy marketing, mai loghi di terze parti). Congruenza pre-deploy (prezzi/versione/regole/lingue). NON deployare senza mia conferma. Aggiorna la sezione FASE 1/3 (sito) in .claude/PROGRESS-vpn-premium.md.
```

---

## ► CHAT 6 — TEST E2E + GATE MULTI-DEVICE + MONITORING

```
Progetto AdOff. Working dir: /mnt/backup/Dropbox/1 Programmazione/Progetti/ChromePlugin

Devo testare il nuovo sistema VPN Premium e produrre i report. Decisioni: leggi PRIMA .claude/PLAN-vpn-dns-redesign.md (sezioni "FASE 1bis Test E2E", "CHECKLIST GO-LIVE", "QA continuo VPN", "Monitoring VPN") e .claude/PROGRESS-vpn-premium.md. Se esiste .claude/API-CONTRACT-vpn.md, leggilo.

Il tuo compito. Tocca SOLO sviluppo/tests/vpn/ (nuovi test) e i file di report in .claude/ (*REPORT*). NON modificare codice di produzione.

1. GATE Fase 0 — test empirico multi-device (blocca il lancio VPN): script che, usando gli endpoint /vpn/* (vedi API-CONTRACT), scarica una config VPN reale e connette 2-3 device (o li simula), confrontando WireGuard VS OpenVPN — le connessioni coesistono o l'ultima fa cadere le altre (roaming-hijack)? Contesto: 1 account VPNresellers = 10 connessioni per doc, ma la config WireGuard è statica per (account,server), quindi il multi-device va verificato. Scrivi il verdetto e il protocollo default consigliato in .claude/TEST-REPORT-vpn.md.
2. Test E2E (gate prima di pubblicare i prezzi): Stripe test mode (checkout Premium completo simulato); account VPNresellers test reale (create/enable/config/disable via API); gating (curl a /vpn/* senza token Premium → deve dare 403 su tutti); no leak IP/DNS con VPN attiva; kill-switch (VPN cade → traffico bloccato).
3. QA continuo: smoke test giornaliero degli endpoint /vpn/*; alert se la lista server si svuota/cambia molto; regression test del gating ad ogni deploy.
4. Spec monitoring: alert balance reseller basso, dashboard admin (N account attivi × $1,99 = costo stimato), alert errori API VPNresellers, report settimanale del margine.

Vincoli: riporta i FALLIMENTI reali con l'output letterale (mai mascherare un fallimento come successo). Aggiorna la sezione FASE 1bis in .claude/PROGRESS-vpn-premium.md.
```

---

## ► CHAT 7 — MERGE / INTEGRAZIONE (da lanciare ALLA FINE)

```
Progetto AdOff. Working dir: /mnt/backup/Dropbox/1 Programmazione/Progetti/ChromePlugin

Devo integrare e verificare il lavoro parallelo sul tier VPN "Premium". Leggi: .claude/PLAN-vpn-dns-redesign.md, .claude/PROGRESS-vpn-premium.md, e (se esistono) .claude/API-CONTRACT-vpn.md, .claude/SPEC-checkout-premium.md, .claude/TEST-REPORT-vpn.md.

Cosa fare:
1. Integra i vari filoni di lavoro (worker, estensione, mobile, desktop, sito, test). Se hanno usato branch git separati, fai il merge in quest'ordine: worker → estensione → mobile → desktop → sito → test. I conflitti dovrebbero essere minimi (ogni parte possiede file distinti).
2. Verifica la coerenza globale: il tier si chiama SEMPRE "Premium" (mai "Pro+"); i prezzi sono congruenti (€4,99 / €29,99 / €49,99) tra sito, worker e docs; il gating server-side /vpn/* è attivo (non-Premium → 403); nessun leak di brand di terze parti o PII (grep pre-deploy); la versione si legge dal manifest.
3. Esegui la CHECKLIST GO-LIVE dal TEST-REPORT: nessun leak IP/DNS, kill-switch funzionante, gating 403, congruenza prezzi/versione/regole/lingue.
4. Riporta lo stato reale di ogni fase con evidenza (grep/diff/test con output). NON deployare in produzione senza mia conferma esplicita.
5. Aggiorna .claude/PROGRESS-vpn-premium.md con lo stato consolidato e crea un checkpoint in .claude/checkpoints/.
```
```
