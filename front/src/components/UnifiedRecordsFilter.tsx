import React, { useState, useEffect, useCallback } from 'react';
import {
  Box,
  TextField,
  Autocomplete,
  InputAdornment,
  Button,
  Typography,
} from '@mui/material';
import {
  Search as SearchIcon,
  Clear as ClearIcon,
  CalendarToday as CalendarIcon,
  FileDownload as FileDownloadIcon,
} from '@mui/icons-material';
import { Filter } from 'lucide-react';
import { DateRangePicker } from './DateRangePicker';
import { apiService } from '../services/api';
import { Employee } from '../types';

interface DateRange {
  start_date: string;
  end_date: string;
}

// Interface simplificada para funcionários (compatível com Employee global)
interface EmployeeOption {
  id: string;
  nome: string;
  cargo?: string;
}

interface UnifiedRecordsFilterProps {
  // Estado do filtro de funcionário
  selectedEmployee: EmployeeOption | null;
  onEmployeeChange: (employee: EmployeeOption | null) => void;
  
  // Estado do filtro de mês
  selectedMonth: string;
  onMonthChange: (month: string) => void;
  
  // Estado do filtro de data
  dateRange: DateRange;
  onDateRangeChange: (range: DateRange) => void;
  
  // Callbacks
  onClearFilters: () => void;
  onExportExcel?: () => void;
  
  // Controles de exibição
  showExportButton?: boolean;
  exportDisabled?: boolean;
  
  // Funcionários (opcional - se não fornecido, busca internamente)
  employees?: EmployeeOption[];
}

// Funções utilitárias para datas
const getFirstDayOfMonth = (yearMonth: string): string => {
  const [year, month] = yearMonth.split('-').map(Number);
  return `${year}-${month.toString().padStart(2, '0')}-01`;
};

const getLastDayOfMonth = (yearMonth: string): string => {
  const [year, month] = yearMonth.split('-').map(Number);
  const lastDay = new Date(year, month, 0).getDate();
  return `${year}-${month.toString().padStart(2, '0')}-${lastDay.toString().padStart(2, '0')}`;
};

const getCurrentMonth = (): string => {
  const now = new Date();
  const year = now.getFullYear();
  const month = now.getMonth() + 1;
  return `${year}-${month.toString().padStart(2, '0')}`;
};

const getMonthFromDate = (dateString: string): string => {
  if (!dateString) return '';
  const date = new Date(dateString);
  const year = date.getFullYear();
  const month = date.getMonth() + 1;
  return `${year}-${month.toString().padStart(2, '0')}`;
};

