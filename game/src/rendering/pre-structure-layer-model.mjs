import {structureBasePaintBounds} from './structure-layer-model.mjs';
import {RASTER_ANTIALIAS_MARGIN_CSS,conservativePaintBounds,paintBoundsIntersect,paintBoundsIntersectViewport} from './paint-bounds.mjs';

export const PRE_STRUCTURE_QUALITY=Object.freeze(['high','medium','low']);
export const MAX_PRE_STRUCTURE_PRIMITIVES=65536;
export const MAX_PRE_STRUCTURE_SEGMENTS=131072;

const QUALITY_DASH_SCALE=Object.freeze({high:1,medium:1.5,low:2});
const TAU=Math.PI*2;
const finite=value=>Number.isFinite(Number(value));
const tilePoint=(tile,camera,mapWidth)=>{ const tx=tile%mapWidth,ty=(tile-tx)/mapWidth; return {x:camera.x+(tx+.5)*camera.scale,y:camera.y+(ty+.5)*camera.scale}; };
const circle=(x,y,r,style)=>({kind:'circle',x,y,r,...style});
const line=(a,b,style)=>({kind:'line',x1:a.x,y1:a.y,x2:b.x,y2:b.y,...style});
const rect=(x,y,width,height,style)=>({kind:'rect',x,y,width,height,...style});
const arc=(x,y,r,start,end,style)=>({kind:'arc',x,y,r,start,end,...style});
const strokeMargin=value=>Math.max(0,Number(value?.width)||0)/2;
const bounds=(left,top,right,bottom,kind)=>conservativePaintBounds(left,top,right,bottom,kind);

export function primitivePaintBounds(value){
  const margin=strokeMargin(value);
  if(value.kind==='line') return bounds(Math.min(value.x1,value.x2)-margin,Math.min(value.y1,value.y2)-margin,Math.max(value.x1,value.x2)+margin,Math.max(value.y1,value.y2)+margin,'pre-base-line');
  if(value.kind==='rect') return bounds(value.x-margin,value.y-margin,value.x+value.width+margin,value.y+value.height+margin,'pre-base-rect');
  if(value.kind==='circle'||value.kind==='arc') return bounds(value.x-value.r-margin,value.y-value.r-margin,value.x+value.r+margin,value.y+value.r+margin,`pre-base-${value.kind}`);
  throw new TypeError('unknown pre-structure primitive');
}

const ringBounds=(x,y,r,width,kind)=>bounds(x-r-width/2,y-r-width/2,x+r+width/2,y+r+width/2,kind);
const textBounds=(x,y,text,kind)=>{ const half=Math.max(5,String(text||'').length*3.5+2); return bounds(x-half,y-11,x+half,y+4,kind); };

export function retainedPostBaseBounds(st,camera,mapWidth){
  const p=tilePoint(st.tile,camera,mapWidth),r=Math.max(6,camera.scale*2.4),result=[];
  if(st.building){
    result.push(ringBounds(p.x,p.y,r+3,2.5,'building-ring'));
    if(camera.scale>=1.2) result.push(textBounds(p.x,p.y+r+11,st.buildText||'000s','building-text'));
    return Object.freeze(result);
  }
  const pop=Number.isFinite(Number(st.pop))?Math.max(1,Number(st.pop)):1;
  if(pop>1) result.push(ringBounds(p.x,p.y,r*pop*1.3,2,'pop-ring'));
  if((Number(st.level)||1)>=2) result.push(textBounds(p.x+r*.9,p.y-r*.8,(Number(st.level)||1)>=3?'III':'II','level-mark'));
  if(st.upgrading) result.push(ringBounds(p.x,p.y,r+3,2.5,'upgrade-ring'));
  if(st.type==='airfield'&&camera.scale>=1.2) result.push(textBounds(p.x,p.y+r+11,st.airQueueText||'0/6','airfield-queue-text'));
  if(st.airQueue) result.push(ringBounds(p.x,p.y,r+3,2.5,'airfield-queue-ring'));
  if(st.shipQueue){ result.push(ringBounds(p.x,p.y,r+3,2.5,'port-queue-ring')); if(camera.scale>=1.2) result.push(textBounds(p.x,p.y+r+11,st.shipQueueText||'Ship 000s +00','port-queue-text')); }
  if(st.suppressed) result.push(bounds(p.x-r-1,p.y-r-1,p.x+r+1,p.y+r+1,'suppressed-x'));
  if(st.linked) result.push(ringBounds(p.x,p.y,r+2,1.5,'linked-ring'));
  if(st.cooldown) result.push(ringBounds(p.x,p.y,r+3,2,'cooldown-ring'));
  return Object.freeze(result);
}

