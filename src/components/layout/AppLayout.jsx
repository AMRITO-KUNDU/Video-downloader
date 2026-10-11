import { useCallback, useEffect, useState } from "react";
import { Outlet, useNavigate } from "react-router-dom";
import Sidebar from "@/components/layout/Sidebar";
import BottomNav from "@/components/layout/BottomNav";
import CommandPalette from "@/components/CommandPalette";
import { ChatResetContext } from "@/context/ChatResetContext";

export default function AppLayout() {
  const navigate = useNavigate();
  const [paletteOpen, setPaletteOpen] = useState(false);
  const [resetKey, setResetKey] = useState(0);

  const onNewSearch = useCallback(() => {
    setResetKey((k) => k + 1);
    navigate("/");
  }, [navigate]);

  useEffect(() => {
    const onKey = (e) => {
      if ((e.metaKey || e.ctrlKey) && e.key.toLowerCase() === "k") {
        e.preventDefault();
        setPaletteOpen((o) => !o);
      }
    };
    window.addEventListener("keydown", onKey);
    return () => window.removeEventListener("keydown", onKey);
  }, []);

  return (
    <ChatResetContext.Provider value={{ onNewSearch, resetKey }}>
      <div className="flex h-[100dvh] w-full overflow-hidden bg-[#FAFAF7]">
        <Sidebar onNewSearch={onNewSearch} />
        <main className="flex-1 min-w-0 pb-16 lg:pb-0">
          <Outlet />
        </main>
        <BottomNav />
        <CommandPalette open={paletteOpen} onOpenChange={setPaletteOpen} />
      </div>
    </ChatResetContext.Provider>
  );
}