import React, { useEffect, useState } from 'react';
import {
  Box, Card, CardContent, Typography, Button, Chip,
  CircularProgress, FormControl, InputLabel, Select, MenuItem,
  Alert,
} from '@mui/material';
import {
  FileDownload as DownloadIcon,
  TableChart as ExcelIcon,
  Description as CsvIcon,
  PictureAsPdf as PdfIcon,
} from '@mui/icons-material';
import * as XLSX from 'xlsx';
import { motion } from 'framer-motion';
import RHTabNav from '../components/RHTabNav';
import { payrollService, fmtBRL, fmtHoras, fmtCompetencia, statusColor } from '../services/payrollService';
import type { Competencia } from '../types';
import toast from 'react-hot-toast';

const RH_COLOR = '#f472b6';

type ExportFormat = 'excel' | 'csv' | 'pdf';

const FORMATS: { key: ExportFormat; label: string; ext: string; icon: React.ReactNode; color: string; desc: string }[] = [
  { key: 'excel', label: 'Excel',     ext: '.xlsx', icon: <ExcelIcon sx={{ fontSize: 22 }} />, color: '#34d399', desc: 'Planilha completa com formatação' },
  { key: 'csv',   label: 'CSV',       ext: '.csv',  icon: <CsvIcon   sx={{ fontSize: 22 }} />, color: '#60a5fa', desc: 'Dados separados por ponto-e-vírgula' },
  { key: 'pdf',   label: 'PDF',       ext: '.pdf',  icon: <PdfIcon   sx={{ fontSize: 22 }} />, color: '#f87171', desc: 'Relatório para impressão' },
];

