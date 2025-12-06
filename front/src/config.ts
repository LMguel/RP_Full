export const config = {
  API_URL: process.env.NODE_ENV === 'production' 
    ? 'https://api.seudominio.com' 
    : 'http://localhost:5000', // Conecta diretamente ao backend
  
  // Outras configurações
  APP_NAME: 'Ponto Inteligente',
  VERSION: '1.0.0',
  
  // Configurações específicas
  MAX_FILE_SIZE: 5 * 1024 * 1024, // 5MB
  ALLOWED_IMAGE_TYPES: ['image/jpeg', 'image/jpg', 'image/png'],
};