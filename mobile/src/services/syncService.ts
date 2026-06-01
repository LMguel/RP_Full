/**
 * SyncService - orquestra:
 *  - tick periódico (setInterval)
 *  - ouvir conectividade (online -> kick imediato)
 *  - background-fetch (Headless JS Android)
 *  - bootstrap empresa pós-login (pull employees + embeddings + config)
 */
import BackgroundFetch from 'react-native-background-fetch';
import { Config } from '@utils/config';
import { logger } from '@utils/logger';
import { ConnectivityService } from './connectivityService';
import { QueueProcessor } from './queueProcessor';
import { SyncQueueRepository } from '@repositories/syncQueueRepository';
import { useSyncStore } from '@features/sync/syncStore';
import { nowIso } from '@utils/time';

const EMBEDDING_PULL_INTERVAL_MS = 10 * 60 * 1000; // 10 minutos
let lastEmbeddingPullAt = 0;

let timer: ReturnType<typeof setInterval> | null = null;
let unsubConn: (() => void) | null = null;
let running = false;

async function tick(reason: string) {
  if (running) {
    logger.debug('SyncService', `tick(${reason}) ignorado: já em execução`);
    return;
  }
  running = true;
  useSyncStore.getState().setSyncing(true);
  try {
    const online = await ConnectivityService.isOnline();
    if (!online) {
      const pending = await SyncQueueRepository.countPending();
      useSyncStore.getState().setPendingCount(pending);
      logger.debug('SyncService', `tick(${reason}) skip - offline (pending=${pending})`);
      return;
    }

    const now = Date.now();
    if (now - lastEmbeddingPullAt > EMBEDDING_PULL_INTERVAL_MS) {
      lastEmbeddingPullAt = now;
      await SyncQueueRepository.enqueue('EMBEDDING_PULL', { ts: nowIso() });
    }

    const result = await QueueProcessor.runBatch();
    useSyncStore.getState().setPendingCount(result.pending);
    useSyncStore.getState().setLastSync(nowIso());
    useSyncStore.getState().setLastError(null);
    logger.info(
      'SyncService',
      `tick(${reason}) ok=${result.ok} failed=${result.failed} pending=${result.pending}`,
    );
  } catch (e) {
    const msg = (e as Error)?.message ?? String(e);
    useSyncStore.getState().setLastError(msg);
    logger.error('SyncService', `tick(${reason}) erro`, e);
  } finally {
    running = false;
    useSyncStore.getState().setSyncing(false);
  }
}

export const SyncService = {
  async start() {
    if (timer) return;
    const cfg = Config.load();

    timer = setInterval(() => void tick('interval'), cfg.syncIntervalMs);

    unsubConn = ConnectivityService.subscribe(online => {
      if (online) void tick('online');
    });

    try {
      await BackgroundFetch.configure(
        {
          minimumFetchInterval: 15,
          stopOnTerminate: false,
          startOnBoot: true,
          enableHeadless: true,
          requiredNetworkType: BackgroundFetch.NETWORK_TYPE_ANY,
          requiresCharging: false,
          requiresDeviceIdle: false,
          requiresBatteryNotLow: false,
          requiresStorageNotLow: false,
        },
        async taskId => {
          logger.info('SyncService', `BG-fetch fired: ${taskId}`);
          await tick('background-fetch');
          BackgroundFetch.finish(taskId);
        },
        async taskId => {
          logger.warn('SyncService', `BG-fetch timeout: ${taskId}`);
          BackgroundFetch.finish(taskId);
        },
      );
      await BackgroundFetch.start();
    } catch (e) {
      logger.warn('SyncService', 'BackgroundFetch.configure falhou', e);
    }

    const pending = await SyncQueueRepository.countPending();
    useSyncStore.getState().setPendingCount(pending);

    void tick('startup');
    logger.info('SyncService', `iniciado (interval=${cfg.syncIntervalMs}ms)`);
  },

  async stop() {
    if (timer) clearInterval(timer);
    timer = null;
    unsubConn?.();
    unsubConn = null;
    try {
      await BackgroundFetch.stop();
    } catch {
      // ignore
    }
  },

  async kick(reason = 'manual'): Promise<void> {
    await tick(reason);
  },
};
