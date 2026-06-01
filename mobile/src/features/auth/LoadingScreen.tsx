import React from 'react';
import { ActivityIndicator, StyleSheet, Text, View } from 'react-native';
import { theme } from '@app/theme';

export function LoadingScreen() {
  return (
    <View style={styles.wrap}>
      <Text style={styles.brand}>REGISTRA.PONTO</Text>
      <ActivityIndicator color={theme.colors.accent} size="large" />
      <Text style={styles.msg}>Inicializando terminal…</Text>
    </View>
  );
}

const styles = StyleSheet.create({
  wrap: {
    flex: 1,
    backgroundColor: theme.colors.bg,
    alignItems: 'center',
    justifyContent: 'center',
    gap: theme.spacing.md,
  },
  brand: { color: theme.colors.text, fontSize: 24, fontWeight: '800', letterSpacing: 1 },
  msg: { color: theme.colors.textDim, fontSize: 13 },
});
