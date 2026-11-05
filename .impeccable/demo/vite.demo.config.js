import { defineConfig } from 'vite';
import react from '@vitejs/plugin-react';
import path from 'node:path';
import { fileURLToPath } from 'node:url';

const here = path.dirname(fileURLToPath(import.meta.url));

// Same app, Firebase and transcription swapped for synthetic stand-ins. Never deployed.
export default defineConfig({
  root: path.resolve(here, '../..'),
  plugins: [react()],
  base: './',
  resolve: {
    alias: [
      { find: /^\.\.\/utils\/transcriptionService\.js$/, replacement: path.join(here, 'mock-transcription.js') },
      { find: 'firebase/app', replacement: path.join(here, 'mock-firebase.js') },
      { find: 'firebase/auth', replacement: path.join(here, 'mock-firebase.js') },
      { find: 'firebase/firestore', replacement: path.join(here, 'mock-firebase.js') },
    ],
  },
  build: { outDir: path.join(here, 'dist'), emptyOutDir: true },
});
