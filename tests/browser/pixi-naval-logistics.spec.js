const {test,expect}=require('@playwright/test');
const {createCanvas,loadImage}=require('canvas');

test.describe.configure({mode:'serial'});

async function start(page,query=''){
  await page.addInitScript(()=>{ window.__STATEFALL_TEST_MODE__=true; localStorage.setItem('statefall-audio',JSON.stringify({master:0,sfx:0,alert:0,amb:0,music:0})); });
  await page.goto(`/index.html?browserTest=1&renderer=pixi${query}`,{waitUntil:'load'}); await expect.poll(()=>page.evaluate(()=>typeof window.__STATEFALL_TEST__)).toBe('object');
  await page.evaluate(()=>window.__STATEFALL_TEST__.prepareControlledStart()); await page.locator('#maps button[data-m="random"]').click(); await page.locator('#seedIn').fill('PHASEE5NAVAL'); await page.locator('#countrySel').selectOption('0'); await page.locator('#startBtn').click();
  await expect.poll(()=>page.evaluate(()=>window.__STATEFALL_TEST__.status().ready)).toBe(true); await page.evaluate(()=>{ window.__STATEFALL_TEST__.pause(); window.__STATEFALL_TEST__.installLateGameScene(); window.__STATEFALL_TEST__.freezePresentation(); });
}

function fixtureInPage(){
  const api=window.__STATEFALL_TEST__,camera=api.snapshot().camera,world=(x,y)=>[(x-camera.x)/camera.scale,(y-camera.y)/camera.scale],tile=(x,y)=>Math.max(0,Math.min(720*414-1,Math.floor(y)*720+Math.floor(x)));
  const transport=(x,y,color,heavy)=>{ const [wx,wy]=world(x,y),[sx,sy]=world(x-100,y); return {x:wx,y:wy,heading:0,troops:heavy?87.6:12.4,hp:3,maxHp:4,heavy,color,visible:true,pos:1,path:[tile(sx,sy)],wake:[[wx-18,wy],[wx-9,wy],[wx-3,wy]],speed:1.3}; };
  const [mx,my]=world(760,330),[bx,by]=world(-40,360),[tx,ty]=world(1320,360);
  return {transports:[transport(400,280,'#ff3355',false),transport(620,280,'#33cc66',true)],merchants:[{x:mx,y:my,heading:0,color:'#3f7bd9',visible:true,wake:[[mx-15,my],[mx-5,my]],speed:1.3}],boarding:[{x:bx,y:by,targetX:tx,targetY:ty,active:true,visible:true}]};
}

async function pixels(locator){ const image=await loadImage(await locator.screenshot()),canvas=createCanvas(image.width,image.height),context=canvas.getContext('2d'); context.drawImage(image,0,0); return {width:image.width,height:image.height,data:context.getImageData(0,0,image.width,image.height).data}; }
function matches(image,x,y,r,predicate){ let count=0; for(let py=Math.max(0,y-r);py<=Math.min(image.height-1,y+r);py++) for(let px=Math.max(0,x-r);px<=Math.min(image.width-1,x+r);px++){ const i=(py*image.width+px)*4; if(predicate(...image.data.slice(i,i+4))) count++; } return count; }
const canvasRedAt=(page,x,y,r)=>page.evaluate(({x,y,r})=>{ const canvas=document.querySelector('#map'),context=canvas.getContext('2d'),dpr=canvas.width/canvas.getBoundingClientRect().width,data=context.getImageData(Math.floor((x-r)*dpr),Math.floor((y-r)*dpr),Math.ceil(r*2*dpr),Math.ceil(r*2*dpr)).data; let count=0; for(let i=0;i<data.length;i+=4) if(data[i]>170&&data[i+1]<140&&data[i+3]>0) count++; return count; },{x,y,r});

