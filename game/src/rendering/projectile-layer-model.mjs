import {primitiveGraphicsSegments,primitiveIntersectsViewport} from './pre-structure-layer-model.mjs';

export const MAX_PROJECTILE_ENTRIES=8192;
export const MAX_PROJECTILE_TRAIL_POINTS=262144;
export const MAX_PROJECTILE_PRIMITIVES=262144;
export const MAX_PROJECTILE_SEGMENTS=524288;
export const MAX_PROJECTILE_CONTAINERS=8192;
export const MAX_PROJECTILE_IDLE_CONTAINERS=1024;
export const MAX_PROJECTILE_GRAPHICS=32768;
export const MAX_PROJECTILE_IDLE_GRAPHICS=4096;

const finite=value=>Number.isFinite(Number(value));
const point=(x,y)=>Object.freeze({x,y});
const line=(x1,y1,x2,y2,style)=>({kind:'line',x1,y1,x2,y2,...style});
const polygon=(points,style)=>({kind:'polygon',points:Object.freeze(points),...style});
const circle=(x,y,r,style)=>({kind:'circle',x,y,r,...style});
const rotate=(x,y,angle,values)=>values.map(([px,py])=>point(x+px*Math.cos(angle)-py*Math.sin(angle),y+px*Math.sin(angle)+py*Math.cos(angle)));
const freezePrimitive=(value,remaining)=>Object.freeze({...value,graphicsSegments:primitiveGraphicsSegments(value,remaining)});

export function advanceVisualShots(input){
  const shots=Array.isArray(input)?input:[],descriptors=[],next=[];
  for(const value of shots){
    if(!value||typeof value!=='object') throw new TypeError('invalid visual shot source');
    const age=Number(value.age)+1,source=value.source&&typeof value.source==='object'?value.source:value;
    const descriptor=Object.freeze({source,x0:Number(value.x0),y0:Number(value.y0),x1:Number(value.x1),y1:Number(value.y1),col:value.col,age,alpha:1-age/6,lifetime:6});
    descriptors.push(descriptor);
    if(age<6) next.push(Object.freeze({...descriptor,source}));
  }
  return Object.freeze({descriptors:Object.freeze(descriptors),next:Object.freeze(next)});
}

export function paintProjectileScene(context,scene){
  const order=[];
  for(const entry of scene.entries) for(const item of entry.items){
    order.push(item.semantic);
    for(const primitive of item.primitives){
      context.save(); context.globalAlpha=primitive.alpha??1; context.lineCap=primitive.cap||'butt'; context.lineJoin=primitive.join||'miter'; context.lineWidth=primitive.width||1; context.setLineDash(primitive.dash||[]); context.lineDashOffset=-(primitive.phase||0); context.beginPath();
      if(primitive.kind==='line'){ context.moveTo(primitive.x1,primitive.y1); context.lineTo(primitive.x2,primitive.y2); }
      else if(primitive.kind==='circle') context.arc(primitive.x,primitive.y,primitive.r,0,Math.PI*2);
      else if(primitive.kind==='polygon'){ const [first,...rest]=primitive.points; if(first){ context.moveTo(first.x,first.y); for(const point of rest) context.lineTo(point.x,point.y); context.closePath(); } }
      else { context.restore(); throw new TypeError('unknown projectile Canvas primitive'); }
      if(primitive.fill){ context.fillStyle=primitive.fill; context.fill(); }
      if(primitive.stroke){ context.strokeStyle=primitive.stroke; context.stroke(); }
      context.restore();
    }
  }
  context.globalAlpha=scene.canvasStrokeState.globalAlpha; context.lineJoin=scene.canvasStrokeState.lineJoin; context.lineCap=scene.canvasStrokeState.lineCap; context.setLineDash(scene.canvasStrokeState.lineDash); context.lineDashOffset=scene.canvasStrokeState.lineDashOffset;
  return Object.freeze(order);
}

