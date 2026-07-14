#!/usr/bin/env python3
"""Refresh wiki + checkpoint after rename-abort decision (2026-05-15)."""
import json, datetime, subprocess

NOW = datetime.datetime.now()
TS_FILE = NOW.strftime("%Y%m%d_%H%M")
TS_ISO = NOW.strftime("%Y-%m-%d_%H%M")
TS_LOG = NOW.strftime("%F %H:%M")

# ---------- 1. Append rename-abort note alle wiki pages ----------
identity_md = "/home/mrxxx/Obsidian/claude-memory/projects/adoff/reference/adoff-identity-separation.md"
stack_md    = "/home/mrxxx/Obsidian/claude-memory/projects/adoff/reference/adoff-n8n-autopilot-stack.md"

abort_note = """

## Decisione 2026-05-15: NO rename cartella ChromePlugin -> adoff

Tentativo rename fallito (WinError 32, file lock Claude Code attivo). Rollback completato.
Decisione utente: mantenere `ChromePlugin/` come nome cartella locale.
Motivazione: il brand "AdOff" e pubblico (sito adoff.app, store listings) — il nome cartella sul disco e irrilevante.
Script rename eliminati. NON ri-proporre.
"""

for path in [identity_md, stack_md]:
    content = open(path, encoding="utf-8").read()
    if "Decisione 2026-05-15: NO rename" not in content:
        with open(path, "a", encoding="utf-8") as f:
            f.write(abort_note)
        print(f"[wiki] appended abort note to {path.split('/')[-1]}")
    else:
        print(f"[wiki] already has abort note: {path.split('/')[-1]}")

# ---------- 2. Update PROJECT.md status timestamp ----------
project_md = "/home/mrxxx/Obsidian/claude-memory/projects/adoff/PROJECT.md"
content = open(project_md, encoding="utf-8").read()
# Bump updated date in frontmatter
import re
content = re.sub(r"^updated:.*$", f"updated: {NOW.strftime('%Y-%m-%d')}", content, count=1, flags=re.M)
open(project_md, "w", encoding="utf-8").write(content)
print(f"[wiki] PROJECT.md updated date bumped")

# ---------- 3. Rewrite checkpoint MD ----------
ckpt_dir = "/home/mrxxx/Dropbox/1 Programmazione/Progetti/ChromePlugin/.claude/checkpoints"
ckpt_md = f"{ckpt_dir}/CP_{TS_FILE}.md"

md = f"""# CP {TS_FILE} — AdOff n8n Autopilot

**Stato:** 95% — sistema OPERATIONAL, cartella `ChromePlugin/` confermata (rename abortito).

## Completato
- 10 workflow n8n importati + 9/10 attivi (W03 inactive, serve creds social)
- DB schema adoff_autopilot (8 tab + 2 view) applicato
- Credentials PG + Resend cifrate AES-256-CBC compat crypto-js
- Pipeline email E2E verificata 2026-05-14 22:18 (n8n -> Resend -> DKIM -> Proton)
- Identity wrap layer: adoffsecurity@proton.me + 5 PII leak risolti
- Memory claude-memory: 2 reference pages + PROJECT.md aggiornato
- Decisione: cartella resta ChromePlugin/ (brand AdOff e pubblico, non locale)

## Pending (founder action)
- T002 HIGH: CF API Token (Email Routing+DNS+Zone, 90gg TTL) -> abilita 5 alias @adoff.app
- T003 HIGH: Proton 2FA TOTP attivo + password rotation (se non gia fatto)
- T004 MED: Twitter API + Mastodon + Reddit OAuth -> attiva W03 Posts Dispatcher
- T005 MED: wrangler deploy 2 worker con workers_dev=false
- T006 LOW: monitor 7gg false positive tune
- T007 LOW: decisione Proton Plus upgrade fine maggio 2026

## Banned (mai riproporre)
- BAN006: rename cartella ChromePlugin -> adoff (decisione utente)

## File chiave
- Workflow: ChromePlugin/sviluppo/ai-autopilot/n8n-workflows/workflows/ (10 JSON)
- Scripts: ChromePlugin/sviluppo/ai-autopilot/n8n-workflows/scripts/ (5 py/sh)
- Wiki: claude-memory/projects/adoff/reference/{{adoff-identity-separation, adoff-n8n-autopilot-stack}}.md
- Snapshot precedente: .claude/checkpoints/snapshot_2026-05-15_0025.json
- Master creds: ChromePlugin/sviluppo/.secrets/adoff-stores.env (gitignored)

## Ripresa
Leggi snapshot JSON aggiornato. Continua da T002 (CF token) o T004 (social creds).
"""
open(ckpt_md, "w", encoding="utf-8").write(md)
print(f"[ckpt] checkpoint MD: {ckpt_md} ({len(md.splitlines())} lines)")

