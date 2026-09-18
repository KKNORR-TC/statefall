import {createCanvasRenderer} from './canvas-renderer.mjs';

const boundedReason=value=>String(value||'').slice(0,160);

export async function createRenderer({stage,metrics,search=location.search}={}){
  const params=new URLSearchParams(search),query=params.get('renderer'),requested=query||'canvas';
  let active=createCanvasRenderer(),fallbackReason=null,fallbackCleanup=null,fallbackPromise=null;
  const controller={
    get kind(){ return active.kind; }, get hybrid(){ return active.hybrid; }, ready:Promise.resolve(),
    async mount(){ return controller.ready; },
    resize(value){ active.resize(value); }, updateRaster(source){ active.updateRaster(source); }, invalidateRaster(source){ active.invalidateRaster(source); }, renderFrame(camera){ active.renderFrame(camera); },
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
  const fallback=async(reason,failed=active)=>{
    if(active.kind==='canvas'&&failed===active) return;
    if(fallbackPromise) return fallbackPromise;
    fallbackPromise=(async()=>{
      failed.destroy(); fallbackCleanup=failed.diagnostics();
      const replacement=createCanvasRenderer(); await replacement.mount({stage,metrics:metrics()}); replacement.resize(metrics());
      active=replacement; fallbackReason=boundedReason(reason); syncStage();
    })();
    try{ await fallbackPromise; } finally { fallbackPromise=null; }
  };

  if(__STATEFALL_DEV_RENDERERS__&&(requested==='pixi'||requested==='pixi-hybrid')){
    try{
      const {createPixiHybridRenderer}=await import('./pixi-hybrid-renderer.mjs');
      const injected=__STATEFALL_TEST_BRIDGE__&&window.__STATEFALL_TEST_MODE__===true,initFailure=injected?params.get('pixiInit'):null;
      const failResumeAt=injected?Math.max(0,Number(params.get('pixiResumeFailAt'))||0):0;
      const candidate=createPixiHybridRenderer({onContextFailure:reason=>void fallback(reason,candidate),failResumeAt});
      try{ await candidate.mount({stage,metrics:metrics(),failBefore:initFailure==='fail',failAfterSetup:initFailure==='fail-after-setup'}); }
      catch(error){ candidate.destroy(); fallbackCleanup=candidate.diagnostics(); throw error; }
      active=candidate; active.resize(metrics());
    }catch(error){ fallbackReason=boundedReason(`pixi-init-failed: ${error?.message||error}`); active=createCanvasRenderer(); await active.mount({stage,metrics:metrics()}); }
  }else{
    if(requested!=='canvas') fallbackReason=boundedReason(__STATEFALL_DEV_RENDERERS__?`unsupported-renderer: ${requested}`:'development-renderer-disabled');
    await active.mount({stage,metrics:metrics()});
  }
  syncStage();
  return controller;
}
