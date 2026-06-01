/**
 * Cache em memória dos embeddings faciais.
 *
 * - Hidrata uma vez do SQLite (lazy)
 * - Atualizações incrementais (upsert/remove)
 * - Acessível em hot path do reconhecimento sem I/O
 *
 * Os embeddings ficam como `Float32Array` (mais barato que number[]).
 */
import { EmbeddingRepository } from '@repositories/embeddingRepository';
import { logger } from '@utils/logger';
import type { FaceEmbedding } from '@/types/domain';

export interface CacheEntry {
  employee_id: string;
  embedding: Float32Array;
  model_version: string;
  updated_at: string;
}

interface ListenerEvent {
  type: 'HYDRATED' | 'UPSERT' | 'REMOVE' | 'CLEAR';
  size: number;
}

type Listener = (e: ListenerEvent) => void;

class EmbeddingCacheImpl {
  private cache = new Map<string, CacheEntry>();
  private hydrated = false;
  private hydrating: Promise<void> | null = null;
  private listeners = new Set<Listener>();
  private currentModelVersion: string | null = null;

  setExpectedModelVersion(v: string) {
    this.currentModelVersion = v;
  }

  async hydrate(force = false): Promise<void> {
    if (this.hydrated && !force) return;
    if (this.hydrating) return this.hydrating;

    this.hydrating = (async () => {
      try {
        const list = await EmbeddingRepository.listAll();
        this.cache.clear();
        for (const e of list) {
          if (
            this.currentModelVersion &&
            e.model_version !== this.currentModelVersion
          ) {
            continue;
          }
          this.cache.set(e.employee_id, {
            employee_id: e.employee_id,
            embedding: Float32Array.from(e.embedding),
            model_version: e.model_version,
            updated_at: e.updated_at,
          });
        }
        this.hydrated = true;
        logger.info('EmbeddingCache', `Hidratado com ${this.cache.size} embeddings`);
        this.emit({ type: 'HYDRATED', size: this.cache.size });
      } finally {
        this.hydrating = null;
      }
    })();
    return this.hydrating;
  }

  isHydrated(): boolean {
    return this.hydrated;
  }

  size(): number {
    return this.cache.size;
  }

  /** Snapshot com referências (sem cópia) — uso somente leitura. */
  snapshot(): CacheEntry[] {
    return Array.from(this.cache.values());
  }

  get(employeeId: string): CacheEntry | undefined {
    return this.cache.get(employeeId);
  }

  async upsert(e: FaceEmbedding): Promise<void> {
    const f32 = Float32Array.from(e.embedding);
    this.cache.set(e.employee_id, {
      employee_id: e.employee_id,
      embedding: f32,
      model_version: e.model_version,
      updated_at: e.updated_at,
    });
    await EmbeddingRepository.upsert(e);
    this.emit({ type: 'UPSERT', size: this.cache.size });
  }

  /** Bulk: persiste TODOS de uma vez e atualiza cache. */
  async upsertMany(list: FaceEmbedding[]): Promise<number> {
    const n = await EmbeddingRepository.upsertMany(list);
    for (const e of list) {
      this.cache.set(e.employee_id, {
        employee_id: e.employee_id,
        embedding: Float32Array.from(e.embedding),
        model_version: e.model_version,
        updated_at: e.updated_at,
      });
    }
    this.emit({ type: 'UPSERT', size: this.cache.size });
    return n;
  }

  async remove(employeeId: string): Promise<void> {
    this.cache.delete(employeeId);
    await EmbeddingRepository.deleteForEmployee(employeeId);
    this.emit({ type: 'REMOVE', size: this.cache.size });
  }

  async clear(): Promise<void> {
    this.cache.clear();
    await EmbeddingRepository.clearAll();
    this.hydrated = false;
    this.emit({ type: 'CLEAR', size: 0 });
  }

  /**
   * Remove embeddings cuja model_version não bate com a versão atual.
   * Chamado quando o app sobe com um modelo novo (invalidação automática).
   */
  async invalidateForModelMismatch(currentVersion: string): Promise<number> {
    const stale: string[] = [];
    const fresh = await EmbeddingRepository.listAll();
    for (const e of fresh) {
      if (e.model_version !== currentVersion) stale.push(e.employee_id);
    }
    for (const id of stale) {
      await EmbeddingRepository.deleteForEmployee(id);
      this.cache.delete(id);
    }
    if (stale.length > 0) {
      logger.warn(
        'EmbeddingCache',
        `Invalidados ${stale.length} embeddings (model mismatch -> ${currentVersion})`,
      );
    }
    return stale.length;
  }

  subscribe(l: Listener): () => void {
    this.listeners.add(l);
    return () => this.listeners.delete(l);
  }

  private emit(e: ListenerEvent) {
    this.listeners.forEach(l => {
      try {
        l(e);
      } catch {
        // ignore
      }
    });
  }
}

export const EmbeddingCache = new EmbeddingCacheImpl();
