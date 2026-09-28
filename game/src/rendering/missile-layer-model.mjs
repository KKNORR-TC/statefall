import {primitiveGraphicsSegments,primitiveIntersectsViewport} from './pre-structure-layer-model.mjs';
import {UNIT_COLORS} from './unit-art-direction.mjs';

export const MAX_MISSILE_ENTRIES=8192;
export const MAX_MISSILE_TRAIL_SAMPLES=262144;
export const MAX_MISSILE_PRIMITIVES=262144;
export const MAX_MISSILE_SEGMENTS=524288;
export const MAX_MISSILE_CONTAINERS=8192;
export const MAX_MISSILE_IDLE_CONTAINERS=1024;
export const MAX_MISSILE_GRAPHICS=24576;
export const MAX_MISSILE_IDLE_GRAPHICS=3072;

const finite=value=>Number.isFinite(Number(value));
const point=(x,y)=>Object.freeze({x,y});
const line=(x1,y1,x2,y2,style)=>({kind:'line',x1,y1,x2,y2,...style});
const polygon=(points,style)=>({kind:'polygon',points:Object.freeze(points),...style});
const circle=(x,y,r,style)=>({kind:'circle',x,y,r,...style});
const rotate=(x,y,angle,scale,values)=>values.map(([px,py])=>point(x+(px*Math.cos(angle)-py*Math.sin(angle))*scale,y+(px*Math.sin(angle)+py*Math.cos(angle))*scale));

export function missilePosition(missile,age,mapWidth){
  const k=Math.min(1,Number(age)/Number(missile.flight)),x0=Number(missile.from)%mapWidth+.5,y0=(Number(missile.from)-Number(missile.from)%mapWidth)/mapWidth+.5,x1=Number(missile.t)%mapWidth+.5,y1=(Number(missile.t)-Number(missile.t)%mapWidth)/mapWidth+.5;
  const h=missile.cruise?0:Math.hypot(x1-x0,y1-y0)*.35;
  return Object.freeze([x0+(x1-x0)*k,y0+(y1-y0)*k-Math.sin(k*Math.PI)*h]);
}

export function paintMissileScene(context,scene){
  const order=[];
  for(const entry of scene.entries) for(const item of entry.items){
    order.push(item.semantic);
    for(const primitive of item.primitives){
      context.save(); context.globalAlpha=primitive.alpha??1; context.lineCap=primitive.cap||'butt'; context.lineJoin=primitive.join||'miter'; context.lineWidth=primitive.width||1; context.setLineDash(primitive.dash||[]); context.lineDashOffset=-(primitive.phase||0); context.beginPath();
      if(primitive.kind==='line'){ context.moveTo(primitive.x1,primitive.y1); context.lineTo(primitive.x2,primitive.y2); }
      else if(primitive.kind==='circle') context.arc(primitive.x,primitive.y,primitive.r,0,Math.PI*2);
      else if(primitive.kind==='polygon'){ const [first,...rest]=primitive.points; if(first){ context.moveTo(first.x,first.y); for(const value of rest) context.lineTo(value.x,value.y); context.closePath(); } }
      else { context.restore(); throw new TypeError('unknown missile Canvas primitive'); }
      if(primitive.fill){ context.fillStyle=primitive.fill; context.fill(); }
      if(primitive.stroke){ context.strokeStyle=primitive.stroke; context.stroke(); }
      context.restore();
    }
  }
  context.globalAlpha=scene.canvasStrokeState.globalAlpha; context.lineJoin=scene.canvasStrokeState.lineJoin; context.lineCap=scene.canvasStrokeState.lineCap; context.setLineDash(scene.canvasStrokeState.lineDash); context.lineDashOffset=scene.canvasStrokeState.lineDashOffset;
  return Object.freeze(order);
}

