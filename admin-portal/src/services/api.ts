const API_URL = import.meta.env.VITE_API_URL || "http://192.168.1.2:5000";

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
  activeEmployees: number; // Count of active employees
  expectedEmployees: number; // Total expected employees
  payments: Payment; // Payment history by month/year
  senha?: string; // Password (optional, returned from backend)
}

export interface CreateCompanyPayload {
  userId: string; // user_id for UserCompany table
  companyName: string;
  email: string;
  password: string;
  confirmPassword: string;
  expectedEmployees?: number; // Total expected employees
}

export interface DashboardStats {
  totalCompanies: number;
  totalEmployees: number;
  totalTimeEntries: number;
  activeCompanies: number;
  inactiveCompanies: number;
  lastCreatedCompanies: Array<Pick<CompanySummary, "companyId" | "companyName" | "dateCreated" | "status" >>;
  paidCompanies: number;
  unpaidCompanies: number;
}
export interface CompanyEmployee {
  id: string;
  nome: string; // name in Portuguese
  cargo: string; // role/position
  email: string;
  ativo: boolean; // active status
  empresa_nome: string; // company name
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

// Helper function to add header with auth token
function getHeaders(): Record<string, string> {
  return {
    "Content-Type": "application/json",
  };
}

// Helper to make fetch requests to backend
async function fetchFromBackend(endpoint: string, options?: RequestInit) {
  const response = await fetch(`${API_URL}${endpoint}`, {
    ...options,
    headers: {
      ...getHeaders(),
      ...options?.headers,
    },
  });

  if (!response.ok) {
    const error = await response.json().catch(() => ({ error: "Erro desconhecido" }));
    throw new Error(error.error || `Erro na requisição: ${response.status}`);
  }

  return response.json();
}

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
  try {
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
  } catch (error) {
    console.error("Erro ao criar empresa:", error);
    throw error;
  }
}

export async function fetchCompanyDetails(companyId: string): Promise<CompanySummary> {
  try {
    const response = await fetchFromBackend(`/api/admin/companies/${companyId}`);
    return response.company;
  } catch (error) {
    console.error("Erro ao buscar detalhes da empresa:", error);
    throw error;
  }
}

export async function fetchCompanyEmployees(companyId: string): Promise<CompanyEmployee[]> {
  try {
    const response = await fetchFromBackend(`/api/admin/companies/${companyId}/employees`);
    // Backend returns array directly in response.employees
    const employees = response.employees || [];
    return Array.isArray(employees) ? employees : [employees];
  } catch (error) {
    console.error("Erro ao buscar funcionários da empresa:", error);
    return [];
  }
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
  try {
    await fetchFromBackend(`/api/admin/companies/${companyId}/payment-status`, {
      method: "POST",
      body: JSON.stringify({
        monthYear,
        isPaid,
      }),
    });
  } catch (error) {
    console.error("Erro ao atualizar status de pagamento:", error);
    throw error;
  }
}
