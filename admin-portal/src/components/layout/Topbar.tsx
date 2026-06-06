import { Menu } from "lucide-react";

export function Topbar({ title, onMenuClick }: { title: string; onMenuClick?: () => void }) {
  return (
    <header
      className="flex h-14 flex-shrink-0 items-center justify-between px-5 border-b"
      style={{
        background: "rgba(5,12,26,0.65)",
        borderColor: "rgba(255,255,255,0.07)",
        backdropFilter: "blur(20px)",
        WebkitBackdropFilter: "blur(20px)",
      }}
    >
      <div className="flex items-center gap-3">
        <button
          className="lg:hidden flex h-8 w-8 items-center justify-center rounded-lg text-white/45 hover:bg-white/[0.06] hover:text-white/80 transition-all"
          onClick={onMenuClick}
          aria-label="Abrir menu"
        >
          <Menu className="h-4.5 w-4.5" />
        </button>
        <h2 className="text-[15px] font-semibold text-white/80 tracking-[-0.01em]">{title}</h2>
      </div>

      <div className="flex items-center gap-2">
        <div
          className="flex h-8 w-8 items-center justify-center rounded-full text-[10px] font-bold text-white/70"
          style={{ background: "linear-gradient(135deg,#1d4ed8,#3b82f6)", fontSize: "9px" }}
        >
          ADM
        </div>
      </div>
    </header>
  );
}
