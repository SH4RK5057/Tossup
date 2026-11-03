/// <reference types="vitest" />
import { defineConfig } from 'vite';
import react from '@vitejs/plugin-react';

// BASE_PATH is set by the GitHub Pages workflow, e.g. "/Tossup/".
export default defineConfig({
  base: process.env.BASE_PATH ?? '/',
  plugins: [react()],
  test: { include: ['src/**/*.test.ts'], environment: 'node' },
});
