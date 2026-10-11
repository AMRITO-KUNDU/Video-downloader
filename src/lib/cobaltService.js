/**
 * Cobalt Service
 * External Cobalt API only - no local fallback
 * Downloads → External Cobalt instance (COBALT_API_URL required)
 * Cookies → Configured in Cobalt instance (COOKIE_PATH/COOKIES env vars)
 * Search    → YouTube Data API v3
 */

console.log("[COBALT_SERVICE] Initializing Cobalt service...");

// External Cobalt API instance (required - no local fallback)
const COBALT_API_URL = process.env.COBALT_API_URL;

console.log("[COBALT_SERVICE] COBALT_API_URL:", COBALT_API_URL ? `***.onrender.com` : "NOT SET");

if (!COBALT_API_URL) {
  console.error("[COBALT_SERVICE] FATAL: COBALT_API_URL environment variable is not set. Please configure your external Cobalt instance.");
  throw new Error("COBALT_API_URL environment variable is not set. Please configure your external Cobalt instance.");
}

// Fallback instances (optional external only)
const COBALT_FALLBACKS = [
  process.env.COBALT_FALLBACK_1,
  process.env.COBALT_FALLBACK_2,
].filter(Boolean);

console.log("[COBALT_SERVICE] COBALT_FALLBACKS count:", COBALT_FALLBACKS.length);

// All instances (external only, no local fallback)
const ALL_INSTANCES = [COBALT_API_URL, ...COBALT_FALLBACKS];

console.log("[COBALT_SERVICE] ALL_INSTANCES count:", ALL_INSTANCES.length);
console.log("[COBALT_SERVICE] Instances:", ALL_INSTANCES.map(u => u ? `***${u.substring(u.length - 20)}` : "empty"));

const SUPPORTED_HOSTS = [
  "youtube.com",
  "youtu.be",
  "youtube-nocookie.com",
];

console.log("[COBALT_SERVICE] SUPPORTED_HOSTS:", SUPPORTED_HOSTS);
console.log("[COBALT_SERVICE] Cookies: Configure in your Cobalt instance (COOKIE_PATH or COOKIES env var)");

// ======================
// Helpers
// ======================

export function validateVideoUrl(value) {
  console.log("[validateVideoUrl] Called with:", value);
  if (!value || typeof value !== "string") {
    console.log("[validateVideoUrl] Invalid: empty or not string");
    return false;
  }
  try {
    const parsed = new URL(value);
    const hostname = parsed.hostname.toLowerCase().replace(/^www\./, "");
    const isSupported = (
      (parsed.protocol === "http:" || parsed.protocol === "https:") &&
      SUPPORTED_HOSTS.some(
        (host) => hostname === host || hostname.endsWith(`.${host}`)
      )
    );
    console.log("[validateVideoUrl] Parsed hostname:", hostname, "Supported:", isSupported);
    return isSupported;
  } catch (e) {
    console.log("[validateVideoUrl] URL parsing failed:", e.message);
    return false;
  }
}

export function extractYouTubeId(url) {
  console.log("[extractYouTubeId] Called with:", url);
  if (!url || typeof url !== "string") {
    console.log("[extractYouTubeId] Invalid: empty or not string");
    return null;
  }
  const match = url.match(
    /(?:youtube\.com\/(?:watch\?v=|embed\/|shorts\/|v\/)|youtu\.be\/)([A-Za-z0-9_-]{11})/
  );
  const result = match ? match[1] : null;
  console.log("[extractYouTubeId] Extracted ID:", result);
  return result;
}

export function durationLabel(seconds) {
  console.log("[durationLabel] Called with:", seconds);
  if (!Number.isFinite(seconds) || seconds <= 0) {
    console.log("[durationLabel] Invalid seconds, returning: --");
    return "--";
  }
  const total = Math.floor(seconds);
  const hours = Math.floor(total / 3600);
  const mins = Math.floor((total % 3600) / 60);
  const secs = total % 60;
  const result = hours
    ? `${hours}:${String(mins).padStart(2, "0")}:${String(secs).padStart(2, "0")}`
    : `${mins}:${String(secs).padStart(2, "0")}`;
  console.log("[durationLabel] Result:", result);
  return result;
}

