const {test,expect}=require('@playwright/test');

test.describe.configure({mode:'serial'});

async function start(page,renderer,seed='PHASEF2RASTER',map='random',garrison=false){
  await page.addInitScript(()=>{ window.__STATEFALL_TEST_MODE__=true; localStorage.setItem('statefall-audio',JSON.stringify({master:0,sfx:0,alert:0,amb:0,music:0})); });
  await page.goto(`/index.html?browserTest=1&renderer=${renderer}`,{waitUntil:'load'});
  await expect.poll(()=>page.evaluate(()=>typeof window.__STATEFALL_TEST__)).toBe('object');
  await page.evaluate(()=>window.__STATEFALL_TEST__.prepareControlledStart());
  await page.locator(`#maps button[data-m="${map}"]`).click(); await page.locator('#seedIn').fill(seed); await page.locator('#countrySel').selectOption('0'); if(garrison) await page.evaluate(()=>{ document.querySelector('#garrisonOn').checked=true; }); await page.locator('#startBtn').click();
  await expect.poll(()=>page.evaluate(()=>window.__STATEFALL_TEST__.status().ready),{timeout:120_000}).toBe(true); await page.evaluate(()=>window.__STATEFALL_TEST__.pause());
}

test('F2 shares 4x deterministic bytes and recomposes only across the camera detail threshold',async({browser},testInfo)=>{
  test.skip(testInfo.project.name!=='chromium-desktop','primary source integration contract'); test.setTimeout(180_000);
  const results={};
  for(const renderer of ['canvas','pixi']){
    const context=await browser.newContext({viewport:{width:1280,height:720},deviceScaleFactor:1}),page=await context.newPage(); await start(page,renderer);
    await page.evaluate(()=>window.__STATEFALL_TEST__.setCamera(.9,'world'));
    const initial=await page.evaluate(async()=>{ const digest=await window.__STATEFALL_TEST__.terrainRasterDigest(); window.__STATEFALL_TEST__.renderRepeatedly(1); return {digest,rendering:window.__STATEFALL_TEST__.rendererDiagnostics()}; });
    expect(initial.digest).toMatchObject({worldWidth:720,worldHeight:414,pixelWidth:2880,pixelHeight:1656,pixelsPerTile:4,bytes:2880*1656*4,detailLevel:'strategic',filter:'canvas-high-pixi-linear',styleRevision:'direction-02-f2'});
    expect(initial.rendering.rasterDiagnostics).toMatchObject({staticBuild:1,worldWidth:720,worldHeight:414,pixelWidth:2880,pixelHeight:1656,pixelsPerTile:4,bytes:2880*1656*4,detailLevel:'strategic',filter:'canvas-high-pixi-linear',filterPolicy:{canvas:'imageSmoothingEnabled with imageSmoothingQuality=high',pixi:'bilinear/linear texture sampling'}});
    const before=initial.rendering,coarse=await page.evaluate(()=>window.__STATEFALL_TEST__.refreshTerrainRaster());
    expect(coarse.changed).toBe(false); expect(coarse.rendering.rasterBuildCount).toBe(before.rasterBuildCount); expect(coarse.rendering.rasterUploadCount).toBe(before.rasterUploadCount);
    await page.evaluate(()=>window.__STATEFALL_TEST__.setCameraOrigin(37,-19,.9));
    const panned=await page.evaluate(()=>window.__STATEFALL_TEST__.rendererDiagnostics()); expect(panned.rasterDiagnostics.compositeBuild).toBe(before.rasterDiagnostics.compositeBuild); expect(panned.rasterBuildCount).toBe(before.rasterBuildCount); expect(panned.rasterUploadCount).toBe(before.rasterUploadCount);
    await page.evaluate(()=>window.__STATEFALL_TEST__.setCamera(1.5,'player'));
    const sameBand=await page.evaluate(()=>window.__STATEFALL_TEST__.rendererDiagnostics()); expect(sameBand.rasterDiagnostics.compositeBuild).toBe(before.rasterDiagnostics.compositeBuild); expect(sameBand.rasterUploadCount).toBe(before.rasterUploadCount);
    await page.evaluate(()=>window.__STATEFALL_TEST__.setCamera(4,'player'));
    await page.evaluate(async()=>{ await window.__STATEFALL_TEST__.terrainRasterSettled(); window.__STATEFALL_TEST__.renderRepeatedly(1); });
    const crossed=await page.evaluate(()=>window.__STATEFALL_TEST__.rendererDiagnostics()); expect(crossed.rasterDiagnostics.compositeBuild).toBe(before.rasterDiagnostics.compositeBuild+1); expect(crossed.rasterBuildCount).toBe(before.rasterBuildCount+1); expect(crossed.rasterUploadCount).toBe(before.rasterUploadCount+(renderer==='pixi'?1:0)); expect(crossed.rasterDiagnostics.staticBuild).toBe(1); expect(crossed.rasterDiagnostics.detailLevel).toBe('operational');
    expect(crossed.rasterDiagnostics.scheduler.maxRequestMs).toBeLessThan(16.7); expect(crossed.rasterDiagnostics.scheduler.maxPublishMs).toBeLessThan(50);
    console.log(`${renderer} F2 worker cold/static cumulative ${before.rasterDiagnostics.timing.staticMs.toFixed(3)} ms, worker max ${crossed.rasterDiagnostics.scheduler.maxWorkerMs.toFixed(3)} ms, request max ${crossed.rasterDiagnostics.scheduler.maxRequestMs.toFixed(3)} ms, publish max ${crossed.rasterDiagnostics.scheduler.maxPublishMs.toFixed(3)} ms, model raster-retained ${crossed.rasterDiagnostics.modelRasterRetainedBytes} bytes`);
    const performance=await page.evaluate(()=>{ const started=performance.now(); window.__STATEFALL_TEST__.renderRepeatedly(600); return {mean:(performance.now()-started)/600}; }); expect(performance.mean).toBeLessThanOrEqual(16.7); console.log(`${renderer} F2 600-frame local CPU mean ${performance.mean.toFixed(3)} ms`);
    const stable=await page.evaluate(()=>window.__STATEFALL_TEST__.rendererDiagnostics()); expect(stable.rasterDiagnostics.compositeBuild).toBe(crossed.rasterDiagnostics.compositeBuild); expect(stable.rasterUploadCount).toBe(crossed.rasterUploadCount);
    results[renderer]={strategic:initial.digest,operational:await page.evaluate(()=>window.__STATEFALL_TEST__.terrainRasterDigest()),textureCount:stable.layers.terrain.textureCount||0}; await context.close();
  }
  expect(results.pixi.strategic).toEqual(results.canvas.strategic); expect(results.pixi.operational).toEqual(results.canvas.operational); expect(results.canvas.textureCount).toBe(0); expect(results.pixi.textureCount).toBe(1);
});

