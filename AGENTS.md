# AGENTS.md

## Project Context

VidGrab 2.0 is a standalone React + Node.js video downloader app.

## Key Files

- `src/`: React frontend application source code.
- `src/api/apiClient.js`: Standalone client for API requests and local persistence.
- `server.js`: Standalone Express backend handling `yt-dlp` download requests.
- `Dockerfile`: Production container build for Render deployment.
- `vite.config.js`: Vite build configuration.
