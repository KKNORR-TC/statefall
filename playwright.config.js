const {defineConfig, devices} = require('@playwright/test');

module.exports = defineConfig({
  testDir: './tests/browser',
  timeout: 30_000,
  expect: {timeout: 10_000},
  fullyParallel: false,
  forbidOnly: !!process.env.CI,
  retries: process.env.CI ? 1 : 0,
  workers: process.env.CI ? 2 : 1,
  reporter: 'line',
  use: {
    baseURL: 'http://127.0.0.1:4173',
    trace: 'retain-on-failure',
    screenshot: 'only-on-failure',
    video: 'retain-on-failure'
  },
  webServer: {
    command: 'node tools/browser-server.js',
    url: 'http://127.0.0.1:4173/game/index.html',
    reuseExistingServer: false,
    timeout: 10_000
  },
  projects: [
    {name: 'chromium-desktop', use: {browserName: 'chromium', viewport: {width: 1440, height: 900}, deviceScaleFactor: 1}},
    {name: 'firefox-desktop', use: {browserName: 'firefox', viewport: {width: 1280, height: 720}, deviceScaleFactor: 1}},
    {name: 'webkit-desktop', use: {browserName: 'webkit', viewport: {width: 1280, height: 720}, deviceScaleFactor: 1}},
    {name: 'chromium-mobile', use: {...devices['Pixel 7'], viewport: {width: 390, height: 844}}},
    {name: 'webkit-mobile', use: {...devices['iPhone 13'], viewport: {width: 390, height: 844}}},
    {name: 'chromium-reduced-motion', use: {browserName: 'chromium', viewport: {width: 1280, height: 720}, deviceScaleFactor: 1, reducedMotion: 'reduce'}}
  ]
});