function validatedMissileInput(input){
  const camera={x:Number(input?.camera?.x),y:Number(input?.camera?.y),scale:Number(input?.camera?.scale)},viewport={width:Number(input?.viewport?.width),height:Number(input?.viewport?.height)},mapWidth=Number(input?.mapWidth),now=Number(input?.now);
  if(!finite(camera.x)||!finite(camera.y)||!(camera.scale>0)||!finite(viewport.width)||!finite(viewport.height)||viewport.width<0||viewport.height<0||!Number.isInteger(mapWidth)||mapWidth<1||!finite(now)) throw new TypeError('invalid missile camera');
  const nukeRadius=Number(input?.nukeRadius),cruiseRadius=Number(input?.cruiseRadius);
  if(!(nukeRadius>=0)||!finite(nukeRadius)||!(cruiseRadius>=0)||!finite(cruiseRadius)) throw new TypeError('invalid missile radius');
  const missiles=Array.isArray(input?.missiles)?input.missiles:[];
  for(const missile of missiles){
    if(!missile||typeof missile!=='object'||!Number.isInteger(Number(missile.from))||!Number.isInteger(Number(missile.t))||Number(missile.from)<0||Number(missile.t)<0||!finite(missile.age)||Number(missile.age)<0||!finite(missile.flight)||!(Number(missile.flight)>0)||typeof missile.owned!=='boolean'||typeof missile.visible!=='boolean') throw new TypeError('invalid missile source');
    if(!Number.isSafeInteger(Math.max(2,Math.floor(Number(missile.age)/2))+1)) throw new RangeError('invalid missile trail length');
  }
  return {camera,viewport,mapWidth,now,nukeRadius,cruiseRadius,missiles};
}

// This is the legacy Canvas path, intentionally independent of Pixi model/resource caps.
export function paintMissilesCanvas(context,input,{onlySemantic=null}={}){
  const {camera,mapWidth,now,nukeRadius,cruiseRadius,missiles}=validatedMissileInput(input),order=[];
  for(const missile of missiles){
    if(!missile.visible&&!missile.owned) continue;
    const age=Number(missile.age),current=missilePosition(missile,age,mapWidth),next=missilePosition(missile,age+1,mapWidth),x=camera.x+current[0]*camera.scale,y=camera.y+current[1]*camera.scale,target=missilePosition(missile,Number(missile.flight),mapWidth),targetX=camera.x+target[0]*camera.scale,targetY=camera.y+target[1]*camera.scale,N=Math.max(2,Math.floor(age/2));
    if(!onlySemantic||onlySemantic==='missile-trail'){
      context.lineCap='round'; order.push('missile-trail');
      for(let i=1;i<=N;i++){
        const a=i/N,from=missilePosition(missile,age*(i-1)/N,mapWidth),to=missilePosition(missile,age*i/N,mapWidth);
        context.strokeStyle=`rgba(255,200,120,${.05+a*.6})`; context.lineWidth=1+a*3; context.beginPath(); context.moveTo(camera.x+from[0]*camera.scale,camera.y+from[1]*camera.scale); context.lineTo(camera.x+to[0]*camera.scale,camera.y+to[1]*camera.scale); context.stroke();
      }
    }
    if(!onlySemantic||onlySemantic==='missile-body'){
      order.push('missile-body'); context.save(); context.translate(x,y); context.rotate(missile.cruise?Math.atan2(targetY-y,targetX-x):Math.atan2(next[1]-current[1],next[0]-current[0])); if(missile.cruise) context.scale(.65,.65);
      context.fillStyle='rgba(255,180,80,.55)'; context.beginPath(); context.moveTo(-6,0); context.lineTo(-18,-3); context.lineTo(-14,0); context.lineTo(-18,3); context.closePath(); context.fill();
      context.fillStyle=UNIT_COLORS.ivory; context.beginPath(); context.moveTo(8,0); context.lineTo(3,-2.5); context.lineTo(-6,-2.5); context.lineTo(-6,2.5); context.lineTo(3,2.5); context.closePath(); context.fill();
      context.fillStyle='#f4f0d7'; context.beginPath(); context.moveTo(5,-2.1); context.lineTo(-5,-2.1); context.lineTo(-5,-1); context.lineTo(3,-1); context.closePath(); context.fill();
      context.fillStyle=UNIT_COLORS.hostile; context.beginPath(); context.moveTo(-6,-2.5); context.lineTo(-9,-5); context.lineTo(-6,0); context.lineTo(-9,5); context.lineTo(-6,2.5); context.fill(); context.restore();
    }
    if(!onlySemantic||onlySemantic==='missile-target-warning'){
      order.push('missile-target-warning'); context.strokeStyle=`rgba(255,107,107,${.35+.35*Math.sin(now/150)})`; context.lineWidth=1.5; context.setLineDash([6,6]); context.beginPath(); context.arc(targetX,targetY,(missile.cruise?cruiseRadius:nukeRadius)*camera.scale,0,Math.PI*2); context.stroke(); context.setLineDash([]);
    }
  }
  return Object.freeze(order);
}