export function findStructureCompositingConflict(entries,viewport){
  for(let earlierIndex=0;earlierIndex<entries.length-1;earlierIndex++){
    const earlier=entries[earlierIndex];
    for(const overlay of earlier.postBounds||[]){
       if(!paintBoundsIntersectViewport(overlay,viewport)) continue;
      for(let laterIndex=earlierIndex+1;laterIndex<entries.length;laterIndex++){
        const later=entries[laterIndex];
         for(const painted of later.pixiBounds||[]) if(paintBoundsIntersectViewport(painted,viewport)&&paintBoundsIntersect(overlay,painted)) return Object.freeze({earlierIndex,earlierTile:earlier.tile,earlierMark:overlay.kind,laterIndex,laterTile:later.tile,laterPrimitive:painted.kind,reason:`earlier-${overlay.kind}-overlaps-later-${painted.kind}`});
      }
    }
  }
  return null;
}

// Returns every non-empty painted dash interval. This is the single source of
// truth for both cap accounting and Pixi path emission.
export function dashSegments(length,dash,gap,phase=0,maximum=Infinity){
  length=Number(length); dash=Number(dash); gap=Number(gap); phase=Number(phase)||0;
  if(!(length>0)||!(dash>0)||gap<0||!Number.isFinite(length)||!Number.isFinite(dash)||!Number.isFinite(gap)) return [];
  const period=dash+gap;
  if(!(period>0)) return [];
  phase=((phase%period)+period)%period;
  const result=[];
  for(let at=-phase;at<length;at+=period){
    const from=Math.max(0,at),to=Math.min(length,at+dash);
    if(to>from){ if(result.length>=maximum) throw new RangeError('segment-cap'); result.push(Object.freeze({from,to})); }
  }
  return Object.freeze(result);
}

export function dashedSegmentCount(length,dash,gap,phase=0){ return dashSegments(length,dash,gap,phase).length; }

export function primitiveGraphicsSegments(value,maximum=Infinity){
  if(value.kind==='line'){
    const dx=value.x2-value.x1,dy=value.y2-value.y1,length=Math.hypot(dx,dy);
    if(!(length>0)) return Object.freeze([]);
    if(!value.dash){ if(maximum<1) throw new RangeError('segment-cap'); return Object.freeze([Object.freeze({kind:'line',x1:value.x1,y1:value.y1,x2:value.x2,y2:value.y2})]); }
    return Object.freeze(dashSegments(length,value.dash[0],value.dash[1],value.phase,maximum).map(({from,to})=>Object.freeze({kind:'line',x1:value.x1+dx*from/length,y1:value.y1+dy*from/length,x2:value.x1+dx*to/length,y2:value.y1+dy*to/length})));
  }
  if(value.kind==='circle'){
    if(!(value.r>0)) return Object.freeze([]);
    if(!value.dash){ if(maximum<1) throw new RangeError('segment-cap'); return Object.freeze([Object.freeze({kind:'circle',x:value.x,y:value.y,r:value.r})]); }
    const result=value.fill?[Object.freeze({kind:'circle',x:value.x,y:value.y,r:value.r,paint:'fill'})]:[];
    if(result.length>maximum) throw new RangeError('segment-cap');
    result.push(...dashSegments(TAU*value.r,value.dash[0],value.dash[1],value.phase,maximum-result.length).map(({from,to})=>Object.freeze({kind:'arc',x:value.x,y:value.y,r:value.r,start:from/value.r,end:to/value.r,paint:'stroke'})));
    return Object.freeze(result);
  }
  if(value.kind==='arc'){ if(value.r>0&&value.end!==value.start){ if(maximum<1) throw new RangeError('segment-cap'); return Object.freeze([Object.freeze({kind:'arc',x:value.x,y:value.y,r:value.r,start:value.start,end:value.end})]); } return Object.freeze([]); }
  if(value.kind==='rect'){ if(value.width>0&&value.height>0){ if(maximum<1) throw new RangeError('segment-cap'); return Object.freeze([Object.freeze({kind:'rect',x:value.x,y:value.y,width:value.width,height:value.height})]); } return Object.freeze([]); }
  throw new TypeError('unknown pre-structure primitive');
}

