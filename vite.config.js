import { defineConfig, loadEnv } from 'vite'
import react from '@vitejs/plugin-react'
import { VitePWA } from 'vite-plugin-pwa'
import trackingPlugin from './vite-plugins/tracking.js'

export default defineConfig(({ mode }) => ({
  plugins: [
    react(),
    trackingPlugin({ ...loadEnv(mode, process.cwd(), 'VITE_'), ...process.env }),
    VitePWA({
      registerType: 'autoUpdate',
      manifest: {
        name: 'Step2Connect',
        short_name: 'Step2Connect',
        description: 'Servizi per lavoratori Fincantieri in Italia',
        theme_color: '#0A1E3A',
        background_color: '#0A1E3A',
        display: 'standalone',
        orientation: 'portrait',
        icons: [
          { src: '/icon-192.png', sizes: '192x192', type: 'image/png' },
          { src: '/icon-512.png', sizes: '512x512', type: 'image/png' }
        ]
      }
    })
  ],
  server: {
    host: '0.0.0.0',
    port: 5000,
    allowedHosts: true,
    proxy: {
      '/api': {
        target: 'http://localhost:3001',
        changeOrigin: true,
      },
    },
  }
}))
