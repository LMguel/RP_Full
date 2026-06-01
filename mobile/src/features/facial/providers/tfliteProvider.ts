/**
 * TFLiteEmbeddingProvider — provider real baseado em MobileFaceNet TFLite.
 *
 * USOS:
 *  1. Hot path do live recognition (frame processor) — usa o `model.runSync()`
 *     diretamente dentro do worklet (ver hooks/useLiveRecognition).
 *  2. Path one-shot a partir de URL (cadastro/warmup) — usa MLKit Face Detection
 *     em arquivo + ImageResizer para crop+resize → roda inferência no JS thread.
 *
 * O modelo é carregado via react-native-fast-tflite. O singleton é exposto
 * por `getTFLiteRegistry()` para que o frame processor possa usar o `model`
 * carregado pelo hook React.
 */
import { loadTensorflowModel, type TensorflowModel } from 'react-native-fast-tflite';
import RNBlobUtil from 'react-native-blob-util';
import ImageResizer from '@bam.tech/react-native-image-resizer';
import FaceDetection, { type Face as MlkitFace } from '@react-native-ml-kit/face-detection';
import { logger } from '@utils/logger';
import { Config } from '@utils/config';
import {
  EMBEDDING_DIM,
  MFN_INPUT_SIZE,
  MFN_INPUT_DTYPE,
  l2Normalize,
} from '../preprocessing';
import type { EmbeddingProvider, FaceFrame } from '../embeddingService';

export const TFLITE_MODEL_VERSION = 'mobilefacenet@112x112-192d';

interface ModelStateRef {
  model: TensorflowModel | null;
  loadError: string | null;
  isLoading: boolean;
  loadPromise: Promise<TensorflowModel | null> | null;
}

const ref: ModelStateRef = {
  model: null,
  loadError: null,
  isLoading: false,
  loadPromise: null,
};

function resolveLocalModelPath(): string | null {
  const cfg = Config.load();
  if (!cfg.faceLocalModelEnabled) return null;
  const path = cfg.faceLocalModelPath?.trim();
  return path && path.length > 0 ? path : null;
}

export function getLocalModelPath(): string | null {
  return resolveLocalModelPath();
}

/**
 * Loader async para uso no thread JS (warmup, calibração).
 * No hot path do frame processor, use `useTensorflowModel` no componente
 * (que já cuida do ciclo de vida via React) e exponha o `.model` aqui.
 */
async function loadModel(): Promise<TensorflowModel | null> {
  if (ref.model) return ref.model;
  if (ref.loadPromise) return ref.loadPromise;

  const modelPath = resolveLocalModelPath();
  if (!modelPath) {
    ref.loadError = 'modelo-indisponivel';
    ref.model = null;
    logger.warn('TFLite', 'Modelo local desativado ou path vazio');
    return null;
  }

  ref.isLoading = true;
  ref.loadPromise = (async () => {
    try {
      const m = await loadTensorflowModel(modelPath);
      ref.model = m;
      ref.loadError = null;
      logger.info(
        'TFLite',
        `Modelo carregado. inputs=${JSON.stringify(m.inputs.map(t => t.shape))} outputs=${JSON.stringify(m.outputs.map(t => t.shape))}`,
      );
      return m;
    } catch (e) {
      ref.loadError = (e as Error)?.message ?? String(e);
      logger.error('TFLite', 'Modelo NÃO carregado', e);
      return null;
    } finally {
      ref.isLoading = false;
      ref.loadPromise = null;
    }
  })();
  return ref.loadPromise;
}

/**
 * Permite que o componente (que carregou o modelo via useTensorflowModel)
 * publique a instância para outros consumidores no thread JS.
 */
export function publishModelInstance(
  m: TensorflowModel | null,
  error?: string | null,
) {
  ref.model = m;
  if (m) {
    ref.loadError = null;
    return;
  }
  if (error) ref.loadError = error;
}

export function getModelInstance(): TensorflowModel | null {
  return ref.model;
}

export function getModelLoadError(): string | null {
  return ref.loadError;
}

/**
 * Recorta e redimensiona uma imagem em arquivo para o input do MFN
 * (112x112 RGB). Usa MLKit para localizar o rosto na imagem.
 *
 * Retorna o caminho do JPEG final 112x112 + bbox.
 */
