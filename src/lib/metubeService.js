/**
 * MeTube service — replaces cobaltService.js
 *
 * Downloads   -> self-hosted MeTube API (POST /add, GET /history, GET /download/<file>)
 * Search/Info -> YouTube Data API v3 (unchanged)
 *
 * Requires env var:
 *   METUBE_URL   e.g. https://your-metube.up.railway.app   (no trailing slash)
 *
 * MeTube endpoints used:
 *   POST /add   { url, download_type, format, quality }  -> { status: "ok" } | { status: "error", msg }
 *   GET  /history -> { done: [], queue: [], pending: [] }
 *                    each item: { id, url, title, status, filename, timestamp, error, download_type, ... }
 *   GET  /download/<filename>       (video)  |  /audio_download/<filename>  (audio)
 *
 * Notes on MeTube's real behaviour (verified against its source):
 *  - POST /add runs a yt-dlp extraction before returning, so it is NOT instant and
 *    it can return {status:"error", msg:...} — we surface that immediately.
 *  - A finished download lands in `done`; a FAILED one also lands in `done` but with
 *    status "error". `done` is keyed by URL, so re-downloading the same URL overwrites
 *    the entry (fresh `timestamp`) — we match on url + timestamp, not on filename.
 *  - Video quality must be one of: best,2160,1440,1080,720,480,360,240,worst.
 *    Audio (mp3) quality must be one of: best,320,192,128.
 */

const METUBE_URL = (process.env.METUBE_URL || "").replace(/\/+$/, "");

console.log("[metube] Initializing. METUBE_URL:", METUBE_URL || "NOT SET");
if (!METUBE_URL) {
  throw new Error(
    "METUBE_URL environment variable is not set. Point it at your MeTube instance, " +
      "e.g. https://your-metube.up.railway.app"
  );
}

const SUPPORTED_HOSTS = ["youtube.com", "youtu.be", "youtube-nocookie.com"];

// ======================
// Helpers
// ======================

export function validateVideoUrl(value) {
  if (!value || typeof value !== "string") return false;
  try {
    const parsed = new URL(value);
    const hostname = parsed.hostname.toLowerCase().replace(/^www\./, "");
    return (
      (parsed.protocol === "http:" || parsed.protocol === "https:") &&
      SUPPORTED_HOSTS.some((host) => hostname === host || hostname.endsWith(`.${host}`))
    );
  } catch {
    return false;
  }
}

export function extractYouTubeId(url) {
  if (!url || typeof url !== "string") return null;
  const match = url.match(
    /(?:youtube\.com\/(?:watch\?v=|embed\/|shorts\/|v\/)|youtu\.be\/)([A-Za-z0-9_-]{11})/
  );
  return match ? match[1] : null;
}

export function durationLabel(seconds) {
  if (!Number.isFinite(seconds) || seconds <= 0) return "--";
  const total = Math.floor(seconds);
  const hours = Math.floor(total / 3600);
  const mins = Math.floor((total % 3600) / 60);
  const secs = total % 60;
  return hours
    ? `${hours}:${String(mins).padStart(2, "0")}:${String(secs).padStart(2, "0")}`
    : `${mins}:${String(secs).padStart(2, "0")}`;
}

function parseIsoDuration(iso) {
  if (!iso || typeof iso !== "string") return 0;
  const m = iso.match(/PT(?:(\d+)H)?(?:(\d+)M)?(?:(\d+)S)?/);
  if (!m) return 0;
  return (
    parseInt(m[1] || "0", 10) * 3600 +
    parseInt(m[2] || "0", 10) * 60 +
    parseInt(m[3] || "0", 10)
  );
}

function formatViews(n) {
  if (!Number.isFinite(n)) return "--";
  if (n >= 1_000_000) return `${(n / 1_000_000).toFixed(1)}M views`;
  if (n >= 1_000) return `${(n / 1_000).toFixed(1)}K views`;
  return `${n} views`;
}

// Same shape the frontend already expects
const STANDARD_FORMATS = [
  { format_id: "max", label: "Best Quality (Max)", height: 2160, ext: "mp4", type: "video+audio", has_video: true, has_audio: true },
  { format_id: "1080", label: "1080p Full HD", height: 1080, ext: "mp4", type: "video+audio", has_video: true, has_audio: true },
  { format_id: "720", label: "720p HD", height: 720, ext: "mp4", type: "video+audio", has_video: true, has_audio: true },
  { format_id: "480", label: "480p SD", height: 480, ext: "mp4", type: "video+audio", has_video: true, has_audio: true },
  { format_id: "360", label: "360p Low", height: 360, ext: "mp4", type: "video+audio", has_video: true, has_audio: true },
  { format_id: "audio_mp3", label: "MP3 Audio", height: null, abr: 320, ext: "mp3", type: "audio-only", has_video: false, has_audio: true },
];

