import React, { useEffect, useState, useMemo } from "react";
import {
  Building2,
  Users,
  AlertCircle,
  CheckCircle2,
  XCircle,
  Plus,
  Search,
  Eye,
  UserPlus,
  X,
  Loader2,
  Activity,
  CreditCard,
  ChevronUp,
  ChevronDown,
  Clock,
  FileText,
} from "lucide-react";
import { toast } from "sonner";
import {
  fetchCompanies,
  fetchCompanyDetails,
  createCompany,
  createCompanyEmployee,
  updateCompany,
  type CompanySummary,
  type CompanyStatus,
} from "../../services/api";

// ── helpers ──────────────────────────────────────────────────────────────────

const currentMonth = () => {
  const now = new Date();
  return `${now.getFullYear()}-${String(now.getMonth() + 1).padStart(2, "0")}`;
};

const statusLabel: Record<CompanyStatus, string> = {
  active: "Ativo",
  inactive: "Inativo",
  suspended: "Suspenso",
  deleted: "Excluído",
};

const statusColor: Record<CompanyStatus, string> = {
  active: "bg-emerald-500/15 text-emerald-400 border-emerald-500/25",
  inactive: "bg-white/10 text-white/45 border-white/15",
  suspended: "bg-amber-500/15 text-amber-400 border-amber-500/25",
  deleted: "bg-red-500/15 text-red-400 border-red-500/25",
};

function healthScore(c: CompanySummary, month: string): "good" | "warn" | "bad" {
  const paid = c.payments?.[month] === true;
  const active = c.status === "active";
  const hasEmployees = c.activeEmployees > 0;
  if (active && paid && hasEmployees) return "good";
  if (active && (paid || hasEmployees)) return "warn";
  return "bad";
}

const healthDot: Record<string, string> = {
  good: "bg-emerald-400 shadow-[0_0_6px_rgba(52,211,153,0.7)]",
  warn: "bg-amber-400 shadow-[0_0_6px_rgba(251,191,36,0.7)]",
  bad: "bg-red-400 shadow-[0_0_6px_rgba(239,68,68,0.7)]",
};

function formatDate(d: string) {
  if (!d) return "—";
  try {
    return new Intl.DateTimeFormat("pt-BR", { day: "2-digit", month: "short", year: "2-digit" }).format(new Date(d));
  } catch {
    return d.slice(0, 10);
  }
}

// ── modal forms ───────────────────────────────────────────────────────────────

interface CreateCompanyModalProps {
  onClose: () => void;
  onCreated: (c: CompanySummary) => void;
}

