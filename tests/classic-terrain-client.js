const assert=require('node:assert/strict');
(async()=>{
 const {attachClassicTerrainWorker}=await import('../game/src/rendering/classic-terrain-client.mjs');
 const flush=async()=>{await Promise.resolve();await Promise.resolve();};
 const uploads=[],blits=[],workers=[];let fallback=0,destroyed=0,now=1;
 global.document={createElement:()=>({width:0,height:0,getContext:()=>({putImageData:(...a)=>uploads.push(a)})})};
 global.ImageData=class{constructor(pixels,width,height){Object.assign(this,{pixels,width,height});}};
 class Worker{
  constructor(){this.sent=[];workers.push(this);}
  postMessage(message,transfer){this.sent.push({message,transfer});}
  terminate(){this.terminated=true;}
  complete(index=this.sent.length-1,extra={}){const {generation,input}=this.sent[index].message;this.onmessage({data:{type:'complete',generation,rasterRevision:index+1,width:1,height:1,pixels:new Uint8ClampedArray(4),camera:input.camera,cssWidth:input.width,cssHeight:input.height,...extra}});}
 }
 const art=attachClassicTerrainWorker({enabled:true,paintTerrain:()=>{fallback++;return true;},diagnostics:()=>({}),destroy:()=>destroyed++},{workerFactory:()=>new Worker(),clock:()=>now,timeoutMs:20});
 const ctx={canvas:{width:100},save(){},restore(){},drawImage:(...a)=>blits.push(a)};
 const s={tick:0,width:100,height:80,W:2,H:2,camera:{x:-10.25,y:-20.5,s:10},land:new Uint8Array([1,0,1,0]),river:new Uint8Array(4),rough:new Float32Array(4),owner:new Int16Array([0,-1,0,-1]),fog:new Uint8Array(4),fogOpacity:new Uint8Array(4),players:[{color:'#abcdef'}],structures:[{t:0,type:'city',owner:0}]};
 art.paintTerrain(ctx,s);await flush();const w=workers[0],input=w.sent[0].message.input;
 assert.notEqual(input.land.buffer,s.land.buffer);assert.notEqual(input.owner.buffer,s.owner.buffer);assert.notEqual(input.players[0],s.players[0]);assert.notEqual(input.structures[0],s.structures[0]);
 const expected=s.land[0];s.land[0]=0;assert.equal(input.land[0],expected);assert.equal(s.land.byteLength,4);
 for(let tick=1;tick<=10;tick++)art.paintTerrain(ctx,{...s,tick});
 await flush();assert.equal(w.sent.length,1,'only one build in flight');w.complete();await flush();assert.equal(w.sent.length,2);assert.equal(w.sent[1].message.input.land[0],0);
 w.complete();await art.terrainSettled();art.paintTerrain(ctx,{...s,tick:10});assert.deepEqual(blits.at(-1).slice(1),[-32,-32,180,160]);
 const count=fallback;art.paintTerrain(ctx,{...s,tick:10,camera:{...s.camera,x:s.camera.x+10}});assert.equal(fallback,count,'small pan should use overscan');await flush();
 art.resetTerrain();assert.equal(w.terminated,true);const uploadCount=uploads.length;w.complete();assert.equal(uploads.length,uploadCount,'stale completion after reset');
 art.paintTerrain(ctx,s);await flush();workers[1].onerror({message:'injected'});assert.equal(art.diagnostics().terrainWorker.fallbackActive,true);const failedCount=fallback;art.paintTerrain(ctx,s);assert.equal(fallback,failedCount+1);
 art.resetTerrain();art.paintTerrain(ctx,s);await flush();now=100;art.paintTerrain(ctx,{...s,tick:1});assert.equal(workers[2].terminated,true);assert.equal(art.diagnostics().terrainWorker.fallbackActive,true);
 art.resetTerrain();art.paintTerrain(ctx,s);await flush();await art.terrainSettled();assert.equal(workers[3].terminated,true,'hung worker cannot hang settlement');
 art.resetTerrain();art.paintTerrain(ctx,{...s,tick:9});await flush();art.paintTerrain(ctx,{...s,tick:0});await flush();assert.equal(workers[4].terminated,true,'backward timeline resets worker');
 for(let tick=1;tick<=650;tick++)art.paintTerrain(ctx,{...s,tick});await flush();assert.ok(art.diagnostics().terrainWorker.scheduler.requestSamplesMs.length<=600);
 art.destroy();art.destroy();assert.equal(destroyed,1);assert.equal(art.paintTerrain(ctx,s),false);
 assert.equal(art.diagnostics().terrainWorker.scheduler.maxInFlight,1);assert.equal(art.diagnostics().terrainWorker.scheduler.maxQueued,1);
 let frontFallbacks=0;
 const layers=attachClassicTerrainWorker({enabled:true,paintTerrain:()=>true,paintFronts:()=>{frontFallbacks++;return true;},diagnostics:()=>({}),destroy:()=>{}},{workerFactory:()=>new Worker(),clock:()=>now,timeoutMs:20});
 const attack={owner:0,front:new Set([1,2])},frontState={...s,attacks:[attack]},bitmap=()=>({closed:0,close(){this.closed++;}}),first=bitmap(),second=bitmap(),late=bitmap();
 layers.paintTerrain(ctx,frontState);await flush();const frontWorker=workers.at(-1);attack.front.add(3);assert.deepEqual(frontWorker.sent[0].message.input.attacks[0].front,[1,2]);frontWorker.complete(0,{frontLayers:[first]});await layers.terrainSettled();
 const blitCount=blits.length;layers.paintFronts(ctx,[attack],s.players,s.camera,2,2,s.fog,100,0,100,80);assert.equal(blits.length,blitCount+1);assert.equal(frontFallbacks,0);
 layers.paintTerrain(ctx,{...frontState,tick:1});await flush();frontWorker.complete(1,{frontLayers:[second]});await layers.terrainSettled();assert.equal(first.closed,1,'replaced front bitmap closes');layers.resetTerrain();assert.equal(second.closed,1,'reset closes installed front bitmap');frontWorker.complete(1,{frontLayers:[late]});assert.equal(late.closed,1,'discarded stale bitmap closes');layers.destroy();
 const plain={paintTerrain:()=>true};assert.equal(attachClassicTerrainWorker(plain),plain,'unsupported browsers retain original renderer');
 console.log('Classic terrain worker snapshot, coalescing, camera, reset, failure, timeout and teardown PASS');
})().catch(e=>{console.error(e);process.exitCode=1;});
