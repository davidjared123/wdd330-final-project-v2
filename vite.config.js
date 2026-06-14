import { defineConfig } from 'vite';
import { resolve } from 'path';

// Configuración de Vite para habilitar soporte multi-página nativo
// Esto permite a Rollup empaquetar tanto index.html como input.html
export default defineConfig({
  build: {
    rollupOptions: {
      input: {
        main: resolve(__dirname, 'index.html'),
        input: resolve(__dirname, 'input.html'),
      },
    },
  },
});