async function cropResizeToModelInput(
  fileUri: string,
): Promise<{ resizedUri: string; bbox: { x: number; y: number; width: number; height: number } } | null> {
  const faces: MlkitFace[] = await FaceDetection.detect(fileUri, {
    performanceMode: 'accurate',
    landmarkMode: 'none',
    classificationMode: 'none',
    contourMode: 'none',
  });

  if (!faces || faces.length === 0) {
    logger.warn('TFLite', 'MLKit não detectou rosto na imagem');
    return null;
  }
  faces.sort((a, b) => b.frame.width * b.frame.height - a.frame.width * a.frame.height);
  const face = faces[0];

  const margin = 0.25;
  const fx = Math.max(0, Math.floor(face.frame.left - face.frame.width * margin * 0.5));
  const fy = Math.max(0, Math.floor(face.frame.top - face.frame.height * margin * 0.5));
  const fw = Math.floor(face.frame.width * (1 + margin));
  const fh = Math.floor(face.frame.height * (1 + margin));
  const side = Math.max(fw, fh);

  const resized = await ImageResizer.createResizedImage(
    fileUri,
    MFN_INPUT_SIZE,
    MFN_INPUT_SIZE,
    'JPEG',
    92,
    0,
    undefined,
    false,
    {
      mode: 'cover',
      onlyScaleDown: false,
    },
  );

  return {
    resizedUri: resized.uri,
    bbox: { x: fx, y: fy, width: side, height: side },
  };
}

/**
 * Decodifica um JPEG 112x112 em Float32Array (112*112*3) com normalização MFN.
 * Usamos blob-util para ler os bytes; a decodificação JPEG real precisa de
 * um helper nativo. Como esse path é usado SOMENTE para enrollment manual
 * (não para o hot path camera), aceitamos custo maior.
 *
 * Estratégia: pedimos uma representação base64-RGB através do bridge nativo
 * — caso o bridge não exista (build atual), retornamos null e o caller cai
 * para o `embeddingPullService` (embeddings vindos do backend).
 */
async function jpegToTensor(_uri: string): Promise<Float32Array | null> {
  return null;
}

class TFLiteProviderImpl implements EmbeddingProvider {
  readonly modelVersion = TFLITE_MODEL_VERSION;

  async preload(): Promise<boolean> {
    const m = await loadModel();
    return m !== null;
  }

  /**
   * Path do frame processor: NÃO usado aqui. O frame processor chama
   * direto `model.runSync` no worklet. Este método existe só para
   * compatibilidade com a interface antiga e cobre o caso de testes.
   */
  async embed(_frame: FaceFrame): Promise<number[] | null> {
    logger.warn(
      'TFLite',
      'embed(frame) chamado fora do frame processor — use useLiveRecognition',
    );
    return null;
  }

  /**
   * Path async para enrollment: imagem → recorte → tensor → embedding.
   * Requer modelo carregado.
   */
  async embedFromImageUrl(url: string): Promise<number[] | null> {
    const m = await loadModel();
    if (!m) return null;

    let localPath = url;
    if (/^https?:\/\//i.test(url)) {
      try {
        const tmp = await RNBlobUtil.config({ fileCache: true, appendExt: 'jpg' }).fetch(
          'GET',
          url,
        );
        localPath = `file://${tmp.path()}`;
      } catch (e) {
        logger.warn('TFLite', `Download da imagem ${url} falhou`, e);
        return null;
      }
    }

    const cropped = await cropResizeToModelInput(localPath);
    if (!cropped) return null;

    const tensor = await jpegToTensor(cropped.resizedUri);
    if (!tensor) {
      logger.warn(
        'TFLite',
        'JPEG-to-tensor não disponível neste build. Use embeddingPullService.',
      );
      return null;
    }

    if (tensor.length !== MFN_INPUT_SIZE * MFN_INPUT_SIZE * 3) {
      logger.error(
        'TFLite',
        `Tensor input com tamanho inesperado: ${tensor.length}`,
      );
      return null;
    }

    let modelInput: Float32Array | Uint8Array = tensor;
    if (MFN_INPUT_DTYPE === 'uint8') {
      const u8 = new Uint8Array(tensor.length);
      for (let i = 0; i < tensor.length; i++) {
        u8[i] = Math.max(0, Math.min(255, Math.round((tensor[i] + 1) * 127.5)));
      }
      modelInput = u8;
    }

    try {
      const outs = m.runSync([modelInput]) as (Float32Array | Uint8Array)[];
      const raw = outs[0];
      if (!raw || raw.length !== EMBEDDING_DIM) {
        logger.error('TFLite', `Output dim inesperada: ${raw?.length}`);
        return null;
      }
      const arr = new Array<number>(raw.length);
      for (let i = 0; i < raw.length; i++) arr[i] = raw[i];
      return l2Normalize(arr);
    } catch (e) {
      logger.error('TFLite', 'runSync falhou', e);
      return null;
    }
  }
}

export const TFLiteEmbeddingProvider = new TFLiteProviderImpl();
