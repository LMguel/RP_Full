// Remove /api do final se existir para evitar duplicação
// Força o uso do backend local
export const config = {
  API_URL: 'http://192.168.1.2:5000',
  APP_NAME: (import.meta as any).env?.VITE_APP_NAME || 'REGISTRA.PONTO',
  APP_VERSION: (import.meta as any).env?.VITE_APP_VERSION || '1.0.0',
};
