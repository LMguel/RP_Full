import { http, withRetries } from './httpClient';
import type { LoginRequest, LoginResponse } from '@/types/api';

export const AuthApi = {
  async loginEmpresa(usuario_id: string, senha: string): Promise<LoginResponse> {
    const body: LoginRequest = { usuario_id, senha };
    const res = await http().post<LoginResponse>('/api/login', body, withRetries({}, 1));
    return res.data;
  },
};
