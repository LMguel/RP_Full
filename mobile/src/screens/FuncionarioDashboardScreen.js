import React, { useState, useEffect } from 'react';
import {
  View,
  Text,
  TouchableOpacity,
  StyleSheet,
  ScrollView,
  RefreshControl,
  ActivityIndicator,
} from 'react-native';
import { LinearGradient } from 'expo-linear-gradient';
import { MaterialCommunityIcons, Ionicons } from '@expo/vector-icons';
import { useAuth } from '../contexts/AuthContext';
import ApiService from '../services/api';

export default function FuncionarioDashboardScreen({ navigation }) {
  const { user, signOut } = useAuth();
  const [registros, setRegistros] = useState([]);
  const [loading, setLoading] = useState(true);
  const [refreshing, setRefreshing] = useState(false);

  useEffect(() => {
    loadRegistros();
  }, []);

  const loadRegistros = async () => {
    try {
      setLoading(true);
      const response = await ApiService.getMeusRegistros();
      setRegistros(response.registros || []);
    } catch (error) {
      console.error('[DASHBOARD] Erro ao carregar registros:', error);
    } finally {
      setLoading(false);
      setRefreshing(false);
    }
  };

  const onRefresh = () => {
    setRefreshing(true);
    loadRegistros();
  };

  const formatDateTime = (dateTimeStr) => {
    if (!dateTimeStr) return '';
    
    // Formato esperado: "2025-12-08 14:30:00" ou "funcionario_id#2025-12-08 14:30:00"
    let dateTime = dateTimeStr;
    if (dateTime.includes('#')) {
      dateTime = dateTime.split('#')[1];
    }
    
    const [datePart, timePart] = dateTime.split(' ');
    const [year, month, day] = datePart.split('-');
    const [hour, minute] = timePart.split(':');
    
    return {
      date: `${day}/${month}/${year}`,
      time: `${hour}:${minute}`,
    };
  };

  const renderRegistro = (registro, index) => {
    const dateTime = formatDateTime(registro['employee_id#date_time'] || registro.data_hora);
    const tipo = registro.tipo || 'entrada';
    const method = registro.method || 'CAMERA';
    
    return (
      <View key={index} style={styles.registroCard}>
        <View style={styles.registroHeader}>
          <View style={styles.registroTipo}>
            <MaterialCommunityIcons
              name={tipo === 'entrada' ? 'login' : 'logout'}
              size={24}
              color={tipo === 'entrada' ? '#10b981' : '#f59e0b'}
            />
            <Text style={styles.registroTipoText}>
              {tipo === 'entrada' ? 'Entrada' : 'Saída'}
            </Text>
          </View>
          
          <View style={styles.registroMetodo}>
            <MaterialCommunityIcons
              name={method === 'LOCATION' ? 'map-marker-check' : 'camera'}
              size={16}
              color="rgba(255, 255, 255, 0.6)"
            />
          </View>
        </View>
        
        <View style={styles.registroInfo}>
          <View style={styles.registroInfoItem}>
            <Ionicons name="calendar-outline" size={16} color="rgba(255, 255, 255, 0.6)" />
            <Text style={styles.registroInfoText}>{dateTime.date}</Text>
          </View>
          
          <View style={styles.registroInfoItem}>
            <Ionicons name="time-outline" size={16} color="rgba(255, 255, 255, 0.6)" />
            <Text style={styles.registroInfoText}>{dateTime.time}</Text>
          </View>
        </View>

        {registro.distance_from_company && (
          <View style={styles.registroDistancia}>
            <MaterialCommunityIcons name="map-marker-distance" size={14} color="rgba(255, 255, 255, 0.5)" />
            <Text style={styles.registroDistanciaText}>
              {registro.distance_from_company < 1000 
                ? `${Math.round(registro.distance_from_company)}m` 
                : `${(registro.distance_from_company / 1000).toFixed(1)}km`}
            </Text>
          </View>
        )}
      </View>
    );
  };

  return (
    <LinearGradient colors={['#0f172a', '#1e293b', '#334155']} style={styles.container}>
      {/* Header */}
      <View style={styles.header}>
        <View>
          <Text style={styles.headerTitle}>Olá, {user?.nome?.split(' ')[0] || 'Funcionário'}!</Text>
          <Text style={styles.headerSubtitle}>{user?.cargo || 'Colaborador'}</Text>
        </View>
        
        <TouchableOpacity onPress={signOut} style={styles.logoutButton}>
          <Ionicons name="log-out-outline" size={24} color="#fff" />
        </TouchableOpacity>
      </View>

      <ScrollView
        style={styles.content}
        refreshControl={
          <RefreshControl refreshing={refreshing} onRefresh={onRefresh} tintColor="#fff" />
        }
      >
        {/* Botão Registrar Ponto */}
        <TouchableOpacity
          style={styles.registerButton}
          onPress={() => navigation.navigate('RegistroPontoLocation')}
          activeOpacity={0.8}
        >
          <LinearGradient
            colors={['#3b82f6', '#2563eb', '#1d4ed8']}
            style={styles.registerButtonGradient}
            start={{ x: 0, y: 0 }}
            end={{ x: 1, y: 1 }}
          >
            <MaterialCommunityIcons name="map-marker-check" size={32} color="#fff" />
            <Text style={styles.registerButtonText}>Registrar Ponto</Text>
            <Text style={styles.registerButtonSubtext}>Clique para registrar sua presença</Text>
          </LinearGradient>
        </TouchableOpacity>

        {/* Histórico */}
        <View style={styles.historicoSection}>
          <View style={styles.historicoHeader}>
            <View style={styles.historicoHeaderLeft}>
              <MaterialCommunityIcons name="history" size={24} color="#3b82f6" />
              <Text style={styles.historicoTitle}>Últimos Registros</Text>
            </View>
            
            <TouchableOpacity 
              onPress={loadRegistros} 
              style={styles.refreshButton}
              disabled={loading}
            >
              <MaterialCommunityIcons 
                name="refresh" 
                size={22} 
                color={loading ? "rgba(255, 255, 255, 0.4)" : "#3b82f6"} 
              />
            </TouchableOpacity>
          </View>

          {loading ? (
            <ActivityIndicator size="large" color="#3b82f6" style={{ marginTop: 20 }} />
          ) : registros.length === 0 ? (
            <View style={styles.emptyState}>
              <MaterialCommunityIcons name="clipboard-text-outline" size={48} color="rgba(255, 255, 255, 0.3)" />
              <Text style={styles.emptyStateText}>Nenhum registro encontrado</Text>
            </View>
          ) : (
            <View style={styles.registrosList}>
              {registros.slice(0, 10).map((registro, index) => renderRegistro(registro, index))}
            </View>
          )}
        </View>
      </ScrollView>
    </LinearGradient>
  );
}

