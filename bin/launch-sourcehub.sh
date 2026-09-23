#!/usr/bin/env bash
set -e

SCRIPT_DIR="$(cd "$(dirname "${BASH_SOURCE[0]}")" && pwd)"
SOURCEHUB_DIR="$(cd "${SCRIPT_DIR}/.." && pwd)"
DATA_DIR="${SOURCEHUB_DATA_DIR:-${HOME}/.sourcehub}"
PORT="${PORT:-5173}"
URL="http://localhost:${PORT}/"

mkdir -p "${DATA_DIR}"

# Check if SourceHub server is already running
if ! curl -s --connect-timeout 1 "$URL" > /dev/null 2>&1; then
  echo "SourceHub server is not running. Starting it now..."
  cd "$SOURCEHUB_DIR"

  if [ -f "${SOURCEHUB_DIR}/dist/index.html" ]; then
    nohup npm run serve > "${DATA_DIR}/server.log" 2>&1 &
  else
    nohup npm run dev -- --port "${PORT}" > "${DATA_DIR}/server.log" 2>&1 &
  fi

  # Wait for server to become responsive
  for i in {1..20}; do
    if curl -s --connect-timeout 1 "$URL" > /dev/null 2>&1; then
      break
    fi
    sleep 0.5
  done
fi

# Launch in user's default browser
if command -v xdg-open > /dev/null 2>&1; then
  xdg-open "$URL" > /dev/null 2>&1 &
elif command -v open > /dev/null 2>&1; then
  open "$URL" > /dev/null 2>&1 &
fi

exit 0
