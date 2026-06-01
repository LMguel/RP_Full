import React, { useEffect, useState } from 'react';
import { Alert, ScrollView, StyleSheet, Switch, Text, View } from 'react-native';
import { SafeAreaView } from 'react-native-safe-area-context';
import { theme } from '@app/theme';
import { PrimaryButton } from '@components/PrimaryButton';
import { TextField } from '@components/TextField';
import { useConfigStore } from './configStore';
import { useAuthStore } from '@features/auth/authStore';
import { SyncService } from '@services/syncService';
import { BootstrapService } from '@services/bootstrapService';
import { KioskService } from '@features/kiosk/kioskService';
import { DeviceIdService } from '@services/deviceIdService';
import { useSyncStore } from '@features/sync/syncStore';
import { logger } from '@utils/logger';
import { SecureStorage } from '@storage/secureStorage';
import type { ScreenProps } from '@/types/navigation';

export function SettingsScreen({ navigation }: ScreenProps<'Settings'>) {
  const { config, update } = useConfigStore();
  const { session, clear } = useAuthStore();
  const sync = useSyncStore();

  const [apiUrl, setApiUrl] = useState(config.apiBaseUrl);
  const [threshold, setThreshold] = useState(String(config.faceSimilarityThreshold));
  const [deviceId, setDeviceId] = useState<string>('-');
  const [hasSavedCreds, setHasSavedCreds] = useState(false);

  useEffect(() => {
    DeviceIdService.get().then(d => setDeviceId(d ?? '-'));
    SecureStorage.getLoginCredentials().then(c => setHasSavedCreds(!!c));
  }, []);

  function saveApi() {
    update({ apiBaseUrl: apiUrl.trim() });
    Alert.alert('OK', 'URL atualizada');
  }

  function saveThreshold() {
    const n = parseFloat(threshold);
    if (isNaN(n) || n <= 0 || n > 1) {
      Alert.alert('Valor inválido', 'Use entre 0 e 1');
      return;
    }
    update({ faceSimilarityThreshold: n });
  }

  async function handleResync() {
    if (!session) return;
    try {
      const r = await BootstrapService.pullCompanyData(session.company_id);
      Alert.alert(
        'Sincronizado',
        `${r.employees} funcionários · ${r.embeddings} embeddings`,
      );
    } catch (e) {
      logger.error('Settings', 'Resync falhou', e);
      Alert.alert('Erro', 'Falha ao sincronizar. Verifique a conexão.');
    }
  }

  async function handleLogout() {
    Alert.alert(
      'Sair do terminal',
      'Isto encerrará o modo kiosk e exigirá novo login.',
      [
        { text: 'Cancelar', style: 'cancel' },
        {
          text: 'Sair',
          style: 'destructive',
          onPress: async () => {
            await KioskService.stop();
            await clear();
            navigation.reset({ index: 0, routes: [{ name: 'Login' }] });
          },
        },
      ],
    );
  }

  return (
    <SafeAreaView style={styles.safe}>
      <ScrollView contentContainerStyle={styles.scroll}>
        <Text style={styles.title}>Ajustes do terminal</Text>

        <View style={styles.card}>
          <Text style={styles.cardTitle}>Sessão</Text>
          <Row label="Empresa" value={session?.empresa_nome ?? '-'} />
          <Row label="Usuário" value={session?.usuario_id ?? '-'} />
          <Row label="Device ID" value={deviceId} small />
          {hasSavedCreds && (
            <PrimaryButton
              label="Limpar credenciais salvas"
              onPress={() => {
                Alert.alert(
                  'Limpar credenciais',
                  'Remove o usuário e senha salvos neste tablet. Na próxima vez será necessário digitar as credenciais manualmente.',
                  [
                    { text: 'Cancelar', style: 'cancel' },
                    {
                      text: 'Limpar',
                      style: 'destructive',
                      onPress: async () => {
                        await SecureStorage.clearLoginCredentials();
                        setHasSavedCreds(false);
                      },
                    },
                  ],
                );
              }}
              variant="ghost"
            />
          )}
        </View>

        <View style={styles.card}>
          <Text style={styles.cardTitle}>Sincronização</Text>
          <Row label="Status" value={sync.isOnline ? 'Online' : 'Offline'} />
          <Row label="Pendentes" value={String(sync.pendingCount)} />
          <Row label="Última sync" value={sync.lastSyncAt ?? 'Nunca'} small />
          <View style={{ flexDirection: 'row', gap: 8 }}>
            <PrimaryButton
              label="Sincronizar agora"
              onPress={() => SyncService.kick('manual')}
              variant="ghost"
              style={{ flex: 1 }}
            />
            <PrimaryButton
              label="Repuxar dados"
              onPress={handleResync}
              variant="ghost"
              style={{ flex: 1 }}
            />
          </View>
        </View>

        <View style={styles.card}>
          <Text style={styles.cardTitle}>API</Text>
          <TextField
            label="URL base"
            value={apiUrl}
            onChangeText={setApiUrl}
            autoCapitalize="none"
            autoCorrect={false}
            keyboardType="url"
          />
          <PrimaryButton label="Salvar URL" onPress={saveApi} variant="ghost" />
        </View>

        <View style={styles.card}>
          <Text style={styles.cardTitle}>Reconhecimento facial</Text>
          <TextField
            label="Threshold de similaridade (0-1)"
            value={threshold}
            onChangeText={setThreshold}
            onBlur={saveThreshold}
            keyboardType="decimal-pad"
          />
          <RowSwitch
            label="Permitir fallback cloud (Rekognition)"
            value={config.faceUseCloudFallback}
            onChange={v => update({ faceUseCloudFallback: v })}
          />
          <PrimaryButton
            label="Abrir calibração avançada"
            onPress={() => navigation.navigate('Calibration')}
            variant="ghost"
          />
        </View>

        <View style={styles.card}>
          <Text style={styles.cardTitle}>Kiosk</Text>
          <RowSwitch
            label="Bloqueio automático ao iniciar"
            value={config.kioskAutoLock}
            onChange={v => update({ kioskAutoLock: v })}
          />
          <RowSwitch
            label="Iniciar no boot do tablet"
            value={config.kioskBootAutoStart}
            onChange={v => {
              update({ kioskBootAutoStart: v });
              KioskService.setBootStartEnabled(v);
            }}
          />
          <View style={{ flexDirection: 'row', gap: 8 }}>
            <PrimaryButton
              label="Ativar kiosk"
              onPress={() => KioskService.start()}
              variant="ghost"
              style={{ flex: 1 }}
            />
            <PrimaryButton
              label="Desativar kiosk"
              onPress={() => KioskService.stop()}
              variant="ghost"
              style={{ flex: 1 }}
            />
          </View>
        </View>

        <PrimaryButton label="Sair do terminal" onPress={handleLogout} variant="danger" />
        <PrimaryButton
          label="Voltar ao kiosk"
          onPress={() => navigation.goBack()}
          variant="ghost"
        />
      </ScrollView>
    </SafeAreaView>
  );
}

