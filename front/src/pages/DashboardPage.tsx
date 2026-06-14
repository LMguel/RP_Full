import React, { useState, useEffect, useCallback, useRef } from 'react';
import { apiService } from '../services/api';
import {
  Box, Card, CardContent, Typography, Alert,
  Table, TableBody, TableCell, TableContainer, TableHead, TableRow,
  Avatar, Chip, CircularProgress, Tooltip, IconButton, Divider, LinearProgress,
} from '@mui/material';
import {
  Refresh as RefreshIcon,
  CheckCircle as CheckIcon,
  Cancel as AbsentIcon,
  Warning as WarningIcon,
  AccessTime as ClockIcon,
  BuildCircle as BuildCircleIcon,
} from '@mui/icons-material';
import { motion } from 'framer-motion';
import { useNavigate } from 'react-router-dom';
import PageLayout from '../sections/PageLayout';
import { useCorrecoesCtx } from '../contexts/CorrecoesContext';
import PendenciasAlertModal from '../components/PendenciasAlertModal';
import { getDailySummaries } from '../services/dailySummaryService';

interface PresentEmployee {
  name: string;
  statusKey: string;
  statusLabel: string;
  photoUrl: string;
  entryTime: string;
  method: string;
}

interface RecentRecord {
  employeeName: string;
  employeeId?: string;
  recordType: string;
  time: string;
  statusKey: string;
  method: string;
  atraso_minutos?: number;
  horas_extras_minutos?: number;
}

interface TopEmployee {
  name: string;
  total_hours: number;
  worked_hours: number;
  extra_hours: number;
  employee_id: string;
}

interface DashboardData {
  presentEmployees: number;
  totalEmployees: number;
  hoursMonth: number;
  alerts: any[];
  recentRecords: RecentRecord[];
  employeesPresent: PresentEmployee[];
  topEmployee: TopEmployee | null;
}

const normalizeStatusKey = (status: any): string => {
  if (!status && status !== 0) return 'normal';
  return String(status).trim().toLowerCase()
    .normalize('NFD').replace(/[^a-z0-9]/gi, '_')
    .replace(/_+/g, '_').replace(/^_|_$/g, '') || 'normal';
};

const formatTime = (value: string): string => {
  if (!value) return '--:--';
  const t = value.trim();
  if (t.includes('T')) {
    const p = new Date(t);
    if (!Number.isNaN(p.getTime())) return p.toLocaleTimeString('pt-BR', { hour: '2-digit', minute: '2-digit' });
  }
  return t.slice(0, 5);
};

const fmtHBalance = (h: number): string => {
  const sign = h >= 0 ? '+' : '-';
  const abs = Math.abs(h);
  const hh = Math.floor(abs);
  const mm = Math.round((abs - hh) * 60);
  if (hh === 0) return `${sign}${mm}min`;
  return `${sign}${hh}h${mm > 0 ? `${mm}m` : ''}`;
};

const fadeUp = { initial: { opacity: 0, y: 14 }, animate: { opacity: 1, y: 0 }, transition: { duration: 0.32 } };

const CORRECTIONS_CACHE_KEY = '@rp:corrections_dash';
const CORRECTIONS_TTL = 5 * 60 * 1000;

function loadCorrectionsCache(): any[] | null {
  try {
    const raw = sessionStorage.getItem(CORRECTIONS_CACHE_KEY);
    if (!raw) return null;
    const { ts, list } = JSON.parse(raw);
    if (Date.now() - ts > CORRECTIONS_TTL) return null;
    return list;
  } catch { return null; }
}

function saveCorrectionsCache(list: any[]) {
  try {
    sessionStorage.setItem(CORRECTIONS_CACHE_KEY, JSON.stringify({ ts: Date.now(), list }));
  } catch {}
}

