import { useEffect, useState } from "react";
import { Play, Trash2, Bookmark, ExternalLink } from "lucide-react";
import { Image } from "@/components/ui/image";
import { base44 } from "@/api/base44Client";
import MobileTopBar from "@/components/layout/MobileTopBar";
import PlayerModal from "@/components/chat/PlayerModal";
import moment from "moment";

export default function Library() {
  const [items, setItems] = useState(null); // null = loading
  const [playItem, setPlayItem] = useState(null);

  const load = () => {
    base44.entities.SavedVideo
      .list("-created_date", 100)
      .then((r) => setItems(r))
      .catch(() => setItems([]));
  };

  useEffect(() => {
    load();
  }, []);

  const remove = async (id) => {
    setItems((prev) => (prev ? prev.filter((i) => i.id !== id) : prev));
    await base44.entities.SavedVideo.delete(id).catch(() => {});
  };

  return (
    <div className="flex h-full flex-col">
      <MobileTopBar />
      <div className="flex-1 overflow-y-auto scrollbar-nb">
        <div className="mx-auto w-full max-w-5xl px-4 py-6 sm:px-6">
          <h1 className="font-display text-3xl font-extrabold tracking-tight text-black sm:text-4xl">
            Library
          </h1>
          <p className="mt-1 text-sm font-medium text-black/55">Videos you've saved to watch later.</p>

          {items === null && (
            <div className="mt-6 nb-card p-4 text-sm font-medium text-black/55">Loading…</div>
          )}

          {items !== null && items.length === 0 && (
            <div className="mt-10 grid place-items-center border-2 border-dashed border-black bg-white py-20 text-center">
              <div className="grid h-14 w-14 place-items-center border-2 border-black bg-brand shadow-[4px_4px_0_0_#000]">
                <Bookmark className="h-7 w-7" strokeWidth={2.5} />
              </div>
              <h3 className="mt-4 font-display text-xl font-extrabold">Nothing saved yet</h3>
              <p className="mt-1 text-sm font-medium text-black/55">
                Tap the bookmark on any video to save it here.
              </p>
            </div>
          )}

          {items !== null && items.length > 0 && (
            <div className="mt-6 grid gap-3 sm:grid-cols-2">
              {items.map((item) => (
                <div key={item.id} className="nb-card flex overflow-hidden">
                  <button
                    type="button"
                    onClick={() => setPlayItem(item)}
                    className="relative aspect-video w-28 shrink-0 border-r-2 border-black bg-black sm:w-36"
                  >
                    <Image src={item.thumbnail} alt={item.title} className="h-full w-full" fittingType="fill" />
                  </button>
                  <div className="flex min-w-0 flex-1 flex-col p-3">
                    <h3 className="truncate font-display text-sm font-extrabold leading-tight">{item.title}</h3>
                    <div className="mt-0.5 truncate text-xs font-bold text-black/60">{item.channel}</div>
                    <div className="mt-1 text-[11px] font-medium text-black/45">
                      {moment(item.created_date).fromNow()}
                    </div>
                    <div className="mt-auto flex items-center gap-2 pt-2">
                      <button onClick={() => setPlayItem(item)} className="nb-btn flex-1 px-2 py-1.5 text-[11px]">
                        <Play className="h-3 w-3 fill-black" strokeWidth={2.5} /> Watch
                      </button>
                      <a
                        href={item.url}
                        target="_blank"
                        rel="noreferrer"
                        className="grid h-8 w-8 place-items-center border-2 border-black bg-white nb-press"
                        title="Open on YouTube"
                      >
                        <ExternalLink className="h-3.5 w-3.5" strokeWidth={2.5} />
                      </a>
                      <button
                        onClick={() => remove(item.id)}
                        className="grid h-8 w-8 place-items-center border-2 border-black bg-white nb-press"
                        title="Remove"
                      >
                        <Trash2 className="h-3.5 w-3.5" strokeWidth={2.5} />
                      </button>
                    </div>
                  </div>
                </div>
              ))}
            </div>
          )}
        </div>
      </div>

      {playItem && (
        <PlayerModal
          video={{
            videoId: playItem.video_id,
            title: playItem.title,
            channel: playItem.channel,
            url: playItem.url,
            thumbnail: playItem.thumbnail,
            duration: playItem.duration,
          }}
          onClose={() => setPlayItem(null)}
        />
      )}
    </div>
  );
}