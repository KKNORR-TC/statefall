export function createCanvasRenderer(){
  let rasterBuildCount=0,contextState='ready';
  return {
    kind:'canvas',hybrid:false,ready:Promise.resolve(),
    async mount(){}, resize(){},
    updateRaster(){ rasterBuildCount++; },
    invalidateRaster(){ rasterBuildCount++; },
    renderFrame(){}, reset(){}, suspend(){}, async resume(){},
    destroy(){ contextState='destroyed'; },
    diagnostics(){ return {rasterBuildCount,rasterUploadCount:0,textureCount:0,spriteCount:0,containerCount:0,contextState}; }
  };
}
