import React from 'react';
import { StyleSheet, Text, View } from 'react-native';
import { theme } from '@app/theme';
import { useSyncStore } from '@features/sync/syncStore';

export function StatusBar({ companyName }: { companyName?: string }) {
  const { isOnline, pendingCount, isSyncing } = useSyncStore();

  return (
    <View style={styles.wrap}>
      <View style={styles.left}>
        <View style={[styles.dot, { backgroundColor: isOnline ? theme.colors.success : theme.colors.warn }]} />
        <Text style={styles.txt}>{isOnline ? 'Online' : 'Offline'}</Text>
        {isSyncing && <Text style={styles.txtMuted}>· sincronizando…</Text>}
        {pendingCount > 0 && (
          <Text style={styles.pending}>· {pendingCount} pendente{pendingCount > 1 ? 's' : ''}</Text>
        )}
      </View>
      {companyName ? <Text style={styles.company}>{companyName}</Text> : null}
    </View>
  );
}

const styles = StyleSheet.create({
  wrap: {
    flexDirection: 'row',
    justifyContent: 'space-between',
    alignItems: 'center',
    paddingHorizontal: theme.spacing.md,
    paddingVertical: theme.spacing.sm,
    backgroundColor: theme.colors.bgElevated,
    borderBottomWidth: 1,
    borderBottomColor: theme.colors.border,
  },
  left: { flexDirection: 'row', alignItems: 'center', gap: 6 },
  dot: { width: 8, height: 8, borderRadius: 4 },
  txt: { color: theme.colors.text, fontSize: 12, fontWeight: '600' },
  txtMuted: { color: theme.colors.textDim, fontSize: 12 },
  pending: { color: theme.colors.warn, fontSize: 12, fontWeight: '600' },
  company: { color: theme.colors.textDim, fontSize: 12 },
});
