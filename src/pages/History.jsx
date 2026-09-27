import { useEffect, useState } from "react";
import { useNavigate } from "react-router-dom";
import { History as HistoryIcon, ChevronRight, Trash2 } from "lucide-react";
import { apiClient } from "@/api/apiClient";
import moment from "moment";
import MobileTopBar from "@/components/layout/MobileTopBar";

export default function History() {
  const navigate = useNavigate();
  const [items, setItems] = useState(null); // null = loading

  const load = () => {
    apiClient.entities.Conversation
      .list()
      .then((r) => setItems(r))
      .catch(() => setItems([]));
  };

  useEffect(() => {
    load();
  }, []);

  const clearAll = async () => {
    if (!items?.length) return;
    await Promise.all(items.map((item) => apiClient.entities.Conversation.delete(item.id)));
    setItems([]);
  };

  return (
    <div className="flex h-full flex-col">
      <MobileTopBar />
      <div className="flex-1 overflow-y-auto scrollbar-nb">
        <div className="mx-auto w-full max-w-3xl px-4 py-6 sm:px-6">
          <div className="flex items-end justify-between gap-3">
            <div>
              <h1 className="font-display text-3xl font-extrabold tracking-tight text-black sm:text-4xl">
                Search History
              </h1>
              <p className="mt-1 text-sm font-medium text-black/55">
                Reopen any past conversation.
              </p>
            </div>
            {items?.length > 0 && (
              <button onClick={clearAll} className="nb-btn px-3 py-2 text-xs">
                <Trash2 className="h-3.5 w-3.5" strokeWidth={2.5} /> Clear
              </button>
            )}
          </div>

          <div className="mt-6 space-y-3">
            {items === null && (
              <div className="nb-card p-4 text-sm font-medium text-black/55">
                Loading history…
              </div>
            )}

            {items !== null && items.length === 0 && (
              <div className="grid place-items-center border-2 border-dashed border-black bg-white py-16 text-center">
                <div className="grid h-14 w-14 place-items-center border-2 border-black bg-brand shadow-[4px_4px_0_0_#000]">
                  <HistoryIcon className="h-7 w-7" strokeWidth={2.5} />
                </div>
                <h3 className="mt-4 font-display text-xl font-extrabold">No history yet</h3>
                <p className="mt-1 text-sm font-medium text-black/55">
                  Your searches will show up here.
                </p>
              </div>
            )}

            {items?.map((h) => (
              <button
                key={h.id}
                onClick={() => navigate(`/?q=${encodeURIComponent(h.query)}`)}
                className="nb-card flex w-full items-center gap-3 p-3.5 text-left"
              >
                <div className="grid h-10 w-10 shrink-0 place-items-center border-2 border-black bg-brand shadow-[3px_3px_0_0_#000]">
                  <HistoryIcon className="h-5 w-5" strokeWidth={2.5} />
                </div>
                <div className="min-w-0 flex-1">
                  <div className="truncate font-display text-base font-extrabold">"{h.query}"</div>
                  <div className="mt-0.5 text-xs font-semibold text-black/55">
                    {moment(h.createdAt || h.created_date).fromNow()} • {h.results_count || 0} results
                  </div>
                </div>
                <ChevronRight className="h-5 w-5 shrink-0 text-black/40" strokeWidth={2.5} />
              </button>
            ))}
          </div>
        </div>
      </div>
    </div>
  );
}
