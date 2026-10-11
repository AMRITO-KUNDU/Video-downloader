import { useState } from "react";
import { cn } from "@/lib/utils";
import { useAuth } from "@/lib/AuthContext";
import MobileTopBar from "@/components/layout/MobileTopBar";

function Toggle({ on, onClick }) {
  return (
    <button
      onClick={onClick}
      className={cn(
        "relative h-8 w-16 shrink-0 border-2 border-black transition-colors",
        on ? "bg-brand" : "bg-white"
      )}
    >
      <span
        className={cn(
          "absolute top-0.5 h-6 w-6 border-2 border-black bg-black transition-all",
          on ? "left-7" : "left-0.5"
        )}
      />
    </button>
  );
}

export default function Settings() {
  const [s, setS] = useState(() => {
    try { return JSON.parse(localStorage.getItem("vg_settings")) || { notifications: true, darkThumbs: true }; } catch { return { notifications: true, darkThumbs: true }; }
  });
  const { user, logout } = useAuth();
  const toggle = (k) => setS((p) => {
    const next = { ...p, [k]: !p[k] };
    localStorage.setItem("vg_settings", JSON.stringify(next));
    return next;
  });

  const name = user?.full_name || (user?.email ? user.email.split("@")[0] : "Guest");
  const initials = (name[0] || "G").toUpperCase();

  return (
    <div className="flex h-full flex-col">
      <MobileTopBar />
      <div className="flex-1 overflow-y-auto scrollbar-nb">
        <div className="mx-auto w-full max-w-2xl px-4 py-6 sm:px-6">
          <h1 className="font-display text-3xl font-extrabold tracking-tight text-black sm:text-4xl">
            Settings
          </h1>
          <p className="mt-1 text-sm font-medium text-black/55">Tune VidGrab to your taste.</p>

          <div className="mt-4 nb-card p-4">
            <h2 className="font-display text-lg font-extrabold">Notifications</h2>
            <div className="mt-4 space-y-4">
              <Row
                label="Download complete alerts"
                desc="Ping me when a video is ready."
                on={s.notifications}
                onClick={() => toggle("notifications")}
              />
            </div>
          </div>

          <div className="mt-4 nb-card p-4">
            <h2 className="font-display text-lg font-extrabold">Appearance</h2>
            <div className="mt-4 space-y-4">
              <Row
                label="Dark thumbnails"
                desc="Letterbox thumbnails in the chat."
                on={s.darkThumbs}
                onClick={() => toggle("darkThumbs")}
              />
            </div>
          </div>

          <div className="mt-4 nb-card p-4">
            <h2 className="font-display text-lg font-extrabold">Account</h2>
            <div className="mt-3 flex items-center gap-3 border-2 border-black bg-brand p-3 shadow-[3px_3px_0_0_#000]">
              <div className="grid h-10 w-10 place-items-center border-2 border-black bg-black text-sm font-bold text-brand">
                {initials}
              </div>
              <div className="min-w-0">
                <div className="truncate text-sm font-bold">{name}</div>
                <div className="truncate text-xs font-medium text-black/60">
                  {user?.email || "Signed in"}
                </div>
              </div>
            </div>
            <button
              onClick={() => logout()}
              className="nb-btn-dark mt-3 w-full px-3 py-2.5 text-sm"
            >
              Sign out
            </button>
          </div>
        </div>
      </div>
    </div>
  );
}

function Row({ label, desc, on, onClick }) {
  return (
    <div className="flex items-center justify-between gap-4">
      <div>
        <div className="text-sm font-bold">{label}</div>
        <div className="text-xs font-medium text-black/55">{desc}</div>
      </div>
      <Toggle on={on} onClick={onClick} />
    </div>
  );
}
