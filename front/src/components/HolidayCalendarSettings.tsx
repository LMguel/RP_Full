import React, { useState, useEffect, useCallback } from 'react';
import {
  Box,
  Card,
  CardContent,
  Typography,
  Button,
  IconButton,
  Chip,
  CircularProgress,
  Alert,
  TextField,
  Select,
  MenuItem,
  FormControl,
  InputLabel,
  Dialog,
  DialogTitle,
  DialogContent,
  DialogActions,
  Switch,
  FormControlLabel,
  Tooltip,
  Divider,
  Table,
  TableBody,
  TableCell,
  TableContainer,
  TableHead,
  TableRow,
  Paper,
  Autocomplete,
} from '@mui/material';
import Collapse from '@mui/material/Collapse';
import {
  CalendarMonth as CalendarIcon,
  LocationOn as LocationOnIcon,
  LocationOff as LocationOffIcon,
  Add as AddIcon,
  Edit as EditIcon,
  Delete as DeleteIcon,
  Save as SaveIcon,
  Refresh as RefreshIcon,
  CheckCircle as CheckCircleIcon,
  Cancel as CancelIcon,
  Public as PublicIcon,
  Place as PlaceIcon,
  Star as StarIcon,
  ExpandMore as ExpandMoreIcon,
  ExpandLess as ExpandLessIcon,
} from '@mui/icons-material';
import { motion } from 'framer-motion';
import { toast } from 'react-hot-toast';
import { apiService } from '../services/api';

// ── Tipos ─────────────────────────────────────────────────────────────────────

type HolidaySource = 'nacional' | 'estadual' | 'municipal' | 'manual';
type HolidayType   = 'feriado' | 'ponto_facultativo';

interface Holiday {
  id: string;
  date: string;           // YYYY-MM-DD
  name: string;
  type: HolidayType;
  source: HolidaySource;
  active: boolean;
  edited: boolean;
  custom: boolean;        // criado manualmente pelo admin
}

interface LocationInfo {
  lat: number;
  lng: number;
  city: string;
  state: string;
  uf: string;
}

// ── Constantes ────────────────────────────────────────────────────────────────

const ESTADOS_BR = [
  { uf:'AC', name:'Acre' }, { uf:'AL', name:'Alagoas' }, { uf:'AP', name:'Amapá' },
  { uf:'AM', name:'Amazonas' }, { uf:'BA', name:'Bahia' }, { uf:'CE', name:'Ceará' },
  { uf:'DF', name:'Distrito Federal' }, { uf:'ES', name:'Espírito Santo' }, { uf:'GO', name:'Goiás' },
  { uf:'MA', name:'Maranhão' }, { uf:'MT', name:'Mato Grosso' }, { uf:'MS', name:'Mato Grosso do Sul' },
  { uf:'MG', name:'Minas Gerais' }, { uf:'PA', name:'Pará' }, { uf:'PB', name:'Paraíba' },
  { uf:'PR', name:'Paraná' }, { uf:'PE', name:'Pernambuco' }, { uf:'PI', name:'Piauí' },
  { uf:'RJ', name:'Rio de Janeiro' }, { uf:'RN', name:'Rio Grande do Norte' }, { uf:'RS', name:'Rio Grande do Sul' },
  { uf:'RO', name:'Rondônia' }, { uf:'RR', name:'Roraima' }, { uf:'SC', name:'Santa Catarina' },
  { uf:'SP', name:'São Paulo' }, { uf:'SE', name:'Sergipe' }, { uf:'TO', name:'Tocantins' },
];

const SOURCE_LABEL: Record<HolidaySource, string> = {
  nacional: 'Nacional', estadual: 'Estadual', municipal: 'Municipal', manual: 'Manual',
};
const SOURCE_COLOR: Record<HolidaySource, string> = {
  nacional: '#3b82f6', estadual: '#8b5cf6', municipal: '#f59e0b', manual: '#10b981',
};

const MONTHS_BR = ['Janeiro','Fevereiro','Março','Abril','Maio','Junho','Julho','Agosto','Setembro','Outubro','Novembro','Dezembro'];

const toISO = (date: string) => date; // already YYYY-MM-DD

const cardSx = {
  background: 'rgba(255,255,255,0.08)',
  backdropFilter: 'blur(20px)',
  borderRadius: '16px',
  boxShadow: '0 8px 32px rgba(0,0,0,0.2)',
  border: '1px solid rgba(255,255,255,0.1)',
};

const fieldSx = {
  '& .MuiOutlinedInput-root': {
    color: 'rgba(255,255,255,0.9)',
    '& fieldset': { borderColor: 'rgba(255,255,255,0.2)' },
    '&:hover fieldset': { borderColor: 'rgba(255,255,255,0.3)' },
    '&.Mui-focused fieldset': { borderColor: '#3b82f6' },
  },
  '& .MuiInputLabel-root': { color: 'rgba(255,255,255,0.7)', '&.Mui-focused': { color: '#3b82f6' } },
  '& .MuiSelect-icon': { color: 'rgba(255,255,255,0.6)' },
  '& .MuiAutocomplete-popupIndicator': { color: 'rgba(255,255,255,0.6)' },
};

// ── Componente ────────────────────────────────────────────────────────────────

