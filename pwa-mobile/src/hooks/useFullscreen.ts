import { useEffect } from 'react';

function enterFullscreen() {
  if (!document.fullscreenElement) {
    document.documentElement.requestFullscreen?.().catch(() => {});
  }
}

/**
 * Solicita fullscreen no mount e, opcionalmente, re-entra automaticamente
 * se o usuário sair (persistent=true — usado no kiosk).
 *
 * Como requestFullscreen() exige gesto do usuário em alguns browsers,
 * registramos também um listener de click/touch como fallback.
 */
export function useFullscreen({ persistent = false }: { persistent?: boolean } = {}) {
  useEffect(() => {
    enterFullscreen();

    // Fallback: entra no primeiro toque/clique (requerimento de gesto do browser)
    const onGesture = () => enterFullscreen();
    document.addEventListener('click', onGesture, { once: !persistent });
    document.addEventListener('touchstart', onGesture, { once: !persistent, passive: true });

    // Kiosk: re-entra sempre que o fullscreen for encerrado
    const onFsChange = () => {
      if (!document.fullscreenElement) {
        // Delay mínimo para não colidir com a animação de saída do browser
        setTimeout(enterFullscreen, 150);
      }
    };

    if (persistent) {
      document.addEventListener('fullscreenchange', onFsChange);
    }

    return () => {
      document.removeEventListener('click', onGesture);
      document.removeEventListener('touchstart', onGesture);
      if (persistent) {
        document.removeEventListener('fullscreenchange', onFsChange);
      }
    };
  }, [persistent]);
}