const UnifiedRecordsFilter: React.FC<UnifiedRecordsFilterProps> = ({
  selectedEmployee,
  onEmployeeChange,
  selectedMonth,
  onMonthChange,
  dateRange,
  onDateRangeChange,
  onClearFilters,
  onExportExcel,
  showExportButton = true,
  exportDisabled = false,
  employees: externalEmployees,
}) => {
  const [employees, setEmployees] = useState<EmployeeOption[]>(externalEmployees || []);
  const [loadingEmployees, setLoadingEmployees] = useState(false);
  const [employeeInput, setEmployeeInput] = useState('');

  // Carregar funcionários se não foram fornecidos externamente
  useEffect(() => {
    if (externalEmployees) {
      // Ordenar alfabeticamente
      const sorted = [...externalEmployees].sort((a, b) =>
        (a.nome || '').localeCompare(b.nome || '')
      );
      setEmployees(sorted);
      return;
    }

    const loadEmployees = async () => {
      try {
        setLoadingEmployees(true);
        const response = await apiService.getEmployees();
        const employeesList = response.funcionarios || [];
        // Ordenar alfabeticamente
        const sortedEmployees = [...employeesList].sort((a: EmployeeOption, b: EmployeeOption) =>
          (a.nome || '').localeCompare(b.nome || '')
        );
        setEmployees(sortedEmployees);
      } catch (err) {
        console.error('Erro ao carregar funcionários:', err);
      } finally {
        setLoadingEmployees(false);
      }
    };

    loadEmployees();
  }, [externalEmployees]);

  // Atualizar input quando funcionário selecionado muda externamente
  useEffect(() => {
    if (selectedEmployee) {
      setEmployeeInput(selectedEmployee.nome || '');
    } else {
      setEmployeeInput('');
    }
  }, [selectedEmployee]);

  // Handler para mudança de mês
  const handleMonthChange = (month: string) => {
    onMonthChange(month);
    if (month) {
      // Quando um mês é selecionado, definir as datas automaticamente
      onDateRangeChange({
        start_date: getFirstDayOfMonth(month),
        end_date: getLastDayOfMonth(month)
      });
    }
  };

  // Handler para mudança de datas
  const handleDateRangeChange = (newRange: DateRange) => {
    const normalized = {
      start_date: newRange.start_date || '',
      end_date: newRange.end_date || ''
    };

    onDateRangeChange(normalized);

    // Atualizar mês selecionado se as datas estão no mesmo mês
    if (normalized.start_date && normalized.end_date) {
      const monthFromDate = getMonthFromDate(normalized.start_date);
      const monthToDate = getMonthFromDate(normalized.end_date);
      if (monthFromDate === monthToDate) {
        onMonthChange(monthFromDate);
      } else {
        onMonthChange('');
      }
    } else {
      onMonthChange('');
    }
  };

  return (
    <Box sx={{ p: 3 }}>
      {/* Título da seção */}
      <Box sx={{ display: 'flex', alignItems: 'center', gap: 1, mb: 3 }}>
        <Filter size={20} color="rgba(255, 255, 255, 0.9)" />
        <Typography variant="subtitle1" fontWeight={600} sx={{ color: 'rgba(255, 255, 255, 0.9)' }}>
          Filtros
        </Typography>
      </Box>

      {/* Primeira linha: Campo de busca por funcionário */}
      <Box sx={{ mb: 3 }}>
        <Autocomplete
          options={employees}
          getOptionLabel={(option) => option.nome || ''}
          value={selectedEmployee}
          isOptionEqualToValue={(option, value) => option.id === value?.id}
          onChange={(_, newValue) => {
            onEmployeeChange(newValue);
          }}
          inputValue={employeeInput}
          onInputChange={(_, newInputValue) => {
            setEmployeeInput(newInputValue);
          }}
          loading={loadingEmployees}
          renderInput={(params) => (
            <TextField
              {...(params as any)}
              variant="outlined"
              fullWidth
              label="Buscar por funcionário"
              placeholder="Digite o nome do funcionário"
              size="small"
              InputProps={{
                ...params.InputProps,
                startAdornment: (
                  <>
                    <InputAdornment position="start">
                      <SearchIcon sx={{ color: 'rgba(255, 255, 255, 0.7)' }} />
                    </InputAdornment>
                    {params.InputProps.startAdornment}
                  </>
                ),
              }}
              sx={{
                '& .MuiOutlinedInput-root': {
                  color: 'rgba(255, 255, 255, 0.9)',
                  '& fieldset': { borderColor: 'rgba(255, 255, 255, 0.2)' },
                  '&:hover fieldset': { borderColor: 'rgba(255, 255, 255, 0.3)' },
                  '&.Mui-focused fieldset': { borderColor: '#3b82f6' },
                },
                '& .MuiInputLabel-root': {
                  color: 'rgba(255, 255, 255, 0.7)',
                  '&.Mui-focused': { color: '#3b82f6' }
                },
              }}
            />
          )}
          renderOption={(props, option) => (
            <li {...props} key={option.id}>
              <Box sx={{ display: 'flex', flexDirection: 'column' }}>
                <Typography variant="body2" sx={{ color: 'white', fontWeight: 500 }}>
                  {option.nome}
                </Typography>
                {option.cargo && (
                  <Typography variant="caption" sx={{ color: 'rgba(255, 255, 255, 0.65)' }}>
                    {option.cargo}
                  </Typography>
                )}
              </Box>
            </li>
          )}
          ListboxProps={{
            sx: {
              background: 'rgba(15, 23, 42, 0.95)',
              color: 'white',
              '& .MuiAutocomplete-option': {
                '&.Mui-focused': {
                  backgroundColor: 'rgba(59, 130, 246, 0.35)'
                }
              }
            }
          }}
          noOptionsText={employeeInput ? 'Nenhum funcionário encontrado' : 'Digite o nome do funcionário'}
          sx={{
            '& .MuiAutocomplete-popupIndicator': {
              color: 'rgba(255, 255, 255, 0.7)'
            },
            '& .MuiAutocomplete-clearIndicator': {
              color: 'rgba(255, 255, 255, 0.7)'
            },
          }}
        />
      </Box>

      {/* Segunda linha: Mês e Período de Consulta */}
      <Box sx={{ display: 'grid', gridTemplateColumns: { xs: '1fr', md: '1fr 2fr' }, gap: 3, mb: 3 }}>
        {/* Mês */}
        <TextField
          label="Mês"
          type="month"
          value={selectedMonth || ''}
          onChange={(e) => handleMonthChange(e.target.value)}
          size="small"
          InputLabelProps={{ shrink: true }}
          InputProps={{
            startAdornment: (
              <InputAdornment position="start">
                <CalendarIcon sx={{ fontSize: 18, color: 'rgba(255, 255, 255, 0.7)' }} />
              </InputAdornment>
            ),
          }}
          sx={{
            '& .MuiOutlinedInput-root': {
              color: 'rgba(255, 255, 255, 0.9)',
              '& fieldset': { borderColor: 'rgba(255, 255, 255, 0.2)' },
              '&:hover fieldset': { borderColor: 'rgba(255, 255, 255, 0.3)' },
              '&.Mui-focused fieldset': { borderColor: '#3b82f6' },
            },
            '& .MuiInputLabel-root': {
              color: 'rgba(255, 255, 255, 0.7)',
              '&.Mui-focused': { color: '#3b82f6' }
            },
          }}
        />

        {/* Período de Consulta */}
        <Box>
          <Typography variant="body2" sx={{ color: 'rgba(255, 255, 255, 0.7)', mb: 1, fontSize: '0.75rem' }}>
            Período de Consulta
          </Typography>
          <DateRangePicker
            value={dateRange}
            onChange={handleDateRangeChange}
            placeholder="Selecionar período dos registros"
            className="w-full"
          />
        </Box>
      </Box>

      {/* Terceira linha: Botões */}
      <Box sx={{ display: 'flex', gap: 1.5, alignItems: 'center' }}>
        <Button
          variant="outlined"
          size="medium"
          onClick={onClearFilters}
          startIcon={<ClearIcon />}
          sx={{
            borderColor: 'rgba(255, 255, 255, 0.3)',
            color: 'rgba(255, 255, 255, 0.8)',
            '&:hover': {
              borderColor: 'rgba(255, 255, 255, 0.5)',
              backgroundColor: 'rgba(255, 255, 255, 0.05)',
            }
          }}
        >
          Limpar Filtros
        </Button>
        
        {showExportButton && onExportExcel && (
          <Button
            variant="outlined"
            size="medium"
            onClick={onExportExcel}
            startIcon={<FileDownloadIcon />}
            disabled={exportDisabled}
            sx={{
              ml: 'auto',
              borderColor: 'rgba(255, 255, 255, 0.3)',
              color: 'rgba(255, 255, 255, 0.8)',
              '&:hover': {
                borderColor: 'rgba(255, 255, 255, 0.5)',
                backgroundColor: 'rgba(255, 255, 255, 0.05)',
              },
              '&.Mui-disabled': {
                borderColor: 'rgba(255, 255, 255, 0.1)',
                color: 'rgba(255, 255, 255, 0.3)',
              }
            }}
          >
            Exportar Excel
          </Button>
        )}
      </Box>
    </Box>
  );
};

