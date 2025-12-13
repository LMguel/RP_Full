import React from 'react';
import { motion } from 'framer-motion';

export default function FaceOverlay({ faceData, stableFrames, requiredFrames }) {
  const progress = Math.min((stableFrames / requiredFrames) * 100, 100);

  return (
    <div className="absolute inset-0 pointer-events-none z-10">
      {/* Overlay escuro com abertura central */}
      <svg className="absolute inset-0 w-full h-full">
        <defs>
          <mask id="faceOvalMask">
            <rect x="0" y="0" width="100%" height="100%" fill="white" />
            <ellipse 
              cx="50%" 
              cy="50%" 
              rx="30%" 
              ry="40%" 
              fill="black"
            />
          </mask>
        </defs>
        <rect 
          x="0" 
          y="0" 
          width="100%" 
          height="100%" 
          fill="rgba(0, 0, 0, 0.6)" 
          mask="url(#faceOvalMask)"
        />
      </svg>

      {/* Guia de posicionamento - Oval */}
      <div className="absolute inset-0 flex items-center justify-center">
        <div className="relative" style={{ width: '60%', maxWidth: '400px' }}>
          <svg viewBox="0 0 200 260" className="w-full">
            {/* Círculo de progresso */}
            <ellipse
              cx="100"
              cy="130"
              rx="95"
              ry="125"
              fill="none"
              stroke="rgba(255, 255, 255, 0.3)"
              strokeWidth="4"
              strokeDasharray="4 8"
            />
            
            {/* Progresso verde */}
            {stableFrames > 0 && (
              <motion.ellipse
                cx="100"
                cy="130"
                rx="95"
                ry="125"
                fill="none"
                stroke="#10b981"
                strokeWidth="6"
                strokeDasharray={`${(progress / 100) * 700} 700`}
                strokeLinecap="round"
                initial={{ strokeDasharray: '0 700' }}
                animate={{ strokeDasharray: `${(progress / 100) * 700} 700` }}
                transition={{ duration: 0.3 }}
              />
            )}

            {/* Ícone de rosto no centro */}
            <g transform="translate(100, 130)">
              <circle cx="0" cy="-20" r="3" fill="white" opacity="0.7" />
              <circle cx="0" cy="20" r="3" fill="white" opacity="0.7" />
              <path
                d="M -15 0 Q 0 10 15 0"
                stroke="white"
                strokeWidth="2"
                fill="none"
                opacity="0.7"
              />
            </g>
          </svg>

          {/* Cantos decorativos */}
          <div className="absolute top-0 left-0 w-8 h-8 border-t-4 border-l-4 border-white rounded-tl-lg" />
          <div className="absolute top-0 right-0 w-8 h-8 border-t-4 border-r-4 border-white rounded-tr-lg" />
          <div className="absolute bottom-0 left-0 w-8 h-8 border-b-4 border-l-4 border-white rounded-bl-lg" />
          <div className="absolute bottom-0 right-0 w-8 h-8 border-b-4 border-r-4 border-white rounded-br-lg" />
        </div>
      </div>

      {/* Indicador de rosto detectado */}
      {faceData && (
        <motion.div
          initial={{ scale: 0, opacity: 0 }}
          animate={{ scale: 1, opacity: 1 }}
          className="absolute"
          style={{
            left: `${faceData.centerX * 100}%`,
            top: `${faceData.centerY * 100}%`,
            transform: 'translate(-50%, -50%)',
          }}
        >
          <div className="w-3 h-3 bg-green-400 rounded-full shadow-lg" />
        </motion.div>
      )}

      {/* Linha de alinhamento horizontal */}
      <div className="absolute left-0 right-0 top-1/2 h-px bg-white/30" />
      
      {/* Linha de alinhamento vertical */}
      <div className="absolute top-0 bottom-0 left-1/2 w-px bg-white/30" />

      {/* Instruções superiores */}
      <div className="absolute top-20 left-0 right-0 flex justify-center z-20">
        <div className="bg-black/60 backdrop-blur-sm rounded-xl px-6 py-3">
          <p className="text-white text-sm font-medium">
            Posicione seu rosto dentro do oval
          </p>
        </div>
      </div>
    </div>
  );
}
