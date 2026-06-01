import { http, withRetries } from './httpClient';
import type { ListFuncionariosResponse, FuncionarioApi } from '@/types/api';

export const EmployeeApi = {
  async list(): Promise<FuncionarioApi[]> {
    const res = await http().get<ListFuncionariosResponse>(
      '/api/funcionarios',
      withRetries({}, 2),
    );
    return res.data.funcionarios ?? [];
  },
};
