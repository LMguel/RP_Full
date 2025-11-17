import React, { useState, useEffect } from 'react';
import PageLayout from '../sections/PageLayout';
import { useAuth } from '../contexts/AuthContext';
import { getCompanyDailySummary, getCompanyDailySummaryRange } from '../services/dailySummary';
import { 
  BarChart, 
  Bar, 
  XAxis, 
  YAxis, 
  CartesianGrid, 
  Tooltip, 
  ResponsiveContainer,
  Cell,
  Line,
  ComposedChart,
  ReferenceLine
} from 'recharts';
import { 
  Users, 
  Clock, 
  TrendingUp, 
  TrendingDown, 
  AlertTriangle,
  CheckCircle,
  MapPin,
  Calendar,
  Target,
  Award,
  Activity
} from 'lucide-react';

// Tipos
interface DashboardData {
  present_today: number;
  total_employees: number;
  on_time_today: number;
  worked_hours: number;
  expected_hours: number;
  total_balance: number;
  positive_count: number;
  negative_count: number;
  alerts: Alert[];
  latest_records: Record[];
  week_hours: WeekHour[];
  ranking: {
    late: RankingItem[];
    extra: RankingItem[];
  };
  trends: {
    present_diff: number;
    hours_diff: number;
    balance_diff: number;
  };
  performance: {
    punctuality: number;
    attendance: number;
    trend: number;
  };
}

interface Alert {
  type: string;
  message: string;
  details?: string;
  severity?: 'high' | 'medium' | 'low';
  employee: string;
  time?: string;
}

interface Record {
  photo?: string;
  name: string;
  timestamp: string;
  expected_time?: string;
  type: string;
  status: string;
  delay_minutes?: number;
  has_location?: boolean;
  location?: {
    lat: number;
    lng: number;
  };
}

interface WeekHour {
  day: string;
  worked: number;
  expected: number;
}

interface RankingItem {
  name: string;
  minutes: number;
  hours: string;
}