/** Parse ISO 8601 duration (PT1H2M3S) to seconds */
function parseIsoDuration(iso) {
  console.log("[parseIsoDuration] Called with:", iso);
  if (!iso || typeof iso !== "string") {
    console.log("[parseIsoDuration] Invalid, returning 0");
    return 0;
  }
  const m = iso.match(/PT(?:(\d+)H)?(?:(\d+)M)?(?:(\d+)S)?/);
  if (!m) {
    console.log("[parseIsoDuration] No match found, returning 0");
    return 0;
  }
  const result = (
    parseInt(m[1] || "0", 10) * 3600 +
    parseInt(m[2] || "0", 10) * 60 +
    parseInt(m[3] || "0", 10)
  );
  console.log("[parseIsoDuration] Parsed to seconds:", result);
  return result;
}

function formatViews(n) {
  console.log("[formatViews] Called with:", n);
  if (!Number.isFinite(n)) {
    console.log("[formatViews] Invalid, returning: --");
    return "--";
  }
  let result;
  if (n >= 1_000_000) {
    result = `${(n / 1_000_000).toFixed(1)}M views`;
  } else if (n >= 1_000) {
    result = `${(n / 1_000).toFixed(1)}K views`;
  } else {
    result = `${n} views`;
  }
  console.log("[formatViews] Result:", result);
  return result;
}

const STANDARD_FORMATS = [
  { format_id: "max", label: "Best Quality (Max)", height: 2160, ext: "mp4", type: "video+audio", has_video: true, has_audio: true },
  { format_id: "1080", label: "1080p Full HD", height: 1080, ext: "mp4", type: "video+audio", has_video: true, has_audio: true },
  { format_id: "720", label: "720p HD", height: 720, ext: "mp4", type: "video+audio", has_video: true, has_audio: true },
  { format_id: "480", label: "480p SD", height: 480, ext: "mp4", type: "video+audio", has_video: true, has_audio: true },
  { format_id: "360", label: "360p Low", height: 360, ext: "mp4", type: "video+audio", has_video: true, has_audio: true },
  { format_id: "audio_mp3", label: "MP3 Audio", height: null, abr: 128, ext: "mp3", type: "audio-only", has_video: false, has_audio: true },
];

console.log("[COBALT_SERVICE] STANDARD_FORMATS loaded:", STANDARD_FORMATS.length, "formats");

export async function getFormats(videoUrl) {
  console.log("[getFormats] Called with videoUrl:", videoUrl);
  if (!validateVideoUrl(videoUrl)) {
    console.error("[getFormats] Validation failed for URL:", videoUrl);
    throw new Error("Unsupported or invalid video URL");
  }
  console.log("[getFormats] URL validated, returning standard formats");
  return {
    videoUrl,
    formats: STANDARD_FORMATS,
    total: STANDARD_FORMATS.length,
  };
}

// ======================
// Cobalt (downloads only - external instances)
// ======================

