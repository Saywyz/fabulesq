/// <reference types="vitest/config" />
import { defineConfig } from 'vite';

export default defineConfig({
  // Nom du repo GitHub : les assets doivent être servis depuis /fabulesq/ sur Pages.
  base: '/fabulesq/',
  test: {
    include: ['src/**/*.test.ts'],
  },
});
