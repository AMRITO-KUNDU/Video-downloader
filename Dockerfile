# ================================
# VidGrab Downloader - External Cobalt Only
# ================================

FROM node:24-alpine

RUN apk add --no-cache \
    ffmpeg \
    curl \
    ca-certificates

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