function Row({ label, value, small }: { label: string; value: string; small?: boolean }) {
  return (
    <View style={styles.row}>
      <Text style={styles.rowLabel}>{label}</Text>
      <Text
        style={[styles.rowValue, small && { fontSize: 11 }]}
        numberOfLines={1}
        ellipsizeMode="middle"
      >
        {value}
      </Text>
    </View>
  );
}

function RowSwitch({
  label,
  value,
  onChange,
}: {
  label: string;
  value: boolean;
  onChange: (v: boolean) => void;
}) {
  return (
    <View style={styles.row}>
      <Text style={styles.rowLabel}>{label}</Text>
      <Switch value={value} onValueChange={onChange} />
    </View>
  );
}

const styles = StyleSheet.create({
  safe: { flex: 1, backgroundColor: theme.colors.bg },
  scroll: { padding: theme.spacing.lg, gap: theme.spacing.md, paddingBottom: theme.spacing.xxl },
  title: { color: theme.colors.text, fontSize: 24, fontWeight: '700' },
  card: {
    backgroundColor: theme.colors.bgCard,
    borderRadius: theme.radii.md,
    borderWidth: 1,
    borderColor: theme.colors.border,
    padding: theme.spacing.md,
    gap: theme.spacing.sm,
  },
  cardTitle: {
    color: theme.colors.text,
    fontSize: 14,
    fontWeight: '700',
    textTransform: 'uppercase',
    letterSpacing: 1,
    marginBottom: 4,
  },
  row: { flexDirection: 'row', justifyContent: 'space-between', alignItems: 'center', gap: 12 },
  rowLabel: { color: theme.colors.textDim, fontSize: 13, flex: 1 },
  rowValue: { color: theme.colors.text, fontSize: 13, fontWeight: '600', maxWidth: '60%' },
});
