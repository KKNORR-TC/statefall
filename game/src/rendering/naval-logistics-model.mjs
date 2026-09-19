import {conservativePaintBounds,paintBoundsIntersectViewport} from './paint-bounds.mjs';
import {primitiveGraphicsSegments,primitiveIntersectsViewport} from './pre-structure-layer-model.mjs';

export const MAX_NAVAL_ENTITIES=4096;
export const MAX_NAVAL_PATH_POINTS=131072;
export const MAX_NAVAL_WAKE_POINTS=131072;
export const MAX_NAVAL_PRIMITIVES=131072;
export const MAX_NAVAL_SEGMENTS=262144;
export const MAX_NAVAL_LABELS=4096;
export const MAX_NAVAL_CONTAINERS=4096;
export const MAX_NAVAL_IDLE_CONTAINERS=512;
export const MAX_NAVAL_GRAPHICS=16384;
export const MAX_NAVAL_IDLE_GRAPHICS=2048;
export const MAX_NAVAL_LABEL_RESOURCES=4096;
export const MAX_NAVAL_IDLE_LABELS=512;

const finite=value=>Number.isFinite(Number(value));
const point=(x,y)=>Object.freeze({x,y});
const line=(a,b,style)=>({kind:'line',x1:a.x,y1:a.y,x2:b.x,y2:b.y,...style});
const polygon=(points,style)=>({kind:'polygon',points:Object.freeze(points),...style});
const boundsForPoints=(points,kind,margin=0)=>{
  const xs=points.map(value=>value.x),ys=points.map(value=>value.y);
  return conservativePaintBounds(Math.min(...xs)-margin,Math.min(...ys)-margin,Math.max(...xs)+margin,Math.max(...ys)+margin,kind);
};
const transformPoints=(values,x,y,scale,angle)=>{
  const cos=Math.cos(angle),sin=Math.sin(angle);
  return values.map(([px,py])=>point(x+(px*cos-py*sin)*scale,y+(px*sin+py*cos)*scale));
};
const cssPoint=(value,camera)=>point(camera.x+Number(value[0])*camera.scale,camera.y+Number(value[1])*camera.scale);
const tilePoint=(tile,camera,mapWidth)=>{ const x=tile%mapWidth,y=(tile-x)/mapWidth; return point(camera.x+(x+.5)*camera.scale,camera.y+(y+.5)*camera.scale); };
const freezePrimitive=(value,remaining)=>Object.freeze({...value,graphicsSegments:primitiveGraphicsSegments(value,remaining)});

function labelBounds(label){
  const half=Math.max(4,String(label.text).length*3.5),top=label.y-11,bottom=label.y+4;
  return conservativePaintBounds(label.x-half,top,label.x+half,bottom,'naval-label');
}

function hullPrimitives(kind,x,y,r,heading,color){
  const u=r/10,width=1.2*u;
  if(kind==='merchant'){
    const hull=polygon(transformPoints([[8,0],[3,-3],[-8,-3],[-8,3],[3,3]],x,y,u,heading),{fill:'#d9c9a3',stroke:'#5a4a30',width,join:'miter'});
    const cargo1=polygon(transformPoints([[-6,-2],[-2,-2],[-2,2],[-6,2]],x,y,u,heading),{fill:color});
    const cargo2=polygon(transformPoints([[-1,-2],[2,-2],[2,2],[-1,2]],x,y,u,heading),{fill:color});
    return [hull,cargo1,cargo2];
  }
  const hull=polygon(transformPoints([[9,0],[4,-3.5],[-8,-3.5],[-9,0],[-8,3.5],[4,3.5]],x,y,u,heading),{fill:color,stroke:'#fff',width,join:'round'});
  const cargo1=polygon(transformPoints([[-6,-2],[-1,-2],[-1,2],[-6,2]],x,y,u,heading),{fill:'#e8ecef'});
  const cargo2=polygon(transformPoints([[0,-2],[3,-2],[3,2],[0,2]],x,y,u,heading),{fill:'#e8ecef'});
  return [hull,cargo1,cargo2];
}

function wakePrimitives(wake,camera,speed){
  if(wake.length<2) return [];
  const bow=.7+Math.min(1.6,speed/1.6),result=[];
  for(let i=1;i<wake.length;i++){
    const alpha=i/wake.length;
    result.push(line(cssPoint(wake[i-1],camera),cssPoint(wake[i],camera),{stroke:'rgb(200,230,255)',alpha:alpha*.45*Math.min(1,bow),width:(Math.max(1,camera.scale*.8)*(1-alpha*.5)+alpha*Math.max(1,camera.scale*1.6))*bow,cap:'round'}));
  }
  return result;
}

