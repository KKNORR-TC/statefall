import {Application,Container,Sprite,Texture} from 'pixi.js';

export function createPixiHybridRenderer({onContextFailure=()=>{},failResumeAt=0}={}){
  let app=null,canvas=null,world=null,entities=null,effects=null,texture=null,sprite=null,source=null,dirty=false,stage=null,lastMetrics=null;
  let rasterBuildCount=0,rasterUploadCount=0,contextState='initializing',contextListenerCount=0,resumeCount=0;
  let applicationAllocations=0,rendererAllocations=0,textureAllocations=0,releaseCount=0,textureDestroyCount=0;
  const contextLost=event=>{ event.preventDefault(); contextState='lost'; onContextFailure('pixi-context-lost'); };
  const contextRestored=()=>{ contextState='restored'; dirty=true; };
  const destroyTexture=()=>{ if(!texture) return; try{ texture.destroy(true); }catch{} texture=null; textureDestroyCount++; };
  const release=({preserveSource=false}={})=>{
    if(!app&&!canvas&&!world&&!entities&&!effects&&!texture&&!sprite){ if(!preserveSource){ source=null; dirty=false; } return; }
    releaseCount++;
    if(canvas){ canvas.removeEventListener('webglcontextlost',contextLost); canvas.removeEventListener('webglcontextrestored',contextRestored); contextListenerCount=0; }
    if(sprite){ try{ world?.removeChild(sprite); sprite.destroy({texture:false}); }catch{} sprite=null; }
    destroyTexture();
    try{ if(app?.renderer) app.destroy(true,{children:true,texture:false,textureSource:false}); }catch{}
    canvas?.remove(); app=null; canvas=null; world=null; entities=null; effects=null;
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
      app.stop(); world=new Container({label:'world-raster'}); entities=new Container({label:'planned-entities'}); effects=new Container({label:'planned-effects'});
      app.stage.addChild(world,entities,effects); canvas.addEventListener('webglcontextlost',contextLost); canvas.addEventListener('webglcontextrestored',contextRestored); contextListenerCount=2;
      if(failAfterSetup) throw new Error('Pixi failure injected after resource setup');
      contextState='ready'; dirty=!!source;
    }catch(error){ release({preserveSource:true}); contextState='failed'; throw error; }
  };
  return {
    kind:'pixi-hybrid',hybrid:true,
    mount,
    resize(metrics){
      lastMetrics=metrics; if(!app?.renderer) return;
      app.renderer.resolution=metrics.effectiveDpr; app.renderer.resize(metrics.cssWidth,metrics.cssHeight);
      app.canvas.style.width=`${metrics.cssWidth}px`; app.canvas.style.height=`${metrics.cssHeight}px`;
    },
    updateRaster(nextSource){ source=nextSource; dirty=true; rasterBuildCount++; },
    invalidateRaster(nextSource){ source=nextSource; dirty=true; rasterBuildCount++; },
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
      const canvas=app?.canvas,valid=app&&canvas?.isConnected&&contextState!=='lost'&&app.renderer?.gl;
      if(!valid){ release({preserveSource:true}); contextState='restoring'; await mount({stage,metrics}); }
      this.resize(metrics); contextState='ready';
    },
    reset(){
      if(sprite){ world.removeChild(sprite); sprite.destroy({texture:false}); sprite=null; }
      destroyTexture();
      source=null; dirty=false;
    },
    destroy(){
      release(); contextState='destroyed';
    },
    diagnostics(){ return {rasterBuildCount,rasterUploadCount,textureCount:texture?1:0,spriteCount:sprite?1:0,containerCount:app?3:0,canvasCount:canvas?1:0,contextListenerCount,contextState,resumeCount,applicationAllocations,rendererAllocations,textureAllocations,releaseCount,textureDestroyCount}; }
  };
}
