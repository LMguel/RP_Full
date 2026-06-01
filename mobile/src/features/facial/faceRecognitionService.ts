/**
 * FaceRecognitionService - lado JS para verificação ad-hoc.
 *
 * No fluxo normal (kiosk), o reconhecimento acontece em tempo real
 * pelo `useLiveRecognition` (frame processor + worklet). Este serviço
 * cobre:
 *   - testes manuais (CalibrationScreen)
 *   - fallback cloud quando o live engine pede ajuda (AMBIGUOUS / EMPTY_CACHE)
 */
import { logger } from '@utils/logger';
import { Config } from '@utils/config';
import { ConnectivityService } from '@services/connectivityService';
import { FacialApi } from '@api/facialApi';
import { EmployeeRepository } from '@repositories/employeeRepository';
import { EmbeddingService, getEmbeddingProvider } from './embeddingService';
import { l2Normalize } from './preprocessing';

export type RecognitionSource = 'LOCAL' | 'CLOUD' | 'NONE';

export interface RecognitionVerdict {
  recognized: boolean;
  source: RecognitionSource;
  employee_id?: string;
  employee_name?: string;
  similarity?: number;
  gap?: number;
  reason?: string;
}

export const FaceRecognitionService = {
  /**
   * Tenta reconhecer um arquivo de imagem (path local) usando o pipeline JS.
   * Útil para CalibrationScreen e debug.
   */
  async recognizeFromImageUrl(uri: string): Promise<RecognitionVerdict> {
    const provider = getEmbeddingProvider();
    if (provider) {
      const vec = await provider.embedFromImageUrl(uri);
      if (vec) {
        const normalized = l2Normalize(vec);
        const decision = EmbeddingService.match(normalized);
        if (decision.best) {
          const emp = await EmployeeRepository.findById(decision.best.employee_id);
          return {
            recognized: true,
            source: 'LOCAL',
            employee_id: decision.best.employee_id,
            employee_name: emp?.nome,
            similarity: decision.best.similarity,
            gap: decision.gap,
          };
        }
      }
    }

    return await this.cloudFallback(uri);
  },

  /**
   * Disparado quando live engine reportou AMBIGUOUS / EMPTY_CACHE / falha
   * — manda o frame para Rekognition.
   */
  async cloudFallback(uri: string): Promise<RecognitionVerdict> {
    const cfg = Config.load();
    if (!cfg.faceUseCloudFallback) {
      return { recognized: false, source: 'NONE', reason: 'cloud-fallback-disabled' };
    }
    const online = await ConnectivityService.isOnline();
    if (!online) {
      return { recognized: false, source: 'NONE', reason: 'offline' };
    }

    try {
      const resp = await FacialApi.recognize({ uri });
      if (resp.reconhecido && resp.funcionario_id) {
        return {
          recognized: true,
          source: 'CLOUD',
          employee_id: resp.funcionario_id,
          employee_name: resp.funcionario_nome,
          similarity: resp.similarity ?? resp.confidence,
        };
      }
      return {
        recognized: false,
        source: 'NONE',
        reason: resp.error ?? 'cloud-not-recognized',
      };
    } catch (e) {
      logger.warn('FaceRecognition', 'fallback cloud falhou', e);
      return { recognized: false, source: 'NONE', reason: 'cloud-error' };
    }
  },
};
