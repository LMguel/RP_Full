import React, { useState, useEffect } from 'react';
import {
  View,
  Text,
  TextInput,
  TouchableOpacity,
  StyleSheet,
  KeyboardAvoidingView,
  Platform,
  Alert,
  ActivityIndicator,
  ScrollView,
} from 'react-native';
import { LinearGradient } from 'expo-linear-gradient';
import { useAuth } from '../contexts/AuthContext';
import * as Animatable from 'react-native-animatable';
import { Ionicons, MaterialCommunityIcons } from '@expo/vector-icons';
import AsyncStorage from '@react-native-async-storage/async-storage';

const SAVED_LOGIN_KEY = '@funcionario_login_id';

export default function FuncionarioLoginScreen({ navigation }) {
  const [funcionarioId, setFuncionarioId] = useState('');
  const [senha, setSenha] = useState('');
  const [loading, setLoading] = useState(false);
  const [showPassword, setShowPassword] = useState(false);
  const [rememberLogin, setRememberLogin] = useState(false);
  const { signInFuncionario } = useAuth();

  // Carregar login salvo ao montar componente
  useEffect(() => {
    loadSavedLogin();
  }, []);

  async function loadSavedLogin() {
    try {
      const savedId = await AsyncStorage.getItem(SAVED_LOGIN_KEY);
      if (savedId) {
        setFuncionarioId(savedId);
        setRememberLogin(true);
      }
    } catch (error) {
      console.log('[LOGIN] Erro ao carregar login salvo:', error);
    }
  }

  async function handleLogin() {
    if (!funcionarioId || !senha) {
      Alert.alert('Atenção', 'Por favor, preencha o ID e a senha.');
      return;
    }

    setLoading(true);
    try {
      console.log('[FUNC LOGIN] Iniciando login com ID:', funcionarioId);
      await signInFuncionario(funcionarioId, senha);
      console.log('[FUNC LOGIN] Login bem-sucedido');
      
      // Salvar ou remover login baseado na opção "Lembrar Login"
      if (rememberLogin) {
        await AsyncStorage.setItem(SAVED_LOGIN_KEY, funcionarioId);
        console.log('[LOGIN] Login salvo no dispositivo');
      } else {
        await AsyncStorage.removeItem(SAVED_LOGIN_KEY);
        console.log('[LOGIN] Login removido do dispositivo');
      }
      
      // Navegação será automática via AuthContext
    } catch (error) {
      console.error('[FUNC LOGIN] Erro completo:', error);
      console.error('[FUNC LOGIN] Error.message:', error.message);
      console.error('[FUNC LOGIN] Error.error:', error.error);
      
      const errorMessage = 
        error.error || 
        error.message || 
        error.response?.data?.error ||
        'ID ou senha inválidos.';
      
      Alert.alert('Erro no Login', errorMessage);
    } finally {
      setLoading(false);
    }
  }

  return (
    <LinearGradient
      colors={['#1e3a8a', '#1e40af', '#1d4ed8']}
      style={styles.container}
      start={{ x: 0, y: 0 }}
      end={{ x: 1, y: 1 }}
    >
      {/* Círculo decorativo de fundo */}
      <View style={styles.backgroundCircle} />

      <KeyboardAvoidingView
        style={{ flex: 1 }}
        behavior={Platform.OS === 'ios' ? 'padding' : 'height'}
      >
        <ScrollView contentContainerStyle={styles.scrollContent} showsVerticalScrollIndicator={false}>
          {/* Header com botão voltar */}
          <View style={styles.header}>
            <TouchableOpacity
              style={styles.backButton}
              onPress={() => navigation.navigate('LoginMode')}
              activeOpacity={0.7}
            >
              <View style={styles.backButtonInner}>
                <Ionicons name="arrow-back" size={24} color="white" />
              </View>
            </TouchableOpacity>
          </View>

          {/* Card de Login */}
          <Animatable.View animation="fadeInUp" duration={600} style={styles.card}>
            {/* Logo/Título */}
            <View style={styles.logoContainer}>
              <Animatable.View 
                animation="bounceIn" 
                duration={800}
                delay={200}
              >
                <View style={styles.logoCircle}>
                  <View style={styles.logoGlow} />
                  <Ionicons name="person" size={48} color="#2563eb" />
                </View>
              </Animatable.View>
              <Text style={styles.title}>Bem-vindo de volta</Text>
              <Text style={styles.subtitle}>Faça login para continuar</Text>
            </View>

            {/* Formulário */}
            <View style={styles.form}>
              {/* Label ID */}
              <Text style={styles.inputLabel}>ID do Funcionário</Text>
              
              {/* Campo ID */}
              <View style={styles.inputContainer}>
                <View style={styles.inputIconContainer}>
                  <Ionicons name="card-outline" size={20} color="rgba(255, 255, 255, 0.9)" />
                </View>
                <TextInput
                  style={styles.input}
                  placeholder="ID fornecido pela empresa"
                  placeholderTextColor="rgba(255, 255, 255, 0.5)"
                  value={funcionarioId}
                  onChangeText={setFuncionarioId}
                  autoCapitalize="none"
                  autoCorrect={false}
                  editable={!loading}
                />
              </View>
              <Text style={styles.helperText}>Use o ID fornecido pelo RH da sua empresa.</Text>

              {/* Label Senha */}
              <Text style={styles.inputLabel}>Senha</Text>
              
              {/* Campo Senha */}
              <View style={styles.inputContainer}>
                <View style={styles.inputIconContainer}>
                  <Ionicons name="lock-closed-outline" size={20} color="rgba(255, 255, 255, 0.9)" />
                </View>
                <TextInput
                  style={styles.input}
                  placeholder="••••••••"
                  placeholderTextColor="rgba(255, 255, 255, 0.5)"
                  value={senha}
                  onChangeText={setSenha}
                  secureTextEntry={!showPassword}
                  autoCapitalize="none"
                  editable={!loading}
                />
                <TouchableOpacity
                  style={styles.eyeIcon}
                  onPress={() => setShowPassword(!showPassword)}
                  disabled={loading}
                  activeOpacity={0.7}
                >
                  <Ionicons
                    name={showPassword ? 'eye-outline' : 'eye-off-outline'}
                    size={20}
                    color="rgba(255, 255, 255, 0.9)"
                  />
                </TouchableOpacity>
              </View>

              {/* Checkbox Lembrar Login */}
              <TouchableOpacity
                style={styles.rememberContainer}
                onPress={() => setRememberLogin(!rememberLogin)}
                activeOpacity={0.7}
                disabled={loading}
              >
                <View style={[styles.checkbox, rememberLogin && styles.checkboxChecked]}>
                  {rememberLogin && (
                    <MaterialCommunityIcons name="check" size={16} color="#fff" />
                  )}
                </View>
                <Text style={styles.rememberText}>Lembrar meu login</Text>
              </TouchableOpacity>

              {/* Botão Login */}
              <TouchableOpacity
                style={[styles.loginButton, loading && styles.loginButtonDisabled]}
                onPress={handleLogin}
                disabled={loading}
                activeOpacity={0.85}
              >
                {loading ? (
                  <View style={styles.loginButtonContent}>
                    <ActivityIndicator color="#fff" size="small" />
                    <Text style={styles.loginButtonText}>Entrando...</Text>
                  </View>
                ) : (
                  <View style={styles.loginButtonContent}>
                    <Ionicons name="log-in-outline" size={22} color="#fff" />
                    <Text style={styles.loginButtonText}>Entrar na conta</Text>
                  </View>
                )}
              </TouchableOpacity>
            </View>
          </Animatable.View>
        </ScrollView>
      </KeyboardAvoidingView>
    </LinearGradient>
  );
}

