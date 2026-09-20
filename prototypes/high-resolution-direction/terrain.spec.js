const {test, expect} = require('@playwright/test');
const {pathToFileURL} = require('node:url');
const path = require('node:path');

const prototypeUrl = pathToFileURL(path.join(__dirname, 'terrain.html')).href;

test('renders the deterministic terrain-only direction', async ({page}) => {
  const errors = [];
  page.on('pageerror', error => errors.push(error.message));
  page.on('console', message => { if (message.type() === 'error') errors.push(message.text()); });

  await page.goto(prototypeUrl, {waitUntil: 'load'});
  await expect.poll(() => page.evaluate(() => window.__TERRAIN_DIRECTION_READY__)).toBe(true);
  await expect(page.locator('[data-prototype="terrain-only"]')).toBeVisible();
  await expect(page.getByText('TERRAIN DIRECTION 02', {exact: true})).toBeVisible();
  await expect(page.getByText('ISOLATED PROTOTYPE', {exact: true})).toBeVisible();

  const result = await page.evaluate(() => {
    const canvases = [...document.querySelectorAll('canvas')];
    const sampledColors = new Set();
    for (const canvas of canvases) {
      const pixels = canvas.getContext('2d').getImageData(0, 0, canvas.width, canvas.height).data;
      for (let i = 0; i < pixels.length; i += 4 * 613) {
        sampledColors.add(`${pixels[i]},${pixels[i + 1]},${pixels[i + 2]},${pixels[i + 3]}`);
      }
    }
    const metrics = window.__TERRAIN_DIRECTION_METRICS__;
    return {
      sampledColors: sampledColors.size,
      horizontalOverflow: document.documentElement.scrollWidth - document.documentElement.clientWidth,
      verticalOverflow: document.documentElement.scrollHeight - document.documentElement.clientHeight,
      backingStores: canvases.map((canvas, index) => ({
        width: canvas.width,
        height: canvas.height,
        expectedWidth: Math.round(canvas.getBoundingClientRect().width * metrics[index ? 'overview' : 'operational'].dpr),
        expectedHeight: Math.round(canvas.getBoundingClientRect().height * metrics[index ? 'overview' : 'operational'].dpr)
      })),
      forbiddenElements: document.querySelectorAll('[data-unit], .unit, .unit-marker, .structure, .projectile').length,
      marker: document.querySelector('main')?.dataset.prototype
    };
  });

  expect(result.marker).toBe('terrain-only');
  expect(result.forbiddenElements).toBe(0);
  expect(result.sampledColors).toBeGreaterThan(90);
  expect(result.horizontalOverflow).toBeLessThanOrEqual(0);
  expect(result.verticalOverflow).toBeLessThanOrEqual(0);
  for (const backing of result.backingStores) {
    expect(backing.width).toBe(backing.expectedWidth);
    expect(backing.height).toBe(backing.expectedHeight);
    expect(backing.width).toBeGreaterThan(0);
  }
  expect(errors).toEqual([]);
  await expect(page).toHaveScreenshot('terrain-direction.png', {animations: 'disabled', fullPage: true, maxDiffPixelRatio: 0.001});
});
