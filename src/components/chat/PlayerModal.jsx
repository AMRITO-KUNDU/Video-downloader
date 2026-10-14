import { X, ExternalLink } from "lucide-react";
import { extractYouTubeId, isFacebookUrl } from "@/lib/videoService";

export default function PlayerModal({ video, onClose }) {
  const url = video?.url || "";
  const ytId = video?.videoId || extractYouTubeId(url);
  const isFb = isFacebookUrl(url);
  const openLabel = isFb ? "Open on Facebook" : ytId ? "Open on YouTube" : "Open original";

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
          {ytId ? (
            <iframe
              src={`https://www.youtube-nocookie.com/embed/${ytId}?autoplay=1&rel=0`}
              title={video?.title}
              className="h-full w-full"
              allow="autoplay; encrypted-media; picture-in-picture; fullscreen"
              allowFullScreen
              frameBorder="0"
            />
          ) : isFb ? (
            // Facebook has no embed like YouTube, so play the real file through
            // our own proxy instead of showing a dead "no preview" message.
            <video
              src={`/api/stream?url=${encodeURIComponent(url)}`}
              title={video?.title}
              className="h-full w-full"
              controls
              autoPlay
              playsInline
            />
          ) : (
            <div className="grid h-full place-items-center px-4 text-center text-sm font-bold text-white/80">
              No embeddable preview for this link.
            </div>
          )}
        </div>

        <div className="flex items-center justify-between gap-2 border-t-2 border-black bg-white px-4 py-3">
          <span className="truncate text-sm font-bold text-black">{video?.channel}</span>
          {url && (
            <a
              href={url}
              target="_blank"
              rel="noreferrer"
              className="nb-btn-dark px-3 py-1.5 text-xs"
            >
              <ExternalLink className="h-3.5 w-3.5" strokeWidth={3} /> {openLabel}
            </a>
          )}
        </div>
      </div>
    </div>
  );
}