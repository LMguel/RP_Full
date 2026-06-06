import { useEffect, useState, useMemo } from "react";
import {
  Building2, Users, TrendingUp, CheckCircle2, XCircle,
  AlertCircle, ArrowUpRight, FileText,
} from "lucide-react";
import { toast } from "sonner";
import {
  PieChart, Pie, Cell, ResponsiveContainer, Tooltip,
  BarChart, Bar, XAxis, YAxis, CartesianGrid,
} from "recharts";
import { fetchDashboardStats, fetchCompanies, type DashboardStats, type CompanySummary } from "../../services/api";
import { useNavigate } from "react-router-dom";

// ── helpers ───────────────────────────────────────────────────────────────────

function formatDate(d: string) {
  if (!d) return "—";
  try {
    return new Intl.DateTimeFormat("pt-BR", { day: "2-digit", month: "short" }).format(new Date(d));
  } catch { return d.slice(0, 10); }
}

function Skeleton({ className }: { className?: string }) {
  return (
    <div
      className={`rounded-xl animate-pulse ${className ?? ""}`}
      style={{ background: "rgba(255,255,255,0.06)" }}
    />
  );
}

// ── sub-components ────────────────────────────────────────────────────────────

interface KpiCardProps {
  icon: React.ElementType;
  label: string;
  value: number | null;
  color: string;
  sub?: string;
  loading: boolean;
}

function KpiCard({ icon: Icon, label, value, color, sub, loading }: KpiCardProps) {
  return (
    <div
      className="rounded-2xl border p-5 flex flex-col gap-3"
      style={{
        background: "rgba(255,255,255,0.035)",
        borderColor: "rgba(255,255,255,0.07)",
      }}
    >
      <div className="flex items-center justify-between">
        <div
          className="flex h-9 w-9 items-center justify-center rounded-xl"
          style={{ background: `${color}16`, border: `1px solid ${color}26` }}
        >
          <Icon className="h-4.5 w-4.5" style={{ color }} />
        </div>
        <ArrowUpRight className="h-3.5 w-3.5 text-white/15" />
      </div>
      {loading ? (
        <Skeleton className="h-9 w-24" />
      ) : (
        <p className="text-[36px] font-bold text-white leading-none tracking-tight tabular-nums">
          {(value ?? 0).toLocaleString("pt-BR")}
        </p>
      )}
      <div>
        <p className="text-[12.5px] text-white/50 font-medium leading-none">{label}</p>
        {sub && <p className="text-[11px] text-white/25 mt-1">{sub}</p>}
      </div>
    </div>
  );
}

// ── custom tooltip ────────────────────────────────────────────────────────────

function PieTooltip({ active, payload }: { active?: boolean; payload?: Array<{ name: string; value: number; payload: { fill: string } }> }) {
  if (!active || !payload?.length) return null;
  return (
    <div
      className="rounded-xl border border-white/10 px-3 py-2 text-[12px] shadow-xl"
      style={{ background: "rgba(5,12,26,0.97)" }}
    >
      <span className="font-semibold text-white">{payload[0].name}: </span>
      <span style={{ color: payload[0].payload.fill }}>{payload[0].value}</span>
    </div>
  );
}

function BarTooltip({ active, payload, label }: { active?: boolean; payload?: Array<{ value: number }>; label?: string }) {
  if (!active || !payload?.length) return null;
  return (
    <div
      className="rounded-xl border border-white/10 px-3 py-2 text-[12px] shadow-xl"
      style={{ background: "rgba(5,12,26,0.97)" }}
    >
      <p className="text-white/50 mb-0.5">{label}</p>
      <p className="font-semibold text-white">{payload[0].value} funcionários</p>
    </div>
  );
}

// ── page ──────────────────────────────────────────────────────────────────────

