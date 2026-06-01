/**
 * Operações vetoriais para embeddings faciais (lado JS).
 * As versões worklet-safe estão em preprocessing.ts.
 */
import { cosineSim, l2Normalize as l2NormalizeWorklet } from './preprocessing';

export const l2Normalize = l2NormalizeWorklet;
export const cosineSimilarity = cosineSim;

export interface MatchResult {
  employee_id: string;
  similarity: number;
}

export interface MatchDecision {
  best: MatchResult | null;
  /** Top-2 ranked candidates. */
  topK: MatchResult[];
  /** best.similarity - second.similarity (0 se só um candidato). */
  gap: number;
}

/**
 * Encontra top-K candidatos por cosine similarity (assume embeddings L2-normalizados).
 */
export function findTopK(
  query: ArrayLike<number>,
  candidates: { employee_id: string; embedding: ArrayLike<number> }[],
  k = 3,
): MatchResult[] {
  if (candidates.length === 0) return [];
  const heap: MatchResult[] = [];
  for (const c of candidates) {
    const s = cosineSim(query, c.embedding);
    heap.push({ employee_id: c.employee_id, similarity: s });
  }
  heap.sort((a, b) => b.similarity - a.similarity);
  return heap.slice(0, k);
}

export function decide(
  query: ArrayLike<number>,
  candidates: { employee_id: string; embedding: ArrayLike<number> }[],
  threshold: number,
  topGap: number,
): MatchDecision {
  const topK = findTopK(query, candidates, 3);
  if (topK.length === 0) return { best: null, topK: [], gap: 0 };
  const best = topK[0];
  const second = topK[1];
  const gap = second ? best.similarity - second.similarity : 1;
  if (best.similarity < threshold) return { best: null, topK, gap };
  if (second && gap < topGap) return { best: null, topK, gap };
  return { best, topK, gap };
}

export function findBestMatch(
  query: ArrayLike<number>,
  candidates: { employee_id: string; embedding: ArrayLike<number> }[],
): MatchResult | null {
  const top = findTopK(query, candidates, 1);
  return top[0] ?? null;
}
