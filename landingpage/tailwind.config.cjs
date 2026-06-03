module.exports = {
  content: ['./index.html', './src/**/*.{js,jsx}'],
  theme: {
    screens: {
      xs:  '400px',
      sm:  '640px',
      md:  '768px',
      lg:  '1024px',
      xl:  '1280px',
      '2xl': '1536px',
    },
    extend: {
      fontFamily: {
        sans: ['DM Sans', 'ui-sans-serif', 'system-ui', '-apple-system'],
        heading: ['Outfit', 'sans-serif'],
        display: ['Outfit', 'sans-serif'],
      },
      colors: {
        rp: {
          bg:            '#050C18',
          surface:       '#070F1F',
          card:          '#0B1527',
          elevated:      '#101D32',
          green:         '#00E87A',
          'green-dim':   'rgba(0,232,122,0.12)',
          'green-glow':  'rgba(0,232,122,0.20)',
          blue:          '#3B82F6',
          'blue-dim':    'rgba(59,130,246,0.10)',
          cyan:          '#06B6D4',
          border:        'rgba(255,255,255,0.07)',
          'border-hover':'rgba(255,255,255,0.14)',
        },
      },
      backgroundImage: {
        'gradient-radial': 'radial-gradient(var(--tw-gradient-stops))',
        'dot-grid':  "url(\"data:image/svg+xml,%3csvg xmlns='http://www.w3.org/2000/svg' viewBox='0 0 40 40' width='40' height='40'%3e%3ccircle cx='20' cy='20' r='0.8' fill='rgba(255,255,255,0.05)'/%3e%3c/svg%3e\")",
        'hero-grid': "url(\"data:image/svg+xml,%3csvg xmlns='http://www.w3.org/2000/svg' viewBox='0 0 40 40' width='40' height='40' fill='none' stroke='rgba(255,255,255,0.03)'%3e%3cpath d='M0 .5H39.5V40'/%3e%3c/svg%3e\")",
      },
      boxShadow: {
        'glow-green':    '0 0 60px rgba(0,232,122,0.18)',
        'glow-green-sm': '0 0 30px rgba(0,232,122,0.12)',
        'glow-blue':     '0 0 60px rgba(59,130,246,0.15)',
        card:            '0 4px 32px rgba(0,0,0,0.5)',
        'card-lg':       '0 16px 64px rgba(0,0,0,0.6)',
      },
      animation: {
        'float':      'float 5s ease-in-out infinite',
        'pulse-slow': 'pulse 4s ease-in-out infinite',
        'shimmer':    'shimmer 2s linear infinite',
      },
      keyframes: {
        float: {
          '0%, 100%': { transform: 'translateY(0)' },
          '50%':       { transform: 'translateY(-14px)' },
        },
        shimmer: {
          '0%':   { backgroundPosition: '-200% center' },
          '100%': { backgroundPosition: '200% center' },
        },
      },
    },
  },
  plugins: [],
}
