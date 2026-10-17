import { fileURLToPath } from 'node:url'
import { defineConfig } from 'vitest/config'

const sharedDir = fileURLToPath(new URL('./shared', import.meta.url))

export default defineConfig({
  resolve: {
    alias: {
      '@shared': sharedDir,
    },
  },
  test: {
    projects: [
      {
        extends: true,
        test: {
          name: 'unit',
          include: ['src/**/*.test.ts', 'shared/**/*.test.ts'],
        },
      },
      {
        extends: true,
        test: {
          name: 'integration',
          include: ['test/integration/**/*.test.ts'],
        },
      },
      {
        extends: true,
        test: {
          name: 'compat',
          include: ['test/compat/**/*.test.ts'],
          testTimeout: 300_000,
          hookTimeout: 300_000,
        },
      },
      {
        extends: true,
        test: {
          name: 'e2e',
          include: ['test/e2e/**/*.test.ts'],
          testTimeout: 600_000,
          hookTimeout: 240_000,
          fileParallelism: false,
          // One automatic retry for timing flakes in CI; local runs stay strict.
          retry: process.env.CI ? 1 : 0,
        },
      },
    ],
  },
})