export function DashboardPage() {
  const navigate = useNavigate();
  const [stats, setStats] = useState<DashboardStats | null>(null);
  const [companies, setCompanies] = useState<CompanySummary[]>([]);
  const [loading, setLoading] = useState(true);
  const [selectedMonth, setSelectedMonth] = useState(() => {
    const n = new Date();
    return `${n.getFullYear()}-${String(n.getMonth() + 1).padStart(2, "0")}`;
  });

  useEffect(() => {
    (async () => {
      try {
        const [s, c] = await Promise.all([fetchDashboardStats(), fetchCompanies()]);
        setStats(s);
        setCompanies(c);
      } catch {
        toast.error("Erro ao carregar dashboard");
      } finally {
        setLoading(false);
      }
    })();
  }, []);

  const paid = useMemo(
    () => companies.filter((c) => c.payments?.[selectedMonth] === true).length,
    [companies, selectedMonth]
  );
  const unpaid = companies.length - paid;
  const adimRatio = companies.length > 0 ? Math.round((paid / companies.length) * 100) : 0;

  const pieData = [
    { name: "Pagas", value: paid, fill: "#10b981" },
    { name: "Não pagas", value: unpaid, fill: "#ef4444" },
  ];

  const topCompanies = useMemo(
    () =>
      [...companies]
        .filter((c) => c.activeEmployees > 0)
        .sort((a, b) => b.activeEmployees - a.activeEmployees)
        .slice(0, 6)
        .map((c) => ({ name: c.companyName.split(" ").slice(0, 2).join(" "), emp: c.activeEmployees })),
    [companies]
  );

  const recentCompanies = useMemo(
    () =>
      [...companies]
        .filter((c) => c.dateCreated)
        .sort((a, b) => (b.dateCreated > a.dateCreated ? 1 : -1))
        .slice(0, 5),
    [companies]
  );

  const now = new Date();
  const timeGreeting = now.getHours() < 12 ? "Bom dia" : now.getHours() < 18 ? "Boa tarde" : "Boa noite";

  return (
    <div className="space-y-6">

      {/* ── header ── */}
      <div className="flex flex-col sm:flex-row sm:items-end justify-between gap-3">
        <div>
          <p className="text-[12px] font-semibold text-white/30 uppercase tracking-[0.1em] mb-1">{timeGreeting}</p>
          <h1 className="text-[32px] font-bold text-white leading-none tracking-tight">Dashboard</h1>
          <p className="mt-1.5 text-[13px] text-white/38">
            {now.toLocaleDateString("pt-BR", { weekday: "long", day: "numeric", month: "long", year: "numeric" })}
          </p>
        </div>
        <button
          onClick={() => navigate("/clients")}
          className="flex items-center gap-2 px-4 py-2.5 rounded-xl text-[13px] font-semibold text-white transition-all hover:opacity-90 active:scale-95 self-start sm:self-auto"
          style={{ background: "linear-gradient(90deg,#1d4ed8,#3b82f6)" }}
        >
          <Users className="h-3.5 w-3.5" />
          Ver Clientes
        </button>
      </div>

      {/* ── KPI row ── */}
      <div className="grid grid-cols-2 xl:grid-cols-4 gap-3">
        <KpiCard icon={Building2} label="Empresas cadastradas" value={stats?.totalCompanies ?? null} color="#3b82f6" sub={`${stats?.activeCompanies ?? 0} ativas`} loading={loading} />
        <KpiCard icon={Users} label="Funcionários ativos" value={stats?.totalEmployees ?? null} color="#a78bfa" loading={loading} />
        <KpiCard icon={FileText} label="Registros de ponto" value={stats?.totalTimeEntries ?? null} color="#06b6d4" loading={loading} />
        <div
          className="rounded-2xl border p-5 flex flex-col gap-3"
          style={{ background: "linear-gradient(135deg,rgba(16,185,129,0.10) 0%,rgba(5,12,26,0.6) 100%)", borderColor: "rgba(16,185,129,0.20)" }}
        >
          <div className="flex items-center justify-between">
            <div className="flex h-9 w-9 items-center justify-center rounded-xl bg-emerald-500/15 border border-emerald-500/25">
              <TrendingUp className="h-4.5 w-4.5 text-emerald-400" />
            </div>
            <span className="text-[10px] font-bold uppercase tracking-wide text-emerald-400/50">{selectedMonth}</span>
          </div>
          {loading ? (
            <Skeleton className="h-9 w-20" />
          ) : (
            <p className="text-[36px] font-bold text-white leading-none tracking-tight tabular-nums">{adimRatio}%</p>
          )}
          <div>
            <p className="text-[12.5px] text-white/50 font-medium leading-none">Taxa de adimplência</p>
            <p className="text-[11px] text-white/25 mt-1">{paid} pagas · {unpaid} pendentes</p>
          </div>
        </div>
      </div>

      {/* ── main content grid ── */}
      <div className="grid grid-cols-1 lg:grid-cols-5 gap-4">

        {/* Payment donut — 2 cols */}
        <div
          className="lg:col-span-2 rounded-2xl border border-white/[0.07] p-5"
          style={{ background: "rgba(255,255,255,0.035)" }}
        >
          <div className="flex items-center justify-between mb-5">
            <div>
              <p className="text-[13px] font-semibold text-white/80">Status de Pagamento</p>
              <p className="text-[11px] text-white/30 mt-0.5">Pagas vs pendentes</p>
            </div>
            <input
              type="month"
              value={selectedMonth}
              onChange={(e) => setSelectedMonth(e.target.value)}
              className="bg-white/[0.05] border border-white/[0.09] rounded-lg px-2.5 py-1.5 text-[12px] text-white/65 focus:outline-none focus:border-blue-500/40 transition-all"
            />
          </div>

          {loading ? (
            <div className="flex items-center justify-center h-48">
              <Skeleton className="h-40 w-40 rounded-full" />
            </div>
          ) : (paid + unpaid) > 0 ? (
            <div className="relative">
              <ResponsiveContainer width="100%" height={200}>
                <PieChart>
                  <Pie
                    data={pieData}
                    cx="50%"
                    cy="50%"
                    innerRadius={60}
                    outerRadius={85}
                    paddingAngle={3}
                    dataKey="value"
                    strokeWidth={0}
                  >
                    {pieData.map((entry) => (
                      <Cell key={entry.name} fill={entry.fill} fillOpacity={0.85} />
                    ))}
                  </Pie>
                  <Tooltip content={<PieTooltip />} />
                </PieChart>
              </ResponsiveContainer>
              {/* Center label */}
              <div className="absolute inset-0 flex flex-col items-center justify-center pointer-events-none">
                <p className="text-[30px] font-bold text-white leading-none">{adimRatio}%</p>
                <p className="text-[11px] text-white/35 mt-0.5">adimplência</p>
              </div>
            </div>
          ) : (
            <div className="flex h-48 items-center justify-center text-white/25 text-[13px]">
              Sem dados para este mês
            </div>
          )}

          {/* legend */}
          {!loading && (
            <div className="flex gap-4 mt-2 justify-center">
              {pieData.map((d) => (
                <div key={d.name} className="flex items-center gap-1.5">
                  <span className="h-2.5 w-2.5 rounded-full" style={{ background: d.fill }} />
                  <span className="text-[11.5px] text-white/45">{d.name}: <span className="font-semibold text-white/70">{d.value}</span></span>
                </div>
              ))}
            </div>
          )}
        </div>

        {/* Employees bar — 3 cols */}
        <div
          className="lg:col-span-3 rounded-2xl border border-white/[0.07] p-5"
          style={{ background: "rgba(255,255,255,0.035)" }}
        >
          <div className="mb-5">
            <p className="text-[13px] font-semibold text-white/80">Funcionários por Empresa</p>
            <p className="text-[11px] text-white/30 mt-0.5">Top 6 empresas com mais colaboradores ativos</p>
          </div>
          {loading ? (
            <Skeleton className="h-44 w-full" />
          ) : topCompanies.length > 0 ? (
            <ResponsiveContainer width="100%" height={190}>
              <BarChart data={topCompanies} margin={{ top: 0, right: 4, left: -20, bottom: 0 }} barSize={18}>
                <CartesianGrid strokeDasharray="3 3" stroke="rgba(255,255,255,0.05)" vertical={false} />
                <XAxis
                  dataKey="name"
                  tick={{ fill: "rgba(255,255,255,0.38)", fontSize: 10.5 }}
                  axisLine={false}
                  tickLine={false}
                />
                <YAxis
                  tick={{ fill: "rgba(255,255,255,0.25)", fontSize: 10 }}
                  axisLine={false}
                  tickLine={false}
                />
                <Tooltip content={<BarTooltip />} cursor={{ fill: "rgba(255,255,255,0.04)" }} />
                <Bar dataKey="emp" fill="#3b82f6" fillOpacity={0.75} radius={[6, 6, 0, 0]} />
              </BarChart>
            </ResponsiveContainer>
          ) : (
            <div className="flex h-44 items-center justify-center text-white/25 text-[13px]">
              Sem empresas com funcionários cadastrados
            </div>
          )}
        </div>
      </div>

      {/* ── bottom row ── */}
      <div className="grid grid-cols-1 lg:grid-cols-2 gap-4">

        {/* Status breakdown */}
        <div
          className="rounded-2xl border border-white/[0.07] p-5"
          style={{ background: "rgba(255,255,255,0.035)" }}
        >
          <p className="text-[13px] font-semibold text-white/80 mb-4">Status das Empresas</p>
          {loading ? (
            <div className="space-y-2.5">
              {[1, 2, 3].map((i) => <Skeleton key={i} className="h-10 w-full" />)}
            </div>
          ) : (
            <div className="space-y-2.5">
              {[
                { label: "Ativas", value: stats?.activeCompanies ?? 0, total: stats?.totalCompanies ?? 1, color: "#10b981", icon: CheckCircle2 },
                { label: "Inativas", value: stats?.inactiveCompanies ?? 0, total: stats?.totalCompanies ?? 1, color: "#ef4444", icon: XCircle },
                { label: "Em risco (sem pagamento)", value: stats?.unpaidCompanies ?? 0, total: stats?.totalCompanies ?? 1, color: "#f59e0b", icon: AlertCircle },
              ].map(({ label, value, total, color, icon: Icon }) => {
                const pct = total > 0 ? Math.round((value / total) * 100) : 0;
                return (
                  <div key={label} className="flex items-center gap-3">
                    <div
                      className="flex h-8 w-8 flex-shrink-0 items-center justify-center rounded-lg"
                      style={{ background: `${color}15`, border: `1px solid ${color}22` }}
                    >
                      <Icon className="h-3.5 w-3.5" style={{ color }} />
                    </div>
                    <div className="flex-1 min-w-0">
                      <div className="flex items-center justify-between mb-1">
                        <span className="text-[12.5px] text-white/60">{label}</span>
                        <span className="text-[12.5px] font-semibold text-white/80 tabular-nums">{value}</span>
                      </div>
                      <div className="h-1.5 w-full rounded-full bg-white/[0.07]">
                        <div
                          className="h-1.5 rounded-full transition-all duration-500"
                          style={{ width: `${pct}%`, background: color, opacity: 0.75 }}
                        />
                      </div>
                    </div>
                  </div>
                );
              })}
            </div>
          )}
        </div>

        {/* Recent companies */}
        <div
          className="rounded-2xl border border-white/[0.07] p-5"
          style={{ background: "rgba(255,255,255,0.035)" }}
        >
          <div className="flex items-center justify-between mb-4">
            <p className="text-[13px] font-semibold text-white/80">Últimas Empresas Criadas</p>
            <button
              onClick={() => navigate("/clients")}
              className="text-[11.5px] text-blue-400/70 hover:text-blue-400 transition-colors"
            >
              Ver todas →
            </button>
          </div>
          {loading ? (
            <div className="space-y-3">
              {[1, 2, 3, 4, 5].map((i) => <Skeleton key={i} className="h-10 w-full" />)}
            </div>
          ) : recentCompanies.length > 0 ? (
            <div className="space-y-1">
              {recentCompanies.map((c, i) => (
                <button
                  key={c.companyId}
                  onClick={() => navigate(`/companies/${c.companyId}`)}
                  className="w-full flex items-center gap-3 px-3 py-2.5 rounded-xl text-left hover:bg-white/[0.04] transition-all group"
                >
                  <div
                    className="flex h-7 w-7 flex-shrink-0 items-center justify-center rounded-lg text-[10px] font-bold text-white"
                    style={{ background: `hsl(${220 + i * 25},70%,35%)` }}
                  >
                    {c.companyName.charAt(0).toUpperCase()}
                  </div>
                  <div className="flex-1 min-w-0">
                    <p className="text-[12.5px] font-medium text-white/80 truncate group-hover:text-white transition-colors">{c.companyName}</p>
                    <p className="text-[11px] text-white/30">{c.activeEmployees} funcionários</p>
                  </div>
                  <div className="flex flex-col items-end gap-0.5">
                    <span
                      className={`inline-flex h-1.5 w-1.5 rounded-full ${c.status === "active" ? "bg-emerald-400" : "bg-white/20"}`}
                    />
                    <span className="text-[10.5px] text-white/25">{formatDate(c.dateCreated)}</span>
                  </div>
                </button>
              ))}
            </div>
          ) : (
            <div className="flex h-44 items-center justify-center text-white/25 text-[13px]">
              Nenhuma empresa cadastrada
            </div>
          )}
        </div>
      </div>

    </div>
  );
}
