const {test,expect}=require('@playwright/test');
const {createCanvas}=require('canvas');

test('synthetic Canvas atlas creates real Pixi subtextures at DPR 1, 1.5, and 2 and tears down',async({page},testInfo)=>{
  test.skip(!['chromium-desktop-scale-1','chromium-desktop-scale-1.5','chromium-desktop-scale-2'].includes(testInfo.project.name),'atlas pixel evidence runs in DPR projects');
  await page.goto('/index.html',{waitUntil:'load'});
  const result=await page.evaluate(async()=>{ const module=await import('/src/rendering/pixi-atlas-registry.mjs'); return module.syntheticAtlasEvidence(devicePixelRatio); });
  expect(result.dpr).toBe(testInfo.project.use.deviceScaleFactor); expect(result.resolution).toBe(testInfo.project.use.deviceScaleFactor);
  expect(result.counts.red).toBeGreaterThan(20*result.dpr); expect(result.counts.blue).toBeGreaterThan(4*result.dpr);
  expect(result.beforeRelease).toMatchObject({liveAtlases:1,liveFrames:2,references:2,sourceBytes:128,categories:{manifests:1,atlasTextures:1,subtextures:2,generatedTextures:0,labelTextures:0}});
  expect(result.afterReset).toMatchObject({liveAtlases:0,liveFrames:0,references:0,sourceBytes:0,destroyed:1}); expect(result.failures).toEqual([]);
});

test('atlas loading failures are categorized, atomic, and choose Canvas fallback',async({page},testInfo)=>{
  test.skip(testInfo.project.name!=='chromium-desktop','focused loader failure matrix runs once');
  const png=size=>{ const canvas=createCanvas(size,size); canvas.getContext('2d').fillRect(0,0,size,size); return canvas.toBuffer('image/png'); },valid=png(4),wrongDimensions=png(2);
  await page.route('**/atlas-valid.png',route=>route.fulfill({status:200,contentType:'image/png',body:valid}));
  await page.route('**/atlas-dimensions.png',route=>route.fulfill({status:200,contentType:'image/png',body:wrongDimensions}));
  await page.route('**/atlas-missing.png',route=>route.abort('failed'));
  await page.route('**/atlas-wrong.png',route=>route.fulfill({status:200,contentType:'text/plain',body:'not an image'}));
  await page.route('**/atlas-bad.png',route=>route.fulfill({status:200,contentType:'image/png',body:'not a png'}));
  await page.goto('/index.html',{waitUntil:'load'});
  const result=await page.evaluate(async({validBytes,wrongDimensionBytes})=>{
    const {createPixiAtlasRegistry}=await import('/src/rendering/pixi-atlas-registry.mjs'),fallback=[],registry=createPixiAtlasRegistry({onFallback:value=>fallback.push(value)});
    const make=(id,asset,bytes)=>({schema:'statefall-atlas/v1',version:1,id,source:{asset,mime:'image/png',width:4,height:4,bytes},frames:[{key:'one',x:0,y:0,width:4,height:4,scale:1,anchor:{x:.5,y:.5}}]});
    const valid=await registry.load(make('valid','atlas-valid.png',validBytes)),lease=registry.acquire(valid,'one'); lease.release();
    await registry.load(make('dimensions','atlas-dimensions.png',wrongDimensionBytes));
    await registry.load(make('missing','atlas-missing.png',1)); await registry.load(make('mime','atlas-wrong.png',12)); await registry.load(make('decode','atlas-bad.png',9));
    const beforeDestroy=registry.diagnostics(); registry.destroy(); return {fallback,beforeDestroy,afterDestroy:registry.diagnostics()};
  },{validBytes:valid.length,wrongDimensionBytes:wrongDimensions.length});
  expect(result.fallback.map(value=>value.category)).toEqual(['source-dimensions','source-fetch','source-mime','source-decode']);
  expect(result.beforeDestroy).toMatchObject({loads:1,liveAtlases:1,liveFrames:1,references:0,sourceBytes:valid.length,fallbacks:4}); expect(result.afterDestroy).toMatchObject({liveAtlases:0,sourceBytes:0,destroyed:1});
});

