import {STRUCTURE_AMBIENT_TYPES,STRUCTURE_AMBIENT_ZOOM_CUTOFF,structureAmbientDish,structureBasePaintBounds} from './structure-layer-model.mjs';
import {RASTER_ANTIALIAS_MARGIN_CSS,conservativePaintBounds,paintBoundsIntersectViewport} from './paint-bounds.mjs';

export const PRE_STRUCTURE_QUALITY=Object.freeze(['high','medium','low']);
export const MAX_PRE_STRUCTURE_PRIMITIVES=65536;
export const MAX_PRE_STRUCTURE_SEGMENTS=131072;
export const MAX_STRUCTURE_TEXTS=8192;

const QUALITY_DASH_SCALE=Object.freeze({high:1,medium:1.5,low:2});
const TAU=Math.PI*2;
const finite=value=>Number.isFinite(Number(value));
const tilePoint=(tile,camera,mapWidth)=>{ const tx=tile%mapWidth,ty=(tile-tx)/mapWidth; return {x:camera.x+(tx+.5)*camera.scale,y:camera.y+(ty+.5)*camera.scale}; };
const circle=(x,y,r,style)=>({kind:'circle',x,y,r,...style});
const line=(a,b,style)=>({kind:'line',x1:a.x,y1:a.y,x2:b.x,y2:b.y,...style});
const rect=(x,y,width,height,style)=>({kind:'rect',x,y,width,height,...style});
const arc=(x,y,r,start,end,style)=>({kind:'arc',x,y,r,start,end,...style});
const clamp01=value=>Math.max(0,Math.min(1,Number(value)||0));
const strokeMargin=value=>Math.max(0,Number(value?.width)||0)/2;
const bounds=(left,top,right,bottom,kind)=>conservativePaintBounds(left,top,right,bottom,kind);

export function primitivePaintBounds(value){
  const margin=strokeMargin(value);
  if(value.kind==='polyline'||value.kind==='polygon'){
    const xs=value.points.map(point=>point.x),ys=value.points.map(point=>point.y);
    return bounds(Math.min(...xs)-margin,Math.min(...ys)-margin,Math.max(...xs)+margin,Math.max(...ys)+margin,`pre-base-${value.kind}`);
  }
  if(value.kind==='line') return bounds(Math.min(value.x1,value.x2)-margin,Math.min(value.y1,value.y2)-margin,Math.max(value.x1,value.x2)+margin,Math.max(value.y1,value.y2)+margin,'pre-base-line');
  if(value.kind==='rect') return bounds(value.x-margin,value.y-margin,value.x+value.width+margin,value.y+value.height+margin,'pre-base-rect');
  if(value.kind==='circle'||value.kind==='arc') return bounds(value.x-value.r-margin,value.y-value.r-margin,value.x+value.r+margin,value.y+value.r+margin,`pre-base-${value.kind}`);
  throw new TypeError('unknown pre-structure primitive');
}

