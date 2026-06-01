/**
 * EmbeddingService - serviço de alto nível para geração e matching
 * de embeddings faciais.
 *
 * O hot path do live-recognition NÃO passa por aqui — ver
 * useLiveRecognition (frame processor + worklet TFLite). Este módulo
 * cobre os caminhos JS-side: enrollment, calibração e fallback.
 */
import { logger } from '@utils/logger';
import { EmbeddingCache } from './embeddingCache';
import { decide, findTopK, type MatchDecision, type MatchResult } from './faceMath';
import { l2Normalize } from './preprocessing';
import { Config } from '@utils/config';

export interface FaceFrame {
  uri: string;
  width: number;
  height: number;
  bbox?: { x: number; y: number; width: number; height: number };
}

export interface EmbeddingProvider {
  readonly modelVersion: string;
  preload?(): Promise<boolean>;
  embed(frame: FaceFrame): Promise<number[] | null>;
  embedFromImageUrl(url: string): Promise<number[] | null>;
}

let provider: EmbeddingProvider | null = null;

export function setEmbeddingProvider(p: EmbeddingProvider) {
  provider = p;
  EmbeddingCache.setExpectedModelVersion(p.modelVersion);
  logger.info('EmbeddingService', `Provider definido: ${p.modelVersion}`);
}

export function getEmbeddingProvider(): EmbeddingProvider | null {
  return provider;
}

export const EmbeddingService = {
  /**
   * Gera embeddings via image URL (enrollment / debug).
   * Pula quem já tem embedding com mesma model_version (a menos que `force`).
   */
  async warmupForEmployees(
    employees: { id: string; foto_url?: string }[],
    force = false,
  ): Promise<number> {
    if (!provider) {
      logger.warn('EmbeddingService', 'Sem provider — warmup ignorado');
      return 0;
    }

    let count = 0;
    for (const e of employees) {
      if (!e.foto_url) continue;

      const existing = EmbeddingCache.get(e.id);
      if (
        !force &&
        existing &&
        existing.model_version === provider.modelVersion
      ) continue;

      const vec = await provider.embedFromImageUrl(e.foto_url);
      if (!vec) continue;

      const normalized = l2Normalize(vec);
      await EmbeddingCache.upsert({
        employee_id: e.id,
        embedding: normalized,
        model_version: provider.modelVersion,
        updated_at: new Date().toISOString(),
      });
      count++;
    }
    logger.info('EmbeddingService', `Warmup gerou ${count} embeddings`);
    return count;
  },

  /**
   * Match com decisão (top-K + gap + threshold). Usa o cache em memória.
   */
  match(query: ArrayLike<number>, threshold?: number): MatchDecision {
    const cfg = Config.load();
    const t = threshold ?? cfg.faceSimilarityThreshold;
    const candidates = EmbeddingCache.snapshot().map(c => ({
      employee_id: c.employee_id,
      embedding: c.embedding,
    }));
    return decide(query, candidates, t, cfg.faceTopGap);
  },

  topK(query: ArrayLike<number>, k = 5): MatchResult[] {
    const candidates = EmbeddingCache.snapshot().map(c => ({
      employee_id: c.employee_id,
      embedding: c.embedding,
    }));
    return findTopK(query, candidates, k);
  },
};
