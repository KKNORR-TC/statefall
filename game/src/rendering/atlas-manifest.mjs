export const ATLAS_SCHEMA='statefall-atlas/v1';
export const ATLAS_LIMITS=Object.freeze({atlases:8,frames:4096,width:4096,height:4096,sourceBytes:32*1024*1024,totalSourceBytes:64*1024*1024});

const fail=(category,message)=>{ const error=new Error(message); error.category=category; throw error; };
const integer=(value,name,minimum=0)=>{ if(!Number.isSafeInteger(value)||value<minimum) fail('manifest-schema',`${name} must be an integer >= ${minimum}`); return value; };
const finite=(value,name)=>{ if(!Number.isFinite(value)) fail('manifest-schema',`${name} must be finite`); return value; };

export function resolveAtlasAsset(asset,baseURL=location.href){
  if(typeof asset!=='string'||!asset||asset.includes('\\')||asset.startsWith('/')||asset.startsWith('//')||asset.includes('?')||asset.includes('#')) fail('asset-url','atlas source must be a relative same-origin asset identifier');
  const parts=asset.split('/');
  if(parts.some(part=>!part||part==='.'||part==='..')) fail('asset-url','atlas source contains an invalid path segment');
  let base,resolved;
  try{ base=new URL(baseURL); resolved=new URL(asset,base); }catch{ fail('asset-url','atlas source URL is invalid'); }
  if(!['http:','https:'].includes(base.protocol)||resolved.origin!==base.origin||!resolved.pathname.startsWith(new URL('.',base).pathname)) fail('asset-url','atlas source must remain below the same-origin base path');
  return resolved.href;
}

export function validateAtlasManifest(input,{limits=ATLAS_LIMITS,baseURL=location.href}={}){
  if(!input||typeof input!=='object'||Array.isArray(input)) fail('manifest-schema','atlas manifest must be an object');
  if(input.schema!==ATLAS_SCHEMA||input.version!==1) fail('manifest-version',`unsupported atlas schema/version: ${input.schema||'missing'}/${input.version??'missing'}`);
  if(typeof input.id!=='string'||!/^[a-z0-9][a-z0-9._-]{0,63}$/.test(input.id)) fail('manifest-schema','atlas id is invalid');
  const source=input.source;
  if(!source||typeof source!=='object') fail('manifest-schema','atlas source is required');
  const width=integer(source.width,'source.width',1),height=integer(source.height,'source.height',1),bytes=integer(source.bytes,'source.bytes',1);
  if(width>limits.width||height>limits.height) fail('dimension-cap','atlas dimensions exceed the configured cap');
  if(bytes>limits.sourceBytes) fail('source-byte-cap','atlas source bytes exceed the configured cap');
  if(!['image/png','image/webp'].includes(source.mime)) fail('source-mime','atlas source MIME must be image/png or image/webp');
  const sourceURL=resolveAtlasAsset(source.asset,baseURL);
  if(!Array.isArray(input.frames)||input.frames.length<1) fail('manifest-schema','atlas frames must be a nonempty array');
  if(input.frames.length>limits.frames) fail('frame-cap','atlas frame count exceeds the configured cap');
  const keys=new Set(),rectangles=[];
  const frames=input.frames.map((frame,index)=>{
    if(!frame||typeof frame!=='object') fail('manifest-schema',`frame ${index} must be an object`);
    if(typeof frame.key!=='string'||!/^[a-z0-9][a-z0-9._/-]{0,127}$/.test(frame.key)||keys.has(frame.key)) fail(keys.has(frame?.key)?'duplicate-frame-key':'manifest-schema',`invalid or duplicate frame key: ${frame?.key}`);
    keys.add(frame.key);
    const x=integer(frame.x,`${frame.key}.x`),y=integer(frame.y,`${frame.key}.y`),frameWidth=integer(frame.width,`${frame.key}.width`,1),frameHeight=integer(frame.height,`${frame.key}.height`,1);
    if(x+frameWidth>width||y+frameHeight>height) fail('frame-bounds',`frame ${frame.key} lies outside its source`);
    const scale=finite(frame.scale,`${frame.key}.scale`); if(scale<=0||scale>16) fail('manifest-schema',`frame ${frame.key} scale is outside (0,16]`);
    if(!frame.anchor||typeof frame.anchor!=='object') fail('manifest-schema',`frame ${frame.key} anchor is required`);
    const anchor=Object.freeze({x:finite(frame.anchor.x,`${frame.key}.anchor.x`),y:finite(frame.anchor.y,`${frame.key}.anchor.y`)});
    if(anchor.x<0||anchor.x>1||anchor.y<0||anchor.y>1) fail('manifest-schema',`frame ${frame.key} anchor is outside [0,1]`);
    const rectangle={key:frame.key,x,y,width:frameWidth,height:frameHeight};
    for(const other of rectangles) if(x<other.x+other.width&&x+frameWidth>other.x&&y<other.y+other.height&&y+frameHeight>other.y) fail('frame-overlap',`frames ${other.key} and ${frame.key} overlap`);
    rectangles.push(rectangle);
    return Object.freeze({...rectangle,scale,anchor});
  });
  return Object.freeze({schema:ATLAS_SCHEMA,version:1,id:input.id,source:Object.freeze({asset:source.asset,url:sourceURL,mime:source.mime,width,height,bytes}),frames:Object.freeze(frames)});
}

export function atlasBundleCategory(path){
  return /\.atlas\.json$/i.test(path)?'atlas-manifest':/\.(?:png|webp)$/i.test(path)?'atlas-texture':'other';
}
