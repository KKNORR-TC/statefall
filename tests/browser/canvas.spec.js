const {test, expect} = require('@playwright/test');
const {assertCanonicalBaseline}=require('../tools/simulation-baselines.js');
const replayFixture=require('../fixtures/replays/public-v1.10.7-focus.json');

const GAME_URL = '/index.html?browserTest=1';
const MAPS = ['random', 'land', 'islands_l', 'islands_m', 'islands_s', 'atoll', 'world', 'europe', 'americas', 'africa', 'asia', 'mideast'];
const MODES = [
  {id: 'quickStart', key: 'quick', label: 'quick-start'},
  {id: 'riskyOn', key: 'risky', label: 'risky-start'},
  {id: 'endgameOn', key: 'endgame', label: 'end-game'},
  {id: 'fogOn', key: 'fog', label: 'fog'},
  {id: 'instantOn', key: 'instant', label: 'instant-build'},
  {id: 'billionaireOn', key: 'billionaire', label: 'billionaire'},
  {id: 'garrisonOn', key: 'garrison', label: 'garrisons'},
  {id: 'stNoCap', key: 'noCap', label: 'no-cap', settings: true},
  {id: 'stPauseBuild', key: 'pauseBuild', label: 'paused-orders'}
];

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

async function configureTestPage(page) {
  attachErrorCollectors(page);
  await page.addInitScript(() => {
    window.__STATEFALL_TEST_MODE__ = true;
    Object.defineProperty(Performance.prototype, 'now', {value: () => 1_000});
    localStorage.setItem('statefall-audio', JSON.stringify({master: 0, sfx: 0, alert: 0, amb: 0, music: 0}));
  });
}

test.beforeEach(async ({page}) => {
  await configureTestPage(page);
});

test.afterEach(async ({page}) => {
  expect(page.__statefallFailures, page.__statefallFailures.join('\n')).toEqual([]);
});

async function startFixedMatch(page, {map = 'random', seed = 'PHASE0CANVAS', mode, controlled = false} = {}) {
  await page.goto(`${GAME_URL}&case=${encodeURIComponent(seed)}`, {waitUntil: 'load'});
  await expect(page.locator('#start')).toBeVisible();
  await expect(page.locator('#map')).toBeVisible();
  if (controlled) await page.evaluate(() => window.__STATEFALL_TEST__.prepareControlledStart());
  await page.locator(`#maps button[data-m="${map}"]`).click();
  await expect(page.locator(`#maps button[data-m="${map}"]`)).toHaveClass(/\bon\b/);
  await page.locator('#seedIn').fill(seed);
  await page.locator('#countrySel').selectOption('0');
  if (mode?.settings) await page.locator('#settingsBtn').click();
  if (mode?.id === 'garrisonOn') {
    await page.locator('#garrisonOn').locator('..').click();
    await expect(page.locator('#garrisonOn')).toBeChecked();
  } else if (mode) await page.locator(`#${mode.id}`).check();
  if (mode?.settings) await page.locator('#settingsClose').click();
  await page.locator('#startBtn').click();
  await expect.poll(() => page.evaluate(() => window.__STATEFALL_TEST__?.status().ready)).toBe(true);
  await page.evaluate(() => window.__STATEFALL_TEST__.pause());
}

async function createCanonicalResumeReplay(page, seed) {
  await startFixedMatch(page, {seed, controlled: true});
  await page.evaluate(() => window.__STATEFALL_TEST__.advance(200));
  const replay = await page.evaluate(() => window.__STATEFALL_TEST__.replayPayload());
  expect(replay.requiresCanonicalCheckpoints).toBe(true);
  expect(replay.hashes[0][2].canonical.sha256).toMatch(/^[0-9a-f]{64}$/);
  delete replay.finalHash;
  delete replay.finalDigest;
  delete replay.final;
  await page.goto(`${GAME_URL}&case=${encodeURIComponent(seed)}-resume`, {waitUntil: 'load'});
  return replay;
}

