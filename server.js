import express from "express";
import path from "path";
import { fileURLToPath } from "url";
import fs from "fs";

console.log("[SERVER] Starting VidGrab server...");

import {
  getInfo,
  getFormats,
  getDirectUrl,
  validateVideoUrl,
  search as cobaltSearch
} from "./src/lib/cobaltService.js";

const __filename = fileURLToPath(import.meta.url);
const __dirname = path.dirname(__filename);

const app = express();
app.use(express.json());

// Request logging middleware
app.use((req, res, next) => {
  const start = Date.now();
  const logId = Math.random().toString(36).substring(2, 8);
  console.log(`[${logId}] ${req.method} ${req.path} - Query:`, req.query, "Body:", req.body);
  
  res.on('finish', () => {
    const duration = Date.now() - start;
    console.log(`[${logId}] ${req.method} ${req.path} - Status: ${res.statusCode} Duration: ${duration}ms`);
  });
  
  next();
});

// ======================
// API Routes
// ======================

// Search
app.get("/api/search", async (req, res) => {
  console.log("[API:/api/search] Called");
  const query = req.query.q;
  console.log("[API:/api/search] Query:", query);

  if (!query || typeof query !== "string") {
    console.log("[API:/api/search] Invalid query");
    return res.json({ videos: [] });
  }

  try {
    console.log("[API:/api/search] Calling cobaltSearch...");
    const videos = await cobaltSearch(query);
    console.log("[API:/api/search] Success, videos count:", videos?.length || 0);
    return res.json({ videos: videos || [] });
  } catch (err) {
    console.error("[API:/api/search] ERROR:", err.message);
    console.error("[API:/api/search] Stack:", err.stack);
    res.status(500).json({
      error: "Search failed",
      details: err.message
    });
  }
});

// Video metadata
app.get("/api/info", async (req, res) => {
  console.log("[API:/api/info] Called");
  const videoUrl = req.query.url;
  console.log("[API:/api/info] URL:", videoUrl);

  if (!videoUrl) {
    console.log("[API:/api/info] URL parameter missing");
    return res.status(400).json({ error: "URL parameter required" });
  }

  const isValid = validateVideoUrl(videoUrl);
  console.log("[API:/api/info] URL valid:", isValid);
  if (!isValid) {
    return res.status(400).json({ error: "Unsupported video URL" });
  }

  try {
    console.log("[API:/api/info] Calling getInfo...");
    const info = await getInfo(videoUrl);
    console.log("[API:/api/info] Success, title:", info.title);
    return res.json(info);
  } catch (err) {
    console.error("[API:/api/info] ERROR:", err.message);
    console.error("[API:/api/info] Stack:", err.stack);
    res.status(500).json({
      error: "Could not fetch video metadata",
      details: err.message
    });
  }
});

// Available formats
app.get("/api/formats", async (req, res) => {
  console.log("[API:/api/formats] Called");
  const videoUrl = req.query.url;
  console.log("[API:/api/formats] URL:", videoUrl);

  if (!videoUrl) {
    console.log("[API:/api/formats] URL parameter missing");
    return res.status(400).json({ error: "URL parameter required" });
  }

  const isValid = validateVideoUrl(videoUrl);
  console.log("[API:/api/formats] URL valid:", isValid);
  if (!isValid) {
    return res.status(400).json({ error: "Unsupported video URL" });
  }

  try {
    console.log("[API:/api/formats] Calling getFormats...");
    const result = await getFormats(videoUrl);
    console.log("[API:/api/formats] Success, formats count:", result.formats?.length || 0);
    return res.json(result);
  } catch (err) {
    console.error("[API:/api/formats] ERROR:", err.message);
    console.error("[API:/api/formats] Stack:", err.stack);
    res.status(500).json({
      error: "Could not fetch video formats",
      details: err.message
    });
  }
});

// Get direct download URL
app.get("/api/direct-url", async (req, res) => {
  console.log("[API:/api/direct-url] Called");
  const { url, format_id, bitrate } = req.query;
  console.log("[API:/api/direct-url] URL:", url, "Format:", format_id, "Bitrate:", bitrate);

  if (!url) {
    console.log("[API:/api/direct-url] URL parameter missing");
    return res.status(400).json({ error: "URL parameter required" });
  }

  if (!format_id) {
    console.log("[API:/api/direct-url] format_id parameter missing");
    return res.status(400).json({ error: "format_id parameter required" });
  }

  const isValid = validateVideoUrl(url);
  console.log("[API:/api/direct-url] URL valid:", isValid);
  if (!isValid) {
    return res.status(400).json({ error: "Unsupported video URL" });
  }

  try {
    console.log("[API:/api/direct-url] Calling getDirectUrl...");
    const result = await getDirectUrl(url, format_id, bitrate);
    console.log("[API:/api/direct-url] Success, status:", result.status, "URL:", result.directUrl ? `***${result.directUrl.substring(0, 50)}...` : "empty");
    return res.json(result);
  } catch (err) {
    console.error("[API:/api/direct-url] ERROR:", err.message);
    console.error("[API:/api/direct-url] Stack:", err.stack);
    res.status(500).json({
      error: "Could not extract direct URL",
      details: err.message
    });
  }
});

