import { useState, useEffect, useCallback } from "react";
import {
  Activity, RefreshCw, Tablet, Wifi, WifiOff,
  Battery, BatteryLow, Clock, Filter, ChevronDown,
  AlertCircle, CheckCircle2, Info, AlertTriangle, Circle,
} from "lucide-react";
import { toast } from "sonner";
import {
  fetchAdminKioskLogs,
  fetchAdminKioskHeartbeats,
  fetchCompanies,
  type KioskLogEntry,
  type KioskHeartbeat,
  type CompanySummary,
} from "../../services/api";

// ─── Event meta ───────────────────────────────────────────────────────────────

type Severity = "error" | "warning" | "success" | "info" | "neutral";

const EVENT_SEVERITY: Record<string, Severity> = {
  REGISTER_FAILED:      "error",
  RECOVERY_RELOAD:      "error",
  KIOSK_HARD_RELOAD:    "error",
  UPDATE_FAIL:          "error",
  TENANT_MISMATCH:      "error",
  SYNC_FAILED:          "error",
  KIOSK_SOFT_RELOAD:    "warning",
  KIOSK_MEMORY_PRESSURE:"warning",
  FACIAL_RESTART:       "warning",
  RECOVERY_CAMERA:      "warning",
  KIOSK_CAMERA_RECOVERY:"warning",
  FACE_NO_MATCH:        "warning",
  NO_FACE:              "warning",
  REGISTER_SUCCESS:     "success",
  FACE_MATCH:           "success",
  UPDATE_SUCCESS:       "success",
  KIOSK_BOOT:           "success",
  CAMERA_START:         "success",
  KIOSK_HEALTH:         "info",
  CAMERA_RESTART:       "info",
  CAMERA_STOP:          "info",
  SW_UPDATED:           "info",
};

const SEVERITY_STYLES: Record<Severity, { badge: string; dot: string; row: string }> = {
  error:   { badge: "bg-rose-500/15 text-rose-400 border-rose-500/25",   dot: "bg-rose-400",   row: "hover:bg-rose-500/[0.04]" },
  warning: { badge: "bg-amber-500/15 text-amber-400 border-amber-500/25", dot: "bg-amber-400",  row: "hover:bg-amber-500/[0.04]" },
  success: { badge: "bg-emerald-500/15 text-emerald-400 border-emerald-500/25", dot: "bg-emerald-400", row: "hover:bg-emerald-500/[0.04]" },
  info:    { badge: "bg-blue-500/15 text-blue-400 border-blue-500/25",   dot: "bg-blue-400",   row: "hover:bg-blue-500/[0.04]" },
  neutral: { badge: "bg-white/[0.06] text-white/50 border-white/[0.08]", dot: "bg-white/30",   row: "hover:bg-white/[0.02]" },
};

function getSeverity(event: string): Severity {
  return EVENT_SEVERITY[event] ?? "neutral";
}

// ─── Time ranges ──────────────────────────────────────────────────────────────

const TIME_RANGES = [
  { label: "1h",  ms: 1 * 3600 * 1000 },
  { label: "6h",  ms: 6 * 3600 * 1000 },
  { label: "24h", ms: 24 * 3600 * 1000 },
  { label: "7d",  ms: 7 * 24 * 3600 * 1000 },
];

// ─── Helpers ──────────────────────────────────────────────────────────────────

function fmtTs(ts: number): string {
  return new Date(ts).toLocaleString("pt-BR", {
    day: "2-digit", month: "2-digit",
    hour: "2-digit", minute: "2-digit", second: "2-digit",
  });
}

function fmtUptime(ms: number): string {
  const h = Math.floor(ms / 3600000);
  const m = Math.floor((ms % 3600000) / 60000);
  return h > 0 ? `${h}h ${m}m` : `${m}m`;
}

function timeSince(iso: string): string {
  const diff = Date.now() - new Date(iso).getTime();
  const m = Math.floor(diff / 60000);
  if (m < 1) return "agora";
  if (m < 60) return `${m}min atrás`;
  const h = Math.floor(m / 60);
  if (h < 24) return `${h}h atrás`;
  return `${Math.floor(h / 24)}d atrás`;
}

