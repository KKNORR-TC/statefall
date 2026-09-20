const {test, expect} = require('@playwright/test');
const {pathToFileURL} = require('node:url');
const path = require('node:path');

const prototypeUrl = pathToFileURL(path.join(__dirname, 'units.html')).href;
const reviewTime = 8400;

test('renders the deterministic unit direction in map context', async ({page}) => {
  const errors = [];
  page.on('pageerror', error => errors.push(error.message));
  page.on('console', message => { if (message.type() === 'error') errors.push(message.text()); });

  await page.goto(prototypeUrl, {waitUntil: 'load'});
  await expect.poll(() => page.evaluate(() => window.__UNIT_DIRECTION_READY__)).toBe(true);
  await page.evaluate(time => window.__UNIT_DIRECTION_ANIMATION__.setFixedTime(time), reviewTime);
  await expect(page.locator('[data-prototype="unit-direction"]')).toBeVisible();
  await expect(page.getByText('UNIT DIRECTION 02', {exact: true})).toBeVisible();
  await expect(page.getByText('ISOLATED PROTOTYPE', {exact: true})).toBeVisible();
  await expect(page.getByText('GENERAL LANGUAGE ONLY - INDIVIDUAL UNITS REQUIRE REVIEW', {exact: true})).toBeVisible();

  const result = await page.evaluate(() => {
    const canvases = [...document.querySelectorAll('canvas')];
    const sampledColors = new Set();
    for (const canvas of canvases) {
      const pixels = canvas.getContext('2d').getImageData(0, 0, canvas.width, canvas.height).data;
      for (let i = 0; i < pixels.length; i += 4 * 487) sampledColors.add(`${pixels[i]},${pixels[i + 1]},${pixels[i + 2]},${pixels[i + 3]}`);
    }
    const metrics = window.__UNIT_DIRECTION_METRICS__;
    return {
      sampledColors: sampledColors.size,
      horizontalOverflow: document.documentElement.scrollWidth - document.documentElement.clientWidth,
      verticalOverflow: document.documentElement.scrollHeight - document.documentElement.clientHeight,
      backingStores: canvases.map((canvas, index) => ({
        width: canvas.width,
        height: canvas.height,
        expectedWidth: Math.round(canvas.getBoundingClientRect().width * metrics[index ? 'scale' : 'operational'].dpr),
        expectedHeight: Math.round(canvas.getBoundingClientRect().height * metrics[index ? 'scale' : 'operational'].dpr)
      })),
      categories: [...document.querySelectorAll('[data-unit]')].map(node => node.dataset.unit),
      states: [...document.querySelectorAll('[data-state]')].map(node => node.dataset.state),
      marker: document.querySelector('main')?.dataset.prototype
    };
  });

  expect(result.marker).toBe('unit-direction');
  expect(result.sampledColors).toBeGreaterThan(100);
  expect(result.horizontalOverflow).toBeLessThanOrEqual(0);
  expect(result.verticalOverflow).toBeLessThanOrEqual(0);
  expect(result.categories).toEqual(expect.arrayContaining(['destroyer', 'submarine', 'stealth-fighter', 'bomber', 'coastal-bastion', 'sam-radar', 'repair-support', 'interceptor-missile']));
  expect(result.states).toEqual(expect.arrayContaining(['normal', 'selected', 'hostile-targeted', 'damaged-disabled', 'submerged-detected', 'active-firing']));
  for (const backing of result.backingStores) {
    expect(backing.width).toBe(backing.expectedWidth);
    expect(backing.height).toBe(backing.expectedHeight);
    expect(backing.width).toBeGreaterThan(0);
  }
  expect(errors).toEqual([]);
  await expect(page).toHaveScreenshot('unit-direction.png', {animations: 'disabled', fullPage: true, maxDiffPixelRatio: 0.001});
});

test('derives ambient and transit motion from fixed time without moving canonical anchors', async ({page}) => {
  await page.goto(prototypeUrl, {waitUntil: 'load'});
  await expect.poll(() => page.evaluate(() => window.__UNIT_DIRECTION_READY__)).toBe(true);
  const samples = await page.evaluate(times => {
    const api = window.__UNIT_DIRECTION_ANIMATION__;
    const anchors = JSON.stringify(api.anchors);
    return {
      anchors,
      samples: times.map(time => ({state: api.setFixedTime(time), anchors: JSON.stringify(api.anchors)}))
    };
  }, [1000, 3000, reviewTime]);

  expect(samples.samples.every(sample => sample.anchors === samples.anchors)).toBe(true);
  expect(samples.samples[0].state.radarAngle).not.toBe(samples.samples[1].state.radarAngle);
  expect(samples.samples[0].state.wakePhase).not.toBe(samples.samples[1].state.wakePhase);
  expect(samples.samples[0].state.dishAngle).not.toBe(samples.samples[1].state.dishAngle);
  expect(samples.samples[0].state.bubblePhase).not.toBe(samples.samples[1].state.bubblePhase);
  expect(samples.samples[0].state.projectileProgress).not.toBe(samples.samples[1].state.projectileProgress);
  expect(samples.samples[0].state.bomberBank).not.toBe(samples.samples[1].state.bomberBank);
  expect(samples.samples[0].state.fighterRollActive).toBe(false);
  expect(samples.samples[2].state.fighterRollActive).toBe(true);
  expect(samples.samples[2].state.fighterRollProgress).toBeCloseTo(.5, 8);
  expect(JSON.parse(samples.anchors).fighter).toEqual({x: 555, y: 230});
});

test('reduced motion disables decorative animation while preserving semantic rendering', async ({page}) => {
  await page.emulateMedia({reducedMotion: 'reduce'});
  await page.goto(prototypeUrl, {waitUntil: 'load'});
  await expect.poll(() => page.evaluate(() => window.__UNIT_DIRECTION_READY__)).toBe(true);
  const result = await page.evaluate(() => {
    const api = window.__UNIT_DIRECTION_ANIMATION__;
    const first = api.setFixedTime(1000);
    const second = api.setFixedTime(8400);
    const semanticPixels = document.querySelector('#unit-map').getContext('2d').getImageData(0,0,80,80).data.some(value => value !== 0);
    return {first, second, semanticPixels, categories: document.querySelectorAll('[data-unit]').length};
  });

  expect(result.first.reducedMotion).toBe(true);
  expect(result.second.reducedMotion).toBe(true);
  for (const property of ['radarAngle', 'wakePhase', 'dishAngle', 'sonarAngle', 'bubblePhase', 'projectileProgress', 'bomberBank']) {
    expect(result.first[property]).toBe(result.second[property]);
  }
  for (const property of ['shipNavLight', 'aircraftNavLight', 'supportBeacon', 'fighterRollActive']) {
    expect(result.first[property]).toBe(false);
    expect(result.second[property]).toBe(false);
  }
  expect(result.first.fighterRollProgress).toBe(0);
  expect(result.second.fighterRollProgress).toBe(0);
  expect(result.semanticPixels).toBe(true);
  expect(result.categories).toBe(8);
  await expect(page.locator('#unit-map')).toBeVisible();
});
