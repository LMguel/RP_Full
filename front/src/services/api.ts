import axios, { AxiosInstance, AxiosResponse } from 'axios';
import { toast } from 'react-hot-toast';
import { config } from '../config';

const API_BASE_URL = config.API_URL;

class ApiService {
  private api: AxiosInstance;

  constructor() {
    this.api = axios.create({
      baseURL: API_BASE_URL,
      timeout: 10000,
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
    const response = await this.api.post('/login', credentials);
    return response.data;
  }

  async register(userData: {
    usuario_id: string;
    email: string;
    empresa_nome: string;
    senha: string;
  }) {
    const response = await this.api.post('/cadastrar_usuario_empresa', userData);
    return response.data;
  }

  // Password reset endpoint
  async resetPassword(usuario_id: string, nova_senha: string) {
    const response = await this.api.post('/reset_password', {
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
    const response = await this.api.post('/forgot_password', data);
    return response.data;
  }

  // Employee endpoints
  async getEmployees() {
    const response = await this.api.get('/funcionarios');
    return response.data;
  }

  async getEmployee(id: string) {
    const response = await this.api.get(`/funcionarios/${id}`);
    return response.data;
  }

  async createEmployee(employeeData: FormData) {
    const response = await this.api.post('/cadastrar_funcionario', employeeData, {
      headers: {
        'Content-Type': 'multipart/form-data',
      },
    });
    return response.data;
  }

  async updateEmployee(id: string, employeeData: FormData) {
    const response = await this.api.put(`/funcionarios/${id}`, employeeData, {
      headers: {
        'Content-Type': 'multipart/form-data',
      },
    });
    return response.data;
  }

  async deleteEmployee(id: string) {
    const response = await this.api.delete(`/funcionarios/${id}`);
    return response.data;
  }

  async updateEmployeePhoto(id: string, photo: File) {
    const formData = new FormData();
    formData.append('foto', photo);
    
    const response = await this.api.put(`/funcionarios/${id}/foto`, formData, {
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
    const response = await this.api.get('/registros', { params });
    return response.data;
  }

  async registerTime(foto: File) {
    const formData = new FormData();
    formData.append('foto', foto);
    
    const response = await this.api.post('/registrar_ponto', formData, {
      headers: {
        'Content-Type': 'multipart/form-data',
      },
    });
    return response.data;
  }

  async registerTimeManual(data: {
    funcionario_id: string;
    data_hora: string;
    tipo: 'entrada' | 'saída';
  }) {
    const response = await this.api.post('/registrar_ponto_manual', data);
    return response.data;
  }

  async deleteTimeRecord(registroId: string) {
    const response = await this.api.delete(`/registros/${registroId}`);
    return response.data;
  }

  // Search endpoints
  async searchEmployeeNames(query: string) {
    const response = await this.api.get('/funcionarios/nome', {
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
    const response = await this.api.post('/enviar-email-registros', data);
    return response.data;
  }

  // Health check
  async healthCheck() {
    const response = await this.api.get('/');
    return response.data;
  }
}

export const apiService = new ApiService();
export default apiService;
