import React from 'react';

export function RecordsList({ records = [], loading = false }) {
  if (loading) {
    return (
      <div className="space-y-3">
        {[1, 2, 3].map(i => (
          <div key={i} className="bg-white/[.08] rounded-xl p-4 animate-pulse border border-white/10">
            <div className="h-4 bg-white/10 rounded w-3/4 mb-2"></div>
            <div className="h-3 bg-white/10 rounded w-1/2"></div>
          </div>
        ))}
      </div>
    );
  }

  if (!records || records.length === 0) {
    return (
      <div className="text-center py-12">
        <svg className="w-14 h-14 mx-auto text-white/20 mb-4" fill="none" stroke="currentColor" viewBox="0 0 24 24">
          <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M9 5H7a2 2 0 00-2 2v12a2 2 0 002 2h10a2 2 0 002-2V7a2 2 0 00-2-2h-2M9 5a2 2 0 002 2h2a2 2 0 002-2M9 5a2 2 0 012-2h2a2 2 0 012 2" />
        </svg>
        <p className="text-white/60 text-base">Nenhum registro encontrado</p>
        <p className="text-white/40 text-sm mt-1">Seus registros de ponto aparecerão aqui</p>
      </div>
    );
  }

  return (
    <div className="space-y-3">
      {records.map((record, index) => {
        const recordType = (record.type || record.tipo || '').toLowerCase();
        const isEntrada = recordType === 'entrada';
        const tipoLabels = {
          'entrada': 'ENTRADA', 'saida': 'SAÍDA', 'saída': 'SAÍDA',
          'saida_antecipada': 'SAÍDA ANTECIPADA',
        };
        const tipoLabel = tipoLabels[recordType] || (isEntrada ? 'ENTRADA' : 'SAÍDA');
        const isBreakStart = recordType.includes('pausa') || recordType.includes('intervalo');

        function parseDateFromValue(val) {
          if (!val && val !== 0) return null;
          if (typeof val === 'number') {
            return String(val).length === 10 ? new Date(val * 1000) : new Date(val);
          }
          if (typeof val !== 'string') return null;
          let s = val.trim();
          if (s.includes('#')) s = s.split('#').pop().trim();
          const parsed = Date.parse(s);
          if (!isNaN(parsed)) return new Date(parsed);
          const ymdMatch = s.match(/(\d{4})-(\d{2})-(\d{2})[ T](\d{2}):(\d{2})(?::(\d{2}))?/);
          if (ymdMatch) {
            const [, yy, mm, dd, hh, min, sec] = ymdMatch;
            return new Date(Number(yy), Number(mm) - 1, Number(dd), Number(hh), Number(min), Number(sec || 0));
          }
          const dmyMatch = s.match(/(\d{2})\/(\d{2})\/(\d{4})[ T](\d{2}):(\d{2})(?::(\d{2}))?/);
          if (dmyMatch) {
            const [, dd, mm, yyyy, hh, min, sec] = dmyMatch;
            return new Date(Number(yyyy), Number(mm) - 1, Number(dd), Number(hh), Number(min), Number(sec || 0));
          }
          return null;
        }

        function findDateValue(obj) {
          if (!obj || typeof obj !== 'object') return null;
          const prefer = ['timestamp', 'data_hora', 'created_at', 'date_time', 'datetime', 'date', 'time', 'created_time', 'hora'];
          for (const k of prefer) {
            if (obj[k]) return obj[k];
          }
          for (const k of Object.keys(obj)) {
            if (k.includes('#') && obj[k]) return obj[k];
          }
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
            className="bg-white/[.08] rounded-xl border border-white/10 p-4 shadow-sm hover:bg-white/[.12] transition-colors"
          >
            <div className="flex items-start gap-3">
              {/* Type icon */}
              <div className={`p-2 rounded-lg mt-0.5 ${
                isEntrada ? 'bg-green-500/20' : isBreakStart ? 'bg-yellow-500/20' : 'bg-red-500/20'
              }`}>
                {isEntrada ? (
                  <svg className="w-4 h-4 text-green-400" fill="none" stroke="currentColor" viewBox="0 0 24 24">
                    <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M11 16l-4-4m0 0l4-4m-4 4h14m-5 4v1a3 3 0 01-3 3H6a3 3 0 01-3-3V7a3 3 0 013-3h7a3 3 0 013 3v1" />
                  </svg>
                ) : (
                  <svg className={`w-4 h-4 ${isBreakStart ? 'text-yellow-400' : 'text-red-400'}`} fill="none" stroke="currentColor" viewBox="0 0 24 24">
                    <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M17 16l4-4m0 0l-4-4m4 4H7m6 4v1a3 3 0 01-3 3H6a3 3 0 01-3-3V7a3 3 0 013-3h4a3 3 0 013 3v1" />
                  </svg>
                )}
              </div>

              <div className="flex-1 min-w-0">
                <div className="flex items-center gap-2 mb-1">
                  <span className={`px-2 py-0.5 rounded text-xs font-semibold ${
                    isEntrada ? 'bg-green-500/20 text-green-300' : isBreakStart ? 'bg-yellow-500/20 text-yellow-300' : 'bg-red-500/20 text-red-300'
                  }`}>
                    {tipoLabel}
                  </span>
                </div>

                <p className="text-white font-semibold text-base">
                  {date && !isNaN(date.getTime())
                    ? date.toLocaleTimeString('pt-BR', { hour: '2-digit', minute: '2-digit', timeZone: 'America/Sao_Paulo' })
                    : (record.hora || record.time || record.created_time || record.timestamp || record.data_hora || '—')}
                </p>
                <p className="text-white/60 text-sm">
                  {date && !isNaN(date.getTime())
                    ? date.toLocaleDateString('pt-BR', { day: '2-digit', month: 'long', year: 'numeric', timeZone: 'America/Sao_Paulo' })
                    : '—'}
                </p>

                {record.metodo && (
                  <div className="flex items-center gap-1 mt-1.5 text-xs text-white/40">
                    {record.metodo === 'reconhecimento_facial' ? (
                      <>
                        <svg className="w-3 h-3" fill="none" stroke="currentColor" viewBox="0 0 24 24">
                          <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M3 9a2 2 0 012-2h.93a2 2 0 001.664-.89l.812-1.22A2 2 0 0110.07 4h3.86a2 2 0 011.664.89l.812 1.22A2 2 0 0018.07 7H19a2 2 0 012 2v9a2 2 0 01-2 2H5a2 2 0 01-2-2V9z" />
                        </svg>
                        <span>Reconhecimento Facial</span>
                      </>
                    ) : (
                      <>
                        <svg className="w-3 h-3" fill="none" stroke="currentColor" viewBox="0 0 24 24">
                          <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M17.657 16.657L13.414 20.9a1.998 1.998 0 01-2.827 0l-4.244-4.243a8 8 0 1111.314 0z" />
                        </svg>
                        <span>Geolocalização</span>
                      </>
                    )}
                  </div>
                )}
              </div>
            </div>
          </div>
        );
      })}
    </div>
  );
}

export function LoadingSpinner({ message = 'Carregando...' }) {
  return (
    <div className="flex flex-col items-center justify-center py-12">
      <div className="w-12 h-12 border-4 border-white/30 border-t-white rounded-full animate-spin mb-4"></div>
      <p className="text-white/60 font-medium text-sm">{message}</p>
    </div>
  );
}

export function ErrorMessage({ message, onRetry }) {
  return (
    <div className="bg-red-500/10 border border-red-500/30 rounded-xl p-6 text-center">
      <svg className="w-10 h-10 text-red-400 mx-auto mb-3" fill="none" stroke="currentColor" viewBox="0 0 24 24">
        <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M12 8v4m0 4h.01M21 12a9 9 0 11-18 0 9 9 0 0118 0z" />
      </svg>
      <p className="text-red-300 font-semibold mb-1">Erro</p>
      <p className="text-red-200/80 text-sm mb-4">{message}</p>
      {onRetry && (
        <button
          onClick={onRetry}
          className="px-5 py-2 bg-red-500/20 hover:bg-red-500/30 text-red-300 border border-red-500/30 rounded-lg font-semibold transition-colors text-sm"
        >
          Tentar Novamente
        </button>
      )}
    </div>
  );
}