function tamperFirstCheckpoint(replay) {
  const tampered = structuredClone(replay);
  tampered.hashes[0][1] = tampered.hashes[0][1] === '00000000' ? 'ffffffff' : '00000000';
  tampered.hashes[0][2].canonical.sha256 = '0'.repeat(64);
  return tampered;
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

  const zoomed = await page.evaluate(() => window.__STATEFALL_TEST__.snapshot().camera);
  await page.mouse.move(box.x + box.width / 2, box.y + box.height / 2);
  await page.mouse.down();
  await page.mouse.move(box.x + box.width / 2 + 72, box.y + box.height / 2 + 38, {steps: 4});
  await page.mouse.up();
  await expect.poll(() => page.evaluate(() => window.__STATEFALL_TEST__.snapshot().camera.x)).toBeCloseTo(zoomed.x + 72, 0);
  await expect.poll(() => page.evaluate(() => window.__STATEFALL_TEST__.snapshot().camera.y)).toBeCloseTo(zoomed.y + 38, 0);
});

test('all map buttons launch useful maps and match the strategic/close visual matrix', async ({context}, testInfo) => {
  test.skip(testInfo.project.name !== 'chromium-desktop', 'table-driven map coverage runs in primary Chromium');
  test.setTimeout(180_000);

  for (const map of MAPS) {
    const mapPage = await context.newPage();
    await configureTestPage(mapPage);
    try {
      await startFixedMatch(mapPage, {map, seed: `PHASEA${map.replace('_', '').toUpperCase()}`, controlled: true});
      const state = await mapPage.evaluate(() => window.__STATEFALL_TEST__.snapshot());
      expect(state.map, map).toBe(map);
      expect(state.landCount, map).toBeGreaterThan(1_000);
      expect(state.players, map).toBeGreaterThan(1);

      if (process.platform === 'win32') {
        await mapPage.evaluate(() => { window.__STATEFALL_TEST__.setCamera(0.9, 'world'); window.__STATEFALL_TEST__.freezePresentation(); });
        await expect(mapPage.locator('#map')).toHaveScreenshot(`maps/${map}-strategic.png`, {animations: 'disabled'});
        await mapPage.evaluate(() => window.__STATEFALL_TEST__.setCamera(4, 'player'));
        await expect(mapPage.locator('#map')).toHaveScreenshot(`maps/${map}-close.png`, {animations: 'disabled'});
      }
      expect(mapPage.__statefallFailures, `${map} page failures:\n${mapPage.__statefallFailures.join('\n')}`).toEqual([]);
    } finally {
      await mapPage.close();
    }
  }
});

test('major modes launch individually and expose their defining state', async ({context}, testInfo) => {
  test.skip(testInfo.project.name !== 'chromium-desktop', 'table-driven mode coverage runs in primary Chromium');
  test.setTimeout(120_000);

  for (const mode of MODES) {
    const modePage = await context.newPage();
    await configureTestPage(modePage);
    try {
      await startFixedMatch(modePage, {seed: `PHASEA${mode.label.replaceAll('-', '').toUpperCase()}`, mode, controlled: true});
      if (mode.key === 'fog') await modePage.evaluate(() => window.__STATEFALL_TEST__.advance(5));
      const state = await modePage.evaluate(() => window.__STATEFALL_TEST__.snapshot());
      expect(state.modes[mode.key], mode.label).toBe(true);
      if (mode.key !== 'fog') expect(state.matchClass, mode.label).not.toBe('Standard');
      if (mode.key === 'quick') expect(state.player.tiles).toBeGreaterThan(1_000);
      if (mode.key === 'risky') expect(state.mapState.draft).toBe(true);
      if (mode.key === 'endgame') expect(state.mapState.neutralLand).toBe(0);
      if (mode.key === 'fog') expect(state.mapState.hiddenTiles).toBeGreaterThan(0);
      if (mode.key === 'billionaire') {
        expect(state.player.troops).toBe(1_000_000_000);
        expect(state.player.gold).toBe(1_000_000_000);
      }
      if (mode.key === 'garrison') expect(state.player.areas).toBeGreaterThan(0);
      if (mode.key === 'pauseBuild') {
        const target = await modePage.evaluate(() => window.__STATEFALL_TEST__.focusTarget('owned', 4));
        const before = state.input.commands;
        await modePage.locator('#map').click({position: {x: target.x, y: target.y}});
        await expect.poll(() => modePage.evaluate(() => window.__STATEFALL_TEST__.snapshot().input.commands)).toBe(before + 1);
      }
      expect(modePage.__statefallFailures, `${mode.label} page failures:\n${modePage.__statefallFailures.join('\n')}`).toEqual([]);
    } finally {
      await modePage.close();
    }
  }
});

