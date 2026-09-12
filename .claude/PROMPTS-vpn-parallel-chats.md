# PROMPT per chat/agenti SIMULTANEI — AdOff Premium VPN

> Fonte decisioni: `.claude/PLAN-vpn-dns-redesign.md` (102 AQ). Stato: `.claude/PROGRESS-vpn-premium.md`.
> Ogni chat lavora su file DISTINTI + branch/worktree separato → merge pulito su `feat/premium-vpn`.
> Regole globali attive: MiniMax esegue il codice, main verifica (evidence-gate). Vedi ~/.claude/CLAUDE.md.

## STRATEGIA DI MERGE

1. Branch di integrazione: `git checkout -b feat/premium-vpn` (da master).
2. Ogni chat crea il suo branch: `feat/premium-vpn-<area>` (worktree isolato consigliato).
3. **Zero sovrapposizione di file** tra le chat (vedi "File posseduti" in ogni prompt) → merge senza conflitti.
4. Chat A (worker) è la SPINA DORSALE: definisce il contratto API. Le altre la consumano → **A parte per prima** o pubblica subito il contratto endpoint (path, payload, response) in `.claude/API-CONTRACT-vpn.md` che le altre leggono.
5. Merge order finale: A (worker) → B (estensione) → C (mobile) → D (desktop) → E (sito/pricing) → F (test E2E gate).
6. Ogni chat committa piccolo + aggiorna la sua sezione in `PROGRESS-vpn-premium.md`.

---

## CHAT A — Worker: gating + fix + auto-disable (FASE 0, SPINA DORSALE)

**File posseduti**: `sviluppo/license-system/worker.js` (blocco VPN + routing), nuovo modulo `sviluppo/license-system/vpn-module.js`, `sviluppo/license-system/wrangler.toml` (cron trigger). Pubblica `.claude/API-CONTRACT-vpn.md`.

```
Lavori su AdOff, progetto in "/mnt/backup/Dropbox/1 Programmazione/Progetti/ChromePlugin".
Leggi PRIMA: .claude/PLAN-vpn-dns-redesign.md (sezioni Schema licenza, Anti-abuso, Controllo costi, FASE 0) e .claude/PROGRESS-vpn-premium.md.
Branch: git checkout -b feat/premium-vpn-worker (da feat/premium-vpn).

OBIETTIVO (FASE 0 — sicurezza worker). Tocca SOLO: sviluppo/license-system/worker.js, nuovo sviluppo/license-system/vpn-module.js, wrangler.toml.

1. Estrai tutta la logica VPN (handleVpnServers/Profile/GetConfig/CreateAccount/DeleteAccount/EnableDisable, vpnApiCall, VPN_PROJECT_ID) dal worker.js (righe ~7960-8285) in un modulo separato vpn-module.js importato dal worker.
2. Gating server-side: OGNI endpoint /vpn/* verifica il token licenza Premium ECDSA (tier=premium attivo) PRIMA di agire. Riusa lo schema di verifica firma già usato per il trial (importTrialMobilePubKey / crypto.subtle.verify). Senza token valido → 403. Aggiungi nonce/timestamp anti-replay.
3. Fix bug /vpn/create: oggi il client manda solo email ma l'handler pretende username+password. Genera username+password lato worker (o accetta email e crea le credenziali). Lega l'account al deviceId del token (1 account per licenza).
4. Fix /verify-mobile-license: oggi risponde 405 perché registrato solo in POST ma il client lo chiama in GET. Registralo anche per GET.
5. Rate-limit stretto su /vpn/create. Audit log (D1) delle operazioni create/enable/disable (chi/quando/accountId, MAI traffico).
6. Cron Trigger Cloudflare giornaliero (wrangler.toml [triggers] crons): disable account VPN inattivi >7gg + con abbonamento scaduto. Auto-riattivazione trasparente: se Premium valido + account disabled alla riconnessione → enable.
7. PUBBLICA il contratto API in .claude/API-CONTRACT-vpn.md: per ogni endpoint /vpn/* → path, metodo, header auth (token), body, response JSON. Questo file lo leggono le altre chat.

Regole: MiniMax scrive il codice (m3x/m3-code), tu verifichi (evidence-gate: grep+diff+deploy dry). NON toccare popup/mobile/sito. Commit piccoli. Aggiorna la sezione FASE 0 in PROGRESS-vpn-premium.md.
NON deployare in produzione senza ok esplicito.
```

