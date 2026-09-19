const {test,expect}=require('@playwright/test');
const {createCanvas,loadImage}=require('canvas');
const {assertCanonicalBaseline}=require('../tools/simulation-baselines.js');

test.describe.configure({mode:'serial'});

async function configure(page){
  const failures=[];
  page.on('pageerror',error=>failures.push(`page error: ${error.stack||error.message}`));
  page.on('console',message=>{ if(message.type()==='error') failures.push(`console error: ${message.text()}`); });
  page.on('requestfailed',request=>failures.push(`request failed: ${request.url()}`));
  page.on('response',response=>{ if(response.status()>=400) failures.push(`HTTP ${response.status()}: ${response.url()}`); });
  await page.addInitScript(()=>{
    window.__STATEFALL_TEST_MODE__=true;
    localStorage.setItem('statefall-audio',JSON.stringify({master:0,sfx:0,alert:0,amb:0,music:0}));
  });
  return failures;
}

async function start(page,renderer,seed='PHASEEFOUNDATION'){
  await page.goto(`/index.html?browserTest=1&renderer=${renderer}`,{waitUntil:'load'});
  await expect.poll(()=>page.evaluate(()=>typeof window.__STATEFALL_TEST__)).toBe('object');
  await page.evaluate(()=>window.__STATEFALL_TEST__.prepareControlledStart());
  await page.locator('#maps button[data-m="random"]').click();
  await page.locator('#seedIn').fill(seed);
  await page.locator('#countrySel').selectOption('0');
  await page.locator('#startBtn').click();
  await expect.poll(()=>page.evaluate(()=>window.__STATEFALL_TEST__?.status().ready)).toBe(true);
  await page.evaluate(()=>window.__STATEFALL_TEST__.pause());
}

async function pixels(locator){
  const image=await loadImage(await locator.screenshot()),canvas=createCanvas(image.width,image.height),context=canvas.getContext('2d');
  context.drawImage(image,0,0); const data=context.getImageData(0,0,image.width,image.height).data;
  let opaque=0,sea=0,land=0,ownership=0;
  for(let i=0;i<data.length;i+=4){
    const r=data[i],g=data[i+1],b=data[i+2],a=data[i+3];
    if(a>240) opaque++;
    if(Math.abs(r-28)<8&&Math.abs(g-58)<8&&Math.abs(b-82)<8) sea++;
    if(Math.abs(r-185)<12&&Math.abs(g-173)<12&&Math.abs(b-132)<12) land++;
    if(a>240&&Math.max(r,g,b)-Math.min(r,g,b)>45&&!(b>g&&g>r)) ownership++;
  }
  return {width:image.width,height:image.height,opaque,sea,land,ownership,data};
}

function changedPixels(before,after){
  let changed=0;
  for(let i=0;i<before.length;i+=4) if(Math.abs(before[i]-after[i])+Math.abs(before[i+1]-after[i+1])+Math.abs(before[i+2]-after[i+2])>30) changed++;
  return changed;
}