const HolidayCalendarSettings: React.FC = () => {
  const currentYear = new Date().getFullYear();

  // Localização
  const [locationMode, setLocationMode] = useState<'requesting' | 'auto' | 'manual' | 'denied'>('requesting');
  const [location, setLocation] = useState<LocationInfo | null>(null);
  const [manualUF, setManualUF] = useState<string>('');
  const [manualCity, setManualCity] = useState<string>('');
  const [loadedFromBackend, setLoadedFromBackend] = useState(false);

  // Calendário
  const [year, setYear] = useState(currentYear);
  const [holidays, setHolidays] = useState<Holiday[]>([]);
  const [loadingHolidays, setLoadingHolidays] = useState(false);
  const [saving, setSaving] = useState(false);
  const [hasChanges, setHasChanges] = useState(false);

  // Vista: 'list' | 'calendar'
  const [view, setView] = useState<'list' | 'calendar'>('list');

  // Expansão do card
  const [expanded, setExpanded] = useState(false);

  // Dialogs
  const [editDialog, setEditDialog] = useState<{ open: boolean; holiday: Holiday | null }>({ open: false, holiday: null });
  const [addDialog, setAddDialog] = useState(false);
  const [newHoliday, setNewHoliday] = useState({ date: '', name: '', type: 'feriado' as HolidayType });

  // ── Geolocalização ──────────────────────────────────────────────────────────
  const requestGeolocation = useCallback(() => {
    setLocationMode('requesting');
    if (!navigator.geolocation) {
      setLocationMode('denied');
      return;
    }
    navigator.geolocation.getCurrentPosition(
      async (pos) => {
        try {
          const { latitude: lat, longitude: lng } = pos.coords;
          const res = await fetch(
            `https://nominatim.openstreetmap.org/reverse?lat=${lat}&lon=${lng}&format=json&accept-language=pt-BR`,
            { headers: { 'Accept-Language': 'pt-BR', 'User-Agent': 'RegistraPonto/1.0' } }
          );
          const data = await res.json();
          const addr = data.address || {};
          const rawCity  = addr.city || addr.town || addr.village || addr.municipality || addr.county || '';
          const rawState = addr.state || '';
          // Tenta casar pelo nome e também pelo código ISO (ex: 'SP' em addr.state_code)
          const stateCode = (addr.state_code || '').toUpperCase().replace('BR-', '');
          const uf = stateCode.length === 2
            ? stateCode
            : ESTADOS_BR.find(e =>
                rawState.toLowerCase().includes(e.name.toLowerCase()) ||
                rawState.toUpperCase().includes(e.uf)
              )?.uf || '';
          setLocation({ lat, lng, city: rawCity, state: rawState, uf });
          setLocationMode('auto');
        } catch {
          // Mesmo com erro no reverse geocoding, marca como auto e tenta carregar feriados nacionais
          setLocation({ lat: pos.coords.latitude, lng: pos.coords.longitude, city: '', state: '', uf: '' });
          setLocationMode('auto');
        }
      },
      () => setLocationMode('denied'),
      { timeout: 10000 }
    );
  }, []);

  useEffect(() => {
    // Primeiro tenta carregar localização salva no backend; só pede GPS se não tiver
    apiService.get('/api/configuracoes').then((config: any) => {
      const savedUF   = config?.empresa_uf   || '';
      const savedCity = config?.empresa_cidade || '';
      if (savedUF || savedCity) {
        setManualUF(savedUF);
        setManualCity(savedCity);
        setLoadedFromBackend(true);
        setLocationMode('manual');
      } else {
        requestGeolocation();
      }
    }).catch(() => {
      requestGeolocation();
    });
  // eslint-disable-next-line react-hooks/exhaustive-deps
  }, []);

  // ── Buscar feriados ─────────────────────────────────────────────────────────
  const fetchHolidays = useCallback(async (uf: string, city: string, yr: number) => {
    setLoadingHolidays(true);
    let national: Holiday[] = [];
    let municipal: Holiday[] = [];
    let saved: Holiday[] = [];

    // 1. Feriados nacionais via BrasilAPI
    try {
      const res = await fetch(`https://brasilapi.com.br/api/feriados/v1/${yr}`);
      const data: { date: string; name: string; type: string }[] = await res.json();
      national = data.map((h, i) => ({
        id: `nacional-${i}-${h.date}`,
        date: h.date,
        name: h.name,
        type: 'feriado' as HolidayType,
        source: 'nacional' as HolidaySource,
        active: true,
        edited: false,
        custom: false,
      }));
    } catch { /* silencioso */ }

    // 2. Feriados municipais via IBGE + BrasilAPI
    if (city && uf) {
      try {
        // Normaliza nome da cidade: remove acentos, lowercase
        const normalize = (s: string) => s.normalize('NFD').replace(/[\u0300-\u036f]/g, '').toLowerCase().trim();
        const cityNorm = normalize(city);
        const ibgeRes = await fetch(
          `https://servicodados.ibge.gov.br/api/v1/localidades/estados/${uf}/municipios`
        );
        const municipios: { id: number; nome: string }[] = await ibgeRes.json();
        const municipio = municipios.find(m => normalize(m.nome) === cityNorm);
        if (municipio) {
          const mRes = await fetch(
            `https://brasilapi.com.br/api/feriados/v2/${yr}?city=${municipio.id}`
          );
          if (mRes.ok) {
            const mData: { date: string; name: string; type: string }[] = await mRes.json();
            // BrasilAPI v2 retorna nacional + estadual + municipal; pegar só os novos (municipal)
            const nationalDates = new Set(national.map(h => h.date));
            municipal = mData
              .filter(h => !nationalDates.has(h.date))
              .map((h, i) => ({
                id: `municipal-${i}-${h.date}`,
                date: h.date,
                name: h.name,
                type: 'feriado' as HolidayType,
                source: (h.type === 'municipal' ? 'municipal' : 'estadual') as HolidaySource,
                active: true,
                edited: false,
                custom: false,
              }));
          }
        }
      } catch { /* silencioso */ }
    }

    // 3. Feriados salvos no backend (customizações do admin)
    try {
      const resp = await apiService.get(`/api/feriados?ano=${yr}&uf=${uf}`);
      if (Array.isArray(resp)) {
        saved = resp.map((h: any) => ({
          id: h.id || `saved-${h.date}`,
          date: h.date,
          name: h.name || h.nome,
          type: h.type || h.tipo || 'feriado',
          source: h.source || h.fonte || 'manual',
          active: h.active !== false && h.ativo !== false,
          edited: h.edited || false,
          custom: h.custom || h.personalizado || false,
        }));
      }
    } catch { /* endpoint pode não existir ainda */ }

    // 4. Merge: nacional → municipal/estadual → saved sobrescreve
    const mergedMap = new Map<string, Holiday>();
    national.forEach(h => mergedMap.set(h.date, h));
    municipal.forEach(h => mergedMap.set(h.date, h));
    saved.forEach(h => mergedMap.set(h.date, h));
    const merged = Array.from(mergedMap.values()).sort((a, b) => a.date.localeCompare(b.date));
    setHolidays(merged);
    setHasChanges(false);
    setLoadingHolidays(false);
  }, []);

  // Recarregar quando localização ou ano muda
  useEffect(() => {
    const uf   = locationMode === 'auto' ? (location?.uf || '') : manualUF;
    const city = locationMode === 'auto' ? (location?.city || '') : manualCity;
    if (locationMode === 'auto' || uf) {
      fetchHolidays(uf, city, year);
    }
  }, [location, locationMode, manualUF, manualCity, year, fetchHolidays]);

  // ── Ações ───────────────────────────────────────────────────────────────────
  const toggleHoliday = (id: string) => {
    setHolidays(prev => prev.map(h => h.id === id ? { ...h, active: !h.active, edited: true } : h));
    setHasChanges(true);
  };

  const openEdit = (h: Holiday) => setEditDialog({ open: true, holiday: { ...h } });

  const saveEdit = () => {
    if (!editDialog.holiday) return;
    setHolidays(prev => prev.map(h => h.id === editDialog.holiday!.id ? { ...editDialog.holiday!, edited: true } : h));
    setEditDialog({ open: false, holiday: null });
    setHasChanges(true);
  };

  const deleteHoliday = (id: string) => {
    setHolidays(prev => prev.filter(h => h.id !== id));
    setHasChanges(true);
  };

  const addHoliday = () => {
    if (!newHoliday.date || !newHoliday.name.trim()) { toast.error('Preencha data e nome'); return; }
    const h: Holiday = {
      id: `manual-${Date.now()}`,
      date: newHoliday.date,
      name: newHoliday.name.trim(),
      type: newHoliday.type,
      source: 'manual',
      active: true,
      edited: false,
      custom: true,
    };
    setHolidays(prev => [...prev, h].sort((a, b) => a.date.localeCompare(b.date)));
    setNewHoliday({ date: '', name: '', type: 'feriado' });
    setAddDialog(false);
    setHasChanges(true);
    toast.success('Feriado adicionado');
  };

  const saveAll = async () => {
    setSaving(true);
    const uf   = locationMode === 'auto' ? (location?.uf || '') : manualUF;
    const city = locationMode === 'auto' ? (location?.city || '') : manualCity;
    const payload = {
      ano: year,
      uf,
      cidade: city,
      feriados: holidays.map(h => ({
        id: h.id,
        date: h.date,
        name: h.name,
        type: h.type,
        source: h.source,
        active: h.active,
        edited: h.edited,
        custom: h.custom,
      })),
    };
    try {
      await apiService.post('/api/feriados/salvar', payload);
      setHasChanges(false);
      toast.success('Calendário salvo com sucesso!');
    } catch {
      // Salvar localmente como fallback
      localStorage.setItem(`feriados-${year}-${uf}`, JSON.stringify(holidays));
      setHasChanges(false);
      toast.success('Calendário salvo localmente');
    } finally {
      setSaving(false);
    }
  };

  // ── Helpers visuais ─────────────────────────────────────────────────────────
  const groupByMonth = (): Record<number, Holiday[]> => {
    const groups: Record<number, Holiday[]> = {};
    holidays.forEach(h => {
      const m = new Date(h.date + 'T12:00:00').getMonth();
      groups[m] = groups[m] || [];
      groups[m].push(h);
    });
    return groups;
  };

  const uf   = locationMode === 'auto' ? location?.uf   : manualUF;
  const city = locationMode === 'auto' ? location?.city : manualCity;

  // ── Render ──────────────────────────────────────────────────────────────────
  return (
    <Card sx={cardSx}>
      <CardContent sx={{ pb: expanded ? undefined : '16px !important' }}>
        {/* Header — clicável para expandir */}
        <Box
          onClick={() => setExpanded(e => !e)}
          sx={{ display:'flex', alignItems:'center', gap:2, cursor:'pointer', userSelect:'none',
            mb: expanded ? 3 : 0 }}
        >
          <CalendarIcon sx={{ color:'#3b82f6', fontSize:'24px' }} />
          <Box sx={{ flex:1 }}>
            <Typography variant="h6" sx={{ fontWeight:600, color:'white', fontSize:'18px' }}>
              Calendário de Feriados
            </Typography>
            <Typography variant="body2" sx={{ color:'rgba(255,255,255,0.6)', fontSize:'14px' }}>
              {expanded
                ? 'Detecção automática por localização • Ajuste manual disponível'
                : (() => {
                    const loc = manualCity || location?.city || manualUF || location?.uf || '';
                    const total = holidays.filter(h => h.active).length;
                    return loc
                      ? `${loc}${(manualUF || location?.uf) ? ` (${manualUF || location?.uf})` : ''} • ${total} feriado${total !== 1 ? 's' : ''} em ${year}`
                      : `${total} feriado${total !== 1 ? 's' : ''} em ${year}`;
                  })()
              }
            </Typography>
          </Box>
          {loadingHolidays && !expanded && <CircularProgress size={16} sx={{ color:'rgba(255,255,255,0.4)' }} />}
          {hasChanges && expanded && (
            <Button
              variant="contained"
              size="small"
              startIcon={saving ? <CircularProgress size={16} color="inherit" /> : <SaveIcon />}
              onClick={e => { e.stopPropagation(); saveAll(); }}
              disabled={saving}
              sx={{ background:'linear-gradient(135deg,#3b82f6,#2563eb)', '&:hover':{background:'linear-gradient(135deg,#2563eb,#1d4ed8)'} }}
            >
              {saving ? 'Salvando...' : 'Salvar Calendário'}
            </Button>
          )}
          <IconButton size="small" sx={{ color:'rgba(255,255,255,0.5)', pointerEvents:'none' }}>
            {expanded ? <ExpandLessIcon /> : <ExpandMoreIcon />}
          </IconButton>
        </Box>

        <Collapse in={expanded} timeout="auto" unmountOnExit>

        {/* Seção de Localização */}
        <Box sx={{ background:'rgba(255,255,255,0.04)', borderRadius:2, p:2, mb:3, border:'1px solid rgba(255,255,255,0.08)' }}>
          {locationMode === 'requesting' && (
            <Box sx={{ display:'flex', alignItems:'center', gap:2 }}>
              <CircularProgress size={20} sx={{ color:'#3b82f6' }} />
              <Typography sx={{ color:'rgba(255,255,255,0.7)', fontSize:'14px' }}>
                Solicitando permissão de localização...
              </Typography>
            </Box>
          )}

          {locationMode === 'auto' && location && (
            <Box sx={{ display:'flex', alignItems:'center', gap:2, flexWrap:'wrap' }}>
              <LocationOnIcon sx={{ color:'#10b981', fontSize:'20px' }} />
              <Typography sx={{ color:'rgba(255,255,255,0.9)', fontSize:'14px', fontWeight:500 }}>
                Localização detectada: <strong>{location.city}</strong>{location.uf ? ` — ${location.uf}` : ''}
              </Typography>
              <Chip label="Automático" size="small" sx={{ background:'rgba(16,185,129,0.15)', color:'#10b981', border:'1px solid #10b981', fontSize:'11px' }} />
              <Button size="small" variant="text" onClick={() => { setLocationMode('manual'); setLoadedFromBackend(false); }}
                sx={{ color:'rgba(255,255,255,0.5)', fontSize:'12px', textTransform:'none' }}>
                Alterar manualmente
              </Button>
            </Box>
          )}

          {(locationMode === 'denied' || locationMode === 'manual') && (
            <Box>
              <Box sx={{ display:'flex', alignItems:'center', gap:2, mb:2 }}>
                {loadedFromBackend
                  ? <LocationOnIcon sx={{ color:'#3b82f6', fontSize:'20px' }} />
                  : <LocationOffIcon sx={{ color:'#f59e0b', fontSize:'20px' }} />
                }
                <Typography sx={{ color:'rgba(255,255,255,0.8)', fontSize:'14px' }}>
                  {loadedFromBackend
                    ? 'Localização da empresa (salva anteriormente):'
                    : locationMode === 'denied'
                      ? 'Localização negada ou indisponível. Selecione seu estado e cidade abaixo.'
                      : 'Seleção manual de localização. Selecione seu estado e cidade abaixo.'
                  }
                </Typography>
                {loadedFromBackend && (
                  <Chip label="Salvo" size="small" sx={{ background:'rgba(59,130,246,0.15)', color:'#60a5fa', border:'1px solid #3b82f6', fontSize:'11px' }} />
                )}
                {locationMode === 'denied' && (
                  <Button size="small" variant="outlined" startIcon={<RefreshIcon />} onClick={requestGeolocation}
                    sx={{ borderColor:'rgba(255,255,255,0.3)', color:'rgba(255,255,255,0.7)', fontSize:'12px' }}>
                    Tentar novamente
                  </Button>
                )}
              </Box>
              <Box sx={{ display:'flex', gap:2 }}>
                <FormControl size="small" sx={{ minWidth:180, ...fieldSx }}>
                  <InputLabel>Estado (UF)</InputLabel>
                  <Select value={manualUF} label="Estado (UF)" onChange={e => { setManualUF(e.target.value); setLoadedFromBackend(false); }}
                    MenuProps={{ PaperProps:{ sx:{ background:'#1e293b', color:'white' } } }}>
                    {ESTADOS_BR.map(e => <MenuItem key={e.uf} value={e.uf}>{e.uf} — {e.name}</MenuItem>)}
                  </Select>
                </FormControl>
                <TextField
                  size="small"
                  label="Cidade (opcional)"
                  value={manualCity}
                  onChange={e => { setManualCity(e.target.value); setLoadedFromBackend(false); }}
                  sx={{ minWidth:200, ...fieldSx }}
                  placeholder="Ex: São Paulo"
                />
              </Box>
            </Box>
          )}
        </Box>

        {/* Controles: Ano + Vista + Adicionar */}
        <Box sx={{ display:'flex', alignItems:'center', gap:2, mb:3, flexWrap:'wrap' }}>
          <FormControl size="small" sx={{ minWidth:120, ...fieldSx }}>
            <InputLabel>Ano</InputLabel>
            <Select value={year} label="Ano" onChange={e => setYear(Number(e.target.value))}
              MenuProps={{ PaperProps:{ sx:{ background:'#1e293b', color:'white' } } }}>
              {[currentYear - 1, currentYear, currentYear + 1].map(y => <MenuItem key={y} value={y}>{y}</MenuItem>)}
            </Select>
          </FormControl>

          <Box sx={{ display:'flex', borderRadius:1, overflow:'hidden', border:'1px solid rgba(255,255,255,0.15)' }}>
            {(['list','calendar'] as const).map(v => (
              <Button key={v} size="small" onClick={() => setView(v)}
                sx={{ borderRadius:0, px:2, textTransform:'none', fontSize:'13px',
                  background: view === v ? 'rgba(59,130,246,0.3)' : 'transparent',
                  color: view === v ? '#60a5fa' : 'rgba(255,255,255,0.5)',
                  '&:hover':{ background:'rgba(59,130,246,0.15)' } }}>
                {v === 'list' ? 'Lista' : 'Calendário'}
              </Button>
            ))}
          </Box>

          <Box sx={{ ml:'auto', display:'flex', gap:1, alignItems:'center' }}>
            {loadingHolidays && <CircularProgress size={18} sx={{ color:'rgba(255,255,255,0.5)' }} />}
            <Tooltip title="Recarregar feriados automáticos">
              <IconButton size="small" onClick={() => fetchHolidays(uf||'', city||'', year)}
                sx={{ color:'rgba(255,255,255,0.5)', '&:hover':{ color:'white' } }}>
                <RefreshIcon fontSize="small" />
              </IconButton>
            </Tooltip>
            <Button size="small" variant="outlined" startIcon={<AddIcon />} onClick={() => setAddDialog(true)}
              sx={{ borderColor:'rgba(255,255,255,0.3)', color:'rgba(255,255,255,0.8)', fontSize:'13px', textTransform:'none',
                '&:hover':{ borderColor:'rgba(255,255,255,0.5)', background:'rgba(255,255,255,0.05)' } }}>
              Adicionar Feriado
            </Button>
          </Box>
        </Box>

        {/* Legenda */}
        <Box sx={{ display:'flex', gap:2, mb:3, flexWrap:'wrap' }}>
          {(Object.entries(SOURCE_LABEL) as [HolidaySource, string][]).map(([src, label]) => (
            <Box key={src} sx={{ display:'flex', alignItems:'center', gap:0.5 }}>
              <Box sx={{ width:10, height:10, borderRadius:'50%', background: SOURCE_COLOR[src] }} />
              <Typography sx={{ fontSize:'12px', color:'rgba(255,255,255,0.6)' }}>{label}</Typography>
            </Box>
          ))}
          <Box sx={{ display:'flex', alignItems:'center', gap:0.5, ml:1 }}>
            <Box sx={{ width:10, height:10, borderRadius:'50%', background:'rgba(255,255,255,0.2)' }} />
            <Typography sx={{ fontSize:'12px', color:'rgba(255,255,255,0.4)' }}>Desativado</Typography>
          </Box>
        </Box>

        {/* Conteúdo principal */}
        {(!uf && locationMode !== 'auto') ? (
          <Alert severity="info" sx={{ background:'rgba(59,130,246,0.1)', color:'rgba(255,255,255,0.9)', border:'1px solid rgba(59,130,246,0.3)' }}>
            Selecione um estado para carregar o calendário de feriados.
          </Alert>
        ) : loadingHolidays ? (
          <Box sx={{ display:'flex', justifyContent:'center', py:6, gap:2, flexDirection:'column', alignItems:'center' }}>
            <CircularProgress sx={{ color:'#3b82f6' }} />
            <Typography sx={{ color:'rgba(255,255,255,0.5)', fontSize:'14px' }}>Carregando feriados...</Typography>
          </Box>
        ) : holidays.length === 0 ? (
          <Alert severity="warning" sx={{ background:'rgba(245,158,11,0.1)', color:'rgba(255,255,255,0.9)', border:'1px solid rgba(245,158,11,0.3)' }}>
            Nenhum feriado encontrado para {year}. Adicione feriados manualmente.
          </Alert>
        ) : view === 'list' ? (
          <ListView holidays={holidays} onToggle={toggleHoliday} onEdit={openEdit} onDelete={deleteHoliday} />
        ) : (
          <CalendarView holidays={holidays} year={year} onToggle={toggleHoliday} />
        )}

        {/* Resumo */}
        {holidays.length > 0 && (
          <Box sx={{ mt:3, pt:2, borderTop:'1px solid rgba(255,255,255,0.08)', display:'flex', gap:4, flexWrap:'wrap' }}>
            {[
              { label:'Total de feriados', value: holidays.filter(h=>h.active).length, color:'#60a5fa' },
              { label:'Nacionais', value: holidays.filter(h=>h.source==='nacional'&&h.active).length, color: SOURCE_COLOR.nacional },
              { label:'Municipais/Estaduais', value: holidays.filter(h=>['municipal','estadual'].includes(h.source)&&h.active).length, color: SOURCE_COLOR.municipal },
              { label:'Manuais / Ajustados', value: holidays.filter(h=>(h.custom||h.edited)&&h.active).length, color: SOURCE_COLOR.manual },
              { label:'Desativados', value: holidays.filter(h=>!h.active).length, color:'rgba(255,255,255,0.3)' },
            ].map(s => (
              <Box key={s.label} sx={{ textAlign:'center' }}>
                <Typography sx={{ fontSize:'22px', fontWeight:700, color: s.color }}>{s.value}</Typography>
                <Typography sx={{ fontSize:'12px', color:'rgba(255,255,255,0.5)' }}>{s.label}</Typography>
              </Box>
            ))}
          </Box>
        )}

        </Collapse>
      </CardContent>

      {/* Dialog: Editar feriado */}
      <Dialog open={editDialog.open} onClose={() => setEditDialog({ open:false, holiday:null })} maxWidth="sm" fullWidth
        PaperProps={{ sx:{ background:'#1e293b', color:'white', border:'1px solid rgba(255,255,255,0.1)' } }}>
        <DialogTitle sx={{ color:'white' }}>Editar Feriado</DialogTitle>
        <DialogContent sx={{ display:'flex', flexDirection:'column', gap:2, pt:'16px !important' }}>
          <TextField label="Nome do feriado" value={editDialog.holiday?.name||''} fullWidth
            onChange={e => setEditDialog(d => ({ ...d, holiday: d.holiday ? { ...d.holiday, name: e.target.value } : null }))}
            sx={fieldSx} />
          <FormControl fullWidth sx={fieldSx}>
            <InputLabel>Tipo</InputLabel>
            <Select value={editDialog.holiday?.type||'feriado'} label="Tipo"
              onChange={e => setEditDialog(d => ({ ...d, holiday: d.holiday ? { ...d.holiday, type: e.target.value as HolidayType } : null }))}
              MenuProps={{ PaperProps:{ sx:{ background:'#1e293b', color:'white' } } }}>
              <MenuItem value="feriado">Feriado</MenuItem>
              <MenuItem value="ponto_facultativo">Ponto Facultativo</MenuItem>
            </Select>
          </FormControl>
          <FormControl fullWidth sx={fieldSx}>
            <InputLabel>Abrangência</InputLabel>
            <Select value={editDialog.holiday?.source||'manual'} label="Abrangência"
              onChange={e => setEditDialog(d => ({ ...d, holiday: d.holiday ? { ...d.holiday, source: e.target.value as HolidaySource } : null }))}
              MenuProps={{ PaperProps:{ sx:{ background:'#1e293b', color:'white' } } }}>
              <MenuItem value="nacional">Nacional</MenuItem>
              <MenuItem value="estadual">Estadual</MenuItem>
              <MenuItem value="municipal">Municipal</MenuItem>
              <MenuItem value="manual">Manual</MenuItem>
            </Select>
          </FormControl>
          <FormControlLabel
            control={<Switch checked={editDialog.holiday?.active ?? true}
              onChange={e => setEditDialog(d => ({ ...d, holiday: d.holiday ? { ...d.holiday, active: e.target.checked } : null }))}
              sx={{ '& .MuiSwitch-switchBase.Mui-checked':{ color:'#3b82f6' }, '& .MuiSwitch-switchBase.Mui-checked + .MuiSwitch-track':{ backgroundColor:'#3b82f6' } }} />}
            label={<Typography sx={{ color:'rgba(255,255,255,0.8)' }}>Feriado ativo (conta no cálculo de ponto)</Typography>}
          />
        </DialogContent>
        <DialogActions sx={{ px:3, pb:2 }}>
          <Button onClick={() => setEditDialog({ open:false, holiday:null })} sx={{ color:'rgba(255,255,255,0.5)' }}>Cancelar</Button>
          <Button variant="contained" onClick={saveEdit} sx={{ background:'#2563eb' }}>Salvar</Button>
        </DialogActions>
      </Dialog>

      {/* Dialog: Adicionar feriado */}
      <Dialog open={addDialog} onClose={() => setAddDialog(false)} maxWidth="sm" fullWidth
        PaperProps={{ sx:{ background:'#1e293b', color:'white', border:'1px solid rgba(255,255,255,0.1)' } }}>
        <DialogTitle sx={{ color:'white' }}>Adicionar Feriado Manual</DialogTitle>
        <DialogContent sx={{ display:'flex', flexDirection:'column', gap:2, pt:'16px !important' }}>
          <TextField label="Data" type="date" value={newHoliday.date} fullWidth InputLabelProps={{ shrink:true }}
            onChange={e => setNewHoliday(p => ({ ...p, date: e.target.value }))} sx={fieldSx} />
          <TextField label="Nome do feriado" value={newHoliday.name} fullWidth placeholder="Ex: Aniversário da cidade"
            onChange={e => setNewHoliday(p => ({ ...p, name: e.target.value }))} sx={fieldSx} />
          <FormControl fullWidth sx={fieldSx}>
            <InputLabel>Tipo</InputLabel>
            <Select value={newHoliday.type} label="Tipo"
              onChange={e => setNewHoliday(p => ({ ...p, type: e.target.value as HolidayType }))}
              MenuProps={{ PaperProps:{ sx:{ background:'#1e293b', color:'white' } } }}>
              <MenuItem value="feriado">Feriado</MenuItem>
              <MenuItem value="ponto_facultativo">Ponto Facultativo</MenuItem>
            </Select>
          </FormControl>
        </DialogContent>
        <DialogActions sx={{ px:3, pb:2 }}>
          <Button onClick={() => setAddDialog(false)} sx={{ color:'rgba(255,255,255,0.5)' }}>Cancelar</Button>
          <Button variant="contained" startIcon={<AddIcon />} onClick={addHoliday} sx={{ background:'#2563eb' }}>Adicionar</Button>
        </DialogActions>
      </Dialog>
    </Card>
  );
};

