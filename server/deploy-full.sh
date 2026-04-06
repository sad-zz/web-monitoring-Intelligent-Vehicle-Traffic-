#!/bin/bash
# Full deploy helper: run all deploy parts in correct order
set -e

ROOT_DIR="/opt/tc-manager"

echo "=== TC Manager Full Deploy ==="
echo "[1/5] Running server deploy (part1)..."
bash /tmp/deploy-part1-server.sh

echo "[2/5] Running frontend data deploy (part2)..."
bash /tmp/deploy-part2-frontend.sh

echo "[3/5] Running html deploy (part3)..."
bash /tmp/deploy-part3-html.sh

echo "[4/5] Running css/js deploy (part4)..."
bash /tmp/deploy-part4-css-js.sh

echo "[5/5] Verifying services..."
systemctl is-active --quiet tc-manager && echo "tc-manager: active" || (echo "tc-manager: inactive" && exit 1)
systemctl is-active --quiet nginx && echo "nginx: active" || (echo "nginx: inactive" && exit 1)

if [ -f "$ROOT_DIR/server/.env" ]; then
  echo "Current SEND_INTERVAL_MINUTES:"
  grep -E '^SEND_INTERVAL_MINUTES=' "$ROOT_DIR/server/.env" || true
fi

echo "=== Full deploy done ==="
