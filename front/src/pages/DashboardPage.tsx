import React, { useState, useEffect, useCallback, useRef } from 'react';
import { apiService } from '../services/api';
import { 
  Users, 
  Clock, 
  TrendingUp, 
  TrendingDown, 
  AlertTriangle,
  Activity
} from 'lucide-react';
import { 
  Box, 
  Card, 
  CardContent, 
  Typography, 
  Alert,
  Table,
  TableBody,
  TableCell,
  TableContainer,
  TableHead,
  TableRow,
  Paper,
  Avatar,
  Chip,
  CircularProgress
} from '@mui/material';
import { motion } from 'framer-motion';

interface PresentEmployee {
  name: string;
  statusKey: string;
  statusLabel: string;
  photoUrl: string;
  entryTime: string;
  method: string;
}

interface RecentRecord {
  employeeName: string;
  recordType: string;
  time: string;
  statusKey: string;
  statusLabel: string;
  method: string;
  // Campos de status detalhado
  atraso_minutos?: number;
  horas_extras_minutos?: number;
  entrada_antecipada_minutos?: number;
  saida_antecipada_minutos?: number;
}

// Interface para os dados do dashboard
interface DashboardData {
  presentEmployees: number;
  totalEmployees: number;
  hoursMonth: number;
  balanceMonth: number;
  alerts: any[];
  recentRecords: RecentRecord[];
  employeesPresent: PresentEmployee[];
}

const normalizeStatusKey = (status: any): string => {
  if (!status && status !== 0) {
    return 'normal';
  }

  const value = String(status).trim().toLowerCase();
  if (!value) {
    return 'normal';
  }

  const ascii = value
    .normalize('NFD')
    .replace(/[^a-z0-9]/gi, '_')
    .replace(/_+/g, '_')
    .replace(/^_|_$/g, '');

  if (!ascii) {
    return 'normal';
  }

  if (['entrada_antecipada', 'entradaantecipada', 'entrada_adiantada', 'entradaadiantada', 'adiantado'].includes(ascii)) {
    return 'entrada_antecipada';
  }

  if (['saida_antecipada', 'saidaantecipada', 'saida_adiantada', 'saidaadiantada'].includes(ascii)) {
    return 'saida_antecipada';
  }

  return ascii;
};

const STATUS_LABEL_MAP: Record<string, string> = {
  entrada_antecipada: 'Entrada antecipada',
  normal: 'Pontual',
  saida_antecipada: 'Saída antecipada'
};

const getStatusLabelFromKey = (statusKey: string): string => {
  const key = statusKey || 'normal';
  return STATUS_LABEL_MAP[key] || key.replace(/_/g, ' ').replace(/\b\w/g, (letter) => letter.toUpperCase());
};

const getStatusChipStyles = (statusKey: string) => {
  switch (statusKey) {
    case 'entrada_antecipada':
      return {
        bgcolor: '#e3f2fd',
        color: '#1565c0',
        border: '1px solid #90caf9'
      };
    case 'saida_antecipada':
      return {
        bgcolor: '#fff3e0',
        color: '#ef6c00',
        border: '1px solid #ffe0b2'
      };
    case 'presente':
      return {
        bgcolor: '#e8f5e9',
        color: '#2e7d32',
        border: '1px solid #c8e6c9'
      };
    case 'saiu':
      return {
        bgcolor: '#fce4ec',
        color: '#c2185b',
        border: '1px solid #f8bbd9'
      };
    case 'entrada':
      return {
        bgcolor: '#e3f2fd',
        color: '#1976d2',
        border: '1px solid #90caf9'
      };
    default:
      return {
        bgcolor: '#e8f5e9',
        color: '#2e7d32',
        border: '1px solid #c8e6c9'
      };
  }
};