export async function requestCobalt(payload) {
  console.log("[requestCobalt] Called with payload:", JSON.stringify(payload, null, 2));
  console.log("[requestCobalt] Will try instances:", ALL_INSTANCES.map(u => u ? `***${u.substring(u.length - 20)}` : "empty"));
  
  let lastError = null;

  for (const instanceUrl of ALL_INSTANCES) {
    console.log(`[requestCobalt] Trying instance: ${instanceUrl ? `***${instanceUrl.substring(instanceUrl.length - 20)}` : "empty"}`);
    try {
      const endpoint = instanceUrl.endsWith("/")
        ? instanceUrl
        : `${instanceUrl}/`;

      console.log(`[requestCobalt] Fetching from Cobalt instance: ***${endpoint.substring(endpoint.length - 20)}`);
      console.log(`[requestCobalt] Payload size: ${JSON.stringify(payload).length} bytes`);

      const response = await fetch(endpoint, {
        method: "POST",
        headers: {
          Accept: "application/json",
          "Content-Type": "application/json",
          "User-Agent": "VidGrab/2.0",
        },
        body: JSON.stringify(payload),
        signal: AbortSignal.timeout(25000),
      });

      console.log(`[requestCobalt] Response status: ${response.status} ${response.statusText}`);
      console.log(`[requestCobalt] Response headers:`, Object.fromEntries(response.headers.entries()));

      const data = await response.json().catch(() => ({}));
      console.log(`[requestCobalt] Response data:`, JSON.stringify(data, null, 2));

      // Skip auth-protected public instances
      if (
        data.error &&
        (data.error.code === "INVALID_JWT" ||
          data.error.code === "api.auth.jwt.missing" ||
          String(data.error.message || "").toLowerCase().includes("jwt") ||
          String(data.error.message || "").toLowerCase().includes("authentication"))
      ) {
        console.warn(`[requestCobalt] AUTH ERROR on ${instanceUrl ? `***${instanceUrl.substring(instanceUrl.length - 20)}` : "empty"}: JWT/Authentication required`);
        lastError = new Error(`Auth required on ${instanceUrl}`);
        continue;
      }

      if (data.status === "error") {
        console.error(`[requestCobalt] ERROR STATUS on ${instanceUrl ? `***${instanceUrl.substring(instanceUrl.length - 20)}` : "empty"}:`, data.error || data.text || "Cobalt error");
        lastError = new Error(
          data.error?.code || data.text || "Cobalt error"
        );
        continue;
      }

      if (!response.ok) {
        console.error(`[requestCobalt] HTTP ERROR on ${instanceUrl ? `***${instanceUrl.substring(instanceUrl.length - 20)}` : "empty"}: HTTP ${response.status}`);
        lastError = new Error(`HTTP ${response.status}`);
        continue;
      }

      console.log(`[requestCobalt] SUCCESS via ${instanceUrl ? `***${instanceUrl.substring(instanceUrl.length - 20)}` : "empty"}`);
      return data;
    } catch (err) {
      console.error(`[requestCobalt] EXCEPTION on ${instanceUrl ? `***${instanceUrl.substring(instanceUrl.length - 20)}` : "empty"}:`, err.message, err.stack);
      lastError = err;
    }
  }

  const errorMsg = lastError?.message || "All Cobalt instances unavailable";
  console.error("[requestCobalt] ALL INSTANCES FAILED. Last error:", errorMsg);
  throw lastError || new Error("All Cobalt instances unavailable");
}

export async function getDirectUrl(videoUrl, formatId = "720", bitrate) {
  console.log("[getDirectUrl] Called with videoUrl:", videoUrl, "formatId:", formatId, "bitrate:", bitrate);
  if (!validateVideoUrl(videoUrl)) {
    console.error("[getDirectUrl] Validation failed for URL:", videoUrl);
    throw new Error("Unsupported or invalid video URL");
  }

  const isAudio = formatId === "audio_mp3" || formatId === "audio";
  let cleaned = String(formatId).replace(/p$/, "");
  if (
    !["max", "4320", "2160", "1440", "1080", "720", "480", "360", "240", "144"].includes(
      cleaned
    )
  ) {
    console.log("[getDirectUrl] Invalid formatId:", formatId, "defaulting to 720");
    cleaned = "720";
  }

  const payload = {
    url: videoUrl,
    downloadMode: isAudio ? "audio" : "auto",
    localProcessing: "disabled",
  };
  
  // Conditionally add audio or video specific fields
  if (isAudio) {
    payload.audioFormat = "mp3";
    // Fix 3: Send bitrate as string enum ("320"/"256"/"128"/"96"/"64"/"8")
    payload.audioBitrate = bitrate ? String(bitrate) : "128";
  } else {
    payload.videoQuality = cleaned;
    payload.youtubeVideoCodec = "h264";
  }

  console.log("[getDirectUrl] Payload:", JSON.stringify(payload, null, 2));
  console.log("[getDirectUrl] Requesting from Cobalt...");
  console.log("[getDirectUrl] Note: Cookies must be configured in Cobalt instance for age-restricted videos");

  const response = await requestCobalt(payload);
  console.log("[getDirectUrl] Cobalt response status:", response.status);

  // Handle tunnel / redirect
  if (["redirect", "tunnel"].includes(response.status) && response.url) {
    console.log("[getDirectUrl] SUCCESS: Got redirect/tunnel URL");
    console.log("[getDirectUrl] Direct URL:", response.url ? `***${response.url.substring(0, 50)}...` : "empty");
    return {
      success: true,
      directUrl: response.url,
      filename:
        response.filename ||
        (isAudio ? "audio.mp3" : `video_${cleaned}p.mp4`),
      status: response.status,
      format: {
        format_id: formatId,
        ext: isAudio ? "mp3" : "mp4",
        label: isAudio ? "MP3 Audio" : `${cleaned}p`,
        type: isAudio ? "audio-only" : "video+audio",
        has_video: !isAudio,
        has_audio: true,
      },
      contentType: isAudio ? "audio/mpeg" : "video/mp4",
    };
  }

  // Handle picker (rare on YouTube)
  if (response.status === "picker" && response.picker?.[0]?.url) {
    console.log("[getDirectUrl] Picker response detected, using first URL");
    return {
      success: true,
      directUrl: response.picker[0].url,
      filename: response.filename || `video_${cleaned}p.mp4`,
      status: "redirect",
      format: {
        format_id: formatId,
        ext: "mp4",
        label: `${cleaned}p`,
        type: "video+audio",
        has_video: true,
        has_audio: true,
      },
      contentType: "video/mp4",
    };
  }

  // local-processing: show direct error - no retry, no fallback
  if (response.status === "local-processing") {
    console.error("[getDirectUrl] LOCAL-PROCESSING DETECTED - This Cobalt instance requires local processing");
    console.error("[getDirectUrl] Full response:", JSON.stringify(response, null, 2));
    throw new Error("This Cobalt instance requires local processing. Please use a different Cobalt instance with localProcessing disabled.");
  }

  // Any other status is an error
  console.error("[getDirectUrl] UNEXPECTED STATUS:", response.status || "unknown");
  console.error("[getDirectUrl] Full response:", JSON.stringify(response, null, 2));
  throw new Error(
    `Unexpected Cobalt response: ${response.status || "unknown"}`
  );
}

