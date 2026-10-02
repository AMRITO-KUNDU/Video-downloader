import { useEffect, useState, useRef } from "react";
import { useSearchParams, useLocation } from "react-router-dom";
import { Download, Link2, Loader2, ClipboardPaste, Film, Music, CheckCircle2, Check, X } from "lucide-react";
import { Image } from "@/components/ui/image";
import MobileTopBar from "@/components/layout/MobileTopBar";
import { fetchVideoInfo, isVideoUrl, fetchVideoFormats, getDirectDownloadUrl } from "@/lib/videoService";
import { useToast } from "@/components/ui/use-toast";
import { cn } from "@/lib/utils";

export default function Downloader() {
  const [searchParams] = useSearchParams();
  const location = useLocation();
  const [url, setUrl] = useState(searchParams.get("url") || "");
  const [video, setVideo] = useState(null);
  const [loading, setLoading] = useState(false);
  const [loadingFormats, setLoadingFormats] = useState(false);
  const [formats, setFormats] = useState(null);
  const [selectedFormat, setSelectedFormat] = useState(null);
  const [error, setError] = useState("");
  const [formatError, setFormatError] = useState("");
  
  // Download state for direct downloads
  const [dlPhase, setDlPhase] = useState("idle"); // idle | extracting | done
  const [progress, setProgress] = useState(0); // 0–100
  const abortRef = useRef(null);
  const { toast } = useToast();

  const isDownloading = dlPhase === "extracting";

  // Check if we have video data passed from search results
  const hasVideoData = location.state?.video;

  // Initialize from search result metadata or URL
  useEffect(() => {
    if (hasVideoData) {
      setVideo(hasVideoData);
      setUrl(hasVideoData.url);
      // Fetch formats for this video
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
    setFormatError("");
    try {
      const result = await fetchVideoFormats(videoUrl);
      setFormats(result);
      
      // Auto-select the first available format (usually best quality video+audio)
      if (result.formats && result.formats.length > 0) {
        setSelectedFormat(result.formats[0]);
      }
    } catch (err) {
      setFormatError(err.message || "Failed to load formats");
      toast({
        variant: "destructive",
        title: "Formats Error",
        description: err.message || "Failed to load available formats",
      });
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
      // Load formats for this video
      await loadFormats(u);
    } catch {
      setError("Couldn't fetch that video. Make sure it's public.");
    } finally {
      setLoading(false);
    }
  };

  const handleSelectFormat = (format) => {
    setSelectedFormat(format);
  };

  const handleDownload = async () => {
    if (!selectedFormat) {
      toast({
        variant: "destructive",
        title: "No Format Selected",
        description: "Please select a format first",
      });
      return;
    }

    const targetUrl = video?.url || url;
    if (!targetUrl || isDownloading) return;

    setDlPhase("extracting");
    setProgress(0);

    try {
      // Get direct URL from backend
      const result = await getDirectDownloadUrl({
        url: targetUrl,
        formatId: selectedFormat.format_id
      });

      if (result?.success && result?.directUrl) {
        // Simulate some progress while we prepare the download        setProgress(50);
        
        // Trigger browser download directly from the CDN
        const a = document.createElement("a");
        a.href = result.directUrl;
        a.target = "_blank";
        a.download = `${(video?.title || "video").replace(/[^\w\s-]/g, "").slice(0, 80)}_${selectedFormat.format_id}.${selectedFormat.ext}`;
        document.body.appendChild(a);
        a.click();
        document.body.removeChild(a);

        setProgress(100);
        setDlPhase("done");

        toast({
          title: "Download Started",
          description: `Downloading ${selectedFormat.label || selectedFormat.format_id} (${selectedFormat.ext.toUpperCase()})`,
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

  const getFormatIcon = (format) => {
    if (format.has_video && format.has_audio) return Film;
    if (format.has_video) return Film;
    if (format.has_audio) return Music;
    return Download;
  };

  const getFormatTypeLabel = (format) => {
    if (format.has_video && format.has_audio) return "Video + Audio";
    if (format.has_video) return "Video Only";
    if (format.has_audio) return "Audio Only";
    return "Unknown";
  };

  const getFormatDescription = (format) => {
    const parts = [];
    if (format.height) parts.push(`${format.height}p`);
    if (format.fps && format.fps > 30) parts.push(`${format.fps}fps`);
    if (format.abr) parts.push(`${Math.round(format.abr)}kbps`);
    if (format.codec_info) parts.push(format.codec_info);
    return parts.length > 0 ? parts.join(" ") : format.format_id;
  };

  const statusLabel = {
    idle: selectedFormat ? `Download ${selectedFormat.ext.toUpperCase()}` : "Select a Format",
    extracting: "Extracting direct URL...",
    done: "Download Started",
  }[dlPhase];

  return (
    <div className="flex h-full flex-col">
      <MobileTopBar />
      <div className="flex-1 overflow-y-auto scrollbar-nb">
        <div className="mx-auto w-full max-w-2xl px-4 py-6 sm:px-6">
          <h1 className="font-display text-3xl font-extrabold tracking-tight text-black sm:text-4xl">
            Downloader
          </h1>
          <p className="mt-1 text-sm font-medium text-black/55">
            Paste a link, pick a format, and grab it.
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

          {!loading && !video && !error && (
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

                {/* Format Selection */}
                <div className="mt-4">
                  <div className="mb-2 text-[11px] font-bold uppercase tracking-widest text-black/50">
                    Available Formats ({formats?.total || 0})
                  </div>
                  
                  {formatError && (
                    <div className="mb-3 border-2 border-red-500 bg-red-50 px-3 py-2 text-sm font-medium text-red-600">
                      {formatError}
                    </div>
                  )}

                  {loadingFormats && !formats ? (
                    <div className="flex items-center justify-center py-8">
                      <Loader2 className="h-5 w-5 animate-spin text-black" strokeWidth={3} />
                    </div>
                  ) : (
                    <div className="max-h-96 overflow-y-auto scrollbar-nb">
                      {formats?.formats?.length === 0 ? (
                        <div className="text-center py-4 text-sm text-black/50">
                          No formats available for this video.
                        </div>
                      ) : (
                        <div className="space-y-2">
                          {formats?.formats?.map((format) => {
                            const Icon = getFormatIcon(format);
                            const isSelected = selectedFormat?.format_id === format.format_id;
                            
                            return (
                              <button
                                key={format.format_id}
                                onClick={() => !isDownloading && handleSelectFormat(format)}
                                disabled={isDownloading}
                                className={cn(
                                  "w-full flex items-center gap-3 border-2 border-black p-3 text-left nb-press",
                                  isSelected 
                                    ? "bg-black text-white shadow-[3px_3px_0_0_#000]" 
                                    : "bg-white",
                                  isDownloading && "opacity-50"
                                )}
                              >
                                <div className="flex-shrink-0">
                                  <Icon className="h-4 w-4" strokeWidth={2.5} />
                                </div>
                                <div className="flex-1 min-w-0">
                                  <div className="text-sm font-bold">{getFormatDescription(format)}</div>
                                  <div className="text-[11px] font-medium text-black/60">{getFormatTypeLabel(format)}</div>
                                </div>
                                <div className="flex-shrink-0">
                                  <span className="text-[11px] font-bold border border-black px-2 py-0.5 bg-white text-black">
                                    {format.ext.toUpperCase()}
                                  </span>
                                  {isSelected && (
                                    <span className="ml-2 text-brand">
                                      <Check className="h-4 w-4" strokeWidth={3} />
                                    </span>
                                  )}
                                </div>
                              </button>
                            );
                          })}
                        </div>
                      )}
                    </div>
                  )}
                </div>

                {selectedFormat && (
                  <div className="mt-4 border-2 border-black bg-white p-3">
                    <div className="text-[11px] font-bold uppercase tracking-widest text-black/50 mb-2">
                      Selected Format
                    </div>
                    <div className="flex items-center justify-between">
                      <div>
                        <div className="text-sm font-bold">{getFormatDescription(selectedFormat)}</div>
                        <div className="text-[11px] text-black/60">{getFormatTypeLabel(selectedFormat)} • {selectedFormat.ext.toUpperCase()}</div>
                      </div>
                      <button 
                        onClick={() => !isDownloading && setSelectedFormat(null)}
                        disabled={isDownloading}
                        className="text-black/40 hover:text-black disabled:opacity-50"
                      >
                        <X className="h-4 w-4" strokeWidth={2.5} />
                      </button>
                    </div>
                  </div>
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
                  disabled={!selectedFormat || isDownloading || dlPhase === "done"}
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
                  Direct download from CDN - Powered by yt-dlp metadata extraction.
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
