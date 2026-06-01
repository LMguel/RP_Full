/**
 * Processador da fila de sync.
 * Lê itens prontos da sync_queue e despacha para handlers por tipo.
 * Falhas usam backoff exponencial via SyncQueueRepository.markFailed.
 */
import { Config } from '@utils/config';
import { logger } from '@utils/logger';
import { SyncQueueRepository } from '@repositories/syncQueueRepository';
import { TimeRecordRepository } from '@repositories/timeRecordRepository';
import { EmployeeRepository } from '@repositories/employeeRepository';
import { EmployeeApi } from '@api/employeeApi';
import { FacialApi } from '@api/facialApi';
import { EmbeddingPullService } from '@features/facial/embeddingPullService';
import type { SyncQueueItem, SyncOpType, Employee } from '@/types/domain';
import type {
  RegisterPointFacialRequest,
  RegisterPointFacialResponse,
  FuncionarioApi,
} from '@/types/api';
import { isOfflineError } from '@api/httpClient';

interface TimeRecordSyncPayload {
  record_id: string;
  client_id: string;
  funcionario_id: string;
  data_hora: string;
  tipo?: string;
  similarity?: number;
  device_id: string;
  offline: true;
}

type Handler = (item: SyncQueueItem) => Promise<void>;

const handlers: Partial<Record<SyncOpType, Handler>> = {
  TIME_RECORD_CREATE: async item => {
    const payload = JSON.parse(item.payload) as TimeRecordSyncPayload;

    const req: RegisterPointFacialRequest = {
      funcionario_id: payload.funcionario_id,
      metodo: 'kiosk_offline_facial',
      data_hora: payload.data_hora,
      tipo: payload.tipo,
      device_id: payload.device_id,
      similarity: payload.similarity,
      offline: true,
      client_id: payload.client_id,
    };

    let resp: RegisterPointFacialResponse;
    try {
      resp = await FacialApi.registerPoint(req);
    } catch (e) {
      const status = (e as { response?: { status?: number } })?.response?.status;
      if (status === 409) {
        logger.info('queueProcessor', `Registro já existe remoto (409). Marcando sync.`);
        await TimeRecordRepository.markSynced(payload.record_id);
        return;
      }
      throw e;
    }

    await TimeRecordRepository.markSynced(payload.record_id, resp.registro?.id);
  },

  EMPLOYEE_PULL: async () => {
    const list = await EmployeeApi.list();
    const employees: Employee[] = list.map((f: FuncionarioApi) => ({
      id: f.id,
      company_id: f.empresa_id ?? '',
      nome: f.nome ?? '',
      matricula: f.matricula,
      cargo: f.cargo,
      foto_url: f.foto_url,
      face_id: f.face_id,
      ativo: f.ativo ?? f.is_active ?? true,
      horario_entrada: f.horario_entrada,
      horario_saida: f.horario_saida,
      updated_at: new Date().toISOString(),
    }));
    await EmployeeRepository.upsertMany(employees);
    logger.info('queueProcessor', `Sincronizou ${employees.length} funcionários`);
  },

  EMBEDDING_PULL: async () => {
    const r = await EmbeddingPullService.pullIncremental();
    logger.info(
      'queueProcessor',
      `Sync embeddings: +${r.added}, -${r.removed}`,
    );
  },
};

export const QueueProcessor = {
  /**
   * Processa o lote atual. Retorna número de items resolvidos com sucesso.
   */
  async runBatch(): Promise<{ ok: number; failed: number; pending: number }> {
    const cfg = Config.load();
    const items = await SyncQueueRepository.listReady(cfg.syncBatchSize);
    let ok = 0;
    let failed = 0;

    for (const item of items) {
      const handler = handlers[item.type];
      if (!handler) {
        logger.warn('queueProcessor', `Sem handler para tipo ${item.type}. Removendo.`);
        await SyncQueueRepository.markDone(item.id);
        continue;
      }

      await SyncQueueRepository.markInFlight(item.id);
      try {
        await handler(item);
        await SyncQueueRepository.markDone(item.id);
        ok++;
      } catch (e) {
        failed++;
        const offline = isOfflineError(e);
        const msg = offline
          ? 'Offline durante envio'
          : (e as Error)?.message ?? String(e);
        logger.warn('queueProcessor', `Falha em item ${item.id} (${item.type}): ${msg}`);
        await SyncQueueRepository.markFailed(item.id, item.retries + 1, msg);
        if (offline) break;
      }
    }

    const pending = await SyncQueueRepository.countPending();
    return { ok, failed, pending };
  },
};
