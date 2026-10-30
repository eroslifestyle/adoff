# HANDOVER — AdOff Premium VPN · 2026-07-19

> Prompt standalone per nuove chat. Tutto il contesto è qui: stato, decisioni congelate, file chiave, residui.

---

## CONTESTO

**Branches attivi:**
- `master` — production stabile (v3.5.36, CWS published)
- `feat/premium-vpn` — branch integrazione VPN Premium

**Worker API:** `api.adoff.app` (deployato, Version ID ~83a75a15)
**Sito:** `adoff.app` (CF Pages, branch main)
**Secret:** `~/.secrets/adoff-stores.env`

**Checkout Stripe Premium:** funzionante (3 piani: €4.99/mese, €29.99/anno Founder, €49.99/anno std)
**Gating VPN:** deployed, 403 su /vpn/* senza token Premium ✅
**Balance VPNresellers:** $25 (INSUFFICIENTE per test reali)

---

## PROMPT A — VPN provisioning nel webhook

```
Progetto AdOff. Working dir: /mnt/backup/Dropbox/1 Programmazione/Progetti/ChromePlugin

Contesto: checkout Stripe Premium è già funzionante (3 piani, webhook che scrive in KV/D1).
Manca: la creazione reale dell'account VPN quando l'utente compra Premium.

Leggi PRIMA:
- .claude/PROGRESS-vpn-premium.md (stato FASE 1)
- .claude/TODO.md (questo file, sezione VPN provisioning)
- sviluppo/license-system/worker.js (funzioni handleStripeWebhook, handleSubscriptionCreated)

Compito: nel webhook `checkout.session.completed` con tier=premium, dopo aver scritto la licenza in KV:
1. Estrai deviceId da metadata (o generane uno)
2. Fai POST /vpn/create con deviceId → accountId dalla risposta VPNresellers
3. Salva {customerId, deviceId, accountId} in D1 vpn_accounts
4. Su customer.subscription.deleted: leggi accountId da vpn_accounts → POST /vpn/disable

Il worker DEVE avere VPNRESELLERS_API_KEY in env. Gli endpoint VPNresellers usano auth Bearer.

Verifica: fai un checkout di test Stripe e controlla che l'account VPN venga creato (lista account su vpnresellers.com).
NON deployare in produzione senza test locale passato. Commit piccolo.
```

---

## PROMPT B — Multi-device test empirico

```
Progetto AdOff. Working dir: /mnt/backup/Dropbox/1 Programmazione/Progetti/ChromePlugin

Contesto: gating VPN è deployato e funziona (403 senza token Premium).
Manca: test empirico se WireGuard/OpenVPN supportano multi-device senza roaming-hijack.

Leggi PRIMA:
- .claude/TEST-REPORT-vpn.md (stato test precedenti)
- sviluppo/license-system/vpn-module.js (se esiste) o worker.js sezioni /vpn/*
- docs VPNresellers API (endpoint /servers, /accounts, /create, /enable)

Compito:
1. Verifica balance VPNresellers: quanto abbiamo? Se < $50, STOP e segnala di ricaricare PRIMA.
2. Crea 2 account VPN di test con VPNRESELLERS_API_KEY
3. Scarica config WireGuard per entrambi
4. Test empirico: i 2 device si connettono simultaneamente? Il secondo fa cadere il primo (roaming-hijack)?
5. Ripeti con OpenVPN
6. Scrivi verdetto + protocollo consigliato in .claude/TEST-REPORT-vpn.md

Usa curl/wget direttamente verso api.vpnresellers.com con Bearer token da ~/.secrets/adoff-stores.env.
Reporta l'output letterale, mai mascherare un fallimento.
```

---

## PROMPT C — Balance refill + Edge/AMO publish

```
Progetto AdOff. Working dir: /mnt/backup/Dropbox/1 Programmazione/Progetti/ChromePlugin

Task separati, non correlati:

TASK 1 — Balance refill VPNresellers:
1. Vai su vpnresellers.com → account → billing → ricarica $100+
2. Verifica balance aggiornato via API: curl https://api.vpnresellers.com/v4_1/profile -H "Authorization: Bearer $VPNRESELLERS_API_KEY"

TASK 2 — Edge publish v3.5.36:
Leggi CP_20260718_1720.md (sezione "EDGY publish"). Poll della InProgressSubmission Microsoft:
1. Estrai operationId dalla risposta dell'ultimo upload
2. GET /submissions/draft/package/operations/{operationId} fino a status=Succeeded
3. Se Succeeded → POST /submissions/{submissionId}/publish con notes changelog
4. Se failed → ricrea draft da zero

TASK 3 — AMO Firefox v3.5.36:
web-ext sign timeout a 120s. Retry con timeout piu' lungo:
npx web-ext sign --api-key $AMO_API_KEY --api-secret $AMO_API_SECRET \
  --timeout 300000 \
  --source-dir app-firefox/

API keys in ~/.secrets/adoff-stores.env.
```

---

## PROMPT D — i18n 31 pagine mancanti

```
Progetto AdOff. Working dir: /mnt/backup/Dropbox/1 Programmazione/Progetti/ChromePlugin

Contesto: il sistema i18n funziona su 8 pagine (index, install, premium, pricing, privacy, support, terms, withdrawal).
31 pagine NON hanno ancora attributi data-i18n.

Leggi PRIMA:
- .claude/checkpoints/CP_20260719_i18n.md (lista esatta delle 31 pagine)
- site/i18n/it.json (source delle traduzioni IT)
- site/i18n/en.json (source EN)
- site/adoff-i18n.js (come funziona il loader)

Compito (ciclico per ogni pagina):
1. Per ogni pagina della lista, aggiungi attributi data-i18n="page.section.key" a tutti i testi visibili
2. Verifica che la chiave ESISTA gia' in en.json/it.json; se non esiste, aggiungila
3. Per le 14 lingue diverse da EN/IT, il sistema i18n.js fa fallback a EN (ok per ora)
4. Test con Playwright: carica la pagina, cambia lingua, verifica i testi cambino

Siccome le pagine sono tante, fai batch di 5-10 pagine alla volta e commit.
Il sistema i18n è gia' in HEAD di tutte le pagine: l'aggiunta è solo attributi HTML.
```

---

## PROMPT E — EDGE_API_KEY renew (scadenza 2026-09)

```
Progetto AdOff. Working dir: /mnt/backup/Dropbox/1 Programmazione/Progetti/ChromePlugin

Rinnova EDGE_API_KEY prima della scadenza.

1. Vai su https://partner.microsoft.com/dashboard/microsoftedge/publishapi
2. Crea/renew API credentials
3. Aggiorna ~/.secrets/adoff-stores.env con il nuovo valore
4. Verifica: curl -X POST .../submissions/draft/package con la nuova key funziona
5. Commit solo se necessario (nessun file del repo cambia)
```

---

## FILE CHIAVE DA LEGGERE

| File | Cosa contiene |
|---|---|
| `.claude/TODO.md` | Todo board consolidato |
| `.claude/PROGRESS-vpn-premium.md` | Stato completo FASE 0-3 |
| `.claude/TEST-REPORT-vpn.md` | Risultati test VPN |
| `.claude/checkpoints/CP_20260714_VPN_SPRINT2.md` | Checkout Stripe funzionante |
| `.claude/checkpoints/CP_20260718_1720.md` | Site i18n completato |
| `.claude/checkpoints/CP_20260719_i18n.md` | 31 pagine pendenti i18n |
| `sviluppo/license-system/worker.js` | Backend API |
| `sviluppo/license-system/vpn-module.js` | Logica VPN estratta |
| `site/i18n/it.json` | Traduzioni IT |
| `site/adoff-i18n.js` | Loader i18n |

## DO NOT

- NON chiamare tier "Pro+" — è SEMPRE "Premium"
- NON loggare traffico/IP utente
- NON pubblicare pricing pubblici prima di test E2E completato
- NON lanciare VPN prima di test multi-device empirico
- NON committare segreti (VPNRESELLERS_API_KEY, EDGE_API_KEY, CWS creds)
