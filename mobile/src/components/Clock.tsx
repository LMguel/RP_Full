import React, { useEffect, useState } from 'react';
import { StyleSheet, Text, View } from 'react-native';
import { theme } from '@app/theme';
import { formatClockHM, formatDateLong } from '@utils/time';

export function Clock() {
  const [now, setNow] = useState(new Date());

  useEffect(() => {
    const t = setInterval(() => setNow(new Date()), 1000);
    return () => clearInterval(t);
  }, []);

  return (
    <View style={styles.wrap}>
      <Text style={styles.time}>{formatClockHM(now)}</Text>
      <Text style={styles.date}>{formatDateLong(now)}</Text>
    </View>
  );
}

const styles = StyleSheet.create({
  wrap: { alignItems: 'center', gap: 4 },
  time: { color: theme.colors.text, fontSize: 96, fontWeight: '700', letterSpacing: -2 },
  date: { color: theme.colors.textDim, fontSize: 18, textTransform: 'capitalize' },
});