export function createProjectileModel(){
  let identities=new WeakMap(),identitySerial=0,totals=new WeakMap(),activeTotals=new Set();
  const identity=value=>{ let id=identities.get(value); if(!id){ id=++identitySerial; identities.set(value,id); } return id; };
  const reset=()=>{ identities=new WeakMap(); identitySerial=0; totals=new WeakMap(); activeTotals.clear(); };
  const build=(input,limits={})=>{
    const camera={x:Number(input?.camera?.x),y:Number(input?.camera?.y),scale:Number(input?.camera?.scale)},viewport={width:Number(input?.viewport?.width),height:Number(input?.viewport?.height)};
    if(!finite(camera.x)||!finite(camera.y)||!(camera.scale>0)||!finite(viewport.width)||!finite(viewport.height)||viewport.width<0||viewport.height<0) throw new TypeError('invalid projectile camera');
    const maximum={entries:limits.entries??MAX_PROJECTILE_ENTRIES,trailPoints:limits.trailPoints??MAX_PROJECTILE_TRAIL_POINTS,primitives:limits.primitives??MAX_PROJECTILE_PRIMITIVES,segments:limits.segments??MAX_PROJECTILE_SEGMENTS};
    for(const [name,value] of Object.entries(maximum)) if(!Number.isInteger(value)||value<0) throw new TypeError(`invalid projectile ${name} cap`);
    const shells=Array.isArray(input?.shells)?input.shells:[],shots=Array.isArray(input?.visualShots)?input.visualShots:[];
    if(shells.length+shots.length>maximum.entries) throw new RangeError('entry-cap');
    let trailPointCount=0;
    for(const shell of shells){ if(!shell||typeof shell!=='object'||!finite(shell.x)||!finite(shell.y)||!Array.isArray(shell.trail)) throw new TypeError('invalid shell source'); trailPointCount+=shell.trail.length; for(const p of shell.trail) if(!Array.isArray(p)||p.length<2||!finite(p[0])||!finite(p[1])||(p[2]!=null&&!finite(p[2]))) throw new TypeError('invalid shell trail'); }
    if(trailPointCount>maximum.trailPoints) throw new RangeError('trail-cap');
    for(const shot of shots) if(!shot||typeof shot!=='object'||!finite(shot.x0)||!finite(shot.y0)||!finite(shot.x1)||!finite(shot.y1)||!finite(shot.alpha)||typeof shot.col!=='string') throw new TypeError('invalid visual shot source');
    const inherited=input?.inheritedStrokeState||{},lineJoin=inherited.lineJoin==='round'?'round':'miter'; let lineCap=inherited.lineCap==='round'?'round':'butt';
    const entries=[],items=[],strokeTimeline=[],occurrences=new Map(),nextTotals=new Set(),counts={shells:{total:shells.length,visible:0,culled:0,hidden:0},visualShots:{total:shots.length,visible:0,culled:0}}; let primitiveCount=0,segmentCount=0;
    const keyFor=(category,source)=>{ const base=`${category}:${identity(source)}`,occurrence=occurrences.get(base)||0; occurrences.set(base,occurrence+1); return `${base}:${occurrence}`; };
    const add=(entry,semantic,values,cap=lineCap)=>{ const visible=values.filter(value=>primitiveIntersectsViewport(value,viewport)); if(!visible.length) return false; if(primitiveCount+visible.length>maximum.primitives) throw new RangeError('primitive-cap'); const primitives=[]; for(const value of visible){ const primitive=freezePrimitive(value,maximum.segments-segmentCount); segmentCount+=primitive.graphicsSegments.length; if(segmentCount>maximum.segments) throw new RangeError('segment-cap'); primitives.push(primitive); } primitiveCount+=primitives.length; const item=Object.freeze({kind:'graphics',semantic,lineCap:cap,primitives:Object.freeze(primitives)}); entry.items.push(item); items.push(item); return true; };
    const screen=(x,y,h=0)=>point(camera.x+Number(x)*camera.scale,camera.y+Number(y)*camera.scale-Number(h||0)*camera.scale);
    for(let order=0;order<shells.length;order++){
      const shell=shells[order],source=shell.source&&typeof shell.source==='object'?shell.source:shell,incomingLineCap=lineCap,entry={key:keyFor('shell',source),category:'shell',variant:'ordinary',order,source,incomingLineCap,items:[]};
      if(shell.visible===false){ counts.shells.hidden++; continue; }
      const p=screen(shell.x,shell.y),trail=shell.trail;
      if(shell.torpedo){
        entry.variant='torpedo'; lineCap='round'; const trails=[]; for(let i=1;i<trail.length;i++){ const a=i/trail.length,u=screen(trail[i-1][0],trail[i-1][1]),v=screen(trail[i][0],trail[i][1]); trails.push(line(u.x,u.y,v.x,v.y,{stroke:`rgba(225,240,255,${0.08+a*.55})`,alpha:1,width:Math.max(1,camera.scale*.6)*(1-a*.4)+a*Math.max(1.5,camera.scale*1.4),cap:'round',join:lineJoin})); } add(entry,'torpedo-foam-trail',trails,'round');
        if(trail.length>2&&camera.scale>=1.2){ const foam=[]; for(let i=2;i<trail.length;i+=4){ const a=i/trail.length,q=screen(trail[i][0],trail[i][1]); foam.push(circle(q.x+(i%3-1)*camera.scale*.5,q.y+(i%2)*camera.scale*.4,Math.max(.8,camera.scale*.35),{fill:`rgba(255,255,255,${a*.5})`,alpha:1,cap:'round',join:lineJoin})); } add(entry,'torpedo-foam-points',foam,'round'); }
        const last=trail.at(-1)||[shell.x,shell.y],angle=Math.atan2(shell.y-last[1],shell.x-last[0]); add(entry,'torpedo-body',[polygon(rotate(p.x,p.y,angle,[[-4,-1.2],[4,-1.2],[4,1.2],[-4,1.2]]),{fill:'#233',stroke:'#9df',width:1,alpha:1,cap:'round',join:lineJoin})],'round');
      }else if(shell.kind==='aam'){
        entry.variant='aam'; const trails=[]; for(let i=1;i<trail.length;i++){ const a=i/trail.length,u=screen(trail[i-1][0],trail[i-1][1]),v=screen(trail[i][0],trail[i][1]); trails.push(line(u.x,u.y,v.x,v.y,{stroke:`rgba(230,240,255,${a*.7})`,alpha:1,width:1+a*2,cap:lineCap,join:lineJoin})); } add(entry,'aam-trail',trails);
        const last=trail.at(-1)||[shell.x,shell.y],angle=Math.atan2(shell.y-last[1],shell.x-last[0]); add(entry,'aam-body',[polygon(rotate(p.x,p.y,angle,[[5,0],[-3,-1.3],[-3,1.3]]),{fill:'#e8ecef',alpha:1,cap:lineCap,join:lineJoin}),polygon(rotate(p.x,p.y,angle,[[-5,-.8],[-3,-.8],[-3,.8],[-5,.8]]),{fill:'#ffb347',alpha:1,cap:lineCap,join:lineJoin})]);
      }else if(shell.arc&&shell.missile){
        entry.variant='barrage'; if(!finite(shell.tx)||!finite(shell.ty)) throw new TypeError('invalid shell arc target'); const distance=Math.hypot(shell.tx-shell.x,shell.ty-shell.y); let total=Number(shell.tot)||totals.get(source); if(!total){ total=Math.max(1,distance); totals.set(source,total); } nextTotals.add(source); const k=1-Math.min(1,distance/total),height=Math.sin(k*Math.PI)*(Number(shell.rise)||14)*.6,head=screen(shell.x,shell.y,height),trails=[];
        for(let i=1;i<trail.length;i++){ const a=i/trail.length,u=screen(trail[i-1][0],trail[i-1][1],trail[i-1][2]||0),v=screen(trail[i][0],trail[i][1],trail[i][2]||0); trails.push(line(u.x,u.y,v.x,v.y,{stroke:`rgba(230,225,215,${a*.55})`,alpha:1,width:1+a*2.5,cap:lineCap,join:lineJoin})); } add(entry,'barrage-trail',trails);
        const last=trail.at(-1),angle=last?Math.atan2(head.y-screen(last[0],last[1],last[2]||0).y,head.x-screen(last[0],last[1],last[2]||0).x):0; add(entry,'barrage-rocket',[polygon(rotate(head.x,head.y,angle,[[-4,0],[-12,-2],[-9,0],[-12,2]]),{fill:'rgba(255,170,70,.7)',alpha:1,cap:lineCap,join:lineJoin}),polygon(rotate(head.x,head.y,angle,[[6,0],[2,-1.8],[-4,-1.8],[-4,1.8],[2,1.8]]),{fill:'#e8ecef',alpha:1,cap:lineCap,join:lineJoin}),polygon(rotate(head.x,head.y,angle,[[-4,-1.8],[-6,-3.5],[-4,0],[-6,3.5],[-4,1.8]]),{fill:'#e35d5d',alpha:1,cap:lineCap,join:lineJoin})]);
        entry.arc=Object.freeze({distance,total,k,height,rise:Number(shell.rise)||14,delay:Number(shell.delay)||0});
      }else if(shell.arc){
        entry.variant='artillery'; if(!finite(shell.tx)||!finite(shell.ty)) throw new TypeError('invalid shell arc target'); const distance=Math.hypot(shell.tx-shell.x,shell.ty-shell.y); let total=Number(shell.tot)||totals.get(source); if(!total){ total=Math.max(1,distance); totals.set(source,total); } nextTotals.add(source); const k=1-Math.min(1,distance/total),height=Math.sin(k*Math.PI)*(Number(shell.rise)||14)*.6,head=screen(shell.x,shell.y,height);
        add(entry,'artillery-shell',[circle(head.x,head.y,Math.max(2.5,camera.scale*1.2),{fill:'#e8ecef',alpha:1,cap:lineCap,join:lineJoin})]); add(entry,'artillery-ground-tether',[line(head.x,head.y,p.x,p.y,{stroke:'rgba(255,255,255,.25)',alpha:1,width:1,dash:[2,4],phase:0,cap:lineCap,join:lineJoin})]); entry.arc=Object.freeze({distance,total,k,height,rise:Number(shell.rise)||14,delay:Number(shell.delay)||0});
      }else{
        const trails=[]; for(let i=1;i<trail.length;i++){ const a=i/trail.length,u=screen(trail[i-1][0],trail[i-1][1]),v=screen(trail[i][0],trail[i][1]); trails.push(line(u.x,u.y,v.x,v.y,{stroke:`rgba(255,220,150,${a*.6})`,alpha:1,width:1+a,cap:lineCap,join:lineJoin})); } add(entry,'gun-shell-trail',trails); const last=trail.at(-1)||[shell.x,shell.y],angle=Math.atan2(shell.y-last[1],shell.x-last[0]); add(entry,'gun-shell-body',[polygon(rotate(p.x,p.y,angle,[[4,0],[-2.5,-1.4],[-2.5,1.4]]),{fill:'#ffe0a8',alpha:1,cap:lineCap,join:lineJoin})]);
      }
      const outgoingLineCap=lineCap; strokeTimeline.push(Object.freeze({key:entry.key,order,variant:entry.variant,incomingLineCap,outgoingLineCap,torpedoTransition:!!shell.torpedo})); if(entry.items.length){ entries.push(Object.freeze({...entry,outgoingLineCap,items:Object.freeze(entry.items)})); counts.shells.visible++; }else counts.shells.culled++;
    }
    for(let order=0;order<shots.length;order++){
      const shot=shots[order],source=shot.source&&typeof shot.source==='object'?shot.source:shot,entry={key:keyFor('visual-shot',source),category:'visual-shot',variant:'visual-shot',order,source,incomingLineCap:lineCap,items:[]},a=screen(shot.x0,shot.y0),b=screen(shot.x1,shot.y1); add(entry,'visual-gun-line',[line(a.x,a.y,b.x,b.y,{stroke:shot.col,alpha:Number(shot.alpha),width:2,cap:lineCap,join:lineJoin})]); if(entry.items.length){ entries.push(Object.freeze({...entry,outgoingLineCap:lineCap,age:Number(shot.age),alpha:Number(shot.alpha),items:Object.freeze(entry.items)})); counts.visualShots.visible++; }else counts.visualShots.culled++;
    }
    for(const source of activeTotals) if(!nextTotals.has(source)) totals.delete(source); activeTotals=nextTotals;
    return Object.freeze({entries:Object.freeze(entries),items:Object.freeze(items),strokeTimeline:Object.freeze(strokeTimeline),counts:Object.freeze({shells:Object.freeze(counts.shells),visualShots:Object.freeze(counts.visualShots)}),canvasStrokeState:Object.freeze({lineJoin,lineCap,globalAlpha:1,lineDash:Object.freeze([]),lineDashOffset:0}),trailPointCount,primitiveCount,segmentCount,limits:Object.freeze(maximum),fallbackTotals:activeTotals.size});
  };
  return Object.freeze({build,reset,diagnostics:()=>Object.freeze({identitySerial,fallbackTotals:activeTotals.size})});
}
