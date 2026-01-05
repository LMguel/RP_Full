import { Outlet, useLocation } from "react-router-dom";
import { useEffect, useState } from "react";

import { Sidebar } from "./Sidebar";
import { Topbar } from "./Topbar";

const TITLES: Record<string, string> = {
  "/dashboard": "Visão Geral",
  "/companies": "Empresas",
  "/companies/create": "Cadastrar Empresa",
};

export function AppLayout() {
  const location = useLocation();

  const [mobileOpen, setMobileOpen] = useState(false);

  const titleKey = Object.keys(TITLES).find((path) =>
    location.pathname.startsWith(path)
  );

  useEffect(() => {
    // Close mobile sidebar on route change
    setMobileOpen(false);
  }, [location.pathname]);

  return (
    <div className="flex h-screen w-full bg-muted/20">
      <Sidebar isOpen={mobileOpen} onClose={() => setMobileOpen(false)} />
      <div className="flex flex-1 flex-col">
        <Topbar
          title={titleKey ? TITLES[titleKey] : "Área Administrativa"}
          onMenuClick={() => setMobileOpen((s) => !s)}
        />
        <main className="flex-1 overflow-y-auto bg-muted/30 p-6">
          <div className="mx-auto w-full max-w-7xl">
            <Outlet />
          </div>
        </main>
      </div>
    </div>
  );
}
