module.exports = {
  content: ['./index.html', './src/**/*.{js,jsx}'],
  theme: {
    extend: {
      fontFamily: {
        sans: ['Inter', 'ui-sans-serif', 'system-ui', '-apple-system'],
        heading: ['Inter', 'sans-serif'],
      },
      colors: {
        rp: {
          bg: '#050B18',
          surface: '#080F1E',
          card: '#0D1B2E',
          elevated: '#122035',
          blue: '#3B82F6',
          'blue-dim': 'rgba(59,130,246,0.12)',
          cyan: '#06B6D4',
          'cyan-dim': 'rgba(6,182,212,0.12)',
          green: '#10B981',
          'green-dim': 'rgba(16,185,129,0.12)',
          border: 'rgba(255,255,255,0.07)',
          'border-hover': 'rgba(255,255,255,0.14)',
        },
      },
      backgroundImage: {
        'gradient-radial': 'radial-gradient(var(--tw-gradient-stops))',
        'hero-grid': "url(\"data:image/svg+xml,%3csvg xmlns='http://www.w3.org/2000/svg' viewBox='0 0 32 32' width='32' height='32' fill='none' stroke='rgba(255,255,255,0.04)'%3e%3cpath d='M0 .5H31.5V32'/%3e%3c/svg%3e\")",
      },
      boxShadow: {
        glow: '0 0 60px rgba(59,130,246,0.15)',
        'glow-sm': '0 0 30px rgba(59,130,246,0.10)',
        'glow-green': '0 0 60px rgba(16,185,129,0.15)',
        card: '0 4px 32px rgba(0,0,0,0.5)',
        'card-lg': '0 16px 64px rgba(0,0,0,0.6)',
      },
      animation: {
        'float': 'float 6s ease-in-out infinite',
        'pulse-slow': 'pulse 4s ease-in-out infinite',
        'gradient': 'gradient 8s ease infinite',
        'spin-slow': 'spin 20s linear infinite',
      },
      keyframes: {
        float: {
          '0%, 100%': { transform: 'translateY(0)' },
          '50%': { transform: 'translateY(-12px)' },
        },
        gradient: {
          '0%, 100%': { backgroundPosition: '0% 50%' },
          '50%': { backgroundPosition: '100% 50%' },
        },
      },
    },
  },
  plugins: [],
}
