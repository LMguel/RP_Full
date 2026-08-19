import React, { useState, useEffect, useCallback, useRef, useMemo } from 'react';
import {
  Box, Typography, Card, CardContent, Chip, CircularProgress,
  Table, TableBody, TableCell, TableContainer, TableHead, TableRow,
  TextField, InputAdornment, IconButton, Tooltip,
  Alert, Avatar, Collapse,
} from '@mui/material';
import {
  Refresh as RefreshIcon,
  Search as SearchIcon,
  AddCircle as AddCircleIcon,
  CheckCircle as CheckCircleIcon,
  ExpandMore as ExpandMoreIcon,
  ExpandLess as ExpandLessIcon,
  History as HistoryIcon,
} from '@mui/icons-material';
import { motion } from 'framer-motion';
import PageLayout from '../sections/PageLayout';
import MonthNavigator from '../components/MonthNavigator';
import { usePeriodo } from '../contexts/PeriodoContext';
import { getDailySummaries } from '../services/dailySummaryService';
import { useCorrecoesCtx } from '../contexts/CorrecoesContext';
import CorrecaoDrawer, { type DrawerTarget } from '../components/CorrecaoDrawer';

// ─── Constantes ───────────────────────────────────────────────────────────────

const MESES = [
  'Janeiro', 'Fevereiro', 'Março', 'Abril', 'Maio', 'Junho',
  'Julho', 'Agosto', 'Setembro', 'Outubro', 'Novembro', 'Dezembro',
];

const STATUS_PROBLEMA = new Set([
  'INCOMPLETO', 'FALTA', 'ATRASO', 'MISSING_EXIT',
  'INCOMPLETE', 'ABSENT', 'LATE',
]);

const STATUS_CFG: Record<string, { label: string; color: string; bg: string; border: string }> = {
  INCOMPLETO:    { label: '⚠ Incompleto',    color: '#eab308', bg: 'rgba(234,179,8,0.12)',   border: 'rgba(234,179,8,0.35)' },
  INCOMPLETE:    { label: '⚠ Incompleto',    color: '#eab308', bg: 'rgba(234,179,8,0.12)',   border: 'rgba(234,179,8,0.35)' },
  FALTA:         { label: '✗ Falta',         color: '#ef4444', bg: 'rgba(239,68,68,0.12)',   border: 'rgba(239,68,68,0.35)' },
  ABSENT:        { label: '✗ Falta',         color: '#ef4444', bg: 'rgba(239,68,68,0.12)',   border: 'rgba(239,68,68,0.35)' },
  ATRASO:        { label: '! Atraso',        color: '#f59e0b', bg: 'rgba(245,158,11,0.12)',  border: 'rgba(245,158,11,0.35)' },
  LATE:          { label: '! Atraso',        color: '#f59e0b', bg: 'rgba(245,158,11,0.12)',  border: 'rgba(245,158,11,0.35)' },
  MISSING_EXIT:  { label: '↗ Sem saída',     color: '#f97316', bg: 'rgba(249,115,22,0.12)',  border: 'rgba(249,115,22,0.35)' },
  PROXIMOS:      { label: '⟳ Reg. Próximos', color: '#a78bfa', bg: 'rgba(167,139,250,0.12)', border: 'rgba(167,139,250,0.35)' },
};

const STATUS_FILTER_OPTS = [
  { value: 'todos',        label: 'Todos' },
  { value: 'INCOMPLETO',   label: 'Incompleto' },
  { value: 'FALTA',        label: 'Falta' },
  { value: 'ATRASO',       label: 'Atraso' },
  { value: 'MISSING_EXIT', label: 'Sem saída' },
  { value: 'PROXIMOS',     label: 'Reg. Próximos' },
];

// ─── Helpers ──────────────────────────────────────────────────────────────────

function getPeriodo(year: number, month: number) {
  const inicio = `${year}-${String(month).padStart(2, '0')}-01`;
  const lastDay = new Date(year, month, 0).getDate();
  const fim = `${year}-${String(month).padStart(2, '0')}-${lastDay}`;
  return { inicio, fim };
}

export function formatDate(dateStr: string): string {
  const [y, m, d] = dateStr.split('-');
  return `${d}/${m}/${y}`;
}