const styles = StyleSheet.create({
  container: {
    flex: 1,
  },
  backgroundCircle: {
    position: 'absolute',
    width: 400,
    height: 400,
    borderRadius: 200,
    backgroundColor: 'rgba(255, 255, 255, 0.02)',
    top: -200,
    right: -150,
  },
  scrollContent: {
    flexGrow: 1,
    paddingHorizontal: 24,
    paddingBottom: 30,
  },
  header: {
    paddingTop: 50,
    paddingBottom: 20,
  },
  backButton: {
    width: 48,
    height: 48,
    justifyContent: 'center',
    alignItems: 'flex-start',
  },
  backButtonInner: {
    width: 44,
    height: 44,
    borderRadius: 22,
    backgroundColor: 'rgba(255, 255, 255, 0.1)',
    justifyContent: 'center',
    alignItems: 'center',
    borderWidth: 1,
    borderColor: 'rgba(255, 255, 255, 0.2)',
  },
  card: {
    backgroundColor: 'rgba(255, 255, 255, 0.08)',
    borderRadius: 24,
    padding: 28,
    borderWidth: 1.5,
    borderColor: 'rgba(255, 255, 255, 0.15)',
    shadowColor: '#000',
    shadowOffset: { width: 0, height: 12 },
    shadowOpacity: 0.3,
    shadowRadius: 24,
    elevation: 10,
  },
  logoContainer: {
    alignItems: 'center',
    marginBottom: 36,
  },
  logoCircle: {
    width: 90,
    height: 90,
    backgroundColor: 'white',
    borderRadius: 45,
    justifyContent: 'center',
    alignItems: 'center',
    marginBottom: 20,
    shadowColor: '#2563eb',
    shadowOffset: { width: 0, height: 8 },
    shadowOpacity: 0.4,
    shadowRadius: 16,
    elevation: 8,
  },
  logoGlow: {
    position: 'absolute',
    width: 110,
    height: 110,
    borderRadius: 55,
    backgroundColor: 'rgba(37, 99, 235, 0.15)',
  },
  title: {
    fontSize: 26,
    fontWeight: '700',
    color: 'white',
    marginBottom: 6,
    letterSpacing: 0.3,
  },
  subtitle: {
    fontSize: 14,
    color: 'rgba(255, 255, 255, 0.7)',
    textAlign: 'center',
    fontWeight: '400',
  },
  form: {
    width: '100%',
  },
  inputLabel: {
    fontSize: 13,
    fontWeight: '600',
    color: 'rgba(255, 255, 255, 0.9)',
    marginBottom: 8,
    marginLeft: 4,
    letterSpacing: 0.3,
  },
  inputContainer: {
    flexDirection: 'row',
    alignItems: 'center',
    backgroundColor: 'rgba(255, 255, 255, 0.06)',
    borderRadius: 12,
    marginBottom: 20,
    paddingHorizontal: 4,
    paddingVertical: 4,
    borderWidth: 1.5,
    borderColor: 'rgba(255, 255, 255, 0.2)',
  },
  inputIconContainer: {
    width: 40,
    height: 40,
    borderRadius: 10,
    backgroundColor: 'rgba(37, 99, 235, 0.15)',
    justifyContent: 'center',
    alignItems: 'center',
    marginRight: 8,
  },
  input: {
    flex: 1,
    height: 40,
    fontSize: 15,
    color: 'white',
    fontWeight: '500',
  },
  eyeIcon: {
    width: 40,
    height: 40,
    justifyContent: 'center',
    alignItems: 'center',
    borderRadius: 10,
  },
  loginButton: {
    backgroundColor: '#2563eb',
    borderRadius: 14,
    height: 54,
    justifyContent: 'center',
    alignItems: 'center',
    marginTop: 28,
    shadowColor: '#2563eb',
    shadowOffset: { width: 0, height: 6 },
    shadowOpacity: 0.4,
    shadowRadius: 12,
    elevation: 6,
  },
  loginButtonDisabled: {
    opacity: 0.5,
  },
  loginButtonContent: {
    flexDirection: 'row',
    alignItems: 'center',
    gap: 10,
  },
  loginButtonText: {
    color: '#fff',
    fontSize: 16,
    fontWeight: '700',
    letterSpacing: 0.5,
  },
  helperText: {
    fontSize: 11,
    color: 'rgba(255, 255, 255, 0.6)',
    marginTop: -12,
    marginBottom: 16,
    marginLeft: 4,
    fontStyle: 'italic',
  },
  rememberContainer: {
    flexDirection: 'row',
    alignItems: 'center',
    marginTop: 8,
    marginBottom: 8,
  },
  checkbox: {
    width: 22,
    height: 22,
    borderRadius: 6,
    borderWidth: 2,
    borderColor: 'rgba(255, 255, 255, 0.4)',
    marginRight: 10,
    justifyContent: 'center',
    alignItems: 'center',
    backgroundColor: 'rgba(255, 255, 255, 0.05)',
  },
  checkboxChecked: {
    backgroundColor: '#2563eb',
    borderColor: '#2563eb',
  },
  rememberText: {
    fontSize: 14,
    color: 'rgba(255, 255, 255, 0.85)',
    fontWeight: '500',
  },
});
