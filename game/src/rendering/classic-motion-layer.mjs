import {missilePosition} from './missile-layer-model.mjs';
import {paintSam} from './classic-sam-sequence.mjs';
import {createClassicMotionPainter} from './classic-motion-effects.mjs';
import {createMotionTracker,shipMuzzles,unitAttachment} from './classic-motion-state.mjs';
const AIR=new Set(['fighter','bomber','carrier','spy']);
const SEA=new Set(['warship','scout','sub','hunter','rship','privateer','cruiser','battleship','merchant','transport','heavytransport']);
function cPath(c,x,y,r){c.beginPath();c.arc(x,y,r,Math.PI,0);c.lineTo(x,y+r*1.7);c.closePath();c.stroke();}
export function createClassicMotionLayer(){
 const paint=createClassicMotionPainter(),tracker=createMotionTracker();let draws=0,weaponStates=new WeakMap(),priorMissiles=[],lastTick=-1;
 function render(ctx,input){
  const {art,camera:c,width,height,tick,now,paused,reducedMotion,structures=[],warships=[],transports=[],merchants=[],aircraft=[],planes=[],trucks=[],fog=null,shelled=[],W=720,selectedStructure=null}=input;
  const time=tracker.begin(tick,now,paused);draws=0;if(tick<lastTick){weaponStates=new WeakMap();priorMissiles=[];}lastTick=tick;
  if(!art?.enabled)return;const animate=!reducedMotion&&c.s>=2;
  // Only observed actors contribute dispatch cues; hidden enemy activity never does.
  const departures=new Set(),working=new Set();
  for(const a of aircraft)if(a.visible&&a.source&&['out','return'].includes(a.state))departures.add(a.source.home?.t);
  for(const tr of trucks)if(tr.visible&&tr.state==='work')working.add(tr.source?.home?.t);
  function draw(key,source,x,y,size,options={}){
   if(!Number.isFinite(x)||!Number.isFinite(y)||size<.055||x+size*190<0||y+size*190<0||x-size*190>width||y-size*190>height)return;
   const unit=SEA.has(key)||AIR.has(key)||key==='truck',heading=options.heading||0;
   ctx.save();ctx.translate(x,y);ctx.scale(size,size);ctx.translate(-180,unit?(key==='truck'?-128:-116):-166);
   if(key==='sam')paintSam(ctx,{age:options.samAge??3.8,target:options.heading??-Math.PI/2,projectile:options.projectile!==false,aimHeading:options.heading,reducedMotion:!animate});
   else paint(ctx,{key,level:source.level||1,time:time+(source.t??source.id??source.owner??0)*.071,age:options.age??-100,scale:Math.min(1,c.s/4),strength:.8,muzzles:unit?shipMuzzles(key,heading):null,wingtips:AIR.has(key)?art.motionWingTips(key,heading):null,unitPoint:unit?(x,y)=>unitAttachment(heading,x,y):null,moving:options.moving??true,shieldActive:options.shieldActive??true,nativeActions:true,impact:source.flash>tick});ctx.restore();draws++;
  }
  for(const st of structures){
   if(st.building||fog&&!fog[st.t]||!animate&&st.type!=='sam')continue;
   const suppress=shelled[st.t]>tick,disabled=suppress||(['battery','shore','bertha','shield'].includes(st.type)&&st.hp<=0)||(st.type==='port'&&(st.level||1)>1&&st.gunHp<=0);
   const values=['sam','silo'].includes(st.type)?[st.cool||0]:[st.cool||0,st.flash||0,st.popAt||0,st.level||1,st.type==='satellite'&&st.owner===input.myId?input.satCool||0:0];
   const routine=['city','radar','lradar','jammer'].includes(st.type);
   const dispatch=(st.type==='airfield'&&departures.has(st.t))||(st.type==='engcmd'&&working.has(st.t));
   let weapon=weaponStates.get(st);if(!weapon){weapon={cool:st.cool||0,at:time,heading:-Math.PI/2,loadedAt:time,fired:false,lastSeen:tick,lastTime:time};weaponStates.set(st,weapon);}
   const shot=(st.cool||0)>weapon.cool&&tick-weapon.lastSeen<=1;const dt=Math.max(0,time-weapon.lastTime);weapon.cool=st.cool||0;weapon.lastSeen=tick;weapon.lastTime=time;
   if(shot){weapon.at=time;weapon.fired=true;}
   let samAge=3.8,projectile=true;
   if(st.type==='sam'){
    const x=st.t%W+.5,y=Math.floor(st.t/W)+.5;
    const candidates=[...(input.weaponMissiles||[]),...priorMissiles].filter(m=>m.owner!==st.owner&&(!fog||(()=>{const p=missilePosition(m,m.age,W);return p[0]>=0&&p[0]<W&&p[1]>=0&&p[1]<fog.length/W&&fog[Math.floor(p[1])*W+Math.floor(p[0])];})())&&(!shot||m.fired?.has(st.t)));
    const m=candidates.sort((a,b)=>Math.hypot(a.t%W-x,Math.floor(a.t/W)-y)-Math.hypot(b.t%W-x,Math.floor(b.t/W)-y))[0];
    if(m){const it=(input.weaponInterceptors||[]).find(it=>!it.ship&&it.owner===st.owner&&it.trail?.[0]&&Math.hypot(it.trail[0][0]-x,it.trail[0][1]-y)<.1);const pos=it?[it.x,it.y]:missilePosition(m,m.age,W);const heading=Math.atan2(pos[1]-y,pos[0]-x);const delta=Math.atan2(Math.sin(heading-weapon.heading),Math.cos(heading-weapon.heading));if(!paused)weapon.heading+=shot?delta:delta*(1-Math.exp(-18*dt));}
    const elapsed=time-weapon.at;
    if(weapon.fired&&elapsed<.7){samAge=4.2+elapsed*7;projectile=false;}
    else{if(weapon.fired){weapon.fired=false;weapon.loadedAt=time;}const loading=(time-weapon.loadedAt)*4;samAge=loading<1.8?loading:3.8;}
   }
   const state=tracker.observe(st,values),phase=(time+st.t*.071)%12;
   let age=st.type==='silo'?state.age*14:state.age;
   if(routine&&phase<2.5||dispatch||(st.type==='fort'&&st===selectedStructure))age=phase%2.5;
   if(st.type==='flightops'&&departures.size&&structures.some(q=>q.type==='airfield'&&q.owner===st.owner&&departures.has(q.t)))age=phase%2.5;
   if(st.type==='command'&&structures.some(q=>q.type==='silo'&&q.owner===st.owner&&(!fog||fog[q.t])&&q.cool>tick&&q.cool-tick>175&&Math.hypot(q.t%W-st.t%W,Math.floor(q.t/W)-Math.floor(st.t/W))<=45))age=phase%2.5;
   if(st.type==='troopcmd'&&transports.some(q=>q.visible&&q.source.owner===st.owner&&q.heavy))age=phase%2.5;
   if(disabled&&st.type!=='sam')continue;if(disabled){samAge=0;projectile=false;}
   const pop=st.popAt!=null&&tick-st.popAt<10?1+.35*(1-(tick-st.popAt)/10):1;
   draw(st.type,st,c.x+(st.t%W+.5)*c.s,c.y+(Math.floor(st.t/W)+.5)*c.s,Math.max(6,c.s*2.4)*pop/62,{age,samAge,heading:weapon.heading,projectile,shieldActive:st.type==='shield'?st.hp>0:st.lshield>0});
  }
  priorMissiles=[...(input.weaponMissiles||[])];
  if(!animate)return;
  const actor=(v,key,radius)=>{
   if(!v.visible||v.source?.done||v.source?.dead)return;const a=v.source||v,heading=v.heading||0;
   const state=tracker.observe(a,[a.cool||0,a.barCool||0,a.fireAt??0,a.type==='bomber'?-(a.bombs??0):0,a.type==='carrier'?-(a.troops??0):0],key==='truck'&&a.state==='work'||['transport','heavytransport','merchant'].includes(key)&&a.path&&a.path.length-a.pos<5);
   if(key==='carrier'&&state.age>=0&&state.age<2.5&&Number.isFinite(a.tx)&&Number.isFinite(a.ty)){
    const dx=c.x+a.tx*c.s,dy=c.y+a.ty*c.s;if(dx>=0&&dy>=0&&dx<=width&&dy<=height){ctx.save();ctx.strokeStyle='rgba(237,241,224,'+(1-state.age/2.5)+')';ctx.lineWidth=1;const r=Math.max(2,c.s*.5);for(let j=0;j<3;j++){const x=dx+(j-1)*c.s,y=dy+state.age*c.s;cPath(ctx,x,y,r);}ctx.restore();}
   }
   draw(key,a,c.x+v.x*c.s,c.y+v.y*c.s,radius,{heading,age:state.age,moving:a.path?a.pos<a.path.length-1:key==='truck'?a.state!=='work':true});
  };
  for(const v of warships){const k=v.cls;actor(v,k,Math.max(5,c.s*(k==='battleship'?4:k==='cruiser'?3.3:k==='scout'?2.1:k==='rship'?2.4:k==='privateer'?2.5:['sub','hunter'].includes(k)?2.3:2.8))/57);}
  for(const v of transports)actor(v,v.heavy?'heavytransport':'transport',Math.max(4,c.s*2)*(v.heavy?1.35:1)/57);
  for(const v of merchants)actor(v,'merchant',Math.max(3.5,c.s*1.7)/57);
  for(const v of aircraft)if(['out','patrol','run','return'].includes(v.state))actor(v,v.type,Math.max(10,c.s*(v.type==='fighter'?4.4:5.2))/(28*(v.type==='fighter'?4.4:5.2)));
  for(const v of planes)if(v.phase!=='down')actor(v,'spy',Math.max(10,c.s*5.2)/(28*5.2));
  for(const v of trucks)actor(v,'truck',Math.max(9,c.s*3.6)/(28*3.6));
 }
 return {render,reset:()=>{tracker.reset();weaponStates=new WeakMap();priorMissiles=[];lastTick=-1;},diagnostics:()=>({draws})};
}
