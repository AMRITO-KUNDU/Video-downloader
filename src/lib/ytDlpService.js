import { execFile } from "child_process";
import { promisify } from "util";
import fs from "fs";

const execFileAsync = promisify(execFile);

// Cookie configuration - compatible with server.js cookie handling
const SECRET_COOKIES = process.env.YTDLP_COOKIES || null;
const WRITABLE_COOKIES = "/tmp/cookies.txt";

// Copy secret cookies to a writable location once at startup
function prepareCookies() {
  if (!SECRET_COOKIES) return null;
  if (!fs.existsSync(SECRET_COOKIES)) {
    console.log(`[cookies] Secret file not found: ${SECRET_COOKIES}`);
    return null;
  }
  try {
    fs.copyFileSync(SECRET_COOKIES, WRITABLE_COOKIES);
    console.log(`[cookies] Copied to writable location: ${WRITABLE_COOKIES}`);
    return WRITABLE_COOKIES;
  } catch (err) {
    console.error("[cookies] Failed to copy cookies:", err.message);
    return null;
  }
}

const COOKIES_PATH = prepareCookies();

const SUPPORTED_HOSTS = ["youtube.com", "youtu.be", "youtube-nocookie.com", "facebook.com", "fb.watch"];

function getYtDlpBaseArgs() {
  const args = [
    "-4",
    "--extractor-args", "youtube:player_client=android,web,mweb",
    "--no-warnings",
    "--socket-timeout", "30",
    "--retries", "10"
  ];
  if (COOKIES_PATH && fs.existsSync(COOKIES_PATH)) {
    args.push("--cookies", COOKIES_PATH);
  }
  return args;
}

function validateVideoUrl(value) {
  try {
    const parsed = new URL(value);
    const hostname = parsed.hostname.toLowerCase().replace(/^www\./, "");
    return parsed.protocol === "http:" || parsed.protocol === "https:"
      ? SUPPORTED_HOSTS.some((host) => hostname === host || hostname.endsWith(`.${host}`))
      : false;
  } catch {
    return false;
  }
}

function durationLabel(seconds) {
  if (!Number.isFinite(seconds) || seconds <= 0) return "—";
  const total = Math.floor(seconds);
  const hours = Math.floor(total / 3600);
  const mins = Math.floor((total % 3600) / 60);
  const secs = total % 60;
  return hours
    ? `${hours}:${String(mins).padStart(2, "0")}:${String(secs).padStart(2, "0")}`
    : `${mins}:${String(secs).padStart(2, "0")}`;
}

/**
 * Search videos using yt-dlp
 * @param {string} query - Search query
 * @returns {Promise<Array>} - Array of video search results
 */
export async function search(query) {
  if (!query || typeof query !== "string") return [];

  try {
    const args = [
      ...getYtDlpBaseArgs(),
      "--flat-playlist",
      "--dump-json",
      `ytsearch8:${query}`
    ];
    const { stdout } = await execFileAsync("yt-dlp", args, { maxBuffer: 10 * 1024 * 1024 });

    const lines = stdout.trim().split("\n").filter(Boolean);
    return lines
      .map((line, i) => {
        try {
          const item = JSON.parse(line);
          const durationSec = item.duration || 0;
          const durStr = durationLabel(durationSec);
          const vId = item.id || (typeof item.url === "string" && /^[A-Za-z0-9_-]{11}$/.test(item.url) ? item.url : "");

          return {
            id: vId || `v_${i}`,
            videoId: vId,
            title: item.title || "YouTube Video",
            channel: item.uploader || item.channel || "YouTube Creator",
            views: item.view_count ? `${item.view_count.toLocaleString()} views` : "—",
            uploadDate: item.upload_date ? `${item.upload_date.slice(0, 4)}` : "—",
            duration: durStr,
            seconds: durationSec,
            url: vId ? `https://www.youtube.com/watch?v=${vId}` : item.webpage_url || "",
            thumbnail: vId
              ? `https://img.youtube.com/vi/${vId}/hqdefault.jpg`
              : item.thumbnails?.[0]?.url || "",
          };
        } catch {
          return null;
        }
      })
      .filter(Boolean);
  } catch (err) {
    console.error("Search error:", err);
    throw new Error(`YouTube search failed: ${err.message}`);
  }
}

