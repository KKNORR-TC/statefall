const {test, expect} = require('@playwright/test');
const {createCanvas,loadImage}=require('canvas');

const GAME_URL = '/index.html?browserTest=1&case=PHASEADISPLAYSCALE';
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

async function startMatch(page,renderer='canvas') {
  await page.goto(`${GAME_URL}&renderer=${renderer}`, {waitUntil: 'load'});
  await expect.poll(()=>page.evaluate(()=>typeof window.__STATEFALL_TEST__)).toBe('object');
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

async function screenshotPixels(locator){
  const image=await loadImage(await locator.screenshot()),canvas=createCanvas(image.width,image.height),context=canvas.getContext('2d');
  context.drawImage(image,0,0); return {width:image.width,height:image.height,data:context.getImageData(0,0,image.width,image.height).data};
}

function changedPixelsInColumns(a,b,columns){
  let changed=0;
  for(let y=0;y<a.height;y++) for(let x=0;x<Math.min(columns,a.width);x++){
    const offset=(y*a.width+x)*4;
    if(a.data[offset]!==b.data[offset]||a.data[offset+1]!==b.data[offset+1]||a.data[offset+2]!==b.data[offset+2]||a.data[offset+3]!==b.data[offset+3]) changed++;
  }
  return changed;
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
  let center={x:target.x,y:target.y};

  for (const viewport of VIEWPORTS) {
    const beforeBounds=await page.evaluate(() => window.__STATEFALL_TEST__.snapshot().camera.visibleBounds);
    const beforeFocus={x:(beforeBounds.left+beforeBounds.right)/2,y:(beforeBounds.top+beforeBounds.bottom)/2};
    await page.setViewportSize(viewport);
    await expect.poll(() => page.evaluate(() => {
      const state = window.__STATEFALL_TEST__.snapshot();
      return state.canvas.width===state.rendering.pixelWidth&&state.canvas.height===state.rendering.pixelHeight;
    })).toBe(true);
    await expect.poll(() => readDisplayState(page).then(state => state.colors)).toBeGreaterThan(8);

    const state = await readDisplayState(page);
    expect(state.dpr).toBe(expectedDpr);
    expect(state.canvas.width).toBe(Math.round(state.canvas.clientWidth*Math.min(expectedDpr,2)));
    expect(state.canvas.height).toBe(Math.round(state.canvas.clientHeight*Math.min(expectedDpr,2)));
    expect(state.canvas.width).toBeGreaterThan(100);
    expect(state.canvas.height).toBeGreaterThan(100);
    expect(state.opaqueSamples).toBe(state.samples);
    expectContained(state);

    center={x:state.canvas.clientWidth/2,y:state.canvas.clientHeight/2};
    expect(await page.evaluate(point => window.__STATEFALL_TEST__.screenToTile(point.x,point.y),center)).toBe(target.tile);
    const afterBounds=await page.evaluate(() => window.__STATEFALL_TEST__.snapshot().camera.visibleBounds);
    expect((afterBounds.left+afterBounds.right)/2).toBeCloseTo(beforeFocus.x,8);
    expect((afterBounds.top+afterBounds.bottom)/2).toBeCloseTo(beforeFocus.y,8);
  }

  const canvas = page.locator('#map');
  await canvas.hover({position: center});
  await expect.poll(() => page.evaluate(() => window.__STATEFALL_TEST__.snapshot().input.hover)).toBe(target.tile);
  const commands = await page.evaluate(() => window.__STATEFALL_TEST__.snapshot().input.commands);
  await canvas.click({position: center});
  await expect.poll(() => page.evaluate(() => window.__STATEFALL_TEST__.snapshot().input.commands)).toBe(commands + 1);
  expect(await page.evaluate(() => window.__STATEFALL_TEST__.snapshot().input.lastCommand.a[0])).toBe(target.tile);
});

test('keeps Pixi raster and Canvas overlay aligned across desktop display scales',async({page},testInfo)=>{
  await startMatch(page,'pixi');
  const expectedDpr=Math.min(testInfo.project.use.deviceScaleFactor,2);
  const target=await page.evaluate(()=>window.__STATEFALL_TEST__.focusTarget('owned',4));
  for(const size of VIEWPORTS){
    const before=await page.evaluate(()=>window.__STATEFALL_TEST__.snapshot().camera.visibleBounds);
    await page.setViewportSize(size);
    await expect.poll(()=>page.evaluate(()=>window.__STATEFALL_TEST__.rendererDiagnostics().pixelWidth)).toBe(Math.round(documentWidth(size)*expectedDpr));
    const state=await page.evaluate(()=>{
      const snapshot=window.__STATEFALL_TEST__.snapshot(),map=document.querySelector('#map').getBoundingClientRect(),world=document.querySelector('.pixi-world').getBoundingClientRect();
      return {snapshot,map:map.toJSON(),world:world.toJSON()};
    });
    expect(state.snapshot.rendering).toMatchObject({active:'pixi-hybrid',effectiveDpr:expectedDpr,capabilities:{preStructures:true,structures:true},layers:{terrain:{textureCount:1},preStructures:{owned:true}}});
    expect(state.snapshot.canvas.width).toBe(state.snapshot.rendering.pixelWidth);
    expect(state.snapshot.canvas.height).toBe(state.snapshot.rendering.pixelHeight);
    expect(state.world).toMatchObject({x:state.map.x,y:state.map.y,width:state.map.width,height:state.map.height});
    const center={x:state.map.width/2,y:state.map.height/2};
    expect(await page.evaluate(point=>window.__STATEFALL_TEST__.screenToTile(point.x,point.y),center)).toBe(target.tile);
    const after=state.snapshot.camera.visibleBounds;
    expect((after.left+after.right)/2).toBeCloseTo((before.left+before.right)/2,8);
    expect((after.top+after.bottom)/2).toBeCloseTo((before.top+before.bottom)/2,8);
  }
});