const RHExportacoesPage: React.FC = () => {
  const [competencias, setCompetencias] = useState<Competencia[]>([]);
  const [selectedComp, setSelectedComp] = useState('');
  const [selectedFormat, setSelectedFormat] = useState<ExportFormat>('excel');
  const [exporting, setExporting] = useState(false);

  useEffect(() => {
    payrollService.listCompetencias().then(r => {
      setCompetencias(r.competencias);
      if (r.competencias.length) setSelectedComp(r.competencias[0].competencia);
    });
  }, []);

  const compAtual = competencias.find(c => c.competencia === selectedComp);
  const sc = statusColor(compAtual?.status ?? '');

  const handleExport = async () => {
    if (!selectedComp) return;
    setExporting(true);
    try {
      const data = await payrollService.exportar(selectedComp);
      const rows = data.rows;
      const compLabel = fmtCompetencia(selectedComp);
      const filename  = `prefolha_${selectedComp}`;

      if (selectedFormat === 'excel' || selectedFormat === 'csv') {
        const ws = XLSX.utils.json_to_sheet(rows);

        // Larguras das colunas
        ws['!cols'] = [
          { wch: 30 }, { wch: 14 }, { wch: 12 }, { wch: 12 }, { wch: 10 },
          { wch: 10 }, { wch: 10 }, { wch: 14 }, { wch: 8 }, { wch: 8 },
          { wch: 8 }, { wch: 12 }, { wch: 12 }, { wch: 14 },
        ];

        const wb = XLSX.utils.book_new();
        XLSX.utils.book_append_sheet(wb, ws, compLabel);

        if (selectedFormat === 'excel') {
          XLSX.writeFile(wb, `${filename}.xlsx`);
        } else {
          XLSX.writeFile(wb, `${filename}.csv`, { bookType: 'csv', FS: ';' });
        }
        toast.success(`Exportado: ${filename}${selectedFormat === 'excel' ? '.xlsx' : '.csv'}`);
      } else {
        // PDF: gera HTML e abre nova janela para impressão
        const html = buildPdfHtml(compLabel, rows, data.total);
        const win = window.open('', '_blank');
        if (win) {
          win.document.write(html);
          win.document.close();
          win.focus();
          setTimeout(() => win.print(), 600);
        } else {
          toast.error('Permita pop-ups para exportar PDF');
        }
      }
    } catch {
      toast.error('Erro ao exportar');
    } finally { setExporting(false); }
  };

  return (
    <Box>
      <RHTabNav />

      <Typography sx={{ fontWeight: 700, color: 'white', fontSize: 15, mb: 2 }}>
        Exportações
      </Typography>

      <motion.div initial={{ opacity: 0, y: 8 }} animate={{ opacity: 1, y: 0 }} transition={{ duration: 0.25 }}>
        <Box sx={{ display: 'grid', gridTemplateColumns: { xs: '1fr', md: '1fr 1fr' }, gap: 2 }}>
          {/* Config */}
          <Box>
            <Typography sx={{ fontSize: 10, fontWeight: 700, color: 'rgba(255,255,255,0.3)', textTransform: 'uppercase', letterSpacing: '0.1em', mb: 1.5 }}>
              Configurar Exportação
            </Typography>
            <Card>
              <CardContent sx={{ p: '20px !important', display: 'flex', flexDirection: 'column', gap: 2 }}>
                <FormControl size="small" fullWidth>
                  <InputLabel>Competência</InputLabel>
                  <Select
                    value={selectedComp}
                    onChange={e => setSelectedComp(e.target.value)}
                    label="Competência"
                  >
                    {competencias.map(c => (
                      <MenuItem key={c.competencia} value={c.competencia}>
                        {fmtCompetencia(c.competencia)}
                        <Chip
                          label={c.status}
                          size="small"
                          sx={{ ml: 1, height: 16, fontSize: 9.5, bgcolor: statusColor(c.status) + '18', color: statusColor(c.status) }}
                        />
                      </MenuItem>
                    ))}
                  </Select>
                </FormControl>

                {compAtual && (
                  <Box sx={{ p: '10px 14px', borderRadius: '9px', background: sc + '0d', border: `1px solid ${sc}22` }}>
                    <Typography sx={{ fontSize: 12, color: sc, fontWeight: 600 }}>
                      {fmtCompetencia(selectedComp)} · {compAtual.status}
                    </Typography>
                    <Typography sx={{ fontSize: 11, color: 'rgba(255,255,255,0.4)', mt: 0.25 }}>
                      Total: {fmtBRL(compAtual.total_folha)} · {compAtual.total_folha > 0 ? 'Calculado' : 'Sem dados'}
                    </Typography>
                  </Box>
                )}

                {compAtual?.status === 'ABERTA' && (
                  <Alert severity="warning" sx={{ fontSize: 11.5 }}>
                    Competência ainda aberta. Feche-a antes de exportar para o contador.
                  </Alert>
                )}

                <Button
                  startIcon={exporting ? <CircularProgress size={14} sx={{ color: 'white' }} /> : <DownloadIcon />}
                  onClick={handleExport}
                  disabled={exporting || !selectedComp}
                  fullWidth
                  sx={{
                    background: `linear-gradient(135deg, ${RH_COLOR}, #db2777)`,
                    color: 'white', fontWeight: 700, fontSize: 13,
                    boxShadow: `0 4px 16px ${RH_COLOR}35`,
                    '&:disabled': { opacity: 0.5 },
                  }}
                >
                  {exporting ? 'Exportando…' : `Exportar ${FORMATS.find(f => f.key === selectedFormat)?.ext ?? ''}`}
                </Button>
              </CardContent>
            </Card>
          </Box>

          {/* Formato */}
          <Box>
            <Typography sx={{ fontSize: 10, fontWeight: 700, color: 'rgba(255,255,255,0.3)', textTransform: 'uppercase', letterSpacing: '0.1em', mb: 1.5 }}>
              Formato
            </Typography>
            <Box sx={{ display: 'flex', flexDirection: 'column', gap: 1 }}>
              {FORMATS.map(fmt => {
                const active = selectedFormat === fmt.key;
                return (
                  <Card
                    key={fmt.key}
                    onClick={() => setSelectedFormat(fmt.key)}
                    sx={{
                      cursor: 'pointer',
                      border: active ? `1px solid ${fmt.color}40` : '1px solid rgba(255,255,255,0.08)',
                      background: active ? `${fmt.color}0d` : 'transparent',
                      transition: 'all 0.18s ease',
                      '&:hover': { border: `1px solid ${fmt.color}30`, background: `${fmt.color}08` },
                    }}
                  >
                    <CardContent sx={{ p: '12px 16px !important', display: 'flex', alignItems: 'center', gap: 1.5 }}>
                      <Box sx={{ color: active ? fmt.color : 'rgba(255,255,255,0.3)', transition: 'color 0.18s' }}>
                        {fmt.icon}
                      </Box>
                      <Box sx={{ flex: 1 }}>
                        <Typography sx={{ fontWeight: 600, color: 'white', fontSize: 13 }}>
                          {fmt.label}
                          <Typography component="span" sx={{ fontSize: 11, color: 'rgba(255,255,255,0.35)', ml: 0.75 }}>
                            {fmt.ext}
                          </Typography>
                        </Typography>
                        <Typography sx={{ fontSize: 11.5, color: 'rgba(255,255,255,0.4)' }}>{fmt.desc}</Typography>
                      </Box>
                      {active && (
                        <Box sx={{
                          width: 8, height: 8, borderRadius: '50%',
                          bgcolor: fmt.color, boxShadow: `0 0 8px ${fmt.color}`,
                        }} />
                      )}
                    </CardContent>
                  </Card>
                );
              })}
            </Box>
          </Box>
        </Box>

        {/* Colunas exportadas */}
        <Box sx={{ mt: 2 }}>
          <Typography sx={{ fontSize: 10, fontWeight: 700, color: 'rgba(255,255,255,0.3)', textTransform: 'uppercase', letterSpacing: '0.1em', mb: 1.5 }}>
            Dados incluídos na exportação
          </Typography>
          <Card>
            <CardContent sx={{ p: '14px 20px !important' }}>
              <Box sx={{ display: 'flex', flexWrap: 'wrap', gap: 0.75 }}>
                {[
                  'Funcionário', 'Tipo', 'Horas Previstas', 'Horas Trabalhadas',
                  'Horas Extras', 'Horas Falta', 'Banco de Horas',
                  'Salário Base', 'Valor Hora', 'Valor Extras',
                  'Desconto Falta', 'Desconto Atraso', 'Total',
                ].map(col => (
                  <Chip
                    key={col}
                    label={col}
                    size="small"
                    sx={{ bgcolor: 'rgba(255,255,255,0.05)', color: 'rgba(255,255,255,0.55)', fontSize: 11, height: 22 }}
                  />
                ))}
              </Box>
              <Typography sx={{ fontSize: 11, color: 'rgba(255,255,255,0.25)', mt: 1.5 }}>
                * Não inclui INSS, FGTS, IRRF ou outros encargos legais. Use como referência para seu contador.
              </Typography>
            </CardContent>
          </Card>
        </Box>
      </motion.div>
    </Box>
  );
};

