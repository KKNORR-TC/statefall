import {primitiveGraphicsSegments,primitiveIntersectsViewport} from './pre-structure-layer-model.mjs';

export const GLOBAL_EFFECT_CATEGORIES=Object.freeze(['scorches','sparks','puffs','fragments','tracers','wrecks','flashes']);
export const MAX_GLOBAL_EFFECT_CATEGORY_ENTRIES=8192;
export const MAX_GLOBAL_EFFECT_ENTRIES=32768;
export const MAX_GLOBAL_EFFECT_TRAIL_POINTS=65536;
export const MAX_GLOBAL_EFFECT_PRIMITIVES=262144;
export const MAX_GLOBAL_EFFECT_SEGMENTS=524288;
export const MAX_GLOBAL_EFFECT_CONTAINERS=32768;
export const MAX_GLOBAL_EFFECT_IDLE_CONTAINERS=2048;
export const MAX_GLOBAL_EFFECT_GRAPHICS=65536;
export const MAX_GLOBAL_EFFECT_IDLE_GRAPHICS=4096;

const TAU=Math.PI*2;
const finite=value=>Number.isFinite(Number(value));
const color=value=>typeof value==='string'&&value.length>0;
const point=(x,y)=>Object.freeze({x,y});
const circle=(x,y,r,style)=>({kind:'circle',x,y,r,...style});
const rect=(x,y,width,height,style)=>({kind:'rect',x,y,width,height,...style});
const line=(x1,y1,x2,y2,style)=>({kind:'line',x1,y1,x2,y2,...style});
const polygon=(points,style)=>({kind:'polygon',points:Object.freeze(points),...style});
const polyline=(points,style)=>({kind:'polyline',points:Object.freeze(points),...style});

function inheritedState(input){
  const value=input?.inheritedCanvasState||{},dash=Array.isArray(value.lineDash)?value.lineDash.map(Number):[];
  if(dash.some(item=>!finite(item)||item<0)) throw new TypeError('invalid global effects inherited dash');
  return {globalAlpha:finite(value.globalAlpha)?Number(value.globalAlpha):1,lineJoin:['round','bevel'].includes(value.lineJoin)?value.lineJoin:'miter',lineCap:['round','square'].includes(value.lineCap)?value.lineCap:'butt',lineDash:dash,lineDashOffset:finite(value.lineDashOffset)?Number(value.lineDashOffset):0,lineWidth:finite(value.lineWidth)&&Number(value.lineWidth)>=0?Number(value.lineWidth):1,strokeStyle:color(value.strokeStyle)?value.strokeStyle:'#000000',fillStyle:color(value.fillStyle)?value.fillStyle:'#000000',font:typeof value.font==='string'?value.font:'10px sans-serif',textAlign:['left','right','center','start','end'].includes(value.textAlign)?value.textAlign:'start',textBaseline:['top','hanging','middle','alphabetic','ideographic','bottom'].includes(value.textBaseline)?value.textBaseline:'alphabetic'};
}

function applyState(context,state){
  context.globalAlpha=state.globalAlpha; context.lineJoin=state.lineJoin; context.lineCap=state.lineCap; context.setLineDash(state.lineDash); context.lineDashOffset=state.lineDashOffset; context.lineWidth=state.lineWidth; context.strokeStyle=state.strokeStyle; context.fillStyle=state.fillStyle; context.font=state.font; context.textAlign=state.textAlign; context.textBaseline=state.textBaseline;
}

function arrays(input){
  return {scorches:Array.isArray(input?.scorches)?input.scorches:[],sparks:Array.isArray(input?.sparks)?input.sparks:[],puffs:Array.isArray(input?.puffs)?input.puffs:[],fragments:Array.isArray(input?.fragments)?input.fragments:[],tracers:Array.isArray(input?.tracers)?input.tracers:[],wrecks:Array.isArray(input?.wrecks)?input.wrecks:[],flashes:Array.isArray(input?.flashes)?input.flashes:[]};
}

