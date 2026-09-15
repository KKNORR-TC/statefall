const {defineConfig, devices} = require('@playwright/test');

module.exports = defineConfig({
  testDir: __dirname,
  testMatch: 'graphics-vertical-slice.spec.js',
  timeout: 20_000,
  reporter: 'line',
  use: {screenshot: 'only-on-failure', reducedMotion: 'reduce'},
  projects: [
    {name: 'chromium-desktop', use: {browserName: 'chromium', viewport: {width: 1440, height: 900}, deviceScaleFactor: 1}},
    {name: 'chromium-mobile', use: {...devices['Pixel 7'], viewport: {width: 390, height: 844}}}
  ]
});
