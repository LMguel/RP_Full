import React, { useCallback, useEffect, useMemo, useState } from 'react';
import {
  Box,
  Button,
  Checkbox,
  Chip,
  CircularProgress,
  Collapse,
  TextField,
  Typography,
} from '@mui/material';
import {
  ContentPasteGo as PasteIcon,
  AutoFixHigh as ApplyIcon,
  CheckCircle as OkIcon,
  WarningAmber as WarnIcon,
} from '@mui/icons-material';
import { apiService } from '../services/api';
import type { LoteDiaEnvio, LoteDiaPrevia, LotePreviaResponse, LoteResultado } from '../types';
import {
  formatarDataBr,
  normalizarHhmm,
  parseHorariosColados,
  validarBatidasDia,
} from '../utils/batchRecords';

const ACCENT = '#f97316';

const fieldSx = {
  '& .MuiOutlinedInput-root': {
    color: 'white',
    background: 'rgba(255,255,255,0.05)',
    '& fieldset': { borderColor: 'rgba(255,255,255,0.2)' },
    '&:hover fieldset': { borderColor: 'rgba(255,255,255,0.4)' },
    '&.Mui-focused fieldset': { borderColor: ACCENT },
  },
  '& .MuiInputLabel-root': { color: 'rgba(255,255,255,0.6)', '&.Mui-focused': { color: ACCENT } },
  '& input[type="date"]::-webkit-calendar-picker-indicator': { filter: 'invert(1) brightness(0.7)' },
  '& input[type="time"]::-webkit-calendar-picker-indicator': { filter: 'invert(1) brightness(0.7)' },
};

const cellSx = {
  ...fieldSx,
  '& .MuiOutlinedInput-input': { py: 0.8, px: 1, fontSize: 13 },
};

interface Linha extends LoteDiaPrevia {
  incluir: boolean;
  celulas: string[]; // 2 (intervalo automático) ou 4 (intervalo manual)
}

const ROTULOS_4 = ['Entrada', 'Saída almoço', 'Volta almoço', 'Saída'];
const ROTULOS_2 = ['Entrada', 'Saída'];

const pad = (n: number) => String(n).padStart(2, '0');
const isoDe = (d: Date) => `${d.getFullYear()}-${pad(d.getMonth() + 1)}-${pad(d.getDate())}`;

function hojeSP(): Date {
  return new Date(new Date().toLocaleString('en-US', { timeZone: 'America/Sao_Paulo' }));
}

function diasEntre(inicio: string, fim: string): number {
  return Math.round((new Date(`${fim}T00:00:00`).getTime() - new Date(`${inicio}T00:00:00`).getTime()) / 86400000) + 1;
}

function celulasDoModelo(modelo: string[], colunas: number): string[] {
  return colunas === 2 ? [modelo[0], modelo[3]] : [...modelo];
}

const batidasDaLinha = (l: Linha) => l.celulas.map(c => c.trim()).filter(Boolean);

interface BatchRecordsPanelProps {
  employeeId: string;
  disabled: boolean;
  tentouEnviar: boolean;
  onChange: (dias: LoteDiaEnvio[], pendencias: number) => void;
}

