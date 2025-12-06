import React, { useState, useEffect } from 'react';
import PageLayout from '../sections/PageLayout';
import {
  Box,
  Card,
  CardContent,
  Typography,
  CircularProgress,
  Alert,
  Paper,
  Button,
  MenuItem,
  Select,
  FormControl,
  InputLabel,
} from '@mui/material';
import { DateRangePicker } from '../components/DateRangePicker';
import {
  CalendarMonth as CalendarIcon,
  TrendingUp as TrendingUpIcon,
  AccessTime as AccessTimeIcon,
  Cancel as CancelIcon,
  CheckCircle as CheckCircleIcon,
} from '@mui/icons-material';
import { motion } from 'framer-motion';
import { apiService } from '../services/api';

const MonthlyReportPage: React.FC = () => {
  const currentDate = new Date();
  const currentMonthStart = new Date(currentDate.getFullYear(), currentDate.getMonth(), 1);
  const currentMonthEnd = new Date(currentDate.getFullYear(), currentDate.getMonth() + 1, 0);

  const [employeeId, setEmployeeId] = useState('');
  const [dateRange, setDateRange] = useState({
    start_date: currentMonthStart.toISOString().split('T')[0],
    end_date: currentMonthEnd.toISOString().split('T')[0]
  });
  const [summary, setSummary] = useState<any>(null);
  const [employees, setEmployees] = useState<any[]>([]);
  const [loading, setLoading] = useState(false);
  const [error, setError] = useState<string | null>(null);

  useEffect(() => {
    loadEmployees();
  }, []);

  const loadEmployees = async () => {
    try {
      const response = await apiService.getEmployees();
      setEmployees(response.funcionarios || []);
    } catch (err) {
      console.error('Erro ao carregar funcionários:', err);
    }
  };

  const loadSummary = async () => {
    if (!employeeId) {
      setError('Selecione um funcionário');
      return;
    }

    try {
      setLoading(true);
      setError(null);

      console.log('📊 Carregando resumo por período:', { employeeId, dateRange });
      
      // Usar endpoint de registros com filtro por data
      const data = await apiService.getTimeRecords({
        funcionario_id: employeeId,
        inicio: dateRange.start_date,
        fim: dateRange.end_date
      });
      
      console.log('✅ Dados do período recebidos:', data);
      setSummary(data);

    } catch (err: any) {
      console.error('❌ Erro ao carregar resumo do período:', err);
      setError(err.response?.data?.error || 'Erro ao carregar resumo do período');
    } finally {
      setLoading(false);
    }
  };

  const formatBalance = (balance: number) => {
    const sign = balance >= 0 ? '+' : '';
    return `${sign}${balance.toFixed(2)}h`;
  };

  const StatCard = ({ title, value, subtitle, icon, color }: any) => (
    <motion.div
      initial={{ opacity: 0, y: 20 }}
      animate={{ opacity: 1, y: 0 }}
      transition={{ duration: 0.3 }}
    >
      <Card
        sx={{
          background: 'linear-gradient(135deg, rgba(255,255,255,0.1) 0%, rgba(255,255,255,0.05) 100%)',
          backdropFilter: 'blur(10px)',
          border: '1px solid rgba(255, 255, 255, 0.1)',
          borderRadius: 2,
          height: '100%',
        }}
      >
        <CardContent>
          <Box sx={{ display: 'flex', alignItems: 'center', mb: 2 }}>
            <Box
              sx={{
                p: 1,
                borderRadius: 2,
                background: `linear-gradient(135deg, ${color}40 0%, ${color}20 100%)`,
                mr: 2,
              }}
            >
              {icon}
            </Box>
            <Typography variant="h6" sx={{ color: 'rgba(255,255,255,0.7)' }}>
              {title}
            </Typography>
          </Box>
          <Typography variant="h3" sx={{ fontWeight: 'bold', color: '#fff', mb: 1 }}>
            {value}
          </Typography>
          {subtitle && (
            <Typography variant="body2" sx={{ color: 'rgba(255,255,255,0.5)' }}>
              {subtitle}
            </Typography>
          )}
        </CardContent>
      </Card>
    </motion.div>
  );

  return (
    <PageLayout>
      <div className="w-full max-w-7xl mx-auto p-4 space-y-6">
        <motion.div
          initial={{ opacity: 0, y: 20 }}
          animate={{ opacity: 1, y: 0 }}
          transition={{ duration: 0.5 }}
        >
          <h1 className="text-3xl font-bold text-white flex items-center gap-3 mb-2">
            <CalendarIcon />
            Relatório por Período
          </h1>
          <p className="text-white/70 mb-6">
            Visualize o resumo de horas trabalhadas em qualquer período
          </p>
        </motion.div>

        {/* Filtros */}
        <Paper
          sx={{
            background: 'linear-gradient(135deg, rgba(255,255,255,0.1) 0%, rgba(255,255,255,0.05) 100%)',
            backdropFilter: 'blur(10px)',
            border: '1px solid rgba(255, 255, 255, 0.1)',
            borderRadius: 2,
            p: 3,
            mb: 4,
          }}
        >
          <Box sx={{ display: 'flex', gap: 3, flexWrap: 'wrap', alignItems: 'flex-end' }}>
            <FormControl sx={{ flex: '1 1 300px', minWidth: '250px' }}>
              <InputLabel sx={{ color: 'rgba(255,255,255,0.7)' }}>Funcionário</InputLabel>
              <Select
                value={employeeId}
                onChange={(e) => setEmployeeId(e.target.value)}
                label="Funcionário"
                sx={{
                  color: '#fff',
                  '& .MuiOutlinedInput-notchedOutline': { borderColor: 'rgba(255,255,255,0.3)' },
                  '&:hover .MuiOutlinedInput-notchedOutline': { borderColor: 'rgba(255,255,255,0.5)' },
                  '& .MuiSvgIcon-root': { color: 'rgba(255,255,255,0.7)' },
                }}
              >
                <MenuItem value="">Selecione...</MenuItem>
                {employees.map((emp) => (
                  <MenuItem key={emp.id} value={emp.id}>
                    {emp.nome}
                  </MenuItem>
                ))}
              </Select>
            </FormControl>

            <Box sx={{ flex: '1 1 280px', minWidth: '280px' }}>
              <DateRangePicker
                value={dateRange}
                onChange={setDateRange}
                placeholder="Selecionar período do relatório"
                className="w-full"
              />
            </Box>

            <Button
              variant="contained"
              onClick={loadSummary}
              disabled={loading || !employeeId}
              sx={{
                flex: '0 1 auto',
                background: 'linear-gradient(135deg, #667eea 0%, #764ba2 100%)',
                '&:hover': {
                  background: 'linear-gradient(135deg, #764ba2 0%, #667eea 100%)',
                },
                minHeight: '56px',
                px: 3,
              }}
            >
              {loading ? <CircularProgress size={24} /> : 'Buscar Relatório'}
            </Button>
          </Box>
        </Paper>

        {error && (
          <Alert severity="error" sx={{ mb: 4 }}>
            {error}
          </Alert>
        )}

        {/* Resumo */}
        {summary && (
          <>
            <Box sx={{ display: 'flex', gap: 3, mb: 4, flexWrap: 'wrap' }}>
              <Box sx={{ flex: '1 1 250px', minWidth: '250px' }}>
                <StatCard
                  title="Dias Trabalhados"
                  value={`${summary.days_worked}/${summary.total_days}`}
                  subtitle="dias no mês"
                  icon={<CalendarIcon sx={{ color: '#667eea' }} />}
                  color="#667eea"
                />
              </Box>
              <Box sx={{ flex: '1 1 250px', minWidth: '250px' }}>
                <StatCard
                  title="Horas Totais"
                  value={`${(summary.total_worked_hours || 0).toFixed(1)}h`}
                  subtitle={`de ${(summary.total_expected_hours || 0).toFixed(1)}h esperadas`}
                  icon={<AccessTimeIcon sx={{ color: '#10b981' }} />}
                  color="#10b981"
                />
              </Box>
              <Box sx={{ flex: '1 1 250px', minWidth: '250px' }}>
                <StatCard
                  title="Horas Extras"
                  value={`${(summary.total_extra_hours || 0).toFixed(1)}h`}
                  subtitle="acima do esperado"
                  icon={<TrendingUpIcon sx={{ color: '#f59e0b' }} />}
                  color="#f59e0b"
                />
              </Box>
              <Box sx={{ flex: '1 1 250px', minWidth: '250px' }}>
                <StatCard
                  title="Faltas"
                  value={summary.absences || 0}
                  subtitle="dias ausentes"
                  icon={<CancelIcon sx={{ color: '#ef4444' }} />}
                  color="#ef4444"
                />
              </Box>
            </Box>

            {/* Detalhes adicionais */}
            <Paper
              sx={{
                background: 'linear-gradient(135deg, rgba(255,255,255,0.1) 0%, rgba(255,255,255,0.05) 100%)',
                backdropFilter: 'blur(10px)',
                border: '1px solid rgba(255, 255, 255, 0.1)',
                borderRadius: 2,
                p: 3,
              }}
            >
              <Typography variant="h6" sx={{ color: '#fff', mb: 3 }}>
                Detalhes do Mês
              </Typography>

              <Box sx={{ display: 'flex', flexDirection: 'column', gap: 2 }}>
                <Box sx={{ display: 'flex', justifyContent: 'space-between' }}>
                  <Typography sx={{ color: 'rgba(255,255,255,0.7)' }}>
                    Total de Atrasos:
                  </Typography>
                  <Typography sx={{ color: '#ef4444', fontWeight: 'bold' }}>
                    {summary.total_delay_minutes || 0} minutos
                  </Typography>
                </Box>

                <Box sx={{ display: 'flex', justifyContent: 'space-between' }}>
                  <Typography sx={{ color: 'rgba(255,255,255,0.7)' }}>
                    Feriados Trabalhados:
                  </Typography>
                  <Typography sx={{ color: '#10b981', fontWeight: 'bold' }}>
                    {summary.worked_holidays || 0} dias
                  </Typography>
                </Box>

                <Box
                  sx={{
                    display: 'flex',
                    justifyContent: 'space-between',
                    pt: 2,
                    mt: 2,
                    borderTop: '1px solid rgba(255,255,255,0.1)',
                  }}
                >
                  <Typography sx={{ color: '#fff', fontSize: '1.2rem', fontWeight: 'bold' }}>
                    Saldo Final do Mês:
                  </Typography>
                  <Typography
                    sx={{
                      color: summary.final_balance >= 0 ? '#10b981' : '#ef4444',
                      fontSize: '1.5rem',
                      fontWeight: 'bold',
                    }}
                  >
                    {formatBalance(summary.final_balance || 0)}
                  </Typography>
                </Box>
              </Box>
            </Paper>
          </>
        )}

        {!summary && !loading && !error && (
          <Paper
            sx={{
              background: 'linear-gradient(135deg, rgba(255,255,255,0.1) 0%, rgba(255,255,255,0.05) 100%)',
              backdropFilter: 'blur(10px)',
              border: '1px solid rgba(255, 255, 255, 0.1)',
              borderRadius: 2,
              p: 6,
              textAlign: 'center',
            }}
          >
            <CalendarIcon sx={{ fontSize: 64, color: 'rgba(255,255,255,0.3)', mb: 2 }} />
            <Typography sx={{ color: 'rgba(255,255,255,0.7)' }}>
              Selecione um funcionário e período para visualizar o relatório
            </Typography>
          </Paper>
        )}
      </div>
    </PageLayout>
  );
};

export default MonthlyReportPage;
