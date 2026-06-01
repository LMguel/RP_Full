import React, { useEffect, useState } from 'react';
import { Pressable, StyleSheet, Text, View } from 'react-native';
import { SafeAreaView } from 'react-native-safe-area-context';
import { theme } from '@app/theme';
import { Clock } from '@components/Clock';
import { StatusBar } from '@components/StatusBar';
import { PrimaryButton } from '@components/PrimaryButton';
import { useAuthStore } from '@features/auth/authStore';
import { useKioskStore } from './kioskStore';
import type { ScreenProps } from '@/types/navigation';
import { EmployeeRepository } from '@repositories/employeeRepository';

export function KioskScreen({ navigation }: ScreenProps<'Kiosk'>) {
  const session = useAuthStore(s => s.session);
  const flow = useKioskStore(s => s.flow);
  const lastEmployeeName = useKioskStore(s => s.lastEmployeeName);
  const [employeeCount, setEmployeeCount] = useState<number>(0);

  useEffect(() => {
    if (!session) return;
    EmployeeRepository.count(session.company_id).then(setEmployeeCount).catch(() => {});
  }, [session]);

  return (
    <SafeAreaView style={styles.safe} edges={['top', 'bottom']}>
      <StatusBar companyName={session?.empresa_nome} />

      <View style={styles.body}>
        <Clock />

        <View style={styles.cta}>
          <Text style={styles.title}>Aproxime o rosto da câmera</Text>
          <Text style={styles.subtitle}>
            ou toque no botão abaixo para iniciar o registro de ponto
          </Text>
        </View>

        <View style={styles.actions}>
          <PrimaryButton
            label="Iniciar reconhecimento"
            onPress={() => navigation.navigate('FacialScan')}
          />
        </View>

        {flow !== 'IDLE' && lastEmployeeName ? (
          <View style={styles.lastBox}>
            <Text style={styles.lastLabel}>Último ponto registrado</Text>
            <Text style={styles.lastName}>{lastEmployeeName}</Text>
          </View>
        ) : null}
      </View>

      <View style={styles.footer}>
        <Text style={styles.footerInfo}>
          {employeeCount} funcionário{employeeCount === 1 ? '' : 's'} cadastrado{employeeCount === 1 ? '' : 's'}
        </Text>
        <Pressable
          onLongPress={() => navigation.navigate('Settings')}
          delayLongPress={1500}
          hitSlop={20}
        >
          <Text style={styles.adminHint}>● Pressione e segure 1.5s para ajustes</Text>
        </Pressable>
      </View>
    </SafeAreaView>
  );
}

const styles = StyleSheet.create({
  safe: { flex: 1, backgroundColor: theme.colors.bg },
  body: {
    flex: 1,
    paddingHorizontal: theme.spacing.xl,
    paddingTop: theme.spacing.xxl,
    gap: theme.spacing.xl,
    alignItems: 'center',
    justifyContent: 'center',
  },
  cta: { alignItems: 'center', gap: 8, marginTop: theme.spacing.lg },
  title: { color: theme.colors.text, fontSize: 26, fontWeight: '700', textAlign: 'center' },
  subtitle: { color: theme.colors.textDim, fontSize: 16, textAlign: 'center', maxWidth: 360 },
  actions: { alignSelf: 'center', maxWidth: 420, width: '100%' },
  lastBox: {
    backgroundColor: theme.colors.bgCard,
    borderRadius: theme.radii.lg,
    paddingVertical: theme.spacing.md,
    paddingHorizontal: theme.spacing.lg,
    borderWidth: 1,
    borderColor: theme.colors.border,
    alignItems: 'center',
    gap: 4,
  },
  lastLabel: { color: theme.colors.textDim, fontSize: 12, letterSpacing: 0.5 },
  lastName: { color: theme.colors.text, fontSize: 18, fontWeight: '700' },
  footer: {
    paddingHorizontal: theme.spacing.lg,
    paddingVertical: theme.spacing.md,
    borderTopWidth: 1,
    borderTopColor: theme.colors.border,
    flexDirection: 'row',
    justifyContent: 'space-between',
  },
  footerInfo: { color: theme.colors.textMuted, fontSize: 11 },
  adminHint: { color: theme.colors.textMuted, fontSize: 11 },
});
