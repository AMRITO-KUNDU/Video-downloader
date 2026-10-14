# ================================
# VidGrab Downloader - Self-hosted MeTube
# ================================

FROM node:24-alpine

RUN apk add --no-cache \
    ffmpeg \
    curl \
    ca-certificates

# yt-dlp — the metadata engine MeTube uses — so the app can report duration and
# upload date for sites the YouTube API doesn't cover (e.g. Facebook). Tries the
# musl release binary (always current), then Alpine's package, and degrades
# gracefully so a download hiccup can never fail the image build.
RUN set -e; \
    if curl -fsSL https://github.com/yt-dlp/yt-dlp/releases/latest/download/yt-dlp_musllinux -o /tmp/yt-dlp \
       && chmod +x /tmp/yt-dlp \
       && /tmp/yt-dlp --version; then \
      mv /tmp/yt-dlp /usr/local/bin/yt-dlp; \
      echo "yt-dlp (release binary) installed"; \
    elif apk add --no-cache yt-dlp && yt-dlp --version; then \
      echo "yt-dlp (apk package) installed"; \
    else \
      echo "WARN: yt-dlp unavailable; metadata will fall back to page scraping"; \
    fi

WORKDIR /app

COPY package*.json ./
RUN npm install

COPY . .
RUN npm run build

# Environment variables
ENV PORT=10000

# Install startup script and normalize line endings
COPY start.sh /start.sh
RUN sed -i 's/\r$//' /start.sh \
    && chmod +x /start.sh \
    && test -f /start.sh

EXPOSE 10000

CMD ["/bin/sh", "/start.sh"]
