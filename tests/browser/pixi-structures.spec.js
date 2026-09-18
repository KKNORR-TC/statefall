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

function brightPixelsAt(image,item){
  let bright=0; const radius=Math.ceil((item.radius||12)*(item.pop||1));
  for(let y=Math.max(0,Math.floor(item.y-radius));y<=Math.min(image.height-1,Math.ceil(item.y+radius));y++) for(let x=Math.max(0,Math.floor(item.x-radius));x<=Math.min(image.width-1,Math.ceil(item.x+radius));x++){
    const offset=(y*image.width+x)*4,r=image.data[offset],g=image.data[offset+1],b=image.data[offset+2]; if(r>210&&g>210&&b>210) bright++;
  }
  return bright;
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
  const initial=await page.evaluate(()=>({rendering:window.__STATEFALL_TEST__.rendererDiagnostics(),expected:window.__STATEFALL_TEST__.structurePresentation()}));
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
  await page.evaluate(()=>window.__STATEFALL_TEST__.renderRepeatedly(3));
  const stable=await page.evaluate(()=>window.__STATEFALL_TEST__.rendererDiagnostics().layers.structures.instances);
  for(const item of stable) expect(item.spriteId).toBe(identity.get(item.tile));

  await page.evaluate(()=>window.__STATEFALL_TEST__.setCamera(0.8,'world'));
  const hidden=await page.evaluate(()=>window.__STATEFALL_TEST__.rendererDiagnostics().layers.structures);
  expect(hidden).toMatchObject({visible:0,culled:hidden.total}); expect(hidden.pooled).toBeGreaterThan(0);
  const reusedBefore=hidden.reused;
  await page.evaluate(()=>{ window.__STATEFALL_TEST__.installLateGameScene(); window.__STATEFALL_TEST__.freezePresentation(); });
  const returned=await page.evaluate(()=>window.__STATEFALL_TEST__.rendererDiagnostics().layers.structures);
  expect(returned.visible).toBe(returned.total); expect(returned.reused).toBeGreaterThan(reusedBefore);

  const camera=await page.evaluate(()=>window.__STATEFALL_TEST__.snapshot().camera);
  await page.evaluate(()=>window.__STATEFALL_TEST__.setCameraOrigin(100000,100000,5));
  const offscreen=await page.evaluate(()=>window.__STATEFALL_TEST__.rendererDiagnostics().layers.structures);
  expect(offscreen.visible).toBe(0); expect(offscreen.culled).toBe(offscreen.total);
  const panReused=offscreen.reused;
  await page.evaluate(value=>window.__STATEFALL_TEST__.setCameraOrigin(value.x,value.y,value.scale),camera);
  const restored=await page.evaluate(()=>window.__STATEFALL_TEST__.rendererDiagnostics().layers.structures);
  expect(restored.visible).toBe(restored.total); expect(restored.reused).toBeGreaterThan(panReused);
  expect(restored.created).toBeLessThanOrEqual(4096); expect(restored.pooled+restored.visible).toBeLessThanOrEqual(4096);
});

for(const limit of [{query:'&pixiSpriteCap=10',reason:'sprite-cap'},{query:'&pixiTextureCap=1',reason:'texture-cap'}]) test(`atomic Canvas fallback represents every base when the ${limit.reason} is exhausted`,async({page},testInfo)=>{
  test.skip(testInfo.project.name!=='chromium-desktop','resource exhaustion evidence runs in primary Chromium');
  await start(page,`PHASEE2${limit.reason.replace('-','').toUpperCase()}`,'pixi',limit.query);
  const before=await page.evaluate(()=>window.__STATEFALL_TEST__.canonicalCheckpoint());
  const evidence=await page.evaluate(()=>({expected:window.__STATEFALL_TEST__.structurePresentation(),rendering:window.__STATEFALL_TEST__.rendererDiagnostics()}));
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
  expect(restored.layers.structures.resourceLimitFallback.reason).toBe('texture-cap');
  expect(await page.evaluate(()=>window.__STATEFALL_TEST__.canonicalCheckpoint())).toEqual(checkpoint);
});

