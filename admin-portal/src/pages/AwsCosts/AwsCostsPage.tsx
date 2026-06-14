import { useEffect, useState, useCallback } from "react";
import {
  AreaChart, Area, BarChart, Bar, XAxis, YAxis,
  CartesianGrid, Tooltip, ResponsiveContainer, Cell,
} from "recharts";
import {
  Database, HardDrive, Scan, DollarSign, RefreshCw,
  TrendingUp, TrendingDown, Minus, Cloud, AlertTriangle,
  Server, Leaf, Info,
} from "lucide-react";
import { toast } from "sonner";
import { fetchAwsCosts, fetchAwsMetrics, type AwsCosts, type AwsMetrics } from "../../services/api";

// ── helpers ──────────────────────────────────────────────────────────────────

function smartUsd(n: number): string {
  if (n === 0) return "$0.00";
  if (n < 0.001) return `$${n.toFixed(6)}`;
  if (n < 0.01) return `$${n.toFixed(4)}`;
  return new Intl.NumberFormat("en-US", { style: "currency", currency: "USD", minimumFractionDigits: 2 }).format(n);
}

function mb(n: number): string {
  if (n >= 1024) return `${(n / 1024).toFixed(2)} GB`;
  return `${n.toFixed(1)} MB`;
}

function monthLabel(m: string): string {
  const [y, mo] = m.split("-");
  const names = ["Jan", "Fev", "Mar", "Abr", "Mai", "Jun", "Jul", "Ago", "Set", "Out", "Nov", "Dez"];
  return `${names[parseInt(mo) - 1]}/${y.slice(2)}`;
}

const SERVICE_COLORS: Record<string, string> = {
  DynamoDB: "#3b82f6",
  S3: "#10b981",
  Rekognition: "#a78bfa",
  CloudFront: "#f59e0b",
  Lambda: "#fb923c",
  "API Gateway": "#34d399",
  EC2: "#60a5fa",
  Route53: "#c084fc",
  Tax: "#94a3b8",
};

function serviceColor(name: string): string {
  for (const [key, color] of Object.entries(SERVICE_COLORS)) {
    if (name.includes(key)) return color;
  }
  return "#6366f1";
}

// ── custom tooltips ───────────────────────────────────────────────────────────

function CostTooltip({ active, payload, label }: { active?: boolean; payload?: Array<{ value: number }>; label?: string }) {
  if (!active || !payload?.length) return null;
  return (
    <div className="rounded-xl border border-white/10 px-3 py-2.5 text-[12px] shadow-xl" style={{ background: "rgba(5,12,26,0.97)" }}>
      <p className="font-semibold text-white/55 mb-1">{label}</p>
      <p className="text-white font-bold">{smartUsd(payload[0].value)}</p>
    </div>
  );
}

function ServiceTooltip({ active, payload }: { active?: boolean; payload?: Array<{ value: number; name: string }> }) {
  if (!active || !payload?.length) return null;
  return (
    <div className="rounded-xl border border-white/10 px-3 py-2.5 text-[12px] shadow-xl" style={{ background: "rgba(5,12,26,0.97)" }}>
      <p className="text-white font-bold">{smartUsd(payload[0].value)}</p>
    </div>
  );
}

// ── skeleton ──────────────────────────────────────────────────────────────────

function Skeleton({ className }: { className?: string }) {
  return <div className={`animate-pulse rounded-xl ${className}`} style={{ background: "rgba(255,255,255,0.06)" }} />;
}

// ── stat card ─────────────────────────────────────────────────────────────────

interface StatCardProps {
  icon: React.ElementType;
  label: string;
  value: string;
  sub?: string;
  color: string;
  error?: boolean;
}

