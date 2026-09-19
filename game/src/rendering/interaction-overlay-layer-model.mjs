import {primitiveGraphicsSegments} from './pre-structure-layer-model.mjs';
import {paintBoundsIntersectViewport} from './paint-bounds.mjs';

export const MAX_INTERACTION_ENTRIES=16;
export const MAX_INTERACTION_PRIMITIVES=8;
export const MAX_INTERACTION_SEGMENTS=4096;
export const MAX_INTERACTION_LABELS=8;
export const MAX_INTERACTION_CHARS=1024;
export const MAX_INTERACTION_CONTAINERS=16;
export const MAX_INTERACTION_GRAPHICS=8;
export const MAX_INTERACTION_SPRITES=8;
export const MAX_INTERACTION_TEXTURES=16;
export const MAX_INTERACTION_SOURCE_BYTES=4*1024*1024;
export const MAX_INTERACTION_IDLE_RESOURCES=16;

const finite=value=>Number.isFinite(Number(value)),color=value=>typeof value==='string'&&value.length>0;

function cap(limits,name,fallback){ const value=limits[name]??fallback; if(!Number.isSafeInteger(value)||value<0) throw new TypeError(`invalid interaction ${name} cap`); return value; }
function add(a,b,reason){ if(a>Number.MAX_SAFE_INTEGER-b) throw new RangeError(reason); return a+b; }
function cloneState(value){ return {...value,lineDash:Object.freeze([...(value.lineDash||[])]),transform:Object.freeze([...(value.transform||[1,0,0,1,0,0])])}; }
function inheritedState(input,allowAnyComposite=false){
  const value=input?.inheritedCanvasState||{},dash=Array.isArray(value.lineDash)?value.lineDash.map(Number):[],transform=Array.isArray(value.transform)?value.transform.map(Number):[1,0,0,1,0,0];
  if(dash.some(item=>!finite(item)||item<0)||transform.length!==6||transform.some(item=>!finite(item))) throw new TypeError('invalid interaction inherited state');
  const composite=value.globalCompositeOperation||'source-over'; if(!allowAnyComposite&&!['source-over','lighter'].includes(composite)) throw new RangeError('composite-mode');
  return {globalAlpha:finite(value.globalAlpha)?Number(value.globalAlpha):1,globalCompositeOperation:composite,lineJoin:['round','bevel'].includes(value.lineJoin)?value.lineJoin:'miter',lineCap:['round','square'].includes(value.lineCap)?value.lineCap:'butt',lineDash:dash,lineDashOffset:finite(value.lineDashOffset)?Number(value.lineDashOffset):0,lineWidth:finite(value.lineWidth)&&Number(value.lineWidth)>=0?Number(value.lineWidth):1,miterLimit:finite(value.miterLimit)&&Number(value.miterLimit)>0?Number(value.miterLimit):10,strokeStyle:color(value.strokeStyle)?value.strokeStyle:'#000000',fillStyle:color(value.fillStyle)?value.fillStyle:'#000000',font:typeof value.font==='string'?value.font:'10px sans-serif',textAlign:['left','right','center','start','end'].includes(value.textAlign)?value.textAlign:'start',textBaseline:['top','hanging','middle','alphabetic','ideographic','bottom'].includes(value.textBaseline)?value.textBaseline:'alphabetic',direction:['ltr','rtl','inherit'].includes(value.direction)?value.direction:'inherit',transform};
}
function applyState(context,state){ context.globalAlpha=state.globalAlpha; context.globalCompositeOperation=state.globalCompositeOperation; context.lineJoin=state.lineJoin; context.lineCap=state.lineCap; context.setLineDash(state.lineDash); context.lineDashOffset=state.lineDashOffset; context.lineWidth=state.lineWidth; context.miterLimit=state.miterLimit; context.strokeStyle=state.strokeStyle; context.fillStyle=state.fillStyle; context.font=state.font; context.textAlign=state.textAlign; context.textBaseline=state.textBaseline; context.direction=state.direction; }
function validate(input){
  const viewport={width:Number(input?.viewport?.width),height:Number(input?.viewport?.height)},resolution=Number(input?.resolution),camera={x:Number(input?.camera?.x),y:Number(input?.camera?.y),scale:Number(input?.camera?.scale)},mapWidth=Number(input?.mapWidth),pick=input?.pick??null,box=input?.box??null,draft=input?.draft??null,paused=!!input?.paused,build=input?.build??null;
  if(!finite(viewport.width)||!finite(viewport.height)||viewport.width<0||viewport.height<0||!(resolution>0)||!finite(camera.x)||!finite(camera.y)||!(camera.scale>0)||!Number.isSafeInteger(mapWidth)||mapWidth<1) throw new TypeError('invalid interaction overlay state');
  if(pick&&(!finite(pick.cx)||!finite(pick.cy)||typeof pick.text!=='string')) throw new TypeError('invalid interaction pick');
  if(box&&![box.x0,box.y0,box.x1,box.y1].every(finite)) throw new TypeError('invalid interaction box');
  if(draft&&typeof draft.text!=='string') throw new TypeError('invalid interaction draft');
  if(build&&(!Number.isSafeInteger(build.tile)||build.tile<0||typeof build.valid!=='boolean')) throw new TypeError('invalid interaction build');
  if(typeof input?.measureText!=='function') throw new TypeError('invalid interaction measurement');
  return {viewport,resolution,camera,mapWidth,pick,box,draft,paused,build};
}
function labelBounds(input,label){
  const measured=input.measureText(label.font,label.text); if(!measured||![measured.width,measured.ascent,measured.descent].every(finite)) throw new TypeError('invalid interaction measurement');
  const left=finite(measured.left)&&Number(measured.left)>=0?Number(measured.left):Number(measured.width)/2,right=finite(measured.right)&&Number(measured.right)>=0?Number(measured.right):Number(measured.width)/2,pad=(label.stroke?label.width/2:0)+1;
  return {left:label.x-left-pad,top:label.y-Number(measured.ascent)-pad,right:label.x+right+pad,bottom:label.y+Number(measured.descent)+pad};
}
function rasterPlan(bounds,resolution){ const left=Math.floor(bounds.left*resolution)/resolution,top=Math.floor(bounds.top*resolution)/resolution,right=Math.ceil(bounds.right*resolution)/resolution,bottom=Math.ceil(bounds.bottom*resolution)/resolution,pixelWidth=Math.max(1,Math.ceil((right-left)*resolution)),pixelHeight=Math.max(1,Math.ceil((bottom-top)*resolution)); if(pixelWidth>Number.MAX_SAFE_INTEGER/pixelHeight||pixelWidth*pixelHeight>Number.MAX_SAFE_INTEGER/4) throw new RangeError('source-byte-cap'); return Object.freeze({left,top,right,bottom,pixelWidth,pixelHeight,sourceBytes:pixelWidth*pixelHeight*4}); }
function rectPrimitive(x,y,width,height,style){ const points=Object.freeze([{x,y},{x:x+width,y},{x:x+width,y:y+height},{x,y:y+height},{x,y}].map(Object.freeze)); return {kind:'polyline',points,...style}; }

