const { defineConfig, devices } = require('@playwright/test')

module.exports = defineConfig({
  testDir: './tests/e2e',
  fullyParallel: false,
  workers: 1,
  retries: process.env.CI ? 1 : 0,
  reporter: [['list'], ['html', { open: 'never' }]],
  use: {
    baseURL: 'http://127.0.0.1:4173',
    locale: 'es-MX',
    timezoneId: 'America/Mexico_City',
    serviceWorkers: 'block',
    screenshot: 'only-on-failure',
    trace: 'on-first-retry',
    video: 'retain-on-failure',
  },
  projects: [
    {
      name: 'chromium-mobile',
      testIgnore: ['**/layout-desktop.spec.js'],
      use: { ...devices['Pixel 5'] },
    },
    {
      name: 'webkit-iphone',
      testIgnore: [
        '**/offline.spec.js',
        '**/respaldo-restauracion.spec.js',
        '**/layout-desktop.spec.js',
      ],
      use: { ...devices['iPhone 13'] },
    },
    {
      name: 'chromium-desktop',
      testMatch: '**/layout-desktop.spec.js',
      use: {
        ...devices['Desktop Chrome'],
        viewport: { width: 1365, height: 768 },
      },
    },
  ],
  globalSetup: require.resolve('./tests/e2e/server.cjs'),
})
