import { defineConfig } from 'vite'
import react from '@vitejs/plugin-react'
import legacy from '@vitejs/plugin-legacy'
import { VitePWA } from 'vite-plugin-pwa'

// https://vite.dev/config/
export default defineConfig({
  base: '/',
  plugins: [
    react(),

    // Gera um bundle legado (ES5 + polyfills) para browsers antigos.
    // Windows 7: Chrome 66–109 e Firefox 60–116 são cobertos por esses targets.
    legacy({
      targets: [
        'Chrome >= 66',
        'Firefox >= 60',
        'Safari >= 11',
        'Edge >= 18',
      ],
      // Polyfills incluídos no bundle legado
      additionalLegacyPolyfills: ['regenerator-runtime/runtime'],
      renderLegacyChunks: true,
      polyfills: true,
      modernPolyfills: true,
    }),

    VitePWA({
      registerType: 'autoUpdate',
      includeAssets: ['favicon.ico', 'logo.png', 'icon-192x192.png', 'icon-512x512.png'],
      manifest: {
        name: 'REGISTRA.PONTO',
        short_name: 'RP',
        description: 'Sistema de controle de ponto eletrônico',
        theme_color: '#1e40af',
        background_color: '#1e40af',
        display: 'standalone',
        start_url: '/',
        scope: '/',
        icons: [
          { src: '/icon-192x192.png', sizes: '192x192', type: 'image/png' },
          { src: '/icon-512x512.png', sizes: '512x512', type: 'image/png', purpose: 'any maskable' }
        ]
      },
      workbox: {
        globPatterns: ['**/*.{js,css,html,ico,png,svg,woff2}'],
        maximumFileSizeToCacheInBytes: 10 * 1024 * 1024,
      },
      devOptions: {
        enabled: true
      }
    })
  ],
  server: {
    host: '0.0.0.0',
    port: 3000
  },
  build: {
    outDir: 'dist',
    sourcemap: false,
    target: 'es2015',
    cssTarget: 'chrome66',
    minify: 'terser',
    terserOptions: {
      compress: {
        drop_console: false,
      },
    },
    rollupOptions: {
      output: {
        manualChunks: {
          vendor: ['react', 'react-dom'],
          mui: ['@mui/material', '@mui/icons-material'],
          motion: ['framer-motion'],
        },
      },
    },
  },
  define: {
    global: 'globalThis',
  },
})
