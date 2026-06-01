import React, { createContext, useState, useContext, useEffect, useCallback, ReactNode } from 'react';
import apiService from '../../services/api';
import { cacheEmployees, clearEmployeeCache } from '../../services/offline/employeeCache';
import { useSessionTimeout, renewSession } from '../../hooks/useSessionTimeout';
import type { FuncionarioUser, EmpresaUser, UserType } from '../../types';

interface AuthContextValue {
  signed: boolean;
  user: FuncionarioUser | EmpresaUser | null;
  userType: UserType | null;
  loading: boolean;
  kioskShouldRestore: boolean;
  clearKioskRestore: () => void;
  signInFuncionario: (id: string, senha: string) => Promise<FuncionarioUser>;
  signInEmpresa: (usuario: string, senha: string) => Promise<EmpresaUser>;
  signOut: () => void;
}

const AuthContext = createContext<AuthContextValue>({} as AuthContextValue);

async function cleanupOnLogout(companyId?: string): Promise<void> {
  // 1. Limpar cache de funcionários no IndexedDB
  try { await clearEmployeeCache(companyId); } catch { /* ignore */ }

  // 2. Limpar caches de API do service worker (não remover assets PWA)
  if ('caches' in window) {
    try {
      const cacheNames = await caches.keys();
      for (const name of cacheNames) {
        if (name.includes('api-cache')) {
          await caches.delete(name);
        }
      }
    } catch { /* ignore */ }
  }

  // 3. Limpar localStorage sensível (preservar device_id para rastreio offline)
  const keysToRemove = ['@app:token', '@app:userType', '@app:user', '@app:session_expires', '@kiosk:active'];
  for (const key of keysToRemove) {
    localStorage.removeItem(key);
  }

  // 4. Limpar sessionStorage
  try { sessionStorage.clear(); } catch { /* ignore */ }
}

export function AuthProvider({ children }: { children: ReactNode }) {
  const [user, setUser] = useState<FuncionarioUser | EmpresaUser | null>(null);
  const [userType, setUserType] = useState<UserType | null>(null);
  const [loading, setLoading] = useState(true);
  const [kioskShouldRestore, setKioskShouldRestore] = useState(false);

  const clearKioskRestore = useCallback(() => {
    setKioskShouldRestore(false);
  }, []);

  const signOut = useCallback(async () => {
    const companyId = (user as EmpresaUser)?.company_id;
    await cleanupOnLogout(companyId);
    apiService.setAuthToken(null);
    setUser(null);
    setUserType(null);
    setKioskShouldRestore(false);
  }, [user]);

  // Session timeout — auto-logout quando expirar
  useSessionTimeout(userType, signOut);

  useEffect(() => {
    try {
      const token = localStorage.getItem('@app:token');
      const storedType = localStorage.getItem('@app:userType') as UserType | null;
      const storedUser = localStorage.getItem('@app:user');
      if (token && storedType && storedUser) {
        apiService.setAuthToken(token);
        setUserType(storedType);
        setUser(JSON.parse(storedUser));

        // Kiosk recovery: empresa logada E kiosk estava ativo antes do reload
        if (storedType === 'empresa' && localStorage.getItem('@kiosk:active') === 'true') {
          setKioskShouldRestore(true);
        }
      }
    } catch {
      // Token ou user corrompido — limpar
      cleanupOnLogout().catch(() => {});
    } finally {
      setLoading(false);
    }
  }, []);

  async function signInFuncionario(id: string, senha: string): Promise<FuncionarioUser> {
    const { token, funcionario } = await apiService.loginFuncionario(id, senha);
    localStorage.setItem('@app:token', token);
    localStorage.setItem('@app:userType', 'funcionario');
    localStorage.setItem('@app:user', JSON.stringify(funcionario));
    localStorage.removeItem('@app:session_expires'); // força novo timer
    apiService.setAuthToken(token);
    setUser(funcionario as FuncionarioUser);
    setUserType('funcionario');
    renewSession('funcionario');
    return funcionario as FuncionarioUser;
  }

  async function signInEmpresa(usuario: string, senha: string): Promise<EmpresaUser> {
    const res = await apiService.loginEmpresa(usuario, senha);
    const empresaData: EmpresaUser = {
      usuario_id: res.usuario_id,
      empresa_nome: res.empresa_nome,
      company_id: res.company_id,
      tipo: res.tipo,
    };
    localStorage.setItem('@app:token', res.token);
    localStorage.setItem('@app:userType', 'empresa');
    localStorage.setItem('@app:user', JSON.stringify(empresaData));
    localStorage.removeItem('@app:session_expires');
    apiService.setAuthToken(res.token);
    setUser(empresaData);
    setUserType('empresa');
    renewSession('empresa');

    // Cache offline de funcionários (fire-and-forget)
    apiService.getEmployees().then(employees => {
      cacheEmployees(employees, res.company_id).catch(() => {});
    }).catch(() => {});

    return empresaData;
  }

  return (
    <AuthContext.Provider value={{
      signed: !!user,
      user,
      userType,
      loading,
      kioskShouldRestore,
      clearKioskRestore,
      signInFuncionario,
      signInEmpresa,
      signOut,
    }}>
      {children}
    </AuthContext.Provider>
  );
}

export function useAuth(): AuthContextValue {
  const ctx = useContext(AuthContext);
  if (!ctx) throw new Error('useAuth deve ser usado dentro de AuthProvider');
  return ctx;
}
