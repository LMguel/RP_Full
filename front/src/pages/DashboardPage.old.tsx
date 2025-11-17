import React, { useState, useEffect } from 'react';
import PageLayout from '../sections/PageLayout';
import { useAuth } from '../contexts/AuthContext';
import { getCompanyDailySummary } from '../services/dailySummary';
import { BarChart, Bar, XAxis, YAxis, CartesianGrid, Tooltip, ResponsiveContainer, Cell } from 'recharts';

const DashboardPage: React.FC = () => {
  const { user } = useAuth();

  // Estados
  const [selectedDate, setSelectedDate] = useState('2025-11-13'); // Data com dados de exemplo
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState<string | null>(null);

  // Dados do dashboard
  const [dailyData, setDailyData] = useState<any>(null);
  const [monthlyData, setMonthlyData] = useState<any[]>([]);
  const [alerts, setAlerts] = useState<AlertType[]>([]);
  const [recentRecords, setRecentRecords] = useState<RecentRecord[]>([]);
  const [weeklyData, setWeeklyData] = useState<WeekData[]>([]);
  const [lateRanking, setLateRanking] = useState<RankingEmployee[]>([]);
  const [extraRanking, setExtraRanking] = useState<RankingEmployee[]>([]);

  useEffect(() => {
    loadDashboardData();
  }, [selectedDate]);

  const loadDashboardData = async () => {
    try {
      setLoading(true);
      setError(null);

      console.log('📊 Dashboard V3: Carregando dados para', selectedDate);

      // 1. Buscar resumos diários da empresa
      const dailyResponse = await getCompanyDailySummary(selectedDate);
      console.log('✅ Dados diários:', dailyResponse);
      setDailyData(dailyResponse);

      // 2. Buscar resumos mensais de todos os funcionários
      const date = new Date(selectedDate);
      const year = date.getFullYear();
      const month = date.getMonth() + 1;

      // Buscar todos os funcionários (usar endpoint de employees)
      // Por enquanto, vamos processar os dados diários para calcular o mensal
      await loadMonthlyData(year, month);

      // 3. Processar alertas
      processAlerts(dailyResponse);

      // 4. Processar últimos registros
      processRecentRecords(dailyResponse);

      // 5. Processar dados semanais para o gráfico
      await loadWeeklyData(date);

      // 6. Processar rankings
      processRankings(dailyResponse);

      setLoading(false);
    } catch (err: any) {
      console.error('❌ Erro ao carregar dashboard:', err);
      setError(err.response?.data?.error || 'Erro ao carregar dados');
      setLoading(false);
    }
  };

  const loadMonthlyData = async (year: number, month: number) => {
    try {
      // TODO: Implementar endpoint para buscar todos os resumos mensais da empresa
      // Por enquanto, usar dados simulados baseados no diário
      console.log('📅 Carregando dados mensais:', { year, month });
    } catch (err) {
      console.error('❌ Erro ao carregar dados mensais:', err);
    }
  };

  const loadWeeklyData = async (referenceDate: Date) => {
    try {
      // Buscar dados dos últimos 7 dias
      const weekData: WeekData[] = [];
      const daysOfWeek = ['Dom', 'Seg', 'Ter', 'Qua', 'Qui', 'Sex', 'Sáb'];

      for (let i = 6; i >= 0; i--) {
        const date = new Date(referenceDate);
        date.setDate(date.getDate() - i);
        const dateStr = date.toISOString().split('T')[0];

        try {
          const dayData = await getCompanyDailySummary(dateStr);
          const employees = dayData.employees || [];

          const totalExpected = employees.reduce(
            (sum: number, emp: any) => sum + (emp.expected_hours || 0),
            0
          );
          const totalWorked = employees.reduce(
            (sum: number, emp: any) => sum + (emp.worked_hours || 0),
            0
          );
          const totalExtra = employees.reduce(
            (sum: number, emp: any) => sum + (emp.extra_minutes || 0),
            0
          );
          const totalDelay = employees.reduce(
            (sum: number, emp: any) => sum + (emp.delay_minutes || 0),
            0
          );

          weekData.push({
            day: daysOfWeek[date.getDay()],
            expected: Math.round((totalExpected / 60) * 10) / 10,
            worked: Math.round((totalWorked / 60) * 10) / 10,
            extra: Math.round((totalExtra / 60) * 10) / 10,
            delay: Math.round((totalDelay / 60) * 10) / 10,
          });
        } catch (err) {
          // Se não houver dados para o dia, adicionar zeros
          weekData.push({
            day: daysOfWeek[date.getDay()],
            expected: 0,
            worked: 0,
            extra: 0,
            delay: 0,
          });
        }
      }

      setWeeklyData(weekData);
    } catch (err) {
      console.error('❌ Erro ao carregar dados semanais:', err);
    }
  };

  const processAlerts = (data: any) => {
    const newAlerts: AlertType[] = [];
    const employees = data.employees || [];

    // Funcionários sem saída
    const noExit = employees.filter(
      (emp: any) => emp.actual_start && !emp.actual_end
    );
    if (noExit.length > 0) {
      newAlerts.push({
        id: 'no_exit',
        type: 'error',
        title: 'Funcionários sem registro de saída',
        description: `${noExit.length} funcionário(s) ainda não registraram saída`,
        count: noExit.length,
        severity: 'high',
      });
    }

    // Funcionários ausentes (esperado > 0 mas worked = 0)
    const absent = employees.filter(
      (emp: any) => emp.expected_hours > 0 && emp.worked_hours === 0
    );
    if (absent.length > 0) {
      newAlerts.push({
        id: 'absent',
        type: 'warning',
        title: 'Funcionários ausentes',
        description: `${absent.length} funcionário(s) sem registro hoje`,
        count: absent.length,
        severity: 'medium',
      });
    }

    // Funcionários com atraso significativo (> 15 min)
    const lateEmployees = employees.filter(
      (emp: any) => emp.delay_minutes > 15
    );
    if (lateEmployees.length > 0) {
      newAlerts.push({
        id: 'late',
        type: 'warning',
        title: 'Atrasos significativos',
        description: `${lateEmployees.length} funcionário(s) com atraso acima da tolerância`,
        count: lateEmployees.length,
        severity: 'medium',
      });
    }

    // TODO: Adicionar alertas de localização quando houver dados de GPS

    setAlerts(newAlerts);
  };

  const processRecentRecords = (data: any) => {
    const employees = data.employees || [];
    const records: RecentRecord[] = [];

    employees.forEach((emp: any) => {
      // Adicionar entrada
      if (emp.actual_start) {
        records.push({
          id: `${emp.employee_id}_entry`,
          employee_name: emp.employee_name || emp.employee_id,
          timestamp: emp.actual_start,
          type: 'entrada',
          status: emp.status || 'normal',
          location_valid: true, // TODO: Usar dados reais de localização
        });
      }

      // Adicionar saída
      if (emp.actual_end) {
        records.push({
          id: `${emp.employee_id}_exit`,
          employee_name: emp.employee_name || emp.employee_id,
          timestamp: emp.actual_end,
          type: 'saída',
          status: emp.status || 'normal',
          location_valid: true,
        });
      }
    });

    // Ordenar por timestamp (mais recentes primeiro)
    records.sort((a, b) => {
      return new Date(b.timestamp).getTime() - new Date(a.timestamp).getTime();
    });

    setRecentRecords(records.slice(0, 10)); // Top 10 registros
  };

  const processRankings = (data: any) => {
    const employees = data.employees || [];

    // Ranking de atrasos
    const lateList = employees
      .filter((emp: any) => emp.delay_minutes > 0)
      .map((emp: any) => ({
        id: emp.employee_id,
        name: emp.employee_name || emp.employee_id,
        value: emp.delay_minutes,
        label: formatMinutes(emp.delay_minutes),
      }))
      .sort((a: any, b: any) => b.value - a.value);

    setLateRanking(lateList);

    // Ranking de horas extras
    const extraList = employees
      .filter((emp: any) => emp.extra_minutes > 0)
      .map((emp: any) => ({
        id: emp.employee_id,
        name: emp.employee_name || emp.employee_id,
        value: emp.extra_minutes,
        label: formatMinutes(emp.extra_minutes),
      }))
      .sort((a: any, b: any) => b.value - a.value);

    setExtraRanking(extraList);
  };

  const formatMinutes = (minutes: number): string => {
    const hours = Math.floor(minutes / 60);
    const mins = Math.round(minutes % 60);
    if (hours > 0) {
      return `${hours}h ${mins}min`;
    }
    return `${mins}min`;
  };

  // Calcular estatísticas do dia usando dados da API
  const calculateDailyStats = () => {
    const summary = dailyData?.summary || {};
    const employees = dailyData?.employees || [];

    console.log('📊 Dashboard Stats - Summary:', summary);
    console.log('📊 Dashboard Stats - Employees:', employees);

    // Usar os totais da API
    const totalWorkedMinutes = summary.total_worked_minutes || 0;
    const totalExpectedMinutes = summary.total_expected_minutes || 0;
    const totalBalanceMinutes = summary.total_balance_minutes || 0;

    const employeesWithPositiveBalance = employees.filter(
      (emp: any) => (emp.daily_balance || 0) > 0
    ).length;
    const employeesWithNegativeBalance = employees.filter(
      (emp: any) => (emp.daily_balance || 0) < 0
    ).length;

    const calculatedStats = {
      totalEmployees: summary.total_employees || 0,
      present: summary.present || 0,
      late: summary.late || 0,
      expectedHours: Math.round((totalExpectedMinutes / 60) * 10) / 10,
      workedHours: Math.round((totalWorkedMinutes / 60) * 10) / 10,
      balance: Math.round((totalBalanceMinutes / 60) * 10) / 10,
      positiveBalanceCount: employeesWithPositiveBalance,
      negativeBalanceCount: employeesWithNegativeBalance,
    };

    console.log('📊 Dashboard Stats - Calculated:', calculatedStats);
    return calculatedStats;
  };

  const stats = calculateDailyStats();

  if (loading) {
    return (
      <PageLayout>
        <Box
          display="flex"
          justifyContent="center"
          alignItems="center"
          minHeight="400px"
        >
          <CircularProgress />
        </Box>
      </PageLayout>
    );
  }

  return (
    <PageLayout>
      <Box sx={{ width: '100%' }}>
        <Typography variant="h4" fontWeight="bold" mb={3} color="white">
          Dashboard da Empresa
        </Typography>

        {/* Controles */}
        <Paper sx={{ p: 2, mb: 3 }}>
          <Box display="flex" alignItems="center" gap={2}>
            <TextField
              label="Data"
              type="date"
              value={selectedDate}
              onChange={(e) => setSelectedDate(e.target.value)}
              InputLabelProps={{ shrink: true }}
              size="small"
            />
            <Button
              variant="outlined"
              startIcon={<RefreshIcon />}
              onClick={loadDashboardData}
            >
              Atualizar
            </Button>
          </Box>
        </Paper>

        {error && (
          <Alert severity="error" sx={{ mb: 3 }}>
            {error}
          </Alert>
        )}

        {/* Cards Principais */}
        <Box
          sx={{
            display: 'grid',
            gridTemplateColumns: {
              xs: '1fr',
              sm: 'repeat(2, 1fr)',
              md: 'repeat(3, 1fr)',
            },
            gap: 3,
            mb: 3,
          }}
        >
          <StatCard
            title="Funcionários Presentes"
            value={`${stats.present} / ${stats.totalEmployees}`}
            subtitle={stats.late > 0 ? `${stats.late} chegaram atrasados` : 'Todos no horário'}
            icon={<PeopleIcon sx={{ fontSize: 32, color: 'white' }} />}
            color="primary"
            gradient="linear-gradient(135deg, #667eea 0%, #764ba2 100%)"
          />
          <StatCard
            title="Horas Trabalhadas"
            value={`${stats.workedHours}h`}
            subtitle={`Meta: ${stats.expectedHours}h`}
            icon={<AccessTimeIcon sx={{ fontSize: 32, color: 'white' }} />}
            color="success"
            gradient="linear-gradient(135deg, #f093fb 0%, #f5576c 100%)"
          />
          <StatCard
            title="Saldo Acumulado"
            value={`${stats.balance >= 0 ? '+' : ''}${stats.balance}h`}
            subtitle={
              stats.balance >= 0
                ? `${stats.positiveBalanceCount} funcionários positivos`
                : `${stats.negativeBalanceCount} funcionários negativos`
            }
            icon={
              stats.balance >= 0 ? (
                <TrendingUpIcon sx={{ fontSize: 32, color: 'white' }} />
              ) : (
                <TrendingDownIcon sx={{ fontSize: 32, color: 'white' }} />
              )
            }
            color={stats.balance >= 0 ? 'success' : 'error'}
            gradient={
              stats.balance >= 0
                ? 'linear-gradient(135deg, #4facfe 0%, #00f2fe 100%)'
                : 'linear-gradient(135deg, #fa709a 0%, #fee140 100%)'
            }
          />
        </Box>

        {/* Alertas e Últimos Registros */}
        <Box
          sx={{
            display: 'grid',
            gridTemplateColumns: { xs: '1fr', md: 'repeat(2, 1fr)' },
            gap: 3,
            mb: 3,
          }}
        >
          <AlertsWidget alerts={alerts} />
          <RecentRecordsWidget records={recentRecords} />
        </Box>

        {/* Gráfico e Rankings */}
        <Box
          sx={{
            display: 'grid',
            gridTemplateColumns: { xs: '1fr', md: '2fr 1fr' },
            gap: 3,
          }}
        >
          <WeeklyChart data={weeklyData} />
          <RankingWidget
            lateEmployees={lateRanking}
            extraEmployees={extraRanking}
          />
        </Box>
      </Box>
    </PageLayout>
  );
};

export default DashboardPage;
