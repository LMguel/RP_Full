/**
 * BootstrapService - rotina pós-login.
 * Baixa funcionários, embeddings e configurações da empresa
 * para uso 100% offline a seguir.
 */
import { EmployeeApi } from '@api/employeeApi';
import { EmployeeRepository } from '@repositories/employeeRepository';
import { DeviceConfigRepository } from '@repositories/deviceConfigRepository';
import { EmbeddingPullService } from '@features/facial/embeddingPullService';
import { EmbeddingCache } from '@features/facial/embeddingCache';
import { DeviceIdService } from './deviceIdService';
import { logger } from '@utils/logger';
import { nowIso } from '@utils/time';
import { Config } from '@utils/config';
import type { Employee } from '@/types/domain';
import type { FuncionarioApi } from '@/types/api';

export const BootstrapService = {
  /**
   * Pulls iniciais. Idempotente; chamado após login OU sob demanda no Settings.
   */
  async pullCompanyData(companyId: string): Promise<{
    employees: number;
    embeddings: number;
  }> {
    logger.info('Bootstrap', `Iniciando pull empresa ${companyId}`);

    const apiList = await EmployeeApi.list();
    const employees: Employee[] = apiList.map((f: FuncionarioApi) => ({
      id: f.id,
      company_id: companyId,
      nome: f.nome ?? '',
      matricula: f.matricula,
      cargo: f.cargo,
      foto_url: f.foto_url,
      face_id: f.face_id,
      ativo: f.ativo ?? f.is_active ?? true,
      horario_entrada: f.horario_entrada,
      horario_saida: f.horario_saida,
      updated_at: nowIso(),
    }));

    await EmployeeRepository.upsertMany(employees);
    logger.info('Bootstrap', `Salvou ${employees.length} funcionários`);

    let embeddingsAdded = 0;
    try {
      const r = await EmbeddingPullService.pullIncremental();
      embeddingsAdded = r.added;
    } catch (e) {
      logger.warn('Bootstrap', 'Pull de embeddings falhou (continua)', e);
    }
    await EmbeddingCache.hydrate(true);

    const cfg = Config.load();
    const deviceId = await DeviceIdService.ensure();
    await DeviceConfigRepository.upsert({
      device_id: deviceId,
      company_id: companyId,
      kiosk_enabled: true,
      similarity_threshold: cfg.faceSimilarityThreshold,
      use_cloud_fallback: cfg.faceUseCloudFallback,
      sync_interval_ms: cfg.syncIntervalMs,
      updated_at: nowIso(),
    });

    return { employees: employees.length, embeddings: embeddingsAdded };
  },
};
