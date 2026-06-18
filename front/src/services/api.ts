import axios, { AxiosInstance, AxiosResponse } from 'axios';
import { toast } from 'react-hot-toast';
import { config } from '../config';

const API_BASE_URL = config.API_URL;

class ApiService {
  private api: AxiosInstance;

  constructor() {
    this.api = axios.create({
      baseURL: API_BASE_URL,
      timeout: 30000,
      headers: {
        'Content-Type': 'application/json',
      },
    });

    this.setupInterceptors();
  }

  private setupInterceptors() {
    // Injeta o token JWT no header Authorization (Bearer)
    // O cookie httpOnly session_token é uma camada adicional enviada automaticamente via withCredentials
    this.api.interceptors.request.use(
      (config) => {
        const token = localStorage.getItem('token');
        if (token) {
          config.headers.Authorization = `Bearer ${token}`;
        }
        return config;
      },
      (error) => Promise.reject(error)
    );

    // Response interceptor to handle errors
    this.api.interceptors.response.use(
      (response: AxiosResponse) => {
        return response;
      },
      (error) => {
        if (error.response?.status === 401) {
          const requestUrl = error.config?.url ?? '';
          const isAuthRequest = requestUrl.includes('/api/login') || requestUrl.includes('/api/funcionario/login');

          if (isAuthRequest) {
            return Promise.reject(error);
          }

          localStorage.removeItem('token');
          localStorage.removeItem('user');
          window.location.href = '/login';
          toast.error('Sessão expirada. Faça login novamente.');
        } else if (error.response?.status >= 500) {
          toast.error('Erro interno do servidor. Tente novamente.');
        } else if (error.response?.data?.error) {
          toast.error(error.response.data.error);
        } else if (error.message === 'Network Error') {
          toast.error('Erro de conexão. Verifique sua internet.');
        }
        return Promise.reject(error);
      }
    );
  }

  // Auth endpoints
  async login(credentials: { usuario_id: string; senha: string }) {
    const response = await this.api.post('/api/login', credentials);
    return response.data;
  }

  async register(userData: {
    usuario_id: string;
    email: string;
    empresa_nome: string;
    senha: string;
  }) {
    const response = await this.api.post('/api/cadastrar_usuario_empresa', userData);
    return response.data;
  }

  // Password reset endpoint
  async resetPassword(usuario_id: string, nova_senha: string) {
    const response = await this.api.post('/api/reset_password', {
      usuario_id,
      nova_senha
    });
    return response.data;
  }

  // Forgot password endpoint (self-service)
  async forgotPassword(data: {
    usuario_id: string;
    email: string;
    nova_senha: string;
  }) {
    const response = await this.api.post('/api/forgot_password', data);
    return response.data;
  }

  // Employee endpoints
  async getEmployees() {
    const response = await this.api.get('/api/funcionarios');
    return response.data;
  }

  async getEmployee(id: string) {
    const response = await this.api.get(`/api/funcionarios/${id}`);
    return response.data;
  }

  async createEmployee(employeeData: FormData) {
    const response = await this.api.post('/api/cadastrar_funcionario', employeeData, {
      headers: { 'Content-Type': 'multipart/form-data' },
    });
    return response.data;
  }

  async updateEmployee(id: string, employeeData: FormData) {
    const response = await this.api.put(`/api/funcionarios/${id}`, employeeData, {
      headers: { 'Content-Type': 'multipart/form-data' },
    });
    return response.data;
  }

  async deleteEmployee(id: string) {
    const response = await this.api.delete(`/api/funcionarios/${id}`);
    return response.data;
  }

  async updateEmployeePhoto(id: string, photo: File) {
    const formData = new FormData();
    formData.append('foto', photo);
    
    const response = await this.api.put(`/api/funcionarios/${id}/foto`, formData, {
      headers: {
        'Content-Type': 'multipart/form-data',
      },
    });
    return response.data;
  }

  // Time records endpoints
  async getTimeRecords(params?: {
    inicio?: string;
    fim?: string;
    nome?: string;
    funcionario_id?: string;
  }) {
    const response = await this.api.get('/api/registros', { params });
    return response.data;
  }

  async getTimeRecordsSummary(params?: {
    inicio?: string;
    fim?: string;
    nome?: string;
    funcionario_id?: string;
  }) {
    const response = await this.api.get('/api/registros/resumo', { params });
    return response.data;
  }

