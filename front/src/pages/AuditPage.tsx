import React, { useState, useEffect, useCallback } from 'react';
import PageLayout from '../sections/PageLayout';
import {
  Box, Card, CardContent, Typography, Button, Chip, IconButton,
  Table, TableBody, TableCell, TableContainer, TableHead, TableRow,
  TextField, Select, MenuItem, FormControl, InputLabel,
  Collapse, CircularProgress, Tooltip,
} from '@mui/material';
import {
  Search as SearchIcon, ExpandMore as ExpandMoreIcon,
  ExpandLess as ExpandLessIcon, Refresh as RefreshIcon,
} from '@mui/icons-material';
import { motion } from 'framer-motion';
import { apiService } from '../services/api';
import { AuditLog, AuditAction, AuditEntity } from '../types';

const ACTION_LABELS: Record<AuditAction, string> = {
  CREATE:     'Criação',
  EDIT:       'Edição',
  DELETE:     'Exclusão',
  ADJUST:     'Ajuste',
  INVALIDATE: 'Invalidação',
  LOGIN:      'Login',
  EXPORT:     'Exportação',
  CLOSE:      'Fechamento',
  PERMISSION: 'Permissão',
};

const ACTION_COLORS: Record<AuditAction, string> = {
  CREATE:     '#10b981',
  EDIT:       '#3b82f6',
  DELETE:     '#ef4444',
  ADJUST:     '#f59e0b',
  INVALIDATE: '#f97316',
  LOGIN:      '#6366f1',
  EXPORT:     '#06b6d4',
  CLOSE:      '#8b5cf6',
  PERMISSION: '#a78bfa',
};

const ENTITY_LABELS: Record<AuditEntity, string> = {
  EMPLOYEE: 'Funcionário',
  RECORD:   'Registro',
  USER:     'Usuário',
  CONFIG:   'Configuração',
  RH:       'RH / Folha',
};

function DiffViewer({ before, after }: { before?: Record<string, unknown>; after?: Record<string, unknown> }) {
  if (!before && !after) return null;
  const keys = Array.from(new Set([...Object.keys(before || {}), ...Object.keys(after || {})]));
  return (
    <Box sx={{ display: 'flex', gap: 2, flexWrap: 'wrap', mt: 1 }}>
      {before && (
        <Box sx={{ flex: 1, minWidth: 200 }}>
          <Typography variant="caption" sx={{ color: 'rgba(255,255,255,0.4)', fontWeight: 700, textTransform: 'uppercase', letterSpacing: '0.06em' }}>Antes</Typography>
          <Box sx={{ mt: 0.5, p: 1.5, borderRadius: 1, bgcolor: 'rgba(239,68,68,0.08)', border: '1px solid rgba(239,68,68,0.18)' }}>
            {keys.filter(k => before[k] !== undefined).map(k => (
              <Box key={k} sx={{ display: 'flex', gap: 1, mb: 0.3 }}>
                <Typography variant="caption" sx={{ color: 'rgba(255,255,255,0.4)', minWidth: 100 }}>{k}:</Typography>
                <Typography variant="caption" sx={{ color: 'rgba(239,68,68,0.9)', wordBreak: 'break-all' }}>
                  {JSON.stringify(before[k])}
                </Typography>
              </Box>
            ))}
          </Box>
        </Box>
      )}
      {after && (
        <Box sx={{ flex: 1, minWidth: 200 }}>
          <Typography variant="caption" sx={{ color: 'rgba(255,255,255,0.4)', fontWeight: 700, textTransform: 'uppercase', letterSpacing: '0.06em' }}>Depois</Typography>
          <Box sx={{ mt: 0.5, p: 1.5, borderRadius: 1, bgcolor: 'rgba(16,185,129,0.08)', border: '1px solid rgba(16,185,129,0.18)' }}>
            {keys.filter(k => after[k] !== undefined).map(k => (
              <Box key={k} sx={{ display: 'flex', gap: 1, mb: 0.3 }}>
                <Typography variant="caption" sx={{ color: 'rgba(255,255,255,0.4)', minWidth: 100 }}>{k}:</Typography>
                <Typography variant="caption" sx={{ color: 'rgba(16,185,129,0.9)', wordBreak: 'break-all' }}>
                  {JSON.stringify(after[k])}
                </Typography>
              </Box>
            ))}
          </Box>
        </Box>
      )}
    </Box>
  );
}