function validate(input,{strict=true}={}){
  const camera={x:Number(input?.camera?.x),y:Number(input?.camera?.y),scale:Number(input?.camera?.scale)},viewport={width:Number(input?.viewport?.width),height:Number(input?.viewport?.height)},values=arrays(input);
  if(!finite(camera.x)||!finite(camera.y)||!(camera.scale>0)||!finite(viewport.width)||!finite(viewport.height)||viewport.width<0||viewport.height<0) throw new TypeError('invalid global effects camera');
  if(strict){
    for(const value of values.scorches) if(!value||typeof value.source!=='object'||![value.x,value.y,value.r,value.age].every(finite)||value.r<0) throw new TypeError('invalid scorch source');
    for(const value of values.sparks) if(!value||typeof value.source!=='object'||![value.x,value.y,value.age].every(finite)) throw new TypeError('invalid spark source');
    for(const value of values.puffs) if(!value||typeof value.source!=='object'||![value.x,value.y,value.r,value.age,value.life].every(finite)||value.r<0||!(value.life>0)||!color(value.color)) throw new TypeError('invalid puff source');
    for(const value of values.fragments) if(!value||typeof value.source!=='object'||![value.x,value.y,value.vx,value.vy,value.age,value.life].every(finite)||!(value.life>0)||!color(value.color)||typeof value.bomb!=='boolean'||typeof value.dud!=='boolean') throw new TypeError('invalid fragment source');
    for(const value of values.tracers) if(!value||typeof value.source!=='object'||![value.x0,value.y0,value.x1,value.y1,value.age].every(finite)||!color(value.color)) throw new TypeError('invalid tracer source');
    for(const value of values.wrecks) if(!value||typeof value.source!=='object'||![value.x,value.y,value.age].every(finite)||!['ship','air','dome'].includes(value.kind)||(value.kind==='ship'&&(!color(value.color)||!color(value.cls)||![value.heading,value.spin].every(finite)))||(value.kind==='air'&&(!color(value.color)||!finite(value.heading)))||(value.kind==='dome'&&(!finite(value.r)||value.r<0))) throw new TypeError('invalid wreck source');
    for(const value of values.flashes) if(!value||typeof value.source!=='object'||![value.x,value.y,value.r,value.age].every(finite)||value.r<0||!color(value.color)) throw new TypeError('invalid flash source');
  }
  return {camera,viewport,...values};
}

