/**
 * Tema dark premium - terminal de ponto profissional.
 */
export const theme = {
  colors: {
    bg: '#0B0F1A',
    bgElevated: '#121826',
    bgCard: '#161D2E',
    border: '#1F2A40',
    text: '#FFFFFF',
    textDim: '#9CA8C2',
    textMuted: '#5E6B85',
    accent: '#3B82F6',
    accentBright: '#60A5FA',
    success: '#10B981',
    warn: '#F59E0B',
    danger: '#EF4444',
    overlay: 'rgba(0,0,0,0.55)',
  },
  radii: {
    sm: 6,
    md: 12,
    lg: 20,
    xl: 28,
    full: 999,
  },
  spacing: {
    xs: 4,
    sm: 8,
    md: 16,
    lg: 24,
    xl: 32,
    xxl: 48,
  },
  typography: {
    h1: { fontSize: 36, fontWeight: '700' as const },
    h2: { fontSize: 28, fontWeight: '700' as const },
    h3: { fontSize: 22, fontWeight: '600' as const },
    body: { fontSize: 16, fontWeight: '400' as const },
    label: { fontSize: 14, fontWeight: '500' as const },
    mono: { fontSize: 14, fontFamily: 'monospace' },
  },
};

export type Theme = typeof theme;
