import {primitiveGraphicsSegments,primitiveIntersectsViewport} from './pre-structure-layer-model.mjs';
import {UNIT_COLORS} from './unit-art-direction.mjs';

export const MAX_AIRCRAFT_ENTRIES=4096;
export const MAX_AIRCRAFT_PRIMITIVES=32768;
export const MAX_AIRCRAFT_SEGMENTS=131072;
export const MAX_AIRCRAFT_CONTAINERS=4096;
export const MAX_AIRCRAFT_IDLE_CONTAINERS=512;
export const MAX_AIRCRAFT_GRAPHICS=12288;
export const MAX_AIRCRAFT_IDLE_GRAPHICS=1536;

const TYPES=new Set(['fighter','bomber','carrier']);
const STATES=new Set(['hangar','out','patrol','run','return','refuel','heal']);
const SKIPPED=new Set(['hangar','refuel','heal']);
const finite=value=>Number.isFinite(Number(value));
const point=(x,y)=>Object.freeze({x,y});
const polygon=(points,style)=>({kind:'polygon',points:Object.freeze(points),...style});
const polyline=(points,style)=>({kind:'polyline',points:Object.freeze(points),...style});
const circle=(x,y,r,style)=>({kind:'circle',x,y,r,...style});
const rect=(x,y,width,height,style)=>({kind:'rect',x,y,width,height,...style});
const transform=(x,y,heading,scale,values)=>values.map(([px,py])=>point(x+(px*Math.cos(heading)-py*Math.sin(heading))*scale,y+(px*Math.sin(heading)+py*Math.cos(heading))*scale));
const rgba=value=>typeof value==='string'&&value.length>0;

function validatedInput(input,{requireIds=true}={}){
  const camera={x:Number(input?.camera?.x),y:Number(input?.camera?.y),scale:Number(input?.camera?.scale)},viewport={width:Number(input?.viewport?.width),height:Number(input?.viewport?.height)},fighterPatrol=Number(input?.fighterPatrol),fighterHp=Number(input?.fighterHp),aircraft=Array.isArray(input?.aircraft)?input.aircraft:[];
  if(!finite(camera.x)||!finite(camera.y)||!(camera.scale>0)||!finite(viewport.width)||!finite(viewport.height)||viewport.width<0||viewport.height<0||!finite(fighterPatrol)||fighterPatrol<0||!Number.isInteger(fighterHp)||fighterHp<1) throw new TypeError('invalid aircraft camera');
  const ids=new Set();
  for(const craft of aircraft){
    if(!craft||typeof craft!=='object') throw new TypeError('invalid aircraft source');
    if(requireIds){ if(!Number.isSafeInteger(craft.id)||craft.id<1) throw new TypeError('missing aircraft stable ID'); if(ids.has(craft.id)) throw new TypeError('duplicate aircraft stable ID'); ids.add(craft.id); }
    if(requireIds&&(!TYPES.has(craft.type)||!STATES.has(craft.state)||!finite(craft.x)||!finite(craft.y)||!finite(craft.heading)||(craft.type==='fighter'&&(!finite(craft.hp)||Number(craft.hp)<0))||typeof craft.owned!=='boolean'||typeof craft.visible!=='boolean'||!rgba(craft.color))) throw new TypeError('invalid aircraft source');
    if(requireIds&&craft.type==='bomber'&&craft.pull!=null&&(!finite(craft.pull)||Number(craft.pull)<0)) throw new TypeError('invalid aircraft pull');
    if(requireIds&&craft.type==='fighter'&&craft.owned&&(craft.state==='out'||craft.state==='patrol')&&(!finite(craft.targetX)||!finite(craft.targetY))) throw new TypeError('invalid aircraft patrol target');
  }
  return {camera,viewport,fighterPatrol,fighterHp,aircraft};
}

function inheritedState(input){
  const value=input?.inheritedCanvasState||input?.inheritedStrokeState||{},dash=Array.isArray(value.lineDash)?value.lineDash.map(Number):[];
  if(dash.some(item=>!finite(item)||item<0)) throw new TypeError('invalid aircraft inherited dash');
  return {globalAlpha:finite(value.globalAlpha)?Number(value.globalAlpha):1,lineJoin:value.lineJoin==='round'||value.lineJoin==='bevel'?value.lineJoin:'miter',lineCap:value.lineCap==='round'||value.lineCap==='square'?value.lineCap:'butt',lineDash:dash,lineDashOffset:finite(value.lineDashOffset)?Number(value.lineDashOffset):0,lineWidth:finite(value.lineWidth)&&Number(value.lineWidth)>=0?Number(value.lineWidth):1,strokeStyle:rgba(value.strokeStyle)?value.strokeStyle:'#000000',fillStyle:rgba(value.fillStyle)?value.fillStyle:'#000000'};
}

