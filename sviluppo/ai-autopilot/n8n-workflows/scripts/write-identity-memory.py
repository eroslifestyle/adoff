#!/usr/bin/env python3
"""Writes AdOff identity-separation memory page (no credentials in plain text)."""
import subprocess, datetime

CONTENT = '''---
type: reference
slug: adoff-identity-separation
project: adoff
created: 2026-05-14
updated: 2026-05-15
status: operational
tags: [adoff, privacy, identity, opsec, proton, resend, email]
---

# AdOff - Identity Separation & Email Stack

> Layer operativo identity wrap + email infrastructure per AdOff.
> Setup ZERO-BUDGET: Proton Free (ricezione) + Resend (invio bulk) + Cloudflare Email Routing (alias forwarding).

## Email primaria progetto

| Field | Value | Note |
|---|---|---|
| **Account Proton** | adoffsecurity@proton.me | Identity wrapper per tutti gli account social/admin AdOff |
| Tier | Free (1 GB, 150 msg/giorno, no custom domain nativo) | Upgrade a Plus 3.99 EUR/mese deferred a fine maggio 2026 (decisione 30gg) |
| Created | 2026-05-14 | |
| Password | Cambiata 2026-05-15, random 24+ char, salvata in password manager utente | **MAI in memory, MAI in vault** |
| 2FA TOTP | Da attivare (Aegis/Raivo, NO Google Auth) | Founder responsibility |
| Recovery phrase | Su carta + cassaforte | Founder responsibility |
| Use case primario | Ricezione signup social (Reddit, PH, HN, Quora) + forward CF alias + recovery account | |

## Resend (invio bulk outbound)

| Field | Value | Note |
|---|---|---|
| **Account email** | adoffsecurity@proton.me | Login Resend dashboard |
| Domain | adoff.app | VERIFIED 2026-04-18, region us-east-1 |
| DKIM/SPF/DMARC | Already configured on Cloudflare DNS | Verificato 2026-05-15 |
| Sending capability | Enabled | 3k email/mese gratis |
| Receiving capability | Disabled | (we use CF Email Routing for receive) |
| API key attiva | re_H3Eu...vJNo | **Cifrata in n8n credential adoff-resend-credential-001** (AES-256-CBC). NO plain text. |
| n8n credential ID | adoff-resend-credential-001 | type httpHeaderAuth, owner personal project |
| Status | Operational | Test invio end-to-end 2026-05-14 22:18 da W07 a adoffsecurity@proton.me OK |

## Cloudflare Email Routing (alias adoff.app forward Proton)

- Status: pending
- Bloccante: serve CF API Token con permessi Email Routing + DNS Edit + Zone Read
- Quando attivato: 5 alias forwarding press support partners dev hello @ adoff.app verso adoffsecurity@proton.me
- Setup script pronto: sviluppo/ai-autopilot/n8n-workflows/scripts/setup-email-stack.sh

## n8n workflow attivi che usano email

- W07 Press Cold Email Drip — schedule 4h, drip 4-step recipients in tabella outreach, mittente press@adoff.app via Resend

## Architettura completa

```
Inbound (ricezione)
  press|support|partners|dev|hello @ adoff.app
    --[CF Email Routing pending]--> adoffsecurity@proton.me [Proton Free]

Outbound (invio)
  n8n W07 --> Resend API --> press@adoff.app (DKIM su adoff.app)
                             Reply-To press@adoff.app
                             --> CF Email Routing --> Proton Free
```

## Pattern OpSec adottato

1. Password Proton mai con PII (nome anno luoghi)
2. Password Proton mai condivisa con Claude/sessione live
3. API keys (Resend CF) sempre cifrate in n8n credential (AES-256-CBC)
4. Bridge Proton NON usato (richiede Plus); usiamo Resend per sending
5. 2FA TOTP obbligatorio
6. Recovery phrase analogica (carta + cassaforte)
7. CF API token con TTL 90gg + scope minimo
8. Audit periodico .secrets/adoff-stores.env (NON committarsi mai)

## File master credentials

Path: /home/mrxxx/Dropbox/1 Programmazione/Progetti/ChromePlugin/sviluppo/.secrets/adoff-stores.env

Contiene credentials in chiaro per: CWS, Edge, Firefox AMO, Stripe TEST, Cloudflare Account ID, Google OAuth, Google Cloud, Resend. NON committato (in .gitignore).

## Audit leak pulizia 2026-05-14/15

- Session Claude Code scrubbed
- Obsidian vault ErosTest: 0 leak
- claude-memory vault: 0 leak
- Backup files .bak removed
- 5 chat log storici archiviati in sviluppo/.archive-pii/ (gitignored)
- W07 hardcoded eros@adoff.app sostituito con press@adoff.app
- W07 signature Eros sostituito con The AdOff team
- Wrangler workers_dev disabled su license-system e worker-telegram (re-deploy pending)

## Task aperti

- Generare CF API Token (Email Routing+DNS+Zone, 90gg TTL) — Founder
- Activate 2FA Proton se non gia attivo — Founder
- Re-deploy 2 workers con workers_dev=false — Founder via wrangler deploy
- Setup CF Email Routing (5 alias) — Claude via setup-email-stack.sh quando token disponibile
- Decisione Plus upgrade a fine maggio 2026 — Founder
- Rename CF account display da "Erosdegrande@gmail.com Account" a "AdOff App" — Founder via CF UI
- Browser profile dedicato AdOff (Firefox/Brave) — Founder
- Proton VPN sempre attivo durante dev — Founder

## Related

- [[adoff-anonimato-utenti-finali-strategia-2026]]
- [[adoff-anonimato-srl-italia-roadmap-pratica-2026]]
- [[anonymous-llc-jurisdictions]]
- [[adoff-dual-brand-strategy]]
'''

target = "/home/mrxxx/Obsidian/claude-memory/projects/adoff/reference/adoff-identity-separation.md"
with open(target, "w", encoding="utf-8") as f:
    f.write(CONTENT)
print(f"written: {target} ({len(CONTENT.splitlines())} lines)")

now = datetime.datetime.now().strftime("%F %H:%M")
log_entry = f"{now} | reference_update | adoff | Identity separation + email stack — Resend operational, CF Email Routing pending token\n"
with open("/home/mrxxx/Obsidian/claude-memory/log.md", "a", encoding="utf-8") as f:
    f.write(log_entry)
print("log updated")
