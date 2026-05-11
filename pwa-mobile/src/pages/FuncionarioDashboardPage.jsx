import React, { useState, useEffect } from 'react';
import { motion } from 'framer-motion';
import { useNavigate } from 'react-router-dom';
import { useAuth } from '../contexts/AuthContext';
import apiService from '../services/api';
import { RecordsList, LoadingSpinner, ErrorMessage } from '../components/RecordsComponents';

export default function FuncionarioDashboardPage() {
  const navigate = useNavigate();
  const { user, signOut } = useAuth();
  const [registros, setRegistros] = useState([]);
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState(null);
  const [refreshing, setRefreshing] = useState(false);

  useEffect(() => {
    loadRegistros();
  }, []);

  async function loadRegistros() {
    try {
      setLoading(true);
      setError(null);
      const response = await apiService.getMeusRegistros(10);
      setRegistros(response.registros || []);
    } catch (error) {
      setError(error.response?.data?.error || 'Erro ao carregar registros');
    } finally {
      setLoading(false);
      setRefreshing(false);
    }
  }

  async function handleRefresh() {
    setRefreshing(true);
    await loadRegistros();
  }

  function handleLogout() {
    signOut();
    navigate('/', { replace: true });
  }

  return (
    <div className="min-h-screen bg-gradient-to-br from-primary-900 via-primary-800 to-primary-700">
      {/* Header glassmorphism */}
      <div className="bg-white/[.08] backdrop-blur-md border-b border-white/10 px-4 py-5 shadow-lg">
        <div className="flex justify-between items-center max-w-2xl mx-auto">
          <div>
            <h1 className="text-xl font-semibold text-white">
              Olá, {user?.nome?.split(' ')[0] || 'Funcionário'}!
            </h1>
            <p className="text-white/60 text-sm">{user?.cargo || 'Colaborador'}</p>
          </div>

          <button
            onClick={handleLogout}
            className="p-2 rounded-full bg-white/10 hover:bg-white/20 transition-colors border border-white/10"
            aria-label="Sair"
          >
            <svg className="w-5 h-5 text-white" fill="none" stroke="currentColor" viewBox="0 0 24 24">
              <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M17 16l4-4m0 0l-4-4m4 4H7m6 4v1a3 3 0 01-3 3H6a3 3 0 01-3-3V7a3 3 0 013-3h4a3 3 0 013 3v1" />
            </svg>
          </button>
        </div>
      </div>

      <div className="p-4 max-w-2xl mx-auto pb-20">
        {/* Botão Registrar Ponto */}
        <motion.button
          whileTap={{ scale: 0.97 }}
          onClick={() => navigate('/funcionario/registrar-ponto')}
          className="w-full mb-6 mt-4 bg-white text-primary-700 rounded-2xl p-5 shadow-xl flex items-center justify-center gap-3 font-bold text-lg hover:shadow-2xl transition-all"
        >
          <svg className="w-6 h-6" fill="none" stroke="currentColor" viewBox="0 0 24 24">
            <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M12 8v4l3 3m6-3a9 9 0 11-18 0 9 9 0 0118 0z" />
          </svg>
          Registrar Ponto
        </motion.button>

        {/* Header Histórico */}
        <div className="flex justify-between items-center mb-4">
          <h2 className="text-white font-semibold text-base flex items-center gap-2">
            <svg className="w-5 h-5 text-white/60" fill="none" stroke="currentColor" viewBox="0 0 24 24">
              <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M12 8v4l3 3m6-3a9 9 0 11-18 0 9 9 0 0118 0z" />
            </svg>
            Histórico de Registros
          </h2>

          <button
            onClick={handleRefresh}
            disabled={refreshing}
            className="p-2 rounded-full bg-white/10 hover:bg-white/20 border border-white/10 transition-colors disabled:opacity-50"
            aria-label="Atualizar"
          >
            <svg
              className={`w-4 h-4 text-white ${refreshing ? 'animate-spin' : ''}`}
              fill="none"
              stroke="currentColor"
              viewBox="0 0 24 24"
            >
              <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M4 4v5h.582m15.356 2A8.001 8.001 0 004.582 9m0 0H9m11 11v-5h-.581m0 0a8.003 8.003 0 01-15.357-2m15.357 2H15" />
            </svg>
          </button>
        </div>

        {/* Lista de Registros */}
        {loading ? (
          <LoadingSpinner message="Carregando registros..." />
        ) : error ? (
          <ErrorMessage message={error} onRetry={handleRefresh} />
        ) : (
          <RecordsList records={registros} loading={refreshing} />
        )}
      </div>
    </div>
  );
}