function LogRow({ log }: { log: AuditLog }) {
  const [expanded, setExpanded] = useState(false);
  const hasDiff = !!(log.before || log.after);
  const motivo = log.motivo || log.justificativa || (log.after as Record<string,unknown>)?.justificativa as string || (log.before as Record<string,unknown>)?.justificativa_ajuste as string || '';

  return (
    <>
      <TableRow
        hover
        sx={{ cursor: hasDiff || motivo ? 'pointer' : 'default' }}
        onClick={() => (hasDiff || motivo) && setExpanded(e => !e)}
      >
        <TableCell>
          <Typography variant="caption" sx={{ color: 'rgba(255,255,255,0.55)' }}>
            {new Date(log.created_at).toLocaleString('pt-BR')}
          </Typography>
        </TableCell>
        <TableCell>
          <Typography variant="body2" sx={{ color: 'rgba(255,255,255,0.8)', fontSize: '0.8rem' }}>
            {log.user_name || log.user_id}
          </Typography>
        </TableCell>
        <TableCell>
          <Chip
            label={ENTITY_LABELS[log.entity] || log.entity}
            size="small"
            sx={{ bgcolor: 'rgba(255,255,255,0.06)', color: 'rgba(255,255,255,0.6)', fontSize: '0.65rem' }}
          />
        </TableCell>
        <TableCell>
          <Chip
            label={ACTION_LABELS[log.action] || log.action}
            size="small"
            sx={{ bgcolor: `${ACTION_COLORS[log.action] || '#6b7280'}22`, color: ACTION_COLORS[log.action] || '#6b7280', fontWeight: 700, fontSize: '0.65rem' }}
          />
        </TableCell>
        <TableCell>
          <Typography variant="caption" sx={{ color: 'rgba(255,255,255,0.4)', fontFamily: 'monospace' }}>
            {log.entity_id}
          </Typography>
        </TableCell>
        <TableCell>
          {motivo && (
            <Typography variant="caption" sx={{ color: 'rgba(255,255,255,0.5)', fontStyle: 'italic', maxWidth: 160, display: 'block', overflow: 'hidden', textOverflow: 'ellipsis', whiteSpace: 'nowrap' }}>
              {motivo}
            </Typography>
          )}
        </TableCell>
        <TableCell align="right">
          {(hasDiff || motivo) && (
            <IconButton size="small" onClick={e => { e.stopPropagation(); setExpanded(x => !x); }}>
              {expanded ? <ExpandLessIcon sx={{ fontSize: 16 }} /> : <ExpandMoreIcon sx={{ fontSize: 16 }} />}
            </IconButton>
          )}
        </TableCell>
      </TableRow>
      {(hasDiff || motivo) && (
        <TableRow>
          <TableCell colSpan={7} sx={{ py: 0, border: 0 }}>
            <Collapse in={expanded} timeout="auto" unmountOnExit>
              <Box sx={{ py: 1.5, px: 2 }}>
                {motivo && (
                  <Box sx={{ mb: 1.5, p: 1.25, borderRadius: 1, bgcolor: 'rgba(245,158,11,0.08)', border: '1px solid rgba(245,158,11,0.2)' }}>
                    <Typography variant="caption" sx={{ color: 'rgba(255,255,255,0.4)', fontWeight: 700, textTransform: 'uppercase', letterSpacing: '0.06em', display: 'block' }}>Motivo</Typography>
                    <Typography variant="body2" sx={{ color: 'rgba(245,158,11,0.9)', mt: 0.25 }}>{motivo}</Typography>
                  </Box>
                )}
                <DiffViewer before={log.before} after={log.after} />
                {log.ip && (
                  <Typography variant="caption" sx={{ color: 'rgba(255,255,255,0.3)', mt: 1, display: 'block' }}>
                    IP: {log.ip} · {log.device}
                  </Typography>
                )}
              </Box>
            </Collapse>
          </TableCell>
        </TableRow>
      )}
    </>
  );
}

function currentMonthISO() {
  const now = new Date();
  return `${now.getFullYear()}-${String(now.getMonth() + 1).padStart(2, '0')}`;
}

function todayISO() {
  const now = new Date();
  return `${now.getFullYear()}-${String(now.getMonth() + 1).padStart(2, '0')}-${String(now.getDate()).padStart(2, '0')}`;
}

function firstDayOfMonthISO(yearMonth: string) {
  return `${yearMonth}-01`;
}

function lastDayOfMonthISO(yearMonth: string) {
  const [y, m] = yearMonth.split('-').map(Number);
  const last = new Date(y, m, 0).getDate();
  return `${yearMonth}-${String(last).padStart(2, '0')}`;
}

