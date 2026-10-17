import { defineConfig } from '@playwright/test'

export default defineConfig({
  testDir: '.',
  timeout: 60_000,
  use: {
    headless: true,
  },
  reporter: [['list']],
})
