#!/usr/bin/env bash
#
# START.sh — ClaudeSounds production start script
#
# Installs dependencies, builds the Next.js frontend, then launches
# the Express API and the Next.js production server as background tasks.
#
# Usage:  ./START.sh
#

set -e

SCRIPT_DIR="$(cd "$(dirname "${BASH_SOURCE[0]}")" && pwd)"
cd "$SCRIPT_DIR"

echo "==> ClaudeSounds starting in $SCRIPT_DIR"

# ---------------------------------------------------------------------------
# 1. Load environment variables from .env if present
# ---------------------------------------------------------------------------
if [ -f ".env" ]; then
  echo "==> Loading environment from .env"
  set -a
  # shellcheck disable=SC1091
  . ./.env
  set +a
else
  echo "==> No .env file found (using process environment / defaults)"
fi

export NODE_ENV="${NODE_ENV:-production}"

# ---------------------------------------------------------------------------
# 2. Install dependencies
# ---------------------------------------------------------------------------
echo "==> Installing dependencies"
npm install --omit=dev || npm install

# ---------------------------------------------------------------------------
# 3. Build the Next.js production bundle
# ---------------------------------------------------------------------------
echo "==> Building Next.js production bundle"
npm run build

# ---------------------------------------------------------------------------
# 4. Prepare log directory
# ---------------------------------------------------------------------------
mkdir -p logs

# ---------------------------------------------------------------------------
# 5. Launch the Express API in the background
# ---------------------------------------------------------------------------
echo "==> Starting Express API (server/index.js)"
nohup node server/index.js > logs/api.log 2>&1 &
API_PID=$!
echo "$API_PID" > logs/api.pid

# Give the API a moment to bind its port before starting the web server
sleep 2

# ---------------------------------------------------------------------------
# 6. Launch the Next.js production server in the background
# ---------------------------------------------------------------------------
echo "==> Starting Next.js production server"
nohup npm run start > logs/web.log 2>&1 &
WEB_PID=$!
echo "$WEB_PID" > logs/web.pid

echo ""
echo "==> ClaudeSounds is up"
echo "    API  PID: $API_PID   (logs/api.log)"
echo "    Web  PID: $WEB_PID   (logs/web.log)"
echo ""
echo "    Stop with: kill $API_PID $WEB_PID"