const BatchRecordsPanel: React.FC<BatchRecordsPanelProps> = ({ employeeId, disabled, tentouEnviar, onChange }) => {
  const [inicio, setInicio] = useState('');
  const [fim, setFim] = useState('');
  const [carregando, setCarregando] = useState(false);
  const [erroCarga, setErroCarga] = useState('');
  const [previa, setPrevia] = useState<LotePreviaResponse | null>(null);
  const [linhas, setLinhas] = useState<Linha[]>([]);
  const [modelo, setModelo] = useState<string[]>(['', '', '', '']);
  const [colarAberto, setColarAberto] = useState(false);
  const [textoColado, setTextoColado] = useState('');
  const [avisoColar, setAvisoColar] = useState<{ ok: number; erros: string[] } | null>(null);

  const colunas = previa?.intervalo_automatico ? 2 : 4;
  const rotulos = colunas === 2 ? ROTULOS_2 : ROTULOS_4;

  // Período padrão: últimos 7 dias até hoje
  useEffect(() => {
    const hoje = hojeSP();
    const ini = new Date(hoje);
    ini.setDate(ini.getDate() - 6);
    setInicio(isoDe(ini));
    setFim(isoDe(hoje));
  }, []);

  const periodoValido = !!inicio && !!fim && fim >= inicio && diasEntre(inicio, fim) <= 62;

  // Carrega a grade (horário previsto + situação de cada dia) quando funcionário/período mudam
  useEffect(() => {
    setPrevia(null);
    setLinhas([]);
    setErroCarga('');
    setAvisoColar(null);
    if (!employeeId || !periodoValido) return;

    let cancelado = false;
    setCarregando(true);
    apiService
      .getPontoLotePrevia({ employee_id: employeeId, data_inicio: inicio, data_fim: fim })
      .then(resp => {
        if (cancelado) return;
        const cols = resp.intervalo_automatico ? 2 : 4;
        const primeiro = resp.dias.find(d => d.tem_escala);
        const mod = ['', '', '', ''];
        mod[0] = primeiro?.entrada_prevista?.slice(0, 5) ?? '';
        mod[3] = primeiro?.saida_prevista?.slice(0, 5) ?? '';
        setModelo(mod);
        setPrevia(resp);
        setLinhas(
          resp.dias.map(d => {
            const incluir = d.situacao === 'livre' && d.tem_escala;
            const cel = celulasDoModelo(
              [d.entrada_prevista?.slice(0, 5) ?? '', '', '', d.saida_prevista?.slice(0, 5) ?? ''],
              cols,
            );
            return { ...d, incluir, celulas: incluir ? cel : cel.map(() => '') };
          }),
        );
      })
      .catch((err: unknown) => {
        if (cancelado) return;
        const e = err as { response?: { data?: { mensagem?: string } } };
        setErroCarga(e?.response?.data?.mensagem || 'Não foi possível carregar os dias. Tente novamente.');
      })
      .finally(() => { if (!cancelado) setCarregando(false); });

    return () => { cancelado = true; };
  }, [employeeId, inicio, fim, periodoValido]);

  const errosPorLinha = useMemo(() => {
    const mapa: Record<string, string | null> = {};
    linhas.forEach(l => { if (l.incluir) mapa[l.data] = validarBatidasDia(batidasDaLinha(l)); });
    return mapa;
  }, [linhas]);

  // Informa o formulário pai com o que está pronto para enviar
  useEffect(() => {
    const incluidas = linhas.filter(l => l.incluir);
    const pendencias = incluidas.filter(l => errosPorLinha[l.data]).length;
    const dias: LoteDiaEnvio[] = incluidas.map(l => ({
      data: l.data,
      batidas: batidasDaLinha(l).map(b => normalizarHhmm(b) ?? b),
      substituir: l.situacao === 'com_batidas',
    }));
    onChange(dias, pendencias);
  }, [linhas, errosPorLinha, onChange]);

  const podeEditar = (l: Linha) => l.situacao === 'livre' || l.situacao === 'com_batidas';

  const alternarLinha = (data: string, marcado: boolean) =>
    setLinhas(prev => prev.map(l => (l.data === data ? { ...l, incluir: marcado } : l)));

  const editarCelula = (data: string, idx: number, valor: string) =>
    setLinhas(prev =>
      prev.map(l =>
        l.data === data ? { ...l, incluir: true, celulas: l.celulas.map((c, i) => (i === idx ? valor : c)) } : l,
      ),
    );

  const marcarTodos = (marcado: boolean) =>
    setLinhas(prev => prev.map(l => (podeEditar(l) && (!marcado || l.tem_escala || l.incluir) ? { ...l, incluir: marcado } : l)));

  const aplicarModelo = () =>
    setLinhas(prev =>
      prev.map(l => (l.incluir && podeEditar(l) ? { ...l, celulas: celulasDoModelo(modelo, colunas) } : l)),
    );

  const aplicarColado = useCallback(() => {
    const { porData, erros } = parseHorariosColados(textoColado, inicio, fim);
    const erros2 = [...erros];
    let aplicados = 0;
    setLinhas(prev =>
      prev.map(l => {
        const batidas = porData[l.data];
        if (!batidas) return l;
        if (!podeEditar(l)) {
          erros2.push(`${formatarDataBr(l.data)} — dia com ${l.situacao === 'futuro' ? 'data futura' : 'férias/atestado'}, ignorado`);
          return l;
        }
        if (batidas.length > colunas) {
          erros2.push(`${formatarDataBr(l.data)} — este funcionário usa ${colunas} horários por dia`);
          return l;
        }
        aplicados += 1;
        // 2 horários em quadro de 4 colunas = só entrada e saída (almoço em branco)
        const celulas = colunas === 4 && batidas.length === 2
          ? [batidas[0], '', '', batidas[1]]
          : Array.from({ length: colunas }, (_, i) => batidas[i] ?? '');
        return { ...l, incluir: true, celulas };
      }),
    );
    Object.keys(porData).forEach(d => {
      if (!linhas.some(l => l.data === d)) erros2.push(`${formatarDataBr(d)} — fora do período escolhido`);
    });
    setAvisoColar({ ok: aplicados, erros: erros2 });
    if (aplicados > 0 && erros2.length === 0) setTextoColado('');
  }, [textoColado, inicio, fim, colunas, linhas]);

  const incluidas = linhas.filter(l => l.incluir);
  const substituindo = incluidas.filter(l => l.situacao === 'com_batidas').length;
  const gridCols = `34px 108px repeat(${colunas}, minmax(96px, 1fr))`;

  return (
    <Box sx={{ display: 'flex', flexDirection: 'column', gap: 2 }}>
      {/* Passo 1 — período */}
      <Box>
        <Typography sx={{ color: ACCENT, fontSize: 11, fontWeight: 800, letterSpacing: 0.8, mb: 1 }}>
          1 · ESCOLHA O PERÍODO
        </Typography>
        <Box sx={{ display: 'flex', gap: 2 }}>
          <TextField
            label="De" type="date" value={inicio} disabled={disabled}
            onChange={e => setInicio(e.target.value)}
            InputLabelProps={{ shrink: true }} sx={{ flex: 1, ...fieldSx }}
          />
          <TextField
            label="Até" type="date" value={fim} disabled={disabled}
            onChange={e => setFim(e.target.value)}
            inputProps={{ min: inicio }}
            error={!!inicio && !!fim && fim < inicio}
            helperText={!!inicio && !!fim && fim < inicio ? 'Deve ser igual ou depois da data inicial' : undefined}
            InputLabelProps={{ shrink: true }} sx={{ flex: 1, ...fieldSx }}
          />
        </Box>
        {!!inicio && !!fim && fim >= inicio && diasEntre(inicio, fim) > 62 && (
          <Typography sx={{ color: '#f87171', fontSize: 12, mt: 0.5 }}>Escolha no máximo 62 dias por vez.</Typography>
        )}
      </Box>

      {!employeeId && (
        <Box sx={{ p: 1.5, borderRadius: 2, background: 'rgba(249,115,22,0.08)', border: '1px solid rgba(249,115,22,0.25)' }}>
          <Typography sx={{ fontSize: 12.5, color: 'rgba(226,232,240,0.9)' }}>
            Selecione o funcionário acima para carregar os dias do período.
          </Typography>
        </Box>
      )}

      {carregando && (
        <Box sx={{ display: 'flex', justifyContent: 'center', py: 3 }}>
          <CircularProgress size={28} sx={{ color: ACCENT }} />
        </Box>
      )}

      {erroCarga && (
        <Box sx={{ p: 1.5, borderRadius: 2, background: 'rgba(239,68,68,0.08)', border: '1px solid rgba(239,68,68,0.25)' }}>
          <Typography sx={{ color: '#f87171', fontSize: 12 }}>{erroCarga}</Typography>
        </Box>
      )}

      {previa && !carregando && (
        <>
          {/* Passo 2 — modelo */}
          <Box>
            <Typography sx={{ color: ACCENT, fontSize: 11, fontWeight: 800, letterSpacing: 0.8, mb: 1 }}>
              2 · HORÁRIO PARA TODOS OS DIAS MARCADOS
            </Typography>
            <Box sx={{ p: 1.5, borderRadius: 2, background: 'rgba(255,255,255,0.03)', border: '1px solid rgba(255,255,255,0.08)' }}>
              <Box sx={{ display: 'flex', gap: 1.5, alignItems: 'flex-end', flexWrap: 'wrap' }}>
                {rotulos.map((rot, i) => {
                  const idxModelo = colunas === 2 ? (i === 0 ? 0 : 3) : i;
                  return (
                    <TextField
                      key={rot} label={rot} type="time" size="small" value={modelo[idxModelo]}
                      onChange={e => setModelo(m => m.map((v, k) => (k === idxModelo ? e.target.value : v)))}
                      disabled={disabled} InputLabelProps={{ shrink: true }}
                      sx={{ width: 128, ...fieldSx }}
                    />
                  );
                })}
                <Button
                  onClick={aplicarModelo} disabled={disabled} startIcon={<ApplyIcon />}
                  sx={{ color: ACCENT, border: `1px solid ${ACCENT}66`, fontWeight: 700, '&:hover': { background: `${ACCENT}1a` } }}
                >
                  Aplicar nos dias marcados
                </Button>
              </Box>
              <Typography sx={{ fontSize: 11.5, color: 'rgba(255,255,255,0.45)', mt: 1 }}>
                {colunas === 4
                  ? 'Este funcionário registra o intervalo: informe também a saída e a volta do almoço. Depois ajuste só os dias diferentes.'
                  : 'Entrada e saída previstas já vieram preenchidas. Depois ajuste só os dias diferentes.'}
              </Typography>
            </Box>
          </Box>

          {/* Passo 3 — dias */}
          <Box>
            <Box sx={{ display: 'flex', justifyContent: 'space-between', alignItems: 'center', mb: 1 }}>
              <Typography sx={{ color: ACCENT, fontSize: 11, fontWeight: 800, letterSpacing: 0.8 }}>
                3 · CONFIRA OS DIAS
              </Typography>
              <Box sx={{ display: 'flex', gap: 0.5 }}>
                <Button size="small" onClick={() => marcarTodos(true)} disabled={disabled}
                  sx={{ color: 'rgba(255,255,255,0.6)', fontSize: 11 }}>Marcar todos</Button>
                <Button size="small" onClick={() => marcarTodos(false)} disabled={disabled}
                  sx={{ color: 'rgba(255,255,255,0.6)', fontSize: 11 }}>Desmarcar todos</Button>
              </Box>
            </Box>

            <Box sx={{ overflowX: 'auto', borderRadius: 2, border: '1px solid rgba(255,255,255,0.08)' }}>
              <Box sx={{ minWidth: 100 + colunas * 100 + 140 }}>
                <Box sx={{ display: 'grid', gridTemplateColumns: gridCols, gap: 1, px: 1, py: 0.8, background: 'rgba(255,255,255,0.04)' }}>
                  <span />
                  <Typography sx={{ fontSize: 11, color: 'rgba(255,255,255,0.5)', fontWeight: 700 }}>Dia</Typography>
                  {rotulos.map(r => (
                    <Typography key={r} sx={{ fontSize: 11, color: 'rgba(255,255,255,0.5)', fontWeight: 700 }}>{r}</Typography>
                  ))}
                </Box>

                {linhas.map(l => {
                  const bloqueado = !podeEditar(l);
                  const erro = l.incluir ? errosPorLinha[l.data] : null;
                  const fimDeSemanaOuFolga = !l.tem_escala;
                  return (
                    <Box key={l.data} sx={{
                      px: 1, py: 0.8, borderTop: '1px solid rgba(255,255,255,0.05)',
                      opacity: bloqueado ? 0.55 : 1,
                      background: l.incluir ? 'rgba(249,115,22,0.05)' : 'transparent',
                    }}>
                      <Box sx={{ display: 'grid', gridTemplateColumns: gridCols, gap: 1, alignItems: 'center' }}>
                        <Checkbox
                          size="small" checked={l.incluir} disabled={disabled || bloqueado}
                          onChange={e => alternarLinha(l.data, e.target.checked)}
                          inputProps={{ 'aria-label': `Incluir ${formatarDataBr(l.data)}` }}
                          sx={{ p: 0.5, color: 'rgba(255,255,255,0.35)', '&.Mui-checked': { color: ACCENT } }}
                        />
                        <Box>
                          <Typography sx={{ fontSize: 13, color: 'white', fontWeight: 700, lineHeight: 1.2 }}>
                            {formatarDataBr(l.data).slice(0, 5)}
                          </Typography>
                          <Typography sx={{ fontSize: 11, color: 'rgba(255,255,255,0.45)' }}>
                            {l.dia_semana}{fimDeSemanaOuFolga && !bloqueado ? ' · sem escala' : ''}
                          </Typography>
                        </Box>
                        {l.celulas.map((valor, i) => (
                          <TextField
                            key={i} type="time" size="small" value={valor}
                            disabled={disabled || bloqueado}
                            onChange={e => editarCelula(l.data, i, e.target.value)}
                            error={!!erro && tentouEnviar}
                            inputProps={{ 'aria-label': `${rotulos[i]} em ${formatarDataBr(l.data)}` }}
                            sx={cellSx}
                          />
                        ))}
                      </Box>
                      {(bloqueado || l.situacao === 'com_batidas' || erro) && (
                        <Box sx={{ display: 'flex', gap: 1, alignItems: 'center', mt: 0.6, ml: '42px', flexWrap: 'wrap' }}>
                          {l.situacao === 'ferias' && <Chip size="small" label="Férias/Folga lançada" sx={{ background: 'rgba(139,92,246,0.2)', color: '#a78bfa', fontSize: 11 }} />}
                          {l.situacao === 'atestado' && <Chip size="small" label="Atestado lançado" sx={{ background: 'rgba(20,184,166,0.2)', color: '#2dd4bf', fontSize: 11 }} />}
                          {l.situacao === 'futuro' && <Chip size="small" label="Data futura" sx={{ background: 'rgba(255,255,255,0.08)', color: 'rgba(255,255,255,0.5)', fontSize: 11 }} />}
                          {l.situacao === 'com_batidas' && (
                            <Chip
                              size="small" icon={<WarnIcon sx={{ fontSize: 14, color: '#fbbf24 !important' }} />}
                              label={`Já tem batidas (${l.batidas_existentes.join(' · ')}) — ${l.incluir ? 'serão substituídas' : 'não será alterado'}`}
                              sx={{ background: 'rgba(251,191,36,0.14)', color: '#fbbf24', fontSize: 11 }}
                            />
                          )}
                          {erro && (
                            <Typography sx={{ fontSize: 11.5, color: tentouEnviar ? '#f87171' : '#fbbf24' }}>{erro}</Typography>
                          )}
                        </Box>
                      )}
                    </Box>
                  );
                })}
              </Box>
            </Box>
          </Box>

          {/* Colar horários */}
          <Box>
            <Button
              onClick={() => setColarAberto(v => !v)} startIcon={<PasteIcon />} size="small"
              sx={{ color: 'rgba(255,255,255,0.6)', fontWeight: 600, textTransform: 'none' }}
            >
              {colarAberto ? 'Esconder' : 'Tenho os horários anotados — colar de uma vez'}
            </Button>
            <Collapse in={colarAberto}>
              <Box sx={{ mt: 1 }}>
                <TextField
                  multiline minRows={4} fullWidth value={textoColado} disabled={disabled}
                  onChange={e => setTextoColado(e.target.value)}
                  placeholder={'Uma linha por dia: data e horários\n' + (colunas === 4
                    ? '03/11 08:00 12:00 13:00 17:00\n04/11 08:10 12:05 13:05 17:30'
                    : '03/11 08:00 17:00\n04/11 08:10 17:30')}
                  sx={fieldSx}
                />
                <Box sx={{ display: 'flex', alignItems: 'center', gap: 1.5, mt: 1 }}>
                  <Button
                    onClick={aplicarColado} disabled={disabled || !textoColado.trim()} variant="outlined"
                    sx={{ color: ACCENT, borderColor: `${ACCENT}88`, fontWeight: 700 }}
                  >
                    Preencher o quadro
                  </Button>
                  {avisoColar && avisoColar.ok > 0 && (
                    <Box sx={{ display: 'flex', alignItems: 'center', gap: 0.5 }}>
                      <OkIcon sx={{ fontSize: 16, color: '#4ade80' }} />
                      <Typography sx={{ fontSize: 12, color: '#4ade80' }}>{avisoColar.ok} dia(s) preenchido(s)</Typography>
                    </Box>
                  )}
                </Box>
                {avisoColar && avisoColar.erros.length > 0 && (
                  <Box sx={{ mt: 1 }}>
                    {avisoColar.erros.map(e => (
                      <Typography key={e} sx={{ fontSize: 11.5, color: '#fbbf24' }}>• {e}</Typography>
                    ))}
                  </Box>
                )}
              </Box>
            </Collapse>
          </Box>

          <Box sx={{ p: 1.5, borderRadius: 2, background: 'rgba(249,115,22,0.08)', border: '1px solid rgba(249,115,22,0.25)' }}>
            <Typography sx={{ fontSize: 13, color: 'white', fontWeight: 700 }}>
              {incluidas.length === 0
                ? 'Nenhum dia marcado'
                : `${incluidas.length} dia(s) serão lançados${substituindo ? ` · ${substituindo} substituirão batidas existentes` : ''}`}
            </Typography>
            <Typography sx={{ fontSize: 11.5, color: 'rgba(148,163,184,0.9)', mt: 0.3 }}>
              Os registros ficam marcados como lançamento manual em lote, com a justificativa abaixo e o seu usuário, e aparecem na auditoria.
            </Typography>
          </Box>
        </>
      )}
    </Box>
  );
};

