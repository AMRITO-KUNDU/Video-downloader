import { useEffect, useState } from "react";
import { useSearchParams } from "react-router-dom";
import { Download, Link2, Loader2, ClipboardPaste, Film, Music } from "lucide-react";
import { Image } from "@/components/ui/image";
import MobileTopBar from "@/components/layout/MobileTopBar";
import { fetchVideoInfo, isVideoUrl, downloadVideo } from "@/lib/videoService";
import { useToast } from "@/components/ui/use-toast";
import { cn } from "@/lib/utils";

const QUALITIES = ["1080p", "720p", "480p", "360p"];

export default function Downloader() {
  const [searchParams] = useSearchParams();
  const [url, setUrl] = useState(searchParams.get("url") || "");
  const [video, setVideo] = useState(null);
  const [loading, setLoading] = useState(false);
  const [downloading, setDownloading] = useState(false);
  const [error, setError] = useState("");
  const [quality, setQuality] = useState("720p");
  const [format, setFormat] = useState("mp4");
  const { toast } = useToast();

  const handleFetch = async (override) => {
    const u = (override ?? url).trim();
    if (!u) return;
    if (!isVideoUrl(u)) {
      setError("Paste a valid YouTube or Facebook video link.");
      setVideo(null);
      return;
    }
    setError("");
    setLoading(true);
    setVideo(null);
    try {
      const v = await fetchVideoInfo(u);
      if (!v) throw new Error();
      setVideo(v);
    } catch {
      setError("Couldn't fetch that video. Make sure it's public.");
    } finally {
      setLoading(false);
    }
  };

  // If opened via ?url= (from a video card), auto-fetch
  useEffect(() => {
    const u = searchParams.get("url");
    if (u) {
      setUrl(u);
      handleFetch(u);
    }
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, []);

  const handleDownload = async () => {
    const targetUrl = video?.url || url;
    if (!targetUrl) return;

    setDownloading(true);
    try {
      const res = await downloadVideo({ url: targetUrl, format, quality });
      if (res?.success && res?.url) {
        const a = document.createElement("a");
        a.href = res.url;
        a.target = "_blank";
        a.download = `${video?.title || "video"}.${format}`;
        document.body.appendChild(a);
        a.click();
        document.body.removeChild(a);

        toast({
          title: "Download Started",
          description: `Preparing your ${format.toUpperCase()} (${quality}) file...`,
        });
      } else {
        throw new Error(res?.error || "Could not generate download link.");
      }
    } catch (err) {
      toast({
        variant: "destructive",
        title: "Download Error",
        description: err.message || "Failed to download video using yt-dlp backend.",
      });
    } finally {
      setDownloading(false);
    }
  };

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

          {error && (
            <div className="mt-3 border-2 border-black bg-white px-3 py-2.5 text-sm font-bold text-black shadow-[3px_3px_0_0_#000]">
              {error}
            </div>
          )}

          {loading && (
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

                <div className="mt-4">
                  <div className="mb-2 text-[11px] font-bold uppercase tracking-widest text-black/50">Format</div>
                  <div className="flex gap-2">
                    {[
                      { id: "mp4", label: "MP4", icon: Film },
                      { id: "mp3", label: "MP3", icon: Music },
                    ].map((f) => (
                      <button
                        key={f.id}
                        onClick={() => setFormat(f.id)}
                        className={cn(
                          "flex items-center gap-1.5 border-2 border-black px-3 py-2 text-xs font-bold uppercase nb-press",
                          format === f.id ? "bg-black text-white" : "bg-white"
                        )}
                      >
                        <f.icon className="h-3.5 w-3.5" strokeWidth={2.5} /> {f.label}
                      </button>
                    ))}
                  </div>
                </div>

                {format === "mp4" && (
                  <div className="mt-4">
                    <div className="mb-2 text-[11px] font-bold uppercase tracking-widest text-black/50">Quality</div>
                    <div className="flex flex-wrap gap-2">
                      {QUALITIES.map((q) => (
                        <button
                          key={q}
                          onClick={() => setQuality(q)}
                          className={cn(
                            "border-2 border-black px-3 py-2 text-xs font-bold uppercase nb-press",
                            quality === q ? "bg-brand shadow-[3px_3px_0_0_#000]" : "bg-white"
                          )}
                        >
                          {q}
                        </button>
                      ))}
                    </div>
                  </div>
                )}

                <button onClick={handleDownload} disabled={downloading} className="nb-btn-dark mt-5 w-full px-3 py-3 text-sm">
                  {downloading ? (
                    <Loader2 className="h-4 w-4 animate-spin" strokeWidth={3} />
                  ) : (
                    <Download className="h-4 w-4" strokeWidth={3} />
                  )}
                  {downloading ? "Extracting..." : `Download ${format === "mp3" ? "MP3" : quality}`}
                </button>
                <p className="mt-2 text-center text-[11px] font-medium text-black/45">
                  Powered by yt-dlp backend integration.
                </p>
              </div>
            </div>
          )}
        </div>
      </div>
    </div>
  );
}