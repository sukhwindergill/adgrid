import { defineConfig } from 'vitest/config';
import react from '@vitejs/plugin-react';

export default defineConfig({
  plugins: [react()],
  // vitest resolves its own vite, whose JSX default is the classic runtime.
  // Without this, every .jsx test fails with "React is not defined".
  esbuild: { jsx: 'automatic' },
  test: {
    environment: 'jsdom',
    setupFiles: ['./vitest.setup.js'],
    include: ['src/**/*.test.{js,jsx}', 'supabase/functions/**/*.test.js'],
    globals: true,
  },
});
