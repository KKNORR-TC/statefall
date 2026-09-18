import {Application,Container,Sprite,Texture} from 'pixi.js';
import {MAX_STRUCTURE_POOL,MAX_STRUCTURE_SPRITES,MAX_STRUCTURE_TEXTURES,createBoundedPool,structureTextureKey,structureVisual} from './structure-layer-model.mjs';

export function createPixiHybridRenderer({onContextFailure=()=>{},failResumeAt=0,structureLimits={}}={}){
  let app=null,canvas=null,world=null,entities=null,structureLayer=null,effects=null,texture=null,sprite=null,source=null,dirty=false,stage=null,lastMetrics=null,healthy=false;
  let rasterBuildCount=0,rasterUploadCount=0,contextState='initializing',contextListenerCount=0,resumeCount=0;
  let applicationAllocations=0,rendererAllocations=0,textureAllocations=0,releaseCount=0,textureDestroyCount=0,textureClock=0;
  let structureTotal=0,structureVisible=0,structureCulled=0,structureTextureAllocations=0,structureTextureDestroyCount=0,structureSpriteSerial=0,structureTextureSerial=0,structureFrameOwned=false,resourceLimitFallbackCount=0,resourceLimitFallbackReason=null;
  const spriteMaximum=Number.isInteger(structureLimits.sprites)?Math.max(0,structureLimits.sprites):MAX_STRUCTURE_SPRITES;
  const poolMaximum=Number.isInteger(structureLimits.pool)?Math.max(0,Math.min(spriteMaximum,structureLimits.pool)):Math.min(spriteMaximum,MAX_STRUCTURE_POOL);
  const textureMaximum=Number.isInteger(structureLimits.textures)?Math.max(0,structureLimits.textures):MAX_STRUCTURE_TEXTURES;
  const structureTextures=new Map(),activeStructures=new Map();
  const destroyStructureSprite=value=>{ try{ value.destroy({texture:false}); }catch{} };
  const structurePool=createBoundedPool({maximum:spriteMaximum,idleMaximum:poolMaximum,create:()=>new Sprite(Texture.EMPTY),destroy:destroyStructureSprite});
  const capabilities=()=>({structures:!!(healthy&&app?.renderer&&structureLayer&&contextState==='ready')});
  const markUnhealthy=()=>{ healthy=false; };
  const contextLost=event=>{ event.preventDefault(); markUnhealthy(); contextState='lost'; onContextFailure('pixi-context-lost'); };
  const contextRestored=()=>{ contextState='restored'; dirty=true; };
  const destroyTexture=()=>{ if(!texture) return; try{ texture.destroy(true); }catch{} texture=null; textureDestroyCount++; };
  const destroyStructureTexture=entry=>{
    if(!entry) return;
    try{ entry.texture.destroy(true); }catch{}
    try{ entry.canvas.width=0; entry.canvas.height=0; }catch{}
    structureTextureDestroyCount++;
  };
  const releaseStructure=record=>{
    if(!record) return;
    structureLayer?.removeChild(record.sprite);
    const entry=structureTextures.get(record.key); if(entry) entry.refs=Math.max(0,entry.refs-1);
    record.sprite.texture=Texture.EMPTY; record.sprite.alpha=1; record.sprite.scale.set(1); delete record.sprite.__statefall;
    structurePool.release(record.sprite);
  };
  const clearStructures=()=>{
    for(const record of activeStructures.values()) releaseStructure(record);
    activeStructures.clear(); structurePool.drain();
    for(const entry of structureTextures.values()) destroyStructureTexture(entry);
    structureTextures.clear(); structureTotal=0; structureVisible=0; structureCulled=0; structureFrameOwned=false; resourceLimitFallbackReason=null;
  };
  const release=({preserveSource=false}={})=>{
    if(!app&&!canvas&&!world&&!entities&&!effects&&!texture&&!sprite){ if(!preserveSource){ source=null; dirty=false; } return; }
    releaseCount++; markUnhealthy();
    if(canvas){ canvas.removeEventListener('webglcontextlost',contextLost); canvas.removeEventListener('webglcontextrestored',contextRestored); contextListenerCount=0; }
    clearStructures();
    if(sprite){ try{ world?.removeChild(sprite); sprite.destroy({texture:false}); }catch{} sprite=null; }
    destroyTexture();
    try{ if(app?.renderer) app.destroy(true,{children:true,texture:false,textureSource:false}); }catch{}
    canvas?.remove(); app=null; canvas=null; world=null; entities=null; structureLayer=null; effects=null;
    if(!preserveSource){ source=null; dirty=false; }
  };
  const mount=async({stage:nextStage,metrics,failBefore=false,failAfterSetup=false})=>{
    if(failBefore) throw new Error('Pixi initialization disabled by test');
    stage=nextStage; lastMetrics=metrics;
    canvas=document.createElement('canvas'); canvas.className='pixi-world'; canvas.setAttribute('aria-hidden','true');
    stage.insertBefore(canvas,stage.firstChild);
    try{
      app=new Application(); applicationAllocations++;
      await app.init({canvas,width:metrics.cssWidth,height:metrics.cssHeight,resolution:metrics.effectiveDpr,autoDensity:false,antialias:false,backgroundAlpha:1,backgroundColor:0x132a3d,preference:'webgl'});
      rendererAllocations++;
      app.stop(); world=new Container({label:'world-raster'}); entities=new Container({label:'planned-entities'}); structureLayer=new Container({label:'structures'}); effects=new Container({label:'planned-effects'});
      entities.addChild(structureLayer); app.stage.addChild(world,entities,effects); canvas.addEventListener('webglcontextlost',contextLost); canvas.addEventListener('webglcontextrestored',contextRestored); contextListenerCount=2;
      if(failAfterSetup) throw new Error('Pixi failure injected after resource setup');
      contextState='ready'; healthy=true; dirty=!!source;
    }catch(error){ release({preserveSource:true}); contextState='failed'; throw error; }
  };
  const validateIconCanvas=value=>{
    if(!value||typeof value.getContext!=='function'||!Number.isInteger(value.width)||!Number.isInteger(value.height)||value.width<1||value.height<1||!value.getContext('2d')) throw new Error('invalid structure texture canvas');
    return value;
  };
  const evictTexture=()=>{
    let candidate=null;
    for(const [key,entry] of structureTextures) if(entry.refs===0&&(!candidate||entry.used<candidate[1].used)) candidate=[key,entry];
    if(!candidate) return false;
    structureTextures.delete(candidate[0]); destroyStructureTexture(candidate[1]); return true;
  };
  const acquireTexture=(item,createTextureCanvas)=>{
    const key=structureTextureKey(item.type,item.color); let entry=structureTextures.get(key);
    if(!entry){
      if(structureTextures.size>=textureMaximum&&!evictTexture()) return {error:'texture-cap'};
      let iconCanvas,iconTexture;
      try{ iconCanvas=validateIconCanvas(createTextureCanvas(item.type,item.color)); }
      catch{ return {error:'invalid-source'}; }
      try{ iconTexture=Texture.from(iconCanvas); iconTexture.source.scaleMode='linear'; }
      catch{
        try{ iconTexture?.destroy(true); }catch{}
        try{ if(iconCanvas){ iconCanvas.width=0; iconCanvas.height=0; } }catch{}
        return {error:'texture-resource'};
      }
      entry={texture:iconTexture,canvas:iconCanvas,refs:0,used:++textureClock,bytes:iconCanvas.width*iconCanvas.height*4,sourceId:++structureTextureSerial};
      structureTextures.set(key,entry); structureTextureAllocations++;
    }
    entry.refs++; entry.used=++textureClock; return {key,entry,error:null};
  };
  const failStructureFrame=reason=>{
    for(const record of activeStructures.values()) releaseStructure(record);
    activeStructures.clear(); structureVisible=0; structureFrameOwned=false;
    resourceLimitFallbackCount++; resourceLimitFallbackReason=reason;
    return false;
  };
  const updateStructures=state=>{
    structureFrameOwned=false;
    if(!capabilities().structures) return false;
    const items=Array.isArray(state?.items)?state.items:[],camera=state?.camera||{},viewport=state?.viewport||{},fog=state?.fog||null,mapWidth=state?.mapWidth||720;
    if(typeof state?.createTextureCanvas!=='function') throw new Error('missing structure texture canvas callback');
    structureTotal=items.length;
    const visible=[],desired=new Set(),wantedKeys=new Map();
    for(const item of items){
      if(desired.has(item.tile)) continue;
      const visual=structureVisual(item,camera,viewport,fog,mapWidth);
      if(visual){ const key=structureTextureKey(item.type,item.color); desired.add(item.tile); wantedKeys.set(item.tile,key); visible.push({item,visual,key}); }
    }
    structureCulled=Math.max(0,structureTotal-visible.length);
    for(const [tile,record] of activeStructures) if(!desired.has(tile)||record.key!==wantedKeys.get(tile)){ releaseStructure(record); activeStructures.delete(tile); }
    let reservedSprites;
    try{ reservedSprites=structurePool.acquireMany(visible.reduce((count,{item})=>count+(activeStructures.has(item.tile)?0:1),0)); }
    catch{ return failStructureFrame('sprite-resource'); }
    if(!reservedSprites) return failStructureFrame('sprite-cap');
    for(const {item,visual,key:wantedKey} of visible){
      let record=activeStructures.get(item.tile);
      if(!record){
        const icon=acquireTexture(item,state.createTextureCanvas);
        if(icon.error){ for(const held of reservedSprites) structurePool.release(held); return failStructureFrame(icon.error); }
        const nextSprite=reservedSprites.pop();
        if(!nextSprite.__statefallSpriteId) nextSprite.__statefallSpriteId=++structureSpriteSerial;
        nextSprite.anchor.set(0.5); nextSprite.texture=icon.entry.texture;
        record={sprite:nextSprite,key:wantedKey,tile:item.tile,sourceId:icon.entry.sourceId}; activeStructures.set(item.tile,record);
      }
      const baseRadius=Number(state.textureRadius)||24,displayScale=visual.radius*visual.scale/baseRadius;
      record.sprite.position.set(visual.x,visual.y); record.sprite.scale.set(displayScale); record.sprite.alpha=visual.alpha;
      record.sprite.__statefall={spriteId:record.sprite.__statefallSpriteId,textureKey:record.key,sourceId:record.sourceId,tile:item.tile,type:item.type,color:item.color,x:visual.x,y:visual.y,radius:visual.radius,pop:visual.scale,alpha:visual.alpha};
      structureLayer.addChild(record.sprite); structureLayer.setChildIndex(record.sprite,structureLayer.children.length-1);
    }
    structureVisible=activeStructures.size; structureFrameOwned=true; resourceLimitFallbackReason=null;
    return true;
  };
  const structureDiagnostics=()=>{
    const pool=structurePool.diagnostics(),textureBytesEstimate=Array.from(structureTextures.values(),entry=>entry.bytes).reduce((sum,value)=>sum+value,0);
    return {owned:structureFrameOwned,total:structureTotal,visible:structureVisible,culled:structureCulled,pooled:pool.pooled,created:pool.created,reused:pool.reused,destroyed:pool.destroyed,maximum:pool.maximum,textureMaximum,textureCount:structureTextures.size,textureBytesEstimate,textureAllocations:structureTextureAllocations,textureDestroyCount:structureTextureDestroyCount,resourceLimitFallback:{count:resourceLimitFallbackCount,reason:resourceLimitFallbackReason},instances:structureLayer?structureLayer.children.map(child=>child.__statefall):[]};
  };
  return {
    kind:'pixi-hybrid',hybrid:true,
    mount,markUnhealthy,capabilities,
    resize(metrics){
      lastMetrics=metrics; if(!app?.renderer) return;
      app.renderer.resolution=metrics.effectiveDpr; app.renderer.resize(metrics.cssWidth,metrics.cssHeight);
      app.canvas.style.width=`${metrics.cssWidth}px`; app.canvas.style.height=`${metrics.cssHeight}px`;
    },
    updateRaster(nextSource){ source=nextSource; dirty=true; rasterBuildCount++; },
    invalidateRaster(nextSource){ source=nextSource; dirty=true; rasterBuildCount++; },
    updateWorldLayer(layer,state){ return layer==='structures'?updateStructures(typeof state==='function'?state():state):false; },
    renderFrame(camera){
      if(!app||contextState==='lost') return;
      if(source&&!texture){ texture=Texture.from(source); textureAllocations++; texture.source.scaleMode='nearest'; sprite=new Sprite(texture); world.addChild(sprite); }
      if(dirty&&texture){ texture.source.update(); rasterUploadCount++; dirty=false; }
      if(sprite){ sprite.position.set(camera.x,camera.y); sprite.scale.set(camera.s); }
      app.render();
    },
    suspend(){},
    async resume(metrics=lastMetrics){
      resumeCount++;
      if(failResumeAt&&resumeCount===failResumeAt){ release({preserveSource:true}); contextState='restoring'; await mount({stage,metrics,failAfterSetup:true}); }
      const currentCanvas=app?.canvas,valid=app&&currentCanvas?.isConnected&&contextState!=='lost'&&app.renderer?.gl;
      if(!valid){ release({preserveSource:true}); contextState='restoring'; await mount({stage,metrics}); }
      this.resize(metrics); contextState='ready'; healthy=true;
    },
    reset(){
      clearStructures();
      if(sprite){ world.removeChild(sprite); sprite.destroy({texture:false}); sprite=null; }
      destroyTexture(); source=null; dirty=false;
    },
    destroy(){ release(); contextState='destroyed'; },
    diagnostics(){
      const structures=structureDiagnostics();
      return {rasterBuildCount,rasterUploadCount,textureCount:(texture?1:0)+structures.textureCount,spriteCount:(sprite?1:0)+structures.visible+structures.pooled,containerCount:app?4:0,canvasCount:canvas?1:0,contextListenerCount,contextState,resumeCount,applicationAllocations,rendererAllocations,textureAllocations,releaseCount,textureDestroyCount,capabilities:capabilities(),layers:{terrain:{owned:!!(healthy&&texture),textureCount:texture?1:0,spriteCount:sprite?1:0},structures}};
    }
  };
}