export function advanceGlobalEffectsPresentation(input,advance=true,{visibleWreckSources=null}={}){
  const {scorches,sparks,puffs,fragments,tracers,wrecks,flashes}=arrays(input);
  if(!advance) return Object.freeze({frame:Object.freeze({scorches:Object.freeze(scorches.slice()),sparks:Object.freeze(sparks.slice()),puffs:Object.freeze(puffs.slice()),fragments:Object.freeze(fragments.slice()),tracers:Object.freeze(tracers.slice()),wrecks:Object.freeze(wrecks.slice()),flashes:Object.freeze(flashes.slice())}),next:{scorches,sparks,puffs,fragments,tracers,wrecks,flashes}});
  for(const value of scorches){ if(!finite(value.age)) throw new TypeError('invalid scorch presentation source'); value.age++; }
  for(const value of sparks){ if(!finite(value.age)) throw new TypeError('invalid spark presentation source'); value.age++; }
  for(const value of puffs){ if(![value.age,value.x,value.y,value.vx,value.vy,value.r].every(finite)) throw new TypeError('invalid puff presentation source'); value.age++; value.x+=value.vx; value.y+=value.vy; value.r+=.06; }
  const displayedPuffs=puffs.slice();
  for(const value of fragments){ if(![value.age,value.x,value.y,value.vx,value.vy].every(finite)) throw new TypeError('invalid fragment presentation source'); value.age++; value.x+=value.vx; value.y+=value.vy; if(value.dud) value.vy+=.04; }
  for(const value of tracers){ if(!finite(value.age)) throw new TypeError('invalid tracer presentation source'); value.age++; }
  for(const value of wrecks){ if(!finite(value.age)) throw new TypeError('invalid wreck presentation source'); value.age++; if(value.kind==='air'&&value.age%3===0&&(!visibleWreckSources||visibleWreckSources.has(value))) puffs.push({x:value.x+Math.cos(value.hdg)*value.age*.35,y:value.y+Math.sin(value.hdg)*value.age*.35+value.age*.25,vx:0,vy:-.05,r:1,age:0,life:25,col:'70,70,70'}); }
  for(const value of flashes){ if(!finite(value.age)) throw new TypeError('invalid flash presentation source'); value.age++; }
  return Object.freeze({frame:Object.freeze({scorches:Object.freeze(scorches.slice()),sparks:Object.freeze(sparks.slice()),puffs:Object.freeze(displayedPuffs),fragments:Object.freeze(fragments.slice()),tracers:Object.freeze(tracers.slice()),wrecks:Object.freeze(wrecks.slice()),flashes:Object.freeze(flashes.slice())}),next:{scorches:scorches.filter(value=>value.age<1800),sparks:sparks.filter(value=>value.age<6),puffs:puffs.filter(value=>value.age<value.life),fragments:fragments.filter(value=>value.age<value.life),tracers:tracers.filter(value=>value.age<9),wrecks:wrecks.filter(value=>value.age<(value.kind==='ship'?40:value.kind==='air'?30:25)),flashes:flashes.filter(value=>value.age<25)}});
}