test('F2 source bytes ignore DPR, quality, renderer and reduced-motion policy',async({browser},testInfo)=>{
  test.skip(testInfo.project.name!=='chromium-desktop','byte policy contract'); test.setTimeout(180_000);
  const hashes=[];
  for(const options of [{renderer:'canvas',dpr:1,quality:'high',reducedMotion:'no-preference'},{renderer:'pixi',dpr:2,quality:'low',reducedMotion:'no-preference'},{renderer:'pixi',dpr:1,quality:'high',reducedMotion:'reduce'}]){
    const context=await browser.newContext({viewport:{width:1280,height:720},deviceScaleFactor:options.dpr,reducedMotion:options.reducedMotion}),page=await context.newPage();
    await start(page,options.renderer,'PHASEF2POLICY'); await page.evaluate(()=>window.__STATEFALL_TEST__.setCamera(4,'player'));
    hashes.push(await page.evaluate(async()=>window.__STATEFALL_TEST__.terrainRasterDigest())); await context.close();
  }
  expect(new Set(hashes.map(value=>value.sha256)).size).toBe(1); expect(new Set(hashes.map(value=>value.bytes)).size).toBe(1);
});

test('cold worker failure paints bounded emergency terrain and reset clears old map pixels immediately',async({browser},testInfo)=>{
  test.skip(testInfo.project.name!=='chromium-desktop','cold failure and reset ownership contract'); test.setTimeout(180_000);
  for(const renderer of ['canvas','pixi']){
    const failedContext=await browser.newContext({viewport:{width:960,height:640}}),failedPage=await failedContext.newPage();
    await failedPage.addInitScript(()=>{ window.__STATEFALL_TEST_MODE__=true; localStorage.setItem('statefall-audio',JSON.stringify({master:0,sfx:0,alert:0,amb:0,music:0})); }); await failedPage.goto(`/index.html?browserTest=1&renderer=${renderer}&terrainWorkerFail=1`,{waitUntil:'load'}); await expect.poll(()=>failedPage.evaluate(()=>typeof window.__STATEFALL_TEST__)).toBe('object'); await failedPage.evaluate(()=>window.__STATEFALL_TEST__.prepareControlledStart()); await failedPage.locator('#seedIn').fill(`F2FAIL${renderer}`); await failedPage.locator('#countrySel').selectOption('0'); await failedPage.locator('#startBtn').click(); await expect.poll(()=>failedPage.evaluate(()=>window.__STATEFALL_TEST__.status().ready),{timeout:120_000}).toBe(true);
    const failure=await failedPage.evaluate(async()=>{ await window.__STATEFALL_TEST__.terrainRasterSettled(); return {digest:await window.__STATEFALL_TEST__.terrainRasterDigest(),scheduler:window.__STATEFALL_TEST__.rendererDiagnostics().rasterDiagnostics.scheduler}; }); expect(failure.scheduler).toMatchObject({validRaster:true,emergencyMode:true,fallback:'emergency-terrain',failures:1}); expect(failure.scheduler.latestPublishedGeneration).toBe(0); expect(failure.scheduler.emergencyMs).toBeLessThan(50); console.log(`${renderer} emergency terrain ${failure.scheduler.emergencyMs.toFixed(3)} ms`); await failedContext.close();
    const context=await browser.newContext({viewport:{width:960,height:640}}),page=await context.newPage(); await start(page,renderer,`F2RESET${renderer}`); const probe=await page.evaluate(()=>window.__STATEFALL_TEST__.terrainResetSurfaceProbe()); expect(probe.immediate.first).toEqual([27,46,52,255]); expect(probe.immediate.uniform).toBe(true); expect(probe.immediate.diagnostics.validRaster).toBe(false); expect(probe.immediate.diagnostics.installedRasterRevision).toBeNull(); expect(probe.immediate.renderer.layers.terrain.owned).toBe(false); expect(probe.recovered.validRaster).toBe(true); expect(probe.recovered.latestPublishedGeneration).toBe(probe.recovered.latestRequestedGeneration); expect(probe.previous.installedRasterRevision).toBe(1); expect(probe.recovered.installedRasterRevision).toBe(1); expect(probe.recovered.installedWorkerEpoch).not.toBe(probe.previous.installedWorkerEpoch); await context.close();
  }
});

