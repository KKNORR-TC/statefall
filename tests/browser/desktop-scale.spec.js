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
  await page.evaluate(async() => { window.__STATEFALL_TEST__.pause(); await window.__STATEFALL_TEST__.terrainRasterSettled(); window.__STATEFALL_TEST__.renderRepeatedly(1); });
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

test('uses rasterized scaled-texture fringe for edge culling and ordered overlap at every DPR',async({page},testInfo)=>{
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

  const overlap=await page.evaluate(item=>{
    const scale=12,tileX=item.tile%720,tileY=(item.tile-tileX)/720;
    window.__STATEFALL_TEST__.setCameraOrigin(240-(tileX+.5)*scale,180-(tileY+.5)*scale,scale);
    const first={...item,type:'city',building:false,pop:1.35},within={...item,tile:item.tile+8,type:'city',building:false,pop:1.35},beyond={...item,tile:item.tile+9,type:'city',building:false,pop:1.35};
    return {
      within:window.__STATEFALL_TEST__.exerciseStructureLayer([first,within],{preStructures:[first,within]}),
      beyond:window.__STATEFALL_TEST__.exerciseStructureLayer([first,beyond],{preStructures:[first,beyond]})
    };
  },source);
  expect(overlap.within).toMatchObject({preOwned:true,owned:true,rendering:{compositingConflictFallback:{active:false,reason:null},layers:{structures:{visible:2,culled:0}}}});
  expect(overlap.beyond).toMatchObject({preOwned:true,owned:true,rendering:{compositingConflictFallback:{active:false,reason:null},layers:{structures:{visible:2,culled:0}}}});
  console.log(`DPR ${dpr} scaled texture edge: ${fringePixels} changed raster pixels in first ${Math.ceil(2*dpr)} columns; 96px and 108px overlaps remain Pixi-owned`);
});

test('matches Canvas alphabetic-baseline label semantics and overlapping level/queue/arc pixels at every DPR',async({page},testInfo)=>{
  await startMatch(page,'pixi'); await page.evaluate(()=>{ window.__STATEFALL_TEST__.installLateGameScene(); window.__STATEFALL_TEST__.freezePresentation(); });
  const evidence=await page.evaluate(()=>{ const source=window.__STATEFALL_TEST__.structurePresentation()[0],item={...source,type:'airfield',pop:1.2,level:3,upgrading:true,upgradeFraction:.4,airQueue:true,airQueueFraction:.5,airQueueText:'2/6 · F 12s',shipQueue:true,shipQueueFraction:.75,shipQueueText:'Cruiser 12s +1'},result=window.__STATEFALL_TEST__.exerciseStructureLayer([item],{preStructures:[item]}),instance=result.rendering.layers.structures.instances[0],r=instance.radius; return {result,probe:window.__STATEFALL_TEST__.structureLabelCanvasProbe({x:instance.x,y:instance.y,r})}; });
  test.skip(evidence.result.rendering.active!=='pixi-hybrid','Pixi WebGL renderer unavailable');
  const order=evidence.result.rendering.layers.structures.order[0];
  expect(order.children).toEqual(['base','pop-graphics','level-mark','upgrade-graphics','airfield-label','airfield-arc','ship-arc','ship-label']);
  const level=order.labels.find(value=>value.kind==='level-label'),air=order.labels.find(value=>value.kind==='airfield-label'),ship=order.labels.find(value=>value.kind==='ship-queue-label');
  expect(level).toMatchObject({x:evidence.probe.level.x,y:evidence.probe.level.y,align:'center',baseline:'alphabetic',layers:[{operation:'stroke',text:'II'},{operation:'fill',text:'III'}]});
  expect(air).toMatchObject({x:evidence.probe.queue.x,y:evidence.probe.queue.y,baseline:'alphabetic'}); expect(ship).toMatchObject({x:air.x,y:air.y,baseline:'alphabetic'});
  const decode=async input=>{ const image=await loadImage(input),canvas=createCanvas(image.width,image.height),context=canvas.getContext('2d'); context.drawImage(image,0,0); return {width:image.width,height:image.height,data:context.getImageData(0,0,image.width,image.height).data}; };
  const canvas=await decode(evidence.probe.dataUrl),pixi=await decode(await page.locator('.pixi-world').screenshot()),dpr=evidence.probe.dpr;
  const count=(image,point,radius,predicate)=>{ let total=0,cx=point.x*dpr,cy=point.y*dpr,rr=radius*dpr; for(let y=Math.max(0,Math.floor(cy-rr));y<=Math.min(image.height-1,Math.ceil(cy+rr));y++) for(let x=Math.max(0,Math.floor(cx-rr));x<=Math.min(image.width-1,Math.ceil(cx+rr));x++){ const offset=(y*image.width+x)*4; if(predicate(...image.data.slice(offset,offset+4))) total++; } return total; };
  const gold=(r,g,b,a)=>a>0&&r>180&&g>120&&b<150,white=(r,g,b,a)=>a>0&&r>185&&g>185&&b>185,cyan=(r,g,b,a)=>a>0&&r>120&&g>170&&b>190;
  for(const [name,point,radius,predicate] of [['level',evidence.probe.level,10,gold],['overlapping queue labels',evidence.probe.queue,14,white],['overlapping queue arcs',evidence.probe.arc,5,cyan]]){
    expect(count(canvas,point,radius,predicate),`Canvas ${name} pixels at DPR ${dpr}`).toBeGreaterThan(0); expect(count(pixi,point,radius,predicate),`Pixi ${name} pixels at DPR ${dpr}`).toBeGreaterThan(0);
  }
});

