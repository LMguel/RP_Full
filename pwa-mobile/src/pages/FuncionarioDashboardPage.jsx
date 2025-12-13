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
      
      const response = await apiService.getMeusRegistros(10); // Últimos 10 registros
      console.log('[DASHBOARD] Registros carregados:', response);
      
      setRegistros(response.registros || []);
    } catch (error) {
      console.error('[DASHBOARD] Erro ao carregar registros:', error);
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

  function formatDateTime(dateTimeStr) {
    if (!dateTimeStr) return { date: '', time: '' };
    
    let dateTime = dateTimeStr;
    if (dateTime.includes('#')) {
      dateTime = dateTime.split('#')[1];
    }
    
    const [datePart, timePart] = dateTime.split(' ');
    const [year, month, day] = datePart.split('-');
    const [hour, minute] = timePart.split(':');
    
    return {
      date: `${day}/${month}/${year}`,
      time: `${hour}:${minute}`,
    };
  }

  function handleLogout() {
    signOut();
    navigate('/', { replace: true });
  }

  return (
    <div className="min-h-screen bg-gradient-to-br from-slate-900 via-slate-800 to-slate-900">
      {/* Header */}
      <div className="bg-gradient-to-r from-blue-600 to-purple-600 px-4 py-6 shadow-xl">
        <div className="flex justify-between items-center">
          <div>
            <h1 className="text-2xl font-bold text-white">
              Olá, {user?.nome?.split(' ')[0] || 'Funcionário'}!
            </h1>
            <p className="text-blue-100 text-sm">{user?.cargo || 'Colaborador'}</p>
          </div>
          
          <button
            onClick={handleLogout}
            className="p-2 rounded-full bg-white/20 hover:bg-white/30 transition-colors"
          >
            <svg className="w-6 h-6 text-white" fill="none" stroke="currentColor" viewBox="0 0 24 24">
              <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M17 16l4-4m0 0l-4-4m4 4H7m6 4v1a3 3 0 01-3 3H6a3 3 0 01-3-3V7a3 3 0 013-3h4a3 3 0 013 3v1" />
            </svg>
          </button>
        </div>
      </div>

      <div className="p-4 max-w-2xl mx-auto pb-20">
        {/* Botão Registrar Ponto */}
        <motion.button
          whileTap={{ scale: 0.98 }}
          onClick={() => navigate('/funcionario/registrar-ponto')}
          className="w-full mb-6 bg-gradient-to-r from-blue-500 via-blue-600 to-blue-700 rounded-2xl p-6 shadow-2xl flex items-center justify-center space-x-3"
        >
          <svg className="w-8 h-8 text-white" fill="none" stroke="currentColor" viewBox="0 0 24 24">
            <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M17.657 16.657L13.414 20.9a1.998 1.998 0 01-2.827 0l-4.244-4.243a8 8 0 1111.314 0z" />
            <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M15 11a3 3 0 11-6 0 3 3 0 016 0z" />
          </svg>
          <span className="text-white text-xl font-bold">Registrar Ponto</span>
        </motion.button>

        {/* Header Histórico */}
        <div className="flex justify-between items-center mb-4">
          <h2 className="text-white text-lg font-bold flex items-center">
            <svg className="w-5 h-5 mr-2" fill="none" stroke="currentColor" viewBox="0 0 24 24">
              <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M12 8v4l3 3m6-3a9 9 0 11-18 0 9 9 0 0118 0z" />
            </svg>
            Histórico de Registros
          </h2>
          
          <button
            onClick={() => {
              setRefreshing(true);
              loadRegistros();
            }}
            disabled={refreshing}
            className="p-2 rounded-full bg-white/10 hover:bg-white/20 transition-colors disabled:opacity-50"
          >
            <svg 
              className={`w-5 h-5 text-white ${refreshing ? 'animate-spin' : ''}`} 
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
