const {test,expect}=require('@playwright/test');
const fs=require('node:fs');
const path=require('node:path');
const {pathToFileURL}=require('node:url');

test.describe.configure({mode:'serial'});
const REVIEW=process.env.STATEFALL_PHASE_G_REVIEW==='1',REVIEW_DIR=path.resolve(__dirname,'../../.artifacts/phase-g-radar-sam-review');
async function reviewShot(locator,name){ if(!REVIEW) return; fs.mkdirSync(REVIEW_DIR,{recursive:true}); await locator.screenshot({path:path.join(REVIEW_DIR,name)}); }
async function reviewCenterShot(page,name){ if(!REVIEW) return; fs.mkdirSync(REVIEW_DIR,{recursive:true}); const viewport=page.viewportSize(); await page.screenshot({path:path.join(REVIEW_DIR,name),clip:{x:viewport.width/2-48,y:viewport.height/2-48,width:96,height:96}}); }
function reviewDataUrl(dataUrl,name){ if(!REVIEW) return; fs.mkdirSync(REVIEW_DIR,{recursive:true}); fs.writeFileSync(path.join(REVIEW_DIR,name),Buffer.from(dataUrl.split(',')[1],'base64')); }

async function start(page,renderer='pixi',query=''){
  await page.addInitScript(()=>{ window.__STATEFALL_TEST_MODE__=true; localStorage.setItem('statefall-audio',JSON.stringify({master:0,sfx:0,alert:0,amb:0,music:0})); });
  await page.goto(`/index.html?browserTest=1&renderer=${renderer}${query}`,{waitUntil:'load'});
  await expect.poll(()=>page.evaluate(()=>typeof window.__STATEFALL_TEST__)).toBe('object');
  await page.evaluate(()=>window.__STATEFALL_TEST__.prepareControlledStart());
  await page.locator('#maps button[data-m="random"]').click(); await page.locator('#seedIn').fill('PHASEGRADARSAM'); await page.locator('#countrySel').selectOption('0'); await page.locator('#startBtn').click();
  await expect.poll(()=>page.evaluate(()=>window.__STATEFALL_TEST__.status().ready)).toBe(true);
  await page.evaluate(()=>{ const api=window.__STATEFALL_TEST__; api.pause(); api.installLateGameScene(); api.freezePresentation(); api.setCamera(4,'player'); });
  await page.evaluate(()=>window.__STATEFALL_TEST__.terrainRasterSettled());
}

