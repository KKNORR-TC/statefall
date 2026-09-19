import {conservativePaintBounds,paintBoundsIntersectViewport} from './paint-bounds.mjs';
import {primitiveGraphicsSegments,primitiveIntersectsViewport} from './pre-structure-layer-model.mjs';

export const MAX_WARSHIP_ENTRIES=4096;
export const MAX_WARSHIP_WAKE_POINTS=131072;
export const MAX_WARSHIP_PRIMITIVES=131072;
export const MAX_WARSHIP_SEGMENTS=262144;
export const MAX_WARSHIP_LABELS=4096;
export const MAX_WARSHIP_CONTAINERS=4096;
export const MAX_WARSHIP_IDLE_CONTAINERS=512;
export const MAX_WARSHIP_GRAPHICS=16384;
export const MAX_WARSHIP_IDLE_GRAPHICS=2048;
export const MAX_WARSHIP_LABEL_RESOURCES=4096;
export const MAX_WARSHIP_IDLE_LABELS=512;

const TAU=Math.PI*2,CLASSES=new Set(['sub','hunter','rship','privateer','scout','warship','cruiser','battleship']);
const finite=value=>Number.isFinite(Number(value));
const point=(x,y)=>Object.freeze({x,y});
const polygon=(points,style={})=>({kind:'polygon',points:Object.freeze(points),...style});
const line=(x1,y1,x2,y2,style={})=>({kind:'line',x1,y1,x2,y2,...style});
const rect=(x,y,width,height,style={})=>({kind:'polygon',points:Object.freeze([point(x,y),point(x+width,y),point(x+width,y+height),point(x,y+height)]),...style});
const circle=(x,y,r,style={})=>({kind:'circle',x,y,r,...style});
const arc=(x,y,r,start,end,style={})=>({kind:'arc',x,y,r,start,end,...style});
const radiusFor=(cls,scale)=>Math.max(5,scale*(cls==='battleship'?4:cls==='cruiser'?3.3:cls==='scout'?2.1:cls==='rship'?2.4:cls==='privateer'?2.5:cls==='sub'||cls==='hunter'?2.3:2.8));
const freezePrimitive=(value,remaining)=>Object.freeze({...value,graphicsSegments:primitiveGraphicsSegments(value,remaining)});

function transformFactory(x,y,r,heading,lean){
  const u=r/10,cos=Math.cos(heading),sin=Math.sin(heading),shear=lean*.6,yscale=1-Math.abs(lean)*.3;
  return (px,py)=>{ const dx=(px*cos-py*sin)*u,dy=(px*sin+py*cos)*u; return point(x+dx+shear*dy,y+yscale*dy); };
}

function leanTransformFactory(x,y,lean){
  const shear=lean*.6,yscale=1-Math.abs(lean)*.3;
  return (px,py)=>{ const dx=px-x,dy=py-y; return point(x+dx+shear*dy,y+yscale*dy); };
}

function transformedArc(tx,cx,cy,r,start,end,style){
  // Canvas applies the actor matrix to its circular radar details. A bounded
  // polyline samples that same ellipse rather than promoting actor transforms
  // into renderer authority.
  const points=[]; for(let i=0;i<=24;i++){ const a=start+(end-start)*i/24; points.push(tx(cx+Math.cos(a)*r,cy+Math.sin(a)*r)); }
  return {kind:'polyline',points:Object.freeze(points),...style};
}

