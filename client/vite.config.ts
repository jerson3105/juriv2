import { defineConfig } from 'vite'
import react from '@vitejs/plugin-react'
import { VitePWA } from 'vite-plugin-pwa'

// https://vite.dev/config/
export default defineConfig({
  plugins: [
    react(),
    VitePWA({
      registerType: 'autoUpdate',
      includeAssets: ['favicon.ico', 'iconojuried.png', 'logo.png'],
      manifest: {
        name: 'Juried - Gamificación Educativa',
        short_name: 'Juried',
        description: 'Plataforma de gamificación educativa para motivar a tus estudiantes',
        theme_color: '#6366f1',
        background_color: '#ffffff',
        display: 'standalone',
        orientation: 'portrait-primary',
        scope: '/',
        start_url: '/',
        icons: [
          {
            src: 'pwa-64x64.png',
            sizes: '64x64',
            type: 'image/png'
          },
          {
            src: 'pwa-192x192.png',
            sizes: '192x192',
            type: 'image/png'
          },
          {
            src: 'pwa-512x512.png',
            sizes: '512x512',
            type: 'image/png',
            purpose: 'any'
          },
          {
            src: 'maskable-icon-512x512.png',
            sizes: '512x512',
            type: 'image/png',
            purpose: 'maskable'
          }
        ]
      },
      workbox: {
        globPatterns: ['**/*.{js,css,html,ico,png,svg,woff,woff2}'],
        maximumFileSizeToCacheInBytes: 3 * 1024 * 1024, // 3 MB
        navigateFallbackDenylist: [/^\/api/], // No interceptar rutas de API
        runtimeCaching: [
          {
            urlPattern: /^https:\/\/api\..*/i,
            handler: 'NetworkFirst',
            options: {
              cacheName: 'api-cache',
              expiration: {
                maxEntries: 100,
                maxAgeSeconds: 60 * 60 * 24 // 24 hours
              },
              cacheableResponse: {
                statuses: [0, 200]
              }
            }
          }
        ]
      },
      devOptions: {
        enabled: true
      }
    })
  ],
  build: {
    // Optimización de bundle
    rollupOptions: {
      output: {
        manualChunks: (id) => {
          if (id.includes('node_modules')) {
            if (id.includes('react-dom')) return 'vendor-react-dom';
            if (id.includes('react-router')) return 'vendor-react-router';
            if (id.includes('react')) return 'vendor-react';
            if (id.includes('framer-motion')) return 'vendor-framer';
            if (id.includes('lucide-react')) return 'vendor-icons';
            if (id.includes('@tanstack/react-query')) return 'vendor-query';
            if (id.includes('recharts') || id.includes('d3-')) return 'vendor-charts';
            if (id.includes('axios') || id.includes('zustand')) return 'vendor-data';
            return 'vendor';
          }
        },
      },
    },
    chunkSizeWarningLimit: 1200,
    // Minificación con terser para eliminar console.log
    minify: 'terser',
    terserOptions: {
      compress: {
        drop_console: true, // Eliminar console.log en producción
        drop_debugger: true, // Eliminar debugger
        pure_funcs: ['console.log', 'console.info', 'console.debug'], // Funciones a eliminar
      },
    },
  },
})
