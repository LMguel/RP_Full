/**
 * Hook composto para reconhecimento facial em tempo real.
 *
 * Pipeline (frame processor / worklet):
 *   frame ─▶ MLKit detect ─▶ anti-spoof checks ─▶
 *      crop+resize via vision-camera-resize-plugin ─▶
 *      runSync TFLite (MobileFaceNet) ─▶
 *      L2 normalize ─▶ cosine vs cache ─▶
 *      emite verdict via runOnJS
 *
 * Otimizações para Tab A11:
 *  - cooldown global (faceCooldownMs) entre tentativas de inferência
 *  - inferência só ocorre quando há rosto + tamanho mínimo + confiança mínima
 *  - frame processor com `pixelFormat: 'yuv'` para menor banda
 *  - resize plugin entrega buffer já cropado e na escala final
 *  - cache de embeddings é referência compartilhada (sem cópia por frame)
 */
import { useCallback, useEffect, useMemo, useRef, useState } from 'react';
import {
  useTensorflowModel,
  type TensorflowModel,
} from 'react-native-fast-tflite';
import {
  useFrameProcessor,
  type Frame,
  type FrameProcessor,
} from 'react-native-vision-camera';
import {
  useFaceDetector,
  type FaceDetectionOptions,
  type Face,
} from 'react-native-vision-camera-face-detector';
import { useResizePlugin } from 'vision-camera-resize-plugin';
import { Worklets } from 'react-native-worklets-core';

import { Config, type RuntimeConfig } from '@utils/config';
import { logger } from '@utils/logger';
import {
  EMBEDDING_DIM,
  MFN_INPUT_DTYPE,
  MFN_INPUT_SIZE,
  expandBbox,
  l2NormalizeInPlace,
  cosineSim,
} from './preprocessing';
import { EmbeddingCache, type CacheEntry } from './embeddingCache';
import { getLocalModelPath, publishModelInstance } from './providers/tfliteProvider';
import {
  createAntiSpoofState,
  ingestSample,
  isLive,
  resetAntiSpoof,
  whyNotLive,
  DEFAULT_ANTI_SPOOF_CFG,
  type AntiSpoofState,
  type FaceLikeSample,
} from './antiSpoofing';
import { CalibrationLog } from './calibrationLog';

type LoadedTF = { state: 'loaded'; model: TensorflowModel };

export type LiveDecision =
  | { kind: 'IDLE' }
  | { kind: 'NO_FACE' }
  | { kind: 'TOO_SMALL'; sizeRatio: number }
  | { kind: 'WAITING_LIVENESS'; reason: string }
  | { kind: 'PROCESSING' }
  | {
      kind: 'MATCH';
      employee_id: string;
      similarity: number;
      gap: number;
      durationMs: number;
    }
  | {
      kind: 'NO_MATCH';
      reason: 'BELOW_THRESHOLD' | 'AMBIGUOUS' | 'EMPTY_CACHE';
      topSimilarity: number;
      gap: number;
    }
  | { kind: 'ERROR'; message: string };

export interface UseLiveRecognitionOptions {
  enabled: boolean;
  /** Disparada (no JS) quando uma decisão final acontece. */
  onDecision: (d: LiveDecision) => void;
  /** Disparada para eventos por frame (faces detectadas, sem decisão). */
  onTick?: (info: { faces: number; phase: string }) => void;
}

export interface UseLiveRecognitionResult {
  frameProcessor: FrameProcessor | undefined;
  modelState: 'loading' | 'loaded' | 'error' | 'unavailable';
  modelError: string | null;
  cacheSize: number;
  faceDetectorEnabled: boolean;
  setEnabled: (v: boolean) => void;
}

/**
 * Carrega o modelo MobileFaceNet via fast-tflite quando um path local
 * estiver configurado. Caso contrario, o reconhecimento offline fica
 * desativado sem bloquear o boot.
 */
function useModelLoader() {
  const modelPath = useMemo(() => getLocalModelPath(), []);

  useEffect(() => {
    if (!modelPath) publishModelInstance(null, 'modelo-indisponivel');
  }, [modelPath]);

  if (!modelPath) {
    return {
      state: 'unavailable' as const,
      model: null,
      error: null,
    };
  }

  // Model path is static for this session; only load when configured.
  // eslint-disable-next-line react-hooks/rules-of-hooks
  const tf = useTensorflowModel(modelPath);

  useEffect(() => {
    if (tf.state === 'loaded') {
      logger.info(
        'TFLite',
        `Modelo carregado (hook). inputs=${JSON.stringify(tf.model.inputs.map(t => t.shape))} outputs=${JSON.stringify(tf.model.outputs.map(t => t.shape))}`,
      );
      publishModelInstance(tf.model, null);
    } else if (tf.state === 'error') {
      logger.error('TFLite', 'Modelo NÃO carregado (hook)', tf.error);
      publishModelInstance(
        null,
        (tf.error as Error)?.message ?? 'modelo-indisponivel',
      );
    }
  }, [tf.state, 'model' in tf ? tf.model : null]);

  return tf;
}