const textPaintBounds=value=>{ const half=Math.max(5,String(value.text||'').length*(value.style==='level'?3:3.5)+2); return bounds(value.x-half,value.y-(value.style==='level'?10:11),value.x+half,value.y+4,`post-${value.kind}`); };
const normalLabel=(kind,text,x,y)=>({kind,text:String(text||''),x,y,style:'normal',font:'10px "Segoe UI",system-ui,sans-serif',align:'center',baseline:'alphabetic',layers:Object.freeze([{operation:'stroke',text:String(text||''),color:'rgba(0,0,0,.6)',width:3},{operation:'fill',text:String(text||''),color:'#fff'}])});
const levelLabel=(level,x,y)=>({kind:'level-label',text:level>=3?'III':'II',x,y,style:'level',font:'bold 9px "Segoe UI",system-ui,sans-serif',align:'center',baseline:'alphabetic',layers:Object.freeze([{operation:'stroke',text:'II',color:'rgba(0,0,0,.7)',width:2.5},{operation:'fill',text:level>=3?'III':'II',color:'#ffd27a'}])});

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
  if(value.kind==='polygon'){
    if(value.points.length<2) return Object.freeze([]);
    if(maximum<1) throw new RangeError('segment-cap');
    return Object.freeze([Object.freeze({kind:'polygon',points:value.points})]);
  }
  if(value.kind==='polyline'){
    const legs=[]; let total=0;
    for(let i=1;i<value.points.length;i++){ const a=value.points[i-1],b=value.points[i],length=Math.hypot(b.x-a.x,b.y-a.y); if(length>0){ legs.push({a,b,length,at:total}); total+=length; } }
    if(!value.dash?.length){ if(legs.length>maximum) throw new RangeError('segment-cap'); return Object.freeze(legs.map(({a,b})=>Object.freeze({kind:'line',x1:a.x,y1:a.y,x2:b.x,y2:b.y}))); }
    const intervals=dashSegments(total,value.dash[0],value.dash[1],value.phase,maximum),result=[];
    for(const interval of intervals) for(const leg of legs){ const from=Math.max(interval.from,leg.at),to=Math.min(interval.to,leg.at+leg.length); if(to<=from) continue; const f=(from-leg.at)/leg.length,t=(to-leg.at)/leg.length; result.push(Object.freeze({kind:'line',x1:leg.a.x+(leg.b.x-leg.a.x)*f,y1:leg.a.y+(leg.b.y-leg.a.y)*f,x2:leg.a.x+(leg.b.x-leg.a.x)*t,y2:leg.a.y+(leg.b.y-leg.a.y)*t})); if(result.length>maximum) throw new RangeError('segment-cap'); }
    return Object.freeze(result);
  }
  if(value.kind==='line'){
    const dx=value.x2-value.x1,dy=value.y2-value.y1,length=Math.hypot(dx,dy);
    if(!(length>0)) return Object.freeze([]);
    if(!value.dash?.length){ if(maximum<1) throw new RangeError('segment-cap'); return Object.freeze([Object.freeze({kind:'line',x1:value.x1,y1:value.y1,x2:value.x2,y2:value.y2})]); }
    return Object.freeze(dashSegments(length,value.dash[0],value.dash[1],value.phase,maximum).map(({from,to})=>Object.freeze({kind:'line',x1:value.x1+dx*from/length,y1:value.y1+dy*from/length,x2:value.x1+dx*to/length,y2:value.y1+dy*to/length})));
  }
  if(value.kind==='circle'){
    if(!(value.r>0)) return Object.freeze([]);
    if(!value.dash?.length){ if(maximum<1) throw new RangeError('segment-cap'); return Object.freeze([Object.freeze({kind:'circle',x:value.x,y:value.y,r:value.r})]); }
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
  if(value.kind==='polyline'||value.kind==='polygon') return paintBoundsIntersectViewport(primitivePaintBounds(value),viewport);
  if(value.kind==='line') return lineIntersectsViewport(value,viewport);
  if(value.kind==='circle') return circleIntersectsViewport(value,viewport);
  if(value.kind==='arc') return circleIntersectsViewport(value,viewport); // Conservative for partial arcs.
  if(value.kind==='rect'){
    const margin=strokeMargin(value)+RASTER_ANTIALIAS_MARGIN_CSS;
    return value.x+value.width+margin>=0&&value.y+value.height+margin>=0&&value.x-margin<=viewport.width&&value.y-margin<=viewport.height;
  }
  return false;
}

