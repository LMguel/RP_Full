import { apiService } from './api';
import type {
  PayrollConfig, EmployeePayrollConfig, Competencia,
  PreFolhaItem, RHDashboard,
} from '../types';

const get  = (url: string) => apiService.get(url).then(r => r.data ?? r);
const put  = (url: string, data: unknown) => apiService.put(url, data).then(r => r.data ?? r);
const post = (url: string, data?: unknown) => apiService.post(url, data ?? {}).then(r => r.data ?? r);

export const payrollService = {
  // Config empresa
  getConfig: (): Promise<PayrollConfig> => get('/api/rh/config'),
  saveConfig: (cfg: Partial<PayrollConfig>) => put('/api/rh/config', cfg),

  // Config funcionário
  getEmpConfig: (eid: string): Promise<EmployeePayrollConfig> => get(`/api/rh/funcionario/${eid}/config`),
  saveEmpConfig: (eid: string, cfg: Partial<EmployeePayrollConfig>) => put(`/api/rh/funcionario/${eid}/config`, cfg),
  listEmpConfigs: (): Promise<{ configs: EmployeePayrollConfig[] }> => get('/api/rh/funcionarios/configs'),

  // Competências
  listCompetencias: (): Promise<{ competencias: Competencia[] }> => get('/api/rh/competencias'),
  createCompetencia: (competencia?: string) => post('/api/rh/competencias', { competencia }),
  getCompetencia: (comp: string): Promise<Competencia> => get(`/api/rh/competencias/${comp}`),

  // Pré-folha
  getPreFolha: (comp: string): Promise<{ pre_folha: PreFolhaItem[] }> => get(`/api/rh/pre-folha/${comp}`),
  calcular: (comp: string): Promise<{ success: boolean; total_funcionarios: number; total_folha: number; pre_folha: PreFolhaItem[] }> =>
    post(`/api/rh/calcular/${comp}`),

  // Fechamento
  fechar: (comp: string) => post(`/api/rh/fechar/${comp}`),
  reabrir: (comp: string) => post(`/api/rh/reabrir/${comp}`),

  // Exportação
  exportar: (comp: string): Promise<{ rows: Record<string, string | number>[]; competencia: string; total: number }> =>
    get(`/api/rh/exportar/${comp}`),

  // Dashboard
  getDashboard: (): Promise<RHDashboard> => get('/api/rh/dashboard'),
};

// ─── Formatação ───────────────────────────────────────────────────────────────

export function fmtBRL(value: number): string {
  return new Intl.NumberFormat('pt-BR', { style: 'currency', currency: 'BRL' }).format(value);
}

export function fmtHoras(h: number): string {
  if (h === 0) return '0h';
  const hh = Math.floor(Math.abs(h));
  const mm = Math.round((Math.abs(h) - hh) * 60);
  const sign = h < 0 ? '-' : '';
  return mm > 0 ? `${sign}${hh}h${String(mm).padStart(2, '0')}` : `${sign}${hh}h`;
}

export function fmtCompetencia(comp: string): string {
  const [year, month] = comp.split('-');
  const months = ['Jan','Fev','Mar','Abr','Mai','Jun','Jul','Ago','Set','Out','Nov','Dez'];
  return `${months[parseInt(month) - 1]} ${year}`;
}

export function competenciaAtual(): string {
  const now = new Date();
  return `${now.getFullYear()}-${String(now.getMonth() + 1).padStart(2, '0')}`;
}

export function statusColor(status: string): string {
  switch (status?.toUpperCase()) {
    case 'ABERTA':       return '#10b981';
    case 'FECHADA':      return 'rgba(255,255,255,0.35)';
    case 'PROCESSANDO':  return '#f59e0b';
    default:             return '#6366f1';
  }
}