function hullPrimitives(ship,x,y,r,lineCap){
  const lean=Number(ship.lean),tx=transformFactory(x,y,r,Number(ship.heading),lean),col=ship.color,width=1.2*r/10,white='#e8ecef',dark='#0f1a26',result=[],poly=(values,style)=>result.push(polygon(values.map(([a,b])=>tx(a,b)),style)),box=(a,b,w,h,style)=>poly([[a,b],[a+w,b],[a+w,b+h],[a,b+h]],style),ln=(a,b,c,d,style)=>{ const p=tx(a,b),q=tx(c,d); result.push(line(p.x,p.y,q.x,q.y,style)); };
  const hull=(values,style={})=>poly(values,{fill:col,stroke:'#fff',width,cap:lineCap,join:'round',...style});
  if(ship.cls==='warship'){
    hull([[12,0],[5,-3.5],[-9,-3.5],[-11,-2],[-11,2],[-9,3.5],[5,3.5]]); box(-5,-2,7,4,{fill:white}); box(-1,-1.2,2.5,2.4,{fill:white}); ln(5,0,9.5,0,{stroke:white,width:1.4*r/10,cap:lineCap,join:'round'}); box(-8,-1,2,2,{fill:dark});
  }else if(ship.cls==='privateer'){
    poly([[10,0],[4,-3],[-8,-3],[-9,0],[-8,3],[4,3]],{fill:'#3a2f2a',stroke:col,width:1.4*r/10,cap:lineCap,join:'round'}); poly([[-2,-1.5],[-2,-8],[3,-3.5]],{fill:white}); box(-4,-1,3,2,{fill:'#111'});
  }else if(ship.cls==='sub'||ship.cls==='hunter'){
    hull([[9,0],[5,-2.2],[-7,-2.2],[-9,0],[-7,2.2],[5,2.2]]); box(-2,-4.5,3,2.5,{fill:white}); if(ship.cls==='hunter') result.push(transformedArc(tx,-.5,-5.5,2,Math.PI*1.1,Math.PI*1.9,{stroke:white,width:1.2*r/10,cap:lineCap,join:'round'}));
  }else if(ship.cls==='rship'){
    hull([[9,0],[3,-3],[-8,-3],[-9,0],[-8,3],[3,3]]); box(-4,-1.5,4,3,{fill:white}); result.push(transformedArc(tx,-1,-4,3,Math.PI*1.1,Math.PI*1.9,{stroke:white,width:1.2*r/10,cap:lineCap,join:'round'})); ln(-1,-4,-1,-1.5,{stroke:white,width:1.2*r/10,cap:lineCap,join:'round'});
  }else if(ship.cls==='scout'){
    hull([[9,0],[3,-2.2],[-7,-2.2],[-8,0],[-7,2.2],[3,2.2]]); box(-3,-1.3,4,2.6,{fill:white});
  }else if(ship.cls==='cruiser'){
    hull([[13,0],[6,-3.2],[-10,-3.2],[-12,-1.5],[-12,1.5],[-10,3.2],[6,3.2]]); box(-2,-2,5,4,{fill:white}); box(-8,-2.4,4,1.8,{fill:dark}); box(-8,.6,4,1.8,{fill:dark}); box(4,-2.4,2.5,1.8,{fill:dark}); box(4,.6,2.5,1.8,{fill:dark}); ln(0,0,0,-5,{stroke:white,width:r/10,cap:lineCap,join:'round'}); ln(-1.5,-5,1.5,-5,{stroke:white,width:r/10,cap:lineCap,join:'round'});
  }else if(ship.cls==='battleship'){
    hull([[14,0],[7,-4.5],[-11,-4.5],[-13,-2.5],[-13,2.5],[-11,4.5],[7,4.5]]); box(-4,-2.5,6,5,{fill:white}); box(-1.5,-1.5,2.5,3,{fill:white});
    // Turret circles are transformed ellipses in Canvas; dense closed paths preserve that footprint.
    for(const cx of [6,-8]){ const pts=[]; for(let i=0;i<32;i++){ const a=TAU*i/32; pts.push(tx(cx+Math.cos(a)*2.2,Math.sin(a)*2.2)); } result.push(polygon(pts,{fill:dark})); }
    for(const values of [[6,-1,11.5,-1],[6,1,11.5,1],[-8,-1,-12,-1],[-8,1,-12,1]]) ln(...values,{stroke:white,width:1.3*r/10,cap:lineCap,join:'round'});
  }
  const pip=2*r/Number(ship.hpMax),pipWidth=Math.max(1,pip-1),pipY=y-r*1.5,pipTx=leanTransformFactory(x,y,lean);
  for(let i=0;i<Math.ceil(Number(ship.hp));i++){ const pipX=x-r+i*pip; result.push(polygon([[pipX,pipY],[pipX+pipWidth,pipY],[pipX+pipWidth,pipY+2],[pipX,pipY+2]].map(([a,b])=>pipTx(a,b)),{fill:'#fff',alpha:1})); }
  return result;
}

function wakePrimitives(ship,camera){
  const result=[],bow=.7+Math.min(1.6,Number(ship.speed)/1.6),wake=ship.wake;
  for(let i=1;i<wake.length;i++){ const a=i/wake.length; result.push(line(camera.x+Number(wake[i-1][0])*camera.scale,camera.y+Number(wake[i-1][1])*camera.scale,camera.x+Number(wake[i][0])*camera.scale,camera.y+Number(wake[i][1])*camera.scale,{stroke:'rgb(200,230,255)',alpha:a*.45*Math.min(1,bow),width:(Math.max(1,camera.scale*.8)*(1-a*.5)+a*Math.max(1,camera.scale*1.6))*bow,cap:'round'})); }
  return result;
}

