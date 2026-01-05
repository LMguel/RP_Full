import React, { useEffect, useState } from 'react';
import {
  Box,
  Button,
  TextField,
  Typography,
  Switch,
  FormControlLabel,
  CircularProgress,
  Card,
  CardContent,
} from '@mui/material';
import { toast } from 'react-hot-toast';
import { apiService } from '../services/api';
import { MapContainer, TileLayer, Marker, Circle, useMapEvents } from 'react-leaflet';
import L from 'leaflet';
import 'leaflet/dist/leaflet.css';

// Fix default icon paths for leaflet when bundled (Vite / ESM)
try {
  const iconRetinaUrl = new URL('leaflet/dist/images/marker-icon-2x.png', import.meta.url).href;
  const iconUrl = new URL('leaflet/dist/images/marker-icon.png', import.meta.url).href;
  const shadowUrl = new URL('leaflet/dist/images/marker-shadow.png', import.meta.url).href;

  // Work around differing typings across leaflet/react-leaflet versions
  // cast to any to avoid TS errors when accessing Icon.Default
  // @ts-ignore
  const IconDefault: any = (L as any).Icon && (L as any).Icon.Default ? (L as any).Icon.Default : (L as any).Icon;
  try {
    // @ts-ignore
    delete IconDefault.prototype._getIconUrl;
  } catch (e) {}
  if (IconDefault && typeof IconDefault.mergeOptions === 'function') {
    IconDefault.mergeOptions({
      iconRetinaUrl,
      iconUrl,
      shadowUrl,
    });
  }
} catch (e) {
  // ignore in non-browser or unexpected environments
}

const DEFAULT_CENTER: [number, number] = [-23.55052, -46.633308]; // São Paulo

function ClickHandler({ setPosition }: { setPosition: (pos: [number, number]) => void }) {
  useMapEvents({
    click(e: any) {
      setPosition([e.latlng.lat, e.latlng.lng]);
    },
  });
  return null;
}

const LocationSettings: React.FC = () => {
  const [loading, setLoading] = useState(true);
  const [saving, setSaving] = useState(false);
  const [position, setPosition] = useState<[number, number] | null>(null);
  const [radius, setRadius] = useState<number>(100);
  const [requireLocation, setRequireLocation] = useState<boolean>(true);

  useEffect(() => {
    (async () => {
      try {
        setLoading(true);
        const res = await apiService.get('/api/configuracoes');
        if (res) {
          const lat = res.company_lat ?? res.latitude ?? res.latitude_empresa ?? null;
          const lng = res.company_lng ?? res.longitude ?? res.longitude_empresa ?? null;
          const raio = res.raio_permitido_metros ?? res.raio_permitido ?? res.raio_permitido ?? 100;
          const exigir = typeof res.exigir_localizacao !== 'undefined' ? res.exigir_localizacao : true;

          if (lat && lng) setPosition([Number(lat), Number(lng)]);
          setRadius(Number(raio));
          setRequireLocation(Boolean(exigir));
        }
      } catch (err) {
        console.error('Erro ao carregar localização da empresa', err);
      } finally {
        setLoading(false);
      }
    })();
  }, []);

  const handleSave = async () => {
    if (!position) {
      toast.error('Clique no mapa ou capture a localização antes de salvar');
      return;
    }
    if (radius < 10 || radius > 5000) {
      toast.error('Raio deve estar entre 10m e 5000m');
      return;
    }

    try {
      setSaving(true);
      const payload = {
        company_lat: position[0],
        company_lng: position[1],
        raio_permitido: radius,
        exigir_localizacao: requireLocation,
      };
      const resp = await apiService.post('/api/company/update-location', payload);
      if (resp && resp.success) {
        toast.success('Localização salva');
      } else {
        toast.error(resp?.error || 'Erro ao salvar localização');
      }
    } catch (err: any) {
      console.error(err);
      toast.error(err?.message || 'Erro ao salvar localização');
    } finally {
      setSaving(false);
    }
  };

  return (
    <Card sx={{ background: 'rgba(255,255,255,0.04)', borderRadius: 2 }}>
      <CardContent>
        <Box sx={{ display: 'flex', alignItems: 'center', justifyContent: 'space-between', mb: 2 }}>
          <Box>
            <Typography variant="h6" sx={{ color: 'white', fontWeight: 600 }}>Localização da Empresa</Typography>
            <Typography variant="body2" sx={{ color: 'rgba(255,255,255,0.7)' }}>Defina a localização da empresa clicando no mapa ou usando o botão de captura.</Typography>
          </Box>
          <Box>
            <FormControlLabel
              control={<Switch checked={requireLocation} onChange={(e) => setRequireLocation(e.target.checked)} />}
              label={<Typography sx={{ color: 'rgba(255,255,255,0.85)' }}>Exigir localização</Typography>}
            />
          </Box>
        </Box>

        {loading ? (
          <Box sx={{ display: 'flex', justifyContent: 'center', p: 4 }}>
            <CircularProgress />
          </Box>
        ) : (
          <>
            <Box sx={{ height: 360, mb: 2 }}>
              {/* Typing mismatches between leaflet and react-leaflet can cause TS errors; ignore here */}
              {/* @ts-ignore */}
              <MapContainer center={(position ?? DEFAULT_CENTER) as any} zoom={16} style={{ height: '100%', borderRadius: 8 }}>
                <TileLayer url="https://{s}.tile.openstreetmap.org/{z}/{x}/{y}.png" />
                <ClickHandler setPosition={setPosition} />
                {position && (
                  <>
                    {/* @ts-ignore */}
                    <Marker position={position as any} />
                    {/* @ts-ignore */}
                    <Circle center={position as any} radius={radius as any} pathOptions={{ color: '#3b82f6', fillOpacity: 0.08 }} />
                  </>
                )}
              </MapContainer>
            </Box>

            <Box sx={{ display: 'flex', gap: 2, alignItems: 'center', flexWrap: 'wrap' }}>
              <TextField
                label="Latitude"
                size="small"
                value={position ? position[0] : ''}
                onChange={(e) => setPosition(prev => prev ? [Number(e.target.value || 0), prev[1]] : [Number(e.target.value || 0), 0])}
                sx={{
                  '& .MuiInputBase-input': { color: 'white' },
                  '& .MuiOutlinedInput-notchedOutline': { borderColor: 'rgba(255,255,255,0.12)' },
                  background: 'transparent'
                }}
              />
              <TextField
                label="Longitude"
                size="small"
                value={position ? position[1] : ''}
                onChange={(e) => setPosition(prev => prev ? [prev[0], Number(e.target.value || 0)] : [0, Number(e.target.value || 0)])}
                sx={{
                  '& .MuiInputBase-input': { color: 'white' },
                  '& .MuiOutlinedInput-notchedOutline': { borderColor: 'rgba(255,255,255,0.12)' },
                  background: 'transparent'
                }}
              />
              <TextField
                label="Raio (m)"
                size="small"
                type="number"
                value={radius}
                onChange={(e) => setRadius(Number(e.target.value || 0))}
                sx={{
                  '& .MuiInputBase-input': { color: 'white' },
                  '& .MuiOutlinedInput-notchedOutline': { borderColor: 'rgba(255,255,255,0.12)' },
                  background: 'transparent'
                }}
              />
              <Button variant="contained" onClick={handleSave} disabled={saving} sx={{ ml: 'auto' }}>{saving ? 'Salvando...' : 'Salvar Localização'}</Button>
            </Box>
          </>
        )}
      </CardContent>
    </Card>
  );
};

export default LocationSettings;
