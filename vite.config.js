import { defineConfig } from 'vite';
import react from '@vitejs/plugin-react';
import tailwindcss from '@tailwindcss/vite';
import { VitePWA } from 'vite-plugin-pwa';

export default defineConfig({
  plugins: [
    react(),
    tailwindcss(),
    VitePWA({
      strategies: 'injectManifest',
      srcDir: '.',
      filename: 'sw.js',
      injectRegister: false,
      manifest: {
        name: 'LifeOS',
        short_name: 'LifeOS',
        description: 'Персональный ассистент: финансы, здоровье, задачи, инвестиции',
        theme_color: '#000000',
        background_color: '#000000',
        display: 'standalone',
        orientation: 'portrait',
        start_url: '/',
        scope: '/',
        lang: 'ru',
        categories: ['lifestyle', 'productivity', 'finance'],
        shortcuts: [
          { name: 'Добавить расход', short_name: 'Расход', url: '/?action=expense', icons: [{ src: '/icon-192.png', sizes: '192x192' }] },
          { name: 'Новая задача', short_name: 'Задача', url: '/?action=task', icons: [{ src: '/icon-192.png', sizes: '192x192' }] },
          { name: 'Тренировка', short_name: 'Спорт', url: '/?action=workout', icons: [{ src: '/icon-192.png', sizes: '192x192' }] },
        ],
        icons: [
          { src: '/icon-192.png', sizes: '192x192', type: 'image/png' },
          { src: '/icon-512.png', sizes: '512x512', type: 'image/png' },
          { src: '/icon-512.png', sizes: '512x512', type: 'image/png', purpose: 'maskable' },
        ],
      },
      injectManifest: {
        globPatterns: ['**/*.{js,css,html,png,svg,woff2}'],
        maximumFileSizeToCacheInBytes: 5 * 1024 * 1024,
      },
      devOptions: {
        enabled: false,
      },
    }),
  ],
  esbuild: {
    drop: ['debugger'],
    pure: ['console.log', 'console.debug'], // Keep console.error/warn in production
  },
  build: {
    target: 'es2022',
    outDir: 'dist',
    sourcemap: 'hidden',
    rollupOptions: {
      output: {
        manualChunks: {
          dexie: ['dexie'],
        },
      },
    },
  },
  server: {
    port: 3000,
    host: true,
  },
});
