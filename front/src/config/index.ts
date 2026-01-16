// Remove /api do final se existir para evitar duplicação
// Força o uso do backend local
export const config = {
  API_URL: 'http://127.0.0.1:5000', //'https://registra-ponto.duckdns.org',
  APP_NAME: (import.meta as any).env?.VITE_APP_NAME || 'REGISTRA.PONTO',
  APP_VERSION: (import.meta as any).env?.VITE_APP_VERSION || '1.0.0',
};
