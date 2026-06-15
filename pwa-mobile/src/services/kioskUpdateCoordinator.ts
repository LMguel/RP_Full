/**
 * Singleton que coordena a atualização do SW entre SwUpdateToast e KioskPage.
 *
 * SwUpdateToast chama setUpdateReady() quando um novo SW está aguardando.
 * KioskPage escuta o evento 'kiosk:update-ready', para a câmera e chama confirmReady().
 * Só então o coordinator executa o applyFn que envia SKIP_WAITING e recarrega.
 *
 * Isso garante que o reload nunca acontece no meio de uma captura facial.
 */
type ApplyFn = () => void;

let _pendingApply: ApplyFn | null = null;

export const kioskUpdateCoordinator = {
  setUpdateReady(applyFn: ApplyFn): void {
    _pendingApply = applyFn;
    window.dispatchEvent(new CustomEvent('kiosk:update-ready'));
  },

  confirmReady(): void {
    const fn = _pendingApply;
    _pendingApply = null;
    fn?.();
  },

  isPending: (): boolean => _pendingApply !== null,
};
