import { base44 } from "@/api/base44Client";

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

const videoSchema = {
  type: "object",
  properties: {
    title: { type: "string" },
    channel: { type: "string" },
    views: { type: "string" },
    uploadDate: { type: "string" },
    duration: { type: "string" },
    url: { type: "string" },
  },
};

const searchSchema = {
  type: "object",
  properties: {
    videos: {
      type: "array",
      items: {
        type: "object",
        properties: {
          title: { type: "string" },
          channel: { type: "string" },
          views: { type: "string" },
          uploadDate: { type: "string" },
          duration: { type: "string" },
          videoId: { type: "string" },
        },
      },
    },
  },
};

export async function fetchVideoInfo(url) {
  const ytId = extractYouTubeId(url);

  const res = await base44.integrations.Core.InvokeLLM({
    prompt: `Look up the real, public video at this URL and return its exact metadata. URL: ${url}\nReturn the exact title, channel name, view count (e.g. "1.2M views"), relative upload date (e.g. "3 weeks ago"), and duration (MM:SS or H:MM:SS). If the video does not exist or is private, return empty strings.`,
    add_context_from_internet: true,
    model: "gemini_3_flash",
    response_json_schema: videoSchema,
  });

  const d = res || {};
  if (!d.title) return null;

  return {
    title: d.title,
    channel: d.channel || "Unknown channel",
    views: d.views || "—",
    uploadDate: d.uploadDate || "—",
    duration: d.duration || "—",
    seconds: parseDuration(d.duration),
    url,
    videoId: ytId,
    thumbnail: ytId ? ytThumb(ytId) : null,
  };
}

export async function searchYouTube(query) {
  const res = await base44.integrations.Core.InvokeLLM({
    prompt: `Search YouTube for real, publicly available videos that match this request: "${query}". Return up to 8 videos that actually exist on YouTube right now. For each, include the exact title, channel name, view count (e.g. "1.2M views"), relative upload date, duration (MM:SS or H:MM:SS), and the 11-character YouTube video ID. Do not invent videos — only return ones you can verify exist.`,
    add_context_from_internet: true,
    model: "gemini_3_flash",
    response_json_schema: searchSchema,
  });

  const list = (res?.videos || []).filter((v) => v.title && (v.videoId || v.url));
  return list.map((v, i) => ({
    id: v.videoId || `r${i}`,
    title: v.title,
    channel: v.channel || "Unknown channel",
    views: v.views || "—",
    uploadDate: v.uploadDate || "—",
    duration: v.duration || "—",
    seconds: parseDuration(v.duration),
    videoId: v.videoId,
    url: v.videoId ? `https://www.youtube.com/watch?v=${v.videoId}` : v.url,
    thumbnail: v.videoId ? ytThumb(v.videoId) : null,
  }));
}

export async function downloadVideo({ url, format = "mp4", quality = "720p" }) {
  const res = await base44.functions.invoke("downloadVideo", {
    url,
    format,
    quality,
  });
  return res;
}