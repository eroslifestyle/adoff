#!/usr/bin/env bash
# Single deploy path for the AdOff website (adoff.app).
# Runs the i18n gate + leak checks BEFORE pushing to Cloudflare Pages,
# so a missing/untranslated string or a privacy leak can never ship.
set -euo pipefail

ROOT="$(cd "$(dirname "$0")/../.." && pwd)"
cd "$ROOT"

echo "── 1/3 · i18n gate ──────────────────────────────────────────"
# Regenerate baked SEO prose from their master (sviluppo/seo-tools/.state/prose),
# then verify zero content drift. The master is the single source for prose i18n.
python3 sviluppo/scripts/prose_i18n.py apply-all
python3 sviluppo/scripts/prose_i18n.py check-all  # exits non-zero on content drift
# Rebuild runtime JSON from the single source, then hard-gate.
python3 sviluppo/scripts/i18n_manager.py build
python3 sviluppo/scripts/i18n_manager.py check   # exits non-zero on missing/HTML-desync
python3 sviluppo/scripts/i18n_manager.py pages   # baked SEO prose: exist/lang/hreflang per lang

echo "── 2/3 · leak checks ────────────────────────────────────────"
if grep -rniE "erosdegrande|LeoDg|mailto:support" site/ --include="*.html" --include="*.js" 2>/dev/null; then
  echo "✗ identity/contact leak found — aborting"; exit 1
fi
# brand leak only in extension code/assets, NOT in marketing copy (site copy is allowed)
echo "  leak checks ok"

echo "── perf · critical CSS inline + async /style.css ────────────"
# Elimina il render-blocking di /style.css: inietta il critical CSS above-the-fold
# (penthouse → .state/critical.css) e carica style.css async (preload→onload).
# Idempotente/re-eseguibile: gira sull'output finale di site/ prima del deploy.
python3 sviluppo/seo-tools/inline_critical_css.py

echo "── 3/3 · deploy ─────────────────────────────────────────────"
export PATH="$HOME/.local/bin:$PATH"
# shellcheck disable=SC1090
source ~/.secrets/adoff-stores.env 2>/dev/null || true
export CLOUDFLARE_API_TOKEN="${CF_API_TOKEN:-${CLOUDFLARE_API_TOKEN:-}}"
export CLOUDFLARE_ACCOUNT_ID="${CF_ACCOUNT_ID:-${CLOUDFLARE_ACCOUNT_ID:-}}"
# Staging: dev artifacts (knowledge graph, istruzioni interne) NON devono andare
# online — il 2026-06-13 CLAUDE.md e graphify-out/ erano serviti da adoff.app.
# Pages deploya snapshot completi: escluderli qui li RIMUOVE anche dal sito live.
STAGING="$(mktemp -d /tmp/adoff-site-deploy.XXXXXX)"
trap 'rm -rf "$STAGING"' EXIT
rsync -a --exclude='graphify-out' --exclude='CLAUDE.md' --exclude='.state' \
  --exclude='*.log' --exclude='*.tmp' site/ "$STAGING/"
wrangler pages deploy "$STAGING" --project-name adoff-site

echo "✅ deploy complete (i18n gate passed)"
