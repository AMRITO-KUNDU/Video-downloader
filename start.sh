#!/bin/bash
set -e

echo "=========================================="
echo "Starting VidGrab Server"
echo "=========================================="
echo "Timestamp: $(date)"
echo "Node version: $(node --version)"
echo "Current directory: $(pwd)"
echo ""

# Check if METUBE_URL is set (will error on startup if not)
echo "[STARTUP] Checking METUBE_URL..."
if [ -z "$METUBE_URL" ]; then
  echo "[STARTUP] ERROR: METUBE_URL is not set!"
  echo "[STARTUP] Please set it to your self-hosted MeTube instance URL."
  echo "[STARTUP] Example: export METUBE_URL=https://your-metube.up.railway.app"
  echo "[STARTUP] NOTE: Configure YouTube cookies in the MeTube instance if needed."
  exit 1
fi

echo "[STARTUP] METUBE_URL is set: ${METUBE_URL:0:50}..."
echo "[STARTUP] Cookies: Configure in your MeTube instance (upload in the UI or via YTDL_OPTIONS)"

# Check if YOUTUBE_API_KEY is set (optional)
echo "[STARTUP] Checking YOUTUBE_API_KEY..."
if [ -z "$YOUTUBE_API_KEY" ]; then
  echo "[STARTUP] WARNING: YOUTUBE_API_KEY is not set. YouTube metadata and search will be limited."
else
  echo "[STARTUP] YOUTUBE_API_KEY is set"
fi

echo ""
echo "[STARTUP] All checks passed. Starting server..."
echo "=========================================="
echo ""

cd /app
exec node server.js
