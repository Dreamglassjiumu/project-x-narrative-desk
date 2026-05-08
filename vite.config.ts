import { defineConfig } from 'vite';
import react from '@vitejs/plugin-react';

export default defineConfig({
  plugins: [react()],
  base: './',
  server: {
    host: '127.0.0.1',
    proxy: {
      '/api': 'http://127.0.0.1:4317',
      '/uploads': 'http://127.0.0.1:4317',
    },
  },
  preview: {
    host: '127.0.0.1',
  },
});