test('keeps Pixi naval logistics hulls, routes, wakes, labels, cargo, and boarding aligned at every DPR',async({page},testInfo)=>{
  await startMatch(page,'pixi'); await page.evaluate(()=>{ window.__STATEFALL_TEST__.installLateGameScene(); window.__STATEFALL_TEST__.freezePresentation(); });
  const evidence=await page.evaluate(()=>{ const api=window.__STATEFALL_TEST__,camera=api.snapshot().camera,world=(x,y)=>[(x-camera.x)/camera.scale,(y-camera.y)/camera.scale],tile=(x,y)=>Math.max(0,Math.min(720*414-1,Math.floor(y)*720+Math.floor(x))),transport=(x,color,heavy)=>{ const [wx,wy]=world(x,280),[sx,sy]=world(x-100,280); return {x:wx,y:wy,heading:0,troops:heavy?88:12,hp:3,maxHp:4,heavy,color,visible:true,pos:1,path:[tile(sx,sy)],wake:[[wx-15,wy],[wx-5,wy]],speed:1.3}; },[mx,my]=world(760,330),[x1,y1]=world(-40,360),[x2,y2]=world(1320,360),state={transports:[transport(400,'#ff3355',false),transport(620,'#33cc66',true)],merchants:[{x:mx,y:my,heading:0,color:'#3f7bd9',visible:true,wake:[[mx-12,my],[mx-4,my]],speed:1.3}],boarding:[{x:x1,y:y1,targetX:x2,targetY:y2,active:true,visible:true}]}; return api.exerciseNavalLogistics(state); });
  test.skip(!evidence.owned,'Pixi WebGL renderer unavailable'); const dpr=Math.min(testInfo.project.use.deviceScaleFactor,2),image=await screenshotPixels(page.locator('.pixi-world'));
  const count=(x,y,r,predicate)=>{ let total=0; for(let py=Math.max(0,Math.floor((y-r)*dpr));py<=Math.min(image.height-1,Math.ceil((y+r)*dpr));py++) for(let px=Math.max(0,Math.floor((x-r)*dpr));px<=Math.min(image.width-1,Math.ceil((x+r)*dpr));px++){ const offset=(py*image.width+px)*4; if(predicate(...image.data.slice(offset,offset+4))) total++; } return total; };
  expect(count(400,280,20,(r,g,b,a)=>r>180&&g<130&&a>0)).toBeGreaterThan(0); expect(count(350,280,4,(r,g,b,a)=>r>g+25&&r>b+15&&a>0),'route center').toBeGreaterThan(0); expect(count(404,276.5,2,(r,g,b,a)=>r>180&&g>180&&b>180&&a>0),'rounded hull corner').toBeGreaterThan(0); expect(count(620,280,22,(r,g,b,a)=>g>130&&r<180&&a>0)).toBeGreaterThan(0); expect(count(760,330,18,(r,g,b,a)=>b>100&&a>0)).toBeGreaterThan(0); expect(count(640,360,5,(r,g,b,a)=>r>120&&g>90&&b<140&&a>0)).toBeGreaterThan(0);
  expect(evidence.rendering.layers.navalLogistics.presentation[0].styles.find(value=>value.stroke==='#fff')).toMatchObject({kind:'polygon',join:'round'});
  expect(evidence.rendering.layers.navalLogistics).toMatchObject({owned:true,counts:{transports:{visible:2},merchants:{visible:1},boarding:{visible:1}},labelCount:2});
});

