/**
 * Preprocessamento e constantes para MobileFaceNet.
 *
 * Funções declaradas como `worklet` podem ser chamadas tanto no
 * thread JS quanto no thread de frame processor (vision-camera).
 * Mantemos só Math básico, sem dependências de runtime.
 */

/** Tamanho de input do MobileFaceNet (224 / 112 / 160 — usar conforme modelo). */
export const MFN_INPUT_SIZE = 112;
export const EMBEDDING_DIM = 192;

/**
 * Dtype esperado pelo modelo. MobileFaceNet "padrão" aceita uint8 com
 * normalização interna OU float32 [-1, 1]. Mantemos uint8 (mais rápido)
 * por padrão; se o seu modelo for float32, troque para 'float32'.
 */
export const MFN_INPUT_DTYPE: 'uint8' | 'float32' = 'uint8';

/**
 * L2 normalize in-place. Worklet-safe.
 * @returns o próprio buffer normalizado (para encadeamento).
 */
export function l2NormalizeInPlace(v: Float32Array | number[]): Float32Array | number[] {
  'worklet';
  let sum = 0;
  for (let i = 0; i < v.length; i++) sum += v[i] * v[i];
  const norm = Math.sqrt(sum) || 1;
  for (let i = 0; i < v.length; i++) v[i] = v[i] / norm;
  return v;
}

export function l2Normalize(v: number[]): number[] {
  'worklet';
  let sum = 0;
  for (let i = 0; i < v.length; i++) sum += v[i] * v[i];
  const norm = Math.sqrt(sum) || 1;
  const out = new Array<number>(v.length);
  for (let i = 0; i < v.length; i++) out[i] = v[i] / norm;
  return out;
}

/** Cosine similarity de dois vetores L2-normalizados (= dot product). */
export function cosineSim(a: ArrayLike<number>, b: ArrayLike<number>): number {
  'worklet';
  if (a.length !== b.length) return -1;
  let dot = 0;
  for (let i = 0; i < a.length; i++) dot += a[i] * b[i];
  return dot;
}

/**
 * Converte buffer uint8 RGB [0,255] para float32 [-1,1] (normalização MFN).
 * Usado quando o resize plugin entrega uint8.
 */
export function uint8ToMfnFloat32(input: Uint8Array): Float32Array {
  'worklet';
  const out = new Float32Array(input.length);
  for (let i = 0; i < input.length; i++) {
    out[i] = (input[i] - 127.5) / 128;
  }
  return out;
}

export function copyToFloat32(buffer: ArrayLike<number>): Float32Array {
  'worklet';
  const out = new Float32Array(buffer.length);
  for (let i = 0; i < buffer.length; i++) out[i] = buffer[i];
  return out;
}

/**
 * Expande uma bbox por um fator de margem (ex 1.25 = +25% em cada lado).
 * Mantém dentro do frame.
 */
export function expandBbox(
  bbox: { x: number; y: number; width: number; height: number },
  frameWidth: number,
  frameHeight: number,
  factor = 1.25,
): { x: number; y: number; width: number; height: number } {
  'worklet';
  const cx = bbox.x + bbox.width / 2;
  const cy = bbox.y + bbox.height / 2;
  const w = bbox.width * factor;
  const h = bbox.height * factor;
  // sempre crop quadrado para casar com 112x112
  const side = Math.max(w, h);
  let x = cx - side / 2;
  let y = cy - side / 2;
  let s = side;
  if (x < 0) x = 0;
  if (y < 0) y = 0;
  if (x + s > frameWidth) s = frameWidth - x;
  if (y + s > frameHeight) s = frameHeight - y;
  return { x: Math.floor(x), y: Math.floor(y), width: Math.floor(s), height: Math.floor(s) };
}