---

## CHAT B — Estensione: rimuovi VPN browser + upsell + badge Premium (FASE 1)

**File posseduti**: `app/src/popup.{js,html,css}`, `app/src/options.{js,html,css}`, `app/src/license-client.js` + propagazione a `app-firefox/` e `app-safari/`. NON tocca worker/mobile/sito.

```
Lavori su AdOff, "/mnt/backup/Dropbox/1 Programmazione/Progetti/ChromePlugin".
Leggi PRIMA: .claude/PLAN-vpn-dns-redesign.md (sezioni VPN browser, Badge, Upsell, Struttura licenza) + .claude/API-CONTRACT-vpn.md (da Chat A).
Branch: git checkout -b feat/premium-vpn-ext (da feat/premium-vpn).

OBIETTIVO (FASE 1 — estensione). Tocca SOLO app/src/ + propaga a app-firefox/src/ e app-safari/src/ (regola Multi-Browser Sync).

1. RIMUOVI la UI VPN dal popup (server select, connect/disconnect, download .conf) — nel browser la VPN non può instradare traffico (verificato). Elimina vpnFetch/loadVpnState/toggleVpn e relativo HTML/CSS.
2. Sostituisci con UPSELL "AdOff Premium": (a) banner discreto nel popup "VPN disponibile su app" + link download, (b) sezione dedicata "AdOff Premium" con CTA checkout, (c) voce in options.
3. Badge licenza a 3 livelli: Free / Pro / Premium (Premium con icona/colore VPN distinto). Aggiorna license-client.js per esporre tier (pro|premium) dal token.
4. Congruenza: versione da manifest a runtime (regola Version Congruence), niente hardcode.

Propaga OGNI modifica ai 3 target (app/, app-firefox/, app-safari/) — file condivisi identici salvo differenze strutturali note.
Regole: MiniMax scrive, tu verifichi. NON toccare worker/mobile/sito. NON build/deploy senza ok. Commit piccoli. Aggiorna FASE 1 (parte estensione) in PROGRESS-vpn-premium.md.
```

---

## CHAT C — Mobile Flutter: fix license + blocklist + gating (FASE 0+2)

**File posseduti**: `AdOff/lib/`, `AdOff/android/`, `AdOff/README.md`. NON tocca worker/app/sito.

```
Lavori su AdOff mobile, "/mnt/backup/Dropbox/1 Programmazione/Progetti/ChromePlugin/AdOff".
Leggi PRIMA: .claude/PLAN-vpn-dns-redesign.md (sezioni Mobile, DNS Guard, Bug mobile, Kill-switch) + .claude/API-CONTRACT-vpn.md.
Branch: git checkout -b feat/premium-vpn-mobile (da feat/premium-vpn).

OBIETTIVO. Tocca SOLO AdOff/.

1. FASE 0 fix: license_service.dart chiama GET /api/verify-mobile-license (Chat A lo fixa lato worker). Aggiungi verifica firma ECDSA client-side in Dart (oggi si fida ciecamente del server) — verifica payload.deviceId == locale.
2. DNS Guard freemium: blocklist statica grande (importa liste pubbliche EasyList/AdGuard DNS filter, da ~349 a migliaia di domini) in assets/blocklist.txt + update remoto (scarica blocklist aggiornabile dal rules-feed, pattern come l'estensione). Base free, feature avanzate Pro.
3. FASE 2 (dopo test protocollo di Chat A): estendere VpnService.kt da DNS-filter locale a tunnel reale verso server VPNresellers (protocollo WireGuard/OpenVPN secondo esito test). Kill-switch (VpnService). Gating Premium (token verificato).
4. Allinea README.md al codice reale (oggi dichiara Phase 3 TODO ma è implementata).

Regole: MiniMax scrive (Flutter/Kotlin), tu verifichi. NON toccare worker/estensione/sito. Commit piccoli. Aggiorna FASE 0/2 (mobile) in PROGRESS-vpn-premium.md.
```

---

## CHAT D — App desktop Tauri nuova (FASE 2, parallelo mobile)

