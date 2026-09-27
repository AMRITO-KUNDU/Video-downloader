import { X, ExternalLink } from "lucide-react";
import { extractYouTubeId } from "@/lib/videoService";

export default function PlayerModal({ video, onClose }) {
  const id = video?.videoId || extractYouTubeId(video?.url || "");

  return (
    <div
      className="fixed inset-0 z-50 grid place-items-center bg-black/70 p-4"
      onClick={onClose}
    >
      <div
        className="nb-card w-full max-w-3xl overflow-hidden"
        onClick={(e) => e.stopPropagation()}
      >
        <div className="flex items-center justify-between gap-3 border-b-2 border-black bg-white px-4 py-3">
          <h3 className="truncate font-display text-base font-extrabold text-black">
            {video?.title}
          </h3>
          <button
            onClick={onClose}
            className="grid h-9 w-9 shrink-0 place-items-center border-2 border-black bg-white nb-press"
          >
            <X className="h-4 w-4" strokeWidth={3} />
          </button>
        </div>

        <div className="aspect-video w-full bg-black">
          {id ? (
            <iframe
              src={`https://www.youtube-nocookie.com/embed/${id}?autoplay=1&rel=0`}
              title={video?.title}
              className="h-full w-full"
              allow="autoplay; encrypted-media; picture-in-picture; fullscreen"
              allowFullScreen
              frameBorder="0"
            />
          ) : (
            <div className="grid h-full place-items-center px-4 text-center text-sm font-bold text-white/80">
              No embeddable preview for this link. Open it on YouTube to watch.
            </div>
          )}
        </div>

        <div className="flex items-center justify-between gap-2 border-t-2 border-black bg-white px-4 py-3">
          <span className="truncate text-sm font-bold text-black">{video?.channel}</span>
          <a
            href={video?.url}
            target="_blank"
            rel="noreferrer"
            className="nb-btn-dark px-3 py-1.5 text-xs"
          >
            <ExternalLink className="h-3.5 w-3.5" strokeWidth={3} /> Open on YouTube
          </a>
        </div>
      </div>
    </div>
  );
}