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
          bg:            '#FFFFFF',
          surface:       '#F4F8FF',
          card:          '#FFFFFF',
          elevated:      '#EBF2FF',
          blue:          '#1847D6',
          'blue-light':  '#3B7BF7',
          'blue-dim':    'rgba(24,71,214,0.08)',
          'blue-glow':   'rgba(24,71,214,0.18)',
          sky:           '#38BDF8',
          border:        'rgba(24,71,214,0.10)',
          'border-hover':'rgba(24,71,214,0.22)',
          text:          '#0C1A38',
          'text-body':   '#4D5E7A',
          'text-muted':  '#8FA0BE',
        },
      },
      backgroundImage: {
        'gradient-radial': 'radial-gradient(var(--tw-gradient-stops))',
        'dot-grid':  "url(\"data:image/svg+xml,%3csvg xmlns='http://www.w3.org/2000/svg' viewBox='0 0 40 40' width='40' height='40'%3e%3ccircle cx='20' cy='20' r='0.8' fill='rgba(24%2c71%2c214%2c0.06)'/%3e%3c/svg%3e\")",
        'hero-grid': "url(\"data:image/svg+xml,%3csvg xmlns='http://www.w3.org/2000/svg' viewBox='0 0 40 40' width='40' height='40' fill='none' stroke='rgba(24%2c71%2c214%2c0.04)'%3e%3cpath d='M0 .5H39.5V40'/%3e%3c/svg%3e\")",
      },
      boxShadow: {
        'glow-blue':     '0 0 60px rgba(24,71,214,0.18)',
        'glow-blue-sm':  '0 0 30px rgba(24,71,214,0.12)',
        card:            '0 4px 32px rgba(24,71,214,0.08)',
        'card-lg':       '0 16px 64px rgba(24,71,214,0.14)',
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