function shipPrimitives(wk,px,py,r,alpha){
  const heading=wk.heading+wk.spin*wk.age,u=r/10,sy=Math.max(.2,1-wk.age/40*.6),transform=values=>values.map(([x,y])=>point(px+(x*Math.cos(heading)-y*sy*Math.sin(heading))*u,py+(x*Math.sin(heading)+y*sy*Math.cos(heading))*u)),base={alpha,join:'round'},fillRect=(x,y,w,h,fill)=>polygon(transform([[x,y],[x+w,y],[x+w,y+h],[x,y+h]]),{fill,alpha}),hull=(points,extra={})=>polygon(transform(points),{fill:wk.color,stroke:'#fff',width:1.2*u,...base,...extra}),out=[],addLine=(x1,y1,x2,y2,width=1.2)=>{ const [a,b]=transform([[x1,y1],[x2,y2]]); out.push(line(a.x,a.y,b.x,b.y,{stroke:'#e8ecef',width:width*u,...base})); },addArc=(cx,cy,radius,start,end)=>{ const points=[]; for(let i=0;i<=24;i++){ const angle=start+(end-start)*i/24; points.push(...transform([[cx+Math.cos(angle)*radius,cy+Math.sin(angle)*radius]])); } out.push(polyline(points,{stroke:'#e8ecef',width:1.2*u,...base})); };
  const kind=wk.cls==='trader'||wk.cls==='transport'?'transport':wk.cls;
  if(kind==='warship'){ out.push(hull([[12,0],[5,-3.5],[-9,-3.5],[-11,-2],[-11,2],[-9,3.5],[5,3.5]]),fillRect(-5,-2,7,4,'#e8ecef'),fillRect(-1,-1.2,2.5,2.4,'#e8ecef')); const [a,b]=transform([[5,0],[9.5,0]]); out.push(line(a.x,a.y,b.x,b.y,{stroke:'#e8ecef',width:1.4*u,...base}),fillRect(-8,-1,2,2,'#0f1a26'));
  }else if(kind==='privateer'){ out.push(hull([[10,0],[4,-3],[-8,-3],[-9,0],[-8,3],[4,3]],{fill:'#3a2f2a',stroke:wk.color,width:1.4*u}),polygon(transform([[-2,-1.5],[-2,-8],[3,-3.5]]),{fill:'#e8ecef',alpha}),fillRect(-4,-1,3,2,'#111'));
  }else if(kind==='sub'||kind==='hunter'){ out.push(hull([[9,0],[5,-2.2],[-7,-2.2],[-9,0],[-7,2.2],[5,2.2]]),fillRect(-2,-4.5,3,2.5,'#e8ecef')); if(kind==='hunter') addArc(-.5,-5.5,2,Math.PI*1.1,Math.PI*1.9);
  }else if(kind==='rship'){ out.push(hull([[9,0],[3,-3],[-8,-3],[-9,0],[-8,3],[3,3]]),fillRect(-4,-1.5,4,3,'#e8ecef')); addArc(-1,-4,3,Math.PI*1.1,Math.PI*1.9); addLine(-1,-4,-1,-1.5);
  }else if(kind==='scout'){ out.push(hull([[9,0],[3,-2.2],[-7,-2.2],[-8,0],[-7,2.2],[3,2.2]]),fillRect(-3,-1.3,4,2.6,'#e8ecef'));
  }else if(kind==='cruiser'){ out.push(hull([[13,0],[6,-3.2],[-10,-3.2],[-12,-1.5],[-12,1.5],[-10,3.2],[6,3.2]]),fillRect(-2,-2,5,4,'#e8ecef'),fillRect(-8,-2.4,4,1.8,'#0f1a26'),fillRect(-8,.6,4,1.8,'#0f1a26'),fillRect(4,-2.4,2.5,1.8,'#0f1a26'),fillRect(4,.6,2.5,1.8,'#0f1a26')); addLine(0,0,0,-5,1); addLine(-1.5,-5,1.5,-5,1);
  }else if(kind==='battleship'){ out.push(hull([[14,0],[7,-4.5],[-11,-4.5],[-13,-2.5],[-13,2.5],[-11,4.5],[7,4.5]]),fillRect(-4,-2.5,6,5,'#e8ecef'),fillRect(-1.5,-1.5,2.5,3,'#e8ecef')); for(const cx of [6,-8]){ const points=[]; for(let i=0;i<32;i++){ const angle=TAU*i/32; points.push(...transform([[cx+Math.cos(angle)*2.2,Math.sin(angle)*2.2]])); } out.push(polygon(points,{fill:'#0f1a26',alpha})); } for(const values of [[6,-1,11.5,-1],[6,1,11.5,1],[-8,-1,-12,-1],[-8,1,-12,1]]) addLine(...values,1.3);
  }else out.push(hull([[9,0],[4,-3.5],[-8,-3.5],[-9,0],[-8,3.5],[4,3.5]]),fillRect(-6,-2,5,4,'#e8ecef'),fillRect(0,-2,3,4,'#e8ecef'));
  return out;
}

