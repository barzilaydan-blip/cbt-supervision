import { defineConfig } from 'vite';
import react from '@vitejs/plugin-react';
import path from 'node:path';
import { fileURLToPath } from 'node:url';

const here = path.dirname(fileURLToPath(import.meta.url));

// Same app, Firebase swapped for in-memory synthetic data. Never deployed.
export default defineConfig({
  root: path.resolve(here, '../..'),
  plugins: [react()],
  base: './',
  resolve: {
    alias: {
      'firebase/app': path.join(here, 'mock-firebase.js'),
      'firebase/auth': path.join(here, 'mock-firebase.js'),
      'firebase/firestore': path.join(here, 'mock-firebase.js'),
    },
  },
  build: { outDir: path.join(here, 'dist'), emptyOutDir: true },
});
