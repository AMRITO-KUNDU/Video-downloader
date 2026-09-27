# Multi-stage Dockerfile optimized for Render web service deployment
FROM node:20-slim

# Install system runtime dependencies: python3, ffmpeg, ca-certificates & yt-dlp binary
RUN apt-get update && apt-get install -y --no-install-recommends \
    python3 \
    ffmpeg \
    curl \
    ca-certificates \
    && curl -L https://github.com/yt-dlp/yt-dlp/releases/latest/download/yt-dlp -o /usr/local/bin/yt-dlp \
    && chmod a+rx /usr/local/bin/yt-dlp \
    && apt-get clean \
    && rm -rf /var/lib/apt/lists/*

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
CMD ["sh", "-c", "npx vite preview --host 0.0.0.0 --port ${PORT:-10000}"]
