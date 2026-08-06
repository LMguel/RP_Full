import { db, type CachedEmployee } from './db';
import type { Employee } from '../../types';
import { kioskLog } from '../kioskLogger';
import apiService from '../api';

const CACHE_REFRESHED_AT_KEY = '@kiosk:cache_refreshed_at';

/**
 * Projeta apenas os campos mínimos necessários para o modo kiosk offline.
 * LGPD: cpf, face_id, foto_url e outros dados sensíveis NÃO são armazenados
 * no IndexedDB do dispositivo sem criptografia.
 */
function toSafeCacheEntry(e: Employee, companyId: string): CachedEmployee {
  return {
    id: e.id,
    nome: e.nome,
    cargo: e.cargo,
    matricula: e.matricula,
    company_id: companyId,
    cached_at: Date.now(),
  };
}

/**
 * Grava a lista de funcionários no cache local. Recusa sobrescrever um cache
 * já populado com uma resposta vazia — evita apagar o cache bom quando a API
 * responde 200 com uma lista vazia por instabilidade momentânea.
 */
export async function cacheEmployees(employees: Employee[], companyId: string): Promise<void> {
  const records: CachedEmployee[] = employees
    .filter(e => e.ativo !== false)
    .map(e => toSafeCacheEntry(e, companyId));

  if (records.length === 0) {
    const existing = await getCachedEmployeeCount(companyId);
    if (existing > 0) {
      kioskLog('EMPLOYEE_CACHE_EMPTY_RESPONSE', `mantido cache existente (${existing})`);
      return;
    }
  }

  await db.employees_cache.where('company_id').equals(companyId).delete();
  await db.employees_cache.bulkAdd(records);
}

/**
 * Busca funcionários da API e atualiza o cache local. Fire-and-forget seguro:
 * nunca lança, sempre registra o resultado via telemetria para diagnóstico remoto.
 * Retorna a quantidade de funcionários cacheados (0 em caso de falha).
 */
export async function refreshEmployeeCache(companyId: string): Promise<number> {
  if (!companyId) {
    kioskLog('EMPLOYEE_CACHE_FAILED', 'company_id ausente');
    return 0;
  }
  try {
    const employees = await apiService.getEmployees();
    await cacheEmployees(employees, companyId);
    const count = await getCachedEmployeeCount(companyId);
    localStorage.setItem(CACHE_REFRESHED_AT_KEY, String(Date.now()));
    kioskLog('EMPLOYEE_CACHE_OK', `count=${count}`);
    return count;
  } catch (err: any) {
    kioskLog('EMPLOYEE_CACHE_FAILED', String(err?.message || err).slice(0, 80));
    return 0;
  }
}

/** Idade do último refresh bem-sucedido, em ms. Infinity se nunca refrescou. */
export function getCacheAgeMs(): number {
  const ts = parseInt(localStorage.getItem(CACHE_REFRESHED_AT_KEY) || '0', 10);
  return ts > 0 ? Date.now() - ts : Infinity;
}

export async function getCachedEmployees(companyId: string): Promise<CachedEmployee[]> {
  const rows = await db.employees_cache.where('company_id').equals(companyId).toArray();
  return rows.sort((a, b) => a.nome.localeCompare(b.nome, 'pt-BR'));
}

export async function getCachedEmployeeCount(companyId: string): Promise<number> {
  return db.employees_cache.where('company_id').equals(companyId).count();
}

export async function clearEmployeeCache(companyId?: string): Promise<void> {
  if (companyId) {
    await db.employees_cache.where('company_id').equals(companyId).delete();
  } else {
    await db.employees_cache.clear();
  }
}