**File posseduti**: nuova cartella `AdOff-desktop/` (o `sviluppo/adoff-desktop/`). NON tocca nulla di esistente.

```
Lavori su AdOff, "/mnt/backup/Dropbox/1 Programmazione/Progetti/ChromePlugin".
Leggi PRIMA: .claude/PLAN-vpn-dns-redesign.md (sezioni App desktop, UX scelta server, Kill-switch, Feature avanzate) + .claude/API-CONTRACT-vpn.md + il progetto reference /mnt/backup/Dropbox/1 Programmazione/Progetti/vpn-tray (README + vpn-tray.py) per la UX.
Branch: git checkout -b feat/premium-vpn-desktop (da feat/premium-vpn).

OBIETTIVO (FASE 2). Crea una NUOVA app desktop cross-platform in AdOff-desktop/. NON toccare file esistenti.

1. Stack Tauri (Rust + web frontend). Scaffold app desktop Win/Mac/Linux.
2. Riusa la UX di vpn-tray: scelta server paese→città, web picker filtrato, fast-connect (server ottimale), country-lock, auto-rotation. Backend = VPNresellers (WireGuard/OpenVPN) via gli endpoint /vpn/* del worker (API-CONTRACT), NON Tailscale.
3. Verifica licenza Premium (stesso token ECDSA). Kill-switch (firewall rules). Connessione lazy on-demand.
4. Feature Premium: auto-rotation + fast-connect + country-lock.

Regole: MiniMax scrive (Rust/Tauri), tu verifichi. Isolato in AdOff-desktop/. Commit piccoli. Aggiorna FASE 2 (desktop) in PROGRESS-vpn-premium.md. Marca chiaramente come WIP se non compila ancora.
```

---

## CHAT E — Sito/pricing/checkout/messaging (FASE 1+3)

**File posseduti**: `site/` (landing, pricing, vs/, i18n, VPN Policy), `docs/PRICING-PLAN.md`, `sviluppo/license-system/worker.js` SOLO il blocco Stripe checkout (COORDINARE con Chat A — vedi nota merge). Meglio: Chat A possiede worker.js; Chat E prepara la copy/spec e Chat A integra il checkout. → **Chat E NON tocca worker.js**, scrive la spec checkout in `.claude/SPEC-checkout-premium.md` che Chat A implementa.

```
Lavori su AdOff, "/mnt/backup/Dropbox/1 Programmazione/Progetti/ChromePlugin".
Leggi PRIMA: .claude/PLAN-vpn-dns-redesign.md (sezioni Pricing, Founder Premium, Messaging, Posizionamento, Legale, Presentazione valore).
Branch: git checkout -b feat/premium-vpn-site (da feat/premium-vpn).

OBIETTIVO (FASE 1+3 — sito, no worker). Tocca SOLO site/ e docs/. NON toccare worker.js.

1. Landing /premium (15 lingue via i18n _matrix.json): bundle adblock+VPN, pain-point (privacy+ads), bundle value, onestà piattaforme (VPN su app non browser), CTA free trial adblock come entry.
2. Pricing: aggiungi tier Premium (€4,99/mo · Founder €29,99→€49,99 · std €49,99). Prezzi fissi psicologici multi-valuta. Founder pool separato "X/100". Aggiorna docs/PRICING-PLAN.md + site/data/constants.json (SSOT) — MA marca "PENDING test E2E" (non pubblicare finché Chat F non valida).
3. Pagine vs/ competitor: NordVPN/Proton, AdGuard VPN, Brave (riusa sistema vs/ SEO).
4. VPN Policy doc dedicato (no-log, giurisdizione EU, cosa si traccia, P2P). Contenuti SEO (guide adblock+VPN, FAQ AEO).
5. Scrivi .claude/SPEC-checkout-premium.md: spec dettagliata del checkout Stripe Premium (SKU, price_data inline, founder gating, multi-valuta, PayPal/Apple/Google Pay, crypto BTCPay/Coinbase USDT/USDC, upgrade proration) che Chat A implementerà nel worker.

Regole: MiniMax scrive, tu verifichi. NON toccare worker.js/estensione/mobile. NON deployare. Congruenza pre-deploy (prezzi/versione/regole/lingue). Aggiorna FASE 1/3 (sito) in PROGRESS-vpn-premium.md.
```

