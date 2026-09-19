'use strict';

const assert=require('node:assert/strict');

(async()=>{
  const layer=await import('../game/src/rendering/notification-overlay-layer-model.mjs'),model=layer.createNotificationOverlayModel(),canvasState={globalAlpha:.75,globalCompositeOperation:'source-over',lineCap:'round',lineJoin:'bevel',lineWidth:3,strokeStyle:'#123456',fillStyle:'#654321',lineDash:[2,5],lineDashOffset:1.5,font:'14px serif',textAlign:'right',textBaseline:'middle',transform:[1.5,0,0,1.5,0,0]},input={viewport:{width:1280,height:720},resolution:1.5,canvasState,notifications:[{key:'nuclear:1',kind:'nuclear-alert',labels:2,chars:24,primitives:5,segments:8},{key:'song:2',kind:'song-banner',labels:1,chars:30,primitives:2,segments:8},{key:'badge:3',kind:'fallen-badge',labels:2,chars:42,primitives:8,segments:24}]},before=JSON.stringify(input),scene=model.build(input);
  assert.equal(JSON.stringify(input),before,'model input is immutable');
  assert.deepEqual(scene.entries.map(value=>[value.key,value.kind,value.order]),[['nuclear:1','nuclear-alert',0],['song:2','song-banner',1],['badge:3','fallen-badge',2]]);
  assert.deepEqual(scene.counts,{entries:3,labels:5,chars:96,primitives:15,segments:40,visible:3,culled:0});
  assert.deepEqual(scene.raster,{key:`notification:viewport:${JSON.stringify(canvasState)}`,kind:'sprite',blendMode:'normal',bounds:{left:0,top:0,right:1280,bottom:720},resolution:1.5,pixelWidth:1920,pixelHeight:1080,sourceBytes:8294400,canvasState});
  assert.deepEqual(scene.resources,{containers:1,graphics:15,sprites:1,textures:1,sourceBytes:8294400});
  assert.equal(Object.isFrozen(scene),true); assert.equal(Object.isFrozen(scene.entries),true); assert.equal(Object.isFrozen(scene.raster),true);
  assert.deepEqual(model.build({...input,viewport:{width:0,height:720}}).counts,{...scene.counts,visible:0,culled:3});
  assert.equal(model.build({...input,notifications:[]}).raster,null);
  assert.throws(()=>model.build({...input,notifications:[input.notifications[0],input.notifications[0]]}),/duplicate notification stable key/);
  for(const [name,value,error] of [['entries',2,'entry-cap'],['labels',4,'label-cap'],['chars',95,'char-cap'],['primitives',14,'primitive-cap'],['segments',39,'segment-cap'],['containers',0,'container-cap'],['graphics',14,'graphics-cap'],['sprites',0,'sprite-cap'],['textures',0,'texture-cap'],['sourceBytes',8294399,'source-byte-cap']]) assert.throws(()=>model.build(input,{[name]:value}),new RegExp(error));
  const huge=model.build({...input,viewport:{width:4096,height:2160},resolution:2},{sourceBytes:136*1024*1024}); assert.equal(huge.raster.sourceBytes,135*1024*1024); assert.equal(huge.raster.pixelWidth,8192); assert.equal(huge.raster.pixelHeight,4320);
  assert.throws(()=>model.build({...input,viewport:{width:4096,height:2160},resolution:2}),/source-byte-cap/);
  assert.throws(()=>model.build({...input,viewport:{width:Number.MAX_VALUE,height:2160},resolution:2}),/invalid notification overlay state|source-byte-cap/);
  assert.throws(()=>model.build({...input,viewport:{width:Number.MAX_SAFE_INTEGER,height:Number.MAX_SAFE_INTEGER},resolution:1}),/source-byte-cap/);
  assert.throws(()=>model.build({...input,resolution:0}),/invalid notification overlay state/);
  assert.throws(()=>model.build({...input,viewport:{width:'1280',height:720}}),/invalid notification overlay state/);
  assert.throws(()=>model.build({...input,viewport:{width:null,height:720}}),/invalid notification overlay state/);
  assert.throws(()=>model.build({...input,viewport:{width:Infinity,height:720}}),/invalid notification overlay state/);
  assert.throws(()=>model.build({...input,canvasState:{lineDash:[],transform:[1,0]}}),/invalid notification canvas state/);
  assert.equal(model.build({...input,canvasState:{...canvasState,globalCompositeOperation:'lighter'}}).raster.blendMode,'add');
  for(const mode of ['destination-in','destination-out','source-in','source-out','source-atop','destination-atop','destination-over','copy','xor','unknown']) assert.throws(()=>model.build({...input,canvasState:{...canvasState,globalCompositeOperation:mode}}),/composite-mode/);
  console.log('Notification overlay layer model contracts PASS');
})().catch(error=>{ console.error(error); process.exitCode=1; });
