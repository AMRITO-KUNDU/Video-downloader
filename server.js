/**
 * VidGrab backend — a simple wrapper over a self-hosted MeTube instance.
 *
 * MeTube is the download engine. This backend exposes only what the frontend
 * needs, using MeTube's own API and its exact option values.
 *
 * MeTube API used (per https://github.com/alexta69/metube):
 *   POST /add              { url, download_type, format, quality } -> { status: "ok" | "error", msg? }
 *   GET  /history          -> { done: [], queue: [], pending: [] }
 *   GET  /download/<file>       (video files)
 *   GET  /audio_download/<file> (audio files)
 *   GET  /version
 *
 * MeTube option values this app uses (all natively supported):
 *   video: download_type=video, format=mp4, quality in best|2160|1440|1080|720|480|360|240|worst
 *   audio: download_type=audio, format=mp3, quality in 320|192|128
 *
 * Env:
 *   METUBE_URL  (required)  e.g. https://your-metube.up.railway.app
 *
 * Removed on purpose (MeTube does not provide these): search, video metadata.
 */

import express from "express";
import path from "path";
import { fileURLToPath } from "url";
import fs from "fs";

let METUBE = (process.env.METUBE_URL || "").trim().replace(/\/+$/, "");
// Accept a bare host (e.g. "my-metube.up.railway.app") and add the scheme,
// so a missing https:// can never break the URL again.
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

// MeTube's exact allowed values (from its format catalog)
const VIDEO_QUALITIES = ["best", "2160", "1440", "1080", "720", "480", "360", "240", "worst"];

// The choices we expose to the UI — every one is natively supported by MeTube
const FORMATS = [
  { format_id: "max", label: "Best Quality", height: 2160, ext: "mp4", type: "video+audio", has_video: true, has_audio: true },
  { format_id: "1080", label: "1080p", height: 1080, ext: "mp4", type: "video+audio", has_video: true, has_audio: true },
  { format_id: "720", label: "720p", height: 720, ext: "mp4", type: "video+audio", has_video: true, has_audio: true },
  { format_id: "480", label: "480p", height: 480, ext: "mp4", type: "video+audio", has_video: true, has_audio: true },
  { format_id: "360", label: "360p", height: 360, ext: "mp4", type: "video+audio", has_video: true, has_audio: true },
  { format_id: "mp3", label: "MP3 (320 kbps)", height: null, abr: 320, ext: "mp3", type: "audio-only", has_video: false, has_audio: true },
];

// Map the app's format_id -> MeTube's new-style request body
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
// Routes
// ======================

// The format choices this app offers
app.get("/api/formats", (req, res) => {
  const url = req.query.url;
  if (!isYouTube(url)) {
    return res.status(400).json({ error: "Unsupported video URL" });
  }
  res.json({ videoUrl: url, formats: FORMATS, total: FORMATS.length });
});

// Queue a download on MeTube, wait for it, return a same-origin file URL
app.get("/api/direct-url", async (req, res) => {
  const { url, format_id } = req.query;
  if (!isYouTube(url)) {
    return res.status(400).json({ error: "Unsupported video URL" });
  }
  if (!format_id) {
    return res.status(400).json({ error: "format_id required" });
  }

  const body = toMeTubeBody(format_id, url);

  try {
    // If this URL was already completed before, remember its timestamp so a
    // re-download (MeTube keys `done` by URL) is still detected as new.
    const before =
      (await metube("/history")).done?.find((i) => i.url === url)?.timestamp ?? null;

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
      const mine = [...(h.done || []), ...(h.queue || []), ...(h.pending || [])].filter(
        (i) => i.url === url
      );

      const failed = mine.find((i) => i.status === "error" || i.error);
      if (failed) {
        return res.status(502).json({ error: failed.error || failed.msg || "Download failed" });
      }

      const finished = (h.done || []).find(
        (i) => i.url === url && i.status === "finished" && i.filename
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

// Stream a finished file through our own origin so the browser saves it
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

// MeTube's download history / queue, passed straight through
app.get("/api/history", async (_req, res) => {
  try {
    res.json(await metube("/history"));
  } catch (err) {
    res.status(502).json({ error: err.message });
  }
});

// Diagnostics: is MeTube reachable?
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
});
