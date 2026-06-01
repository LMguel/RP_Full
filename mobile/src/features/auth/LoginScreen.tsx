import React, { useEffect, useState } from 'react';
import {
  Alert,
  KeyboardAvoidingView,
  Platform,
  ScrollView,
  StyleSheet,
  Switch,
  Text,
  View,
} from 'react-native';
import { SafeAreaView } from 'react-native-safe-area-context';
import { theme } from '@app/theme';
import { TextField } from '@components/TextField';
import { PrimaryButton } from '@components/PrimaryButton';
import { AuthApi } from '@api/authApi';
import { useAuthStore } from './authStore';
import { BootstrapService } from '@services/bootstrapService';
import { logger } from '@utils/logger';
import { nowIso } from '@utils/time';
import type { ScreenProps } from '@/types/navigation';
import { KioskService } from '@features/kiosk/kioskService';
import { Config } from '@utils/config';
import { SecureStorage } from '@storage/secureStorage';

export function LoginScreen({ navigation }: ScreenProps<'Login'>) {
  const [usuario, setUsuario] = useState('');
  const [senha, setSenha] = useState('');
  const [lembrar, setLembrar] = useState(false);
  const [loading, setLoading] = useState(false);
  const [error, setError] = useState<string | null>(null);
  const setSession = useAuthStore(s => s.setSession);

  useEffect(() => {
    SecureStorage.getLoginCredentials().then(saved => {
      if (saved) {
        setUsuario(saved.usuario);
        setSenha(saved.senha);
        setLembrar(true);
      }
    });
  }, []);

  async function handleLogin() {
    setError(null);
    if (!usuario.trim() || !senha) {
      setError('Usuário e senha obrigatórios');
      return;
    }
    setLoading(true);
    try {
      const res = await AuthApi.loginEmpresa(usuario.trim(), senha);
      await setSession({
        token: res.token,
        company_id: res.company_id,
        empresa_nome: res.empresa_nome,
        usuario_id: res.usuario_id,
        issued_at: nowIso(),
      });

      if (lembrar) {
        await SecureStorage.saveLoginCredentials(usuario.trim(), senha);
      } else {
        await SecureStorage.clearLoginCredentials();
      }

      navigation.replace('Provisioning');

      try {
        await BootstrapService.pullCompanyData(res.company_id);
        const cfg = Config.load();
        if (cfg.kioskAutoLock) {
          await KioskService.start();
        }
        navigation.replace('Kiosk');
      } catch (e) {
        logger.error('LoginScreen', 'Bootstrap pós-login falhou', e);
        Alert.alert(
          'Aviso',
          'Sessão iniciada, mas dados da empresa não puderam ser baixados agora. Tentaremos novamente em segundo plano.',
        );
        navigation.replace('Kiosk');
      }
    } catch (e: unknown) {
      const apiErr = e as { response?: { data?: { error?: string } }; message?: string };
      const msg =
        apiErr?.response?.data?.error ?? apiErr?.message ?? 'Erro desconhecido';
      logger.warn('LoginScreen', `Login falhou: ${msg}`);
      setError(msg);
    } finally {
      setLoading(false);
    }
  }

  return (
    <SafeAreaView style={styles.safe}>
      <KeyboardAvoidingView
        behavior={Platform.OS === 'ios' ? 'padding' : undefined}
        style={styles.flex}
      >
        <ScrollView
          contentContainerStyle={styles.scroll}
          keyboardShouldPersistTaps="handled"
        >
          <View style={styles.brand}>
            <Text style={styles.brandTitle}>REGISTRA.PONTO</Text>
            <Text style={styles.brandSubtitle}>Terminal de Ponto Eletrônico</Text>
          </View>

          <View style={styles.card}>
            <Text style={styles.cardTitle}>Acesso da Empresa</Text>
            <Text style={styles.cardHint}>
              Use as credenciais corporativas para ativar este tablet como terminal.
            </Text>

            <TextField
              label="Usuário"
              autoCapitalize="none"
              autoCorrect={false}
              autoComplete="username"
              value={usuario}
              onChangeText={setUsuario}
              editable={!loading}
            />
            <TextField
              label="Senha"
              secureTextEntry
              autoCapitalize="none"
              autoCorrect={false}
              autoComplete="current-password"
              value={senha}
              onChangeText={setSenha}
              editable={!loading}
              errorText={error ?? undefined}
              onSubmitEditing={handleLogin}
            />

            <View style={styles.rememberRow}>
              <Text style={styles.rememberLabel}>Lembrar credenciais neste tablet</Text>
              <Switch
                value={lembrar}
                onValueChange={setLembrar}
                trackColor={{ false: theme.colors.border, true: theme.colors.accent }}
                thumbColor={theme.colors.text}
                disabled={loading}
              />
            </View>

            <PrimaryButton
              label="Ativar terminal"
              onPress={handleLogin}
              loading={loading}
            />
          </View>

          <Text style={styles.footer}>
            v1.0 · Modo offline-first · Reconhecimento facial híbrido
          </Text>
        </ScrollView>
      </KeyboardAvoidingView>
    </SafeAreaView>
  );
}

const styles = StyleSheet.create({
  safe: { flex: 1, backgroundColor: theme.colors.bg },
  flex: { flex: 1 },
  scroll: {
    flexGrow: 1,
    padding: theme.spacing.xl,
    justifyContent: 'center',
    gap: theme.spacing.xl,
  },
  brand: { alignItems: 'center', gap: 4 },
  brandTitle: {
    color: theme.colors.text,
    fontSize: 32,
    fontWeight: '800',
    letterSpacing: 1,
  },
  brandSubtitle: { color: theme.colors.textDim, fontSize: 14 },
  card: {
    backgroundColor: theme.colors.bgCard,
    borderRadius: theme.radii.lg,
    padding: theme.spacing.lg,
    borderWidth: 1,
    borderColor: theme.colors.border,
    gap: theme.spacing.sm,
  },
  cardTitle: { color: theme.colors.text, fontSize: 22, fontWeight: '700' },
  cardHint: { color: theme.colors.textDim, fontSize: 13, marginBottom: theme.spacing.sm },
  rememberRow: {
    flexDirection: 'row',
    alignItems: 'center',
    justifyContent: 'space-between',
    paddingVertical: 4,
  },
  rememberLabel: { color: theme.colors.textDim, fontSize: 13, flex: 1 },
  footer: { color: theme.colors.textMuted, fontSize: 11, textAlign: 'center' },
});
