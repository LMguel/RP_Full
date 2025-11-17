import React, { useState, useEffect, useRef } from 'react';
import {
  View,
  Text,
  StyleSheet,
  Dimensions,
  Modal,
  Pressable,
  ActivityIndicator,
  Alert,
  Image,
} from 'react-native';
import { CameraView, useCameraPermissions } from 'expo-camera';
import { useAuth } from '../contexts/AuthContext';
import ApiService from '../services/api';
import * as Animatable from 'react-native-animatable';

const { width, height } = Dimensions.get('window');

export default function CameraScreen() {
  const [permission, requestPermission] = useCameraPermissions();
  const [faceDetected, setFaceDetected] = useState(false);
  const [faceStableTime, setFaceStableTime] = useState(0); // Tempo em segundos que o rosto está estável
  const [previewMode, setPreviewMode] = useState(false);
  const [previewPhoto, setPreviewPhoto] = useState(null);
  const [recognitionData, setRecognitionData] = useState(null);
  const [processing, setProcessing] = useState(false);
  const [autoConfirmCountdown, setAutoConfirmCountdown] = useState(null);
  const [successModal, setSuccessModal] = useState(false);
  const [successData, setSuccessData] = useState(null);
  const cameraRef = useRef(null);
  const { companyName, signOut } = useAuth();
  const [currentTime, setCurrentTime] = useState(new Date());
  const faceDetectionTimer = useRef(null);
  const countdownTimer = useRef(null);
  const lastFaceDetectedTime = useRef(null);
  const captureTriggered = useRef(false);

  // Relógio
  useEffect(() => {
    const timer = setInterval(() => {
      setCurrentTime(new Date());
    }, 1000);
    return () => clearInterval(timer);
  }, []);

  // Timer para contar tempo de rosto estável
  useEffect(() => {
    if (faceDetected && !previewMode && !processing && !successModal && !captureTriggered.current) {
      // Começar a contar o tempo
      if (!lastFaceDetectedTime.current) {
        lastFaceDetectedTime.current = Date.now();
      }

      faceDetectionTimer.current = setInterval(() => {
        const elapsedSeconds = Math.floor((Date.now() - lastFaceDetectedTime.current) / 1000);
        setFaceStableTime(elapsedSeconds);

        // Capturar automaticamente após 2 segundos de rosto estável
        if (elapsedSeconds >= 2 && !captureTriggered.current) {
          captureTriggered.current = true;
          capturePreview();
        }
      }, 100);
    } else if (!faceDetected) {
      // Reset quando não há rosto
      lastFaceDetectedTime.current = null;
      setFaceStableTime(0);
      captureTriggered.current = false;
      
      if (faceDetectionTimer.current) {
        clearInterval(faceDetectionTimer.current);
      }
    }

    return () => {
      if (faceDetectionTimer.current) {
        clearInterval(faceDetectionTimer.current);
      }
    };
  }, [faceDetected, previewMode, processing, successModal]);

  // Limpar timers ao desmontar
  useEffect(() => {
    return () => {
      if (countdownTimer.current) {
        clearInterval(countdownTimer.current);
      }
      if (faceDetectionTimer.current) {
        clearInterval(faceDetectionTimer.current);
      }
    };
  }, []);

  const getGreeting = () => {
    const hour = currentTime.getHours();
    if (hour < 12) return 'Bom dia';
    if (hour < 18) return 'Boa tarde';
    return 'Boa noite';
  };

  const getFormattedTime = () => {
    return currentTime.toLocaleTimeString('pt-BR', {
      hour: '2-digit',
      minute: '2-digit',
    });
  };

  // Callback quando rostos são detectados pela câmera
  const handleFacesDetected = ({ faces }) => {
    if (faces && faces.length > 0 && !previewMode && !processing && !successModal) {
      setFaceDetected(true);
    } else {
      setFaceDetected(false);
    }
  };

  const capturePreview = async () => {
    if (!cameraRef.current || previewMode || processing) return;

    // Limpar timer de detecção
    if (faceDetectionTimer.current) {
      clearInterval(faceDetectionTimer.current);
    }
    setFaceDetected(false);
    setFaceStableTime(0);

    try {
      setProcessing(true);

      const photo = await cameraRef.current.takePictureAsync({
        quality: 0.5, // Low-res para prévia
        base64: false,
      });

      console.log('Prévia capturada:', photo.uri);
      setPreviewPhoto(photo.uri);

      // Reconhecer o rosto
      const response = await ApiService.registerFaceTime(photo.uri, true); // Preview mode
      
      if (response.success) {
        setRecognitionData({
          nome: response.funcionario,
          tipo: response.tipo,
          confidence: response.confidence || 0.85,
        });

        setPreviewMode(true);
        setProcessing(false);

        // Sempre iniciar countdown de 5 segundos para confirmar ou recapturar
        startAutoConfirmCountdown(5);
      } else {
        throw new Error(response.message || 'Rosto não reconhecido');
      }
    } catch (error) {
      console.error('Erro na prévia:', error);
      Alert.alert('Atenção', error.message || 'Rosto não reconhecido. Tente novamente.');
      resetToCamera();
    }
  };

  const startAutoConfirmCountdown = (seconds = 5) => {
    setAutoConfirmCountdown(seconds);
    let count = seconds;

    countdownTimer.current = setInterval(() => {
      count -= 1;
      setAutoConfirmCountdown(count);

      if (count <= 0) {
        clearInterval(countdownTimer.current);
        confirmRegistration();
      }
    }, 1000);
  };

  const cancelCountdown = () => {
    if (countdownTimer.current) {
      clearInterval(countdownTimer.current);
    }
    setAutoConfirmCountdown(null);
  };

  const confirmRegistration = async () => {
    cancelCountdown();
    setProcessing(true);

    try {
      // Registrar com foto de alta qualidade
      const finalPhoto = await cameraRef.current.takePictureAsync({
        quality: 0.8,
        base64: false,
      });

      const response = await ApiService.registerFaceTime(finalPhoto.uri);
      
      if (response.success) {
        setSuccessData({
          nome: response.funcionario,
          tipo: response.tipo,
          hora: new Date(response.hora).toLocaleTimeString('pt-BR', {
            hour: '2-digit',
            minute: '2-digit',
          }),
        });
        setSuccessModal(true);
        setTimeout(() => {
          setSuccessModal(false);
          setSuccessData(null);
          resetToCamera();
        }, 4000);
      }
    } catch (error) {
      console.error('Erro ao confirmar:', error);
      Alert.alert('Erro', error.message || 'Erro ao registrar ponto. Tente novamente.');
      resetToCamera();
    } finally {
      setProcessing(false);
    }
  };

  const recapture = () => {
    cancelCountdown();
    resetToCamera();
  };

  const resetToCamera = () => {
    setPreviewMode(false);
    setPreviewPhoto(null);
    setRecognitionData(null);
    setAutoConfirmCountdown(null);
    setProcessing(false);
    setFaceStableTime(0);
    setFaceDetected(false);
    lastFaceDetectedTime.current = null;
    captureTriggered.current = false;
  };

  if (!permission) {
    return (
      <View style={styles.loadingContainer}>
        <ActivityIndicator size="large" color="#3b82f6" />
        <Text style={styles.loadingText}>Carregando...</Text>
      </View>
    );
  }

  if (!permission.granted) {
    return (
      <View style={styles.permissionContainer}>
        <Text style={styles.permissionIcon}>📸</Text>
        <Text style={styles.permissionTitle}>Acesso à Câmera</Text>
        <Text style={styles.permissionText}>
          Precisamos de acesso à câmera para reconhecimento facial
        </Text>
        <Pressable style={styles.permissionButton} onPress={requestPermission}>
          <Text style={styles.permissionButtonText}>Permitir Acesso</Text>
        </Pressable>
      </View>
    );
  }

  return (
    <View style={styles.container}>
      <CameraView 
        style={styles.camera} 
        ref={cameraRef}
        facing="front"
        onFacesDetected={handleFacesDetected}
        faceDetectorSettings={{
          mode: 'fast',
          detectLandmarks: 'none',
          runClassifications: 'none',
          minDetectionInterval: 100,
          tracking: true,
        }}
      />

      {/* Relógio no topo */}
      <View style={styles.clockContainer}>
        <Text style={styles.clockText}>{getFormattedTime()}</Text>
      </View>

      {/* Indicador de detecção de rosto com contagem */}
      {faceDetected && !previewMode && !processing && !successModal && (
        <Animatable.View 
          animation="pulse" 
          iterationCount="infinite"
          style={styles.faceDetectedIndicator}
        >
          <View style={styles.faceFrame}>
            <View style={[styles.faceFrameCorner, styles.topLeft]} />
            <View style={[styles.faceFrameCorner, styles.topRight]} />
            <View style={[styles.faceFrameCorner, styles.bottomLeft]} />
            <View style={[styles.faceFrameCorner, styles.bottomRight]} />
          </View>
          <Text style={styles.faceDetectedText}>
            {faceStableTime < 2 ? '👤 Rosto detectado' : `Capturando em ${2 - faceStableTime}...`}
          </Text>
        </Animatable.View>
      )}

      {/* Instrução quando não há rosto */}
      {!faceDetected && !previewMode && !processing && !successModal && (
        <View style={styles.instructionContainer}>
          <Text style={styles.instructionText}>Posicione seu rosto na câmera</Text>
        </View>
      )}

      {/* Modal de Prévia e Confirmação */}
      <Modal
        visible={previewMode}
        transparent
        animationType="fade"
        onRequestClose={recapture}
      >
        <View style={styles.previewContainer}>
          {previewPhoto && (
            <Image source={{ uri: previewPhoto }} style={styles.previewImage} />
          )}
          
          <View style={styles.previewOverlay}>
            {processing ? (
              <View style={styles.processingBox}>
                <ActivityIndicator size="large" color="#fff" />
                <Text style={styles.processingText}>Reconhecendo...</Text>
              </View>
            ) : recognitionData ? (
              <Animatable.View animation="fadeInUp" duration={400} style={styles.recognitionBox}>
                <Text style={styles.recognitionName}>
                  {recognitionData.nome}
                </Text>
                <Text style={styles.recognitionType}>
                  {recognitionData.tipo === 'entrada' ? '🟢 Entrada' : '🔴 Saída'}
                </Text>
                <Text style={styles.confidenceText}>
                  Confiança: {(recognitionData.confidence * 100).toFixed(0)}%
                </Text>

                {/* Countdown e botões sempre visíveis */}
                {autoConfirmCountdown !== null && (
                  <View style={styles.countdownContainer}>
                    <Text style={styles.countdownText}>
                      Confirmando automaticamente em {autoConfirmCountdown}s
                    </Text>
                  </View>
                )}

                {/* Botões de ação */}
                <View style={styles.actionButtons}>
                  <Pressable 
                    style={[styles.actionButton, styles.recaptureButton]}
                    onPress={recapture}
                  >
                    <Text style={styles.actionButtonText}>🔄 Recapturar</Text>
                  </Pressable>
                  <Pressable 
                    style={[styles.actionButton, styles.confirmButton]}
                    onPress={confirmRegistration}
                  >
                    <Text style={styles.actionButtonText}>✓ Confirmar Agora</Text>
                  </Pressable>
                </View>
              </Animatable.View>
            ) : null}
          </View>
        </View>
      </Modal>

      {/* Overlay de processamento geral */}
      {processing && !previewMode && (
        <View style={styles.processingOverlay}>
          <ActivityIndicator size="large" color="#fff" />
          <Text style={styles.processingText}>Processando...</Text>
        </View>
      )}

      {/* Modal de Sucesso */}
      <Modal
        visible={successModal}
        transparent
        animationType="fade"
        onRequestClose={() => setSuccessModal(false)}
      >
        <View style={styles.modalContainer}>
          <Animatable.View animation="bounceIn" duration={600} style={styles.modalContent}>
            <Text style={styles.successIcon}>✅</Text>
            <Text style={styles.successGreeting}>
              {getGreeting()}, {successData?.nome}!
            </Text>
            <Text style={styles.successType}>
              {successData?.tipo === 'entrada' ? '🟢 Entrada' : '🔴 Saída'}
            </Text>
            <Text style={styles.successTime}>{successData?.hora}</Text>
          </Animatable.View>
        </View>
      </Modal>
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
    width: width,
    height: height,
  },
  clockContainer: {
    position: 'absolute',
    top: 50,
    alignSelf: 'center',
    paddingHorizontal: 24,
    paddingVertical: 12,
  },
  clockText: {
    fontSize: 48,
    fontWeight: '700',
    color: '#fff',
    textShadowColor: 'rgba(0, 0, 0, 0.8)',
    textShadowOffset: { width: 0, height: 2 },
    textShadowRadius: 8,
  },
  processingOverlay: {
    position: 'absolute',
    top: 0,
    left: 0,
    right: 0,
    bottom: 0,
    backgroundColor: 'rgba(0, 0, 0, 0.7)',
    justifyContent: 'center',
    alignItems: 'center',
  },
  processingText: {
    marginTop: 16,
    fontSize: 20,
    color: '#fff',
    fontWeight: '600',
  },
  loadingContainer: {
    flex: 1,
    justifyContent: 'center',
    alignItems: 'center',
    backgroundColor: '#0f172a',
  },
  loadingText: {
    marginTop: 16,
    fontSize: 18,
    color: '#fff',
  },
  permissionContainer: {
    flex: 1,
    justifyContent: 'center',
    alignItems: 'center',
    backgroundColor: '#0f172a',
    padding: 32,
  },
  permissionIcon: {
    fontSize: 80,
    marginBottom: 24,
  },
  permissionTitle: {
    fontSize: 28,
    fontWeight: 'bold',
    color: '#fff',
    marginBottom: 12,
  },
  permissionText: {
    fontSize: 16,
    color: '#94a3b8',
    textAlign: 'center',
    marginBottom: 32,
    lineHeight: 24,
  },
  permissionButton: {
    backgroundColor: '#3b82f6',
    paddingHorizontal: 32,
    paddingVertical: 16,
    borderRadius: 12,
  },
  permissionButtonText: {
    fontSize: 18,
    fontWeight: '600',
    color: '#fff',
  },
  modalContainer: {
    flex: 1,
    justifyContent: 'center',
    alignItems: 'center',
    backgroundColor: 'rgba(0, 0, 0, 0.8)',
  },
  modalContent: {
    backgroundColor: '#fff',
    borderRadius: 24,
    padding: 40,
    alignItems: 'center',
    minWidth: 320,
    shadowColor: '#000',
    shadowOffset: { width: 0, height: 10 },
    shadowOpacity: 0.3,
    shadowRadius: 20,
    elevation: 10,
  },
  successIcon: {
    fontSize: 72,
    marginBottom: 20,
  },
  successGreeting: {
    fontSize: 28,
    fontWeight: 'bold',
    color: '#1e293b',
    marginBottom: 12,
    textAlign: 'center',
  },
  successType: {
    fontSize: 24,
    fontWeight: '600',
    color: '#3b82f6',
    marginBottom: 16,
  },
  successTime: {
    fontSize: 20,
    color: '#64748b',
    fontWeight: '500',
  },
  // Novos estilos para detecção e prévia
  faceDetectedIndicator: {
    position: 'absolute',
    top: '40%',
    alignSelf: 'center',
    alignItems: 'center',
  },
  faceFrame: {
    width: 250,
    height: 250,
    justifyContent: 'center',
    alignItems: 'center',
    marginBottom: 20,
    position: 'relative',
  },
  faceFrameCorner: {
    position: 'absolute',
    width: 60,
    height: 60,
    borderColor: '#10b981',
    borderWidth: 4,
  },
  topLeft: {
    top: 0,
    left: 0,
    borderRightWidth: 0,
    borderBottomWidth: 0,
    borderTopLeftRadius: 20,
  },
  topRight: {
    top: 0,
    right: 0,
    borderLeftWidth: 0,
    borderBottomWidth: 0,
    borderTopRightRadius: 20,
  },
  bottomLeft: {
    bottom: 0,
    left: 0,
    borderRightWidth: 0,
    borderTopWidth: 0,
    borderBottomLeftRadius: 20,
  },
  bottomRight: {
    bottom: 0,
    right: 0,
    borderLeftWidth: 0,
    borderTopWidth: 0,
    borderBottomRightRadius: 20,
  },
  faceDetectedText: {
    fontSize: 20,
    fontWeight: '700',
    color: '#10b981',
    backgroundColor: 'rgba(0, 0, 0, 0.85)',
    paddingHorizontal: 24,
    paddingVertical: 14,
    borderRadius: 25,
    overflow: 'hidden',
  },
  instructionContainer: {
    position: 'absolute',
    bottom: 100,
    alignSelf: 'center',
  },
  instructionText: {
    fontSize: 22,
    fontWeight: '600',
    color: '#fff',
    backgroundColor: 'rgba(0, 0, 0, 0.7)',
    paddingHorizontal: 30,
    paddingVertical: 16,
    borderRadius: 25,
    textAlign: 'center',
  },
  previewContainer: {
    flex: 1,
    backgroundColor: '#000',
  },
  previewImage: {
    width: width,
    height: height,
    position: 'absolute',
  },
  previewOverlay: {
    flex: 1,
    justifyContent: 'flex-end',
    paddingBottom: 60,
    paddingHorizontal: 20,
  },
  processingBox: {
    backgroundColor: 'rgba(0, 0, 0, 0.8)',
    borderRadius: 20,
    padding: 40,
    alignItems: 'center',
  },
  recognitionBox: {
    backgroundColor: 'rgba(255, 255, 255, 0.95)',
    borderRadius: 24,
    padding: 30,
    alignItems: 'center',
  },
  recognitionName: {
    fontSize: 32,
    fontWeight: 'bold',
    color: '#1e293b',
    marginBottom: 12,
    textAlign: 'center',
  },
  recognitionType: {
    fontSize: 26,
    fontWeight: '600',
    color: '#3b82f6',
    marginBottom: 12,
  },
  confidenceText: {
    fontSize: 16,
    color: '#64748b',
    marginBottom: 24,
  },
  countdownContainer: {
    alignItems: 'center',
    marginTop: 20,
  },
  countdownText: {
    fontSize: 20,
    fontWeight: '600',
    color: '#f59e0b',
    marginBottom: 16,
  },
  cancelButton: {
    backgroundColor: '#ef4444',
    paddingHorizontal: 32,
    paddingVertical: 12,
    borderRadius: 12,
  },
  cancelButtonText: {
    fontSize: 18,
    fontWeight: '600',
    color: '#fff',
  },
  actionButtons: {
    flexDirection: 'row',
    gap: 16,
    marginTop: 24,
  },
  actionButton: {
    flex: 1,
    paddingVertical: 16,
    borderRadius: 12,
    alignItems: 'center',
  },
  recaptureButton: {
    backgroundColor: '#64748b',
  },
  confirmButton: {
    backgroundColor: '#10b981',
  },
  actionButtonText: {
    fontSize: 18,
    fontWeight: '600',
    color: '#fff',
  },
});
