import { execute, rowsToArray } from '@database/sqlite';
import type { FaceEmbedding } from '@/types/domain';
import { nowIso } from '@utils/time';
import { logger } from '@utils/logger';

interface EmbeddingRow {
  employee_id: string;
  embedding: string;
  model_version: string;
  updated_at: string;
}

function rowToEmbedding(r: EmbeddingRow): FaceEmbedding | null {
  try {
    return {
      employee_id: r.employee_id,
      embedding: JSON.parse(r.embedding) as number[],
      model_version: r.model_version,
      updated_at: r.updated_at,
    };
  } catch (e) {
    logger.warn('EmbeddingRepository', `Embedding corrompido emp=${r.employee_id}`, e);
    return null;
  }
}

export const EmbeddingRepository = {
  async upsert(e: FaceEmbedding): Promise<void> {
    await execute(
      `INSERT INTO face_embeddings (employee_id, embedding, model_version, updated_at)
       VALUES (?, ?, ?, ?)
       ON CONFLICT(employee_id) DO UPDATE SET
         embedding=excluded.embedding,
         model_version=excluded.model_version,
         updated_at=excluded.updated_at`,
      [e.employee_id, JSON.stringify(e.embedding), e.model_version, e.updated_at ?? nowIso()],
    );
  },

  async upsertMany(list: FaceEmbedding[]): Promise<number> {
    let n = 0;
    for (const e of list) {
      await this.upsert(e);
      n++;
    }
    return n;
  },

  async findById(employeeId: string): Promise<FaceEmbedding | null> {
    const res = await execute(
      'SELECT * FROM face_embeddings WHERE employee_id = ? LIMIT 1',
      [employeeId],
    );
    const row = rowsToArray<EmbeddingRow>(res)[0];
    return row ? rowToEmbedding(row) : null;
  },

  async listAll(): Promise<FaceEmbedding[]> {
    const res = await execute('SELECT * FROM face_embeddings', []);
    return rowsToArray<EmbeddingRow>(res)
      .map(rowToEmbedding)
      .filter((e): e is FaceEmbedding => e !== null);
  },

  async deleteForEmployee(employeeId: string): Promise<void> {
    await execute('DELETE FROM face_embeddings WHERE employee_id = ?', [employeeId]);
  },

  async clearAll(): Promise<void> {
    await execute('DELETE FROM face_embeddings', []);
  },
};
