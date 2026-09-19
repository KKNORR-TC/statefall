import {primitiveGraphicsSegments} from './pre-structure-layer-model.mjs';

export const MAX_WORLD_ANNOTATION_ENTRIES=16384;
export const MAX_WORLD_ANNOTATION_MEMBERS=8192;
export const MAX_WORLD_ANNOTATION_PRIMITIVES=16384;
export const MAX_WORLD_ANNOTATION_SEGMENTS=131072;
export const MAX_WORLD_ANNOTATION_LABELS=8192;
export const MAX_WORLD_ANNOTATION_CHARS=262144;
export const MAX_WORLD_ANNOTATION_CONTAINERS=16384;
export const MAX_WORLD_ANNOTATION_IDLE_CONTAINERS=512;
export const MAX_WORLD_ANNOTATION_GRAPHICS=16384;
export const MAX_WORLD_ANNOTATION_IDLE_GRAPHICS=512;
export const MAX_WORLD_ANNOTATION_SPRITES=8192;
export const MAX_WORLD_ANNOTATION_IDLE_SPRITES=512;
export const MAX_WORLD_ANNOTATION_TEXTURES=8192;
export const MAX_WORLD_ANNOTATION_SOURCE_BYTES=64*1024*1024;
export const MAX_WORLD_ANNOTATION_IDLE_TEXTURES=512;
export const MAX_WORLD_ANNOTATION_TEXTURE_IDLE_FRAMES=120;

const TAU=Math.PI*2,finite=value=>Number.isFinite(Number(value)),color=value=>typeof value==='string'&&value.length>0;
const cloneState=state=>({...state,lineDash:state.lineDash.slice()});

function inheritedState(input){
  const value=input?.inheritedCanvasState||{},dash=Array.isArray(value.lineDash)?value.lineDash.map(Number):[];
  if(dash.some(item=>!finite(item)||item<0)) throw new TypeError('invalid world annotation inherited dash');
  return {globalAlpha:finite(value.globalAlpha)?Number(value.globalAlpha):1,lineJoin:['round','bevel'].includes(value.lineJoin)?value.lineJoin:'miter',lineCap:['round','square'].includes(value.lineCap)?value.lineCap:'butt',lineDash:dash,lineDashOffset:finite(value.lineDashOffset)?Number(value.lineDashOffset):0,lineWidth:finite(value.lineWidth)&&Number(value.lineWidth)>=0?Number(value.lineWidth):1,strokeStyle:color(value.strokeStyle)?value.strokeStyle:'#000000',fillStyle:color(value.fillStyle)?value.fillStyle:'#000000',font:typeof value.font==='string'?value.font:'10px sans-serif',textAlign:['left','right','center','start','end'].includes(value.textAlign)?value.textAlign:'start',textBaseline:['top','hanging','middle','alphabetic','ideographic','bottom'].includes(value.textBaseline)?value.textBaseline:'alphabetic'};
}

function applyState(context,state){
  context.globalAlpha=state.globalAlpha; context.lineJoin=state.lineJoin; context.lineCap=state.lineCap; context.setLineDash(state.lineDash); context.lineDashOffset=state.lineDashOffset; context.lineWidth=state.lineWidth; context.strokeStyle=state.strokeStyle; context.fillStyle=state.fillStyle; context.font=state.font; context.textAlign=state.textAlign; context.textBaseline=state.textBaseline;
}