test('distinguishes merchant miter corners and boarding butt/round endpoints at every DPR',async({page},testInfo)=>{
  await startMatch(page,'pixi'); await page.evaluate(()=>{ window.__STATEFALL_TEST__.installLateGameScene(); window.__STATEFALL_TEST__.freezePresentation(); });
  const states=await page.evaluate(()=>{ const camera={x:0,y:0,scale:24},viewport={width:1440,height:900},mapWidth=720,merchant={x:760/24,y:330/24,heading:0,color:'#3f7bd9',visible:true,wake:[],speed:1.3},boarding={x:400/24,y:360.5/24,targetX:500/24,targetY:360.5/24,active:true,visible:true},offscreenWake={x:1000,y:1000,heading:0,color:'#3f7bd9',visible:true,wake:[[998,1000],[999,1000]],speed:1.3},api=window.__STATEFALL_TEST__; const butt=api.exerciseNavalLogistics({camera,viewport,mapWidth,transports:[],merchants:[merchant],boarding:[boarding]}); return {butt,roundState:{camera,viewport,mapWidth,transports:[],merchants:[merchant,offscreenWake],boarding:[boarding]}}; });
  test.skip(!states.butt.owned,'Pixi WebGL renderer unavailable'); const buttImage=await screenshotPixels(page.locator('.pixi-world'));
  const round=await page.evaluate(state=>window.__STATEFALL_TEST__.exerciseNavalLogistics(state),states.roundState),roundImage=await screenshotPixels(page.locator('.pixi-world')),dpr=Math.min(testInfo.project.use.deviceScaleFactor,2);
  expect(states.butt.rendering.layers.navalLogistics).toMatchObject({canvasStrokeState:{lineJoin:'miter',lineCap:'butt'}}); expect(round.rendering.layers.navalLogistics).toMatchObject({canvasStrokeState:{lineJoin:'miter',lineCap:'round'},counts:{merchants:{visible:1,culled:1}}});
  const gold=(image,left,top,right,bottom)=>{ let count=0; for(let y=Math.floor(top*dpr);y<=Math.ceil(bottom*dpr);y++) for(let x=Math.floor(left*dpr);x<=Math.ceil(right*dpr);x++){ const i=(y*image.width+x)*4,r=image.data[i],g=image.data[i+1],b=image.data[i+2]; if(r>110&&g>80&&b<150&&r>b+20) count++; } return count; };
  const buttEnd=gold(buttImage,403,359.6,403.8,361.4),roundEnd=gold(roundImage,403,359.6,403.8,361.4); expect(roundEnd,`round cap endpoint pixels at DPR ${dpr}`).toBeGreaterThan(buttEnd);
  const reference=createCanvas(buttImage.width,buttImage.height),context=reference.getContext('2d'); context.scale(dpr,dpr); context.translate(760,330); const u=4.08; context.scale(u,u); context.lineWidth=1.2; context.strokeStyle='#5a4a30'; const draw=join=>{ context.clearRect(-100,-100,200,200); context.lineJoin=join; context.beginPath(); context.moveTo(8,0); context.lineTo(3,-3); context.lineTo(-8,-3); context.lineTo(-8,3); context.lineTo(3,3); context.closePath(); context.stroke(); return context.getImageData(0,0,reference.width,reference.height).data.slice(); },miter=draw('miter'),rounded=draw('round');
  let miterOnly=0,pixiMiter=0; for(let y=Math.floor(324*dpr);y<=Math.ceil(336*dpr);y++) for(let x=Math.floor(792*dpr);x<=Math.ceil(799*dpr);x++){ const i=(y*buttImage.width+x)*4; if(miter[i+3]>32&&rounded[i+3]<16){ miterOnly++; const r=buttImage.data[i],g=buttImage.data[i+1],b=buttImage.data[i+2]; if(r>45&&r<150&&g>25&&g<120&&b<100) pixiMiter++; } }
  expect(miterOnly,`Canvas reference has a miter-only bow region at DPR ${dpr}`).toBeGreaterThan(0); expect(pixiMiter,`Pixi paints the miter-only merchant bow region at DPR ${dpr}`).toBeGreaterThan(0);
});

function documentWidth(viewport){ return viewport.width>700?viewport.width-300:viewport.width; }
