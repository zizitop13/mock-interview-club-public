import { defineConfig } from 'vite';
import react from '@vitejs/plugin-react';
import path from 'node:path';
import { fileURLToPath } from 'node:url';

const directory = path.dirname(fileURLToPath(import.meta.url));

export default defineConfig({
  root: directory,
  plugins: [react()],
  build: {
    outDir: path.resolve(directory, '../assets/react'),
    emptyOutDir: true,
    lib: {
      entry: path.resolve(directory, 'src/main.jsx'),
      formats: ['es'],
      fileName: () => 'components.js',
    },
  },
});