export async function getInfo(videoUrl) {
  console.log("[getInfo] Called with videoUrl:", videoUrl);
  if (!validateVideoUrl(videoUrl)) {
    console.error("[getInfo] Validation failed for URL:", videoUrl);
    throw new Error("Unsupported or invalid video URL");
  }

  const ytId = extractYouTubeId(videoUrl);
  const defaultThumbnail = ytId
    ? `https://img.youtube.com/vi/${ytId}/hqdefault.jpg`
    : "";

  console.log("[getInfo] YouTube ID:", ytId);
  console.log("[getInfo] Default thumbnail:", defaultThumbnail);

  // Prefer YouTube Data API if key is set
  const apiKey = process.env.YOUTUBE_API_KEY;
  console.log("[getInfo] YOUTUBE_API_KEY:", apiKey ? "***.SET**" : "NOT SET");
  
  if (apiKey && ytId) {
    console.log("[getInfo] Using YouTube Data API v3");
    try {
      const apiUrl = `https://www.googleapis.com/youtube/v3/videos?part=snippet,contentDetails,statistics&id=${ytId}&key=${apiKey}`;
      console.log("[getInfo] API URL: https://www.googleapis.com/youtube/v3/videos?part=...&key=***REDACTED**");
      const res = await fetch(apiUrl);
      console.log("[getInfo] API response status:", res.status);
      
      if (res.ok) {
        const data = await res.json();
        console.log("[getInfo] API response items count:", data.items?.length || 0);
        const item = data.items?.[0];
        if (item) {
          const seconds = parseIsoDuration(item.contentDetails?.duration);
          const result = {
            title: item.snippet?.title || `YouTube Video (${ytId})`,
            channel: item.snippet?.channelTitle || "YouTube Creator",
            views: formatViews(
              parseInt(item.statistics?.viewCount || "0", 10)
            ),
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
          console.log("[getInfo] YouTube API SUCCESS, title:", result.title);
          return result;
        }
        console.log("[getInfo] YouTube API: No items in response");
      } else {
        console.error("[getInfo] YouTube API failed, status:", res.status);
      }
    } catch (err) {
      console.error("[getInfo] YouTube API EXCEPTION:", err.message, err.stack);
    }
  }

  // oEmbed fallback
  console.log("[getInfo] Trying oEmbed fallback...");
  try {
    const oembedUrl = `https://noembed.com/embed?url=${encodeURIComponent(videoUrl)}`;
    console.log("[getInfo] oEmbed URL:", oembedUrl);
    const oembed = await fetch(oembedUrl);
    console.log("[getInfo] oEmbed response status:", oembed.status);
    
    if (oembed.ok) {
      const data = await oembed.json();
      console.log("[getInfo] oEmbed data title:", data?.title || "none");
      if (data?.title) {
        const result = {
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
        console.log("[getInfo] oEmbed SUCCESS, title:", result.title);
        return result;
      }
      console.log("[getInfo] oEmbed: No title in response");
    }
  } catch (err) {
    console.error("[getInfo] oEmbed EXCEPTION:", err.message, err.stack);
  }

  console.log("[getInfo] All methods failed, returning default info");
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

// ======================
// Search - YouTube Data API v3
// ======================

export async function search(query) {
  console.log("[search] Called with query:", query);
  if (!query?.trim()) {
    console.log("[search] Empty query, returning empty array");
    return [];
  }

  const apiKey = process.env.YOUTUBE_API_KEY;
  console.log("[search] YOUTUBE_API_KEY:", apiKey ? "***.SET**" : "NOT SET");
  
  if (!apiKey) {
    console.warn("[search] YOUTUBE_API_KEY is not set, cannot search");
    return [];
  }

  try {
    console.log("[search] Building search URL...");
    // 1. Search for video IDs
    const searchUrl =
      "https://www.googleapis.com/youtube/v3/search" +
      "?part=snippet" +
      "&type=video" +
      "&maxResults=10" +
      `&q=${encodeURIComponent(query.trim())}` +
      `&key=${apiKey}`;

    console.log("[search] Search URL: https://www.googleapis.com/youtube/v3/search?part=...&key=***REDACTED**");
    const searchRes = await fetch(searchUrl);
    console.log("[search] Search response status:", searchRes.status);
    
    if (!searchRes.ok) {
      const err = await searchRes.json().catch(() => ({}));
      const errorMsg = err.error?.message || `YouTube search HTTP ${searchRes.status}`;
      console.error("[search] Search failed:", errorMsg);
      throw new Error(errorMsg);
    }

    const searchData = await searchRes.json();
    console.log("[search] Search returned items:", searchData.items?.length || 0);
    const items = searchData.items || [];
    if (items.length === 0) {
      console.log("[search] No items found, returning empty array");
      return [];
    }

    const ids = items
      .map((i) => i.id.videoId)
      .filter(Boolean)
      .join(",");
    
    console.log("[search] Video IDs:", ids.substring(0, 100));

    // 2. Fetch duration + view count
    const detailsUrl =
      "https://www.googleapis.com/youtube/v3/videos" +
      "?part=contentDetails,statistics" +
      `&id=${ids}` +
      `&key=${apiKey}`;

    console.log("[search] Fetching video details...");
    const detailsRes = await fetch(detailsUrl);
    console.log("[search] Details response status:", detailsRes.status);
    
    const detailsData = detailsRes.ok
      ? await detailsRes.json()
      : { items: [] };

    console.log("[search] Details returned items:", detailsData.items?.length || 0);
    const detailsMap = {};
    for (const d of detailsData.items || []) {
      detailsMap[d.id] = d;
    }

    const results = items.map((item) => {
      const id = item.id.videoId;
      const details = detailsMap[id] || {};
      const seconds = parseIsoDuration(details.contentDetails?.duration);
      const views = parseInt(details.statistics?.viewCount || "0", 10);

      const result = {
        id,
        videoId: id,
        title: item.snippet?.title || "YouTube Video",
        channel: item.snippet?.channelTitle || "YouTube Creator",
        views: formatViews(views),
        uploadDate: item.snippet?.publishedAt?.slice(0, 10) || "--",
        duration: durationLabel(seconds),
        seconds,
        url: `https://www.youtube.com/watch?v=${id}`,
        thumbnail:
          item.snippet?.thumbnails?.high?.url ||
          item.snippet?.thumbnails?.medium?.url ||
          `https://img.youtube.com/vi/${id}/hqdefault.jpg`,
      };
      console.log(`[search] Result: ${result.title} (${result.duration})`);
      return result;
    });
    
    console.log("[search] Total results:", results.length);
    return results;
  } catch (err) {
    console.error("[search] EXCEPTION:", err.message, err.stack);
    return [];
  }
}