test('Pixi owns the bounded naval-logistics prefix in exact legacy order with targeted pixels',async({page},testInfo)=>{
  test.skip(testInfo.project.name!=='chromium-desktop','focused E5 evidence runs in primary Chromium'); await start(page);
  const evidence=await page.evaluate(fixtureInPage); const result=await page.evaluate(state=>window.__STATEFALL_TEST__.exerciseNavalLogistics(state,{drawRetainedWarship:true}),evidence);
  test.skip(result.rendering.active!=='pixi-hybrid','Pixi WebGL renderer unavailable');
  expect(result.owned).toBe(true); expect(result.rendering.layers.structures.owned).toBe(true);
  expect(result.rendering.layers.navalLogistics).toMatchObject({owned:true,counts:{transports:{total:2,visible:2,culled:0},merchants:{total:1,visible:1,culled:0},boarding:{total:1,visible:1,culled:0}},routeCount:2,wakeSegmentCount:5,boardingSegmentCount:1,labelCount:2,generatedHullTextures:{strategy:'vector-primitives',references:0,textures:0,gpuBytes:{status:'unknown',bytes:null}},resourceLimitFallback:{reason:null}});
  expect(result.rendering.layers.navalLogistics.presentation.map(value=>value.items)).toEqual([
    ['transport-route','transport-wake','transport-hull','transport-troops'],
    ['transport-route','transport-wake','transport-hull','transport-hp','transport-troops'],
    ['merchant-wake','merchant-hull-cargo'],['boarding-line']
  ]);
  expect(result.rendering.layers.navalLogistics.presentation[0].styles.find(value=>value.stroke==='#fff')).toMatchObject({kind:'polygon',join:'round'});
  expect(result.rendering.layers.navalLogistics.presentation[2].styles.find(value=>value.stroke==='#5a4a30')).toMatchObject({kind:'polygon',join:'miter'});
  expect(result.rendering.layers.navalLogistics.presentation[3].styles[0]).toMatchObject({kind:'line',cap:'round'});
  expect(result.rendering.layers.navalLogistics.resources.map(value=>value.childCount)).toEqual([4,5,2,1]);
  const pixi=await pixels(page.locator('.pixi-world'));
  expect(matches(pixi,400,280,18,(r,g,b,a)=>r>180&&g<130&&b<150&&a>0)).toBeGreaterThan(0);
  expect(matches(pixi,620,280,22,(r,g,b,a)=>g>130&&r<180&&a>0)).toBeGreaterThan(0);
  expect(matches(pixi,760,330,18,(r,g,b,a)=>b>100&&a>0)).toBeGreaterThan(0);
  expect(matches(pixi,640,360,5,(r,g,b,a)=>r>120&&g>90&&b<130&&a>0)).toBeGreaterThan(0);
  const canvas=await pixels(page.locator('#map')); expect(matches(canvas,result.retainedWarship.x,result.retainedWarship.y,20,(r,g,b,a)=>r>180&&g<120&&a>0),'retained Canvas warship remains above migrated boarding in the overlay canvas').toBeGreaterThan(0);
});

test('boarding cap and Canvas handoff follow earlier visible wakes before viewport culling',async({page},testInfo)=>{
  test.skip(testInfo.project.name!=='chromium-desktop','stroke-state contract runs in primary Chromium'); await start(page);
  const result=await page.evaluate(()=>{ const api=window.__STATEFALL_TEST__,camera={x:0,y:0,scale:2},viewport={width:100,height:100},boarding=[{x:-10,y:25,targetX:60,targetY:25,active:true,visible:true}],merchant={x:1000,y:1000,heading:0,color:'#3f7bd9',visible:true,wake:[[998,1000],[999,1000]],speed:1.3},run=merchants=>{ const value=api.exerciseNavalLogistics({camera,viewport,mapWidth:100,transports:[],merchants,boarding}); return {handoff:value.canvasStrokeState,layer:value.rendering.layers.navalLogistics}; }; return {round:run([merchant]),butt:run([{...merchant,visible:false}])}; });
  test.skip(!result.round.layer.owned,'Pixi WebGL renderer unavailable');
  expect(result.round).toMatchObject({handoff:{lineJoin:'miter',lineCap:'round'},layer:{canvasStrokeState:{lineJoin:'miter',lineCap:'round'},counts:{merchants:{visible:0,culled:1}}}});
  expect(result.round.layer.presentation[0].styles[0]).toMatchObject({kind:'line',cap:'round'});
  expect(result.butt.handoff).toEqual({lineJoin:'miter',lineCap:'butt'}); expect(result.butt.layer.canvasStrokeState).toEqual(result.butt.handoff); expect(result.butt.layer.presentation[0].styles[0]).toMatchObject({kind:'line',cap:'butt'});
});

