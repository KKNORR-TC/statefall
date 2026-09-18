import {createCanvasRenderer} from './canvas-renderer.mjs';

export async function createRenderer({stage,metrics}={}){
  const renderer=createCanvasRenderer();
  await renderer.mount({stage,metrics:metrics()});
  return {
    get kind(){ return renderer.kind; }, get hybrid(){ return renderer.hybrid; }, ready:Promise.resolve(),
    async mount(){}, resize(value){ renderer.resize(value); }, updateRaster(source){ renderer.updateRaster(source); },
    invalidateRaster(source){ renderer.invalidateRaster(source); }, updateWorldLayer(layer,state){ return renderer.updateWorldLayer(layer,state); }, capabilities(){ return renderer.capabilities(); }, renderFrame(camera){ renderer.renderFrame(camera); },
    reset(){ renderer.reset(); }, suspend(){ renderer.suspend(); }, resume(value){ return renderer.resume(value); }, destroy(){ renderer.destroy(); },
    diagnostics(){ return {...metrics(),...renderer.diagnostics(),active:renderer.kind}; }
  };
}