test('Canvas and Pixi hybrid preserve state, input, camera, and bounded raster lifecycle',async({browser},testInfo)=>{
  test.skip(testInfo.project.name!=='chromium-desktop','dual renderer contract runs in source Chromium');
  const results={};
  for(const renderer of ['canvas','pixi']){
    const context=await browser.newContext({viewport:{width:1280,height:720},deviceScaleFactor:1});
    const page=await context.newPage(),failures=await configure(page);
    try{
      await start(page,renderer);
      const canvas=page.locator('#map'),box=await canvas.boundingBox();
      const initial=await page.evaluate(()=>window.__STATEFALL_TEST__.snapshot());
      expect(initial.rendering.requested).toBe(renderer);
      expect(initial.rendering.active).toBe(renderer==='pixi'?'pixi-hybrid':'canvas');
      expect(initial.rendering.cssWidth).toBe(initial.canvas.clientWidth);
      expect(initial.rendering.pixelWidth).toBe(initial.canvas.width);
      if(renderer==='pixi'){
        expect(initial.rendering).toMatchObject({textureCount:1,spriteCount:1,containerCount:14,contextState:'ready',capabilities:{preStructures:true,structures:true,navalLogistics:true,warships:true,projectiles:true,missiles:true,aircraft:true,mapLabels:true,supportActors:true,floatingText:true}});
        const layers=await page.evaluate(()=>{
          const map=document.querySelector('#map').getBoundingClientRect(),world=document.querySelector('.pixi-world').getBoundingClientRect();
          return {map:map.toJSON(),world:world.toJSON(),mapPointer:getComputedStyle(document.querySelector('#map')).pointerEvents,worldPointer:getComputedStyle(document.querySelector('.pixi-world')).pointerEvents};
        });
        expect(layers.world).toMatchObject({x:layers.map.x,y:layers.map.y,width:layers.map.width,height:layers.map.height});
        expect(layers.mapPointer).not.toBe('none'); expect(layers.worldPointer).toBe('none');
        const initialPixels=await pixels(page.locator('.pixi-world'));
        expect(initialPixels.opaque).toBe(initialPixels.width*initialPixels.height);
        expect(initialPixels.sea).toBeGreaterThan(500);
        expect(initialPixels.land+initialPixels.ownership).toBeGreaterThan(500);

        const beforeInvalidation=await page.evaluate(()=>window.__STATEFALL_TEST__.rendererDiagnostics());
        await page.evaluate(()=>window.__STATEFALL_TEST__.invalidateOwnershipRaster());
        const afterInvalidation=await page.evaluate(()=>window.__STATEFALL_TEST__.rendererDiagnostics());
        expect(afterInvalidation.rasterBuildCount-beforeInvalidation.rasterBuildCount).toBe(1);
        expect(afterInvalidation.rasterUploadCount-beforeInvalidation.rasterUploadCount).toBe(1);
        const changed=changedPixels(initialPixels.data,(await pixels(page.locator('.pixi-world'))).data);
        expect(changed).toBeGreaterThan(500);

        const boardNation=page.locator('#board [data-pid]').first();
        await boardNation.hover(); await page.locator('#stage').hover({position:{x:5,y:5}});
        await expect.poll(()=>page.evaluate(()=>window.__STATEFALL_TEST__.rendererDiagnostics().rasterUploadCount)).toBeGreaterThan(afterInvalidation.rasterUploadCount);
        const unhighlighted=await pixels(page.locator('.pixi-world'));
        const beforeHover=await page.evaluate(async()=>({diagnostics:window.__STATEFALL_TEST__.rendererDiagnostics(),checkpoint:await window.__STATEFALL_TEST__.canonicalCheckpoint(),raf:window.__STATEFALL_TEST__.renderingLifecycle().rafCallbacks}));
        await boardNation.hover();
        await expect.poll(()=>page.evaluate(()=>window.__STATEFALL_TEST__.rendererDiagnostics().rasterUploadCount)).toBeGreaterThan(beforeHover.diagnostics.rasterUploadCount);
        const entered=await page.evaluate(()=>window.__STATEFALL_TEST__.rendererDiagnostics());
        expect(entered.rasterBuildCount-beforeHover.diagnostics.rasterBuildCount).toBeLessThanOrEqual(1);
        expect(entered.rasterUploadCount-beforeHover.diagnostics.rasterUploadCount).toBeLessThanOrEqual(1);
        expect(changedPixels(unhighlighted.data,(await pixels(page.locator('.pixi-world'))).data)).toBeGreaterThan(500);
        await expect.poll(()=>page.evaluate(()=>window.__STATEFALL_TEST__.renderingLifecycle().rafCallbacks)).toBeGreaterThanOrEqual(beforeHover.raf+20);
        const sustained=await page.evaluate(async()=>({diagnostics:window.__STATEFALL_TEST__.rendererDiagnostics(),checkpoint:await window.__STATEFALL_TEST__.canonicalCheckpoint()}));
        expect(sustained.diagnostics.rasterBuildCount).toBe(entered.rasterBuildCount);
        expect(sustained.diagnostics.rasterUploadCount).toBe(entered.rasterUploadCount);
        expect(sustained.checkpoint).toEqual(beforeHover.checkpoint);
        await page.locator('#stage').hover({position:{x:5,y:5}});
        await expect.poll(()=>page.evaluate(()=>window.__STATEFALL_TEST__.rendererDiagnostics().rasterUploadCount)).toBeGreaterThan(entered.rasterUploadCount);
        const cleared=await page.evaluate(()=>window.__STATEFALL_TEST__.rendererDiagnostics());
        expect(cleared.rasterBuildCount-entered.rasterBuildCount).toBeLessThanOrEqual(1);
        expect(cleared.rasterUploadCount-entered.rasterUploadCount).toBeLessThanOrEqual(1);
      }else{
        expect(await page.locator('.pixi-world').count()).toBe(0);
        const beforeHover=await page.evaluate(async()=>({diagnostics:window.__STATEFALL_TEST__.rendererDiagnostics(),checkpoint:await window.__STATEFALL_TEST__.canonicalCheckpoint()}));
        await page.locator('#board [data-pid]').first().hover();
        await page.evaluate(()=>window.__STATEFALL_TEST__.renderRepeatedly(10));
        const pulsing=await page.evaluate(async()=>({diagnostics:window.__STATEFALL_TEST__.rendererDiagnostics(),checkpoint:await window.__STATEFALL_TEST__.canonicalCheckpoint()}));
        expect(pulsing.diagnostics.rasterBuildCount-beforeHover.diagnostics.rasterBuildCount).toBeGreaterThanOrEqual(10);
        expect(pulsing.checkpoint).toEqual(beforeHover.checkpoint);
        await page.locator('#stage').hover({position:{x:5,y:5}});
      }

      const target=await page.evaluate(()=>window.__STATEFALL_TEST__.focusTarget('owned',4));
      expect(await page.evaluate(point=>window.__STATEFALL_TEST__.screenToTile(point.x,point.y),target)).toBe(target.tile);
      await canvas.click({position:{x:target.x,y:target.y}});
      await expect.poll(()=>page.evaluate(()=>window.__STATEFALL_TEST__.snapshot().input.lastCommand?.a[0])).toBe(target.tile);
      await canvas.click({position:{x:target.x,y:target.y},button:'right'});
      await expect(page.locator('#ctx')).toBeVisible();
      await expect(page.locator('#ctx')).toContainText('Economy');
      await page.keyboard.press('Escape');

      const beforeZoom=await page.evaluate(()=>window.__STATEFALL_TEST__.snapshot().camera);
      await page.mouse.move(box.x+box.width/2,box.y+box.height/2); await page.mouse.wheel(0,-120);
      await expect.poll(()=>page.evaluate(()=>window.__STATEFALL_TEST__.snapshot().camera.scale)).toBeGreaterThan(beforeZoom.scale);
      const beforePan=await page.evaluate(()=>window.__STATEFALL_TEST__.snapshot().camera);
      await page.mouse.down(); await page.mouse.move(box.x+box.width/2+40,box.y+box.height/2+25); await page.mouse.up();
      await expect.poll(()=>page.evaluate(()=>window.__STATEFALL_TEST__.snapshot().camera.x)).toBeCloseTo(beforePan.x+40,0);

      const beforeRepeat=await page.evaluate(()=>window.__STATEFALL_TEST__.rendererDiagnostics());
      await page.evaluate(()=>window.__STATEFALL_TEST__.renderRepeatedly(12));
      const afterRepeat=await page.evaluate(()=>window.__STATEFALL_TEST__.rendererDiagnostics());
      expect(afterRepeat.rasterBuildCount).toBe(beforeRepeat.rasterBuildCount);
      expect(afterRepeat.rasterUploadCount).toBe(beforeRepeat.rasterUploadCount);
      const frameSample=await page.evaluate(()=>{ const before=performance.now(); window.__STATEFALL_TEST__.renderRepeatedly(20); return (performance.now()-before)/20; });
      console.log(`${renderer} paused render mean: ${frameSample.toFixed(3)} ms; diagnostics ${JSON.stringify(afterRepeat)}`);

      await page.evaluate(()=>window.__STATEFALL_TEST__.advance(120));
      results[renderer]=await page.evaluate(async()=>({checkpoint:await window.__STATEFALL_TEST__.canonicalCheckpoint(),terrain:window.__STATEFALL_TEST__.snapshot().landCount}));
      expect(results[renderer].terrain).toBeGreaterThan(10_000);
      const beforeReset=await page.evaluate(()=>window.__STATEFALL_TEST__.rendererDiagnostics());
      const reset=await page.evaluate(()=>{ const contract=window.__STATEFALL_TEST__.creditsReplayResetContract(); window.__STATEFALL_TEST__.renderRepeatedly(1); return {contract,rendering:window.__STATEFALL_TEST__.rendererDiagnostics()}; });
      expect(reset.contract).toMatchObject({scratchCleared:true,setupInstalled:true,status:{ready:true,tick:0}});
      expect(reset.rendering.layers.terrain.textureCount||0).toBe(renderer==='pixi'?1:0);
      if(renderer==='pixi'){
        expect(reset.rendering.textureDestroyCount-beforeReset.textureDestroyCount).toBe(1);
        expect(reset.rendering.textureAllocations-beforeReset.textureAllocations).toBe(1);
      }
      expect(failures,failures.join('\n')).toEqual([]);
    }finally{ await context.close(); }
  }
  expect(results.pixi).toEqual(results.canvas);
});