export function createMissileModel(){
  let identities=new WeakMap(),identitySerial=0;
  const identity=value=>{ let id=identities.get(value); if(!id){ id=++identitySerial; identities.set(value,id); } return id; };
  const reset=()=>{ identities=new WeakMap(); identitySerial=0; };
  const build=(input,limits={})=>{
    const {camera,viewport,mapWidth,now,nukeRadius,cruiseRadius,missiles}=validatedMissileInput(input);
    const maximum={entries:limits.entries??MAX_MISSILE_ENTRIES,trailSamples:limits.trailSamples??MAX_MISSILE_TRAIL_SAMPLES,primitives:limits.primitives??MAX_MISSILE_PRIMITIVES,segments:limits.segments??MAX_MISSILE_SEGMENTS};
    for(const [name,value] of Object.entries(maximum)) if(!Number.isInteger(value)||value<0) throw new TypeError(`invalid missile ${name} cap`);
    if(missiles.length>maximum.entries) throw new RangeError('entry-cap');
    let trailSampleCount=0;
    for(const missile of missiles){
      const sampleCount=Math.max(2,Math.floor(Number(missile.age)/2))+1; if(!Number.isSafeInteger(sampleCount)) throw new RangeError('trail-cap'); trailSampleCount+=sampleCount; if(trailSampleCount>maximum.trailSamples) throw new RangeError('trail-cap');
    }
    const inherited=input?.inheritedStrokeState||{},lineJoin=inherited.lineJoin==='round'?'round':'miter',incomingLineCap=inherited.lineCap==='round'?'round':'butt',incomingDash=Array.isArray(inherited.lineDash)?inherited.lineDash.map(Number):[],incomingDashOffset=finite(inherited.lineDashOffset)?Number(inherited.lineDashOffset):0,incomingAlpha=finite(inherited.globalAlpha)?Number(inherited.globalAlpha):1;
    if(incomingDash.some(value=>!finite(value)||value<0)) throw new TypeError('invalid missile inherited dash');
    const staged=[],items=[],counts={total:missiles.length,visible:0,culled:0,hidden:0,normal:0,cruise:0}; let primitiveCount=0,segmentCount=0,advanced=false;
    const screen=([x,y])=>point(camera.x+x*camera.scale,camera.y+y*camera.scale);
    const freezePrimitive=value=>{ const generated=primitiveGraphicsSegments(value,maximum.segments-segmentCount); segmentCount+=generated.length; if(segmentCount>maximum.segments) throw new RangeError('segment-cap'); return Object.freeze({...value,graphicsSegments:generated}); };
    const add=(entry,semantic,values)=>{ const visible=values.filter(value=>primitiveIntersectsViewport(value,viewport)); if(!visible.length) return false; if(primitiveCount+visible.length>maximum.primitives) throw new RangeError('primitive-cap'); const primitives=visible.map(freezePrimitive); primitiveCount+=primitives.length; const item=Object.freeze({kind:'graphics',semantic,lineCap:'round',primitives:Object.freeze(primitives)}); entry.items.push(item); items.push(item); return true; };
    for(let order=0;order<missiles.length;order++){
      const missile=missiles[order],source=missile.source&&typeof missile.source==='object'?missile.source:missile,age=Number(missile.age),flight=Number(missile.flight),cruise=!!missile.cruise,current=missilePosition(missile,age,mapWidth),next=missilePosition(missile,age+1,mapWidth),target=missilePosition(missile,flight,mapWidth); let entry={source,category:'missile',variant:cruise?'cruise':'normal',order,items:[]};
      if(!missile.visible&&!missile.owned){ counts.hidden++; staged.push(entry); continue; }
      advanced=true;
      const samples=[],N=Math.max(2,Math.floor(age/2));
      for(let i=0;i<=N;i++){ const sampleAge=age*i/N,position=missilePosition(missile,sampleAge,mapWidth); samples.push(Object.freeze({age:sampleAge,x:position[0],y:position[1]})); }
      const trails=[]; for(let i=1;i<samples.length;i++){ const a=i/N,u=screen([samples[i-1].x,samples[i-1].y]),v=screen([samples[i].x,samples[i].y]); trails.push(line(u.x,u.y,v.x,v.y,{stroke:`rgba(255,200,120,${.05+a*.6})`,alpha:1,width:1+a*3,cap:'round',join:lineJoin})); }
      add(entry,'missile-trail',trails);
      const head=screen(current),targetPoint=screen(target),analyticHeading=Math.atan2(next[1]-current[1],next[0]-current[0]),heading=cruise?Math.atan2(targetPoint.y-head.y,targetPoint.x-head.x):analyticHeading,scale=cruise?.65:1;
      add(entry,'missile-body',[
        polygon(rotate(head.x,head.y,heading,scale,[[-6,0],[-18,-3],[-14,0],[-18,3]]),{fill:'rgba(255,180,80,.55)',alpha:1,cap:'round',join:lineJoin}),
        polygon(rotate(head.x,head.y,heading,scale,[[8,0],[3,-2.5],[-6,-2.5],[-6,2.5],[3,2.5]]),{fill:UNIT_COLORS.ivory,alpha:1,cap:'round',join:lineJoin}),
        polygon(rotate(head.x,head.y,heading,scale,[[5,-2.1],[-5,-2.1],[-5,-1],[3,-1]]),{fill:'#f4f0d7',alpha:1,cap:'round',join:lineJoin}),
        polygon(rotate(head.x,head.y,heading,scale,[[-6,-2.5],[-9,-5],[-6,0],[-9,5],[-6,2.5]]),{fill:UNIT_COLORS.hostile,alpha:1,cap:'round',join:lineJoin})
      ]);
      const radius=(cruise?cruiseRadius:nukeRadius)*camera.scale,pulse=.35+.35*Math.sin(now/150);
      add(entry,'missile-target-warning',[circle(targetPoint.x,targetPoint.y,radius,{stroke:`rgba(255,107,107,${pulse})`,alpha:1,width:1.5,dash:[6,6],phase:0,cap:'round',join:lineJoin})]);
      entry=Object.freeze({...entry,current:Object.freeze({x:current[0],y:current[1]}),next:Object.freeze({x:next[0],y:next[1]}),target:Object.freeze({x:target[0],y:target[1]}),heading,analyticHeading,bodyScale:scale,trailN:N,trailSamples:Object.freeze(samples),warningRadius:cruise?cruiseRadius:nukeRadius,warningAlpha:pulse,items:Object.freeze(entry.items)}); staged[order]=entry; if(entry.items.length){ counts.visible++; counts[entry.variant]++; }else counts.culled++;
    }
    const occurrences=new Map(),entries=[];
    for(let order=0;order<missiles.length;order++){
      const missile=missiles[order],source=missile.source&&typeof missile.source==='object'?missile.source:missile,base=`missile:${identity(source)}`,occurrence=occurrences.get(base)||0; occurrences.set(base,occurrence+1); const entry=staged[order]; if(entry?.items?.length) entries.push(Object.freeze({...entry,key:`${base}:${occurrence}`}));
    }
    const canvasStrokeState=advanced?{lineJoin,lineCap:'round',globalAlpha:incomingAlpha,lineDash:Object.freeze([]),lineDashOffset:incomingDashOffset}:{lineJoin,lineCap:incomingLineCap,globalAlpha:incomingAlpha,lineDash:Object.freeze(incomingDash),lineDashOffset:incomingDashOffset};
    return Object.freeze({entries:Object.freeze(entries),items:Object.freeze(items),counts:Object.freeze(counts),trailSampleCount,primitiveCount,segmentCount,limits:Object.freeze(maximum),canvasStrokeState:Object.freeze(canvasStrokeState),pulseTime:now});
  };
  return Object.freeze({build,reset,diagnostics:()=>Object.freeze({identitySerial})});
}