test('real pointer targeting and context interaction use the expected tile', async ({page}, testInfo) => {
  test.skip(testInfo.project.name !== 'chromium-desktop', 'deterministic tactical input coverage runs in primary Chromium');
  await startFixedMatch(page, {controlled: true});
  const canvas = page.locator('#map');
  const box = await canvas.boundingBox();
  const target = await page.evaluate(() => window.__STATEFALL_TEST__.focusTarget('owned', 4));
  expect(await page.evaluate(({x, y}) => window.__STATEFALL_TEST__.screenToTile(x, y), target)).toBe(target.tile);

  await page.mouse.move(box.x + target.x, box.y + target.y);
  await expect.poll(() => page.evaluate(() => window.__STATEFALL_TEST__.snapshot().input.hover)).toBe(target.tile);
  const before = await page.evaluate(() => window.__STATEFALL_TEST__.snapshot().input.commands);
  await page.mouse.click(box.x + target.x, box.y + target.y);
  await expect.poll(() => page.evaluate(() => window.__STATEFALL_TEST__.snapshot().input.commands)).toBe(before + 1);
  expect(await page.evaluate(() => window.__STATEFALL_TEST__.snapshot().input.lastCommand.a[0])).toBe(target.tile);

  await page.mouse.click(box.x + target.x, box.y + target.y, {button: 'right'});
  const menu = page.locator('#ctx');
  await expect(menu).toBeVisible();
  await expect(menu).toContainText('Economy');
  const menuBox = await menu.boundingBox();
  const viewport = page.viewportSize();
  expect(menuBox.x).toBeGreaterThanOrEqual(0);
  expect(menuBox.y).toBeGreaterThanOrEqual(0);
  expect(menuBox.x + menuBox.width).toBeLessThanOrEqual(viewport.width + 1);
  expect(menuBox.y + menuBox.height).toBeLessThanOrEqual(viewport.height + 1);

  await page.keyboard.press('Escape');
  await expect(menu).toBeHidden();
  const foreign = await page.evaluate(() => window.__STATEFALL_TEST__.focusTarget('foreign', 4));
  await page.mouse.click(box.x + foreign.x, box.y + foreign.y, {button: 'right'});
  await expect(menu).toBeVisible();
  const action = menu.locator('button[data-act="transport"], button[data-act="nap"], button[data-act="ally"], button[data-act="war"]').filter({visible: true}).first();
  await expect(action).toBeEnabled();
  const expectedAction = await action.getAttribute('data-act');
  await action.click();
  await expect(menu).toBeHidden();
  const command = await page.evaluate(() => window.__STATEFALL_TEST__.snapshot().input.lastCommand);
  expect(command.k).toBe('menu');
  expect(command.a[0].act).toBe(expectedAction);
  expect(command.a[1]).toBe(foreign.tile);
  command.a[0].act = 'mutated outside game';
  expect(await page.evaluate(() => window.__STATEFALL_TEST__.snapshot().input.lastCommand.a[0].act)).toBe(expectedAction);
});

test('dense late-game fixture exposes strategic visual layers', async ({page}, testInfo) => {
  test.skip(testInfo.project.name.includes('mobile'), 'full-game evidence follows the desktop-first policy');
  await startFixedMatch(page, {seed: 'PHASEALATEGAME', mode: MODES.find(mode => mode.key === 'fog'), controlled: true});
  const scene=await page.evaluate(() => window.__STATEFALL_TEST__.installLateGameScene());
  expect(scene).toMatchObject({fixture:'dense-late-game',nations:3,adjacentOwnership:true,selectedShips:1,fog:true,alerts:1,notices:1});
  expect(scene.structures).toBeGreaterThanOrEqual(10);
  expect(scene.ships).toBeGreaterThanOrEqual(4);
  expect(scene.aircraft).toBeGreaterThanOrEqual(3);
  expect(scene.missiles + scene.shells).toBeGreaterThanOrEqual(3);
  expect(scene.attacks).toBeGreaterThan(0);
  expect(scene.supplyRoutes).toBeGreaterThan(0);
  expect(scene.hiddenTiles).toBeGreaterThan(0);
  await expect(page.locator('#notices')).toContainText('Eastern front under bombardment');
  if(testInfo.project.name === 'chromium-desktop' && process.platform === 'win32'){
    await page.evaluate(() => window.__STATEFALL_TEST__.freezePresentation());
    await expect(page.locator('#stage')).toHaveScreenshot('dense-late-game.png',{animations:'disabled'});
  }
});