test('atlas references prevent eviction and released atlases evict in LRU order',async({page},testInfo)=>{
  test.skip(testInfo.project.name!=='chromium-desktop','focused registry lifecycle runs once'); await page.goto('/index.html',{waitUntil:'load'});
  const result=await page.evaluate(async()=>{
    const {createPixiAtlasRegistry}=await import('/src/rendering/pixi-atlas-registry.mjs'),fallback=[],limits={atlases:1,frames:2,width:8,height:8,sourceBytes:256,totalSourceBytes:128},registry=createPixiAtlasRegistry({limits,onFallback:value=>fallback.push(value)}),source=()=>{ const canvas=document.createElement('canvas'); canvas.width=4; canvas.height=4; canvas.getContext('2d').fillRect(0,0,4,4); return {resource:canvas,width:4,height:4,mime:'image/png',bytes:64,destroy(){ canvas.width=0; canvas.height=0; }}; },manifest=id=>({schema:'statefall-atlas/v1',version:1,id,source:{asset:`assets/${id}.png`,mime:'image/png',width:4,height:4,bytes:64},frames:[{key:'one',x:0,y:0,width:4,height:4,scale:1,anchor:{x:.5,y:.5}}]});
    await registry.load(manifest('first'),{source:source()}); const lease=registry.acquire('first','one'); const blocked=await registry.load(manifest('blocked'),{source:source()}); const blockedState=registry.diagnostics(); lease.release(); const second=await registry.load(manifest('second'),{source:source()}),evictedState=registry.diagnostics(); registry.destroy(); return {blocked,second,blockedState,evictedState,final:registry.diagnostics(),fallback};
  });
  expect(result.blocked).toBeNull(); expect(result.blockedState).toMatchObject({liveAtlases:1,references:1,fallbacks:1,lastFailure:{category:'texture-cap'}}); expect(result.second).toBe('second'); expect(result.evictedState).toMatchObject({liveAtlases:1,references:0,evictions:1,destroyed:1}); expect(result.final).toMatchObject({liveAtlases:0,sourceBytes:0,destroyed:2});
});

