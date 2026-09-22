#!/usr/bin/env bash
set -e

SOURCEHUB_DIR="/home/mrnicholas/Dev/SourceHub"
URL="http://localhost:5173/"

# Check if SourceHub dev server is already running
if ! curl -s --connect-timeout 1 "$URL" > /dev/null 2>&1; then
  echo "SourceHub dev server is not running. Starting it now..."
  cd "$SOURCEHUB_DIR"
  nohup npm run dev -- --host 0.0.0.0 --port 5173 > "/home/mrnicholas/.sourcehub/server.log" 2>&1 &
  
  # Wait for server to become responsive
  for i in {1..20}; do
    if curl -s --connect-timeout 1 "$URL" > /dev/null 2>&1; then
      break
    fi
    sleep 0.5
  done
fi

# Launch in user's default browser
xdg-open "$URL" > /dev/null 2>&1 &
exit 0
