// Dev: VITE_API_URL vazio → URL relativa → proxy Vite encaminha para Flask local
// Prod: VITE_API_URL preenchido via secret no GitHub Actions
const API_URL = (import.meta.env.VITE_API_URL as string) ?? "";

export type CompanyStatus = "active" | "inactive" | "suspended" | "deleted";

export interface Payment {
  [monthYear: string]: boolean; // true = paid, false = not paid. Format: "2025-12"
}

export interface CompanySummary {
  companyId: string;
  companyName: string;
  email: string;
  status: CompanyStatus;
  dateCreated: string;
  userId: string;
  activeEmployees: number;
  expectedEmployees: number;
  payments: Payment;
  recordsCount?: number;
  senha?: string;
  rh_enabled?: boolean;
  plano?: string;
}

export interface CreateCompanyPayload {
  userId: string;
  companyName: string;
  email: string;
  password: string;
  confirmPassword: string;
  expectedEmployees?: number;
}

export interface CreateEmployeePayload {
  nome: string;
  email: string;
  cargo: string;
  password: string;
}

export interface DashboardStats {
  totalCompanies: number;
  totalEmployees: number;
  totalTimeEntries: number;
  activeCompanies: number;
  inactiveCompanies: number;
  lastCreatedCompanies: Array<Pick<CompanySummary, "companyId" | "companyName" | "dateCreated" | "status">>;
  paidCompanies: number;
  unpaidCompanies: number;
}

export interface CompanyEmployee {
  id: string;
  nome: string;
  cargo: string;
  email: string;
  ativo: boolean;
  empresa_nome: string;
  data_cadastro: string;
  face_id?: string;
  foto_url?: string;
  home_office?: boolean;
  horario_entrada?: string;
  horario_saida?: string;
  is_active?: boolean;
}

export interface CompanyRecord {
  registro_id: string;
  employee_id: string;
  funcionario_id: string;
  company_id: string;
  tipo: "entrada" | "saida";
  data_hora: string;
  empresa_nome: string;
}

// ── AWS types ────────────────────────────────────────────────────────────────

export interface DynamoTableStat {
  label: string;
  table_name: string;
  item_count: number;
  size_bytes: number;
  size_mb: number;
  status: string;
  billing_mode: string;
  error?: string;
}

export interface AwsMetrics {
  region: string;
  timestamp: string;
  dynamodb: {
    tables: DynamoTableStat[];
    total_items: number;
    total_size_bytes: number;
    total_size_mb: number;
  };
  s3: {
    bucket: string;
    size_bytes: number;
    size_gb: number;
    size_mb: number;
    object_count: number;
    error?: string;
  };
  rekognition: {
    collection: string;
    face_count: number;
    face_model_version: string;
    creation_timestamp: string;
    error?: string;
  };
}

export interface AwsServiceCost {
  service: string;
  full_name?: string;
  cost: number;
}

export interface AwsMonthCost {
  month: string;
  services: AwsServiceCost[];
  total: number;
}

export interface AwsCosts {
  monthly_costs: AwsMonthCost[];
  current_month: {
    month: string;
    total: number;
    services: AwsServiceCost[];
  } | null;
  currency: string;
  error: string | null;
  error_hint?: string;
}

export interface CompanyAwsUsage {
  company_id: string;
  employee_count: number | null;
  record_count: number | null;
  s3_objects: number | null;
  s3_size_bytes: number | null;
  s3_size_mb: number | null;
  rekognition_faces: number | null;
}

// ── helpers ──────────────────────────────────────────────────────────────────

function getHeaders(): Record<string, string> {
  const headers: Record<string, string> = { "Content-Type": "application/json" };
  try {
    const raw = localStorage.getItem("rp_admin_portal_session");
    if (raw) {
      const session = JSON.parse(raw) as { token?: string };
      if (session?.token) headers["Authorization"] = `Bearer ${session.token}`;
    }
  } catch { /* ignore */ }
  return headers;
}

async function fetchFromBackend(endpoint: string, options?: RequestInit) {
  const response = await fetch(`${API_URL}${endpoint}`, {
    ...options,
    headers: { ...getHeaders(), ...options?.headers },
  });

  if (response.status === 401) {
    localStorage.removeItem("rp_admin_portal_session");
    window.location.href = "/login";
    throw new Error("Sessão expirada");
  }

  if (!response.ok) {
    const error = await response.json().catch(() => ({ error: "Erro desconhecido" }));
    throw new Error(error.error || `Erro na requisição: ${response.status}`);
  }

  return response.json();
}

// ── Dashboard ────────────────────────────────────────────────────────────────

export async function fetchDashboardStats(): Promise<DashboardStats> {
  try {
    const response = await fetchFromBackend("/api/admin/dashboard/stats");
    return {
      totalCompanies: response.totalCompanies || 0,
      totalEmployees: response.totalEmployees || 0,
      totalTimeEntries: response.totalTimeEntries || 0,
      activeCompanies: response.activeCompanies || 0,
      inactiveCompanies: response.inactiveCompanies || 0,
      lastCreatedCompanies: response.lastCreatedCompanies || [],
      paidCompanies: response.paidCompanies || 0,
      unpaidCompanies: response.unpaidCompanies || 0,
    };
  } catch (error) {
    console.error("Erro ao buscar estatísticas do dashboard:", error);
    return {
      totalCompanies: 0,
      totalEmployees: 0,
      totalTimeEntries: 0,
      activeCompanies: 0,
      inactiveCompanies: 0,
      lastCreatedCompanies: [],
      paidCompanies: 0,
      unpaidCompanies: 0,
    };
  }
}

// ── Companies ────────────────────────────────────────────────────────────────

