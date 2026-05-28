import React, { useEffect, useState, useCallback } from 'react';
import { useNavigate, useLocation } from 'react-router-dom';
import { motion } from 'framer-motion';
import { useAuth } from '../../auth/AuthContext';
import apiService from '../../../services/api';
import { Skeleton } from '../../../components/ui/Skeleton';
import Badge from '../../../components/ui/Badge';
import type { TimeRecord, RegistroDiario, MonthlySummary, FuncionarioUser } from '../../../types';

const MONTHS = ['Janeiro','Fevereiro','Março','Abril','Maio','Junho','Julho','Agosto','Setembro','Outubro','Novembro','Dezembro'];

function formatHours(h: number): string {
  const totalMins = Math.round(h * 60);
  const hours = Math.floor(totalMins / 60);
  const mins = totalMins % 60;
  return `${hours}h${mins > 0 ? String(mins).padStart(2, '0') + 'm' : ''}`;
}

function formatTime(iso: string): string {
  if (!iso) return '--:--';
  const d = new Date(iso.includes('T') ? iso : iso.replace(' ', 'T'));
  return d.toLocaleTimeString('pt-BR', { hour: '2-digit', minute: '2-digit', timeZone: 'America/Sao_Paulo' });
}

function getTipoLabel(tipo: string): string {
  const map: Record<string, string> = { entrada: 'Entrada', saida: 'Saída', intervalo_inicio: 'Início Intervalo', intervalo_fim: 'Fim Intervalo' };
  return map[tipo] ?? tipo;
}

function getTipoDot(tipo: string): string {
  if (tipo === 'entrada') return 'bg-emerald-500';
  if (tipo === 'saida') return 'bg-rose-500';
  return 'bg-amber-500';
}

