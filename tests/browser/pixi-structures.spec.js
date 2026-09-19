const {test,expect}=require('@playwright/test');
const {createCanvas,loadImage}=require('canvas');

const MAPS=['random','land','islands_l','islands_m','islands_s','atoll','world','europe','americas','africa','asia','mideast'];
const MODES=[{id:'quickStart',label:'quick'},{id:'riskyOn',label:'risky'},{id:'endgameOn',label:'endgame'},{id:'fogOn',label:'fog'},{id:'instantOn',label:'instant'},{id:'billionaireOn',label:'billionaire'},{id:'garrisonOn',label:'garrison'},{id:'stNoCap',label:'no-cap',settings:true},{id:'stPauseBuild',label:'pause-build'}];

test.describe.configure({mode:'serial'});

async function start(page,seed='PHASEE2STRUCTURES',renderer='pixi',query=''){
  await page.addInitScript(()=>{ window.__STATEFALL_TEST_MODE__=true; localStorage.setItem('statefall-audio',JSON.stringify({master:0,sfx:0,alert:0,amb:0,music:0})); });
  await page.goto(`/index.html?browserTest=1&renderer=${renderer}${query}`,{waitUntil:'load'});
  await expect.poll(()=>page.evaluate(()=>typeof window.__STATEFALL_TEST__)).toBe('object');
  await page.evaluate(()=>window.__STATEFALL_TEST__.prepareControlledStart());
  await page.locator('#maps button[data-m="random"]').click(); await page.locator('#seedIn').fill(seed); await page.locator('#countrySel').selectOption('0'); await page.locator('#startBtn').click();
  await expect.poll(()=>page.evaluate(()=>window.__STATEFALL_TEST__.status().ready)).toBe(true);
  await page.evaluate(()=>{ window.__STATEFALL_TEST__.pause(); window.__STATEFALL_TEST__.installLateGameScene(); window.__STATEFALL_TEST__.freezePresentation(); });
}

async function screenshotPixels(locator){
  const image=await loadImage(await locator.screenshot()),canvas=createCanvas(image.width,image.height),context=canvas.getContext('2d');
  context.drawImage(image,0,0); return {width:image.width,height:image.height,data:context.getImageData(0,0,image.width,image.height).data};
}

async function canvasPixels(page,selector){
  const dataUrl=await page.locator(selector).evaluate(canvas=>canvas.toDataURL()),image=await loadImage(dataUrl),canvas=createCanvas(image.width,image.height),context=canvas.getContext('2d');
  context.drawImage(image,0,0); return {width:image.width,height:image.height,data:context.getImageData(0,0,image.width,image.height).data};
}

function brightPixelsAt(image,item){
  let bright=0; const radius=Math.ceil((item.radius||12)*(item.pop||1));
  for(let y=Math.max(0,Math.floor(item.y-radius));y<=Math.min(image.height-1,Math.ceil(item.y+radius));y++) for(let x=Math.max(0,Math.floor(item.x-radius));x<=Math.min(image.width-1,Math.ceil(item.x+radius));x++){
    const offset=(y*image.width+x)*4,r=image.data[offset],g=image.data[offset+1],b=image.data[offset+2]; if(r>210&&g>210&&b>210) bright++;
  }
  return bright;
}

function matchingPixelsAt(image,item,predicate){
  let matches=0; const radius=Math.ceil(item.r||item.radius||4);
  for(let y=Math.max(0,Math.floor(item.y-radius));y<=Math.min(image.height-1,Math.ceil(item.y+radius));y++) for(let x=Math.max(0,Math.floor(item.x-radius));x<=Math.min(image.width-1,Math.ceil(item.x+radius));x++){
    const offset=(y*image.width+x)*4; if(predicate(image.data[offset],image.data[offset+1],image.data[offset+2],image.data[offset+3])) matches++;
  }
  return matches;
}

function changedPixels(a,b){ let changed=0; for(let i=0;i<a.data.length;i+=4) if(a.data[i]!==b.data[i]||a.data[i+1]!==b.data[i+1]||a.data[i+2]!==b.data[i+2]||a.data[i+3]!==b.data[i+3]) changed++; return changed; }

function pixelPatch(image,point){
  if(!point) return null; const result=[],radius=Math.ceil(point.r||2);
  for(let y=Math.max(0,Math.floor(point.y)-radius);y<=Math.min(image.height-1,Math.ceil(point.y)+radius);y++) for(let x=Math.max(0,Math.floor(point.x)-radius);x<=Math.min(image.width-1,Math.ceil(point.x)+radius);x++){ const offset=(y*image.width+x)*4; result.push(...image.data.slice(offset,offset+4)); }
  return result;
}

