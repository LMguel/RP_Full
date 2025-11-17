/**
 * Daily Summary Table Component
 * Displays daily summaries in a table format with status indicators
 */

import React from 'react';
import {
  Table,
  TableBody,
  TableCell,
  TableContainer,
  TableHead,
  TableRow,
  Paper,
  Chip,
  IconButton,
  Tooltip,
  CircularProgress,
  Box,
  Typography
} from '@mui/material';
import {
  Visibility as VisibilityIcon,
  CheckCircle as CheckCircleIcon,
  Cancel as CancelIcon,
  Schedule as ScheduleIcon,
  TrendingUp as TrendingUpIcon
} from '@mui/icons-material';

interface DailySummary {
  company_id: string;
  employee_id: string;
  date: string;
  employee_name?: string;
  scheduled_start?: string;
  scheduled_end?: string;
  actual_start?: string;
  actual_end?: string;
  worked_hours: number; // minutes
  expected_hours: number; // minutes
  delay_minutes: number;
  extra_minutes: number;
  compensated_minutes: number;
  daily_balance: number; // minutes
  status: string;
  record_count: number;
}

interface DailySummaryTableProps {
  summaries: DailySummary[];
  onRowClick?: (summary: DailySummary) => void;
  loading?: boolean;
}

const formatMinutesToHHMM = (minutes: number): string => {
  if (minutes === 0) return '00:00';
  const hours = Math.floor(Math.abs(minutes) / 60);
  const mins = Math.abs(minutes) % 60;
  const sign = minutes < 0 ? '-' : '';
  return `${sign}${hours.toString().padStart(2, '0')}:${mins.toString().padStart(2, '0')}`;
};

const getStatusColor = (status: string): 'success' | 'error' | 'warning' | 'info' | 'default' => {
  const statusMap: Record<string, 'success' | 'error' | 'warning' | 'info' | 'default'> = {
    'normal': 'success',
    'late': 'error',
    'extra_hours': 'info',
    'compensated': 'warning',
    'absent': 'error',
    'day_off': 'default',
    'worked_day_off': 'info'
  };
  return statusMap[status] || 'default';
};

const getStatusLabel = (status: string): string => {
  const statusLabels: Record<string, string> = {
    'normal': 'Normal',
    'late': 'Atrasado',
    'extra_hours': 'Hora Extra',
    'compensated': 'Compensado',
    'absent': 'Ausente',
    'day_off': 'Folga',
    'worked_day_off': 'Trabalhou na Folga'
  };
  return statusLabels[status] || status;
};

const DailySummaryTable: React.FC<DailySummaryTableProps> = ({
  summaries,
  onRowClick,
  loading = false
}) => {
  
  if (loading) {
    return (
      <Box display="flex" justifyContent="center" alignItems="center" minHeight={300}>
        <CircularProgress />
      </Box>
    );
  }

  if (!summaries || summaries.length === 0) {
    return (
      <Box p={4} textAlign="center">
        <Typography variant="h6" color="textSecondary">
          Nenhum registro encontrado
        </Typography>
        <Typography variant="body2" color="textSecondary" mt={1}>
          Não há dados de resumo diário para o período selecionado
        </Typography>
      </Box>
    );
  }

  return (
    <TableContainer component={Paper} sx={{ maxHeight: 600 }}>
      <Table stickyHeader>
        <TableHead>
          <TableRow>
            <TableCell>Data</TableCell>
            <TableCell>Funcionário</TableCell>
            <TableCell align="center">Entrada</TableCell>
            <TableCell align="center">Saída</TableCell>
            <TableCell align="center">Horas Trabalhadas</TableCell>
            <TableCell align="center">Atraso</TableCell>
            <TableCell align="center">Extra</TableCell>
            <TableCell align="center">Saldo</TableCell>
            <TableCell align="center">Status</TableCell>
            <TableCell align="center">Ações</TableCell>
          </TableRow>
        </TableHead>
        <TableBody>
          {summaries.map((summary) => {
            const balanceColor = summary.daily_balance > 0 ? 'success.main' : 
                               summary.daily_balance < 0 ? 'error.main' : 'text.secondary';
            
            return (
              <TableRow 
                key={`${summary.employee_id}-${summary.date}`}
                hover
                sx={{ cursor: onRowClick ? 'pointer' : 'default' }}
                onClick={() => onRowClick && onRowClick(summary)}
              >
                <TableCell>
                  {new Date(summary.date).toLocaleDateString('pt-BR')}
                </TableCell>
                <TableCell>{summary.employee_name || summary.employee_id}</TableCell>
                <TableCell align="center">
                  {summary.actual_start ? 
                    new Date(summary.actual_start).toLocaleTimeString('pt-BR', { 
                      hour: '2-digit', 
                      minute: '2-digit' 
                    }) : 
                    '-'
                  }
                </TableCell>
                <TableCell align="center">
                  {summary.actual_end ? 
                    new Date(summary.actual_end).toLocaleTimeString('pt-BR', { 
                      hour: '2-digit', 
                      minute: '2-digit' 
                    }) : 
                    '-'
                  }
                </TableCell>
                <TableCell align="center">
                  <Box display="flex" alignItems="center" justifyContent="center" gap={0.5}>
                    <ScheduleIcon fontSize="small" color="action" />
                    <Typography variant="body2">
                      {formatMinutesToHHMM(summary.worked_hours)}
                    </Typography>
                  </Box>
                </TableCell>
                <TableCell align="center">
                  {summary.delay_minutes > 0 ? (
                    <Chip 
                      label={formatMinutesToHHMM(summary.delay_minutes)} 
                      size="small" 
                      color="error" 
                      icon={<CancelIcon />}
                    />
                  ) : (
                    '-'
                  )}
                </TableCell>
                <TableCell align="center">
                  {summary.extra_minutes > 0 ? (
                    <Chip 
                      label={formatMinutesToHHMM(summary.extra_minutes)} 
                      size="small" 
                      color="info" 
                      icon={<TrendingUpIcon />}
                    />
                  ) : (
                    '-'
                  )}
                </TableCell>
                <TableCell align="center">
                  <Typography 
                    variant="body2" 
                    fontWeight="bold"
                    color={balanceColor}
                  >
                    {formatMinutesToHHMM(summary.daily_balance)}
                  </Typography>
                </TableCell>
                <TableCell align="center">
                  <Chip 
                    label={getStatusLabel(summary.status)} 
                    size="small" 
                    color={getStatusColor(summary.status)}
                    icon={
                      summary.status === 'normal' ? <CheckCircleIcon /> :
                      summary.status === 'late' ? <CancelIcon /> :
                      <ScheduleIcon />
                    }
                  />
                </TableCell>
                <TableCell align="center">
                  <Tooltip title="Ver detalhes">
                    <IconButton 
                      size="small"
                      onClick={(e) => {
                        e.stopPropagation();
                        onRowClick && onRowClick(summary);
                      }}
                    >
                      <VisibilityIcon fontSize="small" />
                    </IconButton>
                  </Tooltip>
                </TableCell>
              </TableRow>
            );
          })}
        </TableBody>
      </Table>
    </TableContainer>
  );
};

export default DailySummaryTable;