export function getDiaSemana(dateStr: string): string {
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
  if (s.registros_proximos === true) return true;
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

export function getDisplayStatus(s: any): string {
  const st = normalizeStatus(s.raw?.status ?? s.status);
  if (!STATUS_PROBLEMA.has(st) && s._proximos) return 'PROXIMOS';
  return st;
}

export function rowToDrawerTarget(s: any): DrawerTarget {
  const date = s.date || s.data || '';
  return {
    employee_id:        s.employee_id || s.funcionario_id || '',
    employee_name:      s.employee_name || s.nome || '',
    date,
    dateLabel:          formatDate(date),
    diaSemana:          getDiaSemana(date),
    statusLabel:        STATUS_CFG[getDisplayStatus(s)]?.label ?? '—',
    intervaloAutomatico: s.intervalo_automatico ?? true,
  };
}

// ─── Subcomponente: linha da tabela ──────────────────────────────────────────

function ProblemRow({ s, idx, confirmedProximos, onOpen, onConfirmar }: {
  s: any;
  idx: number;
  confirmedProximos: Set<string>;
  onOpen: (s: any) => void;
  onConfirmar: (key: string) => void;
}) {
  const date     = s.date || s.data || '';
  const statusKey = getDisplayStatus(s);
  const sc = STATUS_CFG[statusKey] ?? { label: statusKey, color: 'rgba(255,255,255,0.4)', bg: 'rgba(255,255,255,0.05)', border: 'rgba(255,255,255,0.15)' };
  const nome         = s.employee_name || s.nome || '—';
  const entrada      = s.first_entry_time  || s.hora_entrada    || '—';
  const saidaAlmoco  = s.intervalo_saida   || null;
  const voltaAlmoco  = s.intervalo_volta   || null;
  const saidaFinal   = s.last_exit_time    || s.hora_saida      || '—';
  const horas        = s.worked_hours_str  || (s.worked_hours ? `${s.worked_hours}h` : '—');
  const isAutoIntervalo = s.intervalo_automatico ?? false;
  const [y, m, d] = date.split('-');
  const dateObj = new Date(Number(y), Number(m) - 1, Number(d));
  const weekday = dateObj.toLocaleDateString('pt-BR', { weekday: 'short' }).replace('.', '');
  const dateFull = `${d}/${m}/${y}`;

  return (
    <TableRow
      key={`${s.employee_id}-${date}-${idx}`}
      hover
      onClick={() => onOpen(s)}
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
        {weekday}
      </TableCell>
      <TableCell>
        <Chip label={sc.label} size="small" sx={{ height: 19, fontSize: 10.5, fontWeight: 700, background: sc.bg, border: `1px solid ${sc.border}`, color: sc.color }} />
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
              <IconButton size="small"
                onClick={() => onConfirmar(`${s.employee_id || s.funcionario_id}|${date}`)}
                aria-label={`Confirmar correto para ${nome}`}
                sx={{ color: '#a78bfa', border: '1.5px solid rgba(167,139,250,0.35)', borderRadius: '8px', p: 0.65, bgcolor: 'rgba(167,139,250,0.07)', '&:hover': { color: '#c4b5fd', borderColor: 'rgba(167,139,250,0.6)', bgcolor: 'rgba(167,139,250,0.15)', transform: 'scale(1.1)' }, transition: 'transform 0.15s ease' }}>
                <CheckCircleIcon sx={{ fontSize: 17 }} />
              </IconButton>
            </Tooltip>
          )}
          <Tooltip title={statusKey === 'PROXIMOS' ? 'Editar / corrigir registro' : 'Adicionar / corrigir registro'}>
            <IconButton size="small"
              onClick={() => onOpen(s)}
              aria-label={`Corrigir registro para ${nome}`}
              sx={{ color: '#4ade80', border: '1.5px solid rgba(74,222,128,0.35)', borderRadius: '8px', p: 0.65, bgcolor: 'rgba(74,222,128,0.07)', '&:hover': { color: '#86efac', borderColor: 'rgba(74,222,128,0.6)', bgcolor: 'rgba(74,222,128,0.15)', transform: 'scale(1.1)' }, transition: 'transform 0.15s ease' }}>
              <AddCircleIcon sx={{ fontSize: 17 }} />
            </IconButton>
          </Tooltip>
        </Box>
      </TableCell>
    </TableRow>
  );
}

// ─── Subcomponente: grupo de funcionário (vista agrupada) ─────────────────────

const TABLE_HEADERS = ['Funcionário', 'Data', 'Dia', 'Status', 'Entrada', 'Saída Int.', 'Volta Int.', 'Saída', 'H. Trabalhadas', 'Ação'];