function validate(input){
  const camera={x:Number(input?.camera?.x),y:Number(input?.camera?.y),scale:Number(input?.camera?.scale)},viewport={width:Number(input?.viewport?.width),height:Number(input?.viewport?.height)},opening=input?.opening,regions=Array.isArray(input?.regions)?input.regions:[],network=input?.network??null;
  if(!finite(camera.x)||!finite(camera.y)||!(camera.scale>0)||!finite(viewport.width)||!finite(viewport.height)||viewport.width<0||viewport.height<0) throw new TypeError('invalid world annotation state');
  if(!opening||typeof opening.active!=='boolean'||!finite(opening.x)||!finite(opening.y)||!finite(opening.radius)) throw new TypeError('invalid opening annotation');
  for(const region of regions) if(!region||!Number.isSafeInteger(region.id)||typeof region.name!=='string'||!finite(region.x)||!finite(region.y)||!finite(region.size)) throw new TypeError('invalid region annotation');
  if(network){
    if(!Number.isSafeInteger(network.ownerId)||typeof network.name!=='string'||typeof network.mine!=='boolean'||!Array.isArray(network.sites)||!Array.isArray(network.ships)||!network.hovered||!['site','ship'].includes(network.hovered.kind)||!finite(network.hovered.x)||!finite(network.hovered.y)||!finite(network.hovered.range)||typeof network.label!=='string') throw new TypeError('invalid SAM network annotation');
    for(const site of network.sites) if(!site||!Number.isSafeInteger(site.tile)||!finite(site.x)||!finite(site.y)||!finite(site.range)||typeof site.dead!=='boolean'||typeof site.strong!=='boolean') throw new TypeError('invalid SAM site annotation');
    for(const ship of network.ships) if(!ship||!Number.isSafeInteger(ship.id)||!finite(ship.x)||!finite(ship.y)||!finite(ship.range)||typeof ship.strong!=='boolean') throw new TypeError('invalid SAM ship annotation');
  }
  if(typeof input?.measureText!=='function') throw new TypeError('invalid world annotation measurement');
  return {camera,viewport,opening,regions,network};
}

function measure(input,font,text,strokeWidth=0){
  const value=input.measureText(font,text); if(!value||![value.width,value.ascent,value.descent].every(finite)||value.width<0||value.ascent<0||value.descent<0) throw new TypeError('invalid world annotation measurement');
  const measuredLeft=finite(value.left)&&Number(value.left)>=0?Number(value.left):value.width/2,measuredRight=finite(value.right)&&Number(value.right)>=0?Number(value.right):value.width/2,pad=strokeWidth/2+1; return {left:-measuredLeft-pad,top:-value.ascent-pad,right:measuredRight+pad,bottom:value.descent+pad};
}

const intersects=(bounds,viewport)=>bounds.right>=0&&bounds.bottom>=0&&bounds.left<=viewport.width&&bounds.top<=viewport.height;
const freezeBounds=value=>Object.freeze({...value});
const label=(key,order,text,x,y,font,fill,stroke,width,state,bounds)=>Object.freeze({key,order,kind:'label',text,x,y,font,align:'center',baseline:state.textBaseline,fill,stroke,width,rasterState:Object.freeze(cloneState(state)),bounds:freezeBounds(bounds)});

export function paintWorldAnnotationsCanvas(context,input){
  const {camera,opening,regions,network}=validate({...input,measureText:input.measureText||(()=>({width:0,ascent:0,descent:0}))}),state=inheritedState(input),order=[]; applyState(context,state);
  if(opening.active){ context.strokeStyle='#fff'; context.lineWidth=3; context.setLineDash([10,6]); context.beginPath(); context.arc(opening.x,opening.y,opening.radius,0,TAU); context.stroke(); context.setLineDash([]); context.font='bold 16px "Segoe UI",system-ui,sans-serif'; context.textAlign='center'; context.strokeStyle='rgba(0,0,0,.7)'; context.fillStyle='#fff'; context.strokeText('You start here',opening.x,opening.y-opening.radius-10); context.fillText('You start here',opening.x,opening.y-opening.radius-10); order.push('opening:ring','opening:label'); }
  if(camera.scale<1.6){ context.font='italic 13px "Segoe UI",system-ui,sans-serif'; context.textAlign='center'; context.fillStyle='rgba(255,255,255,.45)'; for(const region of regions){ if(region.size<600) continue; context.fillText(region.name,region.x,region.y); order.push(`region:${region.id}`); } }
  if(network){ const col=network.mine?'150,220,255':'190,229,184'; for(const member of [...network.sites,...network.ships]){ const dead=member.dead===true,strong=member.strong===true; context.fillStyle=`rgba(${dead?'255,120,120':col},${strong?.14:.07})`; context.strokeStyle=`rgba(${dead?'255,120,120':col},${strong?.9:.5})`; context.lineWidth=strong?1.5:1; context.beginPath(); context.arc(member.x,member.y,member.range,0,TAU); context.fill(); context.stroke(); order.push(Object.prototype.hasOwnProperty.call(member,'tile')?`sam-site:${member.tile}`:`sam-ship:${member.id}`); } context.font='11px "Segoe UI",system-ui,sans-serif'; context.textAlign='center'; context.fillStyle='#fff'; context.strokeStyle='rgba(0,0,0,.6)'; context.lineWidth=3; const y=network.hovered.y-network.hovered.range-6; context.strokeText(network.label,network.hovered.x,y); context.fillText(network.label,network.hovered.x,y); order.push('sam-network:label'); }
  return Object.freeze(order);
}

