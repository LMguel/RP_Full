import axios, { AxiosInstance, AxiosResponse } from 'axios';
import { toast } from 'react-hot-toast';
import { config } from '../config';

const API_BASE_URL = config.API_URL;

class ApiService {
  private api: AxiosInstance;

  constructor() {
    this.api = axios.create({
      baseURL: API_BASE_URL,
      timeout: 30000, // 30 segundos
      headers: {
        'Content-Type': 'application/json',
      },
    });

    this.setupInterceptors();
  }

  private setupInterceptors() {
    // Request interceptor to add auth token
    this.api.interceptors.request.use(
      (config) => {
        const token = localStorage.getItem('token');
        if (token) {
          config.headers.Authorization = `Bearer ${token}`;
        }
        return config;
      },
      (error) => {
        return Promise.reject(error);
      }
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
      headers: {
        'Content-Type': 'multipart/form-data',
      },
    });
    return response.data;
  }

  async updateEmployee(id: string, employeeData: FormData) {
    const response = await this.api.put(`/api/funcionarios/${id}`, employeeData, {
      headers: {
        'Content-Type': 'multipart/form-data',
      },
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
    tipo: 'entrada' | 'saída';
  }) {
    const response = await this.api.post('/api/registrar_ponto_manual', data);
    return response.data;
  }

  async deleteTimeRecord(registroId: string) {
    const safeId = encodeURIComponent(registroId);
    const response = await this.api.delete(`/api/registros/${safeId}`);
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
    try {
      console.log('Making request to /api/configuracoes');
      const response = await this.api.get('/api/configuracoes');
      console.log('Company settings response:', response.data);
      return response.data;
    } catch (error: any) {
      console.error('Error in getCompanySettings:', error.response?.data || error.message);
      throw error;
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
}

export const apiService = new ApiService();
export default apiService;
