import axios from 'axios';

// Allow overriding the API URL via Vite env var `VITE_API_URL`.
// Fallback: usar localhost em desenvolvimento, produção em produção
const getApiUrl = () => {
  // Se VITE_API_URL estiver definida, usar ela
  if (typeof import.meta !== 'undefined' && import.meta.env && import.meta.env.VITE_API_URL) {
    return import.meta.env.VITE_API_URL;
  }
  
  // Se estiver em modo desenvolvimento (localhost), usar backend local
  if (typeof window !== 'undefined' && window.location.hostname === 'localhost') {
    return 'http://192.168.1.2:5000';
  }
  
  // Senão, usar backend hospedado
  return 'https://registra-ponto.duckdns.org';
};

const API_URL = getApiUrl();

// Log para debug - remover em produção
console.log('[API] URL configurada:', API_URL);
console.log('[API] Modo:', typeof window !== 'undefined' && window.location.hostname === 'localhost' ? 'DESENVOLVIMENTO (localhost)' : 'PRODUÇÃO');

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
    console.log('[API] loginEmpresa - baseURL:', api.defaults.baseURL);
    console.log('[API] loginEmpresa - URL completa:', `${api.defaults.baseURL}/api/login`);
    const response = await api.post('/api/login', {
      usuario_id: usuario,
      senha,
    });
    return response.data;
  }

  // Registros de Ponto - Geolocalização (Funcionário)
  async registerPointByLocation(latitude, longitude, tipo, data_hora) {
    const payload = {
      latitude,
      longitude,
      tipo,
    };
    if (data_hora) payload.data_hora = data_hora;
    const response = await api.post('/api/registrar_ponto_localizacao', payload);
    return response.data;
  }

  // Reconhecimento Facial (Quiosque)
  async recognizeFace(imageBlob) {
    const formData = new FormData();
    formData.append('image', imageBlob, 'frame.jpg');
    
    // Verificar se o token está configurado
    const token = api.defaults.headers.common['Authorization'];
    console.log('[API] recognizeFace - Token configurado:', token ? 'SIM' : 'NÃO');
    console.log('[API] recognizeFace - URL:', `${api.defaults.baseURL}/api/reconhecer_rosto`);
    
    // O token será enviado automaticamente pelo axios se foi configurado via setAuthToken
    // Mas para multipart/form-data, precisamos garantir que o header Authorization seja enviado
    const response = await api.post('/api/reconhecer_rosto', formData, {
      headers: {
        'Content-Type': 'multipart/form-data',
        // Authorization será adicionado automaticamente se api.defaults.headers.common['Authorization'] estiver configurado
      },
      timeout: 10000, // 10 segundos
    });
    return response.data;
  }

  // Registrar ponto após reconhecimento facial
  async registerPointByFace(funcionarioId, tipo, dataHoraString) {
    const payload = {
      funcionario_id: funcionarioId,
      metodo: 'reconhecimento_facial'
    };
    
    // Se dataHoraString foi fornecida, enviar ao backend
    if (dataHoraString) {
      payload.data_hora = dataHoraString;
      console.log('[API] registerPointByFace - Enviando data_hora:', dataHoraString);
    }
    
    // Se tipo foi fornecido, enviar ao backend
    if (tipo) {
      payload.tipo = tipo;
      console.log('[API] registerPointByFace - Enviando tipo:', tipo);
    }
    
    console.log('[API] registerPointByFace - Payload completo:', payload);
    console.log('[API] registerPointByFace - baseURL:', api.defaults.baseURL);
    console.log('[API] registerPointByFace - URL completa:', `${api.defaults.baseURL}/api/registrar_ponto_facial`);
    
    const response = await api.post('/api/registrar_ponto_facial', payload, {
      headers: {
        'Content-Type': 'application/json',
      }
    });
    
    console.log('[API] registerPointByFace - Resposta recebida:', response.data);
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