// Função para obter status detalhado igual ao RecordsPageDetails
const getDetailedStatus = (record: RecentRecord): Array<{ text: string; color: string }> => {
  const statuses: Array<{ text: string; color: string }> = [];

  // Entrada antecipada
  if (record.entrada_antecipada_minutos && record.entrada_antecipada_minutos > 0) {
    statuses.push({
      text: `Entrada ${record.entrada_antecipada_minutos} min antes`,
      color: '#93c5fd' // azul claro
    });
  }

  // Hora extra
  if (record.horas_extras_minutos && record.horas_extras_minutos > 0) {
    statuses.push({
      text: `+${record.horas_extras_minutos} min extra`,
      color: '#10b981' // verde
    });
  }

  // Saída antecipada
  if (record.saida_antecipada_minutos && record.saida_antecipada_minutos > 0) {
    statuses.push({
      text: `Saiu ${record.saida_antecipada_minutos} min antes`,
      color: '#f59e0b' // laranja
    });
  }

  // Se não tem nenhum status especial
  if (statuses.length === 0) {
    return [{
      text: 'Pontual',
      color: '#10b981' // verde
    }];
  }

  return statuses;
};

const formatRecordTime = (value: string): string => {
  if (!value) {
    return 'N/A';
  }

  const trimmed = value.trim();
  if (!trimmed) {
    return 'N/A';
  }

  if (trimmed.includes('T')) {
    const parsed = new Date(trimmed);
    if (!Number.isNaN(parsed.getTime())) {
      return parsed.toLocaleTimeString('pt-BR', {
        hour: '2-digit',
        minute: '2-digit',
        second: '2-digit'
      });
    }
  }

  return trimmed;
};

