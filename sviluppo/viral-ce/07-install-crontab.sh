#!/usr/bin/env bash
#
# Fase 2: Install crontab entries for the ViralCE self-improving pipeline
#
# Schedules:
#   - Weekly Mon 10:00 UTC : ANALYZE cron (extract patterns from Fase 1 posts)
#   - Daily 08:00 UTC      : IDEATE generation (per active pillar)
#   - Nightly 22:00 UTC    : RERANK (update perf_score from real engagement)
#
# Usage:
#   bash 07-install-crontab.sh install   # add entries (idempotent)
#   bash 07-install-crontab.sh remove    # remove entries
#   bash 07-install-crontab.sh status    # show current entries
#
# IMPORTANT: LITELLM_MASTER_KEY must be available to cron.
#   This script reads it from /etc/litellm/.env via sudo at install time
#   and writes it into a protected env file: ~/.config/viral-ce/cron.env (chmod 600)

set -euo pipefail

VCE_DIR="/home/mrxxx/adoff/sviluppo/viral-ce"
CONFIG_DIR="$HOME/.config/viral-ce"
ENV_FILE="$CONFIG_DIR/cron.env"
MARKER="# VIRAL-CE-PIPELINE"

mkdir -p "$CONFIG_DIR"

write_env_file() {
    # Extract master key from system litellm env (requires sudo once)
    local mk
    mk=$(sudo grep '^LITELLM_MASTER_KEY' /etc/litellm/.env 2>/dev/null | cut -d= -f2 || echo "")
    if [[ -z "$mk" ]]; then
        echo "⚠️  Could not read LITELLM_MASTER_KEY from /etc/litellm/.env"
        echo "    Set it manually in $ENV_FILE"
        mk="REPLACE_WITH_MASTER_KEY"
    fi
    cat > "$ENV_FILE" <<EOF
export LITELLM_MASTER_KEY="$mk"
EOF
    chmod 600 "$ENV_FILE"
    echo "✓ Wrote $ENV_FILE (chmod 600)"
}

install_cron() {
    write_env_file

    # Pillars to generate briefs for daily (edit as needed)
    local pillars="privacy-awareness adblock-tips browser-security"

    # Build daily IDEATE lines (one per pillar, staggered 5 min apart)
    local ideate_lines=""
    local min=0
    for pillar in $pillars; do
        ideate_lines+="$min 8 * * * . $ENV_FILE && cd $VCE_DIR && python3 05-ideate-generate.py --pillar \"$pillar\" --platform tiktok >> $VCE_DIR/ideate.log 2>&1 $MARKER\n"
        min=$((min + 5))
    done

    # Remove existing entries first (idempotent)
    crontab -l 2>/dev/null | grep -v "$MARKER" > /tmp/crontab.tmp || true

    {
        cat /tmp/crontab.tmp
        echo "# ── ViralCE self-improving pipeline ──"
        echo "0 10 * * 1 . $ENV_FILE && cd $VCE_DIR && python3 02-cron-viral-scraper.py >> $VCE_DIR/analyze.log 2>&1 $MARKER"
        echo -e "$ideate_lines"
        echo "0 22 * * * cd $VCE_DIR && python3 06-feedback-rerank.py --mode rerank >> $VCE_DIR/rerank.log 2>&1 $MARKER"
    } | crontab -

    rm -f /tmp/crontab.tmp
    echo "✓ Installed ViralCE crontab entries"
    echo ""
    echo "Schedule:"
    echo "  Mon 10:00 → ANALYZE (extract patterns)"
    echo "  Daily 08:00 → IDEATE ($pillars)"
    echo "  Daily 22:00 → RERANK (self-improve)"
}

remove_cron() {
    crontab -l 2>/dev/null | grep -v "$MARKER" | grep -v "ViralCE self-improving" | crontab - || true
    echo "✓ Removed ViralCE crontab entries"
}

show_status() {
    echo "=== Current ViralCE crontab entries ==="
    crontab -l 2>/dev/null | grep -E "$MARKER|ViralCE" || echo "(none installed)"
}

case "${1:-status}" in
    install) install_cron ;;
    remove)  remove_cron ;;
    status)  show_status ;;
    *)
        echo "Usage: $0 {install|remove|status}"
        exit 1
        ;;
esac
