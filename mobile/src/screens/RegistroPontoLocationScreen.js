import React, { useState, useEffect } from 'react';
import {
  View,
  Text,
  StyleSheet,
  TouchableOpacity,
  ActivityIndicator,
  Alert,
  Platform,
} from 'react-native';
import { LinearGradient } from 'expo-linear-gradient';
import { Ionicons } from '@expo/vector-icons';
import * as Location from 'expo-location';
import { useAuth } from '../contexts/AuthContext';
import ApiService from '../services/api';

export default function RegistroPontoLocationScreen({ navigation }) {
  const { user } = useAuth();
  const [loading, setLoading] = useState(false);
  const [location, setLocation] = useState(null);
  const [locationPermission, setLocationPermission] = useState(null);
  const [loadingLocation, setLoadingLocation] = useState(false);

  useEffect(() => {
    requestLocationPermission();
  }, []);

  const requestLocationPermission = async () => {
    try {
      const { status } = await Location.requestForegroundPermissionsAsync();
      setLocationPermission(status === 'granted');
      
      if (status !== 'granted') {
        Alert.alert(
          'Permissão Negada',
          'Para registrar ponto por localização, é necessário permitir o acesso à sua localização.',
          [
            { text: 'Voltar', onPress: () => navigation.goBack() },
            { text: 'Tentar Novamente', onPress: requestLocationPermission }
          ]
        );
      }
    } catch (error) {
      console.error('Erro ao solicitar permissão:', error);
      Alert.alert('Erro', 'Não foi possível solicitar permissão de localização');
    }
  };

  const getCurrentLocation = async () => {
    setLoadingLocation(true);
    try {
      const location = await Location.getCurrentPositionAsync({
        accuracy: Location.Accuracy.High,
      });
      
      setLocation(location.coords);
      console.log('[LOCATION] Localização obtida:', location.coords);
      return location.coords;
    } catch (error) {
      console.error('[LOCATION] Erro ao obter localização:', error);
      Alert.alert('Erro', 'Não foi possível obter sua localização. Verifique se o GPS está ativado.');
      return null;
    } finally {
      setLoadingLocation(false);
    }
  };

  const registrarPonto = async (tipo) => {
    if (!locationPermission) {
      Alert.alert('Erro', 'Permissão de localização não concedida');
      return;
    }

    setLoading(true);

    try {
      // Obter localização atual
      console.log('[PONTO] Obtendo localização...');
      const coords = await getCurrentLocation();
      
      if (!coords) {
        setLoading(false);
        return;
      }

      console.log('[PONTO] Registrando ponto tipo:', tipo);
      console.log('[PONTO] Coordenadas:', coords);

      // Registrar ponto
      const response = await ApiService.registerPointByLocation(
        coords.latitude,
        coords.longitude,
        tipo
      );

      console.log('[PONTO] Resposta:', response);

      if (response.success) {
        const distanceInfo = response.distance ? `\nDistância: ${response.distance}` : '';
        
        Alert.alert(
          'Sucesso!',
          `Ponto de ${tipo} registrado com sucesso!${distanceInfo}`,
          [
            {
              text: 'OK',
              onPress: () => navigation.goBack()
            }
          ]
        );
      } else {
        throw new Error(response.error || 'Erro ao registrar ponto');
      }
    } catch (error) {
      console.error('[PONTO] Erro:', error);
      
      let errorMessage = 'Erro ao registrar ponto';
      
      if (error.error) {
        errorMessage = error.error;
      } else if (error.message) {
        errorMessage = error.message;
      }
      
      Alert.alert('Erro', errorMessage);
    } finally {
      setLoading(false);
    }
  };

  return (
    <LinearGradient
      colors={['#1e3a8a', '#1e40af', '#1d4ed8']}
      style={styles.container}
    >
      <View style={styles.header}>
        <TouchableOpacity
          style={styles.backButton}
          onPress={() => navigation.goBack()}
          activeOpacity={0.7}
        >
          <Ionicons name="arrow-back" size={24} color="white" />
        </TouchableOpacity>
        <Text style={styles.headerTitle}>Registrar Ponto</Text>
      </View>

      <View style={styles.content}>
        {/* Card de Informações */}
        <View style={styles.infoCard}>
          <Ionicons name="information-circle" size={48} color="#3b82f6" />
          <Text style={styles.infoTitle}>Registro por Localização</Text>
          <Text style={styles.infoText}>
            Seu ponto será registrado usando sua localização atual.
            {'\n\n'}
            Certifique-se de estar dentro da área permitida pela empresa.
          </Text>
        </View>

        {/* Status da Localização */}
        {locationPermission === false && (
          <View style={[styles.statusCard, { backgroundColor: 'rgba(239, 68, 68, 0.1)' }]}>
            <Ionicons name="alert-circle" size={24} color="#ef4444" />
            <Text style={[styles.statusText, { color: '#ef4444' }]}>
              Permissão de localização negada
            </Text>
            <TouchableOpacity
              style={[styles.permissionButton]}
              onPress={requestLocationPermission}
            >
              <Text style={styles.permissionButtonText}>Solicitar Permissão</Text>
            </TouchableOpacity>
          </View>
        )}

        {locationPermission === true && (
          <View style={[styles.statusCard, { backgroundColor: 'rgba(16, 185, 129, 0.1)' }]}>
            <Ionicons name="checkmark-circle" size={24} color="#10b981" />
            <Text style={[styles.statusText, { color: '#10b981' }]}>
              GPS ativado e pronto
            </Text>
          </View>
        )}

        {loadingLocation && (
          <View style={styles.loadingCard}>
            <ActivityIndicator size="small" color="#3b82f6" />
            <Text style={styles.loadingText}>Obtendo localização...</Text>
          </View>
        )}

        {location && (
          <View style={styles.coordsCard}>
            <Text style={styles.coordsTitle}>Localização Atual:</Text>
            <Text style={styles.coordsText}>
              Lat: {location.latitude.toFixed(6)}
            </Text>
            <Text style={styles.coordsText}>
              Lng: {location.longitude.toFixed(6)}
            </Text>
          </View>
        )}

        {/* Botões de Registro */}
        <View style={styles.buttonsContainer}>
          <TouchableOpacity
            style={[
              styles.registerButton,
              styles.entradaButton,
              (loading || !locationPermission) && styles.disabledButton
            ]}
            onPress={() => registrarPonto('entrada')}
            disabled={loading || !locationPermission}
            activeOpacity={0.8}
          >
            {loading ? (
              <ActivityIndicator color="#fff" />
            ) : (
              <>
                <Ionicons name="log-in-outline" size={32} color="white" />
                <Text style={styles.buttonText}>Registrar Entrada</Text>
              </>
            )}
          </TouchableOpacity>

          <TouchableOpacity
            style={[
              styles.registerButton,
              styles.saidaButton,
              (loading || !locationPermission) && styles.disabledButton
            ]}
            onPress={() => registrarPonto('saida')}
            disabled={loading || !locationPermission}
            activeOpacity={0.8}
          >
            {loading ? (
              <ActivityIndicator color="#fff" />
            ) : (
              <>
                <Ionicons name="log-out-outline" size={32} color="white" />
                <Text style={styles.buttonText}>Registrar Saída</Text>
              </>
            )}
          </TouchableOpacity>
        </View>

        <Text style={styles.disclaimer}>
          * A validação da localização será feita automaticamente pelo sistema
        </Text>
      </View>
    </LinearGradient>
  );
}

