import React, { useState, useEffect, useCallback } from 'react';
import PageLayout from '../sections/PageLayout';
import {
  Box, Card, CardContent, Typography, Button, Chip, IconButton,
  TextField, Select, MenuItem, FormControl, InputLabel,
  CircularProgress, Tooltip, Dialog, DialogTitle, DialogContent,
  DialogActions, Divider, Avatar,
} from '@mui/material';
import {
  Search as SearchIcon, Refresh as RefreshIcon, Close as CloseIcon,
  History as HistoryIcon,
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

function extractTime(val?: unknown): string {
  if (!val || typeof val !== 'string') return '';
  const m = val.match(/(\d{2}:\d{2})/);
  return m ? m[1] : '';
}

function formatDateTime(iso: string): string {
  try {
    return new Date(iso).toLocaleString('pt-BR', {
      day: '2-digit', month: '2-digit', year: 'numeric',
      hour: '2-digit', minute: '2-digit',
    });
  } catch { return iso; }
}

function getMotivo(log: AuditLog): string {
  return (
    log.reason ||
    (log.after as Record<string, unknown>)?.justificativa as string ||
    (log.before as Record<string, unknown>)?.justificativa_ajuste as string ||
    log.motivo ||
    log.justificativa ||
    ''
  );
}

function getSummaryText(log: AuditLog): string {
  const who = log.user_name || log.user_id || 'Sistema';
  const emp = log.employee_name;

  const afterType = (log.after as Record<string, unknown>)?.type as string | undefined;
  const beforeType = (log.before as Record<string, unknown>)?.type as string | undefined;
  const reason = log.reason || '';

  switch (log.action) {
    case 'ADJUST':
      return emp ? `${who} ajustou um registro de ${emp}` : `${who} ajustou um registro`;
    case 'INVALIDATE':
      if (log.entity === 'RECORD') {
        const rtype = beforeType || '';
        if (rtype === 'ferias_folga') return emp ? `${who} desfez folga de ${emp}` : `${who} desfez folga`;
        if (rtype === 'atestado')     return emp ? `${who} desfez atestado de ${emp}` : `${who} desfez atestado`;
      }
      return emp ? `${who} invalidou um registro de ${emp}` : `${who} invalidou um registro`;
    case 'CREATE':
      if (log.entity === 'EMPLOYEE') return emp ? `${who} cadastrou ${emp}` : `${who} cadastrou funcionário`;
      if (log.entity === 'RECORD') {
        if (afterType === 'ferias_folga') return emp ? `${who} marcou folga/férias de ${emp}` : `${who} marcou folga/férias`;
        if (afterType === 'atestado')     return emp ? `${who} registrou atestado de ${emp}` : `${who} registrou atestado`;
        return emp ? `${who} adicionou registro manual de ${emp}` : `${who} adicionou registro manual`;
      }
      return `${who} criou ${ENTITY_LABELS[log.entity] || log.entity}`;
    case 'EDIT':
      if (log.entity === 'EMPLOYEE') return emp ? `${who} editou cadastro de ${emp}` : `${who} editou funcionário`;
      if (log.entity === 'RECORD' && reason.toLowerCase().includes('atestado'))
        return emp ? `${who} substituiu documento de atestado de ${emp}` : `${who} substituiu documento de atestado`;
      return `${who} editou ${ENTITY_LABELS[log.entity] || log.entity}`;
    case 'DELETE':
      return emp ? `${who} excluiu ${emp}` : `${who} excluiu ${ENTITY_LABELS[log.entity] || log.entity}`;
    case 'LOGIN':
      return `${who} fez login`;
    case 'EXPORT':
      return `${who} exportou relatório`;
    case 'CLOSE':
      return `${who} fechou competência`;
    case 'PERMISSION':
      return `${who} alterou permissões`;
    default:
      return `${who} — ${ACTION_LABELS[log.action] || log.action}`;
  }
}

function getTimeDiff(log: AuditLog): string | null {
  const b = log.before as Record<string, unknown> | undefined;
  const a = log.after as Record<string, unknown> | undefined;
  if (log.action === 'ADJUST') {
    const t1 = extractTime(b?.data_hora);
    const t2 = extractTime(a?.data_hora);
    if (t1 && t2 && t1 !== t2) return `${t1} → ${t2}`;
  }
  if (log.action === 'INVALIDATE') {
    const t = extractTime(b?.data_hora);
    if (t) return t;
  }
  return null;
}

function getOrigem(device?: string): string {
  if (!device) return 'Painel Administrativo';
  const d = device.toLowerCase();
  if (d.includes('mobile') || d.includes('android') || d.includes('ios')) return 'App Mobile';
  if (d.includes('postman') || d.includes('curl') || d.includes('python')) return 'API';
  return 'Painel Administrativo';
}

function initials(name: string): string {
  const parts = name.trim().split(' ').filter(Boolean);
  if (parts.length === 0) return '?';
  if (parts.length === 1) return parts[0].slice(0, 2).toUpperCase();
  return (parts[0][0] + parts[parts.length - 1][0]).toUpperCase();
}

// ---- Info Row ----
function InfoRow({ label, value, full }: { label: string; value: string; full?: boolean }) {
  return (
    <Box sx={{ gridColumn: full ? '1 / -1' : undefined }}>
      <Typography variant="caption" sx={{ color: 'rgba(255,255,255,0.35)', display: 'block', mb: 0.3 }}>
        {label}
      </Typography>
      <Typography variant="body2" sx={{ color: 'rgba(255,255,255,0.85)', fontWeight: 500, wordBreak: 'break-word' }}>
        {value || '-'}
      </Typography>
    </Box>
  );
}

// ---- Detail Modal ----
function DetailModal({ log, onClose }: { log: AuditLog | null; onClose: () => void }) {
  if (!log) return null;
  const motivo = getMotivo(log);
  const b = log.before as Record<string, unknown> | undefined;
  const a = log.after as Record<string, unknown> | undefined;
  const timeDiff = getTimeDiff(log);
  const color = ACTION_COLORS[log.action] || '#6b7280';

  return (
    <Dialog
      open={!!log}
      onClose={onClose}
      maxWidth="sm"
      fullWidth
      PaperProps={{
        sx: {
          background: 'rgba(15,15,25,0.97)',
          border: '1px solid rgba(255,255,255,0.1)',
          borderRadius: 2,
        },
      }}
    >
      <DialogTitle sx={{ pb: 1, display: 'flex', alignItems: 'center', gap: 1.5 }}>
        <Chip
          label={ACTION_LABELS[log.action] || log.action}
          size="small"
          sx={{ bgcolor: `${color}22`, color, fontWeight: 700, fontSize: '0.7rem', flexShrink: 0 }}
        />
        <Typography variant="h6" sx={{ color: '#fff', fontSize: '1rem', flex: 1, lineHeight: 1.3 }}>
          {getSummaryText(log)}
        </Typography>
        <IconButton size="small" onClick={onClose} sx={{ color: 'rgba(255,255,255,0.5)', flexShrink: 0 }}>
          <CloseIcon fontSize="small" />
        </IconButton>
      </DialogTitle>

      <DialogContent dividers sx={{ borderColor: 'rgba(255,255,255,0.1)' }}>
        <Box sx={{ display: 'flex', flexDirection: 'column', gap: 2 }}>
          {/* Destaque do horário alterado */}
          {timeDiff && (
            <Box
              sx={{
                p: 2, borderRadius: 1.5, textAlign: 'center',
                bgcolor: `${color}11`, border: `1px solid ${color}33`,
              }}
            >
              <Typography variant="caption" sx={{ color: 'rgba(255,255,255,0.4)', display: 'block', mb: 0.5 }}>
                {log.action === 'ADJUST' ? 'Horário alterado' : 'Horário'}
              </Typography>
              <Typography variant="h5" sx={{ color, fontWeight: 700, letterSpacing: 2 }}>
                {timeDiff}
              </Typography>
            </Box>
          )}

          {/* Grid de detalhes */}
          <Box sx={{ display: 'grid', gridTemplateColumns: '1fr 1fr', gap: 1.5 }}>
            {log.employee_name && <InfoRow label="Funcionário" value={log.employee_name} />}
            <InfoRow label="Alterado por" value={log.user_name || log.user_id} />
            <InfoRow label="Data / Hora" value={formatDateTime(log.created_at)} />
            <InfoRow label="Entidade" value={ENTITY_LABELS[log.entity] || log.entity} />
            <InfoRow label="Origem" value={getOrigem(log.device)} />
            {log.ip && <InfoRow label="IP" value={log.ip} />}
            {motivo && <InfoRow label="Motivo / Justificativa" value={motivo} full />}
          </Box>

          {/* Diff Antes/Depois */}
          {(b || a) && (
            <>
              <Divider sx={{ borderColor: 'rgba(255,255,255,0.08)' }} />
              <Box sx={{ display: 'flex', gap: 1.5, flexWrap: 'wrap' }}>
                {b && Object.keys(b).length > 0 && (
                  <Box sx={{ flex: 1, minWidth: 180 }}>
                    <Typography variant="caption" sx={{ color: 'rgba(255,255,255,0.4)', fontWeight: 700, textTransform: 'uppercase', letterSpacing: '0.08em', display: 'block', mb: 0.5 }}>
                      Antes
                    </Typography>
                    <Box sx={{ p: 1.25, borderRadius: 1, bgcolor: 'rgba(239,68,68,0.07)', border: '1px solid rgba(239,68,68,0.18)' }}>
                      {Object.entries(b).map(([k, v]) => (
                        <Box key={k} sx={{ display: 'flex', gap: 0.5, mb: 0.3 }}>
                          <Typography variant="caption" sx={{ color: 'rgba(255,255,255,0.35)', minWidth: 80 }}>{k}:</Typography>
                          <Typography variant="caption" sx={{ color: 'rgba(239,68,68,0.9)', wordBreak: 'break-all' }}>{String(v ?? '')}</Typography>
                        </Box>
                      ))}
                    </Box>
                  </Box>
                )}
                {a && Object.keys(a).length > 0 && (
                  <Box sx={{ flex: 1, minWidth: 180 }}>
                    <Typography variant="caption" sx={{ color: 'rgba(255,255,255,0.4)', fontWeight: 700, textTransform: 'uppercase', letterSpacing: '0.08em', display: 'block', mb: 0.5 }}>
                      Depois
                    </Typography>
                    <Box sx={{ p: 1.25, borderRadius: 1, bgcolor: 'rgba(16,185,129,0.07)', border: '1px solid rgba(16,185,129,0.18)' }}>
                      {Object.entries(a).map(([k, v]) => (
                        <Box key={k} sx={{ display: 'flex', gap: 0.5, mb: 0.3 }}>
                          <Typography variant="caption" sx={{ color: 'rgba(255,255,255,0.35)', minWidth: 80 }}>{k}:</Typography>
                          <Typography variant="caption" sx={{ color: 'rgba(16,185,129,0.9)', wordBreak: 'break-all' }}>{String(v ?? '')}</Typography>
                        </Box>
                      ))}
                    </Box>
                  </Box>
                )}
              </Box>
            </>
          )}
        </Box>
      </DialogContent>

      <DialogActions sx={{ px: 2, py: 1.5 }}>
        <Button onClick={onClose} size="small" sx={{ color: 'rgba(255,255,255,0.6)' }}>
          Fechar
        </Button>
      </DialogActions>
    </Dialog>
  );
}

// ---- Log Card ----
function LogCard({ log, onClick }: { log: AuditLog; onClick: () => void }) {
  const color = ACTION_COLORS[log.action] || '#6b7280';
  const summary = getSummaryText(log);
  const timeDiff = getTimeDiff(log);
  const motivo = getMotivo(log);
  const who = log.user_name || log.user_id || '';

  return (
    <Box
      onClick={onClick}
      sx={{
        display: 'flex', alignItems: 'flex-start', gap: 1.5, p: 2,
        borderRadius: 1.5, cursor: 'pointer',
        border: '1px solid rgba(255,255,255,0.07)',
        bgcolor: 'rgba(255,255,255,0.03)',
        transition: 'all 0.15s ease',
        '&:hover': { bgcolor: 'rgba(255,255,255,0.06)', borderColor: `${color}44` },
      }}
    >
      <Avatar
        sx={{
          bgcolor: `${color}22`, color, width: 36, height: 36,
          fontSize: '0.7rem', fontWeight: 700, flexShrink: 0, mt: 0.25,
        }}
      >
        {who ? initials(who) : '?'}
      </Avatar>

      <Box sx={{ flex: 1, minWidth: 0 }}>
        <Box sx={{ display: 'flex', alignItems: 'baseline', gap: 0.75, flexWrap: 'wrap', mb: 0.3 }}>
          <Typography variant="body2" sx={{ color: '#fff', fontWeight: 600, lineHeight: 1.4 }}>
            {summary}
          </Typography>
          {timeDiff && (
            <Typography
              variant="caption"
              sx={{
                color, fontWeight: 700, bgcolor: `${color}18`,
                borderRadius: 0.75, px: 0.75, py: 0.2,
                fontFamily: 'monospace', fontSize: '0.78rem', whiteSpace: 'nowrap',
              }}
            >
              {timeDiff}
            </Typography>
          )}
        </Box>
        <Typography variant="caption" sx={{ color: 'rgba(255,255,255,0.4)', lineHeight: 1.5 }}>
          {formatDateTime(log.created_at)}
          {motivo && (
            <>
              {' • '}
              <span style={{ fontStyle: 'italic' }}>
                {motivo.length > 70 ? motivo.slice(0, 70) + '…' : motivo}
              </span>
            </>
          )}
        </Typography>
      </Box>

      <Chip
        label={ACTION_LABELS[log.action] || log.action}
        size="small"
        sx={{ bgcolor: `${color}22`, color, fontWeight: 700, fontSize: '0.65rem', flexShrink: 0 }}
      />
    </Box>
  );
}

// ---- Helpers ----
function currentMonthISO() {
  const now = new Date();
  return `${now.getFullYear()}-${String(now.getMonth() + 1).padStart(2, '0')}`;
}
function firstDayOfMonthISO(ym: string) { return `${ym}-01`; }
function lastDayOfMonthISO(ym: string) {
  const [y, m] = ym.split('-').map(Number);
  const last = new Date(y, m, 0).getDate();
  return `${ym}-${String(last).padStart(2, '0')}`;
}
function todayISO() {
  const n = new Date();
  return `${n.getFullYear()}-${String(n.getMonth() + 1).padStart(2, '0')}-${String(n.getDate()).padStart(2, '0')}`;
}

// ---- Main Page ----
const AuditPage: React.FC = () => {
  const [logs, setLogs]                       = useState<AuditLog[]>([]);
  const [loading, setLoading]                 = useState(false);
  const [month, setMonth]                     = useState(currentMonthISO());
  const [dateFrom, setDateFrom]               = useState(firstDayOfMonthISO(currentMonthISO()));
  const [dateTo, setDateTo]                   = useState(todayISO());
  const [action, setAction]                   = useState('');
  const [filterEmployee, setFilterEmployee]   = useState('');
  const [filterChangedBy, setFilterChangedBy] = useState('');
  const [selectedLog, setSelectedLog]         = useState<AuditLog | null>(null);

  const load = useCallback(async () => {
    setLoading(true);
    try {
      const { logs: data } = await apiService.getAuditLogs({
        date_from: dateFrom || undefined,
        date_to:   dateTo   || undefined,
        action:    action   || undefined,
        limit:     200,
      });
      setLogs(data);
    } catch {
      // handled by interceptor
    } finally {
      setLoading(false);
    }
  }, [dateFrom, dateTo, action]);

  useEffect(() => { load(); }, [load]);

  function handleMonthChange(m: string) {
    setMonth(m);
    setDateFrom(firstDayOfMonthISO(m));
    setDateTo(lastDayOfMonthISO(m));
  }

  const displayed = logs.filter(log => {
    if (filterEmployee && !log.employee_name?.toLowerCase().includes(filterEmployee.toLowerCase())) return false;
    if (filterChangedBy && !log.user_name?.toLowerCase().includes(filterChangedBy.toLowerCase())) return false;
    return true;
  });

  return (
    <PageLayout>
      <motion.div initial={{ opacity: 0, y: 20 }} animate={{ opacity: 1, y: 0 }} transition={{ duration: 0.5 }}>
        <Box sx={{ mb: 4, display: 'flex', alignItems: 'center', gap: 1.5 }}>
          <HistoryIcon sx={{ color: 'rgba(255,255,255,0.45)', fontSize: 30 }} />
          <Box>
            <Typography variant="h4" sx={{ fontWeight: 700, color: 'white', mb: 0.25 }}>
              Histórico de Alterações
            </Typography>
            <Typography variant="body2" sx={{ color: 'rgba(255,255,255,0.5)' }}>
              Todas as modificações realizadas na empresa
            </Typography>
          </Box>
        </Box>
      </motion.div>

      {/* Filtros */}
      <Card sx={{ mb: 3, background: 'rgba(255,255,255,0.06)', border: '1px solid rgba(255,255,255,0.1)' }}>
        <CardContent>
          <Box sx={{ display: 'flex', gap: 2, flexWrap: 'wrap', alignItems: 'flex-end' }}>
            <TextField
              label="Mês" type="month" value={month}
              onChange={e => handleMonthChange(e.target.value)}
              size="small" InputLabelProps={{ shrink: true }} sx={{ minWidth: 150 }}
            />
            <TextField
              label="Data inicial" type="date" value={dateFrom}
              onChange={e => { setDateFrom(e.target.value); setMonth(''); }}
              size="small" InputLabelProps={{ shrink: true }} sx={{ minWidth: 150 }}
            />
            <TextField
              label="Data final" type="date" value={dateTo}
              onChange={e => { setDateTo(e.target.value); setMonth(''); }}
              size="small" InputLabelProps={{ shrink: true }} sx={{ minWidth: 150 }}
            />
            <TextField
              label="Funcionário" value={filterEmployee}
              onChange={e => setFilterEmployee(e.target.value)}
              size="small" placeholder="Filtrar por nome..." sx={{ minWidth: 180 }}
            />
            <TextField
              label="Alterado por" value={filterChangedBy}
              onChange={e => setFilterChangedBy(e.target.value)}
              size="small" placeholder="Filtrar por usuário..." sx={{ minWidth: 180 }}
            />
            <FormControl size="small" sx={{ minWidth: 160 }}>
              <InputLabel>Tipo de evento</InputLabel>
              <Select value={action} label="Tipo de evento" onChange={e => setAction(e.target.value)}>
                <MenuItem value="">Todos</MenuItem>
                {(Object.keys(ACTION_LABELS) as AuditAction[]).map(a => (
                  <MenuItem key={a} value={a}>{ACTION_LABELS[a]}</MenuItem>
                ))}
              </Select>
            </FormControl>
            <Button
              variant="contained"
              startIcon={<SearchIcon />}
              onClick={load}
              disabled={loading}
              sx={{
                background: 'linear-gradient(135deg, #667eea 0%, #764ba2 100%)',
                '&:hover': { background: 'linear-gradient(135deg, #764ba2 0%, #667eea 100%)' },
              }}
            >
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

      {/* Contador */}
      {!loading && (
        <Typography variant="caption" sx={{ color: 'rgba(255,255,255,0.35)', mb: 1.5, display: 'block' }}>
          {displayed.length} {displayed.length === 1 ? 'evento' : 'eventos'} encontrado{displayed.length !== 1 ? 's' : ''}
        </Typography>
      )}

      {/* Lista */}
      <Card sx={{ background: 'rgba(255,255,255,0.04)', border: '1px solid rgba(255,255,255,0.08)' }}>
        <CardContent sx={{ p: '12px !important' }}>
          {loading ? (
            <Box sx={{ display: 'flex', justifyContent: 'center', py: 6 }}>
              <CircularProgress size={32} />
            </Box>
          ) : displayed.length === 0 ? (
            <Box sx={{ py: 6, textAlign: 'center' }}>
              <HistoryIcon sx={{ fontSize: 48, color: 'rgba(255,255,255,0.15)', mb: 1, display: 'block', mx: 'auto' }} />
              <Typography sx={{ color: 'rgba(255,255,255,0.35)' }}>
                Nenhum evento encontrado para os filtros selecionados
              </Typography>
            </Box>
          ) : (
            <Box sx={{ display: 'flex', flexDirection: 'column', gap: 0.75 }}>
              {displayed.map(log => (
                <LogCard
                  key={`${log.log_id}-${log.created_at}`}
                  log={log}
                  onClick={() => setSelectedLog(log)}
                />
              ))}
            </Box>
          )}
        </CardContent>
      </Card>

      <DetailModal log={selectedLog} onClose={() => setSelectedLog(null)} />
    </PageLayout>
  );
};

export default AuditPage;