test('production publisher installs discarded-B cache-hit C and skips only its installed revision',async({page},testInfo)=>{
  test.skip(testInfo.project.name!=='chromium-desktop','worker raster identity publication contract'); test.setTimeout(180_000); await start(page,'canvas','PHASEF2PUBLISHER');
  const result=await page.evaluate(()=>window.__STATEFALL_TEST__.terrainRasterPublicationRace());
  expect(result.afterC.latestRequestedGeneration).toBe(result.generations.c); expect(result.afterC.latestPublishedGeneration).toBe(result.generations.c); expect(result.afterC.staleDiscarded).toBe(result.start.scheduler.staleDiscarded+1); expect(result.afterCCacheSkip).toBe(result.startCacheSkip+1); expect(result.afterC.completedRasterRevision).toBe(result.afterC.publishedRasterRevision); expect(result.afterC.publishedRasterRevision).toBe(result.afterC.installedRasterRevision); expect(result.afterC.publishedWorkerEpoch).toBe(result.afterC.installedWorkerEpoch); expect(result.bChangedDisplay).toBe(true); expect(result.c).not.toBe(result.a);
  expect(result.final.latestRequestedGeneration).toBe(result.generations.repeat); expect(result.final.latestPublishedGeneration).toBe(result.generations.repeat); expect(result.final.installedRasterRevision).toBe(result.afterC.installedRasterRevision); expect(result.final.installedWorkerEpoch).toBe(result.afterC.installedWorkerEpoch); expect(result.final.uploadSkippedSameRevision).toBe(result.afterC.uploadSkippedSameRevision+1); expect(result.repeatUploadDelta).toBe(0);
});

