import {Application,CanvasSource,Container,Graphics,Rectangle,Sprite,Texture} from 'pixi.js';
import {MAX_STRUCTURE_POOL,MAX_STRUCTURE_SPRITES,MAX_STRUCTURE_TEXTURES,MAX_STRUCTURE_TEXT_POOL,createBoundedPool,structureBasePaintBounds,structureTextureKey,structureVisual} from './structure-layer-model.mjs';
import {MAX_PRE_STRUCTURE_PRIMITIVES,MAX_PRE_STRUCTURE_SEGMENTS,MAX_STRUCTURE_TEXTS,createPreStructureScene} from './pre-structure-layer-model.mjs';
import {MAX_NAVAL_CONTAINERS,MAX_NAVAL_GRAPHICS,MAX_NAVAL_IDLE_CONTAINERS,MAX_NAVAL_IDLE_GRAPHICS,MAX_NAVAL_IDLE_LABELS,MAX_NAVAL_LABEL_RESOURCES,createNavalLogisticsScene} from './naval-logistics-model.mjs';
import {MAX_WARSHIP_CONTAINERS,MAX_WARSHIP_GRAPHICS,MAX_WARSHIP_IDLE_CONTAINERS,MAX_WARSHIP_IDLE_GRAPHICS,MAX_WARSHIP_IDLE_LABELS,MAX_WARSHIP_LABEL_RESOURCES,createWarshipScene} from './warship-layer-model.mjs';
import {MAX_PROJECTILE_CONTAINERS,MAX_PROJECTILE_GRAPHICS,MAX_PROJECTILE_IDLE_CONTAINERS,MAX_PROJECTILE_IDLE_GRAPHICS,createProjectileModel} from './projectile-layer-model.mjs';
import {MAX_MISSILE_CONTAINERS,MAX_MISSILE_GRAPHICS,MAX_MISSILE_IDLE_CONTAINERS,MAX_MISSILE_IDLE_GRAPHICS,createMissileModel} from './missile-layer-model.mjs';
import {MAX_AIRCRAFT_CONTAINERS,MAX_AIRCRAFT_GRAPHICS,MAX_AIRCRAFT_IDLE_CONTAINERS,MAX_AIRCRAFT_IDLE_GRAPHICS,createAircraftModel} from './aircraft-layer-model.mjs';

