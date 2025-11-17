import React from 'react';
import {
  Dialog,
  DialogTitle,
  DialogContent,
  IconButton,
  Typography,
  Box,
  Chip,
  Avatar,
} from '@mui/material';
import { X, Clock, MapPin, Camera, User, AlertCircle } from 'lucide-react';
import type { DailySummary, TimeRecord } from '../types/dailySummary';

interface TimeRecordsModalProps {
  open: boolean;
  onClose: () => void;
  summary: DailySummary | null;
  records: TimeRecord[];
  loading?: boolean;
}

const TimeRecordsModal: React.FC<TimeRecordsModalProps> = ({
  open,
  onClose,
  summary,
  records,
  loading = false,
}) => {
  if (!summary) return null;

  const formatTime = (isoString: string) => {
    return new Date(isoString).toLocaleTimeString('pt-BR', {
      hour: '2-digit',
      minute: '2-digit',
      second: '2-digit',
    });
  };

  const formatDate = (dateString: string) => {
    const [year, month, day] = dateString.split('-');
    return `${day}/${month}/${year}`;
  };

  const getStatusColor = (status: DailySummary['status']) => {
    switch (status) {
      case 'normal':
        return 'success';
      case 'late':
        return 'warning';
      case 'extra':
        return 'info';
      case 'absent':
      case 'missing_exit':
        return 'error';
      default:
        return 'default';
    }
  };

  const getStatusLabel = (status: DailySummary['status']) => {
    const labels = {
      normal: 'Normal',
      late: 'Atraso',
      extra: 'Hora Extra',
      absent: 'Ausente',
      missing_exit: 'Saída Não Registrada',
      incomplete: 'Incompleto',
    };
    return labels[status] || status;
  };

  return (
    <Dialog
      open={open}
      onClose={onClose}
      maxWidth="md"
      fullWidth
      PaperProps={{
        sx: {
          borderRadius: 3,
          maxHeight: '90vh',
        },
      }}
    >
      {/* Header */}
      <DialogTitle
        sx={{
          display: 'flex',
          alignItems: 'center',
          justifyContent: 'space-between',
          borderBottom: '1px solid #e5e7eb',
          pb: 2,
        }}
      >
        <Box sx={{ display: 'flex', alignItems: 'center', gap: 2 }}>
          {summary.employee_photo ? (
            <Avatar
              src={summary.employee_photo}
              alt={summary.employee_name}
              sx={{ width: 48, height: 48 }}
            />
          ) : (
            <Avatar sx={{ width: 48, height: 48, bgcolor: '#3b82f6' }}>
              <User size={24} />
            </Avatar>
          )}
          <Box>
            <Typography variant="h6" fontWeight={600}>
              {summary.employee_name}
            </Typography>
            <Typography variant="body2" color="text.secondary">
              {formatDate(summary.date)}
            </Typography>
          </Box>
        </Box>

        <IconButton
          onClick={onClose}
          sx={{
            color: '#6b7280',
            '&:hover': { bgcolor: '#f3f4f6' },
          }}
        >
          <X size={20} />
        </IconButton>
      </DialogTitle>

      {/* Content */}
      <DialogContent sx={{ p: 3 }}>
        {loading ? (
          <Box sx={{ textAlign: 'center', py: 4 }}>
            <Typography color="text.secondary">Carregando registros...</Typography>
          </Box>
        ) : (
          <>
            {/* Resumo do Dia */}
            <Box
              sx={{
                bgcolor: '#f9fafb',
                borderRadius: 2,
                p: 2.5,
                mb: 3,
              }}
            >
              <Typography variant="subtitle2" fontWeight={600} mb={2}>
                Resumo do Dia
              </Typography>

              <Box sx={{ display: 'grid', gridTemplateColumns: 'repeat(2, 1fr)', gap: 2 }}>
                <Box>
                  <Typography variant="caption" color="text.secondary">
                    Status
                  </Typography>
                  <Box sx={{ mt: 0.5 }}>
                    <Chip
                      label={getStatusLabel(summary.status)}
                      color={getStatusColor(summary.status)}
                      size="small"
                    />
                  </Box>
                </Box>

                <Box>
                  <Typography variant="caption" color="text.secondary">
                    Total de Batidas
                  </Typography>
                  <Typography variant="body2" fontWeight={500}>
                    {summary.total_records} registros
                  </Typography>
                </Box>

                <Box>
                  <Typography variant="caption" color="text.secondary">
                    Horas Trabalhadas
                  </Typography>
                  <Typography variant="body2" fontWeight={500}>
                    {summary.worked_hours.toFixed(2)}h
                  </Typography>
                </Box>

                <Box>
                  <Typography variant="caption" color="text.secondary">
                    Horas Previstas
                  </Typography>
                  <Typography variant="body2" fontWeight={500}>
                    {summary.expected_hours.toFixed(2)}h
                  </Typography>
                </Box>

                <Box>
                  <Typography variant="caption" color="text.secondary">
                    Diferença
                  </Typography>
                  <Typography
                    variant="body2"
                    fontWeight={500}
                    color={summary.difference_minutes >= 0 ? 'success.main' : 'error.main'}
                  >
                    {summary.difference_minutes >= 0 ? '+' : ''}
                    {Math.floor(Math.abs(summary.difference_minutes) / 60)}h
                    {Math.abs(summary.difference_minutes) % 60}min
                  </Typography>
                </Box>

                {summary.overtime_minutes > 0 && (
                  <Box>
                    <Typography variant="caption" color="text.secondary">
                      Horas Extras
                    </Typography>
                    <Typography variant="body2" fontWeight={500} color="info.main">
                      +{Math.floor(summary.overtime_minutes / 60)}h
                      {summary.overtime_minutes % 60}min
                    </Typography>
                  </Box>
                )}

                {summary.delay_minutes > 0 && (
                  <Box>
                    <Typography variant="caption" color="text.secondary">
                      Atraso Total
                    </Typography>
                    <Typography variant="body2" fontWeight={500} color="warning.main">
                      {Math.floor(summary.delay_minutes / 60)}h
                      {summary.delay_minutes % 60}min
                    </Typography>
                  </Box>
                )}
              </Box>

              {/* Alertas */}
              {(summary.missing_exit || summary.has_location_issues) && (
                <Box
                  sx={{
                    mt: 2,
                    pt: 2,
                    borderTop: '1px solid #e5e7eb',
                    display: 'flex',
                    flexDirection: 'column',
                    gap: 1,
                  }}
                >
                  {summary.missing_exit && (
                    <Box sx={{ display: 'flex', alignItems: 'center', gap: 1 }}>
                      <AlertCircle size={16} color="#ef4444" />
                      <Typography variant="caption" color="error.main">
                        Saída não registrada
                      </Typography>
                    </Box>
                  )}
                  {summary.has_location_issues && (
                    <Box sx={{ display: 'flex', alignItems: 'center', gap: 1 }}>
                      <MapPin size={16} color="#f59e0b" />
                      <Typography variant="caption" color="warning.main">
                        Batidas fora do local autorizado
                      </Typography>
                    </Box>
                  )}
                </Box>
              )}
            </Box>

            {/* Lista de Registros */}
            <Typography variant="subtitle2" fontWeight={600} mb={2}>
              Registros Individuais ({records.length})
            </Typography>

            {records.length === 0 ? (
              <Box sx={{ textAlign: 'center', py: 4 }}>
                <Typography color="text.secondary">Nenhum registro encontrado</Typography>
              </Box>
            ) : (
              <Box sx={{ display: 'flex', flexDirection: 'column', gap: 1.5 }}>
                {records.map((record, index) => (
                  <Box
                    key={record.id}
                    sx={{
                      border: '1px solid #e5e7eb',
                      borderRadius: 2,
                      p: 2,
                      '&:hover': { bgcolor: '#f9fafb' },
                      transition: 'background-color 0.2s',
                    }}
                  >
                    <Box sx={{ display: 'flex', alignItems: 'start', gap: 2 }}>
                      {/* Número da Batida */}
                      <Box
                        sx={{
                          width: 32,
                          height: 32,
                          borderRadius: '50%',
                          bgcolor: record.tipo === 'entrada' ? '#dbeafe' : '#fef3c7',
                          color: record.tipo === 'entrada' ? '#1e40af' : '#b45309',
                          display: 'flex',
                          alignItems: 'center',
                          justifyContent: 'center',
                          fontWeight: 600,
                          fontSize: '0.875rem',
                          flexShrink: 0,
                        }}
                      >
                        {index + 1}
                      </Box>

                      {/* Informações */}
                      <Box sx={{ flex: 1 }}>
                        <Box sx={{ display: 'flex', alignItems: 'center', gap: 1, mb: 0.5 }}>
                          <Clock size={16} color="#6b7280" />
                          <Typography variant="body2" fontWeight={600}>
                            {formatTime(record.data_hora)}
                          </Typography>
                          <Chip
                            label={record.tipo === 'entrada' ? 'Entrada' : 'Saída'}
                            size="small"
                            color={record.tipo === 'entrada' ? 'primary' : 'warning'}
                            sx={{ height: 20, fontSize: '0.75rem' }}
                          />
                        </Box>

                        <Box sx={{ display: 'flex', flexWrap: 'wrap', gap: 1.5, mt: 1 }}>
                          {/* Método */}
                          <Box sx={{ display: 'flex', alignItems: 'center', gap: 0.5 }}>
                            {record.metodo === 'automatico' ? (
                              <Camera size={14} color="#6b7280" />
                            ) : (
                              <User size={14} color="#6b7280" />
                            )}
                            <Typography variant="caption" color="text.secondary">
                              {record.metodo === 'automatico' ? 'Automático' : 'Manual'}
                            </Typography>
                          </Box>

                          {/* Localização */}
                          {record.location && (
                            <Box sx={{ display: 'flex', alignItems: 'center', gap: 0.5 }}>
                              <MapPin
                                size={14}
                                color={record.location.inside_radius ? '#10b981' : '#ef4444'}
                              />
                              <Typography
                                variant="caption"
                                color={
                                  record.location.inside_radius
                                    ? 'success.main'
                                    : 'error.main'
                                }
                              >
                                {record.location.inside_radius
                                  ? 'Dentro do raio'
                                  : 'Fora do raio'}
                              </Typography>
                            </Box>
                          )}
                        </Box>

                        {/* Observações */}
                        {record.observacoes && (
                          <Typography
                            variant="caption"
                            color="text.secondary"
                            sx={{
                              display: 'block',
                              mt: 1,
                              fontStyle: 'italic',
                              bgcolor: '#fef3c7',
                              px: 1,
                              py: 0.5,
                              borderRadius: 1,
                            }}
                          >
                            "{record.observacoes}"
                          </Typography>
                        )}
                      </Box>

                      {/* Foto */}
                      {record.foto && (
                        <Avatar
                          src={record.foto}
                          alt="Foto do registro"
                          variant="rounded"
                          sx={{ width: 48, height: 48 }}
                        />
                      )}
                    </Box>
                  </Box>
                ))}
              </Box>
            )}
          </>
        )}
      </DialogContent>
    </Dialog>
  );
};

export default TimeRecordsModal;