test('paused pick-area highlight clears immediately on Escape and mode cancellation',async({page},testInfo)=>{
  test.skip(testInfo.project.name!=='chromium-desktop','paused pick invalidation contract'); test.setTimeout(120_000);
  await page.addInitScript(()=>{ window.__STATEFALL_TEST_MODE__=true; localStorage.setItem('statefall-audio',JSON.stringify({master:0,sfx:0,alert:0,amb:0,music:0})); });
  await page.goto('/index.html?browserTest=1&renderer=canvas',{waitUntil:'load'}); await expect.poll(()=>page.evaluate(()=>typeof window.__STATEFALL_TEST__)).toBe('object'); await page.evaluate(()=>{ window.__STATEFALL_TEST__.prepareControlledStart(); document.querySelector('#garrisonOn').checked=true; }); await page.locator('#seedIn').fill('PHASEF2PICKCLEAR'); await page.locator('#countrySel').selectOption('0'); await page.locator('#startBtn').click(); await expect.poll(()=>page.evaluate(()=>window.__STATEFALL_TEST__.status().ready),{timeout:120_000}).toBe(true); await page.evaluate(()=>window.__STATEFALL_TEST__.pause());
  const plain=await page.evaluate(async()=>window.__STATEFALL_TEST__.terrainRasterDigest());
  await page.evaluate(()=>window.__STATEFALL_TEST__.terrainPickProbe(true)); const highlighted=await page.evaluate(async()=>window.__STATEFALL_TEST__.terrainRasterDigest()); expect(highlighted.sha256).not.toBe(plain.sha256);
  await page.keyboard.press('Escape'); expect(await page.evaluate(()=>window.__STATEFALL_TEST__.terrainPickStatus())).toEqual({active:false,hoverPickArea:-1}); expect((await page.evaluate(async()=>window.__STATEFALL_TEST__.terrainRasterDigest())).sha256).toBe(plain.sha256);
  await page.evaluate(()=>window.__STATEFALL_TEST__.terrainPickProbe(true)); await page.keyboard.press('c'); expect(await page.evaluate(()=>window.__STATEFALL_TEST__.terrainPickStatus())).toEqual({active:false,hoverPickArea:-1}); expect((await page.evaluate(async()=>window.__STATEFALL_TEST__.terrainRasterDigest())).sha256).toBe(plain.sha256);
});

test('F2 Canvas-high and Pixi-linear terrain-only framebuffers retain geometry and bounded sampling parity',async({browser},testInfo)=>{
  test.skip(testInfo.project.name!=='chromium-desktop','controlled DPR framebuffer qualification'); test.setTimeout(300_000);
  const results=[];
  for(const dpr of [1,1.5,2]){
    const context=await browser.newContext({viewport:{width:960,height:640},deviceScaleFactor:dpr}),page=await context.newPage(); await start(page,'pixi',`F2PARITY${String(dpr).replace('.','')}`);
    for(const camera of [{x:-37,y:19,scale:2},{x:-37.375,y:19.625,scale:3.125}]){
      const result=await page.evaluate(async camera=>{ window.__STATEFALL_TEST__.setCameraOrigin(camera.x,camera.y,camera.scale); await window.__STATEFALL_TEST__.terrainRasterSettled(); return window.__STATEFALL_TEST__.terrainFramebufferEvidence(); },camera); results.push(result);
      expect(result.geometry.actual.x).toBe(result.geometry.expected.x); expect(result.geometry.actual.y).toBe(result.geometry.expected.y); expect(result.geometry.actual.scaleX).toBeCloseTo(result.geometry.expected.scale,8); expect(result.geometry.actual.scaleY).toBeCloseTo(result.geometry.expected.scale,8);
      expect(result.alignmentPercent).toBeLessThanOrEqual(1); expect(result.grossPercent).toBeLessThanOrEqual(2); expect(result.meanChannelDelta).toBeLessThanOrEqual(3);
    }
    await context.close();
  }
  console.log(`F2_FRAMEBUFFER_PARITY ${JSON.stringify(results)}`);
});