test('Phase G radar and SAM dishes use bounded Pixi overlays with deterministic state-safe motion',async({page},testInfo)=>{
  test.skip(!['chromium-desktop','chromium-reduced-motion'].includes(testInfo.project.name),'focused Phase G motion contract');
  await start(page);
  const reduced=testInfo.project.name==='chromium-reduced-motion';
  const first=await page.evaluate(()=>{ const api=window.__STATEFALL_TEST__,source=api.structurePresentation()[0],tx=source.tile%720,ty=(source.tile-tx)/720; api.setCameraOrigin(innerWidth/2-(tx+.5)*4,innerHeight/2-(ty+.5)*4,4); const items=[{...source,type:'radar'},{...source,tile:source.tile+40,type:'lradar',color:'#efe4cf'},{...source,tile:source.tile+80,type:'sam',color:'#204568',suppressed:true,cooldown:true,cooldownFraction:.5}]; return {items,result:api.exerciseStructureLayer(items,{preStructures:items,preState:{time:600}})}; });
  test.skip(first.result.rendering.active!=='pixi-hybrid','Pixi WebGL renderer unavailable');
  const initial=first.result.rendering,pre=initial.layers.preStructures;
  expect(first.result).toMatchObject({preOwned:true,owned:true});
  expect(pre.counts).toMatchObject({ambientDishes:3,movingDishes:reduced?0:2,staticDishes:reduced?3:1,budgetSkippedDishes:0});
  expect(pre.presentation.structureEntries.map(entry=>entry.order)).toEqual([['base','ambient-dish'],['base','ambient-dish'],['base','ambient-dish','suppression','cooldown']]);
  expect(initial.layers.structures.order.map(entry=>entry.children)).toEqual(pre.presentation.structureEntries.map(entry=>entry.order));
  await reviewShot(page.locator('.pixi-world'),reduced?'pixi-reduced-close.png':'pixi-normal-close-frame-a.png');
  for(const type of ['radar','lradar','sam']){ reviewDataUrl(await page.evaluate(({type,reduced})=>window.__STATEFALL_TEST__.structureArtPreview(type,'#b96558',{time:8400,reducedMotion:reduced}),{type,reduced}),`isolated-${type}-${reduced?'reduced':'normal'}.png`); if(!reduced) reviewDataUrl(await page.evaluate(type=>window.__STATEFALL_TEST__.structureArtPreview(type,'#b96558',{size:96,radius:9.6,time:8400}),type),`native-${type}.png`); }
  for(const item of first.items){ await page.evaluate(({item,reduced})=>{ const api=window.__STATEFALL_TEST__,reviewItem={...item,tile:50*720+50},tx=reviewItem.tile%720,ty=(reviewItem.tile-tx)/720; api.setCameraOrigin(innerWidth/2-(tx+.5)*4,innerHeight/2-(ty+.5)*4,4); api.exerciseStructureLayer([reviewItem],{preStructures:[reviewItem],preState:{time:600,reducedMotion:reduced}}); },{item,reduced}); await reviewCenterShot(page,`pixi-${item.type}-${reduced?'reduced':'normal'}-detail.png`); }
  await page.evaluate(item=>{ const api=window.__STATEFALL_TEST__,tx=item.tile%720,ty=(item.tile-tx)/720; api.setCameraOrigin(innerWidth/2-(tx+.5)*4,innerHeight/2-(ty+.5)*4,4); },first.items[0]);
  const textureCount=initial.layers.structures.textureCount,checkpoint=first.result.checkpoint;
  const second=await page.evaluate(items=>window.__STATEFALL_TEST__.exerciseStructureLayer(items,{preStructures:items,preState:{time:900}}),first.items);
  expect(second.checkpoint).toEqual(checkpoint);
  expect(second.rendering.layers.structures.textureCount).toBe(textureCount);
  expect(second.rendering.layers.preStructures.counts).toMatchObject({ambientDishes:3,movingDishes:reduced?0:2,staticDishes:reduced?3:1});
  if(!reduced) await reviewShot(page.locator('.pixi-world'),'pixi-normal-close-frame-b.png');
  const stable=await page.evaluate(items=>{ let result; for(let frame=0;frame<180;frame++) result=window.__STATEFALL_TEST__.exerciseStructureLayer(items,{preStructures:items,preState:{time:frame*33.34}}); return result; },first.items);
  expect(stable.checkpoint).toEqual(checkpoint); expect(stable.rendering.layers.structures.textureCount).toBe(textureCount); expect(stable.rendering.layers.structures.textureCount).toBeLessThanOrEqual(512);
  const mid=await page.evaluate(items=>{ const api=window.__STATEFALL_TEST__,tx=items[0].tile%720,ty=(items[0].tile-tx)/720; api.setCameraOrigin(innerWidth/2-(tx+.5)*1.5,innerHeight/2-(ty+.5)*1.5,1.5); return api.exerciseStructureLayer(items,{preStructures:items,preState:{time:1200}}); },first.items);
  expect(mid.rendering.layers.preStructures.counts).toMatchObject({ambientDishes:3,movingDishes:reduced?0:2,staticDishes:reduced?3:1,budgetSkippedDishes:0}); expect(mid.checkpoint).toEqual(checkpoint);
  if(!reduced) await reviewShot(page.locator('.pixi-world'),'pixi-mid-zoom.png');
  const strategic=await page.evaluate(items=>{ const api=window.__STATEFALL_TEST__,tx=items[0].tile%720,ty=(items[0].tile-tx)/720; api.setCameraOrigin(innerWidth/2-(tx+.5),innerHeight/2-(ty+.5),1); return api.exerciseStructureLayer(items,{preStructures:items,preState:{time:1200}}); },first.items);
  expect(strategic.rendering.layers.preStructures.counts).toMatchObject({ambientDishes:0,budgetSkippedDishes:3}); expect(strategic.checkpoint).toEqual(checkpoint);
  if(!reduced) await reviewShot(page.locator('.pixi-world'),'pixi-strategic-static-silhouette.png');
});

