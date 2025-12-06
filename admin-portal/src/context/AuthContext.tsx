import {
  createContext,
  useCallback,
  useContext,
  useEffect,
  useMemo,
  useState,
  type ReactNode,
} from "react";

interface AdminUser {
  id: string;
  name: string;
  login: string;
}

interface LoginPayload {
  login: string;
  password: string;
}

interface AuthState {
  admin: AdminUser | null;
  token: string | null;
}

interface AuthContextValue extends AuthState {
  isAuthenticated: boolean;
  loading: boolean;
  login: (payload: LoginPayload) => Promise<void>;
  logout: () => void;
}

const STORAGE_KEY = "rp_admin_portal_session";

const AuthContext = createContext<AuthContextValue | undefined>(undefined);

function readSession(): AuthState {
  if (typeof window === "undefined") {
    return { admin: null, token: null };
  }
  try {
    const raw = localStorage.getItem(STORAGE_KEY);
    if (!raw) return { admin: null, token: null };
    const parsed = JSON.parse(raw) as AuthState;
    return {
      admin: parsed.admin ?? null,
      token: parsed.token ?? null,
    };
  } catch (error) {
    console.warn("Failed to read auth session", error);
    return { admin: null, token: null };
  }
}

function persistSession(state: AuthState) {
  if (typeof window === "undefined") return;
  localStorage.setItem(STORAGE_KEY, JSON.stringify(state));
}

function clearSession() {
  if (typeof window === "undefined") return;
  localStorage.removeItem(STORAGE_KEY);
}

export function AuthProvider({ children }: { children: ReactNode }) {
  const [state, setState] = useState<AuthState>(() => readSession());

  useEffect(() => {
    if (typeof window === "undefined") return;
    const handleStorage = (event: StorageEvent) => {
      if (event.key === STORAGE_KEY) {
        setState(readSession());
      }
    };
    window.addEventListener("storage", handleStorage);
    return () => window.removeEventListener("storage", handleStorage);
  }, []);

  const login = useCallback(async ({ login, password }: LoginPayload) => {
    const trimmedLogin = login.trim();
    if (!trimmedLogin || !password) {
      throw new Error("Preencha login e senha para continuar.");
    }

    if (trimmedLogin.length < 3) {
      throw new Error("Login deve ter pelo menos 3 caracteres.");
    }

    if (password.length < 6) {
      throw new Error("A senha deve ter pelo menos 6 caracteres.");
    }

    // Call backend API for authentication
    const apiUrl = import.meta.env.VITE_API_URL || "http://localhost:5000";
    
    const response = await fetch(`${apiUrl}/api/auth/admin-login`, {
      method: "POST",
      headers: {
        "Content-Type": "application/json",
      },
      body: JSON.stringify({
        login: trimmedLogin,
        password: password,
      }),
    });

    if (!response.ok) {
      const errorData = await response.json();
      throw new Error(errorData?.error || "Falha na autenticação.");
    }

    const result = await response.json();
    const adminPayload = result?.admin;

    if (!result?.token || !adminPayload?.login) {
      throw new Error("Resposta inválida do servidor de autenticação.");
    }

    const admin: AdminUser = {
      id: adminPayload.login,
      name: adminPayload.login,
      login: adminPayload.login,
    };

    const newState: AuthState = {
      admin,
      token: result.token,
    };
    persistSession(newState);
    setState(newState);
  }, []);

  const logout = useCallback(() => {
    clearSession();
    setState({ admin: null, token: null });
  }, []);

  const value = useMemo<AuthContextValue>(
    () => ({
      ...state,
      isAuthenticated: Boolean(state.token),
      loading: false,
      login,
      logout,
    }),
    [state, login, logout]
  );

  return <AuthContext.Provider value={value}>{children}</AuthContext.Provider>;
}

// eslint-disable-next-line react-refresh/only-export-components
export function useAuthContext() {
  const context = useContext(AuthContext);
  if (!context) {
    throw new Error("useAuthContext deve ser utilizado dentro de AuthProvider");
  }
  return context;
}
