import { db, type CachedEmployee } from './db';
import type { Employee } from '../../types';

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

export async function cacheEmployees(employees: Employee[], companyId: string): Promise<void> {
  const records: CachedEmployee[] = employees
    .filter(e => e.ativo !== false)
    .map(e => toSafeCacheEntry(e, companyId));
  await db.employees_cache.where('company_id').equals(companyId).delete();
  await db.employees_cache.bulkAdd(records);
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
