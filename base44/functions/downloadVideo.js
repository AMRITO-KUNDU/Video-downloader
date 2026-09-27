import { execFile } from "child_process";
import { promisify } from "util";

const execFileAsync = promisify(execFile);

/**
 * Base44 Backend Function: downloadVideo
 * Invokes system `yt-dlp` CLI to fetch direct media URLs or metadata.
 * 
 * Requirements: `yt-dlp` binary must be installed on system PATH or server environment.
 */
export default async function handler(context) {
  const { url, format = "mp4", quality = "720p" } = context.params || context.body || {};

  if (!url) {
    return { success: false, error: "URL is required" };
  }

  const maxFormatHeight = parseInt(quality.replace("p", ""), 10) || 720;

  try {
    let args = [];

    if (format === "mp3") {
      // Extract best direct audio URL
      args = ["-g", "-f", "ba/bestaudio", url];
    } else {
      // Extract direct video URL according to maximum specified resolution height
      args = [
        "-g",
        "-f",
        `bestvideo[height<=${maxFormatHeight}]+bestaudio/best[height<=${maxFormatHeight}]/best`,
        url,
      ];
    }

    const { stdout } = await execFileAsync("yt-dlp", args);
    const downloadUrls = stdout.trim().split("\n");

    return {
      success: true,
      url: downloadUrls[0],
      audioUrl: downloadUrls[1] || null,
      format,
      quality,
    };
  } catch (error) {
    return {
      success: false,
      error: "yt-dlp execution failed. Ensure yt-dlp is installed and available in system PATH.",
      details: error.message,
    };
  }
}
