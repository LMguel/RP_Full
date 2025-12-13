import React, { createContext, useState, useContext, useEffect } from 'react';
import apiService from '../services/api';

const AuthContext = createContext({});

export function AuthProvider({ children }) {
  const [user, setUser] = useState(null);
  const [userType, setUserType] = useState(null); // 'funcionario' ou 'empresa'
  const [loading, setLoading] = useState(true);

  useEffect(() => {
    loadStoredAuth();
  }, []);

  async function loadStoredAuth() {
    try {
      const token = localStorage.getItem('@app:token');
      const storedUserType = localStorage.getItem('@app:userType');
      const storedUser = localStorage.getItem('@app:user');

      if (token && storedUserType && storedUser) {
        apiService.setAuthToken(token);
        setUserType(storedUserType);
        setUser(JSON.parse(storedUser));
      }
    } catch (error) {
      console.error('[AUTH] Erro ao carregar autenticação:', error);
    } finally {
      setLoading(false);
    }
  }

  async function signInFuncionario(funcionarioId, senha) {
    try {
      const response = await apiService.loginFuncionario(funcionarioId, senha);
      const { token, funcionario } = response;

      localStorage.setItem('@app:token', token);
      localStorage.setItem('@app:userType', 'funcionario');
      localStorage.setItem('@app:user', JSON.stringify(funcionario));

      apiService.setAuthToken(token);
      setUser(funcionario);
      setUserType('funcionario');

      return funcionario;
    } catch (error) {
      console.error('[AUTH] Erro no login funcionário:', error);
      throw error;
    }
  }

  async function signInEmpresa(usuario, senha) {
    try {
      const response = await apiService.loginEmpresa(usuario, senha);
      const { token, usuario_id, empresa_nome, company_id, tipo } = response;

      const empresaData = {
        usuario_id,
        empresa_nome,
        company_id,
        tipo
      };

      localStorage.setItem('@app:token', token);
      localStorage.setItem('@app:userType', 'empresa');
      localStorage.setItem('@app:user', JSON.stringify(empresaData));

      apiService.setAuthToken(token);
      setUser(empresaData);
      setUserType('empresa');

      return empresaData;
    } catch (error) {
      console.error('[AUTH] Erro no login empresa:', error);
      throw error;
    }
  }

  function signOut() {
    localStorage.removeItem('@app:token');
    localStorage.removeItem('@app:userType');
    localStorage.removeItem('@app:user');
    
    apiService.setAuthToken(null);
    setUser(null);
    setUserType(null);
  }

  return (
    <AuthContext.Provider
      value={{
        signed: !!user,
        user,
        userType,
        loading,
        signInFuncionario,
        signInEmpresa,
        signOut,
      }}
    >
      {children}
    </AuthContext.Provider>
  );
}

export function useAuth() {
  const context = useContext(AuthContext);
  if (!context) {
    throw new Error('useAuth deve ser usado dentro de AuthProvider');
  }
  return context;
}
