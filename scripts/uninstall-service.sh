#!/usr/bin/env bash
set -e

SERVICE_FILE="${HOME}/.config/systemd/user/sourcehub.service"

echo "=== SourceHub Systemd Service Uninstaller ==="

if systemctl --user is-active --quiet sourcehub.service 2>/dev/null; then
  echo "Stopping active sourcehub.service..."
  systemctl --user stop sourcehub.service
fi

if systemctl --user is-enabled --quiet sourcehub.service 2>/dev/null; then
  echo "Disabling sourcehub.service..."
  systemctl --user disable sourcehub.service
fi

if [ -f "${SERVICE_FILE}" ]; then
  echo "Removing ${SERVICE_FILE}..."
  rm -f "${SERVICE_FILE}"
fi

systemctl --user daemon-reload
echo "✓ SourceHub systemd user service removed."
echo "============================================="
