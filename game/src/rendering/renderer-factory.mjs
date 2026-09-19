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
    injectFailure(kind){ if(kind.startsWith('aircraft-')&&typeof active.injectAircraftFailure==='function') active.injectAircraftFailure(kind); else if(kind.startsWith('map-label-')&&typeof active.injectMapLabelFailure==='function') active.injectMapLabelFailure(kind); else if(kind.startsWith('support-actor-')&&typeof active.injectSupportActorFailure==='function') active.injectSupportActorFailure(kind); else if(kind.startsWith('floating-text-')&&typeof active.injectFloatingTextFailure==='function') active.injectFloatingTextFailure(kind); else if(kind.startsWith('global-effects-')&&typeof active.injectGlobalEffectsFailure==='function') active.injectGlobalEffectsFailure(kind); else if(kind.startsWith('nation-overlays-')&&typeof active.injectNationOverlayFailure==='function') active.injectNationOverlayFailure(kind); else { if(typeof active.injectFailure!=='function') throw new Error('renderer failure injection unavailable'); active.injectFailure(kind); } },
    projectileRasterEvidence(points){ if(typeof active.projectileRasterEvidence!=='function') throw new Error('projectile raster evidence unavailable'); return active.projectileRasterEvidence(points); },
    missileRasterEvidence(points){ if(typeof active.missileRasterEvidence!=='function') throw new Error('missile raster evidence unavailable'); return active.missileRasterEvidence(points); },
    aircraftRasterEvidence(points){ if(typeof active.aircraftRasterEvidence!=='function') throw new Error('aircraft raster evidence unavailable'); return active.aircraftRasterEvidence(points); },
    mapLabelRasterEvidence(points){ if(typeof active.mapLabelRasterEvidence!=='function') throw new Error('map label raster evidence unavailable'); return active.mapLabelRasterEvidence(points); },
    mapLabelCompositeEvidence(){ if(typeof active.mapLabelCompositeEvidence!=='function') throw new Error('map label composite evidence unavailable'); return active.mapLabelCompositeEvidence(); },
    supportActorRasterEvidence(points){ if(typeof active.supportActorRasterEvidence!=='function') throw new Error('support actor raster evidence unavailable'); return active.supportActorRasterEvidence(points); },
    floatingTextRasterEvidence(){ if(typeof active.floatingTextRasterEvidence!=='function') throw new Error('floating text raster evidence unavailable'); return active.floatingTextRasterEvidence(); },
    globalEffectsRasterEvidence(){ if(typeof active.globalEffectsRasterEvidence!=='function') throw new Error('global effects raster evidence unavailable'); return active.globalEffectsRasterEvidence(); },
    nationOverlayRasterEvidence(){ if(typeof active.nationOverlayRasterEvidence!=='function') throw new Error('nation overlay raster evidence unavailable'); return active.nationOverlayRasterEvidence(); },
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
    diagnostics(){ const value=active.diagnostics(),capabilities={...value.capabilities,globalEffects:!!value.capabilities?.globalEffects,nationOverlays:!!value.capabilities?.nationOverlays},layers={...value.layers,globalEffects:value.layers?.globalEffects||{owned:false,counts:{scorches:0,sparks:0,puffs:0,fragments:0,tracers:0,wrecks:0,flashes:0,total:0,visible:0,culled:0},primitiveCount:0,segmentCount:0,trailPointCount:0,resourceLimitFallback:{count:0,reason:null}},nationOverlays:value.layers?.nationOverlays||{owned:false,counts:{players:0,eligible:0,visible:0,culled:0,labels:0,chars:0,primitives:0,segments:0},resourceLimitFallback:{count:0,reason:null}}}; return {requested,active:active.kind,fallbackReason,fallbackCleanup,...metrics(),...value,capabilities,layers}; }
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
      const supportActorLimits={entries:testLimit('pixiSupportActorEntryCap'),trailPoints:testLimit('pixiSupportActorTrailCap'),primitives:testLimit('pixiSupportActorPrimitiveCap'),segments:testLimit('pixiSupportActorSegmentCap'),containers:testLimit('pixiSupportActorContainerCap'),graphics:testLimit('pixiSupportActorGraphicsCap'),failContainerCreate:injected&&params.get('pixiSupportActorContainerFail')==='1',failGraphicsCreate:injected&&params.get('pixiSupportActorGraphicsFail')==='1'};
      const floatingTextLimits={entries:testLimit('pixiFloatingTextEntryCap'),labels:testLimit('pixiFloatingTextLabelCap'),chars:testLimit('pixiFloatingTextCharCap'),containers:testLimit('pixiFloatingTextContainerCap'),sprites:testLimit('pixiFloatingTextSpriteCap'),textures:testLimit('pixiFloatingTextTextureCap'),sourceBytes:testLimit('pixiFloatingTextSourceByteCap'),failContainerCreate:injected&&params.get('pixiFloatingTextContainerFail')==='1',failSpriteCreate:injected&&params.get('pixiFloatingTextSpriteFail')==='1',failSource:injected&&params.get('pixiFloatingTextSourceFail')==='1'};
      const globalEffectsLimits={categoryEntries:testLimit('pixiGlobalEffectsCategoryCap'),entries:testLimit('pixiGlobalEffectsEntryCap'),trailPoints:testLimit('pixiGlobalEffectsTrailCap'),primitives:testLimit('pixiGlobalEffectsPrimitiveCap'),segments:testLimit('pixiGlobalEffectsSegmentCap'),containers:testLimit('pixiGlobalEffectsContainerCap'),graphics:testLimit('pixiGlobalEffectsGraphicsCap'),failContainerCreate:injected&&params.get('pixiGlobalEffectsContainerFail')==='1',failGraphicsCreate:injected&&params.get('pixiGlobalEffectsGraphicsFail')==='1'};
      const nationOverlayLimits={entries:testLimit('pixiNationOverlayEntryCap'),labels:testLimit('pixiNationOverlayLabelCap'),chars:testLimit('pixiNationOverlayCharCap'),primitives:testLimit('pixiNationOverlayPrimitiveCap'),segments:testLimit('pixiNationOverlaySegmentCap'),containers:testLimit('pixiNationOverlayContainerCap'),sprites:testLimit('pixiNationOverlaySpriteCap'),textures:testLimit('pixiNationOverlayTextureCap'),sourceBytes:testLimit('pixiNationOverlaySourceByteCap'),failContainerCreate:injected&&params.get('pixiNationOverlayContainerFail')==='1',failSpriteCreate:injected&&params.get('pixiNationOverlaySpriteFail')==='1',failSource:injected&&params.get('pixiNationOverlaySourceFail')==='1'};
      const queryQuality=params.get('quality'),requestedQuality=injected&&queryQuality?queryQuality:'high',quality=['high','medium','low'].includes(requestedQuality)?requestedQuality:'high';
      const candidate=createPixiHybridRenderer({onContextFailure:reason=>void fallback(reason,candidate),failResumeAt,structureLimits,preStructureLimits,navalLimits,warshipLimits,projectileLimits,missileLimits,aircraftLimits,mapLabelLimits,supportActorLimits,floatingTextLimits,globalEffectsLimits,nationOverlayLimits,requestedQuality,quality,reducedMotion,failGraphics:injected&&params.get('pixiGraphicsFail')==='1',failText:injected&&params.get('pixiTextFail')==='1',testMode:injected});
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
