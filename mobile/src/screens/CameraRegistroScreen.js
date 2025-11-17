import React, { useState, useRef, useEffect } from 'react';
import {
  View,
  Text,
  TouchableOpacity,
  StyleSheet,
  Alert,
  ActivityIndicator,
  Dimensions,
  Image,
} from 'react-native';
import { CameraView, useCameraPermissions } from 'expo-camera';
import { Ionicons } from '@expo/vector-icons';
import * as Animatable from 'react-native-animatable';
import ApiService from '../services/api';
import { useAuth } from '../contexts/AuthContext';

const { width, height } = Dimensions.get('window');

export default function CameraRegistroScreen({ navigation }) {
  const [permission, requestPermission] = useCameraPermissions();
  const [loading, setLoading] = useState(false);
  const [capturedPhoto, setCapturedPhoto] = useState(null);
  const [recognizedPerson, setRecognizedPerson] = useState(null);
  const cameraRef = useRef(null);
  const { userType, user, signOut } = useAuth();

  // Monitor loading state changes
  useEffect(() => {
    console.log('[STATE] Loading mudou para:', loading);
  }, [loading]);

  // Monitor captured photo changes
  useEffect(() => {
    console.log('[STATE] CapturedPhoto mudou:', capturedPhoto ? 'existe' : 'null');
  }, [capturedPhoto]);

  // Monitor recognized person changes
  useEffect(() => {
    console.log('[STATE] RecognizedPerson mudou:', recognizedPerson ? JSON.stringify(recognizedPerson) : 'null');
  }, [recognizedPerson]);

  useEffect(() => {
    if (!permission) {
      requestPermission();
    }
  }, []);

  if (!permission) {
    return <View style={styles.container}><ActivityIndicator size="large" /></View>;
  }

  if (!permission.granted) {
    return (
      <View style={styles.container}>
        <Text style={styles.message}>Precisamos de permissão para usar a câmera</Text>
        <TouchableOpacity style={styles.button} onPress={requestPermission}>
          <Text style={styles.buttonText}>Conceder Permissão</Text>
        </TouchableOpacity>
      </View>
    );
  }

  async function handleCapture() {
    if (loading || !cameraRef.current) return;

    try {
      console.log('[CAPTURE] ========== INÍCIO ==========');
      setLoading(true);
      console.log('[CAPTURE] Loading setado para TRUE');

      // Capturar foto
      const photo = await cameraRef.current.takePictureAsync({
        quality: 0.8,
        base64: false,
      });

      console.log('[CAPTURE] Foto capturada:', photo.uri);

      // Enviar para reconhecimento (modo preview)
      console.log('[CAPTURE] Chamando API em modo preview...');
      const response = await ApiService.registerFaceTime(photo.uri, true);
      console.log('[CAPTURE] Resposta recebida:', JSON.stringify(response));

      if (response.success) {
        console.log('[CAPTURE] ✅ Reconhecimento bem-sucedido!');
        setCapturedPhoto(photo.uri);
        setRecognizedPerson({
          nome: response.funcionario_nome || response.nome || 'Desconhecido',
          tipo: response.tipo_registro || 'entrada',
          horario: new Date().toLocaleTimeString('pt-BR', { 
            hour: '2-digit', 
            minute: '2-digit' 
          }),
        });
        
        // CRÍTICO: Desligar loading após reconhecimento bem-sucedido!
        console.log('[CAPTURE] Desligando loading após sucesso...');
        setLoading(false);
        console.log('[CAPTURE] Loading setado para FALSE');
      } else {
        console.log('[CAPTURE] ❌ Falha no reconhecimento');
        Alert.alert('Erro', response.message || 'Não foi possível reconhecer a pessoa');
        setLoading(false);
        console.log('[CAPTURE] Loading setado para FALSE (erro)');
      }
      
      console.log('[CAPTURE] ========== FIM ==========');
    } catch (error) {
      console.error('[CAPTURE] ========== EXCEPTION ==========');
      console.error('[CAPTURE] Erro ao capturar:', error);
      Alert.alert('Erro', error.message || 'Erro ao processar foto');
      setLoading(false);
      console.error('[CAPTURE] Loading setado para FALSE (exception)');
      console.error('[CAPTURE] ========== FIM EXCEPTION ==========');
    }
  }

  async function handleConfirm() {
    try {
      console.log('[CONFIRM] ========== INÍCIO ==========');
      console.log('[CONFIRM] Loading atual:', loading);
      
      setLoading(true);
      console.log('[CONFIRM] Loading setado para TRUE');
      console.log('[CONFIRM] Foto URI:', capturedPhoto);
      console.log('[CONFIRM] Pessoa reconhecida:', JSON.stringify(recognizedPerson));
      
      console.log('[CONFIRM] Chamando API registerFaceTime...');
      const response = await ApiService.registerFaceTime(capturedPhoto, false);
      console.log('[CONFIRM] ========== RESPOSTA RECEBIDA ==========');
      console.log('[CONFIRM] Resposta completa:', JSON.stringify(response, null, 2));
      console.log('[CONFIRM] Type of response:', typeof response);
      console.log('[CONFIRM] response.success:', response?.success);

      console.log('[CONFIRM] Desligando loading...');
      setLoading(false);
      console.log('[CONFIRM] Loading setado para FALSE');

      if (response && response.success) {
        console.log('[CONFIRM] ✅ Caminho de SUCESSO');
        
        // Armazenar dados antes de limpar
        const pessoa = recognizedPerson;
        console.log('[CONFIRM] Pessoa armazenada:', pessoa);
        
        // Resetar estado
        console.log('[CONFIRM] Limpando estados...');
        setCapturedPhoto(null);
        setRecognizedPerson(null);
        console.log('[CONFIRM] Estados limpos!');
        
        console.log('[CONFIRM] Mostrando Alert de sucesso...');
        Alert.alert(
          '✅ Ponto Registrado!',
          `${pessoa.nome}\nTipo: ${pessoa.tipo}\nHorário: ${pessoa.horario}`,
          [{ text: 'OK', onPress: () => console.log('[CONFIRM] Alert OK pressionado') }]
        );
      } else {
        console.log('[CONFIRM] ❌ Caminho de FALHA');
        console.log('[CONFIRM] Mensagem de erro:', response?.message);
        
        // Resetar estado
        console.log('[CONFIRM] Limpando estados...');
        setCapturedPhoto(null);
        setRecognizedPerson(null);
        console.log('[CONFIRM] Estados limpos!');
        
        console.log('[CONFIRM] Mostrando Alert de erro...');
        Alert.alert(
          '❌ Erro', 
          response?.message || 'Não foi possível registrar o ponto',
          [{ text: 'OK', onPress: () => console.log('[CONFIRM] Alert OK pressionado') }]
        );
      }
      
      console.log('[CONFIRM] ========== FIM ==========');
    } catch (error) {
      console.error('[CONFIRM] ========== EXCEPTION ==========');
      console.error('[CONFIRM] Erro capturado:', error);
      console.error('[CONFIRM] Type of error:', typeof error);
      console.error('[CONFIRM] Error.message:', error?.message);
      console.error('[CONFIRM] Error.error:', error?.error);
      
      console.log('[CONFIRM] Desligando loading no catch...');
      setLoading(false);
      console.log('[CONFIRM] Loading setado para FALSE no catch');
      
      // Resetar estado
      console.log('[CONFIRM] Limpando estados no catch...');
      setCapturedPhoto(null);
      setRecognizedPerson(null);
      console.log('[CONFIRM] Estados limpos no catch!');
      
      console.log('[CONFIRM] Mostrando Alert de exception...');
      Alert.alert(
        '❌ Erro', 
        error?.message || error?.error || 'Erro ao registrar ponto',
        [{ text: 'OK', onPress: () => console.log('[CONFIRM] Alert OK pressionado (catch)') }]
      );
      
      console.error('[CONFIRM] ========== FIM EXCEPTION ==========');
    }
  }

  function handleRetake() {
    setCapturedPhoto(null);
    setRecognizedPerson(null);
    setLoading(false);
  }

  // Se está mostrando confirmação
  if (capturedPhoto && recognizedPerson) {
    return (
      <View style={styles.container}>
        {/* Foto capturada como fundo */}
        <Image source={{ uri: capturedPhoto }} style={styles.previewImage} />

        {/* Overlay escuro */}
        <View style={styles.overlay} />

        {/* Card de confirmação */}
        <Animatable.View animation="bounceIn" style={styles.confirmCard}>
          <Ionicons 
            name="checkmark-circle" 
            size={60} 
            color="#4CAF50" 
            style={styles.checkIcon}
          />
          
          <Text style={styles.confirmTitle}>Pessoa Reconhecida</Text>
          
          <View style={styles.infoContainer}>
            <Text style={styles.infoLabel}>Nome:</Text>
            <Text style={styles.infoValue}>{recognizedPerson.nome}</Text>
          </View>

          <View style={styles.infoContainer}>
            <Text style={styles.infoLabel}>Tipo:</Text>
            <Text style={styles.infoValue}>
              {recognizedPerson.tipo === 'entrada' ? 'Entrada' : 'Saída'}
            </Text>
          </View>

          <View style={styles.infoContainer}>
            <Text style={styles.infoLabel}>Horário:</Text>
            <Text style={styles.infoValue}>{recognizedPerson.horario}</Text>
          </View>

          {/* Botões */}
          <View style={styles.confirmButtons}>
            <TouchableOpacity
              style={[styles.confirmButton, styles.retakeButton]}
              onPress={handleRetake}
              disabled={loading}
            >
              <Ionicons name="camera-outline" size={24} color="#fff" />
              <Text style={styles.confirmButtonText}>Recapturar</Text>
            </TouchableOpacity>

            <TouchableOpacity
              style={[
                styles.confirmButton, 
                styles.saveButton,
                loading && { opacity: 0.6, backgroundColor: '#666' }
              ]}
              onPress={() => {
                console.log('[BUTTON] ========== BOTÃO PRESSIONADO ==========');
                console.log('[BUTTON] Loading atual:', loading);
                console.log('[BUTTON] Disabled:', loading);
                console.log('[BUTTON] Chamando handleConfirm...');
                handleConfirm();
                console.log('[BUTTON] handleConfirm chamado!');
              }}
              disabled={loading}
            >
              {loading ? (
                <View style={{ flexDirection: 'row', alignItems: 'center' }}>
                  <ActivityIndicator color="#fff" size="small" style={{ marginRight: 8 }} />
                  <Text style={[styles.confirmButtonText, { fontSize: 12 }]}>
                    Processando...
                  </Text>
                </View>
              ) : (
                <>
                  <Ionicons name="checkmark-outline" size={24} color="#fff" />
                  <Text style={styles.confirmButtonText}>Confirmar</Text>
                </>
              )}
            </TouchableOpacity>
          </View>
        </Animatable.View>
      </View>
    );
  }

  // Tela de câmera
  return (
    <View style={styles.container}>
      <CameraView style={styles.camera} ref={cameraRef} facing="front" />
      
      {/* Header - Positioned absolutely */}
      <View style={styles.header}>
        <View style={{ width: 40 }} />
        <Text style={styles.headerTitle}>
          {userType === 'empresa' ? 'Registro Empresa' : 'Meu Registro'}
        </Text>
        <TouchableOpacity
          style={styles.logoutButton}
          onPress={() => {
            Alert.alert(
              'Sair',
              'Deseja fazer logout?',
              [
                { text: 'Cancelar', style: 'cancel' },
                { 
                  text: 'Sair', 
                  style: 'destructive',
                  onPress: signOut 
                }
              ]
            );
          }}
        >
          <Ionicons name="log-out-outline" size={28} color="#fff" />
        </TouchableOpacity>
      </View>

      {/* Área de captura (tap anywhere) - Positioned absolutely */}
      <TouchableOpacity
        style={styles.captureArea}
        onPress={handleCapture}
        disabled={loading}
        activeOpacity={1}
      >
        {/* Guia facial */}
        <View style={styles.faceGuide}>
          <View style={styles.faceGuideCorner} />
        </View>

        {/* Instrução */}
        <Animatable.View 
          animation="pulse" 
          iterationCount="infinite" 
          style={styles.instructionContainer}
        >
          <Ionicons name="finger-print" size={40} color="#fff" />
          <Text style={styles.instructionText}>
            Toque na tela para registrar
          </Text>
        </Animatable.View>
      </TouchableOpacity>

      {/* Loading overlay - Positioned absolutely */}
      {loading && (
        <View style={styles.loadingOverlay}>
          <ActivityIndicator size="large" color="#4CAF50" />
          <Text style={styles.loadingText}>Reconhecendo...</Text>
        </View>
      )}
    </View>
  );
}

