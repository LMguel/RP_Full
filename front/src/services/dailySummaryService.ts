import api from './api';
import type { 
  DailySummary, 
  DailySummaryFilters, 
  DailyRecordsResponse,
  DayDetailsResponse 
} from '../types/dailySummary';

/**
 * Busca resumos diários com filtros opcionais
 */
export const getDailySummaries = async (
  filters: DailySummaryFilters = {},
  page: number = 1,
  pageSize: number = 50
): Promise<DailyRecordsResponse> => {
  const params = new URLSearchParams();
  
  if (filters.month) params.append('month', filters.month);
  if (filters.employee_id) params.append('employee_id', filters.employee_id);
  if (filters.status) params.append('status', filters.status);
  if (filters.date) params.append('date', filters.date);
  if (filters.start_date) params.append('start_date', filters.start_date);
  if (filters.end_date) params.append('end_date', filters.end_date);
  
  params.append('page', page.toString());
  params.append('page_size', pageSize.toString());

  const url = `/api/registros-diarios?${params.toString()}`;
  console.log('[API] Chamando:', url);
  
  try {
    const data = await api.get(url);
    console.log('[API] Resposta recebida:', data);
    return data as DailyRecordsResponse;
  } catch (error: any) {
    console.error('[API] Erro na requisição:', error);
    console.error('[API] Erro response:', error.response);
    throw error;
  }
};

/**
 * Busca detalhes de um dia específico (resumo + registros individuais)
 */
export const getDayDetails = async (
  employeeId: string,
  date: string
): Promise<DayDetailsResponse> => {
  const data = await api.get(
    `/api/registros-diarios/${employeeId}/${date}`
  );
  
  return data as DayDetailsResponse;
};

/**
 * Força recalculo de um resumo diário específico
 */
export const recalculateDaySummary = async (
  employeeId: string,
  date: string
): Promise<DailySummary> => {
  const data = await api.post(
    `/api/registros-diarios/${employeeId}/${date}/recalcular`,
    {}
  );
  
  return data as DailySummary;
};