const DashboardPage: React.FC = () => {
  const { user } = useAuth();
  const todayStr = new Date().toISOString().split('T')[0];
  const [selectedDate, setSelectedDate] = useState(todayStr);
  
  // Estados para modais
  const [showPresenceModal, setShowPresenceModal] = useState(false);
  const [showHoursRankingModal, setShowHoursRankingModal] = useState(false);
  const [showBalanceModal, setShowBalanceModal] = useState(false);
  const [rankingOrder, setRankingOrder] = useState<'desc' | 'asc'>('desc'); // maior para menor
  const [dateFrom, setDateFrom] = useState(todayStr);
  const [dateTo, setDateTo] = useState(todayStr);
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState<string | null>(null);
  const [dashboardData, setDashboardData] = useState<DashboardData | null>(null);
  const [showFullRanking, setShowFullRanking] = useState(false);
  const [selectedMonth, setSelectedMonth] = useState<string>('');

  // Carrega dados automaticamente quando as datas mudam
  useEffect(() => {
    loadDashboardData();
  }, [dateFrom, dateTo]);

  // Gera lista dos últimos 12 meses para o seletor
  const generateMonthOptions = () => {
    const options = [];
    const today = new Date();
    
    for (let i = 0; i < 12; i++) {
      const date = new Date(today.getFullYear(), today.getMonth() - i, 1);
      const year = date.getFullYear();
      const month = date.getMonth();
      
      const monthNames = [
        'Janeiro', 'Fevereiro', 'Março', 'Abril', 'Maio', 'Junho',
        'Julho', 'Agosto', 'Setembro', 'Outubro', 'Novembro', 'Dezembro'
      ];
      
      options.push({
        value: `${year}-${String(month + 1).padStart(2, '0')}`,
        label: `${monthNames[month]} ${year}`
      });
    }
    
    return options;
  };

  // Handler para seleção de mês específico
  const handleMonthSelect = (monthValue: string) => {
    if (!monthValue) {
      setSelectedMonth('');
      // Volta para o dia atual
      const today = new Date().toISOString().split('T')[0];
      setDateFrom(today);
      setDateTo(today);
      return;
    }

    setSelectedMonth(monthValue);

    // Calcular primeiro e último dia do mês selecionado
    const [year, month] = monthValue.split('-').map(Number);
    const firstDay = new Date(year, month - 1, 1);
    const lastDay = new Date(year, month, 0);

    const from = firstDay.toISOString().split('T')[0];
    const to = lastDay.toISOString().split('T')[0];

    setDateFrom(from);
    setDateTo(to);
    setSelectedDate(from);
    // O useEffect automaticamente recarregará os dados
  };

  const loadDashboardData = async () => {
    try {
      setLoading(true);
      setError(null);

      console.log('🔍 Carregando dashboard para período:', { dateFrom, dateTo });
      console.log('🔑 User:', user);
      console.log('🔑 Token:', localStorage.getItem('token') ? 'Presente' : 'AUSENTE');

      // Buscar dados da API usando intervalo de datas
      const response = await getCompanyDailySummaryRange(dateFrom, dateTo);
      console.log('📊 Resposta da API:', response);
      
      // Verificar se resposta tem dados
      if (!response || !response.employees) {
        console.warn('⚠️ Resposta da API sem dados de employees');
      }
      
      // Processar dados para o formato do dashboard
      const processed = processDashboardData(response);
      console.log('✅ Dados processados:', processed);
      setDashboardData(processed);
      
      setLoading(false);
    } catch (err: any) {
      console.error('❌ Erro ao carregar dashboard:', err);
      console.error('❌ Detalhes:', err.response?.data);
      console.error('❌ Status:', err.response?.status);
      setError(err.response?.data?.error || err.message || 'Erro ao carregar dados');
      setLoading(false);
    }
  };

  const processDashboardData = (apiData: any): DashboardData => {
    const employees = apiData.employees || [];
    const summary = apiData.summary || {};
    
    // Armazenar employees para uso nos modais
    (window as any).dashboardEmployees = employees;

    // 1. Funcionários presentes
    const present_today = summary.present || 0;
    const total_employees = summary.total_employees || 0;
    const on_time_today = employees.filter((e: any) => e.delay_minutes === 0).length;

    // 2. Horas trabalhadas
    const worked_hours = Math.round((summary.total_worked_minutes || 0) / 60 * 10) / 10;
    const expected_hours = Math.round((summary.total_expected_minutes || 0) / 60 * 10) / 10;

    // 3. Saldo acumulado
    const total_balance = Math.round((summary.total_balance_minutes || 0) / 60 * 10) / 10;
    const positive_count = employees.filter((e: any) => (e.daily_balance || 0) > 0).length;
    const negative_count = employees.filter((e: any) => (e.daily_balance || 0) < 0).length;

    // 4. Alertas
    const alerts: Alert[] = [];
    
    // Sem saída
    const noExit = employees.filter((e: any) => e.actual_start && !e.actual_end);
    noExit.forEach((emp: any) => {
      alerts.push({
        type: 'no_exit',
        employee: emp.employee_name || emp.employee_id,
        message: `Sem registro de saída`,
        details: `Entrada: ${emp.actual_start}`,
        time: emp.actual_start,
        severity: 'high'
      });
    });

    // Ausentes
    const absent = employees.filter((e: any) => e.status === 'absent');
    absent.forEach((emp: any) => {
      alerts.push({
        type: 'absent',
        employee: emp.employee_name || emp.employee_id,
        message: `Sem registro hoje`,
        severity: 'medium'
      });
    });

    // Atrasos
    const late = employees.filter((e: any) => e.delay_minutes > 0);
    late.forEach((emp: any) => {
      const minutes = Math.round(emp.delay_minutes);
      alerts.push({
        type: 'late',
        employee: emp.employee_name || emp.employee_id,
        message: `Atraso de ${minutes} min`,
        details: `Entrada: ${emp.actual_start}`,
        time: emp.actual_start,
        severity: minutes > 15 ? 'high' : 'low'
      });
    });

    // 5. Últimos registros - INCLUIR ENTRADA E SAÍDA
    const latest_records: Record[] = [];
    
    employees.forEach((emp: any) => {
      // Adicionar registro de entrada se existir
      if (emp.actual_start) {
        latest_records.push({
          name: emp.employee_name || emp.employee_id,
          timestamp: emp.actual_start,
          expected_time: emp.expected_start,
          type: 'Entrada',
          status: emp.delay_minutes > 0 ? 'Atraso' : 'Normal',
          delay_minutes: emp.delay_minutes || 0,
          has_location: false,
          location: undefined
        });
      }
      
      // Adicionar registro de saída se existir
      if (emp.actual_end) {
        latest_records.push({
          name: emp.employee_name || emp.employee_id,
          timestamp: emp.actual_end,
          expected_time: emp.expected_end,
          type: 'Saída',
          status: emp.extra_minutes > 0 ? 'Extra' : 'Normal',
          delay_minutes: emp.extra_minutes || 0,
          has_location: false,
          location: undefined
        });
      }
    });
    
    // Ordenar por timestamp mais recente primeiro
    latest_records.sort((a, b) => {
      const timeA = new Date(a.timestamp).getTime();
      const timeB = new Date(b.timestamp).getTime();
      return timeB - timeA;
    });

    // 6. Dados da semana (simulado por enquanto)
    const week_hours: WeekHour[] = [
      { day: 'Seg', worked: worked_hours, expected: expected_hours },
      { day: 'Ter', worked: 0, expected: expected_hours },
      { day: 'Qua', worked: 0, expected: expected_hours },
      { day: 'Qui', worked: 0, expected: expected_hours },
      { day: 'Sex', worked: 0, expected: expected_hours },
    ];

    // 7. Rankings
    const late_ranking = employees
      .filter((e: any) => e.delay_minutes > 0)
      .map((e: any) => {
        const mins = Math.round(e.delay_minutes);
        return {
          name: e.employee_name || e.employee_id,
          minutes: mins,
          hours: `${Math.floor(mins / 60)}h ${mins % 60}min`
        };
      })
      .sort((a: any, b: any) => b.minutes - a.minutes);

    const extra_ranking = employees
      .filter((e: any) => e.extra_minutes > 0)
      .map((e: any) => {
        const mins = Math.round(e.extra_minutes);
        return {
          name: e.employee_name || e.employee_id,
          minutes: mins,
          hours: `${Math.floor(mins / 60)}h ${mins % 60}min`
        };
      })
      .sort((a: any, b: any) => b.minutes - a.minutes);

    // 8. Tendências (simulado - TODO: comparar com dia anterior)
    const trends = {
      present_diff: 0, // +2, -1, etc
      hours_diff: 0,
      balance_diff: 0
    };

    // 9. Performance Geral (simulado - TODO: calcular do banco)
    const performance = {
      punctuality: Math.round((on_time_today / (present_today || 1)) * 100),
      attendance: Math.round((present_today / total_employees) * 100),
      trend: 0 // positivo = melhorando, negativo = piorando
    };

    return {
      present_today,
      total_employees,
      on_time_today,
      worked_hours,
      expected_hours,
      total_balance,
      positive_count,
      negative_count,
      alerts,
      latest_records: latest_records.slice(0, 5),
      week_hours,
      ranking: {
        late: late_ranking,
        extra: extra_ranking
      },
      trends,
      performance
    };
  };

  const getHoursColor = (worked: number, expected: number) => {
    if (worked > expected) return 'text-green-600';
    if (worked === expected) return 'text-blue-600';
    return 'text-yellow-600';
  };

  const getBalanceColor = (balance: number) => {
    if (balance > 0) return 'text-green-600';
    if (balance < 0) return 'text-red-600';
    return 'text-gray-600';
  };

  const getStatusColor = (status: string) => {
    switch (status) {
      case 'Normal': return 'bg-blue-100 text-blue-800';
      case 'Atraso': return 'bg-red-100 text-red-800';
      case 'Extra': return 'bg-green-100 text-green-800';
      default: return 'bg-gray-100 text-gray-800';
    }
  };

  const getSeverityIcon = (severity?: string) => {
    switch (severity) {
      case 'high': return '🔴';
      case 'medium': return '🟡';
      case 'low': return '🟢';
      default: return '⚠️';
    }
  };

  const getBarColor = (worked: number, expected: number) => {
    if (worked >= expected) return '#10b981'; // green
    if (worked >= expected * 0.9) return '#fbbf24'; // yellow
    return '#ef4444'; // red
  };

  if (loading) {
    return (
      <PageLayout>
        <div className="flex flex-col justify-center items-center min-h-screen">
          <div className="animate-spin rounded-full h-12 w-12 border-b-2 border-blue-600"></div>
          <p className="text-white mt-4">Carregando dashboard...</p>
        </div>
      </PageLayout>
    );
  }

  if (error) {
    return (
      <PageLayout>
        <div className="flex flex-col items-center justify-center min-h-screen">
          <div className="bg-red-100 border border-red-400 text-red-700 px-6 py-4 rounded-lg max-w-md">
            <h3 className="font-bold mb-2">❌ Erro ao carregar dados</h3>
            <p>{error}</p>
          </div>
          <button
            onClick={loadDashboardData}
            className="mt-4 px-6 py-2 bg-blue-600 text-white rounded-lg hover:bg-blue-700"
          >
            🔄 Tentar Novamente
          </button>
        </div>
      </PageLayout>
    );
  }

  if (!dashboardData) {
    console.warn('⚠️ dashboardData está null/undefined');
    return (
      <PageLayout>
        <div className="text-center text-white p-8">
          <p className="text-xl mb-4">Nenhum dado disponível</p>
          <button
            onClick={loadDashboardData}
            className="px-6 py-2 bg-blue-600 text-white rounded-lg hover:bg-blue-700"
          >
            🔄 Recarregar
          </button>
        </div>
      </PageLayout>
    );
  }

  const data = dashboardData;
  console.log('🎨 Renderizando dashboard com dados:', data);

  return (
    <PageLayout>
      <div className="w-full max-w-7xl mx-auto p-4 space-y-6">
        {/* Cabeçalho com Filtros */}
        <div className="flex flex-col md:flex-row justify-between items-start md:items-center gap-4 mb-6">
          <h1 className="text-3xl font-bold text-white flex items-center gap-3">
            <Activity className="w-8 h-8" />
            Dashboard da Empresa
          </h1>
          
          {/* Filtros de Data Simplificados */}
          <div className="flex flex-wrap items-center gap-3">
            {/* Seletor de Período (Início e Fim) */}
            <div className="flex items-center gap-2 bg-white/10 backdrop-blur-lg rounded-lg px-4 py-2 border border-white/20">
              <Calendar className="w-5 h-5 text-white" />
              <input
                type="date"
                value={dateFrom}
                onChange={(e) => setDateFrom(e.target.value)}
                className="bg-transparent text-white font-semibold focus:outline-none cursor-pointer"
                style={{ colorScheme: 'dark' }}
              />
              <span className="text-white/60">até</span>
              <input
                type="date"
                value={dateTo}
                onChange={(e) => setDateTo(e.target.value)}
                className="bg-transparent text-white font-semibold focus:outline-none cursor-pointer"
                style={{ colorScheme: 'dark' }}
              />
            </div>

            {/* Seletor Rápido de Mês */}
            <select
              value={selectedMonth}
              onChange={(e) => handleMonthSelect(e.target.value)}
              className="px-4 py-2 rounded-lg border border-white/30 bg-white/10 backdrop-blur-lg text-white focus:ring-2 focus:ring-blue-500 focus:border-transparent font-semibold cursor-pointer hover:bg-white/15 transition-all"
              style={{ colorScheme: 'dark' }}
            >
              <option value="">📅 Mês Completo</option>
              {generateMonthOptions().map((option) => (
                <option key={option.value} value={option.value}>
                  {option.label}
                </option>
              ))}
            </select>

            {/* Botão Atualizar */}
            <button
              onClick={loadDashboardData}
              className="px-4 py-2 bg-blue-600 text-white rounded-lg hover:bg-blue-700 transition-colors shadow-lg font-semibold"
            >
              🔄 Atualizar
            </button>
          </div>
        </div>

        {error && (
          <div className="bg-red-100 border border-red-400 text-red-700 px-4 py-3 rounded-lg">
            {error}
          </div>
        )}

        {/* Grid Principal - 3 Cards Superiores com Ícones e Tendências */}
        <div className="grid grid-cols-1 md:grid-cols-3 gap-6">
          {/* 1. Funcionários Presentes */}
          <div 
            className="bg-gradient-to-br from-purple-500 to-purple-700 rounded-xl shadow-lg p-6 text-white transform hover:scale-105 transition-transform cursor-pointer"
            onClick={() => setShowPresenceModal(true)}
          >
            <div className="flex justify-between items-start mb-4">
              <div className="bg-white/20 p-3 rounded-lg">
                <Users className="w-8 h-8" />
              </div>
              {data.trends.present_diff !== 0 && (
                <div className={`flex items-center gap-1 text-sm font-semibold ${
                  data.trends.present_diff > 0 ? 'text-green-300' : 'text-red-300'
                }`}>
                  {data.trends.present_diff > 0 ? (
                    <TrendingUp className="w-4 h-4" />
                  ) : (
                    <TrendingDown className="w-4 h-4" />
                  )}
                  {Math.abs(data.trends.present_diff)} de ontem
                </div>
              )}
            </div>
            <h3 className="text-lg font-semibold mb-2 opacity-90">Funcionários Presentes</h3>
            <div className="text-4xl font-bold mb-2">
              {data.present_today} / {data.total_employees}
            </div>
            <p className="text-sm opacity-80 flex items-center gap-2">
              {data.present_today === data.total_employees ? (
                <>
                  <CheckCircle className="w-4 h-4" />
                  Todos no horário
                </>
              ) : (
                <>
                  <Clock className="w-4 h-4" />
                  {data.on_time_today} no horário
                </>
              )}
            </p>
          </div>

          {/* 2. Horas Trabalhadas */}
          <div 
            className="bg-gradient-to-br from-pink-500 to-red-500 rounded-xl shadow-lg p-6 text-white transform hover:scale-105 transition-transform cursor-pointer"
            onClick={() => setShowHoursRankingModal(true)}
          >
            <div className="flex justify-between items-start mb-4">
              <div className="bg-white/20 p-3 rounded-lg">
                <Clock className="w-8 h-8" />
              </div>
              {data.trends.hours_diff !== 0 && (
                <div className={`flex items-center gap-1 text-sm font-semibold ${
                  data.trends.hours_diff > 0 ? 'text-green-300' : 'text-red-300'
                }`}>
                  {data.trends.hours_diff > 0 ? (
                    <TrendingUp className="w-4 h-4" />
                  ) : (
                    <TrendingDown className="w-4 h-4" />
                  )}
                  {Math.abs(data.trends.hours_diff)}h de ontem
                </div>
              )}
            </div>
            <h3 className="text-lg font-semibold mb-2 opacity-90">Horas Trabalhadas</h3>
            <div className="text-4xl font-bold mb-2">
              {data.worked_hours}h
            </div>
            <p className="text-sm opacity-80 flex items-center gap-2">
              <Target className="w-4 h-4" />
              Meta: {data.expected_hours}h
              {data.worked_hours >= data.expected_hours && (
                <span className="ml-2 text-green-300 font-semibold">✓ Atingida</span>
              )}
            </p>
          </div>

          {/* 3. Saldo Acumulado */}
          <div 
            className={`bg-gradient-to-br ${
              data.total_balance >= 0 
                ? 'from-cyan-400 to-blue-500' 
                : 'from-orange-400 to-red-500'
            } rounded-xl shadow-lg p-6 text-white transform hover:scale-105 transition-transform cursor-pointer`}
            onClick={() => setShowBalanceModal(true)}
          >
            <div className="flex justify-between items-start mb-4">
              <div className="bg-white/20 p-3 rounded-lg">
                {data.total_balance >= 0 ? (
                  <TrendingUp className="w-8 h-8" />
                ) : (
                  <TrendingDown className="w-8 h-8" />
                )}
              </div>
              {data.trends.balance_diff !== 0 && (
                <div className={`flex items-center gap-1 text-sm font-semibold ${
                  data.trends.balance_diff > 0 ? 'text-green-300' : 'text-red-300'
                }`}>
                  {data.trends.balance_diff > 0 ? (
                    <TrendingUp className="w-4 h-4" />
                  ) : (
                    <TrendingDown className="w-4 h-4" />
                  )}
                  {Math.abs(data.trends.balance_diff)}h de ontem
                </div>
              )}
            </div>
            <h3 className="text-lg font-semibold mb-2 opacity-90">Saldo Acumulado</h3>
            <div className="text-4xl font-bold mb-2">
              {data.total_balance >= 0 ? '+' : ''}{data.total_balance}h
            </div>
            <p className="text-sm opacity-80">
              {data.total_balance >= 0
                ? `${data.positive_count} funcionários positivos`
                : `${data.negative_count} funcionários negativos`}
            </p>
          </div>
        </div>

        {/* Grid Secundário - 2 Colunas */}
        <div className="grid grid-cols-1 lg:grid-cols-2 gap-6">
          {/* 4. Alertas do Dia - Agrupado e Ordenado */}
          <div className="bg-white rounded-xl shadow-lg p-6">
            <div className="flex items-center justify-between mb-4">
              <h3 className="text-xl font-bold text-gray-800 flex items-center gap-2">
                <AlertTriangle className="w-6 h-6 text-orange-500" />
                Alertas do Dia
              </h3>
              <span className="bg-red-100 text-red-700 px-3 py-1 rounded-full text-sm font-bold">
                {data.alerts.length}
              </span>
            </div>
            
            {data.alerts.length === 0 ? (
              <div className="text-center py-8">
                <CheckCircle className="w-16 h-16 mx-auto text-green-500 mb-2" />
                <p className="text-lg font-semibold text-green-600">Nenhum alerta no momento!</p>
                <p className="text-sm text-gray-600">Tudo funcionando perfeitamente.</p>
              </div>
            ) : (
              <div className="space-y-4 max-h-80 overflow-y-auto">
                {/* Agrupar por tipo e severidade */}
                {['high', 'medium', 'low'].map(severity => {
                  const alertsOfSeverity = data.alerts.filter(a => a.severity === severity);
                  if (alertsOfSeverity.length === 0) return null;
                  
                  return (
                    <div key={severity} className="space-y-2">
                      <h4 className={`text-xs font-bold uppercase tracking-wide ${
                        severity === 'high' ? 'text-red-600' :
                        severity === 'medium' ? 'text-yellow-600' :
                        'text-blue-600'
                      }`}>
                        {severity === 'high' ? '🔴 Crítico' :
                         severity === 'medium' ? '🟡 Atenção' :
                         '🟢 Leve'} ({alertsOfSeverity.length})
                      </h4>
                      {alertsOfSeverity.map((alert, idx) => (
                        <div 
                          key={idx} 
                          className={`group relative p-3 rounded-lg border-l-4 transition-all hover:shadow-md cursor-pointer ${
                            severity === 'high' ? 'bg-red-50 border-red-500 hover:bg-red-100' :
                            severity === 'medium' ? 'bg-yellow-50 border-yellow-500 hover:bg-yellow-100' :
                            'bg-blue-50 border-blue-500 hover:bg-blue-100'
                          }`}
                          title={alert.details || alert.message}
                        >
                          <div className="flex items-start gap-3">
                            <div className="flex-1">
                              <p className="font-semibold text-gray-800">{alert.employee}</p>
                              <p className="text-sm text-gray-600">{alert.message}</p>
                              {alert.time && (
                                <p className="text-xs text-gray-500 mt-1">
                                  <Clock className="w-3 h-3 inline mr-1" />
                                  {alert.time}
                                </p>
                              )}
                            </div>
                            {/* Tooltip com detalhes */}
                            {alert.details && (
                              <div className="hidden group-hover:block absolute right-2 top-2 bg-gray-800 text-white text-xs p-2 rounded shadow-lg max-w-xs z-10">
                                {alert.details}
                              </div>
                            )}
                          </div>
                        </div>
                      ))}
                    </div>
                  );
                })}
              </div>
            )}
          </div>

          {/* 5. Últimos Registros - Com Diferença e Localização */}
          <div className="bg-white rounded-xl shadow-lg p-6">
            <h3 className="text-xl font-bold mb-4 text-gray-800 flex items-center gap-2">
              <Clock className="w-6 h-6 text-blue-500" />
              Últimos Registros
            </h3>
            {data.latest_records.length === 0 ? (
              <div className="text-center py-8 text-gray-500">
                Nenhum registro hoje ainda
              </div>
            ) : (
              <div className="space-y-3 max-h-80 overflow-y-auto">
                {data.latest_records.map((record, idx) => (
                  <div 
                    key={idx} 
                    className="group relative flex items-start gap-3 p-3 bg-gray-50 rounded-lg hover:bg-gray-100 transition-all hover:shadow-md"
                  >
                    <div className="w-12 h-12 rounded-full bg-gradient-to-br from-blue-400 to-blue-600 flex items-center justify-center text-white font-bold text-lg flex-shrink-0">
                      {record.name.charAt(0).toUpperCase()}
                    </div>
                    <div className="flex-1 min-w-0">
                      <div className="flex items-start justify-between gap-2">
                        <div className="flex-1">
                          <p className="font-semibold text-gray-800">{record.name}</p>
                          <div className="flex items-center gap-2 text-sm text-gray-600 mt-1">
                            <span className="font-medium">
                              {new Date(record.timestamp).toLocaleTimeString('pt-BR', { 
                                hour: '2-digit', 
                                minute: '2-digit' 
                              })}
                            </span>
                            <span>•</span>
                            <span>{record.type}</span>
                            {record.has_location && (
                              <span title="Com localização">
                                <MapPin className="w-4 h-4 text-green-600" />
                              </span>
                            )}
                          </div>
                          {/* Diferença de horário */}
                          {record.delay_minutes !== undefined && record.delay_minutes !== 0 && (
                            <div className={`text-xs mt-1 flex items-center gap-1 ${
                              record.delay_minutes > 0 ? 'text-red-600' : 'text-green-600'
                            }`}>
                              {record.delay_minutes > 0 ? (
                                <>
                                  <TrendingDown className="w-3 h-3" />
                                  Atraso de {record.delay_minutes} min
                                </>
                              ) : (
                                <>
                                  <TrendingUp className="w-3 h-3" />
                                  Adiantado {Math.abs(record.delay_minutes)} min
                                </>
                              )}
                              {record.expected_time && (
                                <span className="text-gray-500 ml-1">
                                  (esperado: {record.expected_time})
                                </span>
                              )}
                            </div>
                          )}
                        </div>
                        <span className={`px-3 py-1 rounded-full text-xs font-semibold whitespace-nowrap ${getStatusColor(record.status)}`}>
                          {record.status}
                        </span>
                      </div>
                      
                      {/* Tooltip com coordenadas (se houver) */}
                      {record.location && (
                        <div className="hidden group-hover:block absolute right-2 bottom-full mb-2 bg-gray-800 text-white text-xs p-2 rounded shadow-lg z-10 whitespace-nowrap">
                          📍 Lat: {record.location.lat.toFixed(6)}, Lng: {record.location.lng.toFixed(6)}
                        </div>
                      )}
                    </div>
                  </div>
                ))}
              </div>
            )}
          </div>
        </div>

        {/* Grid Inferior - Gráfico e Rankings */}
        <div className="grid grid-cols-1 lg:grid-cols-3 gap-6">
          {/* 6. Gráfico - Horas da Semana com Meta e Performance */}
          <div className="lg:col-span-2 bg-white rounded-xl shadow-lg p-6">
            <div className="flex items-center justify-between mb-4">
              <h3 className="text-xl font-bold text-gray-800 flex items-center gap-2">
                <Activity className="w-6 h-6 text-purple-500" />
                Horas da Semana
              </h3>
              <div className="flex items-center gap-4 text-sm">
                <div className="flex items-center gap-2">
                  <div className="w-3 h-3 bg-green-500 rounded"></div>
                  <span>Acima da meta</span>
                </div>
                <div className="flex items-center gap-2">
                  <div className="w-3 h-3 bg-yellow-500 rounded"></div>
                  <span>Próximo da meta</span>
                </div>
                <div className="flex items-center gap-2">
                  <div className="w-3 h-3 bg-red-500 rounded"></div>
                  <span>Abaixo da meta</span>
                </div>
              </div>
            </div>
            
            {data.week_hours.every(d => d.worked === 0) ? (
              <div className="text-center py-12 text-gray-500">
                <Activity className="w-16 h-16 mx-auto text-gray-300 mb-2" />
                <p>Sem dados para exibir</p>
              </div>
            ) : (
              <ResponsiveContainer width="100%" height={280}>
                <ComposedChart data={data.week_hours}>
                  <CartesianGrid strokeDasharray="3 3" stroke="#e5e7eb" />
                  <XAxis 
                    dataKey="day" 
                    tick={{ fill: '#6b7280' }}
                    tickLine={{ stroke: '#6b7280' }}
                  />
                  <YAxis 
                    tick={{ fill: '#6b7280' }}
                    tickLine={{ stroke: '#6b7280' }}
                    label={{ value: 'Horas', angle: -90, position: 'insideLeft', fill: '#6b7280' }}
                  />
                  <Tooltip 
                    contentStyle={{ 
                      backgroundColor: '#1f2937', 
                      border: 'none', 
                      borderRadius: '8px',
                      color: '#fff'
                    }}
                    formatter={(value: any, name: string) => {
                      if (name === 'worked') return [`${value}h trabalhadas`, 'Trabalhado'];
                      if (name === 'expected') return [`${value}h previstas`, 'Meta'];
                      return [value, name];
                    }}
                    labelFormatter={(label) => `${label}`}
                  />
                  
                  {/* Linha de meta */}
                  <Line 
                    type="monotone" 
                    dataKey="expected" 
                    stroke="#f59e0b" 
                    strokeWidth={2}
                    strokeDasharray="5 5"
                    dot={{ fill: '#f59e0b', r: 4 }}
                    name="Meta"
                  />
                  
                  {/* Barras com cores baseadas em performance */}
                  <Bar 
                    dataKey="worked" 
                    radius={[8, 8, 0, 0]}
                    name="Trabalhado"
                  >
                    {data.week_hours.map((entry, index) => (
                      <Cell 
                        key={`cell-${index}`} 
                        fill={getBarColor(entry.worked, entry.expected)} 
                      />
                    ))}
                  </Bar>
                </ComposedChart>
              </ResponsiveContainer>
            )}
            
            {/* Resumo da semana */}
            <div className="mt-4 pt-4 border-t border-gray-200 flex justify-around text-center">
              <div>
                <p className="text-2xl font-bold text-gray-800">
                  {data.week_hours.reduce((sum, d) => sum + d.worked, 0).toFixed(1)}h
                </p>
                <p className="text-sm text-gray-600">Total Trabalhado</p>
              </div>
              <div>
                <p className="text-2xl font-bold text-gray-800">
                  {data.week_hours.reduce((sum, d) => sum + d.expected, 0).toFixed(1)}h
                </p>
                <p className="text-sm text-gray-600">Meta Semanal</p>
              </div>
              <div>
                <p className={`text-2xl font-bold ${
                  data.week_hours.reduce((sum, d) => sum + d.worked, 0) >= data.week_hours.reduce((sum, d) => sum + d.expected, 0)
                    ? 'text-green-600'
                    : 'text-red-600'
                }`}>
                  {(data.week_hours.reduce((sum, d) => sum + d.worked, 0) - data.week_hours.reduce((sum, d) => sum + d.expected, 0)).toFixed(1)}h
                </p>
                <p className="text-sm text-gray-600">Variação</p>
              </div>
            </div>
          </div>

          {/* 7. Rankings - Top 3 em Destaque */}
          <div className="bg-white rounded-xl shadow-lg p-6">
            <h3 className="text-xl font-bold mb-4 text-gray-800 flex items-center gap-2">
              <Award className="w-6 h-6 text-yellow-500" />
              Ranking do Mês
            </h3>
            
            {/* Atrasos */}
            <div className="mb-6">
              <h4 className="font-semibold text-gray-700 mb-3 flex items-center gap-2">
                <TrendingDown className="w-4 h-4 text-red-500" />
                Mais Atrasos
              </h4>
              {data.ranking.late.length === 0 ? (
                <div className="text-center py-4 bg-green-50 rounded-lg">
                  <CheckCircle className="w-8 h-8 mx-auto text-green-500 mb-1" />
                  <p className="text-sm text-green-600 font-semibold">Nenhum atraso significativo!</p>
                </div>
              ) : (
                <>
                  <div className="space-y-2 mb-3">
                    {data.ranking.late.slice(0, 3).map((item, idx) => (
                      <div 
                        key={idx} 
                        className={`flex items-center justify-between p-3 rounded-lg transition-all ${
                          idx === 0 ? 'bg-red-100 border-2 border-red-300' :
                          idx === 1 ? 'bg-red-50 border border-red-200' :
                          'bg-red-50'
                        }`}
                      >
                        <div className="flex items-center gap-3">
                          <span className={`text-2xl ${
                            idx === 0 ? '🥇' :
                            idx === 1 ? '🥈' :
                            '🥉'
                          }`}></span>
                          <div>
                            <p className="font-semibold text-gray-800">{item.name}</p>
                            <p className="text-xs text-gray-600">{item.hours}</p>
                          </div>
                        </div>
                        <span className="text-red-600 font-bold">{item.minutes} min</span>
                      </div>
                    ))}
                  </div>
                  
                  {data.ranking.late.length > 3 && !showFullRanking && (
                    <button
                      onClick={() => setShowFullRanking(true)}
                      className="w-full py-2 text-sm text-blue-600 hover:bg-blue-50 rounded-lg transition-colors font-semibold"
                    >
                      Ver mais {data.ranking.late.length - 3} funcionários
                    </button>
                  )}
                  
                  {showFullRanking && data.ranking.late.length > 3 && (
                    <div className="space-y-1 mb-2">
                      {data.ranking.late.slice(3).map((item, idx) => (
                        <div key={idx} className="flex justify-between items-center text-sm py-2 px-3 hover:bg-gray-50 rounded">
                          <span className="flex items-center gap-2">
                            <span className="font-bold text-gray-400">{idx + 4}.</span>
                            <span>{item.name}</span>
                          </span>
                          <span className="text-red-600 font-semibold">{item.minutes} min</span>
                        </div>
                      ))}
                      <button
                        onClick={() => setShowFullRanking(false)}
                        className="w-full py-2 text-sm text-gray-600 hover:bg-gray-100 rounded-lg transition-colors"
                      >
                        Ver menos
                      </button>
                    </div>
                  )}
                </>
              )}
            </div>

            {/* Horas Extras */}
            <div>
              <h4 className="font-semibold text-gray-700 mb-3 flex items-center gap-2">
                <TrendingUp className="w-4 h-4 text-green-500" />
                Mais Horas Extras
              </h4>
              {data.ranking.extra.length === 0 ? (
                <div className="text-center py-4 bg-gray-50 rounded-lg">
                  <p className="text-sm text-gray-500">Nenhum registro de hora extra</p>
                </div>
              ) : (
                <div className="space-y-2">
                  {data.ranking.extra.slice(0, 3).map((item, idx) => (
                    <div 
                      key={idx} 
                      className={`flex items-center justify-between p-3 rounded-lg transition-all ${
                        idx === 0 ? 'bg-green-100 border-2 border-green-300' :
                        idx === 1 ? 'bg-green-50 border border-green-200' :
                        'bg-green-50'
                      }`}
                    >
                      <div className="flex items-center gap-3">
                        <span className={`text-2xl ${
                          idx === 0 ? '🥇' :
                          idx === 1 ? '🥈' :
                          '🥉'
                        }`}></span>
                        <div>
                          <p className="font-semibold text-gray-800">{item.name}</p>
                          <p className="text-xs text-gray-600">{item.hours}</p>
                        </div>
                      </div>
                      <span className="text-green-600 font-bold">{item.minutes} min</span>
                    </div>
                  ))}
                </div>
              )}
            </div>
          </div>
        </div>

        {/* Novo Bloco: Performance Geral */}
        <div className="bg-gradient-to-br from-indigo-500 via-purple-500 to-pink-500 rounded-xl shadow-xl p-6 text-white">
          <h3 className="text-2xl font-bold mb-6 flex items-center gap-2">
            <Target className="w-7 h-7" />
            Performance Geral da Equipe
          </h3>
          
          <div className="grid grid-cols-1 md:grid-cols-3 gap-6">
            {/* Índice de Pontualidade */}
            <div className="bg-white/10 backdrop-blur-sm rounded-lg p-5 transform hover:scale-105 transition-transform">
              <div className="flex items-center justify-between mb-3">
                <Clock className="w-8 h-8" />
                {data.performance.trend > 0 ? (
                  <TrendingUp className="w-5 h-5 text-green-300" />
                ) : data.performance.trend < 0 ? (
                  <TrendingDown className="w-5 h-5 text-red-300" />
                ) : null}
              </div>
              <div className="text-5xl font-bold mb-2">{data.performance.punctuality}%</div>
              <p className="text-sm opacity-90 font-semibold">Índice de Pontualidade</p>
              <p className="text-xs opacity-75 mt-1">
                {data.performance.punctuality >= 90 ? '🎉 Excelente!' :
                 data.performance.punctuality >= 70 ? '✅ Bom' :
                 '⚠️ Precisa melhorar'}
              </p>
              {data.performance.trend !== 0 && (
                <div className="mt-2 text-xs font-semibold">
                  {data.performance.trend > 0 ? '+' : ''}{data.performance.trend}% vs semana passada
                </div>
              )}
            </div>

            {/* Índice de Presença */}
            <div className="bg-white/10 backdrop-blur-sm rounded-lg p-5 transform hover:scale-105 transition-transform">
              <div className="flex items-center justify-between mb-3">
                <Users className="w-8 h-8" />
                {data.performance.trend > 0 ? (
                  <TrendingUp className="w-5 h-5 text-green-300" />
                ) : data.performance.trend < 0 ? (
                  <TrendingDown className="w-5 h-5 text-red-300" />
                ) : null}
              </div>
              <div className="text-5xl font-bold mb-2">{data.performance.attendance}%</div>
              <p className="text-sm opacity-90 font-semibold">Índice de Presença</p>
              <p className="text-xs opacity-75 mt-1">
                {data.performance.attendance === 100 ? '🎉 Todos presentes!' :
                 data.performance.attendance >= 90 ? '✅ Ótimo' :
                 '⚠️ Atenção necessária'}
              </p>
              {data.performance.trend !== 0 && (
                <div className="mt-2 text-xs font-semibold">
                  {data.performance.trend > 0 ? '+' : ''}{data.performance.trend}% vs semana passada
                </div>
              )}
            </div>

            {/* Tendência Geral */}
            <div className="bg-white/10 backdrop-blur-sm rounded-lg p-5 transform hover:scale-105 transition-transform">
              <div className="flex items-center justify-between mb-3">
                <Activity className="w-8 h-8" />
                {data.performance.trend > 0 ? (
                  <TrendingUp className="w-5 h-5 text-green-300" />
                ) : data.performance.trend < 0 ? (
                  <TrendingDown className="w-5 h-5 text-red-300" />
                ) : (
                  <div className="w-5 h-5 text-gray-300">—</div>
                )}
              </div>
              <div className={`text-5xl font-bold mb-2 ${
                data.performance.trend > 0 ? 'text-green-300' :
                data.performance.trend < 0 ? 'text-red-300' :
                'text-white'
              }`}>
                {data.performance.trend > 0 ? '+' : ''}{data.performance.trend}%
              </div>
              <p className="text-sm opacity-90 font-semibold">Tendência vs Semana Anterior</p>
              <p className="text-xs opacity-75 mt-1">
                {data.performance.trend > 5 ? '📈 Crescimento forte' :
                 data.performance.trend > 0 ? '📈 Melhorando' :
                 data.performance.trend === 0 ? '➡️ Estável' :
                 data.performance.trend > -5 ? '📉 Leve queda' :
                 '📉 Queda significativa'}
              </p>
            </div>
          </div>

          {/* Barra de progresso geral */}
          <div className="mt-6 pt-6 border-t border-white/20">
            <div className="flex justify-between items-center mb-2">
              <span className="text-sm font-semibold">Desempenho Médio da Equipe</span>
              <span className="text-2xl font-bold">
                {Math.round((data.performance.punctuality + data.performance.attendance) / 2)}%
              </span>
            </div>
            <div className="w-full bg-white/20 rounded-full h-4 overflow-hidden">
              <div 
                className="bg-white h-full rounded-full transition-all duration-1000 ease-out flex items-center justify-end pr-2"
                style={{ 
                  width: `${Math.round((data.performance.punctuality + data.performance.attendance) / 2)}%` 
                }}
              >
                <span className="text-xs font-bold text-purple-600">
                  {Math.round((data.performance.punctuality + data.performance.attendance) / 2) >= 90 ? '🔥' : ''}
                </span>
              </div>
            </div>
          </div>
        </div>
      </div>

      {/* Modal: Funcionários Presentes/Ausentes */}
      {showPresenceModal && (
        <div className="fixed inset-0 bg-black/50 flex items-center justify-center z-50 p-4" onClick={() => setShowPresenceModal(false)}>
          <div className="bg-white/10 backdrop-blur-xl rounded-2xl p-6 max-w-4xl w-full max-h-[80vh] overflow-auto" onClick={(e) => e.stopPropagation()}>
            <div className="flex justify-between items-center mb-6">
              <h2 className="text-2xl font-bold text-white">Presença de Funcionários</h2>
              <button 
                onClick={() => setShowPresenceModal(false)}
                className="text-white/70 hover:text-white text-2xl"
              >
                ×
              </button>
            </div>
            
            <div className="grid grid-cols-1 md:grid-cols-2 gap-4">
              {((window as any).dashboardEmployees || []).map((emp: any, idx: number) => {
                const isPresent = emp.status !== 'absent' && emp.actual_start;
                return (
                  <div 
                    key={idx}
                    className={`p-4 rounded-lg border-2 ${
                      isPresent 
                        ? 'bg-green-500/20 border-green-400' 
                        : 'bg-red-500/20 border-red-400'
                    }`}
                  >
                    <div className="flex items-center justify-between">
                      <div>
                        <h3 className="font-semibold text-white">{emp.employee_name || emp.employee_id}</h3>
                        <p className="text-sm text-white/70">
                          {isPresent ? (
                            <>Entrada: {emp.actual_start}</>
                          ) : (
                            <>Ausente</>
                          )}
                        </p>
                      </div>
                      <div className={`w-3 h-3 rounded-full ${isPresent ? 'bg-green-400' : 'bg-red-400'}`} />
                    </div>
                  </div>
                );
              })}
            </div>
          </div>
        </div>
      )}

      {/* Modal: Ranking de Horas Trabalhadas */}
      {showHoursRankingModal && (
        <div className="fixed inset-0 bg-black/50 flex items-center justify-center z-50 p-4" onClick={() => setShowHoursRankingModal(false)}>
          <div className="bg-white/10 backdrop-blur-xl rounded-2xl p-6 max-w-4xl w-full max-h-[80vh] overflow-auto" onClick={(e) => e.stopPropagation()}>
            <div className="flex justify-between items-center mb-6">
              <h2 className="text-2xl font-bold text-white">Ranking de Horas Trabalhadas</h2>
              <div className="flex gap-4 items-center">
                <button 
                  onClick={() => setRankingOrder(rankingOrder === 'desc' ? 'asc' : 'desc')}
                  className="px-4 py-2 bg-white/20 hover:bg-white/30 rounded-lg text-white text-sm"
                >
                  {rankingOrder === 'desc' ? '▼ Maior → Menor' : '▲ Menor → Maior'}
                </button>
                <button 
                  onClick={() => setShowHoursRankingModal(false)}
                  className="text-white/70 hover:text-white text-2xl"
                >
                  ×
                </button>
              </div>
            </div>
            
            <div className="space-y-3">
              {((window as any).dashboardEmployees || [])
                .sort((a: any, b: any) => {
                  const hoursA = parseFloat(a.worked_hours || 0);
                  const hoursB = parseFloat(b.worked_hours || 0);
                  return rankingOrder === 'desc' ? hoursB - hoursA : hoursA - hoursB;
                })
                .map((emp: any, idx: number) => {
                  const workedHours = parseFloat(emp.worked_hours || 0);
                  const expectedHours = parseFloat(emp.expected_hours || 0);
                  const percentage = expectedHours > 0 ? (workedHours / expectedHours * 100) : 0;
                  
                  return (
                    <div 
                      key={idx}
                      className="p-4 rounded-lg bg-white/10 border border-white/20"
                    >
                      <div className="flex items-center justify-between mb-2">
                        <div className="flex items-center gap-3">
                          <div className="w-8 h-8 rounded-full bg-gradient-to-br from-purple-400 to-pink-500 flex items-center justify-center text-white font-bold text-sm">
                            {idx + 1}
                          </div>
                          <h3 className="font-semibold text-white">{emp.employee_name || emp.employee_id}</h3>
                        </div>
                        <div className="text-right">
                          <p className="text-lg font-bold text-white">{workedHours.toFixed(1)}h</p>
                          <p className="text-xs text-white/70">Meta: {expectedHours.toFixed(1)}h</p>
                        </div>
                      </div>
                      <div className="w-full bg-white/20 rounded-full h-2 overflow-hidden">
                        <div 
                          className={`h-full rounded-full ${
                            percentage >= 100 ? 'bg-green-400' :
                            percentage >= 80 ? 'bg-yellow-400' :
                            'bg-red-400'
                          }`}
                          style={{ width: `${Math.min(percentage, 100)}%` }}
                        />
                      </div>
                    </div>
                  );
                })}
            </div>
          </div>
        </div>
      )}

      {/* Modal: Saldo Acumulado */}
      {showBalanceModal && (
        <div className="fixed inset-0 bg-black/50 flex items-center justify-center z-50 p-4" onClick={() => setShowBalanceModal(false)}>
          <div className="bg-white/10 backdrop-blur-xl rounded-2xl p-6 max-w-4xl w-full max-h-[80vh] overflow-auto" onClick={(e) => e.stopPropagation()}>
            <div className="flex justify-between items-center mb-6">
              <h2 className="text-2xl font-bold text-white">Saldo Acumulado por Funcionário</h2>
              <button 
                onClick={() => setShowBalanceModal(false)}
                className="text-white/70 hover:text-white text-2xl"
              >
                ×
              </button>
            </div>
            
            <div className="space-y-3">
              {((window as any).dashboardEmployees || [])
                .sort((a: any, b: any) => {
                  const balanceA = parseFloat(a.daily_balance || 0);
                  const balanceB = parseFloat(b.daily_balance || 0);
                  return balanceB - balanceA;
                })
                .map((emp: any, idx: number) => {
                  const balance = parseFloat(emp.daily_balance || 0);
                  const delayMinutes = parseFloat(emp.delay_minutes || 0);
                  const extraMinutes = parseFloat(emp.extra_minutes || 0);
                  
                  return (
                    <div 
                      key={idx}
                      className={`p-4 rounded-lg border-2 ${
                        balance > 0 
                          ? 'bg-green-500/20 border-green-400' 
                          : balance < 0
                          ? 'bg-red-500/20 border-red-400'
                          : 'bg-gray-500/20 border-gray-400'
                      }`}
                    >
                      <div className="flex items-center justify-between">
                        <div>
                          <h3 className="font-semibold text-white">{emp.employee_name || emp.employee_id}</h3>
                          <div className="flex gap-4 text-sm text-white/70 mt-1">
                            {extraMinutes > 0 && (
                              <span className="text-green-400">+{(extraMinutes / 60).toFixed(1)}h extra</span>
                            )}
                            {delayMinutes > 0 && (
                              <span className="text-red-400">-{(delayMinutes / 60).toFixed(1)}h atraso</span>
                            )}
                          </div>
                        </div>
                        <div className="text-right">
                          <p className={`text-2xl font-bold ${
                            balance > 0 ? 'text-green-400' :
                            balance < 0 ? 'text-red-400' :
                            'text-gray-400'
                          }`}>
                            {balance > 0 ? '+' : ''}{balance.toFixed(1)}h
                          </p>
                        </div>
                      </div>
                    </div>
                  );
                })}
            </div>
          </div>
        </div>
      )}
    </PageLayout>
  );
};

export default DashboardPage;