# ---------- 4. Rewrite snapshot JSON ----------
snap_path = f"{ckpt_dir}/snapshot_{TS_ISO}.json"

snapshot = {
    "snapshot_timestamp": NOW.strftime("%Y-%m-%d %H:%M"),
    "project_identity": {
        "goal": "Sistema marketing automation autopilot AdOff (ad blocker MV3) via n8n + Ollama + Resend + Cloudflare. Identity separation founder. Lancio aggressivo zero-budget.",
        "current_phase": "Operational 95% — pipeline email + intel + content viva. Pending publishing layer (W03) + CF Email Routing aliases.",
        "last_successful_action": "Decisione utente abort rename ChromePlugin -> adoff (mantieni nome cartella locale, brand AdOff e pubblico)"
    },
    "ACTIVE_USER_REQUEST_TRACKING": {
        "original_request": "creare sistema automatico marketing AdOff su n8n con identity separation Proton, full-auto zero supervisione, lancio aggressivo zero-budget",
        "request_id": "REQ-ADOFF-AUTOPILOT-001",
        "development_status": {
            "understood_intent": "Marketing automation in n8n su leobox: mention sentinel, cross-post, cold email, reddit hunter, warming, quora. Email via Resend con identity wrap Proton. Founder zero-spending, aggressive launch, full-auto.",
            "completed_steps": [
                {"step": "n8n stack scoperto via SSH leobox", "output": "10+ container up", "timestamp": "2026-05-14 23:13"},
                {"step": "DB schema adoff_autopilot creato", "output": "8 tab + 2 view", "timestamp": "2026-05-14 23:18"},
                {"step": "10 workflow JSON scritti e importati via SQL", "output": "tutti in DB con history + shared_workflow + activeVersionId", "timestamp": "2026-05-15 00:00"},
                {"step": "Patch LLM body + PG queryReplacement safety", "output": "JSON.stringify wrap + array params robust", "timestamp": "2026-05-15 00:10"},
                {"step": "Credentials PG + Resend cifrate AES-256-CBC", "output": "adoff-pg-autopilot-credential-1234 + adoff-resend-credential-001", "timestamp": "2026-05-15 00:15"},
                {"step": "PII leak audit + cleanup 5 file + W07 hardcoded fix", "output": "0 leak residual", "timestamp": "2026-05-15 00:20"},
                {"step": "Email test E2E W07", "output": "sequence_step 0->1, email ricevuta su Proton", "timestamp": "2026-05-14 22:18"},
                {"step": "Memory claude-memory aggiornata", "output": "2 reference pages + log entries", "timestamp": "2026-05-15 00:25"},
                {"step": "Tentato rename ChromePlugin -> adoff", "output": "FALLITO WinError 32, rollback completo OK", "timestamp": "2026-05-15 00:35"},
                {"step": "Decisione utente abort rename + cleanup scripts", "output": "B selezionato, cartella resta ChromePlugin", "timestamp": "2026-05-15 00:50"}
            ],
            "in_progress_step": {
                "step": "Attesa input founder per T002 (CF token) o T004 (credentials social)",
                "progress_percent": 0,
                "last_action": "Wiki + checkpoint refreshed dopo decisione abort rename",
                "next_action": "Quando founder fornisce CF API Token: lanciare setup-email-stack.sh. Quando founder fornisce social creds: attivare W03."
            },
            "pending_steps": [
                {"step": "CF Email Routing 5 alias adoff.app", "depends_on": "CF API Token founder (T002)"},
                {"step": "W03 Posts Dispatcher activation", "depends_on": "Twitter+Mastodon+Reddit creds founder (T004)"},
                {"step": "Founder OpSec: 2FA TOTP Proton", "depends_on": "Founder T003"},
                {"step": "Re-deploy 2 workers workers_dev=false", "depends_on": "Founder wrangler deploy T005"},
                {"step": "Monitor 7gg false positive tune", "depends_on": "Tempo trascorso T006"},
                {"step": "Decisione Proton Plus upgrade fine maggio", "depends_on": "Founder T007"}
            ],
            "blockers": [
                "CF API Token assente",
                "Twitter/Reddit/Mastodon credentials assenti",
                "LiteLLM Prisma bug — bypass attivo con Ollama diretto (non bloccante)"
            ],
            "partial_outputs": [
                "ChromePlugin/sviluppo/ai-autopilot/n8n-workflows/ — workflow + scripts + infra",
                "DB n8n-postgres adoff_autopilot schema + workflow_entity + credentials",
                "claude-memory/projects/adoff/reference/adoff-identity-separation.md",
                "claude-memory/projects/adoff/reference/adoff-n8n-autopilot-stack.md"
            ],
            "validation_status": "VALIDATED"
        },
        "user_context_notes": "Eros De Grande, dev italiano. Pragmatico zero-filtri. Output tabellati con numeri concreti. Italian only. Identity anonymity importante (separazione brand da PII). Full-auto preferred. Decide A/B/C/D quando offerto."
    },
    "checkpoints_completed": [
        {"id": "CP001", "desc": "Audit memory leobox + identity layers", "result": "SUCCESS"},
        {"id": "CP002", "desc": "n8n stack setup + 10 workflow", "result": "SUCCESS"},
        {"id": "CP003", "desc": "Email pipeline E2E", "result": "SUCCESS"},
        {"id": "CP004", "desc": "PII leak audit + cleanup", "result": "SUCCESS"},
        {"id": "CP005", "desc": "Wiki + memory persistence", "result": "SUCCESS"},
        {"id": "CP006", "desc": "Rename ChromePlugin -> adoff", "result": "ABORTED by user", "note": "WinError 32 + decisione utente: brand AdOff publico, nome cartella irrilevante"}
    ],
    "knowledge_base": {
        "discovered_facts": [
            "leobox 100.71.178.53 Tailscale Ubuntu 24 user mrxxx",
            "n8n stack: 5678 UI + Ollama 11434 + LiteLLM 4000 (bug bypassato) + Postgres+Redis queue mode",
            "Ollama alias: chat-max, fast-max, reasoning-max, code-max, big-max, cyber-max (abliterated)",
            "Resend domain adoff.app VERIFIED 2026-04-18 (DKIM/SPF/DMARC OK su CF DNS)",
            "Resend API key attiva: re_H3Eu...vJNo (cifrata in n8n cred)",
            "CF account: erosdegrande@gmail.com (display name da rinominare)",
            "n8n 2.20.7-exp.0 richiede activeVersionId + shared_workflow + workflow_history",
            "n8n credentials cifratura: AES-256-CBC + EVP_BytesToKey MD5 (openssl -aes-256-cbc -md md5 -salt)",
            "Cartella progetto: ChromePlugin/ (mantenuta — rename abortito 2026-05-15)"
        ],
        "resolved_decisions": [
            "Email stack zero-budget: Proton Free + Resend + CF Email Routing (no Bridge, no Plus)",
            "DB storage: Postgres n8n schema adoff_autopilot (NO Cloudflare D1)",
            "LLM: Ollama diretto bypass LiteLLM",
            "Identity wrap: adoffsecurity@proton.me",
            "Full-auto zero supervision su workflow safe; supervisione su publishing W03",
            "Nome cartella locale ChromePlugin: mantenuto, brand pubblico AdOff slegato"
        ],
        "technical_constraints": [
            "n8n CLI execute richiede manualTrigger node",
            "Cifratura n8n credentials: openssl AES-256-CBC -md md5 -salt compat crypto-js",
            "Workers.dev subdomain *.erosdegrande.workers.dev: disabilitati (re-deploy pending T005)",
            "Proton Free non supporta custom domain (Plus richiede 3.99 EUR/mese)",
            "Rename cartella con Claude Code attivo: WinError 32 garantito (file lock)"
        ]
    },
    "todo_list": [
        {"id": "T001", "task": "ABORTITO — Rename ChromePlugin -> adoff cancellato", "priority": "DONE", "blocked_by": None, "status": "aborted"},
        {"id": "T002", "task": "Founder crea CF API Token (Email Routing+DNS+Zone, TTL 90gg)", "priority": "HIGH", "blocked_by": "Founder"},
        {"id": "T003", "task": "Founder rotate Proton password + 2FA TOTP attivo", "priority": "HIGH", "blocked_by": "Founder"},
        {"id": "T004", "task": "Founder fornisce Twitter API v2 + Mastodon token + Reddit OAuth", "priority": "MED", "blocked_by": "Founder"},
        {"id": "T005", "task": "Founder wrangler deploy 2 worker con workers_dev=false", "priority": "MED", "blocked_by": "Founder"},
        {"id": "T006", "task": "Monitoring 7gg workflow attivi tune false positive", "priority": "LOW", "blocked_by": "tempo"},
        {"id": "T007", "task": "Decisione Proton Plus upgrade fine maggio 2026", "priority": "LOW", "blocked_by": "fine maggio 2026"},
        {"id": "T008", "task": "Rinomina display CF account 'Erosdegrande@gmail.com Account' -> 'AdOff App'", "priority": "LOW", "blocked_by": "Founder"}
    ],
    "absolute_do_not_do": [
        {"id": "BAN001", "action": "Salvare password/recovery phrase Proton in memory o vault", "reason": "OpSec critical"},
        {"id": "BAN002", "action": "Esporre API key/token in chat plain text", "reason": "Session jsonl + Anthropic cache - rotabili OK, salvabili NO"},
        {"id": "BAN003", "action": "Riprovare LiteLLM senza fix Prisma budget_limits", "reason": "Bug noto, bypass Ollama funziona"},
        {"id": "BAN004", "action": "Attivare W03 Posts Dispatcher senza credentials Twitter/Reddit/Mastodon", "reason": "Poster fallimenti"},
        {"id": "BAN005", "action": "Modificare workflow_entity senza patchare workflow_history", "reason": "n8n usa activeVersionId in history"},
        {"id": "BAN006", "action": "Ri-proporre rename cartella ChromePlugin -> adoff", "reason": "Decisione utente 2026-05-15: lascia stare, brand AdOff pubblico, locale irrilevante"}
    ],
    "active_context": {
        "open_files": [
            "ChromePlugin/sviluppo/ai-autopilot/n8n-workflows/",
            "claude-memory/projects/adoff/"
        ],
        "pending_tests": [],
        "last_error": "None — sistema operational",
        "environment_state": "leobox up, 9/10 workflow active, DB populated, Dropbox sync OK, cartella ChromePlugin/ confermata"
    },
    "compaction_anchor": "AdOff e ad blocker MV3 di Eros. Sistema autopilot marketing su n8n leobox con 9/10 workflow attivi. Identity wrap adoffsecurity@proton.me. Email send via Resend cifrato in n8n cred. DB Postgres adoff_autopilot. W03 dispatcher OFF (serve Twitter/Reddit/Mastodon creds). CF Email Routing pending (serve CF token). Cartella locale: ChromePlugin/ (rename abortito 2026-05-15, brand AdOff pubblico irrilevante). Continuare con T002 (CF token founder) o T004 (creds social founder)."
}

open(snap_path, "w", encoding="utf-8").write(json.dumps(snapshot, indent=2, ensure_ascii=False))
print(f"[ckpt] snapshot JSON: {snap_path} ({len(json.dumps(snapshot))} chars)")

# ---------- 5. Log entry ----------
log_entry = f"{TS_LOG} | wiki_checkpoint_refresh | adoff | Wiki+checkpoint aggiornati post-decisione abort rename. T001 ABORTED, BAN006 added, 6 task pending founder.\n"
open("/home/mrxxx/Obsidian/claude-memory/log.md", "a", encoding="utf-8").write(log_entry)
print(f"[log] entry appended")

print(f"\n=== DONE ===")
print(f"Wiki pages: 2 (identity-separation + autopilot-stack) — abort note appended")
print(f"PROJECT.md: updated date bumped")
print(f"Checkpoint: CP_{TS_FILE}.md")
print(f"Snapshot: snapshot_{TS_ISO}.json")
print(f"Log: appended")
