const {test, expect} = require('@playwright/test');
const {assertCanonicalBaseline}=require('../tools/simulation-baselines.js');

const GAME_URL = '/game/index.html?browserTest=1';

function attachErrorCollectors(page) {
  const failures = [];
  page.on('pageerror', error => failures.push(`page error: ${error.stack || error.message}`));
  page.on('console', message => {
    if (message.type() === 'error') failures.push(`console error: ${message.text()}`);
  });
  page.on('requestfailed', request => failures.push(`request failed: ${request.method()} ${request.url()} (${request.failure()?.errorText || 'unknown'})`));
  page.on('response', response => {
    if (response.status() >= 400) failures.push(`HTTP ${response.status()}: ${response.url()}`);
  });
  page.__statefallFailures = failures;
  return failures;
}

test.beforeEach(async ({page}) => {
  attachErrorCollectors(page);
  await page.addInitScript(() => {
    window.__STATEFALL_TEST_MODE__ = true;
    Object.defineProperty(Performance.prototype, 'now', {value: () => 1_000});
    localStorage.setItem('statefall-audio', JSON.stringify({master: 0, sfx: 0, alert: 0, amb: 0, music: 0}));
  });
});

test.afterEach(async ({page}) => {
  expect(page.__statefallFailures, page.__statefallFailures.join('\n')).toEqual([]);
});

async function startFixedMatch(page) {
  await page.goto(GAME_URL, {waitUntil: 'load'});
  await expect(page.locator('#start')).toBeVisible();
  await expect(page.locator('#map')).toBeVisible();
  await page.locator('#maps button[data-m="random"]').click();
  await page.locator('#seedIn').fill('PHASE0CANVAS');
  await page.locator('#countrySel').selectOption('0');
  await page.locator('#startBtn').click();
  await expect.poll(() => page.evaluate(() => window.__STATEFALL_TEST__?.snapshot().ready)).toBe(true);
  await page.evaluate(() => window.__STATEFALL_TEST__.pause());
}

test('launches a fixed-seed match, renders the map, and supports camera zoom', async ({page}, testInfo) => {
  await startFixedMatch(page);

  const initial = await page.evaluate(() => window.__STATEFALL_TEST__.snapshot());
  expect(initial.seed).toBe('PHASE0CANVAS');
  expect(initial.map).toBe('random');
  expect(initial.players).toBeGreaterThan(1);
  expect(initial.landCount).toBeGreaterThan(10_000);
  expect(initial.canvas.width).toBeGreaterThan(0);
  expect(initial.canvas.height).toBeGreaterThan(0);

  const colors = await page.locator('#map').evaluate(canvas => {
    const data = canvas.getContext('2d').getImageData(0, 0, canvas.width, canvas.height).data;
    const seen = new Set();
    for (let i = 0; i < data.length; i += 4 * 97) seen.add(`${data[i]},${data[i + 1]},${data[i + 2]},${data[i + 3]}`);
    return seen.size;
  });
  expect(colors).toBeGreaterThan(8);

  const box = await page.locator('#map').boundingBox();
  await page.mouse.move(box.x + box.width / 2, box.y + box.height / 2);
  if (testInfo.project.name === 'webkit-mobile') {
    await page.locator('#map').dispatchEvent('wheel', {deltaY: -120, clientX: box.x + box.width / 2, clientY: box.y + box.height / 2});
  } else {
    await page.mouse.wheel(0, -120);
  }
  await expect.poll(() => page.evaluate(() => window.__STATEFALL_TEST__.snapshot().camera.scale)).toBeGreaterThan(initial.camera.scale);

  if (testInfo.project.name === 'chromium-desktop' && process.platform === 'win32') {
    await page.evaluate(() => window.__STATEFALL_TEST__.freezePresentation());
    await expect(page.locator('#map')).toHaveScreenshot('current-map.png', {animations: 'disabled'});
  }
});

