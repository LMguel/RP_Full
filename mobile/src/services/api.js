import axios from 'axios';
import * as SecureStore from 'expo-secure-store';

// URL da API - Configure isso de acordo com seu ambiente
const API_URL = 'http://192.168.1.4:5000/api'; // Substitua pelo IP da sua máquina

class ApiService {
  constructor() {
    this.token = null;
  }

  async setToken(token) {
    this.token = token;
    await SecureStore.setItemAsync('auth_token', token);
  }

  async getToken() {
    if (!this.token) {
      this.token = await SecureStore.getItemAsync('auth_token');
    }
    return this.token;
  }

  async clearToken() {
    this.token = null;
    await SecureStore.deleteItemAsync('auth_token');
    await SecureStore.deleteItemAsync('user_type');
  }

  async saveUserType(type) {
    await SecureStore.setItemAsync('user_type', type);
  }

  async getUserType() {
    return await SecureStore.getItemAsync('user_type');
  }

  // Login Empresa
  async login(usuario_id, senha) {
    try {
      const response = await axios.post(`${API_URL}/login`, {
        usuario_id,
        senha
      });
      
      if (response.data.token) {
        await this.setToken(response.data.token);
      }
      
      return response.data;
    } catch (error) {
      throw error.response?.data || error.message;
    }
  }

  // Login Funcionário
  async loginFuncionario(email, senha) {
    try {
      const response = await axios.post(`${API_URL}/funcionario/login`, {
        email,
        senha
      });
      
      if (response.data.token) {
        await this.setToken(response.data.token);
      }
      
      return response.data;
    } catch (error) {
      throw error.response?.data || error.message;
    }
  }

  async registerFaceTime(photoUri, previewMode = false) {
    try {
      console.log(`[API] ========== INÍCIO registerFaceTime (preview=${previewMode}) ==========`);
      const token = await this.getToken();
      
      if (!token) {
        console.error('[API] Token não encontrado!');
        throw new Error('Token não encontrado. Faça login novamente.');
      }

      console.log('[API] Token OK, preparando FormData...');

      // Criar FormData para envio da foto
      const formData = new FormData();
      
      // Extrair o nome do arquivo da URI
      const filename = photoUri.split('/').pop();
      const match = /\.(\w+)$/.exec(filename);
      const type = match ? `image/${match[1]}` : 'image/jpeg';
      
      formData.append('foto', {
        uri: photoUri,
        name: filename || 'photo.jpg',
        type
      });

      // Adicionar flag de preview se for modo prévia
      if (previewMode) {
        formData.append('preview', 'true');
      }

      console.log(`[API] FormData preparado. Enviando POST para ${API_URL}/registrar_ponto...`);
      console.log(`[API] Timeout configurado: 30000ms`);
      
      const response = await axios.post(
        `${API_URL}/registrar_ponto`,
        formData,
        {
          headers: {
            'Authorization': `Bearer ${token}`,
            'Content-Type': 'multipart/form-data',
          },
          timeout: 30000, // 30 segundos de timeout (aumentado para reconhecimento facial)
        }
      );

      console.log('[API] ========== RESPOSTA RECEBIDA ==========');
      console.log('[API] Status:', response.status);
      console.log('[API] Data:', JSON.stringify(response.data, null, 2));
      console.log('[API] Type of data:', typeof response.data);
      console.log('[API] data.success:', response.data?.success);
      console.log('[API] ========== FIM registerFaceTime ==========');
      
      return response.data;
    } catch (error) {
      console.error('[API] ========== ERRO CAPTURADO ==========');
      console.error('[API] Error object:', error);
      console.error('[API] error.code:', error.code);
      console.error('[API] error.message:', error.message);
      console.error('[API] error.response?.status:', error.response?.status);
      console.error('[API] error.response?.data:', error.response?.data);
      
      // Se for erro de rede/timeout
      if (error.code === 'ECONNABORTED') {
        console.error('[API] Erro de TIMEOUT detectado');
        const errorObj = { 
          success: false, 
          message: 'Tempo esgotado. Tente novamente.',
          error: 'timeout' 
        };
        console.error('[API] Retornando:', errorObj);
        throw errorObj;
      }
      
      // Se for erro HTTP com resposta do servidor
      if (error.response?.data) {
        console.error('[API] Erro HTTP com resposta do servidor');
        console.error('[API] Tipo da resposta:', typeof error.response.data);
        console.error('[API] Conteúdo:', JSON.stringify(error.response.data));
        
        // Garantir que sempre tem a estrutura correta
        const errorData = error.response.data;
        if (typeof errorData === 'object' && errorData !== null) {
          // Se já é um objeto estruturado, retornar como está
          console.error('[API] Retornando erro estruturado do servidor');
          throw errorData;
        } else {
          // Se for string ou outro tipo, criar estrutura
          console.error('[API] Convertendo resposta para objeto estruturado');
          const errorObj = {
            success: false,
            message: String(errorData),
            error: String(errorData)
          };
          console.error('[API] Retornando:', errorObj);
          throw errorObj;
        }
      }
      
      // Qualquer outro erro
      console.error('[API] Erro genérico/desconhecido');
      const errorObj = { 
        success: false, 
        message: error.message || 'Erro ao processar solicitação',
        error: error.message 
      };
      console.error('[API] Retornando:', errorObj);
      console.error('[API] ========== FIM ERRO ==========');
      throw errorObj;
    }
  }

