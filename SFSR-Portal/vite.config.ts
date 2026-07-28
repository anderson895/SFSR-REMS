import react from '@vitejs/plugin-react';
import { defineConfig } from 'vite';

export default defineConfig({
  plugins: [react()],

  // Both projects read the single .env one level up, so the Firebase project
  // and Cloudinary settings are configured in exactly one place. The apps are
  // separate; the database they talk to deliberately is not.
  envDir: '..',

  resolve: {
    /**
     * Force one copy of these packages.
     *
     * @sfsr/shared is linked with `file:../SFSR-Shared`, which npm installs as
     * a symlink. Without dedupe, Vite could resolve `firebase` once from
     * SFSR-Shared/node_modules and again from this project's node_modules,
     * producing TWO Firebase SDK instances. `getApps()` in one would not see
     * the app initialised in the other, so a signed-in user would look signed
     * out to half the code. React would likewise break its hook dispatcher.
     */
    dedupe: ['firebase', 'react', 'react-dom', 'tesseract.js', 'pdfjs-dist'],
  },

  server: { port: 5173 },

  optimizeDeps: {
    /**
     * pdfjs-dist ships ESM and loads its worker from a `?url` import, so it is
     * served as-is.
     *
     * tesseract.js must NOT be listed here. It is CommonJS, and excluding it
     * makes Vite serve the raw file to the browser, where native ESM cannot
     * read named exports from CJS — every import fails with
     * "does not provide an export named 'createWorker'". Letting Vite
     * pre-bundle it converts CJS to ESM properly.
     */
    exclude: ['pdfjs-dist'],
  },
});