---

## CHAT F — Test E2E + gate multi-device + monitoring (FASE 0-gate + 1bis + 3)

**File posseduti**: `sviluppo/tests/vpn/` (nuovi test), `.claude/TEST-REPORT-vpn.md`. NON modifica codice di produzione (solo test + report).

```
Lavori su AdOff, "/mnt/backup/Dropbox/1 Programmazione/Progetti/ChromePlugin".
Leggi PRIMA: .claude/PLAN-vpn-dns-redesign.md (FASE 1bis, Checklist go-live, QA continuo, Monitoring) + .claude/API-CONTRACT-vpn.md (da Chat A).
Branch: git checkout -b feat/premium-vpn-test (da feat/premium-vpn).

OBIETTIVO. Test + report, NON tocchi codice di produzione. Tocca SOLO sviluppo/tests/vpn/ e file .claude/*REPORT*.

1. GATE Fase 0 — test empirico multi-device: script che scarica config VPN reale (via API-CONTRACT), connette 2-3 device (o simula), confronta WireGuard VS OpenVPN — coesistono o kick? Scrivi il verdetto in .claude/TEST-REPORT-vpn.md (decide il protocollo default per Chat C e D).
2. Test E2E (Fase 1bis, gate pre-doc): Stripe test mode checkout Premium completo; account VPNresellers test reale (create/enable/config/disable); test gating (curl /vpn/* senza token → 403 su tutti); no leak IP/DNS con VPN attiva; kill-switch.
3. QA continuo: smoke test giornaliero endpoint /vpn/*; alert se lista server si svuota; regression gating.
4. Monitoring spec: alert balance reseller basso, dashboard admin (account attivi × $1,99), alert errori API, report settimanale margine.

Regole: MiniMax scrive i test, tu verifichi con output letterale. Riporta i FALLIMENTI reali (no mascheramento). Aggiorna FASE 1bis in PROGRESS-vpn-premium.md.
```

---

## PROMPT DI MERGE (chat finale di integrazione)

```
Lavori su AdOff, "/mnt/backup/Dropbox/1 Programmazione/Progetti/ChromePlugin".
Devi fare il MERGE dei branch paralleli su feat/premium-vpn e verificare la coerenza end-to-end.
Leggi: .claude/PLAN-vpn-dns-redesign.md, PROGRESS-vpn-premium.md, API-CONTRACT-vpn.md, SPEC-checkout-premium.md, TEST-REPORT-vpn.md.

1. Merge in ordine: feat/premium-vpn-worker → -ext → -mobile → -desktop → -site → -test su feat/premium-vpn.
2. Ad ogni merge, risolvi conflitti (dovrebbero essere minimi: file distinti per design). Verifica che il contratto API sia rispettato da tutti i consumer.
3. Verifica coerenza globale: tier "Premium" ovunque (mai "Pro+"); prezzi congruenti (€4,99/29,99/49,99) tra sito/worker/docs; gating server-side attivo; nessun leak brand/PII (grep pre-deploy); versione da manifest.
4. Esegui la CHECKLIST GO-LIVE (no leak IP/DNS, kill-switch, gating 403, congruenza) dal TEST-REPORT.
5. Riporta lo stato reale di ogni fase (evidence-gate). NON deployare in produzione senza ok esplicito dell'utente.
6. Aggiorna PROGRESS-vpn-premium.md con lo stato consolidato + crea checkpoint.
```

---

## NOTE OPERATIVE
- **Contratto prima del parallelo**: Chat A deve produrre API-CONTRACT-vpn.md e Chat E SPEC-checkout-premium.md il prima possibile — sbloccano B/C/D/F.
- **Worktree isolati** (consigliato): ogni chat in un worktree separato evita conflitti su working tree. `git worktree add ../adoff-<area> feat/premium-vpn-<area>`.
- **File-ownership rigido**: nessun file è scritto da 2 chat. worker.js = solo Chat A. Questo garantisce il merge pulito.
- **Ordine dipendenze**: A (contratto) → {B,C,D,E,F consumano}. F gate multi-device sblocca la parte tunnel di C e D.
```
