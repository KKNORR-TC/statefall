import * as portableMath from "../strict-math.mjs";
const noop=()=>{};

export function createMissilesSystem({
  W,H,engineState,settings,allowed,random,getMe,
  definitions,ships,shield,levelShield,cruise,
  constants,
  structures:structureOps,
  landCombat,
  diplomacy,
  visibility,
  mechanics,
  effects={}
}){
  const clock=engineState.clock,map=engineState.map;
  const {land,owner,struct,shelled}=map;
  const {players,missiles,structures,warships,interceptors}=engineState.actors;
  const idx=(x,y)=>y*W+x;
  const inb=(x,y)=>x>=0&&y>=0&&x<W&&y<H;
  const fail=effects.fail||noop,log=effects.log||noop,sound=effects.sound||noop;
  const incrementStat=effects.incrementStat||noop,flash=effects.flash||noop;
  const fragments=effects.fragments||noop,dudFragment=effects.dudFragment||noop,puff=effects.puff||noop,tracer=effects.tracer||noop;
  const wreck=effects.wreck||noop,floater=effects.floater||noop;
  const nuclearAlert=effects.nuclearAlert||noop,bigLoss=effects.bigLoss||noop;

  function siloReadyIn(p){ let best=1e9; for(const s of structures) if(s.owner===p.id&&s.type==='silo') best=Math.min(best,Math.max(0,(s.cool||0)-clock.tickN)); return best===1e9?0:best; }
  function silosReady(p,cmdOnly){ let n=0; for(const s of structures) if(s.owner===p.id&&s.type==='silo'&&!s.building&&!(s.cool>clock.tickN)&&(!cmdOnly||structureOps.commandCover(s.t)>0)) n++; return n; }
  function missileCost(p,silo){ const n=silo?structureOps.commandCover(silo.t):0; return Math.round(constants.nukeCost*(1-Math.min(constants.commandDiscountMax,n*constants.commandDiscount))); }
  function launchMissile(p,t,cmdOnly){ if(!cmdOnly&&mechanics.pausedBlock(p)) return false;
    if(!allowed.has('missile')||p.silos<1||!land[t]) return false;
    if(diplomacy.atPeace(p.id,owner[t])){ if(p===getMe()) fail(`You're at peace with ${players[owner[t]].name}.`); return false; }
    const readySilos=structures.filter(s=>s.owner===p.id&&s.type==='silo'&&!s.building&&!(s.cool>clock.tickN)&&(!cmdOnly||structureOps.commandCover(s.t)>0)).sort((a,b)=>missileCost(p,a)-missileCost(p,b));
    const silo=readySilos[0];
    if(!silo){ if(p===getMe()) log(`All silos reloading — next ready in ${Math.ceil((siloReadyIn(p))/10)}s.`,true); return false; }
    const cost=missileCost(p,silo); if(p.gold<cost) return false;
    p.gold-=cost; silo.cool=clock.tickN+constants.siloCooldown;
    if(p===getMe()) incrementStat('missiles'); missiles.push({owner:p.id,t,from:silo.t,age:0,flight:55}); sound(owner[t]===getMe().id?'missile_in':p===getMe()?'missile':'missile_other',silo.t%W,(silo.t-silo.t%W)/W); diplomacy.markHostile(p.id,owner[t]);
    log(`${p.name} launched a missile!`,true); return true;
  }
  function missilePos(m,age){
    const k=Math.min(1,age/m.flight),x0=m.from%W+.5,y0=(m.from-m.from%W)/W+.5,x1=m.t%W+.5,y1=(m.t-m.t%W)/W+.5;
    const h=m.cruise?0:portableMath.hypot(x1-x0,y1-y0)*0.35;
    return [x0+(x1-x0)*k,y0+(y1-y0)*k-portableMath.sin(k*Math.PI)*h];
  }
  function stepInterceptors(){
    for(const m of missiles){ if(m.done||m.age<constants.samReact||m.age>m.flight-8) continue;
      if(interceptors.some(it=>it.target===m&&!it.done)) continue;
      const tx=m.t%W,ty=(m.t-tx)/W; const [mx,my]=missilePos(m,m.age); let best=null,bd=1e12;
      const inRange=(x,y,R)=>((x-mx)**2+(y-my)**2<=R*R)||((x-tx)**2+(y-ty)**2<=R*R);
      const tow=owner[m.t]; const defends=id=>id===tow||(tow>=0&&diplomacy.relation(players[tow],players[id])?.type==='ally')||diplomacy.inConflict(id,m.owner);
      for(const st of structures){ if(st.type!=='sam'||st.building||st.owner===m.owner||st.cool>clock.tickN||shelled[st.t]>clock.tickN||diplomacy.atPeace(st.owner,m.owner)||!defends(st.owner)) continue; if(settings.fog&&st.owner===getMe().id&&!visibility.at(mx,my)) continue; if(m.fired&&m.fired.has(st.t)) continue;
        const sx=st.t%W+.5,sy=(st.t-st.t%W)/W+.5; if(!inRange(sx,sy,constants.samRange)) continue; const d=(sx-mx)**2+(sy-my)**2; if(d<bd){ bd=d; best={kind:'site',st,x:sx,y:sy,owner:st.owner,hit:constants.samHit,key:st.t}; } }
      warships.forEach((w,i)=>{ const S=ships[w.cls]; if(!S.sam||w.owner===m.owner||w.samCool>clock.tickN||w.hp<=0||diplomacy.atPeace(w.owner,m.owner)||!defends(w.owner)) return; if(settings.fog&&w.owner===getMe().id&&!visibility.at(mx,my)) return; if(m.fired&&m.fired.has('w'+i)) return;
        if(!inRange(w.x,w.y,S.sam)) return; const d=(w.x-mx)**2+(w.y-my)**2; if(d<bd){ bd=d; best={kind:'ship',w,S,x:w.x,y:w.y,owner:w.owner,hit:S.samHit,key:'w'+i}; } });
      if(!best) continue;
      if(m.cruise) best.hit=best.hit*cruise.samMul;
      (m.fired??=new Set()).add(best.key);
      if(best.kind==='site'){ best.st.cool=clock.tickN+constants.samCooldown; if(best.owner===getMe().id) log('SAM site launched an interceptor.',true); }
      else { best.w.samCool=clock.tickN+best.S.samCd; if(best.owner===getMe().id) log(`${best.S.label} launched an interceptor.`,true); }
      interceptors.push({owner:best.owner,target:m,x:best.x,y:best.y,trail:[],age:0,hit:best.hit,ship:best.kind==='ship'}); sound('interceptor');
    }
    for(const it of interceptors){
      it.age++; const m=it.target; if(m.done){ it.done=true; continue; }
      let mx,my; { let aimed=null; for(let k=1;k<=m.flight-m.age;k++){ const [px,py]=missilePos(m,m.age+k); if(portableMath.hypot(px-it.x,py-it.y)<=constants.interceptorSpeed*k){ aimed=[px,py]; break; } } if(!aimed) aimed=missilePos(m,m.age); [mx,my]=aimed; }
      const [cx2,cy2]=missilePos(m,m.age); const dx=mx-it.x,dy=my-it.y,d=portableMath.hypot(dx,dy); const dNow=portableMath.hypot(cx2-it.x,cy2-it.y);
      it.trail.push([it.x,it.y]); if(it.trail.length>10) it.trail.shift();
      if(dNow<=constants.interceptorSpeed*1.2||d<=constants.interceptorSpeed){ it.done=true; mx=cx2; my=cy2;
        if(random()<(it.hit??constants.samHit)){ m.done=true; m.intercepted=true; if(it.owner===getMe().id) incrementStat('intercepts'); flash({x:mx,y:my,r:4,age:0,col:'#9df'}); { const [nx2,ny2]=missilePos(m,m.age+1); fragments(mx,my,portableMath.atan2(ny2-my,nx2-mx),8,'#ffd27a'); puff(mx-.5,my-.5,4,'200,220,255'); } sound('intercept');
          log(`${players[it.owner].name}'s ${it.ship?'warship':'SAM site'} shot down ${players[m.owner].name}'s missile.`,it.owner===getMe().id||m.owner===getMe().id); }
        else { flash({x:it.x,y:it.y,r:1.5,age:0,col:'#9df'}); dudFragment({x:it.x,y:it.y,vx:dx/Math.max(1,d)*1.2,vy:dy/Math.max(1,d)*1.2+0.2,age:0,life:28,col:'#bfe6ff',dud:true}); }
        continue; }
      it.x+=dx/d*constants.interceptorSpeed; it.y+=dy/d*constants.interceptorSpeed;
    }
    engineState.retainActors('interceptors',i=>!i.done);
    engineState.retainActors('missiles',m=>!m.done);
  }
  function domeR(st){ return st.type==='shield'?shield.r:levelShield.r; }
  function domeHp(st){ return st.type==='shield'?st.hp:(st.lshield||0); }
  function domeMax(st){ return st.type==='shield'?shield.hp:levelShield.hp; }
  function isDome(st){ return !st.building&&((st.type==='shield'&&st.hp>0)||(st.type==='airfield'&&(st.level||1)>=2&&(st.lshield||0)>0)); }
  function hitDome(st,n,who){ if(st.type==='shield') st.hp-=n; else st.lshield=(st.lshield||0)-n; st.flash=clock.tickN+8; const own=players[st.owner];
    if(domeHp(st)<=0){ if(st.type==='shield'){ structureOps.destroyStructure(st.t); structureOps.structCounts(own); flash({x:st.t%W,y:(st.t-st.t%W)/W,r:6,age:0,col:'#9df'}); log(`${own.name}'s shield generator burned out.`,own===getMe()||who===getMe().id); if(own===getMe()) sound('pushback'); }
      else { st.lshield=0; wreck({kind:'dome',x:st.t%W+.5,y:(st.t-st.t%W)/W+.5,r:levelShield.r,age:0}); log(`${own.name}'s airfield shield is down.`,own===getMe()||who===getMe().id); } } }
  function domeFor(t,missileOwner){ const x=t%W,y=(t-x)/W; let best=null,bd=1e12; for(const st of structures){ if(!isDome(st)||diplomacy.atPeace(st.owner,missileOwner)||st.owner===missileOwner) continue; const r=domeR(st); const d=(st.t%W-x)**2+((st.t-st.t%W)/W-y)**2; if(d<=r*r&&d<bd){bd=d;best=st;} } return best; }
  function absorb(dome,m){ m.done=true; const [mx,my]=missilePos(m,m.age); flash({x:mx,y:my,r:5,age:0,col:'#9df'}); sound('intercept',mx,my); hitDome(dome,m.cruise?1:shield.hit,m.owner); log(`${players[dome.owner].name}'s shield absorbed ${players[m.owner].name}'s missile (${Math.max(0,domeHp(dome))}/${domeMax(dome)}).`,dome.owner===getMe().id||m.owner===getMe().id); }
  function stepShields(){
    for(const m of missiles){ if(m.done) continue; const dome=domeFor(m.t,m.owner); if(!dome) continue;
      const [mx,my]=missilePos(m,m.age); const dx=mx-(dome.t%W+.5),dy=my-((dome.t-dome.t%W)/W+.5);
      if(dx*dx+dy*dy>(domeR(dome)+1)**2) continue;
      absorb(dome,m);
    }
    engineState.retainActors('missiles',m=>!m.done);
    for(const st of structures){ if(!st.repairing) continue; if(st.flash&&st.flash+150>clock.tickN&&st.repairAt<clock.tickN+shield.repairTicks){ st.repairAt=clock.tickN+shield.repairTicks; continue; }
      if(st.repairAt<=clock.tickN){ if(st.type==='shield'){ st.hp=Math.min(shield.hp,st.hp+1); if(st.hp>=shield.hp){ st.repairing=false; if(st.owner===getMe().id) log('Shield generator fully repaired.',true); } else st.repairAt=clock.tickN+shield.repairTicks; } else if(st.type==='port'){ st.gunHp=Math.min(4,(st.gunHp||0)+1); if(st.gunHp>=4){ st.repairing=false; if(st.owner===getMe().id) log('Port guns repaired.',true); } else st.repairAt=clock.tickN+shield.repairTicks; } else { st.lshield=Math.min(levelShield.hp,(st.lshield||0)+1); if(st.lshield>=levelShield.hp){ st.repairing=false; if(st.owner===getMe().id) log('Airfield shield restored.',true); } else st.repairAt=clock.tickN+shield.repairTicks; } } }
  }
  function stepMissiles(){
    for(const m of missiles){
      m.age++;
      if(m.age<m.flight) continue;
      { const dome=domeFor(m.t,m.owner); if(dome){ absorb(dome,m); continue; } }
      m.done=true;
      if(m.cruise){ const cx=m.t%W,cy=(m.t-cx)/W; tracer(m.from%W+.5,(m.from-m.from%W)/W+.5,cx+.5,cy+.5,'255,200,120'); puff(cx,cy,4,'110,100,90'); crater(cx,cy,cruise.radius,m.owner,{flat:40,pct:0.006,cap:120}); sound('bomb',cx,cy); continue; }
      const tx=m.t%W,ty=(m.t-tx)/W,victim=owner[m.t];
      flash({x:tx,y:ty,r:constants.nukeRadius,age:0,col:'#ffb347'}); sound(victim===getMe().id||m.owner===getMe().id?'impact':'impact_other',tx,ty);
      if(victim>=0) mechanics.noteThreat(victim,m.t,'missile',m.owner);
      if(victim===getMe().id&&m.owner!==getMe().id) nuclearAlert(m,tx,ty);
      const domes=structures.filter(st=>isDome(st)&&st.owner!==m.owner&&!diplomacy.atPeace(st.owner,m.owner)&&((st.t%W-tx)**2+((st.t-st.t%W)/W-ty)**2)<(constants.nukeRadius+domeR(st))**2);
      const underDome=(x,y)=>domes.some(dm=>(dm.t%W-x)**2+((dm.t-dm.t%W)/W-y)**2<=domeR(dm)*domeR(dm));
      for(const dm of domes) log(`${players[dm.owner].name}'s shield held against the blast (${Math.max(0,domeHp(dm)-shield.hit)}/${domeMax(dm)}).`,dm.owner===getMe().id||m.owner===getMe().id);
      const lost={};
      for(let y=ty-constants.nukeRadius;y<=ty+constants.nukeRadius;y++)for(let x=tx-constants.nukeRadius;x<=tx+constants.nukeRadius;x++){
        if(!inb(x,y)||(x-tx)**2+(y-ty)**2>constants.nukeRadius**2) continue;
        const t=idx(x,y); if(!land[t]) continue;
        if(underDome(x,y)) continue;
        if(struct[t]) structureOps.destroyStructure(t);
        const o=owner[t]; if(o>=0){ lost[o]=(lost[o]||0)+1; landCombat.setOwner(t,-1); }
      }
      for(const dm of domes) if(structures.includes(dm)) hitDome(dm,shield.hit,m.owner);
      for(const o in lost){ const q=players[o]; const area=landCombat.areaAt(m.t); const pool=landCombat.gOn(q)?((area&&area.owner===q.id)?area.troops:(q.areas&&q.areas[0]?q.areas[0].troops:q.troops)):q.troops; const dloc=landCombat.gOn(q)?landCombat.densityAt(q,m.t):landCombat.density(q); const kn=Math.min(lost[o]*dloc*1.0,pool);
        if(landCombat.gOn(q)) landCombat.loseTroopsAt(q,m.t,kn); else q.troops=Math.max(0,q.troops-kn); if(q===getMe()) bigLoss(kn,players[m.owner]); if(q===getMe()||m.owner===getMe().id) log(`Missile killed ${Math.round(kn)} ${q.name} troops.`,true); structureOps.structCounts(q);
        if(q.tiles<=0&&q.alive){q.alive=false;log(`${q.name} was annihilated.`,true);mechanics.seizeTreasury(players[m.owner],q);} }
      log(`Missile struck ${victim>=0?players[victim].name:'open land'}.`,victim===getMe().id);
    }
    engineState.retainActors('missiles',m=>!m.done);
  }
  function missileCommand(){
    if(clock.tickN%15) return;
    for(const p of players){ if(!p.alive||p.kind==='neutral'||!(p.commands>0)||p.autoFire===false) continue;
      if(silosReady(p,true)<1) continue;
      let foes; if(p.cmdFocus!=null){ const f=players[p.cmdFocus]; if(!f||!f.alive||diplomacy.atPeace(p.id,f.id)){ p.cmdFocus=null; foes=[]; } else foes=[f]; }
      else foes=players.filter(q=>q.alive&&q!==p&&q.kind!=='neutral'&&diplomacy.inConflict(p.id,q.id));
      if(!foes.length) continue;
      const foeIds=new Set(foes.map(q=>q.id));
      let obj=p.cmdTarget; if(obj&&(!structures.includes(obj)||!foeIds.has(obj.owner)||(p===getMe()&&visibility.hidden(obj.t)))) obj=null;
      if(!obj){ let bs=0; const fx=p.cmdFocusT!=null?p.cmdFocusT%W:null,fy=p.cmdFocusT!=null?(p.cmdFocusT-fx)/W:null;
        const nearFocus=st=>fx==null||((st.t%W-fx)**2+((st.t-st.t%W)/W-fy)**2)<=3600; const anyNear=fx!=null&&structures.some(st=>foeIds.has(st.owner)&&nearFocus(st)&&!(p===getMe()&&visibility.hidden(st.t)));
        for(const st of structures){ if(!foeIds.has(st.owner)) continue; if(p===getMe()&&visibility.hidden(st.t)) continue; if(anyNear&&!nearFocus(st)) continue;
          let sc={sam:5,silo:6,command:7,bertha:7,shield:5,airfield:7,flightops:6,battery:4,shore:2,city:4,port:3,factory:2,fort:1}[st.type]||1; if(st.type==='sam'&&shelled[st.t]>clock.tickN) sc=8; if(st.building) sc*=0.6;
          let cover=0; const x=st.t%W,y=(st.t-x)/W; for(const q of structures){ if(q.type!=='sam'||q.building||q.owner!==st.owner||shelled[q.t]>clock.tickN) continue; if((q.t%W-x)**2+((q.t-q.t%W)/W-y)**2<=constants.samRange*constants.samRange) cover++; }
          sc/=1+cover*0.7; sc*=0.85+random()*0.3; if(sc>bs){bs=sc;obj=st;} }
        p.cmdTarget=obj; if(obj&&p===getMe()) log(`Missile command: new objective, ${players[obj.owner].name}'s ${definitions[obj.type].label.toLowerCase()}.`,true); }
      if(!obj) continue;
      const dome=obj.type==='shield'?null:domeFor(obj.t,p.id); if(dome){ const needM=Math.ceil(dome.hp/shield.hit); if(silosReady(p,true)<Math.min(needM,Math.max(1,p.silos))||p.gold<needM*constants.nukeCost*0.6+constants.commandReserve){ if(p===getMe()&&p.cmdWait!==dome){ p.cmdWait=dome; log(`Missile command: target is under a shield (${dome.hp} hp, ${needM} missiles to break) — holding until the salvo is affordable.`,true); } continue; } }
      const cover=obj.type==='sam'?null:structureOps.coveringSam(obj); if(cover&&p===getMe()&&visibility.hidden(cover.t)){ if(p.cmdWait!==cover){ p.cmdWait=cover; log(`Missile command: ${players[obj.owner].name}'s target is under a SAM site you can't see — get eyes on it first.`,true); } continue; } const aim=cover||obj;
      const inflight=missiles.filter(m=>!m.done&&m.owner===p.id&&m.t===aim.t).length;
      if(aim.type!=='sam'&&!domeFor(aim.t,p.id)){
        if(inflight>0) continue;
        if(launchMissile(p,aim.t,true)&&p===getMe()) log(`Missile command fired at ${players[aim.owner].name}'s ${definitions[aim.type].label.toLowerCase()}.`,true);
        continue; }
      if(inflight>0) continue;
      const dm=domeFor(aim.t,p.id); const domeNeed=dm?Math.ceil(dm.hp/shield.hit):0;
      const ax=aim.t%W,ay=(aim.t-ax)/W; let cov=0; for(const q of structures){ if(q.type!=='sam'||q.building||q.owner!==aim.owner||shelled[q.t]>clock.tickN||(p===getMe()&&visibility.hidden(q.t))) continue; if((q.t%W-ax)**2+((q.t-q.t%W)/W-ay)**2<=constants.samRange*constants.samRange) cov++; }
      const ctrl=structures.filter(q=>q.owner===p.id&&q.type==='silo'&&!q.building&&structureOps.commandCover(q.t)>0).length;
      const need=Math.min(2*cov+1+domeNeed,Math.max(1,ctrl));
      const ready=silosReady(p,true); if(ready<need||p.gold<need*constants.nukeCost+constants.commandReserve){ if(p===getMe()&&p.cmdWait!==aim){ p.cmdWait=aim; log(`Missile command: need a ${need}-missile salvo for ${players[aim.owner].name}'s SAM site — ${ready} of ${need} silos ready.`,true); } continue; }
      p.cmdWait=null; let fired=0; for(let i=0;i<need;i++) if(launchMissile(p,aim.t,true)) fired++;
      if(fired&&p===getMe()) log(`Missile command: ${fired}-missile salvo at ${players[aim.owner].name}'s SAM site${cover?' (clearing the way)':''}.`,true);
    }
  }
  function crater(cx,cy,r,by,opt,spare){
    flash({x:cx,y:cy,r:r+1,age:0,col:'#ffb347'}); const lost={}; if(owner[idx(cx,cy)]>=0) diplomacy.markHostile(by,owner[idx(cx,cy)]);
    const R2=r+constants.suppressRing; for(let y=cy-R2;y<=cy+R2;y++)for(let x=cx-R2;x<=cx+R2;x++){ if(inb(x,y)&&(x-cx)**2+(y-cy)**2<=R2*R2&&land[idx(x,y)]) shelled[idx(x,y)]=clock.tickN+constants.suppressTicks; }
    for(let y=cy-r;y<=cy+r;y++)for(let x=cx-r;x<=cx+r;x++){ if(!inb(x,y)||(x-cx)**2+(y-cy)**2>r*r) continue; const t=idx(x,y); if(!land[t]) continue;
      const oo=owner[t]; if(spare!=null&&oo>=0&&(oo===spare||diplomacy.atPeace(spare,oo))) continue;
      if(struct[t]){ const st=structures.find(q=>q.t===t); if(st&&(st.level||1)>=2){ st.level=1; st.lshield=0; if(st.owner===getMe().id) log(`${definitions[st.type].label} knocked back to level I by bombardment.`,true); } else { structureOps.destroyStructure(t); if(st) structureOps.structCounts(players[st.owner]); } }
      const o=owner[t]; if(spare!=null&&o>=0&&(o===spare||diplomacy.atPeace(spare,o))) continue; if(o>=0&&o!==by&&!struct[t]){ lost[o]=(lost[o]||0)+1; landCombat.setOwner(t,-1); } }
    let cas=0;
    for(const o in lost){ const q=players[o];
      const area=landCombat.areaAt(idx(cx,cy)); const poolB=landCombat.gOn(q)?((area&&area.owner===q.id)?area.troops:q.troops):q.troops; const dB=landCombat.gOn(q)?landCombat.densityAt(q,idx(cx,cy)):landCombat.density(q);
      const kill=Math.min(lost[o]*dB*1.0,poolB)+Math.min(opt?opt.cap:constants.barrageKillCap,(opt?opt.flat:constants.barrageKillFlat)+q.troops*(opt?opt.pct:constants.barrageKillPct));
      const k=Math.min(q.troops,kill); if(landCombat.gOn(q)) landCombat.loseTroopsAt(q,idx(cx,cy),k); else q.troops-=k; cas+=k; floater({x:cx,y:cy,txt:'-'+Math.round(k),age:0,col:'#ff9a9a'});
      if(q.kind==='neutral') q.grudge[by]=clock.tickN; if(q.tiles<=0&&q.alive){ q.alive=false; log(`${q.name} was bombarded into oblivion.`,true); mechanics.seizeTreasury(players[by],q); } if(q===getMe()) sound('invaded'); }
    if(Object.keys(lost).length&&(by===getMe().id||lost[getMe().id])) sound('shellhit');
    return cas;
  }

  return Object.freeze({siloReadyIn,silosReady,missileCost,launchMissile,missilePos,stepInterceptors,domeR,domeHp,domeMax,isDome,hitDome,domeFor,stepShields,stepMissiles,missileCommand,crater});
}
