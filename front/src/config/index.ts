// Remove /api do final se existir para evitar duplicação
const getApiUrl = () => {
  const url = (import.meta as any).env?.VITE_API_URL || 'http://localhost:5000';
  return url.endsWith('/api') ? url.replace(/\/api$/, '') : url;
};

export const config = {
  API_URL: getApiUrl(),
  APP_NAME: (import.meta as any).env?.VITE_APP_NAME || 'REGISTRA.PONTO',
  APP_VERSION: (import.meta as any).env?.VITE_APP_VERSION || '1.0.0',
};
