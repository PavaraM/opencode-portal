#!/bin/sh
set -e

DIR="$(cd "$(dirname "$0")" && pwd)"
SERVICE="opencode-portal.service"
TARGET="/etc/systemd/system/$SERVICE"

if [ "$(id -u)" -ne 0 ]; then
  echo "Run with sudo: sudo sh install.sh"
  exit 1
fi

# Pre-flight checks
if ! command -v node >/dev/null 2>&1; then echo "node not found — install Node.js >=18"; exit 1; fi
if ! command -v opencode >/dev/null 2>&1; then echo "opencode CLI not found — install from https://opencode.ai"; exit 1; fi
if ! command -v systemctl >/dev/null 2>&1; then echo "systemctl not found — not a systemd system"; exit 1; fi

NODE=$(command -v node)
USER=$(id -u -n)
PATH_ENV="${HOME}/.opencode/bin:/usr/local/bin:/usr/bin"

sed -e "s|__USER__|${USER}|g" \
    -e "s|__DIR__|${DIR}|g" \
    -e "s|__NODE__|${NODE}|g" \
    -e "s|__PATH__|${PATH_ENV}|g" \
    "$DIR/$SERVICE" > "$TARGET"

systemctl daemon-reload
systemctl enable "$SERVICE"
systemctl restart "$SERVICE" || true

echo ""
echo "Portal deployed. Check status: systemctl status $SERVICE --no-pager"
echo "Logs: journalctl -u $SERVICE -f"
echo "Default: http://localhost:3000"