  async getEmployees() {
    try {
      const token = await this.getToken();
      
      if (!token) {
        throw new Error('Token não encontrado. Faça login novamente.');
      }

      const response = await axios.get(`${API_URL}/funcionarios`, {
        headers: {
          'Authorization': `Bearer ${token}`
        }
      });

      return response.data.funcionarios || [];
    } catch (error) {
      throw error.response?.data || error.message;
    }
  }

  async logout() {
    await this.clearToken();
  }

  // ========== V2.0 ENDPOINTS ==========

  async registerPointV2(employeeId, companyId, photoBase64, location, workMode = 'presencial') {
    try {
      const token = await this.getToken();
      
      if (!token) {
        throw new Error('Token não encontrado. Faça login novamente.');
      }

      console.log('[API V2] Registrando ponto com V2...');
      
      const response = await axios.post(
        `${API_URL}/v2/registrar-ponto`,
        {
          employee_id: employeeId,
          company_id: companyId,
          photo_base64: photoBase64,
          location: location,
          work_mode: workMode
        },
        {
          headers: {
            'Authorization': `Bearer ${token}`,
            'Content-Type': 'application/json',
          },
          timeout: 30000,
        }
      );

      console.log('[API V2] Ponto registrado com sucesso:', response.data);
      return response.data;
    } catch (error) {
      console.error('[API V2] Erro ao registrar ponto:', error);
      throw error.response?.data || error.message;
    }
  }

  async getEmployeeDashboard() {
    try {
      const token = await this.getToken();
      
      if (!token) {
        throw new Error('Token não encontrado. Faça login novamente.');
      }

      const response = await axios.get(`${API_URL}/v2/dashboard/employee`, {
        headers: {
          'Authorization': `Bearer ${token}`
        }
      });

      return response.data;
    } catch (error) {
      throw error.response?.data || error.message;
    }
  }

  async getDailySummary(employeeId, date) {
    try {
      const token = await this.getToken();
      
      if (!token) {
        throw new Error('Token não encontrado. Faça login novamente.');
      }

      const response = await axios.get(`${API_URL}/v2/daily-summary/${employeeId}/${date}`, {
        headers: {
          'Authorization': `Bearer ${token}`
        }
      });

      return response.data;
    } catch (error) {
      throw error.response?.data || error.message;
    }
  }

  async getMonthlySummary(employeeId, year, month) {
    try {
      const token = await this.getToken();
      
      if (!token) {
        throw new Error('Token não encontrado. Faça login novamente.');
      }

      const response = await axios.get(`${API_URL}/v2/monthly-summary/${employeeId}/${year}/${month}`, {
        headers: {
          'Authorization': `Bearer ${token}`
        }
      });

      return response.data;
    } catch (error) {
      throw error.response?.data || error.message;
    }
  }
}

export default new ApiService();