export function createPixiHybridRenderer({onContextFailure=()=>{},failResumeAt=0,structureLimits={},preStructureLimits={},navalLimits={},warshipLimits={},projectileLimits={},missileLimits={},aircraftLimits={},quality='high',requestedQuality=quality,reducedMotion=false,failGraphics=false,failText=false,testMode=false}={}){
  let app=null,canvas=null,world=null,entities=null,frontsGraphics=null,routesGraphics=null,structureLayer=null,navalLayer=null,warshipLayer=null,projectileLayer=null,missileLayer=null,aircraftLayer=null,effects=null,texture=null,sprite=null,source=null,dirty=false,stage=null,lastMetrics=null,healthy=false;
  let rasterBuildCount=0,rasterUploadCount=0,contextState='initializing',contextListenerCount=0,resumeCount=0;
  let applicationAllocations=0,rendererAllocations=0,textureAllocations=0,releaseCount=0,textureDestroyCount=0,textureClock=0;
  let structureTotal=0,structureVisible=0,structureCulled=0,structureTextureAllocations=0,structureTextureDestroyCount=0,structureSpriteSerial=0,structureTextureSerial=0,structureFrameOwned=false,resourceLimitFallbackCount=0,resourceLimitFallbackReason=null;
  let preStructureFrameOwned=false,preStructureFallbackCount=0,preStructureFallbackReason=null,preStructureScene=null;
  let navalFrameOwned=false,navalFallbackCount=0,navalFallbackReason=null,navalScene=null,navalIdentitySerial=0,navalLabelRasterUpdates=0,navalLabelSourceBytes=0;
  let warshipFrameOwned=false,warshipFallbackCount=0,warshipFallbackReason=null,warshipScene=null,warshipLabelRasterUpdates=0,warshipLabelSourceBytes=0;
  let projectileFrameOwned=false,projectileFallbackCount=0,projectileFallbackReason=null,projectileScene=null,failFinalRenderRemaining=0,failWorldLayerRemaining=0;
  let missileFrameOwned=false,missileFallbackCount=0,missileFallbackReason=null,missileScene=null;
  let aircraftFrameOwned=false,aircraftFallbackCount=0,aircraftFallbackReason=null,aircraftScene=null;
  const spriteMaximum=Number.isInteger(structureLimits.sprites)?Math.max(0,structureLimits.sprites):MAX_STRUCTURE_SPRITES;
  const poolMaximum=Number.isInteger(structureLimits.pool)?Math.max(0,Math.min(spriteMaximum,structureLimits.pool)):Math.min(spriteMaximum,MAX_STRUCTURE_POOL);
  const textureMaximum=Number.isInteger(structureLimits.textures)?Math.max(0,structureLimits.textures):MAX_STRUCTURE_TEXTURES;
  const textMaximum=Number.isInteger(structureLimits.texts)?Math.max(0,structureLimits.texts):MAX_STRUCTURE_TEXTS;
  const textPoolMaximum=Math.min(textMaximum,MAX_STRUCTURE_TEXT_POOL);
  const primitiveMaximum=Number.isInteger(preStructureLimits.primitives)?Math.max(0,preStructureLimits.primitives):MAX_PRE_STRUCTURE_PRIMITIVES;
  const segmentMaximum=Number.isInteger(preStructureLimits.segments)?Math.max(0,preStructureLimits.segments):MAX_PRE_STRUCTURE_SEGMENTS;
  const structureTextures=new Map(),activeStructures=new Map();
  const activeNaval=new Map(),navalIdentities=new WeakMap(),activeWarships=new Map(),activeProjectiles=new Map(),projectileModel=createProjectileModel(),activeMissiles=new Map(),missileModel=createMissileModel(),activeAircraft=new Map(),aircraftModel=createAircraftModel();
  const graphicsMaximum=Math.min(primitiveMaximum,spriteMaximum*9),graphicsPoolMaximum=Math.min(graphicsMaximum,MAX_STRUCTURE_TEXT_POOL*2);
  let failEntryCreateRemaining=structureLimits.failEntryCreate?1:0,failGraphicsCreateRemaining=failGraphics?1:0,failLabelCreateRemaining=failText?1:0,failStructureGraphicsAfterAppend=0,failStructureLabelAfterPaint=0,failStructureContainerAfterAppend=0,labelRasterUpdates=0,labelTextureSourceBytes=0;
  const destroyGraphics=value=>{ try{ value.destroy(); }catch{} };
  const graphicsPool=createBoundedPool({maximum:graphicsMaximum,idleMaximum:graphicsPoolMaximum,create:()=>{ const value=new Graphics({label:'structure-graphics'}); if(failGraphicsCreateRemaining){ failGraphicsCreateRemaining--; value.destroy(); throw new Error('graphics-resource'); } return value; },destroy:destroyGraphics});
  const destroyLabel=value=>{ labelTextureSourceBytes-=value.bytes||0; try{ value.sprite.destroy({texture:false}); }catch{} try{ value.texture.destroy(true); }catch{} try{ value.canvas.width=0; value.canvas.height=0; }catch{} };
  const labelPool=createBoundedPool({maximum:textMaximum,idleMaximum:textPoolMaximum,create:()=>{ const canvas=document.createElement('canvas'); canvas.width=1; canvas.height=1; const source=new CanvasSource({resource:canvas,resolution:1,autoDensity:false,antialias:false}),texture=new Texture({source}),sprite=new Sprite(texture),value={canvas,texture,sprite,bytes:4}; labelTextureSourceBytes+=4; if(failLabelCreateRemaining){ failLabelCreateRemaining--; destroyLabel(value); throw new Error('text-resource'); } return value; },destroy:destroyLabel});
  const recycleGraphics=(pool,value)=>{ try{ value.removeFromParent(); value.clear(); delete value.__statefall; pool.release(value); }catch{ pool.discard(value); } };
  const recycleLabel=(pool,value)=>{ try{ value.sprite.removeFromParent(); value.sprite.visible=false; delete value.sprite.__statefall; pool.release(value); }catch{ pool.discard(value); } };
  const discardGraphics=(pool,value)=>{ try{ value.removeFromParent(); }catch{} pool.discard(value); };
  const discardLabel=(pool,value)=>{ try{ value.sprite.removeFromParent(); }catch{} pool.discard(value); };
  const releaseEntryChildren=record=>{ for(const value of record.graphics) recycleGraphics(graphicsPool,value); for(const value of record.labels) recycleLabel(labelPool,value); record.graphics.length=0; record.labels.length=0; };
  const destroyStructureEntry=value=>{ releaseEntryChildren(value); try{ value.sprite.destroy({texture:false}); }catch{} try{ value.container.destroy({children:false}); }catch{} };
  const structurePool=createBoundedPool({maximum:spriteMaximum,idleMaximum:poolMaximum,create:()=>{ const container=new Container({label:'structure-entry'}),sprite=new Sprite(Texture.EMPTY); if(failEntryCreateRemaining){ failEntryCreateRemaining--; container.destroy({children:false}); sprite.destroy({texture:false}); throw new Error('sprite-resource'); } return {container,sprite,graphics:[],labels:[]}; },destroy:destroyStructureEntry});
  const navalContainerMaximum=Number.isInteger(navalLimits.containers)?Math.max(0,navalLimits.containers):MAX_NAVAL_CONTAINERS,navalGraphicsMaximum=Number.isInteger(navalLimits.graphics)?Math.max(0,navalLimits.graphics):MAX_NAVAL_GRAPHICS,navalLabelMaximum=Number.isInteger(navalLimits.labels)?Math.max(0,navalLimits.labels):MAX_NAVAL_LABEL_RESOURCES;
  let failNavalContainerRemaining=navalLimits.failContainerCreate?1:0,failNavalGraphicsRemaining=navalLimits.failGraphicsCreate?1:0,failNavalLabelRemaining=navalLimits.failLabelCreate?1:0,failNavalGraphicsAfterAppend=0,failNavalLabelAfterPaint=0,failNavalContainerAfterAppend=0;
  const releaseNavalChildren=record=>{ for(const value of record.graphics) recycleGraphics(navalGraphicsPool,value); for(const value of record.labels) recycleLabel(navalLabelPool,value); record.graphics.length=0; record.labels.length=0; };
  const destroyNavalLabel=value=>{ navalLabelSourceBytes-=value.bytes||0; try{ value.sprite.destroy({texture:false}); }catch{} try{ value.texture.destroy(true); }catch{} try{ value.canvas.width=0; value.canvas.height=0; }catch{} };
  const navalGraphicsPool=createBoundedPool({maximum:navalGraphicsMaximum,idleMaximum:Math.min(navalGraphicsMaximum,MAX_NAVAL_IDLE_GRAPHICS),create:()=>{ const value=new Graphics({label:'naval-graphics'}); if(failNavalGraphicsRemaining){ failNavalGraphicsRemaining--; value.destroy(); throw new Error('graphics-resource'); } return value; },destroy:destroyGraphics});
  const navalLabelPool=createBoundedPool({maximum:navalLabelMaximum,idleMaximum:Math.min(navalLabelMaximum,MAX_NAVAL_IDLE_LABELS),create:()=>{ const canvas=document.createElement('canvas'); canvas.width=1; canvas.height=1; const source=new CanvasSource({resource:canvas,resolution:1,autoDensity:false,antialias:false}),texture=new Texture({source}),sprite=new Sprite(texture),value={canvas,texture,sprite,bytes:4}; navalLabelSourceBytes+=4; if(failNavalLabelRemaining){ failNavalLabelRemaining--; destroyNavalLabel(value); throw new Error('label-resource'); } return value; },destroy:destroyNavalLabel});
  const navalPool=createBoundedPool({maximum:navalContainerMaximum,idleMaximum:Math.min(navalContainerMaximum,MAX_NAVAL_IDLE_CONTAINERS),create:()=>{ const value={container:new Container({label:'naval-entry'}),graphics:[],labels:[]}; if(failNavalContainerRemaining){ failNavalContainerRemaining--; value.container.destroy({children:false}); throw new Error('container-resource'); } return value; },destroy:value=>{ releaseNavalChildren(value); try{ value.container.destroy({children:false}); }catch{} }});
  const warshipContainerMaximum=Number.isInteger(warshipLimits.containers)?Math.max(0,warshipLimits.containers):MAX_WARSHIP_CONTAINERS,warshipGraphicsMaximum=Number.isInteger(warshipLimits.graphics)?Math.max(0,warshipLimits.graphics):MAX_WARSHIP_GRAPHICS,warshipLabelMaximum=Number.isInteger(warshipLimits.labels)?Math.max(0,warshipLimits.labels):MAX_WARSHIP_LABEL_RESOURCES;
  let failWarshipContainerRemaining=warshipLimits.failContainerCreate?1:0,failWarshipGraphicsRemaining=warshipLimits.failGraphicsCreate?1:0,failWarshipLabelRemaining=warshipLimits.failLabelCreate?1:0,failWarshipGraphicsAfterAppend=0,failWarshipLabelAfterPaint=0,failWarshipContainerAfterAppend=0;
  const releaseWarshipChildren=record=>{ for(const value of record.graphics) recycleGraphics(warshipGraphicsPool,value); for(const value of record.labels) recycleLabel(warshipLabelPool,value); record.graphics.length=0; record.labels.length=0; };
  const destroyWarshipLabel=value=>{ warshipLabelSourceBytes-=value.bytes||0; try{ value.sprite.destroy({texture:false}); }catch{} try{ value.texture.destroy(true); }catch{} try{ value.canvas.width=0; value.canvas.height=0; }catch{} };
  const warshipGraphicsPool=createBoundedPool({maximum:warshipGraphicsMaximum,idleMaximum:Math.min(warshipGraphicsMaximum,MAX_WARSHIP_IDLE_GRAPHICS),create:()=>{ const value=new Graphics({label:'warship-graphics'}); if(failWarshipGraphicsRemaining){ failWarshipGraphicsRemaining--; value.destroy(); throw new Error('graphics-resource'); } return value; },destroy:destroyGraphics});
  const warshipLabelPool=createBoundedPool({maximum:warshipLabelMaximum,idleMaximum:Math.min(warshipLabelMaximum,MAX_WARSHIP_IDLE_LABELS),create:()=>{ const canvas=document.createElement('canvas'); canvas.width=1; canvas.height=1; const source=new CanvasSource({resource:canvas,resolution:1,autoDensity:false,antialias:false}),texture=new Texture({source}),sprite=new Sprite(texture),value={canvas,texture,sprite,bytes:4}; warshipLabelSourceBytes+=4; if(failWarshipLabelRemaining){ failWarshipLabelRemaining--; destroyWarshipLabel(value); throw new Error('label-resource'); } return value; },destroy:destroyWarshipLabel});
  const warshipPool=createBoundedPool({maximum:warshipContainerMaximum,idleMaximum:Math.min(warshipContainerMaximum,MAX_WARSHIP_IDLE_CONTAINERS),create:()=>{ const value={container:new Container({label:'warship-entry'}),graphics:[],labels:[]}; if(failWarshipContainerRemaining){ failWarshipContainerRemaining--; value.container.destroy({children:false}); throw new Error('container-resource'); } return value; },destroy:value=>{ releaseWarshipChildren(value); try{ value.container.destroy({children:false}); }catch{} }});
  const projectileContainerMaximum=Number.isInteger(projectileLimits.containers)?Math.max(0,projectileLimits.containers):MAX_PROJECTILE_CONTAINERS,projectileGraphicsMaximum=Number.isInteger(projectileLimits.graphics)?Math.max(0,projectileLimits.graphics):MAX_PROJECTILE_GRAPHICS;
  let failProjectileContainerRemaining=projectileLimits.failContainerCreate?1:0,failProjectileGraphicsRemaining=projectileLimits.failGraphicsCreate?1:0,failProjectileGraphicsAfterPaint=0,failProjectileContainerAfterAppend=0;
  const projectileGraphicsPool=createBoundedPool({maximum:projectileGraphicsMaximum,idleMaximum:Math.min(projectileGraphicsMaximum,MAX_PROJECTILE_IDLE_GRAPHICS),create:()=>{ const value=new Graphics({label:'projectile-graphics'}); if(failProjectileGraphicsRemaining){ failProjectileGraphicsRemaining--; value.destroy(); throw new Error('graphics-resource'); } return value; },destroy:destroyGraphics});
  const releaseProjectileChildren=record=>{ for(const value of record.graphics) recycleGraphics(projectileGraphicsPool,value); record.graphics.length=0; };
  const projectilePool=createBoundedPool({maximum:projectileContainerMaximum,idleMaximum:Math.min(projectileContainerMaximum,MAX_PROJECTILE_IDLE_CONTAINERS),create:()=>{ const value={container:new Container({label:'projectile-entry'}),graphics:[]}; if(failProjectileContainerRemaining){ failProjectileContainerRemaining--; value.container.destroy({children:false}); throw new Error('container-resource'); } return value; },destroy:value=>{ releaseProjectileChildren(value); try{ value.container.destroy({children:false}); }catch{} }});
  const missileContainerMaximum=Number.isInteger(missileLimits.containers)?Math.max(0,missileLimits.containers):MAX_MISSILE_CONTAINERS,missileGraphicsMaximum=Number.isInteger(missileLimits.graphics)?Math.max(0,missileLimits.graphics):MAX_MISSILE_GRAPHICS;
  let failMissileContainerRemaining=missileLimits.failContainerCreate?1:0,failMissileGraphicsRemaining=missileLimits.failGraphicsCreate?1:0,failMissileGraphicsAfterPaint=0,failMissileContainerAfterAppend=0;
  const missileGraphicsPool=createBoundedPool({maximum:missileGraphicsMaximum,idleMaximum:Math.min(missileGraphicsMaximum,MAX_MISSILE_IDLE_GRAPHICS),create:()=>{ const value=new Graphics({label:'missile-graphics'}); if(failMissileGraphicsRemaining){ failMissileGraphicsRemaining--; value.destroy(); throw new Error('graphics-resource'); } return value; },destroy:destroyGraphics});
  const releaseMissileChildren=record=>{ for(const value of record.graphics) recycleGraphics(missileGraphicsPool,value); record.graphics.length=0; };
  const missilePool=createBoundedPool({maximum:missileContainerMaximum,idleMaximum:Math.min(missileContainerMaximum,MAX_MISSILE_IDLE_CONTAINERS),create:()=>{ const value={container:new Container({label:'missile-entry'}),graphics:[]}; if(failMissileContainerRemaining){ failMissileContainerRemaining--; value.container.destroy({children:false}); throw new Error('container-resource'); } return value; },destroy:value=>{ releaseMissileChildren(value); try{ value.container.destroy({children:false}); }catch{} }});
  const aircraftContainerMaximum=Number.isInteger(aircraftLimits.containers)?Math.max(0,aircraftLimits.containers):MAX_AIRCRAFT_CONTAINERS,aircraftGraphicsMaximum=Number.isInteger(aircraftLimits.graphics)?Math.max(0,aircraftLimits.graphics):MAX_AIRCRAFT_GRAPHICS;
  let failAircraftContainerRemaining=aircraftLimits.failContainerCreate?1:0,failAircraftGraphicsRemaining=aircraftLimits.failGraphicsCreate?1:0,failAircraftGraphicsAfterPaint=0,failAircraftContainerAfterAppend=0;
  const aircraftGraphicsPool=createBoundedPool({maximum:aircraftGraphicsMaximum,idleMaximum:Math.min(aircraftGraphicsMaximum,MAX_AIRCRAFT_IDLE_GRAPHICS),create:()=>{ const value=new Graphics({label:'aircraft-graphics'}); if(failAircraftGraphicsRemaining){ failAircraftGraphicsRemaining--; value.destroy(); throw new Error('graphics-resource'); } return value; },destroy:destroyGraphics});
  const releaseAircraftChildren=record=>{ for(const value of record.graphics) recycleGraphics(aircraftGraphicsPool,value); record.graphics.length=0; };
  const aircraftPool=createBoundedPool({maximum:aircraftContainerMaximum,idleMaximum:Math.min(aircraftContainerMaximum,MAX_AIRCRAFT_IDLE_CONTAINERS),create:()=>{ const value={container:new Container({label:'aircraft-entry'}),graphics:[]}; if(failAircraftContainerRemaining){ failAircraftContainerRemaining--; value.container.destroy({children:false}); throw new Error('container-resource'); } return value; },destroy:value=>{ releaseAircraftChildren(value); try{ value.container.destroy({children:false}); }catch{} }});
  const capabilities=()=>({preStructures:!!(healthy&&app?.renderer&&frontsGraphics&&routesGraphics&&contextState==='ready'),structures:!!(healthy&&app?.renderer&&structureLayer&&contextState==='ready'),navalLogistics:!!(healthy&&app?.renderer&&navalLayer&&contextState==='ready'),warships:!!(healthy&&app?.renderer&&warshipLayer&&contextState==='ready'),projectiles:!!(healthy&&app?.renderer&&projectileLayer&&contextState==='ready'),missiles:!!(healthy&&app?.renderer&&missileLayer&&contextState==='ready'),aircraft:!!(healthy&&app?.renderer&&aircraftLayer&&contextState==='ready')});
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
    let clean=true; try{ structureLayer?.removeChild(record.container); }catch{ clean=false; }
    const textureEntry=structureTextures.get(record.key); if(textureEntry) textureEntry.refs=Math.max(0,textureEntry.refs-1);
    releaseEntryChildren(record);
    try{ record.container.removeChildren(); record.sprite.texture=Texture.EMPTY; record.sprite.visible=true; record.sprite.alpha=1; record.sprite.scale.set(1); delete record.sprite.__statefall; record.key=null; record.sourceId=null; }catch{ clean=false; }
    if(clean) structurePool.release(record); else structurePool.discard(record);
  };
  const clearStructures=()=>{
    for(const record of activeStructures.values()) releaseStructure(record);
    activeStructures.clear(); structurePool.drain(); graphicsPool.drain(); labelPool.drain();
    for(const entry of structureTextures.values()) destroyStructureTexture(entry);
    structureTextures.clear(); structureTotal=0; structureVisible=0; structureCulled=0; structureFrameOwned=false; resourceLimitFallbackReason=null;
  };
  const releaseNaval=record=>{ if(!record) return; let clean=true; try{ navalLayer?.removeChild(record.container); }catch{ clean=false; } releaseNavalChildren(record); try{ record.container.removeChildren(); delete record.container.__statefall; record.key=null; }catch{ clean=false; } if(clean) navalPool.release(record); else navalPool.discard(record); };
  const clearNaval=()=>{ for(const record of activeNaval.values()) releaseNaval(record); activeNaval.clear(); navalPool.drain(); navalGraphicsPool.drain(); navalLabelPool.drain(); navalFrameOwned=false; navalScene=null; navalFallbackReason=null; };
  const releaseWarship=record=>{ if(!record) return; let clean=true; try{ warshipLayer?.removeChild(record.container); }catch{ clean=false; } releaseWarshipChildren(record); try{ record.container.removeChildren(); delete record.container.__statefall; record.key=null; }catch{ clean=false; } if(clean) warshipPool.release(record); else warshipPool.discard(record); };
  const clearWarships=()=>{ for(const record of activeWarships.values()) releaseWarship(record); activeWarships.clear(); warshipPool.drain(); warshipGraphicsPool.drain(); warshipLabelPool.drain(); warshipFrameOwned=false; warshipScene=null; warshipFallbackReason=null; };
  const releaseProjectile=record=>{ if(!record) return; let clean=true; try{ projectileLayer?.removeChild(record.container); }catch{ clean=false; } releaseProjectileChildren(record); try{ record.container.removeChildren(); delete record.container.__statefall; record.key=null; }catch{ clean=false; } if(clean) projectilePool.release(record); else projectilePool.discard(record); };
  const clearProjectiles=()=>{ for(const record of activeProjectiles.values()) releaseProjectile(record); activeProjectiles.clear(); projectilePool.drain(); projectileGraphicsPool.drain(); projectileModel.reset(); projectileFrameOwned=false; projectileScene=null; projectileFallbackReason=null; };
  const releaseMissile=record=>{ if(!record) return; let clean=true; try{ missileLayer?.removeChild(record.container); }catch{ clean=false; } releaseMissileChildren(record); try{ record.container.removeChildren(); delete record.container.__statefall; record.key=null; }catch{ clean=false; } if(clean) missilePool.release(record); else missilePool.discard(record); };
  const clearMissiles=()=>{ for(const record of activeMissiles.values()) releaseMissile(record); activeMissiles.clear(); missilePool.drain(); missileGraphicsPool.drain(); missileModel.reset(); missileFrameOwned=false; missileScene=null; missileFallbackReason=null; };
  const releaseAircraft=record=>{ if(!record) return; let clean=true; try{ aircraftLayer?.removeChild(record.container); }catch{ clean=false; } releaseAircraftChildren(record); try{ record.container.removeChildren(); delete record.container.__statefall; record.key=null; }catch{ clean=false; } if(clean) aircraftPool.release(record); else aircraftPool.discard(record); };
  const clearAircraft=()=>{ for(const record of activeAircraft.values()) releaseAircraft(record); activeAircraft.clear(); aircraftPool.drain(); aircraftGraphicsPool.drain(); aircraftModel.reset(); aircraftFrameOwned=false; aircraftScene=null; aircraftFallbackReason=null; };
  const clearPreStructures=()=>{
    try{ frontsGraphics?.clear(); routesGraphics?.clear(); for(const record of activeStructures.values()) for(const graphics of record.graphics) graphics.clear(); }catch{}
    preStructureFrameOwned=false; preStructureScene=null; preStructureFallbackReason=null;
  };
  const release=({preserveSource=false}={})=>{
    if(!app&&!canvas&&!world&&!entities&&!effects&&!texture&&!sprite){ if(!preserveSource){ source=null; dirty=false; } return; }
    releaseCount++; markUnhealthy();
    if(canvas){ canvas.removeEventListener('webglcontextlost',contextLost); canvas.removeEventListener('webglcontextrestored',contextRestored); contextListenerCount=0; }
    clearPreStructures(); clearStructures(); clearNaval(); clearWarships(); clearProjectiles(); clearMissiles(); clearAircraft();
    if(sprite){ try{ world?.removeChild(sprite); sprite.destroy({texture:false}); }catch{} sprite=null; }
    destroyTexture();
    try{ if(app?.renderer) app.destroy(true,{children:true,texture:false,textureSource:false}); }catch{}
    canvas?.remove(); app=null; canvas=null; world=null; entities=null; frontsGraphics=null; routesGraphics=null; structureLayer=null; navalLayer=null; warshipLayer=null; projectileLayer=null; missileLayer=null; aircraftLayer=null; effects=null;
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
        app.stop(); world=new Container({label:'world-raster'}); entities=new Container({label:'entities'}); frontsGraphics=new Graphics({label:'fronts'}); routesGraphics=new Graphics({label:'routes'}); structureLayer=new Container({label:'structures'}); navalLayer=new Container({label:'naval-logistics'}); warshipLayer=new Container({label:'warships'}); projectileLayer=new Container({label:'projectiles'}); missileLayer=new Container({label:'missiles'}); aircraftLayer=new Container({label:'aircraft'}); effects=new Container({label:'planned-effects'});
        entities.addChild(frontsGraphics,routesGraphics,structureLayer,navalLayer,warshipLayer,projectileLayer,missileLayer,aircraftLayer); app.stage.addChild(world,entities,effects); canvas.addEventListener('webglcontextlost',contextLost); canvas.addEventListener('webglcontextrestored',contextRestored); contextListenerCount=2;
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
  const paintStroke=(graphics,primitive)=>graphics.stroke({color:primitive.stroke,width:primitive.width,alpha:primitive.alpha??1,cap:primitive.cap||'butt',join:primitive.join||'miter'});
  const appendSegment=(graphics,segment)=>{
    if(segment.kind==='rect') graphics.rect(segment.x,segment.y,segment.width,segment.height);
    else if(segment.kind==='circle') graphics.circle(segment.x,segment.y,segment.r);
    else if(segment.kind==='line') graphics.moveTo(segment.x1,segment.y1).lineTo(segment.x2,segment.y2);
    else if(segment.kind==='arc') graphics.moveTo(segment.x+Math.cos(segment.start)*segment.r,segment.y+Math.sin(segment.start)*segment.r).arc(segment.x,segment.y,segment.r,segment.start,segment.end);
    else if(segment.kind==='polygon'){ const [first,...rest]=segment.points; if(first){ graphics.moveTo(first.x,first.y); for(const point of rest) graphics.lineTo(point.x,point.y); graphics.closePath(); } }
    else throw new TypeError('unknown generated Graphics segment');
  };
  const drawPrimitive=(graphics,primitive)=>{
    const generated=primitive.graphicsSegments;
    if(primitive.dash?.length){
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
  const rasterLabel=(resource,label)=>{
    const resolution=lastMetrics?.effectiveDpr||1,context=resource.canvas.getContext('2d');
    context.font=label.font; context.textAlign=label.align; context.textBaseline=label.baseline;
    let left=0,right=0,ascent=0,descent=0,stroke=0;
    for(const layer of label.layers){ const metrics=context.measureText(layer.text); left=Math.max(left,metrics.actualBoundingBoxLeft||metrics.width/2); right=Math.max(right,metrics.actualBoundingBoxRight||metrics.width/2); ascent=Math.max(ascent,metrics.actualBoundingBoxAscent||10); descent=Math.max(descent,metrics.actualBoundingBoxDescent||3); stroke=Math.max(stroke,Number(layer.width)||0); }
    const padding=Math.ceil(stroke/2+1),width=Math.max(1,Math.ceil(left+right+padding*2)),height=Math.max(1,Math.ceil(ascent+descent+padding*2)),baseline=padding+ascent;
    resource.texture.source.resize(width,height,resolution); resource.texture.update();
    context.setTransform(resolution,0,0,resolution,0,0); context.clearRect(0,0,width,height); context.font=label.font; context.textAlign=label.align; context.textBaseline=label.baseline;
    for(const layer of label.layers){ if(layer.operation==='stroke'){ context.strokeStyle=layer.color; context.lineWidth=layer.width; context.strokeText(layer.text,width/2,baseline); }else{ context.fillStyle=layer.color; context.fillText(layer.text,width/2,baseline); } }
    resource.texture.source.update(); resource.sprite.position.set(label.x-width/2,label.y-baseline); resource.sprite.visible=true; const bytes=resource.canvas.width*resource.canvas.height*4; labelTextureSourceBytes+=bytes-resource.bytes; resource.bytes=bytes; resource.sprite.__statefall={kind:label.kind,text:label.text,x:label.x,y:label.y,align:label.align,baseline:label.baseline,baselineOffset:baseline,layers:label.layers.map(({operation,text})=>({operation,text}))}; labelRasterUpdates++;
  };
  const rasterNavalLabel=(resource,label)=>{
    const resolution=lastMetrics?.effectiveDpr||1,context=resource.canvas.getContext('2d'); if(!context) throw new Error('label-source');
    context.font=label.font; context.textAlign=label.align; context.textBaseline=label.baseline;
    let left=0,right=0,ascent=0,descent=0,stroke=0;
    for(const layer of label.layers){ const metrics=context.measureText(layer.text); left=Math.max(left,metrics.actualBoundingBoxLeft||metrics.width/2); right=Math.max(right,metrics.actualBoundingBoxRight||metrics.width/2); ascent=Math.max(ascent,metrics.actualBoundingBoxAscent||10); descent=Math.max(descent,metrics.actualBoundingBoxDescent||3); stroke=Math.max(stroke,Number(layer.width)||0); }
    const padding=Math.ceil(stroke/2+1),width=Math.max(1,Math.ceil(left+right+padding*2)),height=Math.max(1,Math.ceil(ascent+descent+padding*2)),baseline=padding+ascent;
    resource.texture.source.resize(width,height,resolution); resource.texture.update(); context.setTransform(resolution,0,0,resolution,0,0); context.clearRect(0,0,width,height); context.font=label.font; context.textAlign=label.align; context.textBaseline=label.baseline;
    for(const layer of label.layers){ if(layer.operation==='stroke'){ context.strokeStyle=layer.color; context.lineWidth=layer.width; context.strokeText(layer.text,width/2,baseline); }else{ context.fillStyle=layer.color; context.fillText(layer.text,width/2,baseline); } }
    resource.texture.source.update(); resource.sprite.position.set(label.x-width/2,label.y-baseline); resource.sprite.visible=true; const bytes=resource.canvas.width*resource.canvas.height*4; navalLabelSourceBytes+=bytes-resource.bytes; resource.bytes=bytes; resource.sprite.__statefall={kind:label.kind,text:label.text,x:label.x,y:label.y,align:label.align,baseline:label.baseline,baselineOffset:baseline}; navalLabelRasterUpdates++;
  };
  const rasterWarshipLabel=(resource,label)=>{
    const resolution=lastMetrics?.effectiveDpr||1,context=resource.canvas.getContext('2d'); if(!context) throw new Error('label-source');
    context.font=label.font; context.textAlign=label.align; context.textBaseline=label.baseline;
    let left=0,right=0,ascent=0,descent=0,stroke=0;
    for(const layer of label.layers){ const metrics=context.measureText(layer.text); left=Math.max(left,metrics.actualBoundingBoxLeft||metrics.width/2); right=Math.max(right,metrics.actualBoundingBoxRight||metrics.width/2); ascent=Math.max(ascent,metrics.actualBoundingBoxAscent||10); descent=Math.max(descent,metrics.actualBoundingBoxDescent||3); stroke=Math.max(stroke,Number(layer.width)||0); }
    const padding=Math.ceil(stroke/2+1),width=Math.max(1,Math.ceil(left+right+padding*2)),height=Math.max(1,Math.ceil(ascent+descent+padding*2)),baseline=padding+ascent;
    resource.texture.source.resize(width,height,resolution); resource.texture.update(); context.setTransform(resolution,0,0,resolution,0,0); context.clearRect(0,0,width,height); context.font=label.font; context.textAlign=label.align; context.textBaseline=label.baseline;
    for(const layer of label.layers){ if(layer.operation==='stroke'){ context.strokeStyle=layer.color; context.lineWidth=layer.width; context.strokeText(layer.text,width/2,baseline); }else{ context.fillStyle=layer.color; context.fillText(layer.text,width/2,baseline); } }
    resource.texture.source.update(); resource.sprite.position.set(label.x-width/2,label.y-baseline); resource.sprite.visible=true; const bytes=resource.canvas.width*resource.canvas.height*4; warshipLabelSourceBytes+=bytes-resource.bytes; resource.bytes=bytes; resource.sprite.__statefall={kind:label.kind,text:label.text,x:label.x,y:label.y,align:label.align,baseline:label.baseline,baselineOffset:baseline}; warshipLabelRasterUpdates++;
  };
  const updatePreStructures=state=>{
    clearPreStructures();
    if(!capabilities().preStructures) return false;
    try{
      const scene=createPreStructureScene({...state,quality,reducedMotion},{primitiveLimit:primitiveMaximum,segmentLimit:segmentMaximum,textLimit:textMaximum});
       for(const primitive of scene.fronts) drawPrimitive(frontsGraphics,primitive);
      for(const primitive of scene.routes) drawPrimitive(routesGraphics,primitive);
      preStructureScene=scene; preStructureFrameOwned=true; preStructureFallbackReason=null; return true;
    }catch(error){ const reason=['primitive-cap','segment-cap','text-cap','graphics-resource'].find(value=>String(error?.message||error).includes(value))||'model-resource'; return failPreStructureFrame(reason); }
  };
  const updateStructures=state=>{
    structureFrameOwned=false;
    const items=Array.isArray(state?.items)?state.items:[];
    if(!capabilities().structures||!preStructureFrameOwned) return failStructureFrame(preStructureFallbackReason?'pre-structure-fallback':'pre-structure-unowned');
    const camera=state?.camera||{},viewport=state?.viewport||{},fog=state?.fog||null,mapWidth=state?.mapWidth||720;
    if(typeof state?.createTextureCanvas!=='function') throw new Error('missing structure texture canvas callback');
    structureTotal=items.length;
    const visible=[],desired=new Set(),wantedKeys=new Map(),sceneByTile=new Map((preStructureScene?.structureEntries||[]).map(entry=>[entry.tile,entry]));
    for(const item of items){
      if(desired.has(item.tile)) continue;
      const visual=structureVisual(item,camera,viewport,fog,mapWidth);
      const sceneEntry=sceneByTile.get(item.tile)||null;
      if(visual||sceneEntry){ const key=structureTextureKey(item.type,item.color); desired.add(item.tile); wantedKeys.set(item.tile,key); visible.push({item,visual,sceneEntry,key}); }
    }
    structureCulled=Math.max(0,structureTotal-visible.filter(entry=>entry.visual).length);
    for(const [tile,record] of activeStructures) if(!desired.has(tile)||(record.key&&record.key!==wantedKeys.get(tile))){ releaseStructure(record); activeStructures.delete(tile); }
    let reservedEntries;
    try{ reservedEntries=structurePool.acquireMany(visible.reduce((count,{item})=>count+(activeStructures.has(item.tile)?0:1),0)); }
    catch{ return failStructureFrame('sprite-resource'); }
    if(!reservedEntries) return failStructureFrame('sprite-cap');
    for(const record of activeStructures.values()) releaseEntryChildren(record);
    let reservedGraphics,reservedLabels;
    try{ reservedGraphics=graphicsPool.acquireMany(visible.reduce((count,value)=>count+(value.sceneEntry?.items.filter(item=>item.kind==='graphics').length||0),0)); }
    catch{ for(const held of reservedEntries) structurePool.release(held); return failStructureFrame('graphics-resource'); }
    if(!reservedGraphics){ for(const held of reservedEntries) structurePool.release(held); return failStructureFrame('graphics-cap'); }
    try{ reservedLabels=labelPool.acquireMany(visible.reduce((count,value)=>count+(value.sceneEntry?.items.filter(item=>item.kind==='label').length||0),0)); }
    catch{ for(const held of reservedGraphics) graphicsPool.release(held); for(const held of reservedEntries) structurePool.release(held); return failStructureFrame('text-resource'); }
    if(!reservedLabels){ for(const held of reservedGraphics) graphicsPool.release(held); for(const held of reservedEntries) structurePool.release(held); return failStructureFrame('text-cap'); }
    const releaseReserved=()=>{ for(const held of reservedLabels) labelPool.release(held); for(const held of reservedGraphics) graphicsPool.release(held); for(const held of reservedEntries) structurePool.release(held); };
    for(const {item,visual,sceneEntry,key:wantedKey} of visible){
      let record=activeStructures.get(item.tile);
      if(!record){
        record=reservedEntries.pop(); record.tile=item.tile;
        if(!record.sprite.__statefallSpriteId) record.sprite.__statefallSpriteId=++structureSpriteSerial;
        record.sprite.anchor.set(0.5); activeStructures.set(item.tile,record);
      }
      if(visual){
        if(!record.key){
          const icon=acquireTexture(item,state.createTextureCanvas);
          if(icon.error){ releaseReserved(); return failStructureFrame(icon.error); }
          record.key=wantedKey; record.sourceId=icon.entry.sourceId; record.sprite.texture=icon.entry.texture;
        }
        const baseRadius=Number(state.textureRadius)||24,displayScale=visual.radius*visual.scale/baseRadius;
        record.sprite.visible=true; record.sprite.position.set(visual.x,visual.y); record.sprite.scale.set(displayScale); record.sprite.alpha=visual.alpha;
        record.sprite.__statefall={spriteId:record.sprite.__statefallSpriteId,textureKey:record.key,sourceId:record.sourceId,tile:item.tile,type:item.type,color:item.color,x:visual.x,y:visual.y,radius:visual.radius,pop:visual.scale,alpha:visual.alpha,paintBounds:structureBasePaintBounds(item.type,visual.x,visual.y,visual.radius*visual.scale)};
      }else{
        const textureEntry=structureTextures.get(record.key); if(textureEntry) textureEntry.refs=Math.max(0,textureEntry.refs-1);
        record.key=null; record.sourceId=null; record.sprite.texture=Texture.EMPTY; record.sprite.visible=false; delete record.sprite.__statefall;
      }
      record.container.removeChildren();
      for(const ordered of sceneEntry?.items||[{kind:'base',semantic:'base'}]){
        if(ordered.kind==='base'){ record.sprite.label='base'; record.container.addChild(record.sprite); continue; }
        if(ordered.kind==='graphics'){
          const graphics=reservedGraphics.pop(); let reason='graphics-resource';
          try{ graphics.label=ordered.semantic; graphics.__statefall={kind:'graphics',semantic:ordered.semantic}; for(const primitive of ordered.primitives) drawPrimitive(graphics,primitive); if(failStructureGraphicsAfterAppend){ failStructureGraphicsAfterAppend--; throw new Error('graphics-after-append'); } record.graphics.push(graphics); record.container.addChild(graphics); if(failStructureContainerAfterAppend){ failStructureContainerAfterAppend--; reason='sprite-resource'; throw new Error('container-after-append'); } }
          catch{ const index=record.graphics.indexOf(graphics); if(index>=0) record.graphics.splice(index,1); discardGraphics(graphicsPool,graphics); releaseReserved(); return failStructureFrame(reason); }
          continue;
        }
        const label=reservedLabels.pop();
        let reason='text-resource';
        try{ rasterLabel(label,ordered.label); label.sprite.__statefall.semantic=ordered.semantic; if(failStructureLabelAfterPaint){ failStructureLabelAfterPaint--; throw new Error('label-after-paint'); } record.labels.push(label); record.container.addChild(label.sprite); if(failStructureContainerAfterAppend){ failStructureContainerAfterAppend--; reason='sprite-resource'; throw new Error('container-after-append'); } }
        catch{ const index=record.labels.indexOf(label); if(index>=0) record.labels.splice(index,1); discardLabel(labelPool,label); releaseReserved(); return failStructureFrame(reason); }
      }
      structureLayer.addChild(record.container);
    }
    releaseReserved();
    structureVisible=visible.filter(entry=>entry.visual).length; structureFrameOwned=true; resourceLimitFallbackReason=null;
    return true;
  };
  const failNavalFrame=reason=>{ for(const record of activeNaval.values()) releaseNaval(record); activeNaval.clear(); navalFrameOwned=false; navalScene=null; navalFallbackCount++; navalFallbackReason=reason; return false; };
  const updateNaval=state=>{
    navalFrameOwned=false;
    if(!capabilities().navalLogistics) return failNavalFrame('context-unavailable');
    if(!structureFrameOwned) return failNavalFrame('structures-unowned');
    let scene;
    try{ scene=createNavalLogisticsScene(state,navalLimits); }
    catch(error){ const message=String(error?.message||error),reason=['entity-cap','path-cap','wake-cap','primitive-cap','segment-cap','label-cap'].find(value=>message.includes(value))||(message.includes('invalid')?'invalid-source':'model-resource'); return failNavalFrame(reason); }
    const occurrences=new Map(),wanted=[];
    for(const entry of scene.entries){ let identity=navalIdentities.get(entry.source); if(!identity){ identity=++navalIdentitySerial; navalIdentities.set(entry.source,identity); } const base=`${entry.category}:${identity}`,occurrence=occurrences.get(base)||0; occurrences.set(base,occurrence+1); wanted.push({entry,key:`${base}:${occurrence}`}); }
    const desired=new Set(wanted.map(value=>value.key));
    for(const [key,record] of activeNaval) if(!desired.has(key)){ releaseNaval(record); activeNaval.delete(key); }
    let containers,graphics,labels;
    try{ containers=navalPool.acquireMany(wanted.reduce((sum,value)=>sum+(activeNaval.has(value.key)?0:1),0)); }catch{ return failNavalFrame('container-resource'); }
    if(!containers) return failNavalFrame('container-cap');
    for(const record of activeNaval.values()) releaseNavalChildren(record);
    try{ graphics=navalGraphicsPool.acquireMany(scene.items.filter(item=>item.kind==='graphics').length); }catch{ for(const value of containers) navalPool.release(value); return failNavalFrame('graphics-resource'); }
    if(!graphics){ for(const value of containers) navalPool.release(value); return failNavalFrame('graphics-cap'); }
    try{ labels=navalLabelPool.acquireMany(scene.labelCount); }catch{ for(const value of graphics) navalGraphicsPool.release(value); for(const value of containers) navalPool.release(value); return failNavalFrame('label-resource'); }
    if(!labels){ for(const value of graphics) navalGraphicsPool.release(value); for(const value of containers) navalPool.release(value); return failNavalFrame('label-cap'); }
    const releaseReserved=()=>{ for(const value of labels) navalLabelPool.release(value); for(const value of graphics) navalGraphicsPool.release(value); for(const value of containers) navalPool.release(value); };
    for(const {entry,key} of wanted){
      let record=activeNaval.get(key); if(!record){ record=containers.pop(); record.key=key; activeNaval.set(key,record); }
      record.container.removeChildren(); record.container.__statefall={category:entry.category,key,order:entry.order};
      for(const item of entry.items){
        if(item.kind==='graphics'){
          const value=graphics.pop(); let reason='graphics-resource';
          try{ value.label=item.semantic; value.__statefall={kind:'graphics',semantic:item.semantic}; for(const primitive of item.primitives) drawPrimitive(value,primitive); if(failNavalGraphicsAfterAppend){ failNavalGraphicsAfterAppend--; throw new Error('graphics-after-append'); } record.graphics.push(value); record.container.addChild(value); if(failNavalContainerAfterAppend){ failNavalContainerAfterAppend--; reason='container-resource'; throw new Error('container-after-append'); } }
          catch{ const index=record.graphics.indexOf(value); if(index>=0) record.graphics.splice(index,1); discardGraphics(navalGraphicsPool,value); releaseReserved(); return failNavalFrame(reason); }
        }else{
          const value=labels.pop(); let reason='label-resource';
          try{ rasterNavalLabel(value,item.label); value.sprite.__statefall.semantic=item.semantic; if(failNavalLabelAfterPaint){ failNavalLabelAfterPaint--; throw new Error('label-after-paint'); } record.labels.push(value); record.container.addChild(value.sprite); if(failNavalContainerAfterAppend){ failNavalContainerAfterAppend--; reason='container-resource'; throw new Error('container-after-append'); } }
          catch{ const index=record.labels.indexOf(value); if(index>=0) record.labels.splice(index,1); discardLabel(navalLabelPool,value); releaseReserved(); return failNavalFrame(reason); }
        }
      }
      navalLayer.addChild(record.container);
    }
    const orderedRecords=wanted.map(({key})=>[key,activeNaval.get(key)]); activeNaval.clear(); for(const [key,record] of orderedRecords) activeNaval.set(key,record);
    releaseReserved(); navalScene=scene; navalFrameOwned=true; navalFallbackReason=null; return true;
  };
  const failWarshipFrame=reason=>{ for(const record of activeWarships.values()) releaseWarship(record); activeWarships.clear(); warshipFrameOwned=false; warshipScene=null; warshipFallbackCount++; warshipFallbackReason=reason; return false; };
  const updateWarships=state=>{
    warshipFrameOwned=false;
    if(!capabilities().warships) return failWarshipFrame('context-unavailable');
    if(!structureFrameOwned) return failWarshipFrame('structures-unowned');
    if(!navalFrameOwned) return failWarshipFrame('naval-unowned');
    let scene;
    try{ scene=createWarshipScene(state,warshipLimits); }
    catch(error){ const message=String(error?.message||error),reason=['entry-cap','wake-cap','primitive-cap','segment-cap','label-cap'].find(value=>message.includes(value))||(message.includes('stable ID')?'invalid-id':message.includes('invalid')?'invalid-source':'model-resource'); return failWarshipFrame(reason); }
    const desired=new Set(scene.entries.map(entry=>entry.id));
    for(const [id,record] of activeWarships) if(!desired.has(id)){ releaseWarship(record); activeWarships.delete(id); }
    let containers,graphics,labels;
    try{ containers=warshipPool.acquireMany(scene.entries.reduce((sum,entry)=>sum+(activeWarships.has(entry.id)?0:1),0)); }catch{ return failWarshipFrame('container-resource'); }
    if(!containers) return failWarshipFrame('container-cap');
    for(const record of activeWarships.values()) releaseWarshipChildren(record);
    try{ graphics=warshipGraphicsPool.acquireMany(scene.items.filter(item=>item.kind==='graphics').length); }catch{ for(const value of containers) warshipPool.release(value); return failWarshipFrame('graphics-resource'); }
    if(!graphics){ for(const value of containers) warshipPool.release(value); return failWarshipFrame('graphics-cap'); }
    try{ labels=warshipLabelPool.acquireMany(scene.labelCount); }catch{ for(const value of graphics) warshipGraphicsPool.release(value); for(const value of containers) warshipPool.release(value); return failWarshipFrame('label-resource'); }
    if(!labels){ for(const value of graphics) warshipGraphicsPool.release(value); for(const value of containers) warshipPool.release(value); return failWarshipFrame('label-cap'); }
    const releaseReserved=()=>{ for(const value of labels) warshipLabelPool.release(value); for(const value of graphics) warshipGraphicsPool.release(value); for(const value of containers) warshipPool.release(value); };
    for(const entry of scene.entries){
      let record=activeWarships.get(entry.id); if(!record){ record=containers.pop(); record.key=entry.id; activeWarships.set(entry.id,record); }
      record.container.removeChildren(); record.container.__statefall={id:entry.id,cls:entry.cls,order:entry.order};
      for(const item of entry.items){
        if(item.kind==='graphics'){
          const value=graphics.pop(); let reason='graphics-resource';
          try{ value.label=item.semantic; value.__statefall={kind:'graphics',semantic:item.semantic}; for(const primitive of item.primitives) drawPrimitive(value,primitive); if(failWarshipGraphicsAfterAppend){ failWarshipGraphicsAfterAppend--; throw new Error('graphics-after-append'); } record.graphics.push(value); record.container.addChild(value); if(failWarshipContainerAfterAppend){ failWarshipContainerAfterAppend--; reason='container-resource'; throw new Error('container-after-append'); } }
          catch{ const index=record.graphics.indexOf(value); if(index>=0) record.graphics.splice(index,1); discardGraphics(warshipGraphicsPool,value); releaseReserved(); return failWarshipFrame(reason); }
        }else{
          const value=labels.pop(); let reason='label-resource';
          try{ rasterWarshipLabel(value,item.label); value.sprite.__statefall.semantic=item.semantic; if(failWarshipLabelAfterPaint){ failWarshipLabelAfterPaint--; throw new Error('label-after-paint'); } record.labels.push(value); record.container.addChild(value.sprite); if(failWarshipContainerAfterAppend){ failWarshipContainerAfterAppend--; reason='container-resource'; throw new Error('container-after-append'); } }
          catch{ const index=record.labels.indexOf(value); if(index>=0) record.labels.splice(index,1); discardLabel(warshipLabelPool,value); releaseReserved(); return failWarshipFrame(reason); }
        }
      }
      warshipLayer.addChild(record.container);
    }
    const ordered=scene.entries.map(entry=>[entry.id,activeWarships.get(entry.id)]); activeWarships.clear(); for(const [id,record] of ordered) activeWarships.set(id,record);
    releaseReserved(); warshipScene=scene; warshipFrameOwned=true; warshipFallbackReason=null; return true;
  };
  const failProjectileFrame=reason=>{ for(const record of activeProjectiles.values()) releaseProjectile(record); activeProjectiles.clear(); projectileFrameOwned=false; projectileScene=null; projectileFallbackCount++; projectileFallbackReason=reason; return false; };
  const updateProjectiles=state=>{
    projectileFrameOwned=false;
    if(!capabilities().projectiles) return failProjectileFrame('context-unavailable');
    if(!structureFrameOwned) return failProjectileFrame('structures-unowned');
    if(!navalFrameOwned) return failProjectileFrame('naval-unowned');
    if(!warshipFrameOwned) return failProjectileFrame('warships-unowned');
    let scene;
    try{ scene=projectileModel.build(state,projectileLimits); }
    catch(error){ const message=String(error?.message||error),reason=['entry-cap','trail-cap','primitive-cap','segment-cap'].find(value=>message.includes(value))||(message.includes('invalid')?'invalid-source':'model-resource'); return failProjectileFrame(reason); }
    const desired=new Set(scene.entries.map(entry=>entry.key));
    for(const [key,record] of activeProjectiles) if(!desired.has(key)){ releaseProjectile(record); activeProjectiles.delete(key); }
    let containers,graphics;
    try{ containers=projectilePool.acquireMany(scene.entries.reduce((sum,entry)=>sum+(activeProjectiles.has(entry.key)?0:1),0)); }catch{ return failProjectileFrame('container-resource'); }
    if(!containers) return failProjectileFrame('container-cap');
    for(const record of activeProjectiles.values()) releaseProjectileChildren(record);
    try{ graphics=projectileGraphicsPool.acquireMany(scene.items.length); }catch{ for(const value of containers) projectilePool.release(value); return failProjectileFrame('graphics-resource'); }
    if(!graphics){ for(const value of containers) projectilePool.release(value); return failProjectileFrame('graphics-cap'); }
    const releaseReserved=()=>{ for(const value of graphics) projectileGraphicsPool.release(value); for(const value of containers) projectilePool.release(value); };
    for(const entry of scene.entries){
      let record=activeProjectiles.get(entry.key); if(!record){ record=containers.pop(); record.key=entry.key; activeProjectiles.set(entry.key,record); }
      record.container.removeChildren(); record.container.__statefall={key:entry.key,category:entry.category,variant:entry.variant,order:entry.order};
      for(const item of entry.items){ const value=graphics.pop(); let reason='graphics-resource'; try{ value.label=item.semantic; value.__statefall={kind:'graphics',semantic:item.semantic}; for(const primitive of item.primitives) drawPrimitive(value,primitive); if(failProjectileGraphicsAfterPaint){ failProjectileGraphicsAfterPaint--; throw new Error('graphics-after-paint'); } record.graphics.push(value); record.container.addChild(value); if(failProjectileContainerAfterAppend){ failProjectileContainerAfterAppend--; reason='container-resource'; throw new Error('container-after-append'); } }catch{ const index=record.graphics.indexOf(value); if(index>=0) record.graphics.splice(index,1); discardGraphics(projectileGraphicsPool,value); releaseReserved(); return failProjectileFrame(reason); } }
      projectileLayer.addChild(record.container);
    }
    const ordered=scene.entries.map(entry=>[entry.key,activeProjectiles.get(entry.key)]); activeProjectiles.clear(); for(const [key,record] of ordered) activeProjectiles.set(key,record);
    releaseReserved(); projectileScene=scene; projectileFrameOwned=true; projectileFallbackReason=null; return true;
  };
  const failMissileFrame=reason=>{ for(const record of activeMissiles.values()) releaseMissile(record); activeMissiles.clear(); missileFrameOwned=false; missileScene=null; missileFallbackCount++; missileFallbackReason=reason; return false; };
  const updateMissiles=state=>{
    missileFrameOwned=false;
    if(!capabilities().missiles) return failMissileFrame('context-unavailable');
    if(!structureFrameOwned) return failMissileFrame('structures-unowned');
    if(!navalFrameOwned) return failMissileFrame('naval-unowned');
    if(!warshipFrameOwned) return failMissileFrame('warships-unowned');
    if(!projectileFrameOwned) return failMissileFrame('projectiles-unowned');
    let scene;
    try{ scene=missileModel.build(state,missileLimits); }
    catch(error){ const message=String(error?.message||error),reason=['entry-cap','trail-cap','primitive-cap','segment-cap'].find(value=>message.includes(value))||(message.includes('invalid')?'invalid-source':'model-resource'); return failMissileFrame(reason); }
    const desired=new Set(scene.entries.map(entry=>entry.key));
    for(const [key,record] of activeMissiles) if(!desired.has(key)){ releaseMissile(record); activeMissiles.delete(key); }
    let containers,graphics;
    try{ containers=missilePool.acquireMany(scene.entries.reduce((sum,entry)=>sum+(activeMissiles.has(entry.key)?0:1),0)); }catch{ return failMissileFrame('container-resource'); }
    if(!containers) return failMissileFrame('container-cap');
    for(const record of activeMissiles.values()) releaseMissileChildren(record);
    try{ graphics=missileGraphicsPool.acquireMany(scene.items.length); }catch{ for(const value of containers) missilePool.release(value); return failMissileFrame('graphics-resource'); }
    if(!graphics){ for(const value of containers) missilePool.release(value); return failMissileFrame('graphics-cap'); }
    const releaseReserved=()=>{ for(const value of graphics) missileGraphicsPool.release(value); for(const value of containers) missilePool.release(value); };
    for(const entry of scene.entries){
      let record=activeMissiles.get(entry.key); if(!record){ record=containers.pop(); record.key=entry.key; activeMissiles.set(entry.key,record); }
      record.container.removeChildren(); record.container.__statefall={key:entry.key,variant:entry.variant,order:entry.order};
      for(const item of entry.items){ const value=graphics.pop(); let reason='graphics-resource'; try{ value.label=item.semantic; value.__statefall={kind:'graphics',semantic:item.semantic}; for(const primitive of item.primitives) drawPrimitive(value,primitive); if(failMissileGraphicsAfterPaint){ failMissileGraphicsAfterPaint--; throw new Error('graphics-after-paint'); } record.graphics.push(value); record.container.addChild(value); if(failMissileContainerAfterAppend){ failMissileContainerAfterAppend--; reason='container-resource'; throw new Error('container-after-append'); } }catch{ const index=record.graphics.indexOf(value); if(index>=0) record.graphics.splice(index,1); discardGraphics(missileGraphicsPool,value); releaseReserved(); return failMissileFrame(reason); } }
      missileLayer.addChild(record.container);
    }
    const ordered=scene.entries.map(entry=>[entry.key,activeMissiles.get(entry.key)]); activeMissiles.clear(); for(const [key,record] of ordered) activeMissiles.set(key,record);
    releaseReserved(); missileScene=scene; missileFrameOwned=true; missileFallbackReason=null; return true;
  };
  const failAircraftFrame=reason=>{ for(const record of activeAircraft.values()) releaseAircraft(record); activeAircraft.clear(); aircraftFrameOwned=false; aircraftScene=null; aircraftFallbackCount++; aircraftFallbackReason=reason; return false; };
  const updateAircraft=state=>{
    aircraftFrameOwned=false;
    if(!capabilities().aircraft) return failAircraftFrame('context-unavailable');
    if(!structureFrameOwned) return failAircraftFrame('structures-unowned');
    if(!navalFrameOwned) return failAircraftFrame('naval-unowned');
    if(!warshipFrameOwned) return failAircraftFrame('warships-unowned');
    if(!projectileFrameOwned) return failAircraftFrame('projectiles-unowned');
    if(!missileFrameOwned) return failAircraftFrame('missiles-unowned');
    let scene;
    try{ scene=aircraftModel.build(state,aircraftLimits); }
    catch(error){ const message=String(error?.message||error),reason=['entry-cap','primitive-cap','segment-cap'].find(value=>message.includes(value))||(message.includes('stable ID')?'invalid-id':message.includes('invalid')?'invalid-source':'model-resource'); return failAircraftFrame(reason); }
    const desired=new Set(scene.entries.map(entry=>entry.id));
    for(const [id,record] of activeAircraft) if(!desired.has(id)){ releaseAircraft(record); activeAircraft.delete(id); }
    let containers,graphics;
    try{ containers=aircraftPool.acquireMany(scene.entries.reduce((sum,entry)=>sum+(activeAircraft.has(entry.id)?0:1),0)); }catch{ return failAircraftFrame('container-resource'); }
    if(!containers) return failAircraftFrame('container-cap');
    for(const record of activeAircraft.values()) releaseAircraftChildren(record);
    try{ graphics=aircraftGraphicsPool.acquireMany(scene.items.length); }catch{ for(const value of containers) aircraftPool.release(value); return failAircraftFrame('graphics-resource'); }
    if(!graphics){ for(const value of containers) aircraftPool.release(value); return failAircraftFrame('graphics-cap'); }
    const releaseReserved=()=>{ for(const value of graphics) aircraftGraphicsPool.release(value); for(const value of containers) aircraftPool.release(value); };
    for(const entry of scene.entries){
      let record=activeAircraft.get(entry.id); if(!record){ record=containers.pop(); record.key=entry.id; activeAircraft.set(entry.id,record); }
      record.container.removeChildren(); record.container.__statefall={id:entry.id,type:entry.type,state:entry.state,order:entry.order};
      for(const item of entry.items){ const value=graphics.pop(); let reason='graphics-resource'; try{ value.label=item.semantic; value.__statefall={kind:'graphics',semantic:item.semantic}; for(const primitive of item.primitives) drawPrimitive(value,primitive); if(failAircraftGraphicsAfterPaint){ failAircraftGraphicsAfterPaint--; throw new Error('graphics-after-paint'); } record.graphics.push(value); record.container.addChild(value); if(failAircraftContainerAfterAppend){ failAircraftContainerAfterAppend--; reason='container-resource'; throw new Error('container-after-append'); } }catch{ const index=record.graphics.indexOf(value); if(index>=0) record.graphics.splice(index,1); discardGraphics(aircraftGraphicsPool,value); releaseReserved(); return failAircraftFrame(reason); } }
      aircraftLayer.addChild(record.container);
    }
    const ordered=scene.entries.map(entry=>[entry.id,activeAircraft.get(entry.id)]); activeAircraft.clear(); for(const [id,record] of ordered) activeAircraft.set(id,record);
    releaseReserved(); aircraftScene=scene; aircraftFrameOwned=true; aircraftFallbackReason=null; return true;
  };
  const structureDiagnostics=()=>{
    const pool=structurePool.diagnostics(),graphics=graphicsPool.diagnostics(),labels=labelPool.diagnostics(),textureBytesEstimate=Array.from(structureTextures.values(),entry=>entry.bytes).reduce((sum,value)=>sum+value,0);
    const records=Array.from(activeStructures.values());
    const activeGraphics=records.reduce((sum,record)=>sum+record.graphics.length,0),activeLabels=records.reduce((sum,record)=>sum+record.labels.length,0),activeLabelTextureBytes=records.reduce((sum,record)=>sum+record.labels.reduce((inner,label)=>inner+label.bytes,0),0);
    return {owned:structureFrameOwned,total:structureTotal,visible:structureVisible,culled:structureCulled,entries:records.length,pooled:pool.pooled,created:pool.created,reused:pool.reused,destroyed:pool.destroyed,maximum:pool.maximum,entryGraphicsCount:activeGraphics,entrySpriteCount:records.length+activeLabels,pooledGraphicsCount:graphics.pooled,pooledSpriteCount:pool.pooled+labels.pooled,entryContainerCount:records.length,pooledContainerCount:pool.pooled,graphicsMaximum:graphics.maximum,graphicsCreated:graphics.created,graphicsReused:graphics.reused,graphicsDestroyed:graphics.destroyed,textureMaximum,textureCount:structureTextures.size,textureBytesEstimate,textureAllocations:structureTextureAllocations,textureDestroyCount:structureTextureDestroyCount,textMaximum,textStrategy:'canvas-raster-label-sprites',activeTextObjects:0,idleTextObjects:0,pixiTextCache:{status:'known-unused',references:0,textures:0,bytes:0},activeLabelSprites:activeLabels,idleLabelSprites:labels.pooled,labelTextureCount:activeLabels+labels.pooled,activeLabelTextureBytes,labelTextureSourceBytes,labelGpuBytes:{status:'unknown',bytes:null},labelRasterUpdates,labelCreated:labels.created,labelReused:labels.reused,labelDestroyed:labels.destroyed,resourceLimitFallback:{count:resourceLimitFallbackCount,reason:resourceLimitFallbackReason},order:records.map(record=>({tile:record.tile,children:record.container.children.map(child=>child===record.sprite?'base':child.__statefall?.semantic||child.__statefall?.kind||child.label),baseVisible:record.sprite.visible,labels:record.labels.map(label=>label.sprite.__statefall)})),instances:records.map(record=>record.sprite.__statefall).filter(Boolean)};
  };
  const preStructureDiagnostics=()=>{
    const scene=preStructureScene,segments=values=>(values||[]).reduce((sum,value)=>sum+value.graphicsSegments.length,0);
    return {owned:preStructureFrameOwned,order:['fronts','routes','structure-entry ordered items'],quality:{requested:requestedQuality,effective:quality},reducedMotion,primitiveMaximum,segmentMaximum,textMaximum,primitiveCount:scene?.primitiveCount||0,textCount:scene?.textCount||0,segmentCount:scene?.segmentCount||0,emittedSegmentCount:scene?.emittedSegmentCount||0,segmentCounts:{fronts:segments(scene?.fronts),routes:segments(scene?.routes),structurePre:segments(scene?.rangesStatus),structurePost:segments(scene?.postOverlays)},counts:scene?.counts||null,globalGraphicsCount:frontsGraphics?2:0,entryGraphicsCount:Array.from(activeStructures.values()).reduce((sum,record)=>sum+record.graphics.length,0),graphicsCount:(frontsGraphics?2:0)+Array.from(activeStructures.values()).reduce((sum,record)=>sum+record.graphics.length,0),presentation:scene?{fronts:scene.fronts.map(({x,y,width,height,fill,alpha,graphicsSegments})=>({x,y,width,height,fill,alpha,segmentCount:graphicsSegments.length})),markers:scene.routes.filter(value=>value.kind==='circle'&&value.fill).map(value=>({x:value.x,y:value.y,r:value.r,color:value.fill})),dashedRoutes:scene.routes.filter(value=>value.dash).map(value=>({kind:value.kind,x:value.x,y:value.y,r:value.r,stroke:value.stroke,dash:value.dash,phase:value.phase,segmentCount:value.graphicsSegments.length,segments:value.graphicsSegments,first:value.graphicsSegments[0]||null,middle:value.graphicsSegments[Math.floor(value.graphicsSegments.length/2)]||null,last:value.graphicsSegments.at(-1)||null})),structureEntries:scene.structureEntries.map(entry=>({tile:entry.tile,order:entry.items.map(value=>value.semantic),preSegmentCount:segments(entry.pre),postSegmentCount:segments(entry.post),labels:entry.labels,pre:entry.pre.map(({kind,x,y,r,stroke,fill,width,graphicsSegments})=>({kind,x,y,r,stroke,fill,width,segmentCount:graphicsSegments.length})),post:entry.post.map(({kind,x,y,r,stroke,fill,width,semantic,graphicsSegments})=>({kind,x,y,r,stroke,fill,width,semantic,segmentCount:graphicsSegments.length}))}))}:null,resourceLimitFallback:{count:preStructureFallbackCount,reason:preStructureFallbackReason},compositingConflictFallback:{active:false,count:0,reason:null,detail:null}};
  };
  const navalDiagnostics=()=>{
    const containers=navalPool.diagnostics(),graphics=navalGraphicsPool.diagnostics(),labels=navalLabelPool.diagnostics(),records=Array.from(activeNaval.values()),scene=navalScene;
    const activeGraphics=records.reduce((sum,record)=>sum+record.graphics.length,0),activeLabels=records.reduce((sum,record)=>sum+record.labels.length,0),activeLabelBytes=records.reduce((sum,record)=>sum+record.labels.reduce((inner,value)=>inner+value.bytes,0),0);
    return {owned:navalFrameOwned,order:['complete-structures','transports','merchants','boarding-lines','canvas-warships-and-later'],canvasStrokeState:scene?.canvasStrokeState||{lineJoin:'miter',lineCap:'butt'},counts:scene?.counts||{transports:{total:0,visible:0,culled:0},merchants:{total:0,visible:0,culled:0},boarding:{total:0,visible:0,culled:0}},entityCount:scene?.entityCount||0,primitiveCount:scene?.primitiveCount||0,segmentCount:scene?.segmentCount||0,pathPointCount:scene?.pathPointCount||0,wakePointCount:scene?.wakePointCount||0,routeCount:scene?.routeCount||0,wakeSegmentCount:scene?.wakeSegmentCount||0,boardingSegmentCount:scene?.boardingSegmentCount||0,labelCount:scene?.labelCount||0,entries:records.length,containerMaximum:containers.maximum,containersLive:containers.live,containersIdle:containers.pooled,containersCreated:containers.created,containersReused:containers.reused,containersDestroyed:containers.destroyed,graphicsMaximum:graphics.maximum,graphicsActive:activeGraphics,graphicsIdle:graphics.pooled,graphicsCreated:graphics.created,graphicsReused:graphics.reused,graphicsDestroyed:graphics.destroyed,labelMaximum:labels.maximum,labelActive:activeLabels,labelIdle:labels.pooled,labelCreated:labels.created,labelReused:labels.reused,labelDestroyed:labels.destroyed,labelTextureCount:activeLabels+labels.pooled,labelActiveSourceBytes:activeLabelBytes,labelSourceBytes:navalLabelSourceBytes,labelRasterUpdates:navalLabelRasterUpdates,labelGpuBytes:{status:'unknown',bytes:null},generatedHullTextures:{strategy:'vector-primitives',references:0,textures:0,sourceBytes:0,gpuBytes:{status:'unknown',bytes:null}},resourceLimitFallback:{count:navalFallbackCount,reason:navalFallbackReason},presentation:scene?scene.entries.map(entry=>({category:entry.category,order:entry.order,items:entry.items.map(item=>item.semantic),styles:entry.items.flatMap(item=>(item.primitives||[]).map(({kind,stroke,fill,width,cap,join})=>({kind,stroke,fill,width,cap,join})))})):[],resources:records.map(record=>({key:record.key,category:record.container.__statefall?.category,order:record.container.__statefall?.order,childCount:record.container.children.length,children:record.container.children.map(child=>child.__statefall?.semantic||child.label)}))};
  };
  const warshipDiagnostics=()=>{
    const containers=warshipPool.diagnostics(),graphics=warshipGraphicsPool.diagnostics(),labels=warshipLabelPool.diagnostics(),records=Array.from(activeWarships.values()),scene=warshipScene,activeGraphics=records.reduce((sum,record)=>sum+record.graphics.length,0),activeLabels=records.reduce((sum,record)=>sum+record.labels.length,0),activeLabelBytes=records.reduce((sum,record)=>sum+record.labels.reduce((inner,value)=>inner+value.bytes,0),0);
    return {owned:warshipFrameOwned,order:['complete-structures','naval-logistics','warships-array-order','canvas-shells-and-later'],canvasStrokeState:scene?.canvasStrokeState||{lineJoin:'miter',lineCap:'butt',globalAlpha:1,lineDash:[],lineDashOffset:0},strokeTimeline:scene?.strokeTimeline||[],counts:scene?.counts||{total:0,visible:0,culled:0,hidden:0},wakePointCount:scene?.wakePointCount||0,wakeSegmentCount:scene?.wakeSegmentCount||0,primitiveCount:scene?.primitiveCount||0,segmentCount:scene?.segmentCount||0,labelCount:scene?.labelCount||0,entries:records.length,containerMaximum:containers.maximum,containersLive:containers.live,containersIdle:containers.pooled,containersCreated:containers.created,containersReused:containers.reused,containersDestroyed:containers.destroyed,graphicsMaximum:graphics.maximum,graphicsActive:activeGraphics,graphicsIdle:graphics.pooled,graphicsCreated:graphics.created,graphicsReused:graphics.reused,graphicsDestroyed:graphics.destroyed,labelMaximum:labels.maximum,labelActive:activeLabels,labelIdle:labels.pooled,labelCreated:labels.created,labelReused:labels.reused,labelDestroyed:labels.destroyed,labelTextureCount:activeLabels+labels.pooled,labelActiveSourceBytes:activeLabelBytes,labelSourceBytes:warshipLabelSourceBytes,labelRasterUpdates:warshipLabelRasterUpdates,labelGpuBytes:{status:'unknown',bytes:null},generatedHullTextures:{strategy:'vector-primitives',references:0,textures:0,sourceBytes:0,gpuBytes:{status:'unknown',bytes:null}},resourceLimitFallback:{count:warshipFallbackCount,reason:warshipFallbackReason},presentation:scene?scene.entries.map(entry=>({id:entry.id,cls:entry.cls,order:entry.order,incomingLineCap:entry.incomingLineCap,outgoingLineCap:entry.outgoingLineCap,items:entry.items.map(item=>item.semantic),itemCaps:entry.items.map(item=>({semantic:item.semantic,lineCap:item.lineCap})),styles:entry.items.flatMap(item=>(item.primitives||[]).map(({kind,stroke,fill,width,alpha,cap,join})=>({kind,stroke,fill,width,alpha,cap,join})))})):[],resources:records.map(record=>({id:record.key,order:record.container.__statefall?.order,cls:record.container.__statefall?.cls,childCount:record.container.children.length,children:record.container.children.map(child=>child.__statefall?.semantic||child.label)}))};
  };
  const projectileDiagnostics=()=>{
    const containers=projectilePool.diagnostics(),graphics=projectileGraphicsPool.diagnostics(),records=Array.from(activeProjectiles.values()),scene=projectileScene,activeGraphics=records.reduce((sum,record)=>sum+record.graphics.length,0);
    return {owned:projectileFrameOwned,order:['complete-structures','naval-logistics','warships','shells-array-order','visual-shots-array-order','canvas-missiles-and-later'],canvasStrokeState:scene?.canvasStrokeState||{lineJoin:'miter',lineCap:'butt',globalAlpha:1,lineDash:[],lineDashOffset:0},strokeTimeline:scene?.strokeTimeline||[],counts:scene?.counts||{shells:{total:0,visible:0,culled:0,hidden:0},visualShots:{total:0,visible:0,culled:0}},trailPointCount:scene?.trailPointCount||0,primitiveCount:scene?.primitiveCount||0,segmentCount:scene?.segmentCount||0,fallbackTotals:scene?.fallbackTotals||0,entries:records.length,containerMaximum:containers.maximum,containersLive:containers.live,containersIdle:containers.pooled,containersCreated:containers.created,containersReused:containers.reused,containersDestroyed:containers.destroyed,graphicsMaximum:graphics.maximum,graphicsActive:activeGraphics,graphicsIdle:graphics.pooled,graphicsCreated:graphics.created,graphicsReused:graphics.reused,graphicsDestroyed:graphics.destroyed,resourceLimitFallback:{count:projectileFallbackCount,reason:projectileFallbackReason},presentation:scene?scene.entries.map(entry=>({key:entry.key,category:entry.category,variant:entry.variant,order:entry.order,incomingLineCap:entry.incomingLineCap,outgoingLineCap:entry.outgoingLineCap,age:entry.age,alpha:entry.alpha,arc:entry.arc,items:entry.items.map(item=>item.semantic),itemCaps:entry.items.map(item=>({semantic:item.semantic,lineCap:item.lineCap})),styles:entry.items.flatMap(item=>item.primitives.map(({kind,stroke,fill,width,alpha,cap,join,dash})=>({kind,stroke,fill,width,alpha,cap,join,dash})))})):[],resources:records.map(record=>({key:record.key,category:record.container.__statefall?.category,variant:record.container.__statefall?.variant,order:record.container.__statefall?.order,childCount:record.container.children.length,children:record.container.children.map(child=>child.__statefall?.semantic)}))};
  };
  const missileDiagnostics=()=>{
    const containers=missilePool.diagnostics(),graphics=missileGraphicsPool.diagnostics(),records=Array.from(activeMissiles.values()),scene=missileScene,activeGraphics=records.reduce((sum,record)=>sum+record.graphics.length,0);
    return {owned:missileFrameOwned,order:['complete-structures','naval-logistics','warships','projectiles','missiles-array-order','canvas-aircraft-and-later'],canvasStrokeState:scene?.canvasStrokeState||{lineJoin:'miter',lineCap:'butt',globalAlpha:1,lineDash:[],lineDashOffset:0},counts:scene?.counts||{total:0,visible:0,culled:0,hidden:0,normal:0,cruise:0},trailSampleCount:scene?.trailSampleCount||0,primitiveCount:scene?.primitiveCount||0,segmentCount:scene?.segmentCount||0,pulseTime:scene?.pulseTime??null,entries:records.length,containerMaximum:containers.maximum,containersLive:containers.live,containersIdle:containers.pooled,containersCreated:containers.created,containersReused:containers.reused,containersDestroyed:containers.destroyed,graphicsMaximum:graphics.maximum,graphicsActive:activeGraphics,graphicsIdle:graphics.pooled,graphicsCreated:graphics.created,graphicsReused:graphics.reused,graphicsDestroyed:graphics.destroyed,resourceLimitFallback:{count:missileFallbackCount,reason:missileFallbackReason},presentation:scene?scene.entries.map(entry=>({key:entry.key,variant:entry.variant,order:entry.order,current:entry.current,next:entry.next,target:entry.target,heading:entry.heading,analyticHeading:entry.analyticHeading,bodyScale:entry.bodyScale,trailN:entry.trailN,trailSamples:entry.trailSamples,warningRadius:entry.warningRadius,warningAlpha:entry.warningAlpha,items:entry.items.map(item=>item.semantic),primitiveCounts:entry.items.map(item=>({semantic:item.semantic,count:item.primitives.length})),styles:entry.items.flatMap(item=>item.primitives.map(({kind,stroke,fill,width,alpha,cap,join,dash})=>({kind,stroke,fill,width,alpha,cap,join,dash})))})):[],resources:records.map(record=>({key:record.key,variant:record.container.__statefall?.variant,order:record.container.__statefall?.order,childCount:record.container.children.length,children:record.container.children.map(child=>child.__statefall?.semantic)}))};
  };
  const aircraftDiagnostics=()=>{
    const containers=aircraftPool.diagnostics(),graphics=aircraftGraphicsPool.diagnostics(),records=Array.from(activeAircraft.values()),scene=aircraftScene,activeGraphics=records.reduce((sum,record)=>sum+record.graphics.length,0);
    return {owned:aircraftFrameOwned,order:['complete-structures','naval-logistics','warships','projectiles','missiles','aircraft-array-order','canvas-draft-garrison-and-later'],canvasState:scene?.canvasState||{lineJoin:'miter',lineCap:'butt',globalAlpha:1,lineDash:[],lineDashOffset:0,lineWidth:1,strokeStyle:'#000000',fillStyle:'#000000'},counts:scene?.counts||{total:0,visible:0,culled:0,hidden:0,skipped:0,fighter:0,bomber:0,carrier:0,patrolRings:0,hpPips:0},primitiveCount:scene?.primitiveCount||0,segmentCount:scene?.segmentCount||0,entries:records.length,containerMaximum:containers.maximum,containersLive:containers.live,containersIdle:containers.pooled,containersCreated:containers.created,containersReused:containers.reused,containersDestroyed:containers.destroyed,graphicsMaximum:graphics.maximum,graphicsActive:activeGraphics,graphicsIdle:graphics.pooled,graphicsCreated:graphics.created,graphicsReused:graphics.reused,graphicsDestroyed:graphics.destroyed,generatedTextures:{strategy:'vector-primitives',references:0,textures:0,sourceBytes:0,gpuBytes:{status:'unknown',bytes:null}},resourceLimitFallback:{count:aircraftFallbackCount,reason:aircraftFallbackReason},presentation:scene?scene.entries.map(entry=>({id:entry.id,type:entry.type,state:entry.state,order:entry.order,x:entry.x,y:entry.y,screen:entry.screen,heading:entry.heading,baseRadius:entry.baseRadius,bodyScale:entry.bodyScale,pullScale:entry.pullScale,hpPips:entry.hpPips,patrolTarget:entry.patrolTarget,items:entry.items.map(item=>item.semantic),primitiveCounts:entry.items.map(item=>({semantic:item.semantic,count:item.primitives.length})),styles:entry.items.flatMap(item=>item.primitives.map(({kind,stroke,fill,width,alpha,cap,join,dash})=>({kind,stroke,fill,width,alpha,cap,join,dash})))})):[],resources:records.map(record=>({id:record.key,type:record.container.__statefall?.type,state:record.container.__statefall?.state,order:record.container.__statefall?.order,childCount:record.container.children.length,children:record.container.children.map(child=>child.__statefall?.semantic)}))};
  };
  const projectileRasterEvidence=(samplePoints=[])=>{
    if(!testMode) throw new Error('projectile raster evidence is test-only');
    if(!app?.renderer||!projectileLayer||!projectileFrameOwned) throw new Error('projectile layer is unavailable');
    const resolution=lastMetrics?.effectiveDpr||1,width=lastMetrics?.cssWidth||1,height=lastMetrics?.cssHeight||1,frame=new Rectangle(0,0,width,height),visibility=[];
    const summarize=output=>{
      const pixels=output.pixels||output,width_=output.width||Math.round(width*resolution),height_=output.height||Math.round(height*resolution),colors=new Set(); let count=0,minX=width_,minY=height_,maxX=-1,maxY=-1;
      for(let i=0;i<pixels.length;i+=4){ if(!pixels[i+3]) continue; const n=i/4,x=n%width_,y=Math.floor(n/width_); count++; minX=Math.min(minX,x); minY=Math.min(minY,y); maxX=Math.max(maxX,x); maxY=Math.max(maxY,y); colors.add(`${pixels[i]},${pixels[i+1]},${pixels[i+2]},${pixels[i+3]}`); }
      return {pixels:count,colors:colors.size,bounds:count?{left:minX/resolution,top:minY/resolution,right:(maxX+1)/resolution,bottom:(maxY+1)/resolution}:null,width:width_,height:height_};
    };
    const extract=(target,withSamples=false)=>{ const output=app.renderer.extract.pixels({target,frame,resolution,clearColor:[0,0,0,0],antialias:false}),summary=summarize(output); if(withSamples){ const pixels=output.pixels||output,width_=output.width||summary.width,height_=output.height||summary.height; summary.samples=samplePoints.map(({x,y})=>{ const px=Math.max(0,Math.min(width_-1,Math.floor(x*resolution))),py=Math.max(0,Math.min(height_-1,Math.floor(y*resolution))),i=(py*width_+px)*4; return {x,y,rgba:Array.from(pixels.slice(i,i+4))}; }); } return summary; };
    let evidence=null;
    try{
      for(const child of app.stage.children){ visibility.push([child,child.visible]); child.visible=child===entities; }
      for(const child of entities.children){ visibility.push([child,child.visible]); child.visible=child===projectileLayer; }
      app.render();
      const combined=extract(projectileLayer,true),semantics={},order=[];
      for(const record of activeProjectiles.values()) for(const graphics of record.graphics){ const semantic=graphics.__statefall?.semantic||graphics.label; order.push(semantic); semantics[semantic]=extract(graphics); }
      evidence={resolution,width,height,combined,semantics,order,restored:false}; return evidence;
    }finally{
      for(let i=visibility.length-1;i>=0;i--) visibility[i][0].visible=visibility[i][1];
      if(evidence) evidence.restored=visibility.every(([value,visible])=>value.visible===visible);
    }
  };
  const missileRasterEvidence=(samplePoints=[])=>{
    if(!testMode) throw new Error('missile raster evidence is test-only');
    if(!app?.renderer||!missileLayer||!missileFrameOwned) throw new Error('missile layer is unavailable');
    const resolution=lastMetrics?.effectiveDpr||1,width=lastMetrics?.cssWidth||1,height=lastMetrics?.cssHeight||1,frame=new Rectangle(0,0,width,height),visibility=[];
    const summarize=output=>{ const pixels=output.pixels||output,width_=output.width||Math.round(width*resolution),height_=output.height||Math.round(height*resolution),colors=new Set(); let count=0,minX=width_,minY=height_,maxX=-1,maxY=-1; for(let i=0;i<pixels.length;i+=4){ if(!pixels[i+3]) continue; const n=i/4,x=n%width_,y=Math.floor(n/width_); count++; minX=Math.min(minX,x); minY=Math.min(minY,y); maxX=Math.max(maxX,x); maxY=Math.max(maxY,y); colors.add(`${pixels[i]},${pixels[i+1]},${pixels[i+2]},${pixels[i+3]}`); } return {pixels:count,colors:colors.size,bounds:count?{left:minX/resolution,top:minY/resolution,right:(maxX+1)/resolution,bottom:(maxY+1)/resolution}:null,width:width_,height:height_}; };
    const extract=(target,withSamples=false)=>{ const output=app.renderer.extract.pixels({target,frame,resolution,clearColor:[0,0,0,0],antialias:false}),summary=summarize(output); if(withSamples){ const pixels=output.pixels||output,width_=output.width||summary.width,height_=output.height||summary.height; summary.samples=samplePoints.map(({x,y})=>{ const px=Math.max(0,Math.min(width_-1,Math.floor(x*resolution))),py=Math.max(0,Math.min(height_-1,Math.floor(y*resolution))),i=(py*width_+px)*4; return {x,y,rgba:Array.from(pixels.slice(i,i+4))}; }); } return summary; };
    let evidence=null;
    try{
      for(const child of app.stage.children){ visibility.push([child,child.visible]); child.visible=child===entities; }
      for(const child of entities.children){ visibility.push([child,child.visible]); child.visible=child===missileLayer; }
      app.render();
      const combined=extract(missileLayer,true),semantics={},primitives=[],order=[];
      for(const record of activeMissiles.values()) for(const graphics of record.graphics){ const semantic=graphics.__statefall?.semantic||graphics.label,key=`${record.container.__statefall?.order}:${semantic}`; order.push(semantic); const summary=extract(graphics); semantics[key]=summary; primitives.push({key,semantic,order:record.container.__statefall?.order,...summary}); }
      projectileLayer.visible=true; app.render(); const stacked=extract(entities,true); projectileLayer.visible=false;
      evidence={resolution,width,height,combined,stacked,semantics,primitives,order,restored:false}; return evidence;
    }finally{
      for(let i=visibility.length-1;i>=0;i--) visibility[i][0].visible=visibility[i][1];
      if(evidence) evidence.restored=visibility.every(([value,visible])=>value.visible===visible);
    }
  };
  const aircraftRasterEvidence=(samplePoints=[])=>{
    if(!testMode) throw new Error('aircraft raster evidence is test-only');
    if(!app?.renderer||!aircraftLayer||!aircraftFrameOwned) throw new Error('aircraft layer is unavailable');
    const resolution=lastMetrics?.effectiveDpr||1,width=lastMetrics?.cssWidth||1,height=lastMetrics?.cssHeight||1,frame=new Rectangle(0,0,width,height),visibility=[];
    const summarize=output=>{ const pixels=output.pixels||output,width_=output.width||Math.round(width*resolution),height_=output.height||Math.round(height*resolution),colors=new Set(),opaqueRgb=new Set(); let count=0,minX=width_,minY=height_,maxX=-1,maxY=-1; for(let i=0;i<pixels.length;i+=4){ if(!pixels[i+3]) continue; const n=i/4,x=n%width_,y=Math.floor(n/width_); count++; minX=Math.min(minX,x); minY=Math.min(minY,y); maxX=Math.max(maxX,x); maxY=Math.max(maxY,y); colors.add(`${pixels[i]},${pixels[i+1]},${pixels[i+2]},${pixels[i+3]}`); if(pixels[i+3]>=230) opaqueRgb.add(`${pixels[i]},${pixels[i+1]},${pixels[i+2]}`); } return {pixels:count,colors:colors.size,opaqueRgb:Array.from(opaqueRgb),bounds:count?{left:minX/resolution,top:minY/resolution,right:(maxX+1)/resolution,bottom:(maxY+1)/resolution}:null,width:width_,height:height_}; };
    const extract=(target,withSamples=false)=>{ const output=app.renderer.extract.pixels({target,frame,resolution,clearColor:[0,0,0,0],antialias:false}),summary=summarize(output); if(withSamples){ const pixels=output.pixels||output,width_=output.width||summary.width,height_=output.height||summary.height; summary.samples=samplePoints.map(({x,y})=>{ const px=Math.max(0,Math.min(width_-1,Math.floor(x*resolution))),py=Math.max(0,Math.min(height_-1,Math.floor(y*resolution))),i=(py*width_+px)*4; return {x,y,rgba:Array.from(pixels.slice(i,i+4))}; }); } return summary; };
    let evidence=null,isolated=null;
    try{
      for(const child of app.stage.children){ visibility.push([child,child.visible]); child.visible=child===entities; }
      for(const child of entities.children){ visibility.push([child,child.visible]); child.visible=child===aircraftLayer; }
      app.render(); const combined=extract(aircraftLayer,true),primitives=[],primitiveOrder=[],operationOrder=[],order=[];
      for(const entry of aircraftScene.entries) for(const item of entry.items){ order.push(item.semantic); for(let index=0;index<item.primitives.length;index++){ const primitive=item.primitives[index],key=`${entry.order}:${item.semantic}:${index}`; primitiveOrder.push(key); for(const operation of ['fill','stroke']) if(primitive[operation]) operationOrder.push(`${key}:${operation}`); } }
      for(const child of aircraftLayer.children){ visibility.push([child,child.visible]); child.visible=false; }
      isolated=new Container({label:'aircraft-primitive-evidence'}); aircraftLayer.addChild(isolated);
      for(const entry of aircraftScene.entries) for(const item of entry.items) for(let index=0;index<item.primitives.length;index++){
        const primitive=item.primitives[index],key=`${entry.order}:${item.semantic}:${index}`,graphics=new Graphics({label:key});
        try{ drawPrimitive(graphics,primitive); isolated.addChild(graphics); app.render(); primitives.push({key,semantic:item.semantic,order:entry.order,index,kind:primitive.kind,fill:primitive.fill||null,stroke:primitive.stroke||null,...extract(graphics)}); }
        finally{ try{ isolated.removeChild(graphics); }catch{} try{ graphics.destroy(); }catch{} }
      }
      for(const [child,visible] of visibility) if(child.parent===aircraftLayer) child.visible=visible;
      missileLayer.visible=true; app.render(); const stacked=extract(entities,true); missileLayer.visible=false;
      evidence={resolution,width,height,combined,stacked,primitives,primitiveOrder,operationOrder,order,restored:false}; return evidence;
    }finally{ if(isolated){ try{ isolated.removeFromParent(); isolated.destroy({children:true}); }catch{} } for(let i=visibility.length-1;i>=0;i--) visibility[i][0].visible=visibility[i][1]; if(evidence) evidence.restored=visibility.every(([value,visible])=>value.visible===visible)&&!isolated?.parent; }
  };
  return {
    kind:'pixi-hybrid',hybrid:true,
    mount,markUnhealthy,capabilities,
    injectFailure(kind){ if(kind==='entry') failEntryCreateRemaining=1; else if(kind==='graphics') failGraphicsCreateRemaining=1; else if(kind==='label') failLabelCreateRemaining=1; else if(kind==='structure-graphics-after-append') failStructureGraphicsAfterAppend=1; else if(kind==='structure-label-after-paint') failStructureLabelAfterPaint=1; else if(kind==='structure-container-after-append') failStructureContainerAfterAppend=1; else if(kind==='naval-container') failNavalContainerRemaining=1; else if(kind==='naval-graphics') failNavalGraphicsRemaining=1; else if(kind==='naval-label') failNavalLabelRemaining=1; else if(kind==='naval-graphics-after-append') failNavalGraphicsAfterAppend=1; else if(kind==='naval-label-after-paint') failNavalLabelAfterPaint=1; else if(kind==='naval-container-after-append') failNavalContainerAfterAppend=1; else if(kind==='warship-container') failWarshipContainerRemaining=1; else if(kind==='warship-graphics') failWarshipGraphicsRemaining=1; else if(kind==='warship-label') failWarshipLabelRemaining=1; else if(kind==='warship-graphics-after-append') failWarshipGraphicsAfterAppend=1; else if(kind==='warship-label-after-paint') failWarshipLabelAfterPaint=1; else if(kind==='warship-container-after-append') failWarshipContainerAfterAppend=1; else if(kind==='projectile-container') failProjectileContainerRemaining=1; else if(kind==='projectile-graphics') failProjectileGraphicsRemaining=1; else if(kind==='projectile-graphics-after-paint') failProjectileGraphicsAfterPaint=1; else if(kind==='projectile-container-after-append') failProjectileContainerAfterAppend=1; else if(kind==='missile-container') failMissileContainerRemaining=1; else if(kind==='missile-graphics') failMissileGraphicsRemaining=1; else if(kind==='missile-graphics-after-paint') failMissileGraphicsAfterPaint=1; else if(kind==='missile-container-after-append') failMissileContainerAfterAppend=1; else if(kind==='final-render') failFinalRenderRemaining=1; else if(kind==='world-layer-update') failWorldLayerRemaining=1; else throw new Error(`unknown renderer failure: ${kind}`); },
    injectAircraftFailure(kind){ if(kind==='aircraft-container') failAircraftContainerRemaining=1; else if(kind==='aircraft-graphics') failAircraftGraphicsRemaining=1; else if(kind==='aircraft-graphics-after-paint') failAircraftGraphicsAfterPaint=1; else if(kind==='aircraft-container-after-append') failAircraftContainerAfterAppend=1; else throw new Error('unknown aircraft failure injection'); },
    projectileRasterEvidence,missileRasterEvidence,aircraftRasterEvidence,
    resize(metrics){
      lastMetrics=metrics; if(!app?.renderer) return;
      app.renderer.resolution=metrics.effectiveDpr; app.renderer.resize(metrics.cssWidth,metrics.cssHeight);
      app.canvas.style.width=`${metrics.cssWidth}px`; app.canvas.style.height=`${metrics.cssHeight}px`;
    },
    updateRaster(nextSource){ source=nextSource; dirty=true; rasterBuildCount++; },
    invalidateRaster(nextSource){ source=nextSource; dirty=true; rasterBuildCount++; },
    motionState(time=performance.now()){ return {time:reducedMotion?0:Number(time)||0,reducedMotion}; },
    updateWorldLayer(layer,state){ if(failWorldLayerRemaining){ failWorldLayerRemaining--; throw new Error('world-layer-update'); } const value=typeof state==='function'?state():state; return layer==='pre-structures'?updatePreStructures(value):layer==='structures'?updateStructures(value):layer==='naval-logistics'?updateNaval(value):layer==='warships'?updateWarships(value):layer==='projectiles'?updateProjectiles(value):layer==='missiles'?updateMissiles(value):layer==='aircraft'?updateAircraft(value):false; },
    renderFrame(camera){
      if(!app||contextState==='lost') return;
      if(source&&!texture){ texture=Texture.from(source); textureAllocations++; texture.source.scaleMode='nearest'; sprite=new Sprite(texture); world.addChild(sprite); }
      if(dirty&&texture){ texture.source.update(); rasterUploadCount++; dirty=false; }
      if(sprite){ sprite.position.set(camera.x,camera.y); sprite.scale.set(camera.s); }
      if(failFinalRenderRemaining){
        failFinalRenderRemaining--;
        const submit=app.render;
        app.render=function(){ app.render=submit; throw new Error('final-app-render'); };
      }
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
      clearPreStructures(); clearStructures(); clearNaval(); clearWarships(); clearProjectiles(); clearMissiles(); clearAircraft();
      if(sprite){ world.removeChild(sprite); sprite.destroy({texture:false}); sprite=null; }
      destroyTexture(); source=null; dirty=false;
    },
    destroy(){ release(); contextState='destroyed'; },
    diagnostics(){
      const structures=structureDiagnostics();
      const naval=navalDiagnostics();
      const warships=warshipDiagnostics();
      const projectiles=projectileDiagnostics();
      const missiles=missileDiagnostics();
      const aircraft=aircraftDiagnostics();
      return {rasterBuildCount,rasterUploadCount,textureCount:(texture?1:0)+structures.textureCount+structures.labelTextureCount+naval.labelTextureCount+warships.labelTextureCount,spriteCount:(sprite?1:0)+structures.entries+structures.pooled+structures.activeLabelSprites+structures.idleLabelSprites+naval.labelActive+naval.labelIdle+warships.labelActive+warships.labelIdle,graphicsCount:(frontsGraphics?2:0)+structures.entryGraphicsCount+structures.pooledGraphicsCount+naval.graphicsActive+naval.graphicsIdle+warships.graphicsActive+warships.graphicsIdle+projectiles.graphicsActive+projectiles.graphicsIdle+missiles.graphicsActive+missiles.graphicsIdle+aircraft.graphicsActive+aircraft.graphicsIdle,textCount:0,containerCount:app?11+structures.entries+structures.pooled+naval.containersLive+warships.containersLive+projectiles.containersLive+missiles.containersLive+aircraft.containersLive:0,canvasCount:canvas?1:0,contextListenerCount,contextState,resumeCount,applicationAllocations,rendererAllocations,textureAllocations,releaseCount,textureDestroyCount,quality:{requested:requestedQuality,effective:quality},reducedMotion,motion:{clock:reducedMotion?'frozen':'monotonic',frozenTime:reducedMotion?0:null},capabilities:capabilities(),compositingConflictFallback:{active:false,count:0,reason:null,detail:null},layers:{terrain:{owned:!!(healthy&&texture),textureCount:texture?1:0,spriteCount:sprite?1:0},preStructures:preStructureDiagnostics(),structures,navalLogistics:naval,warships,projectiles,missiles,aircraft}};
    }
  };
}
