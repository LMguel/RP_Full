import React, { useState, useEffect } from 'react';
import { useNavigate } from 'react-router-dom';
import { useAuth } from '../contexts/AuthContext';
import { motion } from 'framer-motion';
import PermissionsModal from '../components/PermissionsModal';
import logo from '../../image/logo.png';

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
            className="w-32 h-32 mx-auto mb-6 bg-white/20 backdrop-blur-sm rounded-full flex items-center justify-center shadow-2xl overflow-hidden"
          >
            <img src={logo} alt="REGISTRA.PONTO logo" className="w-28 h-28 object-cover rounded-full" />
          </motion.div>
          <h1 className="text-4xl font-bold text-white mb-2"> REGISTRA.PONTO</h1>
          <p className="text-blue-100 text-lg">Sistema com Geolocalização e Reconhecimento Facial</p>
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
