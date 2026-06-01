/**
 * RecordService - cria registros de ponto offline-first.
 *
 * Fluxo:
 *  1. cria registro local em time_records (synced=0)
 *  2. enfileira TIME_RECORD_CREATE em sync_queue
 *  3. dispara SyncService.kick() (não-bloqueante)
 *
 * O registro local é a fonte da verdade até confirmação do backend.
 */
import { TimeRecordRepository } from '@repositories/timeRecordRepository';
import { SyncQueueRepository } from '@repositories/syncQueueRepository';
import { DeviceIdService } from '@services/deviceIdService';
import { ConnectivityService } from '@services/connectivityService';
import { SyncService } from '@services/syncService';
import { useAuthStore } from '@features/auth/authStore';
import { useSyncStore } from '@features/sync/syncStore';
import { logger } from '@utils/logger';
import type { TimeRecord, RecordMethod } from '@/types/domain';

interface CreateRecordInput {
  employee_id: string;
  method: RecordMethod;
  similarity?: number;
  timestamp?: string;
}

export const RecordService = {
  async createPunch(input: CreateRecordInput): Promise<TimeRecord> {
    const session = useAuthStore.getState().session;
    if (!session) throw new Error('Sessão não autenticada');

    const deviceId = await DeviceIdService.ensure();
    const online = await ConnectivityService.isOnline();

    const record = await TimeRecordRepository.create({
      employee_id: input.employee_id,
      company_id: session.company_id,
      timestamp: input.timestamp,
      metodo: input.method,
      similarity: input.similarity,
      device_id: deviceId,
      offline: !online,
    });

    await SyncQueueRepository.enqueue('TIME_RECORD_CREATE', {
      record_id: record.id,
      client_id: (record as TimeRecord & { client_id?: string }).client_id ?? record.id,
      funcionario_id: record.employee_id,
      data_hora: record.timestamp,
      tipo: record.tipo,
      similarity: record.similarity,
      device_id: deviceId,
      offline: true,
    });

    const pending = await SyncQueueRepository.countPending();
    useSyncStore.getState().setPendingCount(pending);

    if (online) {
      void SyncService.kick('post-record');
    } else {
      logger.info('RecordService', `Registro offline criado (pending=${pending})`);
    }

    return record;
  },
};
