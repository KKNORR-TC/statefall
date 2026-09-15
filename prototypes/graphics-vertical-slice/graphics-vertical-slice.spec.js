const {test, expect} = require('@playwright/test');
const {pathToFileURL} = require('node:url');
const path = require('node:path');

const prototypeUrl = pathToFileURL(path.join(__dirname, 'index.html')).href;

test('renders the deterministic command-map slice', async ({page}) => {
  const errors = [];
  page.on('pageerror', error => errors.push(error.message));
  page.on('console', message => { if (message.type() === 'error') errors.push(message.text()); });

  await page.goto(prototypeUrl, {waitUntil: 'load'});
  await expect.poll(() => page.evaluate(() => window.__GRAPHICS_VERTICAL_SLICE_READY__)).toBe(true);
  await expect(page.locator('#map')).toBeVisible();
  await expect(page.locator('.intel-card')).toBeVisible();
  await expect(page.locator('.combat-readout')).toContainText('BEACHHEAD CONTESTED');

  const result = await page.evaluate(() => {
    const canvas = document.querySelector('#map');
    const pixels = canvas.getContext('2d').getImageData(0, 0, canvas.width, canvas.height).data;
    const colors = new Set();
    for (let i = 0; i < pixels.length; i += 4 * 997) colors.add(`${pixels[i]},${pixels[i + 1]},${pixels[i + 2]}`);
    return {
      colors: colors.size,
      overflow: document.documentElement.scrollWidth - document.documentElement.clientWidth,
      camera: window.__GRAPHICS_VERTICAL_SLICE_CAMERA__
    };
  });
  expect(result.colors).toBeGreaterThan(30);
  expect(result.overflow).toBeLessThanOrEqual(0);
  expect(result.camera.scaleX).toBe(result.camera.scaleY);
  expect(result.camera.portrait).toBe(test.info().project.name.includes('mobile'));
  expect(errors).toEqual([]);
  if (process.platform === 'win32') {
    await expect(page).toHaveScreenshot('command-map.png', {animations: 'disabled', fullPage: true, maxDiffPixelRatio: 0.001});
  }
});