function CreateCompanyModal({ onClose, onCreated }: CreateCompanyModalProps) {
  const [form, setForm] = useState({
    userId: "", email: "", companyName: "", expectedEmployees: "", password: "", confirmPassword: "",
  });
  const [saving, setSaving] = useState(false);

  const field = (k: keyof typeof form) => (e: React.ChangeEvent<HTMLInputElement>) =>
    setForm((f) => ({ ...f, [k]: e.target.value }));

  async function handleSubmit(e: React.FormEvent) {
    e.preventDefault();
    if (form.password !== form.confirmPassword) { toast.error("Senhas não conferem"); return; }
    setSaving(true);
    try {
      const company = await createCompany({
        userId: form.userId,
        email: form.email,
        companyName: form.companyName,
        expectedEmployees: form.expectedEmployees ? Number(form.expectedEmployees) : 0,
        password: form.password,
        confirmPassword: form.confirmPassword,
      });
      toast.success(`Empresa "${company.companyName}" criada!`);
      onCreated(company);
    } catch (err) {
      toast.error(err instanceof Error ? err.message : "Erro ao criar empresa");
    } finally {
      setSaving(false);
    }
  }

  return (
    <div className="fixed inset-0 z-50 flex items-center justify-center p-4 bg-black/60 backdrop-blur-sm">
      <div
        className="w-full max-w-lg rounded-2xl border border-white/10 shadow-2xl"
        style={{ background: "rgba(8,18,60,0.97)" }}
      >
        <div className="flex items-center justify-between px-6 py-5 border-b border-white/[0.08]">
          <div>
            <p className="text-[15px] font-bold text-white">Novo Cliente</p>
            <p className="text-[11.5px] text-white/40 mt-0.5">Criar conta UserCompany</p>
          </div>
          <button onClick={onClose} className="p-1.5 rounded-lg text-white/35 hover:text-white/80 hover:bg-white/[0.06] transition-all">
            <X className="h-4 w-4" />
          </button>
        </div>
        <form onSubmit={handleSubmit} className="px-6 py-5 space-y-4">
          <div className="grid grid-cols-2 gap-3">
            <div className="flex flex-col gap-1.5">
              <label className="text-[11px] font-semibold uppercase tracking-wide text-white/40">User ID *</label>
              <input required value={form.userId} onChange={field("userId")}
                className="input-glass" placeholder="ex: joaosilva" />
            </div>
            <div className="flex flex-col gap-1.5">
              <label className="text-[11px] font-semibold uppercase tracking-wide text-white/40">E-mail *</label>
              <input required type="email" value={form.email} onChange={field("email")}
                className="input-glass" placeholder="email@empresa.com" />
            </div>
          </div>
          <div className="grid grid-cols-2 gap-3">
            <div className="col-span-2 flex flex-col gap-1.5">
              <label className="text-[11px] font-semibold uppercase tracking-wide text-white/40">Nome da Empresa *</label>
              <input required value={form.companyName} onChange={field("companyName")}
                className="input-glass" placeholder="Minha Empresa Ltda" />
            </div>
          </div>
          <div className="flex flex-col gap-1.5">
            <label className="text-[11px] font-semibold uppercase tracking-wide text-white/40">Funcionários Previstos</label>
            <input type="number" min="0" value={form.expectedEmployees} onChange={field("expectedEmployees")}
              className="input-glass" placeholder="0" />
          </div>
          <div className="grid grid-cols-2 gap-3">
            <div className="flex flex-col gap-1.5">
              <label className="text-[11px] font-semibold uppercase tracking-wide text-white/40">Senha *</label>
              <input required type="password" value={form.password} onChange={field("password")}
                className="input-glass" placeholder="••••••" />
            </div>
            <div className="flex flex-col gap-1.5">
              <label className="text-[11px] font-semibold uppercase tracking-wide text-white/40">Confirmar Senha *</label>
              <input required type="password" value={form.confirmPassword} onChange={field("confirmPassword")}
                className="input-glass" placeholder="••••••" />
            </div>
          </div>
          <div className="flex gap-2 pt-2">
            <button type="button" onClick={onClose}
              className="flex-1 py-2.5 rounded-xl text-[13px] font-medium text-white/50 border border-white/[0.08] hover:bg-white/[0.04] transition-all">
              Cancelar
            </button>
            <button type="submit" disabled={saving}
              className="flex-1 py-2.5 rounded-xl text-[13px] font-semibold text-white flex items-center justify-center gap-2 transition-all"
              style={{ background: "linear-gradient(90deg,#3b82f6,#2563eb)" }}>
              {saving ? <Loader2 className="h-4 w-4 animate-spin" /> : <Plus className="h-4 w-4" />}
              {saving ? "Criando..." : "Criar Empresa"}
            </button>
          </div>
        </form>
      </div>
    </div>
  );
}

interface CreateEmployeeModalProps {
  company: CompanySummary;
  onClose: () => void;
  onCreated: () => void;
}

