import { useEffect, useState } from "react";
import { Plus, Eye, Pause, Play, Trash, Users, Search } from "lucide-react";
import { useNavigate } from "react-router-dom";
import { toast } from "sonner";
import { fetchCompanies, type CompanySummary } from "../../services/api";

const statusLabel: Record<string, string> = {
  active: "Ativa", suspended: "Suspensa", inactive: "Inativa", deleted: "Excluída",
};
const statusStyle: Record<string, string> = {
  active: "bg-emerald-500/15 text-emerald-400 border-emerald-500/25",
  suspended: "bg-amber-500/15 text-amber-400 border-amber-500/25",
  inactive: "bg-white/[0.06] text-white/35 border-white/[0.1]",
  deleted: "bg-red-500/15 text-red-400 border-red-500/25",
};

function Skeleton({ className }: { className?: string }) {
  return <div className={`animate-pulse rounded-xl ${className}`} style={{ background: "rgba(255,255,255,0.06)" }} />;
}

export function CompaniesPage() {
  const navigate = useNavigate();
  const [companies, setCompanies] = useState<CompanySummary[]>([]);
  const [loading, setLoading] = useState(true);
  const [search, setSearch] = useState("");
  const [month, setMonth] = useState(() => {
    const n = new Date();
    return `${n.getFullYear()}-${String(n.getMonth() + 1).padStart(2, "0")}`;
  });

  useEffect(() => {
    fetchCompanies()
      .then(setCompanies)
      .catch(() => toast.error("Falha ao buscar empresas."))
      .finally(() => setLoading(false));
  }, []);

  const filtered = companies.filter((c) =>
    c.companyName.toLowerCase().includes(search.toLowerCase())
  );

  const isPaid = (c: CompanySummary) => c.payments?.[month] === true;

  const handleAction = (label: string, company: CompanySummary) => {
    toast.info(`${label}: ${company.companyName} — em desenvolvimento`);
  };

  return (
    <div className="space-y-5">

      {/* header */}
      <div className="flex flex-col sm:flex-row sm:items-end justify-between gap-4">
        <div>
          <h1 className="text-[28px] font-bold text-white leading-none tracking-tight">Empresas</h1>
          <p className="mt-1 text-[13px] text-white/38">
            {companies.length} empresa{companies.length !== 1 ? "s" : ""} · gestão e controle
          </p>
        </div>
        <button
          onClick={() => navigate("/companies/create")}
          className="flex items-center gap-2 px-4 py-2.5 rounded-xl text-[13px] font-semibold text-white transition-all hover:opacity-90 active:scale-95 self-start sm:self-auto"
          style={{ background: "linear-gradient(90deg,#1d4ed8,#3b82f6)" }}
        >
          <Plus className="h-4 w-4" />
          Cadastrar Empresa
        </button>
      </div>

      {/* filters */}
      <div
        className="flex flex-col sm:flex-row gap-3 rounded-2xl border border-white/[0.07] p-4"
        style={{ background: "rgba(255,255,255,0.03)" }}
      >
        <div className="relative flex-1">
          <Search className="absolute left-3 top-1/2 -translate-y-1/2 h-4 w-4 text-white/28 pointer-events-none" />
          <input
            value={search}
            onChange={(e) => setSearch(e.target.value)}
            placeholder="Buscar por nome da empresa..."
            className="w-full bg-white/[0.05] border border-white/[0.08] rounded-xl pl-9 pr-3 py-2.5 text-[13px] text-white placeholder-white/22 focus:outline-none focus:border-blue-500/50 transition-all"
          />
        </div>
        <input
          type="month"
          value={month}
          onChange={(e) => setMonth(e.target.value)}
          className="bg-white/[0.05] border border-white/[0.08] rounded-xl px-3 py-2.5 text-[13px] text-white/65 focus:outline-none focus:border-blue-500/50 transition-all"
        />
      </div>

      {/* table */}
      <div
        className="rounded-2xl border border-white/[0.07] overflow-hidden"
        style={{ background: "rgba(255,255,255,0.025)" }}
      >
        <div className="px-5 py-3.5 border-b border-white/[0.06] flex items-center justify-between">
          <p className="text-[13px] font-semibold text-white/65">
            Lista de Empresas
          </p>
          <span className="text-[11.5px] text-white/30">{filtered.length} de {companies.length}</span>
        </div>

        <div className="overflow-x-auto">
          <table className="w-full text-[13px]">
            <thead>
              <tr className="border-b border-white/[0.05]">
                {["ID", "Nome", "Email", "Status", "Pagamento", "Funcionários", "Criação", ""].map((h) => (
                  <th key={h} className="px-5 py-3 text-left text-[10.5px] font-bold uppercase tracking-[0.08em] text-white/25">
                    {h}
                  </th>
                ))}
              </tr>
            </thead>
            <tbody>
              {loading ? (
                Array.from({ length: 4 }).map((_, i) => (
                  <tr key={i}>
                    <td colSpan={8} className="px-5 py-3">
                      <Skeleton className="h-8 w-full" />
                    </td>
                  </tr>
                ))
              ) : filtered.length === 0 ? (
                <tr>
                  <td colSpan={8} className="px-5 py-12 text-center text-white/25 text-[13px]">
                    {companies.length === 0 ? "Nenhuma empresa cadastrada." : "Nenhuma empresa encontrada."}
                  </td>
                </tr>
              ) : (
                filtered.map((c, i) => {
                  const paid = isPaid(c);
                  return (
                    <tr
                      key={c.companyId}
                      className={`border-b border-white/[0.04] hover:bg-white/[0.02] transition-colors ${i % 2 === 1 ? "bg-white/[0.01]" : ""}`}
                    >
                      <td className="px-5 py-3.5">
                        <span className="font-mono text-[11px] text-white/30">{c.companyId.slice(0, 8)}…</span>
                      </td>
                      <td className="px-5 py-3.5">
                        <p className="font-semibold text-white/85">{c.companyName}</p>
                      </td>
                      <td className="px-5 py-3.5 text-white/50 text-[12.5px]">{c.email}</td>
                      <td className="px-5 py-3.5">
                        <span className={`inline-flex items-center rounded-full border px-2.5 py-0.5 text-[11px] font-medium ${statusStyle[c.status] ?? statusStyle.inactive}`}>
                          {statusLabel[c.status] ?? c.status}
                        </span>
                      </td>
                      <td className="px-5 py-3.5">
                        <span className={`inline-flex items-center rounded-full border px-2.5 py-0.5 text-[11px] font-medium ${paid ? "bg-emerald-500/15 text-emerald-400 border-emerald-500/25" : "bg-white/[0.06] text-white/35 border-white/[0.09]"}`}>
                          {paid ? "Pago" : "Pendente"}
                        </span>
                      </td>
                      <td className="px-5 py-3.5">
                        <button
                          onClick={() => navigate(`/companies/${c.companyId}`)}
                          className="inline-flex items-center gap-1.5 px-2.5 py-1 rounded-lg text-[12px] font-medium text-blue-400/80 bg-blue-500/10 border border-blue-500/15 hover:bg-blue-500/18 transition-all"
                        >
                          <Users className="h-3.5 w-3.5" />
                          {c.activeEmployees}/{c.expectedEmployees || 0}
                        </button>
                      </td>
                      <td className="px-5 py-3.5 text-white/35 text-[12px]">
                        {c.dateCreated ? new Date(c.dateCreated).toLocaleDateString("pt-BR") : "—"}
                      </td>
                      <td className="px-5 py-3.5">
                        <div className="flex items-center justify-end gap-1">
                          <button
                            onClick={() => navigate(`/companies/${c.companyId}`)}
                            title="Ver detalhes"
                            className="flex h-7 w-7 items-center justify-center rounded-lg text-white/28 hover:bg-blue-500/15 hover:text-blue-400 transition-all"
                          >
                            <Eye className="h-3.5 w-3.5" />
                          </button>
                          {c.status === "active" ? (
                            <button
                              onClick={() => handleAction("Suspender", c)}
                              title="Suspender"
                              className="flex h-7 w-7 items-center justify-center rounded-lg text-white/28 hover:bg-amber-500/15 hover:text-amber-400 transition-all"
                            >
                              <Pause className="h-3.5 w-3.5" />
                            </button>
                          ) : c.status === "suspended" ? (
                            <button
                              onClick={() => handleAction("Reativar", c)}
                              title="Reativar"
                              className="flex h-7 w-7 items-center justify-center rounded-lg text-white/28 hover:bg-emerald-500/15 hover:text-emerald-400 transition-all"
                            >
                              <Play className="h-3.5 w-3.5" />
                            </button>
                          ) : null}
                          <button
                            onClick={() => {
                              if (confirm(`Deletar ${c.companyName}?`)) handleAction("Deletar", c);
                            }}
                            title="Deletar"
                            className="flex h-7 w-7 items-center justify-center rounded-lg text-white/28 hover:bg-red-500/15 hover:text-red-400 transition-all"
                          >
                            <Trash className="h-3.5 w-3.5" />
                          </button>
                        </div>
                      </td>
                    </tr>
                  );
                })
              )}
            </tbody>
          </table>
        </div>
      </div>
    </div>
  );
}