/**
 * Get video metadata using yt-dlp
 * @param {string} videoUrl - Video URL
 * @returns {Promise<Object>} - Video metadata
 */
export async function getInfo(videoUrl) {
  if (!videoUrl) throw new Error("URL parameter required");
  if (!validateVideoUrl(videoUrl)) {
    throw new Error("Only public YouTube and Facebook URLs are supported");
  }

  try {
    const args = [
      ...getYtDlpBaseArgs(),
      "--dump-json",
      "--no-playlist",
      videoUrl
    ];
    const { stdout } = await execFileAsync("yt-dlp", args, { maxBuffer: 10 * 1024 * 1024 });

    const item = JSON.parse(stdout);
    const durationSec = item.duration || 0;
    const vId = item.id;

    return {
      title: item.title,
      channel: item.uploader || item.channel || "YouTube",
      views: item.view_count ? `${item.view_count.toLocaleString()} views` : "—",
      uploadDate: item.upload_date || "—",
      duration: durationLabel(durationSec),
      seconds: durationSec,
      url: videoUrl,
      videoId: vId,
      thumbnail: vId ? `https://img.youtube.com/vi/${vId}/hqdefault.jpg` : item.thumbnail || "",
    };
  } catch (err) {
    console.error("Info error:", err);
    throw new Error(`Could not fetch video metadata: ${err.message}`);
  }
}

/**
 * Get available formats for a video using yt-dlp
 * Only returns formats that can be delivered as a single direct media URL
 * @param {string} videoUrl - Video URL
 * @returns {Promise<Object>} - Object containing formats array and metadata
 */
export async function getFormats(videoUrl) {
  if (!videoUrl) throw new Error("URL parameter required");
  if (!validateVideoUrl(videoUrl)) {
    throw new Error("Only public YouTube and Facebook URLs are supported");
  }

  try {
    // Use --dump-json to get full info, then extract formats from the JSON
    const args = [
      ...getYtDlpBaseArgs(),
      "--dump-json",
      "--no-playlist",
      videoUrl
    ];
    const { stdout } = await execFileAsync("yt-dlp", args, { maxBuffer: 10 * 1024 * 1024 });

    const item = JSON.parse(stdout);
    
    // If formats are not available in the dump, try --list-formats with --json
    if (!item.formats || !Array.isArray(item.formats)) {
      // Fallback: try --list-formats -j (JSON output)
      const listArgs = [
        ...getYtDlpBaseArgs(),
        "--list-formats",
        "-j", // JSON output
        "--no-playlist",
        videoUrl
      ];
      
      try {
        const { stdout: listStdout } = await execFileAsync("yt-dlp", listArgs, { maxBuffer: 10 * 1024 * 1024 });
        const formatData = JSON.parse(listStdout);
        
        // Handle different output formats
        if (Array.isArray(formatData)) {
          // Some versions output array of format objects directly
          processFormats(formatData, videoUrl);
        } else if (formatData.formats && Array.isArray(formatData.formats)) {
          return processFormats(formatData.formats, videoUrl);
        } else {
          throw new Error("Unexpected format data structure");
        }
      } catch (listErr) {
        console.error("List formats with -j failed, trying plain --list-formats:", listErr);
        // Last fallback: use plain --list-formats and parse the text output
        const textArgs = [
          ...getYtDlpBaseArgs(),
          "--list-formats",
          "--no-playlist",
          videoUrl
        ];
        
        const { stdout: textStdout } = await execFileAsync("yt-dlp", textArgs, { maxBuffer: 10 * 1024 * 1024 });
        return parseTextFormats(textStdout, videoUrl);
      }
    }
    
    // Process formats from the dump-json output
    return processFormats(item.formats, videoUrl);
    
  } catch (err) {
    console.error("Formats error:", err);
    throw new Error(`Could not fetch video formats: ${err.message}`);
  }
}

