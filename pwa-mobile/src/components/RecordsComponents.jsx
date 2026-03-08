import React from 'react';
import { useTheme } from '../contexts/ThemeContext';

/**
 * Componente para exibir lista de registros
 * Usado no dashboard do funcionário
 */
export function RecordsList({ records = [], loading = false }) {
  const { isDarkMode } = useTheme();
  
  if (loading) {
    return (
      <div className="space-y-3">
        {[1, 2, 3].map(i => (
          <div key={i} className={`${isDarkMode ? 'bg-white/5' : 'bg-gray-100'} rounded-lg p-4 animate-pulse`}>
            <div className={`h-4 ${isDarkMode ? 'bg-white/10' : 'bg-gray-300'} rounded w-3/4 mb-2`}></div>
            <div className={`h-3 ${isDarkMode ? 'bg-white/10' : 'bg-gray-300'} rounded w-1/2`}></div>
          </div>
        ))}
      </div>
    );
  }

  if (!records || records.length === 0) {
    return (
      <div className="text-center py-12">
        <svg className={`w-16 h-16 mx-auto ${isDarkMode ? 'text-gray-600' : 'text-gray-300'} mb-4`} fill="none" stroke="currentColor" viewBox="0 0 24 24">
          <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M9 5H7a2 2 0 00-2 2v12a2 2 0 002 2h10a2 2 0 002-2V7a2 2 0 00-2-2h-2M9 5a2 2 0 002 2h2a2 2 0 002-2M9 5a2 2 0 012-2h2a2 2 0 012 2" />
        </svg>
        <p className={`${isDarkMode ? 'text-gray-400' : 'text-gray-500'} text-lg`}>Nenhum registro encontrado</p>
        <p className={`${isDarkMode ? 'text-gray-500' : 'text-gray-400'} text-sm mt-2`}>Seus registros de ponto aparecerão aqui</p>
      </div>
    );
  }

  return (
    <div className="space-y-3">
      {records.map((record, index) => {
        // Debug: logar o registro para inspecionar formato (remover depois)
        try { console.debug('[RECORD]', record); } catch (e) {}
        
        // Usar 'type' como padrão, com fallback para 'tipo' (registros antigos)
        const recordType = (record.type || record.tipo || '').toLowerCase();
        const isEntrada = recordType === 'entrada';
        const tipoLabels = {
          'entrada': 'ENTRADA', 'saida': 'SAÍDA', 'saída': 'SAÍDA',
          'saida_antecipada': 'SAÍDA ANTECIPADA',
        };
        const tipoLabel = tipoLabels[recordType] || (isEntrada ? 'ENTRADA' : 'SAÍDA');
        const isEntradaLike = isEntrada;
        const isBreakStart = recordType.includes('pausa') || recordType.includes('intervalo');

        // Tenta obter um objeto Date válido a partir de vários formatos
        function parseDateFromValue(val) {
          if (!val && val !== 0) return null;

          // Número (timestamp em segundos ou ms)
          if (typeof val === 'number') {
            // timestamp em segundos (10 dígitos)
            if (String(val).length === 10) return new Date(val * 1000);
            return new Date(val);
          }

          if (typeof val !== 'string') return null;

          let s = val.trim();

          // Se tiver '#', usar a parte depois dele (alguns backends retornam prefix#YYYY-MM-DD ...)
          if (s.includes('#')) {
            s = s.split('#').pop().trim();
          }

          // Tenta Date.parse direto (ISO e variações)
          const parsed = Date.parse(s);
          if (!isNaN(parsed)) return new Date(parsed);

          // Tentar detectar formato YYYY-MM-DD HH:MM:SS
          const ymdMatch = s.match(/(\d{4})-(\d{2})-(\d{2})[ T](\d{2}):(\d{2})(?::(\d{2}))?/);
          if (ymdMatch) {
            const [, yy, mm, dd, hh, min, sec] = ymdMatch;
            return new Date(Number(yy), Number(mm) - 1, Number(dd), Number(hh), Number(min), Number(sec || 0));
          }

          // Detecta DD/MM/YYYY HH:MM(:SS)?
          const dmyMatch = s.match(/(\d{2})\/(\d{2})\/(\d{4})[ T](\d{2}):(\d{2})(?::(\d{2}))?/);
          if (dmyMatch) {
            const [, dd, mm, yyyy, hh, min, sec] = dmyMatch;
            return new Date(Number(yyyy), Number(mm) - 1, Number(dd), Number(hh), Number(min), Number(sec || 0));
          }

          // Última tentativa: aceitar apenas a data (YYYY-MM-DD ou DD/MM/YYYY)
          const ymdOnly = s.match(/^(\d{4})-(\d{2})-(\d{2})$/);
          if (ymdOnly) {
            const [, yy, mm, dd] = ymdOnly;
            return new Date(Number(yy), Number(mm) - 1, Number(dd));
          }

          const dmyOnly = s.match(/^(\d{2})\/(\d{2})\/(\d{4})$/);
          if (dmyOnly) {
            const [, dd, mm, yyyy] = dmyOnly;
            return new Date(Number(yyyy), Number(mm) - 1, Number(dd));
          }

          return null;
        }

        // Tenta encontrar um campo que contenha data/hora (inclui keys com '#')
        function findDateValue(obj) {
          if (!obj || typeof obj !== 'object') return null;

          const prefer = ['timestamp', 'data_hora', 'created_at', 'date_time', 'datetime', 'date', 'time', 'created_time', 'hora'];
          for (const k of prefer) {
            if (obj[k]) return obj[k];
          }

          // Procurar chaves que contenham '#' (ex: 'employee_id#date_time')
          for (const k of Object.keys(obj)) {
            if (k.includes('#') && obj[k]) return obj[k];
          }

          // Procurar valores que pareçam conter uma data/horário
          for (const k of Object.keys(obj)) {
            const v = obj[k];
            if (typeof v === 'string' && /(\d{4}-\d{2}-\d{2} [0-9:]{5,8})|(\d{2}\/\d{2}\/\d{4} [0-9:]{5,8})/.test(v)) {
              return v;
            }
          }

          return null;
        }

        const rawDateValue = findDateValue(record);
        const date = parseDateFromValue(rawDateValue);
        
        return (
          <div 
            key={record.id || index}
            className={`${isDarkMode ? 'bg-white/10 border-white/20' : 'bg-white border-gray-200'} rounded-lg shadow-sm border p-4 hover:shadow-md transition-shadow`}
          >
            <div className="flex items-start justify-between">
              {/* Ícone e informações */}
              <div className="flex items-start gap-3">
                {/* Ícone de tipo */}
                <div className={`
                  p-2 rounded-full mt-1
                  ${isEntradaLike ? (isDarkMode ? 'bg-green-600/20' : 'bg-green-100') : (isBreakStart ? (isDarkMode ? 'bg-yellow-600/20' : 'bg-yellow-100') : (isDarkMode ? 'bg-red-600/20' : 'bg-red-100'))}
                `}>
                  {isEntradaLike ? (
                    <svg className={`w-5 h-5 ${isDarkMode ? 'text-green-400' : 'text-green-600'}`} fill="none" stroke="currentColor" viewBox="0 0 24 24">
                      <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M11 16l-4-4m0 0l4-4m-4 4h14m-5 4v1a3 3 0 01-3 3H6a3 3 0 01-3-3V7a3 3 0 013-3h7a3 3 0 013 3v1" />
                    </svg>
                  ) : (
                    <svg className={`w-5 h-5 ${isBreakStart ? (isDarkMode ? 'text-yellow-400' : 'text-yellow-600') : (isDarkMode ? 'text-red-400' : 'text-red-600')}`} fill="none" stroke="currentColor" viewBox="0 0 24 24">
                      <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M17 16l4-4m0 0l-4-4m4 4H7m6 4v1a3 3 0 01-3 3H6a3 3 0 01-3-3V7a3 3 0 013-3h4a3 3 0 013 3v1" />
                    </svg>
                  )}
                </div>

                {/* Detalhes do registro */}
                <div className="flex-1">
                  <div className="flex items-center gap-2 mb-1">
                    <span className={`
                      px-2 py-1 rounded text-xs font-semibold
                      ${isEntradaLike ? (isDarkMode ? 'bg-green-600/20 text-green-300' : 'bg-green-100 text-green-800') : (isBreakStart ? (isDarkMode ? 'bg-yellow-600/20 text-yellow-300' : 'bg-yellow-100 text-yellow-800') : (isDarkMode ? 'bg-red-600/20 text-red-300' : 'bg-red-100 text-red-800'))}
                    `}>
                      {tipoLabel}
                    </span>
                  </div>

                  {/* Data e hora */}
                  <p className={`${isDarkMode ? 'text-white' : 'text-gray-900'} font-semibold text-lg`}>
                    {date && !isNaN(date.getTime()) ? (
                      date.toLocaleTimeString('pt-BR', {
                        hour: '2-digit',
                        minute: '2-digit',
                        timeZone: 'America/Sao_Paulo' // Forçar fuso horário brasileiro
                      })
                    ) : (
                      // Se não houver data válida, tentar mostrar qualquer campo de hora disponível
                      (record.hora || record.time || record.created_time || record.timestamp || record.data_hora || record.date_time || record.datetime || '') || '—'
                    )}
                  </p>
                  <p className={`${isDarkMode ? 'text-gray-300' : 'text-gray-700'} text-sm`}>
                    {date && !isNaN(date.getTime()) ? (
                      date.toLocaleDateString('pt-BR', {
                        day: '2-digit',
                        month: 'long',
                        year: 'numeric',
                        timeZone: 'America/Sao_Paulo' // Forçar fuso horário brasileiro
                      })
                    ) : (
                      (record.data || record.date || record.created_date || record.timestamp || record.data_hora || record.date_time || record.datetime) ? String(record.timestamp || record.data_hora || record.created_at || record.date_time || record.datetime) : '—'
                    )}
                  </p>

                  {/* Método de registro */}
                  {record.metodo && (
                    <div className={`flex items-center gap-1 mt-2 text-xs ${isDarkMode ? 'text-gray-400' : 'text-gray-500'}`}>
                      {record.metodo === 'reconhecimento_facial' ? (
                        <>
                          <svg className="w-4 h-4" fill="none" stroke="currentColor" viewBox="0 0 24 24">
                            <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M3 9a2 2 0 012-2h.93a2 2 0 001.664-.89l.812-1.22A2 2 0 0110.07 4h3.86a2 2 0 011.664.89l.812 1.22A2 2 0 0018.07 7H19a2 2 0 012 2v9a2 2 0 01-2 2H5a2 2 0 01-2-2V9z" />
                          </svg>
                          <span>Reconhecimento Facial</span>
                        </>
                      ) : (
                        <>
                          <svg className="w-4 h-4" fill="none" stroke="currentColor" viewBox="0 0 24 24">
                            <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M17.657 16.657L13.414 20.9a1.998 1.998 0 01-2.827 0l-4.244-4.243a8 8 0 1111.314 0z" />
                          </svg>
                          <span>Geolocalização</span>
                        </>
                      )}
                    </div>
                  )}

                  {/* Localização (se disponível) */}
                  {record.localizacao && (
                    <p className={`text-xs ${isDarkMode ? 'text-gray-500' : 'text-gray-400'} mt-1`}>
                      📍 {record.localizacao.latitude?.toFixed(6)}, {record.localizacao.longitude?.toFixed(6)}
                    </p>
                  )}
                </div>
              </div>
            </div>
          </div>
        );
      })}
    </div>
  );
}

