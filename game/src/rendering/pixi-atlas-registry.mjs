import {Application,CanvasSource,Container,Rectangle,Sprite,Texture} from 'pixi.js';
import {ATLAS_LIMITS,ATLAS_SCHEMA,validateAtlasManifest} from './atlas-manifest.mjs';

const categorized=(category,message,cause)=>{ const error=new Error(message,{cause}); error.category=category; return error; };

async function defaultLoadSource(source){
  let response;
  try{ response=await fetch(source.url,{credentials:'same-origin',mode:'same-origin',redirect:'error'}); }catch(error){ throw categorized('source-fetch','atlas source request failed',error); }
  if(!response.ok) throw categorized('source-fetch',`atlas source request failed with HTTP ${response.status}`);
  const mime=(response.headers.get('content-type')||'').split(';')[0].trim().toLowerCase();
  if(mime!==source.mime) throw categorized('source-mime',`atlas source MIME ${mime||'missing'} does not match ${source.mime}`);
  const blob=await response.blob();
  if(blob.size!==source.bytes) throw categorized('source-bytes',`atlas source byte count ${blob.size} does not match ${source.bytes}`);
  try{ const resource=await createImageBitmap(blob); return {resource,width:resource.width,height:resource.height,mime,bytes:blob.size,destroy(){ this.resource.close(); }}; }
  catch(error){ throw categorized('source-decode','atlas source decode failed',error); }
}

export function createPixiAtlasRegistry({limits=ATLAS_LIMITS,loadSource=defaultLoadSource,onFallback=()=>{},createSource=options=>new CanvasSource(options),createTexture=options=>new Texture(options),createRectangle=(...values)=>new Rectangle(...values),beforeTextureCreate=()=>{}}={}){
  const atlases=new Map(); let clock=0,loads=0,destroyed=0,evictions=0,fallbacks=0,lastFailure=null,totalSourceBytes=0,totalFrames=0,generation=0,closed=false;
  const destroyStaged=entry=>{ if(!entry||entry.destroyed) return; entry.destroyed=true; for(const texture of entry.frames.values()) try{ texture.destroy(false); }catch{} try{ entry.base?.destroy(true); }catch{} if(!entry.base) try{ entry.source?.destroy?.(); }catch{} try{ entry.loaded?.destroy?.(); }catch{} };
  const destroyEntry=entry=>{ if(!entry||entry.destroyed) return; atlases.delete(entry.manifest.id); totalSourceBytes-=entry.manifest.source.bytes; totalFrames-=entry.manifest.frames.length; destroyStaged(entry); destroyed++; };
  const evictionPlan=(neededAtlases=0,neededBytes=0,neededFrames=0)=>{ const candidates=Array.from(atlases.values()).filter(entry=>entry.refs===0).sort((a,b)=>a.used-b.used||a.manifest.id.localeCompare(b.manifest.id)),plan=[]; let atlasCount=atlases.size,bytes=totalSourceBytes,frames=totalFrames; while(candidates.length&&(atlasCount+neededAtlases>limits.atlases||bytes+neededBytes>limits.totalSourceBytes||frames+neededFrames>limits.frames)){ const entry=candidates.shift(); plan.push(entry); atlasCount--; bytes-=entry.manifest.source.bytes; frames-=entry.manifest.frames.length; } return {plan,atlasCount,bytes,frames}; };
  const evict=()=>{ const {plan}=evictionPlan(); for(const entry of plan){ destroyEntry(entry); evictions++; } };
  const fallback=error=>{ fallbacks++; lastFailure={category:error.category||'texture-create',message:String(error.message||error).slice(0,160)}; try{ onFallback(lastFailure); }catch{} return null; };
  return Object.freeze({
    async load(input,{baseURL=location.href,source=null}={}){
      let manifest,loaded=null,sourceTexture=null,base=null,staged=null; const frames=new Map(),loadGeneration=generation;
      try{
        manifest=validateAtlasManifest(input,{limits,baseURL});
        if(closed) throw categorized('registry-destroyed','atlas registry is destroyed');
        loaded=source||await loadSource(manifest.source);
        if(!loaded||!loaded.resource) throw categorized('source-decode','atlas loader returned no decoded resource');
        if(loaded.mime!==manifest.source.mime) throw categorized('source-mime','decoded source MIME does not match manifest');
        if(loaded.width!==manifest.source.width||loaded.height!==manifest.source.height) throw categorized('source-dimensions','decoded source dimensions do not match manifest');
        if(loaded.bytes!==manifest.source.bytes) throw categorized('source-bytes','decoded source byte count does not match manifest');
        sourceTexture=createSource({resource:loaded.resource,resolution:1,autoDensity:false,antialias:false});
        sourceTexture.update();
        beforeTextureCreate('base',manifest,null); base=createTexture({source:sourceTexture});
        for(const frame of manifest.frames){ beforeTextureCreate('frame',manifest,frame); frames.set(frame.key,createTexture({source:base.source,frame:createRectangle(frame.x,frame.y,frame.width,frame.height)})); }
        staged={manifest,loaded,source:sourceTexture,base,frames,refs:0,used:0,destroyed:false};

        if(closed||loadGeneration!==generation) throw categorized('registry-destroyed','atlas registry changed while the source was loading');
        if(atlases.has(manifest.id)) throw categorized('duplicate-atlas-id',`atlas ${manifest.id} is already loaded`);
        const fit=evictionPlan(1,manifest.source.bytes,manifest.frames.length);
        if(fit.atlasCount+1>limits.atlases) throw categorized('texture-cap','atlas texture cap is full and all entries are referenced');
        if(fit.bytes+manifest.source.bytes>limits.totalSourceBytes) throw categorized('source-byte-cap','total atlas source-byte cap would be exceeded');
        if(fit.frames+manifest.frames.length>limits.frames) throw categorized('frame-cap','total atlas frame cap would be exceeded');
        for(const entry of fit.plan){ destroyEntry(entry); evictions++; }
        staged.used=++clock; atlases.set(manifest.id,staged); totalSourceBytes+=manifest.source.bytes; totalFrames+=manifest.frames.length; loads++; return manifest.id;
      }catch(error){
        destroyStaged(staged||{loaded,source:sourceTexture,base,frames,destroyed:false});
        return fallback(error);
      }
    },
    acquire(atlasId,frameKey){ const entry=atlases.get(atlasId),texture=entry?.frames.get(frameKey); if(!entry||!texture) return null; entry.refs++; entry.used=++clock; let released=false; const frame=entry.manifest.frames.find(value=>value.key===frameKey); return Object.freeze({texture,scale:frame.scale,anchor:frame.anchor,release(){ if(released) return; released=true; entry.refs=Math.max(0,entry.refs-1); entry.used=++clock; }}); },
    evict(){ evict(0); },
    reset(){ generation++; for(const entry of Array.from(atlases.values())) destroyEntry(entry); },
    contextReset(){ generation++; for(const entry of Array.from(atlases.values())) destroyEntry(entry); },
    destroy(){ if(closed) return; closed=true; generation++; for(const entry of Array.from(atlases.values())) destroyEntry(entry); },
    diagnostics(){ return {schema:1,loads,liveAtlases:atlases.size,liveFrames:totalFrames,references:Array.from(atlases.values()).reduce((sum,value)=>sum+value.refs,0),sourceBytes:totalSourceBytes,destroyed,evictions,fallbacks,lastFailure,categories:{manifests:atlases.size,atlasTextures:atlases.size,subtextures:totalFrames,generatedTextures:0,labelTextures:0}}; }
  });
}