test('naval cap failure is atomic, leaves structures owned, and recovers next valid frame',async({page},testInfo)=>{
  test.skip(testInfo.project.name!=='chromium-desktop','atomic E5 evidence runs in primary Chromium'); await start(page,'&pixiNavalLabelCap=0');
  const checkpoint=await page.evaluate(()=>window.__STATEFALL_TEST__.canonicalCheckpoint()),state=await page.evaluate(fixtureInPage),failed=await page.evaluate(value=>window.__STATEFALL_TEST__.exerciseNavalLogistics(value),state);
  expect(failed).toMatchObject({owned:false,rendering:{layers:{structures:{owned:true},navalLogistics:{owned:false,entries:0,resourceLimitFallback:{reason:'label-cap'}}}}});
  const recovered=await page.evaluate(value=>window.__STATEFALL_TEST__.exerciseNavalLogistics({transports:[],merchants:value.merchants,boarding:value.boarding}),state);
  expect(recovered.rendering.layers.navalLogistics).toMatchObject({owned:true,labelCount:0,resourceLimitFallback:{reason:null}}); expect(await page.evaluate(()=>window.__STATEFALL_TEST__.canonicalCheckpoint())).toEqual(checkpoint);
});

test('invalid paint and every pooled fail-after-mutation path fall back in-frame without dirty idle state or recovery ghosts',async({page},testInfo)=>{
  test.skip(testInfo.project.name!=='chromium-desktop','transactional E5 paint recovery runs in primary Chromium'); await start(page);
  const fixture=await page.evaluate(fixtureInPage);
  const invalid=await page.evaluate(value=>window.__STATEFALL_TEST__.exerciseNavalLogistics({...value,transports:[{...value.transports[0],color:'not-a-pixi-color('}],merchants:[],boarding:[]}),fixture);
  expect(invalid).toMatchObject({owned:false,fallbackPainted:true,rendering:{layers:{structures:{owned:true},navalLogistics:{owned:false,entries:0,resourceLimitFallback:{reason:'graphics-resource'}}}}});
  for(const failure of [
    {kind:'naval-graphics-after-append',reason:'graphics-resource',destroyed:'graphicsDestroyed'},
    {kind:'naval-label-after-paint',reason:'label-resource',destroyed:'labelDestroyed'},
    {kind:'naval-container-after-append',reason:'container-resource',destroyed:'graphicsDestroyed'}
  ]){
    const state=fixture;
    await page.evaluate(value=>{ window.__STATEFALL_TEST__.exerciseNavalLogistics(value); window.__STATEFALL_TEST__.exerciseNavalLogistics({transports:[],merchants:[],boarding:[]}); },state);
    const baseline=await page.evaluate(()=>window.__STATEFALL_TEST__.rendererDiagnostics().layers.navalLogistics);
    const failed=await page.evaluate(({kind,state})=>{ window.__STATEFALL_TEST__.injectRendererFailure(kind); return window.__STATEFALL_TEST__.exerciseNavalLogistics(state); },{kind:failure.kind,state});
    expect(failed).toMatchObject({owned:false,fallbackPainted:true,rendering:{layers:{navalLogistics:{owned:false,entries:0,resourceLimitFallback:{reason:failure.reason}}}}});
    const layer=failed.rendering.layers.navalLogistics;
    expect(layer[failure.destroyed]).toBe(baseline[failure.destroyed]+1);
    expect(layer.containersLive).toBe(layer.containersIdle); expect(layer.graphicsActive).toBe(0); expect(layer.labelActive).toBe(0);
    expect(await canvasRedAt(page,400,280,15),'same-frame Canvas fallback paints the complete valid fixture').toBeGreaterThan(0);
    const recovered=await page.evaluate(value=>window.__STATEFALL_TEST__.exerciseNavalLogistics(value),state);
    expect(recovered.rendering.layers.navalLogistics).toMatchObject({owned:true,resourceLimitFallback:{reason:null}});
    expect(recovered.rendering.layers.navalLogistics.resources.every(value=>value.childCount===value.children.length)).toBe(true);
    expect(await canvasRedAt(page,400,280,15),'Canvas fallback geometry must be cleared on Pixi recovery').toBe(0);
  }
});