/**
 * Process format array and filter for direct-URL-capable formats
 */
function processFormats(formats, videoUrl) {
  // Filter formats that can be delivered as direct URLs
  const validFormats = formats
    .filter(format => {
      // Skip DASH manifests and other non-direct formats
      if (format.protocol === 'dash' || format.protocol === 'm3u8_native') {
        return false;
      }
      
      // Check if this is a direct URL format
      if (format.url && typeof format.url === 'string') {
        return true;
      }
      
      // Also accept formats that yt-dlp can extract direct URLs for
      return format.format_id && format.ext;
    })
    .map(format => {
      // Create a more descriptive label
      let label = format.format_id;
      
      if (format.height) {
        label = `${format.height}p`;
        if (format.fps && format.fps > 30) {
          label += `${format.fps}`;
        }
      } else if (format.abr) {
        label = `${Math.round(format.abr)}kbps`;
      }
      
      // Add codec info for advanced users
      const codecInfo = [];
      if (format.vcodec && format.vcodec !== 'none') {
        codecInfo.push(format.vcodec);
      }
      if (format.acodec && format.acodec !== 'none') {
        codecInfo.push(format.acodec);
      }
      
      return {
        format_id: format.format_id,
        ext: format.ext || 'unknown',
        height: format.height,
        width: format.width,
        fps: format.fps,
        abr: format.abr,
        vcodec: format.vcodec || 'none',
        acodec: format.acodec || 'none',
        protocol: format.protocol || 'unknown',
        label: label,
        filesize: format.filesize || format.filesize_approx || null,
        resolution: format.height ? `${format.width || '?'}x${format.height}` : null,
        codec_info: codecInfo.length > 0 ? codecInfo.join('+') : null,
        type: format.height ? (format.acodec && format.acodec !== 'none' ? 'video+audio' : 'video-only') : 
              (format.acodec && format.acodec !== 'none' ? 'audio-only' : 'unknown'),
        has_video: !!format.height,
        has_audio: format.acodec && format.acodec !== 'none',
      };
    });
  
  // Sort formats: first video+audio, then video-only, then audio-only
  validFormats.sort((a, b) => {
    const typePriority = { 'video+audio': 0, 'video-only': 1, 'audio-only': 2 };
    const aTypePriority = typePriority[a.type] ?? 3;
    const bTypePriority = typePriority[b.type] ?? 3;
    
    if (aTypePriority !== bTypePriority) {
      return aTypePriority - bTypePriority;
    }
    
    // Within same type, sort by quality
    if (aTypePriority === 0 || aTypePriority === 1) {
      return (b.height || 0) - (a.height || 0);
    } else {
      return (b.abr || 0) - (a.abr || 0);
    }
  });
  
  return {
    videoUrl,
    formats: validFormats,
    total: validFormats.length
  };
}

/**
 * Parse text output from --list-formats (fallback method)
 */
function parseTextFormats(textOutput, videoUrl) {
  const lines = textOutput.trim().split('\n');
  const formats = [];
  
  // Parse text format lines like: "ID  EXT   RESOLUTION FPS │   FILESIZE   TBR PROTO │ VCODEC        ACODEC MORE .INFO"
  for (const line of lines) {
    if (!line.trim() || line.startsWith('ID') || line.startsWith('format') || line.includes('│')) {
      continue; // Skip headers and separator lines
    }
    
    const parts = line.trim().split(/\s+/);
    if (parts.length >= 2) {
      const formatId = parts[0];
      const ext = parts[1];
      
      // Try to extract more info
      const heightMatch = line.match(/(\d+)p/);
      const height = heightMatch ? parseInt(heightMatch[1]) : null;
      
      const abrMatch = line.match(/audio only.*?(\d+)kbps/);
      const abr = abrMatch ? parseInt(abrMatch[1]) : null;
      
      formats.push({
        format_id: formatId,
        ext: ext || 'unknown',
        height: height,
        width: height ? Math.round(height * (16/9)) : null, // approximate
        fps: null,
        abr: abr,
        vcodec: 'unknown',
        acodec: 'unknown',
        protocol: 'unknown',
        label: height ? `${height}p` : abr ? `${abr}kbps` : formatId,
        filesize: null,
        resolution: null,
        codec_info: null,
        type: height ? 'video-only' : abr ? 'audio-only' : 'unknown',
        has_video: !!height,
        has_audio: !!abr,
      });
    }
  }
  
  return {
    videoUrl,
    formats: formats,
    total: formats.length
  };
}

