import React, { useState } from 'react';
import { useNavigate } from 'react-router-dom';
import { motion } from 'framer-motion';
import { useAuth } from '../../auth/AuthContext';
import apiService from '../../../services/api';
import Input from '../../../components/ui/Input';
import Button from '../../../components/ui/Button';
import { saveFuncionarioCredentials, clearFuncionarioCredentials, loadFuncionarioCredentials } from '../savedCredentials';
import type { FuncionarioUser } from '../../../types';

/**
 * Gate obrigatório de troca de senha — aparece quando o RH gera uma senha
 * temporária pro funcionário (must_change_password=true, seja no primeiro
 * acesso ou depois de "esqueci minha senha"). Não tem como pular: sem trocar
 * a senha aqui, o funcionário não acessa nenhuma outra rota do app.
 *
 * A senha temporária não é pedida de novo aqui — ele acabou de digitar ela na
 * tela de login (ou ela já estava salva, no caso de auto-login), então
 * reaproveitamos o valor salvo em savedCredentials em vez de pedir de novo.
 */
export default function TrocarSenhaObrigatoriaPage() {
  const navigate = useNavigate();
  const { user, markPasswordChanged, signOut } = useAuth();
  const func = user as FuncionarioUser;

  const senhaTemporariaSalva = loadFuncionarioCredentials()?.senha ?? '';
  const [senhaAtual, setSenhaAtual] = useState(senhaTemporariaSalva);
  const [novaSenha, setNovaSenha] = useState('');
  const [confirmar, setConfirmar] = useState('');
  const [loading, setLoading] = useState(false);
  const [error, setError] = useState('');

  const handleSubmit = async (e: React.FormEvent) => {
    e.preventDefault();
    setError('');
    if (!senhaAtual) { setError('Digite a senha temporária que você recebeu.'); return; }
    if (novaSenha.length < 6) { setError('A nova senha deve ter ao menos 6 caracteres.'); return; }
    if (novaSenha !== confirmar) { setError('As senhas não coincidem.'); return; }
    setLoading(true);
    try {
      await apiService.alterarSenha(senhaAtual, novaSenha);
      markPasswordChanged();
      // Mantém a credencial salva em sincronia — a senha temporária que estava
      // guardada não vale mais, senão o próximo auto-login falharia sozinho.
      if (func?.id) saveFuncionarioCredentials(func.id, novaSenha);
      navigate('/funcionario', { replace: true });
    } catch (err: any) {
      setError(err?.response?.data?.error || 'Não foi possível trocar a senha. Confira a senha temporária.');
    } finally {
      setLoading(false);
    }
  };

  return (
    <div className="min-h-screen bg-slate-950 flex flex-col">
      <motion.div
        initial={{ opacity: 0, y: 24 }}
        animate={{ opacity: 1, y: 0 }}
        transition={{ duration: 0.4 }}
        className="flex-1 flex flex-col justify-center px-6 pb-10 max-w-sm mx-auto w-full"
      >
        <div className="mb-8 text-center">
          <div className="w-16 h-16 bg-amber-500/20 rounded-2xl flex items-center justify-center mx-auto mb-5">
            <svg className="w-8 h-8 text-amber-400" fill="none" stroke="currentColor" viewBox="0 0 24 24">
              <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M12 15v2m-6 4h12a2 2 0 002-2v-6a2 2 0 00-2-2H6a2 2 0 00-2 2v6a2 2 0 002 2zm10-10V7a4 4 0 00-8 0v4h8z" />
            </svg>
          </div>
          <h1 className="text-2xl font-bold text-slate-50">Defina sua senha</h1>
          <p className="text-slate-400 text-sm mt-2 leading-relaxed">
            Você entrou com uma senha temporária. Antes de continuar, crie uma senha definitiva só sua.
          </p>
        </div>

        <form onSubmit={handleSubmit} className="space-y-4">
          {!senhaTemporariaSalva && (
            <Input
              label="Senha Temporária"
              type="password"
              placeholder="A que você recebeu do RH"
              value={senhaAtual}
              onChange={e => setSenhaAtual(e.target.value)}
              autoComplete="current-password"
              autoFocus
            />
          )}
          <Input
            label="Nova Senha"
            type="password"
            placeholder="Mínimo 6 caracteres"
            value={novaSenha}
            onChange={e => setNovaSenha(e.target.value)}
            autoComplete="new-password"
            hint="Mínimo 6 caracteres"
            autoFocus={!!senhaTemporariaSalva}
          />
          <Input
            label="Confirmar Nova Senha"
            type="password"
            placeholder="••••••••"
            value={confirmar}
            onChange={e => setConfirmar(e.target.value)}
            autoComplete="new-password"
            error={confirmar && novaSenha !== confirmar ? 'As senhas não coincidem' : undefined}
          />

          {error && (
            <div className="bg-rose-500/15 border border-rose-500/30 rounded-xl px-4 py-3">
              <p className="text-rose-400 text-sm">{error}</p>
            </div>
          )}

          <Button type="submit" fullWidth loading={loading} size="lg" className="mt-2">
            Salvar Nova Senha
          </Button>
        </form>

        <button
          onClick={() => { clearFuncionarioCredentials(); signOut(); navigate('/'); }}
          className="mt-6 text-sm text-slate-500 hover:text-slate-300 transition-colors text-center"
        >
          Não sei a senha temporária — sair e tentar depois
        </button>
      </motion.div>
    </div>
  );
}