// ── Subcomponente: Lista ───────────────────────────────────────────────────────

const ListView: React.FC<{
  holidays: Holiday[];
  onToggle: (id: string) => void;
  onEdit: (h: Holiday) => void;
  onDelete: (id: string) => void;
}> = ({ holidays, onToggle, onEdit, onDelete }) => {
  const grouped = holidays.reduce((acc, h) => {
    const m = new Date(h.date + 'T12:00:00').getMonth();
    acc[m] = acc[m] || [];
    acc[m].push(h);
    return acc;
  }, {} as Record<number, Holiday[]>);

  const fmt = (date: string) => {
    const [y, m, d] = date.split('-');
    return `${d}/${m}/${y}`;
  };

  const DOW = ['Dom','Seg','Ter','Qua','Qui','Sex','Sáb'];

  return (
    <Box sx={{ display:'flex', flexDirection:'column', gap:2 }}>
      {Object.entries(grouped).map(([mStr, hols]) => (
        <Box key={mStr}>
          <Typography sx={{ fontSize:'13px', fontWeight:600, color:'rgba(255,255,255,0.4)', textTransform:'uppercase', letterSpacing:'0.1em', mb:1 }}>
            {MONTHS_BR[Number(mStr)]}
          </Typography>
          <TableContainer component={Paper} sx={{ background:'rgba(255,255,255,0.03)', border:'1px solid rgba(255,255,255,0.07)', borderRadius:2 }}>
            <Table size="small">
              <TableBody>
                {hols.map(h => {
                  const dow = DOW[new Date(h.date + 'T12:00:00').getDay()];
                  return (
                    <TableRow key={h.id} sx={{ opacity: h.active ? 1 : 0.4, '&:hover':{ background:'rgba(255,255,255,0.03)' } }}>
                      <TableCell sx={{ border:'none', color:'rgba(255,255,255,0.9)', fontWeight:600, fontSize:'13px', width:100 }}>
                        {fmt(h.date)}
                      </TableCell>
                      <TableCell sx={{ border:'none', color:'rgba(255,255,255,0.4)', fontSize:'12px', width:40 }}>
                        {dow}
                      </TableCell>
                      <TableCell sx={{ border:'none', color:'rgba(255,255,255,0.85)', fontSize:'13px' }}>
                        <Box sx={{ display:'flex', alignItems:'center', gap:1 }}>
                          {h.name}
                          {h.edited && <Chip label="editado" size="small" sx={{ height:18, fontSize:'10px', background:'rgba(245,158,11,0.15)', color:'#f59e0b', border:'1px solid #f59e0b' }} />}
                          {h.custom && <Chip label="manual" size="small" sx={{ height:18, fontSize:'10px', background:'rgba(16,185,129,0.15)', color:'#10b981', border:'1px solid #10b981' }} />}
                        </Box>
                      </TableCell>
                      <TableCell sx={{ border:'none', width:110 }}>
                        <Chip label={SOURCE_LABEL[h.source]} size="small"
                          sx={{ height:20, fontSize:'11px', background: SOURCE_COLOR[h.source] + '22', color: SOURCE_COLOR[h.source], border:`1px solid ${SOURCE_COLOR[h.source]}55` }} />
                      </TableCell>
                      <TableCell sx={{ border:'none', width:120 }}>
                        <Chip label={h.type === 'feriado' ? 'Feriado' : 'Pt. Facultativo'} size="small"
                          sx={{ height:20, fontSize:'11px', background:'rgba(255,255,255,0.05)', color:'rgba(255,255,255,0.5)' }} />
                      </TableCell>
                      <TableCell sx={{ border:'none', width:130, textAlign:'right' }}>
                        <Box sx={{ display:'flex', justifyContent:'flex-end', gap:0.5 }}>
                          <Tooltip title={h.active ? 'Desativar' : 'Ativar'}>
                            <IconButton size="small" onClick={() => onToggle(h.id)}
                              sx={{ color: h.active ? '#10b981' : 'rgba(255,255,255,0.3)', '&:hover':{ color: h.active ? '#ef4444' : '#10b981' } }}>
                              {h.active ? <CheckCircleIcon fontSize="small" /> : <CancelIcon fontSize="small" />}
                            </IconButton>
                          </Tooltip>
                          <Tooltip title="Editar">
                            <IconButton size="small" onClick={() => onEdit(h)} sx={{ color:'rgba(255,255,255,0.4)', '&:hover':{ color:'#60a5fa' } }}>
                              <EditIcon fontSize="small" />
                            </IconButton>
                          </Tooltip>
                          {h.custom && (
                            <Tooltip title="Remover">
                              <IconButton size="small" onClick={() => onDelete(h.id)} sx={{ color:'rgba(255,255,255,0.3)', '&:hover':{ color:'#ef4444' } }}>
                                <DeleteIcon fontSize="small" />
                              </IconButton>
                            </Tooltip>
                          )}
                        </Box>
                      </TableCell>
                    </TableRow>
                  );
                })}
              </TableBody>
            </Table>
          </TableContainer>
        </Box>
      ))}
    </Box>
  );
};

