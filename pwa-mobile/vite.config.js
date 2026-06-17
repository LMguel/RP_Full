import { defineConfig } from 'vite';
import react from '@vitejs/plugin-react';
import { VitePWA } from 'vite-plugin-pwa';
import basicSsl from '@vitejs/plugin-basic-ssl';
import { createRequire } from 'module';
const require = createRequire(import.meta.url);
const { version } = require('./package.json');

export default defineConfig({
  define: {
    // Versão do package.json injetada em build-time — usada pelo badge de versão no kiosk
    __APP_VERSION__: JSON.stringify(process.env.VITE_APP_VERSION || version),
  },
  plugins: [
    react(),
    // basicSsl removed for local dev to avoid self-signed SSL issues in the browser
    VitePWA({
      registerType: 'prompt',
      includeAssets: ['favicon.ico', 'apple-touch-icon.png', 'icon-192x192.png', 'icon-512x512.png'],
      manifest: {
        name: 'Registro de Ponto',
        short_name: 'RP Mobile',
        description: 'Sistema de Registro de Ponto com Geolocalização e Reconhecimento Facial',
        theme_color: '#2563eb',
        background_color: '#ffffff',
        display: 'fullscreen',
        orientation: 'portrait',
        start_url: '/',
        scope: '/',
        permissions: ['geolocation', 'camera'],
        icons: [
          {
            src: '/icon-192x192.png',
            sizes: '192x192',
            type: 'image/png',
            purpose: 'any'
          },
          {
            src: '/icon-512x512.png',
            sizes: '512x512',
            type: 'image/png',
            purpose: 'any'
          },
          {
            src: '/icon-512x512.png',
            sizes: '512x512',
            type: 'image/png',
            purpose: 'maskable'
          }
        ],
        categories: ['business', 'productivity'],
        shortcuts: [
          {
            name: 'Registrar Ponto',
            short_name: 'Ponto',
            description: 'Registrar entrada/saída',
            url: '/',
            icons: [{ src: '/icon-192x192.png', sizes: '192x192' }]
          }
        ]
      },
      workbox: {
        clientsClaim: true,
        cleanupOutdatedCaches: true,
        globPatterns: ['**/*.{js,css,html,ico,png,svg,woff2}'],
        runtimeCaching: [
          {
            urlPattern: /^https:\/\/.*\.(?:png|jpg|jpeg|svg|gif)$/,
            handler: 'CacheFirst',
            options: {
              cacheName: 'images-cache',
              expiration: {
                maxEntries: 50,
                maxAgeSeconds: 30 * 24 * 60 * 60 // 30 days
              }
            }
          },
          {
            // POST /api/* — nunca usar cache: POST não é cacheável pelo Cache API do browser.
            // networkTimeoutSeconds no NetworkFirst derrubava requests POST lentos (cold start)
            // sem fallback possível, resultando em NetworkError silencioso.
            urlPattern: ({ request }) => request.method === 'POST' && /\/api\//.test(request.url),
            handler: 'NetworkOnly',
          },
          {
            // GET /api/* — NetworkFirst com cache de 5min para resiliência offline.
            urlPattern: ({ request }) => request.method === 'GET' && /\/api\//.test(request.url),
            handler: 'NetworkFirst',
            options: {
              cacheName: 'api-cache',
              networkTimeoutSeconds: 10,
              expiration: {
                maxEntries: 50,
                maxAgeSeconds: 5 * 60 // 5 minutes
              },
              cacheableResponse: {
                statuses: [0, 200]
              }
            }
          }
        ]
      },
      devOptions: {
        enabled: true // Habilita PWA em desenvolvimento
      }
    })
  ],
  server: {
    host: '0.0.0.0',
    port: 3002,
  },
  build: {
    sourcemap: false,
    minify: 'terser',
    terserOptions: {
      compress: {
        // Remove todos os console.* em builds de produção — evita vazamento de dados
        drop_console: true,
        drop_debugger: true,
      },
    },
  },
});
