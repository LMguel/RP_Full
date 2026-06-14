import React, { useState, useEffect, useCallback, useRef } from 'react';
import {
  Box, Typography, Card, CardContent, Chip, CircularProgress,
  Table, TableBody, TableCell, TableContainer, TableHead, TableRow,
  TextField, InputAdornment, IconButton, Tooltip, Select,
  MenuItem, FormControl, Alert, Avatar,
} from '@mui/material';
import {
  Refresh as RefreshIcon,
  Search as SearchIcon,
  AddCircle as AddCircleIcon,
  CheckCircle as CheckCircleIcon,
} from '@mui/icons-material';
import { motion } from 'framer-motion';
import PageLayout from '../sections/PageLayout';
import { getDailySummaries } from '../services/dailySummaryService';
import { useCorrecoesCtx } from '../contexts/CorrecoesContext';
import CorrecaoDrawer, { type DrawerTarget } from '../components/CorrecaoDrawer';

// ─── Constantes ───────────────────────────────────────────────────────────────

const MESES = [
  'Janeiro', 'Fevereiro', 'Março', 'Abril', 'Maio', 'Junho',
  'Julho', 'Agosto', 'Setembro', 'Outubro', 'Novembro', 'Dezembro',
];

// Status considerados "pendências" — excluem PRESENTE, FERIADO, EM_PROCESSAMENTO
const STATUS_PROBLEMA = new Set([
  'INCOMPLETO', 'FALTA', 'ATRASO', 'MISSING_EXIT',
  'INCOMPLETE', 'ABSENT', 'LATE',
]);

const STATUS_CFG: Record<string, { label: string; color: string; bg: string; border: string }> = {
  INCOMPLETO:    { label: '⚠ Incompleto',          color: '#eab308', bg: 'rgba(234,179,8,0.12)',   border: 'rgba(234,179,8,0.35)' },
  INCOMPLETE:    { label: '⚠ Incompleto',          color: '#eab308', bg: 'rgba(234,179,8,0.12)',   border: 'rgba(234,179,8,0.35)' },
  FALTA:         { label: '✗ Falta',               color: '#ef4444', bg: 'rgba(239,68,68,0.12)',   border: 'rgba(239,68,68,0.35)' },
  ABSENT:        { label: '✗ Falta',               color: '#ef4444', bg: 'rgba(239,68,68,0.12)',   border: 'rgba(239,68,68,0.35)' },
  ATRASO:        { label: '! Atraso',              color: '#f59e0b', bg: 'rgba(245,158,11,0.12)',  border: 'rgba(245,158,11,0.35)' },
  LATE:          { label: '! Atraso',              color: '#f59e0b', bg: 'rgba(245,158,11,0.12)',  border: 'rgba(245,158,11,0.35)' },
  MISSING_EXIT:  { label: '↗ Sem saída',           color: '#f97316', bg: 'rgba(249,115,22,0.12)',  border: 'rgba(249,115,22,0.35)' },
  PROXIMOS:      { label: '⟳ Reg. Próximos',       color: '#a78bfa', bg: 'rgba(167,139,250,0.12)', border: 'rgba(167,139,250,0.35)' },
};

const STATUS_FILTER_OPTS = [
  { value: 'todos',         label: 'Todos' },
  { value: 'INCOMPLETO',    label: 'Incompleto' },
  { value: 'FALTA',         label: 'Falta' },
  { value: 'ATRASO',        label: 'Atraso' },
  { value: 'MISSING_EXIT',  label: 'Sem saída' },
  { value: 'PROXIMOS',      label: 'Reg. Próximos' },
];

// ─── Helpers ──────────────────────────────────────────────────────────────────

function getPeriodo(year: number, month: number) {
  const inicio = `${year}-${String(month).padStart(2, '0')}-01`;
  const lastDay = new Date(year, month, 0).getDate();
  const fim = `${year}-${String(month).padStart(2, '0')}-${lastDay}`;
  return { inicio, fim };
}

