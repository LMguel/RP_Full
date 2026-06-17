import axios from 'axios';
import type {
  FuncionarioDashboard,
  TimeRecord,
  Employee,
  RecognitionResult,
  RegisterPointResult,
  MonthlySummary,
  RegistroDiario,
  CredenciaisFuncionario,
} from '../types';

const API_URL = import.meta.env.VITE_API_URL;

if (!API_URL) {
  throw new Error('VITE_API_URL não está configurada!');
}

const api = axios.create({
  baseURL: API_URL,
  headers: { 'Content-Type': 'application/json' },
});

// ─── Token management ─────────────────────────────────────────────────────────

function setAuthToken(token: string | null) {
  if (token) {
    api.defaults.headers.common['Authorization'] = `Bearer ${token}`;
  } else {
    delete api.defaults.headers.common['Authorization'];
  }
}

function getStoredToken(): string | null {
  return localStorage.getItem('@app:token');
}

// Auto-restore token on load
const stored = getStoredToken();
if (stored) setAuthToken(stored);

// ─── Token refresh ────────────────────────────────────────────────────────────

// Mutex: evita múltiplos refresh simultâneos (ex: várias requests em paralelo recebendo 401)
let _refreshPromise: Promise<string | null> | null = null;

async function _doRefresh(): Promise<string | null> {
  const token = getStoredToken();
  if (!token) return null;
  try {
    const { data } = await api.post<{ token: string }>('/api/auth/refresh', {});
    const newToken = data.token;
    localStorage.setItem('@app:token', newToken);
    setAuthToken(newToken);
    // Renova o timer de sessão local também
    const EMPRESA_SESSION_MS = 12 * 60 * 60 * 1000;
    localStorage.setItem('@app:session_expires', String(Date.now() + EMPRESA_SESSION_MS));
    return newToken;
  } catch {
    return null;
  }
}

/** Renova o JWT de empresa chamando o backend. Fire-and-forget seguro. */
export async function refreshEmpresaToken(): Promise<boolean> {
  if (_refreshPromise) {
    const result = await _refreshPromise;
    return result !== null;
  }
  _refreshPromise = _doRefresh();
  try {
    const result = await _refreshPromise;
    return result !== null;
  } finally {
    _refreshPromise = null;
  }
}

// ─── 401 interceptor com auto-refresh ────────────────────────────────────────
// Se a request falhar com 401 e for uma conta empresa (kiosk), tenta refresh uma
// vez e repete a request original. Se o refresh falhar, limpa a sessão.

api.interceptors.response.use(
  (r) => r,
  async (err) => {
    const status = err?.response?.status;
    const config = err?.config;

    // Só tenta refresh para 401 de conta empresa, evita loop no próprio /auth/refresh
    if (
      status === 401 &&
      config &&
      !config._refreshRetry &&
      localStorage.getItem('@app:userType') === 'empresa' &&
      !config.url?.includes('/auth/refresh') &&
      !config.url?.includes('/login')
    ) {
      config._refreshRetry = true;
      const ok = await refreshEmpresaToken();
      if (ok) {
        // Atualiza o header da request original e repete
        config.headers['Authorization'] = `Bearer ${getStoredToken()}`;
        return api(config);
      }
    }

    // Sem refresh ou refresh falhou — limpa sessão
    if (status === 401) {
      localStorage.removeItem('@app:token');
      localStorage.removeItem('@app:userType');
      localStorage.removeItem('@app:user');
      setAuthToken(null);
    }
    return Promise.reject(err);
  }
);

// ─── Auth ─────────────────────────────────────────────────────────────────────

async function loginFuncionario(funcionarioId: string, senha: string) {
  const { data } = await api.post('/api/funcionario/login', {
    funcionario_id: funcionarioId,
    senha,
  });
  return data as { token: string; funcionario: Employee };
}

async function loginEmpresa(usuario: string, senha: string) {
  const { data } = await api.post('/api/login', { usuario_id: usuario, senha });
  return data as {
    token: string;
    usuario_id: string;
    empresa_nome: string;
    company_id: string;
    tipo: string;
  };
}

async function logoutSession() {
  try {
    await api.post('/api/logout', {});
  } catch {
    // Best-effort — não bloqueia logout local mesmo se offline
  }
}

// ─── Facial / Kiosk ───────────────────────────────────────────────────────────

async function recognizeFace(imageBlob: Blob): Promise<RecognitionResult> {
  const formData = new FormData();
  formData.append('image', imageBlob, 'frame.jpg');
  const { data } = await api.post('/api/reconhecer_rosto', formData, {
    headers: { 'Content-Type': 'multipart/form-data' },
    timeout: 10000,
  });
  return data;
}

async function registerPointByFace(
  funcionarioId: string,
  tipo: string,
  dataHoraString: string,
  extra?: { offline?: boolean; device_id?: string; company_id?: string }
): Promise<RegisterPointResult> {
  const { data } = await api.post('/api/registrar_ponto_facial', {
    funcionario_id: funcionarioId,
    tipo,
    data_hora: dataHoraString,
    metodo: extra?.offline ? 'offline_sync' : 'reconhecimento_facial',
    ...(extra?.offline && { offline: true }),
    ...(extra?.device_id && { device_id: extra.device_id }),
    ...(extra?.company_id && { company_id: extra.company_id }),
  });
  return data;
}

// ─── Funcionário ──────────────────────────────────────────────────────────────

async function getFuncionarioDashboard(): Promise<FuncionarioDashboard> {
  const { data } = await api.get('/api/v2/dashboard/employee');
  return data;
}

