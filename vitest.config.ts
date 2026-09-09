import { defineConfig } from 'vitest/config';

const testEnv = {
  NODE_ENV: 'test',
  SESSION_SECRET: 'budgetplanner-dev-only-session-secret-32ch',
  APP_PUBLIC_BASE_URL: 'http://127.0.0.1:3103',
  CLERK_PUBLISHABLE_KEY: '',
  CLERK_SECRET_KEY: '',
  VITE_CLERK_PUBLISHABLE_KEY: '',
} as const;

export default defineConfig({
  test: {
    environment: 'node',
    env: testEnv,
    include: ['server/**/*.test.ts', 'client/**/*.test.ts', 'shared/**/*.test.ts'],
    exclude: ['dist/**', 'e2e/**', 'node_modules/**'],
    coverage: {
      provider: 'v8',
      all: true,
      reporter: ['text-summary', 'html'],
      reportsDirectory: 'coverage',
      include: ['server/**/*.ts', 'shared/**/*.ts', 'client/utils/**/*.ts'],
      exclude: [
        '**/*.test.ts',
        '**/*.test.tsx',
        'dist/**',
        'node_modules/**',
        'e2e/**',
        'server/index.ts',
      ],
    },
  },
});