function formatDate(dateStr: string): string {
  const [y, m, d] = dateStr.split('-');
  return `${d}/${m}/${y}`;
}

function getDiaSemana(dateStr: string): string {
  const DIAS = ['Domingo', 'Segunda', 'Terça', 'Quarta', 'Quinta', 'Sexta', 'Sábado'];
  return DIAS[new Date(`${dateStr}T12:00:00`).getDay()] ?? '';
}

function nomeInicial(nome: string): string {
  return nome.split(' ').map(w => w[0]).slice(0, 2).join('').toUpperCase();
}

function normalizeStatus(raw: any): string {
  return String(raw?.status || raw || '').toUpperCase().replace(/-/g, '_');
}

function toMs(t: string): number {
  // Aceita HH:MM, HH:MM:SS, ISO ou "YYYY-MM-DD HH:MM:SS"
  if (!t.includes('-') && !t.includes('T')) {
    const [h = '0', m = '0', sec = '0'] = t.split(':');
    return (parseInt(h) * 3600 + parseInt(m) * 60 + parseInt(sec)) * 1000;
  }
  const d = new Date(t.includes('T') ? t : t.replace(' ', 'T'));
  return isNaN(d.getTime()) ? NaN : d.getTime();
}

function minutosDiff(t1: string | null | undefined, t2: string | null | undefined): number {
  if (!t1 || !t2) return 999;
  try {
    const diff = Math.abs(toMs(t1) - toMs(t2)) / 60000;
    return isNaN(diff) ? 999 : diff;
  } catch { return 999; }
}

function detectarProximos(s: any): boolean {
  // Campo direto do backend (mais confiável — inclui todos os punches)
  if (s.registros_proximos === true) return true;
  // Fallback: campos de horário do summary
  const ts = [
    s.hora_entrada || s.first_entry_time,
    s.intervalo_saida,
    s.intervalo_volta,
    s.hora_saida || s.last_exit_time,
  ].filter(Boolean) as string[];
  for (let i = 0; i < ts.length; i++)
    for (let j = i + 1; j < ts.length; j++)
      if (minutosDiff(ts[i], ts[j]) < 10) return true;
  return false;
}

function getDisplayStatus(s: any): string {
  const st = normalizeStatus(s.raw?.status ?? s.status);
  if (!STATUS_PROBLEMA.has(st) && s._proximos) return 'PROXIMOS';
  return st;
}

// ─── Componente ──────────────────────────────────────────────────────────────

const CONFIRMED_KEY = '@rp:proximos_confirmados';

function loadConfirmed(): Set<string> {
  try {
    const raw = localStorage.getItem(CONFIRMED_KEY);
    return raw ? new Set(JSON.parse(raw)) : new Set();
  } catch { return new Set(); }
}

function saveConfirmed(set: Set<string>) {
  localStorage.setItem(CONFIRMED_KEY, JSON.stringify([...set]));
}

