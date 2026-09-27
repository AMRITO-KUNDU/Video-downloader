import { cn } from "@/lib/utils";

export default function Logo({ size = "md", showText = true, className }) {
  const sizes = {
    sm: { box: "h-7 w-7", text: "text-base", sub: "text-[9px]", tri: 7 },
    md: { box: "h-9 w-9", text: "text-lg", sub: "text-[10px]", tri: 9 },
    lg: { box: "h-12 w-12", text: "text-2xl", sub: "text-xs", tri: 12 },
  };
  const s = sizes[size];

  return (
    <div className={cn("flex items-center gap-2.5 select-none", className)}>
      <div
        className={cn(
          "relative grid place-items-center border-2 border-black bg-brand shadow-[3px_3px_0_0_#000]",
          s.box
        )}
      >
        <svg width={s.tri + 4} height={s.tri + 4} viewBox="0 0 24 24" fill="none">
          <path d="M8 5v14l11-7L8 5z" fill="#000" />
        </svg>
        <span className="absolute -bottom-1.5 -right-1.5 grid h-3.5 w-3.5 place-items-center border-2 border-black bg-black">
          <svg width="7" height="7" viewBox="0 0 24 24" fill="none">
            <path d="M12 3v12m0 0l-4-4m4 4l4-4M4 21h16" stroke="#C8F955" strokeWidth="4" strokeLinecap="square" strokeLinejoin="miter" />
          </svg>
        </span>
      </div>
      {showText && (
        <div className="leading-none">
          <div className={cn("font-display font-extrabold tracking-tight text-black", s.text)}>
            VIDGRAB
          </div>
          <div className={cn("font-display font-bold text-black/60 -mt-0.5", s.sub)}>
            2.0
          </div>
        </div>
      )}
    </div>
  );
}