test('WeakMap source identity survives reorder, removal, and compaction without index cross-wiring',async({page},testInfo)=>{
  test.skip(testInfo.project.name!=='chromium-desktop','identity evidence runs in primary Chromium'); await start(page);
  const result=await page.evaluate(()=>window.__STATEFALL_TEST__.navalIdentityChurn());
  const keys=value=>new Set(value.map(item=>item.key)); expect(keys(result.reordered)).toEqual(keys(result.first)); expect(keys(result.compacted)).toEqual(keys(result.first));
  expect(result.first.map(value=>value.order)).toEqual([0,1]); expect(result.reordered.map(value=>value.order)).toEqual([0,1]); expect(result.rendering.layers.navalLogistics.resourceLimitFallback.reason).toBeNull();
});

test('reset withdraws naval ownership when structures are unowned and a normal render restores it',async({page},testInfo)=>{
  test.skip(testInfo.project.name!=='chromium-desktop','lifecycle evidence runs in primary Chromium'); await start(page);
  const state=await page.evaluate(fixtureInPage); await page.evaluate(value=>{ window.__STATEFALL_TEST__.exerciseNavalLogistics(value); window.__STATEFALL_TEST__.exerciseNavalLogistics({transports:[],merchants:[],boarding:[]}); },state);
  const reset=await page.evaluate(()=>window.__STATEFALL_TEST__.resetRendererResources().layers.navalLogistics);
  expect(reset).toMatchObject({owned:false,entries:0,containersLive:0,containersIdle:0,graphicsActive:0,graphicsIdle:0,labelActive:0,labelIdle:0,labelTextureCount:0,labelSourceBytes:0});
  const failed=await page.evaluate(value=>window.__STATEFALL_TEST__.exerciseNavalLogistics(value),state); expect(failed.rendering.layers.navalLogistics).toMatchObject({owned:false,resourceLimitFallback:{reason:'structures-unowned'}});
  await page.evaluate(()=>window.__STATEFALL_TEST__.restoreRendererResources()); const restored=await page.evaluate(value=>window.__STATEFALL_TEST__.exerciseNavalLogistics(value),state); expect(restored.rendering.layers.structures.owned).toBe(true); expect(restored.rendering.layers.navalLogistics).toMatchObject({owned:true,resourceLimitFallback:{reason:null}}); expect(restored.rendering.layers.navalLogistics.resources.map(value=>value.childCount)).toEqual([4,5,2,1]);
});

