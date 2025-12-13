import React from 'react';
import { useLiveClock } from '../hooks/useCameraCapture';

/**
 * Componente de visualização da câmera com relógio sobreposto
 * Usado no modo Quiosque
 */
export function CameraView({ videoRef, showClock = true, overlayContent = null }) {
  const { formatted, date } = useLiveClock();

  return (
    <div className="relative w-full h-full bg-black rounded-lg overflow-hidden">
      {/* Vídeo da câmera */}
      <video
        ref={videoRef}
        autoPlay
        playsInline
        muted
        className="w-full h-full object-cover"
      />

      {/* Overlay com relógio e conteúdo adicional */}
      <div className="absolute inset-0 pointer-events-none">
        {/* Relógio no topo */}
        {showClock && (
          <div className="absolute top-0 left-0 right-0 bg-gradient-to-b from-black/70 to-transparent p-6">
            <div className="text-center">
              <div className="text-5xl font-bold text-white mb-2 font-mono tracking-wider drop-shadow-lg">
                {formatted}
              </div>
              <div className="text-lg text-white/90 capitalize drop-shadow-md">
                {date}
              </div>
            </div>
          </div>
        )}

        {/* Conteúdo adicional (mensagens, status, etc) */}
        {overlayContent && (
          <div className="absolute bottom-0 left-0 right-0 bg-gradient-to-t from-black/70 to-transparent p-6">
            {overlayContent}
          </div>
        )}

        {/* Moldura de guia facial */}
        <div className="absolute top-1/2 left-1/2 transform -translate-x-1/2 -translate-y-1/2">
          <div className="w-64 h-80 border-4 border-white/40 rounded-full relative">
            {/* Cantos da moldura */}
            <div className="absolute -top-1 -left-1 w-8 h-8 border-t-4 border-l-4 border-blue-400 rounded-tl-lg"></div>
            <div className="absolute -top-1 -right-1 w-8 h-8 border-t-4 border-r-4 border-blue-400 rounded-tr-lg"></div>
            <div className="absolute -bottom-1 -left-1 w-8 h-8 border-b-4 border-l-4 border-blue-400 rounded-bl-lg"></div>
            <div className="absolute -bottom-1 -right-1 w-8 h-8 border-b-4 border-r-4 border-blue-400 rounded-br-lg"></div>
          </div>
          
          {/* Texto de instrução */}
          <p className="text-center text-white text-lg font-semibold mt-4 drop-shadow-lg">
            Posicione seu rosto no centro
          </p>
        </div>
      </div>
    </div>
  );
}

/**
 * Componente de feedback de reconhecimento
 * Exibe mensagens de sucesso ou erro
 */
export function RecognitionFeedback({ status, message, funcionarioNome = null, onClose }) {
  if (!status) return null;

  const isSuccess = status === 'success';
  const isError = status === 'error';
  const isProcessing = status === 'processing';

  return (
    <div className="fixed inset-0 z-50 flex items-center justify-center bg-black/80 backdrop-blur-sm">
      <div className={`
        max-w-md w-full mx-4 p-8 rounded-2xl shadow-2xl text-center transform transition-all
        ${isSuccess ? 'bg-green-500' : isError ? 'bg-red-500' : 'bg-blue-500'}
      `}>
        {/* Ícone */}
        <div className="mb-6">
          {isSuccess && (
            <svg className="w-24 h-24 mx-auto text-white animate-bounce" fill="none" stroke="currentColor" viewBox="0 0 24 24">
              <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M5 13l4 4L19 7" />
            </svg>
          )}
          {isError && (
            <svg className="w-24 h-24 mx-auto text-white animate-shake" fill="none" stroke="currentColor" viewBox="0 0 24 24">
              <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M6 18L18 6M6 6l12 12" />
            </svg>
          )}
          {isProcessing && (
            <div className="w-24 h-24 mx-auto border-8 border-white border-t-transparent rounded-full animate-spin"></div>
          )}
        </div>

        {/* Nome do funcionário */}
        {isSuccess && funcionarioNome && (
          <h2 className="text-3xl font-bold text-white mb-4">
            Olá, {funcionarioNome}!
          </h2>
        )}

        {/* Mensagem */}
        <p className="text-xl text-white font-semibold mb-2">
          {message}
        </p>

        {/* Botão de fechar (apenas para sucesso/erro) */}
        {!isProcessing && onClose && (
          <button
            onClick={onClose}
            className="mt-6 px-8 py-3 bg-white text-gray-900 rounded-lg font-semibold hover:bg-gray-100 transition-colors"
          >
            Fechar
          </button>
        )}

        {/* Mensagem de auto-close */}
        {isSuccess && !onClose && (
          <p className="text-white/80 text-sm mt-4">
            Esta mensagem fechará automaticamente
          </p>
        )}
      </div>
    </div>
  );
}

/**
 * Componente para solicitar permissões
 */
export function PermissionRequest({ type, onRequest, onCancel }) {
  const isCamera = type === 'camera';
  const isLocation = type === 'location';

  return (
    <div className="fixed inset-0 z-50 flex items-center justify-center bg-black/80 backdrop-blur-sm p-4">
      <div className="bg-white rounded-2xl max-w-md w-full p-8 shadow-2xl">
        {/* Ícone */}
        <div className="mb-6 text-center">
          {isCamera && (
            <svg className="w-20 h-20 mx-auto text-blue-500" fill="none" stroke="currentColor" viewBox="0 0 24 24">
              <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M3 9a2 2 0 012-2h.93a2 2 0 001.664-.89l.812-1.22A2 2 0 0110.07 4h3.86a2 2 0 011.664.89l.812 1.22A2 2 0 0018.07 7H19a2 2 0 012 2v9a2 2 0 01-2 2H5a2 2 0 01-2-2V9z" />
              <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M15 13a3 3 0 11-6 0 3 3 0 016 0z" />
            </svg>
          )}
          {isLocation && (
            <svg className="w-20 h-20 mx-auto text-green-500" fill="none" stroke="currentColor" viewBox="0 0 24 24">
              <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M17.657 16.657L13.414 20.9a1.998 1.998 0 01-2.827 0l-4.244-4.243a8 8 0 1111.314 0z" />
              <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M15 11a3 3 0 11-6 0 3 3 0 016 0z" />
            </svg>
          )}
        </div>

        {/* Título e descrição */}
        <h2 className="text-2xl font-bold text-gray-900 mb-4 text-center">
          {isCamera && 'Permissão de Câmera'}
          {isLocation && 'Permissão de Localização'}
        </h2>
        
        <p className="text-gray-600 mb-6 text-center">
          {isCamera && 'Este aplicativo precisa acessar sua câmera para realizar o reconhecimento facial e registrar seu ponto.'}
          {isLocation && 'Este aplicativo precisa acessar sua localização para validar que você está no local de trabalho.'}
        </p>

        {/* Botões */}
        <div className="flex gap-3">
          <button
            onClick={onCancel}
            className="flex-1 py-3 px-4 bg-gray-200 text-gray-800 rounded-lg font-semibold hover:bg-gray-300 transition-colors"
          >
            Cancelar
          </button>
          <button
            onClick={onRequest}
            className="flex-1 py-3 px-4 bg-blue-500 text-white rounded-lg font-semibold hover:bg-blue-600 transition-colors"
          >
            Permitir
          </button>
        </div>

        {/* Nota de segurança */}
        <p className="text-xs text-gray-500 mt-4 text-center">
          Suas informações são protegidas e utilizadas apenas para registro de ponto.
        </p>
      </div>
    </div>
  );
}
