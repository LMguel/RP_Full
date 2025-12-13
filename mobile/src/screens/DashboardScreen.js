import React, { useState, useEffect } from 'react';
import {
  View,
  Text,
  StyleSheet,
  ScrollView,
  ActivityIndicator,
  RefreshControl,
  TouchableOpacity,
} from 'react-native';
import { LinearGradient } from 'expo-linear-gradient';
import { MaterialCommunityIcons } from '@expo/vector-icons';
import apiService from '../services/api';

const DashboardScreen = ({ navigation }) => {
  const [dashboard, setDashboard] = useState(null);
  const [loading, setLoading] = useState(true);
  const [refreshing, setRefreshing] = useState(false);

  useEffect(() => {
    loadDashboard();
  }, []);

  const loadDashboard = async () => {
    try {
      setLoading(true);
      const data = await apiService.getEmployeeDashboard();
      setDashboard(data);
    } catch (error) {
      console.error('Erro ao carregar dashboard:', error);
      alert('Erro ao carregar dashboard: ' + (error.message || 'Erro desconhecido'));
    } finally {
      setLoading(false);
      setRefreshing(false);
    }
  };

  const onRefresh = () => {
    setRefreshing(true);
    loadDashboard();
  };

  const formatBalance = (balance) => {
    const sign = balance >= 0 ? '+' : '';
    return `${sign}${balance.toFixed(2)}h`;
  };

  const getStatusColor = (status) => {
    switch (status) {
      case 'complete':
        return '#10b981';
      case 'incomplete':
        return '#f59e0b';
      case 'absent':
        return '#ef4444';
      default:
        return '#94a3b8';
    }
  };

  const getStatusText = (status) => {
    switch (status) {
      case 'complete':
        return 'Completo';
      case 'incomplete':
        return 'Incompleto';
      case 'absent':
        return 'Ausente';
      default:
        return status;
    }
  };

  if (loading) {
    return (
      <LinearGradient colors={['#667eea', '#764ba2']} style={styles.container}>
        <View style={styles.loadingContainer}>
          <ActivityIndicator size="large" color="#fff" />
          <Text style={styles.loadingText}>Carregando...</Text>
        </View>
      </LinearGradient>
    );
  }

  return (
    <LinearGradient colors={['#667eea', '#764ba2']} style={styles.container}>
      <ScrollView
        style={styles.scrollView}
        refreshControl={
          <RefreshControl refreshing={refreshing} onRefresh={onRefresh} tintColor="#fff" />
        }
      >
        <View style={styles.header}>
          <Text style={styles.title}>Meu Dashboard</Text>
          <Text style={styles.subtitle}>Acompanhe suas horas</Text>
        </View>

        {/* Botão de Registro de Ponto */}
        <TouchableOpacity
          style={styles.registerButton}
          onPress={() => navigation.navigate('RegistroPontoLocation')}
          activeOpacity={0.8}
        >
          <MaterialCommunityIcons name="map-marker-check" size={24} color="white" />
          <Text style={styles.registerButtonText}>Registrar Ponto por Localização</Text>
        </TouchableOpacity>

        {/* Resumo do Mês Atual */}
        {dashboard?.current_month && (
          <View style={styles.card}>
            <View style={styles.cardHeader}>
              <MaterialCommunityIcons name="calendar-month" size={24} color="#667eea" />
              <Text style={styles.cardTitle}>Mês Atual - {dashboard.current_month.month}</Text>
            </View>

            <View style={styles.statsRow}>
              <View style={styles.statItem}>
                <Text style={styles.statLabel}>Dias Trabalhados</Text>
                <Text style={styles.statValue}>{dashboard.current_month.days_worked || 0}</Text>
              </View>
              <View style={styles.statItem}>
                <Text style={styles.statLabel}>Horas Totais</Text>
                <Text style={styles.statValue}>
                  {(dashboard.current_month.total_hours || 0).toFixed(1)}h
                </Text>
              </View>
            </View>

            <View style={styles.balanceContainer}>
              <Text style={styles.balanceLabel}>Saldo do Mês</Text>
              <Text
                style={[
                  styles.balanceValue,
                  {
                    color:
                      dashboard.current_month.final_balance >= 0 ? '#10b981' : '#ef4444',
                  },
                ]}
              >
                {formatBalance(dashboard.current_month.final_balance || 0)}
              </Text>
            </View>
          </View>
        )}

        {/* Últimos 7 Dias */}
        {dashboard?.last_7_days && dashboard.last_7_days.length > 0 && (
          <View style={styles.card}>
            <View style={styles.cardHeader}>
              <MaterialCommunityIcons name="history" size={24} color="#667eea" />
              <Text style={styles.cardTitle}>Últimos 7 Dias</Text>
            </View>

            {dashboard.last_7_days.map((day, index) => (
              <View key={index} style={styles.dayItem}>
                <View style={styles.dayInfo}>
                  <Text style={styles.dayDate}>
                    {new Date(day.date).toLocaleDateString('pt-BR', {
                      day: '2-digit',
                      month: '2-digit',
                    })}
                  </Text>
                  <View
                    style={[
                      styles.statusBadge,
                      { backgroundColor: getStatusColor(day.status) },
                    ]}
                  >
                    <Text style={styles.statusText}>{getStatusText(day.status)}</Text>
                  </View>
                </View>

                <View style={styles.dayStats}>
                  <View style={styles.dayStatItem}>
                    <Text style={styles.dayStatLabel}>Trabalhadas</Text>
                    <Text style={styles.dayStatValue}>
                      {(day.worked_hours || 0).toFixed(1)}h
                    </Text>
                  </View>
                  <View style={styles.dayStatItem}>
                    <Text style={styles.dayStatLabel}>Saldo</Text>
                    <Text
                      style={[
                        styles.dayStatValue,
                        { color: day.balance >= 0 ? '#10b981' : '#ef4444' },
                      ]}
                    >
                      {formatBalance(day.balance || 0)}
                    </Text>
                  </View>
                </View>
              </View>
            ))}
          </View>
        )}

        {/* Botão para Registrar Ponto */}
        <TouchableOpacity
          style={styles.registerButton}
          onPress={() => navigation.navigate('CameraRegistro')}
        >
          <MaterialCommunityIcons name="camera" size={24} color="#fff" />
          <Text style={styles.registerButtonText}>Registrar Ponto</Text>
        </TouchableOpacity>
      </ScrollView>
    </LinearGradient>
  );
};