test('attack and supply crossings retain an explicit hybrid compositing residual',async({browser},testInfo)=>{
  test.skip(testInfo.project.name!=='chromium-desktop','compositing evidence runs in primary Chromium');
  const captures={};
  for(const renderer of ['canvas','pixi']){
    const context=await browser.newContext({viewport:{width:1440,height:900},deviceScaleFactor:1}),page=await context.newPage();
    try{
      await start(page,'PHASEE2ORDERING',renderer);
      const semantic=await page.evaluate(()=>({ordering:window.__STATEFALL_TEST__.structureLineOrdering(),structures:window.__STATEFALL_TEST__.structurePresentation(),rendering:window.__STATEFALL_TEST__.rendererDiagnostics()}));
      if(renderer==='pixi') test.skip(semantic.rendering.active!=='pixi-hybrid','Pixi WebGL renderer unavailable');
      expect(semantic.ordering.attack.length).toBeGreaterThan(0); expect(semantic.ordering.supply.length).toBeGreaterThan(0);
      expect(semantic.ordering.supply.some(line=>semantic.ordering.structureTiles.includes(line.from)&&semantic.ordering.structureTiles.includes(line.to))).toBe(true);
      captures[renderer]={image:await screenshotPixels(page.locator('#stage')),points:semantic.structures.filter(item=>semantic.ordering.supply.some(line=>line.from===item.tile||line.to===item.tile))};
    }finally{ await context.close(); }
  }
  expect(captures.pixi.points.map(value=>value.tile)).toEqual(captures.canvas.points.map(value=>value.tile));
  let changed=0;
  for(const point of captures.canvas.points) for(let y=Math.floor(point.y-8);y<=Math.ceil(point.y+8);y++) for(let x=Math.floor(point.x-8);x<=Math.ceil(point.x+8);x++){
    const offset=(y*captures.canvas.image.width+x)*4;
    if(captures.canvas.image.data.slice(offset,offset+4).some((value,index)=>Math.abs(value-captures.pixi.image.data[offset+index])>12)) changed++;
  }
  expect(changed,'hybrid currently composites Canvas attack/supply marks above Pixi bases, unlike legacy base-over-line order').toBeGreaterThan(0);
});

test('60-frame paused dense-fixture microbenchmark stays bounded with visible and culled structure scenes',async({browser},testInfo)=>{
  test.skip(testInfo.project.name!=='chromium-desktop','focused E2 performance evidence runs in primary Chromium');
  for(const renderer of ['canvas','pixi']){
    const context=await browser.newContext({viewport:{width:1280,height:720},deviceScaleFactor:1}),page=await context.newPage();
    try{
      await start(page,`PHASEE2PERF${renderer.toUpperCase()}`,renderer);
      const visible=await page.evaluate(()=>{ const before=performance.now(); window.__STATEFALL_TEST__.renderRepeatedly(60); return {mean:(performance.now()-before)/60,expected:window.__STATEFALL_TEST__.structurePresentation().length,rendering:window.__STATEFALL_TEST__.rendererDiagnostics()}; });
      expect(visible.mean).toBeLessThan(50);
      if(renderer==='pixi'){ expect(visible.rendering.layers.structures.visible).toBe(visible.expected); expect(visible.rendering.layers.structures.culled).toBe(0); }
      else expect(visible.rendering.capabilities.structures).toBe(false);
      await page.evaluate(()=>window.__STATEFALL_TEST__.setCameraOrigin(100000,100000,5));
      const culled=await page.evaluate(()=>{ const before=performance.now(); window.__STATEFALL_TEST__.renderRepeatedly(60); return {mean:(performance.now()-before)/60,rendering:window.__STATEFALL_TEST__.rendererDiagnostics()}; });
      expect(culled.mean).toBeLessThan(50);
      if(renderer==='pixi'){ expect(culled.rendering.layers.structures.visible).toBe(0); expect(culled.rendering.layers.structures.culled).toBe(visible.expected); }
      console.log(`${renderer} dense paused structures: visible ${visible.mean.toFixed(3)} ms/frame, culled ${culled.mean.toFixed(3)} ms/frame; ${JSON.stringify(culled.rendering.layers.structures)}`);
    }finally{ await context.close(); }
  }
});

test('dense structure resources recreate after BFCache loss and cleanly hand ownership to Canvas on context loss',async({page},testInfo)=>{
  test.skip(testInfo.project.name!=='chromium-desktop','focused E2 resource lifecycle runs in primary Chromium');
  await start(page,'PHASEE2LIFECYCLE');
  const before=await page.evaluate(async()=>({checkpoint:await window.__STATEFALL_TEST__.canonicalCheckpoint(),rendering:window.__STATEFALL_TEST__.rendererDiagnostics()}));
  test.skip(before.rendering.active!=='pixi-hybrid','Pixi WebGL renderer unavailable');
  expect(before.rendering.layers.structures.visible).toBe(11);
  await page.evaluate(()=>window.dispatchEvent(new PageTransitionEvent('pagehide',{persisted:true})));
  await page.locator('.pixi-world').evaluate(element=>element.remove());
  await page.evaluate(()=>window.dispatchEvent(new PageTransitionEvent('pageshow',{persisted:true})));
  await expect.poll(()=>page.evaluate(()=>window.__STATEFALL_TEST__.renderingLifecycle().suspended)).toBe(false);
  await page.evaluate(()=>window.__STATEFALL_TEST__.renderRepeatedly(1));
  const resumed=await page.evaluate(async()=>({checkpoint:await window.__STATEFALL_TEST__.canonicalCheckpoint(),rendering:window.__STATEFALL_TEST__.rendererDiagnostics()}));
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
      expect(rendering.layers.structures,entry.seed).toMatchObject({owned:true,total:11,visible:11,culled:0});
    }finally{ await page.close(); }
  }
});