export function paintInteractionOverlayLabelCanvas(context,label){ applyState(context,label.rasterState); context.font=label.font; context.textAlign='center'; if(label.stroke){ context.strokeStyle=label.stroke; context.lineWidth=label.width; context.strokeText(label.text,label.x,label.y); } context.fillStyle=label.fill; context.fillText(label.text,label.x,label.y); }

export function paintInteractionOverlaysCanvas(context,input){
  const value=validate({...input,measureText:input.measureText||(()=>({width:0,ascent:0,descent:0}))}),state=inheritedState(input,true),order=[]; applyState(context,state);
  if(value.pick){ state.font='bold 14px "Segoe UI",system-ui,sans-serif'; state.textAlign='center'; state.lineWidth=3; state.strokeStyle='rgba(0,0,0,.7)'; state.fillStyle='#ffd27a'; applyState(context,state); const x=value.camera.x+value.pick.cx*value.camera.scale,y=value.camera.y+value.pick.cy*value.camera.scale-10; context.strokeText(value.pick.text,x,y); context.fillText(value.pick.text,x,y); order.push('pick-label'); }
  if(value.box){ state.strokeStyle='#fff'; state.fillStyle='rgba(255,255,255,.08)'; state.lineWidth=1; applyState(context,state); const x=Math.min(value.box.x0,value.box.x1),y=Math.min(value.box.y0,value.box.y1),width=Math.abs(value.box.x1-value.box.x0),height=Math.abs(value.box.y1-value.box.y0); context.fillRect(x,y,width,height); context.strokeRect(x,y,width,height); order.push('selection-box'); }
  if(value.draft){ state.fillStyle='rgba(10,20,30,.55)'; applyState(context,state); context.fillRect(0,0,value.viewport.width,44); state.font='bold 16px "Segoe UI",system-ui,sans-serif'; state.textAlign='center'; state.fillStyle='#fff'; applyState(context,state); context.fillText(value.draft.text,value.viewport.width/2,28); order.push('draft-panel','draft-label'); }
  if(value.paused){ state.fillStyle='rgba(10,20,30,.35)'; applyState(context,state); context.fillRect(0,0,value.viewport.width,value.viewport.height); state.font='bold 28px "Segoe UI",system-ui,sans-serif'; state.textAlign='center'; state.fillStyle='#fff'; applyState(context,state); context.fillText('Paused',value.viewport.width/2,value.viewport.height/2); state.font='13px "Segoe UI",system-ui,sans-serif'; state.fillStyle='rgba(255,255,255,.7)'; applyState(context,state); context.fillText('Space to resume',value.viewport.width/2,value.viewport.height/2+24); order.push('paused-scrim','paused-title','paused-subtitle'); }
  if(value.build){ const x=value.build.tile%value.mapWidth,y=(value.build.tile-x)/value.mapWidth; state.strokeStyle=value.build.valid?'#7fffa0':'#ff6b6b'; state.lineWidth=2; applyState(context,state); context.strokeRect(value.camera.x+x*value.camera.scale-2,value.camera.y+y*value.camera.scale-2,value.camera.scale+4,value.camera.scale+4); order.push('build-cursor'); }
  return Object.freeze(order);
}

