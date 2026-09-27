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

  try {
    // Fetch video info via noembed oEmbed service
    const res = await fetch(`https://noembed.com/embed?url=${encodeURIComponent(url)}`);
    const data = await res.json();

    if (data && data.title) {
      return {
        title: data.title,
        channel: data.author_name || "YouTube Creator",
        views: "—",
        uploadDate: "Recently",
        duration: "3:45",
        seconds: 225,
        url,
        videoId: ytId,
        thumbnail: ytId ? ytThumb(ytId) : data.thumbnail_url,
      };
    }
  } catch (err) {
    console.warn("oEmbed lookup failed, falling back to basic details:", err);
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
  return [
    {
      id: "dQw4w9WgXcQ",
      title: `${query} - Sample Video`,
      channel: "VidGrab Featured",
      views: "1.2M views",
      uploadDate: "2 weeks ago",
      duration: "3:33",
      seconds: 213,
      videoId: "dQw4w9WgXcQ",
      url: "https://www.youtube.com/watch?v=dQw4w9WgXcQ",
      thumbnail: ytThumb("dQw4w9WgXcQ"),
    }
  ];
}

export async function downloadVideo({ url, format = "mp4", quality = "720p" }) {
  return apiClient.downloadVideo({ url, format, quality });
}