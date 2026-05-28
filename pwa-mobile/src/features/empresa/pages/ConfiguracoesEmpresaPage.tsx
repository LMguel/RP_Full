import React, { useEffect, useState } from 'react';
import { useNavigate } from 'react-router-dom';
import { motion } from 'framer-motion';
import apiService from '../../../services/api';
import Input from '../../../components/ui/Input';
import Button from '../../../components/ui/Button';
import Card from '../../../components/ui/Card';
import { Skeleton } from '../../../components/ui/Skeleton';

export default function ConfiguracoesEmpresaPage() {
  const navigate = useNavigate();
  const [config, setConfig] = useState<Record<string, any> | null>(null);
  const [loading, setLoading] = useState(true);
  const [saving, setSaving] = useState(false);
  const [saved, setSaved] = useState(false);

  useEffect(() => {
    apiService.getCompanyConfig().then(setConfig).catch(() => setConfig({})).finally(() => setLoading(false));
  }, []);

  const set = (k: string, v: any) => setConfig(c => ({ ...c, [k]: v }));

  const handleSave = async () => {
    if (!config) return;
    setSaving(true);
    try {
      await apiService.saveCompanyConfig(config);
      setSaved(true);
      setTimeout(() => setSaved(false), 3000);
    } catch (err: any) {
      alert(err?.response?.data?.error || 'Erro ao salvar configurações.');
    } finally {
      setSaving(false);
    }
  };

  return (
    <div className="min-h-screen bg-slate-950 flex flex-col">
      <div className="bg-slate-900 border-b border-slate-800 px-5 pt-10 pb-4">
        <div className="flex items-center gap-3">
          <button onClick={() => navigate('/empresa')} className="text-slate-400 hover:text-slate-200 transition-colors">
            <svg className="w-5 h-5" fill="none" stroke="currentColor" viewBox="0 0 24 24"><path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M15 19l-7-7 7-7" /></svg>
          </button>
          <h1 className="text-lg font-bold text-slate-50">Configurações</h1>
        </div>
      </div>

      <div className="flex-1 overflow-y-auto px-4 py-5 space-y-5 pb-8">
        {loading ? (
          <div className="space-y-3">{[...Array(4)].map((_, i) => <Skeleton key={i} height="56px" />)}</div>
        ) : (
          <motion.div initial={{ opacity: 0 }} animate={{ opacity: 1 }} className="space-y-5">
            <div>
              <p className="text-xs font-medium text-slate-500 uppercase tracking-wider mb-3">Horário Padrão</p>
              <Card className="space-y-4">
                <div className="grid grid-cols-2 gap-3">
                  <Input label="Entrada" type="time" value={config?.horario_entrada || '08:00'} onChange={e => set('horario_entrada', e.target.value)} />
                  <Input label="Saída" type="time" value={config?.horario_saida || '17:00'} onChange={e => set('horario_saida', e.target.value)} />
                </div>
                <Input label="Intervalo Padrão (min)" type="number" inputMode="numeric" value={String(config?.intervalo_padrao || 60)} onChange={e => set('intervalo_padrao', Number(e.target.value))} />
              </Card>
            </div>

            <div>
              <p className="text-xs font-medium text-slate-500 uppercase tracking-wider mb-3">Tolerâncias</p>
              <Card className="space-y-4">
                <Input label="Tolerância de Atraso (min)" type="number" inputMode="numeric" value={String(config?.tolerancia_atraso || 10)} onChange={e => set('tolerancia_atraso', Number(e.target.value))} hint="Minutos de atraso não computados" />
                <Input label="Tolerância de Saída Antecipada (min)" type="number" inputMode="numeric" value={String(config?.tolerancia_saida || 10)} onChange={e => set('tolerancia_saida', Number(e.target.value))} />
              </Card>
            </div>

            {saved && <div className="bg-emerald-500/15 border border-emerald-500/30 rounded-xl px-4 py-3"><p className="text-emerald-400 text-sm text-center">Configurações salvas!</p></div>}

            <Button fullWidth loading={saving} onClick={handleSave} size="lg">Salvar Configurações</Button>
          </motion.div>
        )}
      </div>
    </div>
  );
}
