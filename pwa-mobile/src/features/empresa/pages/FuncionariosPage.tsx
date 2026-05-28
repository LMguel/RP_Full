import React, { useEffect, useState, useMemo } from 'react';
import { useNavigate } from 'react-router-dom';
import { motion, AnimatePresence } from 'framer-motion';
import apiService from '../../../services/api';
import Avatar from '../../../components/ui/Avatar';
import Badge from '../../../components/ui/Badge';
import Button from '../../../components/ui/Button';
import { SkeletonCard } from '../../../components/ui/Skeleton';
import Modal from '../../../components/ui/Modal';
import Input from '../../../components/ui/Input';
import type { Employee, CredenciaisFuncionario } from '../../../types';

export default function FuncionariosPage() {
  const navigate = useNavigate();
  const [employees, setEmployees] = useState<Employee[]>([]);
  const [loading, setLoading] = useState(true);
  const [search, setSearch] = useState('');
  const [filterAtivo, setFilterAtivo] = useState<'todos' | 'ativos' | 'inativos'>('ativos');
  const [resetModal, setResetModal] = useState<Employee | null>(null);
  const [resetResult, setResetResult] = useState<CredenciaisFuncionario | null>(null);
  const [resetLoading, setResetLoading] = useState(false);
  const [disableModal, setDisableModal] = useState<Employee | null>(null);
  const [actionLoading, setActionLoading] = useState(false);

  useEffect(() => {
    apiService.getEmployees()
      .then(setEmployees)
      .catch(() => setEmployees([]))
      .finally(() => setLoading(false));
  }, []);

  const filtered = useMemo(() => employees.filter(e => {
    const matchSearch = !search || e.nome.toLowerCase().includes(search.toLowerCase()) || e.cargo?.toLowerCase().includes(search.toLowerCase());
    const matchAtivo = filterAtivo === 'todos' || (filterAtivo === 'ativos' ? e.ativo !== false : e.ativo === false);
    return matchSearch && matchAtivo;
  }), [employees, search, filterAtivo]);

  const handleResetSenha = async () => {
    if (!resetModal) return;
    setResetLoading(true);
    try {
      const cred = await apiService.redefinirSenha(resetModal.id);
      setResetResult(cred);
    } catch (err: any) {
      alert(err?.response?.data?.error || 'Erro ao redefinir senha.');
    } finally {
      setResetLoading(false);
    }
  };

  const handleToggleAtivo = async () => {
    if (!disableModal) return;
    setActionLoading(true);
    try {
      await apiService.updateEmployee(disableModal.id, { ativo: !disableModal.ativo });
      setEmployees(prev => prev.map(e => e.id === disableModal.id ? { ...e, ativo: !e.ativo } : e));
      setDisableModal(null);
    } catch {
      alert('Erro ao atualizar status.');
    } finally {
      setActionLoading(false);
    }
  };

  const handleCopy = (text: string) => navigator.clipboard.writeText(text).catch(() => {});

  return (
    <div className="min-h-screen bg-slate-950 flex flex-col">
      {/* Header */}
      <div className="bg-slate-900 border-b border-slate-800 px-5 pt-10 pb-4">
        <div className="flex items-center gap-3 mb-4">
          <button onClick={() => navigate('/empresa')} className="text-slate-400 hover:text-slate-200 transition-colors">
            <svg className="w-5 h-5" fill="none" stroke="currentColor" viewBox="0 0 24 24"><path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M15 19l-7-7 7-7" /></svg>
          </button>
          <h1 className="text-lg font-bold text-slate-50 flex-1">Funcionários</h1>
          <span className="text-xs text-slate-500">{filtered.length} resultado{filtered.length !== 1 ? 's' : ''}</span>
        </div>
        <Input placeholder="Buscar por nome ou cargo..." value={search} onChange={e => setSearch(e.target.value)}
          icon={<svg className="w-4 h-4" fill="none" stroke="currentColor" viewBox="0 0 24 24"><path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M21 21l-6-6m2-5a7 7 0 11-14 0 7 7 0 0114 0z" /></svg>}
        />
        <div className="flex gap-2 mt-3">
          {(['ativos', 'inativos', 'todos'] as const).map(f => (
            <button key={f} onClick={() => setFilterAtivo(f)}
              className={`text-xs px-3 py-1.5 rounded-lg transition-all capitalize ${filterAtivo === f ? 'bg-blue-600 text-white' : 'bg-slate-800 text-slate-400 border border-slate-700'}`}>
              {f}
            </button>
          ))}
        </div>
      </div>

      <div className="flex-1 overflow-y-auto px-4 py-4 space-y-2 pb-24">
        {loading ? (
          <>{[...Array(4)].map((_, i) => <SkeletonCard key={i} />)}</>
        ) : filtered.length === 0 ? (
          <div className="text-center py-12">
            <div className="w-12 h-12 bg-slate-800 rounded-full flex items-center justify-center mx-auto mb-3">
              <svg className="w-6 h-6 text-slate-600" fill="none" stroke="currentColor" viewBox="0 0 24 24"><path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M17 20h5v-2a3 3 0 00-5.356-1.857M17 20H7m10 0v-2c0-.656-.126-1.283-.356-1.857M7 20H2v-2a3 3 0 015.356-1.857M7 20v-2c0-.656.126-1.283.356-1.857m0 0a5.002 5.002 0 019.288 0M15 7a3 3 0 11-6 0 3 3 0 016 0z" /></svg>
            </div>
            <p className="text-slate-500 text-sm">Nenhum funcionário encontrado</p>
          </div>
        ) : (
          <AnimatePresence>
            {filtered.map((emp, i) => (
              <motion.div key={emp.id} initial={{ opacity: 0, y: 8 }} animate={{ opacity: 1, y: 0 }} transition={{ delay: i * 0.03 }}>
                <div className="bg-slate-900 border border-slate-800 rounded-2xl p-4">
                  <div className="flex items-center gap-3 mb-3">
                    <Avatar src={emp.foto_url} name={emp.nome} size="md" />
                    <div className="flex-1 min-w-0">
                      <p className="font-semibold text-slate-100 truncate">{emp.nome}</p>
                      <p className="text-xs text-slate-400 truncate">{emp.cargo || 'Sem cargo'}{emp.setor ? ` · ${emp.setor}` : ''}</p>
                    </div>
                    <Badge variant={emp.ativo !== false ? 'success' : 'neutral'} dot>{emp.ativo !== false ? 'Ativo' : 'Inativo'}</Badge>
                  </div>
                  <div className="flex gap-2 flex-wrap">
                    <button onClick={() => navigate(`/empresa/funcionarios/${emp.id}`)}
                      className="flex-1 text-xs bg-slate-800 hover:bg-slate-700 text-slate-300 px-3 py-2 rounded-lg border border-slate-700 transition-colors">
                      Editar
                    </button>
                    <button onClick={() => { setResetModal(emp); setResetResult(null); }}
                      className="flex-1 text-xs bg-slate-800 hover:bg-slate-700 text-slate-300 px-3 py-2 rounded-lg border border-slate-700 transition-colors">
                      Redefinir Senha
                    </button>
                    <button onClick={() => setDisableModal(emp)}
                      className={`flex-1 text-xs px-3 py-2 rounded-lg border transition-colors ${emp.ativo !== false ? 'bg-rose-500/10 hover:bg-rose-500/20 text-rose-400 border-rose-500/30' : 'bg-emerald-500/10 hover:bg-emerald-500/20 text-emerald-400 border-emerald-500/30'}`}>
                      {emp.ativo !== false ? 'Desativar' : 'Reativar'}
                    </button>
                  </div>
                </div>
              </motion.div>
            ))}
          </AnimatePresence>
        )}
      </div>

      {/* FAB */}
      <motion.button whileHover={{ scale: 1.05 }} whileTap={{ scale: 0.95 }}
        onClick={() => navigate('/empresa/funcionarios/novo')}
        className="fixed bottom-6 right-5 w-14 h-14 bg-blue-600 hover:bg-blue-500 text-white rounded-full shadow-2xl shadow-blue-600/40 flex items-center justify-center transition-colors z-40">
        <svg className="w-6 h-6" fill="none" stroke="currentColor" viewBox="0 0 24 24"><path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M12 4v16m8-8H4" /></svg>
      </motion.button>

      {/* Reset modal */}
      <Modal open={!!resetModal} onClose={() => { setResetModal(null); setResetResult(null); }} title="Redefinir Senha">
        {resetResult ? (
          <div className="space-y-4">
            <div className="bg-emerald-500/10 border border-emerald-500/20 rounded-xl p-4">
              <p className="text-emerald-400 text-sm font-semibold mb-3">Senha redefinida com sucesso!</p>
              <div className="space-y-2">
                <div className="flex items-center justify-between bg-slate-900 rounded-lg px-3 py-2">
                  <div><p className="text-xs text-slate-400">Login (CPF)</p><p className="text-slate-100 font-mono text-sm">{resetResult.login}</p></div>
                  <button onClick={() => handleCopy(resetResult.login)} className="text-slate-400 hover:text-slate-200"><svg className="w-4 h-4" fill="none" stroke="currentColor" viewBox="0 0 24 24"><path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M8 16H6a2 2 0 01-2-2V6a2 2 0 012-2h8a2 2 0 012 2v2m-6 12h8a2 2 0 002-2v-8a2 2 0 00-2-2h-8a2 2 0 00-2 2v8a2 2 0 002 2z" /></svg></button>
                </div>
                <div className="flex items-center justify-between bg-slate-900 rounded-lg px-3 py-2">
                  <div><p className="text-xs text-slate-400">Senha Temporária</p><p className="text-slate-100 font-mono text-sm">{resetResult.senha_temporaria}</p></div>
                  <button onClick={() => handleCopy(resetResult.senha_temporaria)} className="text-slate-400 hover:text-slate-200"><svg className="w-4 h-4" fill="none" stroke="currentColor" viewBox="0 0 24 24"><path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M8 16H6a2 2 0 01-2-2V6a2 2 0 012-2h8a2 2 0 012 2v2m-6 12h8a2 2 0 002-2v-8a2 2 0 00-2-2h-8a2 2 0 00-2 2v8a2 2 0 002 2z" /></svg></button>
                </div>
              </div>
              <button onClick={() => handleCopy(`Login: ${resetResult.login}\nSenha: ${resetResult.senha_temporaria}`)}
                className="w-full mt-3 text-xs bg-slate-700 hover:bg-slate-600 text-slate-300 px-3 py-2 rounded-lg transition-colors">
                Copiar Tudo
              </button>
            </div>
            <Button fullWidth onClick={() => { setResetModal(null); setResetResult(null); }}>Fechar</Button>
          </div>
        ) : (
          <div className="space-y-4">
            <p className="text-slate-300 text-sm">Redefinir senha de <strong>{resetModal?.nome}</strong>? Uma senha temporária será gerada.</p>
            <div className="flex gap-3">
              <Button variant="ghost" fullWidth onClick={() => setResetModal(null)}>Cancelar</Button>
              <Button variant="danger" fullWidth loading={resetLoading} onClick={handleResetSenha}>Confirmar</Button>
            </div>
          </div>
        )}
      </Modal>

      {/* Disable modal */}
      <Modal open={!!disableModal} onClose={() => setDisableModal(null)} title={disableModal?.ativo !== false ? 'Desativar Funcionário' : 'Reativar Funcionário'}>
        <div className="space-y-4">
          <p className="text-slate-300 text-sm">
            {disableModal?.ativo !== false ? `Desativar ${disableModal?.nome}? O funcionário não conseguirá mais fazer login.` : `Reativar ${disableModal?.nome}?`}
          </p>
          <div className="flex gap-3">
            <Button variant="ghost" fullWidth onClick={() => setDisableModal(null)}>Cancelar</Button>
            <Button variant={disableModal?.ativo !== false ? 'danger' : 'success'} fullWidth loading={actionLoading} onClick={handleToggleAtivo}>Confirmar</Button>
          </div>
        </div>
      </Modal>
    </div>
  );
}