function CreateEmployeeModal({ company, onClose, onCreated }: CreateEmployeeModalProps) {
  const [form, setForm] = useState({ nome: "", email: "", cargo: "", password: "" });
  const [saving, setSaving] = useState(false);

  const field = (k: keyof typeof form) => (e: React.ChangeEvent<HTMLInputElement>) =>
    setForm((f) => ({ ...f, [k]: e.target.value }));

  async function handleSubmit(e: React.FormEvent) {
    e.preventDefault();
    setSaving(true);
    try {
      await createCompanyEmployee(company.companyId, form);
      toast.success(`Funcionário "${form.nome}" adicionado!`);
      onCreated();
    } catch (err) {
      toast.error(err instanceof Error ? err.message : "Erro ao criar funcionário");
    } finally {
      setSaving(false);
    }
  }

  return (
    <div className="fixed inset-0 z-50 flex items-center justify-center p-4 bg-black/60 backdrop-blur-sm">
      <div
        className="w-full max-w-md rounded-2xl border border-white/10 shadow-2xl"
        style={{ background: "rgba(8,18,60,0.97)" }}
      >
        <div className="flex items-center justify-between px-6 py-5 border-b border-white/[0.08]">
          <div>
            <p className="text-[15px] font-bold text-white">Adicionar Funcionário</p>
            <p className="text-[11.5px] text-white/40 mt-0.5 truncate max-w-[240px]">{company.companyName}</p>
          </div>
          <button onClick={onClose} className="p-1.5 rounded-lg text-white/35 hover:text-white/80 hover:bg-white/[0.06] transition-all">
            <X className="h-4 w-4" />
          </button>
        </div>
        <form onSubmit={handleSubmit} className="px-6 py-5 space-y-4">
          <div className="flex flex-col gap-1.5">
            <label className="text-[11px] font-semibold uppercase tracking-wide text-white/40">Nome Completo *</label>
            <input required value={form.nome} onChange={field("nome")} className="input-glass" placeholder="João da Silva" />
          </div>
          <div className="grid grid-cols-2 gap-3">
            <div className="flex flex-col gap-1.5">
              <label className="text-[11px] font-semibold uppercase tracking-wide text-white/40">E-mail *</label>
              <input required type="email" value={form.email} onChange={field("email")} className="input-glass" placeholder="joao@empresa.com" />
            </div>
            <div className="flex flex-col gap-1.5">
              <label className="text-[11px] font-semibold uppercase tracking-wide text-white/40">Cargo *</label>
              <input required value={form.cargo} onChange={field("cargo")} className="input-glass" placeholder="Analista" />
            </div>
          </div>
          <div className="flex flex-col gap-1.5">
            <label className="text-[11px] font-semibold uppercase tracking-wide text-white/40">Senha *</label>
            <input required type="password" value={form.password} onChange={field("password")} className="input-glass" placeholder="••••••" />
          </div>
          <div className="flex gap-2 pt-2">
            <button type="button" onClick={onClose}
              className="flex-1 py-2.5 rounded-xl text-[13px] font-medium text-white/50 border border-white/[0.08] hover:bg-white/[0.04] transition-all">
              Cancelar
            </button>
            <button type="submit" disabled={saving}
              className="flex-1 py-2.5 rounded-xl text-[13px] font-semibold text-white flex items-center justify-center gap-2 transition-all"
              style={{ background: "linear-gradient(90deg,#10b981,#059669)" }}>
              {saving ? <Loader2 className="h-4 w-4 animate-spin" /> : <UserPlus className="h-4 w-4" />}
              {saving ? "Adicionando..." : "Adicionar"}
            </button>
          </div>
        </form>
      </div>
    </div>
  );
}

// ── edit company modal ────────────────────────────────────────────────────────

interface EditCompanyModalProps {
  company: CompanySummary;
  onClose: () => void;
  onSaved: (updated: Partial<CompanySummary>) => void;
}

