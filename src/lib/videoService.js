import { apiClient } from "@/api/apiClient";

export function isVideoUrl(text) {
  return /(youtube\.com|youtu\.be|facebook\.com|fb\.watch)/i.test(text);
}

export function extractYouTubeId(text) {
  const m = text.match(
    /(?:youtube\.com\/(?:watch\?v=|embed\/|shorts\/|v\/)|youtu\.be\/)([A-Za-z0-9_-]{11})/
  );
  return m ? m[1] : null;
}

function ytThumb(id) {
  return `https://img.youtube.com/vi/${id}/hqdefault.jpg`;
}

export function parseDuration(d) {
  if (!d || typeof d !== "string") return 0;
  const parts = d.split(":").map((p) => parseInt(p, 10));
  if (parts.some(isNaN)) return 0;
  if (parts.length === 2) return parts[0] * 60 + parts[1];
  if (parts.length === 3) return parts[0] * 3600 + parts[1] * 60 + parts[2];
  return 0;
}

export function parseMinutesFilter(query) {
  const m = query.match(/under\s+(\d+)\s*min/i);
  return m ? parseInt(m[1], 10) : null;
}

export async function fetchVideoInfo(url) {
  const ytId = extractYouTubeId(url);

  // 1. Try backend /api/info (uses yt-dlp)
  try {
    const res = await fetch(`/api/info?url=${encodeURIComponent(url)}`);
    if (res.ok) {
      const data = await res.json();
      if (data && data.title) {
        return {
          ...data,
          seconds: typeof data.seconds === "number" ? data.seconds : parseDuration(data.duration),
        };
      }
    }
  } catch (err) {
    console.warn("Backend /api/info unavailable, falling back to oEmbed:", err);
  }

  // 2. Fallback to public oEmbed
  try {
    const res = await fetch(`https://noembed.com/embed?url=${encodeURIComponent(url)}`);
    const data = await res.json();
    if (data && data.title) {
      return {
        title: data.title,
        channel: data.author_name || "YouTube Creator",
        views: "—",
        uploadDate: "—",
        duration: "—",
        seconds: 0,
        url,
        videoId: ytId,
        thumbnail: ytId ? ytThumb(ytId) : data.thumbnail_url || null,
      };
    }
  } catch (err) {
    console.warn("oEmbed lookup failed:", err);
  }

  if (ytId) {
    return {
      title: `YouTube Video (${ytId})`,
      channel: "YouTube",
      views: "—",
      uploadDate: "—",
      duration: "—",
      seconds: 0,
      url,
      videoId: ytId,
      thumbnail: ytThumb(ytId),
    };
  }

  return null;
}

export async function searchYouTube(query) {
  // 1. Try backend /api/search (uses yt-dlp ytsearch8)
  try {
    const res = await fetch(`/api/search?q=${encodeURIComponent(query)}`);
    if (res.ok) {
      const data = await res.json();
      if (data && Array.isArray(data.videos)) return data.videos;
    }
  } catch (err) {
    console.warn("Backend /api/search unavailable:", err);
  }

  throw new Error("Search service is unavailable. Start the VidGrab server and try again.");
}

/**
 * Fetch available formats for a video (NEW - Direct link architecture)
 * @param {string} url - Video URL
 * @returns {Promise<Object>} - Object containing formats array and metadata
 */
export async function fetchVideoFormats(url) {
  if (!url) throw new Error("URL is required");

  try {
    const res = await apiClient.getFormats(url);
    return res;
  } catch (err) {
    console.error("Failed to fetch formats:", err);
    throw new Error(`Could not fetch video formats: ${err.message}`);
  }
}

/**
 * Get direct download URL for a specific format (NEW - Direct link architecture)
 * @param {string} url - Video URL
 * @param {string} formatId - The format_id to download
 * @returns {Promise<Object>} - Object containing direct URL and format metadata
 */
export async function getDirectDownloadUrl({ url, formatId }) {
  if (!url) throw new Error("URL is required");
  if (!formatId) throw new Error("Format ID is required");

  try {
    return await apiClient.getDirectUrl({ url, formatId });
  } catch (err) {
    console.error("Failed to get direct URL:", err);
    throw new Error(`Could not get direct URL: ${err.message}`);
  }
}

// Legacy download function - kept for backward compatibility
// Use getDirectDownloadUrl() for the new direct-link architecture
export async function downloadVideo({ url, format = "mp4", quality = "720p" }) {
  console.warn("downloadVideo() is deprecated. Use getDirectDownloadUrl() instead.");
  return apiClient.downloadVideo({ url, format, quality });
}
