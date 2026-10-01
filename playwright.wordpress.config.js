const {defineConfig}=require('@playwright/test');

module.exports=defineConfig({
  testDir:'./tests/browser',
  outputDir:'.artifacts/wordpress-test-results',
  testMatch:/wordpress-artifact\.spec\.js/,
  timeout:60_000,
  workers:1,
  reporter:'line',
  use:{launchOptions:{args:['--mute-audio']},baseURL:process.env.STATEFALL_WORDPRESS_URL||'http://127.0.0.1:8089',browserName:'chromium',viewport:{width:1280,height:720},trace:'retain-on-failure',screenshot:'only-on-failure'}
});