function validatePointList(value,name){
  if(!Array.isArray(value)) throw new TypeError(`invalid naval ${name}`);
  for(const item of value) if(!Array.isArray(item)||item.length<2||!finite(item[0])||!finite(item[1])) throw new TypeError(`invalid naval ${name}`);
}

function validatePath(value){
  if(!Array.isArray(value)||!value.length||value.some(tile=>!Number.isInteger(tile)||tile<0)) throw new TypeError('invalid naval path');
}

export function navalLogisticsCanvasStrokeState(input){
  const visibleWake=value=>value?.visible!==false&&Array.isArray(value.wake)&&value.wake.length>=2;
  const lineCap=[...(Array.isArray(input?.transports)?input.transports:[]),...(Array.isArray(input?.merchants)?input.merchants:[])].some(visibleWake)?'round':'butt';
  return Object.freeze({lineJoin:'miter',lineCap});
}

export function createNavalLogisticsScene(input,limits={}){
  const camera={x:Number(input?.camera?.x),y:Number(input?.camera?.y),scale:Number(input?.camera?.scale)},viewport={width:Number(input?.viewport?.width),height:Number(input?.viewport?.height)},mapWidth=Number(input?.mapWidth);
  if(!finite(camera.x)||!finite(camera.y)||!finite(camera.scale)||camera.scale<=0||!finite(viewport.width)||!finite(viewport.height)||viewport.width<0||viewport.height<0||!Number.isInteger(mapWidth)||mapWidth<1) throw new TypeError('invalid naval camera');
  const maximum={entities:limits.entities??MAX_NAVAL_ENTITIES,pathPoints:limits.pathPoints??MAX_NAVAL_PATH_POINTS,wakePoints:limits.wakePoints??MAX_NAVAL_WAKE_POINTS,primitives:limits.primitives??MAX_NAVAL_PRIMITIVES,segments:limits.segments??MAX_NAVAL_SEGMENTS,labels:limits.labels??MAX_NAVAL_LABELS};
  for(const [name,value] of Object.entries(maximum)) if(!Number.isInteger(value)||value<0) throw new TypeError(`invalid naval ${name} cap`);
  const transports=Array.isArray(input?.transports)?input.transports:[],merchants=Array.isArray(input?.merchants)?input.merchants:[],boarding=Array.isArray(input?.boarding)?input.boarding:[];
  const entityCount=transports.length+merchants.length+boarding.length;
  if(entityCount>maximum.entities) throw new RangeError('entity-cap');
  let pathPointCount=0,wakePointCount=0;
  for(const item of transports){ validatePath(item.path); validatePointList(item.wake,'wake'); pathPointCount+=item.path.length; wakePointCount+=item.wake.length; }
  for(const item of merchants){ validatePointList(item.wake,'wake'); wakePointCount+=item.wake.length; }
  if(pathPointCount>maximum.pathPoints) throw new RangeError('path-cap');
  if(wakePointCount>maximum.wakePoints) throw new RangeError('wake-cap');
  const canvasStrokeState=navalLogisticsCanvasStrokeState({transports,merchants}),items=[],entries=[],counts={transports:{total:transports.length,visible:0,culled:0},merchants:{total:merchants.length,visible:0,culled:0},boarding:{total:boarding.length,visible:0,culled:0}};
  let primitiveCount=0,segmentCount=0,labelCount=0,routeCount=0,wakeSegmentCount=0,boardingSegmentCount=0;
  const addGraphics=(entry,semantic,values)=>{
    const visibleValues=values.filter(value=>primitiveIntersectsViewport(value,viewport));
    if(!visibleValues.length) return false;
    if(primitiveCount+visibleValues.length>maximum.primitives) throw new RangeError('primitive-cap');
    const primitives=[];
    for(const value of visibleValues){ const primitive=freezePrimitive(value,maximum.segments-segmentCount); segmentCount+=primitive.graphicsSegments.length; if(segmentCount>maximum.segments) throw new RangeError('segment-cap'); primitives.push(primitive); }
    primitiveCount+=primitives.length; const item=Object.freeze({kind:'graphics',semantic,primitives:Object.freeze(primitives)}); entry.items.push(item); items.push(item); return true;
  };
  const addLabel=(entry,semantic,label)=>{
    if(!paintBoundsIntersectViewport(labelBounds(label),viewport)) return false;
    if(++labelCount>maximum.labels) throw new RangeError('label-cap');
    const item=Object.freeze({kind:'label',semantic,label:Object.freeze(label)}); entry.items.push(item); items.push(item); return true;
  };
  const finish=(entry,category)=>{
    if(entry.items.length){ counts[category].visible++; entries.push(Object.freeze({...entry,items:Object.freeze(entry.items)})); }
    else counts[category].culled++;
  };
  for(let index=0;index<transports.length;index++){
    const tr=transports[index];
    if(!tr||typeof tr!=='object'||!finite(tr.x)||!finite(tr.y)||!finite(tr.heading)||!finite(tr.troops)||typeof tr.color!=='string'||(tr.heavy&&(!finite(tr.hp)||!finite(tr.maxHp)||Number(tr.maxHp)<=0))) throw new TypeError('invalid naval transport source');
    if(tr.visible===false){ counts.transports.culled++; continue; }
    const entry={category:'transports',source:tr.source||tr,order:index,items:[]},center=point(camera.x+Number(tr.x)*camera.scale,camera.y+Number(tr.y)*camera.scale),baseRadius=Math.max(4,camera.scale*2),radius=tr.heavy?baseRadius*1.35:baseRadius;
    const routePoints=[tilePoint(tr.path[0],camera,mapWidth)];
    for(let i=8;i<Number(tr.pos);i+=8){ const tile=tr.path[i]; if(!Number.isInteger(tile)||tile<0) throw new TypeError('invalid naval sampled path'); routePoints.push(tilePoint(tile,camera,mapWidth)); }
    routePoints.push(center); routeCount++;
    addGraphics(entry,'transport-route',[{kind:'polyline',points:Object.freeze(routePoints),stroke:tr.color,alpha:.55,width:1.5,dash:[3,5],phase:0}]);
    const wakes=wakePrimitives(tr.wake,camera,Number(tr.speed)||1.3); wakeSegmentCount+=wakes.length; addGraphics(entry,'transport-wake',wakes);
    addGraphics(entry,'transport-hull',hullPrimitives('transport',center.x,center.y,radius,Number(tr.heading),tr.color));
    if(tr.heavy){ const hp=[],pip=2*radius/Number(tr.maxHp); for(let i=0;i<Math.ceil(Number(tr.hp));i++) hp.push({kind:'rect',x:center.x-radius+i*pip,y:center.y-radius*1.5,width:Math.max(1,pip-1),height:2,fill:'#fff'}); addGraphics(entry,'transport-hp',hp); }
    if(camera.scale>=1.2) addLabel(entry,'transport-troops',{kind:'transport-troops',text:String(Math.round(Number(tr.troops))),x:center.x,y:center.y-baseRadius*1.2,font:'10px "Segoe UI",system-ui,sans-serif',align:'center',baseline:'alphabetic',layers:Object.freeze([{operation:'fill',text:String(Math.round(Number(tr.troops))),color:'#fff'}])});
    finish(entry,'transports');
  }
  for(let index=0;index<merchants.length;index++){
    const tr=merchants[index];
    if(!tr||typeof tr!=='object'||!finite(tr.x)||!finite(tr.y)||!finite(tr.heading)||typeof tr.color!=='string') throw new TypeError('invalid naval merchant source');
    if(tr.visible===false){ counts.merchants.culled++; continue; }
    const entry={category:'merchants',source:tr.source||tr,order:index,items:[]},center=point(camera.x+Number(tr.x)*camera.scale,camera.y+Number(tr.y)*camera.scale),radius=Math.max(3.5,camera.scale*1.7),wakes=wakePrimitives(tr.wake,camera,Number(tr.speed)||1.3);
    wakeSegmentCount+=wakes.length; addGraphics(entry,'merchant-wake',wakes); addGraphics(entry,'merchant-hull-cargo',hullPrimitives('merchant',center.x,center.y,radius,Number(tr.heading),tr.color)); finish(entry,'merchants');
  }
  for(let index=0;index<boarding.length;index++){
    const value=boarding[index];
    if(!value||typeof value!=='object'||!finite(value.x)||!finite(value.y)||!finite(value.targetX)||!finite(value.targetY)) throw new TypeError('invalid naval boarding source');
    if(value.visible===false||value.active===false){ counts.boarding.culled++; continue; }
    const entry={category:'boarding',source:value.source||value,order:index,items:[]}; boardingSegmentCount++;
    addGraphics(entry,'boarding-line',[line(point(camera.x+Number(value.x)*camera.scale,camera.y+Number(value.y)*camera.scale),point(camera.x+Number(value.targetX)*camera.scale,camera.y+Number(value.targetY)*camera.scale),{stroke:'rgba(255,210,122,.8)',width:1.5,dash:[3,3],phase:0,cap:canvasStrokeState.lineCap})]); finish(entry,'boarding');
  }
  return Object.freeze({entries:Object.freeze(entries),items:Object.freeze(items),counts:Object.freeze({transports:Object.freeze(counts.transports),merchants:Object.freeze(counts.merchants),boarding:Object.freeze(counts.boarding)}),canvasStrokeState,entityCount,pathPointCount,wakePointCount,primitiveCount,segmentCount,labelCount,routeCount,wakeSegmentCount,boardingSegmentCount,limits:Object.freeze(maximum)});
}