test('resizes without document overflow and keeps the Canvas usable', async ({page}, testInfo) => {
  await startFixedMatch(page);
  const viewport = testInfo.project.name.includes('mobile') ? {width: 412, height: 732} : {width: 1024, height: 640};
  await page.setViewportSize(viewport);

  await expect.poll(() => page.evaluate(() => {
    const canvas = window.__STATEFALL_TEST__.snapshot().canvas;
    return canvas.width === canvas.clientWidth && canvas.height === canvas.clientHeight;
  })).toBe(true);
  const layout = await page.evaluate(() => ({
    documentWidth: document.documentElement.scrollWidth,
    viewportWidth: document.documentElement.clientWidth,
    bodyWidth: document.body.scrollWidth,
    canvas: window.__STATEFALL_TEST__.snapshot().canvas,
    side: document.querySelector('#side').getBoundingClientRect().toJSON()
  }));
  expect(layout.documentWidth).toBeLessThanOrEqual(layout.viewportWidth);
  expect(layout.bodyWidth).toBeLessThanOrEqual(layout.viewportWidth);
  expect(layout.canvas.width).toBe(layout.canvas.clientWidth);
  expect(layout.canvas.height).toBe(layout.canvas.clientHeight);
  expect(layout.canvas.width).toBeGreaterThan(100);
  expect(layout.canvas.height).toBeGreaterThan(100);
  expect(layout.side.right).toBeLessThanOrEqual(viewport.width + 1);
});

test('fixed-seed simulation has the same canonical digest in Chromium, Firefox, and WebKit', async ({page}, testInfo) => {
  test.skip(testInfo.project.name !== 'chromium-desktop', 'cross-engine comparison runs once');
  const {chromium,firefox,webkit}=require('playwright');
  const {firstDifference}=require('../tools/state-oracle.js');
  const digests={},states={},cruise={};
  for(const [name,engine] of Object.entries({chromium,firefox,webkit})){
    const browser=await engine.launch();
    try{
      const context=await browser.newContext({viewport:{width:1280,height:720}});
      const testPage=await context.newPage();
      const failures=attachErrorCollectors(testPage);
      await testPage.addInitScript(() => {
        window.__STATEFALL_TEST_MODE__=true;
        Object.defineProperty(Performance.prototype,'now',{value:()=>1_000});
        localStorage.setItem('statefall-audio',JSON.stringify({master:0,sfx:0,alert:0,amb:0,music:0}));
      });
      await testPage.goto(GAME_URL,{waitUntil:'load'});
      await testPage.evaluate(() => window.__STATEFALL_TEST__.prepareControlledStart());
      await testPage.locator('#maps button[data-m="random"]').click();
      await testPage.locator('#seedIn').fill('PHASE0DIGEST');
      await testPage.locator('#countrySel').selectOption('0');
      await testPage.locator('#startBtn').click();
      await expect.poll(() => testPage.evaluate(() => window.__STATEFALL_TEST__?.snapshot().ready)).toBe(true);
      await testPage.evaluate(() => { window.__STATEFALL_TEST__.pause(); window.__STATEFALL_TEST__.advance(300); });
      cruise[name]=await testPage.evaluate(() => window.__STATEFALL_TEST__.exerciseCruiseTargetOrder([
        {name:'late',type:'other',t:40,owner:3},
        {name:'sam-b',type:'sam',t:22,owner:2},
        {name:'shield-b',type:'shield',t:12,owner:2},
        {name:'shield-a',type:'shield',t:8,owner:4},
        {name:'sam-a',type:'sam',t:22,owner:1}
      ]));
      digests[name]=await testPage.evaluate(() => window.__STATEFALL_TEST__.canonicalDigest());
      states[name]=await testPage.evaluate(() => window.__STATEFALL_TEST__.canonicalState());
      expect(failures,`${name} page failures:\n${failures.join('\n')}`).toEqual([]);
      await context.close();
    }finally{
      await browser.close();
    }
  }
  const detail=Object.keys(states).slice(1).map(name=>`${name}: ${firstDifference(states.chromium,states[name])}`).join('\n');
  for(const [name,result] of Object.entries(cruise)){
    expect(result.draws,`${name} cruise RNG draws`).toBe(5);
    expect(result.order,`${name} cruise target order`).toEqual(['shield-a','shield-b']);
  }
  expect(new Set(Object.values(cruise).map(JSON.stringify)).size,JSON.stringify(cruise,null,2)).toBe(1);
  expect(new Set(Object.values(digests)).size,`${JSON.stringify(digests,null,2)}\n${detail}`).toBe(1);
  for(const [name,digest] of Object.entries(digests)) assertCanonicalBaseline('browser','fixed-seed-cross-engine',digest,`${name}\n${detail}`);
});
