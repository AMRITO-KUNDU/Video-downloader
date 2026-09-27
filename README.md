# VidGrab 2.0

VidGrab 2.0 is a standalone AI video search & downloader web application powered by React, Tailwind CSS, Vite, Node.js, and `yt-dlp`.

## Features
- 🎥 **Video Search & Discovery**: Search YouTube and preview video metadata instantly.
- ⚡ **High-Speed Downloads**: Download video and audio formats (MP4, MP3) in multiple resolutions (1080p, 720p, 480p, 360p).
- 🎨 **Neo-Brutalist UI**: Dynamic interface designed with Tailwind CSS & Lucide icons.
- 🐳 **Docker & Render Ready**: Includes a production-optimized `Dockerfile` with pre-configured `yt-dlp` and `ffmpeg` binaries.

## Getting Started

### Local Development
```bash
# Install dependencies
npm install

# In terminal 1: start the API (requires yt-dlp and ffmpeg on PATH)
npm start

# In terminal 2: start the frontend; /api calls are proxied to port 10000
npm run dev
```

### Production Build & Server
```bash
# Build frontend assets
npm run build

# Start backend server
npm start
```

The production server exposes `/api/search`, `/api/info`, `/api/download`, and
`/api/stream`. Downloads are processed on the server with yt-dlp and ffmpeg;
the browser never receives a raw extractor URL.

### Docker Deployment
```bash
# Build Docker image
docker build -t vidgrab .

# Run Docker container locally
docker run -p 10000:10000 vidgrab
```
