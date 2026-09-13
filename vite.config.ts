import path from 'node:path';
import { defineConfig } from 'vite';
import react from '@vitejs/plugin-react';
import tailwindcss from '@tailwindcss/vite';

export default defineConfig({
  plugins: [react(), tailwindcss()],
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
          motion: ['motion'],
        },
      },
    },
  },
});