function EmployeeGroupSection({ group, defaultExpanded, confirmedProximos, onOpen, onConfirmar, onStartQueue }: {
  group: { id: string; name: string; items: any[] };
  defaultExpanded: boolean;
  confirmedProximos: Set<string>;
  onOpen: (s: any) => void;
  onConfirmar: (key: string) => void;
  onStartQueue: (items: any[]) => void;
}) {
  const [expanded, setExpanded] = useState(defaultExpanded);

  const counts: Record<string, number> = { INCOMPLETO: 0, FALTA: 0, ATRASO: 0, MISSING_EXIT: 0, PROXIMOS: 0 };
  for (const s of group.items) {
    const st = getDisplayStatus(s);
    if (st === 'INCOMPLETO' || st === 'INCOMPLETE') counts.INCOMPLETO++;
    else if (st === 'FALTA' || st === 'ABSENT') counts.FALTA++;
    else if (st === 'ATRASO' || st === 'LATE') counts.ATRASO++;
    else if (st === 'MISSING_EXIT') counts.MISSING_EXIT++;
    else if (st === 'PROXIMOS') counts.PROXIMOS++;
  }

  const dominant = Object.entries(counts).sort((a, b) => b[1] - a[1])[0]?.[0] ?? 'INCOMPLETO';
  const accentColor = STATUS_CFG[dominant]?.color ?? '#eab308';

  return (
    <Box sx={{ mb: 1 }}>
      {/* Cabeçalho do grupo */}
      <Box
        onClick={() => setExpanded(v => !v)}
        sx={{
          display: 'flex', alignItems: 'center', gap: 1.5, px: 2, py: 1.25,
          cursor: 'pointer', borderRadius: expanded ? '10px 10px 0 0' : '10px',
          bgcolor: expanded ? 'rgba(255,255,255,0.06)' : 'rgba(255,255,255,0.04)',
          border: `1px solid ${expanded ? 'rgba(255,255,255,0.12)' : 'rgba(255,255,255,0.07)'}`,
          borderBottom: expanded ? 'none' : undefined,
          transition: 'all 0.18s ease',
          '&:hover': { bgcolor: 'rgba(255,255,255,0.07)' },
        }}
      >
        <Avatar sx={{ width: 32, height: 32, background: `linear-gradient(135deg, ${accentColor}55, ${accentColor}22)`, border: `1px solid ${accentColor}40`, fontSize: 11, fontWeight: 800, color: accentColor, flexShrink: 0 }}>
          {nomeInicial(group.name)}
        </Avatar>
        <Typography sx={{ fontWeight: 700, fontSize: 13.5, color: 'rgba(255,255,255,0.9)', flex: 1 }}>
          {group.name.split(' ').slice(0, 2).join(' ')}
        </Typography>
        {/* Mini badges por tipo */}
        <Box sx={{ display: 'flex', gap: 0.5, flexWrap: 'wrap' }}>
          {Object.entries(counts).filter(([, v]) => v > 0).map(([st, count]) => {
            const cfg = STATUS_CFG[st];
            return (
              <Box key={st} sx={{ px: 0.75, py: 0.1, borderRadius: '5px', bgcolor: cfg?.bg, border: `1px solid ${cfg?.border}`, display: 'flex', alignItems: 'center', gap: 0.4 }}>
                <Typography sx={{ fontSize: 10, fontWeight: 800, color: cfg?.color, fontVariantNumeric: 'tabular-nums' }}>
                  {count} {st === 'FALTA' || st === 'ABSENT' ? 'falta' : st === 'INCOMPLETO' || st === 'INCOMPLETE' ? 'incomp.' : st === 'ATRASO' || st === 'LATE' ? 'atraso' : st === 'MISSING_EXIT' ? 's/saída' : 'próx.'}
                </Typography>
              </Box>
            );
          })}
        </Box>
        <Tooltip title="Corrigir todos em sequência">
          <Box
            onClick={e => { e.stopPropagation(); onStartQueue(group.items); }}
            sx={{
              ml: 0.5, px: 1.25, py: 0.4, borderRadius: '7px', cursor: 'pointer',
              border: `1px solid ${accentColor}35`, color: accentColor, fontSize: 11, fontWeight: 700,
              bgcolor: `${accentColor}0d`,
              '&:hover': { bgcolor: `${accentColor}1a`, borderColor: `${accentColor}60` },
              transition: 'all 0.15s ease',
              whiteSpace: 'nowrap',
            }}
          >
            Corrigir →
          </Box>
        </Tooltip>
        {expanded ? <ExpandLessIcon sx={{ fontSize: 18, color: 'rgba(255,255,255,0.4)', flexShrink: 0 }} /> : <ExpandMoreIcon sx={{ fontSize: 18, color: 'rgba(255,255,255,0.4)', flexShrink: 0 }} />}
      </Box>

      {/* Tabela expandível */}
      <Collapse in={expanded}>
        <Box sx={{ border: '1px solid rgba(255,255,255,0.1)', borderTop: 'none', borderRadius: '0 0 10px 10px', overflow: 'hidden' }}>
          <TableContainer sx={{ bgcolor: 'transparent', overflowX: 'auto', WebkitOverflowScrolling: 'touch' }}>
            <Table size="small">
              <TableHead>
                <TableRow>
                  {TABLE_HEADERS.map(h => (
                    <TableCell key={h} sx={{ bgcolor: 'rgba(10,22,66,0.7)', fontSize: '0.68rem' }}>{h}</TableCell>
                  ))}
                </TableRow>
              </TableHead>
              <TableBody>
                {group.items.map((s, idx) => (
                  <ProblemRow
                    key={`${s.employee_id}-${s.date || s.data}-${idx}`}
                    s={s} idx={idx}
                    confirmedProximos={confirmedProximos}
                    onOpen={onOpen}
                    onConfirmar={onConfirmar}
                  />
                ))}
              </TableBody>
            </Table>
          </TableContainer>
        </Box>
      </Collapse>
    </Box>
  );
}

