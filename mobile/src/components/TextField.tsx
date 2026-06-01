import React from 'react';
import { StyleSheet, Text, TextInput, type TextInputProps, View } from 'react-native';
import { theme } from '@app/theme';

interface Props extends TextInputProps {
  label: string;
  errorText?: string;
}

export function TextField({ label, errorText, style, ...rest }: Props) {
  return (
    <View style={styles.wrap}>
      <Text style={styles.label}>{label}</Text>
      <TextInput
        placeholderTextColor={theme.colors.textMuted}
        style={[styles.input, !!errorText && styles.inputError, style]}
        {...rest}
      />
      {errorText ? <Text style={styles.error}>{errorText}</Text> : null}
    </View>
  );
}

const styles = StyleSheet.create({
  wrap: { gap: 6, marginBottom: theme.spacing.md },
  label: { color: theme.colors.textDim, fontSize: 13, letterSpacing: 0.5, fontWeight: '600' },
  input: {
    height: 56,
    backgroundColor: theme.colors.bgElevated,
    borderRadius: theme.radii.md,
    borderWidth: 1,
    borderColor: theme.colors.border,
    paddingHorizontal: 16,
    color: theme.colors.text,
    fontSize: 16,
  },
  inputError: { borderColor: theme.colors.danger },
  error: { color: theme.colors.danger, fontSize: 12 },
});