function isOnline(lastSeen: string): boolean {
  return Date.now() - new Date(lastSeen).getTime() < 10 * 60 * 1000; // 10 min
}

// ─── Component ────────────────────────────────────────────────────────────────

export function KioskLogsPage() {
  const [tab, setTab] = useState<"logs" | "heartbeats">("logs");
  const [logs, setLogs] = useState<KioskLogEntry[]>([]);
  const [heartbeats, setHeartbeats] = useState<KioskHeartbeat[]>([]);
  const [companies, setCompanies] = useState<CompanySummary[]>([]);
  const [loading, setLoading] = useState(false);
  const [tableWarn, setTableWarn] = useState<string | null>(null);

  // Filters
  const [companyFilter, setCompanyFilter] = useState("");
  const [eventFilter, setEventFilter] = useState("");
  const [severityFilter, setSeverityFilter] = useState<Severity | "">("");
  const [rangeIdx, setRangeIdx] = useState(2); // default: 24h

  const companyMap = Object.fromEntries(
    companies.map((c) => [c.companyId, c.companyName])
  );

  const loadCompanies = useCallback(async () => {
    try {
      const list = await fetchCompanies();
      setCompanies(list);
    } catch { /* ignore */ }
  }, []);

  const loadLogs = useCallback(async () => {
    setLoading(true);
    try {
      const now = Date.now();
      const start = now - TIME_RANGES[rangeIdx].ms;
      const { logs: data, warn } = await fetchAdminKioskLogs({
        company_id: companyFilter || undefined,
        event: eventFilter || undefined,
        start_ts: start,
        end_ts: now,
        limit: 500,
      });
      setLogs(data);
      setTableWarn(warn ?? null);
    } catch (e: any) {
      toast.error(e?.message || "Erro ao carregar logs");
    } finally {
      setLoading(false);
    }
  }, [companyFilter, eventFilter, rangeIdx]);

  const loadHeartbeats = useCallback(async () => {
    setLoading(true);
    try {
      const { heartbeats: data, warn } = await fetchAdminKioskHeartbeats(companyFilter || undefined);
      setHeartbeats(data);
      setTableWarn(warn ?? null);
    } catch (e: any) {
      toast.error(e?.message || "Erro ao carregar heartbeats");
    } finally {
      setLoading(false);
    }
  }, [companyFilter]);

  useEffect(() => { loadCompanies(); }, [loadCompanies]);

  useEffect(() => {
    if (tab === "logs") loadLogs();
    else loadHeartbeats();
  }, [tab, loadLogs, loadHeartbeats]);

  const refresh = () => {
    if (tab === "logs") loadLogs();
    else loadHeartbeats();
  };

  // Filtered logs (client-side severity filter)
  const filteredLogs = severityFilter
    ? logs.filter((l) => getSeverity(l.event) === severityFilter)
    : logs;

  // Unique events for the event dropdown
  const uniqueEvents = Array.from(new Set(logs.map((l) => l.event))).sort();

  // ─── Counts by severity ─────────────────────────────────────────────────────
  const counts = logs.reduce((acc, l) => {
    const s = getSeverity(l.event);
    acc[s] = (acc[s] || 0) + 1;
    return acc;
  }, {} as Record<string, number>);

  const cardStyle = {
    background: "rgba(255,255,255,0.025)",
    border: "1px solid rgba(255,255,255,0.07)",
  };

  const inputStyle: React.CSSProperties = {
    background: "rgba(255,255,255,0.05)",
    border: "1px solid rgba(255,255,255,0.08)",
    color: "white",
  };

  return (
    <div className="space-y-5">
      {/* Header */}
      <div className="flex flex-wrap items-center justify-between gap-3">
        <div className="flex items-center gap-3">
          <div className="flex h-9 w-9 items-center justify-center rounded-[10px]"
            style={{ background: "rgba(244,63,94,0.15)", border: "1px solid rgba(244,63,94,0.2)" }}>
            <Activity className="h-4.5 w-4.5 text-rose-400" />
          </div>
          <div>
            <h1 className="text-[18px] font-bold text-white leading-tight">Logs Kiosk</h1>
            <p className="text-[11px] text-white/38 mt-0.5">Monitoramento em tempo real de tablets e eventos</p>
          </div>
        </div>
        <button
          onClick={refresh}
          disabled={loading}
          className="flex items-center gap-2 rounded-[10px] px-3.5 py-2 text-[12.5px] font-medium text-white/70 transition-all hover:text-white hover:bg-white/[0.06] disabled:opacity-40"
          style={{ border: "1px solid rgba(255,255,255,0.08)" }}
        >
          <RefreshCw className={`h-3.5 w-3.5 ${loading ? "animate-spin" : ""}`} />
          Atualizar
        </button>
      </div>

      {/* Tabs */}
      <div className="flex gap-1 rounded-xl p-1" style={{ background: "rgba(255,255,255,0.04)", border: "1px solid rgba(255,255,255,0.06)" }}>
        {(["logs", "heartbeats"] as const).map((t) => (
          <button
            key={t}
            onClick={() => setTab(t)}
            className={`flex-1 rounded-[9px] py-2 text-[13px] font-semibold transition-all ${
              tab === t
                ? "bg-white/[0.08] text-white shadow-sm"
                : "text-white/40 hover:text-white/65"
            }`}
          >
            {t === "logs" ? "Logs de Eventos" : "Heartbeats de Tablets"}
          </button>
        ))}
      </div>

      {/* Aviso: tabela não criada ainda */}
      {tableWarn && (
        <div className="flex items-start gap-3 rounded-xl px-4 py-3"
          style={{ background: "rgba(245,158,11,0.1)", border: "1px solid rgba(245,158,11,0.2)" }}>
          <AlertTriangle className="mt-0.5 h-4 w-4 shrink-0 text-amber-400" />
          <div>
            <p className="text-[13px] font-semibold text-amber-300">Tabela não encontrada no DynamoDB</p>
            <p className="mt-0.5 text-[12px] text-amber-400/70">Execute o script para criar a tabela e começar a receber logs dos tablets:</p>
            <code className="mt-1.5 block rounded-lg bg-black/30 px-3 py-1.5 text-[11.5px] text-amber-300/80 font-mono select-all">
              python backend/scripts/create_kiosk_telemetry_table.py
            </code>
          </div>
        </div>
      )}

      {/* ── LOGS TAB ── */}
      {tab === "logs" && (
        <>
          {/* Severity summary */}
          <div className="grid grid-cols-2 gap-3 sm:grid-cols-4">
            {(["error", "warning", "success", "info"] as Severity[]).map((s) => {
              const styles = SEVERITY_STYLES[s];
              const icons = { error: AlertCircle, warning: AlertTriangle, success: CheckCircle2, info: Info };
              const Icon = icons[s];
              const labels = { error: "Erros", warning: "Avisos", success: "Sucessos", info: "Info" };
              return (
                <button
                  key={s}
                  onClick={() => setSeverityFilter(severityFilter === s ? "" : s)}
                  className={`rounded-xl p-3.5 text-left transition-all ${severityFilter === s ? "ring-1 ring-white/20" : ""}`}
                  style={{ ...cardStyle, opacity: severityFilter && severityFilter !== s ? 0.5 : 1 }}
                >
                  <div className="flex items-center justify-between mb-2">
                    <Icon className="h-4 w-4" style={{ color: styles.dot.replace("bg-", "").replace("-400", "") }} />
                    <span className={`text-[10px] px-1.5 py-0.5 rounded-full border ${styles.badge}`}>
                      {labels[s]}
                    </span>
                  </div>
                  <p className="text-2xl font-bold text-white tabular-nums">{counts[s] || 0}</p>
                </button>
              );
            })}
          </div>

          {/* Filters */}
          <div className="flex flex-wrap gap-3 items-center">
            {/* Time range */}
            <div className="flex gap-1 rounded-lg p-1" style={{ background: "rgba(255,255,255,0.04)", border: "1px solid rgba(255,255,255,0.06)" }}>
              {TIME_RANGES.map((r, i) => (
                <button key={r.label} onClick={() => setRangeIdx(i)}
                  className={`px-3 py-1 rounded-md text-[12px] font-medium transition-all ${
                    rangeIdx === i ? "bg-white/[0.1] text-white" : "text-white/40 hover:text-white/70"
                  }`}>
                  {r.label}
                </button>
              ))}
            </div>

            {/* Company filter */}
            <div className="relative">
              <select
                value={companyFilter}
                onChange={(e) => setCompanyFilter(e.target.value)}
                className="appearance-none rounded-lg pl-3 pr-8 py-1.5 text-[12.5px] focus:outline-none focus:ring-1 focus:ring-blue-500/50"
                style={inputStyle}
              >
                <option value="">Todas as empresas</option>
                {companies.map((c) => (
                  <option key={c.companyId} value={c.companyId}>{c.companyName}</option>
                ))}
              </select>
              <ChevronDown className="pointer-events-none absolute right-2 top-1/2 -translate-y-1/2 h-3.5 w-3.5 text-white/40" />
            </div>

            {/* Event filter */}
            <div className="relative">
              <select
                value={eventFilter}
                onChange={(e) => setEventFilter(e.target.value)}
                className="appearance-none rounded-lg pl-3 pr-8 py-1.5 text-[12.5px] focus:outline-none focus:ring-1 focus:ring-blue-500/50"
                style={inputStyle}
              >
                <option value="">Todos os eventos</option>
                {uniqueEvents.map((ev) => (
                  <option key={ev} value={ev}>{ev}</option>
                ))}
              </select>
              <ChevronDown className="pointer-events-none absolute right-2 top-1/2 -translate-y-1/2 h-3.5 w-3.5 text-white/40" />
            </div>

            {severityFilter && (
              <button onClick={() => setSeverityFilter("")}
                className="flex items-center gap-1.5 px-3 py-1.5 rounded-lg text-[12px] text-white/60 hover:text-white transition-all"
                style={{ border: "1px solid rgba(255,255,255,0.08)" }}>
                <Filter className="h-3 w-3" />
                Limpar filtro
              </button>
            )}

            <span className="ml-auto text-[12px] text-white/30">
              {filteredLogs.length} de {logs.length} entradas
            </span>
          </div>

          {/* Logs table */}
          <div className="rounded-xl overflow-hidden" style={cardStyle}>
            {loading ? (
              <div className="py-16 flex items-center justify-center gap-3 text-white/40">
                <RefreshCw className="h-4 w-4 animate-spin" />
                <span className="text-[13px]">Carregando...</span>
              </div>
            ) : filteredLogs.length === 0 ? (
              <div className="py-16 text-center text-white/30 text-[13px]">
                Nenhum log encontrado para os filtros selecionados.
              </div>
            ) : (
              <div className="overflow-x-auto">
                <table className="w-full text-[12.5px]">
                  <thead>
                    <tr style={{ borderBottom: "1px solid rgba(255,255,255,0.06)" }}>
                      {["Horário", "Empresa", "Tablet", "Evento", "Detalhe", "Versão"].map((h) => (
                        <th key={h} className="px-4 py-3 text-left font-semibold text-white/35 uppercase tracking-[0.07em] text-[10.5px] whitespace-nowrap">
                          {h}
                        </th>
                      ))}
                    </tr>
                  </thead>
                  <tbody>
                    {filteredLogs.map((log, i) => {
                      const sev = getSeverity(log.event);
                      const styles = SEVERITY_STYLES[sev];
                      return (
                        <tr key={i}
                          className={`transition-colors ${styles.row}`}
                          style={{ borderBottom: "1px solid rgba(255,255,255,0.04)" }}
                        >
                          <td className="px-4 py-2.5 whitespace-nowrap font-mono text-white/50">
                            {fmtTs(log.ts)}
                          </td>
                          <td className="px-4 py-2.5 max-w-[180px]">
                            <span className="text-white/80 font-medium truncate block">
                              {companyMap[log.company_id] || log.company_id.slice(0, 8) + "…"}
                            </span>
                          </td>
                          <td className="px-4 py-2.5 whitespace-nowrap">
                            <span className="text-white/45 font-mono text-[11px]">
                              {log.device_id.slice(0, 16)}
                            </span>
                          </td>
                          <td className="px-4 py-2.5 whitespace-nowrap">
                            <span className={`inline-flex items-center gap-1.5 px-2 py-0.5 rounded-full text-[11px] font-medium border ${styles.badge}`}>
                              <span className={`w-1.5 h-1.5 rounded-full ${styles.dot}`} />
                              {log.event}
                            </span>
                          </td>
                          <td className="px-4 py-2.5 max-w-[240px]">
                            <span className="text-white/45 truncate block text-[11.5px]">
                              {log.detail || "—"}
                            </span>
                          </td>
                          <td className="px-4 py-2.5 whitespace-nowrap">
                            <span className="text-white/30 font-mono text-[11px]">{log.version}</span>
                          </td>
                        </tr>
                      );
                    })}
                  </tbody>
                </table>
              </div>
            )}
          </div>
        </>
      )}

      {/* ── HEARTBEATS TAB ── */}
      {tab === "heartbeats" && (
        <>
          {/* Company filter */}
          <div className="flex flex-wrap items-center gap-3">
            <div className="relative">
              <select
                value={companyFilter}
                onChange={(e) => setCompanyFilter(e.target.value)}
                className="appearance-none rounded-lg pl-3 pr-8 py-1.5 text-[12.5px] focus:outline-none focus:ring-1 focus:ring-blue-500/50"
                style={inputStyle}
              >
                <option value="">Todas as empresas</option>
                {companies.map((c) => (
                  <option key={c.companyId} value={c.companyId}>{c.companyName}</option>
                ))}
              </select>
              <ChevronDown className="pointer-events-none absolute right-2 top-1/2 -translate-y-1/2 h-3.5 w-3.5 text-white/40" />
            </div>
            <span className="ml-auto text-[12px] text-white/30">{heartbeats.length} tablet(s)</span>
          </div>

          {/* Summary cards */}
          {heartbeats.length > 0 && (
            <div className="grid grid-cols-2 gap-3 sm:grid-cols-3">
              {[
                {
                  label: "Online",
                  value: heartbeats.filter(h => isOnline(h.last_seen)).length,
                  color: "#10b981",
                  bg: "rgba(16,185,129,0.1)",
                  border: "rgba(16,185,129,0.2)",
                },
                {
                  label: "Offline",
                  value: heartbeats.filter(h => !isOnline(h.last_seen)).length,
                  color: "#f43f5e",
                  bg: "rgba(244,63,94,0.1)",
                  border: "rgba(244,63,94,0.2)",
                },
                {
                  label: "Fila pendente",
                  value: heartbeats.reduce((s, h) => s + (h.queue_size || 0), 0),
                  color: "#f59e0b",
                  bg: "rgba(245,158,11,0.1)",
                  border: "rgba(245,158,11,0.2)",
                },
              ].map(({ label, value, color, bg, border }) => (
                <div key={label} className="rounded-xl p-4"
                  style={{ background: bg, border: `1px solid ${border}` }}>
                  <p className="text-[11px] font-semibold uppercase tracking-[0.08em] mb-1" style={{ color }}>
                    {label}
                  </p>
                  <p className="text-3xl font-bold text-white tabular-nums">{value}</p>
                </div>
              ))}
            </div>
          )}

          {/* Heartbeats table */}
          <div className="rounded-xl overflow-hidden" style={cardStyle}>
            {loading ? (
              <div className="py-16 flex items-center justify-center gap-3 text-white/40">
                <RefreshCw className="h-4 w-4 animate-spin" />
                <span className="text-[13px]">Carregando...</span>
              </div>
            ) : heartbeats.length === 0 ? (
              <div className="py-16 text-center">
                <Tablet className="h-8 w-8 text-white/15 mx-auto mb-3" />
                <p className="text-white/30 text-[13px]">Nenhum heartbeat recebido ainda.</p>
                <p className="text-white/20 text-[11.5px] mt-1">Os tablets enviam dados a cada 5 minutos.</p>
              </div>
            ) : (
              <div className="overflow-x-auto">
                <table className="w-full text-[12.5px]">
                  <thead>
                    <tr style={{ borderBottom: "1px solid rgba(255,255,255,0.06)" }}>
                      {["Status", "Empresa", "Tablet ID", "Versão", "Uptime", "Bateria", "Fila", "Último contato"].map((h) => (
                        <th key={h} className="px-4 py-3 text-left font-semibold text-white/35 uppercase tracking-[0.07em] text-[10.5px] whitespace-nowrap">
                          {h}
                        </th>
                      ))}
                    </tr>
                  </thead>
                  <tbody>
                    {heartbeats.map((hb, i) => {
                      const online = isOnline(hb.last_seen);
                      const lowBattery = hb.battery !== undefined && hb.battery < 20;
                      return (
                        <tr key={i}
                          className="transition-colors hover:bg-white/[0.02]"
                          style={{ borderBottom: "1px solid rgba(255,255,255,0.04)" }}
                        >
                          {/* Status */}
                          <td className="px-4 py-3">
                            <span className={`inline-flex items-center gap-1.5 px-2.5 py-1 rounded-full text-[11px] font-semibold border ${
                              online
                                ? "bg-emerald-500/15 text-emerald-400 border-emerald-500/25"
                                : "bg-white/[0.05] text-white/35 border-white/[0.08]"
                            }`}>
                              <span className={`w-1.5 h-1.5 rounded-full ${online ? "bg-emerald-400 animate-pulse" : "bg-white/25"}`} />
                              {online ? "Online" : "Offline"}
                            </span>
                          </td>
                          {/* Empresa */}
                          <td className="px-4 py-3 max-w-[180px]">
                            <span className="text-white/80 font-medium truncate block">
                              {companyMap[hb.company_id] || hb.company_id.slice(0, 8) + "…"}
                            </span>
                          </td>
                          {/* Tablet ID */}
                          <td className="px-4 py-3">
                            <span className="font-mono text-[11px] text-white/45">{hb.device_id.slice(0, 20)}</span>
                          </td>
                          {/* Versão */}
                          <td className="px-4 py-3">
                            <span className="font-mono text-[11px] text-white/55">v{hb.version}</span>
                          </td>
                          {/* Uptime */}
                          <td className="px-4 py-3 whitespace-nowrap">
                            <span className="flex items-center gap-1 text-white/55">
                              <Clock className="h-3 w-3" />
                              {fmtUptime(hb.uptime)}
                            </span>
                          </td>
                          {/* Bateria */}
                          <td className="px-4 py-3 whitespace-nowrap">
                            {hb.battery !== undefined ? (
                              <span className={`flex items-center gap-1 font-medium ${lowBattery ? "text-rose-400" : "text-white/55"}`}>
                                {lowBattery ? <BatteryLow className="h-3.5 w-3.5" /> : <Battery className="h-3.5 w-3.5" />}
                                {hb.battery}%
                              </span>
                            ) : (
                              <span className="text-white/20">—</span>
                            )}
                          </td>
                          {/* Fila */}
                          <td className="px-4 py-3">
                            {hb.queue_size > 0 ? (
                              <span className="inline-flex items-center gap-1 px-2 py-0.5 rounded-full text-[11px] font-medium bg-amber-500/15 text-amber-400 border border-amber-500/25">
                                {hb.queue_size} pend.
                              </span>
                            ) : (
                              <span className="text-white/30 text-[11.5px]">vazia</span>
                            )}
                          </td>
                          {/* Último contato */}
                          <td className="px-4 py-3 whitespace-nowrap">
                            <span className={`text-[12px] ${online ? "text-white/55" : "text-white/30"}`}>
                              {timeSince(hb.last_seen)}
                            </span>
                          </td>
                        </tr>
                      );
                    })}
                  </tbody>
                </table>
              </div>
            )}
          </div>
        </>
      )}
    </div>
  );
}
