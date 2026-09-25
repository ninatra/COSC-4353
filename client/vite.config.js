import react from '@vitejs/plugin-react';
import { defineConfig } from 'vite';

export default defineConfig({
  plugins: [react()],
  server: {
    // Listen on IPv4 so both http://localhost:5173 and http://127.0.0.1:5173 work
    // (on newer Node versions Vite otherwise binds only to IPv6 ::1).
    host: '127.0.0.1',
    port: 5173,
    // Forward /api calls to the Express server so the browser sees one origin.
    proxy: { '/api': 'http://localhost:4000' },
  },
});
