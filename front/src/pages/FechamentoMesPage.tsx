import React, { useState, useCallback, useMemo } from 'react';
import {
  Box, Typography, Card, CardContent, Chip, CircularProgress,
  Avatar, Button, Select, MenuItem, FormControl, Alert, LinearProgress,
  IconButton, Tooltip,
} from '@mui/material';
import {
  CheckCircle as CheckCircleIcon,
  Refresh as RefreshIcon,
  PlayArrow as PlayArrowIcon,
  TaskAlt as TaskAltIcon,
} from '@mui/icons-material';
import { motion, AnimatePresence } from 'framer-motion';
import PageLayout from '../sections/PageLayout';
import { getDailySummaries } from '../services/dailySummaryService';
import CorrecaoDrawer, { type DrawerTarget } from '../components/CorrecaoDrawer';
import {
  formatDate,
  getDiaSemana,
  getDisplayStatus,
  rowToDrawerTarget,
} from './CorrecaoPage';

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
  INCOMPLETO:    { label: 'Incompleto', color: '#eab308', bg: 'rgba(234,179,8,0.12)',   border: 'rgba(234,179,8,0.35)' },
  INCOMPLETE:    { label: 'Incompleto', color: '#eab308', bg: 'rgba(234,179,8,0.12)',   border: 'rgba(234,179,8,0.35)' },
  FALTA:         { label: 'Falta',      color: '#ef4444', bg: 'rgba(239,68,68,0.12)',   border: 'rgba(239,68,68,0.35)' },
  ABSENT:        { label: 'Falta',      color: '#ef4444', bg: 'rgba(239,68,68,0.12)',   border: 'rgba(239,68,68,0.35)' },
  ATRASO:        { label: 'Atraso',     color: '#f59e0b', bg: 'rgba(245,158,11,0.12)',  border: 'rgba(245,158,11,0.35)' },
  LATE:          { label: 'Atraso',     color: '#f59e0b', bg: 'rgba(245,158,11,0.12)',  border: 'rgba(245,158,11,0.35)' },
  MISSING_EXIT:  { label: 'Sem saída',  color: '#f97316', bg: 'rgba(249,115,22,0.12)',  border: 'rgba(249,115,22,0.35)' },
  PROXIMOS:      { label: 'Próximos',   color: '#a78bfa', bg: 'rgba(167,139,250,0.12)', border: 'rgba(167,139,250,0.35)' },
};

// ─── Helpers ──────────────────────────────────────────────────────────────────

function getPeriodo(year: number, month: number) {
  const inicio = `${year}-${String(month).padStart(2, '0')}-01`;
  const lastDay = new Date(year, month, 0).getDate();
  const fim = `${year}-${String(month).padStart(2, '0')}-${lastDay}`;
  return { inicio, fim };
}

function normalizeStatus(raw: any): string {
  return String(raw?.status || raw || '').toUpperCase().replace(/-/g, '_');
}

function detectarProximos(s: any): boolean {
  return s.registros_proximos === true;
}

function nomeInicial(nome: string): string {
  return nome.split(' ').map(w => w[0]).slice(0, 2).join('').toUpperCase();
}

interface EmployeeGroup {
  id: string;
  name: string;
  items: any[];
  counts: Record<string, number>;
  dominantColor: string;
}

// ─── Card de funcionário ──────────────────────────────────────────────────────

