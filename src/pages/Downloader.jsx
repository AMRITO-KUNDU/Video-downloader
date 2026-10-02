import { useEffect, useState, useRef } from "react";
import { useSearchParams, useLocation } from "react-router-dom";
import { Download, Link2, Loader2, ClipboardPaste, Film, Music, CheckCircle2 } from "lucide-react";
import { Image } from "@/components/ui/image";
import MobileTopBar from "@/components/layout/MobileTopBar";
import { fetchVideoInfo, isVideoUrl, fetchVideoFormats, getDirectDownloadUrl } from "@/lib/videoService";
import { useToast } from "@/components/ui/use-toast";
import { cn } from "@/lib/utils";

const QUALITY_HEIGHTS = ["1080p", "720p", "480p", "360p"];
const AUDIO_BITRATES = ["320kbps", "256kbps", "192kbps", "128kbps"];

export default function Downloader() {
  const [searchParams] = useSearchParams();
  const location = useLocation();
  const [url, setUrl] = useState(searchParams.get("url") || "");
  const [video, setVideo] = useState(null);
  const [loading, setLoading] = useState(false);
  const [loadingFormats, setLoadingFormats] = useState(false);
  const [formats, setFormats] = useState(null);
  const [formatType, setFormatType] = useState("mp4"); // mp4, mp3, or custom formats
  const [quality, setQuality] = useState("720p");
  const [audioBitrate, setAudioBitrate] = useState("192kbps");
  const [error, setError] = useState("");
  const [customFormatError, setCustomFormatError] = useState("");
  
  // Download state
  const [dlPhase, setDlPhase] = useState("idle"); // idle | extracting | done
  const [progress, setProgress] = useState(0); // 0–100
  const abortRef = useRef(null);
  const { toast } = useToast();

  const isDownloading = dlPhase === "extracting";

  // Check if we have video data passed from search results
  const hasVideoData = location.state?.video;

  // Get selected format based on current UI selections
  const getSelectedFormat = () => {
    if (!formats?.formats) return null;
    
    if (formatType === "custom") {
      // Find the first format for custom selection
      return formats.formats[0] || null;
    }
    
    if (formatType === "mp4") {
      // Find the best video+audio format for the selected quality
      const height = parseInt(quality, 10) || 720;
      const videoFormats = formats.formats.filter(f => f.has_video && f.type === 'video+audio');
      
      // Sort by height (descending) and find closest match
      videoFormats.sort((a, b) => (b.height || 0) - (a.height || 0));
      
      // Find the highest quality that is <= requested height
      for (const fmt of videoFormats) {
        if ((fmt.height || 0) <= height) {
          return fmt;
        }
      }
      
      // If no exact match, return the highest quality video+audio
      return videoFormats[0] || null;
    }
    
    if (formatType === "mp3") {
      // Find audio-only format
      const bitrate = parseInt(audioBitrate, 10) || 192;
      const audioFormats = formats.formats.filter(f => f.type === 'audio-only');
      
      // Sort by bitrate (descending)
      audioFormats.sort((a, b) => (b.abr || 0) - (a.abr || 0));
      
      // Find closest match
      for (const fmt of audioFormats) {
        if ((fmt.abr || 0) <= bitrate) {
          return fmt;
        }
      }
      
      // Return highest quality audio
      return audioFormats[0] || null;
    }
    
    return null;
  };

  // Initialize from search result metadata or URL
  useEffect(() => {
    if (hasVideoData) {
      setVideo(hasVideoData);
      setUrl(hasVideoData.url);
      loadFormats(hasVideoData.url);
    } else {
      const u = searchParams.get("url");
      if (u) {
        setUrl(u);
        handleFetch(u);
      }
    }
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [location.state, searchParams]);

  const loadFormats = async (videoUrl) => {
    setLoadingFormats(true);
    setCustomFormatError("");
    try {
      const result = await fetchVideoFormats(videoUrl);
      setFormats(result);
    } catch (err) {
      setCustomFormatError(err.message || "Failed to load formats");
    } finally {
      setLoadingFormats(false);
    }
  };

  const handleFetch = async (override) => {
    const u = (override ?? url).trim();
    if (!u) return;
    if (!isVideoUrl(u)) {
      setError("Paste a valid YouTube or Facebook video link.");
      setVideo(null);
      setFormats(null);
      return;
    }
    setError("");
    setLoading(true);
    setVideo(null);
    setFormats(null);
    try {
      const v = await fetchVideoInfo(u);
      if (!v) throw new Error();
      setVideo(v);
      await loadFormats(u);
    } catch {
      setError("Couldn't fetch that video. Make sure it's public.");
    } finally {
      setLoading(false);
    }
  };

  const handleDownload = async () => {
    const selectedFormat = getSelectedFormat();
    const targetUrl = video?.url || url;
    
    if (!selectedFormat || !targetUrl || isDownloading) return;

    setDlPhase("extracting");
    setProgress(0);

    try {
      // Get direct URL using the selected format_id
      const result = await getDirectDownloadUrl({
        url: targetUrl,
        formatId: selectedFormat.format_id
      });

      if (result?.success && result?.directUrl) {
        setProgress(50);
        
        // Trigger browser download directly from the CDN
        const a = document.createElement("a");
        a.href = result.directUrl;
        a.target = "_blank";
        a.download = `${(video?.title || "video").replace(/[^\w\s-]/g, "").slice(0, 80)}.${selectedFormat.ext}`;
        document.body.appendChild(a);
        a.click();
        document.body.removeChild(a);

        setProgress(100);
        setDlPhase("done");

        toast({
          title: "Download Started",
          description: formatType === "mp3" ? `Downloading ${audioBitrate} MP3` : `Downloading ${quality} MP4`,
        });

        // Reset after a short moment
        setTimeout(() => {
          setDlPhase("idle");
          setProgress(0);
        }, 1800);
        return;
      } else {
        throw new Error(result?.error || "Could not get direct download URL");
      }
    } catch (err) {
      if (err.name === "AbortError") return;
      setDlPhase("idle");
      setProgress(0);
      toast({
        variant: "destructive",
        title: "Download failed",
        description: err.message || "Something went wrong while starting the download.",
      });
    } finally {
      abortRef.current = null;
    }
  };

  const statusLabel = {
    idle: formatType === "mp3" ? `Download ${audioBitrate} MP3` : `Download ${quality} MP4`,
    extracting: "Extracting from YouTube…",
    done: "Saved",
  }[dlPhase];

  // Check if we have video+audio formats available
  const hasVideoAudio = formats?.formats?.some(f => f.type === 'video+audio');
  const hasAudioOnly = formats?.formats?.some(f => f.type === 'audio-only');

  return (
    <div className="flex h-full flex-col">
      <MobileTopBar />
      <div className="flex-1 overflow-y-auto scrollbar-nb">
        <div className="mx-auto w-full max-w-2xl px-4 py-6 sm:px-6">
          <h1 className="font-display text-3xl font-extrabold tracking-tight text-black sm:text-4xl">
            Downloader
          </h1>
          <p className="mt-1 text-sm font-medium text-black/55">
            Paste a link, pick a quality, and grab it.
          </p>

          <div className="mt-5 flex flex-col gap-2 sm:flex-row">
            <div className="flex flex-1 items-center border-2 border-black bg-white shadow-[3px_3px_0_0_#000]">
              <Link2 className="ml-3 h-4 w-4 shrink-0 text-black/40" strokeWidth={2.5} />
              <input
                value={url}
                onChange={(e) => setUrl(e.target.value)}
                onKeyDown={(e) => e.key === "Enter" && handleFetch()}
                placeholder="https://youtube.com/watch?v=…"
                className="w-full bg-transparent px-2 py-2.5 text-sm font-medium placeholder:text-black/40 focus:outline-none"
              />
            </div>
            <button onClick={() => handleFetch()} disabled={loading} className="nb-btn-dark px-4 py-2.5 text-sm">
              {loading ? (
                <Loader2 className="h-4 w-4 animate-spin" strokeWidth={3} />
              ) : (
                <ClipboardPaste className="h-4 w-4" strokeWidth={2.5} />
              )}
              Fetch
            </button>
          </div>

          {customFormatError && (
            <div className="mt-3 border-2 border-red-500 bg-red-50 px-3 py-2.5 text-sm font-medium text-red-600">
              {customFormatError}
            </div>
          )}

          {error && (
            <div className="mt-3 border-2 border-black bg-white px-3 py-2.5 text-sm font-bold text-black shadow-[3px_3px_0_0_#000]">
              {error}
            </div>
          )}

          {loading && !video && (
            <div className="mt-5 flex items-center justify-center border-2 border-dashed border-black bg-white py-16">
              <Loader2 className="h-6 w-6 animate-spin text-black" strokeWidth={3} />
            </div>
          )}

          {!loading && !video && !error && !customFormatError && (
            <div className="mt-5 grid place-items-center border-2 border-dashed border-black bg-white py-16 text-center">
              <div className="grid h-14 w-14 place-items-center border-2 border-black bg-brand shadow-[4px_4px_0_0_#000]">
                <Download className="h-7 w-7" strokeWidth={2.5} />
              </div>
              <h3 className="mt-4 font-display text-xl font-extrabold">Paste a video link to begin</h3>
              <p className="mt-1 text-sm font-medium text-black/55">YouTube or Facebook links supported.</p>
            </div>
          )}

          {video && (
            <div className="mt-5 nb-card overflow-hidden">
              <div className="relative aspect-video w-full border-b-2 border-black bg-black">
                <Image src={video.thumbnail} alt={video.title} className="h-full w-full" fittingType="fill" />
                <span className="absolute bottom-2 right-2 border-2 border-black bg-black px-2 py-0.5 text-xs font-bold text-white">
                  {video.duration}
                </span>
              </div>
              <div className="p-4">
                <h3 className="font-display text-lg font-extrabold leading-tight text-black">{video.title}</h3>
                <div className="mt-1 text-sm font-bold text-black/70">{video.channel}</div>

                {loadingFormats && (
                  <div className="mt-6 flex items-center justify-center py-8">
                    <Loader2 className="h-5 w-5 animate-spin text-black" strokeWidth={3} />
                  </div>
                )}

                {formats && !loadingFormats && (
                  <>
                    <div className="mt-4">
                      <div className="mb-2 text-[11px] font-bold uppercase tracking-widest text-black/50">Format</div>
                      <div className="flex gap-2">
                        {hasVideoAudio && (
                          <button
                            onClick={() => !isDownloading && setFormatType("mp4")}
                            disabled={isDownloading}
                            className={cn(
                              "flex items-center gap-1.5 border-2 border-black px-3 py-2 text-xs font-bold uppercase nb-press",
                              formatType === "mp4" ? "bg-black text-white" : "bg-white",
                              isDownloading && "opacity-50"
                            )}
                          >
                            <Film className="h-3.5 w-3.5" strokeWidth={2.5} /> MP4
                          </button>
                        )}
                        {hasAudioOnly && (
                          <button
                            onClick={() => !isDownloading && setFormatType("mp3")}
                            disabled={isDownloading}
                            className={cn(
                              "flex items-center gap-1.5 border-2 border-black px-3 py-2 text-xs font-bold uppercase nb-press",
                              formatType === "mp3" ? "bg-black text-white" : "bg-white",
                              isDownloading && "opacity-50"
                            )}
                          >
                            <Music className="h-3.5 w-3.5" strokeWidth={2.5} /> MP3
                          </button>
                        )}
                      </div>
                    </div>

                    {formatType === "mp4" && hasVideoAudio && (
                      <div className="mt-4">
                        <div className="mb-2 text-[11px] font-bold uppercase tracking-widest text-black/50">Quality</div>
                        <div className="flex flex-wrap gap-2">
                          {QUALITY_HEIGHTS.map((q) => (
                            <button
                              key={q}
                              onClick={() => !isDownloading && setQuality(q)}
                              disabled={isDownloading}
                              className={cn(
                                "border-2 border-black px-3 py-2 text-xs font-bold uppercase nb-press",
                                quality === q ? "bg-brand shadow-[3px_3px_0_0_#000]" : "bg-white",
                                isDownloading && "opacity-50"
                              )}
                            >
                              {q}
                            </button>
                          ))}
                        </div>
                      </div>
                    )}

                    {formatType === "mp3" && hasAudioOnly && (
                      <div className="mt-4">
                        <div className="mb-2 text-[11px] font-bold uppercase tracking-widest text-black/50">Bitrate</div>
                        <div className="flex flex-wrap gap-2">
                          {AUDIO_BITRATES.map((br) => (
                            <button
                              key={br}
                              onClick={() => !isDownloading && setAudioBitrate(br)}
                              disabled={isDownloading}
                              className={cn(
                                "border-2 border-black px-3 py-2 text-xs font-bold uppercase nb-press",
                                audioBitrate === br ? "bg-brand shadow-[3px_3px_0_0_#000]" : "bg-white",
                                isDownloading && "opacity-50"
                              )}
                            >
                              {br}
                            </button>
                          ))}
                        </div>
                      </div>
                    )}
                  </>
                )}

                {/* Progress bar – neo-brutalism style */}
                {isDownloading && (
                  <div className="mt-5">
                    <div className="mb-1.5 flex items-center justify-between text-[11px] font-bold uppercase tracking-widest">
                      <span className="text-black/60">{statusLabel}</span>
                      {progress > 0 && (
                        <span className="text-black">{progress}%</span>
                      )}
                    </div>
                    <div className="h-3 w-full border-2 border-black bg-white shadow-[2px_2px_0_0_#000]">
                      {dlPhase === "extracting" ? (
                        // Indeterminate shimmer bar
                        <div className="h-full w-full overflow-hidden bg-brand/30">
                          <div className="h-full w-1/3 animate-[shimmer_1.2s_ease-in-out_infinite] bg-brand" />
                        </div>
                      ) : (
                        // Determinate progress
                        <div
                          className="h-full bg-brand transition-all duration-200 ease-out"
                          style={{ width: `${progress}%` }}
                        />
                      )}
                    </div>
                  </div>
                )}

                <button
                  onClick={handleDownload}
                  disabled={isDownloading || dlPhase === "done"}
                  className="nb-btn-dark mt-5 w-full px-3 py-3 text-sm"
                >
                  {dlPhase === "done" ? (
                    <CheckCircle2 className="h-4 w-4" strokeWidth={3} />
                  ) : isDownloading ? (
                    <Loader2 className="h-4 w-4 animate-spin" strokeWidth={3} />
                  ) : (
                    <Download className="h-4 w-4" strokeWidth={3} />
                  )}
                  {statusLabel}
                </button>

                <p className="mt-2 text-center text-[11px] font-medium text-black/45">
                  Direct download from CDN - Powered by yt-dlp.
                </p>
              </div>
            </div>
          )}
        </div>
      </div>

      {/* Tiny keyframe for the indeterminate shimmer */}
      <style>{`
        @keyframes shimmer {
          0%   { transform: translateX(-100%); }
          100% { transform: translateX(400%); }
        }
      `}</style>
    </div>
  );
}
