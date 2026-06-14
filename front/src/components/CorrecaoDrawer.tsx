import React, { useState, useEffect } from 'react';
import {
  Drawer, Box, Typography, IconButton, Divider,
  Button, TextField, CircularProgress, Chip, Tooltip,
} from '@mui/material';
import {
  Close as CloseIcon,
  Add as AddIcon,
  Edit as EditIcon,
  Delete as DeleteIcon,
  Check as CheckIcon,
  ArrowBack as BackIcon,
  WarningAmber as WarningIcon,
} from '@mui/icons-material';
import { toast } from 'react-hot-toast';
import { apiService } from '../services/api';
import { getDayDetails } from '../services/dailySummaryService';

// ─── Tipos públicos ───────────────────────────────────────────────────────────

export interface DrawerTarget {
  employee_id: string;
  employee_name: string;
  date: string;           // YYYY-MM-DD
  dateLabel: string;      // DD/MM/YYYY
  diaSemana: string;
  statusLabel: string;
  intervaloAutomatico: boolean; // false = 4 pontos obrigatórios
}

interface IndividualRecord {
  registro_id?: string;
  id?: string;
  data_hora: string;
  tipo?: string;
  type?: string;
  method?: string;
  metodo?: string;
  status?: string;
}

type Mode = 'view' | 'add' | 'edit' | 'remove';

// ─── Helpers ─────────────────────────────────────────────────────────────────

const TIPOS_LABEL: Record<string, string> = {
  entrada: 'Entrada',
  saida_almoco: 'Saída Almoço',
  retorno_almoco: 'Volta Almoço',
  'saída': 'Saída',
  saida: 'Saída',
  revisao: 'Revisão',
};

const STATUS_INATIVO = new Set(['INVALIDADO', 'AJUSTADO', 'CANCELADO']);

/**
 * Determina o próximo tipo de registro baseado na sequência real do dia.
 * - intervaloAutomatico=false → 4 pontos: entrada→saida_almoco→retorno_almoco→saída
 * - intervaloAutomatico=true  → 2 pontos: entrada→saída
 */
function calcularTipoAuto(
  records: IndividualRecord[],
  intervaloAutomatico: boolean,
): string {
  const ativos = records
    .filter(r => !STATUS_INATIVO.has(String(r.status || '').toUpperCase()))
    .sort((a, b) => (a.data_hora || '').localeCompare(b.data_hora || ''));

  const n = ativos.length;

  if (intervaloAutomatico) {
    if (n === 0) return 'entrada';
    const ultimoTipo = (ativos[n - 1].tipo || ativos[n - 1].type || '').toLowerCase().trim();
    return ultimoTipo === 'entrada' ? 'saída' : 'entrada';
  }

  // Inferência posicional: 0→entrada, 1→saida_almoco, 2→retorno_almoco, 3→saída, 4+→revisao
  switch (n) {
    case 0: return 'entrada';
    case 1: return 'saida_almoco';
    case 2: return 'retorno_almoco';
    case 3: return 'saída';
    default: return 'revisao';
  }
}

/** Retorna set de IDs de registros ativos que estão < minutos de outro */
function calcularProximos(records: IndividualRecord[], limitMin = 10): Set<string> {
  const validos = records.filter(r => !STATUS_INATIVO.has(String(r.status || '').toUpperCase()));
  const proximos = new Set<string>();
  for (let i = 0; i < validos.length; i++) {
    for (let j = i + 1; j < validos.length; j++) {
      try {
        const diff = Math.abs(new Date(validos[i].data_hora).getTime() - new Date(validos[j].data_hora).getTime()) / 60000;
        if (diff < limitMin) {
          proximos.add(validos[i].registro_id || validos[i].id || String(i));
          proximos.add(validos[j].registro_id || validos[j].id || String(j));
        }
      } catch { /* ignorar */ }
    }
  }
  return proximos;
}

function formatHora(dataHora: string): string {
  try {
    if (dataHora.includes('T')) {
      return new Date(dataHora).toLocaleTimeString('pt-BR', { hour: '2-digit', minute: '2-digit' });
    }
    return dataHora.slice(11, 16) || dataHora.slice(0, 5) || '--:--';
  } catch {
    return '--:--';
  }
}

