import { apiClient } from "@/api/apiClient";

/**
 * Check if a string looks like a supported video URL
 */
export function isVideoUrl(text) {
  if (!text || typeof text !== "string") return false;
  return /(youtube\.com|youtu\.be|youtube-nocookie\.com|facebook\.com|fb\.watch|fb\.me)/i.test(
    text.trim()
  );
}

/**
 * Check if a URL points at Facebook
 */
export function isFacebookUrl(url) {
  return /(facebook\.com|fb\.watch|fb\.me)/i.test(String(url || ""));
}

/**
 * Extract YouTube video ID from a URL
 */
export function extractYouTubeId(text) {
  if (!text || typeof text !== "string") return null;
  const match = text.match(
    /(?:youtube\.com\/(?:watch\?v=|embed\/|shorts\/|v\/)|youtu\.be\/)([A-Za-z0-9_-]{11})/
  );
  return match ? match[1] : null;
}

/**
 * Get YouTube thumbnail URL
 */
function getYouTubeThumbnail(id) {
  return id ? `https://img.youtube.com/vi/${id}/hqdefault.jpg` : "";
}

/**
 * Parse duration string (e.g. "3:45" or "1:02:30") into seconds
 */
export function parseDuration(duration) {
  if (!duration || typeof duration !== "string") return 0;

  const parts = duration.split(":").map((p) => parseInt(p, 10));
  if (parts.some(isNaN)) return 0;

  if (parts.length === 2) return parts[0] * 60 + parts[1];
  if (parts.length === 3) return parts[0] * 3600 + parts[1] * 60 + parts[2];
  return 0;
}

/**
 * Extract "under X min" filter from search query
 */
export function parseMinutesFilter(query) {
  const match = query.match(/under\s+(\d+)\s*min/i);
  return match ? parseInt(match[1], 10) : null;
}

/**
 * Fetch video metadata
 */
export async function fetchVideoInfo(url) {
  const ytId = extractYouTubeId(url);

  try {
    const res = await fetch(`/api/info?url=${encodeURIComponent(url)}`);
    if (res.ok) {
      const data = await res.json();
      if (data && (data.title || data.url)) {
        const videoId = data.videoId || ytId || "";
        return {
          ...data,
          videoId,
          thumbnail: data.thumbnail || getYouTubeThumbnail(videoId),
          seconds:
            typeof data.seconds === "number"
              ? data.seconds
              : parseDuration(data.duration),
        };
      }
    }
  } catch (err) {
    console.warn("Backend /api/info failed, trying oEmbed fallback:", err.message);
  }

  // Fallback to oEmbed
  try {
    const res = await fetch(
      `https://noembed.com/embed?url=${encodeURIComponent(url)}`
    );
    const data = await res.json();

    if (data?.title) {
      return {
        title: data.title,
        channel: data.author_name || "Video Creator",
        views: "—",
        uploadDate: "—",
        duration: "—",
        seconds: 0,
        url,
        videoId: ytId || "",
        thumbnail: getYouTubeThumbnail(ytId) || data.thumbnail_url || "",
      };
    }
  } catch (err) {
    console.warn("oEmbed fallback failed:", err.message);
  }

  // Final fallback
  if (ytId) {
    return {
      title: `YouTube Video (${ytId})`,
      channel: "YouTube Creator",
      views: "—",
      uploadDate: "—",
      duration: "—",
      seconds: 0,
      url,
      videoId: ytId,
      thumbnail: getYouTubeThumbnail(ytId),
    };
  }

  return {
    title: "Shared Video Link",
    channel: "Media Service",
    views: "—",
    uploadDate: "—",
    duration: "—",
    seconds: 0,
    url,
    videoId: "",
    thumbnail: "",
  };
}

/**
 * Search YouTube via backend
 */
export async function searchYouTube(query) {
  try {
    const res = await fetch(`/api/search?q=${encodeURIComponent(query)}`);
    if (res.ok) {
      const data = await res.json();
      if (Array.isArray(data.videos)) return data.videos;
    }
  } catch (err) {
    console.warn("Search failed:", err.message);
  }

  throw new Error("Search service is currently unavailable.");
}

/**
 * Get available formats for a video
 */
export async function fetchVideoFormats(url) {
  if (!url) throw new Error("URL is required");

  try {
    return await apiClient.getFormats(url);
  } catch (err) {
    throw new Error(`Could not fetch video formats: ${err.message}`);
  }
}

/**
 * Get direct download URL for a specific format
 */
export async function getDirectDownloadUrl({ url, formatId }) {
  if (!url) throw new Error("URL is required");
  if (!formatId) throw new Error("Format ID is required");

  try {
    return await apiClient.getDirectUrl({ url, formatId });
  } catch (err) {
    throw new Error(`Could not get direct URL: ${err.message}`);
  }
}
