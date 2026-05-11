import React, { useState, useEffect } from 'react';
import { useNavigate } from 'react-router-dom';
import { useAuth } from '../contexts/AuthContext';
import apiService from '../services/api';
import { motion } from 'framer-motion';
import LocationMap from '../components/LocationMap';

export default function RegistroPontoPage() {
  const navigate = useNavigate();
  const { user } = useAuth();
  const [loading, setLoading] = useState(false);
  const [location, setLocation] = useState(null);
  const [locationPermission, setLocationPermission] = useState(null);
  const [loadingLocation, setLoadingLocation] = useState(false);
  const [error, setError] = useState('');
  const [success, setSuccess] = useState('');

  useEffect(() => {
    checkLocationPermission();
  }, []);

  function checkLocationPermission() {
    if ('geolocation' in navigator) {
      setLocationPermission(true);
    } else {
      setLocationPermission(false);
      setError('Seu navegador não suporta geolocalização');
    }
  }

  async function getCurrentLocation() {
    setLoadingLocation(true);
    setError('');
    setSuccess('Solicitando acesso à localização...');

    const getPosition = (highAccuracy, timeout, maxAge) => {
      return new Promise((resolve, reject) => {
        navigator.geolocation.getCurrentPosition(resolve, reject, {
          enableHighAccuracy: highAccuracy,
          timeout,
          maximumAge: maxAge,
        });
      });
    };

    try {
      let position;
      try {
        position = await getPosition(false, 8000, 300000);
      } catch (e1) {
        setSuccess('Obtendo localização...');
        try {
          position = await getPosition(false, 15000, 0);
        } catch (e2) {
          setSuccess('Obtendo localização precisa...');
          position = await getPosition(true, 30000, 0);
        }
      }

      const coords = {
        latitude: position.coords.latitude,
        longitude: position.coords.longitude,
        accuracy: position.coords.accuracy,
      };

      setLocation(coords);
      setLoadingLocation(false);
      setSuccess('');
      return coords;
    } catch (error) {
      setLoadingLocation(false);
      setSuccess('');
      let errorMessage = 'Não foi possível obter sua localização';
      if (error.code === 1) {
        errorMessage = 'Permissão de localização negada. Permita o acesso nas configurações do navegador.';
      } else if (error.code === 2) {
        errorMessage = 'Localização indisponível. Verifique suas configurações de rede.';
      } else if (error.code === 3) {
        errorMessage = 'Não foi possível obter localização. Tente novamente.';
      }
      setError(errorMessage);
      throw error;
    }
  }

  async function registrarPonto(tipo) {
    if (!locationPermission) {
      setError('Permissão de localização não concedida');
      return;
    }

    setLoading(true);
    setError('');
    setSuccess('');

    try {
      const coords = await getCurrentLocation();
      if (!coords) { setLoading(false); return; }

      const getSaoPauloDateTime = () => {
        const now = new Date();
        const utc = now.getTime() + now.getTimezoneOffset() * 60000;
        return new Date(utc + -3 * 3600000);
      };

      const dtSP = getSaoPauloDateTime();
      const ano = dtSP.getFullYear();
      const mes = String(dtSP.getMonth() + 1).padStart(2, '0');
      const dia = String(dtSP.getDate()).padStart(2, '0');
      const hora = String(dtSP.getHours()).padStart(2, '0');
      const minuto = String(dtSP.getMinutes()).padStart(2, '0');
      const segundo = String(dtSP.getSeconds()).padStart(2, '0');
      const dataHoraString = `${ano}-${mes}-${dia} ${hora}:${minuto}:${segundo}`;

      const response = await apiService.registerPointByLocation(
        coords.latitude, coords.longitude, tipo, dataHoraString, coords.accuracy
      );

      if (response.success) {
        const distanceInfo = response.distance ? ` - Distância: ${response.distance}` : '';
        const tipoLabel = response.tipo_label || tipo;
        setSuccess(`Ponto de ${tipoLabel} registrado com sucesso!${distanceInfo}`);
        setTimeout(() => navigate('/funcionario/dashboard'), 2000);
      } else {
        throw new Error(response.error || 'Erro ao registrar ponto');
      }
    } catch (err) {
      setError(err.response?.data?.error || err.message || 'Erro ao registrar ponto');
    } finally {
      setLoading(false);
    }
  }

  return (
    <div className="min-h-screen flex flex-col bg-gradient-to-br from-primary-900 via-primary-800 to-primary-700">
      {/* Header glassmorphism */}
      <div className="bg-white/[.08] backdrop-blur-md border-b border-white/10 px-4 py-5 shadow-lg">
        <div className="flex justify-between items-center max-w-2xl mx-auto">
          <div>
            <h1 className="text-xl font-semibold text-white">Registrar Ponto</h1>
            <p className="text-white/60 text-sm">Por Geolocalização</p>
          </div>

          <button
            onClick={() => navigate('/funcionario/dashboard')}
            className="p-2 rounded-full bg-white/10 hover:bg-white/20 border border-white/10 transition-colors"
            aria-label="Voltar"
          >
            <svg className="w-5 h-5 text-white" fill="none" stroke="currentColor" viewBox="0 0 24 24">
              <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M10 19l-7-7m0 0l7-7m-7 7h18" />
            </svg>
          </button>
        </div>
      </div>

      <div className="flex-1 flex flex-col items-center justify-start pt-6 px-4 pb-6 max-w-2xl mx-auto w-full">
        {/* Alerts */}
        {error && (
          <motion.div
            initial={{ opacity: 0, y: -10 }}
            animate={{ opacity: 1, y: 0 }}
            className="w-full mb-4 bg-red-500/10 border border-red-500/30 rounded-xl p-3 text-sm"
          >
            <p className="text-red-300 flex items-center gap-2">
              <svg className="w-4 h-4 flex-shrink-0" fill="none" stroke="currentColor" viewBox="0 0 24 24">
                <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M12 8v4m0 4h.01M21 12a9 9 0 11-18 0 9 9 0 0118 0z" />
              </svg>
              {error}
            </p>
          </motion.div>
        )}

        {success && (
          <motion.div
            initial={{ opacity: 0, y: -10 }}
            animate={{ opacity: 1, y: 0 }}
            className="w-full mb-4 bg-green-500/10 border border-green-500/30 rounded-xl p-3 text-sm"
          >
            <p className="text-green-300 flex items-center gap-2">
              <svg className="w-4 h-4 flex-shrink-0" fill="none" stroke="currentColor" viewBox="0 0 24 24">
                <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M9 12l2 2 4-4m6 2a9 9 0 11-18 0 9 9 0 0118 0z" />
              </svg>
              {success}
            </p>
          </motion.div>
        )}

        {/* Localização detectada */}
        {location && (
          <motion.div
            initial={{ opacity: 0, scale: 0.95 }}
            animate={{ opacity: 1, scale: 1 }}
            className="w-full mb-6 bg-emerald-500/10 border border-emerald-500/30 rounded-2xl p-4"
          >
            <div className="flex items-center justify-between mb-3">
              <div className="flex items-center gap-3">
                <div className="relative w-3 h-3 flex-shrink-0">
                  <div className="absolute inset-0 bg-green-400 rounded-full animate-pulse"></div>
                  <div className="absolute inset-0 bg-green-400 rounded-full"></div>
                </div>
                <div>
                  <p className="text-emerald-300 text-sm font-medium">Localização Detectada</p>
                  <p className="text-emerald-300/60 text-xs">Precisão: {Math.round(location.accuracy)}m</p>
                </div>
              </div>
              <button
                onClick={getCurrentLocation}
                disabled={loadingLocation}
                className="p-2 rounded-lg hover:bg-white/10 transition-colors disabled:opacity-50"
                aria-label="Atualizar localização"
              >
                <svg
                  className={`w-4 h-4 text-emerald-300 ${loadingLocation ? 'animate-spin' : ''}`}
                  fill="none" stroke="currentColor" viewBox="0 0 24 24"
                >
                  <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M4 4v5h.582m15.356 2A8.001 8.001 0 004.582 9m0 0H9m11 11v-5h-.581m0 0a8.003 8.003 0 01-15.357-2m15.357 2H15" />
                </svg>
              </button>
            </div>
            <div className="mt-3">
              <LocationMap location={location} isDarkMode={true} />
            </div>
          </motion.div>
        )}

        {/* Botões ENTRADA / SAÍDA */}
        <div className="w-full space-y-4 mb-6">
          <motion.button
            whileTap={{ scale: 0.97 }}
            onClick={() => registrarPonto('entrada')}
            disabled={loading || loadingLocation || !locationPermission}
            className="w-full bg-gradient-to-br from-green-500 to-green-600 hover:from-green-400 hover:to-green-500 rounded-2xl p-5 flex items-center justify-center gap-3 shadow-xl disabled:opacity-40 disabled:cursor-not-allowed transition-all"
          >
            <div className="w-10 h-10 rounded-full bg-white/20 flex items-center justify-center flex-shrink-0">
              {loading ? (
                <svg className="animate-spin w-5 h-5 text-white" fill="none" viewBox="0 0 24 24">
                  <circle className="opacity-25" cx="12" cy="12" r="10" stroke="currentColor" strokeWidth="4"></circle>
                  <path className="opacity-75" fill="currentColor" d="M4 12a8 8 0 018-8V0C5.373 0 0 5.373 0 12h4zm2 5.291A7.962 7.962 0 014 12H0c0 3.042 1.135 5.824 3 7.938l3-2.647z"></path>
                </svg>
              ) : (
                <svg className="w-5 h-5 text-white" fill="none" stroke="currentColor" viewBox="0 0 24 24">
                  <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M11 16l-4-4m0 0l4-4m-4 4h14m-5 4v1a3 3 0 01-3 3H6a3 3 0 01-3-3V7a3 3 0 013-3h7a3 3 0 013 3v1" />
                </svg>
              )}
            </div>
            <span className="text-white font-bold text-lg">
              {loading ? 'Processando...' : 'Registrar Entrada'}
            </span>
          </motion.button>

          <motion.button
            whileTap={{ scale: 0.97 }}
            onClick={() => registrarPonto('saida')}
            disabled={loading || loadingLocation || !locationPermission}
            className="w-full bg-gradient-to-br from-red-500 to-red-600 hover:from-red-400 hover:to-red-500 rounded-2xl p-5 flex items-center justify-center gap-3 shadow-xl disabled:opacity-40 disabled:cursor-not-allowed transition-all"
          >
            <div className="w-10 h-10 rounded-full bg-white/20 flex items-center justify-center flex-shrink-0">
              {loading ? (
                <svg className="animate-spin w-5 h-5 text-white" fill="none" viewBox="0 0 24 24">
                  <circle className="opacity-25" cx="12" cy="12" r="10" stroke="currentColor" strokeWidth="4"></circle>
                  <path className="opacity-75" fill="currentColor" d="M4 12a8 8 0 018-8V0C5.373 0 0 5.373 0 12h4zm2 5.291A7.962 7.962 0 014 12H0c0 3.042 1.135 5.824 3 7.938l3-2.647z"></path>
                </svg>
              ) : (
                <svg className="w-5 h-5 text-white" fill="none" stroke="currentColor" viewBox="0 0 24 24">
                  <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M17 16l4-4m0 0l-4-4m4 4H7m6 4v1a3 3 0 01-3 3H6a3 3 0 01-3-3V7a3 3 0 013-3h4a3 3 0 013 3v1" />
                </svg>
              )}
            </div>
            <span className="text-white font-bold text-lg">
              {loading ? 'Processando...' : 'Registrar Saída'}
            </span>
          </motion.button>
        </div>

        {/* Hint quando sem localização */}
        {!location && locationPermission && (
          <motion.div
            initial={{ opacity: 0 }}
            animate={{ opacity: 1 }}
            className="w-full text-center py-4 text-white/40"
          >
            <svg className="w-7 h-7 text-white/20 mx-auto mb-2" fill="none" stroke="currentColor" viewBox="0 0 24 24">
              <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M17.657 16.657L13.414 20.9a1.998 1.998 0 01-2.827 0l-4.244-4.243a8 8 0 1111.314 0z" />
            </svg>
            <p className="text-sm">Clique para obter sua localização</p>
          </motion.div>
        )}
      </div>
    </div>
  );
}
