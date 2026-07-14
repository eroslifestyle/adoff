#!/usr/bin/env bash
# AdOff systemd units installer — OWNER MODEL
# Il progetto è SSOT degli unit file: /etc/systemd/system/ e ~/.config/systemd/user/
# contengono solo symlink che puntano qui.
#
# Uso: sudo ./install.sh [--enable-scraper]
set -euo pipefail

SCRIPT_DIR="$(cd "$(dirname "${BASH_SOURCE[0]}")" && pwd)"
SYS_SRC="$SCRIPT_DIR/system"
USR_SRC="$SCRIPT_DIR/user"
SYS_DST="/etc/systemd/system"
USR_DST="$HOME/.config/systemd/user"

if [ "$(id -u)" -ne 0 ]; then
  echo "Devi lanciare come root (sudo)." >&2
  exit 1
fi

REAL_USER="${SUDO_USER:-mrxxx}"
USR_DST="/home/$REAL_USER/.config/systemd/user"

echo "[1/4] Symlink unit files SYSTEM in $SYS_DST"
for f in "$SYS_SRC"/*.service "$SYS_SRC"/*.timer; do
  [ -f "$f" ] || continue
  name="$(basename "$f")"
  ln -sfn "$f" "$SYS_DST/$name"
  echo "  $SYS_DST/$name -> $f"
done

echo "[2/4] Symlink unit files USER in $USR_DST"
mkdir -p "$USR_DST"
chown "$REAL_USER:$REAL_USER" "$USR_DST"
for f in "$USR_SRC"/*.service; do
  [ -f "$f" ] || continue
  name="$(basename "$f")"
  sudo -u "$REAL_USER" ln -sfn "$f" "$USR_DST/$name"
  echo "  $USR_DST/$name -> $f"
done

echo "[3/4] systemctl daemon-reload (system + user)"
systemctl daemon-reload
sudo -u "$REAL_USER" XDG_RUNTIME_DIR="/run/user/$(id -u "$REAL_USER")" systemctl --user daemon-reload || true

echo "[4/4] Stato"
for u in adoff-admin-ui adoff-media-server adoff-scraper adoff-social-dispatch \
         adoff-imageworker adoff-imgserve adoff-sdserver adoff-sdserver-qwen \
         adoff-sdserver-flux2 cloudflared-adoff-admin; do
  printf "  %-32s enabled=%s active=%s\n" "$u" \
    "$(systemctl is-enabled "$u".service 2>/dev/null || echo n/a)" \
    "$(systemctl is-active "$u".service 2>/dev/null || echo n/a)"
done

if [ "${1:-}" = "--enable-scraper" ]; then
  echo "Enabling adoff-scraper.service per boot..."
  systemctl enable --now adoff-scraper.service
fi

echo "Done."
