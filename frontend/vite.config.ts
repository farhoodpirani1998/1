import { defineConfig } from 'vite';
import react from '@vitejs/plugin-react';

export default defineConfig({
  plugins: [react()],
  server: {
    host: true,
    port: 5173,
    proxy: {
      '/api': {
        target: 'http://localhost:3000',
        changeOrigin: true,
      },
      // Sprint P1 — Universal Avatar System. Avatar images are served by
      // the backend at /uploads/avatars/... (see main.ts's
      // useStaticAssets), outside the /api prefix above — this proxy
      // entry is what makes <img src={user.avatarUrl}> resolve during
      // `vite dev` instead of 404ing against the frontend dev server.
      '/uploads': {
        target: 'http://localhost:3000',
        changeOrigin: true,
      },
    },
  },
});
