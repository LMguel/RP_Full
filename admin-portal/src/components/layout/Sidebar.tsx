import { useMemo } from "react";
import { NavLink, useLocation } from "react-router-dom";
import {
  Building2,
  LayoutDashboard,
  LogOut,
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

export function Sidebar() {
  const { pathname } = useLocation();
  const { logout } = useAuth();

  const activeLabel = useMemo(() => {
    const current = navigationItems.find((item) => pathname.startsWith(item.to));
    return current?.label ?? "Dashboard";
  }, [pathname]);

  return (
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
  );
}
