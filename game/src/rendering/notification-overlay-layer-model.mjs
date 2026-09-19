export const MAX_NOTIFICATION_ENTRIES=256;
export const MAX_NOTIFICATION_LABELS=2048;
export const MAX_NOTIFICATION_CHARS=131072;
export const MAX_NOTIFICATION_PRIMITIVES=4096;
export const MAX_NOTIFICATION_SEGMENTS=32768;
export const MAX_NOTIFICATION_CONTAINERS=1;
export const MAX_NOTIFICATION_GRAPHICS=4096;
export const MAX_NOTIFICATION_SPRITES=1;
export const MAX_NOTIFICATION_TEXTURES=1;
export const MAX_NOTIFICATION_SOURCE_BYTES=64*1024*1024;
export const NOTIFICATION_COMPOSITE_MODES=Object.freeze({
  'source-over':'normal',
  lighter:'add'
});

function cap(limits,name,fallback){
  const value=limits[name]??fallback;
  if(!Number.isSafeInteger(value)||value<0) throw new TypeError(`invalid notification ${name} cap`);
  return value;
}

function add(current,value,reason){
  if(current>Number.MAX_SAFE_INTEGER-value) throw new RangeError(reason);
  return current+value;
}

function rasterPlan(viewport,resolution,visible,canvasState){
  if(!visible) return null;
  const blendMode=NOTIFICATION_COMPOSITE_MODES[canvasState.globalCompositeOperation];
  if(!blendMode) throw new RangeError('composite-mode');
  const scaledWidth=viewport.width*resolution,scaledHeight=viewport.height*resolution;
  if(!Number.isFinite(scaledWidth)||!Number.isFinite(scaledHeight)) throw new TypeError('invalid notification overlay state');
  const pixelWidth=Math.max(1,Math.round(scaledWidth)),pixelHeight=Math.max(1,Math.round(scaledHeight));
  if(!Number.isSafeInteger(pixelWidth)||!Number.isSafeInteger(pixelHeight)||pixelWidth>Number.MAX_SAFE_INTEGER/pixelHeight||pixelWidth*pixelHeight>Number.MAX_SAFE_INTEGER/4) throw new RangeError('source-byte-cap');
  return Object.freeze({key:`notification:viewport:${JSON.stringify(canvasState)}`,kind:'sprite',blendMode,bounds:Object.freeze({left:0,top:0,right:viewport.width,bottom:viewport.height}),resolution,pixelWidth,pixelHeight,sourceBytes:pixelWidth*pixelHeight*4,canvasState});
}

function validate(input){
  const viewport={width:input?.viewport?.width,height:input?.viewport?.height},resolution=input?.resolution,notifications=Array.isArray(input?.notifications)?input.notifications:[],canvasState=input?.canvasState||{};
  if(typeof viewport.width!=='number'||typeof viewport.height!=='number'||typeof resolution!=='number'||!Number.isFinite(viewport.width)||!Number.isFinite(viewport.height)||viewport.width<0||viewport.height<0||!(resolution>0)||!Number.isFinite(resolution)||resolution>Number.MAX_SAFE_INTEGER) throw new TypeError('invalid notification overlay state');
  for(const item of notifications) if(!item||typeof item.key!=='string'||!item.key||typeof item.kind!=='string'||!Number.isSafeInteger(item.labels)||item.labels<0||!Number.isSafeInteger(item.chars)||item.chars<0||!Number.isSafeInteger(item.primitives)||item.primitives<0||!Number.isSafeInteger(item.segments)||item.segments<0) throw new TypeError('invalid notification overlay entry');
  if(!canvasState||typeof canvasState!=='object'||!Array.isArray(canvasState.lineDash||[])||!Array.isArray(canvasState.transform||[])||(canvasState.transform&&canvasState.transform.length!==6)) throw new TypeError('invalid notification canvas state');
  const frozenCanvasState=Object.freeze({...canvasState,lineDash:Object.freeze([...(canvasState.lineDash||[])]),transform:Object.freeze([...(canvasState.transform||[])])});
  return {viewport,resolution,notifications,canvasState:frozenCanvasState};
}

export function createNotificationOverlayModel(){
  return Object.freeze({
    build(input,limits={}){
      const {viewport,resolution,notifications,canvasState}=validate(input),maximum={entries:cap(limits,'entries',MAX_NOTIFICATION_ENTRIES),labels:cap(limits,'labels',MAX_NOTIFICATION_LABELS),chars:cap(limits,'chars',MAX_NOTIFICATION_CHARS),primitives:cap(limits,'primitives',MAX_NOTIFICATION_PRIMITIVES),segments:cap(limits,'segments',MAX_NOTIFICATION_SEGMENTS),containers:cap(limits,'containers',MAX_NOTIFICATION_CONTAINERS),graphics:cap(limits,'graphics',MAX_NOTIFICATION_GRAPHICS),sprites:cap(limits,'sprites',MAX_NOTIFICATION_SPRITES),textures:cap(limits,'textures',MAX_NOTIFICATION_TEXTURES),sourceBytes:cap(limits,'sourceBytes',MAX_NOTIFICATION_SOURCE_BYTES)};
      if(notifications.length>maximum.entries) throw new RangeError('entry-cap');
      const keys=new Set(); let labels=0,chars=0,primitives=0,segments=0;
      const entries=notifications.map((item,order)=>{ if(keys.has(item.key)) throw new TypeError('duplicate notification stable key'); keys.add(item.key); labels=add(labels,item.labels,'label-cap'); chars=add(chars,item.chars,'char-cap'); primitives=add(primitives,item.primitives,'primitive-cap'); segments=add(segments,item.segments,'segment-cap'); const entry={key:item.key,kind:item.kind,order}; if(Number.isFinite(item.age)) entry.age=item.age; if(Number.isFinite(item.alpha)) entry.alpha=item.alpha; return Object.freeze(entry); });
      if(labels>maximum.labels) throw new RangeError('label-cap');
      if(chars>maximum.chars) throw new RangeError('char-cap');
      if(primitives>maximum.primitives) throw new RangeError('primitive-cap');
      if(segments>maximum.segments) throw new RangeError('segment-cap');
      const visible=viewport.width>0&&viewport.height>0&&entries.length>0;
      const raster=rasterPlan(viewport,resolution,visible,canvasState),resources=Object.freeze({containers:raster?1:0,graphics:primitives,sprites:raster?1:0,textures:raster?1:0,sourceBytes:raster?.sourceBytes||0});
      if(resources.containers>maximum.containers) throw new RangeError('container-cap');
      if(resources.graphics>maximum.graphics) throw new RangeError('graphics-cap');
      if(resources.sprites>maximum.sprites) throw new RangeError('sprite-cap');
      if(resources.textures>maximum.textures) throw new RangeError('texture-cap');
      if(resources.sourceBytes>maximum.sourceBytes) throw new RangeError('source-byte-cap');
      return Object.freeze({entries:Object.freeze(entries),raster,resources,counts:Object.freeze({entries:entries.length,labels,chars,primitives,segments,visible:visible?entries.length:0,culled:visible?0:entries.length}),limits:Object.freeze(maximum)});
    },
    reset(){}
  });
}
