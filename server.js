import express from "express";
import { execFile } from "child_process";
import { promisify } from "util";
import path from "path";
import { fileURLToPath } from "url";

const execFileAsync = promisify(execFile);
const __filename = fileURLToPath(import.meta.url);
const __dirname = path.dirname(__filename);

const app = express();
app.use(express.json());

// API Endpoint: /api/download
app.post("/api/download", async (req, res) => {
  const { url, format = "mp4", quality = "720p" } = req.body || {};

  if (!url) {
    return res.status(400).json({ success: false, error: "URL is required" });
  }

  const maxFormatHeight = parseInt(quality.replace("p", ""), 10) || 720;

  try {
    let args = [];
    if (format === "mp3") {
      args = ["-g", "-f", "ba/bestaudio", url];
    } else {
      args = [
        "-g",
        "-f",
        `bestvideo[height<=${maxFormatHeight}]+bestaudio/best[height<=${maxFormatHeight}]/best`,
        url,
      ];
    }

    const { stdout } = await execFileAsync("yt-dlp", args);
    const downloadUrls = stdout.trim().split("\n");

    return res.json({
      success: true,
      url: downloadUrls[0],
      audioUrl: downloadUrls[1] || null,
      format,
      quality,
    });
  } catch (error) {
    console.error("yt-dlp error:", error);
    return res.status(500).json({
      success: false,
      error: "yt-dlp execution failed. Make sure yt-dlp is installed on your server.",
      details: error.message,
    });
  }
});

// Serve static build in production
app.use(express.static(path.join(__dirname, "dist")));

app.get("*", (req, res) => {
  const indexPath = path.join(__dirname, "dist", "index.html");
  if (require("fs").existsSync(indexPath)) {
    res.sendFile(indexPath);
  } else {
    res.send("VidGrab API Server Running");
  }
});

const PORT = process.env.PORT || 10000;
app.listen(PORT, "0.0.0.0", () => {
  console.log(`VidGrab server listening on port ${PORT}`);
});