export async function syntheticAtlasEvidence(dpr=devicePixelRatio){
  const canvas=document.createElement('canvas'); canvas.width=8; canvas.height=4;
  const context=canvas.getContext('2d'); context.fillStyle='#ff0000'; context.fillRect(0,0,4,4); context.fillStyle='#0066ff'; context.fillRect(4,0,4,4);
  const manifest={schema:ATLAS_SCHEMA,version:1,id:'synthetic',source:{asset:'assets/synthetic-test-atlas.png',mime:'image/png',width:8,height:4,bytes:128},frames:[{key:'red',x:0,y:0,width:4,height:4,scale:2,anchor:{x:.5,y:.5}},{key:'blue',x:4,y:0,width:4,height:4,scale:1,anchor:{x:0,y:0}}]};
  const failures=[],registry=createPixiAtlasRegistry({onFallback:value=>failures.push(value)}),app=new Application(); let red=null,blue=null;
  try{
    await app.init({width:64,height:32,resolution:dpr,autoDensity:false,antialias:false,background:'#101010',preference:'webgl'});
    const id=await registry.load(manifest,{baseURL:location.href,source:{resource:canvas,width:8,height:4,mime:'image/png',bytes:128,destroy(){ canvas.width=0; canvas.height=0; }}});
    if(!id) throw new Error(`synthetic atlas load failed: ${JSON.stringify(failures)}`);
    red=registry.acquire(id,'red'); blue=registry.acquire(id,'blue');
    const root=new Container(),redSprite=new Sprite(red.texture),blueSprite=new Sprite(blue.texture);
    redSprite.anchor.set(red.anchor.x,red.anchor.y); redSprite.scale.set(red.scale); redSprite.position.set(18,16); blueSprite.anchor.set(blue.anchor.x,blue.anchor.y); blueSprite.scale.set(blue.scale); blueSprite.position.set(40,14); root.addChild(redSprite,blueSprite); app.stage.addChild(root); app.render();
    const extracted=await app.renderer.extract.pixels(app.stage),pixels=extracted.pixels||extracted,counts={red:0,blue:0};
    for(let index=0;index<pixels.length;index+=4){ if(pixels[index]>220&&pixels[index+1]<40&&pixels[index+2]<40) counts.red++; if(pixels[index]<40&&pixels[index+1]>70&&pixels[index+2]>220) counts.blue++; }
    const beforeRelease=registry.diagnostics(); red.release(); blue.release(); red=null; blue=null; root.destroy({children:true,texture:false}); registry.contextReset(); const afterReset=registry.diagnostics();
    return {dpr,resolution:app.renderer.resolution,counts,beforeRelease,afterReset,failures};
  }finally{ red?.release(); blue?.release(); registry.destroy(); try{ app.destroy(true,{children:true,texture:false}); }catch{} }
}
