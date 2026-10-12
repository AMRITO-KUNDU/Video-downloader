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
  search
} from "./src/lib/metubeService.js";

const __filename = fileURLToPath(import.meta.url);
const __dirname = path.dirname(__filename);

const app = express();
app.use(express.json());

// Request logging middleware
app.use((req, res, next) => {
  const start = Date.now();
  const logId = Math.random().toString(36).substring(2, 8);
  console.log(`[${logId}] ${req.method} ${req.path} - Query:`, req.query);

  res.on("finish", () => {
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
  const query = req.query.q;
  if (!query || typeof query !== "string") {
    return res.json({ videos: [] });
  }
  try {
    const videos = await search(query);
    return res.json({ videos: videos || [] });
  } catch (err) {
    console.error("[API:/api/search] ERROR:", err.message);
    res.status(500).json({ error: "Search failed", details: err.message });
  }
});

// Video metadata
app.get("/api/info", async (req, res) => {
  const videoUrl = req.query.url;
  if (!videoUrl) {
    return res.status(400).json({ error: "URL parameter required" });
  }
  if (!validateVideoUrl(videoUrl)) {
    return res.status(400).json({ error: "Unsupported video URL" });
  }
  try {
    const info = await getInfo(videoUrl);
    return res.json(info);
  } catch (err) {
    console.error("[API:/api/info] ERROR:", err.message);
    res.status(500).json({ error: "Could not fetch video metadata", details: err.message });
  }
});

// Available formats
app.get("/api/formats", async (req, res) => {
  const videoUrl = req.query.url;
  if (!videoUrl) {
    return res.status(400).json({ error: "URL parameter required" });
  }
  if (!validateVideoUrl(videoUrl)) {
    return res.status(400).json({ error: "Unsupported video URL" });
  }
  try {
    const result = await getFormats(videoUrl);
    return res.json(result);
  } catch (err) {
    console.error("[API:/api/formats] ERROR:", err.message);
    res.status(500).json({ error: "Could not fetch video formats", details: err.message });
  }
});

// Queue a download on MeTube, wait for it, return a same-origin file URL.
app.get("/api/direct-url", async (req, res) => {
  const { url, format_id } = req.query;
  if (!url) {
    return res.status(400).json({ error: "URL parameter required" });
  }
  if (!format_id) {
    return res.status(400).json({ error: "format_id parameter required" });
  }
  if (!validateVideoUrl(url)) {
    return res.status(400).json({ error: "Unsupported video URL" });
  }
  try {
    const result = await getDirectUrl(url, format_id);
    return res.json(result);
  } catch (err) {
    console.error("[API:/api/direct-url] ERROR:", err.message);
    res.status(500).json({ error: "Could not prepare the download", details: err.message });
  }
});

// Stream a finished MeTube file through our own origin so the browser saves it.
app.get("/api/file", async (req, res) => {
  const name = req.query.name;
  const type = req.query.type === "audio" ? "audio" : "video";
  if (!name || typeof name !== "string") {
    return res.status(400).send("name is required");
  }
  const base = (process.env.METUBE_URL || "").replace(/\/+$/, "");
  if (!base) {
    return res.status(500).send("METUBE_URL is not configured");
  }
  const dir = type === "audio" ? "audio_download" : "download";
  try {
    const upstream = await fetch(`${base}/${dir}/${encodeURIComponent(name)}`);
    if (!upstream.ok || !upstream.body) {
      return res.status(502).send("Upstream file not available");
    }
    // Never let the filename break out of the header.
    const safeName = name.replace(/[\r\n"]/g, "");
    res.setHeader("Content-Type", upstream.headers.get("content-type") || "application/octet-stream");
    res.setHeader("Content-Disposition", `attachment; filename="${safeName}"`);
    const { Readable } = await import("node:stream");
    Readable.fromWeb(upstream.body).pipe(res);
  } catch (err) {
    console.error("[API:/api/file] ERROR:", err.message);
    res.status(500).send("Failed to fetch file");
  }
});

// ======================
// Frontend
// ======================

console.log("[SERVER] Setting up static file serving from:", path.join(__dirname, "dist"));
app.use(express.static(path.join(__dirname, "dist")));

app.get("*", (req, res) => {
  const indexPath = path.join(__dirname, "dist", "index.html");
  if (fs.existsSync(indexPath)) {
    res.sendFile(indexPath);
  } else {
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
  console.log(`[SERVER] Using self-hosted MeTube API`);
  console.log(`[SERVER] METUBE_URL: ${process.env.METUBE_URL ? `***${process.env.METUBE_URL.substring(process.env.METUBE_URL.length - 20)}` : "NOT SET - WILL FAIL"}`);
  console.log(`[SERVER] ==================================\n`);
});

// Handle unhandled promise rejections
process.on("unhandledRejection", (reason, promise) => {
  console.error("[SERVER] UNHANDLED REJECTION:", reason);
  console.error("[SERVER] Promise:", promise);
});

// Handle uncaught exceptions
process.on("uncaughtException", (err) => {
  console.error("[SERVER] UNCAUGHT EXCEPTION:", err.message);
  console.error("[SERVER] Stack:", err.stack);
  process.exit(1);
});
