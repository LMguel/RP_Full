/**
 * Bootstrap unificado do app.
 * Roda UMA vez antes da árvore React montar.
 *
 *  1. inicia SQLite + migrations
 *  2. configura logger persistente
 *  3. garante device_id
 *  4. configura providers do http (token + device_id)
 *  5. hidrata authStore do keychain
 *  6. registra TFLite embedding provider + invalida embeddings velhos
 *  7. hidrata cache facial em memória
 *  8. inicia connectivity + sync
 */
import { initDatabase } from '@database/sqlite';
import { LogRepository } from '@repositories/logRepository';
import { setLogPersister, logger } from '@utils/logger';
import { DeviceIdService } from '@services/deviceIdService';
import {
  configureAuthProvider,
  configureDeviceIdProvider,
  configureUnauthorizedHandler,
} from '@api/httpClient';
import { useAuthStore } from '@features/auth/authStore';
import { ConnectivityService } from '@services/connectivityService';
import { SyncService } from '@services/syncService';
import { KioskService } from '@features/kiosk/kioskService';
import { Config } from '@utils/config';
import {
  TFLITE_MODEL_VERSION,
  TFLiteEmbeddingProvider,
} from '@features/facial/providers/tfliteProvider';
import { setEmbeddingProvider } from '@features/facial/embeddingService';
import { EmbeddingCache } from '@features/facial/embeddingCache';

let booted = false;

export async function bootstrapApp(): Promise<void> {
  if (booted) return;
  booted = true;

  await initDatabase();

  setLogPersister((level, message, context) => {
    LogRepository.append(level, message, context).catch(() => {});
  });

  logger.info('Bootstrap', 'SQLite + Logger inicializados');

  const deviceId = await DeviceIdService.ensure();
  logger.info('Bootstrap', `Device ID: ${deviceId}`);

  configureDeviceIdProvider(() => deviceId);
  configureAuthProvider(() => useAuthStore.getState().getToken());
  configureUnauthorizedHandler(() => {
    useAuthStore.getState().clear();
  });

  const cfg = Config.load();
  const localModelEnabled =
    cfg.faceLocalModelEnabled && !!cfg.faceLocalModelPath?.trim();

  if (localModelEnabled) {
    setEmbeddingProvider(TFLiteEmbeddingProvider);
    await EmbeddingCache.invalidateForModelMismatch(TFLITE_MODEL_VERSION);
    await EmbeddingCache.hydrate();
  } else {
    logger.warn(
      'Bootstrap',
      'Modelo facial local desativado: reconhecimento offline indisponível',
    );
  }

  await useAuthStore.getState().hydrate();

  ConnectivityService.start();

  if (useAuthStore.getState().session) {
    void SyncService.start();

    if (cfg.kioskBootAutoStart) {
      void KioskService.setBootStartEnabled(true);
    }
  }

  LogRepository.prune().catch(() => {});

  logger.info('Bootstrap', 'App pronto');
}