test('source Pixi smoke preserves raster, input alignment, and canonical parity',async({page},testInfo)=>{
  test.skip(!['chromium-desktop','firefox-desktop','webkit-desktop'].includes(testInfo.project.name),'source desktop renderer smoke only');
  const failures=await configure(page);
  await start(page,'pixi','PHASE0DIGEST');
  const capability=await page.evaluate(()=>{ const canvas=document.createElement('canvas'); return !!(canvas.getContext('webgl2')||canvas.getContext('webgl')); });
  const rendering=await page.evaluate(()=>window.__STATEFALL_TEST__.rendererDiagnostics());
  if(capability){
    expect(rendering).toMatchObject({active:'pixi-hybrid',contextState:'ready',capabilities:{preStructures:true,structures:true},layers:{terrain:{textureCount:1}}});
    await expect(page.locator('.pixi-world')).toBeVisible();
    expect(rendering.rasterUploadCount).toBeGreaterThan(0);
    if(testInfo.project.name==='chromium-desktop'){
      const raster=await pixels(page.locator('.pixi-world'));
      expect(raster.sea).toBeGreaterThan(500); expect(raster.land+raster.ownership).toBeGreaterThan(500);
    }
  }else{
    expect(rendering).toMatchObject({active:'canvas',textureCount:0});
    expect(rendering.fallbackReason).toContain('pixi-init-failed');
  }
  await page.evaluate(()=>window.__STATEFALL_TEST__.advance(300));
  const digest=await page.evaluate(()=>window.__STATEFALL_TEST__.canonicalDigest());
  assertCanonicalBaseline('browser','fixed-seed-cross-engine',digest,testInfo.project.name);
  const target=await page.evaluate(()=>window.__STATEFALL_TEST__.focusTarget('owned',4));
  expect(await page.evaluate(point=>window.__STATEFALL_TEST__.screenToTile(point.x,point.y),target)).toBe(target.tile);
  await page.locator('#map').click({position:{x:target.x,y:target.y}});
  await expect.poll(()=>page.evaluate(()=>window.__STATEFALL_TEST__.snapshot().input.lastCommand?.a[0])).toBe(target.tile);
  expect(failures,failures.join('\n')).toEqual([]);
});