export default function FuncionarioDashboardPage() {
  const navigate = useNavigate();
  const location = useLocation();
  const { user, signOut } = useAuth();
  const func = user as FuncionarioUser;

  const now = new Date();
  const [year, setYear] = useState(now.getFullYear());
  const [month, setMonth] = useState(now.getMonth() + 1);
  const [records, setRecords] = useState<TimeRecord[]>([]);
  const [summary, setSummary] = useState<MonthlySummary | null>(null);
  const [dailySummaries, setDailySummaries] = useState<RegistroDiario[]>([]);
  const [loading, setLoading] = useState(true);

  const isCurrentMonth = year === now.getFullYear() && month === now.getMonth() + 1;
  const today = now.toISOString().slice(0, 10);

  const fetchData = useCallback(() => {
    setLoading(true);
    const inicio = `${year}-${String(month).padStart(2, '0')}-01`;
    const lastDay = new Date(year, month, 0).getDate();
    const fim = `${year}-${String(month).padStart(2, '0')}-${lastDay}`;

    Promise.all([
      apiService.getMeusRegistros({ inicio, fim }),
      func?.id ? apiService.getMonthlySummary(func.id, year, month) : Promise.resolve(null),
      func?.id ? apiService.getDailyRegistros(func.id, inicio, fim) : Promise.resolve([]),
    ])
      .then(([recs, sum, daily]) => { setRecords(recs); setSummary(sum); setDailySummaries(daily); })
      .catch(() => { setRecords([]); setSummary(null); setDailySummaries([]); })
      .finally(() => setLoading(false));
  }, [year, month, func?.id]);

  useEffect(() => { fetchData(); }, [fetchData]);

  const prevMonth = () => { if (month === 1) { setYear(y => y - 1); setMonth(12); } else setMonth(m => m - 1); };
  const nextMonth = () => {
    if (year < now.getFullYear() || (year === now.getFullYear() && month < now.getMonth() + 1)) {
      if (month === 12) { setYear(y => y + 1); setMonth(1); } else setMonth(m => m + 1);
    }
  };

  const todayRecords = isCurrentMonth ? records.filter(r => r.data_hora?.startsWith(today)) : [];
  const lastRecord = todayRecords[todayRecords.length - 1];

  const dayStatus = todayRecords.length > 0
    ? (todayRecords.some(r => r.tipo === 'entrada') && !todayRecords.some(r => r.tipo === 'saida') ? 'incompleto' : 'presente')
    : 'ausente';
  const dayBadge = dayStatus === 'presente'
    ? { v: 'success' as const, label: 'Presente' }
    : dayStatus === 'incompleto'
    ? { v: 'warning' as const, label: 'Em andamento' }
    : { v: 'neutral' as const, label: 'Sem registro' };

  // Use daily summaries as primary source (same as front principal)
  const todayStr = new Date().toISOString().slice(0, 10);
  const dailyUpToToday = dailySummaries.filter(s => s.data <= todayStr);
  const totalHorasMin = dailyUpToToday.reduce((acc, s) => acc + (s.horas_trabalhadas_min ?? 0), 0);
  const totalHoras = totalHorasMin / 60;
  const horasExtras = (summary?.total_horas_extras ?? 0);
  const diasTrabalhados = summary?.dias_trabalhados
    ?? dailyUpToToday.filter(s => (s.horas_trabalhadas_min ?? 0) > 0).length;
  const faltas = summary?.faltas ?? 0;
  // banco_horas: sum of banco_horas_dia from daily summaries
  const bancoHorasMin = dailyUpToToday.reduce((acc, s) => acc + (s.banco_horas_dia ?? 0), 0);
  const bancoHoras = bancoHorasMin / 60;

  // Use backend-calculated horas_previstas from daily summaries (not workdays * 8)
  const expectedTotalHours = dailySummaries.reduce((acc, s) => acc + (s.horas_previstas_min ?? 0), 0) / 60;
  const progressPct = expectedTotalHours > 0 ? Math.min(100, Math.round((totalHoras / expectedTotalHours) * 100)) : 0;

  const initials = func?.nome?.split(' ').map(n => n[0]).slice(0, 2).join('').toUpperCase() ?? '?';

  return (
    <div className="min-h-screen bg-slate-950 flex flex-col">
      {/* ── Header ──────────────────────────────────────────────────────────── */}
      <div className="bg-slate-900 border-b border-slate-800 px-5 pt-10 pb-5">
        <div className="flex items-start gap-4 mb-4">
          {/* Avatar */}
          <div className="w-14 h-14 rounded-2xl bg-gradient-to-br from-blue-600 to-blue-800 flex items-center justify-center flex-shrink-0 shadow-lg">
            <span className="text-white font-black text-lg">{initials}</span>
          </div>
          <div className="flex-1 min-w-0">
            <p className="text-slate-400 text-sm">Olá,</p>
            <h1 className="text-2xl font-black text-slate-50 leading-tight truncate">{func?.nome ?? 'Funcionário'}</h1>
            {func?.cargo && <p className="text-slate-500 text-sm mt-0.5">{func.cargo}</p>}
          </div>
          <div className="flex flex-col items-end gap-2 flex-shrink-0">
            {isCurrentMonth && <Badge variant={dayBadge.v} dot>{dayBadge.label}</Badge>}
            <button
              onClick={() => { signOut(); navigate('/'); }}
              className="p-2 text-slate-500 hover:text-rose-400 transition-colors rounded-xl hover:bg-rose-500/10"
            >
              <svg className="w-5 h-5" fill="none" stroke="currentColor" viewBox="0 0 24 24">
                <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M17 16l4-4m0 0l-4-4m4 4H7m6 4v1a3 3 0 01-3 3H6a3 3 0 01-3-3V7a3 3 0 013-3h4a3 3 0 013 3v1" />
              </svg>
            </button>
          </div>
        </div>

        {/* Month picker */}
        <div className="flex items-center justify-between bg-slate-800 rounded-2xl p-1.5">
          <button onClick={prevMonth} className="p-2.5 text-slate-400 hover:text-slate-200 transition-colors rounded-xl hover:bg-slate-700">
            <svg className="w-5 h-5" fill="none" stroke="currentColor" viewBox="0 0 24 24"><path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M15 19l-7-7 7-7" /></svg>
          </button>
          <div className="text-center">
            <span className="text-slate-100 font-bold text-base">{MONTHS[month - 1]} {year}</span>
            {isCurrentMonth && <span className="ml-2 text-xs text-blue-400 bg-blue-400/10 px-2 py-0.5 rounded-full">atual</span>}
          </div>
          <button
            onClick={nextMonth}
            className={`p-2.5 rounded-xl transition-colors ${isCurrentMonth ? 'text-slate-700 cursor-not-allowed' : 'text-slate-400 hover:text-slate-200 hover:bg-slate-700'}`}
          >
            <svg className="w-5 h-5" fill="none" stroke="currentColor" viewBox="0 0 24 24"><path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M9 5l7 7-7 7" /></svg>
          </button>
        </div>
      </div>

      {/* ── Content ────────────────────────────────────────────────────────── */}
      <div className="flex-1 overflow-y-auto px-5 py-6 space-y-5 pb-28">
        {loading ? (
          <div className="space-y-4">
            <Skeleton height="140px" />
            <div className="grid grid-cols-2 gap-4">
              {[...Array(4)].map((_, i) => <Skeleton key={i} height="100px" />)}
            </div>
          </div>
        ) : (
          <motion.div initial={{ opacity: 0, y: 12 }} animate={{ opacity: 1, y: 0 }} transition={{ duration: 0.3 }} className="space-y-5">

            {/* ── Hero: Horas do Mês ───────────────────────────────────────── */}
            <div className="bg-slate-900 border border-slate-800 rounded-2xl p-5">
              <div className="flex items-center justify-between mb-4">
                <p className="text-sm font-semibold text-slate-400 uppercase tracking-wider">Horas do Mês</p>
                <span className="text-sm text-slate-500 font-medium">{progressPct}%</span>
              </div>
              <div className="flex items-end justify-between mb-3">
                <div>
                  <p className="text-4xl font-black text-slate-50">{formatHours(totalHoras)}</p>
                  <p className="text-sm text-slate-500 mt-1">trabalhadas</p>
                </div>
                <div className="text-right">
                  <p className="text-2xl font-bold text-slate-400">{formatHours(expectedTotalHours)}</p>
                  <p className="text-sm text-slate-500 mt-1">previstas</p>
                </div>
              </div>
              <div className="h-3 bg-slate-800 rounded-full overflow-hidden">
                <div
                  className={`h-full rounded-full transition-all duration-700 ${progressPct >= 100 ? 'bg-emerald-500' : progressPct >= 75 ? 'bg-blue-500' : progressPct >= 50 ? 'bg-amber-500' : 'bg-rose-500'}`}
                  style={{ width: `${progressPct}%` }}
                />
              </div>
              <p className="text-xs text-slate-600 mt-2">{Math.round(expectedTotalHours / 8)} dias úteis no mês</p>
            </div>

            {/* ── Stats Grid ───────────────────────────────────────────────── */}
            <div className="grid grid-cols-2 gap-4">
              {/* Dias trabalhados */}
              <div className="bg-slate-900 border border-slate-800 rounded-2xl p-5">
                <div className="flex items-center gap-2 mb-3">
                  <div className="w-8 h-8 bg-blue-500/15 rounded-xl flex items-center justify-center">
                    <svg className="w-4 h-4 text-blue-400" fill="none" stroke="currentColor" viewBox="0 0 24 24">
                      <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M8 7V3m8 4V3m-9 8h10M5 21h14a2 2 0 002-2V7a2 2 0 00-2-2H5a2 2 0 00-2 2v12a2 2 0 002 2z" />
                    </svg>
                  </div>
                  <p className="text-sm text-slate-500 font-medium">Dias</p>
                </div>
                <p className="text-3xl font-black text-slate-100">{diasTrabalhados}</p>
                <p className="text-sm text-slate-500 mt-1">trabalhados</p>
              </div>

              {/* Faltas */}
              <div className="bg-slate-900 border border-slate-800 rounded-2xl p-5">
                <div className="flex items-center gap-2 mb-3">
                  <div className={`w-8 h-8 rounded-xl flex items-center justify-center ${faltas > 0 ? 'bg-rose-500/15' : 'bg-emerald-500/15'}`}>
                    <svg className={`w-4 h-4 ${faltas > 0 ? 'text-rose-400' : 'text-emerald-400'}`} fill="none" stroke="currentColor" viewBox="0 0 24 24">
                      <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d={faltas > 0 ? 'M10 14l2-2m0 0l2-2m-2 2l-2-2m2 2l2 2m7-2a9 9 0 11-18 0 9 9 0 0118 0z' : 'M9 12l2 2 4-4m6 2a9 9 0 11-18 0 9 9 0 0118 0z'} />
                    </svg>
                  </div>
                  <p className="text-sm text-slate-500 font-medium">Faltas</p>
                </div>
                <p className={`text-3xl font-black ${faltas > 0 ? 'text-rose-400' : 'text-emerald-400'}`}>{faltas}</p>
                <p className="text-sm text-slate-500 mt-1">no período</p>
              </div>

              {/* Banco de horas */}
              <div className="bg-slate-900 border border-slate-800 rounded-2xl p-5">
                <div className="flex items-center gap-2 mb-3">
                  <div className={`w-8 h-8 rounded-xl flex items-center justify-center ${bancoHoras >= 0 ? 'bg-emerald-500/15' : 'bg-amber-500/15'}`}>
                    <svg className={`w-4 h-4 ${bancoHoras >= 0 ? 'text-emerald-400' : 'text-amber-400'}`} fill="none" stroke="currentColor" viewBox="0 0 24 24">
                      <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M9 19v-6a2 2 0 00-2-2H5a2 2 0 00-2 2v6a2 2 0 002 2h2a2 2 0 002-2zm0 0V9a2 2 0 012-2h2a2 2 0 012 2v10m-6 0a2 2 0 002 2h2a2 2 0 002-2m0 0V5a2 2 0 012-2h2a2 2 0 012 2v14a2 2 0 01-2 2h-2a2 2 0 01-2-2z" />
                    </svg>
                  </div>
                  <p className="text-sm text-slate-500 font-medium">Banco</p>
                </div>
                <p className={`text-2xl font-black ${bancoHoras >= 0 ? 'text-emerald-400' : 'text-amber-400'}`}>
                  {bancoHoras >= 0 ? '+' : ''}{formatHours(Math.abs(bancoHoras))}
                </p>
                <p className="text-sm text-slate-500 mt-1">{bancoHoras >= 0 ? 'crédito' : 'débito'}</p>
              </div>

              {/* Horas extras / último registro */}
              {isCurrentMonth ? (
                <div className="bg-slate-900 border border-slate-800 rounded-2xl p-5">
                  <div className="flex items-center gap-2 mb-3">
                    <div className="w-8 h-8 bg-violet-500/15 rounded-xl flex items-center justify-center">
                      <svg className="w-4 h-4 text-violet-400" fill="none" stroke="currentColor" viewBox="0 0 24 24">
                        <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M12 8v4l3 3m6-3a9 9 0 11-18 0 9 9 0 0118 0z" />
                      </svg>
                    </div>
                    <p className="text-sm text-slate-500 font-medium">Último</p>
                  </div>
                  <p className="text-2xl font-black text-slate-100">{lastRecord ? formatTime(lastRecord.data_hora) : '--:--'}</p>
                  <p className="text-sm text-slate-500 mt-1">{lastRecord ? getTipoLabel(lastRecord.tipo) : 'Sem registro'}</p>
                </div>
              ) : (
                <div className="bg-slate-900 border border-slate-800 rounded-2xl p-5">
                  <div className="flex items-center gap-2 mb-3">
                    <div className="w-8 h-8 bg-violet-500/15 rounded-xl flex items-center justify-center">
                      <svg className="w-4 h-4 text-violet-400" fill="none" stroke="currentColor" viewBox="0 0 24 24">
                        <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M13 10V3L4 14h7v7l9-11h-7z" />
                      </svg>
                    </div>
                    <p className="text-sm text-slate-500 font-medium">Extras</p>
                  </div>
                  <p className="text-2xl font-black text-violet-400">{formatHours(horasExtras)}</p>
                  <p className="text-sm text-slate-500 mt-1">horas extras</p>
                </div>
              )}
            </div>

            {/* ── Registros de Hoje ───────────────────────────────────────── */}
            {isCurrentMonth && (
              <div>
                <p className="text-sm font-semibold text-slate-500 uppercase tracking-wider mb-3">Hoje</p>
                <div className="bg-slate-900 border border-slate-800 rounded-2xl overflow-hidden">
                  {todayRecords.length === 0 ? (
                    <div className="px-5 py-8 text-center">
                      <div className="w-12 h-12 bg-slate-800 rounded-full flex items-center justify-center mx-auto mb-3">
                        <svg className="w-6 h-6 text-slate-600" fill="none" stroke="currentColor" viewBox="0 0 24 24">
                          <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M12 8v4l3 3m6-3a9 9 0 11-18 0 9 9 0 0118 0z" />
                        </svg>
                      </div>
                      <p className="text-slate-500 text-base">Nenhum registro hoje</p>
                    </div>
                  ) : (
                    <div className="divide-y divide-slate-800">
                      {todayRecords.map((r, i) => (
                        <div key={i} className="flex items-center gap-4 px-5 py-4">
                          <div className={`w-2.5 h-2.5 rounded-full flex-shrink-0 ${getTipoDot(r.tipo)}`} />
                          <div className="flex-1">
                            <p className="text-base font-semibold text-slate-200">{getTipoLabel(r.tipo)}</p>
                            {r.editado && <p className="text-xs text-amber-400 mt-0.5">Editado manualmente</p>}
                          </div>
                          <span className="text-base font-mono text-slate-300 font-semibold">{formatTime(r.data_hora)}</span>
                        </div>
                      ))}
                    </div>
                  )}
                </div>
              </div>
            )}

            {/* ── Link para Espelho ───────────────────────────────────────── */}
            <button
              onClick={() => navigate('/funcionario/espelho')}
              className="w-full flex items-center justify-between bg-slate-900 border border-slate-700 rounded-2xl px-5 py-4 hover:border-blue-600/50 hover:bg-slate-800 transition-all group"
            >
              <div className="flex items-center gap-4">
                <div className="w-10 h-10 bg-blue-500/15 rounded-xl flex items-center justify-center group-hover:bg-blue-500/20 transition-colors">
                  <svg className="w-5 h-5 text-blue-400" fill="none" stroke="currentColor" viewBox="0 0 24 24">
                    <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M9 5H7a2 2 0 00-2 2v12a2 2 0 002 2h10a2 2 0 002-2V7a2 2 0 00-2-2h-2M9 5a2 2 0 002 2h2a2 2 0 002-2M9 5a2 2 0 012-2h2a2 2 0 012 2" />
                  </svg>
                </div>
                <div className="text-left">
                  <p className="text-base font-bold text-slate-200">Espelho de Ponto</p>
                  <p className="text-sm text-slate-500 mt-0.5">Ver todos os registros e exportar PDF</p>
                </div>
              </div>
              <svg className="w-5 h-5 text-slate-600 group-hover:text-slate-400 transition-colors" fill="none" stroke="currentColor" viewBox="0 0 24 24">
                <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M9 5l7 7-7 7" />
              </svg>
            </button>
          </motion.div>
        )}
      </div>

      {/* ── Bottom Nav ──────────────────────────────────────────────────────── */}
      <div className="fixed bottom-0 left-0 right-0 bg-slate-900/95 backdrop-blur-sm border-t border-slate-800 flex safe-bottom">
        {[
          {
            path: '/funcionario',
            label: 'Início',
            icon: <svg className="w-6 h-6" fill="none" stroke="currentColor" viewBox="0 0 24 24"><path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M3 12l2-2m0 0l7-7 7 7M5 10v10a1 1 0 001 1h3m10-11l2 2m-2-2v10a1 1 0 01-1 1h-3m-6 0a1 1 0 001-1v-4a1 1 0 011-1h2a1 1 0 011 1v4a1 1 0 001 1m-6 0h6" /></svg>,
          },
          {
            path: '/funcionario/espelho',
            label: 'Espelho',
            icon: <svg className="w-6 h-6" fill="none" stroke="currentColor" viewBox="0 0 24 24"><path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M9 5H7a2 2 0 00-2 2v12a2 2 0 002 2h10a2 2 0 002-2V7a2 2 0 00-2-2h-2M9 5a2 2 0 002 2h2a2 2 0 002-2M9 5a2 2 0 012-2h2a2 2 0 012 2" /></svg>,
          },
          {
            path: '/funcionario/configuracoes',
            label: 'Config',
            icon: <svg className="w-6 h-6" fill="none" stroke="currentColor" viewBox="0 0 24 24"><path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M10.325 4.317c.426-1.756 2.924-1.756 3.35 0a1.724 1.724 0 002.573 1.066c1.543-.94 3.31.826 2.37 2.37a1.724 1.724 0 001.065 2.572c1.756.426 1.756 2.924 0 3.35a1.724 1.724 0 00-1.066 2.573c.94 1.543-.826 3.31-2.37 2.37a1.724 1.724 0 00-2.572 1.065c-.426 1.756-2.924 1.756-3.35 0a1.724 1.724 0 00-2.573-1.066c-1.543.94-3.31-.826-2.37-2.37a1.724 1.724 0 00-1.065-2.572c-1.756-.426-1.756-2.924 0-3.35a1.724 1.724 0 001.066-2.573c-.94-1.543.826-3.31 2.37-2.37.996.608 2.296.07 2.572-1.065z" /><path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M15 12a3 3 0 11-6 0 3 3 0 016 0z" /></svg>,
          },
        ].map(({ path, label, icon }) => {
          const active = location.pathname === path;
          return (
            <button
              key={path}
              onClick={() => navigate(path)}
              className={`flex-1 flex flex-col items-center gap-1 py-4 transition-colors ${active ? 'text-blue-400' : 'text-slate-500 hover:text-slate-300'}`}
            >
              {icon}
              <span className="text-xs font-medium">{label}</span>
            </button>
          );
        })}
      </div>
    </div>
  );
}
