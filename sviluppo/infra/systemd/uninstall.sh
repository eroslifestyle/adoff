#!/usr/bin/env bash
# AdOff systemd units uninstaller — rimuove i symlink da /etc/ e ~/.config/
# Lascia intatti gli unit file nel progetto (sviluppo/infra/systemd/).
set -euo pipefail

SCRIPT_DIR="$(cd "$(dirname "${BASH_SOURCE[0]}")" && pwd)"
SYS_DST="/etc/systemd/system"

if [ "$(id -u)" -ne 0 ]; then
  echo "Devi lanciare come root (sudo)." >&2
  exit 1
fi

REAL_USER="${SUDO_USER:-mrxxx}"
USR_DST="/home/$REAL_USER/.config/systemd/user"

echo "[1/3] Stop unit attivi"
for u in adoff-admin-ui adoff-media-server adoff-scraper adoff-social-dispatch \
         adoff-imageworker.timer adoff-social-dispatch.timer adoff-imgserve \
         adoff-sdserver adoff-sdserver-qwen adoff-sdserver-flux2 cloudflared-adoff-admin; do
  systemctl stop "$u" 2>/dev/null || true
  systemctl disable "$u" 2>/dev/null || true
done

echo "[2/3] Rimuovo symlink SYSTEM"
for f in "$SYS_DST"/adoff-*.service "$SYS_DST"/adoff-*.timer "$SYS_DST"/cloudflared-adoff-admin.service; do
  [ -L "$f" ] && rm -v "$f"
done

echo "[3/3] Rimuovo symlink USER"
for f in "$USR_DST"/adoff-*.service; do
  [ -L "$f" ] && sudo -u "$REAL_USER" rm -v "$f"
done

systemctl daemon-reload
sudo -u "$REAL_USER" XDG_RUNTIME_DIR="/run/user/$(id -u "$REAL_USER")" systemctl --user daemon-reload || true

echo "Done. Unit file sorgenti restano in sviluppo/infra/systemd/."