function EditCompanyModal({ company, onClose, onSaved }: EditCompanyModalProps) {
  const [loading, setLoading] = React.useState(true);
  const [saving, setSaving] = React.useState(false);
  const [form, setForm] = React.useState({
    empresa_nome: company.companyName,
    status: company.status as CompanyStatus,
    rh_enabled: company.rh_enabled ?? false,
  });

  React.useEffect(() => {
    fetchCompanyDetails(company.companyId)
      .then(details => {
        setForm({
          empresa_nome: details.companyName,
          status: details.status,
          rh_enabled: details.rh_enabled ?? false,
        });
      })
      .catch(() => {})
      .finally(() => setLoading(false));
  }, [company.companyId]);

  async function handleSave(e: React.FormEvent) {
    e.preventDefault();
    setSaving(true);
    try {
      await updateCompany(company.companyId, form);
      toast.success("Empresa atualizada");
      onSaved({ companyName: form.empresa_nome, status: form.status, rh_enabled: form.rh_enabled });
      onClose();
    } catch (err) {
      toast.error(err instanceof Error ? err.message : "Erro ao salvar");
    } finally {
      setSaving(false);
    }
  }

  return (
    <div className="fixed inset-0 z-50 flex items-center justify-center p-4 bg-black/60 backdrop-blur-sm">
      <div className="w-full max-w-lg rounded-2xl border border-white/10 shadow-2xl" style={{ background: "rgba(8,18,60,0.97)" }}>
        <div className="flex items-center justify-between px-6 py-5 border-b border-white/[0.08]">
          <div>
            <p className="text-[15px] font-bold text-white">Editar Empresa</p>
            <p className="text-[11.5px] text-white/40 mt-0.5 truncate max-w-[260px]">{company.companyId}</p>
          </div>
          <button onClick={onClose} className="p-1.5 rounded-lg text-white/35 hover:text-white/80 hover:bg-white/[0.06] transition-all">
            <X className="h-4 w-4" />
          </button>
        </div>

        {loading ? (
          <div className="flex justify-center items-center py-12">
            <Loader2 className="h-6 w-6 animate-spin text-white/30" />
          </div>
        ) : (
          <form onSubmit={handleSave} className="px-6 py-5 space-y-4">
            {/* Info row */}
            <div className="grid grid-cols-2 gap-3 py-3 px-4 rounded-xl" style={{ background: "rgba(255,255,255,0.04)" }}>
              <div>
                <p className="text-[10px] uppercase tracking-wider text-white/30 font-semibold">Criada em</p>
                <p className="text-[13px] text-white/70 mt-0.5">{formatDate(company.dateCreated)}</p>
              </div>
              <div>
                <p className="text-[10px] uppercase tracking-wider text-white/30 font-semibold">Funcionários</p>
                <p className="text-[13px] text-white/70 mt-0.5">{company.activeEmployees}</p>
              </div>
              <div>
                <p className="text-[10px] uppercase tracking-wider text-white/30 font-semibold">E-mail</p>
                <p className="text-[13px] text-white/70 mt-0.5 truncate">{company.email}</p>
              </div>
              <div>
                <p className="text-[10px] uppercase tracking-wider text-white/30 font-semibold">Registros</p>
                <p className="text-[13px] text-white/70 mt-0.5">{(company.recordsCount ?? 0).toLocaleString("pt-BR")}</p>
              </div>
            </div>

            <div className="flex flex-col gap-1.5">
              <label className="text-[11px] font-semibold uppercase tracking-wide text-white/40">Nome da Empresa *</label>
              <input
                required
                value={form.empresa_nome}
                onChange={e => setForm(f => ({ ...f, empresa_nome: e.target.value }))}
                className="input-glass"
              />
            </div>

            <div className="flex flex-col gap-1.5">
              <label className="text-[11px] font-semibold uppercase tracking-wide text-white/40">Status</label>
              <select
                value={form.status}
                onChange={e => setForm(f => ({ ...f, status: e.target.value as CompanyStatus }))}
                className="bg-white/[0.05] border border-white/[0.08] rounded-xl px-3 py-2.5 text-[13px] text-white/75 focus:outline-none focus:border-blue-500/50 transition-all"
              >
                <option value="active">Ativo</option>
                <option value="inactive">Inativo</option>
                <option value="suspended">Suspenso</option>
              </select>
            </div>

            <div className="flex items-center justify-between rounded-xl px-4 py-3 border border-white/[0.08]" style={{ background: "rgba(255,255,255,0.03)" }}>
              <div>
                <p className="text-[13px] font-semibold text-white/80">RH / Folha</p>
                <p className="text-[11px] text-white/35 mt-0.5">Habilita o módulo de pré-folha (Plano Plus)</p>
              </div>
              <button
                type="button"
                onClick={() => setForm(f => ({ ...f, rh_enabled: !f.rh_enabled }))}
                className={`relative inline-flex h-6 w-11 items-center rounded-full transition-colors ${form.rh_enabled ? "bg-emerald-500" : "bg-white/20"}`}
              >
                <span className={`inline-block h-4 w-4 transform rounded-full bg-white shadow-sm transition-transform ${form.rh_enabled ? "translate-x-6" : "translate-x-1"}`} />
              </button>
            </div>

            <div className="flex gap-2 pt-1">
              <button type="button" onClick={onClose}
                className="flex-1 py-2.5 rounded-xl text-[13px] font-medium text-white/50 border border-white/[0.08] hover:bg-white/[0.04] transition-all">
                Cancelar
              </button>
              <button type="submit" disabled={saving}
                className="flex-1 py-2.5 rounded-xl text-[13px] font-semibold text-white flex items-center justify-center gap-2 transition-all"
                style={{ background: "linear-gradient(90deg,#3b82f6,#2563eb)" }}>
                {saving ? <Loader2 className="h-4 w-4 animate-spin" /> : null}
                {saving ? "Salvando..." : "Salvar alterações"}
              </button>
            </div>
          </form>
        )}
      </div>
    </div>
  );
}

