#!/usr/bin/env bash
# AdOff — wrapper cron per clone-monitor.js
# Sorgenti env opzionali (se presenti): GitHub token + Telegram creds.
#   ~/.secrets/adoff-github.env    → GITHUB_TOKEN=ghp_...
#   ~/.secrets/adoff-telegram.env  → TELEGRAM_BOT_TOKEN=... TELEGRAM_CHAT_ID=... TG_THREAD_CLONES=...
# Senza token: il monitor gira comunque (AMO + GitHub repo search) e logga su file.
set -euo pipefail

PROJECT_ROOT="/home/mrxxx/Dropbox/1 Programmazione/Progetti/ChromePlugin"
LOG="$PROJECT_ROOT/sviluppo/logs/clone-monitor.log"

[ -f "$HOME/.secrets/adoff-github.env" ]   && set -a && . "$HOME/.secrets/adoff-github.env"   && set +a || true
[ -f "$HOME/.secrets/adoff-telegram.env" ] && set -a && . "$HOME/.secrets/adoff-telegram.env" && set +a || true

echo "===== $(date -Is) =====" >> "$LOG"
cd "$PROJECT_ROOT"
node sviluppo/scripts/clone-monitor.js "$@" >> "$LOG" 2>&1
echo "" >> "$LOG"
