/**
 * KioskHealthMonitor — serviço de auto-recuperação do kiosk.
 *
 * Hierarquia de ações (da menos à mais disruptiva):
 *   1. CAMERA_RECOVERY  — reinicia stream sem reload de página
 *   2. MEMORY_PRESSURE  — libera recursos ou reinicia câmera
 *   3. SOFT_RELOAD      — reload apenas quando idle + sem sync + sem captura
 *   4. HARD_RELOAD      — reload após N horas de uptime + M minutos idle + fila vazia
 *
 * NUNCA dispara reload durante: isProcessing · isSyncing · pendingCount > 0
 */

import { kioskLog } from './kioskLogger';

// ─── Tipos públicos ───────────────────────────────────────────────────────────

export interface KioskHealthConfig {
  /** Intervalo entre health-checks. Padrão: 5 min. */
  healthCheckIntervalMs: number;
  /** Tempo máximo sem detectar stream live antes de recovery. Padrão: 10 s. */
  cameraLiveTimeoutMs: number;
  /** Habilita soft-reload por pressão de memória. Padrão: true. */
  softReloadEnabled: boolean;
  /** Uptime mínimo para hard-reload. Padrão: 12 h. */
  hardReloadAfterHours: number;
  /** Idle mínimo (sem atividade) para hard-reload. Padrão: 15 min. */
  hardReloadIdleMinutes: number;
  /** % de heap que ativa aviso leve. Padrão: 75%. */
  memoryLightPct: number;
  /** % de heap que reinicia câmera. Padrão: 85%. */
  memoryMediumPct: number;
  /** % de heap que permite soft-reload. Padrão: 90%. */
  memorySeverePct: number;
}

export const DEFAULT_CONFIG: KioskHealthConfig = {
  healthCheckIntervalMs: 5 * 60 * 1000,
  cameraLiveTimeoutMs: 10_000,
  softReloadEnabled: true,
  hardReloadAfterHours: 12,
  hardReloadIdleMinutes: 15,
  memoryLightPct: 75,
  memoryMediumPct: 85,
  memorySeverePct: 90,
};

export type HealthAction =
  | { type: 'CAMERA_RECOVERY'; reason: string }
  | { type: 'MEMORY_PRESSURE'; level: 'light' | 'medium' | 'severe' }
  | { type: 'SOFT_RELOAD'; reason: string }
  | { type: 'HARD_RELOAD'; reason: string };

/** Callbacks que o monitor usa para ler estado externo (refs de React, etc.) */
export interface HealthStateProviders {
  isProcessing: () => boolean;
  isSyncing: () => boolean;
  getPendingCount: () => number;
  getCameraStream: () => MediaStream | null;
  getVideoElement: () => HTMLVideoElement | null;
}

export interface KioskHealthSnapshot {
  cameraHealthy: boolean;
  syncHealthy: boolean;
  memoryUsedPct: number | null;
  idle: boolean;
  uptimeMs: number;
  lastCheckAt: number;
  cameraRecovering: boolean;
}

// ─── Serviço ──────────────────────────────────────────────────────────────────

export class KioskHealthMonitor {
  private readonly config: KioskHealthConfig;
  private readonly providers: HealthStateProviders;
  private readonly handlers: Array<(a: HealthAction) => void> = [];

  private readonly startTime = Date.now();
  /** Atualizado por markActivity(). Ponto de início do contador de idle. */
  private lastActivityMs = Date.now();
  private intervalId: ReturnType<typeof setInterval> | null = null;
  private rafId: number | null = null;
  private cameraRecovering = false;
  private lastFrameMs = 0; // marcado por markFrameReceived() ou pelo rAF loop

  constructor(providers: HealthStateProviders, config: Partial<KioskHealthConfig> = {}) {
    this.providers = providers;
    this.config = { ...DEFAULT_CONFIG, ...config };
  }

  // ── Ciclo de vida ─────────────────────────────────────────────────────────

  start(): void {
    if (this.intervalId !== null) return;
    this.intervalId = setInterval(() => this.runCheck(), this.config.healthCheckIntervalMs);
    this.startFrameWatcher();
  }

  stop(): void {
    if (this.intervalId !== null) {
      clearInterval(this.intervalId);
      this.intervalId = null;
    }
    this.stopFrameWatcher();
  }

  /** rAF loop leve: marca lastFrameMs sempre que o video estiver produzindo frames reais. */
  private startFrameWatcher(): void {
    const tick = () => {
      const video = this.providers.getVideoElement();
      if (video && video.readyState >= 2 && video.videoWidth > 0) {
        this.lastFrameMs = Date.now();
      }
      this.rafId = requestAnimationFrame(tick);
    };
    this.rafId = requestAnimationFrame(tick);
  }

  private stopFrameWatcher(): void {
    if (this.rafId !== null) {
      cancelAnimationFrame(this.rafId);
      this.rafId = null;
    }
  }

  // ── Assinaturas ───────────────────────────────────────────────────────────

  onAction(handler: (a: HealthAction) => void): () => void {
    this.handlers.push(handler);
    return () => {
      const i = this.handlers.indexOf(handler);
      if (i >= 0) this.handlers.splice(i, 1);
    };
  }

  private emit(action: HealthAction): void {
    this.handlers.forEach(h => h(action));
  }

  // ── Sinalizadores externos ────────────────────────────────────────────────