test('F2 authoritative coast and topology input probes remain exact under smoothed presentation',async({browser},testInfo)=>{
  test.skip(testInfo.project.name!=='chromium-desktop','authoritative input qualification'); test.setTimeout(300_000);
  const results=[];
  for(const renderer of ['canvas','pixi']) for(const map of ['atoll','world','islands_s']){
    const context=await browser.newContext({viewport:{width:1280,height:720},deviceScaleFactor:1.5}),page=await context.newPage(); await start(page,renderer,`F2ALIGN${map.replace('_','')}`,map); await page.evaluate(()=>window.__STATEFALL_TEST__.setCameraOrigin(-123.375,41.625,3.125)); const result=await page.evaluate(()=>window.__STATEFALL_TEST__.terrainAlignmentCases()); results.push({renderer,map,...result}); await context.close();
  }
  console.log(`F2_ALIGNMENT ${JSON.stringify(results)}`);
  for(const name of ['coast','one-tile-island','narrow-channel','peninsula','river-mouth']){ const cases=results.flatMap(result=>result.cases[name]?[{...result.cases[name],renderer:result.renderer,map:result.map,kernel:result.presentationKernelRadiusTiles}]:[]); expect(new Set(cases.map(value=>value.renderer)),name).toEqual(new Set(['canvas','pixi-hybrid'])); for(const value of cases){ expect(value.kernel).toBeLessThanOrEqual(.125); expect(value.samples.every(sample=>sample.mapped===sample.expected)).toBe(true); } }
});

test('F2 sustained 10Hz suppression converges and named synchronous interactions stay responsive',async({browser},testInfo)=>{
  test.skip(testInfo.project.name!=='chromium-desktop','scheduler and responsiveness qualification'); test.setTimeout(300_000);
  const convergence=[],responsiveness=[],names=['enqueue','strategic-zoom-threshold','operational-zoom-threshold','hover-enter','hover-plateau','hover-leave','pick-enter','pick-cancel','paused-escape'];
  for(const renderer of ['canvas','pixi']){
    const context=await browser.newContext({viewport:{width:1280,height:720},deviceScaleFactor:1}),page=await context.newPage(); await start(page,renderer,`F2SUPPRESS${renderer}`,'random',true);
    await page.evaluate(names=>{ for(const name of names) window.__STATEFALL_TEST__.terrainResponsivenessSample(name); },names);
    const samples=await page.evaluate(names=>Object.fromEntries(names.map(name=>[name,Array.from({length:12},()=>window.__STATEFALL_TEST__.terrainResponsivenessSample(name))])),names); for(const [name,values] of Object.entries(samples)){ expect(values).toHaveLength(12); expect(Math.max(...values),`${renderer}/${name}`).toBeLessThan(50); responsiveness.push({renderer,name,samplesMs:values,targetMs:16.7,hardMaximumMs:50,maxMs:Math.max(...values)}); }
    const result=await page.evaluate(()=>window.__STATEFALL_TEST__.terrainSuppressionConvergence({requests:12,intervalMs:100})); expect(result.final.latestPublishedGeneration).toBe(result.final.latestRequestedGeneration); expect(result.final.validRaster).toBe(true); expect(result.final.latestPublications).toBeGreaterThan(0); expect(result.final.queued).toBeNull(); expect(result.final.inFlight).toBeNull(); expect(result.final.failures).toBe(0); expect(result.final.retries).toBe(0); expect(result.final.maxRequestMs).toBeLessThan(50); expect(result.final.maxPublishMs).toBeLessThan(50); expect(result.semantics.activeDiffersFromBaseline).toBe(true); expect(result.semantics.expiredEqualsBaseline).toBe(true); expect(result.semantics.consecutiveTickFade).toBe(true); convergence.push({renderer,...result}); await context.close();
  }
  console.log(`F2_CONVERGENCE ${JSON.stringify(convergence)}`); console.log(`F2_RESPONSIVENESS ${JSON.stringify(responsiveness)}`);
});