test('loads and plays the historical replay fixture in the browser', async ({page}, testInfo) => {
  test.skip(testInfo.project.name.includes('mobile'), 'full-game replay coverage follows the desktop-first policy');
  await page.goto(GAME_URL,{waitUntil:'load'});
  const loaded=await page.evaluate(file => window.__STATEFALL_TEST__.loadReplay(file),replayFixture);
  expect(loaded.ready).toBe(true);
  expect(loaded.replay).toMatchObject({on:true,commands:1,applied:0,targetTick:200,mismatch:false});
  await expect(page.locator('#modal')).toContainText('Replay loaded');
  await expect(page.locator('#replayBar')).toBeVisible();
  await page.locator('#rpPlay').click();
  await page.locator('#rpSpeed button[data-sp="8"]').click();
  await expect.poll(() => page.evaluate(() => window.__STATEFALL_TEST__.status().tick)).toBeGreaterThanOrEqual(30);
  const playing=await page.evaluate(() => window.__STATEFALL_TEST__.status());
  expect(playing.replay).toMatchObject({on:true,commands:1,applied:1,mismatch:false,speed:8});
  await page.locator('#rpTake').click();
  const takenOver=await page.evaluate(() => window.__STATEFALL_TEST__.snapshot());
  expect(takenOver.replay.on).toBe(false);
  expect(takenOver.input.commands).toBe(1);
  expect(takenOver.input.lastCommand).toMatchObject({k:'focus',a:[0.35]});
  await expect(page.locator('#replayBar')).toBeHidden();
});

test('8x watch stops and finalizes exactly at the replay target', async ({page}, testInfo) => {
  test.skip(testInfo.project.name !== 'chromium-desktop', 'exact accelerated watch coverage runs in primary Chromium');
  await page.goto(GAME_URL,{waitUntil:'load'});
  await page.evaluate(file=>window.__STATEFALL_TEST__.loadReplay(file),replayFixture);
  await page.locator('#rpPlay').click();
  await page.locator('#rpSpeed button[data-sp="8"]').click();
  await expect.poll(()=>page.evaluate(()=>window.__STATEFALL_TEST__.status()),{timeout:15_000}).toMatchObject({tick:200,paused:true,replay:{on:true,targetTick:200,speed:8,mismatch:false,finalVerified:true,verifiedEvidence:true,finished:true}});
  await page.waitForTimeout(500);
  expect(await page.evaluate(()=>window.__STATEFALL_TEST__.status())).toMatchObject({tick:200,paused:true,replay:{finished:true,finalVerified:true,mismatch:false}});
});

test('resume catch-up suspends once on checkpoint divergence and Continue reaches exact live target', async ({page}, testInfo) => {
  test.skip(testInfo.project.name !== 'chromium-desktop', 'resume controller coverage runs in primary Chromium');
  test.setTimeout(60_000);
  const replay=await createCanonicalResumeReplay(page,'RESUMEDIVERGE');
  await page.evaluate(file=>window.__STATEFALL_TEST__.loadReplay(file,'resume'),tamperFirstCheckpoint(replay));
  await expect(page.locator('#modal')).toContainText('This replay has diverged');
  const paused=await page.evaluate(()=>window.__STATEFALL_TEST__.status());
  expect(paused).toMatchObject({tick:100,paused:true,replay:{on:true,mismatch:true,divTick:100},catchup:{status:'suspended',target:200,framePending:false}});
  expect(paused.replay.why).toBeTruthy();
  await page.waitForTimeout(400);
  const stillPaused=await page.evaluate(()=>window.__STATEFALL_TEST__.status());
  expect(stillPaused.tick).toBe(100);
  expect(stillPaused.catchup.framesScheduled).toBe(paused.catchup.framesScheduled);
  expect(stillPaused.catchup.framesRun).toBe(paused.catchup.framesRun);
  await page.locator('#dvCont').click();
  await expect(page.locator('#cuPlay')).toBeVisible();
  const ready=await page.evaluate(()=>window.__STATEFALL_TEST__.status());
  expect(ready).toMatchObject({tick:200,paused:true,replay:{on:true,mismatch:true,finalVerified:true},catchup:{status:'ready',target:200,framePending:false}});
  await page.locator('#cuPlay').click();
  const resumed=await page.evaluate(()=>window.__STATEFALL_TEST__.status());
  expect(resumed).toMatchObject({ready:true,paused:false,replay:{on:false},catchup:{status:'idle',framePending:false}});
  expect(resumed.tick).toBeGreaterThanOrEqual(200);
  await page.waitForTimeout(150);
  expect((await page.evaluate(()=>window.__STATEFALL_TEST__.status())).tick).toBeGreaterThan(resumed.tick);
});

