import React, { useEffect, useState } from 'react';
import { StatusBar, StyleSheet, Text, View } from 'react-native';
import { GestureHandlerRootView } from 'react-native-gesture-handler';
import { SafeAreaProvider } from 'react-native-safe-area-context';
import { NavigationContainer } from '@react-navigation/native';
import { QueryClientProvider } from '@tanstack/react-query';

import { queryClient } from './queryClient';
import { theme } from './theme';
import { bootstrapApp } from './bootstrap';
import { RootNavigator } from '@navigation/RootNavigator';
import { useAuthStore } from '@features/auth/authStore';
import { SyncService } from '@services/syncService';

export default function App() {
  const [ready, setReady] = useState(false);
  const [bootError, setBootError] = useState<string | null>(null);

  useEffect(() => {
    bootstrapApp()
      .then(() => setReady(true))
      .catch(e => {
        console.error('Boot error', e);
        setBootError((e as Error)?.message ?? 'Erro ao iniciar');
      });
  }, []);

  useEffect(() => {
    return useAuthStore.subscribe((state, prev) => {
      const had = !!prev.session;
      const has = !!state.session;
      if (!had && has) {
        void SyncService.start();
      } else if (had && !has) {
        void SyncService.stop();
      }
    });
  }, []);

  if (bootError) {
    return (
      <View style={styles.errorBox}>
        <Text style={styles.errorTitle}>Falha ao iniciar</Text>
        <Text style={styles.errorMsg}>{bootError}</Text>
      </View>
    );
  }

  return (
    <GestureHandlerRootView style={styles.flex}>
      <QueryClientProvider client={queryClient}>
        <SafeAreaProvider>
          <StatusBar barStyle="light-content" backgroundColor={theme.colors.bg} />
          <NavigationContainer>
            <RootNavigator />
          </NavigationContainer>
        </SafeAreaProvider>
      </QueryClientProvider>
    </GestureHandlerRootView>
  );
}

const styles = StyleSheet.create({
  flex: { flex: 1, backgroundColor: theme.colors.bg },
  errorBox: {
    flex: 1,
    backgroundColor: theme.colors.bg,
    alignItems: 'center',
    justifyContent: 'center',
    padding: theme.spacing.xl,
    gap: theme.spacing.md,
  },
  errorTitle: { color: theme.colors.danger, fontSize: 18, fontWeight: '700' },
  errorMsg: { color: theme.colors.textDim, fontSize: 14, textAlign: 'center' },
});
