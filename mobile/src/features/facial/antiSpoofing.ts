/**
 * Anti-spoofing LEVE (sem modelos pesados).
 *
 * Verificações:
 *  1. Tamanho mínimo do rosto (face/frame width ratio)
 *  2. Confiança mínima do detector
 *  3. Blink detection — sequência (open → closed → open) em até N frames
 *  4. Movimento facial — variância de yaw/pitch acima de epsilon
 *
 * Estado é mantido em uma janela deslizante de frames recentes.
 * Reset automático após sucesso ou timeout.
 */

export interface FaceLikeSample {
  ts: number;
  bbox: { x: number; y: number; width: number; height: number };
  confidence?: number;
  leftEyeOpen?: number;
  rightEyeOpen?: number;
  yaw?: number;
  pitch?: number;
  roll?: number;
}

export interface AntiSpoofConfig {
  minFaceSizeRatio: number;
  minConfidence: number;
  /** Janela em frames para análise. */
  windowSize: number;
  /** Limiar de "olho aberto". */
  eyeOpenThreshold: number;
  /** Limiar de "olho fechado". */
  eyeClosedThreshold: number;
  /** Variação mínima de yaw na janela (graus). */
  minYawVariation: number;
  /** Tempo máximo para aceitar evidência (ms). */
  evidenceMaxAgeMs: number;
}

export const DEFAULT_ANTI_SPOOF_CFG: AntiSpoofConfig = {
  minFaceSizeRatio: 0.22,
  minConfidence: 0.7,
  windowSize: 30,
  eyeOpenThreshold: 0.7,
  eyeClosedThreshold: 0.3,
  minYawVariation: 4,
  evidenceMaxAgeMs: 4000,
};

export interface AntiSpoofState {
  samples: FaceLikeSample[];
  blinkObserved: boolean;
  motionObserved: boolean;
  lastResetAt: number;
}

export function createAntiSpoofState(): AntiSpoofState {
  return {
    samples: [],
    blinkObserved: false,
    motionObserved: false,
    lastResetAt: Date.now(),
  };
}

export function resetAntiSpoof(s: AntiSpoofState) {
  s.samples = [];
  s.blinkObserved = false;
  s.motionObserved = false;
  s.lastResetAt = Date.now();
}

/**
 * Aceita um sample novo e atualiza heurísticas.
 * Retorna `false` em motivos de rejeição imediatos (size/confidence).
 */
export function ingestSample(
  s: AntiSpoofState,
  cfg: AntiSpoofConfig,
  sample: FaceLikeSample,
  frameWidth: number,
): { accept: boolean; reason?: string } {
  const sizeRatio = sample.bbox.width / Math.max(1, frameWidth);
  if (sizeRatio < cfg.minFaceSizeRatio) {
    return { accept: false, reason: 'face-too-small' };
  }
  if (sample.confidence !== undefined && sample.confidence < cfg.minConfidence) {
    return { accept: false, reason: 'low-confidence' };
  }

  const now = sample.ts;
  s.samples.push(sample);
  while (s.samples.length > cfg.windowSize) s.samples.shift();
  s.samples = s.samples.filter(x => now - x.ts <= cfg.evidenceMaxAgeMs);

  s.blinkObserved = s.blinkObserved || detectBlink(s.samples, cfg);
  s.motionObserved = s.motionObserved || detectMotion(s.samples, cfg);

  return { accept: true };
}

function avgEye(sample: FaceLikeSample): number | null {
  const l = sample.leftEyeOpen;
  const r = sample.rightEyeOpen;
  if (l === undefined && r === undefined) return null;
  if (l !== undefined && r !== undefined) return (l + r) / 2;
  return l ?? r ?? null;
}

/**
 * Procura por uma transição open → closed → open na janela.
 */
function detectBlink(samples: FaceLikeSample[], cfg: AntiSpoofConfig): boolean {
  let phase: 'OPEN' | 'CLOSED' | 'OPEN_AGAIN' = 'OPEN';
  let sawClosed = false;

  for (const s of samples) {
    const eye = avgEye(s);
    if (eye === null) continue;
    if (phase === 'OPEN' && eye >= cfg.eyeOpenThreshold) continue;
    if (phase === 'OPEN' && eye <= cfg.eyeClosedThreshold) {
      phase = 'CLOSED';
      sawClosed = true;
      continue;
    }
    if (phase === 'CLOSED' && eye >= cfg.eyeOpenThreshold) {
      phase = 'OPEN_AGAIN';
      break;
    }
  }
  return sawClosed && phase === 'OPEN_AGAIN';
}

/**
 * Movimento real detectado se a variância de yaw / pitch ao longo da janela
 * for > minYawVariation graus. Diferencia rosto vivo de foto estática.
 */
function detectMotion(samples: FaceLikeSample[], cfg: AntiSpoofConfig): boolean {
  if (samples.length < 6) return false;

  const yaws = samples
    .map(s => s.yaw)
    .filter((v): v is number => typeof v === 'number');
  const pitches = samples
    .map(s => s.pitch)
    .filter((v): v is number => typeof v === 'number');

  function spread(arr: number[]): number {
    if (arr.length < 2) return 0;
    return Math.max(...arr) - Math.min(...arr);
  }

  return (
    spread(yaws) >= cfg.minYawVariation || spread(pitches) >= cfg.minYawVariation
  );
}

export function isLive(s: AntiSpoofState, requireBoth = false): boolean {
  return requireBoth
    ? s.blinkObserved && s.motionObserved
    : s.blinkObserved || s.motionObserved;
}

export function whyNotLive(s: AntiSpoofState): string {
  if (!s.blinkObserved && !s.motionObserved) return 'aguardando piscar ou movimento';
  if (!s.blinkObserved) return 'aguardando piscar';
  if (!s.motionObserved) return 'aguardando movimento leve';
  return 'ok';
}
