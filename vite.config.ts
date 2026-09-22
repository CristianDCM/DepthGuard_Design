import path from 'node:path';
import { defineConfig } from 'vite';
import react from '@vitejs/plugin-react';
import tailwindcss from '@tailwindcss/vite';
import { VitePWA } from 'vite-plugin-pwa';

export default defineConfig({
  plugins: [
    react(),
    tailwindcss(),
    VitePWA({
      // injectManifest y no generateSW: el Service Worker se escribe a mano
      // (src/sw.ts) porque tiene que convivir con el de Firebase, que se
      // importa en lugar de sustituirse.
      strategies: 'injectManifest',
      srcDir: 'src',
      filename: 'sw.ts',
      // 'prompt': no se activa una version nueva por sorpresa mientras
      // alguien vigila una camara. Se ofrece y decide la persona.
      registerType: 'prompt',
      injectRegister: null,
      // El manifiesto vive en public/site.webmanifest, que es tambien el que
      // referencia index.html. Una sola fuente de verdad.
      manifest: false,
      injectManifest: {
        // IIFE y no ES: un Service Worker de tipo modulo NO admite
        // importScripts(), y este lo necesita para cargar el de Firebase.
        // Con el formato por defecto ('es') el SW lanzaba al instalarse y se
        // perdian a la vez el offline y las notificaciones push.
        rollupFormat: 'iife',
        globPatterns: ['**/*.{js,css,html,svg,png,woff2}'],
        // El SW de Firebase no se precachea: debe pedirse siempre a la red
        // (ya lleva Cache-Control no-store en vercel.json).
        globIgnores: ['**/firebase-messaging-sw.js'],
      },
      devOptions: { enabled: false },
    }),
  ],
  resolve: {
    alias: {
      '@': path.resolve(__dirname, '.'),
    },
  },
  esbuild: {
    // Elimina del bundle de produccion las trazas de depuracion, pero
    // conserva console.error y console.warn: son utiles para diagnosticar
    // incidencias reales en el panel desplegado.
    pure:
      process.env.NODE_ENV === 'production'
        ? ['console.log', 'console.debug', 'console.info']
        : [],
  },
  build: {
    rollupOptions: {
      output: {
        // Separa las librerias pesadas del codigo de la app: el login ya no
        // descarga Recharts ni Firebase, que solo hacen falta mas adelante.
        manualChunks: {
          react: ['react', 'react-dom', 'react-router-dom'],
          charts: ['recharts'],
          firebase: ['firebase/app', 'firebase/messaging'],
          supabase: ['@supabase/supabase-js'],
        },
      },
    },
  },
});