const styles = StyleSheet.create({
  container: {
    flex: 1,
  },
  header: {
    flexDirection: 'row',
    justifyContent: 'space-between',
    alignItems: 'center',
    paddingTop: 50,
    paddingHorizontal: 20,
    paddingBottom: 20,
  },
  headerTitle: {
    fontSize: 24,
    fontWeight: 'bold',
    color: '#fff',
  },
  headerSubtitle: {
    fontSize: 14,
    color: 'rgba(255, 255, 255, 0.7)',
    marginTop: 4,
  },
  logoutButton: {
    padding: 8,
  },
  content: {
    flex: 1,
    paddingHorizontal: 20,
  },
  registerButton: {
    marginTop: 10,
    marginBottom: 30,
    borderRadius: 16,
    overflow: 'hidden',
    elevation: 8,
    shadowColor: '#3b82f6',
    shadowOffset: { width: 0, height: 4 },
    shadowOpacity: 0.3,
    shadowRadius: 8,
  },
  registerButtonGradient: {
    padding: 24,
    alignItems: 'center',
    justifyContent: 'center',
  },
  registerButtonText: {
    color: '#fff',
    fontSize: 22,
    fontWeight: 'bold',
    marginTop: 12,
  },
  registerButtonSubtext: {
    color: 'rgba(255, 255, 255, 0.8)',
    fontSize: 14,
    marginTop: 4,
  },
  historicoSection: {
    marginBottom: 30,
  },
  historicoHeader: {
    flexDirection: 'row',
    alignItems: 'center',
    justifyContent: 'space-between',
    marginBottom: 16,
  },
  historicoHeaderLeft: {
    flexDirection: 'row',
    alignItems: 'center',
  },
  historicoTitle: {
    fontSize: 20,
    fontWeight: '600',
    color: '#fff',
    marginLeft: 8,
  },
  refreshButton: {
    backgroundColor: 'rgba(59, 130, 246, 0.15)',
    padding: 10,
    borderRadius: 10,
    borderWidth: 1,
    borderColor: 'rgba(59, 130, 246, 0.3)',
  },
  registrosList: {
    gap: 12,
  },
  registroCard: {
    backgroundColor: 'rgba(255, 255, 255, 0.08)',
    borderRadius: 12,
    padding: 16,
    marginBottom: 12,
    borderWidth: 1,
    borderColor: 'rgba(255, 255, 255, 0.1)',
  },
  registroHeader: {
    flexDirection: 'row',
    justifyContent: 'space-between',
    alignItems: 'center',
    marginBottom: 12,
  },
  registroTipo: {
    flexDirection: 'row',
    alignItems: 'center',
  },
  registroTipoText: {
    color: '#fff',
    fontSize: 16,
    fontWeight: '600',
    marginLeft: 8,
  },
  registroMetodo: {
    backgroundColor: 'rgba(255, 255, 255, 0.1)',
    borderRadius: 8,
    padding: 6,
  },
  registroInfo: {
    flexDirection: 'row',
    gap: 20,
  },
  registroInfoItem: {
    flexDirection: 'row',
    alignItems: 'center',
    gap: 6,
  },
  registroInfoText: {
    color: 'rgba(255, 255, 255, 0.8)',
    fontSize: 14,
  },
  registroDistancia: {
    flexDirection: 'row',
    alignItems: 'center',
    marginTop: 8,
    gap: 4,
  },
  registroDistanciaText: {
    color: 'rgba(255, 255, 255, 0.5)',
    fontSize: 12,
  },
  emptyState: {
    alignItems: 'center',
    justifyContent: 'center',
    paddingVertical: 40,
  },
  emptyStateText: {
    color: 'rgba(255, 255, 255, 0.5)',
    fontSize: 16,
    marginTop: 12,
  },
});