// ── Subcomponente: Calendário anual ────────────────────────────────────────────

const CalendarView: React.FC<{
  holidays: Holiday[];
  year: number;
  onToggle: (id: string) => void;
}> = ({ holidays, year, onToggle }) => {
  const holidayMap = new Map<string, Holiday>();
  holidays.forEach(h => holidayMap.set(h.date, h));

  return (
    <Box sx={{ display:'grid', gridTemplateColumns:'repeat(auto-fill, minmax(260px, 1fr))', gap:2 }}>
      {Array.from({ length:12 }, (_, m) => {
        const firstDay = new Date(year, m, 1).getDay(); // 0=Sun
        const daysInMonth = new Date(year, m + 1, 0).getDate();
        const cells: (number | null)[] = [...Array(firstDay).fill(null), ...Array.from({ length: daysInMonth }, (_, i) => i + 1)];

        return (
          <Box key={m} sx={{ background:'rgba(255,255,255,0.03)', border:'1px solid rgba(255,255,255,0.07)', borderRadius:2, p:1.5 }}>
            <Typography sx={{ fontSize:'13px', fontWeight:600, color:'rgba(255,255,255,0.7)', mb:1, textAlign:'center', textTransform:'uppercase', letterSpacing:'0.05em' }}>
              {MONTHS_BR[m]}
            </Typography>
            <Box sx={{ display:'grid', gridTemplateColumns:'repeat(7,1fr)', gap:'2px', mb:'4px' }}>
              {['D','S','T','Q','Q','S','S'].map((d, i) => (
                <Typography key={i} sx={{ fontSize:'10px', color:'rgba(255,255,255,0.3)', textAlign:'center', fontWeight:600 }}>{d}</Typography>
              ))}
            </Box>
            <Box sx={{ display:'grid', gridTemplateColumns:'repeat(7,1fr)', gap:'2px' }}>
              {cells.map((day, i) => {
                if (!day) return <Box key={i} />;
                const iso = `${year}-${String(m+1).padStart(2,'0')}-${String(day).padStart(2,'0')}`;
                const holiday = holidayMap.get(iso);
                const isWeekend = new Date(iso + 'T12:00:00').getDay() === 0 || new Date(iso + 'T12:00:00').getDay() === 6;
                return (
                  <Tooltip key={i} title={holiday ? `${holiday.name}${!holiday.active ? ' (desativado)' : ''}` : ''} placement="top">
                    <Box
                      onClick={() => holiday && onToggle(holiday.id)}
                      sx={{
                        height: 26, display:'flex', alignItems:'center', justifyContent:'center',
                        borderRadius: 1, cursor: holiday ? 'pointer' : 'default',
                        fontSize: '12px', fontWeight: holiday ? 700 : 400,
                        background: holiday && holiday.active ? SOURCE_COLOR[holiday.source] + '33' : 'transparent',
                        border: holiday && holiday.active ? `1px solid ${SOURCE_COLOR[holiday.source]}88` : '1px solid transparent',
                        color: holiday && holiday.active ? SOURCE_COLOR[holiday.source] : isWeekend ? 'rgba(255,255,255,0.25)' : 'rgba(255,255,255,0.6)',
                        opacity: holiday && !holiday.active ? 0.35 : 1,
                        '&:hover': holiday ? { opacity: 0.75 } : {},
                      }}
                    >
                      {day}
                    </Box>
                  </Tooltip>
                );
              })}
            </Box>
          </Box>
        );
      })}
    </Box>
  );
};

export default HolidayCalendarSettings;
