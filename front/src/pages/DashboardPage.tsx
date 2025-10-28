import React, { useState, useEffect } from 'react';
import PageLayout from '../sections/PageLayout';
import {
  Box,
  Grid,
  Card,
  CardContent,
  Typography,
  CircularProgress,
  Alert,
  Paper,
} from '@mui/material';
import {
  People as PeopleIcon,
  AccessTime as AccessTimeIcon,
  TrendingUp as TrendingUpIcon,
  Business as BusinessIcon,
  Schedule as ScheduleIcon,
} from '@mui/icons-material';
import { motion } from 'framer-motion';
import { useAuth } from '../contexts/AuthContext';
import { apiService } from '../services/api';
import { useNavigate } from 'react-router-dom';

const DashboardPage: React.FC = () => {
  const { user } = useAuth();
  const navigate = useNavigate();
  const [stats, setStats] = useState({
    total_funcionarios: 0,
    total_registros_mes: 0,
    funcionarios_registrados_hoje: 0,
  });
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState<string | null>(null);
  
  // Estados para data e hora atual
  const [currentDateTime, setCurrentDateTime] = useState({
    date: '',
    time: '',
    weekday: ''
  });

  useEffect(() => {
    loadDashboardData();
  }, []);

  // Atualizar data e hora a cada segundo
  useEffect(() => {
    const updateDateTime = () => {
      const now = new Date();
      const brasilTime = new Date(now.toLocaleString("en-US", {timeZone: "America/Sao_Paulo"}));
      
      const date = brasilTime.toLocaleDateString('pt-BR', {
        day: '2-digit',
        month: '2-digit',
        year: 'numeric',
        timeZone: "America/Sao_Paulo"
      });
      
      const time = brasilTime.toLocaleTimeString('pt-BR', {
        hour: '2-digit',
        minute: '2-digit',
        second: '2-digit',
        timeZone: "America/Sao_Paulo"
      });
      
      const weekday = brasilTime.toLocaleDateString('pt-BR', {
        weekday: 'long',
        timeZone: "America/Sao_Paulo"
      });

      setCurrentDateTime({
        date,
        time,
        weekday: weekday.charAt(0).toUpperCase() + weekday.slice(1)
      });
    };

    // Atualizar imediatamente
    updateDateTime();
    
    // Atualizar a cada segundo
    const interval = setInterval(updateDateTime, 1000);
    
    return () => clearInterval(interval);
  }, []);

  const loadDashboardData = async () => {
    try {
      setLoading(true);
      setError(null);

      // Load employees count
      const employeesResponse = await apiService.getEmployees();
      const totalEmployees = employeesResponse.funcionarios?.length || 0;

      // Load ALL records using the same strategy as RecordsPageDetails
      console.log('🏠 Dashboard: Buscando TODOS os registros...');
      let allRecords: any[] = [];
      
      try {
        // Estratégia: Buscar todos os funcionários e depois seus registros individuais
        const employeesList = employeesResponse.funcionarios || [];
        console.log('👥 Dashboard: Funcionários encontrados:', employeesList.length);
        
        // Para cada funcionário, buscar TODOS os seus registros individuais
        for (const employee of employeesList) {
          try {
            console.log(`📊 Dashboard: Buscando registros de: ${employee.nome}`);
            
            // Tentar diferentes parâmetros para buscar registros individuais
            const strategies = [
              { funcionario_id: employee.id, individual: true },
              { funcionario_id: employee.id, detailed: true },
              { funcionario_id: employee.id, type: 'individual' },
              { funcionario_id: employee.id }
            ];
            
            let employeeRecords = [];
            
            for (const params of strategies) {
              try {
                const response = await apiService.getTimeRecords(params);
                
                if (Array.isArray(response) && response.length > 0) {
                  // Verificar se são registros individuais (têm data_hora, tipo, etc.)
                  const hasIndividualData = response.some(record => 
                    record.data_hora && record.tipo && (record.tipo === 'entrada' || record.tipo === 'saída')
                  );
                  
                  if (hasIndividualData) {
                    employeeRecords = response;
                    console.log(`  ✅ Dashboard: Encontrados ${employeeRecords.length} registros individuais`);
                    break;
                  }
                } else if (response && typeof response === 'object') {
                  // Verificar propriedades do objeto que podem conter registros
                  const possibleProps = ['registros', 'records', 'data', 'items', 'timeRecords', 'detalhes'];
                  for (const prop of possibleProps) {
                    if (Array.isArray(response[prop])) {
                      const hasIndividualData = response[prop].some(record => 
                        record.data_hora && record.tipo
                      );
                      if (hasIndividualData) {
                        employeeRecords = response[prop];
                        console.log(`  ✅ Dashboard: Encontrados registros em ${prop}:`, employeeRecords.length);
                        break;
                      }
                    }
                  }
                  if (employeeRecords.length > 0) break;
                }
              } catch (strategyError) {
                console.log(`  ❌ Dashboard: Erro com parâmetros ${JSON.stringify(params)}:`, strategyError);
              }
            }
            
            // Se encontrou registros, adicionar informações do funcionário e incluir na lista
            if (employeeRecords.length > 0) {
              const recordsWithEmployeeInfo = employeeRecords.map(record => ({
                ...record,
                funcionario_nome: record.funcionario_nome || employee.nome,
                funcionario_id: record.funcionario_id || employee.id,
                // Garantir que temos os campos necessários
                registro_id: record.registro_id || record.id || `${employee.id}_${record.data_hora || new Date().getTime()}`,
                tipo: record.tipo || 'entrada',
                data_hora: record.data_hora || record.timestamp || record.datetime,
                empresa_nome: record.empresa_nome || record.company || 'N/A'
              }));
              
              allRecords = [...allRecords, ...recordsWithEmployeeInfo];
              console.log(`✅ Dashboard: Adicionados ${recordsWithEmployeeInfo.length} registros de ${employee.nome}`);
            }
            
          } catch (empErr) {
            console.log(`❌ Dashboard: Erro geral ao buscar registros de ${employee.nome}:`, empErr);
          }
        }
        
        console.log('📊 Dashboard: Total de registros coletados:', allRecords.length);
        
        // Se não conseguimos encontrar registros individuais, tentar fallback
        if (allRecords.length === 0) {
          console.log('🔄 Dashboard: Fallback - buscando do endpoint padrão...');
          const fallbackResponse = await apiService.getTimeRecords();
          console.log('📊 Dashboard: Resposta fallback:', fallbackResponse);
          
          if (Array.isArray(fallbackResponse)) {
            allRecords = fallbackResponse;
          } else if (fallbackResponse && typeof fallbackResponse === 'object') {
            Object.keys(fallbackResponse).forEach(key => {
              if (Array.isArray(fallbackResponse[key])) {
                console.log(`📊 Dashboard: Encontrado array em ${key}:`, fallbackResponse[key].length);
                allRecords = [...allRecords, ...fallbackResponse[key]];
              }
            });
          }
        }
        
      } catch (fetchError) {
        console.error('❌ Dashboard: Erro ao buscar registros individuais:', fetchError);
      }
      
      // Get current date in Brazil timezone
      const now = new Date();
      const brasiliaTime = new Date(now.toLocaleString("en-US", {timeZone: "America/Sao_Paulo"}));
      
      const currentYear = brasiliaTime.getFullYear();
      const currentMonth = brasiliaTime.getMonth() + 1; // getMonth() returns 0-11
      const currentDay = brasiliaTime.getDate();
      
      const currentMonthStr = `${currentYear}-${String(currentMonth).padStart(2, '0')}`;
      const currentDateStr = `${currentYear}-${String(currentMonth).padStart(2, '0')}-${String(currentDay).padStart(2, '0')}`;
      
      console.log('📅 Dashboard: Data atual para filtros:', { currentDateStr, currentMonthStr });
      console.log('📋 Dashboard: Exemplos de registros para análise:', allRecords.slice(0, 3));

      // Filtrar registros do mês atual - com conversão de formato
      const monthlyRecords = allRecords.filter(record => {
        if (!record.data_hora) return false;
        
        let recordDate = '';
        
        // Handle different date formats
        if (record.data_hora.includes(' ')) {
          recordDate = record.data_hora.split(' ')[0];
        } else if (record.data_hora.includes('T')) {
          recordDate = record.data_hora.split('T')[0];
        } else {
          recordDate = record.data_hora;
        }
        
        // Converter diferentes formatos para YYYY-MM-DD
        let normalizedDate = '';
        if (recordDate.includes('/')) {
          // Formato DD/MM/YYYY
          const [day, month, year] = recordDate.split('/');
          normalizedDate = `${year}-${month.padStart(2, '0')}-${day.padStart(2, '0')}`;
        } else if (recordDate.includes('-')) {
          const dateParts = recordDate.split('-');
          if (dateParts[0].length === 2) {
            // Formato DD-MM-YYYY
            const [day, month, year] = dateParts;
            normalizedDate = `${year}-${month.padStart(2, '0')}-${day.padStart(2, '0')}`;
          } else {
            // Já está em formato YYYY-MM-DD
            normalizedDate = recordDate;
          }
        } else {
          normalizedDate = recordDate;
        }
        
        const isFromCurrentMonth = normalizedDate && normalizedDate.startsWith(currentMonthStr);
        if (isFromCurrentMonth) {
          console.log(`✅ Dashboard: Registro do mês: ${record.data_hora} -> ${normalizedDate}`);
        }
        
        return isFromCurrentMonth;
      });

      // Filtrar registros de hoje - com conversão de formato
      const todayRecords = allRecords.filter(record => {
        if (!record.data_hora) return false;
        
        let recordDate = '';
        
        if (record.data_hora.includes(' ')) {
          recordDate = record.data_hora.split(' ')[0];
        } else if (record.data_hora.includes('T')) {
          recordDate = record.data_hora.split('T')[0];
        } else {
          recordDate = record.data_hora;
        }
        
        // Converter diferentes formatos para YYYY-MM-DD
        let normalizedDate = '';
        if (recordDate.includes('/')) {
          // Formato DD/MM/YYYY
          const [day, month, year] = recordDate.split('/');
          normalizedDate = `${year}-${month.padStart(2, '0')}-${day.padStart(2, '0')}`;
        } else if (recordDate.includes('-')) {
          const dateParts = recordDate.split('-');
          if (dateParts[0].length === 2) {
            // Formato DD-MM-YYYY
            const [day, month, year] = dateParts;
            normalizedDate = `${year}-${month.padStart(2, '0')}-${day.padStart(2, '0')}`;
          } else {
            // Já está em formato YYYY-MM-DD
            normalizedDate = recordDate;
          }
        } else {
          normalizedDate = recordDate;
        }
        
        const isFromToday = normalizedDate === currentDateStr;
        if (isFromToday) {
          console.log(`✅ Dashboard: Registro de hoje: ${record.data_hora} -> ${normalizedDate}`);
        }
        
        return isFromToday;
      });
      
      console.log('📊 Dashboard: Registros do mês:', monthlyRecords.length);
      console.log('📊 Dashboard: Registros de hoje:', todayRecords.length);
      
      // Get unique employees who registered today
      const uniqueEmployeeIds = [...new Set(todayRecords.map(record => record.funcionario_id))].filter(id => id);
      const uniqueEmployeesToday = uniqueEmployeeIds.length;
      
      console.log('👤 Dashboard: Funcionários únicos que registraram hoje:', uniqueEmployeesToday);

      setStats({
        total_funcionarios: totalEmployees,
        total_registros_mes: monthlyRecords.length,
        funcionarios_registrados_hoje: uniqueEmployeesToday,
      });

    } catch (err: any) {
      console.error('Error loading dashboard data:', err);
      setError('Erro ao carregar dados do dashboard');
    } finally {
      setLoading(false);
    }
  };

  const handleNavigateToTodayRecords = () => {
    // Obter data atual no formato YYYY-MM-DD
    const now = new Date();
    const brasiliaTime = new Date(now.toLocaleString("en-US", {timeZone: "America/Sao_Paulo"}));
    const currentYear = brasiliaTime.getFullYear();
    const currentMonth = brasiliaTime.getMonth() + 1;
    const currentDay = brasiliaTime.getDate();
    const todayStr = `${currentYear}-${String(currentMonth).padStart(2, '0')}-${String(currentDay).padStart(2, '0')}`;
    
    // Navegar para registros detalhados com filtro de data para hoje
    navigate(`/records/detailed?dateFrom=${todayStr}&dateTo=${todayStr}`);
  };

  const handleNavigateToEmployees = () => {
    navigate('/employees');
  };

  if (loading) {
    return (
      <PageLayout>
        <Box display="flex" justifyContent="center" alignItems="center" minHeight="400px">
          <CircularProgress sx={{ color: 'white' }} />
        </Box>
      </PageLayout>
    );
  }

  if (error) {
    return (
      <PageLayout>
        <Alert 
          severity="error" 
          sx={{ 
            mb: 4,
            background: 'rgba(255, 255, 255, 0.95)',
            backdropFilter: 'blur(20px)',
            borderRadius: '12px',
            border: '1px solid rgba(255, 255, 255, 0.1)',
          }}
        >
          {error}
        </Alert>
      </PageLayout>
    );
  }

  return (
    <PageLayout>
      {/* Box com Data e Hora Atual - Canto Superior Direito */}
      <Box 
        sx={{ 
          position: 'fixed',
          top: 70,        // ← AQUI você controla a distância do topo
          right: 16,      // ← AQUI você controla a distância da direita
          zIndex: 1000
        }}
      >
        <motion.div
          initial={{ opacity: 0, x: 20 }}
          animate={{ opacity: 1, x: 0 }}
          transition={{ duration: 0.5 }}
        >
          <Paper
            elevation={8}
            sx={{
              background: 'linear-gradient(135deg, rgba(59, 130, 246, 0.9) 0%, rgba(37, 99, 235, 0.9) 100%)',
              backdropFilter: 'blur(20px)',
              borderRadius: '12px',
              border: '1px solid rgba(255, 255, 255, 0.2)',
              p: 2,
              minWidth: '280px',
              maxWidth: '320px',
              boxShadow: '0 8px 32px rgba(59, 130, 246, 0.3)',
            }}
          >
            <Box sx={{ display: 'flex', alignItems: 'center', justifyContent: 'space-between' }}>
              {/* Lado esquerdo - Ícone e Label */}
              <Box sx={{ display: 'flex', alignItems: 'center' }}>
                <ScheduleIcon sx={{ color: 'white', mr: 1, fontSize: '18px' }} />
                <Typography 
                  sx={{ 
                    color: 'white', 
                    fontSize: '12px',
                    fontWeight: 600,
                    textTransform: 'uppercase',
                    letterSpacing: '0.5px'
                  }}
                >
                  Agora
                </Typography>
              </Box>
              
              {/* Lado direito - Horário */}
              <Typography 
                sx={{ 
                  color: 'white', 
                  fontSize: '20px',
                  fontWeight: 700,
                  fontFamily: 'monospace',
                  textShadow: '0 2px 4px rgba(0,0,0,0.3)'
                }}
              >
                {currentDateTime.time}
              </Typography>
            </Box>
            
            {/* Linha inferior - Data e dia da semana */}
            <Box sx={{ 
              display: 'flex', 
              alignItems: 'center', 
              justifyContent: 'space-between', 
              mt: 1,
              pt: 1,
              borderTop: '1px solid rgba(255, 255, 255, 0.2)'
            }}>
              <Typography 
                sx={{ 
                  color: 'rgba(255, 255, 255, 0.9)', 
                  fontSize: '11px',
                  fontWeight: 500
                }}
              >
                {currentDateTime.weekday}
              </Typography>
              
              <Typography 
                sx={{ 
                  color: 'rgba(255, 255, 255, 0.8)', 
                  fontSize: '11px',
                  fontWeight: 400
                }}
              >
                {currentDateTime.date}
              </Typography>
            </Box>
          </Paper>
        </motion.div>
      </Box>

      {/* Welcome Section */}
      <motion.div
        initial={{ opacity: 0, y: 20 }}
        animate={{ opacity: 1, y: 0 }}
        transition={{ duration: 0.5 }}
      >
        <Box sx={{ mb: 4 }}>
          <Typography 
            variant="h4" 
            sx={{ 
              fontWeight: 600, 
              color: 'white', 
              mb: 1,
              fontSize: '28px'
            }}
          >
            Bem-vindo, {user?.empresa_nome}!
          </Typography>
          <Typography 
            variant="body1" 
            sx={{ 
              color: 'rgba(255, 255, 255, 0.8)',
              fontSize: '16px'
            }}
          >
            Aqui está um resumo das atividades da sua empresa
          </Typography>
        </Box>
      </motion.div>

      {/* Stats Cards - Melhor distribuição */}
      <Grid container spacing={3} sx={{ mb: 4 }}>
        {/* Primeira linha - Cards principais */}
        <Grid size={{ xs: 12, sm: 6, lg: 6 }}>
          <motion.div
            initial={{ opacity: 0, y: 20 }}
            animate={{ opacity: 1, y: 0 }}
            transition={{ duration: 0.5, delay: 0.1 }}
          >
            <Card 
              sx={{
                height: '140px',
                background: 'rgba(255, 255, 255, 0.08)',
                backdropFilter: 'blur(20px)',
                borderRadius: '16px',
                boxShadow: '0 8px 32px rgba(0, 0, 0, 0.2)',
                border: '1px solid rgba(255, 255, 255, 0.1)',
                cursor: 'pointer',
                transition: 'all 0.3s ease',
                '&:hover': {
                  transform: 'translateY(-4px)',
                  boxShadow: '0 16px 48px rgba(59, 130, 246, 0.3)',
                  background: 'linear-gradient(135deg, rgba(59, 130, 246, 0.15) 0%, rgba(59, 130, 246, 0.05) 100%)',
                },
              }}
              onClick={handleNavigateToEmployees}
            >
              <CardContent sx={{ height: '100%', display: 'flex', alignItems: 'center' }}>
                <Box sx={{ display: 'flex', alignItems: 'center', justifyContent: 'space-between', width: '100%' }}>
                  <Box>
                    <Typography 
                      sx={{ 
                        color: 'rgba(255, 255, 255, 0.8)', 
                        fontSize: '16px',
                        mb: 1,
                        fontWeight: 500
                      }}
                    >
                      Total de Funcionários
                    </Typography>
                    <Typography 
                      variant="h3" 
                      sx={{ 
                        fontWeight: 700, 
                        color: '#3b82f6',
                        fontSize: '42px'
                      }}
                    >
                      {stats.total_funcionarios}
                    </Typography>
                  </Box>
                  <PeopleIcon sx={{ color: '#3b82f6', fontSize: '48px' }} />
                </Box>
              </CardContent>
            </Card>
          </motion.div>
        </Grid>

        <Grid size={{ xs: 12, sm: 6, lg: 6 }}>
          <motion.div
            initial={{ opacity: 0, y: 20 }}
            animate={{ opacity: 1, y: 0 }}
            transition={{ duration: 0.5, delay: 0.2 }}
          >
            <Card 
              sx={{
                height: '140px',
                background: 'rgba(255, 255, 255, 0.08)',
                backdropFilter: 'blur(20px)',
                borderRadius: '16px',
                boxShadow: '0 8px 32px rgba(0, 0, 0, 0.2)',
                border: '1px solid rgba(255, 255, 255, 0.1)',
              }}
            >
              <CardContent sx={{ height: '100%', display: 'flex', alignItems: 'center' }}>
                <Box sx={{ display: 'flex', alignItems: 'center', justifyContent: 'space-between', width: '100%' }}>
                  <Box>
                    <Typography 
                      sx={{ 
                        color: 'rgba(255, 255, 255, 0.8)', 
                        fontSize: '16px',
                        mb: 1,
                        fontWeight: 500
                      }}
                    >
                      Registros do Mês
                    </Typography>
                    <Typography 
                      variant="h3" 
                      sx={{ 
                        fontWeight: 700, 
                        color: '#10b981',
                        fontSize: '42px'
                      }}
                    >
                      {stats.total_registros_mes}
                    </Typography>
                  </Box>
                  <AccessTimeIcon sx={{ color: '#10b981', fontSize: '48px' }} />
                </Box>
              </CardContent>
            </Card>
          </motion.div>
        </Grid>

        {/* Segunda linha - Cards de destaque */}
        <Grid size={{ xs: 12, sm: 8, lg: 8 }}>
          <motion.div
            initial={{ opacity: 0, y: 20 }}
            animate={{ opacity: 1, y: 0 }}
            transition={{ duration: 0.5, delay: 0.3 }}
          >
            <Card 
              sx={{
                height: '140px',
                background: 'linear-gradient(135deg, rgba(139, 92, 246, 0.15) 0%, rgba(139, 92, 246, 0.05) 100%)',
                backdropFilter: 'blur(20px)',
                borderRadius: '16px',
                boxShadow: '0 8px 32px rgba(139, 92, 246, 0.2)',
                border: '1px solid rgba(139, 92, 246, 0.3)',
                cursor: 'pointer',
                transition: 'all 0.3s ease',
                '&:hover': {
                  transform: 'translateY(-4px)',
                  boxShadow: '0 16px 48px rgba(139, 92, 246, 0.3)',
                  background: 'linear-gradient(135deg, rgba(139, 92, 246, 0.2) 0%, rgba(139, 92, 246, 0.1) 100%)',
                },
              }}
              onClick={handleNavigateToTodayRecords}
            >
              <CardContent sx={{ height: '100%', display: 'flex', alignItems: 'center' }}>
                <Box sx={{ display: 'flex', alignItems: 'center', justifyContent: 'space-between', width: '100%' }}>
                  <Box>
                    <Typography 
                      sx={{ 
                        color: 'rgba(255, 255, 255, 0.9)', 
                        fontSize: '18px',
                        mb: 1,
                        fontWeight: 600
                      }}
                    >
                      Funcionários que Registraram Hoje
                    </Typography>
                    <Box sx={{ display: 'flex', alignItems: 'center', gap: 2 }}>
                      <Typography 
                        variant="h2" 
                        sx={{ 
                          fontWeight: 800, 
                          color: '#8b5cf6',
                          fontSize: '48px'
                        }}
                      >
                        {stats.funcionarios_registrados_hoje}
                      </Typography>
                      <Typography 
                        sx={{ 
                          color: 'rgba(255, 255, 255, 0.7)',
                          fontSize: '24px',
                          fontWeight: 500
                        }}
                      >
                        / {stats.total_funcionarios}
                      </Typography>
                    </Box>
                  </Box>
                  <TrendingUpIcon sx={{ color: '#8b5cf6', fontSize: '56px' }} />
                </Box>
              </CardContent>
            </Card>
          </motion.div>
        </Grid>

        <Grid size={{ xs: 12, sm: 4, lg: 4 }}>
          <motion.div
            initial={{ opacity: 0, y: 20 }}
            animate={{ opacity: 1, y: 0 }}
            transition={{ duration: 0.5, delay: 0.4 }}
          >
            <Card 
              sx={{
                height: '140px',
                background: 'linear-gradient(135deg, rgba(245, 158, 11, 0.15) 0%, rgba(245, 158, 11, 0.05) 100%)',
                backdropFilter: 'blur(20px)',
                borderRadius: '16px',
                boxShadow: '0 8px 32px rgba(245, 158, 11, 0.2)',
                border: '1px solid rgba(245, 158, 11, 0.3)',
              }}
            >
              <CardContent sx={{ height: '100%', display: 'flex', flexDirection: 'column', justifyContent: 'center', alignItems: 'center' }}>
                <BusinessIcon sx={{ color: '#f59e0b', fontSize: '48px', mb: 1 }} />
                <Typography 
                  sx={{ 
                    color: 'rgba(255, 255, 255, 0.8)', 
                    fontSize: '14px',
                    mb: 1,
                    textAlign: 'center'
                  }}
                >
                  Empresa
                </Typography>
                <Typography 
                  variant="h4" 
                  sx={{ 
                    fontWeight: 700, 
                    color: '#f59e0b',
                    fontSize: '28px',
                    textAlign: 'center'
                  }}
                >
                  {user?.empresa_nome?.slice(0, 6).toUpperCase()}
                </Typography>
              </CardContent>
            </Card>
          </motion.div>
        </Grid>
      </Grid>
    </PageLayout>
  );
};

export default DashboardPage;