function EmployeeCard({ group, isReviewed, onStart }: {
  group: EmployeeGroup;
  isReviewed: boolean;
  onStart: () => void;
}) {
  const { name, items, counts, dominantColor } = group;
  const total = items.length;

  return (
    <motion.div
      layout
      initial={{ opacity: 0, y: 12, scale: 0.97 }}
      animate={{ opacity: 1, y: 0, scale: 1 }}
      transition={{ duration: 0.25 }}
    >
      <Card sx={{
        position: 'relative', overflow: 'hidden',
        border: isReviewed
          ? '1px solid rgba(16,185,129,0.35)'
          : `1px solid ${dominantColor}28`,
        background: isReviewed
          ? 'rgba(16,185,129,0.06)'
          : 'rgba(255,255,255,0.07)',
        transition: 'border-color 0.3s ease, background 0.3s ease',
        '&:hover': { transform: 'none' },
      }}>
        {/* Barra de acento lateral */}
        <Box sx={{
          position: 'absolute', left: 0, top: 0, bottom: 0, width: 3,
          background: isReviewed
            ? 'linear-gradient(180deg, #10b981, #059669)'
            : `linear-gradient(180deg, ${dominantColor}, ${dominantColor}55)`,
          transition: 'background 0.3s ease',
        }} />

        <CardContent sx={{ pl: 3 }}>
          {/* Header do card */}
          <Box sx={{ display: 'flex', alignItems: 'flex-start', gap: 1.5, mb: 1.5 }}>
            <Avatar sx={{
              width: 44, height: 44, flexShrink: 0,
              background: isReviewed
                ? 'linear-gradient(135deg, rgba(16,185,129,0.3), rgba(16,185,129,0.1))'
                : `linear-gradient(135deg, ${dominantColor}40, ${dominantColor}15)`,
              border: isReviewed
                ? '1.5px solid rgba(16,185,129,0.4)'
                : `1.5px solid ${dominantColor}40`,
              fontSize: 14, fontWeight: 800,
              color: isReviewed ? '#34d399' : dominantColor,
              transition: 'all 0.3s ease',
            }}>
              {nomeInicial(name)}
            </Avatar>
            <Box sx={{ flex: 1, minWidth: 0 }}>
              <Typography noWrap sx={{ fontWeight: 700, fontSize: 14, color: 'rgba(255,255,255,0.9)', lineHeight: 1.3 }}>
                {name.split(' ').slice(0, 2).join(' ')}
              </Typography>
              {isReviewed ? (
                <Box sx={{ display: 'flex', alignItems: 'center', gap: 0.5, mt: 0.25 }}>
                  <TaskAltIcon sx={{ fontSize: 13, color: '#34d399' }} />
                  <Typography sx={{ fontSize: 11.5, color: '#34d399', fontWeight: 600 }}>
                    Revisado
                  </Typography>
                </Box>
              ) : (
                <Typography sx={{ fontSize: 11.5, color: 'rgba(255,255,255,0.4)', mt: 0.25 }}>
                  {total} pendência{total !== 1 ? 's' : ''} este mês
                </Typography>
              )}
            </Box>
          </Box>

          {/* Número grande de pendências / check */}
          {isReviewed ? (
            <Box sx={{ textAlign: 'center', py: 1 }}>
              <CheckCircleIcon sx={{ fontSize: 40, color: '#34d399', opacity: 0.7 }} />
            </Box>
          ) : (
            <>
              <Box sx={{ textAlign: 'center', py: 0.5 }}>
                <Typography sx={{
                  fontSize: 52, fontWeight: 900, lineHeight: 1,
                  color: dominantColor,
                  textShadow: `0 0 40px ${dominantColor}40`,
                  fontVariantNumeric: 'tabular-nums',
                }}>
                  {total}
                </Typography>
                <Typography sx={{ fontSize: 11, color: 'rgba(255,255,255,0.35)', textTransform: 'uppercase', letterSpacing: '0.08em', mt: 0.25 }}>
                  pendência{total !== 1 ? 's' : ''}
                </Typography>
              </Box>

              {/* Breakdown por tipo */}
              <Box sx={{ display: 'flex', flexWrap: 'wrap', gap: 0.5, mt: 1.25, mb: 1.5 }}>
                {Object.entries(counts).filter(([, v]) => v > 0).map(([st, count]) => {
                  const cfg = STATUS_CFG[st];
                  return (
                    <Box key={st} sx={{
                      px: 0.85, py: 0.2, borderRadius: '5px',
                      bgcolor: cfg?.bg, border: `1px solid ${cfg?.border}`,
                      display: 'flex', alignItems: 'center', gap: 0.4,
                    }}>
                      <Typography sx={{ fontSize: 10.5, fontWeight: 700, color: cfg?.color, fontVariantNumeric: 'tabular-nums' }}>
                        {count}× {cfg?.label ?? st}
                      </Typography>
                    </Box>
                  );
                })}
              </Box>
            </>
          )}

          {/* Botão CTA */}
          <Button
            fullWidth variant="outlined"
            startIcon={isReviewed ? <RefreshIcon sx={{ fontSize: 15 }} /> : <PlayArrowIcon sx={{ fontSize: 15 }} />}
            onClick={onStart}
            sx={{
              mt: isReviewed ? 1.5 : 0,
              fontSize: 12, fontWeight: 700, py: 0.75,
              borderColor: isReviewed ? 'rgba(16,185,129,0.3)' : `${dominantColor}35`,
              color: isReviewed ? '#34d399' : dominantColor,
              '&:hover': {
                borderColor: isReviewed ? 'rgba(16,185,129,0.6)' : `${dominantColor}70`,
                bgcolor: isReviewed ? 'rgba(16,185,129,0.07)' : `${dominantColor}0d`,
                transform: 'none',
                boxShadow: 'none',
              },
            }}
          >
            {isReviewed ? 'Revisar novamente' : `Corrigir ${total} registro${total !== 1 ? 's' : ''} →`}
          </Button>
        </CardContent>
      </Card>
    </motion.div>
  );
}

