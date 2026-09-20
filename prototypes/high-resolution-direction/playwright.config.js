const {defineConfig} = require('@playwright/test');

module.exports = defineConfig({
  testDir: __dirname,
  testMatch: ['terrain.spec.js', 'units.spec.js'],
  timeout: 20_000,
  reporter: 'line',
  use: {
    browserName: 'chromium',
    viewport: {width: 1440, height: 900},
    deviceScaleFactor: 2,
    reducedMotion: 'no-preference',
    screenshot: 'only-on-failure'
  },
  projects: [{name: 'chromium-desktop', use: {browserName: 'chromium'}}]
});
