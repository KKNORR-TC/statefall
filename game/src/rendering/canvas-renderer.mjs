export function createCanvasRenderer({reducedMotion=false}={}){
  let rasterBuildCount=0,contextState='ready';
  return {
    kind:'canvas',hybrid:false,ready:Promise.resolve(),
    async mount(){}, resize(){},
    updateRaster(){ rasterBuildCount++; },
    invalidateRaster(){ rasterBuildCount++; },
    updateWorldLayer(){ return false; },
    motionState(time=performance.now()){ return {time:reducedMotion?0:Number(time)||0,reducedMotion}; },
    capabilities(){ return {preStructures:false,structures:false}; },
    renderFrame(){}, reset(){}, suspend(){}, async resume(){},
    destroy(){ contextState='destroyed'; },
    diagnostics(){ return {rasterBuildCount,rasterUploadCount:0,textureCount:0,spriteCount:0,containerCount:0,contextState,quality:{requested:'high',effective:'high'},reducedMotion,motion:{clock:reducedMotion?'frozen':'monotonic',frozenTime:reducedMotion?0:null},capabilities:{preStructures:false,structures:false},compositingConflictFallback:{count:0,reason:null,detail:null},layers:{terrain:{owned:false},preStructures:{owned:false,quality:{requested:'high',effective:'high'},reducedMotion,primitiveCount:0,segmentCount:0,graphicsCount:0,resourceLimitFallback:{count:0,reason:null},compositingConflictFallback:{count:0,reason:null,detail:null}},structures:{owned:false,total:0,visible:0,culled:0,pooled:0,created:0,reused:0,destroyed:0,textureCount:0,textureBytesEstimate:0,resourceLimitFallback:{count:0,reason:null}}}}; }
  };
}
