/**
 * useKioskHealth — conecta o KioskHealthMonitor ao componente React.
 *
 * Expõe callbacks estáveis para:
 *   - markFrameReceived: chamar após captura de frame bem-sucedida
 *   - markActivity:      chamar após reconhecimento/registro bem-sucedido
 *   - setCameraRecovering: informar ao monitor que recovery está em andamento
 */
import { useEffect, useRef, useCallback } from 'react';
import {
  KioskHealthMonitor,
  type KioskHealthConfig,
  type HealthAction,
} from '../services/kioskHealthMonitor';

export interface UseKioskHealthOptions {
  /** Refs/getters de estado do componente pai — devem ser estáveis (refs). */
  isProcessing: () => boolean;
  isSyncing: () => boolean;
  getPendingCount: () => number;
  getCameraStream: () => MediaStream | null;
  getVideoElement: () => HTMLVideoElement | null;
  /** Chamado quando o monitor detecta câmera com stream inválido. */
  onCameraRecovery: (reason: string) => void;
  /** Chamado quando o monitor decide que é seguro fazer reload leve. */
  onSoftReload: (reason: string) => void;
  /** Chamado quando uptime longo + idle prolongado + fila vazia. */
  onHardReload: (reason: string) => void;
  /** Chamado em diferentes níveis de uso de memória. */
  onMemoryPressure: (level: 'light' | 'medium' | 'severe') => void;
  /** Configuração opcional (usa DEFAULT_CONFIG se omitida). */
  config?: Partial<KioskHealthConfig>;
}

export function useKioskHealth({
  isProcessing,
  isSyncing,
  getPendingCount,
  getCameraStream,
  getVideoElement,
  onCameraRecovery,
  onSoftReload,
  onHardReload,
  onMemoryPressure,
  config,
}: UseKioskHealthOptions) {
  const monitorRef = useRef<KioskHealthMonitor | null>(null);

  // Callbacks atualizados via refs para evitar re-instanciar o monitor
  const onCameraRecoveryRef = useRef(onCameraRecovery);
  const onSoftReloadRef     = useRef(onSoftReload);
  const onHardReloadRef     = useRef(onHardReload);
  const onMemoryPressureRef = useRef(onMemoryPressure);
  onCameraRecoveryRef.current = onCameraRecovery;
  onSoftReloadRef.current     = onSoftReload;
  onHardReloadRef.current     = onHardReload;
  onMemoryPressureRef.current = onMemoryPressure;

  useEffect(() => {
    const monitor = new KioskHealthMonitor(
      { isProcessing, isSyncing, getPendingCount, getCameraStream, getVideoElement },
      config,
    );

    const unsubscribe = monitor.onAction((action: HealthAction) => {
      switch (action.type) {
        case 'CAMERA_RECOVERY':
          onCameraRecoveryRef.current(action.reason);
          break;
        case 'SOFT_RELOAD':
          onSoftReloadRef.current(action.reason);
          break;
        case 'HARD_RELOAD':
          onHardReloadRef.current(action.reason);
          break;
        case 'MEMORY_PRESSURE':
          onMemoryPressureRef.current(action.level);
          break;
      }
    });

    monitor.start();
    monitorRef.current = monitor;

    return () => {
      unsubscribe();
      monitor.stop();
      monitorRef.current = null;
    };
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, []); // providers/config são estáveis (refs/constantes) — não re-instanciar

  const markFrameReceived = useCallback(() => {
    monitorRef.current?.markFrameReceived();
  }, []);

  const markActivity = useCallback(() => {
    monitorRef.current?.markActivity();
  }, []);

  const setCameraRecovering = useCallback((value: boolean) => {
    monitorRef.current?.setCameraRecovering(value);
  }, []);

  return { markFrameReceived, markActivity, setCameraRecovering };
}