function applyCanvasState(context,state){
  context.globalAlpha=state.globalAlpha; context.lineJoin=state.lineJoin; context.lineCap=state.lineCap; context.setLineDash(state.lineDash); context.lineDashOffset=state.lineDashOffset; context.lineWidth=state.lineWidth; context.strokeStyle=state.strokeStyle; context.fillStyle=state.fillStyle;
}

function materialGradient(context,top,bottom){
  if(typeof context.createLinearGradient!=='function') return UNIT_COLORS.navy;
  const gradient=context.createLinearGradient(0,top,0,bottom); gradient.addColorStop(0,UNIT_COLORS.highlight); gradient.addColorStop(.4,UNIT_COLORS.navy); gradient.addColorStop(1,UNIT_COLORS.deep); return gradient;
}

export function paintAircraftCanvas(context,input,{onlySemantic=null,drawBody=null}={}){
  const {camera,fighterPatrol,fighterHp,aircraft}=validatedInput(input,{requireIds:false}),state=inheritedState(input),order=[]; applyCanvasState(context,state);
  for(const craft of aircraft){
    if(!craft.owned&&!craft.visible) continue;
    const px=camera.x+Number(craft.x)*camera.scale,py=camera.y+Number(craft.y)*camera.scale,patrol=craft.type==='fighter'&&craft.owned&&(craft.state==='out'||craft.state==='patrol');
    if(patrol){
      state.strokeStyle=craft.hovered?'rgba(191,230,255,.95)':'rgba(191,230,255,.35)'; state.lineWidth=craft.hovered?2:1; state.lineDash=[];
      if(!onlySemantic||onlySemantic==='aircraft-patrol-ring'){ order.push('aircraft-patrol-ring'); context.strokeStyle=state.strokeStyle; context.lineWidth=state.lineWidth; context.setLineDash([5,5]); context.beginPath(); context.arc(camera.x+Number(craft.targetX)*camera.scale,camera.y+Number(craft.targetY)*camera.scale,fighterPatrol*camera.scale,0,Math.PI*2); context.stroke(); context.setLineDash([]); }
      else context.setLineDash([]);
    }
    if(SKIPPED.has(craft.state)) continue;
    if((!onlySemantic||onlySemantic==='aircraft-silhouette')&&!drawBody?.(context,craft,camera)){
      order.push('aircraft-silhouette'); context.save(); context.translate(px,py); context.rotate(Number(craft.heading)); const u=Math.max(4,camera.scale*2.2)/10*(craft.type==='bomber'&&craft.pull?1+Number(craft.pull)*.25:1),fighter=[[10,0],[1,-2],[-5,-8],[-7,-8],[-5,-2],[-9,-2],[-10,-4],[-10,4],[-9,2],[-5,2],[-7,8],[-5,8],[1,2]],bomber=[[8,0],[-2,-3],[-10,-9],[-6,-2],[-7,0],[-6,2],[-10,9],[-2,3]],carrier=[[11,0],[6,-3],[-8,-3],[-11,-1],[-11,1],[-8,3],[6,3]],upper=[[1,-3],[-3,-11],[-7,-11],[-4,-3]],lower=[[1,3],[-3,11],[-7,11],[-4,3]],shapes=craft.type==='fighter'?[fighter]:craft.type==='bomber'?[bomber]:[carrier,upper,lower],trace=points=>{ context.beginPath(); for(let i=0;i<points.length;i++) i?context.lineTo(points[i][0],points[i][1]):context.moveTo(points[i][0],points[i][1]); context.closePath(); }; context.scale(u,u);
      context.save(); context.translate(1.8/u,2.8/u); context.fillStyle=UNIT_COLORS.shadow; context.globalAlpha=.62; for(const points of shapes){ trace(points); context.fill(); } context.restore(); context.fillStyle=materialGradient(context,-10,10); context.strokeStyle=UNIT_COLORS.edge; context.lineWidth=1.1; for(const points of shapes){ trace(points); context.fill(); context.stroke(); }
      context.fillStyle='rgba(217,215,199,.68)'; trace([[9,0],[3,-1.2],[-7,-1],[-9,0],[-7,1],[3,1.2]]); context.fill(); context.fillStyle=UNIT_COLORS.deep; context.beginPath(); context.arc(3.8,0,1.7,0,Math.PI*2); context.fill(); context.fillStyle=craft.color; context.fillRect(-6,-1.1,4.2,2.2); context.restore();
    }
    if(craft.type==='fighter'&&craft.owned){
      state.fillStyle=Number(craft.hp)<=2?'#ff9a9a':'#fff';
      if(!onlySemantic||onlySemantic==='aircraft-hp'){ order.push('aircraft-hp'); context.fillStyle=state.fillStyle; const r=Math.max(4,camera.scale*2.2),pw=2*r/fighterHp; for(let i=0;i<Number(craft.hp);i++) context.fillRect(px-r+i*pw,py-r*1.6,Math.max(1,pw-1),2); }
    }
  }
  applyCanvasState(context,state); return Object.freeze(order);
}

