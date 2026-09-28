const noop=()=>{};

export function createStructuresSystem({
  W,H,engineState,settings,allowed,getMe,botBuildDelay,
  definitions,buildTicks,upgrades,guns,shield,levelShield,
  constants,
  ownership,
  mechanics,
  queuedShipPath,
  launchQueuedShip,
  effects={}
}){
  const clock=engineState.clock,map=engineState.map;
  const {land,owner,struct,structOwner,shelled}=map;
  const {players,structures,links}=engineState.actors;
  const idx=(x,y)=>y*W+x;
  const inb=(x,y)=>x>=0&&y>=0&&x<W&&y<H;
  const fail=effects.fail||noop,log=effects.log||noop,sound=effects.sound||noop;
  const incrementStat=effects.incrementStat||noop,puff=effects.puff||noop;
  const scorch=effects.scorch||noop,flash=effects.flash||noop,wreck=effects.wreck||noop;

  function structAtT(t){ return structures.find(s=>s.t===t); }
  function fortRange(st){ return (st.level||1)>=3?32:(st.level||1)>=2?24:constants.fortRange; }
  function fortStack(t,id){ const x=t%W,y=(t-x)/W; let n=0; for(const st of structures){ if(st.type!=='fort'||st.building||st.owner!==id) continue; const r=fortRange(st); if((st.t%W-x)**2+((st.t-st.t%W)/W-y)**2<=r*r){ n++; if(n>=6) break; } } return n; }
  // Valid for one synchronous combat pass: forts can be destroyed, but none are built mid-pass.
  function combatFortQuery(){
    const forts=structures.filter(st=>st.type==='fort'&&!st.building);
    return (t,id)=>{ const x=t%W,y=(t-x)/W; let n=0; for(const st of forts){
      if(st.owner!==id||!struct[st.t]) continue;
      const r=fortRange(st); if((st.t%W-x)**2+((st.t-st.t%W)/W-y)**2<=r*r){ n++; if(n>=6) break; }
    } return n; };
  }
  function fortMult(t,id){ const n=fortStack(t,id); return n?Math.min(64,Math.pow(2,n)):1; }
  function fortified(t,id){ return fortStack(t,id)>0; }
  function commandCover(t){ const x=t%W,y=(t-x)/W; let n=0; for(const c of structures){ if(c.type!=='command'||c.building) continue; if(c.owner!==structOwner[t]&&c.owner!==owner[t]) continue; if((c.t%W-x)**2+((c.t-c.t%W)/W-y)**2<=constants.commandRange*constants.commandRange) n++; } return n; }
  function coveringSam(st){ const x=st.t%W,y=(st.t-x)/W; let best=null,bd=1e12; for(const q of structures){ if(q.type!=='sam'||q.building||q.owner!==st.owner||shelled[q.t]>clock.tickN) continue; const d=(q.t%W-x)**2+((q.t-q.t%W)/W-y)**2; if(d<=constants.samRange*constants.samRange&&d<bd){bd=d;best=q;} } return best; }
  function repairNeed(st){ if(st.building) return 0; if(st.type==='shield') return shield.hp-st.hp; if(st.type==='airfield'&&(st.level||1)>=2) return levelShield.hp-(st.lshield||0); if(st.type==='port'&&(st.level||1)>=2) return 4-(st.gunHp||0); if(guns[st.type]&&st.hp!=null) return guns[st.type].hp-st.hp; return 0; }
  function repairOne(st){ if(st.type==='shield') st.hp++; else if(st.type==='airfield') st.lshield=(st.lshield||0)+1; else if(st.type==='port') st.gunHp=(st.gunHp||0)+1; else st.hp++; }

  function rebuildLinks(){
    links.length=0; const load=new Map();
    const hubs=structures.filter(st=>(st.type==='city'||st.type==='port')&&!st.building), facs=structures.filter(st=>st.type==='factory'&&!st.building);
    for(const st of structures){ st.links=0; }
    for(const f of facs){ const fx=f.t%W,fy=(f.t-fx)/W; const cands=[];
      for(const h of hubs){ if(h.owner!==f.owner) continue; const hx=h.t%W,hy=(h.t-hx)/W; const d=(hx-fx)**2+(hy-fy)**2; if(d<=constants.linkRange*constants.linkRange) cands.push([d,h]); }
      cands.sort((u,v)=>u[0]-v[0]);
      for(const [,h] of cands){ if(f.links>=constants.linkMaxPerFactory) break; const cap=h.type==='city'?constants.linkMaxPerCity:constants.linkMaxPerPort; if((load.get(h)||0)>=cap) continue;
        links.push({a:f,b:h,owner:f.owner}); load.set(h,(load.get(h)||0)+1); f.links++; h.links++; } }
    for(const p of players){ p.factoryLinks=0; p.cityLinks=0; p.portLinks=0; }
    for(const l of links){ const p=players[l.owner]; p.factoryLinks+=1; if(l.b.type==='city') p.cityLinks++; else p.portLinks++; }
    for(const st of structures) st.linked=st.links>0;
  }
  function structCounts(p){ p.cities=p.factories=p.ports=p.sams=p.silos=p.forts=p.commands=p.troopcmds=0;
    for(const s of structures) if(s.owner===p.id&&!s.building){ if(s.type==='city')p.cities++; else if(s.type==='factory')p.factories++; else if(s.type==='port')p.ports++; else if(s.type==='sam')p.sams++; else if(s.type==='silo')p.silos++; else if(s.type==='fort')p.forts++; else if(s.type==='command')p.commands++; else if(s.type==='troopcmd')p.troopcmds++; } }
  function crowded(t){ const x=t%W,y=(t-x)/W; for(const st of structures){ const dx=st.t%W-x, dy=(st.t-st.t%W)/W-y; if(dx*dx+dy*dy<constants.structSpacing*constants.structSpacing) return true; } return false; }
  function snapBuild(p,t,type,R=5){ const S=definitions[type]; const ok=c=>land[c]&&owner[c]===p.id&&!struct[c]&&!crowded(c)&&(!S.coast||ownership.isCoast(c)); if(ok(t)) return t; const x=t%W,y=(t-x)/W; let best=-1,bd=1e9; for(let dy=-R;dy<=R;dy++)for(let dx=-R;dx<=R;dx++){ const X=x+dx,Y=y+dy; if(!inb(X,Y)) continue; const c=idx(X,Y); if(!ok(c)) continue; const d=dx*dx+dy*dy; if(d<bd){bd=d;best=c;} } return best; }
  function snapToCoast(p,t,R=5){ if(ownership.isCoast(t)&&owner[t]===p.id&&!struct[t]) return t; const x=t%W,y=(t-x)/W; let best=-1,bd=1e9; for(let dy=-R;dy<=R;dy++)for(let dx=-R;dx<=R;dx++){ const X=x+dx,Y=y+dy; if(!inb(X,Y)) continue; const c=idx(X,Y); if(!land[c]||owner[c]!==p.id||struct[c]||!ownership.isCoast(c)||crowded(c)) continue; const d=dx*dx+dy*dy; if(d<bd){bd=d;best=c;} } return best; }
  function industrialNear(p,t){ const x=t%W,y=(t-x)/W; for(const c of structures){ if(c.type!=='city'||c.owner!==p.id||c.building||(c.links||0)<3) continue; if((c.t%W-x)**2+((c.t-c.t%W)/W-y)**2<=constants.linkRange*constants.linkRange) return true; } return false; }
  function structCost(p,type){ const base=definitions[type].cost; if(type==='fort'){ const n=structures.filter(st=>st.type==='fort'&&st.owner===p.id).length; return base+40*n; } return base; }
  function addStructure(st){ structures.push(st); struct[st.t]=1; structOwner[st.t]=st.owner; return st; }
  function clearStructures(){ structures.length=0; struct.fill(0); structOwner.fill(-1); }
  function placeStructure(p,type,t){ if(mechanics.pausedBlock(p)) return false; if(p.kind==='bot'){ if(p.nextBuildAt>clock.simMs) return false; }
    const S=definitions[type]; if(!allowed.has(type)) return false;
    { const c=snapBuild(p,t,type); if(c<0) return false; t=c; }
    if(type==='subbase'){ const ok=structures.some(st=>st.type==='port'&&(st.level||1)>=2&&!st.building&&st.owner===p.id&&((st.t%W-t%W)**2+((st.t-st.t%W)/W-(t-t%W)/W)**2)<=constants.linkRange*constants.linkRange); if(!ok){ if(p===getMe()) fail('Submarine bases need a level II port within 34 tiles.'); return false; } }
    const cost=structCost(p,type); if(owner[t]!==p.id||struct[t]||crowded(t)) return false; if(p.gold<cost){ if(p===getMe()) fail(`Not enough gold — ${definitions[type].label.toLowerCase()} costs ${cost}.`); return false; }
    if(S.coast&&!ownership.isCoast(t)) return false;
    p.gold-=cost; struct[t]=1; structOwner[t]=p.id;
    let ticks=(settings.instant&&type!=='shield')?0:(buildTicks[type]||0); if(ticks&&industrialNear(p,t)) ticks=Math.round(ticks*0.75);
    if(p===getMe()) incrementStat('built'); if(p.kind==='bot') p.nextBuildAt=clock.simMs+botBuildDelay(p);
    const st={type,owner:p.id,t,cost,building:ticks>0,done:clock.tickN+ticks,total:ticks}; if(guns[type]) st.hp=guns[type].hp; if(type==='shield') st.hp=shield.hp; structures.push(st); structCounts(p);
    if(p===getMe()) sound(type==='city'?'city':'build');
    if(st.building&&p===getMe()) log(`${S.label} under construction — ${Math.ceil(ticks/10)} s.`,true);
    if(type==='city'){ if(mechanics.garrisonOn(p)) mechanics.addTroopsAt(p,t,constants.cityPop); else p.troops+=constants.cityPop; if(p===getMe()) log(`New city: ${constants.cityPop} citizens joined the army.`,true); }
    return true;
  }
  function destroyStructure(t){ const st=structAtT(t); engineState.retainActors('structures',s=>s.t!==t); struct[t]=0; structOwner[t]=-1; if(st){ puff(t%W,(t-t%W)/W,6,'90,90,90'); scorch(t%W+.5,(t-t%W)/W+.5,st.type==='shield'?5:3.5); if(st.type==='shield'||(st.type==='airfield'&&(st.level||1)>=2)) wreck({kind:'dome',x:t%W+.5,y:(t-t%W)/W+.5,r:mechanics.domeRadius(st),age:0}); } return st; }
  function captureStructure(t,p){
    const s=structAtT(t); if(!s) return; puff(t%W,(t-t%W)/W,3,'200,200,200');
    if(s.type==='fort'||s.type==='shore'||s.type==='battery'||s.type==='shield'){ const old=players[s.owner]; destroyStructure(t); structCounts(old); flash({x:t%W,y:(t-t%W)/W,r:3,age:0,col:'#ffb347'}); if(p===getMe()||old===getMe()) log(`${p.name} overran ${old.name}'s bastion.`,true); return; }
    const old=players[s.owner]; s.owner=p.id; structOwner[t]=p.id; structCounts(old); structCounts(p);
    if(p===getMe()) log(`Captured a ${definitions[s.type].label.toLowerCase()} from ${old.name}.`,true);
  }
  function upgradeStructure(p,st){ if(mechanics.pausedBlock(p)) return false; if(p.kind==='bot'){ if(p.nextBuildAt>clock.simMs) return false; p.nextBuildAt=clock.simMs+botBuildDelay(p); } const U=upgrades[st.type]; if(!U||st.building||st.upgrading||(st.level||1)>=(U.max||2)||st.owner!==p.id) return false; const lvl=(st.level||1); const cost=lvl>=2?(U.cost3||U.cost):U.cost, ticksU=lvl>=2?(U.ticks3||U.ticks):U.ticks; if(p.gold<cost){ if(p===getMe()) fail('Not enough gold for the upgrade.'); return false; }
    p.gold-=cost; const ticks=ticksU; st.upTo=lvl+1; st.upgrading=true; st.upDone=clock.tickN+ticks; st.upTotal=ticks; if(p===getMe()){ log(`${definitions[st.type].label} upgrading to level ${st.upTo===3?'III':'II'} — ${Math.ceil(ticks/10)} s.`,true); sound('build'); } return true; }
  function finishUpgrades(){ for(const st of structures){ if(!st.upgrading||st.upDone>clock.tickN) continue; st.upgrading=false; st.level=st.upTo||2; st.popAt=clock.tickN; if(st.type==='airfield') st.lshield=levelShield.hp; if(st.type==='port') st.gunHp=4; if(st.owner===getMe().id){ log(`${definitions[st.type].label} is now level ${st.level>=3?'III':'II'}.`,true); sound('unified'); } } }
  function enqueue(st,job){ st.queue=st.queue||[]; const idle=st.queue.length===0; st.queue.push({...job,done:idle?clock.tickN+job.total:0}); return st.queue.length; }
  function cancelQueued(st){ if(!st||!st.queue||!st.queue.length) return null; const job=st.queue.shift(); if(st.queue.length) st.queue[0].done=clock.tickN+st.queue[0].total; return job; }
  function stepBuild(){ finishUpgrades();
    for(const st of structures){ if(st.building&&st.done<=clock.tickN){ st.building=false; st.popAt=clock.tickN; const p=players[st.owner]; structCounts(p); if(p===getMe()){ log(`${definitions[st.type].label} completed.`,true); sound('build'); } }
      if((st.type==='port'||st.type==='subbase')&&st.queue&&st.queue.length&&!st.building){ const job=st.queue[0]; if(job.done<=clock.tickN){ st.queue.shift(); const p=players[st.owner]; if(!p.alive) continue;
        const path=queuedShipPath(st,job); if(path){ st.popAt=clock.tickN; if(p===getMe()) incrementStat('shipsBuilt'); launchQueuedShip(st,job,p,path); if(p===getMe()){ log(`${mechanics.shipLabel(job.cls)} launched.`,true); sound('foghorn'); } }
        if(st.queue.length){ st.queue[0].done=clock.tickN+st.queue[0].total; } } }
    }
  }

  return Object.freeze({structAtT,fortRange,fortStack,combatFortQuery,fortMult,fortified,commandCover,coveringSam,repairNeed,repairOne,rebuildLinks,structCounts,crowded,snapBuild,snapToCoast,industrialNear,structCost,addStructure,clearStructures,placeStructure,captureStructure,destroyStructure,upgradeStructure,finishUpgrades,enqueue,cancelQueued,stepBuild});
}
