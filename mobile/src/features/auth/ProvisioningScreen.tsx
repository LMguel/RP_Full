import React from 'react';
import { ActivityIndicator, StyleSheet, Text, View } from 'react-native';
import { theme } from '@app/theme';

export function ProvisioningScreen() {
  return (
    <View style={styles.wrap}>
      <Text style={styles.title}>Preparando terminal</Text>
      <ActivityIndicator color={theme.colors.accent} size="large" />
      <Text style={styles.subtitle}>
        Baixando funcionários, embeddings faciais e configurações da empresa.
      </Text>
      <Text style={styles.note}>Necessário apenas na primeira vez. Não desligue o aparelho.</Text>
    </View>
  );
}

const styles = StyleSheet.create({
  wrap: {
    flex: 1,
    backgroundColor: theme.colors.bg,
    alignItems: 'center',
    justifyContent: 'center',
    padding: theme.spacing.xl,
    gap: theme.spacing.md,
  },
  title: { color: theme.colors.text, fontSize: 22, fontWeight: '700' },
  subtitle: {
    color: theme.colors.textDim,
    fontSize: 14,
    textAlign: 'center',
    maxWidth: 360,
  },
  note: { color: theme.colors.textMuted, fontSize: 12, textAlign: 'center' },
});