  async registerTime(foto: File) {
    const formData = new FormData();
    formData.append('foto', foto);
    
    const response = await this.api.post('/api/registrar_ponto', formData, {
      headers: {
        'Content-Type': 'multipart/form-data',
      },
    });
    return response.data;
  }

  async registerTimeManual(data: {
    employee_id: string;
    data_hora: string;
    tipo?: 'entrada' | 'saída' | 'dia_inteiro' | 'saida_almoco' | 'retorno_almoco';
    justificativa: string;
  }) {
    const response = await this.api.post('/api/registrar_ponto_manual', data);
    return response.data;
  }

  async registerFerias(data: {
    employee_id: string;
    data_inicio: string;
    data_fim: string;
    justificativa: string;
  }) {
    const response = await this.api.post('/api/registrar_ferias', data);
    return response.data;
  }

  async registerAtestado(
    formData: FormData,
    onUploadProgress?: (percent: number) => void,
  ) {
    const response = await this.api.post('/api/registrar_atestado', formData, {
      headers: { 'Content-Type': 'multipart/form-data' },
      timeout: 120000,
      onUploadProgress: onUploadProgress
        ? (e) => {
            const pct = Math.round((e.loaded * 100) / (e.total ?? e.loaded));
            onUploadProgress(Math.min(pct, 99));
          }
        : undefined,
    });
    return response.data;
  }

  async removerEspecial(data: {
    employee_id: string;
    data_inicio: string;
    data_fim: string;
    tipo: 'ferias_folga' | 'atestado' | 'ambos';
  }) {
    const response = await this.api.delete('/api/remover_especial', { data });
    return response.data;
  }

  async substituirAtestado(
    formData: FormData,
    onUploadProgress?: (percent: number) => void,
  ) {
    const response = await this.api.put('/api/atestado/substituir', formData, {
      headers: { 'Content-Type': 'multipart/form-data' },
      timeout: 120000,
      onUploadProgress: onUploadProgress
        ? (e) => {
            const pct = Math.round((e.loaded * 100) / (e.total ?? e.loaded));
            onUploadProgress(Math.min(pct, 99));
          }
        : undefined,
    });
    return response.data;
  }

  async invalidateTimeRecord(registroId: string, justificativa: string) {
    const safeId = encodeURIComponent(registroId);
    const response = await this.api.put(`/api/registros/${safeId}/invalidar`, { justificativa });
    return response.data;
  }

  async adjustTimeRecord(registroId: string, data: {
    data_hora: string;
    tipo?: 'entrada' | 'saída';
    justificativa: string;
  }) {
    const safeId = encodeURIComponent(registroId);
    const response = await this.api.post(`/api/registros/${safeId}/ajustar`, data);
    return response.data;
  }

  // Search endpoints
  async searchEmployeeNames(query: string) {
    const response = await this.api.get('/api/funcionarios/nome', {
      params: { nome: query },
    });
    return response.data;
  }

  // Email endpoints
  async sendEmailReport(data: {
    funcionario: string;
    periodo: string;
    registros: any[];
    email: string;
  }) {
    const response = await this.api.post('/api/enviar-email-registros', data);
    return response.data;
  }

  // Health check
  async healthCheck() {
    const response = await this.api.get('/api/');
    return response.data;
  }

  // ========== V2.0 ENDPOINTS ==========
  
  // Register point with V2 (auto-updates summaries)
  async registerPointV2(data: {
    employee_id: string;
    company_id: string;
    photo_base64: string;
    location?: { latitude: number; longitude: number };
    work_mode: 'presencial' | 'remoto' | 'hibrido';
  }) {
    const response = await this.api.post('/api/v2/registrar-ponto', data);
    return response.data;
  }

  // Get daily summary for an employee
  async getDailySummary(employeeId: string, date: string) {
    const response = await this.api.get(`/api/v2/daily-summary/${employeeId}/${date}`);
    return response.data;
  }

  // Get monthly summary for an employee
  async getMonthlySummary(employeeId: string, year: number, month: number) {
    const response = await this.api.get(`/api/v2/monthly-summary/${employeeId}/${year}/${month}`);
    return response.data;
  }