/**
 * Get direct URL for a specific format
 * @param {string} videoUrl - Video URL
 * @param {string} formatId - The format_id to extract URL for
 * @returns {Promise<Object>} - Object containing direct URL and format metadata
 */
export async function getDirectUrl(videoUrl, formatId) {
  if (!videoUrl) throw new Error("URL parameter required");
  if (!formatId || typeof formatId !== 'string') {
    throw new Error("Valid format_id is required");
  }
  if (!validateVideoUrl(videoUrl)) {
    throw new Error("Only public YouTube and Facebook URLs are supported");
  }

  try {
    // First, get the format info to validate the format_id exists and get metadata
    const args = [
      ...getYtDlpBaseArgs(),
      "--dump-json",
      "-f", formatId,
      "--no-playlist",
      videoUrl
    ];
    
    const { stdout } = await execFileAsync("yt-dlp", args, { maxBuffer: 10 * 1024 * 1024 });
    const item = JSON.parse(stdout);
    
    // Check if this format exists
    const selectedFormat = item.formats?.find(f => f.format_id === formatId);
    if (!selectedFormat) {
      throw new Error(`Format ${formatId} not found for this video`);
    }
    
    // Extract direct URL for the specific format using --get-url
    const urlArgs = [
      ...getYtDlpBaseArgs(),
      "-f", formatId,
      "--get-url",
      "--no-playlist",
      videoUrl
    ];
    
    const { stdout: urlStdout } = await execFileAsync("yt-dlp", urlArgs, { maxBuffer: 10 * 1024 * 1024 });
    const directUrl = urlStdout.trim();
    
    if (!directUrl || !directUrl.startsWith('http')) {
      throw new Error(`Could not extract direct URL for format ${formatId}`);
    }
    
    // Get additional metadata for the format
    const formatInfo = item.formats?.find(f => f.format_id === formatId) || selectedFormat;
    
    return {
      success: true,
      directUrl: directUrl,
      format: {
        format_id: formatInfo.format_id,
        ext: formatInfo.ext || 'unknown',
        height: formatInfo.height,
        width: formatInfo.width,
        fps: formatInfo.fps,
        abr: formatInfo.abr,
        vcodec: formatInfo.vcodec || 'none',
        acodec: formatInfo.acodec || 'none',
        protocol: formatInfo.protocol || 'unknown',
        label: formatInfo.height ? `${formatInfo.height}p` : 
               formatInfo.abr ? `${Math.round(formatInfo.abr)}kbps` : formatInfo.format_id,
        type: formatInfo.height ? (formatInfo.acodec && formatInfo.acodec !== 'none' ? 'video+audio' : 'video-only') : 
              (formatInfo.acodec && formatInfo.acodec !== 'none' ? 'audio-only' : 'unknown'),
        has_video: !!formatInfo.height,
        has_audio: formatInfo.acodec && formatInfo.acodec !== 'none',
      },
      filename: formatInfo.height ? 
        `video_${formatInfo.height}p.${formatInfo.ext || 'mp4'}` :
        formatInfo.abr ? 
        `audio_${Math.round(formatInfo.abr)}kbps.${formatInfo.ext || 'mp3'}` :
        `media_${formatInfo.format_id}.${formatInfo.ext || 'unknown'}`,
      contentType: formatInfo.height ? `video/${formatInfo.ext || 'mp4'}` : 
                   formatInfo.abr ? `audio/${formatInfo.ext || 'mpeg'}` : 'application/octet-stream'
    };
  } catch (err) {
    console.error("Direct URL error:", err);
    throw new Error(`Could not extract direct URL: ${err.message}`);
  }
}

export { validateVideoUrl, durationLabel };