export function paintWorldAnnotationLabelCanvas(context,entry){
  applyState(context,entry.rasterState); context.font=entry.font; context.textAlign=entry.align; context.textBaseline=entry.baseline; if(entry.stroke){ context.strokeStyle=entry.stroke; context.lineWidth=entry.width; context.strokeText(entry.text,entry.x,entry.y); } context.fillStyle=entry.fill; context.fillText(entry.text,entry.x,entry.y);
}

export function createWorldAnnotationModel(){
  const build=(input,limits={})=>{
    const {camera,viewport,opening,regions,network}=validate(input),maximum={entries:limits.entries??MAX_WORLD_ANNOTATION_ENTRIES,members:limits.members??MAX_WORLD_ANNOTATION_MEMBERS,primitives:limits.primitives??MAX_WORLD_ANNOTATION_PRIMITIVES,segments:limits.segments??MAX_WORLD_ANNOTATION_SEGMENTS,labels:limits.labels??MAX_WORLD_ANNOTATION_LABELS,chars:limits.chars??MAX_WORLD_ANNOTATION_CHARS};
    for(const [name,value] of Object.entries(maximum)) if(!Number.isInteger(value)||value<0) throw new TypeError(`invalid world annotation ${name} cap`);
    const sourceKeys=new Set(); for(const region of regions){ const key=`region:${region.id}`; if(sourceKeys.has(key)) throw new TypeError('duplicate world annotation stable key'); sourceKeys.add(key); } if(network) for(const [kind,values] of [['site',network.sites],['ship',network.ships]]) for(const member of values){ const key=kind==='site'?`sam-site:${member.tile}`:`sam-ship:${member.id}`; if(sourceKeys.has(key)) throw new TypeError('duplicate world annotation stable key'); sourceKeys.add(key); }
    const keys=new Set(),entries=[]; let entryCount=0,members=0,primitives=0,segments=0,labels=0,chars=0,culled=0,order=0; const state=inheritedState(input);
    const reserve=(key,{member=false,primitive=null,labelEntry=null}={})=>{ if(keys.has(key)) throw new TypeError('duplicate world annotation stable key'); keys.add(key); entryCount++; if(member) members++; if(primitive){ primitives++; primitive.graphicsSegments=primitiveGraphicsSegments(primitive,maximum.segments-segments); segments+=primitive.graphicsSegments.length; } if(labelEntry){ labels++; chars+=labelEntry.text.length; } if(entryCount>maximum.entries) throw new RangeError('entry-cap'); if(members>maximum.members) throw new RangeError('member-cap'); if(primitives>maximum.primitives) throw new RangeError('primitive-cap'); if(segments>maximum.segments) throw new RangeError('segment-cap'); if(labels>maximum.labels) throw new RangeError('label-cap'); if(chars>maximum.chars) throw new RangeError('char-cap'); };
    const addPrimitive=(key,semantic,primitive,bounds,member=false)=>{ reserve(key,{member,primitive}); if(!intersects(bounds,viewport)){ culled++; return; } entries.push(Object.freeze({key,order:order++,kind:'graphics',semantic,primitive:Object.freeze({...primitive,graphicsSegments:primitive.graphicsSegments}),bounds:freezeBounds(bounds)})); };
    const addLabel=(key,text,x,y,font,fill,stroke,width)=>{ const metrics=measure(input,font,text,stroke?width:0),bounds={left:x+metrics.left,top:y+metrics.top,right:x+metrics.right,bottom:y+metrics.bottom},value=label(key,order,text,x,y,font,fill,stroke,width,state,bounds); reserve(key,{labelEntry:value}); order++; if(!intersects(bounds,viewport)){ culled++; return; } entries.push(value); };
    if(opening.active){ state.strokeStyle='#fff'; state.lineWidth=3; state.lineDash=[10,6]; const primitive={kind:'circle',x:opening.x,y:opening.y,r:opening.radius,stroke:'#fff',width:3,dash:Object.freeze([10,6]),phase:0,cap:state.lineCap,join:state.lineJoin}; addPrimitive('opening:ring','opening-ring',primitive,{left:opening.x-opening.radius-2.5,top:opening.y-opening.radius-2.5,right:opening.x+opening.radius+2.5,bottom:opening.y+opening.radius+2.5}); state.lineDash=[]; state.font='bold 16px "Segoe UI",system-ui,sans-serif'; state.textAlign='center'; state.strokeStyle='rgba(0,0,0,.7)'; state.fillStyle='#fff'; addLabel('opening:label','You start here',opening.x,opening.y-opening.radius-10,state.font,state.fillStyle,state.strokeStyle,state.lineWidth); }
    if(camera.scale<1.6){ state.font='italic 13px "Segoe UI",system-ui,sans-serif'; state.textAlign='center'; state.fillStyle='rgba(255,255,255,.45)'; for(const region of regions){ const key=`region:${region.id}`; if(region.size<600){ keys.add(key); continue; } addLabel(key,region.name,region.x,region.y,state.font,state.fillStyle,null,0); } }
    if(network){ const col=network.mine?'150,220,255':'190,229,184',memberKeys=new Set(); for(const [kind,values] of [['site',network.sites],['ship',network.ships]]) for(const member of values){ const key=kind==='site'?`sam-site:${member.tile}`:`sam-ship:${member.id}`; if(memberKeys.has(key)) throw new TypeError('duplicate world annotation stable key'); memberKeys.add(key); const dead=member.dead===true,strong=member.strong===true,fill=`rgba(${dead?'255,120,120':col},${strong?.14:.07})`,stroke=`rgba(${dead?'255,120,120':col},${strong?.9:.5})`,width=strong?1.5:1,primitive={kind:'circle',x:member.x,y:member.y,r:member.range,fill,stroke,width,dash:Object.freeze(state.lineDash.slice()),phase:-state.lineDashOffset,cap:state.lineCap,join:state.lineJoin},margin=width/2+1; state.fillStyle=fill; state.strokeStyle=stroke; state.lineWidth=width; addPrimitive(key,kind==='site'?'sam-site-range':'sam-ship-range',primitive,{left:member.x-member.range-margin,top:member.y-member.range-margin,right:member.x+member.range+margin,bottom:member.y+member.range+margin},true); } state.font='11px "Segoe UI",system-ui,sans-serif'; state.textAlign='center'; state.fillStyle='#fff'; state.strokeStyle='rgba(0,0,0,.6)'; state.lineWidth=3; addLabel('sam-network:label',network.label,network.hovered.x,network.hovered.y-network.hovered.range-6,state.font,state.fillStyle,state.strokeStyle,state.lineWidth); }
    return Object.freeze({entries:Object.freeze(entries),counts:Object.freeze({entries:entryCount,members,primitives,segments,labels,chars,visible:entries.length,culled}),limits:Object.freeze(maximum),canvasState:Object.freeze(cloneState(state))});
  };
  return Object.freeze({build,reset(){}});
}