export async function getFormats(videoUrl) {
  if (!validateVideoUrl(videoUrl)) throw new Error("Unsupported or invalid video URL");
  return { videoUrl, formats: STANDARD_FORMATS, total: STANDARD_FORMATS.length };
}

// MeTube's exact allowed values (see format_catalog)
const VIDEO_QUALITIES = ["best", "2160", "1440", "1080", "720", "480", "360", "240", "worst"];

function mapToMetube(formatId) {
  const id = String(formatId);
  if (id === "audio_mp3" || id === "audio") {
    return { download_type: "audio", format: "mp3", quality: "320" };
  }
  const q = id.replace(/p$/, "");
  return { download_type: "video", format: "mp4", quality: VIDEO_QUALITIES.includes(q) ? q : "720" };
}

async function metubeFetch(path, options = {}, timeoutMs = 30000) {
  const res = await fetch(`${METUBE_URL}${path}`, {
    ...options,
    signal: AbortSignal.timeout(timeoutMs),
  });
  if (!res.ok) {
    const body = await res.text().catch(() => "");
    throw new Error(`MeTube ${path} -> HTTP ${res.status} ${body.slice(0, 200)}`);
  }
  return res.json();
}

const sleep = (ms) => new Promise((r) => setTimeout(r, ms));

// The `timestamp` of the completed entry for a URL, if it is already in `done`.
async function doneTimestamp(videoUrl) {
  const h = await metubeFetch("/history");
  const existing = (h.done || []).find((i) => i.url === videoUrl);
  return existing ? existing.timestamp : null;
}

/**
 * Queue a download on MeTube and wait for it to finish.
 * Returns the same shape the frontend expects: { success, directUrl, filename, ... }
 * directUrl points at this backend's /api/file proxy (same-origin, attachment header).
 */
export async function getDirectUrl(videoUrl, formatId = "720") {
  if (!validateVideoUrl(videoUrl)) throw new Error("Unsupported or invalid video URL");

  const meta = mapToMetube(formatId);

  // If this URL was already completed before, remember its timestamp so a
  // re-download (which overwrites the same key in `done`) is still detected.
  const beforeTs = await doneTimestamp(videoUrl);

  // POST /add runs extraction first, so allow generous time.
  const addRes = await metubeFetch(
    "/add",
    {
      method: "POST",
      headers: { "Content-Type": "application/json" },
      body: JSON.stringify({ url: videoUrl, ...meta }),
    },
    60000
  );

  if (addRes && addRes.status === "error") {
    throw new Error(addRes.msg || "MeTube rejected the download");
  }

  const deadline = Date.now() + 180000; // wait up to 3 min

  while (Date.now() < deadline) {
    const h = await metubeFetch("/history");
    const mine = [
      ...(h.done || []),
      ...(h.queue || []),
      ...(h.pending || []),
    ].filter((i) => i.url === videoUrl);

    const failed = mine.find((i) => i.status === "error" || i.error);
    if (failed) {
      throw new Error(failed.error || failed.msg || "MeTube reported an error for this video");
    }

    const finished = (h.done || []).find(
      (i) => i.url === videoUrl && i.status === "finished" && i.filename
    );
    if (finished && (beforeTs === null || finished.timestamp !== beforeTs)) {
      const isAudio = meta.download_type === "audio";
      return {
        success: true,
        directUrl: `/api/file?name=${encodeURIComponent(finished.filename)}&type=${isAudio ? "audio" : "video"}`,
        filename: finished.filename,
        status: "ready",
        format: {
          format_id: formatId,
          ext: isAudio ? "mp3" : "mp4",
          label: meta.quality,
          type: isAudio ? "audio-only" : "video+audio",
          has_video: !isAudio,
          has_audio: true,
        },
        contentType: isAudio ? "audio/mpeg" : "video/mp4",
      };
    }

    await sleep(2000);
  }

  throw new Error("Timed out waiting for MeTube to finish the download");
}

// ======================
// Info + Search (YouTube Data API v3)
// ======================