test('Stop replay resets a diverged resume and a subsequent ordinary resume succeeds', async ({page}, testInfo) => {
  test.skip(testInfo.project.name !== 'chromium-desktop', 'sequential resume coverage runs in primary Chromium');
  test.setTimeout(60_000);
  const replay=await createCanonicalResumeReplay(page,'RESUMESTOP');
  await page.evaluate(file=>window.__STATEFALL_TEST__.loadReplay(file,'resume'),tamperFirstCheckpoint(replay));
  await expect(page.locator('#dvStop')).toBeVisible();
  await page.locator('#dvStop').click();
  await expect(page.locator('#start')).toBeVisible();
  expect(await page.evaluate(()=>window.__STATEFALL_TEST__.status())).toMatchObject({ready:false,tick:0,replay:{on:false,mismatch:false,why:null,divTick:null,finalVerified:false,verifiedEvidence:false},catchup:{status:'idle',framePending:false}});
  await page.evaluate(file=>window.__STATEFALL_TEST__.loadReplay(file,'resume'),replay);
  await expect(page.locator('#cuPlay')).toBeVisible();
  const ready=await page.evaluate(()=>window.__STATEFALL_TEST__.status());
  expect(ready).toMatchObject({tick:200,paused:true,replay:{on:true,mismatch:false,why:null,divTick:null,finalVerified:true,verifiedEvidence:true},catchup:{status:'ready',target:200}});
  await page.locator('#cuPlay').click();
  const resumed=await page.evaluate(()=>window.__STATEFALL_TEST__.status());
  expect(resumed).toMatchObject({paused:false,replay:{on:false},catchup:{status:'idle'}});
  expect(resumed.tick).toBeGreaterThanOrEqual(200);
});

test('browser replay payload includes strong final evidence for a short save', async ({page}, testInfo) => {
  test.skip(testInfo.project.name !== 'chromium-desktop', 'save payload authority coverage runs in primary Chromium');
  await startFixedMatch(page,{seed:'SHORTSAVE',controlled:true});
  await page.evaluate(()=>window.__STATEFALL_TEST__.advance(25));
  const payload=await page.evaluate(()=>window.__STATEFALL_TEST__.replayPayload());
  expect(payload.tick).toBe(25);
  expect(payload.hashes).toEqual([]);
  expect(payload.requiresCanonicalCheckpoints).toBe(true);
  expect(payload.finalHash).toMatch(/^[0-9a-f]{8}$/);
  expect(payload.finalDigest).toEqual(payload.final.canonical);
  expect(payload.final).toMatchObject({tick:25,legacyHash:payload.finalHash,canonical:{version:'statefall-authoritative-state/v1'},commandCount:0,replayCursor:null});
  expect(payload.final.canonical.sha256).toMatch(/^[0-9a-f]{64}$/);
  expect(payload.final.rngDraws).toBeGreaterThan(0);
});

test('credits replay reset clears setup scratch before rebuilding the match', async ({page}, testInfo) => {
  test.skip(testInfo.project.name.includes('mobile'), 'credits replay reset coverage follows the desktop-first policy');
  await startFixedMatch(page,{seed:'CREDITSRESET',mode:MODES[0],controlled:true});
  const result=await page.evaluate(()=>window.__STATEFALL_TEST__.creditsReplayResetContract());
  expect(result.scratchCleared).toBe(true);
  expect(result.setupInstalled).toBe(true);
  expect(result.status).toMatchObject({ready:true,tick:0,replay:{on:true,applied:0,targetTick:0}});
});

test('rejects malformed and unsupported replay commands before configuration', async ({page}, testInfo) => {
  test.skip(testInfo.project.name.includes('mobile'), 'full-game replay coverage follows the desktop-first policy');
  await page.goto(GAME_URL,{waitUntil:'load'});
  const result=await page.evaluate(file=>{
    const before=window.__STATEFALL_TEST__.status();
    const messages=[];
    for(const mutate of ['malformed','unsupported']){
      const replay=structuredClone(file);
      if(mutate==='malformed') replay.cmds[0].a=[2];
      else replay.cmds[0].k='futureCommand';
      try{ window.__STATEFALL_TEST__.loadReplay(replay); messages.push('accepted'); }
      catch(error){ messages.push(error.message); }
    }
    return {before,after:window.__STATEFALL_TEST__.status(),messages};
  },replayFixture);
  expect(result.messages[0]).toContain('cmds[0].a');
  expect(result.messages[1]).toContain('cmds[0].k');
  expect(result.after.ready).toBe(result.before.ready);
  expect(result.after.replay).toEqual(result.before.replay);
});