export function paintAircraftScene(context,scene){
  const order=[];
  for(const entry of scene.entries) for(const item of entry.items){
    order.push(item.semantic);
    for(const primitive of item.primitives){
      context.save(); context.globalAlpha=primitive.alpha??1; context.lineCap=primitive.cap||'butt'; context.lineJoin=primitive.join||'miter'; context.lineWidth=primitive.width||1; context.setLineDash(primitive.dash||[]); context.lineDashOffset=-(primitive.phase||0); context.beginPath();
      if(primitive.kind==='circle') context.arc(primitive.x,primitive.y,primitive.r,0,Math.PI*2);
      else if(primitive.kind==='rect') context.rect(primitive.x,primitive.y,primitive.width,primitive.height);
      else if(primitive.kind==='polygon'||primitive.kind==='polyline'){ const [first,...rest]=primitive.points; if(first){ context.moveTo(first.x,first.y); for(const value of rest) context.lineTo(value.x,value.y); if(primitive.kind==='polygon') context.closePath(); } }
      else { context.restore(); throw new TypeError('unknown aircraft Canvas primitive'); }
      if(primitive.fill){ context.fillStyle=primitive.fill; context.fill(); } if(primitive.stroke){ context.strokeStyle=primitive.stroke; context.stroke(); } context.restore();
    }
  }
  applyCanvasState(context,scene.canvasState); return Object.freeze(order);
}

