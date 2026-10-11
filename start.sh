#!/bin/bash
set -e

echo "=========================================="
echo "Starting VidGrab Server"
echo "=========================================="
echo "Timestamp: $(date)"
echo "Node version: $(node --version)"
echo "Current directory: $(pwd)"
echo ""

# Check if COBALT_API_URL is set (will error on startup if not)
echo "[STARTUP] Checking COBALT_API_URL..."
if [ -z "$COBALT_API_URL" ]; then
  echo "[STARTUP] ERROR: COBALT_API_URL is not set!"
  echo "[STARTUP] Please set it to your external Cobalt instance URL."
  echo "[STARTUP] Example: export COBALT_API_URL=https://your-cobalt.onrender.com"
  echo "[STARTUP] NOTE: Configure cookies in your Cobalt instance (COOKIE_PATH or COOKIES env)"
  exit 1
fi

echo "[STARTUP] COBALT_API_URL is set: ${COBALT_API_URL:0:50}..."
echo "[STARTUP] Cookies: Configure in your Cobalt instance (COOKIE_PATH or COOKIES env var)"

# Check if YOUTUBE_API_KEY is set (optional)
echo "[STARTUP] Checking YOUTUBE_API_KEY..."
if [ -z "$YOUTUBE_API_KEY" ]; then
  echo "[STARTUP] WARNING: YOUTUBE_API_KEY is not set. YouTube metadata and search will be limited."
else
  echo "[STARTUP] YOUTUBE_API_KEY is set"
fi

# Check if COBALT_FALLBACKS are set
echo "[STARTUP] Checking fallback instances..."
if [ -n "$COBALT_FALLBACK_1" ]; then
  echo "[STARTUP] COBALT_FALLBACK_1 is set"
fi
if [ -n "$COBALT_FALLBACK_2" ]; then
  echo "[STARTUP] COBALT_FALLBACK_2 is set"
fi

echo ""
echo "[STARTUP] All checks passed. Starting server..."
echo "=========================================="
echo ""

cd /app
exec node server.js
