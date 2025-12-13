import axios from 'axios';

// Allow overriding the API URL via Vite env var `VITE_API_URL`.
// Fallback to localhost for development convenience.
const API_URL = (typeof import.meta !== 'undefined' && import.meta.env && import.meta.env.VITE_API_URL) || 'http://localhost:5000';

const api = axios.create({
  baseURL: API_URL,
  headers: {
    'Content-Type': 'application/json',
  },
});

class ApiService {
  setAuthToken(token) {
    if (token) {
      api.defaults.headers.common['Authorization'] = `Bearer ${token}`;
    } else {
      delete api.defaults.headers.common['Authorization'];
    }
  }

  // Auth - Funcionário
  async loginFuncionario(funcionarioId, senha) {
    const response = await api.post('/api/funcionario/login', {
      funcionario_id: funcionarioId,
      senha,
    });
    return response.data;
  }

  // Auth - Empresa
  async loginEmpresa(usuario, senha) {
    const response = await api.post('/api/login', {
      usuario_id: usuario,
      senha,
    });
    return response.data;
  }

  // Registros de Ponto - Geolocalização (Funcionário)
  async registerPointByLocation(latitude, longitude, tipo) {
    const response = await api.post('/api/registrar_ponto_localizacao', {
      latitude,
      longitude,
      tipo,
    });
    return response.data;
  }

  // Reconhecimento Facial (Quiosque)
  async recognizeFace(imageBlob) {
    const formData = new FormData();
    formData.append('image', imageBlob, 'frame.jpg');
    
    const response = await api.post('/api/reconhecer_rosto', formData, {
      headers: {
        'Content-Type': 'multipart/form-data',
      },
      timeout: 10000, // 10 segundos
    });
    return response.data;
  }

  // Registrar ponto após reconhecimento facial
  async registerPointByFace(funcionarioId) {
    const response = await api.post('/api/registrar_ponto_facial', {
      funcionario_id: funcionarioId,
      metodo: 'reconhecimento_facial'
    });
    return response.data;
  }

  // Buscar registros do funcionário
  async getMeusRegistros(limit = 10) {
    const response = await api.get('/api/funcionario/registros', {
      params: { limit }
    });
    return response.data;
  }

  // Dashboard Empresa
  async getDashboardStats() {
    const response = await api.get('/api/dashboard/stats');
    return response.data;
  }

  async getEmployees() {
    const response = await api.get('/api/funcionarios');
    return response.data;
  }

  async getRecords(filters = {}) {
    const response = await api.get('/api/registros', { params: filters });
    return response.data;
  }
}

export default new ApiService();