export function createAircraftModel(){
  const reset=()=>{};
  const build=(input,limits={})=>{
    const {camera,viewport,fighterPatrol,fighterHp,aircraft}=validatedInput(input),maximum={entries:limits.entries??MAX_AIRCRAFT_ENTRIES,primitives:limits.primitives??MAX_AIRCRAFT_PRIMITIVES,segments:limits.segments??MAX_AIRCRAFT_SEGMENTS};
    for(const [name,value] of Object.entries(maximum)) if(!Number.isInteger(value)||value<0) throw new TypeError(`invalid aircraft ${name} cap`);
    if(aircraft.length>maximum.entries) throw new RangeError('entry-cap');
    const initial=inheritedState(input),canvasState={...initial,lineDash:initial.lineDash.slice()},staged=[],items=[],counts={total:aircraft.length,visible:0,culled:0,hidden:0,skipped:0,fighter:0,bomber:0,carrier:0,patrolRings:0,hpPips:0}; let primitiveCount=0,segmentCount=0;
    const freezePrimitive=value=>{ const generated=primitiveGraphicsSegments(value,maximum.segments-segmentCount); segmentCount+=generated.length; if(segmentCount>maximum.segments) throw new RangeError('segment-cap'); return Object.freeze({...value,graphicsSegments:generated}); };
    const add=(entry,semantic,values)=>{ const visible=values.filter(value=>primitiveIntersectsViewport(value,viewport)); if(!visible.length) return false; if(primitiveCount+visible.length>maximum.primitives) throw new RangeError('primitive-cap'); const primitives=visible.map(freezePrimitive); primitiveCount+=primitives.length; const item=Object.freeze({kind:'graphics',semantic,primitives:Object.freeze(primitives)}); entry.items.push(item); items.push(item); return true; };
    for(let order=0;order<aircraft.length;order++){
      const craft=aircraft[order],px=camera.x+Number(craft.x)*camera.scale,py=camera.y+Number(craft.y)*camera.scale,patrol=craft.type==='fighter'&&craft.owned&&(craft.state==='out'||craft.state==='patrol'),entry={id:craft.id,type:craft.type,state:craft.state,order,items:[]};
      if(!craft.owned&&!craft.visible){ counts.hidden++; continue; }
      if(patrol){ const stroke=craft.hovered?'rgba(191,230,255,.95)':'rgba(191,230,255,.35)',width=craft.hovered?2:1; canvasState.strokeStyle=stroke; canvasState.lineWidth=width; canvasState.lineDash=[]; if(add(entry,'aircraft-patrol-ring',[circle(camera.x+Number(craft.targetX)*camera.scale,camera.y+Number(craft.targetY)*camera.scale,fighterPatrol*camera.scale,{stroke,width,dash:[5,5],phase:0,cap:canvasState.lineCap,join:canvasState.lineJoin})])) counts.patrolRings++; }
      if(SKIPPED.has(craft.state)){ counts.skipped++; continue; }
      const radius=Math.max(4,camera.scale*2.2),pullScale=craft.type==='bomber'&&craft.pull?1+Number(craft.pull)*.25:1,u=radius/10*pullScale,style={fill:UNIT_COLORS.navy,stroke:UNIT_COLORS.edge,width:1.1*u,cap:canvasState.lineCap,join:canvasState.lineJoin,dash:Object.freeze(canvasState.lineDash.slice()),phase:-canvasState.lineDashOffset},heading=Number(craft.heading),fighter=[[10,0],[1,-2],[-5,-8],[-7,-8],[-5,-2],[-9,-2],[-10,-4],[-10,4],[-9,2],[-5,2],[-7,8],[-5,8],[1,2]],bomber=[[8,0],[-2,-3],[-10,-9],[-6,-2],[-7,0],[-6,2],[-10,9],[-2,3]],carrier=[[11,0],[6,-3],[-8,-3],[-11,-1],[-11,1],[-8,3],[6,3]],upper=[[1,-3],[-3,-11],[-7,-11],[-4,-3]],lower=[[1,3],[-3,11],[-7,11],[-4,3]],outlines=craft.type==='fighter'?[fighter]:craft.type==='bomber'?[bomber]:[carrier,upper,lower],shape=[];
      for(const points of outlines) shape.push(polygon(transform(px+2,py+3,heading,u,points),{fill:UNIT_COLORS.shadow,alpha:.62}));
      for(const points of outlines){ shape.push(polygon(transform(px,py,heading,u,points),{...style,fill:UNIT_COLORS.highlight})); shape.push(polygon(transform(px,py,heading,u,points.map(([a,b])=>[a*.96,b*.82+.25])),{fill:UNIT_COLORS.navy})); }
      shape.push(polygon(transform(px,py,heading,u,[[9,0],[3,-1.2],[-7,-1],[-9,0],[-7,1],[3,1.2]]),{fill:'rgba(217,215,199,.68)'})); shape.push(circle(...Object.values(transform(px,py,heading,u,[[3.8,0]])[0]),2.1*u,{fill:UNIT_COLORS.deep})); shape.push(polygon(transform(px,py,heading,u,[[-6,-1.1],[-1.8,-1.1],[-1.8,1.1],[-6,1.1]]),{fill:craft.color}));
      add(entry,'aircraft-silhouette',shape);
      let hpPips=0;
      if(craft.type==='fighter'&&craft.owned){ canvasState.fillStyle=Number(craft.hp)<=2?'#ff9a9a':'#fff'; const pw=2*radius/fighterHp,pips=[]; for(let i=0;i<Number(craft.hp);i++) pips.push(rect(px-radius+i*pw,py-radius*1.6,Math.max(1,pw-1),2,{fill:canvasState.fillStyle,alpha:1})); hpPips=pips.length; if(add(entry,'aircraft-hp',pips)) counts.hpPips+=hpPips; }
      if(entry.items.length){ staged.push(Object.freeze({...entry,x:Number(craft.x),y:Number(craft.y),screen:Object.freeze({x:px,y:py}),heading,baseRadius:radius,bodyScale:u,pullScale,hpPips,patrolTarget:patrol?Object.freeze({x:Number(craft.targetX),y:Number(craft.targetY)}):null,items:Object.freeze(entry.items)})); counts.visible++; counts[craft.type]++; }else counts.culled++;
    }
    return Object.freeze({entries:Object.freeze(staged),items:Object.freeze(items),counts:Object.freeze(counts),primitiveCount,segmentCount,limits:Object.freeze(maximum),canvasState:Object.freeze({...canvasState,lineDash:Object.freeze(canvasState.lineDash.slice())})});
  };
  return Object.freeze({build,reset});
}
