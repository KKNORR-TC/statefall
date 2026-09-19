import {createCanvasRenderer} from './canvas-renderer.mjs';

export async function createRenderer({stage,metrics}={}){
  const renderer=createCanvasRenderer({reducedMotion:matchMedia('(prefers-reduced-motion: reduce)').matches});
  await renderer.mount({stage,metrics:metrics()});
  return {
    get kind(){ return renderer.kind; }, get hybrid(){ return renderer.hybrid; }, ready:Promise.resolve(),
    async mount(){}, resize(value){ renderer.resize(value); }, updateRaster(source){ renderer.updateRaster(source); },
    invalidateRaster(source){ renderer.invalidateRaster(source); }, updateWorldLayer(layer,state){ return renderer.updateWorldLayer(layer,state); }, motionState(time=performance.now()){ return renderer.motionState(time); }, capabilities(){ return renderer.capabilities(); }, renderFrame(camera){ renderer.renderFrame(camera); return {replay:false}; },
    reset(){ renderer.reset(); }, suspend(){ renderer.suspend(); }, resume(value){ return renderer.resume(value); }, destroy(){ renderer.destroy(); },
    diagnostics(){ return {...metrics(),...renderer.diagnostics(),active:renderer.kind}; }
  };
}
