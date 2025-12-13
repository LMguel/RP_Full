import React, { createContext, useState, useContext, useEffect } from 'react';
import ApiService from '../services/api';

const AuthContext = createContext({});

export const AuthProvider = ({ children }) => {
  const [user, setUser] = useState(null);
  const [loading, setLoading] = useState(true);
  const [companyName, setCompanyName] = useState('');
  const [userType, setUserType] = useState(null); // 'empresa' ou 'funcionario'

  useEffect(() => {
    loadStorageData();
  }, []);

  async function loadStorageData() {
    try {
      console.log('[AUTH] Carregando dados do storage...');
      const token = await ApiService.getToken();
      const storedUserType = await ApiService.getUserType();
      
      console.log('[AUTH] Token encontrado:', token ? 'SIM' : 'NÃO');
      console.log('[AUTH] Tipo de usuário:', storedUserType);
      
      if (token) {
        // Token existe, usuário está logado
        setUser({ token });
        setUserType(storedUserType || 'empresa');
        console.log('[AUTH] Usuário logado automaticamente');
      } else {
        console.log('[AUTH] Nenhum token encontrado - redirecionando para login');
      }
    } catch (error) {
      console.error('[AUTH] Erro ao carregar dados:', error);
    } finally {
      setLoading(false);
      console.log('[AUTH] Carregamento concluído');
    }
  }

  // Login para Empresa ou Funcionário
  // Agora suporta ambos os tipos via endpoint unificado /login
  async function signIn(usuario_id, senha, type = 'empresa') {
    try {
      console.log('[AUTH] Iniciando signIn com:', { usuario_id, type });
      const response = await ApiService.login(usuario_id, senha);
      console.log('[AUTH] Resposta do login:', response);
      
      setUser(response);
      setCompanyName(response.empresa_nome || '');
      
      // Detectar tipo de usuário da resposta ou usar tipo padrão
      const userType = response.tipo || 'empresa';
      setUserType(userType);
      await ApiService.saveUserType(userType);
      
      console.log(`[AUTH] Login realizado como: ${userType}`);
      return response;
    } catch (error) {
      console.error('[AUTH] Erro no signIn:', error);
      throw error;
    }
  }

  // Login para Funcionário
  async function signInFuncionario(funcionarioId, senha) {
    try {
      console.log('[AUTH] Iniciando signInFuncionario com ID:', funcionarioId);
      const response = await ApiService.loginFuncionario(funcionarioId, senha);
      console.log('[AUTH] Resposta do login funcionário:', response);
      
      setUser(response);
      setUserType('funcionario');
      await ApiService.saveUserType('funcionario');
      
      console.log('[AUTH] Login funcionário realizado com sucesso');
      return response;
    } catch (error) {
      console.error('[AUTH] Erro no signInFuncionario:', error);
      throw error;
    }
  }

  async function signOut() {
    console.log('[AUTH] Fazendo logout...');
    await ApiService.logout();
    setUser(null);
    setCompanyName('');
    setUserType(null);
    console.log('[AUTH] Logout concluído');
  }

  return (
    <AuthContext.Provider
      value={{
        signed: !!user,
        user,
        loading,
        companyName,
        userType,
        signIn,
        signInFuncionario,
        signOut,
      }}
    >
      {children}
    </AuthContext.Provider>
  );
};

export function useAuth() {
  const context = useContext(AuthContext);

  if (!context) {
    throw new Error('useAuth deve ser usado dentro de um AuthProvider');
  }

  return context;
}