for(const renderer of ['canvas','pixi']) test(`${renderer} survives repeated persisted page lifecycle with one RAF and viewport lifecycle`,async({page},testInfo)=>{
  test.skip(testInfo.project.name!=='chromium-desktop','deterministic BFCache lifecycle simulation runs in Chromium');
  const failures=await configure(page);
  const requested=renderer==='pixi'?'pixi&pixiResumeFailAt=2':renderer;
  await start(page,requested,`PHASEEBFCACHE${renderer.toUpperCase()}`);
  await page.locator('#pauseBtn').focus();
  const target=await page.evaluate(()=>window.__STATEFALL_TEST__.focusTarget('owned',4));
  await page.locator('#map').click({position:{x:target.x,y:target.y}}); await page.locator('#pauseBtn').focus();
  const before=await page.evaluate(async()=>({checkpoint:await window.__STATEFALL_TEST__.canonicalCheckpoint(),camera:window.__STATEFALL_TEST__.snapshot().camera,input:window.__STATEFALL_TEST__.snapshot().input,lifecycle:window.__STATEFALL_TEST__.renderingLifecycle()}));
  expect(before.lifecycle).toMatchObject({rafPending:1,frozen:false,listening:true,observerCount:1,resizeListenerCount:1});
  for(let cycle=0;cycle<3;cycle++){
    await page.evaluate(()=>window.dispatchEvent(new PageTransitionEvent('pagehide',{persisted:true})));
    await expect.poll(()=>page.evaluate(()=>window.__STATEFALL_TEST__.renderingLifecycle().suspended)).toBe(true);
    expect(await page.evaluate(()=>window.__STATEFALL_TEST__.renderingLifecycle())).toMatchObject({rafPending:0,listening:false,observerCount:0,resizeListenerCount:0});
    if(renderer==='pixi'&&cycle===0) await page.locator('.pixi-world').evaluate(element=>element.remove());
    await page.setViewportSize(cycle%2?{width:1280,height:720}:{width:1180,height:760});
    await page.evaluate(()=>window.dispatchEvent(new PageTransitionEvent('pageshow',{persisted:true})));
    await expect.poll(()=>page.evaluate(()=>window.__STATEFALL_TEST__.renderingLifecycle().suspended)).toBe(false);
    await expect.poll(()=>page.evaluate(()=>window.__STATEFALL_TEST__.renderingLifecycle().rafPending)).toBe(1);
    if(renderer==='pixi'&&cycle===0) await expect.poll(()=>page.evaluate(()=>window.__STATEFALL_TEST__.rendererDiagnostics().textureCount)).toBe(1);
    const after=await page.evaluate(async()=>({checkpoint:await window.__STATEFALL_TEST__.canonicalCheckpoint(),camera:window.__STATEFALL_TEST__.snapshot().camera,input:window.__STATEFALL_TEST__.snapshot().input,lifecycle:window.__STATEFALL_TEST__.renderingLifecycle(),focus:document.activeElement?.id,rendering:window.__STATEFALL_TEST__.rendererDiagnostics()}));
    expect(after.checkpoint).toEqual(before.checkpoint); expect(after.input).toEqual(before.input); expect(after.focus).toBe('pauseBtn');
    expect(after.lifecycle).toMatchObject({rafPending:1,frozen:false,listening:true,observerCount:1,resizeListenerCount:1,restoreFailure:null});
    expect((after.camera.visibleBounds.left+after.camera.visibleBounds.right)/2).toBeCloseTo((before.camera.visibleBounds.left+before.camera.visibleBounds.right)/2,8);
    expect((after.camera.visibleBounds.top+after.camera.visibleBounds.bottom)/2).toBeCloseTo((before.camera.visibleBounds.top+before.camera.visibleBounds.bottom)/2,8);
    if(renderer==='pixi'&&cycle===0){
      expect(after.rendering).toMatchObject({active:'pixi-hybrid',containerCount:14,canvasCount:1,contextListenerCount:2,contextState:'ready',capabilities:{preStructures:true,structures:true,navalLogistics:true,warships:true,projectiles:true,missiles:true,aircraft:true,mapLabels:true,supportActors:true,floatingText:true},layers:{terrain:{textureCount:1}}});
      expect(after.rendering.applicationAllocations).toBeLessThanOrEqual(2); expect(after.rendering.textureAllocations).toBeLessThanOrEqual(2);
    }
    if(renderer==='pixi'&&cycle>=1){
      expect(after.rendering).toMatchObject({active:'canvas',textureCount:0,spriteCount:0,containerCount:0});
      expect(after.rendering.fallbackReason).toContain('pixi-resume-failed'); expect(after.rendering.fallbackReason.length).toBeLessThanOrEqual(160);
      expect(after.rendering.fallbackCleanup).toMatchObject({textureCount:0,spriteCount:0,containerCount:0,canvasCount:0,contextListenerCount:0,contextState:'destroyed'});
      expect(after.rendering.fallbackCleanup).toMatchObject({applicationAllocations:3,rendererAllocations:3,textureAllocations:2,releaseCount:3,textureDestroyCount:2});
      expect(await page.locator('.pixi-world').count()).toBe(0);
    }
  }
  expect(failures,failures.join('\n')).toEqual([]);
});