async function getMeusRegistros(params: {
  inicio?: string;
  fim?: string;
  limit?: number;
} = {}): Promise<TimeRecord[]> {
  const { data } = await api.get('/api/funcionario/registros', { params });
  const raw: any[] = data?.registros ?? (Array.isArray(data) ? data : []);
  // Raw DynamoDB items may lack data_hora (embedded in composite key) and use 'type' not 'tipo'
  return raw.map(r => {
    let data_hora: string = r.data_hora || '';
    if (!data_hora) {
      const composite: string = r['employee_id#date_time'] || '';
      const idx = composite.indexOf('#');
      if (idx >= 0) data_hora = composite.slice(idx + 1);
    }
    return {
      ...r,
      data_hora,
      tipo: (r.tipo || r.type || '') as TimeRecord['tipo'],
      funcionario_id: r.funcionario_id || r.employee_id || '',
    } as TimeRecord;
  }).filter(r => Boolean(r.data_hora));
}

async function getDailyRegistros(
  employeeId: string,
  startDate: string,
  endDate: string
): Promise<RegistroDiario[]> {
  try {
    const { data } = await api.get('/api/registros-diarios', {
      params: { employee_id: employeeId, start_date: startDate, end_date: endDate, page_size: 200 },
    });
    return data?.summaries ?? [];
  } catch {
    return [];
  }
}

async function getRegistros(params: {
  funcionario_id?: string;
  inicio?: string;
  fim?: string;
  status?: string;
} = {}): Promise<TimeRecord[]> {
  const { data } = await api.get('/api/registros', { params });
  return data?.registros ?? data ?? [];
}

async function getMonthlySummary(
  employeeId: string,
  year: number,
  month: number
): Promise<MonthlySummary | null> {
  try {
    const { data } = await api.get(
      `/api/v2/monthly-summary/${employeeId}/${year}/${String(month).padStart(2, '0')}`
    );
    return data;
  } catch {
    return null;
  }
}

async function alterarSenha(senhaAtual: string, novaSenha: string) {
  const { data } = await api.post('/api/funcionario/alterar-senha', {
    senha_atual: senhaAtual,
    nova_senha: novaSenha,
  });
  return data;
}

// ─── Empresa / Funcionários ───────────────────────────────────────────────────

async function getEmployees(): Promise<Employee[]> {
  const { data } = await api.get('/api/funcionarios');
  return data?.funcionarios ?? [];
}

async function getEmployee(id: string): Promise<Employee> {
  const { data } = await api.get(`/api/funcionarios/${id}`);
  return data?.funcionario ?? data;
}

async function getHorarios(): Promise<any[]> {
  try {
    const { data } = await api.get('/api/horarios');
    return Array.isArray(data) ? data : [];
  } catch {
    return [];
  }
}

async function createEmployee(formData: FormData): Promise<{ funcionario: Employee; credenciais?: CredenciaisFuncionario }> {
  const { data } = await api.post('/api/cadastrar_funcionario', formData, {
    headers: { 'Content-Type': 'multipart/form-data' },
  });
  return data;
}

async function updateEmployee(id: string, payload: Partial<Employee>): Promise<Employee> {
  const { data } = await api.put(`/api/funcionarios/${id}`, payload);
  return data?.funcionario ?? data;
}

async function updateEmployeePhoto(id: string, photoBlob: Blob): Promise<void> {
  const formData = new FormData();
  formData.append('foto', photoBlob, 'photo.jpg');
  await api.put(`/api/funcionarios/${id}/foto`, formData, {
    headers: { 'Content-Type': 'multipart/form-data' },
  });
}

async function deleteEmployee(id: string): Promise<void> {
  await api.delete(`/api/funcionarios/${id}`);
}

async function redefinirSenha(id: string): Promise<CredenciaisFuncionario> {
  const { data } = await api.put(`/api/funcionarios/${id}/redefinir-senha`);
  return data;
}

async function invalidarRegistro(id: string, justificativa: string): Promise<void> {
  await api.put(`/api/registros/${id}/invalidar`, { justificativa });
}

async function getDashboardStats() {
  const { data } = await api.get('/api/dashboard/stats');
  return data;
}

async function getCompanyConfig() {
  const { data } = await api.get('/api/configuracoes');
  return data;
}

async function getFeriados(ano: string, uf: string): Promise<Array<{ date?: string; data?: string; name?: string; nome?: string; active?: boolean; ativo?: boolean }>> {
  try {
    const { data } = await api.get('/api/feriados', { params: { ano, uf } });
    return Array.isArray(data) ? data : [];
  } catch {
    return [];
  }
}

async function saveCompanyConfig(config: Record<string, unknown>) {
  const { data } = await api.post('/api/configuracoes', config);
  return data;
}

// ─── Export ───────────────────────────────────────────────────────────────────

const apiService = {
  setAuthToken,
  // auth
  loginFuncionario,
  loginEmpresa,
  logout: logoutSession,
  // kiosk
  recognizeFace,
  registerPointByFace,
  // funcionario
  getFuncionarioDashboard,
  getMeusRegistros,
  getDailyRegistros,
  getRegistros,
  getMonthlySummary,
  alterarSenha,
  // empresa
  getEmployees,
  getEmployee,
  getHorarios,
  createEmployee,
  updateEmployee,
  updateEmployeePhoto,
  deleteEmployee,
  redefinirSenha,
  invalidarRegistro,
  getDashboardStats,
  getCompanyConfig,
  saveCompanyConfig,
  getFeriados,
};

export default apiService;