test('invalid replay settings leave start state usable and allow a successful retry', async ({page}, testInfo) => {
  test.skip(testInfo.project.name.includes('mobile'), 'replay boundary coverage runs on desktop');
  await page.goto(GAME_URL,{waitUntil:'load'});
  const result=await page.evaluate(file=>{
    const before=window.__STATEFALL_TEST__.status(),messages=[];
    for(const mutate of [replay=>{ replay.settings.troops=0; },replay=>{ replay.settings.troops=1_000_000_001; },replay=>{ replay.settings=[]; }]){
      const candidate=structuredClone(file); mutate(candidate);
      try{ window.__STATEFALL_TEST__.loadReplay(candidate); messages.push('accepted'); }catch(error){ messages.push(error.message); }
    }
    return {before,after:window.__STATEFALL_TEST__.status(),messages};
  },replayFixture);
  expect(result.messages).toHaveLength(3);
  expect(result.messages.every(message=>message!=='accepted')).toBe(true);
  expect(result.after).toEqual(result.before);
  await expect(page.locator('#start')).toBeVisible();
  await expect(page.locator('#startBtn')).toBeEnabled();
  const loaded=await page.evaluate(file=>window.__STATEFALL_TEST__.loadReplay(file),replayFixture);
  expect(loaded.ready).toBe(true);
  await expect(page.locator('#modal')).toContainText('Replay loaded');
});

test('invalid start configuration reports the error without hiding the start card', async ({page}) => {
  await page.goto(GAME_URL,{waitUntil:'load'});
  await page.locator('#settingsBtn').click();
  await page.locator('#stTroops').fill('0');
  await page.locator('#settingsClose').click();
  await page.locator('#startBtn').click();
  await expect(page.locator('#start')).toBeVisible();
  await expect(page.locator('#startBtn')).toBeEnabled();
  expect(await page.evaluate(()=>window.__STATEFALL_TEST__.status().ready)).toBe(false);
  await page.locator('#settingsBtn').click();
  await page.locator('#stTroops').fill('120');
  await page.locator('#settingsClose').click();
  await page.locator('#startBtn').click();
  await expect.poll(()=>page.evaluate(()=>window.__STATEFALL_TEST__.status().ready)).toBe(true);
});

test('start and settings cards avoid horizontal overflow on desktop and mobile', async ({page}) => {
  await page.goto(GAME_URL, {waitUntil: 'load'});
  const assertNoHorizontalOverflow = async selector => {
    const layout = await page.locator(selector).evaluate(element => ({
      documentWidth: document.documentElement.scrollWidth,
      viewportWidth: document.documentElement.clientWidth,
      rect: element.getBoundingClientRect().toJSON()
    }));
    expect(layout.documentWidth).toBeLessThanOrEqual(layout.viewportWidth);
    expect(layout.rect.left).toBeGreaterThanOrEqual(-1);
    expect(layout.rect.right).toBeLessThanOrEqual(layout.viewportWidth + 1);
  };
  await assertNoHorizontalOverflow('#start .card');
  await page.locator('#settingsBtn').click();
  await expect(page.locator('#settings')).toBeVisible();
  await assertNoHorizontalOverflow('#settings .card');
});

