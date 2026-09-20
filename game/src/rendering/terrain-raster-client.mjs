const now=()=>globalThis.performance?.now?.()||0;

export function createTerrainRasterClient({workerFactory,snapshot,publish,invalidateInstalled=()=>{},captureGuard=()=>null,allowIntermediate=()=>false,clock=now,schedule=queueMicrotask}={}){
  if(typeof snapshot!=='function'||typeof publish!=='function') throw new TypeError('terrain client requires snapshot and publish');
  let worker=null,queued=null,inFlight=null,generation=0,epoch=0,stopped=false,pumpScheduled=false,lastDiagnostics=null,waiters=[];
  const stats={requested:0,queued:0,dispatched:0,completed:0,published:0,latestPublications:0,intermediatePublications:0,staleDiscarded:0,discarded:0,coalesced:0,failures:0,resets:0,workerStarts:0,retries:0,snapshots:0,maxQueued:0,maxInFlight:0,latestRequestedGeneration:0,latestPublishedGeneration:0,latestRasterGeneration:0,completedWorkerEpoch:null,completedRasterRevision:null,publishedWorkerEpoch:null,publishedRasterRevision:null,installedWorkerEpoch:null,installedRasterRevision:null,uploadSkippedSameRevision:0,validRaster:false,emergencyMode:false,requestMs:0,publishMs:0,maxRequestMs:0,maxPublishMs:0,lastWorkerMs:0,maxWorkerMs:0,requestSamplesMs:[],publishSamplesMs:[],fallback:'none',failure:null};
  const diagnostics=()=>({...lastDiagnostics,scheduler:{...stats,generation,inFlight:inFlight?.generation||null,queued:queued?.generation||null,epoch,stopped}});
  function settle(){ if(!queued&&!inFlight&&!pumpScheduled){ const pending=waiters; waiters=[]; for(const resolve of pending) resolve(diagnostics()); } }
  function clearInstalled(reason){ stats.installedWorkerEpoch=null; stats.installedRasterRevision=null; invalidateInstalled(reason); }
  function fail(message,source=worker){ if(source!==worker) return; stats.failures++; stats.failure=String(message||'terrain worker failure').slice(0,240); stopped=true; queued=null; inFlight=null; clearInstalled('failure'); try{ worker?.terminate(); }catch{} worker=null; const result=publish(null,diagnostics()); if(result&&typeof result==='object'){ stats.validRaster=!!result.validRaster; stats.emergencyMode=!!result.emergencyMode; stats.emergencyMs=Number(result.emergencyMs)||0; stats.fallback=result.emergencyMode?'emergency-terrain':'retained-raster'; } settle(); }
  function ensureWorker(){
    if(worker||stopped) return !!worker;
    try{
      const created=workerFactory?.();
      if(!created) throw new Error('module Worker unavailable');
      clearInstalled('new-worker'); worker=created; stats.workerStarts++;
      created.onmessage=event=>onMessage(created,event); created.onerror=event=>fail(event?.message||'terrain worker error',created); created.onmessageerror=()=>fail('terrain worker message error',created);
      return true;
    }catch(error){ fail(error?.message); return false; }
  }
  function schedulePump(){ if(pumpScheduled||stopped) return; pumpScheduled=true; schedule(()=>{ pumpScheduled=false; pump(); settle(); }); }
  function pump(){
    if(stopped||inFlight||!queued||!ensureWorker()) return;
    const request=queued; queued=null;
    try{
      const input=snapshot(request.state),transfer=[]; request.guard=captureGuard(input,request.state); stats.snapshots++;
      for(const value of Object.values(input)) if(ArrayBuffer.isView(value)&&value.buffer instanceof ArrayBuffer) transfer.push(value.buffer);
      inFlight=request; stats.dispatched++; stats.maxInFlight=Math.max(stats.maxInFlight,1); worker.postMessage({type:'build',generation:request.generation,input},transfer);
    }catch(error){ fail(error?.message); }
  }
  function onMessage(source,event){
    if(source!==worker) return;
    const message=event.data||{};
    if(message.type==='failure'){ if(message.generation===inFlight?.generation) fail(message.message); return; }
    if(message.type!=='complete'||message.generation!==inFlight?.generation) return;
    if(!Number.isSafeInteger(message.rasterRevision)||message.rasterRevision<1){ fail('invalid terrain worker raster revision',source); return; }
    const completed=inFlight,completion={...message,workerEpoch:completed.epoch}; inFlight=null; stats.completed++; stats.completedWorkerEpoch=completion.workerEpoch; stats.completedRasterRevision=completion.rasterRevision; stats.lastWorkerMs=Number(message.workerMs)||0; stats.maxWorkerMs=Math.max(stats.maxWorkerMs,stats.lastWorkerMs);
    const latest=message.generation===generation;
    if(!latest&&!allowIntermediate(completed?.guard,queued?.state,completed?.state)){ stats.discarded++; stats.staleDiscarded++; schedulePump(); return; }
    const started=clock();
    try{ lastDiagnostics=message.diagnostics; const result=publish(completion,diagnostics(),{latest,intermediate:!latest}); if(result!==false){ stats.published++; stats.validRaster=true; stats.emergencyMode=false; stats.latestRasterGeneration=message.generation; stats.publishedWorkerEpoch=completion.workerEpoch; stats.publishedRasterRevision=completion.rasterRevision; if(result&&typeof result==='object'){ stats.validRaster=result.validRaster!==undefined?!!result.validRaster:true; stats.emergencyMode=!!result.emergencyMode; stats.installedWorkerEpoch=result.installedWorkerEpoch??null; stats.installedRasterRevision=result.installedRasterRevision??null; if(result.uploadSkippedSameRevision) stats.uploadSkippedSameRevision++; } else { stats.installedWorkerEpoch=completion.workerEpoch; stats.installedRasterRevision=completion.rasterRevision; } if(latest){ stats.latestPublications++; stats.latestPublishedGeneration=message.generation; } else stats.intermediatePublications++; } }
    catch(error){ fail(error?.message); return; }
    const elapsed=Math.max(0,clock()-started); stats.publishSamplesMs.push(elapsed); stats.publishMs+=elapsed; stats.maxPublishMs=Math.max(stats.maxPublishMs,elapsed); schedulePump(); settle();
  }
  return Object.freeze({
    request(state){
      const started=clock(),request={state,generation:++generation,epoch}; stats.requested++; stats.latestRequestedGeneration=request.generation;
      if(queued){ stats.coalesced++; queued=request; } else { queued=request; stats.queued++; }
      stats.maxQueued=Math.max(stats.maxQueued,queued?1:0); schedulePump(); const elapsed=Math.max(0,clock()-started); stats.requestSamplesMs.push(elapsed); stats.requestMs+=elapsed; stats.maxRequestMs=Math.max(stats.maxRequestMs,elapsed); return request.generation;
    },
    reset(){ epoch++; generation++; stats.resets++; stats.validRaster=false; stats.emergencyMode=false; stats.latestRasterGeneration=0; stats.completedWorkerEpoch=null; stats.completedRasterRevision=null; stats.publishedWorkerEpoch=null; stats.publishedRasterRevision=null; stats.fallback='none'; stats.failure=null; queued=null; inFlight=null; stopped=false; lastDiagnostics=null; clearInstalled('reset'); try{ worker?.terminate(); }catch{} worker=null; settle(); },
    destroy(){ stopped=true; queued=null; inFlight=null; clearInstalled('destroy'); try{ worker?.terminate(); }catch{} worker=null; settle(); },
    diagnostics,
    settled(){ if(!queued&&!inFlight&&!pumpScheduled) return Promise.resolve(diagnostics()); return new Promise(resolve=>waiters.push(resolve)); },
    idle(){ return !queued&&!inFlight&&!pumpScheduled; }
  });
}