test('real WebGL context loss falls back without changing simulation state',async({page},testInfo)=>{
  test.skip(testInfo.project.name!=='chromium-desktop','WebGL context-loss contract runs in Chromium');
  const failures=await configure(page);
  await start(page,'pixi','PHASEECONTEXT');
  test.skip((await page.evaluate(()=>window.__STATEFALL_TEST__.rendererDiagnostics().active))!=='pixi-hybrid','Pixi WebGL renderer unavailable');
  const extension=await page.locator('.pixi-world').evaluate(canvas=>{ const gl=canvas.getContext('webgl2')||canvas.getContext('webgl'); return !!gl?.getExtension('WEBGL_lose_context'); });
  test.skip(!extension,'WEBGL_lose_context unavailable in this Chromium environment');
  const before=await page.evaluate(async()=>({checkpoint:await window.__STATEFALL_TEST__.canonicalCheckpoint(),camera:window.__STATEFALL_TEST__.snapshot().camera,input:window.__STATEFALL_TEST__.snapshot().input}));
  await page.locator('.pixi-world').evaluate(canvas=>{ const gl=canvas.getContext('webgl2')||canvas.getContext('webgl'); gl.getExtension('WEBGL_lose_context').loseContext(); });
  await expect.poll(()=>page.evaluate(()=>window.__STATEFALL_TEST__.rendererDiagnostics().active)).toBe('canvas');
  await expect.poll(()=>page.locator('.pixi-world').count()).toBe(0);
  await page.evaluate(()=>window.__STATEFALL_TEST__.renderRepeatedly(1));
  const after=await page.evaluate(async()=>({checkpoint:await window.__STATEFALL_TEST__.canonicalCheckpoint(),camera:window.__STATEFALL_TEST__.snapshot().camera,input:window.__STATEFALL_TEST__.snapshot().input,rendering:window.__STATEFALL_TEST__.rendererDiagnostics()}));
  expect(after.checkpoint).toEqual(before.checkpoint); expect(after.camera).toEqual(before.camera); expect(after.input).toEqual(before.input);
  expect(after.rendering).toMatchObject({active:'canvas',textureCount:0,spriteCount:0,containerCount:0});
  expect(after.rendering.fallbackReason).toContain('pixi-context-lost');
  const composited=await pixels(page.locator('#stage'));
  expect(composited.sea+composited.land+composited.ownership).toBeGreaterThan(500);
  expect(failures,failures.join('\n')).toEqual([]);
});

