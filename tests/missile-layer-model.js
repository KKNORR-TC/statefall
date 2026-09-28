'use strict';

const assert=require('node:assert/strict');

(async()=>{
  const {createMissileModel,missilePosition,paintMissilesCanvas}=await import('../game/src/rendering/missile-layer-model.mjs');
  const model=createMissileModel(),normal={owner:1,owned:false,visible:true,from:1010,t:1050,age:20,flight:55,cruise:false},cruise={owner:0,owned:true,visible:false,from:1210,t:1260,age:18,flight:40,cruise:true};
  const input={camera:{x:20,y:50,scale:1},viewport:{width:500,height:300},mapWidth:100,nukeRadius:4,cruiseRadius:3,now:375,reducedMotion:true,inheritedStrokeState:{lineJoin:'miter',lineCap:'round',globalAlpha:1,lineDash:[],lineDashOffset:0},missiles:[normal,cruise]};
  const before=JSON.stringify(input),scene=model.build(input);
  assert.equal(JSON.stringify(input),before,'missile model is pure');
  assert.deepEqual(missilePosition(normal,normal.age,100),[10.5+(50.5-10.5)*20/55,10.5-Math.sin(20/55*Math.PI)*14]);
  assert.deepEqual(missilePosition(cruise,cruise.age,100),[10.5+(60.5-10.5)*18/40,12.5]);
  assert.deepEqual(scene.entries.map(value=>value.variant),['normal','cruise']);
  assert.deepEqual(scene.entries.map(value=>value.items.map(item=>item.semantic)),[['missile-trail','missile-body','missile-target-warning'],['missile-trail','missile-body','missile-target-warning']]);
  assert.equal(scene.entries[0].trailN,10); assert.deepEqual(scene.entries[0].trailSamples.map(value=>value.age),[0,2,4,6,8,10,12,14,16,18,20]);
  assert.equal(scene.entries[1].trailN,9); assert.equal(scene.entries[1].trailSamples.length,10); assert.equal(scene.trailSampleCount,21);
  assert.equal(scene.entries[0].bodyScale,1); assert.equal(scene.entries[1].bodyScale,.65); assert.equal(scene.entries[0].heading,scene.entries[0].analyticHeading); assert.equal(scene.entries[1].heading,0);
  assert.equal(scene.entries[0].warningRadius,4); assert.equal(scene.entries[1].warningRadius,3); assert.equal(scene.entries[0].warningAlpha,.35+.35*Math.sin(375/150));
  assert.equal(scene.entries[0].items[0].primitives[0].stroke,'rgba(255,200,120,0.11)'); assert.equal(scene.entries[0].items[0].primitives.at(-1).width,4);
  assert.deepEqual(scene.entries[0].items[1].primitives.map(value=>value.fill),['rgba(255,180,80,.55)','#d9d7c7','#f4f0d7','#b96558']);
  assert.deepEqual(scene.entries[0].items[2].primitives[0].dash,[6,6]); assert.equal(scene.entries[0].items[2].primitives[0].stroke,`rgba(255,107,107,${.35+.35*Math.sin(375/150)})`);
  assert.deepEqual(scene.canvasStrokeState,{lineJoin:'miter',lineCap:'round',globalAlpha:1,lineDash:[],lineDashOffset:0});

  const hidden=model.build({...input,missiles:[{...normal,visible:false,owned:false}],inheritedStrokeState:{lineJoin:'miter',lineCap:'butt',globalAlpha:.7,lineDash:[2,3],lineDashOffset:4}}); assert.equal(hidden.entries.length,0); assert.equal(hidden.counts.hidden,1); assert.deepEqual(hidden.canvasStrokeState,{lineJoin:'miter',lineCap:'butt',globalAlpha:.7,lineDash:[2,3],lineDashOffset:4});
  const culled=model.build({...input,camera:{x:10000,y:10000,scale:1},missiles:[normal],inheritedStrokeState:{lineJoin:'miter',lineCap:'butt',globalAlpha:.7,lineDash:[2,3],lineDashOffset:4}}); assert.equal(culled.entries.length,0); assert.deepEqual(culled.canvasStrokeState,{lineJoin:'miter',lineCap:'round',globalAlpha:.7,lineDash:[],lineDashOffset:4},'visible offscreen missiles still advance legacy Canvas state');
  const own=model.build({...input,missiles:[{...normal,visible:false,owned:true}]}); assert.equal(own.entries.length,1,'own missile ignores fog at its current point');
  const pulse=model.build({...input,reducedMotion:false}).entries[0].warningAlpha; assert.equal(pulse,scene.entries[0].warningAlpha,'reduced motion does not freeze the legacy warning pulse');

  const first=model.build({...input,missiles:[normal,cruise]}).entries.map(value=>value.key),reordered=model.build({...input,missiles:[cruise,normal]}).entries.map(value=>value.key); assert.equal(first[0],reordered[1]); assert.equal(first[1],reordered[0]);
  const duplicate=model.build({...input,missiles:[normal,normal]}); assert.notEqual(duplicate.entries[0].key,duplicate.entries[1].key);
  model.build({...input,missiles:[normal]}); const restored=model.build({...input,missiles:[normal,cruise]}).entries.map(value=>value.key); assert.equal(restored[0],first[0]); assert.equal(restored[1],first[1]);

  const ringCross=model.build({...input,camera:{x:-52.5,y:-8.5,scale:1},viewport:{width:4,height:4},nukeRadius:4,missiles:[{...normal,age:55}]}); assert.equal(ringCross.entries[0].items.some(value=>value.semantic==='missile-target-warning'),true,'warning radius crossing viewport survives center culling');
  const trailCross=model.build({...input,camera:{x:-20,y:0,scale:1},viewport:{width:20,height:20},missiles:[{...normal,age:55}]}); assert.equal(trailCross.entries[0].items.some(value=>value.semantic==='missile-trail'),true,'trail crossing viewport survives current-point culling');

  const exact=model.build(input); assert.throws(()=>model.build(input,{entries:1}),/entry-cap/); assert.equal(model.build(input,{entries:2}).counts.total,2); assert.throws(()=>model.build(input,{trailSamples:exact.trailSampleCount-1}),/trail-cap/); assert.equal(model.build(input,{trailSamples:exact.trailSampleCount}).trailSampleCount,exact.trailSampleCount); assert.throws(()=>model.build(input,{primitives:exact.primitiveCount-1}),/primitive-cap/); assert.equal(model.build(input,{primitives:exact.primitiveCount}).primitiveCount,exact.primitiveCount); assert.throws(()=>model.build(input,{segments:exact.segmentCount-1}),/segment-cap/); assert.equal(model.build(input,{segments:exact.segmentCount}).segmentCount,exact.segmentCount);
  const serial=model.diagnostics().identitySerial; assert.throws(()=>model.build(input,{primitives:0}),/primitive-cap/); assert.equal(model.diagnostics().identitySerial,serial,'rejected builds do not consume source identities');
  const operations=[],context=new Proxy({globalAlpha:1,lineJoin:'miter',lineCap:'butt',lineWidth:1,lineDashOffset:0,setLineDash(value){ this.dash=value.slice(); },save(){},restore(){},beginPath(){},moveTo(){},lineTo(){},closePath(){},stroke(){ operations.push('stroke'); },fill(){ operations.push('fill'); },translate(){},rotate(){},scale(){},arc(){}},{set(target,key,value){ target[key]=value; return true; }}),uncapped={...input,missiles:Array.from({length:8193},(_,index)=>index===8192?normal:{...normal,visible:false,owned:false})};
  const uncappedBefore=JSON.stringify(uncapped); assert.deepEqual(paintMissilesCanvas(context,uncapped),['missile-trail','missile-body','missile-target-warning']); assert.ok(operations.length>0,'uncapped Canvas paints the valid missile beyond the Pixi entry cap'); assert.equal(JSON.stringify(uncapped),uncappedBefore,'uncapped Canvas painter is pure');
  const operationCount=operations.length; assert.throws(()=>paintMissilesCanvas(context,{...input,missiles:[normal,{...normal,age:NaN}]}),/invalid missile source/,'Canvas validates malformed input loudly'); assert.equal(operations.length,operationCount,'Canvas validates the complete input before painting');
  console.log('Missile layer model contracts PASS');
})().catch(error=>{ console.error(error); process.exitCode=1; });
