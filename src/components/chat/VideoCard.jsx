import { useState } from "react";
import { useNavigate } from "react-router-dom";
import { Image } from "@/components/ui/image";
import { Eye, Calendar, Clock, Play, Download, Bookmark } from "lucide-react";
import PlayerModal from "@/components/chat/PlayerModal";
import { apiClient } from "@/api/apiClient";
import { useToast } from "@/components/ui/use-toast";
import { cn } from "@/lib/utils";

export default function VideoCard({ video }) {
  const [playing, setPlaying] = useState(false);
  const [saved, setSaved] = useState(false);
  const navigate = useNavigate();
  const { toast } = useToast();

  const save = async () => {
    if (saved) return;
    setSaved(true);
    try {
      await apiClient.entities.SavedVideo.create({
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
      <button
        type="button"
        onClick={() => setPlaying(true)}
        className="relative block aspect-video w-full border-b-2 border-black bg-black"
      >
        <Image src={video.thumbnail} alt={video.title} className="h-full w-full" fittingType="fill" />
        <div className="absolute inset-0 grid place-items-center">
          <div className="grid h-14 w-14 place-items-center border-2 border-black bg-brand shadow-[4px_4px_0_0_#000]">
            <Play className="h-6 w-6 fill-black text-black" />
          </div>
        </div>
        <span className="absolute bottom-2 right-2 border-2 border-black bg-black px-2 py-0.5 text-xs font-bold text-white">
          {video.duration}
        </span>
      </button>
      <div className="p-4">
        <h3 className="font-display text-lg font-extrabold leading-tight text-black">{video.title}</h3>
        <div className="mt-1 text-sm font-bold text-black/70">{video.channel}</div>
        <div className="mt-2 flex flex-wrap gap-x-4 gap-y-1 text-xs font-semibold text-black/50">
          <span className="flex items-center gap-1"><Eye className="h-3.5 w-3.5" strokeWidth={2.5} />{video.views}</span>
          <span className="flex items-center gap-1"><Calendar className="h-3.5 w-3.5" strokeWidth={2.5} />{video.uploadDate}</span>
          <span className="flex items-center gap-1"><Clock className="h-3.5 w-3.5" strokeWidth={2.5} />{video.duration}</span>
        </div>
        <div className="mt-4 flex items-center gap-2">
          <button onClick={() => setPlaying(true)} className="nb-btn-dark flex-1 px-3 py-2.5 text-sm">
            <Play className="h-4 w-4 fill-black" strokeWidth={3} /> Play
          </button>
          <button
            onClick={() => navigate(`/downloader?url=${encodeURIComponent(video.url)}`)}
            className="nb-btn flex-1 px-3 py-2.5 text-sm"
          >
            <Download className="h-4 w-4" strokeWidth={3} /> Download
          </button>
          <button
            onClick={save}
            title={saved ? "Saved" : "Save to Library"}
            className={cn(
              "grid h-10 w-10 shrink-0 place-items-center border-2 border-black nb-press",
              saved ? "bg-brand" : "bg-white"
            )}
          >
            <Bookmark className={cn("h-4 w-4", saved && "fill-black")} strokeWidth={2.5} />
          </button>
        </div>
      </div>
      {playing && <PlayerModal video={video} onClose={() => setPlaying(false)} />}
    </div>
  );
}