export function paintGlobalEffectsCanvas(context,input,{drawShip=null,onlyCategory=null}={}){
  const value=validate(input,{strict:false}),state=inheritedState(input),order=[],s=value.camera.scale,x=n=>value.camera.x+Number(n)*s,y=n=>value.camera.y+Number(n)*s,visible=item=>item.visible!==false; applyState(context,state);
  if(!onlyCategory||onlyCategory==='scorches') for(const sc of value.scorches){ if(!visible(sc)) continue; state.fillStyle=`rgba(10,8,6,${.45*Math.max(0,1-Number(sc.age)/1800)})`; context.fillStyle=state.fillStyle; context.beginPath(); context.arc(x(sc.x),y(sc.y),Number(sc.r)*s,0,TAU); context.fill(); order.push('scorch'); }
  if(!onlyCategory||onlyCategory==='sparks') for(const sp of value.sparks){ const alpha=1-Number(sp.age)/6; if(alpha<=0) continue; context.globalAlpha=alpha; state.fillStyle='#fff'; context.fillStyle=state.fillStyle; context.fillRect(x(sp.x),y(sp.y),Math.max(1,s),Math.max(1,s)); order.push('spark'); } context.globalAlpha=1; state.globalAlpha=1;
  if(!onlyCategory||onlyCategory==='puffs') for(const pf of value.puffs){ if(!visible(pf)) continue; state.fillStyle=`rgba(${pf.color??pf.col},${.5*Math.max(0,1-Number(pf.age)/Number(pf.life))})`; context.fillStyle=state.fillStyle; context.beginPath(); context.arc(x(pf.x),y(pf.y),Number(pf.r)*s,0,TAU); context.fill(); order.push('puff'); }
  if(!onlyCategory||onlyCategory==='fragments') for(const fr of value.fragments){ context.globalAlpha=Math.max(0,1-Number(fr.age)/Number(fr.life)); state.fillStyle=fr.color??fr.col; context.fillStyle=state.fillStyle; if(fr.bomb){ context.beginPath(); context.arc(x(fr.x),y(fr.y)+Number(fr.age)*s*.4,Math.max(1,s*.5),0,TAU); context.fill(); order.push('bomb'); }else{ context.beginPath(); context.moveTo(x(fr.x),y(fr.y)); context.lineTo(x(Number(fr.x)-Number(fr.vx)*2),y(Number(fr.y)-Number(fr.vy)*2)); state.strokeStyle=fr.color??fr.col; state.lineWidth=1.5; context.strokeStyle=state.strokeStyle; context.lineWidth=state.lineWidth; context.stroke(); order.push('fragment'); } } context.globalAlpha=1; state.globalAlpha=1;
  if(!onlyCategory||onlyCategory==='tracers') for(const tr of value.tracers){ const alpha=Math.max(0,1-Number(tr.age)/9); state.strokeStyle=`rgba(${tr.color??tr.col},${alpha*.7})`; state.lineWidth=1; context.strokeStyle=state.strokeStyle; context.lineWidth=1; context.beginPath(); context.moveTo(x(tr.x0),y(tr.y0)); context.lineTo(x(tr.x1),y(tr.y1)); context.stroke(); order.push('tracer'); }
  if(!onlyCategory||onlyCategory==='wrecks') for(const wk of value.wrecks){ if(!visible(wk)) continue; const px=x(wk.x),py=y(wk.y); if(wk.kind==='ship'){ const k=Number(wk.age)/40,r=Math.max(4,s*(wk.cls==='battleship'?4:2.6)); context.globalAlpha=Math.max(0,1-k); if(typeof drawShip==='function'){ context.save(); context.translate(px,py); context.rotate(Number(wk.hdg??wk.heading)+Number(wk.spin)*Number(wk.age)); context.scale(1,Math.max(.2,1-k*.6)); context.translate(-px,-py); drawShip(wk.cls==='trader'||wk.cls==='transport'?'transport':wk.cls,px,py,0,r,wk.col??wk.color,null,null,context); context.restore(); } context.globalAlpha=1; state.strokeStyle=`rgba(230,240,255,${.6*Math.max(0,1-k)})`; state.lineWidth=1.5; context.strokeStyle=state.strokeStyle; context.lineWidth=1.5; context.beginPath(); context.arc(px,py,r*(.8+k*2.2),0,TAU); context.stroke(); order.push('ship-wreck'); }
    else if(wk.kind==='air'){ const k=Number(wk.age)/30; context.globalAlpha=Math.max(0,1-k); context.save(); context.translate(px+Math.cos(Number(wk.hdg??wk.heading))*Number(wk.age)*s*.35,py+Math.sin(Number(wk.hdg??wk.heading))*Number(wk.age)*s*.35+Number(wk.age)*s*.25); context.rotate(Number(wk.hdg??wk.heading)+Number(wk.age)*.3); const u=Math.max(4,s*2.2)/10*(1-k*.4); context.scale(u,u); context.fillStyle=wk.col??wk.color; context.beginPath(); context.moveTo(10,0); context.lineTo(-6,-7); context.lineTo(-4,0); context.lineTo(-6,7); context.closePath(); context.fill(); context.restore(); context.globalAlpha=1; order.push('air-wreck'); }
    else { const k=Number(wk.age)/25; state.strokeStyle=`rgba(150,220,255,${.8*Math.max(0,1-k)})`; state.lineWidth=2; context.strokeStyle=state.strokeStyle; context.lineWidth=2; context.beginPath(); context.arc(px,py,Number(wk.r)*s*(1-k),0,TAU); context.stroke(); order.push('dome-wreck'); } }
  if(!onlyCategory||onlyCategory==='flashes') for(const f of value.flashes){ context.globalAlpha=Math.max(0,1-Number(f.age)/25); state.fillStyle=f.color??f.col; context.fillStyle=state.fillStyle; context.beginPath(); context.arc(value.camera.x+(Number(f.x)+.5)*s,value.camera.y+(Number(f.y)+.5)*s,Number(f.r)*s*(.5+Number(f.age)/25),0,TAU); context.fill(); context.globalAlpha=1; order.push('flash'); } state.globalAlpha=1;
  applyState(context,state); return Object.freeze(order);
}

