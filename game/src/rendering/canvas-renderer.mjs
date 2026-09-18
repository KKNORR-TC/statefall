export function createCanvasRenderer(){
  let rasterBuildCount=0,contextState='ready';
  return {
    kind:'canvas',hybrid:false,ready:Promise.resolve(),
    async mount(){}, resize(){},
    updateRaster(){ rasterBuildCount++; },
    invalidateRaster(){ rasterBuildCount++; },
    updateWorldLayer(){ return false; },
    capabilities(){ return {structures:false}; },
    renderFrame(){}, reset(){}, suspend(){}, async resume(){},
    destroy(){ contextState='destroyed'; },
    diagnostics(){ return {rasterBuildCount,rasterUploadCount:0,textureCount:0,spriteCount:0,containerCount:0,contextState,capabilities:{structures:false},layers:{terrain:{owned:false},structures:{owned:false,total:0,visible:0,culled:0,pooled:0,created:0,reused:0,destroyed:0,textureCount:0,textureBytesEstimate:0,resourceLimitFallback:{count:0,reason:null}}}}; }
  };
}
