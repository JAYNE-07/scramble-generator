import { defineConfig } from 'vite';
import react from '@vitejs/plugin-react';

// Served from https://jayne-07.github.io/scramble-generator/ on GitHub Pages.
export default defineConfig({
  base: '/scramble-generator/',
  plugins: [react()],
});