const AuditPage: React.FC = () => {
  const [logs, setLogs]         = useState<AuditLog[]>([]);
  const [loading, setLoading]   = useState(false);
  const [month, setMonth]       = useState(currentMonthISO());
  const [dateFrom, setDateFrom] = useState(firstDayOfMonthISO(currentMonthISO()));
  const [dateTo, setDateTo]     = useState(todayISO());
  const [action, setAction]     = useState('');
  const [entity, setEntity]     = useState('');

  const load = useCallback(async () => {
    setLoading(true);
    try {
      const { logs: data } = await apiService.getAuditLogs({
        date_from: dateFrom || undefined,
        date_to:   dateTo   || undefined,
        action:    action   || undefined,
        entity:    entity   || undefined,
        limit:     200,
      });
      setLogs(data);
    } catch {
      // toasted by interceptor
    } finally {
      setLoading(false);
    }
  }, [dateFrom, dateTo, action, entity]);

  useEffect(() => { load(); }, [load]);

  function handleMonthChange(m: string) {
    setMonth(m);
    setDateFrom(firstDayOfMonthISO(m));
    setDateTo(lastDayOfMonthISO(m));
  }

  return (
    <PageLayout>
      <motion.div initial={{ opacity: 0, y: 20 }} animate={{ opacity: 1, y: 0 }} transition={{ duration: 0.5 }}>
        <Box sx={{ mb: 4 }}>
          <Typography variant="h4" sx={{ fontWeight: 700, color: 'white', mb: 0.5 }}>Auditoria</Typography>
          <Typography variant="body2" sx={{ color: 'rgba(255,255,255,0.5)' }}>
            Histórico de todas as alterações realizadas na empresa
          </Typography>
        </Box>
      </motion.div>

      {/* Filtros */}
      <Card sx={{ mb: 3, background: 'rgba(255,255,255,0.06)', border: '1px solid rgba(255,255,255,0.1)' }}>
        <CardContent>
          <Box sx={{ display: 'flex', gap: 2, flexWrap: 'wrap', alignItems: 'flex-end' }}>
            <TextField
              label="Mês" type="month" value={month}
              onChange={e => handleMonthChange(e.target.value)}
              size="small" InputLabelProps={{ shrink: true }} sx={{ minWidth: 160 }}
            />
            <TextField
              label="Data inicial" type="date" value={dateFrom}
              onChange={e => { setDateFrom(e.target.value); setMonth(''); }}
              size="small" InputLabelProps={{ shrink: true }} sx={{ minWidth: 160 }}
            />
            <TextField
              label="Data final" type="date" value={dateTo}
              onChange={e => { setDateTo(e.target.value); setMonth(''); }}
              size="small" InputLabelProps={{ shrink: true }} sx={{ minWidth: 160 }}
            />
            <FormControl size="small" sx={{ minWidth: 150 }}>
              <InputLabel>Ação</InputLabel>
              <Select value={action} label="Ação" onChange={e => setAction(e.target.value)}>
                <MenuItem value="">Todas</MenuItem>
                {(Object.keys(ACTION_LABELS) as AuditAction[]).map(a => (
                  <MenuItem key={a} value={a}>{ACTION_LABELS[a]}</MenuItem>
                ))}
              </Select>
            </FormControl>
            <FormControl size="small" sx={{ minWidth: 150 }}>
              <InputLabel>Entidade</InputLabel>
              <Select value={entity} label="Entidade" onChange={e => setEntity(e.target.value)}>
                <MenuItem value="">Todas</MenuItem>
                {(Object.keys(ENTITY_LABELS) as AuditEntity[]).map(e => (
                  <MenuItem key={e} value={e}>{ENTITY_LABELS[e]}</MenuItem>
                ))}
              </Select>
            </FormControl>
            <Button variant="contained" startIcon={<SearchIcon />} onClick={load} disabled={loading}>
              Filtrar
            </Button>
            <Tooltip title="Recarregar">
              <IconButton onClick={load} disabled={loading} size="small">
                <RefreshIcon />
              </IconButton>
            </Tooltip>
          </Box>
        </CardContent>
      </Card>

      {/* Tabela */}
      <Card sx={{ background: 'rgba(255,255,255,0.06)', border: '1px solid rgba(255,255,255,0.1)' }}>
        <CardContent sx={{ p: '0 !important' }}>
          {loading ? (
            <Box sx={{ display: 'flex', justifyContent: 'center', py: 6 }}>
              <CircularProgress size={32} />
            </Box>
          ) : (
            <TableContainer>
              <Table size="small">
                <TableHead>
                  <TableRow>
                    <TableCell>Data/Hora</TableCell>
                    <TableCell>Usuário</TableCell>
                    <TableCell>Entidade</TableCell>
                    <TableCell>Ação</TableCell>
                    <TableCell>ID</TableCell>
                    <TableCell>Motivo</TableCell>
                    <TableCell />
                  </TableRow>
                </TableHead>
                <TableBody>
                  {logs.length === 0 ? (
                    <TableRow>
                      <TableCell colSpan={7} align="center" sx={{ py: 4, color: 'rgba(255,255,255,0.35)' }}>
                        Nenhum evento encontrado para os filtros selecionados
                      </TableCell>
                    </TableRow>
                  ) : (
                    logs.map(log => <LogRow key={`${log.log_id}-${log.created_at}`} log={log} />)
                  )}
                </TableBody>
              </Table>
            </TableContainer>
          )}
        </CardContent>
      </Card>
    </PageLayout>
  );
};

export default AuditPage;
