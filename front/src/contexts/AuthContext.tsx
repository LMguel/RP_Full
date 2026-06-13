import React, { createContext, useContext, useState, useEffect, ReactNode } from 'react';
import { User, LoginRequest, RegisterRequest, UserRole, Permission } from '../types';
import { apiService } from '../services/api';
import { toast } from 'react-hot-toast';

interface AuthContextType {
  user: User | null;
  token: string | null;
  isLoading: boolean;
  isFirstAccess: boolean;
  role: UserRole | null;
  permissions: Permission[];
  userName: string | null;
  hasPermission: (perm: Permission) => boolean;
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

function decodeTokenPayload(token: string): Record<string, any> | null {
  try {
    return JSON.parse(atob(token.split('.')[1]));
  } catch {
    return null;
  }
}

export const AuthProvider: React.FC<AuthProviderProps> = ({ children }) => {
  const [user, setUser] = useState<User | null>(null);
  const [token, setToken] = useState<string | null>(null);
  const [isLoading, setIsLoading] = useState(true);
  const [isFirstAccess, setIsFirstAccess] = useState(false);
  const [role, setRole] = useState<UserRole | null>(null);
  const [permissions, setPermissions] = useState<Permission[]>([]);
  const [userName, setUserName] = useState<string | null>(null);

  const hasPermission = (perm: Permission): boolean => {
    if (role === 'OWNER') return true;
    return permissions.includes(perm);
  };

  const _applyTokenPayload = (payload: Record<string, any>) => {
    const r = (payload.role as UserRole) || null;
    const p = (payload.permissions as Permission[]) || [];
    const n = payload.user_name || payload.empresa_nome || null;
    setRole(r);
    setPermissions(p);
    setUserName(n);
    return { r, p, n };
  };

  useEffect(() => {
    // Check for existing token and user data on app start
    const initAuth = async () => {
      const storedToken = localStorage.getItem('token');
      const storedUser = localStorage.getItem('user');

      if (storedToken && storedUser) {
        try {
          setToken(storedToken);
          const parsed = JSON.parse(storedUser) as User;
          setUser(parsed);
          const payload = decodeTokenPayload(storedToken);
          if (payload) {
            _applyTokenPayload(payload);
          } else {
            // legacy token: treat as OWNER
            setRole('OWNER');
            setPermissions([]);
          }
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

        const payload = decodeTokenPayload(response.token);
        const userData: User = {
          usuario_id: response.usuario_id || payload?.usuario_id || '',
          email: '',
          empresa_nome: response.empresa_nome || payload?.empresa_nome || '',
          empresa_id: response.company_id || payload?.company_id || '',
          company_id: response.company_id || payload?.company_id,
          role: response.role || payload?.role,
          permissions: response.permissions || payload?.permissions,
          user_name: response.user_name || payload?.user_name,
        };
        setUser(userData);
        localStorage.setItem('user', JSON.stringify(userData));

        if (payload) {
          _applyTokenPayload(payload);
        } else {
          setRole('OWNER');
          setPermissions([]);
          setUserName(userData.empresa_nome);
        }

        toast.success('Login realizado com sucesso!');
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
      const isFirst = settings.is_first_access === true;
      setIsFirstAccess(isFirst);
    } catch {
      setIsFirstAccess(false);
    }
  };

  const markConfigurationComplete = () => {
    setIsFirstAccess(false);
  };

  const logout = () => {
    setUser(null);
    setToken(null);
    setRole(null);
    setPermissions([]);
    setUserName(null);
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
    role,
    permissions,
    userName,
    hasPermission,
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
