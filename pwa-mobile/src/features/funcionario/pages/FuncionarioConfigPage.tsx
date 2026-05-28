import React, { useState } from 'react';
import { useNavigate } from 'react-router-dom';
import { motion } from 'framer-motion';
import { useAuth } from '../../auth/AuthContext';
import apiService from '../../../services/api';
import Input from '../../../components/ui/Input';
import Button from '../../../components/ui/Button';
import Card from '../../../components/ui/Card';
import type { FuncionarioUser } from '../../../types';

export default function FuncionarioConfigPage() {
  const navigate = useNavigate();
  const { user, signOut } = useAuth();
  const func = user as FuncionarioUser;

  const [senhaAtual, setSenhaAtual] = useState('');
  const [novaSenha, setNovaSenha] = useState('');
  const [confirmar, setConfirmar] = useState('');
  const [loading, setLoading] = useState(false);
  const [success, setSuccess] = useState(false);
  const [error, setError] = useState('');

  const handleChangePassword = async (e: React.FormEvent) => {
    e.preventDefault();
    setError('');
    if (!senhaAtual) { setError('Digite a senha atual.'); return; }
    if (novaSenha.length < 6) { setError('Nova senha deve ter ao menos 6 caracteres.'); return; }
    if (novaSenha !== confirmar) { setError('As senhas não coincidem.'); return; }
    setLoading(true);
    try {
      await apiService.alterarSenha(senhaAtual, novaSenha);
      setSuccess(true);
      setSenhaAtual(''); setNovaSenha(''); setConfirmar('');
      setTimeout(() => setSuccess(false), 4000);
    } catch (err: any) {
      setError(err?.response?.data?.error || 'Erro ao alterar senha. Verifique a senha atual.');
    } finally {
      setLoading(false);
    }
  };

  const handleSignOut = () => {
    signOut();
    navigate('/');
  };

  return (
    <div className="min-h-screen bg-slate-950 flex flex-col">
      <div className="bg-slate-900 border-b border-slate-800 px-5 pt-10 pb-4">
        <div className="flex items-center gap-3">
          <button onClick={() => navigate('/funcionario')} className="text-slate-400 hover:text-slate-200 transition-colors">
            <svg className="w-5 h-5" fill="none" stroke="currentColor" viewBox="0 0 24 24"><path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M15 19l-7-7 7-7" /></svg>
          </button>
          <h1 className="text-lg font-bold text-slate-50">Configurações</h1>
        </div>
      </div>

      <div className="flex-1 px-4 py-5 space-y-5 pb-24">
        {/* Profile */}
        <motion.div initial={{ opacity: 0, y: 12 }} animate={{ opacity: 1, y: 0 }}>
          <Card>
            <div className="flex items-center gap-3">
              <div className="w-12 h-12 bg-gradient-to-br from-blue-600 to-blue-800 rounded-full flex items-center justify-center text-white font-bold text-lg">
                {func?.nome ? func.nome[0].toUpperCase() : '?'}
              </div>
              <div>
                <p className="font-semibold text-slate-100">{func?.nome}</p>
                <p className="text-sm text-slate-400">{func?.cargo || 'Funcionário'}</p>
              </div>
            </div>
          </Card>
        </motion.div>

        {/* Change password */}
        <motion.div initial={{ opacity: 0, y: 12 }} animate={{ opacity: 1, y: 0 }} transition={{ delay: 0.05 }}>
          <p className="text-xs font-medium text-slate-500 uppercase tracking-wider mb-3">Alterar Senha</p>
          <Card>
            <form onSubmit={handleChangePassword} className="space-y-4">
              <Input label="Senha Atual" type="password" placeholder="••••••••" value={senhaAtual} onChange={e => setSenhaAtual(e.target.value)} autoComplete="current-password" />
              <Input label="Nova Senha" type="password" placeholder="Mínimo 6 caracteres" value={novaSenha} onChange={e => setNovaSenha(e.target.value)} autoComplete="new-password" hint="Mínimo 6 caracteres" />
              <Input label="Confirmar Nova Senha" type="password" placeholder="••••••••" value={confirmar} onChange={e => setConfirmar(e.target.value)} autoComplete="new-password" error={confirmar && novaSenha !== confirmar ? 'As senhas não coincidem' : undefined} />

              {error && <div className="bg-rose-500/15 border border-rose-500/30 rounded-xl px-4 py-3"><p className="text-rose-400 text-sm">{error}</p></div>}
              {success && <div className="bg-emerald-500/15 border border-emerald-500/30 rounded-xl px-4 py-3"><p className="text-emerald-400 text-sm">Senha alterada com sucesso!</p></div>}

              <Button type="submit" fullWidth loading={loading}>Alterar Senha</Button>
            </form>
          </Card>
        </motion.div>

        {/* Logout */}
        <motion.div initial={{ opacity: 0, y: 12 }} animate={{ opacity: 1, y: 0 }} transition={{ delay: 0.1 }}>
          <Card>
            <Button variant="danger" fullWidth onClick={handleSignOut}>
              <svg className="w-4 h-4" fill="none" stroke="currentColor" viewBox="0 0 24 24"><path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M17 16l4-4m0 0l-4-4m4 4H7m6 4v1a3 3 0 01-3 3H6a3 3 0 01-3-3V7a3 3 0 013-3h4a3 3 0 013 3v1" /></svg>
              Sair da Conta
            </Button>
          </Card>
        </motion.div>
      </div>

      {/* Bottom nav */}
      <div className="fixed bottom-0 left-0 right-0 bg-slate-900 border-t border-slate-800 flex">
        {[
          { path: '/funcionario', label: 'Início', icon: <svg className="w-5 h-5" fill="none" stroke="currentColor" viewBox="0 0 24 24"><path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M3 12l2-2m0 0l7-7 7 7M5 10v10a1 1 0 001 1h3m10-11l2 2m-2-2v10a1 1 0 01-1 1h-3m-6 0a1 1 0 001-1v-4a1 1 0 011-1h2a1 1 0 011 1v4a1 1 0 001 1m-6 0h6" /></svg> },
          { path: '/funcionario/espelho', label: 'Espelho', icon: <svg className="w-5 h-5" fill="none" stroke="currentColor" viewBox="0 0 24 24"><path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M9 5H7a2 2 0 00-2 2v12a2 2 0 002 2h10a2 2 0 002-2V7a2 2 0 00-2-2h-2M9 5a2 2 0 002 2h2a2 2 0 002-2M9 5a2 2 0 012-2h2a2 2 0 012 2" /></svg> },
          { path: '/funcionario/configuracoes', label: 'Config', icon: <svg className="w-5 h-5" fill="none" stroke="currentColor" viewBox="0 0 24 24"><path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M10.325 4.317c.426-1.756 2.924-1.756 3.35 0a1.724 1.724 0 002.573 1.066c1.543-.94 3.31.826 2.37 2.37a1.724 1.724 0 001.065 2.572c1.756.426 1.756 2.924 0 3.35a1.724 1.724 0 00-1.066 2.573c.94 1.543-.826 3.31-2.37 2.37a1.724 1.724 0 00-2.572 1.065c-.426 1.756-2.924 1.756-3.35 0a1.724 1.724 0 00-2.573-1.066c-1.543.94-3.31-.826-2.37-2.37a1.724 1.724 0 00-1.065-2.572c-1.756-.426-1.756-2.924 0-3.35a1.724 1.724 0 001.066-2.573c-.94-1.543.826-3.31 2.37-2.37.996.608 2.296.07 2.572-1.065z" /><path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M15 12a3 3 0 11-6 0 3 3 0 016 0z" /></svg> },
        ].map(({ path, label, icon }) => {
          const active = location.pathname === path;
          return (
            <button key={path} onClick={() => navigate(path)}
              className={`flex-1 flex flex-col items-center gap-1 py-3 transition-colors ${active ? 'text-blue-400' : 'text-slate-500 hover:text-slate-300'}`}>
              {icon}
              <span className="text-xs">{label}</span>
            </button>
          );
        })}
      </div>
    </div>
  );
}