function lineIntersectsViewport(value,viewport){
  const margin=strokeMargin(value)+RASTER_ANTIALIAS_MARGIN_CSS,left=-margin,right=viewport.width+margin,top=-margin,bottom=viewport.height+margin;
  let t0=0,t1=1; const dx=value.x2-value.x1,dy=value.y2-value.y1;
  for(const [p,q] of [[-dx,value.x1-left],[dx,right-value.x1],[-dy,value.y1-top],[dy,bottom-value.y1]]){
    if(p===0){ if(q<0) return false; continue; }
    const r=q/p;
    if(p<0){ if(r>t1) return false; if(r>t0) t0=r; }
    else { if(r<t0) return false; if(r<t1) t1=r; }
  }
  return true;
}

function circleIntersectsViewport(value,viewport){
  const margin=strokeMargin(value)+RASTER_ANTIALIAS_MARGIN_CSS,outer=Math.max(0,value.r+margin);
  const nx=Math.max(0,Math.min(viewport.width,value.x)),ny=Math.max(0,Math.min(viewport.height,value.y));
  const minimum=Math.hypot(value.x-nx,value.y-ny);
  if(minimum>outer) return false;
  if(value.fill) return true;
  const inner=Math.max(0,value.r-margin),maximum=Math.max(Math.hypot(value.x,value.y),Math.hypot(value.x-viewport.width,value.y),Math.hypot(value.x,value.y-viewport.height),Math.hypot(value.x-viewport.width,value.y-viewport.height));
  return maximum>=inner;
}

export function primitiveIntersectsViewport(value,viewport){
  if(value.kind==='line') return lineIntersectsViewport(value,viewport);
  if(value.kind==='circle') return circleIntersectsViewport(value,viewport);
  if(value.kind==='arc') return circleIntersectsViewport(value,viewport); // Conservative for partial arcs.
  if(value.kind==='rect'){
    const margin=strokeMargin(value)+RASTER_ANTIALIAS_MARGIN_CSS;
    return value.x+value.width+margin>=0&&value.y+value.height+margin>=0&&value.x-margin<=viewport.width&&value.y-margin<=viewport.height;
  }
  return false;
}