function buildPdfHtml(compLabel: string, rows: Record<string, string | number>[], total: number): string {
  const headers = rows.length > 0 ? Object.keys(rows[0]) : [];
  const tableRows = rows.map(r =>
    `<tr>${headers.map(h => `<td>${r[h] ?? ''}</td>`).join('')}</tr>`
  ).join('');

  return `<!DOCTYPE html>
<html lang="pt-BR">
<head>
<meta charset="utf-8"/>
<title>Pré-Folha ${compLabel}</title>
<style>
  body { font-family: Arial, sans-serif; font-size: 10px; color: #111; margin: 20px; }
  h1 { font-size: 16px; margin-bottom: 4px; }
  p  { color: #555; margin: 0 0 12px; }
  table { width: 100%; border-collapse: collapse; }
  th { background: #1a1a2e; color: white; padding: 6px 8px; text-align: left; font-size: 9px; }
  td { border-bottom: 1px solid #eee; padding: 5px 8px; }
  tr:nth-child(even) td { background: #f9f9f9; }
  .total { text-align: right; font-weight: bold; margin-top: 12px; font-size: 12px; }
  @media print { body { margin: 0; } }
</style>
</head>
<body>
<h1>Pré-Folha — ${compLabel}</h1>
<p>Gerado em ${new Date().toLocaleString('pt-BR')} · Valor estimado, não inclui encargos legais</p>
<table>
  <thead><tr>${headers.map(h => `<th>${h}</th>`).join('')}</tr></thead>
  <tbody>${tableRows}</tbody>
</table>
<p class="total">Total da folha: ${fmtBRL(total)}</p>
</body>
</html>`;
}

export default RHExportacoesPage;