const DashboardPage = () => {
  // Estados
  const [data, setData] = useState<DashboardData | null>(null);
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState<string | null>(null);
  const isLoadingRef = useRef(false);
  
  // Refs para evitar dependências no useEffect
  const loadDataRef = useRef<(() => Promise<void>) | null>(null);

  // Função para fazer login automático se não estiver logado
  const ensureLoggedIn = useCallback(async () => {
    const token = localStorage.getItem('token');
    if (!token) {
      try {
        // Tentar diferentes credenciais de teste
        const credentialsToTry = [
          { usuario_id: 'admin', senha: 'admin123' },
          { usuario_id: 'teste', senha: 'teste123' },
          { usuario_id: 'aaa', senha: 'aaaaaa' },
          { usuario_id: 'user', senha: 'password' }
        ];

        for (const credentials of credentialsToTry) {
          try {
            const loginData = await apiService.login(credentials);
            return true;
          } catch (loginError) {
            // Login silencioso
          }
        }

        return false;
      } catch (error) {
        return false;
      }
    } else {
      return true;
    }
  }, []);

  // Função para carregar dados do dashboard
  const loadDashboardData = useCallback(async () => {
    // Evitar múltiplas chamadas simultâneas
    if (isLoadingRef.current) {
      return;
    }

    try {
    setLoading(true);
    isLoadingRef.current = true;
    setError(null);

      // Garantir que estamos logados
      const isLoggedIn = await ensureLoggedIn();
      if (!isLoggedIn) {
        throw new Error('Falha na autenticação. Não é possível acessar os dados sem login válido.');
      }

      // Lista das APIs essenciais que funcionam
      const apiCalls = [
        { name: 'all-employees', url: '/api/funcionarios' }, // Só usar funcionários para dados básicos
        { name: 'hours-month', url: '/api/dashboard/hours-month' },
        { name: 'balance-month', url: '/api/dashboard/balance-month' },
        { name: 'recent-records', url: '/api/records/last-five' },
        { name: 'present-employees', url: '/api/dashboard/present-employees' },
        { name: 'employees-present', url: '/api/employees/present' },
        { name: 'alerts-today', url: '/api/alerts/today' },
        // Grafico de horas da semana removido
      ];

      try {
        // Carregar dados essenciais sem timeout artificial para evitar vazios intermitentes
        const results = await Promise.allSettled(
          apiCalls.map((api) => apiService.get(api.url))
        );

      // Função auxiliar para extrair dados seguros - completamente silenciosa
      const getSafeData = (result: any, apiName: string) => {
        // Se a Promise foi resolvida
        if (result.status === 'fulfilled' && result.value) {
          // Verificar se é um erro simulado (nosso catch)
          if (result.value.status >= 400 || result.value.data === null) {
            return null;
          }
          
          // Caso 1: Resposta do axios com .data
          if (result.value.data !== undefined) {
            return result.value.data;
          }
          
          // Caso 2: Resposta direta
          return result.value;
        }
        
        // Qualquer outro caso - retornar null silenciosamente
        return null;
      };

      // Extrair dados essenciais
      const allEmployeesData = getSafeData(results[0], 'all-employees') || { funcionarios: [] };
      const hoursMonthData = getSafeData(results[1], 'hours-month') || { total_hours: 0 };
      const balanceMonthData = getSafeData(results[2], 'balance-month') || { balance: 0 };
      const recentRecordsData = getSafeData(results[3], 'recent-records') || { records: [] };
      const presentEmployeesData = getSafeData(results[4], 'present-employees') || {};
      const employeesPresentList = getSafeData(results[5], 'employees-present') || { employees: [] };
      const alertsData = getSafeData(results[6], 'alerts-today') || { alerts: [] };

      // Função auxiliar para extrair valores seguros
      const getSafeValue = (data: any, key: string, defaultValue: any = 0) => {
        if (data && typeof data === 'object') {
          return data[key] ?? defaultValue;
        }
        return defaultValue;
      };

      const getSafeArray = (data: any, defaultValue: any[] = []) => {
        if (Array.isArray(data)) return data;
        if (data && Array.isArray(data.items)) return data.items;
        if (data && Array.isArray(data.data)) return data.data;
        return defaultValue;
      };

      // Usar dados reais dos funcionários presentes e registros
      const funcionariosList = getSafeArray(allEmployeesData.funcionarios || allEmployeesData, []);
      const totalEmployees = getSafeValue(presentEmployeesData, 'totalEmployees', funcionariosList.length);
      const presentEmployees = getSafeValue(presentEmployeesData, 'presentEmployeesCount', 0);
      
      // Formatar registros recentes para o formato esperado
      const formattedRecentRecords: RecentRecord[] = getSafeArray(recentRecordsData.records, []).map((record: any) => {
        const statusKey = normalizeStatusKey(record.status_key ?? record.status);
        const timeValue = record.hora || record.timestamp || '';

        return {
          employeeName: record.nome || record.employee_name || 'N/A',
          recordType: record.type || record.tipo || 'entrada',  // Compatibilidade type/tipo
          time: typeof timeValue === 'string' ? timeValue : String(timeValue ?? ''),
          statusKey,
          statusLabel: record.status_label || getStatusLabelFromKey(statusKey),
          method: record.metodo || record.method || 'manual',
          // Campos de status detalhado
          atraso_minutos: record.atraso_minutos || 0,
          horas_extras_minutos: record.horas_extras_minutos || 0,
          entrada_antecipada_minutos: record.entrada_antecipada_minutos || 0,
          saida_antecipada_minutos: record.saida_antecipada_minutos || 0,
        };
      });
      
      // Formatar funcionários presentes
      const formattedEmployeesPresent: PresentEmployee[] = getSafeArray(employeesPresentList.employees, []).map((emp: any) => {
        const statusKey = normalizeStatusKey(emp.status_key ?? emp.entry_status ?? emp.status);
        return {
          name: emp.nome || 'N/A',
          statusKey,
          statusLabel: emp.status_label || emp.entry_status_label || getStatusLabelFromKey(statusKey),
          photoUrl: emp.foto || '',
          entryTime: emp.hora_entrada || emp.entry_time || 'N/A',
          method: emp.metodo || emp.method || 'manual'
        };
      });

      const dashboardData: DashboardData = {
        presentEmployees: presentEmployees,
        totalEmployees: totalEmployees,
        hoursMonth: getSafeValue(hoursMonthData, 'totalWorkedHoursMonth', 0),
        balanceMonth: getSafeValue(balanceMonthData, 'totalBalanceMonth', 0),
        alerts: getSafeArray(alertsData.alerts || alertsData, []),
        recentRecords: formattedRecentRecords,
        employeesPresent: formattedEmployeesPresent
      };
      
      // Debug: verificar se os dados estão chegando
      console.log('Dashboard Data:', {
        recentRecords: formattedRecentRecords.length,
        employeesPresent: formattedEmployeesPresent.length,
        alerts: getSafeArray(alertsData.alerts || alertsData, []).length
      });

        setData(dashboardData);

      } catch (innerError) {
        throw innerError;
      }

    } catch (error) {
      setError(`Erro ao carregar dados: ${error instanceof Error ? error.message : 'Erro desconhecido'}. Verifique a conexão com o banco de dados.`);
      setData(null);
    } finally {
      setLoading(false);
      isLoadingRef.current = false;
    }
  }, [ensureLoggedIn]);

  // Atualizar ref sempre que a função muda
  useEffect(() => {
    loadDataRef.current = loadDashboardData;
  }, [loadDashboardData]);

  // Efeito para carregar dados iniciais
  useEffect(() => {
    loadDashboardData();
  }, [loadDashboardData]);

  // Atualização automática no foco desabilitada temporariamente
  // para evitar múltiplas requisições que causam erro 500
  // useEffect(() => {
  //   let debounceTimer: number | null = null;
  //   let lastFocusTime = 0;
    
  //   const debouncedLoadData = () => {
  //     const now = Date.now();
  //     // Só executa se passou mais de 5 segundos desde a última execução
  //     if (now - lastFocusTime < 5000) {
  //       return;
  //     }
      
  //     if (debounceTimer) {
  //       clearTimeout(debounceTimer);
  //     }
  //     debounceTimer = setTimeout(() => {
  //       // Só carrega se não estiver já carregando e a função existe
  //       if (loadDataRef.current && !isLoadingRef.current) {
  //         lastFocusTime = Date.now();
  //         loadDataRef.current();
  //       }
  //     }, 2000); // Debounce de 2 segundos
  //   };

  //   const handleFocus = () => {
  //     debouncedLoadData();
  //   };

  //   const handleVisibilityChange = () => {
  //     if (!document.hidden) {
  //       debouncedLoadData();
  //     }
  //   };

  //   // Adicionar listeners para diferentes eventos de foco
  //   window.addEventListener('focus', handleFocus);
  //   window.addEventListener('visibilitychange', handleVisibilityChange);

  //   // Cleanup
  //   return () => {
  //     if (debounceTimer) {
  //       clearTimeout(debounceTimer);
  //     }
  //     window.removeEventListener('focus', handleFocus);
  //     window.removeEventListener('visibilitychange', handleVisibilityChange);
  //   };
  // }, []); // Remover dependências para evitar loop

  // Função para obter cor baseada no valor
  const getStatusColor = (value: number, isPositive: boolean = true) => {
    if (isPositive) {
      return value > 0 ? '#4caf50' : '#f44336';
    }
    return value < 0 ? '#f44336' : '#4caf50';
  };

  // Componente de card de métrica
  const MetricCard = ({ title, value, icon: Icon, color, subtitle, trend }: any) => (
    <motion.div
      initial={{ opacity: 0, y: 20 }}
      animate={{ opacity: 1, y: 0 }}
      transition={{ duration: 0.5 }}
    >
      <Card sx={{ 
        height: '100%', 
        bgcolor: 'rgba(255, 255, 255, 0.1)', 
        border: '1px solid rgba(255, 255, 255, 0.2)',
        borderRadius: '16px',
        boxShadow: '0 8px 32px rgba(0, 0, 0, 0.2)',
        backdropFilter: 'blur(20px)',
        transition: 'transform 0.2s, box-shadow 0.2s',
        '&:hover': {
          transform: 'translateY(-4px)',
          boxShadow: '0 12px 40px rgba(0, 0, 0, 0.3)',
          bgcolor: 'rgba(255, 255, 255, 0.15)'
        }
      }}>
        <CardContent sx={{ p: 3 }}>
          <Box display="flex" alignItems="center" justifyContent="space-between" mb={2}>
            <Box sx={{ 
              p: 1.5, 
              borderRadius: '12px', 
              bgcolor: color + '15',
              display: 'flex',
              alignItems: 'center',
              justifyContent: 'center'
            }}>
              <Icon size={28} color={color} />
            </Box>
            {trend && (
              <Chip 
                icon={trend > 0 ? <TrendingUp size={16} /> : <TrendingDown size={16} />}
                label={`${trend > 0 ? '+' : ''}${trend}%`}
                size="small"
                color={trend > 0 ? 'success' : 'error'}
              />
            )}
          </Box>
          <Typography variant="h3" component="h2" sx={{ color: 'white', fontWeight: 700, mb: 1, textShadow: '0 1px 2px rgba(0,0,0,0.3)' }}>
            {value}
          </Typography>
          <Typography variant="h6" sx={{ color: 'rgba(255,255,255,0.9)', fontWeight: 600, mb: 0.5 }}>
            {title}
          </Typography>
          {subtitle && (
            <Typography variant="body2" sx={{ color: 'rgba(255,255,255,0.7)' }}>
              {subtitle}
            </Typography>
          )}
        </CardContent>
      </Card>
    </motion.div>
  );

  if (loading) {
    return (
      <Box sx={{
        display: 'flex',
        justifyContent: 'center',
        alignItems: 'center',
        flexDirection: 'column',
        minHeight: 300,
      }}>
        <CircularProgress size={60} sx={{ color: 'white', mb: 2 }} />
        <Typography variant="h6" sx={{ color: 'white', textShadow: '0 2px 4px rgba(0,0,0,0.3)' }}>
          Carregando dashboard...
        </Typography>
      </Box>
    );
  }

  if (error) {
    return (
      <Box sx={{
        p: 3,
        display: 'flex',
        justifyContent: 'center',
        alignItems: 'center'
      }}>
        <Card sx={{
          maxWidth: 500,
          bgcolor: 'rgba(255, 255, 255, 0.1)',
          borderRadius: '16px',
          boxShadow: '0 8px 32px rgba(0, 0, 0, 0.2)',
          backdropFilter: 'blur(10px)',
          border: '1px solid rgba(255,255,255,0.15)'
        }}>
          <CardContent sx={{ p: 3 }}>
            <Alert 
              severity="error" 
              sx={{ 
                borderRadius: '12px',
                '& .MuiAlert-action': {
                  alignItems: 'center'
                }
              }}
              action={
                <button 
                  onClick={loadDashboardData}
                  style={{
                    background: '#1976d2',
                    color: 'white',
                    border: 'none',
                    padding: '8px 16px',
                    borderRadius: '8px',
                    cursor: 'pointer',
                    fontWeight: 500
                  }}
                >
                  Tentar novamente
                </button>
              }
            >
              {error}
            </Alert>
          </CardContent>
        </Card>
      </Box>
    );
  }

  if (!data) {
    return (
      <Box sx={{
        display: 'flex',
        justifyContent: 'center',
        alignItems: 'center',
        minHeight: 300,
      }}>
        <Typography variant="h6" sx={{ color: 'white', textShadow: '0 2px 4px rgba(0,0,0,0.3)' }}>
          Nenhum dado disponível
        </Typography>
      </Box>
    );
  }

  return (
    <Box sx={{ p: 3 }}>
      {/* Título */}
      <motion.div
        initial={{ opacity: 0, x: -20 }}
        animate={{ opacity: 1, x: 0 }}
        transition={{ duration: 0.5 }}
      >
        <Box sx={{ display: 'flex', justifyContent: 'space-between', alignItems: 'flex-start', mb: 3 }}>
          <Box>
            <Typography variant="h4" component="h1" gutterBottom fontWeight="bold" sx={{ color: 'white', textShadow: '0 2px 4px rgba(0,0,0,0.3)' }}>
              Dashboard
            </Typography>
            <Typography variant="subtitle1" sx={{ color: 'rgba(255,255,255,0.9)' }}>
              Visão geral em tempo real da empresa
            </Typography>
          </Box>
          <button
            onClick={loadDashboardData}
            disabled={loading}
            style={{
              background: loading ? 'rgba(255, 255, 255, 0.1)' : 'rgba(255, 255, 255, 0.2)',
              color: 'white',
              border: '1px solid rgba(255, 255, 255, 0.3)',
              padding: '8px 16px',
              borderRadius: '8px',
              cursor: loading ? 'not-allowed' : 'pointer',
              fontWeight: 500,
              display: 'flex',
              alignItems: 'center',
              gap: '8px',
              transition: 'all 0.2s',
              opacity: loading ? 0.7 : 1
            }}
          >
            {loading ? (
              <>
                <CircularProgress size={16} sx={{ color: 'white' }} />
                Atualizando...
              </>
            ) : (
              <>
                🔄 Atualizar
              </>
            )}
          </button>
        </Box>
      </motion.div>

      {/* Cards de Métricas Principais */}
      <Box 
        sx={{ 
          display: 'grid', 
          gridTemplateColumns: { xs: '1fr', sm: 'repeat(2, 1fr)' }, 
          gap: 3, 
          mb: 4 
        }}
      >
        <MetricCard
          title="Registros Hoje"
          value={`${data.presentEmployees}/${data.totalEmployees}`}
          icon={Users}
          color="#1976d2"
          subtitle="Funcionários com registro hoje"
        />
        <MetricCard
          title="Horas do Mês"
          value={`${data.hoursMonth}h`}
          icon={Clock}
          color="#2e7d32"
          subtitle="Total de horas trabalhadas"
        />
      </Box>

      {/* Alertas */}
      {data.alerts && data.alerts.filter(a => a.type !== 'atraso').length > 0 && (
        <motion.div
          initial={{ opacity: 0, y: 20 }}
          animate={{ opacity: 1, y: 0 }}
          transition={{ duration: 0.5, delay: 0.1 }}
        >
          <Card sx={{ 
            mb: 4, 
            bgcolor: 'rgba(255, 255, 255, 0.1)',
            border: '1px solid rgba(255, 255, 255, 0.2)',
            borderRadius: '16px',
            boxShadow: '0 8px 32px rgba(0, 0, 0, 0.2)',
            backdropFilter: 'blur(20px)'
          }}>
            <CardContent sx={{ p: 3 }}>
              <Box display="flex" alignItems="center" mb={3}>
                <Box sx={{ 
                  p: 1.5, 
                  borderRadius: '12px', 
                  bgcolor: '#ff9800', 
                  color: 'white',
                  display: 'flex',
                  alignItems: 'center',
                  justifyContent: 'center',
                  mr: 2
                }}>
                  <AlertTriangle size={24} />
                </Box>
                <Typography variant="h6" sx={{ color: 'white', fontWeight: 600, textShadow: '0 1px 2px rgba(0,0,0,0.3)' }}>
                  Alertas do Dia
                </Typography>
              </Box>
              {data.alerts.filter(a => a.type !== 'atraso').map((alert, index) => (
                <Alert key={index} severity={alert.severity || 'info'} sx={{ mb: 1, borderRadius: '8px' }}>
                  {alert.message}
                </Alert>
              ))}
            </CardContent>
          </Card>
        </motion.div>
      )}

      <Box sx={{ display: 'flex', flexDirection: 'column', gap: 3 }}>
        {/* Registros Recentes - Largura completa */}
        <motion.div
          initial={{ opacity: 0, y: 20 }}
          animate={{ opacity: 1, y: 0 }}
          transition={{ duration: 0.5, delay: 0.4 }}
        >
          <Card sx={{
            bgcolor: 'rgba(255, 255, 255, 0.1)',
            border: '1px solid rgba(255, 255, 255, 0.2)',
            borderRadius: '16px',
            boxShadow: '0 8px 32px rgba(0, 0, 0, 0.2)',
            backdropFilter: 'blur(20px)'
          }}>
            <CardContent sx={{ p: 3 }}>
              <Box display="flex" alignItems="center" mb={3}>
                <Box sx={{ 
                  p: 1.5, 
                  borderRadius: '12px', 
                  bgcolor: '#9c27b0', 
                  color: 'white',
                  display: 'flex',
                  alignItems: 'center',
                  justifyContent: 'center',
                  mr: 2
                }}>
                  <Activity size={24} />
                </Box>
                <Typography variant="h6" sx={{ color: 'white', fontWeight: 600, textShadow: '0 1px 2px rgba(0,0,0,0.3)' }}>
                  Registros Recentes
                </Typography>
              </Box>
              <TableContainer sx={{ bgcolor: 'transparent' }}>
                <Table>
                  <TableHead>
                    <TableRow>
                      <TableCell sx={{ color: 'rgba(255,255,255,0.8)', fontWeight: 600, border: 'none' }}>Funcionário</TableCell>
                      <TableCell sx={{ color: 'rgba(255,255,255,0.8)', fontWeight: 600, border: 'none' }}>Tipo</TableCell>
                      <TableCell sx={{ color: 'rgba(255,255,255,0.8)', fontWeight: 600, border: 'none' }}>Horário</TableCell>
                      {/* Status removido conforme solicitado */}
                    </TableRow>
                  </TableHead>
                  <TableBody>
                    {data.recentRecords && data.recentRecords.length > 0 ? (
                      data.recentRecords.slice(0, 5).map((record, index) => (
                        <TableRow key={index} sx={{ '&:hover': { bgcolor: 'rgba(25, 118, 210, 0.04)' } }}>
                          <TableCell sx={{ border: 'none', py: 2 }}>
                            <Box display="flex" alignItems="center">
                              <Avatar sx={{ 
                                width: 40, 
                                height: 40, 
                                mr: 2, 
                                bgcolor: '#1976d2',
                                fontSize: '16px'
                              }}>
                                {record.employeeName?.charAt(0) || 'F'}
                              </Avatar>
                              <Typography sx={{ color: 'white', fontWeight: 500 }}>
                                {record.employeeName || 'Funcionário'}
                              </Typography>
                            </Box>
                          </TableCell>
                          <TableCell sx={{ border: 'none', color: 'rgba(255,255,255,0.9)', fontWeight: 500 }}>
                            {record.recordType === 'entrada' ? 'Entrada' : 'Saída'}
                          </TableCell>
                          <TableCell sx={{ border: 'none', color: 'rgba(255,255,255,0.7)' }}>
                            {formatRecordTime(record.time)}
                          </TableCell>
                          {/* Status coluna removida */}
                        </TableRow>
                      ))
                    ) : (
                      <TableRow>
                        <TableCell colSpan={4} sx={{ border: 'none', py: 4, textAlign: 'center' }}>
                          <Typography sx={{ color: 'rgba(255,255,255,0.7)', fontStyle: 'italic' }}>
                            Nenhum registro encontrado hoje
                          </Typography>
                        </TableCell>
                      </TableRow>
                    )}
                  </TableBody>
                </Table>
              </TableContainer>
            </CardContent>
          </Card>
        </motion.div>
      </Box>
    </Box>
  );
};

export default DashboardPage;