export async function getInfo(videoUrl) {
  if (!validateVideoUrl(videoUrl)) throw new Error("Unsupported or invalid video URL");

  const ytId = extractYouTubeId(videoUrl);
  const defaultThumbnail = ytId ? `https://img.youtube.com/vi/${ytId}/hqdefault.jpg` : "";
  const apiKey = process.env.YOUTUBE_API_KEY;

  if (apiKey && ytId) {
    try {
      const apiUrl = `https://www.googleapis.com/youtube/v3/videos?part=snippet,contentDetails,statistics&id=${ytId}&key=${apiKey}`;
      const res = await fetch(apiUrl);
      if (res.ok) {
        const data = await res.json();
        const item = data.items?.[0];
        if (item) {
          const seconds = parseIsoDuration(item.contentDetails?.duration);
          return {
            title: item.snippet?.title || `YouTube Video (${ytId})`,
            channel: item.snippet?.channelTitle || "YouTube Creator",
            views: formatViews(parseInt(item.statistics?.viewCount || "0", 10)),
            uploadDate: item.snippet?.publishedAt?.slice(0, 10) || "--",
            duration: durationLabel(seconds),
            seconds,
            url: videoUrl,
            videoId: ytId,
            thumbnail:
              item.snippet?.thumbnails?.high?.url ||
              item.snippet?.thumbnails?.medium?.url ||
              defaultThumbnail,
          };
        }
      }
    } catch (err) {
      console.error("[getInfo] YouTube API failed:", err.message);
    }
  }

  try {
    const oembed = await fetch(`https://noembed.com/embed?url=${encodeURIComponent(videoUrl)}`);
    if (oembed.ok) {
      const data = await oembed.json();
      if (data?.title) {
        return {
          title: data.title,
          channel: data.author_name || "Video Creator",
          views: "--",
          uploadDate: "--",
          duration: "--",
          seconds: 0,
          url: videoUrl,
          videoId: ytId || "",
          thumbnail: data.thumbnail_url || defaultThumbnail,
        };
      }
    }
  } catch (err) {
    console.error("[getInfo] oEmbed failed:", err.message);
  }

  return {
    title: ytId ? `YouTube Video (${ytId})` : "YouTube Video",
    channel: "YouTube Creator",
    views: "--",
    uploadDate: "--",
    duration: "--",
    seconds: 0,
    url: videoUrl,
    videoId: ytId || "",
    thumbnail: defaultThumbnail,
  };
}

export async function search(query) {
  if (!query?.trim()) return [];
  const apiKey = process.env.YOUTUBE_API_KEY;
  if (!apiKey) {
    console.warn("[search] YOUTUBE_API_KEY not set");
    return [];
  }
  try {
    const searchUrl =
      "https://www.googleapis.com/youtube/v3/search?part=snippet&type=video&maxResults=10" +
      `&q=${encodeURIComponent(query.trim())}&key=${apiKey}`;
    const searchRes = await fetch(searchUrl);
    if (!searchRes.ok) return [];
    const searchData = await searchRes.json();
    const items = searchData.items || [];
    if (items.length === 0) return [];

    const ids = items.map((i) => i.id.videoId).filter(Boolean).join(",");
    const detailsRes = await fetch(
      `https://www.googleapis.com/youtube/v3/videos?part=contentDetails,statistics&id=${ids}&key=${apiKey}`
    );
    const detailsData = detailsRes.ok ? await detailsRes.json() : { items: [] };
    const detailsMap = {};
    for (const d of detailsData.items || []) detailsMap[d.id] = d;

    return items.map((item) => {
      const id = item.id.videoId;
      const details = detailsMap[id] || {};
      const seconds = parseIsoDuration(details.contentDetails?.duration);
      return {
        id,
        videoId: id,
        title: item.snippet?.title || "YouTube Video",
        channel: item.snippet?.channelTitle || "YouTube Creator",
        views: formatViews(parseInt(details.statistics?.viewCount || "0", 10)),
        uploadDate: item.snippet?.publishedAt?.slice(0, 10) || "--",
        duration: durationLabel(seconds),
        seconds,
        url: `https://www.youtube.com/watch?v=${id}`,
        thumbnail:
          item.snippet?.thumbnails?.high?.url ||
          item.snippet?.thumbnails?.medium?.url ||
          `https://img.youtube.com/vi/${id}/hqdefault.jpg`,
      };
    });
  } catch (err) {
    console.error("[search] failed:", err.message);
    return [];
  }
}
