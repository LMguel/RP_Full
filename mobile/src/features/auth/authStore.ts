/**
 * Auth store. Mantém sessão em memória + restauração do Keychain ao boot.
 */
import { create } from 'zustand';
import type { AuthSession } from '@/types/domain';
import { SecureStorage } from '@storage/secureStorage';
import { storage } from '@storage/mmkv';
import { logger } from '@utils/logger';
import { nowIso } from '@utils/time';

interface AuthState {
  session: AuthSession | null;
  isHydrated: boolean;
  isAuthenticating: boolean;
  hydrate: () => Promise<void>;
  setSession: (s: AuthSession) => Promise<void>;
  clear: () => Promise<void>;
  getToken: () => string | null;
}

const SESSION_META_KEY = 'auth_session_meta_v1';

interface SessionMeta {
  empresa_nome: string;
  usuario_id: string;
  issued_at: string;
}

export const useAuthStore = create<AuthState>((set, get) => ({
  session: null,
  isHydrated: false,
  isAuthenticating: false,

  async hydrate() {
    try {
      const creds = await SecureStorage.getAuthToken();
      if (!creds) {
        set({ isHydrated: true });
        return;
      }
      const metaRaw = storage.getString(SESSION_META_KEY);
      const meta: SessionMeta = metaRaw
        ? JSON.parse(metaRaw)
        : { empresa_nome: '', usuario_id: '', issued_at: nowIso() };

      set({
        session: {
          token: creds.token,
          company_id: creds.companyId,
          empresa_nome: meta.empresa_nome,
          usuario_id: meta.usuario_id,
          issued_at: meta.issued_at,
        },
        isHydrated: true,
      });
      logger.info('AuthStore', 'Sessão restaurada do keychain');
    } catch (e) {
      logger.error('AuthStore', 'Falha ao hidratar sessão', e);
      set({ isHydrated: true });
    }
  },

  async setSession(s) {
    await SecureStorage.setAuthToken(s.token, s.company_id);
    storage.set(
      SESSION_META_KEY,
      JSON.stringify({
        empresa_nome: s.empresa_nome,
        usuario_id: s.usuario_id,
        issued_at: s.issued_at,
      } satisfies SessionMeta),
    );
    set({ session: s });
  },

  async clear() {
    await SecureStorage.clearAuthToken();
    storage.delete(SESSION_META_KEY);
    set({ session: null });
  },

  getToken() {
    return get().session?.token ?? null;
  },
}));
