#!/bin/sh
set -e

SERVICE="opencode-portal.service"
TARGET="/etc/systemd/system/$SERVICE"

if [ "$(id -u)" -ne 0 ]; then
  echo "Run with sudo: sudo sh install.sh"
  exit 1
fi

cp "$SERVICE" "$TARGET"
systemctl daemon-reload
systemctl enable "$SERVICE"
systemctl restart "$SERVICE"
systemctl status "$SERVICE" --no-pager

echo ""
echo "Portal running at http://localhost:3050"
echo "Logs: journalctl -u $SERVICE -f"
