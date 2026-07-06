// Configurações da aplicação via variáveis de ambiente
// Variáveis devem estar no arquivo .env na raiz do projeto

// VITE_API_URL vazio = usar proxy do Vite (dev) ou paths relativos.
// Em produção, definir como a URL completa do backend antes do build.
const API_URL: string = (import.meta as any).env?.VITE_API_URL ?? '';

export const config = {
  API_URL,
  APP_NAME: (import.meta as any).env?.VITE_APP_NAME || 'REGISTRA.PONTO',
  APP_VERSION: (import.meta as any).env?.VITE_APP_VERSION || '1.0.0',
};
