// Remove /api do final se existir para evitar duplicação
// No Codespace, use a URL pública
export const config = {
  API_URL: 'https://registra-ponto.duckdns.org', //'https://registra-ponto.duckdns.org', // 
  APP_NAME: (import.meta as any).env?.VITE_APP_NAME || 'REGISTRA.PONTO',
  APP_VERSION: (import.meta as any).env?.VITE_APP_VERSION || '1.0.0',
};