function StatCard({ icon: Icon, label, value, sub, color, error }: StatCardProps) {
  return (
    <div
      className="rounded-2xl border p-5 flex flex-col gap-3"
      style={{ background: "rgba(255,255,255,0.035)", borderColor: "rgba(255,255,255,0.07)" }}
    >
      <div className="flex items-start justify-between">
        <div
          className="flex h-9 w-9 items-center justify-center rounded-xl"
          style={{ background: `${color}16`, border: `1px solid ${color}26` }}
        >
          <Icon className="h-4.5 w-4.5" style={{ color }} />
        </div>
        {error && <AlertTriangle className="h-3.5 w-3.5 text-amber-400 flex-shrink-0 mt-0.5" />}
      </div>
      <div>
        <p className="text-[24px] font-bold text-white leading-none tracking-tight tabular-nums">{value}</p>
        <p className="mt-1.5 text-[12px] text-white/45 leading-tight">{label}</p>
        {sub && <p className="mt-0.5 text-[11px] text-white/25">{sub}</p>}
      </div>
    </div>
  );
}

// ── main ──────────────────────────────────────────────────────────────────────

export function AwsCostsPage() {
  const [costs, setCosts] = useState<AwsCosts | null>(null);
  const [metrics, setMetrics] = useState<AwsMetrics | null>(null);
  const [loadingCosts, setLoadingCosts] = useState(true);
  const [loadingMetrics, setLoadingMetrics] = useState(true);
  const [lastRefresh, setLastRefresh] = useState<Date | null>(null);

  const load = useCallback(async () => {
    setLoadingCosts(true);
    setLoadingMetrics(true);
    try {
      const [c, m] = await Promise.all([fetchAwsCosts(6), fetchAwsMetrics()]);
      setCosts(c);
      setMetrics(m);
      setLastRefresh(new Date());
      if (c.error) toast.warning(`Cost Explorer: ${c.error_hint || c.error}`);
    } catch {
      toast.error("Erro ao carregar dados AWS");
    } finally {
      setLoadingCosts(false);
      setLoadingMetrics(false);
    }
  }, []);

  useEffect(() => { load(); }, [load]);

  // ── derived ────────────────────────────────────────────────────────────────
  const trendData = (costs?.monthly_costs ?? []).map((m) => ({
    name: monthLabel(m.month),
    total: m.total,
    hasServices: m.services.length > 0,
  }));

  const currentMonth = costs?.current_month;
  const lastClosedMonth = costs?.monthly_costs.at(-1);

  const trendPct = lastClosedMonth && lastClosedMonth.total > 0 && currentMonth && currentMonth.total > 0
    ? ((currentMonth.total - lastClosedMonth.total) / lastClosedMonth.total) * 100
    : null;

  // Combine services from current month + last closed month for the breakdown
  const allServices = currentMonth?.services.length
    ? currentMonth.services
    : (lastClosedMonth?.services ?? []);

  const totalForPct = allServices.reduce((s, x) => s + x.cost, 0);
  const isFreeTier = !loadingCosts && costs && !costs.error &&
    (currentMonth?.total ?? 0) < 0.01 &&
    (lastClosedMonth?.total ?? 0) < 0.01;

  const costsError = !loadingCosts && !!costs?.error;
  const metricsError = !loadingMetrics && metrics === null;
  const loading = loadingCosts || loadingMetrics;

  return (
    <div className="space-y-5">

      {/* ── header ── */}
      <div className="flex flex-col sm:flex-row sm:items-end justify-between gap-4">
        <div>
          <h1 className="text-[30px] font-bold text-white leading-none tracking-tight">Gastos AWS</h1>
          <p className="mt-1.5 text-[13px] text-white/38">
            Infraestrutura · conta {metrics?.region ?? "us-east-1"}
            {lastRefresh && (
              <span className="ml-2 text-white/22">
                · atualizado {lastRefresh.toLocaleTimeString("pt-BR", { hour: "2-digit", minute: "2-digit" })}
              </span>
            )}
          </p>
        </div>
        <button
          onClick={load}
          disabled={loading}
          className="flex items-center gap-2 px-4 py-2.5 rounded-xl text-[13px] font-medium text-white/55 border border-white/[0.09] hover:bg-white/[0.05] hover:text-white/80 transition-all disabled:opacity-40 self-start sm:self-auto"
        >
          <RefreshCw className={`h-3.5 w-3.5 ${loading ? "animate-spin" : ""}`} />
          Atualizar
        </button>
      </div>

      {/* ── banners ── */}
      {(costsError || metricsError) && !loading && (
        <div className="rounded-2xl border border-amber-500/20 p-4 flex gap-3" style={{ background: "rgba(245,158,11,0.06)" }}>
          <AlertTriangle className="h-4 w-4 text-amber-400 flex-shrink-0 mt-0.5" />
          <div className="flex-1 min-w-0">
            <p className="text-[13px] font-semibold text-amber-300">Permissões IAM insuficientes</p>
            <p className="text-[12px] text-amber-300/55 mt-0.5 leading-relaxed">
              Adicione ao usuário IAM no Console AWS:
            </p>
            <div className="mt-2 flex flex-wrap gap-1.5">
              {costsError && <code className="text-[11px] bg-amber-500/10 border border-amber-500/20 rounded-md px-2 py-0.5 text-amber-300/80">ce:GetCostAndUsage</code>}
              {metricsError && (
                <>
                  <code className="text-[11px] bg-amber-500/10 border border-amber-500/20 rounded-md px-2 py-0.5 text-amber-300/80">dynamodb:DescribeTable</code>
                  <code className="text-[11px] bg-amber-500/10 border border-amber-500/20 rounded-md px-2 py-0.5 text-amber-300/80">cloudwatch:GetMetricStatistics</code>
                  <code className="text-[11px] bg-amber-500/10 border border-amber-500/20 rounded-md px-2 py-0.5 text-amber-300/80">rekognition:DescribeCollection</code>
                </>
              )}
            </div>
          </div>
        </div>
      )}

      {isFreeTier && !loading && (
        <div className="rounded-2xl border border-emerald-500/20 p-4 flex gap-3" style={{ background: "rgba(16,185,129,0.05)" }}>
          <Leaf className="h-4 w-4 text-emerald-400 flex-shrink-0 mt-0.5" />
          <div>
            <p className="text-[13px] font-semibold text-emerald-300">Conta no Free Tier AWS</p>
            <p className="text-[12px] text-emerald-300/55 mt-0.5">
              Custos totais {"<"} $0,01/mês — dentro dos limites gratuitos da AWS. Os dados abaixo mostram o uso real da infraestrutura.
            </p>
          </div>
        </div>
      )}

      {/* ── hero + trend ── */}
      <div className="grid grid-cols-1 md:grid-cols-3 gap-4">

        {/* Spend hero */}
        <div
          className="rounded-2xl border p-6 flex flex-col justify-between"
          style={{
            background: "linear-gradient(145deg,rgba(29,78,216,0.15) 0%,rgba(5,12,26,0.7) 100%)",
            borderColor: "rgba(59,130,246,0.22)",
          }}
        >
          <div className="flex items-center gap-2.5 mb-5">
            <div className="flex h-9 w-9 items-center justify-center rounded-xl bg-blue-500/15 border border-blue-500/25">
              <DollarSign className="h-4.5 w-4.5 text-blue-400" />
            </div>
            <div>
              <p className="text-[11px] font-bold uppercase tracking-[0.09em] text-blue-300/60">Mês atual</p>
              <p className="text-[11px] text-white/30">{currentMonth?.month ?? "—"}</p>
            </div>
          </div>

          {loadingCosts ? (
            <Skeleton className="h-12 w-36 mb-3" />
          ) : (
            <>
              <p className="text-[44px] font-bold text-white leading-none tracking-tight mb-2">
                {currentMonth ? smartUsd(currentMonth.total) : "—"}
              </p>
              <div className="flex items-center gap-1.5 mb-3">
                {trendPct !== null ? (
                  <>
                    {trendPct > 5
                      ? <TrendingUp className="h-3.5 w-3.5 text-red-400" />
                      : trendPct < -5
                        ? <TrendingDown className="h-3.5 w-3.5 text-emerald-400" />
                        : <Minus className="h-3.5 w-3.5 text-white/30" />}
                    <span className={`text-[12px] font-medium ${trendPct > 5 ? "text-red-400" : trendPct < -5 ? "text-emerald-400" : "text-white/35"}`}>
                      {trendPct > 0 ? "+" : ""}{trendPct.toFixed(1)}% vs mês anterior
                    </span>
                  </>
                ) : (
                  <span className="text-[12px] text-white/25 flex items-center gap-1">
                    <Info className="h-3 w-3" /> sem comparativo
                  </span>
                )}
              </div>
            </>
          )}

          <div className="border-t border-white/[0.07] pt-3 mt-auto">
            <p className="text-[11px] text-white/28">Último mês fechado</p>
            <p className="text-[14px] font-semibold text-white/65 mt-0.5">
              {lastClosedMonth ? smartUsd(lastClosedMonth.total) : "—"}
            </p>
          </div>
        </div>

        {/* Trend chart */}
        <div
          className="md:col-span-2 rounded-2xl border border-white/[0.07] p-5"
          style={{ background: "rgba(255,255,255,0.035)" }}
        >
          <div className="flex items-center justify-between mb-4">
            <p className="text-[12px] font-bold uppercase tracking-[0.09em] text-white/30">Tendência — últimos 6 meses</p>
            {isFreeTier && <span className="text-[10.5px] text-emerald-400/60 bg-emerald-500/10 border border-emerald-500/15 rounded-full px-2 py-0.5">Free tier</span>}
          </div>
          {loadingCosts ? (
            <Skeleton className="h-32 w-full" />
          ) : trendData.length > 0 ? (
            <ResponsiveContainer width="100%" height={140}>
              <AreaChart data={trendData} margin={{ top: 4, right: 4, left: -16, bottom: 0 }}>
                <defs>
                  <linearGradient id="costGrad" x1="0" y1="0" x2="0" y2="1">
                    <stop offset="5%" stopColor="#3b82f6" stopOpacity={0.35} />
                    <stop offset="95%" stopColor="#3b82f6" stopOpacity={0.02} />
                  </linearGradient>
                </defs>
                <CartesianGrid strokeDasharray="3 3" stroke="rgba(255,255,255,0.05)" />
                <XAxis dataKey="name" tick={{ fill: "rgba(255,255,255,0.30)", fontSize: 11 }} axisLine={false} tickLine={false} />
                <YAxis tick={{ fill: "rgba(255,255,255,0.22)", fontSize: 10 }} axisLine={false} tickLine={false} tickFormatter={(v) => smartUsd(v)} />
                <Tooltip content={<CostTooltip />} />
                <Area
                  type="monotone"
                  dataKey="total"
                  stroke="#3b82f6"
                  strokeWidth={2}
                  fill="url(#costGrad)"
                  dot={{ fill: "#3b82f6", strokeWidth: 0, r: 3 }}
                  activeDot={{ r: 5, fill: "#60a5fa" }}
                />
              </AreaChart>
            </ResponsiveContainer>
          ) : (
            <div className="flex h-32 items-center justify-center text-white/22 text-[13px]">
              {costs?.error ? `Indisponível: ${costs.error_hint ?? costs.error}` : "Aguardando dados do Cost Explorer"}
            </div>
          )}
        </div>
      </div>

      {/* ── service breakdown ── */}
      {!loadingCosts && allServices.length > 0 && (
        <div className="grid grid-cols-1 lg:grid-cols-2 gap-4">

          {/* Horizontal bar */}
          <div
            className="rounded-2xl border border-white/[0.07] p-5"
            style={{ background: "rgba(255,255,255,0.035)" }}
          >
            <p className="text-[12px] font-bold uppercase tracking-[0.09em] text-white/30 mb-4">
              Por Serviço — {currentMonth?.services.length ? "mês atual" : "último mês"}
            </p>
            <ResponsiveContainer width="100%" height={Math.max(120, allServices.length * 32)}>
              <BarChart data={allServices} layout="vertical" margin={{ top: 0, right: 8, left: 4, bottom: 0 }}>
                <CartesianGrid strokeDasharray="3 3" stroke="rgba(255,255,255,0.04)" horizontal={false} />
                <XAxis
                  type="number"
                  tick={{ fill: "rgba(255,255,255,0.22)", fontSize: 10 }}
                  axisLine={false}
                  tickLine={false}
                  tickFormatter={(v) => smartUsd(v)}
                />
                <YAxis
                  dataKey="service"
                  type="category"
                  tick={{ fill: "rgba(255,255,255,0.48)", fontSize: 11 }}
                  axisLine={false}
                  tickLine={false}
                  width={100}
                />
                <Tooltip content={<ServiceTooltip />} cursor={{ fill: "rgba(255,255,255,0.03)" }} />
                <Bar dataKey="cost" radius={[0, 6, 6, 0]} barSize={14}>
                  {allServices.map((s) => (
                    <Cell key={s.service} fill={serviceColor(s.service)} fillOpacity={0.8} />
                  ))}
                </Bar>
              </BarChart>
            </ResponsiveContainer>
          </div>

          {/* Service list */}
          <div
            className="rounded-2xl border border-white/[0.07] p-5"
            style={{ background: "rgba(255,255,255,0.035)" }}
          >
            <p className="text-[12px] font-bold uppercase tracking-[0.09em] text-white/30 mb-4">Detalhamento de Custos</p>
            <div className="space-y-2.5 max-h-[240px] overflow-y-auto pr-1">
              {allServices.map((s) => {
                const pct = totalForPct > 0 ? (s.cost / totalForPct) * 100 : 0;
                return (
                  <div key={s.service} className="flex items-center gap-3">
                    <div className="w-2 h-2 rounded-full flex-shrink-0" style={{ background: serviceColor(s.service) }} />
                    <span className="flex-1 text-[12.5px] text-white/60 truncate">{s.service}</span>
                    <div className="flex items-center gap-2 flex-shrink-0">
                      <div className="w-16 h-1.5 rounded-full bg-white/[0.07]">
                        <div
                          className="h-1.5 rounded-full"
                          style={{ width: `${Math.max(pct, 4)}%`, background: serviceColor(s.service) }}
                        />
                      </div>
                      <span className="text-[12px] font-semibold text-white/70 tabular-nums w-20 text-right">{smartUsd(s.cost)}</span>
                    </div>
                  </div>
                );
              })}
            </div>

            {/* Total row */}
            <div className="mt-4 pt-3 border-t border-white/[0.07] flex items-center justify-between">
              <span className="text-[12px] font-bold uppercase tracking-wide text-white/30">Total</span>
              <span className="text-[14px] font-bold text-white tabular-nums">{smartUsd(totalForPct)}</span>
            </div>
          </div>
        </div>
      )}

      {/* ── no services empty state ── */}
      {!loadingCosts && allServices.length === 0 && !costs?.error && (
        <div
          className="rounded-2xl border border-white/[0.07] p-8 flex flex-col items-center text-center gap-3"
          style={{ background: "rgba(255,255,255,0.025)" }}
        >
          <div className="flex h-12 w-12 items-center justify-center rounded-2xl bg-blue-500/10 border border-blue-500/15">
            <Cloud className="h-6 w-6 text-blue-400/60" />
          </div>
          <p className="text-[14px] font-semibold text-white/60">Sem dados de custo disponíveis</p>
          <p className="text-[12.5px] text-white/30 max-w-sm leading-relaxed">
            O Cost Explorer pode levar até 24h para exibir dados após a primeira ativação. Se acabou de habilitar, aguarde e atualize.
          </p>
        </div>
      )}

      {/* ── infrastructure metrics ── */}
      <div>
        <p className="text-[11px] font-bold uppercase tracking-[0.12em] text-white/22 mb-3">Infraestrutura em Tempo Real</p>
        <div className="grid grid-cols-2 md:grid-cols-4 gap-3">
          {loadingMetrics ? (
            Array.from({ length: 4 }).map((_, i) => <Skeleton key={i} className="h-28" />)
          ) : metrics ? (
            <>
              <StatCard
                icon={Database}
                label="DynamoDB — Itens totais"
                value={metrics.dynamodb.total_items.toLocaleString("pt-BR")}
                sub={`${mb(metrics.dynamodb.total_size_mb)} armazenado`}
                color="#3b82f6"
              />
              <StatCard
                icon={HardDrive}
                label="S3 — Objetos armazenados"
                value={metrics.s3.object_count.toLocaleString("pt-BR")}
                sub={metrics.s3.error ? "Erro ao buscar" : `${mb(metrics.s3.size_mb)} usado`}
                color="#10b981"
                error={!!metrics.s3.error}
              />
              <StatCard
                icon={Scan}
                label="Rekognition — Faces"
                value={metrics.rekognition.face_count.toLocaleString("pt-BR")}
                sub={`Modelo v${metrics.rekognition.face_model_version}`}
                color="#a78bfa"
                error={!!metrics.rekognition.error}
              />
              <StatCard
                icon={Cloud}
                label="Região AWS"
                value={metrics.region}
                sub={`Online · ${new Date(metrics.timestamp).toLocaleTimeString("pt-BR", { hour: "2-digit", minute: "2-digit" })}`}
                color="#f59e0b"
              />
            </>
          ) : (
            <div
              className="col-span-4 flex items-center justify-center h-28 rounded-2xl text-white/22 text-[13px]"
              style={{ background: "rgba(255,255,255,0.025)" }}
            >
              Métricas indisponíveis
            </div>
          )}
        </div>
      </div>

      {/* ── DynamoDB tables ── */}
      {!loadingMetrics && metrics?.dynamodb.tables && (
        <div
          className="rounded-2xl border border-white/[0.07] overflow-hidden"
          style={{ background: "rgba(255,255,255,0.025)" }}
        >
          <div className="px-5 py-4 border-b border-white/[0.06] flex items-center justify-between">
            <div className="flex items-center gap-2.5">
              <div className="flex h-7 w-7 items-center justify-center rounded-lg bg-blue-500/12 border border-blue-500/20">
                <Server className="h-3.5 w-3.5 text-blue-400" />
              </div>
              <p className="text-[13px] font-semibold text-white/70">Tabelas DynamoDB</p>
            </div>
            <span className="text-[11px] text-white/25">{metrics.dynamodb.tables.length} tabelas</span>
          </div>
          <div className="overflow-x-auto">
            <table className="w-full text-[12.5px]">
              <thead>
                <tr className="border-b border-white/[0.04]">
                  {["Tabela", "Itens", "Tamanho", "Billing", "Status"].map((h) => (
                    <th key={h} className="px-5 py-2.5 text-left text-[10px] font-bold uppercase tracking-[0.09em] text-white/22">{h}</th>
                  ))}
                </tr>
              </thead>
              <tbody>
                {metrics.dynamodb.tables.map((t, i) => (
                  <tr
                    key={t.label}
                    className={`border-b border-white/[0.03] hover:bg-white/[0.02] transition-colors ${i % 2 === 0 ? "" : "bg-white/[0.01]"}`}
                  >
                    <td className="px-5 py-3">
                      <p className="font-medium text-white/78">{t.label}</p>
                      <p className="text-[10.5px] text-white/28 mt-0.5">{t.table_name}</p>
                    </td>
                    <td className="px-5 py-3 tabular-nums text-white/55 font-medium">
                      {t.error ? "—" : t.item_count.toLocaleString("pt-BR")}
                    </td>
                    <td className="px-5 py-3 tabular-nums text-white/50">
                      {t.error ? "—" : mb(t.size_mb)}
                    </td>
                    <td className="px-5 py-3 text-white/40 text-[11.5px]">{t.billing_mode ?? "—"}</td>
                    <td className="px-5 py-3">
                      {t.error ? (
                        <span className="text-amber-400 text-[11px]">{t.error}</span>
                      ) : (
                        <span className={`inline-flex items-center rounded-full px-2.5 py-0.5 text-[10.5px] font-medium border ${t.status === "ACTIVE" ? "bg-emerald-500/10 text-emerald-400 border-emerald-500/18" : "bg-white/[0.05] text-white/30 border-white/08"}`}>
                          {t.status}
                        </span>
                      )}
                    </td>
                  </tr>
                ))}
              </tbody>
            </table>
          </div>

          {/* footer totals */}
          <div className="px-5 py-3 border-t border-white/[0.06] flex items-center gap-6 text-[11.5px]">
            <span className="text-white/30">Total:</span>
            <span className="text-white/55 font-semibold tabular-nums">{metrics.dynamodb.total_items.toLocaleString("pt-BR")} itens</span>
            <span className="text-white/55 font-semibold">{mb(metrics.dynamodb.total_size_mb)}</span>
          </div>
        </div>
      )}

    </div>
  );
}