  /** Chamar após cada frame capturado com sucesso pelo kiosk. */
  markFrameReceived(): void {
    this.lastFrameMs = Date.now();
  }

  /** Chamar após reconhecimento ou registro bem-sucedido (reseta timer de idle). */
  markActivity(): void {
    this.lastActivityMs = Date.now();
  }

  setCameraRecovering(value: boolean): void {
    this.cameraRecovering = value;
  }

  // ── Snapshot público ──────────────────────────────────────────────────────

  getSnapshot(): KioskHealthSnapshot {
    return {
      cameraHealthy: this.isCameraHealthy(),
      syncHealthy: !this.providers.isSyncing() && this.providers.getPendingCount() === 0,
      memoryUsedPct: this.getMemoryPct(),
      idle: this.isIdle(),
      uptimeMs: Date.now() - this.startTime,
      lastCheckAt: Date.now(),
      cameraRecovering: this.cameraRecovering,
    };
  }

  // ── Loop principal ────────────────────────────────────────────────────────

  private runCheck(): void {
    const snap = this.getSnapshot();
    const uptimeH = +(snap.uptimeMs / 3_600_000).toFixed(1);
    const idleMin = +((Date.now() - this.lastActivityMs) / 60_000).toFixed(0);

    kioskLog('KIOSK_HEALTH', JSON.stringify({
      cam: snap.cameraHealthy,
      sync: snap.syncHealthy,
      mem: snap.memoryUsedPct,
      idle: snap.idle,
      idle_min: idleMin,
      uptime_h: uptimeH,
    }));

    // 1. Camera recovery — sem reload
    const stream = this.providers.getCameraStream();
    const frozenMs = this.lastFrameMs > 0 ? Date.now() - this.lastFrameMs : 0;
    const cameraFrozen =
      stream !== null &&
      this.lastFrameMs > 0 &&
      frozenMs > this.config.cameraLiveTimeoutMs;

    if (stream && (!snap.cameraHealthy || cameraFrozen) && !this.cameraRecovering) {
      const reason = cameraFrozen ? `frame-frozen-${Math.round(frozenMs / 1000)}s` : 'stream-unhealthy';
      kioskLog('KIOSK_CAMERA_RECOVERY', reason);
      this.emit({ type: 'CAMERA_RECOVERY', reason });
      return; // ação escalada ao componente; próximo ciclo verifica resultado
    }

    // 2. Pressão de memória (gradual)
    const mem = snap.memoryUsedPct;
    if (mem !== null) {
      if (mem >= this.config.memorySeverePct) {
        kioskLog('KIOSK_MEMORY_PRESSURE', `severe:${mem}%`);
        this.emit({ type: 'MEMORY_PRESSURE', level: 'severe' });
      } else if (mem >= this.config.memoryMediumPct) {
        kioskLog('KIOSK_MEMORY_PRESSURE', `medium:${mem}%`);
        this.emit({ type: 'MEMORY_PRESSURE', level: 'medium' });
      } else if (mem >= this.config.memoryLightPct) {
        kioskLog('KIOSK_MEMORY_PRESSURE', `light:${mem}%`);
        this.emit({ type: 'MEMORY_PRESSURE', level: 'light' });
      }
    }

    const safeToReload =
      !this.providers.isProcessing() &&
      !this.providers.isSyncing() &&
      this.providers.getPendingCount() === 0;

    // 3. Hard reload — uptime longo + idle prolongado + seguro
    if (
      uptimeH >= this.config.hardReloadAfterHours &&
      idleMin >= this.config.hardReloadIdleMinutes &&
      safeToReload
    ) {
      kioskLog('KIOSK_HARD_RELOAD', `uptime=${uptimeH}h idle=${idleMin}min`);
      this.emit({ type: 'HARD_RELOAD', reason: `uptime-${uptimeH}h-idle-${idleMin}min` });
      return;
    }

    // 4. Soft reload — memória severa + idle + seguro
    if (
      this.config.softReloadEnabled &&
      mem !== null && mem >= this.config.memorySeverePct &&
      safeToReload
    ) {
      kioskLog('KIOSK_SOFT_RELOAD', `mem=${mem}%`);
      this.emit({ type: 'SOFT_RELOAD', reason: `memory-${mem}%` });
    }
  }

  // ── Helpers privados ──────────────────────────────────────────────────────

  private isCameraHealthy(): boolean {
    const stream = this.providers.getCameraStream();
    if (!stream) return true; // sem stream = modo offline/loading, não é falha

    const tracks = stream.getVideoTracks();
    if (!tracks.length || tracks[0].readyState !== 'live') return false;

    const video = this.providers.getVideoElement();
    if (!video) return false;
    if (video.videoWidth === 0 || video.videoHeight === 0) return false;
    if (video.readyState < 2 /* HAVE_CURRENT_DATA */) return false;

    return true;
  }

  private isIdle(): boolean {
    return (
      !this.providers.isProcessing() &&
      !this.providers.isSyncing() &&
      this.providers.getPendingCount() === 0
    );
  }

  private getMemoryPct(): number | null {
    try {
      const mem = (performance as any).memory;
      if (!mem?.jsHeapSizeLimit) return null;
      return Math.round((mem.usedJSHeapSize / mem.jsHeapSizeLimit) * 100);
    } catch {
      return null;
    }
  }
}
