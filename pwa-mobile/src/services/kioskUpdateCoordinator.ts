/**
 * Singleton que coordena a atualização do SW entre SwUpdateToast e KioskPage.
 *
 * SwUpdateToast chama setUpdateReady() quando um novo SW está aguardando.
 * KioskPage escuta o evento 'kiosk:update-ready', para a câmera e chama confirmReady().
 * Só então o coordinator executa o applyFn que envia SKIP_WAITING e recarrega.
 *
 * Isso garante que o reload nunca acontece no meio de uma captura facial.
 *
 * Fallback de segurança: se confirmReady() não for chamado em 15s (KioskPage não montou
 * o listener a tempo — race condition), aplica o update de qualquer forma.
 */
type ApplyFn = () => void;

const CONFIRM_TIMEOUT_MS = 15_000;

let _pendingApply: ApplyFn | null = null;
let _fallbackTimer: ReturnType<typeof setTimeout> | null = null;

export const kioskUpdateCoordinator = {
  setUpdateReady(applyFn: ApplyFn): void {
    _pendingApply = applyFn;

    // Fallback: se KioskPage não confirmar em 15s, aplica de qualquer forma
    if (_fallbackTimer) clearTimeout(_fallbackTimer);
    _fallbackTimer = setTimeout(() => {
      if (_pendingApply) {
        console.warn('[KioskUpdate] Fallback: confirmReady não chamado em 15s — aplicando update');
        kioskUpdateCoordinator.confirmReady();
      }
    }, CONFIRM_TIMEOUT_MS);

    window.dispatchEvent(new CustomEvent('kiosk:update-ready'));
  },

  confirmReady(): void {
    if (_fallbackTimer) {
      clearTimeout(_fallbackTimer);
      _fallbackTimer = null;
    }
    const fn = _pendingApply;
    _pendingApply = null;
    fn?.();
  },

  isPending: (): boolean => _pendingApply !== null,
};
