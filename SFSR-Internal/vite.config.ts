import react from '@vitejs/plugin-react';
import { defineConfig } from 'vite';

export default defineConfig({
  plugins: [react()],

  // Reads the same .env one level up as the Portal: one centralized database.
  envDir: '..',

  resolve: {
    // See the note in SFSR-Portal/vite.config.ts — prevents two copies of the
    // Firebase SDK being loaded through the linked shared package.
    dedupe: ['firebase', 'react', 'react-dom', 'tesseract.js', 'pdfjs-dist'],
  },

  server: {
    port: 5174,
    // The Internal Management System is an office-based system: staff reach it
    // over the company LAN, not the internet. Binding to 0.0.0.0 makes it
    // reachable from other machines on the network.
    host: true,
  },

  optimizeDeps: {
    // tesseract.js is deliberately NOT excluded — it is CommonJS and must be
    // pre-bundled. See the note in SFSR-Portal/vite.config.ts.
    exclude: ['pdfjs-dist'],
  },
});