// ─── Constantes de localStorage ──────────────────────────────────────────────

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

// ─── Componente principal ─────────────────────────────────────────────────────

export default function CorrecaoPage() {
  const { setCorrecoesData } = useCorrecoesCtx();
  const { ano, mes } = usePeriodo();
  const [refreshKey, setRefreshKey] = useState(0);

  const [loading, setLoading] = useState(true);
  const [error, setError]     = useState<string | null>(null);
  const [rows, setRows]       = useState<any[]>([]);
  // Preenchido quando o mês selecionado está vazio e o sistema expandiu
  // automaticamente a busca para incluir o mês anterior (ver loadData).
  const [janelaExpandida, setJanelaExpandida] = useState<{ inicio: string; fim: string } | null>(null);

  const [filtroStatus, setFiltroStatus] = useState('todos');
  const [busca, setBusca]               = useState('');
  const [viewMode, setViewMode]         = useState<'flat' | 'grouped'>('flat');

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
  const now = new Date();
  const today = `${now.getFullYear()}-${String(now.getMonth() + 1).padStart(2, '0')}-${String(now.getDate()).padStart(2, '0')}`;

  // ── Fetch ──────────────────────────────────────────────────────────────────

  /** Filtra e deduplica os summaries de um período, retornando só os que têm pendência. */
  const filtrarProblemas = useCallback((summaries: any[]) => {
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

    problemas.sort((a, b) => {
      const da = a.date || a.data || '';
      const db = b.date || b.data || '';
      if (db !== da) return db.localeCompare(da);
      return (a.employee_name || '').localeCompare(b.employee_name || '');
    });

    return problemas;
  }, [today]);

  const loadData = useCallback(async () => {
    if (isLoadingRef.current) return;
    isLoadingRef.current = true;
    setLoading(true);
    setError(null);
    setJanelaExpandida(null);
    try {
      const { inicio, fim } = getPeriodo(ano, mes);
      const res = await getDailySummaries({ start_date: inicio, end_date: fim }, 1, 1000);
      let problemas = filtrarProblemas(res?.summaries ?? []);

      // Mês selecionado é o atual e está sem nenhuma pendência: a maioria das
      // correções de virada de mês são sobre o mês ANTERIOR (que só termina
      // de ser fechado nos primeiros dias do mês atual). Em vez de mostrar
      // uma tela vazia, expande a busca para [1º do mês anterior → hoje].
      const isMesAtual = ano === now.getFullYear() && mes === now.getMonth() + 1;
      if (problemas.length === 0 && isMesAtual) {
        const anoAnterior = mes === 1 ? ano - 1 : ano;
        const mesAnterior  = mes === 1 ? 12 : mes - 1;
        const { inicio: inicioAnterior } = getPeriodo(anoAnterior, mesAnterior);
        const resFallback = await getDailySummaries({ start_date: inicioAnterior, end_date: today }, 1, 1000);
        const problemasFallback = filtrarProblemas(resFallback?.summaries ?? []);
        if (problemasFallback.length > 0) {
          problemas = problemasFallback;
          setJanelaExpandida({ inicio: inicioAnterior, fim: today });
        }
      }

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
  }, [ano, mes, refreshKey, setCorrecoesData, filtrarProblemas]);

  useEffect(() => { loadData(); }, [loadData]);

  // ── Filtros ────────────────────────────────────────────────────────────────

  const visible = rows.filter(s => {
    const date = s.date || s.data || '';
    const empId = s.employee_id || s.funcionario_id || '';
    const st = getDisplayStatus(s);
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

  // Contadores por status
  const counts: Record<string, number> = { INCOMPLETO: 0, FALTA: 0, ATRASO: 0, MISSING_EXIT: 0, PROXIMOS: 0 };
  for (const s of rows) {
    const st = getDisplayStatus(s);
    if (st === 'INCOMPLETO' || st === 'INCOMPLETE') counts.INCOMPLETO++;
    else if (st === 'FALTA' || st === 'ABSENT') counts.FALTA++;
    else if (st === 'ATRASO' || st === 'LATE') counts.ATRASO++;
    else if (st === 'MISSING_EXIT') counts.MISSING_EXIT++;
    else if (st === 'PROXIMOS') counts.PROXIMOS++;
  }

  // Vista agrupada por funcionário
  const grouped = useMemo(() => {
    const map = new Map<string, { name: string; items: any[] }>();
    for (const s of visible) {
      const id = s.employee_id || s.funcionario_id || '';
      if (!map.has(id)) map.set(id, { name: s.employee_name || s.nome || '—', items: [] });
      map.get(id)!.items.push(s);
    }
    return [...map.entries()]
      .map(([id, v]) => ({ id, ...v }))
      .sort((a, b) => b.items.length - a.items.length);
  }, [visible]);

  // Fila de navegação para o drawer (Opção B)
  const drawerQueue = useMemo<DrawerTarget[]>(() =>
    visible.map(rowToDrawerTarget),
  [visible]);

  const drawerQueueIndex = drawerTarget
    ? drawerQueue.findIndex(t => t.employee_id === drawerTarget.employee_id && t.date === drawerTarget.date)
    : -1;

  const handleRefresh = () => setRefreshKey(k => k + 1);

  const openDrawer = (s: any) => setDrawerTarget(rowToDrawerTarget(s));

  const startGroupQueue = (items: any[]) => {
    if (items.length === 0) return;
    setDrawerTarget(rowToDrawerTarget(items[0]));
  };

  // ─── UI ──────────────────────────────────────────────────────────────────

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
              {/* Toggle lista/agrupado */}
              <Box sx={{ display: 'flex', border: '1px solid rgba(255,255,255,0.1)', borderRadius: '10px', p: 0.4, gap: 0.4 }}>
                {(['flat', 'grouped'] as const).map(mode => (
                  <Box key={mode} onClick={() => setViewMode(mode)} sx={{
                    px: 1.5, py: 0.45, borderRadius: '7px', cursor: 'pointer', fontSize: 11.5, fontWeight: 600,
                    bgcolor: viewMode === mode ? 'rgba(255,255,255,0.12)' : 'transparent',
                    color: viewMode === mode ? 'white' : 'rgba(255,255,255,0.4)',
                    transition: 'all 0.15s ease',
                    userSelect: 'none',
                    '&:hover': { color: viewMode === mode ? 'white' : 'rgba(255,255,255,0.65)' },
                  }}>
                    {mode === 'flat' ? 'Lista' : 'Agrupado'}
                  </Box>
                ))}
              </Box>

              <Tooltip title="Atualizar">
                <IconButton size="small" onClick={handleRefresh}
                  sx={{ border: '1px solid rgba(255,255,255,0.12)', borderRadius: '9px', p: 0.75, color: 'rgba(255,255,255,0.5)', '&:hover': { color: 'white', borderColor: 'rgba(255,255,255,0.28)', bgcolor: 'rgba(255,255,255,0.06)' } }}>
                  <RefreshIcon sx={{ fontSize: 18 }} />
                </IconButton>
              </Tooltip>
            </Box>
          </Box>
        </motion.div>

        {/* ── Navegador de mês — compartilhado com Registros ── */}
        <motion.div initial={{ opacity: 0, y: 10 }} animate={{ opacity: 1, y: 0 }} transition={{ duration: 0.3, delay: 0.03 }} style={{ flexShrink: 0 }}>
          <Box sx={{ borderRadius: 2, background: 'rgba(255,255,255,0.06)', backdropFilter: 'blur(20px)', border: '1px solid rgba(255,255,255,0.1)' }}>
            <MonthNavigator accentColor="#f59e0b" />
          </Box>
        </motion.div>

        {/* ── Aviso de janela expandida (mês atual sem pendências) ── */}
        {janelaExpandida && (
          <motion.div initial={{ opacity: 0, y: 8 }} animate={{ opacity: 1, y: 0 }} transition={{ duration: 0.25 }} style={{ flexShrink: 0 }}>
            <Alert
              icon={<HistoryIcon sx={{ fontSize: 18 }} />}
              severity="info"
              sx={{ background: 'rgba(245,158,11,0.1)', border: '1px solid rgba(245,158,11,0.3)', color: 'rgba(255,237,213,0.9)', '& .MuiAlert-icon': { color: '#f59e0b' }, borderRadius: 2, py: 0.75 }}
            >
              <strong>{MESES[mes - 1]} {ano}</strong> ainda não tem pendências — mostrando também{' '}
              <strong>{formatDate(janelaExpandida.inicio)} até {formatDate(janelaExpandida.fim)}</strong> (fechamento do mês anterior).
            </Alert>
          </motion.div>
        )}

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

        {/* ── Conteúdo ── */}
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
                    {viewMode === 'grouped' && grouped.length > 0 && (
                      <Typography component="span" sx={{ fontWeight: 400, fontSize: 12, color: 'rgba(255,255,255,0.4)', ml: 1 }}>
                        — {grouped.length} funcionário{grouped.length !== 1 ? 's' : ''}
                      </Typography>
                    )}
                  </Typography>
                  <Typography sx={{ fontSize: 11.5, color: 'rgba(255,255,255,0.3)' }}>
                    {janelaExpandida
                      ? `${formatDate(janelaExpandida.inicio)} – ${formatDate(janelaExpandida.fim)}`
                      : `${MESES[mes - 1]} ${ano}`}
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
                ) : viewMode === 'grouped' ? (
                  /* ── Vista agrupada por funcionário ── */
                  <Box sx={{ flex: 1, overflow: 'auto' }}>
                    {grouped.map((group, idx) => (
                      <EmployeeGroupSection
                        key={group.id}
                        group={group}
                        defaultExpanded={idx === 0}
                        confirmedProximos={confirmedProximos}
                        onOpen={openDrawer}
                        onConfirmar={handleConfirmarCorreto}
                        onStartQueue={startGroupQueue}
                      />
                    ))}
                  </Box>
                ) : (
                  /* ── Vista lista plana ── */
                  <TableContainer sx={{ flex: 1, overflow: 'auto', bgcolor: 'transparent' }}>
                    <Table size="small" stickyHeader>
                      <TableHead>
                        <TableRow>
                          {TABLE_HEADERS.map(h => (
                            <TableCell key={h} sx={{ bgcolor: 'rgba(10,22,66,0.9)' }}>{h}</TableCell>
                          ))}
                        </TableRow>
                      </TableHead>
                      <TableBody>
                        {visible.map((s, idx) => (
                          <ProblemRow
                            key={`${s.employee_id}-${s.date || s.data}-${idx}`}
                            s={s} idx={idx}
                            confirmedProximos={confirmedProximos}
                            onOpen={openDrawer}
                            onConfirmar={handleConfirmarCorreto}
                          />
                        ))}
                      </TableBody>
                    </Table>
                  </TableContainer>
                )}
              </CardContent>
            </Card>
          )}
        </motion.div>
      </Box>

      {/* ── Drawer com navegação em fila (Opção B) ── */}
      <CorrecaoDrawer
        target={drawerTarget}
        onClose={() => { setDrawerTarget(null); handleRefresh(); }}
        onRefresh={() => { setDrawerTarget(null); handleRefresh(); }}
        onConfirmarCorreto={handleConfirmarCorreto}
        queue={drawerQueue.length > 1 ? drawerQueue : undefined}
        queueIndex={drawerQueueIndex >= 0 ? drawerQueueIndex : 0}
        onNavigate={(t) => setDrawerTarget(t)}
      />
    </PageLayout>
  );
}