const styles = StyleSheet.create({
  container: {
    flex: 1,
  },
  scrollView: {
    flex: 1,
  },
  loadingContainer: {
    flex: 1,
    justifyContent: 'center',
    alignItems: 'center',
  },
  loadingText: {
    color: '#fff',
    marginTop: 16,
    fontSize: 16,
  },
  header: {
    paddingHorizontal: 20,
    paddingTop: 60,
    paddingBottom: 30,
  },
  title: {
    fontSize: 32,
    fontWeight: 'bold',
    color: '#fff',
    marginBottom: 8,
  },
  subtitle: {
    fontSize: 16,
    color: 'rgba(255, 255, 255, 0.8)',
  },
  card: {
    backgroundColor: 'rgba(255, 255, 255, 0.95)',
    borderRadius: 16,
    marginHorizontal: 20,
    marginBottom: 20,
    padding: 20,
    shadowColor: '#000',
    shadowOffset: { width: 0, height: 4 },
    shadowOpacity: 0.1,
    shadowRadius: 8,
    elevation: 4,
  },
  cardHeader: {
    flexDirection: 'row',
    alignItems: 'center',
    marginBottom: 20,
  },
  cardTitle: {
    fontSize: 18,
    fontWeight: 'bold',
    color: '#1f2937',
    marginLeft: 12,
  },
  statsRow: {
    flexDirection: 'row',
    justifyContent: 'space-around',
    marginBottom: 20,
  },
  statItem: {
    alignItems: 'center',
  },
  statLabel: {
    fontSize: 14,
    color: '#6b7280',
    marginBottom: 8,
  },
  statValue: {
    fontSize: 24,
    fontWeight: 'bold',
    color: '#1f2937',
  },
  balanceContainer: {
    backgroundColor: '#f3f4f6',
    borderRadius: 12,
    padding: 16,
    alignItems: 'center',
  },
  balanceLabel: {
    fontSize: 14,
    color: '#6b7280',
    marginBottom: 8,
  },
  balanceValue: {
    fontSize: 32,
    fontWeight: 'bold',
  },
  dayItem: {
    borderBottomWidth: 1,
    borderBottomColor: '#e5e7eb',
    paddingVertical: 16,
  },
  dayInfo: {
    flexDirection: 'row',
    justifyContent: 'space-between',
    alignItems: 'center',
    marginBottom: 12,
  },
  dayDate: {
    fontSize: 16,
    fontWeight: '600',
    color: '#1f2937',
  },
  statusBadge: {
    paddingHorizontal: 12,
    paddingVertical: 4,
    borderRadius: 12,
  },
  statusText: {
    color: '#fff',
    fontSize: 12,
    fontWeight: '600',
  },
  dayStats: {
    flexDirection: 'row',
    justifyContent: 'space-around',
  },
  dayStatItem: {
    alignItems: 'center',
  },
  dayStatLabel: {
    fontSize: 12,
    color: '#6b7280',
    marginBottom: 4,
  },
  dayStatValue: {
    fontSize: 16,
    fontWeight: 'bold',
    color: '#1f2937',
  },
  registerButton: {
    backgroundColor: 'rgba(255, 255, 255, 0.2)',
    flexDirection: 'row',
    alignItems: 'center',
    justifyContent: 'center',
    marginHorizontal: 20,
    marginBottom: 40,
    padding: 16,
    borderRadius: 12,
    borderWidth: 2,
    borderColor: 'rgba(255, 255, 255, 0.3)',
  },
  registerButtonText: {
    color: '#fff',
    fontSize: 18,
    fontWeight: 'bold',
    marginLeft: 12,
  },
});

export default DashboardScreen;
