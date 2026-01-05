import { useMemo } from "react";
import { NavLink, useLocation } from "react-router-dom";
import {
  Building2,
  LayoutDashboard,
  LogOut,
  X,
} from "lucide-react";

import { Button } from "../ui/button";
import { cn } from "../../lib/utils";
import { useAuth } from "../../hooks/useAuth";

const navigationItems = [
  {
    label: "Dashboard",
    to: "/dashboard",
    icon: LayoutDashboard,
  },
  {
    label: "Empresas",
    to: "/companies",
    icon: Building2,
  },
];

export function Sidebar({ isOpen, onClose }: { isOpen?: boolean; onClose?: () => void }) {
  const { pathname } = useLocation();
  const { logout } = useAuth();

  const activeLabel = useMemo(() => {
    const current = navigationItems.find((item) => pathname.startsWith(item.to));
    return current?.label ?? "Dashboard";
  }, [pathname]);

  return (
    <>
      {/* Desktop sidebar */}
      <aside className="hidden w-64 flex-col border-r bg-white/80 backdrop-blur lg:flex">
        <div className="px-6 py-8">
          <div className="space-y-2">
            <span className="text-xs uppercase tracking-wide text-muted-foreground">
              Admin
            </span>
            <h1 className="text-2xl font-semibold text-primary">RP Control Center</h1>
          </div>
        </div>
        <nav className="flex-1 space-y-1 px-3">
          {navigationItems.map(({ label, to, icon: Icon }) => (
            <NavLink
              key={label}
              to={to}
              className={({ isActive }) =>
                cn(
                  "group flex items-center gap-3 rounded-md px-3 py-2 text-sm font-medium transition-colors",
                  isActive
                    ? "bg-primary/10 text-primary"
                    : "text-muted-foreground hover:bg-muted hover:text-foreground"
                )
              }
            >
              <Icon className="h-4 w-4" />
              <span>{label}</span>
            </NavLink>
          ))}
        </nav>
        <div className="border-t px-4 py-6">
          <div className="mb-4 text-xs uppercase tracking-wide text-muted-foreground">
            Sessão ativa
          </div>
          <div className="flex items-center justify-between rounded-md border bg-muted/40 px-3 py-3">
            <div>
              <p className="text-sm font-medium text-foreground">Administrador</p>
              <p className="text-xs text-muted-foreground">{activeLabel}</p>
            </div>
            <Button variant="outline" size="sm" onClick={logout}>
              <LogOut className="h-4 w-4" />
            </Button>
          </div>
        </div>
      </aside>

      {/* Mobile drawer */}
      <div
        className={cn(
          "fixed inset-0 z-40 lg:hidden transition-opacity",
          isOpen ? "pointer-events-auto" : "pointer-events-none"
        )}
        aria-hidden={!isOpen}
      >
        {/* Backdrop */}
        <div
          onClick={onClose}
          className={cn(
            "absolute inset-0 bg-black/40 transition-opacity",
            isOpen ? "opacity-100" : "opacity-0"
          )}
        />

        {/* Drawer panel */}
        <aside
          className={cn(
            "absolute left-0 top-0 h-full w-64 bg-white/95 shadow-lg backdrop-blur transform transition-transform",
            isOpen ? "translate-x-0" : "-translate-x-full"
          )}
        >
          <div className="flex items-center justify-between px-4 py-3 border-b">
            <div>
              <h1 className="text-lg font-semibold">RP Control Center</h1>
              <p className="text-xs text-muted-foreground">Admin</p>
            </div>
            <Button variant="ghost" size="icon" onClick={onClose}>
              <X className="h-5 w-5" />
            </Button>
          </div>

          <nav className="flex-1 space-y-1 px-3 py-4">
            {navigationItems.map(({ label, to, icon: Icon }) => (
              <NavLink
                key={label}
                to={to}
                onClick={onClose}
                className={({ isActive }) =>
                  cn(
                    "group flex items-center gap-3 rounded-md px-3 py-2 text-sm font-medium transition-colors",
                    isActive
                      ? "bg-primary/10 text-primary"
                      : "text-muted-foreground hover:bg-muted hover:text-foreground"
                  )
                }
              >
                <Icon className="h-4 w-4" />
                <span>{label}</span>
              </NavLink>
            ))}
          </nav>

          <div className="border-t px-4 py-6">
            <div className="mb-4 text-xs uppercase tracking-wide text-muted-foreground">
              Sessão ativa
            </div>
            <div className="flex items-center justify-between rounded-md border bg-muted/40 px-3 py-3">
              <div>
                <p className="text-sm font-medium text-foreground">Administrador</p>
                <p className="text-xs text-muted-foreground">{activeLabel}</p>
              </div>
              <Button variant="outline" size="sm" onClick={() => { onClose?.(); logout(); }}>
                <LogOut className="h-4 w-4" />
              </Button>
            </div>
          </div>
        </aside>
      </div>
    </>
  );
}