export function createPreStructureScene(input,{primitiveLimit=MAX_PRE_STRUCTURE_PRIMITIVES,segmentLimit=MAX_PRE_STRUCTURE_SEGMENTS}={}){
  const camera={x:Number(input?.camera?.x),y:Number(input?.camera?.y),scale:Number(input?.camera?.scale)};
  const viewport={width:Number(input?.viewport?.width),height:Number(input?.viewport?.height)},mapWidth=Number(input?.mapWidth);
  if(!finite(camera.x)||!finite(camera.y)||!finite(camera.scale)||camera.scale<=0||!finite(viewport.width)||!finite(viewport.height)||viewport.width<0||viewport.height<0||!Number.isInteger(mapWidth)||mapWidth<1) throw new TypeError('invalid pre-structure camera');
  const quality=PRE_STRUCTURE_QUALITY.includes(input?.quality)?input.quality:'high',reducedMotion=!!input?.reducedMotion,time=finite(input?.time)?Number(input.time):0;
  const fog=input?.fog||null,fronts=[],routes=[],rangesStatus=[],structureEntries=[],counts={fronts:0,supplyLinks:0,supplyMarkers:0,focusRings:0,commandLinks:0,commandMarkers:0,bubbles:0,pips:0,repairArcs:0,jammerRanges:0,gunRanges:0,commandRanges:0,samRanges:0,fortRanges:0};
  let primitives=0,segments=0;
  const add=(target,value,countName)=>{
    if(!primitiveIntersectsViewport(value,viewport)) return false;
    const nextPrimitives=primitives+1;
    if(nextPrimitives>primitiveLimit) throw new RangeError('primitive-cap');
    const graphicsSegments=primitiveGraphicsSegments(value,segmentLimit-segments),nextSegments=segments+graphicsSegments.length;
    if(nextSegments>segmentLimit) throw new RangeError('segment-cap');
    target.push(Object.freeze({...value,graphicsSegments})); primitives=nextPrimitives; segments=nextSegments; if(countName) counts[countName]++; return true;
  };
  const addRoute=(value,countName,qualityScaled=false)=>{
    if(qualityScaled&&value.dash){ const scale=QUALITY_DASH_SCALE[quality]; value={...value,dash:[value.dash[0]*scale,value.dash[1]*scale]}; }
    return add(routes,value,countName);
  };
  const hidden=tile=>fog&&!fog[tile];
  const pulseAlpha=reducedMotion?.5:.5+.3*Math.sin(time/120);
  for(const item of input?.fronts||[]){
    if(!Number.isInteger(item.tile)||item.tile<0) continue;
    const tx=item.tile%mapWidth,ty=(item.tile-tx)/mapWidth;
    add(fronts,rect(camera.x+tx*camera.scale,camera.y+ty*camera.scale,camera.scale,camera.scale,{fill:item.color,alpha:pulseAlpha}),'fronts');
  }
  const routePhase=reducedMotion?0:(time/60)%16;
  for(const item of input?.supplyLinks||[]){
    if(!Number.isInteger(item.from)||!Number.isInteger(item.to)||(hidden(item.from)&&hidden(item.to))) continue;
    const a=tilePoint(item.from,camera,mapWidth),b=tilePoint(item.to,camera,mapWidth);
    if(camera.scale>=.6){
      addRoute(line(a,b,{stroke:'rgba(15,26,38,.7)',width:Math.max(2,camera.scale*1.4)}));
      addRoute(line(a,b,{stroke:item.color,width:Math.max(1,camera.scale*.6),dash:[6,10],phase:routePhase}),'supplyLinks',true);
    }
    const k=reducedMotion?.5:((time/1400)+(item.from%7)/7)%1;
    addRoute(circle(a.x+(b.x-a.x)*k,a.y+(b.y-a.y)*k,Math.max(1.5,camera.scale*.9),{fill:'#ffd27a',alpha:1}),'supplyMarkers');
  }
  const focus=input?.missileFocus;
  if(focus&&Number.isInteger(focus.tile)&&focus.active){
    const p=tilePoint(focus.tile,camera,mapWidth);
    addRoute(circle(p.x,p.y,60*camera.scale,{stroke:'rgba(255,170,80,.5)',width:1.5,dash:[8,8],phase:routePhase}),'focusRings',true);
  }
  if(camera.scale>=.6) for(const item of input?.commandLinks||[]){
    if(!Number.isInteger(item.from)||!Number.isInteger(item.to)||hidden(item.from)||hidden(item.to)) continue;
    const a=tilePoint(item.from,camera,mapWidth),b=tilePoint(item.to,camera,mapWidth);
    addRoute(line(a,b,{stroke:item.color,width:Math.max(1,camera.scale*.5),dash:[3,7],phase:routePhase,routeType:item.type}),'commandLinks',true);
    const k=reducedMotion?.5:((time/1100)+(item.to%5)/5)%1;
    addRoute(circle(a.x+(b.x-a.x)*k,a.y+(b.y-a.y)*k,Math.max(1.2,camera.scale*.7),{fill:item.markerColor||item.color,alpha:.9,routeType:item.type}),'commandMarkers');
  }
  const orderingEntries=[];
  if(camera.scale>=.9) for(const st of input?.structures||[]){
    if(!Number.isInteger(st.tile)||st.tile<0||hidden(st.tile)) continue;
    const p=tilePoint(st.tile,camera,mapWidth),r=Math.max(6,camera.scale*2.4),entry={tile:st.tile,primitives:[]};
    const addEntry=(value,name)=>add(entry.primitives,value,name);
    const repair=()=>{ if(st.repairing) addEntry(arc(p.x,p.y,r+(st.type==='shield'?3:6),-Math.PI/2,-Math.PI/2+TAU*Math.max(0,Math.min(1,Number(st.repairFraction)||0)),{stroke:'#7fffa0',width:2.5}),'repairArcs'); };
    const pips=(value,max,y,color,empty=false)=>{ const count=Math.max(0,Math.ceil(Number(value)||0)),pw=2*r/max; for(let i=0;i<count;i++) addEntry(rect(p.x-r+i*pw,y,Math.max(1,pw-1),2,{fill:color,alpha:1}),'pips'); if(empty) for(let i=count;i<max;i++) addEntry(rect(p.x-r+i*pw,y,Math.max(1,pw-1),2,{fill:'rgba(255,255,255,.25)',alpha:1}),'pips'); };
    if(st.type==='airfield'&&st.level>=2&&!st.building){
      const hp=Number(st.lshield)||0,low=hp<=2;
      if(hp>0){ const alpha=st.flashing?.45:low?(reducedMotion?.14:.10+.08*Math.abs(Math.sin(time/120))):.12; addEntry(circle(p.x,p.y,st.bubbleRange*camera.scale,{fill:`rgba(150,220,255,${alpha})`,stroke:low?'rgba(255,120,120,.8)':'rgba(150,220,255,.6)',width:1.5}),'bubbles'); }
      pips(hp,st.lshieldMax,p.y+r+22,hp>0?'#9df':'#ff9a9a'); repair();
    }
    if(st.type==='shield'&&!st.building){
      const hp=Number(st.hp)||0,low=hp<=3,alpha=st.flashing?.45:low?(reducedMotion?.14:.10+.08*Math.abs(Math.sin(time/120))):.12;
      addEntry(circle(p.x,p.y,st.bubbleRange*camera.scale,{fill:`rgba(150,220,255,${alpha})`,stroke:low?'rgba(255,120,120,.8)':'rgba(150,220,255,.6)',width:1.5}),'bubbles'); pips(hp,st.hpMax,p.y+r+4,'#fff'); repair();
    }
    if(st.type==='port'&&st.level>=2&&!st.building){ pips(st.gunHp,4,p.y+r+4,(Number(st.gunHp)||0)<=1?'#ff9a9a':'#fff',true); repair(); }
    if(st.gunHpDamaged&&!st.building) pips(st.hp,st.gunHpMax,p.y+r+4,'#fff');
    if(st.jammerRange&&!st.building&&st.owned) addEntry(circle(p.x,p.y,st.jammerRange*camera.scale,{fill:'rgba(255,180,80,.05)',stroke:'rgba(255,180,80,.35)',width:1,dash:[2,6],phase:0}),'jammerRanges');
    if(st.gunRange&&!st.building&&st.owned) addEntry(circle(p.x,p.y,st.gunRange*camera.scale,{stroke:st.type==='bertha'?'rgba(255,180,80,.16)':'rgba(255,220,150,.14)',width:1}),'gunRanges');
    if(st.commandRange&&!st.building&&st.owned) addEntry(circle(p.x,p.y,st.commandRange*camera.scale,{stroke:'rgba(255,180,80,.18)',width:1,dash:[3,5],phase:0}),'commandRanges');
    if(st.samRange&&st.owned) addEntry(circle(p.x,p.y,st.samRange*camera.scale,{stroke:'rgba(150,220,255,.12)',width:1}),'samRanges');
    if(st.fortRange&&st.owned) addEntry(circle(p.x,p.y,st.fortRange*camera.scale,{stroke:st.level>=3?'rgba(255,210,122,.35)':st.level>=2?'rgba(255,210,122,.24)':'rgba(255,255,255,.14)',width:st.level}),'fortRanges');
    if(entry.primitives.length){ entry.primitives=Object.freeze(entry.primitives); structureEntries.push(Object.freeze(entry)); rangesStatus.push(...entry.primitives); }
    const pop=st.building?1:(Number.isFinite(Number(st.pop))?Number(st.pop):1),baseRadius=r*pop;
    const base=structureBasePaintBounds(st.type,p.x,p.y,baseRadius);
    const pixiBounds=entry.primitives.map(primitivePaintBounds); if(paintBoundsIntersectViewport(base,viewport)) pixiBounds.push(base);
    orderingEntries.push(Object.freeze({tile:st.tile,postBounds:retainedPostBaseBounds(st,camera,mapWidth),pixiBounds:Object.freeze(pixiBounds)}));
  }
  const compositingConflict=findStructureCompositingConflict(orderingEntries,viewport);
  return Object.freeze({quality,reducedMotion,time,fronts:Object.freeze(fronts),routes:Object.freeze(routes),rangesStatus:Object.freeze(rangesStatus),structureEntries:Object.freeze(structureEntries),counts:Object.freeze(counts),primitiveCount:primitives,segmentCount:segments,emittedSegmentCount:segments,compositingConflict});
}
