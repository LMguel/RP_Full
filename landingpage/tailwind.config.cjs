module.exports = {
  darkMode: 'class', // ativar tema via classe `dark` no <html>
  content: ['./index.html', './src/**/*.{js,jsx}'],
  theme: {
    extend: {
      fontFamily: {
        sans: ['Inter', 'ui-sans-serif', 'system-ui', '-apple-system', 'Segoe UI', 'Roboto']
      },
      colors: {
        brand: {
          900: '#0B1224',
          700: '#07203A',
          500: '#0F6BFF',
        }
      }
    }
  },
  plugins: [],
}