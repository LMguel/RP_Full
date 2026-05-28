import React from 'react';
import { useNavigate } from 'react-router-dom';
import { motion, AnimatePresence } from 'framer-motion';
import { useAuth } from '../../auth/AuthContext';
import { useOfflineSync } from '../../../hooks/useOfflineSync';
import type { EmpresaUser } from '../../../types';

export default function EmpresaDashboardPage() {
  const navigate = useNavigate();
  const { user, signOut } = useAuth();
  const empresa = user as EmpresaUser;
  const { pendingCount, syncStatus, backendAvailable } = useOfflineSync();

  const handleLogout = () => { signOut(); navigate('/'); };

  return (
    <div className="min-h-screen bg-slate-950 flex flex-col select-none">
      {/* ── Header ──────────────────────────────────────────────────────── */}
      <div className="bg-slate-900 border-b border-slate-800 px-5 pt-10 pb-5">
        <div className="flex items-center justify-between">
          <div>
            <p className="text-slate-500 text-xs uppercase tracking-widest font-medium">Painel Empresa</p>
            <h1 className="text-3xl font-black text-slate-50 mt-0.5">{empresa?.empresa_nome ?? 'Empresa'}</h1>
          </div>
          <button
            onClick={handleLogout}
            className="flex items-center gap-2 px-4 py-3 rounded-xl bg-slate-800 hover:bg-rose-500/15 border border-slate-700 hover:border-rose-500/40 text-slate-400 hover:text-rose-400 transition-all text-sm font-medium"
          >
            <svg className="w-4 h-4" fill="none" stroke="currentColor" viewBox="0 0 24 24">
              <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M17 16l4-4m0 0l-4-4m4 4H7m6 4v1a3 3 0 01-3 3H6a3 3 0 01-3-3V7a3 3 0 013-3h4a3 3 0 013 3v1" />
            </svg>
            Sair
          </button>
        </div>

        {/* Status bar */}
        <div className="flex items-center gap-3 mt-4 flex-wrap">
          <div className={`flex items-center gap-1.5 px-3 py-1.5 rounded-full text-xs font-medium border ${backendAvailable ? 'bg-emerald-500/15 border-emerald-500/30 text-emerald-300' : 'bg-amber-500/15 border-amber-500/30 text-amber-300'}`}>
            <div className={`w-1.5 h-1.5 rounded-full ${backendAvailable ? 'bg-emerald-400' : 'bg-amber-400 animate-pulse'}`} />
            {backendAvailable ? 'Online' : 'Modo contingência'}
          </div>

          {pendingCount > 0 && (
            <div className="flex items-center gap-1.5 px-3 py-1.5 rounded-full text-xs font-medium border bg-amber-500/15 border-amber-500/30 text-amber-300">
              <svg className="w-3 h-3" fill="none" stroke="currentColor" viewBox="0 0 24 24">
                <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M4 4v5h.582m15.356 2A8.001 8.001 0 004.582 9m0 0H9m11 11v-5h-.581m0 0a8.003 8.003 0 01-15.357-2m15.357 2H15" />
              </svg>
              {pendingCount} pendente(s)
            </div>
          )}

          <AnimatePresence>
            {syncStatus === 'syncing' && (
              <motion.div key="syncing" initial={{ opacity: 0 }} animate={{ opacity: 1 }} exit={{ opacity: 0 }}
                className="flex items-center gap-1.5 px-3 py-1.5 rounded-full text-xs font-medium border bg-blue-500/15 border-blue-500/30 text-blue-300">
                <svg className="animate-spin w-3 h-3" fill="none" viewBox="0 0 24 24"><circle className="opacity-25" cx="12" cy="12" r="10" stroke="currentColor" strokeWidth="4" /><path className="opacity-75" fill="currentColor" d="M4 12a8 8 0 018-8V0C5.373 0 0 5.373 0 12h4z" /></svg>
                Sincronizando...
              </motion.div>
            )}
            {syncStatus === 'synced' && (
              <motion.div key="synced" initial={{ opacity: 0 }} animate={{ opacity: 1 }} exit={{ opacity: 0 }}
                className="flex items-center gap-1.5 px-3 py-1.5 rounded-full text-xs font-medium border bg-emerald-500/15 border-emerald-500/30 text-emerald-300">
                ✓ Registros sincronizados
              </motion.div>
            )}
          </AnimatePresence>
        </div>
      </div>

      {/* ── Main Actions ─────────────────────────────────────────────────── */}
      <div className="flex-1 flex flex-col px-5 py-6 gap-5">

        {/* KIOSK — Primary hero button */}
        <motion.button
          initial={{ opacity: 0, y: 20 }}
          animate={{ opacity: 1, y: 0 }}
          transition={{ delay: 0.05, duration: 0.3 }}
          whileTap={{ scale: 0.98 }}
          onClick={() => navigate('/kiosk')}
          className="flex-1 min-h-[220px] w-full bg-gradient-to-br from-emerald-600/30 via-emerald-700/20 to-teal-800/20 border-2 border-emerald-500/50 rounded-3xl p-8 text-left hover:border-emerald-400/80 hover:from-emerald-600/40 active:scale-[0.97] transition-all shadow-2xl shadow-emerald-600/10 group"
        >
          <div className="flex flex-col h-full justify-between">
            <div className="flex items-start justify-between">
              <div className="w-20 h-20 bg-emerald-500/25 rounded-2xl flex items-center justify-center group-hover:bg-emerald-500/35 transition-colors shadow-lg">
                <svg className="w-10 h-10 text-emerald-300" fill="none" stroke="currentColor" viewBox="0 0 24 24">
                  <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={1.5} d="M3 9a2 2 0 012-2h.93a2 2 0 001.664-.89l.812-1.22A2 2 0 0110.07 4h3.86a2 2 0 011.664.89l.812 1.22A2 2 0 0018.07 7H19a2 2 0 012 2v9a2 2 0 01-2 2H5a2 2 0 01-2-2V9z" />
                  <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={1.5} d="M15 13a3 3 0 11-6 0 3 3 0 016 0z" />
                </svg>
              </div>
              <span className="text-xs bg-emerald-500/20 text-emerald-300 border border-emerald-500/30 px-2.5 py-1 rounded-full font-semibold tracking-wide">FACIAL</span>
            </div>
            <div>
              <p className="text-emerald-300/70 text-base font-medium uppercase tracking-widest mb-1">Registrar Ponto</p>
              <h2 className="text-white text-4xl font-black leading-tight">Modo Kiosk</h2>
              <p className="text-slate-400 text-base mt-2">Terminal de reconhecimento facial</p>
            </div>
          </div>
        </motion.button>

        {/* CADASTRAR — Secondary hero button */}
        <motion.button
          initial={{ opacity: 0, y: 20 }}
          animate={{ opacity: 1, y: 0 }}
          transition={{ delay: 0.12, duration: 0.3 }}
          whileTap={{ scale: 0.98 }}
          onClick={() => navigate('/empresa/funcionarios/novo')}
          className="flex-1 min-h-[200px] w-full bg-gradient-to-br from-blue-600/25 via-blue-700/15 to-indigo-800/15 border-2 border-blue-500/40 rounded-3xl p-8 text-left hover:border-blue-400/70 hover:from-blue-600/35 active:scale-[0.97] transition-all shadow-2xl shadow-blue-600/10 group"
        >
          <div className="flex flex-col h-full justify-between">
            <div className="w-18 h-18 bg-blue-500/20 rounded-2xl flex items-center justify-center group-hover:bg-blue-500/30 transition-colors shadow-lg w-20 h-20">
              <svg className="w-10 h-10 text-blue-300" fill="none" stroke="currentColor" viewBox="0 0 24 24">
                <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={1.5} d="M18 9v3m0 0v3m0-3h3m-3 0h-3m-2-5a4 4 0 11-8 0 4 4 0 018 0zM3 20a6 6 0 0112 0v1H3v-1z" />
              </svg>
            </div>
            <div>
              <p className="text-blue-300/70 text-base font-medium uppercase tracking-widest mb-1">Gestão</p>
              <h2 className="text-white text-3xl font-black leading-tight">Cadastrar Funcionário</h2>
              <p className="text-slate-400 text-base mt-2">Novo colaborador com foto facial</p>
            </div>
          </div>
        </motion.button>
      </div>
    </div>
  );
}
