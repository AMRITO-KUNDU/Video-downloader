import { useState, useRef, useEffect } from "react";
import { ArrowUp, Mic, MicOff } from "lucide-react";
import { cn } from "@/lib/utils";

export default function Composer({ onSend, placeholder = "Paste a link or ask VidGrab..." }) {
  const [value, setValue] = useState("");
  const [listening, setListening] = useState(false);
  const [supported, setSupported] = useState(true);
  const ref = useRef(null);
  const recogRef = useRef(null);

  useEffect(() => {
    const SR = window.SpeechRecognition || window.webkitSpeechRecognition;
    if (!SR) {
      setSupported(false);
      return;
    }
    const r = new SR();
    r.continuous = false;
    r.interimResults = true;
    r.lang = "en-US";
    r.onresult = (e) => {
      let txt = "";
      for (let i = 0; i < e.results.length; i++) txt += e.results[i][0].transcript;
      setValue(txt);
    };
    r.onend = () => setListening(false);
    r.onerror = () => setListening(false);
    recogRef.current = r;
    return () => {
      try {
        r.abort();
      } catch {}
    };
  }, []);

  const toggleMic = () => {
    const r = recogRef.current;
    if (!r) return;
    if (listening) {
      r.stop();
      setListening(false);
      return;
    }
    setValue("");
    setListening(true);
    try {
      r.start();
    } catch {
      setListening(false);
    }
  };

  const submit = () => {
    const v = value.trim();
    if (!v) return;
    onSend(v);
    setValue("");
  };

  return (
    <div className="mx-auto w-full max-w-3xl">
      <div className="nb-card flex items-end gap-2 p-2">
        <textarea
          ref={ref}
          value={value}
          onChange={(e) => setValue(e.target.value)}
          onKeyDown={(e) => {
            if (e.key === "Enter" && !e.shiftKey) {
              e.preventDefault();
              submit();
            }
          }}
          rows={1}
          placeholder={listening ? "Listening…" : placeholder}
          className="max-h-40 min-h-[40px] flex-1 resize-none bg-transparent px-2 py-2.5 text-[15px] font-medium text-black placeholder:text-black/40 focus:outline-none"
        />
        <button
          onClick={toggleMic}
          disabled={!supported}
          title={supported ? (listening ? "Stop voice search" : "Voice search") : "Voice search not supported in this browser"}
          className={cn(
            "grid h-10 w-10 shrink-0 place-items-center border-2 border-black nb-press",
            !supported && "opacity-40",
            listening ? "bg-brand text-black shadow-[3px_3px_0_0_#000]" : "bg-white"
          )}
        >
          {listening ? (
            <MicOff className="h-4 w-4" strokeWidth={2.5} />
          ) : (
            <Mic className="h-4 w-4" strokeWidth={2.5} />
          )}
        </button>
        <button
          onClick={submit}
          disabled={!value.trim()}
          className={cn(
            "grid h-10 w-10 shrink-0 place-items-center border-2 border-black transition-all nb-press",
            value.trim() ? "bg-brand text-black shadow-[3px_3px_0_0_#000]" : "bg-black/10 text-black/30"
          )}
        >
          <ArrowUp className="h-5 w-5" strokeWidth={3} />
        </button>
      </div>
      <p className="mt-2 text-center text-[11px] font-medium text-black/40">
        VidGrab can search the web and find videos. Paste a link, type, or tap the mic.
      </p>
    </div>
  );
}