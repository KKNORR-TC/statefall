'use strict';
const assert=require('node:assert/strict');

(async()=>{
  const {createTerrainRasterClient}=await import('../game/src/rendering/terrain-raster-client.mjs');
  function harness({progress=false,failureResult=null}={}){
    const scheduled=[],workers=[],published=[],uploads=[]; let installed=null;
    class FakeWorker{
      constructor(){ this.sent=[]; workers.push(this); }
      postMessage(message,transfer){ this.sent.push({message,transfer}); }
      complete(index=0,extra={}){ const request=this.sent[index].message,changed=extra.changed??true; if(changed) this.rasterRevision=(this.rasterRevision||0)+1; const pixels=new Uint8ClampedArray([this.rasterRevision,0,0,255]); this.onmessage({data:{type:'complete',generation:request.generation,rasterRevision:this.rasterRevision,changed,pixels,width:1,height:1,diagnostics:{detailLevel:request.input.detailLevel},workerMs:4,...extra}}); }
      terminate(){ this.terminated=true; }
    }
    const sameFog=(guard,state)=>!!guard&&!!state?.fog&&guard.length===state.fog.length&&guard.every((value,index)=>value===state.fog[index]);
    const client=createTerrainRasterClient({workerFactory:()=>new FakeWorker(),schedule:fn=>scheduled.push(fn),snapshot:value=>({detailLevel:value.detailLevel,data:new Uint8Array(value.data||[]),fog:value.fog?new Uint8Array(value.fog):null}),captureGuard:input=>input.fog?new Uint8Array(input.fog):null,allowIntermediate:progress?sameFog:()=>false,invalidateInstalled:()=>{ installed=null; },publish:(value,diagnostics,kind)=>{ if(!value) return failureResult; published.push({value,diagnostics,kind}); const same=installed?.workerEpoch===value.workerEpoch&&installed?.rasterRevision===value.rasterRevision; if(!same){ installed={workerEpoch:value.workerEpoch,rasterRevision:value.rasterRevision}; uploads.push(value); } return {validRaster:true,emergencyMode:false,installedWorkerEpoch:installed.workerEpoch,installedRasterRevision:installed.rasterRevision,uploadSkippedSameRevision:same}; }});
    const pump=()=>{ const fn=scheduled.shift(); assert(fn,'expected scheduled pump'); fn(); };
    return {client,scheduled,workers,published,uploads,pump};
  }

  const basic=harness(),source=new Uint8Array([1,2,3]);
  basic.client.request({detailLevel:'strategic',data:source}); basic.client.request({detailLevel:'operational',data:source});
  assert.equal(basic.workers.length,0,'enqueue must not initialize or snapshot synchronously'); basic.pump();
  assert.equal(basic.workers[0].sent[0].message.generation,2); assert.equal(source.byteLength,3,'authoritative input must not detach');
  basic.client.request({detailLevel:'strategic',data:source}); basic.client.request({detailLevel:'operational',data:source}); basic.workers[0].complete(); basic.pump();
  assert.equal(basic.published.length,0,'unsafe stale completion must not publish'); basic.workers[0].complete(1);
  assert.equal(basic.published.length,1); assert.equal(basic.client.diagnostics().scheduler.coalesced,2); assert.equal(basic.client.diagnostics().scheduler.staleDiscarded,1);

  const race=harness();
  race.client.request({detailLevel:'operational',data:source}); race.pump(); race.client.request({detailLevel:'operational',data:source});
  race.workers[0].complete(0,{changed:true}); race.pump(); race.workers[0].complete(1,{changed:false});
  assert.equal(race.published.length,1,'latest cache hit must publish bytes after a discarded completion mutated worker cache');
  assert.equal(race.published[0].value.changed,false); assert.equal(race.published[0].kind.latest,true);
  assert.equal(race.uploads.length,1,'uninstalled cache-hit revision must upload');
  assert.equal(race.client.diagnostics().scheduler.installedRasterRevision,race.client.diagnostics().scheduler.publishedRasterRevision);
  assert.equal(race.client.diagnostics().scheduler.latestRequestedGeneration,race.client.diagnostics().scheduler.latestPublishedGeneration);
  assert.equal(race.client.diagnostics().scheduler.validRaster,true);
  race.client.request({detailLevel:'operational',data:source}); race.pump(); race.workers[0].complete(2,{changed:false});
  assert.equal(race.published.length,2,'repeated identical latest state is still acknowledged'); assert.equal(race.uploads.length,1,'installed identical revision skips upload'); assert.equal(race.client.diagnostics().scheduler.uploadSkippedSameRevision,1);

  const fog=harness({progress:true}),visible=new Uint8Array([1]),hidden=new Uint8Array([0]);
  fog.client.request({detailLevel:'operational',data:source,fog:visible}); fog.pump(); fog.client.request({detailLevel:'operational',data:source,fog:hidden});
  fog.workers[0].complete(0); fog.pump(); assert.equal(fog.published.length,0,'old visible raster must not publish after newest fog hides it'); fog.workers[0].complete(1);
  assert.equal(fog.published.length,1); assert.equal(fog.client.diagnostics().scheduler.latestPublishedGeneration,fog.client.diagnostics().scheduler.latestRequestedGeneration);

  const reset=harness(); reset.client.request({detailLevel:'strategic',data:source}); reset.pump(); const old=reset.workers[0]; reset.client.reset(); assert.equal(old.terminated,true);
  reset.client.request({detailLevel:'operational',data:source}); reset.pump(); old.complete(0); assert.equal(reset.published.length,0,'pre-reset completion cannot publish'); reset.workers[1].complete();
  assert.equal(reset.published.length,1); old.onerror({message:'late terminated-worker error'}); assert.equal(reset.client.diagnostics().scheduler.failures,0);
  const alias=harness(); alias.client.request({detailLevel:'strategic',data:source}); alias.pump(); alias.workers[0].complete(); const previous=alias.client.diagnostics().scheduler; alias.client.reset(); alias.client.request({detailLevel:'strategic',data:source}); alias.pump(); alias.workers[1].complete(); const current=alias.client.diagnostics().scheduler;
  assert.equal(previous.installedRasterRevision,1); assert.equal(current.installedRasterRevision,1); assert.notEqual(previous.installedWorkerEpoch,current.installedWorkerEpoch,'equal revisions from different workers must not alias'); assert.equal(alias.uploads.length,2);

  const continuous=harness({progress:true}),sameVisibility=new Uint8Array([1]);
  continuous.client.request({detailLevel:'operational',data:new Uint8Array([0]),fog:sameVisibility}); continuous.pump();
  for(let i=1;i<=6;i++){ continuous.client.request({detailLevel:'operational',data:new Uint8Array([i]),fog:sameVisibility}); continuous.workers[0].complete(i-1); continuous.pump(); }
  continuous.workers[0].complete(6); const progress=continuous.client.diagnostics().scheduler;
  assert(progress.intermediatePublications>=6,'safe continuous churn must make intermediate publication progress'); assert.equal(progress.latestPublishedGeneration,progress.latestRequestedGeneration); assert.equal(progress.validRaster,true); assert.equal(progress.queued,null); assert.equal(progress.inFlight,null);

  const emergency=harness({failureResult:{validRaster:true,emergencyMode:true}}); emergency.client.request({}); emergency.pump(); emergency.workers[0].onerror({message:'runtime blocked'});
  assert.equal(emergency.client.diagnostics().scheduler.fallback,'emergency-terrain'); assert.equal(emergency.client.diagnostics().scheduler.emergencyMode,true);
  const retained=harness({failureResult:{validRaster:true,emergencyMode:false}}); retained.client.request({}); retained.pump(); retained.workers[0].onerror({message:'runtime failed'}); assert.equal(retained.client.diagnostics().scheduler.fallback,'retained-raster');
  const startupPublished=[]; const failed=createTerrainRasterClient({workerFactory:()=>{ throw new Error('blocked'); },snapshot:value=>value,publish:value=>{ startupPublished.push(value); return {validRaster:true,emergencyMode:true}; },schedule:fn=>fn()}); failed.request({});
  assert.equal(failed.diagnostics().scheduler.failures,1); assert.equal(failed.diagnostics().scheduler.fallback,'emergency-terrain'); failed.request({}); assert.equal(failed.diagnostics().scheduler.failures,1,'failure must not retry or spin');
  console.log('Terrain worker exact/latest publication, safe progress, fog, reset and emergency regressions PASS');
})().catch(error=>{ console.error(error); process.exitCode=1; });