export const LoteResultadoView: React.FC<{ resultado: LoteResultado }> = ({ resultado }) => (
  <Box sx={{ display: 'flex', flexDirection: 'column', gap: 2 }}>
    <Box sx={{ display: 'flex', alignItems: 'center', gap: 1.5 }}>
      <OkIcon sx={{ color: '#4ade80', fontSize: 32 }} />
      <Box>
        <Typography sx={{ color: 'white', fontWeight: 800, fontSize: 17 }}>{resultado.mensagem}</Typography>
        <Typography sx={{ color: 'rgba(255,255,255,0.5)', fontSize: 12 }}>
          Já aparecem nos registros e no espelho de ponto.
        </Typography>
      </Box>
    </Box>

    {resultado.lancados.length > 0 && (
      <Box sx={{ p: 1.5, borderRadius: 2, background: 'rgba(74,222,128,0.07)', border: '1px solid rgba(74,222,128,0.25)' }}>
        {resultado.lancados.map(l => (
          <Typography key={l.data} sx={{ fontSize: 12.5, color: 'rgba(226,232,240,0.95)' }}>
            {formatarDataBr(l.data)} — {l.batidas.join(' · ')}
            {resultado.substituidos?.includes(l.data) ? ' (substituiu batidas anteriores)' : ''}
          </Typography>
        ))}
      </Box>
    )}

    {resultado.ignorados.length > 0 && (
      <Box sx={{ p: 1.5, borderRadius: 2, background: 'rgba(251,191,36,0.08)', border: '1px solid rgba(251,191,36,0.3)' }}>
        <Typography sx={{ color: '#fbbf24', fontWeight: 700, fontSize: 13, mb: 0.5 }}>
          {resultado.ignorados.length} dia(s) não foram lançados
        </Typography>
        {resultado.ignorados.map(i => (
          <Typography key={`${i.data}-${i.motivo}`} sx={{ fontSize: 12, color: 'rgba(226,232,240,0.85)' }}>
            {formatarDataBr(i.data)} — {i.motivo}
          </Typography>
        ))}
      </Box>
    )}
  </Box>
);

export default BatchRecordsPanel;
