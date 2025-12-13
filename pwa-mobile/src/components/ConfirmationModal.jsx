import React from 'react';
import { motion } from 'framer-motion';

export default function ConfirmationModal({ employee, onConfirm, onCancel }) {
  return (
    <motion.div
      initial={{ opacity: 0 }}
      animate={{ opacity: 1 }}
      exit={{ opacity: 0 }}
      className="fixed inset-0 bg-black/80 backdrop-blur-sm flex items-center justify-center z-50 p-4"
    >
      <motion.div
        initial={{ scale: 0.9, y: 20 }}
        animate={{ scale: 1, y: 0 }}
        exit={{ scale: 0.9, y: 20 }}
        className="bg-gradient-to-br from-slate-800 to-slate-900 rounded-3xl shadow-2xl p-8 max-w-md w-full border border-white/10"
      >
        {/* Ícone de sucesso */}
        <div className="flex justify-center mb-6">
          <div className="w-20 h-20 bg-green-500/20 rounded-full flex items-center justify-center">
            <svg className="w-10 h-10 text-green-400" fill="none" stroke="currentColor" viewBox="0 0 24 24">
              <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M9 12l2 2 4-4m6 2a9 9 0 11-18 0 9 9 0 0118 0z" />
            </svg>
          </div>
        </div>

        {/* Informações do funcionário */}
        <div className="text-center mb-8">
          <h2 className="text-2xl font-bold text-white mb-2">
            Funcionário Identificado
          </h2>
          <p className="text-3xl font-bold text-green-400 mb-3">
            {employee.nome}
          </p>
          {employee.cargo && (
            <p className="text-white/60 text-lg">
              {employee.cargo}
            </p>
          )}
          {employee.id && (
            <p className="text-white/40 text-sm mt-2">
              ID: {employee.id}
            </p>
          )}
        </div>

        {/* Pergunta de confirmação */}
        <div className="bg-blue-500/10 border border-blue-500/30 rounded-xl p-4 mb-6">
          <p className="text-blue-200 text-center text-lg font-medium">
            Confirmar registro de ponto?
          </p>
        </div>

        {/* Botões */}
        <div className="grid grid-cols-2 gap-4">
          <motion.button
            whileTap={{ scale: 0.95 }}
            onClick={onCancel}
            className="bg-white/10 hover:bg-white/20 border border-white/20 rounded-xl py-4 px-6 font-bold text-white transition-colors"
          >
            Cancelar
          </motion.button>

          <motion.button
            whileTap={{ scale: 0.95 }}
            onClick={onConfirm}
            className="bg-gradient-to-r from-green-500 to-green-600 hover:from-green-600 hover:to-green-700 rounded-xl py-4 px-6 font-bold text-white shadow-xl transition-all"
          >
            ✓ Confirmar
          </motion.button>
        </div>

        {/* Aviso de timeout */}
        <p className="text-white/40 text-xs text-center mt-4">
          Esta janela fechará automaticamente em 10 segundos
        </p>
      </motion.div>
    </motion.div>
  );
}