export function createPreStructureScene(input,{primitiveLimit=MAX_PRE_STRUCTURE_PRIMITIVES,segmentLimit=MAX_PRE_STRUCTURE_SEGMENTS,textLimit=MAX_STRUCTURE_TEXTS}={}){
  const camera={x:Number(input?.camera?.x),y:Number(input?.camera?.y),scale:Number(input?.camera?.scale)};
  const viewport={width:Number(input?.viewport?.width),height:Number(input?.viewport?.height)},mapWidth=Number(input?.mapWidth);
  if(!finite(camera.x)||!finite(camera.y)||!finite(camera.scale)||camera.scale<=0||!finite(viewport.width)||!finite(viewport.height)||viewport.width<0||viewport.height<0||!Number.isInteger(mapWidth)||mapWidth<1) throw new TypeError('invalid pre-structure camera');
  const quality=PRE_STRUCTURE_QUALITY.includes(input?.quality)?input.quality:'high',reducedMotion=!!input?.reducedMotion,time=finite(input?.time)?Number(input.time):0;
  const fog=input?.fog||null,fronts=[],routes=[],rangesStatus=[],postOverlays=[],structureEntries=[],counts={fronts:0,supplyLinks:0,supplyMarkers:0,focusRings:0,commandLinks:0,commandMarkers:0,bubbles:0,pips:0,repairArcs:0,jammerRanges:0,gunRanges:0,commandRanges:0,samRanges:0,fortRanges:0,buildingArcs:0,buildingLabels:0,popRings:0,levelLabels:0,upgradeArcs:0,airfieldLabels:0,airfieldQueueArcs:0,shipQueueArcs:0,shipQueueLabels:0,ambientDishes:0,movingDishes:0,staticDishes:0,budgetSkippedDishes:0,suppressedMarks:0,linkedRings:0,cooldownArcs:0};
  let primitives=0,segments=0,texts=0;
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
  const addText=(target,value,countName)=>{
    if(!paintBoundsIntersectViewport(textPaintBounds(value),viewport)) return false;
    if(++texts>textLimit) throw new RangeError('text-cap');
    target.push(Object.freeze(value)); if(countName) counts[countName]++; return true;
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
  if(camera.scale>=.9) for(const st of input?.structures||[]){
    if(!Number.isInteger(st.tile)||st.tile<0||hidden(st.tile)) continue;
    const p=tilePoint(st.tile,camera,mapWidth),r=Math.max(6,camera.scale*2.4),entry={tile:st.tile,pre:[],post:[],labels:[],items:[]};
    const addEntry=(value,name)=>add(entry.pre,value,name),addPost=(value,name)=>add(entry.post,value,name),addEntryText=(value,name)=>addText(entry.labels,value,name);
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
    if(entry.pre.length) entry.items.push({kind:'graphics',semantic:'pre-graphics',primitives:entry.pre});
    entry.items.push({kind:'base',semantic:'base'});
    const ambientEligible=STRUCTURE_AMBIENT_TYPES.includes(st.type)&&!st.building;
    if(ambientEligible&&camera.scale<STRUCTURE_AMBIENT_ZOOM_CUTOFF) counts.budgetSkippedDishes++;
    if(st.building){
      const primitive=arc(p.x,p.y,r+3,-Math.PI/2,-Math.PI/2+TAU*clamp01(st.buildFraction),{stroke:'#ffd27a',width:2.5,semantic:'building-arc'});
      if(addPost(primitive,'buildingArcs')) entry.items.push({kind:'graphics',semantic:'building-arc',primitives:[entry.post.at(-1)]});
      if(camera.scale>=1.2){ const label=normalLabel('building-label',st.buildText,p.x,p.y+r+11); if(addEntryText(label,'buildingLabels')) entry.items.push({kind:'label',semantic:'building-label',label:entry.labels.at(-1)}); }
    }else{
      const pop=Number.isFinite(Number(st.pop))?Math.max(1,Number(st.pop)):1,level=Number(st.level)||1;
      const addOrderedGraphics=(value,name,semantic)=>{ if(addPost(value,name)) entry.items.push({kind:'graphics',semantic,primitives:[entry.post.at(-1)]}); };
      const ambient=structureAmbientDish(st,camera,time,{mapWidth,reducedMotion,quality});
      if(ambient){ addOrderedGraphics(ambient,'ambientDishes','ambient-dish'); if(entry.items.at(-1)?.semantic==='ambient-dish') counts[ambient.motionMode==='moving'?'movingDishes':'staticDishes']++; }
      if(pop>1) addOrderedGraphics(circle(p.x,p.y,r*pop*1.3,{stroke:'rgba(255,255,255,.6)',width:2,semantic:'pop-ring'}),'popRings','pop-graphics');
      if(level>=2){ const label=levelLabel(level,p.x+r*.9,p.y-r*.8); if(addEntryText(label,'levelLabels')) entry.items.push({kind:'label',semantic:'level-mark',label:entry.labels.at(-1)}); }
      if(st.upgrading) addOrderedGraphics(arc(p.x,p.y,r+3,-Math.PI/2,-Math.PI/2+TAU*clamp01(st.upgradeFraction),{stroke:'#ffd27a',width:2.5,semantic:'upgrade-arc'}),'upgradeArcs','upgrade-graphics');
      if(st.type==='airfield'&&camera.scale>=1.2){
        const label=normalLabel('airfield-label',st.airQueueText,p.x,p.y+r+11); if(addEntryText(label,'airfieldLabels')) entry.items.push({kind:'label',semantic:'airfield-label',label:entry.labels.at(-1)});
        if(st.airQueue) addOrderedGraphics(arc(p.x,p.y,r+3,-Math.PI/2,-Math.PI/2+TAU*clamp01(st.airQueueFraction),{stroke:'#bfe6ff',width:2.5,semantic:'airfield-queue-arc'}),'airfieldQueueArcs','airfield-arc');
      }
      if(st.shipQueue){
        addOrderedGraphics(arc(p.x,p.y,r+3,-Math.PI/2,-Math.PI/2+TAU*clamp01(st.shipQueueFraction),{stroke:'#bfe6ff',width:2.5,semantic:'ship-queue-arc'}),'shipQueueArcs','ship-arc');
        if(camera.scale>=1.2){ const label=normalLabel('ship-queue-label',st.shipQueueText,p.x,p.y+r+11); if(addEntryText(label,'shipQueueLabels')) entry.items.push({kind:'label',semantic:'ship-label',label:entry.labels.at(-1)}); }
      }
      if(st.suppressed){ const first=line({x:p.x-r,y:p.y-r},{x:p.x+r,y:p.y+r},{stroke:'rgba(255,120,120,.9)',width:2,semantic:'suppressed-x'}),second=line({x:p.x+r,y:p.y-r},{x:p.x-r,y:p.y+r},{stroke:'rgba(255,120,120,.9)',width:2,semantic:'suppressed-x'}),before=entry.post.length; addPost(first,'suppressedMarks'); addPost(second,'suppressedMarks'); if(entry.post.length>before) entry.items.push({kind:'graphics',semantic:'suppression',primitives:entry.post.slice(before)}); }
      if(st.linked) addOrderedGraphics(circle(p.x,p.y,r+2,{stroke:'rgba(255,210,122,.8)',width:1.5,semantic:'linked-ring'}),'linkedRings','linked');
      if(st.cooldown) addOrderedGraphics(arc(p.x,p.y,r+3,-Math.PI/2,-Math.PI/2+TAU*clamp01(st.cooldownFraction),{stroke:'rgba(255,255,255,.7)',width:2,semantic:'cooldown-arc'}),'cooldownArcs','cooldown');
    }
    entry.pre=Object.freeze(entry.pre); entry.post=Object.freeze(entry.post); entry.labels=Object.freeze(entry.labels); entry.items=Object.freeze(entry.items.map(value=>Object.freeze({...value,primitives:value.primitives?Object.freeze(value.primitives):undefined})));
    if(entry.pre.length||entry.post.length||entry.labels.length||paintBoundsIntersectViewport(structureBasePaintBounds(st.type,p.x,p.y,r*(st.building?1:Number.isFinite(Number(st.pop))?Number(st.pop):1)),viewport)) structureEntries.push(Object.freeze(entry));
    rangesStatus.push(...entry.pre); postOverlays.push(...entry.post);
  }
  return Object.freeze({quality,reducedMotion,time,fronts:Object.freeze(fronts),routes:Object.freeze(routes),rangesStatus:Object.freeze(rangesStatus),postOverlays:Object.freeze(postOverlays),structureEntries:Object.freeze(structureEntries),counts:Object.freeze(counts),primitiveCount:primitives,textCount:texts,segmentCount:segments,emittedSegmentCount:segments});
}