const DashboardPage = () => {
  const [data, setData] = useState<DashboardData | null>(null);
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState<string | null>(null);
  const isLoadingRef = useRef(false);
  const navigate = useNavigate();
  const { totalPendencias, resumo: resumoCorreções, setCorrecoesData, modalDismissed, setModalDismissed } = useCorrecoesCtx();
  const correctionsChecked = useRef(false);

  const ensureLoggedIn = useCallback(() => !!localStorage.getItem('token'), []);

  const loadDashboardData = useCallback(async () => {
    if (isLoadingRef.current) return;
    try {
      setLoading(true);
      isLoadingRef.current = true;
      setError(null);
      if (!ensureLoggedIn()) throw new Error('Sessão expirada. Por favor, faça login novamente.');

      // 2 chamadas em vez de 7: snapshot consolida tudo que o dashboard precisa
      const [empResult, snapResult] = await Promise.allSettled([
        apiService.get('/api/funcionarios'),
        apiService.get('/api/dashboard/snapshot'),
      ]);

      const safe = (r: any) => r.status === 'fulfilled' && r.value ? (r.value.data ?? r.value) : null;
      const safeArr = (v: any): any[] => {
        if (Array.isArray(v)) return v;
        if (v?.items && Array.isArray(v.items)) return v.items;
        if (v?.data && Array.isArray(v.data)) return v.data;
        return [];
      };

      const allEmp  = safe(empResult)  || {};
      const snap    = safe(snapResult) || {};

      const empList     = safeArr(allEmp.funcionarios || allEmp);
      const presentData = snap.present || {};
      const lastFive    = safeArr(snap.lastFive);
      const empPresent  = safeArr(snap.employeesPresent);

      const recentRecords: RecentRecord[] = lastFive.map((r: any) => ({
        employeeName: r.nome || r.employee_name || 'N/A',
        employeeId: r.funcionario_id || r.employee_id,
        recordType: r.tipo || r.type || 'entrada',
        time: r.hora || r.timestamp || '',
        statusKey: normalizeStatusKey(r.status_key ?? r.status),
        method: r.metodo || r.method || 'manual',
        atraso_minutos: r.atraso_minutos || 0,
        horas_extras_minutos: r.horas_extras_minutos || 0,
      }));

      const employeesPresent: PresentEmployee[] = empPresent.map((e: any) => ({
        name: e.nome || 'N/A',
        statusKey: normalizeStatusKey(e.status_key ?? e.entry_status ?? e.status),
        statusLabel: e.status_label || e.entry_status_label || e.status_key || 'Presente',
        photoUrl: e.foto || '',
        entryTime: e.hora_entrada || e.entry_time || '',
        method: e.metodo || e.method || 'manual',
      }));

      setData({
        presentEmployees: (presentData as any).presentEmployeesCount ?? empPresent.length,
        totalEmployees: (presentData as any).totalEmployees ?? empList.length,
        hoursMonth: snap.hoursMonth ?? 0,
        alerts: safeArr(snap.alerts),
        recentRecords,
        employeesPresent,
        topEmployee: snap.topEmployee || null,
      });
    } catch (err) {
      setError(err instanceof Error ? err.message : 'Erro desconhecido');
      setData(null);
    } finally {
      setLoading(false);
      isLoadingRef.current = false;
    }
  }, [ensureLoggedIn]);

  useEffect(() => { loadDashboardData(); }, [loadDashboardData]);

  // Busca pendências em background (uma vez por sessão, com cache de 5 min)
  useEffect(() => {
    if (correctionsChecked.current) return;
    correctionsChecked.current = true;

    const STATUS_PROBLEMA = new Set(['INCOMPLETO', 'FALTA', 'ATRASO', 'MISSING_EXIT', 'INCOMPLETE', 'ABSENT', 'LATE']);
    const normSt = (s: any) => String((s as any).raw?.status ?? s.status ?? '').toUpperCase().replace(/-/g, '_');

    const applyProblemas = (problemas: any[]) => {
      setCorrecoesData(problemas.length, {
        total: problemas.length,
        saida_nao_registrada:  problemas.filter(s => normSt(s) === 'MISSING_EXIT').length,
        intervalo_incompleto:  problemas.filter(s => ['INCOMPLETO', 'INCOMPLETE'].includes(normSt(s))).length,
        sem_registros:         problemas.filter(s => ['FALTA', 'ABSENT'].includes(normSt(s))).length,
        registros_excedentes:  0,
        quantidade_incorreta:  problemas.filter(s => ['ATRASO', 'LATE'].includes(normSt(s))).length,
        proximos:              problemas.filter(s => (s as any).registros_proximos === true).length,
      });
    };

    const cached = loadCorrectionsCache();
    if (cached) {
      applyProblemas(cached);
      return;
    }

    const now = new Date();
    const year = now.getFullYear();
    const month = now.getMonth() + 1;
    const today = `${year}-${String(month).padStart(2, '0')}-${String(now.getDate()).padStart(2, '0')}`;
    const inicio = `${year}-${String(month).padStart(2, '0')}-01`;
    const ontem  = new Date(now.getTime() - 86_400_000).toISOString().slice(0, 10);

    getDailySummaries({ start_date: inicio, end_date: ontem }, 1, 1000)
      .then(res => {
        const seen = new Set<string>();
        const problemas = (res?.summaries ?? []).filter(s => {
          const date = s.date || (s as any).data || '';
          if (date >= today) return false;
          const st = normSt(s);
          const isProximos = (s as any).registros_proximos === true;
          if (!STATUS_PROBLEMA.has(st) && !isProximos) return false;
          const key = `${s.employee_id}|${date}`;
          if (seen.has(key)) return false;
          seen.add(key);
          return true;
        });
        saveCorrectionsCache(problemas);
        applyProblemas(problemas);
      })
      .catch(() => {});
  }, []); // eslint-disable-line react-hooks/exhaustive-deps

  const todayStr = new Date().toLocaleDateString('pt-BR', { weekday: 'long', day: 'numeric', month: 'long' });

  if (error) {
    return (
      <Box sx={{ p: 2 }}>
        <Alert severity="error" sx={{ borderRadius: 2 }}
          action={<IconButton size="small" onClick={loadDashboardData} sx={{ color: 'inherit' }}><RefreshIcon /></IconButton>}>
          {error}
        </Alert>
      </Box>
    );
  }

  const absentes = data ? data.totalEmployees - data.presentEmployees : 0;
  const presencePercent = data && data.totalEmployees > 0 ? Math.round((data.presentEmployees / data.totalEmployees) * 100) : 0;
  const accentColor = presencePercent >= 80 ? '#10b981' : '#f59e0b';
  const visibleAlerts = data ? data.alerts.filter((a: any) => a.type !== 'atraso') : [];
  const showModal = totalPendencias > 0 && resumoCorreções !== null && !modalDismissed && !loading;

  const topFirstName = data?.topEmployee?.name.split(' ')[0] ?? null;
  const topTotal     = data?.topEmployee?.total_hours ?? 0;
  const topExtra     = data?.topEmployee?.extra_hours ?? 0;

  return (
    <PageLayout>
      {resumoCorreções && (
        <PendenciasAlertModal open={showModal} resumo={resumoCorreções} onClose={() => setModalDismissed(true)} />
      )}

      <Box sx={{ display: 'flex', flexDirection: 'column', gap: 1.5, height: { xs: 'auto', md: 'calc(100vh - 120px)' } }}>

        {/* ── Header ── */}
        <motion.div {...fadeUp} style={{ flexShrink: 0 }}>
          <Box sx={{ display: 'flex', justifyContent: 'space-between', alignItems: 'center' }}>
            <Box>
              <Typography sx={{ color: 'rgba(255,255,255,0.4)', fontSize: 11, fontWeight: 600, letterSpacing: '0.09em', textTransform: 'uppercase', mb: 0.35 }}>
                {todayStr}
              </Typography>
              <Typography variant="h4" sx={{ fontWeight: 800, color: 'white', lineHeight: 1.1, letterSpacing: '-0.02em' }}>
                Visão Geral
              </Typography>
            </Box>
            <Tooltip title="Atualizar">
              <IconButton onClick={loadDashboardData} size="small"
                sx={{ color: 'rgba(255,255,255,0.5)', border: '1px solid rgba(255,255,255,0.12)', borderRadius: '9px', p: 0.75, '&:hover': { color: 'white', borderColor: 'rgba(255,255,255,0.28)', bgcolor: 'rgba(255,255,255,0.06)' } }}>
                <RefreshIcon sx={{ fontSize: 18 }} />
              </IconButton>
            </Tooltip>
          </Box>
        </motion.div>

        {/* ── 4 metric cards ── */}
        <Box sx={{ flexShrink: 0, display: 'grid', gridTemplateColumns: { xs: '1fr 1fr', md: 'repeat(4, 1fr)' }, gap: 1.5 }}>
          {[
            { label: 'Presentes',     value: loading ? '—' : `${data!.presentEmployees}`, suffix: loading ? '' : `/${data!.totalEmployees}`, sub: loading ? 'carregando…' : `${presencePercent}% hoje`, icon: <CheckIcon  sx={{ fontSize: 16 }} />, color: accentColor,  clickable: false },
            { label: 'Ausências',     value: loading ? '—' : String(absentes),            suffix: '',                                          sub: loading ? 'carregando…' : absentes === 0 ? 'Sem faltas' : 'sem registro', icon: <AbsentIcon sx={{ fontSize: 16 }} />, color: loading ? '#64748b' : absentes === 0 ? '#10b981' : '#ef4444', clickable: false },
            { label: 'Horas / mês',   value: loading ? '—' : `${data!.hoursMonth}h`,      suffix: '',                                          sub: loading ? 'carregando…' : 'total trabalhado', icon: <ClockIcon  sx={{ fontSize: 16 }} />, color: '#3b82f6',    clickable: false },
            {
              label: 'Destaque do Mês',
              value: loading ? '—' : topFirstName ? `${topTotal}h` : '—',
              suffix: '',
              sub: loading ? 'carregando…' : topFirstName ? `${topFirstName}${topExtra > 0 ? ` · +${topExtra}h extras` : ''}` : 'sem dados',
              icon: <Typography component="span" sx={{ fontSize: 14, lineHeight: 1, display: 'flex' }}>👑</Typography>,
              color: '#fbbf24',
              clickable: !loading && !!topFirstName,
              onClick: () => data?.topEmployee?.employee_id && navigate(`/records/employee/${data.topEmployee!.employee_id}/${data.topEmployee!.name}`),
            },
          ].map((card, i) => (
            <motion.div key={card.label} initial={{ opacity: 0, y: 10 }} animate={{ opacity: 1, y: 0 }} transition={{ duration: 0.26, delay: i * 0.05 }}>
              <Card
                sx={{ cursor: card.clickable ? 'pointer' : 'default', '&:hover': card.clickable ? { opacity: 0.88 } : {} }}
                onClick={'onClick' in card ? card.onClick : undefined}
              >
                <CardContent sx={{ p: '12px !important' }}>
                  <Box sx={{ display: 'flex', alignItems: 'center', gap: 0.75, mb: 0.75 }}>
                    <Box sx={{ p: 0.5, borderRadius: 1.25, bgcolor: card.color + '1f', color: card.color, display: 'flex' }}>{card.icon}</Box>
                    <Typography sx={{ fontSize: 9.5, fontWeight: 700, color: 'rgba(255,255,255,0.36)', textTransform: 'uppercase', letterSpacing: '0.08em' }}>{card.label}</Typography>
                  </Box>
                  <Box sx={{ display: 'flex', alignItems: 'baseline', gap: 0.25, mb: 0.15 }}>
                    <Typography sx={{ fontSize: 22, fontWeight: 800, color: 'white', lineHeight: 1 }}>{card.value}</Typography>
                    {card.suffix && <Typography sx={{ fontSize: 12, fontWeight: 500, color: 'rgba(255,255,255,0.3)' }}>{card.suffix}</Typography>}
                  </Box>
                  <Typography sx={{ fontSize: 10.5, color: card.color, opacity: 0.9 }}>{card.sub}</Typography>
                </CardContent>
              </Card>
            </motion.div>
          ))}
        </Box>

        {/* ── Banner de pendências (compacto) ── */}
        {totalPendencias > 0 && (
          <motion.div initial={{ opacity: 0, y: 4 }} animate={{ opacity: 1, y: 0 }} transition={{ duration: 0.22, delay: 0.18 }} style={{ flexShrink: 0 }}>
            <Card
              onClick={() => navigate('/correcoes')}
              sx={{
                cursor: 'pointer',
                background: 'linear-gradient(90deg, rgba(245,158,11,0.1) 0%, rgba(245,158,11,0.03) 100%)',
                border: '1px solid rgba(245,158,11,0.22)',
                '&:hover': { border: '1px solid rgba(245,158,11,0.42)', background: 'linear-gradient(90deg, rgba(245,158,11,0.16) 0%, rgba(245,158,11,0.06) 100%)' },
              }}
            >
              <CardContent sx={{ p: '9px 14px !important', display: 'flex', alignItems: 'center', gap: 1.25 }}>
                <Box sx={{ p: 0.55, borderRadius: 1.25, bgcolor: 'rgba(245,158,11,0.16)', color: '#fbbf24', display: 'flex', flexShrink: 0 }}>
                  <BuildCircleIcon sx={{ fontSize: 16 }} />
                </Box>
                <Typography sx={{ fontSize: 12.5, fontWeight: 700, color: '#fbbf24', flex: 1 }}>
                  {totalPendencias} {totalPendencias === 1 ? 'pendência' : 'pendências'} de ponto encontradas
                </Typography>
                <Typography sx={{ fontSize: 11, color: '#f59e0b', fontWeight: 600, whiteSpace: 'nowrap' }}>
                  Ver Correções →
                </Typography>
              </CardContent>
            </Card>
          </motion.div>
        )}

        {/* ── Seção principal: tabela (esq) + presença/alertas (dir) ── */}
        <Box sx={{ flex: 1, minHeight: 0, display: 'grid', gridTemplateColumns: { xs: '1fr', lg: '3fr 2fr' }, gap: 1.5 }}>

          {/* Últimos registros */}
          <motion.div initial={{ opacity: 0, y: 10 }} animate={{ opacity: 1, y: 0 }} transition={{ duration: 0.28, delay: 0.2 }}
            style={{ height: '100%', display: 'flex', flexDirection: 'column', minHeight: 0 }}>
            <Card sx={{ flex: 1, display: 'flex', flexDirection: 'column', overflow: 'hidden', minHeight: 0 }}>
              <CardContent sx={{ flex: 1, display: 'flex', flexDirection: 'column', overflow: 'hidden', minHeight: 0, p: '12px !important' }}>
                <Box sx={{ flexShrink: 0, display: 'flex', justifyContent: 'space-between', alignItems: 'center', mb: 0.75 }}>
                  <Typography sx={{ fontWeight: 700, color: 'white', fontSize: 13 }}>Últimos Registros</Typography>
                  <Chip label="Ver todos →" onClick={() => navigate('/records')} size="small"
                    sx={{ bgcolor: 'rgba(59,130,246,0.12)', border: '1px solid rgba(59,130,246,0.2)', color: '#93c5fd', fontSize: 10.5, height: 20, cursor: 'pointer', '&:hover': { bgcolor: 'rgba(59,130,246,0.2)' } }} />
                </Box>
                <Divider sx={{ flexShrink: 0, mb: 0.5 }} />
                {loading ? (
                  <Box sx={{ flex: 1, display: 'flex', alignItems: 'center', justifyContent: 'center', gap: 1.5 }}>
                    <CircularProgress size={20} sx={{ color: 'rgba(255,255,255,0.25)' }} />
                    <Typography sx={{ fontSize: 12, color: 'rgba(255,255,255,0.25)' }}>Carregando registros…</Typography>
                  </Box>
                ) : !data || data.recentRecords.length === 0 ? (
                  <Box sx={{ flex: 1, display: 'flex', alignItems: 'center', justifyContent: 'center' }}>
                    <Typography sx={{ fontSize: 13, color: 'rgba(255,255,255,0.28)', fontStyle: 'italic' }}>Nenhum registro hoje</Typography>
                  </Box>
                ) : (
                  <TableContainer sx={{ flex: 1, overflow: 'auto', bgcolor: 'transparent' }}>
                    <Table size="small" stickyHeader>
                      <TableHead>
                        <TableRow>
                          {['Funcionário', 'Tipo', 'Horário', 'Status'].map(h => (
                            <TableCell key={h} sx={{ bgcolor: 'rgba(10,22,66,0.9)', py: 0.75, fontSize: 11.5 }}>{h}</TableCell>
                          ))}
                        </TableRow>
                      </TableHead>
                      <TableBody>
                        {data.recentRecords.map((rec, i) => {
                          const isEntrada = rec.recordType === 'entrada';
                          const hasDelay  = (rec.atraso_minutos || 0) > 0;
                          const hasExtra  = (rec.horas_extras_minutos || 0) > 0;
                          return (
                            <TableRow key={i} hover sx={{ cursor: rec.employeeId ? 'pointer' : 'default' }}
                              onClick={() => rec.employeeId && navigate(`/records/employee/${rec.employeeId}/${rec.employeeName}`)}>
                              <TableCell sx={{ py: 0.6 }}>
                                <Box sx={{ display: 'flex', alignItems: 'center', gap: 1 }}>
                                  <Avatar sx={{ width: 24, height: 24, background: 'linear-gradient(135deg, #1e3a8a, #2563eb)', fontSize: 9.5, fontWeight: 700, flexShrink: 0 }}>
                                    {rec.employeeName.charAt(0)}
                                  </Avatar>
                                  <Typography sx={{ fontWeight: 500, fontSize: 12 }}>
                                    {rec.employeeName.split(' ').slice(0, 2).join(' ')}
                                  </Typography>
                                </Box>
                              </TableCell>
                              <TableCell sx={{ py: 0.6 }}>
                                <Chip label={isEntrada ? 'Entrada' : 'Saída'} size="small"
                                  sx={{ bgcolor: isEntrada ? 'rgba(16,185,129,0.14)' : 'rgba(59,130,246,0.14)', color: isEntrada ? '#34d399' : '#93c5fd', fontSize: 10, height: 18, border: 'none' }} />
                              </TableCell>
                              <TableCell sx={{ fontVariantNumeric: 'tabular-nums', fontSize: 12, color: 'rgba(255,255,255,0.7)', py: 0.6 }}>
                                {formatTime(rec.time)}
                              </TableCell>
                              <TableCell sx={{ py: 0.6 }}>
                                {hasDelay
                                  ? <Typography sx={{ fontSize: 11, color: '#f87171' }}>−{rec.atraso_minutos}min</Typography>
                                  : hasExtra
                                  ? <Typography sx={{ fontSize: 11, color: '#34d399' }}>+{rec.horas_extras_minutos}min</Typography>
                                  : <Typography sx={{ fontSize: 11, color: '#34d399' }}>Pontual</Typography>}
                              </TableCell>
                            </TableRow>
                          );
                        })}
                      </TableBody>
                    </Table>
                  </TableContainer>
                )}
              </CardContent>
            </Card>
          </motion.div>

          {/* Coluna direita: Presença + Alertas */}
          <motion.div initial={{ opacity: 0, y: 10 }} animate={{ opacity: 1, y: 0 }} transition={{ duration: 0.28, delay: 0.25 }}
            style={{ height: '100%', display: 'flex', flexDirection: 'column', gap: 12, minHeight: 0 }}>

            {/* Presença hoje */}
            <Card sx={{ flexShrink: 0 }}>
              <CardContent sx={{ p: '12px !important' }}>
                <Box sx={{ display: 'flex', justifyContent: 'space-between', alignItems: 'center', mb: 1 }}>
                  <Typography sx={{ fontWeight: 700, color: 'white', fontSize: 13 }}>Presença Hoje</Typography>
                  <Chip label={loading ? '—' : `${presencePercent}%`} size="small"
                    sx={{ bgcolor: accentColor + '1f', color: accentColor, fontWeight: 700, fontSize: 10.5, height: 20, borderRadius: '6px' }} />
                </Box>
                <LinearProgress variant="determinate" value={presencePercent}
                  sx={{ height: 3, borderRadius: 99, mb: 1, bgcolor: 'rgba(255,255,255,0.08)', '& .MuiLinearProgress-bar': { bgcolor: accentColor } }} />
                <Box sx={{ display: 'flex', gap: 1 }}>
                  <Box sx={{ flex: 1, py: 0.6, px: 1, borderRadius: '8px', bgcolor: 'rgba(16,185,129,0.09)', border: '1px solid rgba(16,185,129,0.18)', textAlign: 'center' }}>
                    <Typography sx={{ fontSize: 18, fontWeight: 800, color: '#34d399', lineHeight: 1 }}>{loading ? '—' : data!.presentEmployees}</Typography>
                    <Typography sx={{ fontSize: 9.5, color: 'rgba(255,255,255,0.36)', mt: 0.2 }}>presentes</Typography>
                  </Box>
                  <Box sx={{ flex: 1, py: 0.6, px: 1, borderRadius: '8px', bgcolor: absentes > 0 ? 'rgba(239,68,68,0.08)' : 'rgba(255,255,255,0.04)', border: `1px solid ${absentes > 0 ? 'rgba(239,68,68,0.2)' : 'rgba(255,255,255,0.07)'}`, textAlign: 'center' }}>
                    <Typography sx={{ fontSize: 18, fontWeight: 800, color: absentes > 0 ? '#f87171' : 'rgba(255,255,255,0.4)', lineHeight: 1 }}>{loading ? '—' : absentes}</Typography>
                    <Typography sx={{ fontSize: 9.5, color: 'rgba(255,255,255,0.36)', mt: 0.2 }}>ausentes</Typography>
                  </Box>
                </Box>
                {!loading && absentes > 0 && (
                  <Box sx={{ mt: 1, p: '6px 10px', bgcolor: 'rgba(239,68,68,0.07)', border: '1px solid rgba(239,68,68,0.15)', borderRadius: '8px', display: 'flex', alignItems: 'center', gap: 0.75 }}>
                    <WarningIcon sx={{ fontSize: 11, color: '#f87171', flexShrink: 0 }} />
                    <Typography sx={{ fontSize: 10, color: '#fca5a5', lineHeight: 1.3 }}>Verifique atestados ou folgas.</Typography>
                  </Box>
                )}
              </CardContent>
            </Card>

            {/* Alertas */}
            <Card sx={{ flex: 1, overflow: 'auto', minHeight: 0 }}>
              <CardContent sx={{ p: '12px !important' }}>
                <Typography sx={{ fontWeight: 700, color: 'white', fontSize: 13, mb: 0.75 }}>Alertas</Typography>
                {loading ? (
                  <Box sx={{ display: 'flex', alignItems: 'center', gap: 0.75, py: 0.25 }}>
                    <CircularProgress size={12} sx={{ color: 'rgba(255,255,255,0.25)' }} />
                    <Typography sx={{ fontSize: 12, color: 'rgba(255,255,255,0.25)' }}>Verificando…</Typography>
                  </Box>
                ) : visibleAlerts.length === 0 ? (
                  <Box sx={{ display: 'flex', alignItems: 'center', gap: 0.75, py: 0.25 }}>
                    <CheckIcon sx={{ fontSize: 14, color: '#10b981' }} />
                    <Typography sx={{ fontSize: 12, color: 'rgba(255,255,255,0.36)' }}>Nenhum alerta no momento</Typography>
                  </Box>
                ) : (
                  <Box sx={{ display: 'flex', flexDirection: 'column', gap: 0.6 }}>
                    {visibleAlerts.map((alert: any, i: number) => (
                      <Alert key={i} severity={alert.severity || 'info'}
                        sx={{ borderRadius: '8px', py: 0.4, px: 1.25, '& .MuiAlert-message': { fontSize: 11 }, '& .MuiAlert-icon': { fontSize: 14 } }}>
                        {alert.message}
                      </Alert>
                    ))}
                  </Box>
                )}
              </CardContent>
            </Card>
          </motion.div>
        </Box>
      </Box>
    </PageLayout>
  );
};

export default DashboardPage;
