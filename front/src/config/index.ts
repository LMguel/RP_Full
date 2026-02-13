// Configurações da aplicação via variáveis de ambiente
// Variáveis devem estar no arquivo .env na raiz do projeto

const API_URL = (import.meta as any).env?.VITE_API_URL;

if (!API_URL) {
  throw new Error(
    "VITE_API_URL não está configurada! " +
    "Crie um arquivo .env na raiz do projeto com a variável VITE_API_URL apontando para a URL da API."
  );
}

export const config = {
  API_URL,
  APP_NAME: (import.meta as any).env?.VITE_APP_NAME || 'REGISTRA.PONTO',
  APP_VERSION: (import.meta as any).env?.VITE_APP_VERSION || '1.0.0',
};