export function useLiveRecognition(
  opts: UseLiveRecognitionOptions,
): UseLiveRecognitionResult {
  const tf = useModelLoader();
  const { resize } = useResizePlugin();

  const [enabled, setEnabledState] = useState(opts.enabled);
  const [cacheSize, setCacheSize] = useState(EmbeddingCache.size());

  useEffect(() => {
    setEnabledState(opts.enabled);
  }, [opts.enabled]);

  useEffect(() => {
    EmbeddingCache.hydrate().then(() => setCacheSize(EmbeddingCache.size()));
    const unsub = EmbeddingCache.subscribe(e => setCacheSize(e.size));
    return () => {
      unsub();
    };
  }, []);

  const cfg = useMemo<RuntimeConfig>(() => Config.load(), []);

  const detectorOptions = useMemo<FaceDetectionOptions>(
    () => ({
      performanceMode: 'fast',
      classificationMode: 'all',
      landmarkMode: 'none',
      contourMode: 'none',
      trackingEnabled: true,
      autoMode: true,
      windowWidth: 0,
      windowHeight: 0,
    }),
    [],
  );
  const { detectFaces } = useFaceDetector(detectorOptions);

  const lastInferenceRef = useRef<number>(0);
  const antiSpoofRef = useRef<AntiSpoofState>(createAntiSpoofState());
  const phaseRef = useRef<'IDLE' | 'PROCESSING'>('IDLE');

  /**
   * Snapshot mutable do cache. O frame processor lê esta referência;
   * atualizamos quando o cache muda (sem recriar a árvore).
   */
  const cacheSnapshotRef = useRef<CacheEntry[]>(EmbeddingCache.snapshot());
  useEffect(() => {
    const unsub = EmbeddingCache.subscribe(() => {
      cacheSnapshotRef.current = EmbeddingCache.snapshot();
    });
    return () => {
      unsub();
    };
  }, []);

  const onDecisionJs = opts.onDecision;
  const onTickJs = opts.onTick;

  const emitDecision = useMemo(
    () => Worklets.createRunOnJS(onDecisionJs),
    [onDecisionJs],
  );
  const emitTick = useMemo(
    () => (onTickJs ? Worklets.createRunOnJS(onTickJs) : undefined),
    [onTickJs],
  );

  const recordCalibration = useMemo(
    () =>
      Worklets.createRunOnJS(
        (e: {
          durationMs: number;
          decision:
            | 'ACCEPT'
            | 'REJECT_THRESHOLD'
            | 'REJECT_GAP'
            | 'REJECT_SPOOF'
            | 'NO_FACE'
            | 'ERROR';
          topK: { employee_id: string; similarity: number }[];
          threshold: number;
          gap?: number;
          faceSizeRatio?: number;
          reason?: string;
        }) => {
          if (!CalibrationLog.isEnabled()) return;
          CalibrationLog.push({
            ts: Date.now(),
            durationMs: e.durationMs,
            decision: e.decision,
            topK: e.topK,
            threshold: e.threshold,
            gap: e.gap,
            faceSizeRatio: e.faceSizeRatio,
            reason: e.reason,
          });
        },
      ),
    [],
  );

  const cooldownMs = cfg.faceCooldownMs;
  const threshold = cfg.faceSimilarityThreshold;
  const minConfidence = cfg.faceMinConfidence;
  const minSizeRatio = cfg.faceMinSizeRatio;
  const topGap = cfg.faceTopGap;
  const antiSpoofEnabled = cfg.faceAntiSpoofEnabled;

  const enabledRef = useRef(enabled);
  useEffect(() => {
    enabledRef.current = enabled;
  }, [enabled]);

  // Ref to TFLite model for worklet access — updated via effect so the
  // worklet always sees the current model without needing it in deps.
  const modelRef = useRef<TensorflowModel | null>(null);
  useEffect(() => {
    if (tf.state === 'loaded') {
      modelRef.current = (tf as LoadedTF).model;
    } else {
      modelRef.current = null;
    }
  }, [tf.state, tf.state === 'loaded' ? (tf as LoadedTF).model : null]);

  /**
   * Frame processor com worklet. Cuidado: NUNCA referenciar React state
   * diretamente daqui — só `useRef` e capturas estáveis.
   *
   * Quando TFLite não está disponível (cloud-only mode), o worklet detecta
   * o rosto e emite NO_MATCH/EMPTY_CACHE para acionar o fallback cloud.
   */
  const frameProcessor = useFrameProcessor(
    (frame: Frame) => {
      'worklet';

      if (!enabledRef.current) return;

      const faces: Face[] = detectFaces(frame);
      if (!faces || faces.length === 0) {
        if (emitTick) emitTick({ faces: 0, phase: 'no-face' });
        if (phaseRef.current === 'IDLE') emitDecision({ kind: 'NO_FACE' });
        resetAntiSpoof(antiSpoofRef.current);
        return;
      }

      faces.sort(
        (a, b) =>
          b.bounds.width * b.bounds.height - a.bounds.width * a.bounds.height,
      );
      const face = faces[0];
      const sizeRatio = face.bounds.width / Math.max(1, frame.width);

      if (sizeRatio < minSizeRatio) {
        if (emitTick) emitTick({ faces: faces.length, phase: 'too-small' });
        emitDecision({ kind: 'TOO_SMALL', sizeRatio });
        return;
      }

      const sample: FaceLikeSample = {
        ts: Date.now(),
        bbox: {
          x: face.bounds.x,
          y: face.bounds.y,
          width: face.bounds.width,
          height: face.bounds.height,
        },
        confidence: minConfidence,
        leftEyeOpen: face.leftEyeOpenProbability,
        rightEyeOpen: face.rightEyeOpenProbability,
        yaw: face.yawAngle,
        pitch: face.pitchAngle,
        roll: face.rollAngle,
      };

      const ingest = ingestSample(
        antiSpoofRef.current,
        DEFAULT_ANTI_SPOOF_CFG,
        sample,
        frame.width,
      );
      if (!ingest.accept) {
        if (emitTick)
          emitTick({ faces: faces.length, phase: ingest.reason ?? 'reject' });
        return;
      }

      if (antiSpoofEnabled && !isLive(antiSpoofRef.current)) {
        const reason = whyNotLive(antiSpoofRef.current);
        if (emitTick) emitTick({ faces: faces.length, phase: 'liveness' });
        emitDecision({ kind: 'WAITING_LIVENESS', reason });
        return;
      }

      const now = Date.now();
      if (now - lastInferenceRef.current < cooldownMs) return;
      if (phaseRef.current === 'PROCESSING') return;

      phaseRef.current = 'PROCESSING';
      lastInferenceRef.current = now;
      emitDecision({ kind: 'PROCESSING' });

      // Cloud-only mode: no TFLite model loaded → trigger Rekognition fallback.
      const model = modelRef.current;
      if (!model) {
        emitDecision({ kind: 'NO_MATCH', reason: 'EMPTY_CACHE', topSimilarity: 0, gap: 0 });
        phaseRef.current = 'IDLE';
        resetAntiSpoof(antiSpoofRef.current);
        return;
      }

      const t0 = Date.now();
      try {
        const expanded = expandBbox(
          {
            x: face.bounds.x,
            y: face.bounds.y,
            width: face.bounds.width,
            height: face.bounds.height,
          },
          frame.width,
          frame.height,
          1.3,
        );

        const resized = resize(frame, {
          crop: expanded,
          scale: { width: MFN_INPUT_SIZE, height: MFN_INPUT_SIZE },
          pixelFormat: 'rgb',
          dataType: MFN_INPUT_DTYPE,
        }) as Uint8Array | Float32Array;

        if (
          !resized ||
          resized.length !== MFN_INPUT_SIZE * MFN_INPUT_SIZE * 3
        ) {
          phaseRef.current = 'IDLE';
          emitDecision({ kind: 'ERROR', message: 'resize-failed' });
          recordCalibration({
            durationMs: Date.now() - t0,
            decision: 'ERROR',
            topK: [],
            threshold,
            faceSizeRatio: sizeRatio,
            reason: 'resize-failed',
          });
          return;
        }

        let modelInput: Float32Array | Uint8Array;
        if (MFN_INPUT_DTYPE === 'float32') {
          // resize entrega float32 [0,1] — converter para [-1,1] (MFN)
          const u = resized as Float32Array;
          const f = new Float32Array(u.length);
          for (let i = 0; i < u.length; i++) f[i] = u[i] * 2 - 1;
          modelInput = f;
        } else {
          modelInput = resized;
        }

        const outputs = model.runSync([modelInput]) as (
          | Float32Array
          | Uint8Array
        )[];
        const raw = outputs[0];
        if (!raw || raw.length !== EMBEDDING_DIM) {
          phaseRef.current = 'IDLE';
          emitDecision({ kind: 'ERROR', message: 'output-dim' });
          recordCalibration({
            durationMs: Date.now() - t0,
            decision: 'ERROR',
            topK: [],
            threshold,
            faceSizeRatio: sizeRatio,
            reason: 'output-dim',
          });
          return;
        }

        const query = new Float32Array(EMBEDDING_DIM);
        for (let i = 0; i < EMBEDDING_DIM; i++) query[i] = raw[i];
        l2NormalizeInPlace(query);

        const cache = cacheSnapshotRef.current;
        if (cache.length === 0) {
          phaseRef.current = 'IDLE';
          resetAntiSpoof(antiSpoofRef.current);
          emitDecision({
            kind: 'NO_MATCH',
            reason: 'EMPTY_CACHE',
            topSimilarity: 0,
            gap: 0,
          });
          recordCalibration({
            durationMs: Date.now() - t0,
            decision: 'NO_FACE',
            topK: [],
            threshold,
            faceSizeRatio: sizeRatio,
            reason: 'empty-cache',
          });
          return;
        }

        let bestIdx = -1;
        let bestSim = -2;
        let secondSim = -2;
        for (let i = 0; i < cache.length; i++) {
          const sim = cosineSim(query, cache[i].embedding);
          if (sim > bestSim) {
            secondSim = bestSim;
            bestSim = sim;
            bestIdx = i;
          } else if (sim > secondSim) {
            secondSim = sim;
          }
        }
        const gap = secondSim > -2 ? bestSim - secondSim : 1;

        const topK: { employee_id: string; similarity: number }[] = [];
        if (bestIdx >= 0)
          topK.push({
            employee_id: cache[bestIdx].employee_id,
            similarity: bestSim,
          });

        if (bestIdx < 0 || bestSim < threshold) {
          phaseRef.current = 'IDLE';
          resetAntiSpoof(antiSpoofRef.current);
          emitDecision({
            kind: 'NO_MATCH',
            reason: 'BELOW_THRESHOLD',
            topSimilarity: bestSim,
            gap,
          });
          recordCalibration({
            durationMs: Date.now() - t0,
            decision: 'REJECT_THRESHOLD',
            topK,
            threshold,
            gap,
            faceSizeRatio: sizeRatio,
          });
          return;
        }
        if (gap < topGap) {
          phaseRef.current = 'IDLE';
          resetAntiSpoof(antiSpoofRef.current);
          emitDecision({
            kind: 'NO_MATCH',
            reason: 'AMBIGUOUS',
            topSimilarity: bestSim,
            gap,
          });
          recordCalibration({
            durationMs: Date.now() - t0,
            decision: 'REJECT_GAP',
            topK,
            threshold,
            gap,
            faceSizeRatio: sizeRatio,
          });
          return;
        }

        const employeeId = cache[bestIdx].employee_id;
        const durationMs = Date.now() - t0;
        emitDecision({
          kind: 'MATCH',
          employee_id: employeeId,
          similarity: bestSim,
          gap,
          durationMs,
        });
        recordCalibration({
          durationMs,
          decision: 'ACCEPT',
          topK,
          threshold,
          gap,
          faceSizeRatio: sizeRatio,
        });

        phaseRef.current = 'IDLE';
        resetAntiSpoof(antiSpoofRef.current);
      } catch (err) {
        phaseRef.current = 'IDLE';
        emitDecision({
          kind: 'ERROR',
          message: (err as Error)?.message ?? 'inference-error',
        });
      }
    },
    [
      detectFaces,
      tf.state,
      resize,
      cooldownMs,
      threshold,
      minConfidence,
      minSizeRatio,
      topGap,
      antiSpoofEnabled,
      emitDecision,
      emitTick,
      recordCalibration,
    ],
  );

  const setEnabled = useCallback((v: boolean) => setEnabledState(v), []);

  const modelState = tf.state;
  const modelError =
    modelState === 'error'
      ? (tf as { error?: Error }).error?.message ?? 'erro'
      : modelState === 'unavailable'
      ? 'modelo-indisponivel'
      : null;

  return {
    // Always provide frameProcessor when enabled: cloud-only mode runs face
    // detection even without TFLite and triggers Rekognition fallback.
    frameProcessor: enabled ? frameProcessor : undefined,
    modelState,
    modelError,
    cacheSize,
    faceDetectorEnabled: true,
    setEnabled,
  };
}