function buildDataHora(data: string, hora: string): string {
  // Backend espera "YYYY-MM-DD HH:MM" com espaço (não ISO com T)
  return `${data} ${hora}`;
}

// ─── Componente ──────────────────────────────────────────────────────────────

interface Props {
  target: DrawerTarget | null;
  onClose: () => void;
  onRefresh: () => void;
  onConfirmarCorreto?: (key: string) => void;
}

export default function CorrecaoDrawer({ target, onClose, onRefresh, onConfirmarCorreto }: Props) {
  const [records, setRecords]       = useState<IndividualRecord[]>([]);
  const [loadingRecs, setLoadingRecs] = useState(false);

  const [mode, setMode]             = useState<Mode>('view');
  const [editingRec, setEditingRec] = useState<IndividualRecord | null>(null);
  const [hora, setHora]             = useState('');
  const [justificativa, setJust]    = useState('');
  const [saving, setSaving]         = useState(false);

  // Carrega registros individuais do dia quando o drawer abre
  useEffect(() => {
    if (!target) { setRecords([]); return; }
    setLoadingRecs(true);
    setMode('view');
    getDayDetails(target.employee_id, target.date)
      .then(res => setRecords(res.records ?? []))
      .catch(() => setRecords([]))
      .finally(() => setLoadingRecs(false));
  }, [target]);

  const reset = () => {
    setMode('view');
    setEditingRec(null);
    setHora('');
    setJust('');
  };

  const reloadRecords = () => {
    if (!target) return;
    setLoadingRecs(true);
    getDayDetails(target.employee_id, target.date)
      .then(res => setRecords(res.records ?? []))
      .catch(() => {})
      .finally(() => setLoadingRecs(false));
  };

  const startAdd = () => { reset(); setMode('add'); };
  const startEdit = (rec: IndividualRecord) => {
    setEditingRec(rec);
    setHora(formatHora(rec.data_hora));
    setJust('');
    setMode('edit');
  };
  const startRemove = (rec: IndividualRecord) => {
    setEditingRec(rec);
    setJust('');
    setMode('remove');
  };

  const handleAdd = async () => {
    if (!target) return;
    if (!hora) { toast.error('Informe o horário.'); return; }
    if (!justificativa.trim()) { toast.error('Informe a justificativa.'); return; }
    const tipoAuto = calcularTipoAuto(records, target.intervaloAutomatico);
    setSaving(true);
    try {
      await apiService.registerTimeManual({
        employee_id: target.employee_id,
        data_hora: buildDataHora(target.date, hora),
        tipo: tipoAuto,
        justificativa: justificativa.trim(),
      });
      toast.success('Registro adicionado.');
      reset();
      reloadRecords();
      onRefresh();
    } catch { /* toast no interceptor */ } finally { setSaving(false); }
  };

  const handleEdit = async () => {
    if (!editingRec || !target) return;
    if (!hora) { toast.error('Informe o horário.'); return; }
    if (!justificativa.trim()) { toast.error('Informe a justificativa.'); return; }
    const id = editingRec.registro_id || editingRec.id || '';
    setSaving(true);
    try {
      await apiService.adjustTimeRecord(id, {
        data_hora: buildDataHora(target.date, hora),
        justificativa: justificativa.trim(),
      });
      toast.success('Registro ajustado.');
      reset();
      reloadRecords();
      onRefresh();
    } catch { /* toast no interceptor */ } finally { setSaving(false); }
  };

  const handleRemove = async () => {
    if (!editingRec) return;
    if (!justificativa.trim()) { toast.error('Informe a justificativa.'); return; }
    const id = editingRec.registro_id || editingRec.id || '';
    setSaving(true);
    try {
      await apiService.invalidateTimeRecord(id, justificativa.trim());
      toast.success('Registro invalidado.');
      reset();
      reloadRecords();
      onRefresh();
    } catch { /* toast no interceptor */ } finally { setSaving(false); }
  };

  // ── Computed ────────────────────────────────────────────────────────────────

  const pontosProximos = calcularProximos(records);
  const tipoAuto = target ? calcularTipoAuto(records, target.intervaloAutomatico) : 'entrada';

  // ── Render ──────────────────────────────────────────────────────────────────

  return (
    <Drawer
      anchor="right"
      open={Boolean(target)}
      onClose={() => { reset(); onClose(); }}
      PaperProps={{
        sx: {
          width: { xs: '100%', sm: 420 },
          background: 'rgba(10,22,66,0.97)',
          backdropFilter: 'blur(32px)',
          WebkitBackdropFilter: 'blur(32px)',
          borderLeft: '1px solid rgba(255,255,255,0.1)',
        },
      }}
    >
      {!target ? null : (
        <Box sx={{ display: 'flex', flexDirection: 'column', height: '100%' }}>

          {/* ── Header ── */}
          <Box sx={{ px: 2.5, pt: 2.5, pb: 2, flexShrink: 0 }}>
            <Box sx={{ display: 'flex', alignItems: 'center', justifyContent: 'space-between', mb: 0.5 }}>
              {mode !== 'view' && (
                <IconButton size="small" onClick={reset} aria-label="Voltar" sx={{ mr: 1 }}>
                  <BackIcon sx={{ fontSize: 18 }} />
                </IconButton>
              )}
              <Box sx={{ flex: 1 }}>
                <Typography sx={{ fontWeight: 800, color: 'white', fontSize: 16, lineHeight: 1.2 }}>
                  {target.employee_name}
                </Typography>
                <Typography sx={{ color: 'rgba(255,255,255,0.4)', fontSize: 12, mt: 0.25 }}>
                  {target.dateLabel} · {target.diaSemana}
                </Typography>
              </Box>
              <IconButton size="small" onClick={() => { reset(); onClose(); }} aria-label="Fechar">
                <CloseIcon sx={{ fontSize: 18 }} />
              </IconButton>
            </Box>
            <Box sx={{ mt: 0.75 }}>
              <Chip
                label={target.statusLabel}
                size="small"
                sx={{ bgcolor: 'rgba(245,158,11,0.14)', color: '#fbbf24', border: '1px solid rgba(245,158,11,0.28)', fontSize: 11, height: 21 }}
              />
            </Box>
          </Box>

          <Divider sx={{ borderColor: 'rgba(255,255,255,0.07)' }} />

          {/* ── Body ── */}
          <Box sx={{ flex: 1, overflow: 'auto', px: 2.5, py: 2 }}>

            {/* VIEW: lista dos registros do dia */}
            {mode === 'view' && (
              <>
                <Typography sx={{ fontSize: 11, fontWeight: 700, color: 'rgba(255,255,255,0.28)', textTransform: 'uppercase', letterSpacing: '0.08em', mb: 1.25 }}>
                  Registros do dia
                </Typography>

                {loadingRecs ? (
                  <Box sx={{ display: 'flex', justifyContent: 'center', py: 3 }}>
                    <CircularProgress size={24} sx={{ color: 'rgba(255,255,255,0.4)' }} />
                  </Box>
                ) : records.length === 0 ? (
                  <Box sx={{ py: 3, textAlign: 'center' }}>
                    <Typography sx={{ color: 'rgba(255,255,255,0.25)', fontSize: 13, fontStyle: 'italic' }}>
                      Nenhum registro neste dia
                    </Typography>
                  </Box>
                ) : (
                  <>
                  {pontosProximos.size > 0 && (
                    <Box sx={{ mb: 1.5, px: 1.25, py: 0.9, borderRadius: '8px', bgcolor: 'rgba(251,191,36,0.08)', border: '1px solid rgba(251,191,36,0.25)', display: 'flex', alignItems: 'center', gap: 1 }}>
                      <WarningIcon sx={{ fontSize: 15, color: '#fbbf24', flexShrink: 0 }} />
                      <Typography sx={{ fontSize: 11.5, color: '#fbbf24' }}>
                        Registros muito próximos detectados (menos de 10 min de diferença)
                      </Typography>
                    </Box>
                  )}

                  <Box sx={{ display: 'flex', flexDirection: 'column', gap: 0.75, mb: 2 }}>
                    {records.map((rec, i) => {
                      const tipoLabel = TIPOS_LABEL[rec.tipo || rec.type || ''] || rec.tipo || rec.type || '—';
                      const horaFmt = formatHora(rec.data_hora);
                      const isInvalidado = String(rec.status || '').toUpperCase() === 'INVALIDADO';
                      const recKey = rec.registro_id || rec.id || String(i);
                      const isProximo = !isInvalidado && pontosProximos.has(recKey);
                      return (
                        <Box key={recKey} sx={{
                          display: 'flex', alignItems: 'center', gap: 1.25,
                          px: 1.5, py: 1,
                          borderRadius: '10px',
                          bgcolor: isInvalidado ? 'rgba(239,68,68,0.05)' : isProximo ? 'rgba(251,191,36,0.06)' : 'rgba(255,255,255,0.04)',
                          border: `1px solid ${isInvalidado ? 'rgba(239,68,68,0.2)' : isProximo ? 'rgba(251,191,36,0.3)' : 'rgba(255,255,255,0.07)'}`,
                          opacity: isInvalidado ? 0.5 : 1,
                        }}>
                          <Box sx={{
                            width: 38, height: 38, borderRadius: '9px',
                            bgcolor: isProximo ? 'rgba(251,191,36,0.12)' : 'rgba(59,130,246,0.12)',
                            border: `1px solid ${isProximo ? 'rgba(251,191,36,0.25)' : 'rgba(59,130,246,0.18)'}`,
                            display: 'flex', alignItems: 'center', justifyContent: 'center', flexShrink: 0,
                          }}>
                            <Typography sx={{ fontSize: 13, fontWeight: 700, color: isProximo ? '#fbbf24' : '#93c5fd', fontVariantNumeric: 'tabular-nums' }}>
                              {horaFmt}
                            </Typography>
                          </Box>
                          <Box sx={{ flex: 1 }}>
                            <Box sx={{ display: 'flex', alignItems: 'center', gap: 0.75 }}>
                              <Typography sx={{ fontSize: 13, fontWeight: 600, color: 'rgba(255,255,255,0.85)' }}>
                                {tipoLabel}
                              </Typography>
                              {isProximo && (
                                <Tooltip title="Registro muito próximo de outro (< 10 min)">
                                  <WarningIcon sx={{ fontSize: 13, color: '#fbbf24' }} />
                                </Tooltip>
                              )}
                            </Box>
                            {(rec.method || rec.metodo) && (
                              <Typography sx={{ fontSize: 10.5, color: 'rgba(255,255,255,0.3)' }}>
                                {rec.method || rec.metodo}
                                {isInvalidado && ' · Invalidado'}
                              </Typography>
                            )}
                          </Box>
                          {!isInvalidado && (
                            <Box sx={{ display: 'flex', gap: 0.5 }}>
                              <IconButton size="small" onClick={() => startEdit(rec)} aria-label="Editar"
                                sx={{ color: 'rgba(255,255,255,0.3)', '&:hover': { color: '#60a5fa', bgcolor: 'rgba(96,165,250,0.1)' } }}>
                                <EditIcon sx={{ fontSize: 15 }} />
                              </IconButton>
                              <IconButton size="small" onClick={() => startRemove(rec)} aria-label="Remover"
                                sx={{ color: 'rgba(255,255,255,0.3)', '&:hover': { color: '#f87171', bgcolor: 'rgba(248,113,113,0.1)' } }}>
                                <DeleteIcon sx={{ fontSize: 15 }} />
                              </IconButton>
                            </Box>
                          )}
                        </Box>
                      );
                    })}
                  </Box>
                  </>
                )}
              </>
            )}

            {/* ADD */}
            {mode === 'add' && (
              <>
                <Typography sx={{ fontSize: 11, fontWeight: 700, color: 'rgba(255,255,255,0.28)', textTransform: 'uppercase', letterSpacing: '0.08em', mb: 1.5 }}>
                  Adicionar registro
                </Typography>
                <Box sx={{ display: 'flex', flexDirection: 'column', gap: 1.5 }}>
                  <TextField label="Horário" type="time" value={hora} onChange={e => setHora(e.target.value)}
                    fullWidth size="small" InputLabelProps={{ shrink: true }} />
                  {(() => {
                    const TIPO_CFG: Record<string, { label: string; color: string; bg: string; border: string }> = {
                      'entrada':        { label: 'Entrada',       color: '#34d399', bg: 'rgba(16,185,129,0.14)', border: 'rgba(16,185,129,0.3)' },
                      'saida_almoco':   { label: 'Saída Almoço',  color: '#fb923c', bg: 'rgba(251,146,60,0.14)', border: 'rgba(251,146,60,0.3)' },
                      'retorno_almoco': { label: 'Volta Almoço',  color: '#38bdf8', bg: 'rgba(56,189,248,0.14)', border: 'rgba(56,189,248,0.3)' },
                      'saída':          { label: 'Saída',         color: '#f87171', bg: 'rgba(239,68,68,0.14)',  border: 'rgba(239,68,68,0.3)'  },
                      'revisao':        { label: 'Revisão',       color: '#a78bfa', bg: 'rgba(167,139,250,0.14)', border: 'rgba(167,139,250,0.3)' },
                    };
                    const cfg = TIPO_CFG[tipoAuto] ?? TIPO_CFG['entrada'];
                    return (
                      <Box sx={{ display: 'flex', alignItems: 'center', gap: 1, px: 1.25, py: 0.9, borderRadius: '8px', bgcolor: 'rgba(255,255,255,0.04)', border: '1px solid rgba(255,255,255,0.08)' }}>
                        <Typography sx={{ fontSize: 12, color: 'rgba(255,255,255,0.4)' }}>Tipo detectado:</Typography>
                        <Chip
                          label={cfg.label}
                          size="small"
                          sx={{ height: 20, fontSize: 11, fontWeight: 700, bgcolor: cfg.bg, color: cfg.color, border: `1px solid ${cfg.border}` }}
                        />
                        <Typography sx={{ fontSize: 10.5, color: 'rgba(255,255,255,0.25)', ml: 0.5 }}>
                          (automático)
                        </Typography>
                      </Box>
                    );
                  })()}
                  <TextField label="Justificativa" value={justificativa} onChange={e => setJust(e.target.value)}
                    fullWidth size="small" multiline rows={3} placeholder="Descreva o motivo da correção..." />
                </Box>
              </>
            )}

            {/* EDIT */}
            {mode === 'edit' && editingRec && (
              <>
                <Typography sx={{ fontSize: 11, fontWeight: 700, color: 'rgba(255,255,255,0.28)', textTransform: 'uppercase', letterSpacing: '0.08em', mb: 1.5 }}>
                  Editar registro
                </Typography>
                <Box sx={{ display: 'flex', flexDirection: 'column', gap: 1.5 }}>
                  <Box sx={{ px: 1.25, py: 0.9, borderRadius: '8px', bgcolor: 'rgba(255,255,255,0.04)', border: '1px solid rgba(255,255,255,0.08)' }}>
                    <Typography sx={{ fontSize: 11, color: 'rgba(255,255,255,0.3)', mb: 0.25 }}>Registro original</Typography>
                    <Typography sx={{ fontSize: 13, fontWeight: 600, color: 'rgba(255,255,255,0.7)' }}>
                      {TIPOS_LABEL[editingRec.tipo || editingRec.type || ''] || '—'} — {formatHora(editingRec.data_hora)}
                    </Typography>
                  </Box>
                  <TextField label="Novo horário" type="time" value={hora} onChange={e => setHora(e.target.value)}
                    fullWidth size="small" InputLabelProps={{ shrink: true }} />
                  <TextField label="Justificativa" value={justificativa} onChange={e => setJust(e.target.value)}
                    fullWidth size="small" multiline rows={3} placeholder="Descreva o motivo do ajuste..." />
                </Box>
              </>
            )}

            {/* REMOVE */}
            {mode === 'remove' && editingRec && (
              <>
                <Typography sx={{ fontSize: 11, fontWeight: 700, color: 'rgba(255,255,255,0.28)', textTransform: 'uppercase', letterSpacing: '0.08em', mb: 1.5 }}>
                  Invalidar registro
                </Typography>
                <Box sx={{ p: 1.5, borderRadius: '10px', bgcolor: 'rgba(239,68,68,0.07)', border: '1px solid rgba(239,68,68,0.18)', mb: 2 }}>
                  <Typography sx={{ fontSize: 13, color: 'rgba(255,255,255,0.7)' }}>
                    {TIPOS_LABEL[editingRec.tipo || editingRec.type || ''] || '—'} — {formatHora(editingRec.data_hora)}
                  </Typography>
                  <Typography sx={{ fontSize: 12, color: '#fca5a5', mt: 0.5 }}>
                    Este registro será marcado como invalidado.
                  </Typography>
                </Box>
                <TextField label="Justificativa" value={justificativa} onChange={e => setJust(e.target.value)}
                  fullWidth size="small" multiline rows={3} placeholder="Descreva o motivo da invalidação..." />
              </>
            )}
          </Box>

          {/* ── Footer ── */}
          <Box sx={{ px: 2.5, py: 2, borderTop: '1px solid rgba(255,255,255,0.07)', flexShrink: 0 }}>
            {mode === 'view' && (
              <Box sx={{ display: 'flex', flexDirection: 'column', gap: 1 }}>
                {pontosProximos.size > 0 && onConfirmarCorreto && (
                  <Button
                    fullWidth variant="outlined"
                    startIcon={<CheckIcon />}
                    onClick={() => {
                      if (!target) return;
                      onConfirmarCorreto(`${target.employee_id}|${target.date}`);
                      onClose();
                    }}
                    sx={{ borderColor: 'rgba(167,139,250,0.35)', color: '#a78bfa', '&:hover': { borderColor: 'rgba(167,139,250,0.6)', bgcolor: 'rgba(167,139,250,0.08)' } }}
                  >
                    Confirmar como correto
                  </Button>
                )}
                <Button fullWidth variant="outlined" startIcon={<AddIcon />} onClick={startAdd}
                  sx={{ borderColor: 'rgba(16,185,129,0.3)', color: '#34d399', '&:hover': { borderColor: 'rgba(16,185,129,0.5)', bgcolor: 'rgba(16,185,129,0.07)' } }}>
                  Adicionar registro
                </Button>
              </Box>
            )}
            {mode === 'add' && (
              <Box sx={{ display: 'flex', gap: 1 }}>
                <Button fullWidth variant="outlined" onClick={reset} disabled={saving}>Cancelar</Button>
                <Button fullWidth variant="contained" onClick={handleAdd} disabled={saving}
                  startIcon={saving ? <CircularProgress size={14} /> : <CheckIcon />}
                  sx={{ background: 'linear-gradient(135deg,#10b981,#059669)', '&:hover': { background: 'linear-gradient(135deg,#34d399,#10b981)' } }}>
                  Salvar
                </Button>
              </Box>
            )}
            {mode === 'edit' && (
              <Box sx={{ display: 'flex', gap: 1 }}>
                <Button fullWidth variant="outlined" onClick={reset} disabled={saving}>Cancelar</Button>
                <Button fullWidth variant="contained" onClick={handleEdit} disabled={saving}
                  startIcon={saving ? <CircularProgress size={14} /> : <CheckIcon />}>
                  Salvar ajuste
                </Button>
              </Box>
            )}
            {mode === 'remove' && (
              <Box sx={{ display: 'flex', gap: 1 }}>
                <Button fullWidth variant="outlined" onClick={reset} disabled={saving}>Cancelar</Button>
                <Button fullWidth variant="contained" onClick={handleRemove} disabled={saving}
                  startIcon={saving ? <CircularProgress size={14} /> : <DeleteIcon />}
                  sx={{ background: 'linear-gradient(135deg,#ef4444,#dc2626)', '&:hover': { background: 'linear-gradient(135deg,#f87171,#ef4444)' }, boxShadow: '0 4px 14px rgba(239,68,68,0.3)' }}>
                  Invalidar
                </Button>
              </Box>
            )}
          </Box>
        </Box>
      )}
    </Drawer>
  );
}
