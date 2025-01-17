// vite.config.ts
import { defineConfig } from 'vite';
import react from '@vitejs/plugin-react';

export default defineConfig({
  plugins: [react()],
  server: {
    host: '0.0.0.0',
    port: 5173,
    proxy: {
      '/ws': {
        target: 'ws://192.168.126.1:3000',
        ws: true,
      },
      '/status': {
        target: 'http://192.168.126.1:3000',
        changeOrigin: true,
      }
    },
  },
});