test('concurrent atlas commits recheck duplicate, atlas, byte, and aggregate frame caps in completion order',async({page},testInfo)=>{
  test.skip(testInfo.project.name!=='chromium-desktop','focused registry concurrency runs once'); await page.goto('/index.html',{waitUntil:'load'});
  const result=await page.evaluate(async()=>{
    const {createPixiAtlasRegistry}=await import('/src/rendering/pixi-atlas-registry.mjs');
    const makeManifest=(id,bytes=64,frameCount=1)=>({schema:'statefall-atlas/v1',version:1,id,source:{asset:`assets/${id}.png`,mime:'image/png',width:8,height:4,bytes},frames:Array.from({length:frameCount},(_,index)=>({key:`f${index}`,x:index*4,y:0,width:4,height:4,scale:index+1.5,anchor:{x:index*.25,y:1-index*.25}}))});
    const run=async({limits,loads})=>{
      const pending=new Map(),destroyed=[],fallback=[];
      const registry=createPixiAtlasRegistry({limits,onFallback:value=>fallback.push(value),loadSource:source=>new Promise(resolve=>pending.set(source.asset,()=>{ const canvas=document.createElement('canvas'); canvas.width=8; canvas.height=4; resolve({resource:canvas,width:8,height:4,mime:'image/png',bytes:source.bytes,destroy(){ destroyed.push(source.asset); canvas.width=0; }}); }))});
      const promises=loads.map(value=>registry.load(makeManifest(...value)));
      await Promise.resolve();
      return {registry,pending,promises,destroyed,fallback};
    };
    const common={atlases:1,frames:4,width:8,height:8,sourceBytes:256,totalSourceBytes:128};
    const samePending=[],sameFallback=[],sameDestroyed=[],sameRegistry=createPixiAtlasRegistry({limits:common,onFallback:value=>sameFallback.push(value),loadSource:source=>new Promise(resolve=>samePending.push(()=>{ const canvas=document.createElement('canvas'); canvas.width=8; canvas.height=4; resolve({resource:canvas,width:8,height:4,mime:'image/png',bytes:source.bytes,destroy(){ sameDestroyed.push(source.asset); }}); }))});
    const sameLoads=[sameRegistry.load(makeManifest('dupe')),sameRegistry.load(makeManifest('dupe'))]; await Promise.resolve(); samePending[1](); samePending[0](); const sameIds=await Promise.all(sameLoads),sameLease=sameRegistry.acquire('dupe','f0'),sameMetadata=sameLease&&{scale:sameLease.scale,anchor:sameLease.anchor}; sameLease?.release();
    const cap=await run({limits:common,loads:[['a',64,1],['b',64,1]]}); cap.pending.get('assets/b.png')(); const capB=await cap.promises[1],capLease=cap.registry.acquire('b','f0'); cap.pending.get('assets/a.png')(); const capIds=[await cap.promises[0],capB]; capLease.release();
    const bytes=await run({limits:{...common,atlases:3,totalSourceBytes:100},loads:[['a',60,1],['b',60,1]]}); bytes.pending.get('assets/a.png')(); const byteA=await bytes.promises[0],byteLease=bytes.registry.acquire('a','f0'); bytes.pending.get('assets/b.png')(); const byteIds=[byteA,await bytes.promises[1]]; byteLease.release();
    const frames=await run({limits:{...common,atlases:3,frames:3,totalSourceBytes:256},loads:[['a',64,2],['b',64,2]]}); frames.pending.get('assets/b.png')(); const frameB=await frames.promises[1],frameLease=frames.registry.acquire('b','f0'); frames.pending.get('assets/a.png')(); const frameIds=[await frames.promises[0],frameB]; frameLease.release();
    const values={sameIds,sameMetadata,same:sameRegistry.diagnostics(),sameFallback:[...sameFallback],sameDestroyed:[...sameDestroyed],capIds,cap:cap.registry.diagnostics(),capFallback:[...cap.fallback],capDestroyed:[...cap.destroyed],byteIds,bytes:bytes.registry.diagnostics(),byteFallback:[...bytes.fallback],frameIds,frames:frames.registry.diagnostics(),frameFallback:[...frames.fallback]};
    sameRegistry.destroy(); cap.registry.destroy(); bytes.registry.destroy(); frames.registry.destroy(); return values;
  });
  expect(result.sameIds.filter(Boolean)).toEqual(['dupe']); expect(result.sameMetadata).toEqual({scale:1.5,anchor:{x:0,y:1}}); expect(result.same).toMatchObject({loads:1,liveAtlases:1,liveFrames:1,fallbacks:1,lastFailure:{category:'duplicate-atlas-id'}}); expect(result.sameDestroyed).toHaveLength(1);
  expect(result.capIds.filter(Boolean)).toEqual(['b']); expect(result.cap).toMatchObject({loads:1,liveAtlases:1,sourceBytes:64,fallbacks:1,lastFailure:{category:'texture-cap'}}); expect(result.capDestroyed).toEqual(['assets/a.png']);
  expect(result.byteIds.filter(Boolean)).toEqual(['a']); expect(result.bytes).toMatchObject({liveAtlases:1,sourceBytes:60,fallbacks:1,lastFailure:{category:'source-byte-cap'}});
  expect(result.frameIds.filter(Boolean)).toEqual(['b']); expect(result.frames).toMatchObject({liveAtlases:1,liveFrames:2,fallbacks:1,lastFailure:{category:'frame-cap'}});
});