function cssRgb(value){
  const hex=/^#([0-9a-f]{6})$/i.exec(value||''); if(hex){ const number=parseInt(hex[1],16); return [number>>16,(number>>8)&255,number&255]; }
  const rgb=/rgba?\(\s*(\d+)\s*,\s*(\d+)\s*,\s*(\d+)/i.exec(value||''); return rgb?rgb.slice(1).map(Number):null;
}

async function smokeStart(page,{map='random',mode=null,seed}){
  await page.addInitScript(()=>{ window.__STATEFALL_TEST_MODE__=true; localStorage.setItem('statefall-audio',JSON.stringify({master:0,sfx:0,alert:0,amb:0,music:0})); });
  await page.goto('/index.html?browserTest=1&renderer=pixi',{waitUntil:'load'});
  await expect.poll(()=>page.evaluate(()=>typeof window.__STATEFALL_TEST__)).toBe('object');
  await page.evaluate(()=>window.__STATEFALL_TEST__.prepareControlledStart());
  await page.locator(`#maps button[data-m="${map}"]`).click(); await page.locator('#seedIn').fill(seed); await page.locator('#countrySel').selectOption('0');
  if(mode?.settings) await page.locator('#settingsBtn').click();
  if(mode?.id==='garrisonOn') await page.locator('#garrisonOn').locator('..').click(); else if(mode) await page.locator(`#${mode.id}`).check();
  if(mode?.settings) await page.locator('#settingsClose').click();
  await page.locator('#startBtn').click(); await expect.poll(()=>page.evaluate(()=>window.__STATEFALL_TEST__.status().ready)).toBe(true);
  await page.evaluate(()=>{ window.__STATEFALL_TEST__.pause(); window.__STATEFALL_TEST__.installLateGameScene(); window.__STATEFALL_TEST__.freezePresentation(); });
}

test('Pixi owns every visible structure base beneath Canvas overlays with stable tile alignment and bounded reuse',async({page},testInfo)=>{
  test.skip(testInfo.project.name!=='chromium-desktop','focused E2 source contract runs in primary Chromium');
  await start(page);
  const setup=await page.evaluate(()=>{ const source=window.__STATEFALL_TEST__.structurePresentation()[0],camera=window.__STATEFALL_TEST__.snapshot().camera,scale=camera.scale,items=[{...source,tile:source.tile,type:'city',building:false},{...source,tile:source.tile+20,x:source.x+20*scale,type:'factory',building:false}]; return {camera,items,result:window.__STATEFALL_TEST__.exerciseStructureLayer(items,{preStructures:items})}; });
  const initial={rendering:setup.result.rendering,expected:setup.items};
  test.skip(initial.rendering.active!=='pixi-hybrid','Pixi WebGL renderer unavailable');
  expect(initial.rendering.capabilities.structures).toBe(true);
  expect(initial.rendering.layers.structures).toMatchObject({owned:true,total:initial.expected.length,visible:initial.expected.length,culled:0,pooled:0});
  expect(initial.rendering.layers.structures.textureCount).toBeGreaterThan(0);
  expect(initial.rendering.layers.structures.textureCount).toBeLessThanOrEqual(512);
  expect(initial.rendering.layers.structures.textureBytesEstimate).toBe(initial.rendering.layers.structures.textureCount*64*64*4);
  const image=await screenshotPixels(page.locator('.pixi-world'));
  for(const icon of initial.rendering.layers.structures.instances){
    expect(brightPixelsAt(image,icon),`structure ${icon.type} at tile ${icon.tile} must contain its Canvas-generated white glyph`).toBeGreaterThan(0);
  }
  const byTile=new Map(initial.expected.map(item=>[item.tile,item]));
  expect(initial.rendering.layers.structures.instances.map(item=>item.tile)).toEqual(initial.expected.map(item=>item.tile));
  for(const actual of initial.rendering.layers.structures.instances){
    const expected=byTile.get(actual.tile); expect(expected).toBeTruthy();
    expect(actual).toMatchObject({type:expected.type,color:expected.color,alpha:expected.building?0.45:1});
    expect(actual.x).toBeCloseTo(expected.x,8); expect(actual.y).toBeCloseTo(expected.y,8);
    expect(await page.evaluate(point=>window.__STATEFALL_TEST__.screenToTile(point.x,point.y),actual)).toBe(actual.tile);
  }
  const identity=new Map(initial.rendering.layers.structures.instances.map(item=>[item.tile,item.spriteId]));
  await page.evaluate(items=>window.__STATEFALL_TEST__.exerciseStructureLayer(items,{preStructures:items}),setup.items);
  const stable=await page.evaluate(()=>window.__STATEFALL_TEST__.rendererDiagnostics().layers.structures.instances);
  for(const item of stable) expect(item.spriteId).toBe(identity.get(item.tile));

  await page.evaluate(()=>window.__STATEFALL_TEST__.setCamera(0.8,'world'));
  const hidden=await page.evaluate(items=>window.__STATEFALL_TEST__.exerciseStructureLayer(items,{preStructures:items}).rendering.layers.structures,setup.items);
  expect(hidden).toMatchObject({visible:0,culled:hidden.total}); expect(hidden.pooled).toBeGreaterThan(0);
  const reusedBefore=hidden.reused;
  await page.evaluate(camera=>window.__STATEFALL_TEST__.setCameraOrigin(camera.x,camera.y,camera.scale),setup.camera);
  const returned=await page.evaluate(items=>window.__STATEFALL_TEST__.exerciseStructureLayer(items,{preStructures:items}).rendering.layers.structures,setup.items);
  expect(returned.visible).toBe(returned.total); expect(returned.reused).toBeGreaterThan(reusedBefore);

  const camera=await page.evaluate(()=>window.__STATEFALL_TEST__.snapshot().camera);
  await page.evaluate(()=>window.__STATEFALL_TEST__.setCameraOrigin(100000,100000,5));
  const offscreen=await page.evaluate(()=>window.__STATEFALL_TEST__.rendererDiagnostics().layers.structures);
  expect(offscreen.visible).toBe(0); expect(offscreen.culled).toBe(offscreen.total);
  const panReused=offscreen.reused;
  await page.evaluate(value=>window.__STATEFALL_TEST__.setCameraOrigin(value.x,value.y,value.scale),camera);
  const restored=await page.evaluate(items=>window.__STATEFALL_TEST__.exerciseStructureLayer(items,{preStructures:items}).rendering.layers.structures,setup.items);
  expect(restored.visible).toBe(restored.total); expect(restored.reused).toBeGreaterThan(panReused);
  expect(restored.created).toBeLessThanOrEqual(4096); expect(restored.pooled+restored.visible).toBeLessThanOrEqual(4096);
});

for(const limit of [{query:'&pixiSpriteCap=10',reason:'sprite-cap'},{query:'&pixiTextureCap=1',reason:'texture-cap'}]) test(`atomic Canvas fallback represents every base when the ${limit.reason} is exhausted`,async({page},testInfo)=>{
  test.skip(testInfo.project.name!=='chromium-desktop','resource exhaustion evidence runs in primary Chromium');
  await start(page,`PHASEE2${limit.reason.replace('-','').toUpperCase()}`,'pixi',limit.query);
  const before=await page.evaluate(()=>window.__STATEFALL_TEST__.canonicalCheckpoint());
  const evidence=await page.evaluate(()=>{ const expected=window.__STATEFALL_TEST__.structurePresentation(); return {expected,rendering:window.__STATEFALL_TEST__.exerciseStructureLayer(expected,{preStructures:expected}).rendering}; });
  test.skip(evidence.rendering.active!=='pixi-hybrid','Pixi WebGL renderer unavailable');
  expect(evidence.expected).toHaveLength(11);
  expect(evidence.rendering.capabilities.structures).toBe(true);
  expect(evidence.rendering.layers.structures).toMatchObject({owned:false,total:11,visible:0,culled:0,instances:[],resourceLimitFallback:{reason:limit.reason}});
  expect(evidence.rendering.layers.structures.resourceLimitFallback.count).toBeGreaterThan(0);
  const composite=await screenshotPixels(page.locator('#stage'));
  for(const item of evidence.expected) expect(brightPixelsAt(composite,{...item,radius:12,pop:1}),`Canvas fallback base missing at tile ${item.tile}`).toBeGreaterThan(0);
  const purity=await page.evaluate(()=>window.__STATEFALL_TEST__.renderRepeatedly(1));
  const after=await page.evaluate(()=>window.__STATEFALL_TEST__.canonicalCheckpoint());
  expect(after).toEqual(before); expect(purity).toMatchObject({hash:before.hash,rng:before.rng,tick:before.tick});
  await page.evaluate(()=>window.__STATEFALL_TEST__.setCameraOrigin(100000,100000,5));
  const recovered=await page.evaluate(()=>window.__STATEFALL_TEST__.rendererDiagnostics().layers.structures);
  expect(recovered).toMatchObject({owned:true,total:11,visible:0,culled:11,resourceLimitFallback:{reason:null}});
  expect(await page.evaluate(()=>window.__STATEFALL_TEST__.canonicalCheckpoint())).toEqual(before);
});

test('structure completion, pop, texture replacement, destruction, eviction, invalid source, and reset use real resource identity',async({page},testInfo)=>{
  test.skip(testInfo.project.name!=='chromium-desktop','focused resource identity evidence runs in primary Chromium');
  await start(page,'PHASEE2RESOURCEIDENTITY','pixi','&pixiTextureCap=2');
  const checkpoint=await page.evaluate(()=>window.__STATEFALL_TEST__.canonicalCheckpoint());
  const base=await page.evaluate(()=>window.__STATEFALL_TEST__.structurePresentation()[0]);
  const update=items=>page.evaluate(value=>window.__STATEFALL_TEST__.exerciseStructureLayer(value),items);
  const building=await update([{...base,building:true,pop:1}]);
  test.skip(building.rendering.active!=='pixi-hybrid','Pixi WebGL renderer unavailable');
  expect(building).toMatchObject({owned:true,rendering:{layers:{structures:{owned:true,total:1,visible:1,instances:[{alpha:0.45,pop:1}]}}}});
  const first=building.rendering.layers.structures.instances[0];
  const completed=await update([{...base,building:false,pop:1.35}]),completeInstance=completed.rendering.layers.structures.instances[0];
  expect(completeInstance).toMatchObject({alpha:1,pop:1.35,sourceId:first.sourceId,textureKey:first.textureKey});
  expect(brightPixelsAt(await screenshotPixels(page.locator('.pixi-world')),completeInstance)).toBeGreaterThan(0);

  const recolored=await update([{...base,building:false,pop:1,color:'#12ab34'}]),recoloredInstance=recolored.rendering.layers.structures.instances[0];
  expect(recoloredInstance.textureKey).not.toBe(first.textureKey); expect(recoloredInstance.sourceId).not.toBe(first.sourceId);
  const retyped=await update([{...base,building:false,pop:1,type:'fort',color:'#12ab34'}]),retypedInstance=retyped.rendering.layers.structures.instances[0];
  expect(retypedInstance.textureKey).not.toBe(recoloredInstance.textureKey); expect(retypedInstance.sourceId).not.toBe(recoloredInstance.sourceId);
  const removed=await update([]); expect(removed.rendering.layers.structures).toMatchObject({owned:true,total:0,visible:0,instances:[]});

  let churn=retyped;
  for(const color of ['#220011','#330022','#440033','#550044','#660055']) churn=await update([{...base,building:false,pop:1,type:'city',color}]);
  expect(churn.rendering.layers.structures.textureCount).toBeLessThanOrEqual(2);
  expect(churn.rendering.layers.structures.textureDestroyCount).toBeGreaterThan(0);
  const invalid=await page.evaluate(item=>window.__STATEFALL_TEST__.exerciseStructureLayer([{...item,type:'invalid-source-proof',color:'#abcdef'}],{invalidSource:true}),base);
  expect(invalid.rendering.layers.structures).toMatchObject({owned:false,visible:0,culled:0,instances:[],resourceLimitFallback:{reason:'invalid-source'}});
  expect(await page.evaluate(()=>window.__STATEFALL_TEST__.canonicalCheckpoint())).toEqual(checkpoint);

  const reset=await page.evaluate(()=>window.__STATEFALL_TEST__.resetRendererResources());
  expect(reset.layers.structures).toMatchObject({owned:false,total:0,visible:0,pooled:0,textureCount:0,instances:[]});
  expect(reset.layers.structures.textureDestroyCount).toBeGreaterThanOrEqual(churn.rendering.layers.structures.textureDestroyCount);
  const restored=await page.evaluate(()=>window.__STATEFALL_TEST__.restoreRendererResources());
  expect(restored.layers.structures.owned).toBe(false);
  expect(restored.layers.structures.resourceLimitFallback.reason).toBeNull();
  expect(restored.compositingConflictFallback.reason).not.toBeNull();
  expect(await page.evaluate(()=>window.__STATEFALL_TEST__.canonicalCheckpoint())).toEqual(checkpoint);
});

test('overlapping retained Canvas overlay forces full legacy Canvas order and recovers on the next safe frame',async({browser},testInfo)=>{
  test.skip(testInfo.project.name!=='chromium-desktop','compositing evidence runs in primary Chromium');
  const contexts=[],images={}; let checkpoint;
  for(const renderer of ['canvas','pixi']){
    const context=await browser.newContext({viewport:{width:1280,height:720},deviceScaleFactor:1}),page=await context.newPage(); contexts.push(context);
    await start(page,'PHASEE3ORDERCOMPOSITE',renderer);
    const evidence=await page.evaluate(()=>{ const source=window.__STATEFALL_TEST__.structurePresentation()[0],items=[{...source,tile:source.tile,type:'city',linked:true},{...source,tile:source.tile+3,type:'factory'}]; return window.__STATEFALL_TEST__.exerciseStructureCompositing(items); });
    if(renderer==='pixi'){
      test.skip(evidence.rendering.active!=='pixi-hybrid','Pixi WebGL renderer unavailable');
      expect(evidence).toMatchObject({preOwned:false,owned:false,rendering:{layers:{preStructures:{resourceLimitFallback:{reason:null},compositingConflictFallback:{reason:'earlier-linked-ring-overlaps-later-base'}},structures:{owned:false,visible:0,instances:[],resourceLimitFallback:{reason:null}}}}});
      expect(evidence.rendering.compositingConflictFallback.count).toBeGreaterThan(0);
      expect(evidence.rendering.spriteCount).toBeLessThanOrEqual(1);
      checkpoint=evidence.checkpoint;
    }
    images[renderer]=await screenshotPixels(page.locator('#stage'));
  }
  expect(images.pixi.width).toBe(images.canvas.width); expect(images.pixi.height).toBe(images.canvas.height); expect(Buffer.from(images.pixi.data).equals(Buffer.from(images.canvas.data)),'conflict composite must be pixel-identical to full legacy Canvas order').toBe(true);
  const pixiPage=contexts[1].pages()[0];
  const recovered=await pixiPage.evaluate(()=>{ const source=window.__STATEFALL_TEST__.structurePresentation()[0],items=[{...source,tile:source.tile,type:'city',linked:true},{...source,tile:source.tile+30,type:'factory'}]; return window.__STATEFALL_TEST__.exerciseStructureLayer(items,{preStructures:items}); });
  expect(recovered).toMatchObject({preOwned:true,owned:true,rendering:{compositingConflictFallback:{reason:null},layers:{structures:{owned:true,visible:2}}},checkpoint});
  await Promise.all(contexts.map(context=>context.close()));
});

test('fog-hidden active missile focus remains Pixi-owned and painted',async({page},testInfo)=>{
  test.skip(testInfo.project.name!=='chromium-desktop','missile focus pixel evidence runs in primary Chromium');
  await start(page,'PHASEE3FOGHIDDENFOCUS');
  const source=await page.evaluate(()=>window.__STATEFALL_TEST__.structurePresentation()[0]);
  const evidence=await page.evaluate(item=>{ const fog=new Uint8Array(item.tile+1); return window.__STATEFALL_TEST__.exerciseStructureLayer([],{preState:{fog,missileFocus:{tile:item.tile,active:true}}}); },source);
  test.skip(evidence.rendering.active!=='pixi-hybrid','Pixi WebGL renderer unavailable');
  expect(evidence.rendering.layers.preStructures).toMatchObject({owned:true,counts:{focusRings:1}});
  const ring=evidence.rendering.layers.preStructures.presentation.dashedRoutes.find(value=>value.kind==='circle');
  const pixi=await screenshotPixels(page.locator('.pixi-world'));
  const point={x:ring.first.x+Math.cos(ring.first.start)*ring.first.r,y:ring.first.y+Math.sin(ring.first.start)*ring.first.r,r:4};
  expect(matchingPixelsAt(pixi,point,(r,g,b)=>r>60&&g>35&&b<100),'fog-hidden focus ring must produce Pixi pixels').toBeGreaterThan(0);
});

test('missile focus uses explicit route phase in Canvas and Pixi at two times with and without supply context',async({page},testInfo)=>{
  test.skip(testInfo.project.name!=='chromium-desktop','focus phase pixel parity runs in primary Chromium');
  await start(page,'PHASEE3FOCUSPHASE');
  const source=await page.evaluate(()=>window.__STATEFALL_TEST__.structurePresentation()[0]);
  for(const withSupply of [false,true]) for(const time of [180,780]){
    const evidence=await page.evaluate(({source,time,withSupply})=>window.__STATEFALL_TEST__.exerciseStructureLayer([],{preState:{time,supplyLinks:withSupply?[{from:source.tile,to:source.tile+20,color:'#33cc66'}]:[],missileFocus:{tile:source.tile,active:true}}}).rendering.layers.preStructures,{source,time,withSupply});
    test.skip(!evidence.owned,'Pixi WebGL renderer unavailable');
    const ring=evidence.presentation.dashedRoutes.find(value=>value.kind==='circle');
    expect(ring.phase).toBe((time/60)%16);
    const samples=ring.segments.slice(0,Math.min(8,ring.segments.length)).map(segment=>{ const angle=(segment.start+segment.end)/2; return {x:ring.x+Math.cos(angle)*ring.r,y:ring.y+Math.sin(angle)*ring.r}; });
    const canvasCounts=await page.evaluate(({ring,time,withSupply,samples})=>window.__STATEFALL_TEST__.focusDashProbe({x:ring.x,y:ring.y,r:ring.r,time,withSupply,points:samples,width:1280,height:720}),{ring,time,withSupply,samples});
    expect(canvasCounts.every(count=>count>0),'Canvas must paint every model dash midpoint').toBe(true);
    const pixi=await screenshotPixels(page.locator('.pixi-world'));
    for(const point of samples) expect(matchingPixelsAt(pixi,{...point,r:2},(r,g,b)=>r>55&&g>35&&b<115),'Pixi must paint the same phased dash midpoint').toBeGreaterThan(0);
  }
});

test('E3 Canvas geometry ignores poisoned prior stroke state and restores defaults',async({page},testInfo)=>{
  test.skip(testInfo.project.name!=='chromium-desktop','Canvas state isolation evidence runs in primary Chromium');
  await start(page,'PHASEE3CANVASSTATE','canvas');
  const evidence=await page.evaluate(()=>window.__STATEFALL_TEST__.e3CanvasStatePoisonProbe());
  expect(evidence.poisoned.pixels).toEqual(evidence.baseline.pixels);
  expect(evidence.baseline.state).toEqual({lineCap:'butt',lineJoin:'miter',dash:[],offset:0});
  expect(evidence.poisoned.state).toEqual(evidence.baseline.state);
});

test('retained build, queue, pop, level, suppression, linked, and cooldown marks conservatively reject split compositing',async({page},testInfo)=>{
  test.skip(testInfo.project.name!=='chromium-desktop','compositing conflict matrix runs in primary Chromium');
  await start(page,'PHASEE3CONFLICTMATRIX');
  const cases=[
    {label:'build',first:{type:'city',building:true,buildText:'12s'}},
    {label:'upgrade',first:{type:'city',upgrading:true}},
    {label:'air queue',first:{type:'airfield',airQueue:true,airQueueText:'2/6 · F 12s'}},
    {label:'port queue',first:{type:'port',shipQueue:true,shipQueueText:'Cruiser 12s +1'}},
    {label:'pop and level',first:{type:'city',pop:1.35,level:3}},
    {label:'suppression',first:{type:'sam',suppressed:true}},
    {label:'linked',first:{type:'city',linked:true}},
    {label:'cooldown',first:{type:'silo',cooldown:true}}
  ];
  for(const entry of cases){
    const result=await page.evaluate(({first})=>{ const source=window.__STATEFALL_TEST__.structurePresentation()[0],items=[{...source,...first,tile:source.tile},{...source,tile:source.tile+3,type:'factory'}]; return window.__STATEFALL_TEST__.exerciseStructureLayer(items,{preStructures:items}); },entry);
    test.skip(result.rendering.active!=='pixi-hybrid','Pixi WebGL renderer unavailable');
    expect(result.preOwned,entry.label).toBe(false); expect(result.owned,entry.label).toBe(false);
    expect(result.rendering.layers.preStructures.compositingConflictFallback.reason,entry.label).toContain('overlaps-later-base');
    expect(result.rendering.layers.preStructures.resourceLimitFallback.reason,entry.label).toBeNull();
    expect(result.rendering.layers.structures.resourceLimitFallback.reason,entry.label).toBeNull();
  }
  const range=await page.evaluate(()=>{ const source=window.__STATEFALL_TEST__.structurePresentation()[0],items=[{...source,tile:source.tile,type:'city',level:3},{...source,tile:source.tile+30,type:'command',owned:true,commandRange:45}]; return window.__STATEFALL_TEST__.exerciseStructureLayer(items,{preStructures:items}); });
  expect(range.rendering.layers.preStructures.compositingConflictFallback.detail).toMatchObject({earlierMark:'level-mark',laterPrimitive:'pre-base-circle'});
  const safeRange=await page.evaluate(()=>{ const source=window.__STATEFALL_TEST__.structurePresentation()[0],items=[{...source,tile:source.tile,type:'city',level:1},{...source,tile:source.tile+30,type:'command',owned:true,commandRange:45}]; return window.__STATEFALL_TEST__.exerciseStructureLayer(items,{preStructures:items}); });
  expect(safeRange).toMatchObject({preOwned:true,owned:true,rendering:{compositingConflictFallback:{reason:null},layers:{preStructures:{counts:{commandRanges:1}},structures:{owned:true,visible:2}}}});
});

test('a visible pre-base range keeps its ordered entry when the base sprite is offscreen',async({page},testInfo)=>{
  test.skip(testInfo.project.name!=='chromium-desktop','range/base edge ownership runs in primary Chromium');
  await start(page,'PHASEE3RANGEEDGE');
  const source=await page.evaluate(()=>window.__STATEFALL_TEST__.structurePresentation().find(item=>item.type==='command')||window.__STATEFALL_TEST__.structurePresentation()[0]);
  const result=await page.evaluate(item=>{
    const tileX=item.tile%720,tileY=(item.tile-tileX)/720;
    window.__STATEFALL_TEST__.setCameraOrigin(-20-(tileX+.5)*5,100-(tileY+.5)*5,5);
    return window.__STATEFALL_TEST__.exerciseStructureLayer([item],{preStructures:[{tile:item.tile,type:'command',level:1,owned:true,commandRange:45}]});
  },source);
  test.skip(result.rendering.active!=='pixi-hybrid','Pixi WebGL renderer unavailable');
  expect(result.rendering.layers.preStructures.counts.commandRanges).toBe(1);
  expect(result.rendering.layers.structures).toMatchObject({owned:true,total:1,visible:0,culled:1,entries:1,entryGraphicsCount:1,entrySpriteCount:1,instances:[],order:[{tile:source.tile,baseVisible:false}]});
});

for(const failure of [{query:'&pixiPrimitiveCap=2',reason:'primitive-cap'},{query:'&pixiSegmentCap=2',reason:'segment-cap'},{query:'&pixiGraphicsFail=1',reason:'graphics-resource'}]) test(`pre-structure ${failure.reason} atomically restores Canvas pre-layers and bases`,async({page},testInfo)=>{
  test.skip(testInfo.project.name!=='chromium-desktop','atomic E3 fallback runs in primary Chromium');
  await start(page,`PHASEE3${failure.reason.replace('-','').toUpperCase()}`,'pixi',failure.query);
  const before=await page.evaluate(()=>window.__STATEFALL_TEST__.canonicalCheckpoint());
  const evidence=await page.evaluate(()=>{ const expected=window.__STATEFALL_TEST__.structurePresentation(),[a,b]=expected; return {expected,rendering:window.__STATEFALL_TEST__.exerciseStructureLayer(expected,{preStructures:expected,preState:{supplyLinks:[{from:a.tile,to:b.tile,color:'#33cc66'}],missileFocus:{tile:a.tile,active:true}}}).rendering}; });
  test.skip(evidence.rendering.active!=='pixi-hybrid','Pixi WebGL renderer unavailable');
  expect(evidence.rendering.layers.preStructures).toMatchObject({owned:false,primitiveCount:0,segmentCount:0,resourceLimitFallback:{reason:failure.reason}});
  expect(evidence.rendering.layers.structures).toMatchObject({owned:false,visible:0,instances:[],resourceLimitFallback:{reason:'pre-structure-fallback'}});
  const composite=await screenshotPixels(page.locator('#stage'));
  for(const item of evidence.expected) expect(brightPixelsAt(composite,{...item,radius:12,pop:1}),`Canvas fallback base missing at tile ${item.tile}`).toBeGreaterThan(0);
  await page.evaluate(()=>window.__STATEFALL_TEST__.renderRepeatedly(2));
  expect(await page.evaluate(()=>window.__STATEFALL_TEST__.canonicalCheckpoint())).toEqual(before);
});

test('segment cap accepts the exact generated count and rejects one less before drawing',async({browser},testInfo)=>{
  test.skip(testInfo.project.name!=='chromium-desktop','segment boundary ownership runs in primary Chromium');
  const baselineContext=await browser.newContext({viewport:{width:1280,height:720},deviceScaleFactor:1}),baselinePage=await baselineContext.newPage();
  await start(baselinePage,'PHASEE3SEGMENTBOUNDARY');
  const baseline=await baselinePage.evaluate(()=>{ const tile=window.__STATEFALL_TEST__.structurePresentation()[0].tile; return window.__STATEFALL_TEST__.exerciseStructureLayer([],{preState:{missileFocus:{tile,active:true}}}).rendering; }); await baselineContext.close();
  test.skip(baseline.active!=='pixi-hybrid','Pixi WebGL renderer unavailable');
  const exact=baseline.layers.preStructures.segmentCount; expect(exact).toBeGreaterThan(1);
  for(const offset of [-1,0,1]){
    const context=await browser.newContext({viewport:{width:1280,height:720},deviceScaleFactor:1}),page=await context.newPage();
    try{
      await start(page,'PHASEE3SEGMENTBOUNDARY','pixi',`&pixiSegmentCap=${exact+offset}`);
      const diagnostics=await page.evaluate(()=>{ const tile=window.__STATEFALL_TEST__.structurePresentation()[0].tile; return window.__STATEFALL_TEST__.exerciseStructureLayer([],{preState:{missileFocus:{tile,active:true}}}).rendering; });
      if(offset<0){ expect(diagnostics.layers.preStructures).toMatchObject({owned:false,segmentCount:0,emittedSegmentCount:0,resourceLimitFallback:{reason:'segment-cap'}}); expect(diagnostics.layers.structures.owned).toBe(false); }
      else { expect(diagnostics.layers.preStructures).toMatchObject({owned:true,segmentCount:exact,emittedSegmentCount:exact}); expect(diagnostics.layers.structures.owned).toBe(true); }
    }finally{ await context.close(); }
  }
});

test('60-frame paused dense-fixture microbenchmark stays bounded with visible and culled structure scenes',async({browser},testInfo)=>{
  test.skip(testInfo.project.name!=='chromium-desktop','focused E2 performance evidence runs in primary Chromium');
  for(const renderer of ['canvas','pixi']){
    const context=await browser.newContext({viewport:{width:1280,height:720},deviceScaleFactor:1}),page=await context.newPage();
    try{
      await start(page,`PHASEE2PERF${renderer.toUpperCase()}`,renderer);
      const visible=await page.evaluate(()=>{ const before=performance.now(); window.__STATEFALL_TEST__.renderRepeatedly(60); return {mean:(performance.now()-before)/60,expected:window.__STATEFALL_TEST__.structurePresentation().length,rendering:window.__STATEFALL_TEST__.rendererDiagnostics()}; });
      expect(visible.mean).toBeLessThan(50);
      if(renderer==='pixi'){
        expect(visible.rendering.layers.structures).toMatchObject({owned:false,total:visible.expected,visible:0,culled:0,entries:0});
        expect(visible.rendering.compositingConflictFallback.reason).not.toBeNull();
        expect(visible.rendering.layers.structures.resourceLimitFallback.reason).toBeNull();
      }
      else expect(visible.rendering.capabilities.structures).toBe(false);
      await page.evaluate(()=>window.__STATEFALL_TEST__.setCameraOrigin(100000,100000,5));
      const culled=await page.evaluate(()=>{ const before=performance.now(); window.__STATEFALL_TEST__.renderRepeatedly(60); return {mean:(performance.now()-before)/60,rendering:window.__STATEFALL_TEST__.rendererDiagnostics()}; });
      expect(culled.mean).toBeLessThan(50);
      if(renderer==='pixi'){ expect(culled.rendering.layers.structures.visible).toBe(0); expect(culled.rendering.layers.structures.culled).toBe(visible.expected); }
      console.log(`${renderer} dense paused structures: visible ${visible.mean.toFixed(3)} ms/frame, culled ${culled.mean.toFixed(3)} ms/frame; ${JSON.stringify(culled.rendering.layers.structures)}`);
    }finally{ await context.close(); }
  }
});

test('quality tiers reduce route segments without hiding gameplay meaning',async({browser},testInfo)=>{
  test.skip(testInfo.project.name!=='chromium-desktop','quality policy evidence runs in primary Chromium');
  const cases=[{requested:'high',effective:'high'},{requested:'medium',effective:'medium'},{requested:'low',effective:'low'},{requested:'ultra',effective:'high'}],evidence=[];
  for(const quality of cases){
    const context=await browser.newContext({viewport:{width:1440,height:900},deviceScaleFactor:1}),page=await context.newPage();
    try{
      await start(page,'PHASEE3QUALITY','pixi',`&quality=${quality.requested}`);
      const first=await page.evaluate(()=>{ const [a,b]=window.__STATEFALL_TEST__.structurePresentation(); return window.__STATEFALL_TEST__.exerciseStructureLayer([],{preState:{time:777,supplyLinks:[{from:a.tile,to:b.tile,color:'#33cc66'}],missileFocus:{tile:a.tile,active:true},commandLinks:[{from:a.tile,to:b.tile,color:'rgba(255,170,80,.55)',markerColor:'rgb(255,170,80)',type:'command'}]}}).rendering.layers.preStructures; });
      const image=await screenshotPixels(page.locator('.pixi-world')),marker=first.presentation.markers.find(value=>value.color==='#ffd27a');
      expect(matchingPixelsAt(image,{...marker,r:marker.r+2},(r,g,b)=>r>210&&g>150&&b<160),`${quality.effective} must retain a route marker at its generated position`).toBeGreaterThan(0);
      await page.waitForTimeout(90);
      const second=await page.evaluate(()=>{ const [a,b]=window.__STATEFALL_TEST__.structurePresentation(); return window.__STATEFALL_TEST__.exerciseStructureLayer([],{preState:{time:999,supplyLinks:[{from:a.tile,to:b.tile,color:'#33cc66'}],missileFocus:{tile:a.tile,active:true},commandLinks:[{from:a.tile,to:b.tile,color:'rgba(255,170,80,.55)',markerColor:'rgb(255,170,80)',type:'command'}]}}).rendering.layers.preStructures; });
      if(quality.requested==='high') expect(second.presentation.markers).not.toEqual(first.presentation.markers);
      evidence.push(first);
    }
    finally{ await context.close(); }
  }
  for(let i=0;i<evidence.length;i++){
    expect(evidence[i]).toMatchObject({owned:true,quality:cases[i],counts:{fronts:0,supplyLinks:1,supplyMarkers:1,focusRings:1,commandLinks:1,commandMarkers:1}});
    expect(evidence[i].primitiveCount).toBe(6);
    expect(evidence[i].emittedSegmentCount).toBe(evidence[i].segmentCount);
    expect(evidence[i].presentation.dashedRoutes.reduce((sum,value)=>sum+value.segmentCount,0)).toBeLessThanOrEqual(evidence[i].segmentCount);
  }
  expect(evidence[1].segmentCount).toBeLessThan(evidence[0].segmentCount); expect(evidence[2].segmentCount).toBeLessThan(evidence[1].segmentCount);
  expect(evidence[3].segmentCount).toBe(evidence[0].segmentCount);
});

test('reduced motion freezes pre-structure pulse and route movement while retaining all semantics',async({page},testInfo)=>{
  test.skip(testInfo.project.name!=='chromium-reduced-motion','reduced-motion policy runs in its configured project');
  await start(page,'PHASEE3REDUCED');
  const exercise=()=>page.evaluate(()=>{ const [a,b]=window.__STATEFALL_TEST__.structurePresentation(); return window.__STATEFALL_TEST__.exerciseStructureLayer([],{preState:{fronts:[{tile:a.tile,color:'#ff0000'}],supplyLinks:[{from:a.tile,to:b.tile,color:'#33cc66'}],missileFocus:{tile:a.tile,active:true},commandLinks:[{from:a.tile,to:b.tile,color:'rgba(255,170,80,.55)',markerColor:'rgb(255,170,80)',type:'command'}]}}).rendering.layers.preStructures; });
  const before=await exercise();
  test.skip(!before.owned,'Pixi WebGL renderer unavailable');
  await page.waitForTimeout(80); const after=await exercise();
  expect(before).toMatchObject({owned:true,reducedMotion:true}); expect(after.counts).toEqual(before.counts); expect(after.primitiveCount).toBe(before.primitiveCount); expect(after.segmentCount).toBe(before.segmentCount);
  expect(after.presentation.fronts).toEqual(before.presentation.fronts);
  expect(after.presentation.markers).toEqual(before.presentation.markers);
  expect(after.presentation.dashedRoutes).toEqual(before.presentation.dashedRoutes);
});

test('real conflict fallback obeys effective motion policy across RAFs without changing canonical state',async({page},testInfo)=>{
  test.skip(!['chromium-desktop','chromium-reduced-motion'].includes(testInfo.project.name),'motion fallback evidence runs in Chromium normal/reduced projects');
  const reduced=testInfo.project.name==='chromium-reduced-motion';
  await start(page,`PHASEE3CONFLICTMOTION${reduced?'REDUCED':'NORMAL'}`);
  const beforeCheckpoint=await page.evaluate(()=>window.__STATEFALL_TEST__.canonicalCheckpoint());
  const beforeDiagnostics=await page.evaluate(()=>{ window.__STATEFALL_TEST__.resumePresentation(); return window.__STATEFALL_TEST__.rendererDiagnostics(); });
  test.skip(beforeDiagnostics.active!=='pixi-hybrid','Pixi WebGL renderer unavailable');
  expect(beforeDiagnostics).toMatchObject({reducedMotion:reduced,motion:{clock:reduced?'frozen':'monotonic'},layers:{preStructures:{owned:false},structures:{owned:false}}});
  expect(beforeDiagnostics.compositingConflictFallback.reason).not.toBeNull();
  const firstGeometry=await page.evaluate(()=>window.__STATEFALL_TEST__.preStructureMotionGeometry()),first=await canvasPixels(page,'#map'); await page.waitForTimeout(180); const secondGeometry=await page.evaluate(()=>window.__STATEFALL_TEST__.preStructureMotionGeometry()),second=await canvasPixels(page,'#map');
  expect(firstGeometry.front).toBeTruthy(); expect(firstGeometry.route).toBeTruthy(); expect(firstGeometry.focus).toBeTruthy();
  const delta=changedPixels(first,second);
  if(reduced){
    expect(secondGeometry).toEqual(firstGeometry);
    for(const point of [firstGeometry.front,firstGeometry.route?.dash,firstGeometry.route?.marker,firstGeometry.focus,firstGeometry.lowShield]) if(point) expect(pixelPatch(second,point),'front, route dash/marker, focus, and low-shield pixels must remain frozen during Canvas conflict fallback').toEqual(pixelPatch(first,point));
  }else{
    expect(secondGeometry.time).toBeGreaterThan(firstGeometry.time); expect(secondGeometry.route?.marker).not.toEqual(firstGeometry.route?.marker);
    expect(delta,'normal-motion Canvas conflict fallback must continue animating').toBeGreaterThan(0);
  }
  expect(await page.evaluate(()=>window.__STATEFALL_TEST__.canonicalCheckpoint())).toEqual(beforeCheckpoint);
  expect((await page.evaluate(()=>window.__STATEFALL_TEST__.rendererDiagnostics())).compositingConflictFallback.reason).not.toBeNull();
});

test('dense structure resources recreate after BFCache loss and cleanly hand ownership to Canvas on context loss',async({page},testInfo)=>{
  test.skip(testInfo.project.name!=='chromium-desktop','focused E2 resource lifecycle runs in primary Chromium');
  await start(page,'PHASEE2LIFECYCLE');
  const before=await page.evaluate(async()=>{ const expected=window.__STATEFALL_TEST__.structurePresentation(); return {expected,checkpoint:await window.__STATEFALL_TEST__.canonicalCheckpoint(),rendering:window.__STATEFALL_TEST__.exerciseStructureLayer(expected,{preStructures:expected}).rendering}; });
  test.skip(before.rendering.active!=='pixi-hybrid','Pixi WebGL renderer unavailable');
  expect(before.rendering.layers.structures.visible).toBe(11);
  await page.evaluate(()=>window.dispatchEvent(new PageTransitionEvent('pagehide',{persisted:true})));
  await page.locator('.pixi-world').evaluate(element=>element.remove());
  await page.evaluate(()=>window.dispatchEvent(new PageTransitionEvent('pageshow',{persisted:true})));
  await expect.poll(()=>page.evaluate(()=>window.__STATEFALL_TEST__.renderingLifecycle().suspended)).toBe(false);
  const resumed=await page.evaluate(async expected=>({checkpoint:await window.__STATEFALL_TEST__.canonicalCheckpoint(),rendering:window.__STATEFALL_TEST__.exerciseStructureLayer(expected,{preStructures:expected}).rendering}),before.expected);
  expect(resumed.checkpoint).toEqual(before.checkpoint);
  expect(resumed.rendering.layers.structures).toMatchObject({owned:true,total:11,visible:11,culled:0});
  expect(resumed.rendering.layers.structures.textureDestroyCount).toBeGreaterThanOrEqual(before.rendering.layers.structures.textureCount);
  expect(resumed.rendering.layers.structures.created).toBeLessThanOrEqual(22);

  const extension=await page.locator('.pixi-world').evaluate(canvas=>{ const gl=canvas.getContext('webgl2')||canvas.getContext('webgl'); return !!gl?.getExtension('WEBGL_lose_context'); });
  test.skip(!extension,'WEBGL_lose_context unavailable');
  await page.locator('.pixi-world').evaluate(canvas=>{ const gl=canvas.getContext('webgl2')||canvas.getContext('webgl'); gl.getExtension('WEBGL_lose_context').loseContext(); });
  await expect.poll(()=>page.evaluate(()=>window.__STATEFALL_TEST__.rendererDiagnostics().active)).toBe('canvas');
  await page.evaluate(()=>window.__STATEFALL_TEST__.renderRepeatedly(1));
  const fallback=await page.evaluate(async()=>({checkpoint:await window.__STATEFALL_TEST__.canonicalCheckpoint(),rendering:window.__STATEFALL_TEST__.rendererDiagnostics()}));
  expect(fallback.checkpoint).toEqual(before.checkpoint);
  expect(fallback.rendering).toMatchObject({active:'canvas',capabilities:{structures:false},fallbackCleanup:{capabilities:{structures:false},layers:{structures:{owned:false,visible:0,pooled:0,textureCount:0}}}});
  expect(await page.locator('.pixi-world').count()).toBe(0);
});

test('Pixi structure layer smokes every map and major mode',async({context},testInfo)=>{
  test.skip(testInfo.project.name!=='chromium-desktop','table-driven E2 smoke runs in primary Chromium');
  test.setTimeout(180_000);
  const cases=[...MAPS.map(map=>({map,seed:`E2MAP${map.replaceAll('_','').toUpperCase()}`})),...MODES.map(mode=>({mode,seed:`E2MODE${mode.label.replaceAll('-','').toUpperCase()}`}))];
  for(const entry of cases){
    const page=await context.newPage();
    try{
      await smokeStart(page,entry);
      const rendering=await page.evaluate(()=>window.__STATEFALL_TEST__.rendererDiagnostics());
      test.skip(rendering.active!=='pixi-hybrid','Pixi WebGL renderer unavailable');
      expect(rendering.layers.structures,entry.seed).toMatchObject({owned:false,total:11,visible:0,culled:0,resourceLimitFallback:{reason:null}});
      expect(rendering.compositingConflictFallback.reason,entry.seed).not.toBeNull();
    }finally{ await page.close(); }
  }
});