function labelBounds(label){ return conservativePaintBounds(label.x-10,label.y-10,label.x+10,label.y+4,'warship-label'); }

export function warshipCanvasStrokeState(input){
  const inherited=input?.inheritedStrokeState||{},ships=Array.isArray(input?.warships)?input.warships:[];
  const round=ships.some(ship=>ship?.visible!==false&&!ship.sub&&Array.isArray(ship.wake)&&ship.wake.length>=2);
  return Object.freeze({lineJoin:inherited.lineJoin==='round'?'round':'miter',lineCap:round?'round':inherited.lineCap==='round'?'round':'butt',globalAlpha:1,lineDash:Object.freeze([]),lineDashOffset:0});
}

export function createWarshipScene(input,limits={}){
  const camera={x:Number(input?.camera?.x),y:Number(input?.camera?.y),scale:Number(input?.camera?.scale)},viewport={width:Number(input?.viewport?.width),height:Number(input?.viewport?.height)};
  if(!finite(camera.x)||!finite(camera.y)||!(camera.scale>0)||!finite(viewport.width)||!finite(viewport.height)||viewport.width<0||viewport.height<0) throw new TypeError('invalid warship camera');
  const maximum={entries:limits.entries??MAX_WARSHIP_ENTRIES,wakePoints:limits.wakePoints??MAX_WARSHIP_WAKE_POINTS,primitives:limits.primitives??MAX_WARSHIP_PRIMITIVES,segments:limits.segments??MAX_WARSHIP_SEGMENTS,labels:limits.labels??MAX_WARSHIP_LABELS};
  for(const [name,value] of Object.entries(maximum)) if(!Number.isInteger(value)||value<0) throw new TypeError(`invalid warship ${name} cap`);
  const ships=Array.isArray(input?.warships)?input.warships:[]; if(ships.length>maximum.entries) throw new RangeError('entry-cap');
  const ids=new Set(); let wakePointCount=0;
  for(const ship of ships){
    if(!ship||typeof ship!=='object'||!Number.isSafeInteger(ship.id)||ship.id<1) throw new TypeError('missing warship stable ID');
    if(ids.has(ship.id)) throw new TypeError('duplicate warship stable ID'); ids.add(ship.id);
    if(!CLASSES.has(ship.cls)||!finite(ship.x)||!finite(ship.y)||!finite(ship.heading)||!finite(ship.lean)||!finite(ship.hp)||!finite(ship.hpMax)||!(Number(ship.hpMax)>0)||!finite(ship.gun)||typeof ship.color!=='string'||!Array.isArray(ship.wake)) throw new TypeError('invalid warship source');
    for(const value of ship.wake) if(!Array.isArray(value)||value.length<2||!finite(value[0])||!finite(value[1])) throw new TypeError('invalid warship wake');
    wakePointCount+=ship.wake.length;
  }
  if(wakePointCount>maximum.wakePoints) throw new RangeError('wake-cap');
  const inherited=input?.inheritedStrokeState||{},lineJoin=inherited.lineJoin==='round'?'round':'miter',initialLineCap=inherited.lineCap==='round'?'round':'butt',entries=[],items=[],strokeTimeline=[],counts={total:ships.length,visible:0,culled:0,hidden:0}; let currentLineCap=initialLineCap,primitiveCount=0,segmentCount=0,labelCount=0,wakeSegmentCount=0;
  const addGraphics=(entry,semantic,values,lineCap=currentLineCap)=>{
    const visible=values.filter(value=>primitiveIntersectsViewport(value,viewport)); if(!visible.length) return false;
    if(primitiveCount+visible.length>maximum.primitives) throw new RangeError('primitive-cap'); const primitives=[];
    for(const value of visible){ const primitive=freezePrimitive(value,maximum.segments-segmentCount); segmentCount+=primitive.graphicsSegments.length; if(segmentCount>maximum.segments) throw new RangeError('segment-cap'); primitives.push(primitive); }
    primitiveCount+=primitives.length; const item=Object.freeze({kind:'graphics',semantic,lineCap,primitives:Object.freeze(primitives)}); entry.items.push(item); items.push(item); return true;
  };
  const addLabel=(entry,semantic,label)=>{ if(!paintBoundsIntersectViewport(labelBounds(label),viewport)) return false; if(++labelCount>maximum.labels) throw new RangeError('label-cap'); const item=Object.freeze({kind:'label',semantic,lineCap:currentLineCap,label:Object.freeze({...label,lineCap:currentLineCap,lineJoin})}); entry.items.push(item); items.push(item); return true; };
  for(let order=0;order<ships.length;order++){
    const ship=ships[order]; if(ship.visible===false){ counts.hidden++; continue; }
    const px=camera.x+Number(ship.x)*camera.scale,py=camera.y+Number(ship.y)*camera.scale,r=radiusFor(ship.cls,camera.scale),incomingLineCap=currentLineCap,entry={id:ship.id,order,cls:ship.cls,incomingLineCap,items:[]};
    if(ship.owned){ addGraphics(entry,'gun-range',[circle(px,py,Number(ship.gun)*camera.scale,{stroke:'rgba(255,255,255,.12)',width:1,cap:currentLineCap,join:lineJoin})]); if(ship.barrage) addGraphics(entry,'barrage-range',[circle(px,py,Number(ship.barrage.range)*camera.scale,{stroke:'rgba(255,180,80,.15)',width:1,dash:[4,6],phase:0,cap:currentLineCap,join:lineJoin})]); }
    if(ship.selected){ addGraphics(entry,'selected-ring',[circle(px,py,r*1.9,{stroke:'#fff',width:2,dash:[4,3],phase:0,cap:currentLineCap,join:lineJoin})]); if(ship.destination){ addGraphics(entry,'destination-line',[line(px,py,Number(ship.destination.x),Number(ship.destination.y),{stroke:'rgba(255,255,255,.35)',width:1,cap:currentLineCap,join:lineJoin})]); } }
    if(!ship.sub){
      const wake=wakePrimitives(ship,camera); wakeSegmentCount+=wake.length;
      if(ship.wake.length>=2) currentLineCap='round';
      addGraphics(entry,'wake',wake,currentLineCap);
    }
    const recoil=ship.recoil?1:0,rx=px-(recoil?Math.cos(Number(ship.fireAngle))*r*.25:0),ry=py-(recoil?Math.sin(Number(ship.fireAngle))*r*.25:0),hull=hullPrimitives(ship,rx,ry,r,currentLineCap).map(value=>ship.sub?{...value,alpha:(value.alpha??1)*.7}:value); addGraphics(entry,'hull-details-hp',hull,currentLineCap);
    if(recoil) addGraphics(entry,'muzzle-flash',[circle(px+Math.cos(Number(ship.fireAngle))*r*1.3,py+Math.sin(Number(ship.fireAngle))*r*1.3,Math.max(2,r*.35),{fill:'rgba(255,230,150,.9)',alpha:ship.sub?.7:1})]);
    if(ship.refitFraction!=null) addGraphics(entry,'refit-arc',[arc(px,py,r*1.9,-Math.PI/2,-Math.PI/2+TAU*Number(ship.refitFraction),{stroke:'#ffd27a',width:2.5,cap:currentLineCap,join:lineJoin})]);
    if(ship.cruise) addLabel(entry,'cm-badge',{kind:'cm-badge',text:'CM',x:px+r*1.3,y:py-r*1.2,font:'bold 9px "Segoe UI",system-ui,sans-serif',align:'center',baseline:'alphabetic',layers:Object.freeze([{operation:'stroke',text:'CM',color:'rgba(0,0,0,.7)',width:2.5},{operation:'fill',text:'CM',color:'#ffd27a'}])});
    if(ship.cooldownFraction!=null) addGraphics(entry,'barrage-cooldown',[arc(px,py,r*1.7,-Math.PI/2,-Math.PI/2+TAU*Number(ship.cooldownFraction),{stroke:'rgba(255,200,120,.8)',width:2,cap:currentLineCap,join:lineJoin})]);
    const outgoingLineCap=currentLineCap; strokeTimeline.push(Object.freeze({id:ship.id,order,cls:ship.cls,incomingLineCap,outgoingLineCap,wakeTransition:!ship.sub&&ship.wake.length>=2}));
    if(entry.items.length){ entries.push(Object.freeze({...entry,outgoingLineCap,items:Object.freeze(entry.items)})); counts.visible++; }else counts.culled++;
  }
  const canvasStrokeState=Object.freeze({lineJoin,lineCap:currentLineCap,globalAlpha:1,lineDash:Object.freeze([]),lineDashOffset:0});
  return Object.freeze({entries:Object.freeze(entries),items:Object.freeze(items),strokeTimeline:Object.freeze(strokeTimeline),counts:Object.freeze(counts),canvasStrokeState,wakePointCount,wakeSegmentCount,primitiveCount,segmentCount,labelCount,limits:Object.freeze(maximum)});
}