for(const failure of [{kind:'naval-container',reason:'container-resource',created:'containersCreated'},{kind:'naval-graphics',reason:'graphics-resource',created:'graphicsCreated'},{kind:'naval-label',reason:'label-resource',created:'labelCreated'}]) test(`naval ${failure.reason} constructor failure leaves no phantom slot and recovers`,async({page},testInfo)=>{
  test.skip(testInfo.project.name!=='chromium-desktop','naval constructor rollback runs in primary Chromium'); await start(page);
  const fixture=await page.evaluate(fixtureInPage); await page.evaluate(()=>{ window.__STATEFALL_TEST__.resetRendererResources(); window.__STATEFALL_TEST__.exerciseStructureLayer([],{preStructures:[]}); });
  const baseline=await page.evaluate(()=>window.__STATEFALL_TEST__.rendererDiagnostics().layers.navalLogistics),state=failure.kind==='naval-label'?{transports:[fixture.transports[0]],merchants:[],boarding:[]}:{transports:[],merchants:[],boarding:[fixture.boarding[0]]};
  const failed=await page.evaluate(({kind,state})=>{ window.__STATEFALL_TEST__.injectRendererFailure(kind); return window.__STATEFALL_TEST__.exerciseNavalLogistics(state); },{kind:failure.kind,state});
  expect(failed.rendering.layers.navalLogistics).toMatchObject({owned:false,entries:0,resourceLimitFallback:{reason:failure.reason}}); expect(failed.rendering.layers.navalLogistics[failure.created]).toBe(baseline[failure.created]);
  const recovered=await page.evaluate(value=>window.__STATEFALL_TEST__.exerciseNavalLogistics(value),state); expect(recovered.rendering.layers.navalLogistics).toMatchObject({owned:true,resourceLimitFallback:{reason:null}}); expect(recovered.rendering.layers.navalLogistics[failure.created]).toBe(baseline[failure.created]+1);
});

test('naval fixture remains CSS-pixel aligned at DPR 1, 1.5, and 2',async({page},testInfo)=>{
  test.skip(!testInfo.project.name.startsWith('chromium-desktop-scale-'),'DPR evidence runs in desktop-scale projects'); await start(page);
  const state=await page.evaluate(fixtureInPage),result=await page.evaluate(value=>window.__STATEFALL_TEST__.exerciseNavalLogistics(value),state); test.skip(!result.owned,'Pixi WebGL renderer unavailable');
  const image=await pixels(page.locator('.pixi-world')),dpr=await page.evaluate(()=>window.devicePixelRatio);
  expect(matches(image,Math.round(400*dpr),Math.round(280*dpr),Math.ceil(18*dpr),(r,g,b,a)=>r>180&&g<130&&a>0)).toBeGreaterThan(0);
  expect(matches(image,Math.round(350*dpr),Math.round(280*dpr),Math.ceil(2*dpr),(r,g,b,a)=>r>170&&g<130&&a>0),'route center remains painted at each DPR').toBeGreaterThan(0);
  expect(matches(image,Math.round(404*dpr),Math.round(276.5*dpr),Math.ceil(2*dpr),(r,g,b,a)=>r>180&&g>180&&b>180&&a>0),'rounded transport hull corner remains painted at each DPR').toBeGreaterThan(0);
  expect(result.rendering.layers.navalLogistics).toMatchObject({counts:{transports:{visible:2},merchants:{visible:1},boarding:{visible:1}},labelCount:2});
});

