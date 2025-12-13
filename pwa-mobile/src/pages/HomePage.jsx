import React, { useState, useEffect } from 'react';
import { useNavigate } from 'react-router-dom';
import { useAuth } from '../contexts/AuthContext';
import { motion } from 'framer-motion';
import PermissionsModal from '../components/PermissionsModal';

const PERMISSIONS_KEY = '@app:permissions_requested';

export default function HomePage() {
  const navigate = useNavigate();
  const { signed, userType } = useAuth();
  const [showPermissionsModal, setShowPermissionsModal] = useState(false);

  useEffect(() => {
    // Verificar se é a primeira vez que o usuário acessa
    const permissionsRequested = localStorage.getItem(PERMISSIONS_KEY);
    
    if (!permissionsRequested) {
      // Pequeno delay para melhor UX
      setTimeout(() => {
        setShowPermissionsModal(true);
      }, 800);
    }
  }, []);

  // Removido auto-redirect - deixa usuário escolher onde ir
  // useEffect(() => {
  //   if (signed) {
  //     const redirectPath = userType === 'funcionario' 
  //       ? '/funcionario/dashboard' 
  //       : '/empresa/kiosk';
  //     navigate(redirectPath, { replace: true });
  //   }
  // }, [signed, userType, navigate]);

  function handlePermissionsComplete(permissions) {
    // Salvar que as permissões já foram solicitadas
    localStorage.setItem(PERMISSIONS_KEY, JSON.stringify({
      requested: true,
      camera: permissions.camera,
      location: permissions.location,
      timestamp: new Date().toISOString()
    }));
    setShowPermissionsModal(false);
  }

  return (
    <div className="min-h-screen bg-gradient-to-br from-blue-600 via-purple-600 to-purple-700 flex flex-col items-center justify-center p-4">
      <motion.div
        initial={{ opacity: 0, y: 20 }}
        animate={{ opacity: 1, y: 0 }}
        transition={{ duration: 0.6 }}
        className="w-full max-w-md"
      >
        {/* Logo */}
        <div className="text-center mb-12">
          <motion.div
            initial={{ scale: 0 }}
            animate={{ scale: 1 }}
            transition={{ delay: 0.2, type: 'spring', stiffness: 200 }}
            className="w-24 h-24 mx-auto mb-6 bg-white/20 backdrop-blur-sm rounded-full flex items-center justify-center shadow-2xl"
          >
            <svg className="w-12 h-12 text-white" fill="none" stroke="currentColor" viewBox="0 0 24 24">
              <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M12 8v4l3 3m6-3a9 9 0 11-18 0 9 9 0 0118 0z" />
            </svg>
          </motion.div>
          <h1 className="text-4xl font-bold text-white mb-2">Registro de Ponto</h1>
          <p className="text-blue-100 text-lg">Sistema com Geolocalização</p>
        </div>

        {/* Botões de Login ou Acesso */}
        <div className="space-y-4">
          {/* Botão Funcionário - sempre abre a tela de login */}
          <motion.button
            whileTap={{ scale: 0.95 }}
            onClick={() => navigate('/login/funcionario')}
            className="w-full bg-white text-blue-600 rounded-2xl py-4 px-6 font-semibold text-lg shadow-xl hover:shadow-2xl transition-all duration-200 flex items-center justify-center space-x-3"
          >
            <svg className="w-6 h-6" fill="none" stroke="currentColor" viewBox="0 0 24 24">
              <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M16 7a4 4 0 11-8 0 4 4 0 018 0zM12 14a7 7 0 00-7 7h14a7 7 0 00-7-7z" />
            </svg>
            <span>
              {signed && userType === 'funcionario' ? 'Meu Dashboard' : 'Entrar como Funcionário'}
            </span>
          </motion.button>

          {/* Botão Empresa - sempre abre login, depois pode ir ao quiosque */}
          <motion.button
            whileTap={{ scale: 0.95 }}
            onClick={() => navigate('/login/empresa')}
            className="w-full bg-white/10 backdrop-blur-sm text-white border-2 border-white/30 rounded-2xl py-4 px-6 font-semibold text-lg shadow-xl hover:bg-white/20 transition-all duration-200 flex items-center justify-center space-x-3"
          >
            <svg className="w-6 h-6" fill="none" stroke="currentColor" viewBox="0 0 24 24">
              <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M19 21V5a2 2 0 00-2-2H7a2 2 0 00-2 2v16m14 0h2m-2 0h-5m-9 0H3m2 0h5M9 7h1m-1 4h1m4-4h1m-1 4h1m-5 10v-5a1 1 0 011-1h2a1 1 0 011 1v5m-4 0h4" />
            </svg>
            <span>Entrar como Empresa</span>
          </motion.button>

          {/* Quiosque removido conforme solicitado */}
        </div>

        {/* Botão de Teste PWA */}
        <motion.button
          initial={{ opacity: 0 }}
          animate={{ opacity: 1 }}
          transition={{ delay: 0.7 }}
          onClick={() => navigate('/pwa-test')}
          className="mt-8 w-full bg-purple-500/20 border border-purple-300/30 text-purple-100 rounded-xl py-3 px-4 font-medium text-sm hover:bg-purple-500/30 transition-all duration-200 flex items-center justify-center space-x-2"
        >
          <svg className="w-5 h-5" fill="none" stroke="currentColor" viewBox="0 0 24 24">
            <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M10.325 4.317c.426-1.756 2.924-1.756 3.35 0a1.724 1.724 0 002.573 1.066c1.543-.94 3.31.826 2.37 2.37a1.724 1.724 0 001.065 2.572c1.756.426 1.756 2.924 0 3.35a1.724 1.724 0 00-1.066 2.573c.94 1.543-.826 3.31-2.37 2.37a1.724 1.724 0 00-2.572 1.065c-.426 1.756-2.924 1.756-3.35 0a1.724 1.724 0 00-2.573-1.066c-1.543.94-3.31-.826-2.37-2.37a1.724 1.724 0 00-1.065-2.572c-1.756-.426-1.756-2.924 0-3.35a1.724 1.724 0 001.066-2.573c-.94-1.543.826-3.31 2.37-2.37.996.608 2.296.07 2.572-1.065z" />
            <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M15 12a3 3 0 11-6 0 3 3 0 016 0z" />
          </svg>
          <span>🔧 Testar PWA (Câmera & GPS)</span>
        </motion.button>

        {/* Footer */}
        <motion.div
          initial={{ opacity: 0 }}
          animate={{ opacity: 1 }}
          transition={{ delay: 0.8 }}
          className="mt-8 text-center text-white/70 text-sm"
        >
          <p>Sistema de Registro de Ponto v1.0</p>
          <p className="mt-1">Acesso rápido e seguro</p>
        </motion.div>
      </motion.div>

      {/* Modal de Permissões */}
      {showPermissionsModal && (
        <PermissionsModal onComplete={handlePermissionsComplete} />
      )}
    </div>
  );
}
