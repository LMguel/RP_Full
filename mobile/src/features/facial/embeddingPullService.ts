/**
 * EmbeddingPullService - busca embeddings pré-computados do backend.
 *
 * Estratégia recomendada: o backend (durante o cadastro do funcionário,
 * ou via job batch sobre as fotos S3) computa o embedding 192d e armazena
 * no DynamoDB junto com `model_version`. Mobile pulla via:
 *
 *   GET /api/v2/face_embeddings?company_id=...&since=ISO&model_version=...
 *
 * Resposta:
 *   {
 *     items: [{ employee_id, embedding: number[], model_version, updated_at }],
 *     server_now: ISO,
 *     model_version: 'mobilefacenet@112x112-192d'
 *   }
 *
 * Mobile envia `since` como o último `updated_at` recebido — pull
 * incremental.
 */
import { http, withRetries } from '@api/httpClient';
import { storage } from '@storage/mmkv';
import { EmbeddingCache } from './embeddingCache';
import { TFLITE_MODEL_VERSION } from './providers/tfliteProvider';
import { logger } from '@utils/logger';
import type { FaceEmbedding } from '@/types/domain';

const SINCE_KEY = 'embeddings_pull_since_v1';

interface ApiEmbedding {
  employee_id: string;
  embedding: number[];
  model_version: string;
  updated_at: string;
  deleted?: boolean;
}

interface PullResponse {
  items: ApiEmbedding[];
  server_now: string;
  model_version?: string;
}

export const EmbeddingPullService = {
  async pullIncremental(): Promise<{ added: number; removed: number }> {
    const since = storage.getString(SINCE_KEY);
    const params = new URLSearchParams();
    if (since) params.set('since', since);
    params.set('model_version', TFLITE_MODEL_VERSION);

    let resp: PullResponse;
    try {
      const r = await http().get<PullResponse>(
        `/api/v2/face_embeddings?${params.toString()}`,
        withRetries({}, 1),
      );
      resp = r.data;
    } catch (e) {
      const status = (e as { response?: { status?: number } })?.response?.status;
      if (status === 404) {
        logger.warn(
          'EmbeddingPull',
          '/api/v2/face_embeddings não disponível no backend (404)',
        );
        return { added: 0, removed: 0 };
      }
      throw e;
    }

    if (
      resp.model_version &&
      resp.model_version !== TFLITE_MODEL_VERSION
    ) {
      logger.warn(
        'EmbeddingPull',
        `Backend serve modelo ${resp.model_version} mas app espera ${TFLITE_MODEL_VERSION}`,
      );
    }

    const upserts: FaceEmbedding[] = [];
    let removed = 0;

    for (const item of resp.items ?? []) {
      if (item.model_version && item.model_version !== TFLITE_MODEL_VERSION) {
        continue;
      }
      if (item.deleted) {
        await EmbeddingCache.remove(item.employee_id);
        removed++;
        continue;
      }
      if (!Array.isArray(item.embedding) || item.embedding.length === 0) {
        continue;
      }
      upserts.push({
        employee_id: item.employee_id,
        embedding: item.embedding,
        model_version: item.model_version || TFLITE_MODEL_VERSION,
        updated_at: item.updated_at,
      });
    }

    if (upserts.length > 0) {
      await EmbeddingCache.upsertMany(upserts);
    }

    if (resp.server_now) storage.set(SINCE_KEY, resp.server_now);

    logger.info(
      'EmbeddingPull',
      `Sync facial: +${upserts.length}, -${removed}, total=${EmbeddingCache.size()}`,
    );
    return { added: upserts.length, removed };
  },

  reset() {
    storage.delete(SINCE_KEY);
  },
};