export default function CorrecaoPage() {
  const { setCorrecoesData } = useCorrecoesCtx();

  const now = new Date();
  const [mes, setMes]   = useState(now.getMonth() + 1);
  const [ano, setAno]   = useState(now.getFullYear());
  const [refreshKey, setRefreshKey] = useState(0);

  const [loading, setLoading]         = useState(true);
  const [error, setError]             = useState<string | null>(null);
  const [rows, setRows]               = useState<any[]>([]);

  const [filtroStatus, setFiltroStatus] = useState('todos');
  const [busca, setBusca]               = useState('');

  const [drawerTarget, setDrawerTarget] = useState<DrawerTarget | null>(null);
  const [confirmedProximos, setConfirmedProximos] = useState<Set<string>>(loadConfirmed);

  const handleConfirmarCorreto = useCallback((key: string) => {
    setConfirmedProximos(prev => {
      const next = new Set(prev);
      next.add(key);
      saveConfirmed(next);
      return next;
    });
  }, []);

  const isLoadingRef = useRef(false);
  const anos = Array.from({ length: 3 }, (_, i) => now.getFullYear() - i);
  const today = `${now.getFullYear()}-${String(now.getMonth() + 1).padStart(2, '0')}-${String(now.getDate()).padStart(2, '0')}`;

  // ── Fetch ───────────────────────────────────────────────────────────────────

  const loadData = useCallback(async () => {
    if (isLoadingRef.current) return;
    isLoadingRef.current = true;
    setLoading(true);
    setError(null);
    try {
      const { inicio, fim } = getPeriodo(ano, mes);

      // getDailySummaries retorna { summaries: [...] }
      const res = await getDailySummaries({ start_date: inicio, end_date: fim }, 1, 1000);
      const summaries: any[] = res?.summaries ?? [];

      // Filtrar pendências + deduplicar por employee_id|date
      const seen = new Set<string>();
      const problemas = summaries.filter(s => {
        const date = s.date || s.data || '';
        if (date >= today) return false;
        const st = normalizeStatus(s.raw?.status ?? s.status);
        const isProximos = detectarProximos(s);
        if (!STATUS_PROBLEMA.has(st) && !isProximos) return false;
        const key = `${s.employee_id || s.funcionario_id}|${date}`;
        if (seen.has(key)) return false;
        seen.add(key);
        if (isProximos) s._proximos = true;
        return true;
      });

      // Ordenar: mais recente primeiro, depois por nome
      problemas.sort((a, b) => {
        const da = a.date || a.data || '';
        const db = b.date || b.data || '';
        if (db !== da) return db.localeCompare(da);
        return (a.employee_name || '').localeCompare(b.employee_name || '');
      });

      setRows(problemas);
      const nSt = (s: any) => normalizeStatus(s.raw?.status ?? s.status);
      setCorrecoesData(problemas.length, {
        total: problemas.length,
        saida_nao_registrada: problemas.filter(s => nSt(s) === 'MISSING_EXIT').length,
        intervalo_incompleto:  problemas.filter(s => ['INCOMPLETO', 'INCOMPLETE'].includes(nSt(s))).length,
        sem_registros:         problemas.filter(s => ['FALTA', 'ABSENT'].includes(nSt(s))).length,
        registros_excedentes:  0,
        quantidade_incorreta:  problemas.filter(s => ['ATRASO', 'LATE'].includes(nSt(s))).length,
        proximos:              problemas.filter(s => s._proximos === true).length,
      });
    } catch (err) {
      setError(err instanceof Error ? err.message : 'Erro ao carregar dados.');
    } finally {
      setLoading(false);
      isLoadingRef.current = false;
    }
  }, [ano, mes, refreshKey, setCorrecoesData]);

  useEffect(() => { loadData(); }, [loadData]);

  // ── Filtros ──────────────────────────────────────────────────────────────────

  const visible = rows.filter(s => {
    const date = s.date || s.data || '';
    const empId = s.employee_id || s.funcionario_id || '';
    const st = getDisplayStatus(s);
    // Ocultar registros próximos já confirmados como corretos pelo gerente
    if (st === 'PROXIMOS' && confirmedProximos.has(`${empId}|${date}`)) return false;
    if (filtroStatus !== 'todos') {
      const canonical: Record<string, string[]> = {
        INCOMPLETO:   ['INCOMPLETO', 'INCOMPLETE'],
        FALTA:        ['FALTA', 'ABSENT'],
        ATRASO:       ['ATRASO', 'LATE'],
        MISSING_EXIT: ['MISSING_EXIT'],
        PROXIMOS:     ['PROXIMOS'],
      };
      const allowed = canonical[filtroStatus] ?? [filtroStatus];
      if (!allowed.includes(st)) return false;
    }
    if (busca) {
      const q = busca.toLowerCase();
      const nome = (s.employee_name || s.nome || '').toLowerCase();
      if (!nome.includes(q)) return false;
    }
    return true;
  });

  // Contadores por status para os chips de filtro
  const counts: Record<string, number> = { INCOMPLETO: 0, FALTA: 0, ATRASO: 0, MISSING_EXIT: 0, PROXIMOS: 0 };
  for (const s of rows) {
    const st = getDisplayStatus(s);
    if (st === 'INCOMPLETO' || st === 'INCOMPLETE') counts.INCOMPLETO++;
    else if (st === 'FALTA' || st === 'ABSENT') counts.FALTA++;
    else if (st === 'ATRASO' || st === 'LATE') counts.ATRASO++;
    else if (st === 'MISSING_EXIT') counts.MISSING_EXIT++;
    else if (st === 'PROXIMOS') counts.PROXIMOS++;
  }

  const handleRefresh = () => setRefreshKey(k => k + 1);

  const openDrawer = (s: any) => {
    const date = s.date || s.data || '';
    setDrawerTarget({
      employee_id:        s.employee_id || s.funcionario_id || '',
      employee_name:      s.employee_name || s.nome || '',
      date,
      dateLabel:          formatDate(date),
      diaSemana:          getDiaSemana(date),
      statusLabel:        STATUS_CFG[getDisplayStatus(s)]?.label ?? '—',
      intervaloAutomatico: s.intervalo_automatico ?? true,
    });
  };

  // ─── UI ────────────────────────────────────────────────────────────────────

  return (
    <PageLayout>
      <Box sx={{ display: 'flex', flexDirection: 'column', gap: 2.5, height: { xs: 'auto', md: 'calc(100vh - 120px)' } }}>

        {/* ── Header ── */}
        <motion.div initial={{ opacity: 0, y: 10 }} animate={{ opacity: 1, y: 0 }} transition={{ duration: 0.3 }} style={{ flexShrink: 0 }}>
          <Box sx={{ display: 'flex', alignItems: 'flex-start', justifyContent: 'space-between', flexWrap: 'wrap', gap: 1.5 }}>
            <Box>
              <Typography sx={{ color: 'rgba(255,255,255,0.4)', fontSize: 11, fontWeight: 600, letterSpacing: '0.09em', textTransform: 'uppercase', mb: 0.5 }}>
                Módulo de Correções
              </Typography>
              <Typography variant="h4" sx={{ fontWeight: 800, color: 'white', lineHeight: 1.1, letterSpacing: '-0.02em' }}>
                Registros Incompletos
              </Typography>
            </Box>

            <Box sx={{ display: 'flex', gap: 1, alignItems: 'center', flexWrap: 'wrap' }}>
              <FormControl size="small" sx={{ minWidth: 130 }}>
                <Select value={mes} onChange={e => setMes(Number(e.target.value))} sx={{ fontSize: 13, height: 36 }}>
                  {MESES.map((m, i) => <MenuItem key={i + 1} value={i + 1}>{m}</MenuItem>)}
                </Select>
              </FormControl>

              <FormControl size="small" sx={{ minWidth: 90 }}>
                <Select value={ano} onChange={e => setAno(Number(e.target.value))} sx={{ fontSize: 13, height: 36 }}>
                  {anos.map(y => <MenuItem key={y} value={y}>{y}</MenuItem>)}
                </Select>
              </FormControl>

              <Tooltip title="Atualizar">
                <IconButton size="small" onClick={handleRefresh}
                  sx={{ border: '1px solid rgba(255,255,255,0.12)', borderRadius: '9px', p: 0.75, color: 'rgba(255,255,255,0.5)', '&:hover': { color: 'white', borderColor: 'rgba(255,255,255,0.28)', bgcolor: 'rgba(255,255,255,0.06)' } }}>
                  <RefreshIcon sx={{ fontSize: 18 }} />
                </IconButton>
              </Tooltip>
            </Box>
          </Box>
        </motion.div>

        {/* ── Chips de filtro por status ── */}
        <motion.div initial={{ opacity: 0, y: 8 }} animate={{ opacity: 1, y: 0 }} transition={{ duration: 0.28, delay: 0.05 }} style={{ flexShrink: 0 }}>
          <Box sx={{ display: 'flex', gap: 1, flexWrap: 'wrap' }}>
            <Chip
              label={`Todos (${rows.length})`}
              onClick={() => setFiltroStatus('todos')}
              sx={{
                fontWeight: 700, fontSize: 12, height: 30, cursor: 'pointer',
                bgcolor: filtroStatus === 'todos' ? 'rgba(255,255,255,0.18)' : 'rgba(255,255,255,0.06)',
                color: filtroStatus === 'todos' ? 'white' : 'rgba(255,255,255,0.55)',
                border: filtroStatus === 'todos' ? '1px solid rgba(255,255,255,0.3)' : '1px solid rgba(255,255,255,0.08)',
                '&:hover': { bgcolor: 'rgba(255,255,255,0.12)' },
              }}
            />
            {STATUS_FILTER_OPTS.filter(o => o.value !== 'todos' && counts[o.value] > 0).map(o => {
              const cfg = STATUS_CFG[o.value];
              const active = filtroStatus === o.value;
              return (
                <Chip
                  key={o.value}
                  label={`${o.label} (${counts[o.value]})`}
                  onClick={() => setFiltroStatus(active ? 'todos' : o.value)}
                  sx={{
                    fontWeight: 600, fontSize: 11.5, height: 30, cursor: 'pointer',
                    bgcolor: active ? `${cfg?.color}25` : `${cfg?.color}0d`,
                    color: active ? cfg?.color : `${cfg?.color}bb`,
                    border: `1px solid ${active ? cfg?.border : cfg?.border + '80'}`,
                    '&:hover': { bgcolor: `${cfg?.color}1f` },
                  }}
                />
              );
            })}
          </Box>
        </motion.div>

        {/* ── Busca ── */}
        <Box sx={{ flexShrink: 0 }}>
          <TextField
            size="small"
            placeholder="Buscar por funcionário..."
            value={busca}
            onChange={e => setBusca(e.target.value)}
            InputProps={{
              startAdornment: (
                <InputAdornment position="start">
                  <SearchIcon sx={{ fontSize: 17, color: 'rgba(255,255,255,0.3)' }} />
                </InputAdornment>
              ),
            }}
            sx={{ maxWidth: 380, '& .MuiInputBase-root': { height: 36, fontSize: 13 } }}
          />
        </Box>

        {/* ── Tabela ── */}
        <motion.div
          initial={{ opacity: 0, y: 10 }}
          animate={{ opacity: 1, y: 0 }}
          transition={{ duration: 0.28, delay: 0.1 }}
          style={{ flex: 1, minHeight: 0, display: 'flex', flexDirection: 'column' }}
        >
          {loading ? (
            <Box sx={{ display: 'flex', alignItems: 'center', justifyContent: 'center', flex: 1, gap: 2 }}>
              <CircularProgress size={36} sx={{ color: 'rgba(255,255,255,0.5)' }} />
              <Typography sx={{ color: 'rgba(255,255,255,0.4)', fontSize: 13 }}>Carregando registros...</Typography>
            </Box>
          ) : error ? (
            <Alert severity="error" action={<IconButton size="small" onClick={handleRefresh} sx={{ color: 'inherit' }}><RefreshIcon /></IconButton>}>
              {error}
            </Alert>
          ) : (
            <Card sx={{ flex: 1, display: 'flex', flexDirection: 'column', overflow: 'hidden', minHeight: 0 }}>
              <CardContent sx={{ flex: 1, display: 'flex', flexDirection: 'column', overflow: 'hidden', p: '14px !important' }}>

                <Box sx={{ flexShrink: 0, display: 'flex', justifyContent: 'space-between', alignItems: 'center', mb: 1 }}>
                  <Typography sx={{ fontWeight: 700, color: 'white', fontSize: 13.5 }}>
                    {visible.length === 0 ? 'Nenhuma pendência' : `${visible.length} registro${visible.length !== 1 ? 's' : ''} com pendência`}
                  </Typography>
                  <Typography sx={{ fontSize: 11.5, color: 'rgba(255,255,255,0.3)' }}>
                    {MESES[mes - 1]} {ano}
                  </Typography>
                </Box>

                {visible.length === 0 ? (
                  <Box sx={{ flex: 1, display: 'flex', alignItems: 'center', justifyContent: 'center', flexDirection: 'column', gap: 1.5 }}>
                    <Typography sx={{ color: 'rgba(255,255,255,0.3)', fontSize: 13, fontStyle: 'italic' }}>
                      {busca || filtroStatus !== 'todos'
                        ? 'Nenhum registro encontrado com esse filtro.'
                        : `Nenhuma pendência em ${MESES[mes - 1]} ${ano}.`}
                    </Typography>
                  </Box>
                ) : (
                  <TableContainer sx={{ flex: 1, overflow: 'auto', bgcolor: 'transparent' }}>
                    <Table size="small" stickyHeader>
                      <TableHead>
                        <TableRow>
                          {['Funcionário', 'Data', 'Dia', 'Status', 'Entrada', 'Saída Int.', 'Volta Int.', 'Saída', 'H. Trabalhadas', 'Ação'].map(h => (
                            <TableCell key={h} sx={{ bgcolor: 'rgba(10,22,66,0.9)' }}>{h}</TableCell>
                          ))}
                        </TableRow>
                      </TableHead>
                      <TableBody>
                        {visible.map((s, idx) => {
                          const date = s.date || s.data || '';
                          const statusKey = getDisplayStatus(s);
                          const sc = STATUS_CFG[statusKey] ?? { label: statusKey, color: 'rgba(255,255,255,0.4)', bg: 'rgba(255,255,255,0.05)', border: 'rgba(255,255,255,0.15)' };
                          const nome          = s.employee_name || s.nome || '—';
                          const entrada       = s.first_entry_time  || s.hora_entrada    || '—';
                          const saidaAlmoco   = s.intervalo_saida   || null;
                          const voltaAlmoco   = s.intervalo_volta   || null;
                          const saidaFinal    = s.last_exit_time    || s.hora_saida      || '—';
                          const horas         = s.worked_hours_str  || (s.worked_hours ? `${s.worked_hours}h` : '—');
                          const isAutoIntervalo = s.intervalo_automatico ?? false;
                          const [dateFull, dateWeekday] = (() => {
                            const [y, m, d] = date.split('-');
                            const dateObj = new Date(Number(y), Number(m) - 1, Number(d));
                            const weekday = dateObj.toLocaleDateString('pt-BR', { weekday: 'short' }).replace('.', '');
                            return [`${d}/${m}/${y}`, weekday];
                          })();

                          return (
                            <TableRow
                              key={`${s.employee_id}-${date}-${idx}`}
                              hover
                              onClick={() => openDrawer(s)}
                              sx={{ cursor: 'pointer' }}
                            >
                              <TableCell>
                                <Box sx={{ display: 'flex', alignItems: 'center', gap: 1.25 }}>
                                  <Avatar sx={{ width: 28, height: 28, background: 'linear-gradient(135deg, #1e3a8a, #2563eb)', fontSize: 10, fontWeight: 700, flexShrink: 0 }}>
                                    {nomeInicial(nome)}
                                  </Avatar>
                                  <Typography sx={{ fontWeight: 500, fontSize: 12.5, color: 'rgba(255,255,255,0.85)' }}>
                                    {nome.split(' ').slice(0, 2).join(' ')}
                                  </Typography>
                                </Box>
                              </TableCell>
                              <TableCell sx={{ whiteSpace: 'nowrap' }}>
                                <Typography sx={{ fontWeight: 700, fontSize: 12, color: 'white' }}>{dateFull}</Typography>
                              </TableCell>
                              <TableCell sx={{ fontSize: 12, color: 'rgba(255,255,255,0.45)', whiteSpace: 'nowrap' }}>
                                {dateWeekday}
                              </TableCell>
                              <TableCell>
                                <Chip
                                  label={sc.label}
                                  size="small"
                                  sx={{ height: 19, fontSize: 10.5, fontWeight: 700, background: sc.bg, border: `1px solid ${sc.border}`, color: sc.color }}
                                />
                              </TableCell>
                              <TableCell align="center" sx={{ fontFamily: 'monospace', fontSize: 12, color: 'rgba(255,255,255,0.85)' }}>{entrada}</TableCell>
                              <TableCell align="center" sx={{ fontFamily: 'monospace', fontSize: 12, color: saidaAlmoco ? 'rgba(255,255,255,0.85)' : 'rgba(255,255,255,0.3)', fontStyle: !saidaAlmoco ? 'italic' : 'normal' }}>
                                {saidaAlmoco || (isAutoIntervalo ? '*' : '—')}
                              </TableCell>
                              <TableCell align="center" sx={{ fontFamily: 'monospace', fontSize: 12, color: voltaAlmoco ? 'rgba(255,255,255,0.85)' : 'rgba(255,255,255,0.3)', fontStyle: !voltaAlmoco ? 'italic' : 'normal' }}>
                                {voltaAlmoco || (isAutoIntervalo ? '*' : '—')}
                              </TableCell>
                              <TableCell align="center" sx={{ fontFamily: 'monospace', fontSize: 12, color: 'rgba(255,255,255,0.85)' }}>{saidaFinal}</TableCell>
                              <TableCell align="center" sx={{ fontFamily: 'monospace', fontSize: 12, fontWeight: 700 }}>{horas}</TableCell>
                              <TableCell onClick={e => e.stopPropagation()}>
                                <Box sx={{ display: 'flex', gap: 0.5, alignItems: 'center' }}>
                                  {statusKey === 'PROXIMOS' && (
                                    <Tooltip title="Confirmar como correto">
                                      <IconButton
                                        size="small"
                                        onClick={() => handleConfirmarCorreto(`${s.employee_id || s.funcionario_id}|${date}`)}
                                        aria-label={`Confirmar correto para ${nome}`}
                                        sx={{
                                          color: '#a78bfa',
                                          border: '1.5px solid rgba(167,139,250,0.35)',
                                          borderRadius: '8px',
                                          p: 0.65,
                                          bgcolor: 'rgba(167,139,250,0.07)',
                                          '&:hover': { color: '#c4b5fd', borderColor: 'rgba(167,139,250,0.6)', bgcolor: 'rgba(167,139,250,0.15)', transform: 'scale(1.1)' },
                                          transition: 'transform 0.15s ease',
                                        }}
                                      >
                                        <CheckCircleIcon sx={{ fontSize: 17 }} />
                                      </IconButton>
                                    </Tooltip>
                                  )}
                                  <Tooltip title={statusKey === 'PROXIMOS' ? 'Editar / corrigir registro' : 'Adicionar / corrigir registro'}>
                                    <IconButton
                                      size="small"
                                      onClick={() => openDrawer(s)}
                                      aria-label={`Corrigir registro para ${nome}`}
                                      sx={{
                                        color: '#4ade80',
                                        border: '1.5px solid rgba(74,222,128,0.35)',
                                        borderRadius: '8px',
                                        p: 0.65,
                                        bgcolor: 'rgba(74,222,128,0.07)',
                                        '&:hover': {
                                          color: '#86efac',
                                          borderColor: 'rgba(74,222,128,0.6)',
                                          bgcolor: 'rgba(74,222,128,0.15)',
                                          transform: 'scale(1.1)',
                                        },
                                        transition: 'transform 0.15s ease',
                                      }}
                                    >
                                      <AddCircleIcon sx={{ fontSize: 17 }} />
                                    </IconButton>
                                  </Tooltip>
                                </Box>
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
          )}
        </motion.div>
      </Box>

      {/* ── Drawer ── */}
      <CorrecaoDrawer
        target={drawerTarget}
        onClose={() => setDrawerTarget(null)}
        onRefresh={() => { setDrawerTarget(null); handleRefresh(); }}
        onConfirmarCorreto={handleConfirmarCorreto}
      />
    </PageLayout>
  );
}