export async function fetchCompanies(): Promise<CompanySummary[]> {
  try {
    const response = await fetchFromBackend("/api/admin/companies");
    return response.companies || [];
  } catch (error) {
    console.error("Erro ao buscar empresas:", error);
    return [];
  }
}

export async function createCompany(payload: CreateCompanyPayload): Promise<CompanySummary> {
  if (payload.password !== payload.confirmPassword) {
    throw new Error("As senhas informadas não conferem.");
  }
  const response = await fetchFromBackend("/api/admin/companies", {
    method: "POST",
    body: JSON.stringify({
      user_id: payload.userId,
      company_name: payload.companyName,
      email: payload.email,
      password: payload.password,
      expected_employees: payload.expectedEmployees || 0,
    }),
  });
  return response.company;
}

export async function fetchCompanyDetails(companyId: string): Promise<CompanySummary> {
  const response = await fetchFromBackend(`/api/admin/companies/${companyId}`);
  return response.company;
}

export interface UpdateCompanyPayload {
  empresa_nome?: string;
  status?: CompanyStatus;
  rh_enabled?: boolean;
  plano?: string;
}

export async function updateCompany(companyId: string, payload: UpdateCompanyPayload): Promise<void> {
  await fetchFromBackend(`/api/admin/companies/${companyId}`, {
    method: "PATCH",
    body: JSON.stringify(payload),
  });
}


export async function fetchCompanyEmployees(companyId: string): Promise<CompanyEmployee[]> {
  try {
    const response = await fetchFromBackend(`/api/admin/companies/${companyId}/employees`);
    const employees = response.employees || [];
    return Array.isArray(employees) ? employees : [employees];
  } catch (error) {
    console.error("Erro ao buscar funcionários da empresa:", error);
    return [];
  }
}

export async function createCompanyEmployee(
  companyId: string,
  payload: CreateEmployeePayload
): Promise<CompanyEmployee> {
  const response = await fetchFromBackend(`/api/admin/companies/${companyId}/employees`, {
    method: "POST",
    body: JSON.stringify(payload),
  });
  return response.employee;
}

export async function fetchCompanyRecords(companyId: string): Promise<CompanyRecord[]> {
  try {
    const response = await fetchFromBackend(`/api/admin/companies/${companyId}/records`);
    return response.records || [];
  } catch (error) {
    console.error("Erro ao buscar registros da empresa:", error);
    return [];
  }
}

export async function updateCompanyPaymentStatus(
  companyId: string,
  monthYear: string,
  isPaid: boolean
): Promise<void> {
  await fetchFromBackend(`/api/admin/companies/${companyId}/payment-status`, {
    method: "POST",
    body: JSON.stringify({ monthYear, isPaid }),
  });
}

// ── Kiosk Telemetry ──────────────────────────────────────────────────────────

export interface KioskLogEntry {
  ts: number;
  event: string;
  detail?: string;
  company_id: string;
  device_id: string;
  version: string;
  received_at: string;
}

export interface KioskHeartbeat {
  company_id: string;
  device_id: string;
  version: string;
  uptime: number;
  battery?: number;
  wifi: boolean;
  queue_size: number;
  last_seen: string;
  last_sync?: string;
}

export interface KioskLogsFilter {
  company_id?: string;
  event?: string;
  start_ts?: number;
  end_ts?: number;
  limit?: number;
}

export async function fetchAdminKioskLogs(filter: KioskLogsFilter = {}): Promise<{ logs: KioskLogEntry[]; warn?: string }> {
  const params = new URLSearchParams();
  if (filter.company_id) params.set("company_id", filter.company_id);
  if (filter.event)      params.set("event", filter.event);
  if (filter.start_ts)   params.set("start_ts", String(filter.start_ts));
  if (filter.end_ts)     params.set("end_ts", String(filter.end_ts));
  if (filter.limit)      params.set("limit", String(filter.limit));
  const qs = params.toString();
  const resp = await fetchFromBackend(`/api/admin/kiosk/logs${qs ? `?${qs}` : ""}`);
  return { logs: resp.logs || [], warn: resp.warn };
}

export async function triggerKioskForceUpdate(): Promise<void> {
  await fetchFromBackend("/api/admin/kiosk/force-update", { method: "POST" });
}

export async function fetchAdminKioskHeartbeats(companyId?: string): Promise<{ heartbeats: KioskHeartbeat[]; warn?: string }> {
  const qs = companyId ? `?company_id=${companyId}` : "";
  const resp = await fetchFromBackend(`/api/admin/kiosk/heartbeats${qs}`);
  return { heartbeats: resp.heartbeats || [], warn: resp.warn };
}

// ── AWS ──────────────────────────────────────────────────────────────────────

export async function fetchAwsMetrics(): Promise<AwsMetrics | null> {
  try {
    return await fetchFromBackend("/api/admin/aws/metrics");
  } catch (error) {
    console.error("Erro ao buscar métricas AWS:", error);
    return null;
  }
}

export async function fetchAwsCosts(months = 6): Promise<AwsCosts> {
  try {
    return await fetchFromBackend(`/api/admin/aws/costs?months=${months}`);
  } catch (error) {
    console.error("Erro ao buscar custos AWS:", error);
    return { monthly_costs: [], current_month: null, currency: "USD", error: String(error) };
  }
}

export async function fetchCompanyAwsUsage(companyId: string): Promise<CompanyAwsUsage | null> {
  try {
    return await fetchFromBackend(`/api/admin/aws/company/${companyId}/usage`);
  } catch (error) {
    console.error("Erro ao buscar uso AWS da empresa:", error);
    return null;
  }
}
