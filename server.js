import express from "express";
import { execFile, spawn } from "child_process";
import { promisify } from "util";
import path from "path";
import os from "os";
import { fileURLToPath } from "url";
import fs from "fs";

const execFileAsync = promisify(execFile);
const __filename = fileURLToPath(import.meta.url);
const __dirname = path.dirname(__filename);

const app = express();
app.use(express.json());

const SUPPORTED_HOSTS = ["youtube.com", "youtu.be", "youtube-nocookie.com", "facebook.com", "fb.watch"];
const QUALITY_HEIGHTS = new Set(["1080p", "720p", "480p", "360p"]);

function validateVideoUrl(value) {
  try {
    const parsed = new URL(value);
    const hostname = parsed.hostname.toLowerCase().replace(/^www\./, "");
    return parsed.protocol === "http:" || parsed.protocol === "https:"
      ? SUPPORTED_HOSTS.some((host) => hostname === host || hostname.endsWith(`.${host}`))
      : false;
  } catch {
    return false;
  }
}

function durationLabel(seconds) {
  if (!Number.isFinite(seconds) || seconds <= 0) return "—";
  const total = Math.floor(seconds);
  const hours = Math.floor(total / 3600);
  const mins = Math.floor((total % 3600) / 60);
  const secs = total % 60;
  return hours ? `${hours}:${String(mins).padStart(2, "0")}:${String(secs).padStart(2, "0")}` : `${mins}:${String(secs).padStart(2, "0")}`;
}

function getBaseYtDlpArgs() {
  const args = [
    "-4",
    "--extractor-args", "youtube:player_client=android,web,mweb",
    "--no-warnings",
    "--socket-timeout", "30",
    "--retries", "10"
  ];
  if (process.env.YTDLP_COOKIES) {
    args.push("--cookies", process.env.YTDLP_COOKIES);
  }
  return args;
}

// API: Search YouTube real videos using yt-dlp
app.get("/api/search", async (req, res) => {
  const query = req.query.q;
  if (!query || typeof query !== "string") return res.json({ videos: [] });

  try {
    const args = [
      ...getBaseYtDlpArgs(),
      "--flat-playlist",
      "--dump-json",
      `ytsearch8:${query}`
    ];
    const { stdout } = await execFileAsync("yt-dlp", args, { maxBuffer: 10 * 1024 * 1024 });

    const lines = stdout.trim().split("\n").filter(Boolean);
    const videos = lines
      .map((line, i) => {
        try {
          const item = JSON.parse(line);
          const durationSec = item.duration || 0;
          const durStr = durationLabel(durationSec);
          const vId = item.id || (typeof item.url === "string" && /^[A-Za-z0-9_-]{11}$/.test(item.url) ? item.url : "");

          return {
            id: vId || `v_${i}`,
            videoId: vId,
            title: item.title || "YouTube Video",
            channel: item.uploader || item.channel || "YouTube Creator",
            views: item.view_count ? `${item.view_count.toLocaleString()} views` : "—",
            uploadDate: item.upload_date ? `${item.upload_date.slice(0, 4)}` : "—",
            duration: durStr,
            seconds: durationSec,
            url: vId ? `https://www.youtube.com/watch?v=${vId}` : item.webpage_url || "",
            thumbnail: vId
              ? `https://img.youtube.com/vi/${vId}/hqdefault.jpg`
              : item.thumbnails?.[0]?.url || "",
          };
        } catch {
          return null;
        }
      })
      .filter(Boolean);

    res.json({ videos });
  } catch (err) {
    console.error("Search error:", err);
    res.status(500).json({ error: "YouTube search failed", details: err.message });
  }
});

// API: Get real video info using yt-dlp
app.get("/api/info", async (req, res) => {
  const videoUrl = req.query.url;
  if (!videoUrl) return res.status(400).json({ error: "URL parameter required" });
  if (!validateVideoUrl(videoUrl)) return res.status(400).json({ error: "Only public YouTube and Facebook URLs are supported" });

  try {
    const args = [
      ...getBaseYtDlpArgs(),
      "--dump-json",
      "--no-playlist",
      videoUrl
    ];
    const { stdout } = await execFileAsync("yt-dlp", args, { maxBuffer: 10 * 1024 * 1024 });

    const item = JSON.parse(stdout);
    const durationSec = item.duration || 0;
    const durStr = durationLabel(durationSec);
    const vId = item.id;

    res.json({
      title: item.title,
      channel: item.uploader || item.channel || "YouTube",
      views: item.view_count ? `${item.view_count.toLocaleString()} views` : "—",
      uploadDate: item.upload_date || "—",
      duration: durStr,
      seconds: durationSec,
      url: videoUrl,
      videoId: vId,
      thumbnail: vId ? `https://img.youtube.com/vi/${vId}/hqdefault.jpg` : item.thumbnail || "",
    });
  } catch (err) {
    console.error("Info error:", err);
    res.status(500).json({ error: "Could not fetch video metadata", details: err.message });
  }
});

