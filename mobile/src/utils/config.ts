/**
 * Configuração runtime do app.
 * Pode ser sobrescrita via ConfigStore (configuração remota da empresa).
 */
import { storage } from '@storage/mmkv';

export interface RuntimeConfig {
  apiBaseUrl: string;
  apiTimeoutMs: number;
  syncIntervalMs: number;
  syncBatchSize: number;

  /** Limiar mínimo de cosine similarity para aceitar match local. */
  faceSimilarityThreshold: number;
  /** Mínimo de confiança do detector facial (0-1). */
  faceMinConfidence: number;
  /** Habilita Rekognition como fallback. */
  faceUseCloudFallback: boolean;
  /** Tamanho mínimo do rosto em fração da largura do frame. */
  faceMinSizeRatio: number;
  /** Diferença mínima entre top-1 e top-2 para evitar ambiguidade. */
  faceTopGap: number;
  /** Cooldown entre tentativas de match (ms). */
  faceCooldownMs: number;
  /** Anti-spoofing: exigir blink ou movimento facial antes de aceitar. */
  faceAntiSpoofEnabled: boolean;
  /** Logs detalhados para tela de calibração. */
  faceCalibrationLogging: boolean;
  /** Habilita reconhecimento local (TFLite) quando o modelo estiver disponível. */
  faceLocalModelEnabled: boolean;
  /** Caminho local (filesystem) do modelo TFLite. */
  faceLocalModelPath: string;

  kioskAutoLock: boolean;
  kioskBootAutoStart: boolean;
  debugLogs: boolean;
}

const DEFAULTS: RuntimeConfig = {
  apiBaseUrl: 'https://api.registraponto.com.br',
  apiTimeoutMs: 15000,
  syncIntervalMs: 60_000,
  syncBatchSize: 20,

  faceSimilarityThreshold: 0.62,
  faceMinConfidence: 0.7,
  faceUseCloudFallback: true,
  faceMinSizeRatio: 0.22,
  faceTopGap: 0.05,
  faceCooldownMs: 1500,
  faceAntiSpoofEnabled: true,
  faceCalibrationLogging: false,
  faceLocalModelEnabled: false,
  faceLocalModelPath: '',

  kioskAutoLock: true,
  kioskBootAutoStart: true,
  debugLogs: false,
};

const CONFIG_KEY = 'runtime_config_v1';

export const Config = {
  load(): RuntimeConfig {
    const raw = storage.getString(CONFIG_KEY);
    if (!raw) return { ...DEFAULTS };
    try {
      const parsed = JSON.parse(raw) as Partial<RuntimeConfig>;
      return { ...DEFAULTS, ...parsed };
    } catch {
      return { ...DEFAULTS };
    }
  },

  save(patch: Partial<RuntimeConfig>): RuntimeConfig {
    const next = { ...this.load(), ...patch };
    storage.set(CONFIG_KEY, JSON.stringify(next));
    return next;
  },

  reset(): RuntimeConfig {
    storage.delete(CONFIG_KEY);
    return { ...DEFAULTS };
  },

  defaults(): RuntimeConfig {
    return { ...DEFAULTS };
  },
};