export function createInteractionOverlayModel(){
  return Object.freeze({
    build(input,limits={}){
      const value=validate(input),maximum={entries:cap(limits,'entries',MAX_INTERACTION_ENTRIES),primitives:cap(limits,'primitives',MAX_INTERACTION_PRIMITIVES),segments:cap(limits,'segments',MAX_INTERACTION_SEGMENTS),labels:cap(limits,'labels',MAX_INTERACTION_LABELS),chars:cap(limits,'chars',MAX_INTERACTION_CHARS),containers:cap(limits,'containers',MAX_INTERACTION_CONTAINERS),graphics:cap(limits,'graphics',MAX_INTERACTION_GRAPHICS),sprites:cap(limits,'sprites',MAX_INTERACTION_SPRITES),textures:cap(limits,'textures',MAX_INTERACTION_TEXTURES),sourceBytes:cap(limits,'sourceBytes',MAX_INTERACTION_SOURCE_BYTES)},state=inheritedState(input),entries=[]; let logicalEntries=0,primitives=0,segments=0,labels=0,chars=0,culled=0,sourceBytes=0,order=0;
      const reserve=()=>{ logicalEntries++; if(logicalEntries>maximum.entries) throw new RangeError('entry-cap'); };
      const addPrimitive=(key,semantic,primitive,bounds)=>{ reserve(); primitives++; if(primitives>maximum.primitives) throw new RangeError('primitive-cap'); const graphicsSegments=primitiveGraphicsSegments(primitive,maximum.segments-segments); segments=add(segments,graphicsSegments.length,'segment-cap'); if(segments>maximum.segments) throw new RangeError('segment-cap'); if(!paintBoundsIntersectViewport(bounds,value.viewport)){ culled++; order++; return; } entries.push(Object.freeze({key,kind:'graphics',semantic,order:order++,primitive:Object.freeze({...primitive,graphicsSegments}),bounds:Object.freeze(bounds)})); };
      const addLabel=(key,semantic,text,x,y,font,fill,stroke,width)=>{ reserve(); labels++; chars=add(chars,text.length,'char-cap'); if(labels>maximum.labels) throw new RangeError('label-cap'); if(chars>maximum.chars) throw new RangeError('char-cap'); const label={key,kind:'label',semantic,order:order++,text,x,y,font,fill,stroke,width,rasterState:Object.freeze(cloneState(state))},bounds=labelBounds(input,label),raster=rasterPlan(bounds,value.resolution); sourceBytes=add(sourceBytes,raster.sourceBytes,'source-byte-cap'); if(sourceBytes>maximum.sourceBytes) throw new RangeError('source-byte-cap'); if(!paintBoundsIntersectViewport(bounds,value.viewport)){ culled++; return; } entries.push(Object.freeze({...label,bounds:Object.freeze(bounds),raster})); };
      const baseStyle=()=>({alpha:state.globalAlpha,cap:state.lineCap,join:state.lineJoin,dash:Object.freeze(state.lineDash.slice()),phase:-state.lineDashOffset});
      if(value.pick){ state.font='bold 14px "Segoe UI",system-ui,sans-serif'; state.textAlign='center'; state.lineWidth=3; state.strokeStyle='rgba(0,0,0,.7)'; state.fillStyle='#ffd27a'; const x=value.camera.x+value.pick.cx*value.camera.scale,y=value.camera.y+value.pick.cy*value.camera.scale-10; addLabel('pick:label','pick-label',value.pick.text,x,y,state.font,state.fillStyle,state.strokeStyle,state.lineWidth); }
      if(value.box){ state.strokeStyle='#fff'; state.fillStyle='rgba(255,255,255,.08)'; state.lineWidth=1; const x=Math.min(value.box.x0,value.box.x1),y=Math.min(value.box.y0,value.box.y1),width=Math.abs(value.box.x1-value.box.x0),height=Math.abs(value.box.y1-value.box.y0),margin=state.lineWidth/2+1; addPrimitive('selection:box','selection-box',rectPrimitive(x,y,width,height,{fill:state.fillStyle,stroke:state.strokeStyle,width:state.lineWidth,...baseStyle()}),{left:x-margin,top:y-margin,right:x+width+margin,bottom:y+height+margin}); }
      if(value.draft){ state.fillStyle='rgba(10,20,30,.55)'; addPrimitive('draft:panel','draft-panel',{kind:'rect',x:0,y:0,width:value.viewport.width,height:44,fill:state.fillStyle,alpha:state.globalAlpha}, {left:0,top:0,right:value.viewport.width,bottom:44}); state.font='bold 16px "Segoe UI",system-ui,sans-serif'; state.textAlign='center'; state.fillStyle='#fff'; addLabel('draft:label','draft-label',value.draft.text,value.viewport.width/2,28,state.font,state.fillStyle,null,0); }
      if(value.paused){ state.fillStyle='rgba(10,20,30,.35)'; addPrimitive('paused:scrim','paused-scrim',{kind:'rect',x:0,y:0,width:value.viewport.width,height:value.viewport.height,fill:state.fillStyle,alpha:state.globalAlpha},{left:0,top:0,right:value.viewport.width,bottom:value.viewport.height}); state.font='bold 28px "Segoe UI",system-ui,sans-serif'; state.textAlign='center'; state.fillStyle='#fff'; addLabel('paused:title','paused-title','Paused',value.viewport.width/2,value.viewport.height/2,state.font,state.fillStyle,null,0); state.font='13px "Segoe UI",system-ui,sans-serif'; state.fillStyle='rgba(255,255,255,.7)'; addLabel('paused:subtitle','paused-subtitle','Space to resume',value.viewport.width/2,value.viewport.height/2+24,state.font,state.fillStyle,null,0); }
      if(value.build){ const tx=value.build.tile%value.mapWidth,ty=(value.build.tile-tx)/value.mapWidth,x=value.camera.x+tx*value.camera.scale-2,y=value.camera.y+ty*value.camera.scale-2,width=value.camera.scale+4,height=value.camera.scale+4; state.strokeStyle=value.build.valid?'#7fffa0':'#ff6b6b'; state.lineWidth=2; const margin=2; addPrimitive('build:cursor','build-cursor',rectPrimitive(x,y,width,height,{stroke:state.strokeStyle,width:state.lineWidth,...baseStyle()}),{left:x-margin,top:y-margin,right:x+width+margin,bottom:y+height+margin}); }
      const resources={containers:entries.length,graphics:entries.filter(entry=>entry.kind==='graphics').length,sprites:entries.filter(entry=>entry.kind==='label').length,textures:entries.filter(entry=>entry.kind==='label').length,sourceBytes};
      for(const [name,reason] of [['containers','container-cap'],['graphics','graphics-cap'],['sprites','sprite-cap'],['textures','texture-cap']]) if(resources[name]>maximum[name]) throw new RangeError(reason);
      return Object.freeze({entries:Object.freeze(entries),counts:Object.freeze({entries:logicalEntries,primitives,segments,labels,chars,visible:entries.length,culled}),resources:Object.freeze(resources),limits:Object.freeze(maximum),blendMode:state.globalCompositeOperation==='lighter'?'add':'normal',canvasState:Object.freeze(cloneState(state)),viewport:Object.freeze(value.viewport),resolution:value.resolution});
    },reset(){}
  });
}
