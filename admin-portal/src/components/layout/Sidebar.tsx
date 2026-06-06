import { NavLink, useLocation } from "react-router-dom";
import { Building2, LayoutDashboard, LogOut, X, Shield, Users, CloudCog } from "lucide-react";
import { cn } from "../../lib/utils";
import { useAuth } from "../../hooks/useAuth";

const nav = [
  { label: "Dashboard",  to: "/dashboard",  icon: LayoutDashboard, color: "#10b981" },
  { label: "Clientes",   to: "/clients",    icon: Users,           color: "#a78bfa" },
  { label: "Empresas",   to: "/companies",  icon: Building2,       color: "#3b82f6" },
  { label: "Gastos AWS", to: "/aws-costs",  icon: CloudCog,        color: "#f59e0b" },
];

const sidebarStyle = {
  background: "rgba(8,18,60,0.6)",
  backdropFilter: "blur(32px)",
  WebkitBackdropFilter: "blur(32px)",
  borderRight: "1px solid rgba(255,255,255,0.09)",
};

export function Sidebar({ isOpen, onClose }: { isOpen?: boolean; onClose?: () => void }) {
  const { pathname } = useLocation();
  const { logout } = useAuth();

  const content = (close?: () => void) => (
    <div className="flex h-full flex-col">
      {/* Brand */}
      <div className="flex items-center gap-3 px-5 py-6">
        <div className="flex h-9 w-9 flex-shrink-0 items-center justify-center rounded-[10px] bg-white shadow-[0_2px_12px_rgba(0,0,0,0.3)]">
          <Shield className="h-5 w-5 text-blue-700" />
        </div>
        <div>
          <p className="text-[14px] font-bold uppercase tracking-[0.04em] text-white leading-none">RP Control</p>
          <p className="text-[10.5px] text-white/38 mt-0.5">Central Administrativa</p>
        </div>
      </div>

      <div className="mx-4 h-px bg-white/[0.07]" />

      {/* Nav */}
      <nav className="flex-1 space-y-0.5 px-3 pt-4">
        <p className="mb-2 px-2 text-[9.5px] font-bold uppercase tracking-[0.11em] text-white/25">Navegação</p>
        {nav.map(({ label, to, icon: Icon, color }) => {
          const active = pathname === to || (to !== "/dashboard" && pathname.startsWith(to));
          return (
            <NavLink
              key={label}
              to={to}
              onClick={close}
              className={cn(
                "group relative flex items-center gap-3 rounded-[10px] px-3 py-2.5 text-[13.5px] font-medium transition-all border",
                active
                  ? "text-white border-solid"
                  : "text-white/52 border-transparent hover:text-white/85 hover:bg-white/[0.04] hover:border-white/[0.06]"
              )}
              style={active ? { background: `linear-gradient(90deg,${color}22 0%,${color}05 100%)`, borderColor: `${color}28` } : {}}
            >
              {active && (
                <span className="absolute left-0 top-[20%] bottom-[20%] w-[3px] rounded-r-full"
                  style={{ background: color, boxShadow: `0 0 8px ${color}80` }} />
              )}
              <Icon className="h-[18px] w-[18px] flex-shrink-0" style={active ? { color } : {}} />
              {label}
            </NavLink>
          );
        })}
      </nav>

      {/* Footer */}
      <div className="px-3 pb-5">
        <div className="mx-1 h-px bg-white/[0.07] mb-3" />
        <div className="flex items-center gap-3 rounded-[10px] border border-white/[0.08] bg-white/[0.04] px-3 py-2.5">
          <div className="flex h-7 w-7 flex-shrink-0 items-center justify-center rounded-full bg-gradient-to-br from-blue-500 to-indigo-600 text-[10px] font-bold text-white">
            ADM
          </div>
          <div className="min-w-0 flex-1">
            <p className="text-[12px] font-semibold text-white/85 leading-none">Administrador</p>
            <p className="mt-0.5 text-[10px] text-white/38">Sessão ativa</p>
          </div>
          <button
            onClick={() => { close?.(); logout(); }}
            title="Sair"
            className="flex h-7 w-7 items-center justify-center rounded-[7px] text-white/35 transition-all hover:bg-red-500/15 hover:text-red-400"
          >
            <LogOut className="h-3.5 w-3.5" />
          </button>
        </div>
      </div>
    </div>
  );

  return (
    <>
      {/* Desktop */}
      <aside className="hidden w-60 flex-shrink-0 lg:block" style={sidebarStyle}>
        {content()}
      </aside>

      {/* Mobile overlay */}
      <div
        className={cn("fixed inset-0 z-40 lg:hidden transition-opacity", isOpen ? "pointer-events-auto" : "pointer-events-none")}
        aria-hidden={!isOpen}
      >
        <div onClick={onClose}
          className={cn("absolute inset-0 bg-black/50 transition-opacity", isOpen ? "opacity-100" : "opacity-0")} />
        <aside
          className={cn("absolute left-0 top-0 h-full w-60 transform transition-transform", isOpen ? "translate-x-0" : "-translate-x-full")}
          style={{ ...sidebarStyle, background: "rgba(8,18,60,0.97)" }}
        >
          <button onClick={onClose}
            className="absolute right-3 top-3 flex h-7 w-7 items-center justify-center rounded-[7px] text-white/40 hover:bg-white/[0.07] hover:text-white/80 transition-all">
            <X className="h-4 w-4" />
          </button>
          {content(onClose)}
        </aside>
      </div>
    </>
  );
}
