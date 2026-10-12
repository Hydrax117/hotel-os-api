import { defineConfig } from 'vitest/config';
import tsconfigPaths from 'vite-tsconfig-paths';

export default defineConfig({
  // Resolves the path aliases declared in tsconfig.json, including the ones
  // added by `nest g library`.
  plugins: [tsconfigPaths()],
  test: {
    globals: true,
    root: './',
    include: ['**/*.spec.ts'],
    // reflect-metadata is required by TypeScript decorators (class-validator,
    // class-transformer). Load it once before any test file runs.
    setupFiles: ['./src/test-setup.ts'],
  },
});
