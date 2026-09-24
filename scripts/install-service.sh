#!/usr/bin/env bash
set -e

SCRIPT_DIR="$(cd "$(dirname "${BASH_SOURCE[0]}")" && pwd)"
SOURCEHUB_DIR="$(cd "${SCRIPT_DIR}/.." && pwd)"
SERVICE_DIR="${HOME}/.config/systemd/user"
SERVICE_FILE="${SERVICE_DIR}/sourcehub.service"
NPM_BIN="$(which npm || echo /usr/bin/npm)"
REPOS_DIR="${SOURCEHUB_REPOS_DIR:-${HOME}/Dev}"
BIND_HOST="${HOST:-127.0.0.1}"
SERVER_PORT="${PORT:-5173}"

echo "=== SourceHub Systemd Service Installer ==="
echo "Working directory: ${SOURCEHUB_DIR}"
echo "NPM binary:        ${NPM_BIN}"
echo "Repos directory:   ${REPOS_DIR}"
echo "Host / Port:       ${BIND_HOST}:${SERVER_PORT}"

# 1. Build production frontend
echo ""
echo "Building SourceHub frontend (npm run build)..."
cd "${SOURCEHUB_DIR}"
npm run build

# 2. Ensure systemd user directory exists
mkdir -p "${SERVICE_DIR}"

# 3. Write systemd user unit
echo "Writing ${SERVICE_FILE}..."
cat <<EOF > "${SERVICE_FILE}"
[Unit]
Description=SourceHub Production Daemon
Documentation=https://github.com/Nick040791/SourceHub
After=network.target

[Service]
Type=simple
WorkingDirectory=${SOURCEHUB_DIR}
ExecStart=${NPM_BIN} run serve
Restart=always
RestartSec=5
KillMode=process
Environment=NODE_ENV=production
Environment=PORT=${SERVER_PORT}
Environment=HOST=${BIND_HOST}
Environment=SOURCEHUB_REPOS_DIR=${REPOS_DIR}

[Install]
WantedBy=default.target
EOF

# 4. Reload and enable systemd user service
echo "Reloading systemd user daemon..."
systemctl --user daemon-reload
echo "Enabling sourcehub.service on boot..."
systemctl --user enable sourcehub.service

echo ""
echo "✓ SourceHub systemd user service installed successfully!"
echo "To start now:"
echo "  systemctl --user start sourcehub.service"
echo "To check status:"
echo "  systemctl --user status sourcehub.service"
echo "To view live logs:"
echo "  journalctl --user -u sourcehub.service -f"
echo "To uninstall:"
echo "  ${SOURCEHUB_DIR}/scripts/uninstall-service.sh"
echo "==========================================="
