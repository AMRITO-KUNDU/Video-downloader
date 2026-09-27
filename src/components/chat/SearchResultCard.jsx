import { useState } from "react";
import { useNavigate } from "react-router-dom";
import { Image } from "@/components/ui/image";
import { Eye, Calendar, Clock, Play, Download, Bookmark } from "lucide-react";
import PlayerModal from "@/components/chat/PlayerModal";
import { base44 } from "@/api/base44Client";
import { useToast } from "@/components/ui/use-toast";
import { cn } from "@/lib/utils";

export default function SearchResultCard({ video }) {
  const [playing, setPlaying] = useState(false);
  const [saved, setSaved] = useState(false);
  const navigate = useNavigate();
  const { toast } = useToast();

  const save = async () => {
    if (saved) return;
    setSaved(true);
    try {
      await base44.entities.SavedVideo.create({
        video_id: video.videoId,
        title: video.title,
        channel: video.channel,
        thumbnail: video.thumbnail,
        url: video.url,
        duration: video.duration,
      });
      toast({ title: "Saved to Library" });
    } catch {
      setSaved(false);
      toast({ title: "Couldn't save", variant: "destructive" });
    }
  };

  return (
    <div className="nb-card overflow-hidden">
      <div className="flex flex-col sm:flex-row">
        <button
          type="button"
          onClick={() => setPlaying(true)}
          className="relative aspect-video w-full shrink-0 border-b-2 border-black bg-black sm:w-56 sm:border-b-0 sm:border-r-2"
        >
          <Image src={video.thumbnail} alt={video.title} className="h-full w-full" fittingType="fill" />
          <div className="absolute inset-0 grid place-items-center">
            <div className="grid h-9 w-9 place-items-center border-2 border-black bg-brand shadow-[3px_3px_0_0_#000]">
              <Play className="h-4 w-4 fill-black text-black" />
            </div>
          </div>
          <span className="absolute bottom-1.5 right-1.5 border-2 border-black bg-black px-1.5 py-0.5 text-[10px] font-bold text-white">
            {video.duration}
          </span>
        </button>

        <div className="flex flex-1 flex-col p-3.5">
          <h3 className="font-display text-base font-extrabold leading-snug text-black">{video.title}</h3>
          <div className="mt-0.5 text-sm font-bold text-black/70">{video.channel}</div>
          <div className="mt-1.5 flex flex-wrap gap-x-3 gap-y-0.5 text-[11px] font-semibold text-black/50">
            <span className="flex items-center gap-1"><Eye className="h-3 w-3" strokeWidth={2.5} />{video.views}</span>
            <span className="flex items-center gap-1"><Calendar className="h-3 w-3" strokeWidth={2.5} />{video.uploadDate}</span>
            <span className="flex items-center gap-1"><Clock className="h-3 w-3" strokeWidth={2.5} />{video.duration}</span>
          </div>
          <div className="mt-auto flex items-center gap-2 pt-3">
            <button onClick={() => setPlaying(true)} className="nb-btn flex-1 px-3 py-2 text-xs">
              <Play className="h-3.5 w-3.5 fill-black" strokeWidth={3} /> Watch
            </button>
            <button
              onClick={() => navigate(`/downloader?url=${encodeURIComponent(video.url)}`)}
              className="nb-btn flex-1 px-3 py-2 text-xs"
            >
              <Download className="h-3.5 w-3.5" strokeWidth={3} /> Download
            </button>
            <button
              onClick={save}
              title={saved ? "Saved" : "Save to Library"}
              className={cn(
                "grid h-8 w-8 shrink-0 place-items-center border-2 border-black nb-press",
                saved ? "bg-brand" : "bg-white"
              )}
            >
              <Bookmark className={cn("h-3.5 w-3.5", saved && "fill-black")} strokeWidth={2.5} />
            </button>
          </div>
        </div>
      </div>
      {playing && <PlayerModal video={video} onClose={() => setPlaying(false)} />}
    </div>
  );
}