test('keeps Pixi structure sprites aligned to Canvas CSS-pixel coordinates across desktop display scales',async({page},testInfo)=>{
  await startMatch(page,'pixi');
  await page.evaluate(()=>{ window.__STATEFALL_TEST__.installLateGameScene(); window.__STATEFALL_TEST__.freezePresentation(); });
  const state=await page.evaluate(()=>{ const expected=window.__STATEFALL_TEST__.structurePresentation(); return {rendering:window.__STATEFALL_TEST__.exerciseStructureLayer(expected,{preStructures:expected}).rendering,expected}; });
  test.skip(state.rendering.active!=='pixi-hybrid','Pixi WebGL renderer unavailable');
  expect(state.rendering.effectiveDpr).toBe(Math.min(testInfo.project.use.deviceScaleFactor,2));
  expect(state.rendering.layers.structures.visible).toBe(state.expected.length);
  const expected=new Map(state.expected.map(item=>[item.tile,item]));
  for(const sprite of state.rendering.layers.structures.instances){
    const position=expected.get(sprite.tile); expect(sprite.x).toBeCloseTo(position.x,8); expect(sprite.y).toBeCloseTo(position.y,8);
    expect(await page.evaluate(point=>window.__STATEFALL_TEST__.screenToTile(point.x,point.y),sprite)).toBe(sprite.tile);
  }
});

test('uses rasterized scaled-texture fringe for edge culling and compositing conflicts at every DPR',async({page},testInfo)=>{
  await startMatch(page,'pixi');
  await page.evaluate(()=>{ window.__STATEFALL_TEST__.installLateGameScene(); window.__STATEFALL_TEST__.freezePresentation(); });
  const dpr=Math.min(testInfo.project.use.deviceScaleFactor,2),source=await page.evaluate(()=>window.__STATEFALL_TEST__.structurePresentation()[0]);
  const edge=await page.evaluate(item=>{
    const scale=12,pop=1.35,radius=scale*2.4,visualRadius=radius*pop,geometricExtent=visualRadius+Math.max(1.5,visualRadius*.18)/2;
    const tileX=item.tile%720,tileY=(item.tile-tileX)/720,x=-(geometricExtent+1.2),y=180;
    window.__STATEFALL_TEST__.setCameraOrigin(x-(tileX+.5)*scale,y-(tileY+.5)*scale,scale);
    const empty=window.__STATEFALL_TEST__.exerciseStructureLayer([],{preStructures:[]});
    return {item:{...item,type:'city',building:false,pop},x,y,geometricExtent,empty};
  },source);
  test.skip(edge.empty.rendering.active!=='pixi-hybrid','Pixi WebGL renderer unavailable');
  const before=await screenshotPixels(page.locator('.pixi-world'));
  const visible=await page.evaluate(item=>window.__STATEFALL_TEST__.exerciseStructureLayer([item],{preStructures:[item]}),edge.item);
  expect(visible).toMatchObject({preOwned:true,owned:true,rendering:{layers:{structures:{visible:1,culled:0}}}});
  const instance=visible.rendering.layers.structures.instances[0];
  expect(instance.paintBounds.left).toBeLessThan(0);
  expect(instance.paintBounds.right).toBeGreaterThan(0);
  expect(edge.x+edge.geometricExtent).toBeLessThan(-1,'only scaled source-texture AA lies inside the viewport');
  const after=await screenshotPixels(page.locator('.pixi-world'));
  const fringePixels=changedPixelsInColumns(before,after,Math.ceil(2*dpr));
  expect(fringePixels,'browser-rasterized icon fringe must reach the viewport edge').toBeGreaterThan(0);

  const conflict=await page.evaluate(item=>{
    const scale=12,tileX=item.tile%720,tileY=(item.tile-tileX)/720;
    window.__STATEFALL_TEST__.setCameraOrigin(240-(tileX+.5)*scale,180-(tileY+.5)*scale,scale);
    const first={...item,type:'city',building:false,pop:1.35},within={...item,tile:item.tile+8,type:'city',building:false,pop:1.35},beyond={...item,tile:item.tile+9,type:'city',building:false,pop:1.35};
    return {
      within:window.__STATEFALL_TEST__.exerciseStructureLayer([first,within],{preStructures:[first,within]}),
      beyond:window.__STATEFALL_TEST__.exerciseStructureLayer([first,beyond],{preStructures:[first,beyond]})
    };
  },source);
  expect(conflict.within).toMatchObject({preOwned:false,owned:false,rendering:{layers:{preStructures:{compositingConflictFallback:{reason:'earlier-pop-ring-overlaps-later-base'}},structures:{visible:0}}}});
  expect(conflict.beyond).toMatchObject({preOwned:true,owned:true,rendering:{compositingConflictFallback:{reason:null},layers:{structures:{visible:2,culled:0}}}});
  console.log(`DPR ${dpr} scaled texture edge: ${fringePixels} changed raster pixels in first ${Math.ceil(2*dpr)} columns; 96px gap fallback, 108px gap safe`);
});

function documentWidth(viewport){ return viewport.width>700?viewport.width-300:viewport.width; }
