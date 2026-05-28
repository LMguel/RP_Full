import React, { useEffect, useState, useCallback } from 'react';
import { useNavigate } from 'react-router-dom';
import { motion } from 'framer-motion';
import apiService from '../../../services/api';
import Badge from '../../../components/ui/Badge';
import Button from '../../../components/ui/Button';
import Modal from '../../../components/ui/Modal';
import Input from '../../../components/ui/Input';
import { Skeleton } from '../../../components/ui/Skeleton';
import type { TimeRecord } from '../../../types';

function formatDateTime(iso: string) {
  if (!iso) return '--';
  const d = new Date(iso.includes('T') ? iso : iso.replace(' ', 'T'));
  return d.toLocaleString('pt-BR', { timeZone: 'America/Sao_Paulo', day: '2-digit', month: '2-digit', hour: '2-digit', minute: '2-digit' });
}

function getTipoLabel(tipo: string) {
  const labels: Record<string, string> = { entrada: 'Entrada', saida: 'Saída', intervalo_inicio: 'Início Intervalo', intervalo_fim: 'Fim Intervalo' };
  return labels[tipo] || tipo;
}

export default function RegistrosEmpresaPage() {
  const navigate = useNavigate();
  const today = new Date().toISOString().slice(0, 10);
  const [inicio, setInicio] = useState(today);
  const [fim, setFim] = useState(today);
  const [records, setRecords] = useState<TimeRecord[]>([]);
  const [loading, setLoading] = useState(false);
  const [invalidModal, setInvalidModal] = useState<TimeRecord | null>(null);
  const [justificativa, setJustificativa] = useState('');
  const [invalidLoading, setInvalidLoading] = useState(false);

  const load = useCallback(async () => {
    setLoading(true);
    try {
      const data = await apiService.getRegistros({ inicio, fim });
      setRecords(data);
    } catch { setRecords([]); }
    finally { setLoading(false); }
  }, [inicio, fim]);

  useEffect(() => { load(); }, [load]);

  const handleInvalidar = async () => {
    if (!invalidModal || !justificativa.trim()) return;
    setInvalidLoading(true);
    try {
      await apiService.invalidarRegistro(invalidModal.id!, justificativa);
      setRecords(prev => prev.map(r => r.id === invalidModal.id ? { ...r, status: 'invalidado' } : r));
      setInvalidModal(null);
      setJustificativa('');
    } catch (err: any) {
      alert(err?.response?.data?.error || 'Erro ao invalidar registro.');
    } finally { setInvalidLoading(false); }
  };

  return (
    <div className="min-h-screen bg-slate-950 flex flex-col">
      <div className="bg-slate-900 border-b border-slate-800 px-5 pt-10 pb-4">
        <div className="flex items-center gap-3 mb-4">
          <button onClick={() => navigate('/empresa')} className="text-slate-400 hover:text-slate-200 transition-colors">
            <svg className="w-5 h-5" fill="none" stroke="currentColor" viewBox="0 0 24 24"><path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M15 19l-7-7 7-7" /></svg>
          </button>
          <h1 className="text-lg font-bold text-slate-50 flex-1">Registros</h1>
          <span className="text-xs text-slate-500">{records.length} registros</span>
        </div>
        <div className="grid grid-cols-2 gap-3">
          <Input label="De" type="date" value={inicio} onChange={e => setInicio(e.target.value)} />
          <Input label="Até" type="date" value={fim} onChange={e => setFim(e.target.value)} />
        </div>
      </div>

      <div className="flex-1 overflow-y-auto px-4 py-4 space-y-2">
        {loading ? (
          <div className="space-y-2">{[...Array(6)].map((_, i) => <Skeleton key={i} height="72px" />)}</div>
        ) : records.length === 0 ? (
          <div className="text-center py-12">
            <div className="w-12 h-12 bg-slate-800 rounded-full flex items-center justify-center mx-auto mb-3">
              <svg className="w-6 h-6 text-slate-600" fill="none" stroke="currentColor" viewBox="0 0 24 24"><path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M9 5H7a2 2 0 00-2 2v12a2 2 0 002 2h10a2 2 0 002-2V7a2 2 0 00-2-2h-2M9 5a2 2 0 002 2h2a2 2 0 002-2M9 5a2 2 0 012-2h2a2 2 0 012 2" /></svg>
            </div>
            <p className="text-slate-500 text-sm">Nenhum registro no período</p>
          </div>
        ) : (
          records.map((r, i) => (
            <motion.div key={r.id || i} initial={{ opacity: 0, y: 6 }} animate={{ opacity: 1, y: 0 }} transition={{ delay: i * 0.02 }}>
              <div className={`bg-slate-900 border rounded-xl p-3 flex items-center gap-3 ${r.status === 'invalidado' ? 'border-slate-800 opacity-60' : 'border-slate-800'}`}>
                <div className={`w-2 h-2 rounded-full flex-shrink-0 ${r.tipo === 'entrada' ? 'bg-emerald-500' : r.tipo === 'saida' ? 'bg-rose-500' : 'bg-amber-500'}`} />
                <div className="flex-1 min-w-0">
                  <p className="text-slate-200 text-sm font-medium truncate">{r.funcionario_id}</p>
                  <p className="text-slate-400 text-xs">{getTipoLabel(r.tipo)} · {formatDateTime(r.data_hora)}</p>
                </div>
                {r.status === 'invalidado'
                  ? <Badge variant="neutral">Invalidado</Badge>
                  : <button onClick={() => { setInvalidModal(r); setJustificativa(''); }}
                      className="text-xs text-rose-400 hover:text-rose-300 border border-rose-500/30 px-2 py-1 rounded-lg transition-colors">
                      Invalidar
                    </button>
                }
              </div>
            </motion.div>
          ))
        )}
      </div>

      <Modal open={!!invalidModal} onClose={() => setInvalidModal(null)} title="Invalidar Registro">
        <div className="space-y-4">
          <p className="text-slate-300 text-sm">Registro de <strong>{invalidModal?.funcionario_id}</strong> em {formatDateTime(invalidModal?.data_hora || '')}.</p>
          <Input label="Motivo / Justificativa *" value={justificativa} onChange={e => setJustificativa(e.target.value)} placeholder="Ex: Erro de sistema, registro duplicado..." />
          <div className="flex gap-3">
            <Button variant="ghost" fullWidth onClick={() => setInvalidModal(null)}>Cancelar</Button>
            <Button variant="danger" fullWidth loading={invalidLoading} disabled={!justificativa.trim()} onClick={handleInvalidar}>Invalidar</Button>
          </div>
        </div>
      </Modal>
    </div>
  );
}