test('Phase G Canvas fallback shares moving and reduced-motion dish policy',async({page},testInfo)=>{
  test.skip(!['chromium-desktop','chromium-reduced-motion'].includes(testInfo.project.name),'focused Phase G Canvas contract');
  await start(page,'canvas');
  const reduced=testInfo.project.name==='chromium-reduced-motion';
  const first=await page.evaluate(()=>{ const api=window.__STATEFALL_TEST__,source=api.structurePresentation()[0],tx=source.tile%720,ty=(source.tile-tx)/720; api.setCameraOrigin(innerWidth/2-(tx+.5)*4,innerHeight/2-(ty+.5)*4,4); const items=[{...source,type:'radar'},{...source,tile:source.tile+40,type:'lradar',color:'#efe4cf'},{...source,tile:source.tile+80,type:'sam',color:'#204568',suppressed:true}]; return {items,result:api.exerciseStructureCompositing(items,{time:600})}; });
  expect(first.result.rendering.active).toBe('canvas');
  reviewDataUrl(first.result.canvasDataUrl,reduced?'canvas-reduced-close.png':'canvas-normal-close.png');
  const second=await page.evaluate(items=>window.__STATEFALL_TEST__.exerciseStructureCompositing(items,{time:900}),first.items);
  expect(second.checkpoint).toEqual(first.result.checkpoint);
  if(reduced) expect(second.canvasPatches).toEqual(first.result.canvasPatches); else expect(second.canvasPatches).not.toEqual(first.result.canvasPatches);
});

for(const quality of ['medium','low']) test(`Phase G ${quality}-quality Pixi keeps bounded readable dishes without texture churn`,async({page},testInfo)=>{
  test.skip(testInfo.project.name!=='chromium-desktop','focused Phase G quality contract');
  await start(page,'pixi',`&quality=${quality}`);
  const evidence=await page.evaluate(()=>{ const api=window.__STATEFALL_TEST__,source=api.structurePresentation()[0],tx=source.tile%720,ty=(source.tile-tx)/720; api.setCameraOrigin(innerWidth/2-(tx+.5)*4,innerHeight/2-(ty+.5)*4,4); const baseline=api.rendererDiagnostics().layers.structures.textureCount,items=['radar','lradar','sam'].map((type,index)=>({...source,tile:source.tile+index*40,type})); return {baseline,result:api.exerciseStructureLayer(items,{preStructures:items,preState:{time:900}})}; });
  test.skip(evidence.result.rendering.active!=='pixi-hybrid','Pixi WebGL renderer unavailable');
  expect(evidence.result.rendering.quality).toEqual({requested:quality,effective:quality});
  expect(evidence.result.rendering.layers.preStructures.counts).toMatchObject({ambientDishes:3,movingDishes:quality==='low'?0:3,staticDishes:quality==='low'?3:0,budgetSkippedDishes:0});
  expect(evidence.result.rendering.layers.structures.textureCount).toBeLessThanOrEqual(evidence.baseline+3);
  await reviewShot(page.locator('.pixi-world'),quality==='low'?'pixi-low-quality-static.png':'pixi-medium-quality.png');
});

test('Phase G evidence identifies the approved Unit Direction 02 source',async({page},testInfo)=>{
  test.skip(testInfo.project.name!=='chromium-desktop','one deterministic direction reference is sufficient');
  await page.goto(pathToFileURL(path.resolve(__dirname,'../../prototypes/high-resolution-direction/units.html')).href,{waitUntil:'load'});
  await expect.poll(()=>page.evaluate(()=>window.__UNIT_DIRECTION_READY__)).toBe(true);
  await page.evaluate(()=>window.__UNIT_DIRECTION_ANIMATION__.setFixedTime(8400));
  await reviewShot(page.locator('#unit-map'),'prototype-direction-reference.png');
});