test('resizes without document overflow and keeps the Canvas usable', async ({page}, testInfo) => {
  await startFixedMatch(page);
  const viewport = testInfo.project.name.includes('mobile') ? {width: 412, height: 732} : {width: 1024, height: 640};
  await page.setViewportSize(viewport);

  await expect.poll(() => page.evaluate(() => {
    const canvas = window.__STATEFALL_TEST__.snapshot().canvas;
    const rendering=window.__STATEFALL_TEST__.snapshot().rendering;
    return canvas.width===rendering.pixelWidth&&canvas.height===rendering.pixelHeight;
  })).toBe(true);
  const layout = await page.evaluate(() => ({
    documentWidth: document.documentElement.scrollWidth,
    viewportWidth: document.documentElement.clientWidth,
    bodyWidth: document.body.scrollWidth,
    canvas: window.__STATEFALL_TEST__.snapshot().canvas,
    rendering: window.__STATEFALL_TEST__.snapshot().rendering,
    side: document.querySelector('#side').getBoundingClientRect().toJSON()
  }));
  expect(layout.documentWidth).toBeLessThanOrEqual(layout.viewportWidth);
  expect(layout.bodyWidth).toBeLessThanOrEqual(layout.viewportWidth);
  expect(layout.canvas.width).toBe(layout.rendering.pixelWidth);
  expect(layout.canvas.height).toBe(layout.rendering.pixelHeight);
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
      await expect.poll(() => testPage.evaluate(() => window.__STATEFALL_TEST__?.status().ready)).toBe(true);
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
    expect(result.draws,`${name} cruise RNG draws`).toBe(0);
    expect(result.order,`${name} cruise target order`).toEqual(['shield-a','shield-b']);
  }
  expect(new Set(Object.values(cruise).map(JSON.stringify)).size,JSON.stringify(cruise,null,2)).toBe(1);
  expect(new Set(Object.values(digests)).size,`${JSON.stringify(digests,null,2)}\n${detail}`).toBe(1);
  for(const [name,digest] of Object.entries(digests)) assertCanonicalBaseline('browser','fixed-seed-cross-engine',digest,`${name}\n${detail}`);
});

test('real Canvas rendering is pure and irregular render cadence cannot change simulation', async ({page}, testInfo) => {
  test.skip(testInfo.project.name !== 'chromium-desktop', 'renderer-purity contract runs in primary Chromium');
  await startFixedMatch(page, {seed: 'PHASEDRENDER', controlled: true});
  const before=await page.evaluate(() => window.__STATEFALL_TEST__.canonicalCheckpoint());
  const loopBefore=await page.evaluate(() => window.__STATEFALL_TEST__.renderingLifecycle());
  const rendered=await page.evaluate(() => window.__STATEFALL_TEST__.renderRepeatedly(17));
  const after=await page.evaluate(() => window.__STATEFALL_TEST__.canonicalCheckpoint());
  expect(rendered).toEqual({hash:before.hash,rng:before.rng,tick:before.tick});
  expect(after).toEqual(before);
  const loopAfter=await page.evaluate(() => window.__STATEFALL_TEST__.renderingLifecycle());
  expect(loopBefore).toMatchObject({frozen:false,rafPending:1});
  expect(loopAfter).toMatchObject({frozen:false,rafPending:1});
  await expect.poll(() => page.evaluate(() => window.__STATEFALL_TEST__.renderingLifecycle().rafCallbacks)).toBeGreaterThan(loopAfter.rafCallbacks);
  expect(await page.evaluate(() => window.__STATEFALL_TEST__.renderingLifecycle().rafPending)).toBe(1);

  await page.evaluate(() => window.__STATEFALL_TEST__.advance(120));
  const controlled=await page.evaluate(() => window.__STATEFALL_TEST__.canonicalCheckpoint());
  await startFixedMatch(page, {seed: 'PHASEDRENDER', controlled: true});
  await page.evaluate(() => window.__STATEFALL_TEST__.advanceWithRenderCadence(120, [0, 1, 4, 7, 8]));
  const irregular=await page.evaluate(() => window.__STATEFALL_TEST__.canonicalCheckpoint());
  expect(irregular).toEqual(controlled);

  await startFixedMatch(page, {seed: 'PHASEDINTERPOLATION', controlled: true});
  await page.evaluate(() => window.__STATEFALL_TEST__.installLateGameScene());
  const interpolation=await page.evaluate(() => {
    const before=window.__STATEFALL_TEST__.interpolationFrame();
    window.__STATEFALL_TEST__.advance(1);
    window.__STATEFALL_TEST__.renderRepeatedly(1);
    const after=window.__STATEFALL_TEST__.interpolationFrame();
    return {beforeTick:before.current.tickId,previousTick:after.previous.tickId,currentTick:after.current.tickId,canvas:window.__STATEFALL_TEST__.interpolationCanvasStatus()};
  });
  expect(interpolation.previousTick).toBe(interpolation.beforeTick);
  expect(interpolation.currentTick).toBe(interpolation.beforeTick+1);
  expect(interpolation.canvas.renderedActors).toBeGreaterThan(0);
});
