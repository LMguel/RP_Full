import { useEffect, useState } from "react";
import { useNavigate, useParams } from "react-router-dom";
import { toast } from "sonner";
import { ArrowLeft, Mail, Calendar, Users, Eye, EyeOff, CreditCard, UserCheck } from "lucide-react";

import {
  fetchCompanyDetails,
  fetchCompanyEmployees,
  updateCompanyPaymentStatus,
  type CompanySummary,
  type CompanyEmployee,
} from "../../services/api";

export interface CompanyDetail extends CompanySummary {
  senhaHash?: string;
}

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

export function CompanyDetailsPage() {
  const { companyId } = useParams<{ companyId: string }>();
  const navigate = useNavigate();
  const [company, setCompany] = useState<CompanySummary | null>(null);
  const [employees, setEmployees] = useState<CompanyEmployee[]>([]);
  const [loading, setLoading] = useState(true);
  const [creationMonth, setCreationMonth] = useState<string>("");
  const [selectedCenterMonth, setSelectedCenterMonth] = useState<string>("");
  const [showPassword, setShowPassword] = useState(false);

  useEffect(() => {
    if (!companyId) { navigate("/companies", { replace: true }); return; }

    async function loadDetails() {
      try {
        if (!companyId) return;
        const [companyData, employeesData] = await Promise.all([
          fetchCompanyDetails(companyId),
          fetchCompanyEmployees(companyId),
        ]);
        setCompany(companyData);
        setEmployees(employeesData);
        const createdDate = new Date(companyData.dateCreated);
        setCreationMonth(createdDate.toISOString().slice(0, 7));
        setSelectedCenterMonth(new Date().toISOString().slice(0, 7));
      } catch (error) {
        toast.error("Não foi possível carregar os dados da empresa.");
        console.error(error);
        navigate("/companies", { replace: true });
      } finally {
        setLoading(false);
      }
    }
    loadDetails();
  }, [companyId, navigate]);

  const handlePaymentToggle = async (monthYear: string, currentState: boolean) => {
    if (!company) return;
    try {
      await updateCompanyPaymentStatus(companyId!, monthYear, !currentState);
      if (company.payments) {
        setCompany({ ...company, payments: { ...company.payments, [monthYear]: !currentState } });
      }
      toast.success(`Pagamento de ${monthYear} ${!currentState ? "marcado como pago" : "desmarcado"}`);
    } catch (error) {
      toast.error("Erro ao atualizar status de pagamento");
      console.error(error);
    }
  };

  const getMonthStatus = (monthYear: string) => {
    const current = new Date().toISOString().slice(0, 7);
    if (monthYear < current) return "past";
    if (monthYear === current) return "current";
    return "future";
  };

  const getMonthRowAccent = (monthYear: string) => {
    const s = getMonthStatus(monthYear);
    if (s === "current") return "bg-blue-500/[0.06] border-l-2 border-blue-500/40";
    if (s === "future") return "bg-white/[0.01]";
    return "";
  };

  const getMonthStatusLabel = (monthYear: string) => {
    const s = getMonthStatus(monthYear);
    if (s === "current") return <span className="ml-2 text-[10px] font-semibold text-blue-400 uppercase tracking-wide">Atual</span>;
    if (s === "future") return <span className="ml-2 text-[10px] text-white/25 uppercase tracking-wide">Futuro</span>;
    return <span className="ml-2 text-[10px] text-white/20 uppercase tracking-wide">Passado</span>;
  };

  const generatePaymentMonths = () => {
    if (!company || !selectedCenterMonth) return [];
    const [year, month] = selectedCenterMonth.split("-").map(Number);
    const startDate = new Date(year, month - 5, 1);
    return Array.from({ length: 9 }, (_, i) => {
      const d = new Date(startDate.getFullYear(), startDate.getMonth() + i, 1);
      const monthYear = d.toISOString().slice(0, 7);
      const label = d.toLocaleDateString("pt-BR", { month: "long", year: "numeric" });
      return { monthYear, label: label.charAt(0).toUpperCase() + label.slice(1), isPaid: company.payments?.[monthYear] === true };
    });
  };

  const displayedPaymentMonths = generatePaymentMonths();

  if (loading) {
    return (
      <div className="space-y-5">
        <Skeleton className="h-9 w-28" />
        <Skeleton className="h-44 w-full" />
        <Skeleton className="h-72 w-full" />
        <Skeleton className="h-64 w-full" />
      </div>
    );
  }

  if (!company) {
    return (
      <div className="flex flex-col items-center justify-center py-20">
        <p className="mb-4 text-white/40 text-[14px]">Empresa não encontrada</p>
        <button
          onClick={() => navigate("/companies")}
          className="flex items-center gap-2 px-4 py-2 rounded-xl text-[13px] font-medium text-white/60 bg-white/[0.05] border border-white/[0.08] hover:bg-white/[0.08] transition-all"
        >
          <ArrowLeft className="h-4 w-4" />
          Voltar para Empresas
        </button>
      </div>
    );
  }

  return (
    <div className="space-y-5">

      {/* header */}
      <div className="flex items-center justify-between">
        <button
          onClick={() => navigate("/companies")}
          className="flex items-center gap-2 px-3 py-2 rounded-xl text-[13px] font-medium text-white/50 hover:text-white/80 hover:bg-white/[0.05] transition-all"
        >
          <ArrowLeft className="h-4 w-4" />
          Voltar
        </button>
      </div>

      {/* company info */}
      <div
        className="rounded-2xl border border-white/[0.07] overflow-hidden"
        style={{ background: "rgba(255,255,255,0.025)" }}
      >
        <div
          className="px-6 py-5 border-b border-white/[0.06]"
          style={{ background: "linear-gradient(90deg, rgba(29,78,216,0.12) 0%, rgba(255,255,255,0.02) 100%)" }}
        >
          <div className="flex items-start justify-between gap-4">
            <div>
              <h1 className="text-[22px] font-bold text-white leading-tight">{company.companyName}</h1>
              <p className="mt-1 text-[12.5px] text-white/40">Detalhes da empresa e documentos</p>
            </div>
            <span className={`inline-flex items-center rounded-full border px-2.5 py-0.5 text-[11px] font-medium flex-shrink-0 ${statusStyle[company.status] ?? statusStyle.inactive}`}>
              {statusLabel[company.status] ?? company.status}
            </span>
          </div>
        </div>

        <div className="grid gap-0 md:grid-cols-2 lg:grid-cols-3 divide-y divide-white/[0.04] md:divide-y-0 md:divide-x md:divide-white/[0.04]">
          {[
            { icon: null, label: "ID da Empresa", value: <span className="font-mono text-[11.5px] text-white/55 break-all">{company.companyId}</span> },
            { icon: <Mail className="h-3.5 w-3.5" />, label: "Email", value: <span className="text-white/70 text-[13px]">{company.email}</span> },
            { icon: <Calendar className="h-3.5 w-3.5" />, label: "Data de Criação", value: <span className="text-white/70 text-[13px]">{company.dateCreated ? new Date(company.dateCreated).toLocaleDateString("pt-BR") : "—"}</span> },
            { icon: <Users className="h-3.5 w-3.5" />, label: "Funcionários", value: <span className="text-white/70 text-[13px]">{company.activeEmployees}/{company.expectedEmployees || 0}</span> },
            { icon: null, label: "ID do Usuário", value: <span className="font-mono text-[11.5px] text-white/55 break-all">{company.userId}</span> },
          ].map(({ icon, label, value }) => (
            <div key={label} className="px-5 py-4 space-y-1.5">
              <p className="text-[10.5px] font-bold uppercase tracking-[0.08em] text-white/28 flex items-center gap-1.5">
                {icon}<span>{label}</span>
              </p>
              <div>{value}</div>
            </div>
          ))}

          {/* password field */}
          <div className="px-5 py-4 space-y-1.5">
            <p className="text-[10.5px] font-bold uppercase tracking-[0.08em] text-white/28">Senha</p>
            <div className="flex items-center gap-2">
              <input
                type={showPassword ? "text" : "password"}
                value={company.senha || ""}
                readOnly
                className="flex-1 px-2.5 py-1.5 rounded-lg text-[12px] font-mono text-white/60 focus:outline-none border border-white/[0.08]"
                style={{ background: "rgba(255,255,255,0.04)" }}
              />
              <button
                onClick={() => setShowPassword(!showPassword)}
                className="flex h-7 w-7 items-center justify-center rounded-lg text-white/30 hover:text-white/65 hover:bg-white/[0.06] transition-all"
                title={showPassword ? "Ocultar" : "Mostrar"}
              >
                {showPassword ? <EyeOff className="h-3.5 w-3.5" /> : <Eye className="h-3.5 w-3.5" />}
              </button>
            </div>
          </div>
        </div>
      </div>

      {/* payment history */}
      <div
        className="rounded-2xl border border-white/[0.07] overflow-hidden"
        style={{ background: "rgba(255,255,255,0.025)" }}
      >
        <div className="px-5 py-3.5 border-b border-white/[0.06] flex flex-col sm:flex-row sm:items-center justify-between gap-3">
          <div className="flex items-center gap-2.5">
            <div className="flex h-7 w-7 items-center justify-center rounded-lg" style={{ background: "rgba(59,130,246,0.15)" }}>
              <CreditCard className="h-3.5 w-3.5 text-blue-400" />
            </div>
            <div>
              <p className="text-[13px] font-semibold text-white/75">Histórico de Pagamentos</p>
              <p className="text-[11px] text-white/30">4 meses anteriores, atual e 4 seguintes</p>
            </div>
          </div>
          <div className="flex items-center gap-2">
            <span className="text-[11.5px] text-white/35">Centralizar em:</span>
            <input
              type="month"
              value={selectedCenterMonth}
              onChange={(e) => setSelectedCenterMonth(e.target.value)}
              min={creationMonth}
              className="bg-white/[0.05] border border-white/[0.08] rounded-lg px-2.5 py-1.5 text-[12px] text-white/65 focus:outline-none focus:border-blue-500/50 transition-all"
            />
          </div>
        </div>

        <div className="overflow-x-auto">
          <table className="w-full text-[13px]">
            <thead>
              <tr className="border-b border-white/[0.05]">
                {["Mês", "Status", "Ação"].map((h) => (
                  <th key={h} className="px-5 py-3 text-left text-[10.5px] font-bold uppercase tracking-[0.08em] text-white/25">{h}</th>
                ))}
              </tr>
            </thead>
            <tbody>
              {displayedPaymentMonths.map((month) => (
                <tr
                  key={month.monthYear}
                  className={`border-b border-white/[0.04] hover:bg-white/[0.02] transition-colors ${getMonthRowAccent(month.monthYear)}`}
                >
                  <td className="px-5 py-3.5">
                    <span className="text-white/75 font-medium">{month.label}</span>
                    {getMonthStatusLabel(month.monthYear)}
                  </td>
                  <td className="px-5 py-3.5">
                    <span className={`inline-flex items-center rounded-full border px-2.5 py-0.5 text-[11px] font-medium ${month.isPaid ? "bg-emerald-500/15 text-emerald-400 border-emerald-500/25" : "bg-white/[0.06] text-white/35 border-white/[0.09]"}`}>
                      {month.isPaid ? "Pago" : "Pendente"}
                    </span>
                  </td>
                  <td className="px-5 py-3.5">
                    <label className="flex items-center gap-2.5 cursor-pointer group">
                      <div className="relative flex-shrink-0">
                        <input type="checkbox" checked={month.isPaid} onChange={() => handlePaymentToggle(month.monthYear, month.isPaid)} className="sr-only" />
                        <div
                          className="h-4 w-4 rounded border flex items-center justify-center transition-all"
                          style={{ background: month.isPaid ? "#10b981" : "rgba(255,255,255,0.04)", borderColor: month.isPaid ? "#10b981" : "rgba(255,255,255,0.15)" }}
                        >
                          {month.isPaid && (
                            <svg className="h-2.5 w-2.5 text-white" fill="none" viewBox="0 0 12 12">
                              <path d="M2 6l3 3 5-5" stroke="currentColor" strokeWidth="1.8" strokeLinecap="round" strokeLinejoin="round" />
                            </svg>
                          )}
                        </div>
                      </div>
                      <span className="text-[12px] text-white/35 group-hover:text-white/60 transition-colors select-none">
                        {month.isPaid ? "Marcar como pendente" : "Marcar como pago"}
                      </span>
                    </label>
                  </td>
                </tr>
              ))}
            </tbody>
          </table>
        </div>
      </div>

      {/* employees */}
      <div
        className="rounded-2xl border border-white/[0.07] overflow-hidden"
        style={{ background: "rgba(255,255,255,0.025)" }}
      >
        <div className="px-5 py-3.5 border-b border-white/[0.06] flex items-center justify-between">
          <div className="flex items-center gap-2.5">
            <div className="flex h-7 w-7 items-center justify-center rounded-lg" style={{ background: "rgba(167,139,250,0.15)" }}>
              <UserCheck className="h-3.5 w-3.5 text-purple-400" />
            </div>
            <div>
              <p className="text-[13px] font-semibold text-white/75">Funcionários Ativos</p>
              <p className="text-[11px] text-white/30">{employees.length} funcionários cadastrados</p>
            </div>
          </div>
        </div>

        <div className="overflow-x-auto">
          <table className="w-full text-[13px]">
            <thead>
              <tr className="border-b border-white/[0.05]">
                {["Nome", "Cargo", "Email", "Status"].map((h) => (
                  <th key={h} className="px-5 py-3 text-left text-[10.5px] font-bold uppercase tracking-[0.08em] text-white/25">{h}</th>
                ))}
              </tr>
            </thead>
            <tbody>
              {employees.length === 0 ? (
                <tr>
                  <td colSpan={4} className="px-5 py-12 text-center text-white/25 text-[13px]">
                    Nenhum funcionário ativo nesta empresa.
                  </td>
                </tr>
              ) : (
                employees.slice(0, 10).map((employee, i) => (
                  <tr
                    key={employee.id}
                    className={`border-b border-white/[0.04] hover:bg-white/[0.02] transition-colors ${i % 2 === 1 ? "bg-white/[0.01]" : ""}`}
                  >
                    <td className="px-5 py-3.5">
                      <span className="font-semibold text-white/80">{employee.nome}</span>
                    </td>
                    <td className="px-5 py-3.5 text-white/50">{employee.cargo}</td>
                    <td className="px-5 py-3.5 text-white/40 text-[12.5px]">{employee.email}</td>
                    <td className="px-5 py-3.5">
                      <span className={`inline-flex items-center rounded-full border px-2.5 py-0.5 text-[11px] font-medium ${employee.ativo ? "bg-emerald-500/15 text-emerald-400 border-emerald-500/25" : "bg-red-500/15 text-red-400 border-red-500/25"}`}>
                        {employee.ativo ? "Ativo" : "Inativo"}
                      </span>
                    </td>
                  </tr>
                ))
              )}
            </tbody>
          </table>
        </div>
      </div>
    </div>
  );
}