// ─── Página principal ─────────────────────────────────────────────────────────

export default function FechamentoMesPage() {
  const now = new Date();
  const defaultMes = now.getMonth() === 0 ? 12 : now.getMonth();
  const defaultAno = now.getMonth() === 0 ? now.getFullYear() - 1 : now.getFullYear();

  const [mes, setMes] = useState(defaultMes);
  const [ano, setAno] = useState(defaultAno);
  const [loading, setLoading] = useState(false);
  const [loaded, setLoaded] = useState(false);
  const [error, setError] = useState<string | null>(null);
  const [allRows, setAllRows] = useState<any[]>([]);
  const [reviewedIds, setReviewedIds] = useState<Set<string>>(new Set());

  const [drawerTarget, setDrawerTarget] = useState<DrawerTarget | null>(null);
  const [activeEmployeeId, setActiveEmployeeId] = useState<string | null>(null);
  const anos = Array.from({ length: 3 }, (_, i) => now.getFullYear() - i);
  const today = now.toISOString().slice(0, 10);

  // ── Fetch ──────────────────────────────────────────────────────────────────

  const loadData = useCallback(async () => {
    setLoading(true);
    setLoaded(false);
    setError(null);
    setAllRows([]);
    setReviewedIds(new Set());
    try {
      const { inicio, fim } = getPeriodo(ano, mes);
      const res = await getDailySummaries({ start_date: inicio, end_date: fim }, 1, 1000);
      const summaries: any[] = res?.summaries ?? [];

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

      setAllRows(problemas);
    } catch (err) {
      setError(err instanceof Error ? err.message : 'Erro ao carregar dados.');
    } finally {
      setLoading(false);
      setLoaded(true);
    }
  }, [mes, ano]);

  // ── Dados agrupados ────────────────────────────────────────────────────────

  const employeeGroups = useMemo<EmployeeGroup[]>(() => {
    const map = new Map<string, { name: string; items: any[] }>();
    for (const row of allRows) {
      const id = row.employee_id || row.funcionario_id || '';
      const name = row.employee_name || row.nome || '—';
      if (!map.has(id)) map.set(id, { name, items: [] });
      map.get(id)!.items.push(row);
    }
    return [...map.entries()]
      .map(([id, { name, items }]) => {
        const counts: Record<string, number> = { INCOMPLETO: 0, FALTA: 0, ATRASO: 0, MISSING_EXIT: 0, PROXIMOS: 0 };
        for (const s of items) {
          const st = getDisplayStatus(s);
          if (st === 'INCOMPLETO' || st === 'INCOMPLETE') counts.INCOMPLETO++;
          else if (st === 'FALTA' || st === 'ABSENT') counts.FALTA++;
          else if (st === 'ATRASO' || st === 'LATE') counts.ATRASO++;
          else if (st === 'MISSING_EXIT') counts.MISSING_EXIT++;
          else if (st === 'PROXIMOS') counts.PROXIMOS++;
        }
        const dominant = Object.entries(counts).sort((a, b) => b[1] - a[1])[0]?.[0] ?? 'INCOMPLETO';
        const dominantColor = STATUS_CFG[dominant]?.color ?? '#eab308';
        return { id, name, items, counts, dominantColor };
      })
      .sort((a, b) => b.items.length - a.items.length);
  }, [allRows]);

  // Fila do funcionário ativo
  const activeQueue = useMemo<DrawerTarget[]>(() => {
    if (!activeEmployeeId) return [];
    const group = employeeGroups.find(g => g.id === activeEmployeeId);
    if (!group) return [];
    return group.items.map(rowToDrawerTarget);
  }, [activeEmployeeId, employeeGroups]);

  const activeQueueIndex = drawerTarget && activeQueue.length > 0
    ? activeQueue.findIndex(t => t.date === drawerTarget.date)
    : -1;

  // ── Ações ──────────────────────────────────────────────────────────────────

  const startEmployeeQueue = (group: EmployeeGroup) => {
    setActiveEmployeeId(group.id);
    setDrawerTarget(rowToDrawerTarget(group.items[0]));
  };

  const handleDrawerClose = () => {
    // Marca como revisado se o funcionário tinha itens na fila
    if (activeEmployeeId) {
      setReviewedIds(prev => new Set([...prev, activeEmployeeId]));
    }
    setDrawerTarget(null);
    setActiveEmployeeId(null);
    // Re-fetch para atualizar contagens após correções
    loadData();
  };

  // Stats do topo
  const totalPendencias = allRows.length;
  const funcionariosAfetados = employeeGroups.length;
  const funcionariosRevisados = [...reviewedIds].filter(id => employeeGroups.some(g => g.id === id)).length;
  const progresso = funcionariosAfetados > 0 ? Math.round((funcionariosRevisados / funcionariosAfetados) * 100) : 0;

  // ─── UI ───────────────────────────────────────────────────────────────────

  return (
    <PageLayout>
      <Box sx={{ display: 'flex', flexDirection: 'column', gap: 3 }}>

        {/* ── Header ── */}
        <motion.div initial={{ opacity: 0, y: 10 }} animate={{ opacity: 1, y: 0 }} transition={{ duration: 0.3 }}>
          <Box sx={{ display: 'flex', alignItems: 'flex-start', justifyContent: 'space-between', flexWrap: 'wrap', gap: 2 }}>
            <Box>
              <Typography sx={{ color: 'rgba(255,255,255,0.4)', fontSize: 11, fontWeight: 600, letterSpacing: '0.09em', textTransform: 'uppercase', mb: 0.5 }}>
                Fechamento de Mês
              </Typography>
              <Typography variant="h4" sx={{ fontWeight: 800, color: 'white', lineHeight: 1.1, letterSpacing: '-0.02em' }}>
                {MESES[mes - 1]} {ano}
              </Typography>
              <Typography sx={{ color: 'rgba(255,255,255,0.4)', fontSize: 13, mt: 0.5 }}>
                Revise e corrija todos os registros antes de fechar o período.
              </Typography>
            </Box>

            <Box sx={{ display: 'flex', gap: 1, alignItems: 'center', flexWrap: 'wrap' }}>
              <FormControl size="small" sx={{ minWidth: { xs: '100%', sm: 130 } }}>
                <Select value={mes} onChange={e => { setMes(Number(e.target.value)); setLoaded(false); }} sx={{ fontSize: 13, height: 36 }}>
                  {MESES.map((m, i) => <MenuItem key={i + 1} value={i + 1}>{m}</MenuItem>)}
                </Select>
              </FormControl>

              <FormControl size="small" sx={{ minWidth: { xs: '100%', sm: 90 } }}>
                <Select value={ano} onChange={e => { setAno(Number(e.target.value)); setLoaded(false); }} sx={{ fontSize: 13, height: 36 }}>
                  {anos.map(y => <MenuItem key={y} value={y}>{y}</MenuItem>)}
                </Select>
              </FormControl>

              <Button
                variant="contained"
                onClick={loadData}
                disabled={loading}
                startIcon={loading ? <CircularProgress size={14} sx={{ color: 'white' }} /> : <RefreshIcon sx={{ fontSize: 16 }} />}
                sx={{ height: 36, fontSize: 13, fontWeight: 700, px: 2.5 }}
              >
                {loading ? 'Carregando...' : loaded ? 'Atualizar' : 'Carregar pendências'}
              </Button>
            </Box>
          </Box>
        </motion.div>

        {/* ── Erro ── */}
        {error && (
          <Alert severity="error" onClose={() => setError(null)}>{error}</Alert>
        )}

        {/* ── Stats + barra de progresso (só quando carregado) ── */}
        <AnimatePresence>
          {loaded && !loading && (
            <motion.div
              key="stats"
              initial={{ opacity: 0, y: 8 }}
              animate={{ opacity: 1, y: 0 }}
              exit={{ opacity: 0 }}
              transition={{ duration: 0.25 }}
            >
              <Card sx={{ '&:hover': { transform: 'none' } }}>
                <CardContent>
                  <Box sx={{ display: 'flex', gap: 3, flexWrap: 'wrap', alignItems: 'center' }}>
                    {/* Stats */}
                    <Box sx={{ display: 'flex', gap: 3, flex: 1, flexWrap: 'wrap' }}>
                      <Box>
                        <Typography sx={{ fontSize: 28, fontWeight: 900, color: totalPendencias > 0 ? '#f59e0b' : '#34d399', lineHeight: 1, fontVariantNumeric: 'tabular-nums' }}>
                          {totalPendencias}
                        </Typography>
                        <Typography sx={{ fontSize: 11, color: 'rgba(255,255,255,0.4)', textTransform: 'uppercase', letterSpacing: '0.07em' }}>
                          total de pendências
                        </Typography>
                      </Box>
                      <Box sx={{ width: 1, height: 40, bgcolor: 'rgba(255,255,255,0.07)', alignSelf: 'center' }} />
                      <Box>
                        <Typography sx={{ fontSize: 28, fontWeight: 900, color: 'rgba(255,255,255,0.85)', lineHeight: 1, fontVariantNumeric: 'tabular-nums' }}>
                          {funcionariosAfetados}
                        </Typography>
                        <Typography sx={{ fontSize: 11, color: 'rgba(255,255,255,0.4)', textTransform: 'uppercase', letterSpacing: '0.07em' }}>
                          funcionário{funcionariosAfetados !== 1 ? 's' : ''} com pendência
                        </Typography>
                      </Box>
                      <Box sx={{ width: 1, height: 40, bgcolor: 'rgba(255,255,255,0.07)', alignSelf: 'center' }} />
                      <Box>
                        <Typography sx={{ fontSize: 28, fontWeight: 900, color: '#34d399', lineHeight: 1, fontVariantNumeric: 'tabular-nums' }}>
                          {funcionariosRevisados}
                        </Typography>
                        <Typography sx={{ fontSize: 11, color: 'rgba(255,255,255,0.4)', textTransform: 'uppercase', letterSpacing: '0.07em' }}>
                          já revisado{funcionariosRevisados !== 1 ? 's' : ''}
                        </Typography>
                      </Box>
                    </Box>

                    {/* Barra de progresso */}
                    {funcionariosAfetados > 0 && (
                      <Box sx={{ minWidth: 180 }}>
                        <Box sx={{ display: 'flex', justifyContent: 'space-between', mb: 0.75 }}>
                          <Typography sx={{ fontSize: 11, color: 'rgba(255,255,255,0.4)', fontWeight: 600 }}>
                            Progresso da revisão
                          </Typography>
                          <Typography sx={{ fontSize: 11, fontWeight: 800, color: progresso === 100 ? '#34d399' : 'rgba(255,255,255,0.7)' }}>
                            {progresso}%
                          </Typography>
                        </Box>
                        <LinearProgress
                          variant="determinate"
                          value={progresso}
                          sx={{
                            height: 8, borderRadius: 99,
                            bgcolor: 'rgba(255,255,255,0.07)',
                            '& .MuiLinearProgress-bar': {
                              background: progresso === 100
                                ? 'linear-gradient(90deg, #10b981, #34d399)'
                                : 'linear-gradient(90deg, #2563eb, #6366f1)',
                              borderRadius: 99,
                            },
                          }}
                        />
                      </Box>
                    )}
                  </Box>
                </CardContent>
              </Card>
            </motion.div>
          )}
        </AnimatePresence>

        {/* ── Estado vazio (antes de carregar) ── */}
        {!loaded && !loading && (
          <motion.div initial={{ opacity: 0 }} animate={{ opacity: 1 }} transition={{ duration: 0.3 }}>
            <Box sx={{ textAlign: 'center', py: 8, color: 'rgba(255,255,255,0.25)' }}>
              <Typography sx={{ fontSize: 48, lineHeight: 1, mb: 1 }}>📋</Typography>
              <Typography sx={{ fontSize: 14, fontWeight: 600 }}>
                Selecione o mês e clique em "Carregar pendências"
              </Typography>
              <Typography sx={{ fontSize: 12.5, mt: 0.5 }}>
                Todos os registros com problema do período aparecerão aqui agrupados por funcionário.
              </Typography>
            </Box>
          </motion.div>
        )}

        {/* ── Loading ── */}
        {loading && (
          <Box sx={{ display: 'flex', alignItems: 'center', justifyContent: 'center', py: 8, gap: 2 }}>
            <CircularProgress size={36} sx={{ color: 'rgba(255,255,255,0.5)' }} />
            <Typography sx={{ color: 'rgba(255,255,255,0.4)', fontSize: 13 }}>
              Carregando registros de {MESES[mes - 1]} {ano}...
            </Typography>
          </Box>
        )}

        {/* ── Grid de funcionários ── */}
        <AnimatePresence>
          {loaded && !loading && employeeGroups.length === 0 && (
            <motion.div initial={{ opacity: 0, y: 8 }} animate={{ opacity: 1, y: 0 }} exit={{ opacity: 0 }}>
              <Box sx={{ textAlign: 'center', py: 8 }}>
                <CheckCircleIcon sx={{ fontSize: 56, color: '#34d399', mb: 1.5, opacity: 0.7 }} />
                <Typography variant="h5" sx={{ fontWeight: 800, color: '#34d399', mb: 0.75 }}>
                  Mês sem pendências!
                </Typography>
                <Typography sx={{ color: 'rgba(255,255,255,0.45)', fontSize: 13.5 }}>
                  Todos os registros de {MESES[mes - 1]} {ano} estão corretos.
                </Typography>
              </Box>
            </motion.div>
          )}
        </AnimatePresence>

        {loaded && !loading && employeeGroups.length > 0 && (
          <motion.div initial={{ opacity: 0, y: 10 }} animate={{ opacity: 1, y: 0 }} transition={{ duration: 0.3 }}>
            <Box sx={{
              display: 'grid',
              gridTemplateColumns: { xs: '1fr', sm: 'repeat(2, 1fr)', lg: 'repeat(3, 1fr)' },
              gap: 2,
            }}>
              {employeeGroups.map((group) => (
                <EmployeeCard
                  key={group.id}
                  group={group}
                  isReviewed={reviewedIds.has(group.id)}
                  onStart={() => startEmployeeQueue(group)}
                />
              ))}
            </Box>
          </motion.div>
        )}
      </Box>

      {/* ── Drawer em modo fila por funcionário ── */}
      <CorrecaoDrawer
        target={drawerTarget}
        onClose={handleDrawerClose}
        onRefresh={() => {}}
        queue={activeQueue.length > 1 ? activeQueue : undefined}
        queueIndex={activeQueueIndex >= 0 ? activeQueueIndex : 0}
        onNavigate={(t) => setDrawerTarget(t)}
      />
    </PageLayout>
  );
}
