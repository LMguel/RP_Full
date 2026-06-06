import { Outlet, useLocation } from "react-router-dom";
import { useEffect, useState } from "react";
import { Sidebar } from "./Sidebar";
import { Topbar } from "./Topbar";

const TITLES: Record<string, string> = {
  "/dashboard": "Visão Geral",
  "/clients": "Clientes",
  "/companies": "Empresas",
  "/companies/create": "Cadastrar Empresa",
  "/aws-costs": "Gastos AWS",
};

export function AppLayout() {
  const location = useLocation();
  const [mobileOpen, setMobileOpen] = useState(false);

  const titleKey = Object.keys(TITLES).find((p) => location.pathname.startsWith(p));

  useEffect(() => { setMobileOpen(false); }, [location.pathname]);

  return (
    <div
      className="flex h-screen w-full overflow-hidden"
      style={{ background: "linear-gradient(158deg,#050c1a 0%,#081020 35%,#0a1530 65%,#071220 100%)", backgroundAttachment: "fixed" }}
    >
      <Sidebar isOpen={mobileOpen} onClose={() => setMobileOpen(false)} />
      <div className="flex flex-1 flex-col min-w-0">
        <Topbar
          title={titleKey ? TITLES[titleKey] : "Área Administrativa"}
          onMenuClick={() => setMobileOpen((s) => !s)}
        />
        <main className="flex-1 overflow-y-auto p-6">
          <div className="mx-auto w-full max-w-7xl">
            <Outlet />
          </div>
        </main>
      </div>
    </div>
  );
}