export function paintGlobalEffectsScene(context,scene){
  const order=[]; for(const entry of scene.entries) for(const item of entry.items){ order.push(item.semantic); for(const primitive of item.primitives){ context.save(); context.globalAlpha=primitive.alpha??1; context.lineCap=primitive.cap||'butt'; context.lineJoin=primitive.join||'miter'; context.lineWidth=primitive.width||1; context.setLineDash(primitive.dash||[]); context.lineDashOffset=-(primitive.phase||0); context.beginPath(); if(primitive.kind==='circle') context.arc(primitive.x,primitive.y,primitive.r,0,TAU); else if(primitive.kind==='rect') context.rect(primitive.x,primitive.y,primitive.width,primitive.height); else if(primitive.kind==='line'){ context.moveTo(primitive.x1,primitive.y1); context.lineTo(primitive.x2,primitive.y2); } else if(primitive.kind==='polygon'||primitive.kind==='polyline'){ const [first,...rest]=primitive.points; if(first){ context.moveTo(first.x,first.y); for(const value of rest) context.lineTo(value.x,value.y); if(primitive.kind==='polygon') context.closePath(); } } else { context.restore(); throw new TypeError('unknown global effect Canvas primitive'); } if(primitive.fill){ context.fillStyle=primitive.fill; context.fill(); } if(primitive.stroke){ context.strokeStyle=primitive.stroke; context.stroke(); } context.restore(); } }
  applyState(context,scene.canvasState); return Object.freeze(order);
}

