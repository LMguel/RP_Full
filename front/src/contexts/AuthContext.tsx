import React, { createContext, useContext, useState, useEffect, ReactNode } from 'react';
import { User, LoginRequest, RegisterRequest } from '../types';
import { apiService } from '../services/api';
import { toast } from 'react-hot-toast';

interface AuthContextType {
  user: User | null;
  token: string | null;
  isLoading: boolean;
  isFirstAccess: boolean;
  login: (credentials: LoginRequest) => Promise<boolean>;
  register: (userData: RegisterRequest) => Promise<boolean>;
  logout: () => void;
  checkFirstAccess: () => Promise<void>;
  markConfigurationComplete: () => void;
  isAuthenticated: boolean;
}

const AuthContext = createContext<AuthContextType | undefined>(undefined);

export const useAuth = () => {
  const context = useContext(AuthContext);
  if (context === undefined) {
    throw new Error('useAuth must be used within an AuthProvider');
  }
  return context;
};

interface AuthProviderProps {
  children: ReactNode;
}

export const AuthProvider: React.FC<AuthProviderProps> = ({ children }) => {
  const [user, setUser] = useState<User | null>(null);
  const [token, setToken] = useState<string | null>(null);
  const [isLoading, setIsLoading] = useState(true);
  const [isFirstAccess, setIsFirstAccess] = useState(false);

  useEffect(() => {
    // Check for existing token and user data on app start
    const initAuth = async () => {
      const storedToken = localStorage.getItem('token');
      const storedUser = localStorage.getItem('user');

      if (storedToken && storedUser) {
        try {
          setToken(storedToken);
          setUser(JSON.parse(storedUser));
          // Verificar primeiro acesso para usuários já logados
          await checkFirstAccess();
        } catch (error) {
          console.error('Error parsing stored user data:', error);
          localStorage.removeItem('token');
          localStorage.removeItem('user');
        }
      }
      setIsLoading(false);
    };

    initAuth();
  }, []);

  const login = async (credentials: LoginRequest): Promise<boolean> => {
    try {
      setIsLoading(true);
      const response = await apiService.login(credentials);
      
      if (response.token) {
        setToken(response.token);
        localStorage.setItem('token', response.token);
        
        // Decode token to get user info (basic implementation)
        try {
          const payload = JSON.parse(atob(response.token.split('.')[1]));
          const userData: User = {
            usuario_id: payload.usuario_id,
            email: '', // Not provided in token
            empresa_nome: payload.empresa_nome,
            empresa_id: payload.empresa_id,
          };
          setUser(userData);
          localStorage.setItem('user', JSON.stringify(userData));
        } catch (error) {
          console.error('Error decoding token:', error);
        }
        
        toast.success('Login realizado com sucesso!');
        
        // Verificar se é primeiro acesso após login bem-sucedido
        await checkFirstAccess();
        
        return true;
      }
      return false;
    } catch (error: any) {
      console.error('Login error:', error);
      const statusCode = error.response?.status;
      const errorMessage = error.response?.data?.error || (statusCode === 401
        ? 'Login ou senha incorretos. Verifique suas credenciais.'
        : 'Erro ao fazer login');
      toast.error(errorMessage);
      return false;
    } finally {
      setIsLoading(false);
    }
  };

  const register = async (userData: RegisterRequest): Promise<boolean> => {
    try {
      setIsLoading(true);
      const response = await apiService.register(userData);
      
      if (response.success) {
        toast.success('Usuário cadastrado com sucesso!');
        return true;
      }
      return false;
    } catch (error: any) {
      console.error('Register error:', error);
      const errorMessage = error.response?.data?.error || 'Erro ao cadastrar usuário';
      toast.error(errorMessage);
      return false;
    } finally {
      setIsLoading(false);
    }
  };

  const checkFirstAccess = async () => {
    try {
      const settings = await apiService.getCompanySettings();
      console.log('Company settings response:', settings);
      // Verificar se é primeiro acesso (true explícito ou se não tem o campo first_configuration_completed)
      const isFirst = settings.is_first_access === true;
      console.log('Setting isFirstAccess to:', isFirst);
      setIsFirstAccess(isFirst);
    } catch (error: any) {
      console.error('Error checking first access:', error);
      console.error('Error details:', error.response?.data || error.message);
      // Em caso de erro, assumir que não é primeiro acesso para não bloquear o usuário
      setIsFirstAccess(false);
    }
  };

  const markConfigurationComplete = () => {
    setIsFirstAccess(false);
  };

  const logout = () => {
    setUser(null);
    setToken(null);
    setIsFirstAccess(false);
    localStorage.removeItem('token');
    localStorage.removeItem('user');
    toast.error('Logout realizado com sucesso!');
  };

  const value: AuthContextType = {
    user,
    token,
    isLoading,
    isFirstAccess,
    login,
    register,
    logout,
    checkFirstAccess,
    markConfigurationComplete,
    isAuthenticated: !!user && !!token,
  };

  return (
    <AuthContext.Provider value={value}>
      {children}
    </AuthContext.Provider>
  );
};
