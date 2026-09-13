import { defineConfig } from 'vitest/config';

export default defineConfig({
  test: {
    // jsdom para las pruebas que tocan el DOM (descarga de CSV vía Blob).
    environment: 'jsdom',
    include: ['src/**/*.test.ts', 'src/**/*.test.tsx'],
    coverage: {
      provider: 'v8',
      reporter: ['text', 'lcov'],
      include: ['src/lib/**/*.ts'],
      exclude: [
        'src/lib/**/*.test.ts',
        // Adaptadores de E/S sin logica propia: supabase.ts es el cliente y
        // los tipos del esquema, firebase.ts es la configuracion del SDK.
        // Su comportamiento se verifica contra los servicios reales, no aqui.
        'src/lib/supabase.ts',
        'src/lib/firebase.ts',
      ],
    },
  },
});
