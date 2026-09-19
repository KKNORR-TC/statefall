import {createCanvasRenderer} from './canvas-renderer.mjs';

const boundedReason=value=>String(value||'').slice(0,160);

export async function createRenderer({stage,metrics,search=location.search}={}){
  const params=new URLSearchParams(search),query=params.get('renderer'),requested=query||'canvas';
  const reducedMotion=matchMedia('(prefers-reduced-motion: reduce)').matches;
  let active=createCanvasRenderer({reducedMotion}),fallbackReason=null,fallbackCleanup=null,fallbackPromise=null,replayRequired=false;
  const controller={
    get kind(){ return active.kind; }, get hybrid(){ return active.hybrid; }, ready:Promise.resolve(),
    async mount(){ return controller.ready; },
    resize(value){ active.resize(value); }, updateRaster(source){ active.updateRaster(source); }, invalidateRaster(source){ active.invalidateRaster(source); },
    motionState(time=performance.now()){ return active.motionState(time); },
    updateWorldLayer(layer,state){ try{ return active.updateWorldLayer(layer,state); }catch(error){ fallbackSync(`pixi-world-layer-failed: ${error?.message||error}`,active); replayRequired=true; return false; } },
    capabilities(){ return active.capabilities(); },
    injectFailure(kind){ if(kind.startsWith('aircraft-')&&typeof active.injectAircraftFailure==='function') active.injectAircraftFailure(kind); else if(kind.startsWith('map-label-')&&typeof active.injectMapLabelFailure==='function') active.injectMapLabelFailure(kind); else { if(typeof active.injectFailure!=='function') throw new Error('renderer failure injection unavailable'); active.injectFailure(kind); } },
    projectileRasterEvidence(points){ if(typeof active.projectileRasterEvidence!=='function') throw new Error('projectile raster evidence unavailable'); return active.projectileRasterEvidence(points); },
    missileRasterEvidence(points){ if(typeof active.missileRasterEvidence!=='function') throw new Error('missile raster evidence unavailable'); return active.missileRasterEvidence(points); },
    aircraftRasterEvidence(points){ if(typeof active.aircraftRasterEvidence!=='function') throw new Error('aircraft raster evidence unavailable'); return active.aircraftRasterEvidence(points); },
    mapLabelRasterEvidence(points){ if(typeof active.mapLabelRasterEvidence!=='function') throw new Error('map label raster evidence unavailable'); return active.mapLabelRasterEvidence(points); },
    mapLabelCompositeEvidence(){ if(typeof active.mapLabelCompositeEvidence!=='function') throw new Error('map label composite evidence unavailable'); return active.mapLabelCompositeEvidence(); },
    renderFrame(camera){
      try{ active.renderFrame(camera); }
      catch(error){ fallbackSync(`pixi-render-failed: ${error?.message||error}`,active); replayRequired=true; }
      if(replayRequired){ replayRequired=false; return {replay:true,reason:fallbackReason}; }
      return {replay:false};
    },
    reset(){ active.reset(); }, suspend(){ active.suspend(); },
    async resume(value){
      const resuming=active;
      try{ await resuming.resume(value); syncStage(); }
      catch(error){ await fallback(`pixi-resume-failed: ${error?.message||error}`,resuming); }
    },
    destroy(){ active.destroy(); },
    diagnostics(){ return {requested,active:active.kind,fallbackReason,fallbackCleanup,...metrics(),...active.diagnostics()}; }
  };
  const syncStage=()=>stage.classList.toggle('pixi-hybrid',active.hybrid);
  const fallbackSync=(reason,failed=active)=>{
    if(active.kind==='canvas'&&failed===active) throw new Error(boundedReason(reason)||'canvas renderer failed');
    if(typeof failed.markUnhealthy==='function') failed.markUnhealthy();
    failed.destroy(); fallbackCleanup=failed.diagnostics();
    const replacement=createCanvasRenderer({reducedMotion});
    try{ replacement.mount({stage,metrics:metrics()}); replacement.resize(metrics()); }
    catch(error){ try{ replacement.destroy(); }catch{} active=failed; fallbackReason=boundedReason(reason); syncStage(); throw new Error(`canvas-fallback-failed: ${error?.message||error}`); }
    active=replacement; fallbackReason=boundedReason(reason); syncStage();
  };
  const fallback=async(reason,failed=active)=>{
    if(active.kind==='canvas'&&failed===active) return;
    if(fallbackPromise) return fallbackPromise;
    fallbackPromise=(async()=>{
      if(typeof failed.markUnhealthy==='function') failed.markUnhealthy();
      failed.destroy(); fallbackCleanup=failed.diagnostics();
      const replacement=createCanvasRenderer({reducedMotion}); await replacement.mount({stage,metrics:metrics()}); replacement.resize(metrics());
      active=replacement; fallbackReason=boundedReason(reason); syncStage();
    })();
    try{ await fallbackPromise; } finally { fallbackPromise=null; }
  };

  if(__STATEFALL_DEV_RENDERERS__&&(requested==='pixi'||requested==='pixi-hybrid')){
    try{
      const {createPixiHybridRenderer}=await import('./pixi-hybrid-renderer.mjs');
      const injected=__STATEFALL_TEST_BRIDGE__&&window.__STATEFALL_TEST_MODE__===true,initFailure=injected?params.get('pixiInit'):null;
      const failResumeAt=injected?Math.max(0,Number(params.get('pixiResumeFailAt'))||0):0;
      const testLimit=name=>{ if(!injected||!params.has(name)) return undefined; const value=Number(params.get(name)); return Number.isInteger(value)&&value>=0?value:undefined; };
      const structureLimits={sprites:testLimit('pixiSpriteCap'),pool:testLimit('pixiPoolCap'),textures:testLimit('pixiTextureCap'),texts:testLimit('pixiTextCap'),failEntryCreate:injected&&params.get('pixiEntryFail')==='1'};
      const preStructureLimits={primitives:testLimit('pixiPrimitiveCap'),segments:testLimit('pixiSegmentCap')};
      const navalLimits={entities:testLimit('pixiNavalEntityCap'),pathPoints:testLimit('pixiNavalPathCap'),wakePoints:testLimit('pixiNavalWakeCap'),primitives:testLimit('pixiNavalPrimitiveCap'),segments:testLimit('pixiNavalSegmentCap'),labels:testLimit('pixiNavalLabelCap'),containers:testLimit('pixiNavalContainerCap'),graphics:testLimit('pixiNavalGraphicsCap'),failContainerCreate:injected&&params.get('pixiNavalContainerFail')==='1',failGraphicsCreate:injected&&params.get('pixiNavalGraphicsFail')==='1',failLabelCreate:injected&&params.get('pixiNavalLabelFail')==='1'};
      const warshipLimits={entries:testLimit('pixiWarshipEntryCap'),wakePoints:testLimit('pixiWarshipWakeCap'),primitives:testLimit('pixiWarshipPrimitiveCap'),segments:testLimit('pixiWarshipSegmentCap'),labels:testLimit('pixiWarshipLabelCap'),containers:testLimit('pixiWarshipContainerCap'),graphics:testLimit('pixiWarshipGraphicsCap'),failContainerCreate:injected&&params.get('pixiWarshipContainerFail')==='1',failGraphicsCreate:injected&&params.get('pixiWarshipGraphicsFail')==='1',failLabelCreate:injected&&params.get('pixiWarshipLabelFail')==='1'};
      const projectileLimits={entries:testLimit('pixiProjectileEntryCap'),trailPoints:testLimit('pixiProjectileTrailCap'),primitives:testLimit('pixiProjectilePrimitiveCap'),segments:testLimit('pixiProjectileSegmentCap'),containers:testLimit('pixiProjectileContainerCap'),graphics:testLimit('pixiProjectileGraphicsCap'),failContainerCreate:injected&&params.get('pixiProjectileContainerFail')==='1',failGraphicsCreate:injected&&params.get('pixiProjectileGraphicsFail')==='1'};
      const missileLimits={entries:testLimit('pixiMissileEntryCap'),trailSamples:testLimit('pixiMissileTrailCap'),primitives:testLimit('pixiMissilePrimitiveCap'),segments:testLimit('pixiMissileSegmentCap'),containers:testLimit('pixiMissileContainerCap'),graphics:testLimit('pixiMissileGraphicsCap'),failContainerCreate:injected&&params.get('pixiMissileContainerFail')==='1',failGraphicsCreate:injected&&params.get('pixiMissileGraphicsFail')==='1'};
      const aircraftLimits={entries:testLimit('pixiAircraftEntryCap'),primitives:testLimit('pixiAircraftPrimitiveCap'),segments:testLimit('pixiAircraftSegmentCap'),containers:testLimit('pixiAircraftContainerCap'),graphics:testLimit('pixiAircraftGraphicsCap'),failContainerCreate:injected&&params.get('pixiAircraftContainerFail')==='1',failGraphicsCreate:injected&&params.get('pixiAircraftGraphicsFail')==='1'};
      const mapLabelLimits={entries:testLimit('pixiMapLabelEntryCap'),labels:testLimit('pixiMapLabelLabelCap'),chars:testLimit('pixiMapLabelCharCap'),containers:testLimit('pixiMapLabelContainerCap'),sprites:testLimit('pixiMapLabelSpriteCap'),textures:testLimit('pixiMapLabelTextureCap'),sourceBytes:testLimit('pixiMapLabelSourceByteCap'),failContainerCreate:injected&&params.get('pixiMapLabelContainerFail')==='1',failSpriteCreate:injected&&params.get('pixiMapLabelSpriteFail')==='1',failSource:injected&&params.get('pixiMapLabelSourceFail')==='1',failFont:injected&&params.get('pixiMapLabelFontFail')==='1'};
      const queryQuality=params.get('quality'),requestedQuality=injected&&queryQuality?queryQuality:'high',quality=['high','medium','low'].includes(requestedQuality)?requestedQuality:'high';
      const candidate=createPixiHybridRenderer({onContextFailure:reason=>void fallback(reason,candidate),failResumeAt,structureLimits,preStructureLimits,navalLimits,warshipLimits,projectileLimits,missileLimits,aircraftLimits,mapLabelLimits,requestedQuality,quality,reducedMotion,failGraphics:injected&&params.get('pixiGraphicsFail')==='1',failText:injected&&params.get('pixiTextFail')==='1',testMode:injected});
      try{ await candidate.mount({stage,metrics:metrics(),failBefore:initFailure==='fail',failAfterSetup:initFailure==='fail-after-setup'}); }
      catch(error){ candidate.destroy(); fallbackCleanup=candidate.diagnostics(); throw error; }
      active=candidate; active.resize(metrics());
    }catch(error){ fallbackReason=boundedReason(`pixi-init-failed: ${error?.message||error}`); active=createCanvasRenderer({reducedMotion}); await active.mount({stage,metrics:metrics()}); }
  }else{
    if(requested!=='canvas') fallbackReason=boundedReason(__STATEFALL_DEV_RENDERERS__?`unsupported-renderer: ${requested}`:'development-renderer-disabled');
    await active.mount({stage,metrics:metrics()});
  }
  syncStage();
  return controller;
}