/**
 * Componente de loading
 */
export function LoadingSpinner({ message = 'Carregando...' }) {
  const { isDarkMode } = useTheme();
  
  return (
    <div className="flex flex-col items-center justify-center py-12">
      <div className={`w-16 h-16 border-4 ${isDarkMode ? 'border-blue-400 border-t-transparent' : 'border-blue-500 border-t-transparent'} rounded-full animate-spin mb-4`}></div>
      <p className={`${isDarkMode ? 'text-gray-300' : 'text-gray-600'} font-medium`}>{message}</p>
    </div>
  );
}

/**
 * Componente de erro
 */
export function ErrorMessage({ message, onRetry }) {
  const { isDarkMode } = useTheme();
  
  return (
    <div className={`${isDarkMode ? 'bg-red-500/10 border-red-500/30' : 'bg-red-50 border-red-200'} border rounded-lg p-6 text-center`}>
      <svg className={`w-12 h-12 ${isDarkMode ? 'text-red-400' : 'text-red-500'} mx-auto mb-4`} fill="none" stroke="currentColor" viewBox="0 0 24 24">
        <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M12 8v4m0 4h.01M21 12a9 9 0 11-18 0 9 9 0 0118 0z" />
      </svg>
      <p className={`${isDarkMode ? 'text-red-300' : 'text-red-800'} font-semibold mb-2`}>Erro</p>
      <p className={`${isDarkMode ? 'text-red-200' : 'text-red-600'} text-sm mb-4`}>{message}</p>
      {onRetry && (
        <button
          onClick={onRetry}
          className={`px-6 py-2 ${isDarkMode ? 'bg-red-600 hover:bg-red-700' : 'bg-red-500 hover:bg-red-600'} text-white rounded-lg font-semibold transition-colors`}
        >
          Tentar Novamente
        </button>
      )}
    </div>
  );
}
