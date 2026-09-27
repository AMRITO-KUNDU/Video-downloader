import { useEffect, useRef, useState } from "react";
import { useSearchParams } from "react-router-dom";
import { Sparkles } from "lucide-react";
import { base44 } from "@/api/base44Client";
import MobileTopBar from "@/components/layout/MobileTopBar";
import Composer from "@/components/chat/Composer";
import SuggestionChips from "@/components/chat/SuggestionChips";
import MessageBubble from "@/components/chat/MessageBubble";
import {
  fetchVideoInfo,
  searchYouTube,
  isVideoUrl,
  parseMinutesFilter,
} from "@/lib/videoService";

export default function Chat() {
  const [messages, setMessages] = useState([]);
  const [lastResults, setLastResults] = useState(null);
  const scrollRef = useRef(null);
  const ranRef = useRef(false);
  const [searchParams] = useSearchParams();

  useEffect(() => {
    scrollRef.current?.scrollTo({ top: scrollRef.current.scrollHeight, behavior: "smooth" });
  }, [messages]);

  const push = (m) => setMessages((prev) => [...prev, m]);
  const update = (id, patch) =>
    setMessages((prev) => prev.map((m) => (m.id === id ? { ...m, ...patch } : m)));

  const saveConversation = (payload) => {
    base44.entities.Conversation.create(payload).catch(() => {});
  };

  const handleSend = async (text) => {
    push({ id: Date.now(), role: "user", text });
    const id = Date.now() + 1;

    if (isVideoUrl(text)) {
      push({ id, role: "assistant", detecting: true });
      try {
        const video = await fetchVideoInfo(text);
        if (!video) throw new Error("not found");
        update(id, { detecting: false, text: "I found your video." });
        push({ id: id + 1, role: "assistant", video });
        setLastResults(null);
        saveConversation({
          query: text,
          kind: "link",
          reply: "I found your video.",
          results_count: 1,
          video_id: video.videoId,
          video_title: video.title,
          video_thumbnail: video.thumbnail,
          video_channel: video.channel,
        });
      } catch (e) {
        update(id, {
          detecting: false,
          text: "I couldn't fetch that video. Make sure it's a valid, public YouTube or Facebook link.",
        });
      }
      return;
    }

    const minFilter = parseMinutesFilter(text);
    if (minFilter != null && lastResults) {
      const filtered = lastResults.filter((v) => v.seconds <= minFilter * 60);
      push({ id, role: "assistant", text: `Here are the videos under ${minFilter} minutes.` });
      push({ id: id + 1, role: "assistant", results: filtered, noResults: filtered.length === 0 });
      return;
    }

    push({ id, role: "assistant", searching: true });
    try {
      const results = await searchYouTube(text);
      setLastResults(results);
      const reply = results.length
        ? `I found ${results.length} ${results.length === 1 ? "video" : "videos"} matching your search.`
        : "I couldn't find any videos for that.";
      update(id, { searching: false, text: reply });
      push({ id: id + 1, role: "assistant", results, noResults: results.length === 0 });
      saveConversation({
        query: text,
        kind: "search",
        reply,
        results_count: results.length,
        video_id: results[0]?.videoId,
        video_title: results[0]?.title,
        video_thumbnail: results[0]?.thumbnail,
        video_channel: results[0]?.channel,
      });
    } catch (e) {
      update(id, { searching: false, text: "Search hit a snag. Try again in a moment." });
    }
  };

  // Reopen a past search from History / Command palette via ?q=
  useEffect(() => {
    const q = searchParams.get("q");
    if (q && !ranRef.current && messages.length === 0) {
      ranRef.current = true;
      handleSend(q);
    }
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [searchParams]);

  const empty = messages.length === 0;

  return (
    <div className="flex h-full flex-col">
      <MobileTopBar />

      {empty ? (
        <div className="flex flex-1 flex-col items-center justify-center px-4 py-10">
          <div className="mb-5 flex items-center gap-2 border-2 border-black bg-brand px-3 py-1.5 text-xs font-bold uppercase tracking-widest shadow-[3px_3px_0_0_#000]">
            <Sparkles className="h-3.5 w-3.5" strokeWidth={2.5} /> Conversational video assistant
          </div>
          <h1 className="text-center font-display text-3xl font-extrabold leading-[1.1] text-black sm:text-5xl">
            What do you want to download today?
          </h1>
          <p className="mt-3 text-center text-base font-medium text-black/55 sm:text-lg">
            Paste a video link or describe what you're looking for.
          </p>
          <div className="mt-8 w-full max-w-3xl">
            <Composer onSend={handleSend} />
          </div>
          <div className="mt-6">
            <SuggestionChips onPick={handleSend} />
          </div>
        </div>
      ) : (
        <>
          <div ref={scrollRef} className="flex-1 overflow-y-auto scrollbar-nb">
            <div className="mx-auto w-full max-w-3xl space-y-6 px-4 py-6">
              {messages.map((m) => (
                <MessageBubble key={m.id} message={m} />
              ))}
            </div>
          </div>
          <div className="border-t-2 border-black bg-[#FAFAF7] px-4 py-4">
            <Composer onSend={handleSend} />
          </div>
        </>
      )}
    </div>
  );
}