export function createGlobalEffectsModel(){
  let identities=new WeakMap(),identitySerial=0;
  const reset=()=>{ identities=new WeakMap(); identitySerial=0; };
  const build=(input,limits={})=>{
    const value=validate(input),maximum={categoryEntries:limits.categoryEntries??MAX_GLOBAL_EFFECT_CATEGORY_ENTRIES,entries:limits.entries??MAX_GLOBAL_EFFECT_ENTRIES,trailPoints:limits.trailPoints??MAX_GLOBAL_EFFECT_TRAIL_POINTS,primitives:limits.primitives??MAX_GLOBAL_EFFECT_PRIMITIVES,segments:limits.segments??MAX_GLOBAL_EFFECT_SEGMENTS};
    for(const [name,limit] of Object.entries(maximum)) if(!Number.isInteger(limit)||limit<0) throw new TypeError(`invalid global effects ${name} cap`);
    const lists=GLOBAL_EFFECT_CATEGORIES.map(category=>[category,value[category]]),total=lists.reduce((sum,[,items])=>sum+items.length,0),trailPoints=value.fragments.length*2+value.tracers.length*2;
    if(lists.some(([,items])=>items.length>maximum.categoryEntries)) throw new RangeError('category-cap'); if(total>maximum.entries) throw new RangeError('entry-cap'); if(trailPoints>maximum.trailPoints) throw new RangeError('trail-point-cap');
    const state=inheritedState(input),entries=[],items=[]; let primitiveCount=0,segmentCount=0,culled=0;
    const occurrences=new Map(),key=(category,source)=>{ let identity=identities.get(source); if(!identity){ identity=++identitySerial; identities.set(source,identity); } const base=`${category}:${identity}`,occurrence=occurrences.get(base)||0; occurrences.set(base,occurrence+1); return `${base}:${occurrence}`; };
    const stage=(category,source,order,variant,primitives,meta={})=>{ const visible=primitives.filter(primitive=>primitiveIntersectsViewport(primitive,value.viewport)); if(!visible.length){ culled++; return; } if(primitiveCount+visible.length>maximum.primitives) throw new RangeError('primitive-cap'); const frozen=visible.map(primitive=>{ const graphicsSegments=primitiveGraphicsSegments(primitive,maximum.segments-segmentCount); segmentCount+=graphicsSegments.length; return Object.freeze({...primitive,graphicsSegments}); }); primitiveCount+=frozen.length; const item=Object.freeze({kind:'graphics',semantic:variant,primitives:Object.freeze(frozen)}),entry=Object.freeze({key:key(category,source),category,source,order,variant,...meta,items:Object.freeze([item])}); entries.push(entry); items.push(item); };
    const s=value.camera.scale,sx=n=>value.camera.x+n*s,sy=n=>value.camera.y+n*s,alphaBase=()=>state.globalAlpha,base=()=>({alpha:alphaBase(),cap:state.lineCap,join:state.lineJoin,dash:Object.freeze(state.lineDash.slice()),phase:-state.lineDashOffset});
    for(let order=0;order<value.scorches.length;order++){ const sc=value.scorches[order]; state.fillStyle=`rgba(10,8,6,${.45*Math.max(0,1-sc.age/1800)})`; if(sc.visible!==false) stage('scorches',sc.source,order,'scorch',[circle(sx(sc.x),sy(sc.y),sc.r*s,{fill:state.fillStyle,alpha:alphaBase()})],{age:sc.age,life:1800}); else culled++; }
    for(let order=0;order<value.sparks.length;order++){ const sp=value.sparks[order],alpha=1-sp.age/6; if(alpha>0){ state.fillStyle='#fff'; stage('sparks',sp.source,order,'spark',[rect(sx(sp.x),sy(sp.y),Math.max(1,s),Math.max(1,s),{fill:'#fff',alpha})],{age:sp.age,life:6}); }else culled++; } state.globalAlpha=1;
    for(let order=0;order<value.puffs.length;order++){ const pf=value.puffs[order]; state.fillStyle=`rgba(${pf.color},${.5*Math.max(0,1-pf.age/pf.life)})`; if(pf.visible!==false) stage('puffs',pf.source,order,'puff',[circle(sx(pf.x),sy(pf.y),pf.r*s,{fill:state.fillStyle,alpha:1})],{age:pf.age,life:pf.life}); else culled++; }
    for(let order=0;order<value.fragments.length;order++){ const fr=value.fragments[order],alpha=Math.max(0,1-fr.age/fr.life); state.fillStyle=fr.color; if(fr.bomb) stage('fragments',fr.source,order,'bomb',[circle(sx(fr.x),sy(fr.y)+fr.age*s*.4,Math.max(1,s*.5),{fill:fr.color,alpha})],{age:fr.age,life:fr.life}); else { state.strokeStyle=fr.color; state.lineWidth=1.5; stage('fragments',fr.source,order,'fragment',[line(sx(fr.x),sy(fr.y),sx(fr.x-fr.vx*2),sy(fr.y-fr.vy*2),{...base(),stroke:fr.color,width:1.5,alpha})],{age:fr.age,life:fr.life}); } } state.globalAlpha=1;
    for(let order=0;order<value.tracers.length;order++){ const tr=value.tracers[order],alpha=Math.max(0,1-tr.age/9); state.strokeStyle=`rgba(${tr.color},${alpha*.7})`; state.lineWidth=1; stage('tracers',tr.source,order,'tracer',[line(sx(tr.x0),sy(tr.y0),sx(tr.x1),sy(tr.y1),{stroke:state.strokeStyle,width:1,...base()})],{age:tr.age,life:9}); }
    for(let order=0;order<value.wrecks.length;order++){ const wk=value.wrecks[order]; if(wk.visible===false){ culled++; continue; } const px=sx(wk.x),py=sy(wk.y); if(wk.kind==='ship'){ const k=wk.age/40,r=Math.max(4,s*(wk.cls==='battleship'?4:2.6)),alpha=Math.max(0,1-k),primitives=shipPrimitives(wk,px,py,r,alpha); state.globalAlpha=1; state.strokeStyle=`rgba(230,240,255,${.6*Math.max(0,1-k)})`; state.lineWidth=1.5; primitives.push(circle(px,py,r*(.8+k*2.2),{stroke:state.strokeStyle,width:1.5,alpha:1,...base()})); stage('wrecks',wk.source,order,'ship-wreck',primitives,{age:wk.age,life:40,cls:wk.cls}); }
      else if(wk.kind==='air'){ const k=wk.age/30,h=wk.heading+wk.age*.3,cx=px+Math.cos(wk.heading)*wk.age*s*.35,cy=py+Math.sin(wk.heading)*wk.age*s*.35+wk.age*s*.25,u=Math.max(4,s*2.2)/10*(1-k*.4),points=[[10,0],[-6,-7],[-4,0],[-6,7]].map(([x,y])=>point(cx+(x*Math.cos(h)-y*Math.sin(h))*u,cy+(x*Math.sin(h)+y*Math.cos(h))*u)); stage('wrecks',wk.source,order,'air-wreck',[polygon(points,{fill:wk.color,alpha:Math.max(0,1-k)})],{age:wk.age,life:30,cls:wk.cls}); state.globalAlpha=1; }
      else { const k=wk.age/25; state.strokeStyle=`rgba(150,220,255,${.8*Math.max(0,1-k)})`; state.lineWidth=2; stage('wrecks',wk.source,order,'dome-wreck',[circle(px,py,wk.r*s*(1-k),{stroke:state.strokeStyle,width:2,...base()})],{age:wk.age,life:25}); } }
    for(let order=0;order<value.flashes.length;order++){ const f=value.flashes[order],alpha=Math.max(0,1-f.age/25); state.fillStyle=f.color; stage('flashes',f.source,order,'flash',[circle(value.camera.x+(f.x+.5)*s,value.camera.y+(f.y+.5)*s,f.r*s*(.5+f.age/25),{fill:f.color,alpha})],{age:f.age,life:25}); state.globalAlpha=1; }
    return Object.freeze({entries:Object.freeze(entries),items:Object.freeze(items),counts:Object.freeze(Object.fromEntries([...lists.map(([category,values])=>[category,values.length]),['total',total],['visible',entries.length],['culled',culled]])),trailPointCount:trailPoints,primitiveCount,segmentCount,limits:Object.freeze(maximum),quality:['high','medium','low'].includes(input?.quality)?input.quality:'high',reducedMotion:!!input?.reducedMotion,canvasState:Object.freeze({...state,lineDash:Object.freeze(state.lineDash.slice())})});
  };
  return Object.freeze({build,reset,diagnostics:()=>Object.freeze({identitySerial})});
}
