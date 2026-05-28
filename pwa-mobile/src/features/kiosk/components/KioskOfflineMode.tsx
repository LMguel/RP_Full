import React, { useState, useEffect, useMemo } from 'react';
import { motion, AnimatePresence } from 'framer-motion';
import { getCachedEmployees } from '../../../services/offline/employeeCache';
import { queueOfflineRecord } from '../../../services/offline/offlineQueue';
import { getSaoPauloTimeString, getSaoPauloDateString } from '../../../utils/time';
import type { CachedEmployee } from '../../../services/offline/db';
import KioskClock from './KioskClock';

interface Props {
  companyId: string;
  onBack: () => void;
  onRecordQueued: () => void;
}

type Step = 'list' | 'confirm' | 'success';

export default function KioskOfflineMode({ companyId, onBack, onRecordQueued }: Props) {
  const [employees, setEmployees] = useState<CachedEmployee[]>([]);
  const [search, setSearch] = useState('');
  const [selected, setSelected] = useState<CachedEmployee | null>(null);
  const [step, setStep] = useState<Step>('list');
  const [successNome, setSuccessNome] = useState('');
  const [registeredTime, setRegisteredTime] = useState('');

  useEffect(() => {
    getCachedEmployees(companyId).then(setEmployees);
  }, [companyId]);

  const filtered = useMemo(() => {
    if (!search.trim()) return employees;
    const q = search.toLowerCase().trim();
    return employees.filter(e =>
      e.nome.toLowerCase().includes(q) ||
      (e.matricula?.toLowerCase().includes(q))
    );
  }, [employees, search]);

  const handleSelect = (emp: CachedEmployee) => {
    setSelected(emp);
    setStep('confirm');
  };

  const handleConfirm = async () => {
    if (!selected) return;
    const ts = getSaoPauloTimeString();
    // tipo is intentionally empty — the server will auto-determine entrada/saída on sync
    await queueOfflineRecord({
      employee_id: selected.id,
      company_id: companyId,
      tipo: '',
      timestamp: ts,
    });
    setRegisteredTime(ts.slice(11, 16));
    setSuccessNome(selected.nome);
    setStep('success');
    onRecordQueued();
    setTimeout(() => {
      setStep('list');
      setSelected(null);
      setSearch('');
      setSuccessNome('');
    }, 3000);
  };

  // ─── Success ────────────────────────────────────────────────────────────────
  if (step === 'success') {
    return (
      <div className="fixed inset-0 flex flex-col items-center justify-center bg-gradient-to-br from-blue-700 via-blue-600 to-indigo-600">
        <motion.div
          initial={{ scale: 0.85, opacity: 0 }}
          animate={{ scale: 1, opacity: 1 }}
          transition={{ type: 'spring', stiffness: 220, damping: 22 }}
          className="text-center text-white px-8 max-w-lg"
        >
          <motion.div
            initial={{ scale: 0 }}
            animate={{ scale: 1 }}
            transition={{ delay: 0.1, type: 'spring', stiffness: 300 }}
            className="w-28 h-28 mx-auto mb-8 bg-white/20 rounded-full flex items-center justify-center shadow-2xl border border-white/30"
          >
            <svg className="w-14 h-14 text-white" fill="none" stroke="currentColor" viewBox="0 0 24 24">
              <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2.5} d="M5 13l4 4L19 7" />
            </svg>
          </motion.div>
          <p className="text-white/70 text-xl mb-1">Ponto registrado!</p>
          <h1 className="text-5xl font-black mb-6 leading-tight">{successNome}</h1>
          <div className="bg-white/15 rounded-2xl px-8 py-4 mb-4 border border-white/20 inline-block">
            <div className="text-4xl font-black tracking-wider">
              {registeredTime}
            </div>
          </div>
          <div className="mt-6 flex items-center justify-center gap-2 text-white/50 text-sm">
            <svg className="w-4 h-4" fill="none" stroke="currentColor" viewBox="0 0 24 24">
              <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M12 8v4m0 4h.01M21 12a9 9 0 11-18 0 9 9 0 0118 0z" />
            </svg>
            <span>Offline — será sincronizado automaticamente</span>
          </div>
        </motion.div>
      </div>
    );
  }

  // ─── Confirm ─────────────────────────────────────────────────────────────────
  if (step === 'confirm' && selected) {
    return (
      <div className="fixed inset-0 bg-gradient-to-br from-slate-950 via-slate-900 to-blue-950 flex flex-col">
        <div className="bg-black/30 backdrop-blur-md border-b border-white/10 py-5 px-6 text-center">
          <KioskClock />
        </div>
        {/* Offline banner */}
        <div className="bg-amber-500/20 border-b border-amber-500/30 px-6 py-2.5 flex items-center gap-2">
          <div className="w-2 h-2 bg-amber-400 rounded-full animate-pulse flex-shrink-0" />
          <span className="text-amber-300 text-sm font-medium">Sem internet — modo contingência ativo</span>
        </div>
        <div className="flex-1 flex flex-col items-center justify-center px-8">
          <motion.div
            initial={{ scale: 0.9, opacity: 0 }}
            animate={{ scale: 1, opacity: 1 }}
            className="text-center mb-8 w-full max-w-lg"
          >
            <div className="w-24 h-24 mx-auto mb-5 bg-slate-700 rounded-full flex items-center justify-center border-4 border-slate-600 shadow-2xl">
              <span className="text-white font-black text-4xl">{selected.nome.charAt(0).toUpperCase()}</span>
            </div>
            <p className="text-white/60 text-xl mb-1">Confirma que é você?</p>
            <h2 className="text-white text-5xl font-black mb-1">{selected.nome}</h2>
            {selected.cargo && <p className="text-white/50 text-xl mb-5">{selected.cargo}</p>}
          </motion.div>
          <div className="w-full max-w-2xl space-y-4">
            <motion.button
              initial={{ y: 30, opacity: 0 }}
              animate={{ y: 0, opacity: 1 }}
              transition={{ delay: 0.1 }}
              onClick={handleConfirm}
              className="w-full text-white py-9 rounded-3xl shadow-2xl transition-all text-4xl font-black bg-blue-600 hover:bg-blue-500 active:bg-blue-700"
            >
              ✓ Registrar
            </motion.button>
            <motion.button
              initial={{ y: 30, opacity: 0 }}
              animate={{ y: 0, opacity: 1 }}
              transition={{ delay: 0.2 }}
              onClick={() => { setStep('list'); setSelected(null); }}
              className="w-full bg-white/10 hover:bg-white/20 text-white py-7 rounded-3xl border border-white/20 transition-all text-3xl font-bold"
            >
              ← Cancelar
            </motion.button>
          </div>
        </div>
      </div>
    );
  }

  // ─── Employee List ────────────────────────────────────────────────────────────
  return (
    <div className="fixed inset-0 bg-gradient-to-br from-slate-950 via-slate-900 to-slate-800 flex flex-col">
      {/* Clock header */}
      <div className="bg-black/40 backdrop-blur-md border-b border-white/10 py-4 px-6 flex-shrink-0">
        <div className="flex items-center justify-between">
          <KioskClock />
          <button
            onClick={onBack}
            className="text-white/30 hover:text-white/60 text-xs transition-colors px-3 py-1.5 rounded-lg hover:bg-white/10 border border-white/10"
          >
            ← Menu
          </button>
        </div>
      </div>

      {/* Offline banner */}
      <div className="bg-amber-500/20 border-b border-amber-500/30 px-6 py-3 flex items-center gap-3 flex-shrink-0">
        <div className="w-2 h-2 bg-amber-400 rounded-full animate-pulse flex-shrink-0" />
        <span className="text-amber-300 font-semibold text-sm">Sem internet — modo contingência ativo</span>
        <span className="ml-auto text-amber-400/60 text-xs">{employees.length} funcionários em cache</span>
      </div>

      {/* Search bar */}
      <div className="px-4 pt-4 pb-2 flex-shrink-0">
        <div className="relative">
          <svg className="absolute left-4 top-1/2 -translate-y-1/2 w-6 h-6 text-slate-400 pointer-events-none" fill="none" stroke="currentColor" viewBox="0 0 24 24">
            <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M21 21l-6-6m2-5a7 7 0 11-14 0 7 7 0 0114 0z" />
          </svg>
          <input
            value={search}
            onChange={e => setSearch(e.target.value)}
            placeholder="Buscar por nome ou matrícula..."
            className="w-full bg-slate-800 text-white placeholder-slate-500 rounded-2xl pl-14 pr-4 py-4 text-lg border border-slate-700 focus:border-blue-500 focus:outline-none transition-colors"
            autoComplete="off"
          />
          {search && (
            <button onClick={() => setSearch('')} className="absolute right-4 top-1/2 -translate-y-1/2 text-slate-500 hover:text-slate-300">
              <svg className="w-5 h-5" fill="none" stroke="currentColor" viewBox="0 0 24 24">
                <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M6 18L18 6M6 6l12 12" />
              </svg>
            </button>
          )}
        </div>
      </div>

      {search && (
        <div className="px-6 pb-1 text-slate-500 text-sm">{filtered.length} resultado(s)</div>
      )}

      {/* Employee list */}
      <div className="flex-1 overflow-y-auto px-4 pb-6 space-y-2">
        <AnimatePresence mode="wait">
          {employees.length === 0 ? (
            <motion.div key="empty" initial={{ opacity: 0 }} animate={{ opacity: 1 }} className="text-center py-16 text-slate-500">
              <svg className="w-16 h-16 mx-auto mb-4 text-slate-700" fill="none" stroke="currentColor" viewBox="0 0 24 24">
                <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={1.5} d="M17 20h5v-2a3 3 0 00-5.356-1.857M17 20H7m10 0v-2c0-.656-.126-1.283-.356-1.857M7 20H2v-2a3 3 0 015.356-1.857M7 20v-2c0-.656.126-1.283.356-1.857m0 0a5.002 5.002 0 019.288 0M15 7a3 3 0 11-6 0 3 3 0 016 0zm6 3a2 2 0 11-4 0 2 2 0 014 0zM7 10a2 2 0 11-4 0 2 2 0 014 0z" />
              </svg>
              <p className="text-lg font-medium">Nenhum funcionário em cache</p>
              <p className="text-sm mt-1">Conecte-se à internet e faça login novamente</p>
            </motion.div>
          ) : filtered.length === 0 ? (
            <motion.div key="no-results" initial={{ opacity: 0 }} animate={{ opacity: 1 }} className="text-center py-8 text-slate-500">
              Nenhum resultado para "<span className="text-slate-300">{search}</span>"
            </motion.div>
          ) : (
            filtered.map((emp, i) => (
              <motion.button
                key={emp.id}
                initial={{ opacity: 0, y: 10 }}
                animate={{ opacity: 1, y: 0 }}
                transition={{ delay: Math.min(i * 0.03, 0.3) }}
                whileTap={{ scale: 0.98 }}
                onClick={() => handleSelect(emp)}
                className="w-full bg-slate-800/80 hover:bg-slate-700 border border-slate-700 hover:border-blue-500/50 rounded-2xl px-5 py-4 text-left transition-all flex items-center gap-4 group"
              >
                <div className="w-12 h-12 bg-slate-700 group-hover:bg-slate-600 rounded-full flex items-center justify-center flex-shrink-0 transition-colors">
                  <span className="text-white font-bold text-lg">{emp.nome.charAt(0).toUpperCase()}</span>
                </div>
                <div className="flex-1 min-w-0">
                  <p className="text-white font-bold text-lg truncate">{emp.nome}</p>
                  {emp.cargo && <p className="text-slate-400 text-sm truncate">{emp.cargo}</p>}
                </div>
                {emp.matricula && (
                  <span className="text-slate-500 text-sm font-mono flex-shrink-0">{emp.matricula}</span>
                )}
                <svg className="w-5 h-5 text-slate-600 group-hover:text-blue-400 flex-shrink-0 transition-colors" fill="none" stroke="currentColor" viewBox="0 0 24 24">
                  <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M9 5l7 7-7 7" />
                </svg>
              </motion.button>
            ))
          )}
        </AnimatePresence>
      </div>
    </div>
  );
}
