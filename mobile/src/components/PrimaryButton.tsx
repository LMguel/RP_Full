import React from 'react';
import {
  ActivityIndicator,
  Pressable,
  StyleSheet,
  Text,
  type PressableProps,
  View,
} from 'react-native';
import { theme } from '@app/theme';

interface Props extends Omit<PressableProps, 'children'> {
  label: string;
  loading?: boolean;
  variant?: 'primary' | 'ghost' | 'danger';
}

export function PrimaryButton({ label, loading, variant = 'primary', disabled, style, ...rest }: Props) {
  const palette = {
    primary: { bg: theme.colors.accent, text: '#FFF' },
    ghost: { bg: 'transparent', text: theme.colors.textDim },
    danger: { bg: theme.colors.danger, text: '#FFF' },
  }[variant];

  return (
    <Pressable
      {...rest}
      disabled={disabled || loading}
      style={state => [
        styles.btn,
        { backgroundColor: palette.bg, opacity: disabled ? 0.5 : state.pressed ? 0.85 : 1 },
        variant === 'ghost' && styles.ghost,
        typeof style === 'function' ? style(state) : style,
      ]}
    >
      {loading ? (
        <ActivityIndicator color={palette.text} />
      ) : (
        <View style={styles.row}>
          <Text style={[styles.label, { color: palette.text }]}>{label}</Text>
        </View>
      )}
    </Pressable>
  );
}

const styles = StyleSheet.create({
  btn: {
    height: 56,
    borderRadius: theme.radii.md,
    paddingHorizontal: theme.spacing.lg,
    alignItems: 'center',
    justifyContent: 'center',
  },
  ghost: {
    borderWidth: 1,
    borderColor: theme.colors.border,
  },
  row: { flexDirection: 'row', alignItems: 'center', gap: 8 },
  label: { fontSize: 16, fontWeight: '600' },
});