test('naval active and idle resources release across BFCache recreation and context loss',async({page},testInfo)=>{
  test.skip(testInfo.project.name!=='chromium-desktop','E5 lifecycle teardown evidence runs in primary Chromium'); await start(page);
  const state=await page.evaluate(fixtureInPage),before=await page.evaluate(value=>window.__STATEFALL_TEST__.exerciseNavalLogistics(value),state); test.skip(!before.owned,'Pixi WebGL renderer unavailable');
  await page.evaluate(()=>window.__STATEFALL_TEST__.exerciseNavalLogistics({transports:[],merchants:[],boarding:[]}));
  const idle=await page.evaluate(()=>window.__STATEFALL_TEST__.rendererDiagnostics().layers.navalLogistics); expect(idle).toMatchObject({owned:true,entries:0,graphicsActive:0,labelActive:0}); expect(idle.containersIdle+idle.graphicsIdle+idle.labelIdle).toBeGreaterThan(0);
  await page.evaluate(()=>window.dispatchEvent(new PageTransitionEvent('pagehide',{persisted:true}))); await page.locator('.pixi-world').evaluate(element=>element.remove()); await page.evaluate(()=>window.dispatchEvent(new PageTransitionEvent('pageshow',{persisted:true})));
  await expect.poll(()=>page.evaluate(()=>window.__STATEFALL_TEST__.renderingLifecycle().suspended)).toBe(false);
  await page.evaluate(()=>window.__STATEFALL_TEST__.restoreRendererResources());
  const recovered=await page.evaluate(value=>window.__STATEFALL_TEST__.exerciseNavalLogistics(value),state); expect(recovered.rendering.layers.navalLogistics).toMatchObject({owned:true,entries:4,resourceLimitFallback:{reason:null}}); expect(recovered.rendering.layers.navalLogistics.resources.map(value=>value.childCount)).toEqual([4,5,2,1]);
  const extension=await page.locator('.pixi-world').evaluate(canvas=>{ const gl=canvas.getContext('webgl2')||canvas.getContext('webgl'); return !!gl?.getExtension('WEBGL_lose_context'); }); test.skip(!extension,'WEBGL_lose_context unavailable');
  await page.locator('.pixi-world').evaluate(canvas=>{ const gl=canvas.getContext('webgl2')||canvas.getContext('webgl'); gl.getExtension('WEBGL_lose_context').loseContext(); }); await expect.poll(()=>page.evaluate(()=>window.__STATEFALL_TEST__.rendererDiagnostics().active)).toBe('canvas');
  const fallback=await page.evaluate(()=>window.__STATEFALL_TEST__.rendererDiagnostics()); expect(fallback.fallbackCleanup.layers.navalLogistics).toMatchObject({owned:false,entries:0,containersLive:0,containersIdle:0,graphicsActive:0,graphicsIdle:0,labelActive:0,labelIdle:0,labelTextureCount:0,labelSourceBytes:0});
});

test('1800-frame naval create/remove/reorder/state/visibility churn plateaus within frame budgets',async({page},testInfo)=>{
  test.skip(testInfo.project.name!=='chromium-desktop','long E5 soak runs in primary Chromium'); test.setTimeout(120_000); await start(page);
  const result=await page.evaluate(()=>window.__STATEFALL_TEST__.renderNavalChurnFrames(1800));
  console.log(`pixi E5 timing split: update ${JSON.stringify(result.updateTiming)}, render ${JSON.stringify(result.renderTiming)}`);
  expect(result.measurement).toContain('local synchronous CPU/render-submission'); expect(result.measurement).toContain('excludes GPU');
  expect(result.p95).toBeLessThanOrEqual(16.7); expect(result.p99).toBeLessThanOrEqual(33);
  expect(new Set(result.resources.map(value=>value.visibility))).toEqual(new Set(['visible','offscreen']));
  for(const key of ['containersCreated','graphicsCreated','labelCreated','labelTextures']) expect(new Set(result.resources.slice(-6).map(value=>value[key])).size,`${key} must plateau after warm-up`).toBe(1);
  expect(result.resources.every(value=>value.hullTextureRefs===0)).toBe(true); expect(result.heapAssertion).toContain('advisory-only'); expect(result.gpuAssertion).toContain('unknown');
  const layer=result.rendering.layers.navalLogistics; expect(layer.containersLive).toBeLessThanOrEqual(layer.containerMaximum); expect(layer.graphicsActive+layer.graphicsIdle).toBeLessThanOrEqual(layer.graphicsMaximum); expect(layer.labelActive+layer.labelIdle).toBeLessThanOrEqual(layer.labelMaximum);
  console.log(`pixi E5 naval churn (${result.measurement}): mean ${result.mean.toFixed(3)} ms, p95 ${result.p95.toFixed(3)} ms, p99 ${result.p99.toFixed(3)} ms, max ${result.max.toFixed(3)} ms; ${JSON.stringify(result.resources)}; heap ${result.heapAssertion}; GPU ${result.gpuAssertion}`);
});