// ── main page ─────────────────────────────────────────────────────────────────

type SortKey = "companyName" | "status" | "activeEmployees" | "recordsCount" | "dateCreated" | "health";

export function ClientsPage() {
  const [companies, setCompanies] = useState<CompanySummary[]>([]);
  const [loading, setLoading] = useState(true);
  const [search, setSearch] = useState("");
  const [filterStatus, setFilterStatus] = useState<CompanyStatus | "all">("all");
  const [filterPayment, setFilterPayment] = useState<"all" | "paid" | "unpaid">("all");
  const [sortKey, setSortKey] = useState<SortKey>("dateCreated");
  const [sortDir, setSortDir] = useState<"asc" | "desc">("desc");
  const [month, setMonth] = useState(currentMonth);
  const [showCreateCompany, setShowCreateCompany] = useState(false);
  const [employeeTarget, setEmployeeTarget] = useState<CompanySummary | null>(null);
  const [editTarget, setEditTarget] = useState<CompanySummary | null>(null);

  async function load() {
    setLoading(true);
    try {
      const data = await fetchCompanies();
      setCompanies(data);
    } catch {
      toast.error("Erro ao carregar clientes");
    } finally {
      setLoading(false);
    }
  }

  useEffect(() => { load(); }, []);

  // ── KPIs ──────────────────────────────────────────────────────────────────
  const kpis = useMemo(() => {
    const total = companies.length;
    const active = companies.filter((c) => c.status === "active").length;
    const paid = companies.filter((c) => c.payments?.[month] === true).length;
    const totalEmp = companies.reduce((s, c) => s + (c.activeEmployees || 0), 0);
    const totalRecords = companies.reduce((s, c) => s + (c.recordsCount || 0), 0);
    const atRisk = companies.filter((c) => healthScore(c, month) === "bad").length;
    return { total, active, inactive: total - active, paid, unpaid: total - paid, totalEmp, totalRecords, atRisk };
  }, [companies, month]);

  // ── filtered + sorted ─────────────────────────────────────────────────────
  const rows = useMemo(() => {
    let list = companies.filter((c) => {
      const q = search.toLowerCase();
      const matchSearch = !q || c.companyName.toLowerCase().includes(q) || c.email.toLowerCase().includes(q) || c.userId.toLowerCase().includes(q);
      const matchStatus = filterStatus === "all" || c.status === filterStatus;
      const isPaid = c.payments?.[month] === true;
      const matchPay = filterPayment === "all" || (filterPayment === "paid" ? isPaid : !isPaid);
      return matchSearch && matchStatus && matchPay;
    });

    list.sort((a, b) => {
      let va: string | number, vb: string | number;
      switch (sortKey) {
        case "companyName": va = a.companyName.toLowerCase(); vb = b.companyName.toLowerCase(); break;
        case "status": va = a.status; vb = b.status; break;
        case "activeEmployees": va = a.activeEmployees; vb = b.activeEmployees; break;
        case "recordsCount": va = a.recordsCount ?? 0; vb = b.recordsCount ?? 0; break;
        case "dateCreated": va = a.dateCreated; vb = b.dateCreated; break;
        case "health": {
          const order = { good: 0, warn: 1, bad: 2 };
          va = order[healthScore(a, month)];
          vb = order[healthScore(b, month)];
          break;
        }
      }
      if (va < vb) return sortDir === "asc" ? -1 : 1;
      if (va > vb) return sortDir === "asc" ? 1 : -1;
      return 0;
    });

    return list;
  }, [companies, search, filterStatus, filterPayment, sortKey, sortDir, month]);

  function toggleSort(k: SortKey) {
    if (sortKey === k) setSortDir((d) => (d === "asc" ? "desc" : "asc"));
    else { setSortKey(k); setSortDir("asc"); }
  }

  function SortIcon({ k }: { k: SortKey }) {
    if (sortKey !== k) return <ChevronUp className="h-3 w-3 opacity-20" />;
    return sortDir === "asc" ? <ChevronUp className="h-3 w-3 text-blue-400" /> : <ChevronDown className="h-3 w-3 text-blue-400" />;
  }

  // ── skeleton ──────────────────────────────────────────────────────────────
  if (loading) {
    return (
      <div className="space-y-5">
        <div className="grid grid-cols-2 md:grid-cols-4 xl:grid-cols-5 gap-3">
          {Array.from({ length: 5 }).map((_, i) => (
            <div key={i} className="h-24 rounded-2xl animate-pulse" style={{ background: "rgba(255,255,255,0.05)" }} />
          ))}
        </div>
        <div className="h-96 rounded-2xl animate-pulse" style={{ background: "rgba(255,255,255,0.04)" }} />
      </div>
    );
  }

  return (
    <>
      {showCreateCompany && (
        <CreateCompanyModal
          onClose={() => setShowCreateCompany(false)}
          onCreated={(c) => { setCompanies((prev) => [c, ...prev]); setShowCreateCompany(false); }}
        />
      )}
      {employeeTarget && (
        <CreateEmployeeModal
          company={employeeTarget}
          onClose={() => setEmployeeTarget(null)}
          onCreated={() => { setEmployeeTarget(null); load(); }}
        />
      )}
      {editTarget && (
        <EditCompanyModal
          company={editTarget}
          onClose={() => setEditTarget(null)}
          onSaved={updated => {
            setCompanies(prev => prev.map(c =>
              c.companyId === editTarget.companyId ? { ...c, ...updated } : c
            ));
            setEditTarget(null);
          }}
        />
      )}

      <div className="space-y-5">

        {/* ── header ── */}
        <div className="flex flex-col sm:flex-row sm:items-end justify-between gap-4">
          <div>
            <h1 className="text-[28px] font-bold text-white leading-none">Clientes</h1>
            <p className="mt-1 text-[13px] text-white/40">{kpis.total} contas cadastradas · {kpis.active} ativas</p>
          </div>
          <button
            onClick={() => setShowCreateCompany(true)}
            className="flex items-center gap-2 px-4 py-2.5 rounded-xl text-[13px] font-semibold text-white transition-all hover:opacity-90 active:scale-95"
            style={{ background: "linear-gradient(90deg,#3b82f6,#2563eb)" }}
          >
            <Plus className="h-4 w-4" />
            Novo Cliente
          </button>
        </div>

        {/* ── KPI cards ── */}
        <div className="grid grid-cols-2 md:grid-cols-3 xl:grid-cols-6 gap-3">
          {[
            { icon: Building2, label: "Total Clientes", value: kpis.total, color: "#3b82f6", sub: `${kpis.active} ativos` },
            { icon: CheckCircle2, label: "Adimplentes", value: kpis.paid, color: "#10b981", sub: `em ${month}` },
            { icon: XCircle, label: "Inadimplentes", value: kpis.unpaid, color: "#ef4444", sub: `em ${month}` },
            { icon: Users, label: "Funcionários", value: kpis.totalEmp, color: "#a78bfa", sub: "ativos totais" },
            { icon: FileText, label: "Registros", value: kpis.totalRecords, color: "#06b6d4", sub: "pontos totais" },
            { icon: AlertCircle, label: "Em Risco", value: kpis.atRisk, color: "#f59e0b", sub: "saúde ruim" },
          ].map(({ icon: Icon, label, value, color, sub }) => (
            <div
              key={label}
              className="rounded-2xl border border-white/[0.07] p-4"
              style={{ background: "rgba(255,255,255,0.04)" }}
            >
              <div className="flex items-start justify-between gap-2">
                <div
                  className="flex h-9 w-9 flex-shrink-0 items-center justify-center rounded-xl"
                  style={{ background: `${color}18`, border: `1px solid ${color}28` }}
                >
                  <Icon className="h-4.5 w-4.5" style={{ color }} />
                </div>
                <span className="text-[10px] font-medium text-white/30 text-right leading-tight">{sub}</span>
              </div>
              <p className="mt-3 text-[28px] font-bold text-white leading-none">{value}</p>
              <p className="mt-1 text-[11.5px] text-white/45">{label}</p>
            </div>
          ))}
        </div>

        {/* ── filters bar ── */}
        <div
          className="flex flex-col md:flex-row gap-3 rounded-2xl border border-white/[0.07] p-4"
          style={{ background: "rgba(255,255,255,0.03)" }}
        >
          <div className="relative flex-1">
            <Search className="absolute left-3 top-1/2 -translate-y-1/2 h-4 w-4 text-white/30 pointer-events-none" />
            <input
              value={search}
              onChange={(e) => setSearch(e.target.value)}
              placeholder="Buscar por nome, e-mail ou user ID..."
              className="w-full bg-white/[0.05] border border-white/[0.08] rounded-xl pl-9 pr-3 py-2.5 text-[13px] text-white placeholder-white/25 focus:outline-none focus:border-blue-500/50 focus:bg-white/[0.07] transition-all"
            />
          </div>
          <select
            value={filterStatus}
            onChange={(e) => setFilterStatus(e.target.value as CompanyStatus | "all")}
            className="bg-white/[0.05] border border-white/[0.08] rounded-xl px-3 py-2.5 text-[13px] text-white/75 focus:outline-none focus:border-blue-500/50 transition-all"
          >
            <option value="all">Todos os status</option>
            <option value="active">Ativo</option>
            <option value="suspended">Suspenso</option>
            <option value="inactive">Inativo</option>
            <option value="deleted">Excluído</option>
          </select>
          <select
            value={filterPayment}
            onChange={(e) => setFilterPayment(e.target.value as "all" | "paid" | "unpaid")}
            className="bg-white/[0.05] border border-white/[0.08] rounded-xl px-3 py-2.5 text-[13px] text-white/75 focus:outline-none focus:border-blue-500/50 transition-all"
          >
            <option value="all">Todos os pagamentos</option>
            <option value="paid">Pago</option>
            <option value="unpaid">Não pago</option>
          </select>
          <input
            type="month"
            value={month}
            onChange={(e) => setMonth(e.target.value)}
            className="bg-white/[0.05] border border-white/[0.08] rounded-xl px-3 py-2.5 text-[13px] text-white/75 focus:outline-none focus:border-blue-500/50 transition-all"
          />
        </div>

        {/* ── table ── */}
        <div
          className="rounded-2xl border border-white/[0.07] overflow-hidden"
          style={{ background: "rgba(255,255,255,0.03)" }}
        >
          <div className="overflow-x-auto">
            <table className="w-full text-[13px]">
              <thead>
                <tr className="border-b border-white/[0.06]">
                  {[
                    { label: "Saúde", k: "health" as SortKey, w: "w-16" },
                    { label: "Empresa", k: "companyName" as SortKey, w: "min-w-[180px]" },
                    { label: "Status", k: "status" as SortKey, w: "w-28" },
                    { label: "Funcionários", k: "activeEmployees" as SortKey, w: "w-36" },
                    { label: "Registros", k: "recordsCount" as SortKey, w: "w-28" },
                    { label: "Pagamento", k: null, w: "w-28" },
                    { label: "Cadastro", k: "dateCreated" as SortKey, w: "w-28" },
                    { label: "", k: null, w: "w-24" },
                  ].map(({ label, k, w }) => (
                    <th
                      key={label}
                      onClick={() => k && toggleSort(k)}
                      className={`px-4 py-3 text-left text-[10.5px] font-bold uppercase tracking-[0.08em] text-white/30 select-none ${w} ${k ? "cursor-pointer hover:text-white/55 transition-colors" : ""}`}
                    >
                      <span className="flex items-center gap-1">
                        {label}
                        {k && <SortIcon k={k} />}
                      </span>
                    </th>
                  ))}
                </tr>
              </thead>
              <tbody>
                {rows.length === 0 ? (
                  <tr>
                    <td colSpan={8} className="px-4 py-12 text-center text-white/30 text-[13px]">
                      Nenhum cliente encontrado
                    </td>
                  </tr>
                ) : (
                  rows.map((c, i) => {
                    const hs = healthScore(c, month);
                    const isPaid = c.payments?.[month] === true;
                    const fillPct = c.expectedEmployees > 0
                      ? Math.min(100, Math.round((c.activeEmployees / c.expectedEmployees) * 100))
                      : 0;

                    return (
                      <tr
                        key={c.companyId}
                        className={`border-b border-white/[0.04] transition-colors hover:bg-white/[0.025] ${i % 2 === 0 ? "" : "bg-white/[0.01]"}`}
                      >
                        {/* health dot */}
                        <td className="px-4 py-3.5">
                          <div className="flex justify-center">
                            <span className={`h-2.5 w-2.5 rounded-full ${healthDot[hs]}`} title={hs === "good" ? "Saudável" : hs === "warn" ? "Atenção" : "Risco"} />
                          </div>
                        </td>

                        {/* name + email */}
                        <td className="px-4 py-3.5">
                          <p className="font-semibold text-white/90 truncate max-w-[200px]">{c.companyName}</p>
                          <p className="text-[11px] text-white/35 truncate max-w-[200px] mt-0.5">{c.email}</p>
                        </td>

                        {/* status badge */}
                        <td className="px-4 py-3.5">
                          <span className={`inline-flex items-center rounded-full border px-2.5 py-0.5 text-[11px] font-medium ${statusColor[c.status]}`}>
                            {statusLabel[c.status]}
                          </span>
                        </td>

                        {/* employees + progress */}
                        <td className="px-4 py-3.5">
                          <div className="flex items-center gap-2">
                            <span className="text-white/75 tabular-nums">
                              {c.activeEmployees}
                              {c.expectedEmployees > 0 && (
                                <span className="text-white/30"> / {c.expectedEmployees}</span>
                              )}
                            </span>
                          </div>
                          {c.expectedEmployees > 0 && (
                            <div className="mt-1 h-1 w-20 rounded-full bg-white/[0.08]">
                              <div
                                className="h-1 rounded-full transition-all"
                                style={{ width: `${fillPct}%`, background: fillPct > 80 ? "#10b981" : fillPct > 40 ? "#3b82f6" : "#f59e0b" }}
                              />
                            </div>
                          )}
                        </td>

                        {/* records count */}
                        <td className="px-4 py-3.5">
                          <span className="flex items-center gap-1.5 text-white/70 tabular-nums text-[13px]">
                            <FileText className="h-3 w-3 text-cyan-400/60 flex-shrink-0" />
                            {(c.recordsCount ?? 0).toLocaleString("pt-BR")}
                          </span>
                        </td>

                        {/* payment */}
                        <td className="px-4 py-3.5">
                          <span className={`inline-flex items-center gap-1 rounded-full border px-2.5 py-0.5 text-[11px] font-medium ${isPaid ? "bg-emerald-500/15 text-emerald-400 border-emerald-500/25" : "bg-white/[0.06] text-white/35 border-white/[0.1]"}`}>
                            <CreditCard className="h-3 w-3" />
                            {isPaid ? "Pago" : "Pendente"}
                          </span>
                        </td>

                        {/* date */}
                        <td className="px-4 py-3.5">
                          <span className="flex items-center gap-1.5 text-white/40 text-[12px]">
                            <Clock className="h-3 w-3" />
                            {formatDate(c.dateCreated)}
                          </span>
                        </td>

                        {/* actions */}
                        <td className="px-4 py-3.5">
                          <div className="flex items-center gap-1">
                            <button
                              onClick={() => setEditTarget(c)}
                              title="Ver / editar empresa"
                              className="flex h-7 w-7 items-center justify-center rounded-lg text-white/30 hover:bg-blue-500/15 hover:text-blue-400 transition-all"
                            >
                              <Eye className="h-3.5 w-3.5" />
                            </button>
                            <button
                              onClick={() => setEmployeeTarget(c)}
                              title="Adicionar funcionário"
                              className="flex h-7 w-7 items-center justify-center rounded-lg text-white/30 hover:bg-emerald-500/15 hover:text-emerald-400 transition-all"
                            >
                              <UserPlus className="h-3.5 w-3.5" />
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

          {/* footer */}
          <div className="flex items-center justify-between px-4 py-3 border-t border-white/[0.05]">
            <span className="text-[11.5px] text-white/30">
              {rows.length} de {companies.length} clientes
            </span>
            <div className="flex items-center gap-1.5 text-[11.5px] text-white/30">
              <Activity className="h-3 w-3" />
              <span>{kpis.active} ativos · {kpis.paid} adimplentes · {kpis.atRisk} em risco</span>
            </div>
          </div>
        </div>

      </div>
    </>
  );
}