// API: Download info endpoint
app.post("/api/download", (req, res) => {
  const { url, format = "mp4", quality = "720p" } = req.body || {};
  if (!url) return res.status(400).json({ success: false, error: "URL is required" });
  if (!validateVideoUrl(url)) return res.status(400).json({ success: false, error: "Only public YouTube and Facebook URLs are supported" });
  if (!["mp4", "mp3"].includes(format)) return res.status(400).json({ success: false, error: "Unsupported format" });
  if (format === "mp4" && !QUALITY_HEIGHTS.has(quality)) return res.status(400).json({ success: false, error: "Unsupported quality" });

  const streamUrl = `/api/stream?url=${encodeURIComponent(url)}&format=${format}&quality=${quality}`;
  return res.json({
    success: true,
    url: streamUrl,
    format,
    quality,
  });
});

// API: Direct binary download stream via yt-dlp
app.get("/api/stream", (req, res) => {
  const { url, format = "mp4", quality = "720p" } = req.query;

  if (!url) {
    return res.status(400).send("URL parameter is required");
  }
  if (!validateVideoUrl(url)) return res.status(400).send("Only public YouTube and Facebook URLs are supported");
  if (!["mp4", "mp3"].includes(format)) return res.status(400).send("Unsupported format");
  if (format === "mp4" && !QUALITY_HEIGHTS.has(quality)) return res.status(400).send("Unsupported quality");

  const maxHeight = parseInt(quality, 10) || 720;
  const tempDir = fs.mkdtempSync(path.join(os.tmpdir(), "vidgrab-"));
  const outputTemplate = path.join(tempDir, "download.%(ext)s");
  let downloadComplete = false;
  let stderrOutput = "";

  let args = getBaseYtDlpArgs();
  let contentType = "video/mp4";
  let extension = "mp4";

  if (format === "mp3") {
    contentType = "audio/mpeg";
    extension = "mp3";
    args.push(
      "-x",
      "--audio-format", "mp3",
      "--audio-quality", "0",
      "--no-playlist",
      "-o", outputTemplate,
      url
    );
  } else {
    const formatStr = `bv*[height<=${maxHeight}]+ba/b[height<=${maxHeight}]`;
    args.push(
      "-f", formatStr,
      "--merge-output-format", "mp4",
      "--no-playlist",
      "--fragment-retries", "10",
      "-o", outputTemplate,
      url
    );
  }

  const ytDlpProcess = spawn("yt-dlp", args);

  ytDlpProcess.stderr.on("data", (data) => {
    const str = data.toString();
    stderrOutput += str;
    console.error("[yt-dlp stderr]:", str.trim());
  });

  ytDlpProcess.on("error", (err) => {
    console.error("yt-dlp process spawn error:", err);
    fs.rmSync(tempDir, { recursive: true, force: true });
    if (!res.headersSent) {
      res.status(500).send(`Failed to start yt-dlp process: ${err.message}`);
    }
  });

  ytDlpProcess.on("close", (code) => {
    if (code !== 0) {
      fs.rmSync(tempDir, { recursive: true, force: true });
      if (!res.headersSent) {
        res.status(502).send(`yt-dlp download failed with exit code ${code}: ${stderrOutput.slice(-300) || "Unknown error"}`);
      }
      return;
    }

    const file = fs.readdirSync(tempDir).find((name) => name.endsWith(`.${extension}`));
    if (!file) {
      fs.rmSync(tempDir, { recursive: true, force: true });
      if (!res.headersSent) {
        res.status(502).send("yt-dlp completed but output file was not found");
      }
      return;
    }

    const filePath = path.join(tempDir, file);
    downloadComplete = true;
    res.setHeader("Content-Disposition", `attachment; filename="vidgrab_${Date.now()}.${extension}"`);
    res.setHeader("Content-Type", contentType);
    res.setHeader("Content-Length", fs.statSync(filePath).size);

    const stream = fs.createReadStream(filePath);
    stream.on("close", () => {
      fs.rmSync(tempDir, { recursive: true, force: true });
    });
    stream.on("error", (streamErr) => {
      console.error("File stream error:", streamErr);
      fs.rmSync(tempDir, { recursive: true, force: true });
    });
    stream.pipe(res);
  });

  req.on("close", () => {
    if (!downloadComplete && !res.writableEnded) {
      if (!ytDlpProcess.killed) {
        ytDlpProcess.kill("SIGTERM");
      }
      fs.rmSync(tempDir, { recursive: true, force: true });
    }
  });
});

// Serve static frontend build in production
app.use(express.static(path.join(__dirname, "dist")));

app.get("*", (req, res) => {
  const indexPath = path.join(__dirname, "dist", "index.html");
  if (fs.existsSync(indexPath)) {
    res.sendFile(indexPath);
  } else {
    res.send("VidGrab Backend API Running");
  }
});

const PORT = process.env.PORT || 10000;
app.listen(PORT, "0.0.0.0", () => {
  console.log(`VidGrab server running on port ${PORT}`);
});