// Legacy download endpoint (kept for compatibility)
app.post("/api/download", async (req, res) => {
  console.log("[API:/api/download] Called");
  const { url, format = "mp4", quality = "720p" } = req.body || {};
  console.log("[API:/api/download] URL:", url, "Format:", format, "Quality:", quality);

  if (!url) {
    console.log("[API:/api/download] URL missing");
    return res.status(400).json({ success: false, error: "URL is required" });
  }

  const isValid = validateVideoUrl(url);
  console.log("[API:/api/download] URL valid:", isValid);
  if (!isValid) {
    return res.status(400).json({ success: false, error: "Unsupported video URL" });
  }

  try {
    const formatId = format === "mp3" ? "audio_mp3" : quality;
    console.log("[API:/api/download] Using formatId:", formatId);
    console.log("[API:/api/download] Calling getDirectUrl...");
    const result = await getDirectUrl(url, formatId);
    console.log("[API:/api/download] Success, direct URL:", result.directUrl ? `***${result.directUrl.substring(0, 50)}...` : "empty");

    return res.json({
      success: true,
      url: result.directUrl,
      filename: result.filename,
      format,
      quality
    });
  } catch (err) {
    console.error("[API:/api/download] ERROR:", err.message);
    console.error("[API:/api/download] Stack:", err.stack);
    return res.status(500).json({
      success: false,
      error: err.message
    });
  }
});

// Stream / redirect endpoint
app.get("/api/stream", async (req, res) => {
  console.log("[API:/api/stream] Called");
  const { url, format = "mp4", quality = "720p" } = req.query;
  console.log("[API:/api/stream] URL:", url, "Format:", format, "Quality:", quality);

  if (!url) {
    console.log("[API:/api/stream] URL parameter missing");
    return res.status(400).send("URL parameter is required");
  }

  const isValid = validateVideoUrl(url);
  console.log("[API:/api/stream] URL valid:", isValid);
  if (!isValid) {
    return res.status(400).send("Unsupported video URL");
  }

  try {
    const formatId = format === "mp3" ? "audio_mp3" : quality;
    console.log("[API:/api/stream] Using formatId:", formatId);
    console.log("[API:/api/stream] Calling getDirectUrl...");
    const result = await getDirectUrl(url, formatId);
    console.log("[API:/api/stream] Redirecting to:", result.directUrl ? `***${result.directUrl.substring(0, 50)}...` : "empty");
    return res.redirect(302, result.directUrl);
  } catch (err) {
    console.error("[API:/api/stream] ERROR:", err.message);
    console.error("[API:/api/stream] Stack:", err.stack);
    return res.status(500).send(`Failed to extract stream: ${err.message}`);
  }
});

// ======================
// Frontend
// ======================

console.log("[SERVER] Setting up static file serving from:", path.join(__dirname, "dist"));
app.use(express.static(path.join(__dirname, "dist")));

app.get("*", (req, res) => {
  console.log("[SERVER] Catch-all route, path:", req.path);
  const indexPath = path.join(__dirname, "dist", "index.html");

  if (fs.existsSync(indexPath)) {
    console.log("[SERVER] Serving index.html");
    res.sendFile(indexPath);
  } else {
    console.log("[SERVER] index.html not found, sending fallback message");
    res.send("VidGrab Backend API is running");
  }
});

// ======================
// Start server
// ======================

const PORT = process.env.PORT || 10000;

app.listen(PORT, "0.0.0.0", () => {
  console.log(`\n[SERVER] ==================================`);
  console.log(`[SERVER] VidGrab server running on port ${PORT}`);
  console.log(`[SERVER] Using external Cobalt API`);
  console.log(`[SERVER] COBALT_API_URL: ${process.env.COBALT_API_URL ? `***${process.env.COBALT_API_URL.substring(process.env.COBALT_API_URL.length - 20)}` : "NOT SET - WILL FAIL"}`);
  console.log(`[SERVER] ==================================\n`);

  // Keep the Cobalt instance warm with a simple HTTP request
  const COBALT_URL = process.env.COBALT_API_URL;
  if (COBALT_URL) {
    const warmup = () => {
      fetch(COBALT_URL).catch(() => {});
    };
    warmup();                             // once at startup
    setInterval(warmup, 10 * 60 * 1000);  // repeat every 10 minutes
    console.log("[SERVER] Cobalt warmup scheduled (every 10 minutes)");
  }
});

// Handle unhandled promise rejections
process.on('unhandledRejection', (reason, promise) => {
  console.error('[SERVER] UNHANDLED REJECTION:', reason);
  console.error('[SERVER] Promise:', promise);
});

// Handle uncaught exceptions
process.on('uncaughtException', (err) => {
  console.error('[SERVER] UNCAUGHT EXCEPTION:', err.message);
  console.error('[SERVER] Stack:', err.stack);
  process.exit(1);
});
