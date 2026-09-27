import { Menu } from "lucide-react";
import Logo from "@/components/Logo";

export default function MobileTopBar({ onMenu }) {
  return (
    <header className="lg:hidden sticky top-0 z-20 flex items-center justify-between border-b-2 border-black bg-white px-3 py-2.5">
      <button
        onClick={onMenu}
        className="grid h-9 w-9 place-items-center border-2 border-black bg-white shadow-[2px_2px_0_0_#000] nb-press"
      >
        <Menu className="h-5 w-5" strokeWidth={2.5} />
      </button>
      <Logo size="sm" />
      <div className="h-9 w-9" />
    </header>
  );
}