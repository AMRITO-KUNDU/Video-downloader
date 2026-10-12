/**
 * VidGrab backend
 *
 *  Search + metadata -> YouTube Data API v3 (as before)
 *  Downloads         -> self-hosted MeTube (its own API)
 *
 * MeTube API used:
 *   POST /add              { url, download_type, format, quality } -> { status: "ok" | "error", msg? }
 *   GET  /history          -> { done: [], queue: [], pending: [] }
 *   GET  /download/<file>       (video files)
 *   GET  /audio_download/<file> (audio files)
 *   GET  /version
 *
 * MeTube option values used:
 *   video: download_type=video, format=mp4, quality in best|2160|1440|1080|720|480|360|240|worst
 *   audio: download_type=audio, format=mp3, quality in 320|192|128
 *
 * Env:
 *   METUBE_URL        (required)  e.g. https://your-metube.up.railway.app
 *   YOUTUBE_API_KEY   (optional)  enables search + full metadata
 */

import express from "express";
import path from "path";
import { fileURLToPath } from "url";
import fs from "fs";

let METUBE = (process.env.METUBE_URL || "").trim().replace(/\/+$/, "");
// Accept a bare host (e.g. "my-metube.up.railway.app") and add the scheme,
// so a missing https:// can never break the URL.
if (METUBE && !/^https?:\/\//i.test(METUBE)) METUBE = `https://${METUBE}`;
if (!METUBE) {
  console.error("[SERVER] FATAL: METUBE_URL is not set. Set it to your MeTube URL.");
  process.exit(1);
}

const app = express();
app.use(express.json());

const __dirname = path.dirname(fileURLToPath(import.meta.url));

// ======================
// Helpers
// ======================

const YOUTUBE_RE =
  /^https?:\/\/(www\.|m\.)?(youtube\.com|youtu\.be|youtube-nocookie\.com)\//i;
const isYouTube = (u) => typeof u === "string" && YOUTUBE_RE.test(u);

function extractYouTubeId(url) {
  if (!url || typeof url !== "string") return null;
  const match = url.match(
    /(?:youtube\.com\/(?:watch\?v=|embed\/|shorts\/|v\/)|youtu\.be\/)([A-Za-z0-9_-]{11})/
  );
  return match ? match[1] : null;
}

function parseIsoDuration(iso) {
  if (!iso || typeof iso !== "string") return 0;
  const m = iso.match(/PT(?:(\d+)H)?(?:(\d+)M)?(?:(\d+)S)?/);
  if (!m) return 0;
  return (
    parseInt(m[1] || "0", 10) * 3600 +
    parseInt(m[2] || "0", 10) * 60 +
    parseInt(m[3] || "0", 10)
  );
}

function durationLabel(seconds) {
  if (!Number.isFinite(seconds) || seconds <= 0) return "--";
  const total = Math.floor(seconds);
  const hours = Math.floor(total / 3600);
  const mins = Math.floor((total % 3600) / 60);
  const secs = total % 60;
  return hours
    ? `${hours}:${String(mins).padStart(2, "0")}:${String(secs).padStart(2, "0")}`
    : `${mins}:${String(secs).padStart(2, "0")}`;
}

function formatViews(n) {
  if (!Number.isFinite(n)) return "--";
  if (n >= 1_000_000) return `${(n / 1_000_000).toFixed(1)}M views`;
  if (n >= 1_000) return `${(n / 1_000).toFixed(1)}K views`;
  return `${n} views`;
}

// ======================
// MeTube download side
// ======================

const VIDEO_QUALITIES = ["best", "2160", "1440", "1080", "720", "480", "360", "240", "worst"];

const FORMATS = [
  { format_id: "max", label: "Best Quality", height: 2160, ext: "mp4", type: "video+audio", has_video: true, has_audio: true },
  { format_id: "1080", label: "1080p", height: 1080, ext: "mp4", type: "video+audio", has_video: true, has_audio: true },
  { format_id: "720", label: "720p", height: 720, ext: "mp4", type: "video+audio", has_video: true, has_audio: true },
  { format_id: "480", label: "480p", height: 480, ext: "mp4", type: "video+audio", has_video: true, has_audio: true },
  { format_id: "360", label: "360p", height: 360, ext: "mp4", type: "video+audio", has_video: true, has_audio: true },
  { format_id: "mp3", label: "MP3 (320 kbps)", height: null, abr: 320, ext: "mp3", type: "audio-only", has_video: false, has_audio: true },
];

function toMeTubeBody(formatId, url) {
  const id = String(formatId || "720");
  if (id === "mp3" || id === "audio" || id === "audio_mp3") {
    return { url, download_type: "audio", format: "mp3", quality: "320" };
  }
  const q = id.replace(/p$/, "");
  return {
    url,
    download_type: "video",
    format: "mp4",
    quality: VIDEO_QUALITIES.includes(q) ? q : "720",
  };
}

async function metube(pathname, options = {}, timeoutMs = 60000) {
  const res = await fetch(`${METUBE}${pathname}`, {
    ...options,
    signal: AbortSignal.timeout(timeoutMs),
  });
  if (!res.ok) {
    const body = await res.text().catch(() => "");
    throw new Error(`MeTube ${pathname} -> HTTP ${res.status} ${body.slice(0, 200)}`);
  }
  return res.json();
}

const sleep = (ms) => new Promise((r) => setTimeout(r, ms));

// ======================
// Routes — search + metadata (YouTube Data API)
// ======================

// Search
app.get("/api/search", async (req, res) => {
  const query = req.query.q;
  if (!query || typeof query !== "string" || !query.trim()) {
    return res.json({ videos: [] });
  }
  const apiKey = process.env.YOUTUBE_API_KEY;
  if (!apiKey) {
    console.warn("[API:/api/search] YOUTUBE_API_KEY not set");
    return res.json({ videos: [] });
  }
  try {
    const searchUrl =
      "https://www.googleapis.com/youtube/v3/search?part=snippet&type=video&maxResults=10" +
      `&q=${encodeURIComponent(query.trim())}&key=${apiKey}`;
    const searchRes = await fetch(searchUrl);
    if (!searchRes.ok) {
      const e = await searchRes.json().catch(() => ({}));
      return res.status(502).json({ error: e.error?.message || `YouTube search HTTP ${searchRes.status}` });
    }
    const searchData = await searchRes.json();
    const items = searchData.items || [];
    if (items.length === 0) return res.json({ videos: [] });

    const ids = items.map((i) => i.id.videoId).filter(Boolean).join(",");
    const detailsRes = await fetch(
      `https://www.googleapis.com/youtube/v3/videos?part=contentDetails,statistics&id=${ids}&key=${apiKey}`
    );
    const detailsData = detailsRes.ok ? await detailsRes.json() : { items: [] };
    const detailsMap = {};
    for (const d of detailsData.items || []) detailsMap[d.id] = d;

    const videos = items.map((item) => {
      const id = item.id.videoId;
      const details = detailsMap[id] || {};
      const seconds = parseIsoDuration(details.contentDetails?.duration);
      return {
        id,
        videoId: id,
        title: item.snippet?.title || "YouTube Video",
        channel: item.snippet?.channelTitle || "YouTube Creator",
        views: formatViews(parseInt(details.statistics?.viewCount || "0", 10)),
        uploadDate: item.snippet?.publishedAt?.slice(0, 10) || "--",
        duration: durationLabel(seconds),
        seconds,
        url: `https://www.youtube.com/watch?v=${id}`,
        thumbnail:
          item.snippet?.thumbnails?.high?.url ||
          item.snippet?.thumbnails?.medium?.url ||
          `https://img.youtube.com/vi/${id}/hqdefault.jpg`,
      };
    });
    return res.json({ videos });
  } catch (err) {
    console.error("[API:/api/search] ERROR:", err.message);
    res.status(500).json({ error: "Search failed", details: err.message });
  }
});

// Video metadata
app.get("/api/info", async (req, res) => {
  const videoUrl = req.query.url;
  if (!isYouTube(videoUrl)) {
    return res.status(400).json({ error: "Unsupported video URL" });
  }

  const ytId = extractYouTubeId(videoUrl);
  const defaultThumbnail = ytId ? `https://img.youtube.com/vi/${ytId}/hqdefault.jpg` : "";
  const apiKey = process.env.YOUTUBE_API_KEY;

  if (apiKey && ytId) {
    try {
      const apiUrl = `https://www.googleapis.com/youtube/v3/videos?part=snippet,contentDetails,statistics&id=${ytId}&key=${apiKey}`;
      const r = await fetch(apiUrl);
      if (r.ok) {
        const data = await r.json();
        const item = data.items?.[0];
        if (item) {
          const seconds = parseIsoDuration(item.contentDetails?.duration);
          return res.json({
            title: item.snippet?.title || `YouTube Video (${ytId})`,
            channel: item.snippet?.channelTitle || "YouTube Creator",
            views: formatViews(parseInt(item.statistics?.viewCount || "0", 10)),
            uploadDate: item.snippet?.publishedAt?.slice(0, 10) || "--",
            duration: durationLabel(seconds),
            seconds,
            url: videoUrl,
            videoId: ytId,
            thumbnail:
              item.snippet?.thumbnails?.high?.url ||
              item.snippet?.thumbnails?.medium?.url ||
              defaultThumbnail,
          });
        }
      }
    } catch (err) {
      console.error("[API:/api/info] YouTube API failed:", err.message);
    }
  }

  // oEmbed fallback
  try {
    const oembed = await fetch(`https://noembed.com/embed?url=${encodeURIComponent(videoUrl)}`);
    if (oembed.ok) {
      const data = await oembed.json();
      if (data?.title) {
        return res.json({
          title: data.title,
          channel: data.author_name || "Video Creator",
          views: "--",
          uploadDate: "--",
          duration: "--",
          seconds: 0,
          url: videoUrl,
          videoId: ytId || "",
          thumbnail: data.thumbnail_url || defaultThumbnail,
        });
      }
    }
  } catch (err) {
    console.error("[API:/api/info] oEmbed failed:", err.message);
  }

  res.json({
    title: ytId ? `YouTube Video (${ytId})` : "YouTube Video",
    channel: "YouTube Creator",
    views: "--",
    uploadDate: "--",
    duration: "--",
    seconds: 0,
    url: videoUrl,
    videoId: ytId || "",
    thumbnail: defaultThumbnail,
  });
});

// ======================
// Routes — downloads (MeTube)
// ======================

app.get("/api/formats", (req, res) => {
  const url = req.query.url;
  if (!isYouTube(url)) {
    return res.status(400).json({ error: "Unsupported video URL" });
  }
  res.json({ videoUrl: url, formats: FORMATS, total: FORMATS.length });
});

app.get("/api/direct-url", async (req, res) => {
  const { url, format_id } = req.query;
  if (!isYouTube(url)) {
    return res.status(400).json({ error: "Unsupported video URL" });
  }
  if (!format_id) {
    return res.status(400).json({ error: "format_id required" });
  }

  const body = toMeTubeBody(format_id, url);

  // MeTube stores yt-dlp's NORMALIZED url (e.g. youtu.be/ID -> youtube.com/watch?v=ID),
  // so match on the video id, never on the url the user pasted.
  const vid = extractYouTubeId(url);
  const matches = (i) => (vid ? i.id === vid : i.url === url);

  try {
    const before =
      (await metube("/history")).done?.find(matches)?.timestamp ?? null;

    const added = await metube("/add", {
      method: "POST",
      headers: { "Content-Type": "application/json" },
      body: JSON.stringify(body),
    });
    if (added?.status === "error") {
      return res.status(502).json({ error: added.msg || "MeTube rejected the download" });
    }

    const deadline = Date.now() + 180000;
    while (Date.now() < deadline) {
      const h = await metube("/history");
      const mine = [...(h.done || []), ...(h.queue || []), ...(h.pending || [])].filter(matches);

      const failed = mine.find((i) => i.status === "error" || i.error);
      if (failed) {
        return res.status(502).json({ error: failed.error || failed.msg || "Download failed" });
      }

      const finished = (h.done || []).find(
        (i) => matches(i) && i.status === "finished" && i.filename
      );
      if (finished && (before === null || finished.timestamp !== before)) {
        const audio = body.download_type === "audio";
        return res.json({
          success: true,
          directUrl: `/api/file?name=${encodeURIComponent(finished.filename)}&type=${audio ? "audio" : "video"}`,
          filename: finished.filename,
          ext: audio ? "mp3" : "mp4",
          format_id,
        });
      }
      await sleep(2000);
    }
    return res.status(504).json({ error: "Timed out waiting for MeTube" });
  } catch (err) {
    console.error("[/api/direct-url] ERROR:", err.message);
    return res.status(500).json({ error: err.message });
  }
});

app.get("/api/file", async (req, res) => {
  const { name, type } = req.query;
  if (!name || typeof name !== "string") {
    return res.status(400).send("name required");
  }
  const dir = type === "audio" ? "audio_download" : "download";
  try {
    const upstream = await fetch(`${METUBE}/${dir}/${encodeURIComponent(name)}`);
    if (!upstream.ok || !upstream.body) {
      return res.status(502).send("File not available");
    }
    res.setHeader("Content-Type", upstream.headers.get("content-type") || "application/octet-stream");
    res.setHeader("Content-Disposition", `attachment; filename="${name.replace(/[\r\n"]/g, "")}"`);
    const { Readable } = await import("node:stream");
    Readable.fromWeb(upstream.body).pipe(res);
  } catch (err) {
    console.error("[/api/file] ERROR:", err.message);
    res.status(500).send("Failed to fetch file");
  }
});

app.get("/api/history", async (_req, res) => {
  try {
    res.json(await metube("/history"));
  } catch (err) {
    res.status(502).json({ error: err.message });
  }
});

app.get("/api/health", async (_req, res) => {
  try {
    const v = await fetch(`${METUBE}/version`, { signal: AbortSignal.timeout(10000) });
    res.json({ ok: true, metube: METUBE, version: (await v.text()).trim() });
  } catch (err) {
    res.json({ ok: false, metube: METUBE, error: err.message });
  }
});

// ======================
// Frontend (built React app)
// ======================

app.use(express.static(path.join(__dirname, "dist")));

app.get("*", (_req, res) => {
  const index = path.join(__dirname, "dist", "index.html");
  if (fs.existsSync(index)) res.sendFile(index);
  else res.send("VidGrab backend is running");
});

// ======================
// Start
// ======================

const PORT = process.env.PORT || 10000;
app.listen(PORT, "0.0.0.0", () => {
  console.log(`[SERVER] VidGrab backend on port ${PORT}`);
  console.log(`[SERVER] MeTube: ${METUBE}`);
  console.log(`[SERVER] YOUTUBE_API_KEY: ${process.env.YOUTUBE_API_KEY ? "set" : "NOT set (search disabled)"}`);
});
