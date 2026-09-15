const {test, expect} = require('@playwright/test');

const GAME_URL = '/game/index.html?browserTest=1&case=PHASEADISPLAYSCALE';
const VIEWPORTS = [
  {width: 1280, height: 720},
  {width: 1600, height: 900}
];

test.beforeEach(async ({page}, testInfo) => {
  test.skip(!testInfo.project.name.startsWith('chromium-desktop-scale-'), 'dedicated desktop display-scale projects only');
  page.__statefallFailures = [];
  page.on('pageerror', error => page.__statefallFailures.push(`page error: ${error.stack || error.message}`));
  page.on('console', message => {
    if (message.type() === 'error') page.__statefallFailures.push(`console error: ${message.text()}`);
  });
  page.on('requestfailed', request => page.__statefallFailures.push(`request failed: ${request.method()} ${request.url()} (${request.failure()?.errorText || 'unknown'})`));
  page.on('response', response => {
    if (response.status() >= 400) page.__statefallFailures.push(`HTTP ${response.status()}: ${response.url()}`);
  });
  await page.addInitScript(() => {
    window.__STATEFALL_TEST_MODE__ = true;
    Object.defineProperty(Performance.prototype, 'now', {value: () => 1_000});
    localStorage.setItem('statefall-audio', JSON.stringify({master: 0, sfx: 0, alert: 0, amb: 0, music: 0}));
  });
});

test.afterEach(async ({page}) => {
  const failures = page.__statefallFailures || [];
  expect(failures, failures.join('\n')).toEqual([]);
});

async function startMatch(page) {
  await page.goto(GAME_URL, {waitUntil: 'load'});
  await page.evaluate(() => window.__STATEFALL_TEST__.prepareControlledStart());
  await page.locator('#maps button[data-m="random"]').click();
  await page.locator('#seedIn').fill('PHASEADISPLAYSCALE');
  await page.locator('#countrySel').selectOption('0');
  await page.locator('#startBtn').click();
  await expect.poll(() => page.evaluate(() => window.__STATEFALL_TEST__?.status().ready)).toBe(true);
  await page.evaluate(() => window.__STATEFALL_TEST__.pause());
}

async function readDisplayState(page) {
  return page.evaluate(() => {
    const canvas = document.querySelector('#map');
    const context = canvas.getContext('2d');
    const pixels = context.getImageData(0, 0, canvas.width, canvas.height).data;
    const colors = new Set();
    let samples = 0;
    let opaqueSamples = 0;
    for (let i = 0; i < pixels.length; i += 4 * 997) {
      samples++;
      if (pixels[i + 3] !== 0) opaqueSamples++;
      colors.add(`${pixels[i]},${pixels[i + 1]},${pixels[i + 2]},${pixels[i + 3]}`);
    }
    const rect = element => element.getBoundingClientRect().toJSON();
    return {
      dpr: window.devicePixelRatio,
      viewport: {width: document.documentElement.clientWidth, height: document.documentElement.clientHeight},
      document: {width: document.documentElement.scrollWidth, bodyWidth: document.body.scrollWidth},
      canvas: {width: canvas.width, height: canvas.height, clientWidth: canvas.clientWidth, clientHeight: canvas.clientHeight, rect: rect(canvas)},
      stage: rect(document.querySelector('#stage')),
      side: rect(document.querySelector('#side')),
      colors: colors.size,
      samples,
      opaqueSamples
    };
  });
}

function expectContained(state) {
  expect(state.document.width).toBeLessThanOrEqual(state.viewport.width);
  expect(state.document.bodyWidth).toBeLessThanOrEqual(state.viewport.width);
  for (const rect of [state.canvas.rect, state.stage, state.side]) {
    expect(rect.left).toBeGreaterThanOrEqual(-1);
    expect(rect.top).toBeGreaterThanOrEqual(-1);
    expect(rect.right).toBeLessThanOrEqual(state.viewport.width + 1);
    expect(rect.bottom).toBeLessThanOrEqual(state.viewport.height + 1);
  }
}

test('keeps Canvas, layout, targeting, and camera stable across desktop display scales', async ({page}, testInfo) => {
  await startMatch(page);
  const expectedDpr = testInfo.project.use.deviceScaleFactor;
  const target = await page.evaluate(() => window.__STATEFALL_TEST__.focusTarget('owned', 4));
  const camera = await page.evaluate(() => window.__STATEFALL_TEST__.snapshot().camera);

  for (const viewport of VIEWPORTS) {
    await page.setViewportSize(viewport);
    await expect.poll(() => page.evaluate(() => {
      const state = window.__STATEFALL_TEST__.snapshot();
      return state.canvas.width === state.canvas.clientWidth && state.canvas.height === state.canvas.clientHeight;
    })).toBe(true);
    await expect.poll(() => readDisplayState(page).then(state => state.colors)).toBeGreaterThan(8);

    const state = await readDisplayState(page);
    expect(state.dpr).toBe(expectedDpr);
    expect(state.canvas.width).toBe(state.canvas.clientWidth);
    expect(state.canvas.height).toBe(state.canvas.clientHeight);
    expect(state.canvas.width).toBeGreaterThan(100);
    expect(state.canvas.height).toBeGreaterThan(100);
    expect(state.opaqueSamples).toBe(state.samples);
    expectContained(state);

    expect(await page.evaluate(({x, y}) => window.__STATEFALL_TEST__.screenToTile(x, y), target)).toBe(target.tile);
    expect(await page.evaluate(() => window.__STATEFALL_TEST__.snapshot().camera)).toEqual(camera);
  }

  const canvas = page.locator('#map');
  await canvas.hover({position: {x: target.x, y: target.y}});
  await expect.poll(() => page.evaluate(() => window.__STATEFALL_TEST__.snapshot().input.hover)).toBe(target.tile);
  const commands = await page.evaluate(() => window.__STATEFALL_TEST__.snapshot().input.commands);
  await canvas.click({position: {x: target.x, y: target.y}});
  await expect.poll(() => page.evaluate(() => window.__STATEFALL_TEST__.snapshot().input.commands)).toBe(commands + 1);
  expect(await page.evaluate(() => window.__STATEFALL_TEST__.snapshot().input.lastCommand.a[0])).toBe(target.tile);
});
