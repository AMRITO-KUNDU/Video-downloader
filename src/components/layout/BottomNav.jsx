import { NavLink } from "react-router-dom";
import { MessageSquare, Download, Library, Settings } from "lucide-react";
import { cn } from "@/lib/utils";

const items = [
  { to: "/", label: "Chat", icon: MessageSquare, end: true },
  { to: "/downloader", label: "Download", icon: Download },
  { to: "/library", label: "Library", icon: Library },
  { to: "/settings", label: "Settings", icon: Settings },
];

export default function BottomNav() {
  return (
    <nav className="lg:hidden fixed bottom-0 inset-x-0 z-30 grid grid-cols-4 border-t-2 border-black bg-white">
      {items.map((item) => (
        <NavLink
          key={item.to}
          to={item.to}
          end={item.end}
          className={({ isActive }) =>
            cn(
              "flex flex-col items-center gap-1 py-2.5 text-[10px] font-bold uppercase tracking-wide transition-colors",
              isActive ? "bg-brand text-black" : "text-black/60"
            )
          }
        >
          <item.icon className="h-5 w-5" strokeWidth={2.5} />
          {item.label}
        </NavLink>
      ))}
    </nav>
  );
}