const styles = StyleSheet.create({
  container: {
    flex: 1,
  },
  header: {
    flexDirection: 'row',
    alignItems: 'center',
    paddingTop: Platform.OS === 'ios' ? 50 : 40,
    paddingHorizontal: 20,
    paddingBottom: 20,
  },
  backButton: {
    width: 40,
    height: 40,
    borderRadius: 20,
    backgroundColor: 'rgba(255, 255, 255, 0.1)',
    justifyContent: 'center',
    alignItems: 'center',
  },
  headerTitle: {
    flex: 1,
    fontSize: 20,
    fontWeight: '700',
    color: 'white',
    textAlign: 'center',
    marginRight: 40,
  },
  content: {
    flex: 1,
    paddingHorizontal: 20,
  },
  infoCard: {
    backgroundColor: 'rgba(255, 255, 255, 0.08)',
    borderRadius: 16,
    padding: 24,
    alignItems: 'center',
    marginBottom: 20,
    borderWidth: 1,
    borderColor: 'rgba(255, 255, 255, 0.1)',
  },
  infoTitle: {
    fontSize: 20,
    fontWeight: '700',
    color: 'white',
    marginTop: 12,
    marginBottom: 8,
  },
  infoText: {
    fontSize: 14,
    color: 'rgba(255, 255, 255, 0.7)',
    textAlign: 'center',
    lineHeight: 20,
  },
  statusCard: {
    flexDirection: 'row',
    alignItems: 'center',
    padding: 16,
    borderRadius: 12,
    marginBottom: 16,
  },
  statusText: {
    flex: 1,
    fontSize: 14,
    fontWeight: '600',
    marginLeft: 12,
  },
  permissionButton: {
    backgroundColor: 'rgba(239, 68, 68, 0.2)',
    paddingHorizontal: 16,
    paddingVertical: 8,
    borderRadius: 8,
    marginLeft: 8,
  },
  permissionButtonText: {
    color: '#ef4444',
    fontSize: 12,
    fontWeight: '600',
  },
  loadingCard: {
    flexDirection: 'row',
    alignItems: 'center',
    justifyContent: 'center',
    padding: 16,
    borderRadius: 12,
    backgroundColor: 'rgba(59, 130, 246, 0.1)',
    marginBottom: 16,
  },
  loadingText: {
    color: '#3b82f6',
    fontSize: 14,
    fontWeight: '600',
    marginLeft: 12,
  },
  coordsCard: {
    backgroundColor: 'rgba(255, 255, 255, 0.05)',
    borderRadius: 12,
    padding: 16,
    marginBottom: 20,
  },
  coordsTitle: {
    fontSize: 14,
    fontWeight: '600',
    color: 'rgba(255, 255, 255, 0.9)',
    marginBottom: 8,
  },
  coordsText: {
    fontSize: 13,
    color: 'rgba(255, 255, 255, 0.7)',
    fontFamily: Platform.OS === 'ios' ? 'Courier' : 'monospace',
  },
  buttonsContainer: {
    gap: 16,
    marginTop: 20,
  },
  registerButton: {
    flexDirection: 'row',
    alignItems: 'center',
    justifyContent: 'center',
    padding: 20,
    borderRadius: 16,
    gap: 12,
    shadowColor: '#000',
    shadowOffset: { width: 0, height: 4 },
    shadowOpacity: 0.3,
    shadowRadius: 8,
    elevation: 5,
  },
  entradaButton: {
    backgroundColor: '#10b981',
  },
  saidaButton: {
    backgroundColor: '#ef4444',
  },
  disabledButton: {
    opacity: 0.5,
  },
  buttonText: {
    fontSize: 18,
    fontWeight: '700',
    color: 'white',
  },
  disclaimer: {
    fontSize: 12,
    color: 'rgba(255, 255, 255, 0.5)',
    textAlign: 'center',
    marginTop: 20,
    fontStyle: 'italic',
  },
});