test('failed staged replacement and destroy-during-load preserve publication atomically',async({page},testInfo)=>{
  test.skip(testInfo.project.name!=='chromium-desktop','focused registry staging failures run once'); await page.goto('/index.html',{waitUntil:'load'});
  const result=await page.evaluate(async()=>{
    const {createPixiAtlasRegistry}=await import('/src/rendering/pixi-atlas-registry.mjs');
    const manifest=id=>({schema:'statefall-atlas/v1',version:1,id,source:{asset:`assets/${id}.png`,mime:'image/png',width:4,height:4,bytes:64},frames:[{key:'one',x:0,y:0,width:4,height:4,scale:2,anchor:{x:.25,y:.75}}]}),source=(id,destroyed)=>{ const canvas=document.createElement('canvas'); canvas.width=4; canvas.height=4; return {resource:canvas,width:4,height:4,mime:'image/png',bytes:64,destroy(){ destroyed.push(id); canvas.width=0; }}; };
    const destroyed=[],fallback=[],registry=createPixiAtlasRegistry({limits:{atlases:1,frames:2,width:8,height:8,sourceBytes:128,totalSourceBytes:128},onFallback:value=>fallback.push(value)}); await registry.load(manifest('a'),{source:source('a',destroyed)}); const lease=registry.acquire('a','one');
    const rejected=await registry.load(manifest('b'),{source:source('b',destroyed)}),afterReject=registry.diagnostics(),metadata={scale:lease.scale,anchor:lease.anchor}; lease.release();
    let textureCalls=0; const constructorFallback=[],constructorDestroyed=[],constructorRegistry=createPixiAtlasRegistry({limits:{atlases:1,frames:2,width:8,height:8,sourceBytes:128,totalSourceBytes:128},onFallback:value=>constructorFallback.push(value),beforeTextureCreate:()=>{ textureCalls++; if(textureCalls===4) throw new Error('injected texture failure'); }}); await constructorRegistry.load(manifest('a'),{source:source('constructor-a',constructorDestroyed)}); const constructorRejected=await constructorRegistry.load(manifest('b'),{source:source('constructor-b',constructorDestroyed)}),constructorState=constructorRegistry.diagnostics(),constructorLease=constructorRegistry.acquire('a','one'); constructorLease?.release();
    let resolvePending; const pendingDestroyed=[],pendingFallback=[],pendingRegistry=createPixiAtlasRegistry({onFallback:value=>pendingFallback.push(value),loadSource:()=>new Promise(resolve=>{ resolvePending=resolve; })}),pending=pendingRegistry.load(manifest('pending')); await Promise.resolve(); pendingRegistry.destroy(); resolvePending(source('pending',pendingDestroyed)); const pendingResult=await pending;
    const values={rejected,afterReject,metadata,destroyed:[...destroyed],fallback:[...fallback],constructorRejected,constructorState,constructorAcquired:!!constructorLease,constructorDestroyed:[...constructorDestroyed],constructorFallback:[...constructorFallback],pendingResult,pendingState:pendingRegistry.diagnostics(),pendingDestroyed:[...pendingDestroyed],pendingFallback:[...pendingFallback]}; registry.destroy(); constructorRegistry.destroy(); return values;
  });
  expect(result.rejected).toBeNull(); expect(result.afterReject).toMatchObject({liveAtlases:1,liveFrames:1,references:1,evictions:0,fallbacks:1,lastFailure:{category:'texture-cap'}}); expect(result.metadata).toEqual({scale:2,anchor:{x:.25,y:.75}}); expect(result.destroyed).toEqual(['b']);
  expect(result.constructorRejected).toBeNull(); expect(result.constructorAcquired).toBe(true); expect(result.constructorState).toMatchObject({loads:1,liveAtlases:1,evictions:0,fallbacks:1,lastFailure:{category:'texture-create'}}); expect(result.constructorDestroyed).toContain('constructor-b');
  expect(result.pendingResult).toBeNull(); expect(result.pendingState).toMatchObject({loads:0,liveAtlases:0,fallbacks:1,lastFailure:{category:'registry-destroyed'}}); expect(result.pendingDestroyed).toEqual(['pending']);
});