const styles = StyleSheet.create({
  container: {
    flex: 1,
    backgroundColor: '#000',
  },
  camera: {
    flex: 1,
  },
  header: {
    position: 'absolute',
    top: 0,
    left: 0,
    right: 0,
    flexDirection: 'row',
    alignItems: 'center',
    justifyContent: 'space-between',
    paddingTop: 50,
    paddingHorizontal: 20,
    paddingBottom: 20,
    backgroundColor: 'rgba(0,0,0,0.5)',
    zIndex: 10,
  },
  backButton: {
    width: 40,
    height: 40,
    justifyContent: 'center',
    alignItems: 'center',
  },
  logoutButton: {
    width: 40,
    height: 40,
    justifyContent: 'center',
    alignItems: 'center',
  },
  headerTitle: {
    fontSize: 18,
    fontWeight: 'bold',
    color: '#fff',
  },
  captureArea: {
    position: 'absolute',
    top: 0,
    left: 0,
    right: 0,
    bottom: 0,
    justifyContent: 'center',
    alignItems: 'center',
    zIndex: 5,
  },
  faceGuide: {
    width: 250,
    height: 300,
    borderWidth: 3,
    borderColor: 'rgba(255,255,255,0.5)',
    borderRadius: 150,
    justifyContent: 'center',
    alignItems: 'center',
  },
  instructionContainer: {
    position: 'absolute',
    bottom: 100,
    alignItems: 'center',
  },
  instructionText: {
    fontSize: 18,
    color: '#fff',
    marginTop: 10,
    fontWeight: 'bold',
    textShadowColor: 'rgba(0, 0, 0, 0.75)',
    textShadowOffset: { width: -1, height: 1 },
    textShadowRadius: 10,
  },
  loadingOverlay: {
    position: 'absolute',
    top: 0,
    left: 0,
    right: 0,
    bottom: 0,
    backgroundColor: 'rgba(0,0,0,0.7)',
    justifyContent: 'center',
    alignItems: 'center',
  },
  loadingText: {
    fontSize: 18,
    color: '#fff',
    marginTop: 15,
  },
  // Estilos de confirmação
  previewImage: {
    width: '100%',
    height: '100%',
    position: 'absolute',
  },
  overlay: {
    ...StyleSheet.absoluteFillObject,
    backgroundColor: 'rgba(0,0,0,0.7)',
  },
  confirmCard: {
    position: 'absolute',
    top: '20%',
    alignSelf: 'center',
    width: '85%',
    backgroundColor: '#fff',
    borderRadius: 20,
    padding: 30,
    alignItems: 'center',
    elevation: 10,
    shadowColor: '#000',
    shadowOffset: { width: 0, height: 5 },
    shadowOpacity: 0.3,
    shadowRadius: 10,
  },
  checkIcon: {
    marginBottom: 20,
  },
  confirmTitle: {
    fontSize: 24,
    fontWeight: 'bold',
    color: '#333',
    marginBottom: 25,
  },
  infoContainer: {
    flexDirection: 'row',
    justifyContent: 'space-between',
    width: '100%',
    marginBottom: 15,
    paddingHorizontal: 10,
  },
  infoLabel: {
    fontSize: 16,
    color: '#666',
    fontWeight: '600',
  },
  infoValue: {
    fontSize: 16,
    color: '#333',
    fontWeight: 'bold',
  },
  confirmButtons: {
    flexDirection: 'row',
    marginTop: 25,
    gap: 15,
  },
  confirmButton: {
    flex: 1,
    flexDirection: 'row',
    alignItems: 'center',
    justifyContent: 'center',
    padding: 15,
    borderRadius: 12,
    gap: 8,
  },
  retakeButton: {
    backgroundColor: '#FF9800',
  },
  saveButton: {
    backgroundColor: '#4CAF50',
  },
  confirmButtonText: {
    color: '#fff',
    fontSize: 16,
    fontWeight: 'bold',
  },
  message: {
    fontSize: 16,
    color: '#fff',
    textAlign: 'center',
    marginBottom: 20,
  },
  button: {
    backgroundColor: '#4CAF50',
    padding: 15,
    borderRadius: 10,
  },
  buttonText: {
    color: '#fff',
    fontSize: 16,
    fontWeight: 'bold',
  },
});