  // Get company dashboard (all employees for a specific date)
  async getCompanyDashboard(date: string) {
    const response = await this.api.get(`/api/v2/dashboard/company/${date}`);
    return response.data;
  }

  // Get employee personal dashboard (requires auth)
  async getEmployeeDashboard() {
    const response = await this.api.get('/api/v2/dashboard/employee');
    return response.data;
  }

  // Get individual time records for a specific day
  async getEmployeeRecords(employeeId: string, date: string) {
    const response = await this.api.get(`/api/v2/records/${employeeId}/${date}`);
    return response.data;
  }

  // Company settings
  async getCompanySettings() {
    const response = await this.api.get('/api/configuracoes');
    return response.data;
  }

  async me() {
    const response = await this.api.get('/api/me');
    return response.data as {
      tipo: string;
      usuario_id: string;
      company_id: string;
      empresa_nome: string;
      role: string;
      permissions: string[];
      user_name: string;
    };
  }

  async logout() {
    try {
      await this.api.post('/api/logout', {});
    } catch {
      // Best-effort
    }
  }

  async updateCompanySettings(settings: any) {
    const response = await this.api.put('/api/configuracoes', settings);
    return response.data;
  }

  // Generic HTTP methods for flexibility
  async get(endpoint: string, params?: any) {
    const response = await this.api.get(endpoint, { params });
    return response.data;
  }

  async post(endpoint: string, data: any) {
    const response = await this.api.post(endpoint, data);
    return response.data;
  }

  async put(endpoint: string, data: any) {
    const response = await this.api.put(endpoint, data);
    return response.data;
  }

  async delete(endpoint: string) {
    const response = await this.api.delete(endpoint);
    return response.data;
  }

  // ========== CHATBOT RH ==========

  async chatRH(question: string): Promise<{
    type: 'answer' | 'clarification';
    message: string;
    intent?: string;
    data?: any;
    employee_link?: { employee_id: string; employee_name: string | null } | null;
  }> {
    const response = await this.api.post('/api/chat/rh', { question });
    return response.data;
  }

  // ========== USUÁRIOS ==========

  async getUsers() {
    const response = await this.api.get('/api/users');
    return response.data as { users: import('../types').CompanyUser[] };
  }

  async createUser(data: {
    name: string;
    user_id: string;
    senha: string;
    role: import('../types').UserRole;
    email?: string;
    permissions?: import('../types').PermissionOverride;
  }) {
    const response = await this.api.post('/api/users', data);
    return response.data as { user: import('../types').CompanyUser };
  }

  async updateUser(userId: string, data: {
    name?: string;
    email?: string;
    role?: import('../types').UserRole;
    permissions?: import('../types').PermissionOverride;
    active?: boolean;
  }) {
    const response = await this.api.put(`/api/users/${userId}`, data);
    return response.data as { user: import('../types').CompanyUser };
  }

  async deleteUser(userId: string) {
    const response = await this.api.delete(`/api/users/${userId}`);
    return response.data as { message: string };
  }

  async toggleUserActive(userId: string) {
    const response = await this.api.post(`/api/users/${userId}/toggle-active`);
    return response.data as { active: boolean; user_id: string };
  }

  // ========== AUDITORIA ==========

  async getAuditLogs(filters?: {
    user_id?: string;
    action?: string;
    entity?: string;
    date_from?: string;
    date_to?: string;
    limit?: number;
    employee_id?: string;
  }) {
    const params = new URLSearchParams();
    if (filters?.user_id)      params.set('user_id', filters.user_id);
    if (filters?.action)       params.set('action', filters.action);
    if (filters?.entity)       params.set('entity', filters.entity);
    if (filters?.date_from)    params.set('date_from', filters.date_from);
    if (filters?.date_to)      params.set('date_to', filters.date_to);
    if (filters?.limit)        params.set('limit', String(filters.limit));
    if (filters?.employee_id)  params.set('employee_id', filters.employee_id);
    const response = await this.api.get(`/api/audit?${params.toString()}`);
    return response.data as { logs: import('../types').AuditLog[]; count: number };
  }

  async getCompanyFeatures(): Promise<{ rh_enabled: boolean }> {
    try {
      const response = await this.api.get('/api/company/features');
      return response.data;
    } catch {
      return { rh_enabled: false };
    }
  }
}

export const apiService = new ApiService();
export default apiService;
