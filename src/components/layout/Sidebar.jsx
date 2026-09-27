import { useEffect, useState } from "react";
import { NavLink, useNavigate } from "react-router-dom";
import { Plus, MessageSquare, Library, History, Settings, Search, Download } from "lucide-react";
import Logo from "@/components/Logo";
import { base44 } from "@/api/base44Client";
import { useAuth } from "@/lib/AuthContext";
import { cn } from "@/lib/utils";

const nav = [
  { to: "/", label: "Chat", icon: MessageSquare, end: true },
  { to: "/downloader", label: "Downloader", icon: Download },
  { to: "/library", label: "Library", icon: Library },
  { to: "/history", label: "History", icon: History },
  { to: "/settings", label: "Settings", icon: Settings },
];

export default function Sidebar({ onNewSearch }) {
  const navigate = useNavigate();
  const { user } = useAuth();
  const [recent, setRecent] = useState([]);

  useEffect(() => {
    base44.entities.Conversation.list("-created_date", 6).then(setRecent).catch(() => {});
  }, []);

  const name = user?.full_name || (user?.email ? user.email.split("@")[0] : "Guest");
  const initials = (name[0] || "G").toUpperCase();

  return (
    <aside className="hidden lg:flex w-64 shrink-0 flex-col border-r-2 border-black bg-white">
      <div className="border-b-2 border-black p-4">
        <Logo />
      </div>

      <div className="p-3">
        <button
          onClick={() => {
            onNewSearch?.();
            navigate("/");
          }}
          className="nb-btn-dark w-full px-3 py-2.5 text-sm"
        >
          <Plus className="h-4 w-4" strokeWidth={3} /> New search
        </button>
      </div>

      <nav className="flex flex-col gap-1 px-3">
        {nav.map((item) => (
          <NavLink
            key={item.to}
            to={item.to}
            end={item.end}
            className={({ isActive }) =>
              cn(
                "flex items-center gap-3 border-2 border-transparent px-3 py-2.5 text-sm font-bold uppercase tracking-wide transition-all",
                isActive
                  ? "border-black bg-brand text-black shadow-[3px_3px_0_0_#000]"
                  : "text-black/70 hover:border-black hover:bg-black/5"
              )
            }
          >
            <item.icon className="h-4 w-4" strokeWidth={2.5} />
            {item.label}
          </NavLink>
        ))}
      </nav>

      <div className="mt-5 flex-1 overflow-y-auto scrollbar-nb px-3">
        <div className="mb-2 flex items-center gap-2 px-1">
          <Search className="h-3.5 w-3.5 text-black/50" strokeWidth={2.5} />
          <span className="text-[11px] font-bold uppercase tracking-widest text-black/50">Recent</span>
        </div>
        <div className="flex flex-col gap-1.5">
          {recent.length === 0 && (
            <div className="px-3 py-2 text-sm font-medium text-black/40">No searches yet.</div>
          )}
          {recent.map((c) => (
            <button
              key={c.id}
              onClick={() => navigate(`/?q=${encodeURIComponent(c.query)}`)}
              className="truncate border-2 border-transparent px-3 py-2 text-left text-sm font-medium text-black/70 transition-colors hover:border-black hover:bg-black/5"
            >
              {c.query}
            </button>
          ))}
        </div>
      </div>

      <div className="border-t-2 border-black p-3">
        <div className="flex items-center gap-3 border-2 border-black bg-brand p-2.5 shadow-[3px_3px_0_0_#000]">
          <div className="grid h-9 w-9 place-items-center border-2 border-black bg-black text-sm font-bold text-brand">
            {initials}
          </div>
          <div className="min-w-0 leading-tight">
            <div className="truncate text-sm font-bold text-black">{name}</div>
            <div className="truncate text-[11px] font-medium text-black/60">
              {user?.email || "Signed in"}
            </div>
          </div>
        </div>
      </div>
    </aside>
  );
}