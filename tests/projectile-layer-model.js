'use strict';

const assert=require('node:assert/strict');

(async()=>{
  const {advanceVisualShots,createProjectileModel}=await import('../game/src/rendering/projectile-layer-model.mjs');
  const model=createProjectileModel(),camera={x:10,y:20,scale:2},viewport={width:500,height:300},trail=[[20,30,0],[21,30,3],[22,31,5]],shells=[
    {x:24,y:30,torpedo:true,trail:[[20,30],[22,30],[23,30]]},
    {x:34,y:30,kind:'aam',trail:[[30,30],[32,30]]},
    {x:44,y:30,tx:50,ty:30,arc:true,missile:true,rise:17,delay:2,trail},
    {x:54,y:30,tx:60,ty:30,arc:true,trail:[[50,30,0],[52,30,4]]},
    {x:64,y:30,kind:'gun',trail:[[60,30],[62,30]]}
  ],shotSource={x0:70,y0:20,x1:90,y1:20,col:'#f00',age:0},aged=advanceVisualShots([shotSource]),input={camera,viewport,inheritedStrokeState:{lineJoin:'miter',lineCap:'butt'},shells,visualShots:aged.descriptors};
  const before=JSON.stringify(input),scene=model.build(input);
  assert.equal(JSON.stringify(input),before,'projectile model is pure');
  assert.deepEqual(scene.entries.map(value=>value.variant),['torpedo','aam','barrage','artillery','ordinary','visual-shot']);
  assert.deepEqual(scene.entries.map(value=>value.items.map(item=>item.semantic)),[
    ['torpedo-foam-trail','torpedo-foam-points','torpedo-body'],['aam-trail','aam-body'],['barrage-trail','barrage-rocket'],['artillery-shell','artillery-ground-tether'],['gun-shell-trail','gun-shell-body'],['visual-gun-line']
  ]);
  assert.deepEqual(scene.strokeTimeline.map(value=>[value.variant,value.incomingLineCap,value.outgoingLineCap]),[['torpedo','butt','round'],['aam','round','round'],['barrage','round','round'],['artillery','round','round'],['ordinary','round','round']]);
  assert.deepEqual(scene.canvasStrokeState,{lineJoin:'miter',lineCap:'round',globalAlpha:1,lineDash:[],lineDashOffset:0});
  const torpedo=scene.entries[0],aam=scene.entries[1],barrage=scene.entries[2],artillery=scene.entries[3],ordinary=scene.entries[4],shot=scene.entries[5];
  assert.equal(torpedo.items[0].primitives[0].cap,'round'); assert.equal(torpedo.items[0].primitives[0].stroke,'rgba(225,240,255,0.26333333333333336)');
  assert.equal(aam.items[0].primitives[0].width,2); assert.equal(aam.items[1].primitives[1].fill,'#c88e54');
  assert.equal(barrage.arc.rise,17); assert.equal(barrage.arc.delay,2); assert.equal(barrage.arc.total,6); assert.ok(Math.abs(barrage.arc.height)<1e-12); assert.equal(barrage.items[0].primitives[1].y1,74,'height-bearing trail point is projected above ground');
  assert.deepEqual(artillery.items[1].primitives[0].dash,[2,4]); assert.equal(artillery.items[1].primitives[0].stroke,'rgba(217,215,199,.25)');
  assert.equal(ordinary.items[0].primitives[0].stroke,'rgba(194,166,110,0.3)'); assert.equal(ordinary.items[1].primitives[0].fill,'#d9d7c7');
  assert.equal(shot.alpha,5/6); assert.equal(shot.items[0].primitives[0].width,2);

  const fallback={x:20,y:20,tx:30,ty:20,arc:true,trail:[]},first=model.build({...input,shells:[fallback],visualShots:[]}),total=first.entries[0].arc.total; fallback.x=25; const second=model.build({...input,shells:[fallback],visualShots:[]}); assert.equal(total,10); assert.equal(second.entries[0].arc.total,10,'renderer fallback total follows object identity'); assert.equal(model.diagnostics().fallbackTotals,1); model.build({...input,shells:[],visualShots:[]}); assert.equal(model.diagnostics().fallbackTotals,0,'removed fallback totals clean deterministically');
  const identities=model.build({...input,shells:[shells[4],shells[0]],visualShots:[]}).entries.map(value=>value.key),reordered=model.build({...input,shells:[shells[0],shells[4]],visualShots:[]}).entries.map(value=>value.key); assert.equal(identities[0],reordered[1]); assert.equal(identities[1],reordered[0]);
  const duplicate=model.build({...input,shells:[shells[4],shells[4]],visualShots:[]}); assert.notEqual(duplicate.entries[0].key,duplicate.entries[1].key,'occurrence suffix disambiguates duplicate object references');

  const original={x0:1,y0:2,x1:3,y1:4,col:'#fff',age:4},age1=advanceVisualShots([original]); assert.equal(original.age,4); assert.equal(age1.descriptors[0].age,5); assert.ok(Math.abs(age1.descriptors[0].alpha-1/6)<1e-12); assert.equal(age1.next.length,1); const age2=advanceVisualShots(age1.next); assert.equal(age2.descriptors[0].age,6); assert.equal(age2.descriptors[0].alpha,0); assert.equal(age2.next.length,0); assert.equal(age1.next[0].age,5,'later updates do not mutate prior descriptors');

  const crossing={x:-100,y:50,kind:'gun',trail:[[-100,50],[100,50]]},crossingScene=model.build({camera:{x:0,y:0,scale:1},viewport:{width:80,height:80},inheritedStrokeState:{lineJoin:'miter',lineCap:'butt'},shells:[crossing],visualShots:[{source:{},x0:-50,y0:30,x1:100,y1:30,col:'#fff',age:1,alpha:.8}]}); assert.deepEqual(crossingScene.entries.map(value=>value.items[0].semantic),['gun-shell-trail','visual-gun-line'],'crossing lines survive offscreen centers');
  const hiddenTorpedo=model.build({...input,shells:[{...shells[0],visible:false}],visualShots:[]}); assert.equal(hiddenTorpedo.canvasStrokeState.lineCap,'butt');

  const exact=model.build(input); assert.throws(()=>model.build(input,{entries:5}),/entry-cap/); assert.equal(model.build(input,{entries:6}).entries.length,6); assert.throws(()=>model.build(input,{trailPoints:exact.trailPointCount-1}),/trail-cap/); assert.equal(model.build(input,{trailPoints:exact.trailPointCount}).trailPointCount,exact.trailPointCount); assert.throws(()=>model.build(input,{primitives:exact.primitiveCount-1}),/primitive-cap/); assert.equal(model.build(input,{primitives:exact.primitiveCount}).primitiveCount,exact.primitiveCount); assert.throws(()=>model.build(input,{segments:exact.segmentCount-1}),/segment-cap/); assert.equal(model.build(input,{segments:exact.segmentCount}).segmentCount,exact.segmentCount);
  console.log('Projectile layer model contracts PASS');
})().catch(error=>{ console.error(error); process.exitCode=1; });
