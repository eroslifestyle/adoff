#!/usr/bin/env bash
# Installa le unit systemd dei suggerimenti seguendo l'OWNER model:
# il progetto è SSOT, /etc/systemd/system contiene solo SYMLINK ai file del progetto.
# Richiede sudo. Abilita SOLO il timer di analisi (read-only/safe); il timer
# di esecuzione resta da abilitare manualmente dopo il primo giro supervisionato.
set -euo pipefail

SRC="/home/mrxxx/adoff/sviluppo/infra/systemd/system"
DST="/etc/systemd/system"
UNITS=(
  adoff-suggestions-analysis.service
  adoff-suggestions-analysis.timer
  adoff-suggestions-execute.service
  adoff-suggestions-execute.timer
  adoff-support-triage.service
  adoff-support-triage.timer
)

for u in "${UNITS[@]}"; do
  sudo ln -sf "$SRC/$u" "$DST/$u"
  echo "symlink: $DST/$u -> $SRC/$u"
done

sudo systemctl daemon-reload

# Abilita l'analisi settimanale suggerimenti (sicura, non modifica codice).
sudo systemctl enable --now adoff-suggestions-analysis.timer
echo "Abilitato: adoff-suggestions-analysis.timer"

# Abilita il triage supporto orario (default PROPOSE: posta bozze su Telegram, non invia email).
sudo systemctl enable --now adoff-support-triage.timer
echo "Abilitato: adoff-support-triage.timer (modo PROPOSE — bozze su Telegram)"

echo
echo "EXECUTE suggerimenti: installato ma NON abilitato (deploy autonomo)."
echo "  sudo systemctl edit adoff-suggestions-execute.service   # Environment=SUGG_EXECUTE_CONFIRM=1"
echo "  sudo systemctl enable --now adoff-suggestions-execute.timer"
echo
echo "Triage supporto in AUTO (risponde+chiude i ticket BASE da solo, rimborsi sempre umani):"
echo "  sudo systemctl edit adoff-support-triage.service        # Environment=SUPPORT_AUTO_REPLY=1"
echo
systemctl list-timers 'adoff-*' --all || true
