import React from 'react';
import {
  View,
  Text,
  TouchableOpacity,
  StyleSheet,
  Image,
} from 'react-native';
import { LinearGradient } from 'expo-linear-gradient';
import * as Animatable from 'react-native-animatable';
import { Ionicons } from '@expo/vector-icons';

export default function LoginModeScreen({ navigation }) {
  return (
    <LinearGradient
      colors={['#1e3a8a', '#1e40af', '#1d4ed8']}
      style={styles.container}
      start={{ x: 0, y: 0 }}
      end={{ x: 1, y: 1 }}
    >
      {/* Círculos decorativos de fundo */}
      <View style={styles.backgroundCircle1} />
      <View style={styles.backgroundCircle2} />

      {/* Header */}
      <Animatable.View animation="fadeInDown" duration={800} style={styles.header}>
        <Animatable.View 
          animation="pulse" 
          iterationCount="infinite" 
          duration={2000}
          style={styles.logoContainer}
        >
          <View style={styles.logoCircle}>
            <View style={styles.logoGlow} />
            <Ionicons name="time-outline" size={60} color="#2563eb" />
          </View>
        </Animatable.View>
        <Text style={styles.title}>Sistema de Controle de{'\n'}Ponto Eletrônico</Text>
        <View style={styles.divider} />
        <Text style={styles.subtitle}>Escolha como deseja acessar</Text>
      </Animatable.View>

      {/* Buttons */}
      <Animatable.View animation="fadeInUp" delay={300} duration={800} style={styles.buttonsContainer}>
        {/* Botão Empresa */}
        <Animatable.View animation="fadeInLeft" delay={400} duration={600}>
          <TouchableOpacity
            style={styles.modeButton}
            onPress={() => navigation.navigate('EmpresaLogin')}
            activeOpacity={0.85}
          >
            <View style={styles.buttonIconContainer}>
              <Ionicons name="business" size={36} color="white" />
            </View>
            <View style={styles.buttonTextContainer}>
              <Text style={styles.buttonTitle}>Empresa</Text>
              <Text style={styles.buttonSubtitle}>
                Cadastro e gestão empresarial
              </Text>
            </View>
            <Ionicons name="chevron-forward" size={24} color="rgba(255, 255, 255, 0.6)" />
          </TouchableOpacity>
        </Animatable.View>

        {/* Botão Funcionário */}
        <Animatable.View animation="fadeInRight" delay={500} duration={600}>
          <TouchableOpacity
            style={styles.modeButton}
            onPress={() => navigation.navigate('FuncionarioLogin')}
            activeOpacity={0.85}
          >
            <View style={styles.buttonIconContainer}>
              <Ionicons name="person" size={36} color="white" />
            </View>
            <View style={styles.buttonTextContainer}>
              <Text style={styles.buttonTitle}>Funcionário</Text>
              <Text style={styles.buttonSubtitle}>
                Registro pessoal de ponto
              </Text>
            </View>
            <Ionicons name="chevron-forward" size={24} color="rgba(255, 255, 255, 0.6)" />
          </TouchableOpacity>
        </Animatable.View>
      </Animatable.View>

      {/* Footer */}
      <Animatable.View animation="fadeIn" delay={600} style={styles.footer}>
        <View style={styles.footerDivider} />
        <Text style={styles.footerText}>© 2025 Registra Ponto</Text>
        <Text style={styles.footerSubtext}>Versão 1.0.0</Text>
      </Animatable.View>
    </LinearGradient>
  );
}

const styles = StyleSheet.create({
  container: {
    flex: 1,
    justifyContent: 'space-between',
    paddingVertical: 40,
  },
  backgroundCircle1: {
    position: 'absolute',
    width: 300,
    height: 300,
    borderRadius: 150,
    backgroundColor: 'rgba(255, 255, 255, 0.03)',
    top: -100,
    right: -100,
  },
  backgroundCircle2: {
    position: 'absolute',
    width: 200,
    height: 200,
    borderRadius: 100,
    backgroundColor: 'rgba(255, 255, 255, 0.02)',
    bottom: 100,
    left: -50,
  },
  header: {
    alignItems: 'center',
    paddingTop: 60,
    paddingHorizontal: 30,
    zIndex: 1,
  },
  logoContainer: {
    marginBottom: 30,
  },
  logoCircle: {
    width: 140,
    height: 140,
    backgroundColor: 'white',
    borderRadius: 70,
    justifyContent: 'center',
    alignItems: 'center',
    shadowColor: '#2563eb',
    shadowOffset: { width: 0, height: 12 },
    shadowOpacity: 0.4,
    shadowRadius: 24,
    elevation: 12,
  },
  logoGlow: {
    position: 'absolute',
    width: 160,
    height: 160,
    borderRadius: 80,
    backgroundColor: 'rgba(37, 99, 235, 0.2)',
  },
  title: {
    fontSize: 20,
    fontWeight: '300',
    color: 'white',
    marginTop: 24,
    textAlign: 'center',
    letterSpacing: 0.8,
    lineHeight: 28,
  },
  divider: {
    width: 60,
    height: 3,
    backgroundColor: 'rgba(255, 255, 255, 0.3)',
    borderRadius: 2,
    marginVertical: 20,
  },
  subtitle: {
    fontSize: 15,
    color: 'rgba(255, 255, 255, 0.75)',
    textAlign: 'center',
    fontWeight: '400',
  },
  buttonsContainer: {
    paddingHorizontal: 24,
    gap: 16,
    zIndex: 1,
  },
  modeButton: {
    backgroundColor: 'rgba(255, 255, 255, 0.08)',
    borderRadius: 20,
    padding: 20,
    borderWidth: 1.5,
    borderColor: 'rgba(255, 255, 255, 0.15)',
    flexDirection: 'row',
    alignItems: 'center',
    shadowColor: '#000',
    shadowOffset: { width: 0, height: 4 },
    shadowOpacity: 0.2,
    shadowRadius: 12,
    elevation: 5,
  },
  buttonIconContainer: {
    width: 56,
    height: 56,
    backgroundColor: 'rgba(37, 99, 235, 0.2)',
    borderRadius: 28,
    justifyContent: 'center',
    alignItems: 'center',
    marginRight: 16,
  },
  buttonTextContainer: {
    flex: 1,
  },
  buttonTitle: {
    fontSize: 20,
    fontWeight: '600',
    color: 'white',
    marginBottom: 4,
    letterSpacing: 0.3,
  },
  buttonSubtitle: {
    fontSize: 13,
    color: 'rgba(255, 255, 255, 0.7)',
    lineHeight: 18,
  },
  footer: {
    alignItems: 'center',
    paddingBottom: 20,
    paddingHorizontal: 30,
    zIndex: 1,
  },
  footerDivider: {
    width: 40,
    height: 2,
    backgroundColor: 'rgba(255, 255, 255, 0.2)',
    borderRadius: 1,
    marginBottom: 12,
  },
  footerText: {
    fontSize: 12,
    color: 'rgba(255, 255, 255, 0.5)',
    fontWeight: '500',
  },
  footerSubtext: {
    fontSize: 10,
    color: 'rgba(255, 255, 255, 0.4)',
    marginTop: 4,
  },
});
