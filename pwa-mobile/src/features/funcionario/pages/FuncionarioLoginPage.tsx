import React, { useState } from 'react';
import { useNavigate } from 'react-router-dom';
import { motion } from 'framer-motion';
import { useAuth } from '../../auth/AuthContext';
import Input from '../../../components/ui/Input';
import Button from '../../../components/ui/Button';
import Modal from '../../../components/ui/Modal';


export default function FuncionarioLoginPage() {
  const navigate = useNavigate();
  const { signInFuncionario } = useAuth();
  const [funcionarioId, setFuncionarioId] = useState('');
  const [senha, setSenha] = useState('');
  const [showSenha, setShowSenha] = useState(false);
  const [loading, setLoading] = useState(false);
  const [error, setError] = useState('');
  const [helpModal, setHelpModal] = useState(false);

  const handleSubmit = async (e: React.FormEvent) => {
    e.preventDefault();
    setError('');
    const id = funcionarioId.trim().toLowerCase();
    if (!id) { setError('Digite seu ID de funcionário.'); return; }
    if (!senha) { setError('Digite sua senha.'); return; }
    setLoading(true);
    try {
      await signInFuncionario(id, senha);
      navigate('/funcionario');
    } catch (err: any) {
      setError(err?.response?.data?.error || 'ID ou senha inválidos.');
    } finally {
      setLoading(false);
    }
  };

  return (
    <div className="min-h-screen bg-slate-950 flex flex-col">
      {/* Header */}
      <div className="flex items-center justify-between px-5 pt-10 pb-2">
        <button onClick={() => navigate('/')} className="text-slate-400 hover:text-slate-200 transition-colors">
          <svg className="w-6 h-6" fill="none" stroke="currentColor" viewBox="0 0 24 24">
            <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M15 19l-7-7 7-7" />
          </svg>
        </button>
      </div>

      <motion.div
        initial={{ opacity: 0, y: 24 }}
        animate={{ opacity: 1, y: 0 }}
        transition={{ duration: 0.4 }}
        className="flex-1 flex flex-col justify-center px-6 pb-10 max-w-sm mx-auto w-full"
      >
        {/* Logo */}
        <div className="mb-10 text-center">
          <div className="w-16 h-16 bg-blue-600 rounded-2xl flex items-center justify-center mx-auto mb-5 shadow-lg shadow-blue-600/30">
            <svg className="w-8 h-8 text-white" fill="none" stroke="currentColor" viewBox="0 0 24 24">
              <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M16 7a4 4 0 11-8 0 4 4 0 018 0zM12 14a7 7 0 00-7 7h14a7 7 0 00-7-7z" />
            </svg>
          </div>
          <h1 className="text-2xl font-bold text-slate-50">Área do Funcionário</h1>
          <p className="text-slate-400 text-sm mt-1">Use seu ID e senha para entrar</p>
        </div>

        <form onSubmit={handleSubmit} className="space-y-4">
          <Input
            label="ID do Funcionário"
            type="text"
            inputMode="text"
            placeholder="ex: joao_3a4f"
            value={funcionarioId}
            onChange={e => setFuncionarioId(e.target.value)}
            autoComplete="username"
            hint="Fornecido pelo seu gestor no cadastro"
            icon={<svg className="w-4 h-4" fill="none" stroke="currentColor" viewBox="0 0 24 24"><path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M10 6H5a2 2 0 00-2 2v9a2 2 0 002 2h14a2 2 0 002-2V8a2 2 0 00-2-2h-5m-4 0V5a2 2 0 114 0v1m-4 0a2 2 0 104 0" /></svg>}
          />
          <Input
            label="Senha"
            type={showSenha ? 'text' : 'password'}
            placeholder="••••••••"
            value={senha}
            onChange={e => setSenha(e.target.value)}
            autoComplete="current-password"
            icon={<svg className="w-4 h-4" fill="none" stroke="currentColor" viewBox="0 0 24 24"><path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M12 15v2m-6 4h12a2 2 0 002-2v-6a2 2 0 00-2-2H6a2 2 0 00-2 2v6a2 2 0 002 2zm10-10V7a4 4 0 00-8 0v4h8z" /></svg>}
            rightIcon={
              <button type="button" onClick={() => setShowSenha(s => !s)} className="text-slate-400 hover:text-slate-200">
                {showSenha
                  ? <svg className="w-4 h-4" fill="none" stroke="currentColor" viewBox="0 0 24 24"><path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M13.875 18.825A10.05 10.05 0 0112 19c-4.478 0-8.268-2.943-9.543-7a9.97 9.97 0 011.563-3.029m5.858.908a3 3 0 114.243 4.243M9.878 9.878l4.242 4.242M9.88 9.88l-3.29-3.29m7.532 7.532l3.29 3.29M3 3l3.59 3.59m0 0A9.953 9.953 0 0112 5c4.478 0 8.268 2.943 9.543 7a10.025 10.025 0 01-4.132 5.411m0 0L21 21" /></svg>
                  : <svg className="w-4 h-4" fill="none" stroke="currentColor" viewBox="0 0 24 24"><path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M15 12a3 3 0 11-6 0 3 3 0 016 0z" /><path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M2.458 12C3.732 7.943 7.523 5 12 5c4.478 0 8.268 2.943 9.542 7-1.274 4.057-5.064 7-9.542 7-4.477 0-8.268-2.943-9.542-7z" /></svg>
                }
              </button>
            }
          />

          {error && (
            <motion.div initial={{ opacity: 0 }} animate={{ opacity: 1 }} className="bg-rose-500/15 border border-rose-500/30 rounded-xl px-4 py-3">
              <p className="text-rose-400 text-sm">{error}</p>
            </motion.div>
          )}

          <Button type="submit" fullWidth loading={loading} size="lg" className="mt-2">
            Entrar
          </Button>
        </form>

        <div className="mt-6 flex flex-col gap-2 text-center">
          <button onClick={() => setHelpModal(true)} className="text-sm text-slate-400 hover:text-blue-400 transition-colors">
            Esqueceu a senha?
          </button>
          <button onClick={() => setHelpModal(true)} className="text-sm text-slate-400 hover:text-blue-400 transition-colors">
            Primeiro acesso
          </button>
        </div>

        <div className="mt-8 text-center">
          <button onClick={() => navigate('/empresa/login')} className="text-xs text-slate-600 hover:text-slate-400 transition-colors">
            Acessar como empresa →
          </button>
        </div>
      </motion.div>

      <Modal open={helpModal} onClose={() => setHelpModal(false)} title="Recuperar Acesso">
        <div className="text-center py-2">
          <div className="w-14 h-14 bg-amber-500/20 rounded-full flex items-center justify-center mx-auto mb-4">
            <svg className="w-7 h-7 text-amber-400" fill="none" stroke="currentColor" viewBox="0 0 24 24">
              <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M12 9v2m0 4h.01m-6.938 4h13.856c1.54 0 2.502-1.667 1.732-3L13.732 4c-.77-1.333-2.694-1.333-3.464 0L3.34 16c-.77 1.333.192 3 1.732 3z" />
            </svg>
          </div>
          <h3 className="text-slate-100 font-semibold mb-2">Fale com o seu gestor</h3>
          <p className="text-slate-400 text-sm leading-relaxed">
            Para redefinir sua senha ou realizar o primeiro acesso, entre em contato com o administrador ou RH da sua empresa.
          </p>
          <p className="text-slate-500 text-xs mt-3">Eles poderão gerar uma nova senha temporária para você.</p>
          <Button onClick={() => setHelpModal(false)} fullWidth className="mt-5">Entendido</Button>
        </div>
      </Modal>
    </div>
  );
}