test('Pixi initialization failure and unsupported names fall back without restarting simulation',async({page},testInfo)=>{
  test.skip(testInfo.project.name!=='chromium-desktop','fallback contract runs in source Chromium');
  const failures=await configure(page);
  await start(page,'pixi&pixiInit=fail','PHASEEFALLBACK');
  const failed=await page.evaluate(()=>window.__STATEFALL_TEST__.snapshot());
  expect(failed.rendering).toMatchObject({requested:'pixi',active:'canvas',textureCount:0});
  expect(failed.rendering.fallbackReason).toContain('pixi-init-failed');
  expect(failed.tick).toBe(0);
  await page.goto('/index.html?browserTest=1&renderer=pixi&pixiInit=fail-after-setup',{waitUntil:'load'});
  await expect.poll(()=>page.evaluate(()=>typeof window.__STATEFALL_TEST__)).toBe('object');
  const partial=await page.evaluate(()=>window.__STATEFALL_TEST__.rendererDiagnostics());
  expect(partial).toMatchObject({requested:'pixi',active:'canvas',textureCount:0,fallbackCleanup:{applicationAllocations:1,rendererAllocations:1,textureCount:0,spriteCount:0,containerCount:0,canvasCount:0,contextListenerCount:0,releaseCount:1,contextState:'destroyed'}});
  expect(partial.fallbackReason).toContain('failure injected after resource setup'); expect(partial.fallbackReason.length).toBeLessThanOrEqual(160);
  expect(await page.locator('.pixi-world').count()).toBe(0);
  await page.evaluate(()=>window.__STATEFALL_TEST__.prepareControlledStart()); await page.locator('#maps button[data-m="random"]').click();
  await page.locator('#seedIn').fill('PHASEEPARTIALFAILURE'); await page.locator('#countrySel').selectOption('0'); await page.locator('#startBtn').click();
  await expect.poll(()=>page.evaluate(()=>window.__STATEFALL_TEST__?.status().ready)).toBe(true); await page.evaluate(()=>window.__STATEFALL_TEST__.pause());
  expect((await page.evaluate(()=>window.__STATEFALL_TEST__.snapshot())).rendering.active).toBe('canvas');
  const continuation=await pixels(page.locator('#stage')); expect(continuation.sea+continuation.land+continuation.ownership).toBeGreaterThan(500);
  await page.goto('/index.html?browserTest=1&renderer=unknown-renderer',{waitUntil:'load'});
  await expect.poll(()=>page.evaluate(()=>typeof window.__STATEFALL_TEST__)).toBe('object');
  const unsupported=await page.evaluate(()=>window.__STATEFALL_TEST__.rendererDiagnostics());
  expect(unsupported).toMatchObject({requested:'unknown-renderer',active:'canvas'});
  expect(unsupported.fallbackReason).toContain('unsupported-renderer');
  expect(failures,failures.join('\n')).toEqual([]);
});
