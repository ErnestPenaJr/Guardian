import { defineConfig, devices } from '@playwright/test';

export default defineConfig({
  testDir: './e2e',
  fullyParallel: false,
  forbidOnly: !!process.env.CI,
  retries: process.env.CI ? 2 : 0,
  workers: 1,
  reporter: [['html'], ['list']],
  timeout: 30_000,

  use: {
    baseURL: 'http://localhost:5175',
    trace: 'on-first-retry',
    screenshot: 'only-on-failure',
    navigationTimeout: 60_000,
  },

  projects: [
    // Auth setup (runs first, desktop only)
    {
      name: 'setup',
      testMatch: /auth\.setup\.ts/,
      use: { viewport: { width: 1440, height: 900 } },
    },

    // Desktop (1440x900)
    {
      name: 'Desktop',
      use: {
        viewport: { width: 1440, height: 900 },
        storageState: '.auth/admin.json',
      },
      dependencies: ['setup'],
    },

    // Laptop (1280x720)
    {
      name: 'Laptop',
      use: {
        viewport: { width: 1280, height: 720 },
        storageState: '.auth/admin.json',
      },
      dependencies: ['setup'],
    },

    // Tablet Landscape (1024x768)
    {
      name: 'Tablet Landscape',
      use: {
        viewport: { width: 1024, height: 768 },
        storageState: '.auth/admin.json',
      },
      dependencies: ['setup'],
    },

    // Tablet Portrait (768x1024)
    {
      name: 'Tablet Portrait',
      use: {
        viewport: { width: 768, height: 1024 },
        storageState: '.auth/admin.json',
      },
      dependencies: ['setup'],
    },

    // Mobile Large - iPhone 14 Pro Max (428x926)
    {
      name: 'Mobile Large',
      use: {
        viewport: { width: 428, height: 926 },
        storageState: '.auth/admin.json',
      },
      dependencies: ['setup'],
    },

    // Mobile Small - iPhone SE (375x667)
    {
      name: 'Mobile Small',
      use: {
        viewport: { width: 375, height: 667 },
        storageState: '.auth/admin.json',
      },
      dependencies: ['setup'],
    },
  ],
});