export default UnifiedRecordsFilter;

// Hook para gerenciar estado dos filtros
export const useRecordsFilter = () => {
  const currentDate = new Date();
  const currentMonthStart = new Date(currentDate.getFullYear(), currentDate.getMonth(), 1);
  const currentMonthEnd = new Date(currentDate.getFullYear(), currentDate.getMonth() + 1, 0);

  const [selectedEmployee, setSelectedEmployee] = useState<EmployeeOption | null>(null);
  const [selectedMonth, setSelectedMonth] = useState(getCurrentMonth());
  const [dateRange, setDateRange] = useState<DateRange>({
    start_date: currentMonthStart.toISOString().split('T')[0],
    end_date: currentMonthEnd.toISOString().split('T')[0]
  });

  const clearFilters = useCallback(() => {
    const now = new Date();
    const monthStart = new Date(now.getFullYear(), now.getMonth(), 1);
    const monthEnd = new Date(now.getFullYear(), now.getMonth() + 1, 0);
    
    setSelectedEmployee(null);
    setSelectedMonth(getCurrentMonth());
    setDateRange({
      start_date: monthStart.toISOString().split('T')[0],
      end_date: monthEnd.toISOString().split('T')[0]
    });
  }, []);

  return {
    selectedEmployee,
    setSelectedEmployee,
    selectedMonth,
    setSelectedMonth,
    dateRange,
    setDateRange,
    clearFilters,
  };
};
