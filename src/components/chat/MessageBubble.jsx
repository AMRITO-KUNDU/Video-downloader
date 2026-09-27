import { cn } from "@/lib/utils";
import ReactMarkdown from "react-markdown";
import VideoCard from "@/components/chat/VideoCard";
import SearchResultCard from "@/components/chat/SearchResultCard";

function Avatar({ who }) {
  if (who === "user") {
    return (
      <div className="grid h-9 w-9 shrink-0 place-items-center border-2 border-black bg-black text-xs font-bold text-brand">
        AK
      </div>
    );
  }
  return (
    <div className="grid h-9 w-9 shrink-0 place-items-center border-2 border-black bg-brand shadow-[3px_3px_0_0_#000]">
      <svg width="16" height="16" viewBox="0 0 24 24" fill="none">
        <path d="M8 5v14l11-7L8 5z" fill="#000" />
      </svg>
    </div>
  );
}

export default function MessageBubble({ message }) {
  const isUser = message.role === "user";

  return (
    <div className={cn("flex gap-3", isUser && "flex-row-reverse")}>
      <Avatar who={message.role} />
      <div className={cn("min-w-0 flex-1 space-y-3", isUser && "flex flex-col items-end")}>
        {message.text && (
          <div
            className={cn(
              "inline-block border-2 border-black px-4 py-2.5 text-[15px] font-medium leading-relaxed shadow-[4px_4px_0_0_#000]",
              isUser ? "bg-black text-white" : "bg-white text-black"
            )}
          >
            {isUser ? (
              message.text
            ) : (
              <div className="space-y-2 [&_a]:font-bold [&_a]:underline [&_ul]:list-disc [&_ul]:pl-5 [&_ol]:list-decimal [&_ol]:pl-5 [&_li]:my-0.5 [&_h1]:font-display [&_h1]:text-lg [&_h1]:font-extrabold [&_h2]:font-display [&_h2]:font-extrabold [&_strong]:font-bold">
                <ReactMarkdown
                  components={{
                    a: ({ node, ...p }) => <a {...p} target="_blank" rel="noreferrer" />,
                    ul: (p) => <ul className="list-disc pl-5" {...p} />,
                    ol: (p) => <ol className="list-decimal pl-5" {...p} />,
                  }}
                >
                  {message.text}
                </ReactMarkdown>
              </div>
            )}
          </div>
        )}
        {message.video && <VideoCard video={message.video} />}
        {message.results && (
          <div className="space-y-3">
            {message.results.map((v) => (
              <SearchResultCard key={v.id} video={v} />
            ))}
          </div>
        )}
        {message.searching && (
          <div className="inline-flex items-center gap-2 border-2 border-black bg-white px-4 py-2.5 text-sm font-bold uppercase tracking-wide shadow-[4px_4px_0_0_#000]">
            <span className="flex gap-1">
              <span className="h-2 w-2 animate-bounce bg-black [animation-delay:-0.2s]" />
              <span className="h-2 w-2 animate-bounce bg-black [animation-delay:-0.1s]" />
              <span className="h-2 w-2 animate-bounce bg-black" />
            </span>
            Searching the web…
          </div>
        )}
        {message.detecting && (
          <div className="inline-flex items-center gap-2 border-2 border-black bg-white px-4 py-2.5 text-sm font-bold uppercase tracking-wide shadow-[4px_4px_0_0_#000]">
            Detecting video…
          </div>
        )}
        {message.noResults && (
          <div className="inline-block border-2 border-black bg-white px-4 py-3 text-sm font-medium shadow-[4px_4px_0_0_#000]">
            No videos matched that. Try rephrasing or paste a direct link.
          </div>
        )}
      </div>
    </div>
  );
}