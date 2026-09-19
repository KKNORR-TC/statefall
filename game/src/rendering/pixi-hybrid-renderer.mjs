import {Application,Container,Graphics,Sprite,Texture} from 'pixi.js';
import {MAX_STRUCTURE_POOL,MAX_STRUCTURE_SPRITES,MAX_STRUCTURE_TEXTURES,createBoundedPool,structureBasePaintBounds,structureTextureKey,structureVisual} from './structure-layer-model.mjs';
import {MAX_PRE_STRUCTURE_PRIMITIVES,MAX_PRE_STRUCTURE_SEGMENTS,createPreStructureScene} from './pre-structure-layer-model.mjs';

export function createPixiHybridRenderer({onContextFailure=()=>{},failResumeAt=0,structureLimits={},preStructureLimits={},quality='high',requestedQuality=quality,reducedMotion=false,failGraphics=false}={}){
  let app=null,canvas=null,world=null,entities=null,frontsGraphics=null,routesGraphics=null,structureLayer=null,effects=null,texture=null,sprite=null,source=null,dirty=false,stage=null,lastMetrics=null,healthy=false;
  let rasterBuildCount=0,rasterUploadCount=0,contextState='initializing',contextListenerCount=0,resumeCount=0;
  let applicationAllocations=0,rendererAllocations=0,textureAllocations=0,releaseCount=0,textureDestroyCount=0,textureClock=0;
  let structureTotal=0,structureVisible=0,structureCulled=0,structureTextureAllocations=0,structureTextureDestroyCount=0,structureSpriteSerial=0,structureTextureSerial=0,structureFrameOwned=false,resourceLimitFallbackCount=0,resourceLimitFallbackReason=null;
  let preStructureFrameOwned=false,preStructureFallbackCount=0,preStructureFallbackReason=null,preStructureScene=null,compositingConflictFallbackCount=0,compositingConflictFallbackReason=null,compositingConflictFallbackDetail=null;
  const spriteMaximum=Number.isInteger(structureLimits.sprites)?Math.max(0,structureLimits.sprites):MAX_STRUCTURE_SPRITES;
  const poolMaximum=Number.isInteger(structureLimits.pool)?Math.max(0,Math.min(spriteMaximum,structureLimits.pool)):Math.min(spriteMaximum,MAX_STRUCTURE_POOL);
  const textureMaximum=Number.isInteger(structureLimits.textures)?Math.max(0,structureLimits.textures):MAX_STRUCTURE_TEXTURES;
  const primitiveMaximum=Number.isInteger(preStructureLimits.primitives)?Math.max(0,preStructureLimits.primitives):MAX_PRE_STRUCTURE_PRIMITIVES;
  const segmentMaximum=Number.isInteger(preStructureLimits.segments)?Math.max(0,preStructureLimits.segments):MAX_PRE_STRUCTURE_SEGMENTS;
  const structureTextures=new Map(),activeStructures=new Map();
  const destroyStructureEntry=value=>{ try{ value.graphics.destroy(); }catch{} try{ value.sprite.destroy({texture:false}); }catch{} };
  const structurePool=createBoundedPool({maximum:spriteMaximum,idleMaximum:poolMaximum,create:()=>({graphics:new Graphics(),sprite:new Sprite(Texture.EMPTY)}),destroy:destroyStructureEntry});
  const capabilities=()=>({preStructures:!!(healthy&&app?.renderer&&frontsGraphics&&routesGraphics&&contextState==='ready'),structures:!!(healthy&&app?.renderer&&structureLayer&&contextState==='ready')});
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
    structureLayer?.removeChild(record.graphics); structureLayer?.removeChild(record.sprite);
    const textureEntry=structureTextures.get(record.key); if(textureEntry) textureEntry.refs=Math.max(0,textureEntry.refs-1);
    record.graphics.clear(); record.sprite.texture=Texture.EMPTY; record.sprite.visible=true; record.sprite.alpha=1; record.sprite.scale.set(1); delete record.sprite.__statefall;
    record.key=null; record.sourceId=null; structurePool.release(record);
  };
  const clearStructures=()=>{
    for(const record of activeStructures.values()) releaseStructure(record);
    activeStructures.clear(); structurePool.drain();
    for(const entry of structureTextures.values()) destroyStructureTexture(entry);
    structureTextures.clear(); structureTotal=0; structureVisible=0; structureCulled=0; structureFrameOwned=false; resourceLimitFallbackReason=null;
  };
  const clearPreStructures=()=>{
    try{ frontsGraphics?.clear(); routesGraphics?.clear(); for(const record of activeStructures.values()) record.graphics.clear(); }catch{}
    preStructureFrameOwned=false; preStructureScene=null; preStructureFallbackReason=null; compositingConflictFallbackReason=null; compositingConflictFallbackDetail=null;
  };
  const release=({preserveSource=false}={})=>{
    if(!app&&!canvas&&!world&&!entities&&!effects&&!texture&&!sprite){ if(!preserveSource){ source=null; dirty=false; } return; }
    releaseCount++; markUnhealthy();
    if(canvas){ canvas.removeEventListener('webglcontextlost',contextLost); canvas.removeEventListener('webglcontextrestored',contextRestored); contextListenerCount=0; }
    clearPreStructures(); clearStructures();
    if(sprite){ try{ world?.removeChild(sprite); sprite.destroy({texture:false}); }catch{} sprite=null; }
    destroyTexture();
    try{ if(app?.renderer) app.destroy(true,{children:true,texture:false,textureSource:false}); }catch{}
    canvas?.remove(); app=null; canvas=null; world=null; entities=null; frontsGraphics=null; routesGraphics=null; structureLayer=null; effects=null;
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
       app.stop(); world=new Container({label:'world-raster'}); entities=new Container({label:'entities'}); frontsGraphics=new Graphics({label:'fronts'}); routesGraphics=new Graphics({label:'routes'}); structureLayer=new Container({label:'structures'}); effects=new Container({label:'planned-effects'});
       entities.addChild(frontsGraphics,routesGraphics,structureLayer); app.stage.addChild(world,entities,effects); canvas.addEventListener('webglcontextlost',contextLost); canvas.addEventListener('webglcontextrestored',contextRestored); contextListenerCount=2;
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
    if(preStructureFrameOwned){ clearPreStructures(); preStructureFallbackCount++; preStructureFallbackReason=`structure-${reason}`; }
    resourceLimitFallbackCount++; resourceLimitFallbackReason=reason;
    return false;
  };
  const withdrawStructureFrame=()=>{
    for(const record of activeStructures.values()) releaseStructure(record);
    activeStructures.clear(); structureVisible=0; structureFrameOwned=false; return false;
  };
  const paintStroke=(graphics,primitive)=>graphics.stroke({color:primitive.stroke,width:primitive.width,alpha:primitive.alpha??1,cap:'butt',join:'miter'});
  const appendSegment=(graphics,segment)=>{
    if(segment.kind==='rect') graphics.rect(segment.x,segment.y,segment.width,segment.height);
    else if(segment.kind==='circle') graphics.circle(segment.x,segment.y,segment.r);
    else if(segment.kind==='line') graphics.moveTo(segment.x1,segment.y1).lineTo(segment.x2,segment.y2);
    else if(segment.kind==='arc') graphics.moveTo(segment.x+Math.cos(segment.start)*segment.r,segment.y+Math.sin(segment.start)*segment.r).arc(segment.x,segment.y,segment.r,segment.start,segment.end);
    else throw new TypeError('unknown generated Graphics segment');
  };
  const drawPrimitive=(graphics,primitive)=>{
    const generated=primitive.graphicsSegments;
    if(primitive.dash){
      const fillSegments=generated.filter(segment=>segment.paint==='fill'),strokeSegments=generated.filter(segment=>segment.paint!=='fill');
      for(const segment of fillSegments) appendSegment(graphics,segment);
      if(fillSegments.length&&primitive.fill) graphics.fill({color:primitive.fill,alpha:primitive.alpha??1});
      for(const segment of strokeSegments) appendSegment(graphics,segment);
      if(strokeSegments.length&&primitive.stroke) paintStroke(graphics,primitive);
      return;
    }
    for(const segment of generated) appendSegment(graphics,segment);
    if(primitive.fill) graphics.fill({color:primitive.fill,alpha:primitive.alpha??1});
    if(primitive.stroke) paintStroke(graphics,primitive);
  };
  const failPreStructureFrame=reason=>{
    clearPreStructures();
    for(const record of activeStructures.values()) releaseStructure(record);
    activeStructures.clear(); structureVisible=0; structureFrameOwned=false;
    preStructureFallbackCount++; preStructureFallbackReason=reason; return false;
  };
  const updatePreStructures=state=>{
    clearPreStructures();
    if(!capabilities().preStructures) return false;
    try{
      const scene=createPreStructureScene({...state,quality,reducedMotion},{primitiveLimit:primitiveMaximum,segmentLimit:segmentMaximum});
      if(scene.compositingConflict){
        withdrawStructureFrame(); compositingConflictFallbackCount++; compositingConflictFallbackReason=scene.compositingConflict.reason; compositingConflictFallbackDetail=scene.compositingConflict; return false;
      }
      if(failGraphics) throw new Error('graphics-resource');
      for(const primitive of scene.fronts) drawPrimitive(frontsGraphics,primitive);
      for(const primitive of scene.routes) drawPrimitive(routesGraphics,primitive);
      preStructureScene=scene; preStructureFrameOwned=true; preStructureFallbackReason=null; return true;
    }catch(error){ const reason=['primitive-cap','segment-cap','graphics-resource'].find(value=>String(error?.message||error).includes(value))||'model-resource'; return failPreStructureFrame(reason); }
  };
  const updateStructures=state=>{
    structureFrameOwned=false;
    const items=Array.isArray(state?.items)?state.items:[];
    if(!capabilities().structures||!preStructureFrameOwned){
      if(compositingConflictFallbackReason){ structureTotal=items.length; structureCulled=0; return withdrawStructureFrame(); }
      return failStructureFrame(preStructureFallbackReason?'pre-structure-fallback':'pre-structure-unowned');
    }
    const camera=state?.camera||{},viewport=state?.viewport||{},fog=state?.fog||null,mapWidth=state?.mapWidth||720;
    if(typeof state?.createTextureCanvas!=='function') throw new Error('missing structure texture canvas callback');
    structureTotal=items.length;
    const visible=[],desired=new Set(),wantedKeys=new Map(),preByTile=new Map((preStructureScene?.structureEntries||[]).map(entry=>[entry.tile,entry]));
    for(const item of items){
      if(desired.has(item.tile)) continue;
      const visual=structureVisual(item,camera,viewport,fog,mapWidth);
      const pre=preByTile.get(item.tile)||null;
      if(visual||pre){ const key=structureTextureKey(item.type,item.color); desired.add(item.tile); wantedKeys.set(item.tile,key); visible.push({item,visual,pre,key}); }
    }
    structureCulled=Math.max(0,structureTotal-visible.filter(entry=>entry.visual).length);
    for(const [tile,record] of activeStructures) if(!desired.has(tile)||(record.key&&record.key!==wantedKeys.get(tile))){ releaseStructure(record); activeStructures.delete(tile); }
    let reservedEntries;
    try{ reservedEntries=structurePool.acquireMany(visible.reduce((count,{item})=>count+(activeStructures.has(item.tile)?0:1),0)); }
    catch{ return failStructureFrame('sprite-resource'); }
    if(!reservedEntries) return failStructureFrame('sprite-cap');
    for(const {item,visual,pre,key:wantedKey} of visible){
      let record=activeStructures.get(item.tile);
      if(!record){
        record=reservedEntries.pop(); record.tile=item.tile;
        if(!record.sprite.__statefallSpriteId) record.sprite.__statefallSpriteId=++structureSpriteSerial;
        record.sprite.anchor.set(0.5); activeStructures.set(item.tile,record);
      }
      record.graphics.clear(); for(const primitive of pre?.primitives||[]) drawPrimitive(record.graphics,primitive);
      if(visual){
        if(!record.key){
          const icon=acquireTexture(item,state.createTextureCanvas);
          if(icon.error){ for(const held of reservedEntries) structurePool.release(held); return failStructureFrame(icon.error); }
          record.key=wantedKey; record.sourceId=icon.entry.sourceId; record.sprite.texture=icon.entry.texture;
        }
        const baseRadius=Number(state.textureRadius)||24,displayScale=visual.radius*visual.scale/baseRadius;
        record.sprite.visible=true; record.sprite.position.set(visual.x,visual.y); record.sprite.scale.set(displayScale); record.sprite.alpha=visual.alpha;
        record.sprite.__statefall={spriteId:record.sprite.__statefallSpriteId,textureKey:record.key,sourceId:record.sourceId,tile:item.tile,type:item.type,color:item.color,x:visual.x,y:visual.y,radius:visual.radius,pop:visual.scale,alpha:visual.alpha,paintBounds:structureBasePaintBounds(item.type,visual.x,visual.y,visual.radius*visual.scale)};
      }else{
        const textureEntry=structureTextures.get(record.key); if(textureEntry) textureEntry.refs=Math.max(0,textureEntry.refs-1);
        record.key=null; record.sourceId=null; record.sprite.texture=Texture.EMPTY; record.sprite.visible=false; delete record.sprite.__statefall;
      }
      structureLayer.addChild(record.graphics,record.sprite);
    }
    for(const held of reservedEntries) structurePool.release(held);
    structureVisible=visible.filter(entry=>entry.visual).length; structureFrameOwned=true; resourceLimitFallbackReason=null;
    return true;
  };
  const structureDiagnostics=()=>{
    const pool=structurePool.diagnostics(),textureBytesEstimate=Array.from(structureTextures.values(),entry=>entry.bytes).reduce((sum,value)=>sum+value,0);
    const records=Array.from(activeStructures.values());
    return {owned:structureFrameOwned,total:structureTotal,visible:structureVisible,culled:structureCulled,entries:records.length,pooled:pool.pooled,created:pool.created,reused:pool.reused,destroyed:pool.destroyed,maximum:pool.maximum,entryGraphicsCount:records.length,entrySpriteCount:records.length,pooledGraphicsCount:pool.pooled,pooledSpriteCount:pool.pooled,textureMaximum,textureCount:structureTextures.size,textureBytesEstimate,textureAllocations:structureTextureAllocations,textureDestroyCount:structureTextureDestroyCount,resourceLimitFallback:{count:resourceLimitFallbackCount,reason:resourceLimitFallbackReason},order:records.map(record=>({tile:record.tile,children:['pre-base-graphics','base-sprite'],baseVisible:record.sprite.visible})),instances:records.map(record=>record.sprite.__statefall).filter(Boolean)};
  };
  const preStructureDiagnostics=()=>{
    const scene=preStructureScene,segments=values=>(values||[]).reduce((sum,value)=>sum+value.graphicsSegments.length,0);
    return {owned:preStructureFrameOwned,order:['fronts','routes','structure-entry[pre-base-graphics,base-sprite]'],quality:{requested:requestedQuality,effective:quality},reducedMotion,primitiveMaximum,segmentMaximum,primitiveCount:scene?.primitiveCount||0,segmentCount:scene?.segmentCount||0,emittedSegmentCount:scene?.emittedSegmentCount||0,segmentCounts:{fronts:segments(scene?.fronts),routes:segments(scene?.routes),structureEntries:segments(scene?.rangesStatus)},counts:scene?.counts||null,globalGraphicsCount:frontsGraphics?2:0,entryGraphicsCount:activeStructures.size,graphicsCount:(frontsGraphics?2:0)+activeStructures.size,presentation:scene?{fronts:scene.fronts.map(({x,y,width,height,fill,alpha,graphicsSegments})=>({x,y,width,height,fill,alpha,segmentCount:graphicsSegments.length})),markers:scene.routes.filter(value=>value.kind==='circle'&&value.fill).map(value=>({x:value.x,y:value.y,r:value.r,color:value.fill})),dashedRoutes:scene.routes.filter(value=>value.dash).map(value=>({kind:value.kind,x:value.x,y:value.y,r:value.r,stroke:value.stroke,dash:value.dash,phase:value.phase,segmentCount:value.graphicsSegments.length,segments:value.graphicsSegments,first:value.graphicsSegments[0]||null,middle:value.graphicsSegments[Math.floor(value.graphicsSegments.length/2)]||null,last:value.graphicsSegments.at(-1)||null})),structureEntries:scene.structureEntries.map(entry=>({tile:entry.tile,segmentCount:segments(entry.primitives),primitives:entry.primitives.map(({kind,x,y,r,stroke,fill,width,graphicsSegments})=>({kind,x,y,r,stroke,fill,width,segmentCount:graphicsSegments.length}))}))}:null,resourceLimitFallback:{count:preStructureFallbackCount,reason:preStructureFallbackReason},compositingConflictFallback:{count:compositingConflictFallbackCount,reason:compositingConflictFallbackReason,detail:compositingConflictFallbackDetail}};
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
    motionState(time=performance.now()){ return {time:reducedMotion?0:Number(time)||0,reducedMotion}; },
    updateWorldLayer(layer,state){ const value=typeof state==='function'?state():state; return layer==='pre-structures'?updatePreStructures(value):layer==='structures'?updateStructures(value):false; },
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
      clearPreStructures(); clearStructures();
      if(sprite){ world.removeChild(sprite); sprite.destroy({texture:false}); sprite=null; }
      destroyTexture(); source=null; dirty=false;
    },
    destroy(){ release(); contextState='destroyed'; },
    diagnostics(){
      const structures=structureDiagnostics();
      return {rasterBuildCount,rasterUploadCount,textureCount:(texture?1:0)+structures.textureCount,spriteCount:(sprite?1:0)+structures.entries+structures.pooled,graphicsCount:(frontsGraphics?2:0)+structures.entries+structures.pooled,containerCount:app?6:0,canvasCount:canvas?1:0,contextListenerCount,contextState,resumeCount,applicationAllocations,rendererAllocations,textureAllocations,releaseCount,textureDestroyCount,quality:{requested:requestedQuality,effective:quality},reducedMotion,motion:{clock:reducedMotion?'frozen':'monotonic',frozenTime:reducedMotion?0:null},capabilities:capabilities(),compositingConflictFallback:{count:compositingConflictFallbackCount,reason:compositingConflictFallbackReason,detail:compositingConflictFallbackDetail},layers:{terrain:{owned:!!(healthy&&texture),textureCount:texture?1:0,spriteCount:sprite?1:0},preStructures:preStructureDiagnostics(),structures}};
    }
  };
}
