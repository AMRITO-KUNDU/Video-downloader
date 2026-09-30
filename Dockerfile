# Multi-stage Dockerfile optimized for Render web service deployment
FROM node:20-slim

# Install system runtime dependencies, yt-dlp via pip, and Deno JS runtime (for YouTube n-challenge)
RUN apt-get update && apt-get install -y --no-install-recommends \
    python3 python3-pip ffmpeg curl ca-certificates unzip \
    && pip3 install --break-system-packages --no-cache-dir -U "yt-dlp[default]" \
    && curl -fsSL https://deno.land/install.sh | DENO_INSTALL=/usr/local sh \
    && yt-dlp --version \
    && deno --version \
    && apt-get clean && rm -rf /var/lib/apt/lists/*

# Set working directory
WORKDIR /app

# Copy package descriptors
COPY package*.json ./

# Install application dependencies
RUN npm install

# Copy application source
COPY . .

# Build production bundle
RUN npm run build

# Render sets PORT dynamically (defaults to 10000)
ENV PORT=10000
EXPOSE 10000

# Run host bound on 0.0.0.0 for Render external web routing
CMD ["node", "server.js"]
