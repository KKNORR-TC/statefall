const noop=()=>{};

export function createAirSystem({
  W,H,engineState,settings,random,getMe,constants,
  diplomacy,
  missiles,
  landCombat,
  structureOps,
  fog,
  mechanics,
  ai,
  effects={}
}){
  const clock=engineState.clock,map=engineState.map;
  const {land,owner,struct}=map;
  const {players,attacks,structures,aircraft}=engineState.actors;
  const idx=(x,y)=>y*W+x;
  const inb=(x,y)=>x>=0&&y>=0&&x<W&&y<H;
  const fail=effects.fail||noop,log=effects.log||noop,sound=effects.sound||noop;
  const incrementStat=effects.incrementStat||noop,flash=effects.flash||noop;
  const fragment=effects.fragment||noop,wreck=effects.wreck||noop,addShell=effects.addShell||noop;

  function airfieldsOf(p){ return structures.filter(st=>st.type==='airfield'&&!st.building&&st.owner===p.id); }
  function hangarMax(st){ return (st.level||1)>=2?6:constants.hangar; }
  function hangarCount(st){ return aircraft.filter(a=>a.home===st).length+(st.aq?st.aq.length:0); }
  function buyAircraft(p,st,type){ if(mechanics.pausedBlock(p)) return false; if(p.kind==='bot'){ if(p.nextBuildAt>clock.simMs) return false; p.nextBuildAt=clock.simMs+ai.botBuildDelay(p); } const A=constants[type]; if(!st||st.building||st.type!=='airfield'||st.owner!==p.id) return false; if(hangarCount(st)>=hangarMax(st)||p.gold<A.cost) return false; if(type==='carrier'&&(st.level||1)<2){ if(p===getMe()) fail('Troop transports need a level II airfield.'); return false; }
    p.gold-=A.cost; st.aq=st.aq||[]; const ticks=settings.instant?0:A.build; st.aq.push({type,done:clock.tickN+ticks,total:ticks}); if(p===getMe()){ log(`${type==='fighter'?'Stealth fighter':type==='carrier'?'Stealth troop transport':'Stealth bomber'} ordered — ${Math.ceil(ticks/10)} s.`,true); sound('build'); } return true; }
  function spawnAircraft(st,type){ if(st.owner===getMe().id) incrementStat('planesBuilt'); const x=st.t%W+.5,y=(st.t-st.t%W)/W+.5; const a={id:engineState.nextUid(),owner:st.owner,type,home:st,state:'hangar',x,y,hdg:0,hp:type==='fighter'?constants.fighter.hp:1,until:0}; aircraft.push(a); return a; }
  function idleAircraft(p,type,t){ const x=t%W,y=(t-x)/W; return aircraft.filter(a=>a.owner===p.id&&a.type===type&&a.state==='hangar'&&structures.includes(a.home)&&Math.hypot(a.home.t%W-x,(a.home.t-a.home.t%W)/W-y)<=constants[type].range).sort((a,b)=>Math.hypot(a.x-x,a.y-y)-Math.hypot(b.x-x,b.y-y))[0]; }
  function launchFighter(p,t){ if(mechanics.pausedBlock(p)) return false; const a=idleAircraft(p,'fighter',t); if(!a){ if(p===getMe()) fail('No fighter ready within range of that point.'); return false; } a.state='out'; a.tx=t%W+.5; a.ty=(t-t%W)/W+.5; a.until=0; if(p===getMe()){ log('Fighter patrol launched.',true); sound('jet'); } return true; }
  function launchParadrop(p,t,troops){ if(mechanics.pausedBlock(p)) return false; const a=idleAircraft(p,'carrier',t); if(!a){ if(p===getMe()) fail('No troop transport ready within range of that point.'); return false; }
    const origin=landCombat.gOn(p)?(landCombat.areaAt(a.home.t)||p.areas[0]):null; troops=Math.min(troops,constants.carrier.capacity,origin?origin.troops:p.troops); if(troops<10){ if(p===getMe()) fail('Not enough troops to load.'); return false; }
    const o=owner[t]; if(o>=0&&diplomacy.atPeace(p.id,o)&&o!==p.id){ if(p===getMe()) fail(`You're at peace with ${players[o].name}.`); return false; }
    a.troops=landCombat.takeTroopsFrom(p,origin,troops); if(p===getMe()) incrementStat('paradrops'); a.state='out'; a.tx=t%W+.5; a.ty=(t-t%W)/W+.5; a.dropT=t; if(p===getMe()){ log(`Troop transport airborne with ${Math.round(a.troops)} troops.`,true); sound('jet'); } return true; }
  function launchBomber(p,t){ if(mechanics.pausedBlock(p)) return false; const a=idleAircraft(p,'bomber',t); if(!a){ if(p===getMe()) fail('No bomber ready within range of that point.'); return false; } a.state='out'; a.runHdg=random()*Math.PI*2; const half=constants.bomber.bombs*constants.bomber.spacing/2; a.tx=t%W+.5-Math.cos(a.runHdg)*half; a.ty=(t-t%W)/W+.5-Math.sin(a.runHdg)*half; a.bombs=constants.bomber.bombs; a.dropAt=constants.bomber.spacing; a.runLen=0; if(p===getMe()){ log('Bomber launched.',true); sound('jet'); } return true; }
  function recallAircraft(a){ if(!['out','patrol','run'].includes(a.state)) return false; a.state='return'; if(a.owner===getMe().id) log(`${a.type==='fighter'?'Fighter':'Bomber'} recalled.`,true); return true; }
  function fly(a,tx,ty,sp){ const dx=tx-a.x,dy=ty-a.y,d=Math.hypot(dx,dy); if(d<=sp){ a.x=tx; a.y=ty; return true; } a.x+=dx/d*sp; a.y+=dy/d*sp; a.hdg=Math.atan2(dy,dx); return false; }
  function enemyPatrolAt(x,y,aircraftOwner){ return aircraft.filter(f=>f.type==='fighter'&&f.state==='patrol'&&f.owner!==aircraftOwner&&!diplomacy.atPeace(f.owner,aircraftOwner)&&Math.hypot(f.tx-x,f.ty-y)<=constants.fighter.patrol); }
  function bomb(a,x,y){ const cx=Math.floor(x),cy=Math.floor(y); if(!inb(cx,cy)) return false; if(a.owner===getMe().id) incrementStat('bombs'); const o0=owner[idx(cx,cy)]; if(o0===a.owner||(o0>=0&&diplomacy.atPeace(a.owner,o0))) return false;
    const dome=missiles.domeFor(idx(cx,cy),a.owner);
    if(dome){ flash({x:cx,y:cy,r:2,age:0,col:'#9df'}); missiles.hitDome(dome,1,a.owner); return; }
    const t=idx(cx,cy); const st=struct[t]?structures.find(q=>q.t===t):null; const bunker=st&&(st.type==='bertha'||st.type==='battery'||st.type==='shield'||st.type==='silo')&&random()<0.3;
    if(bunker){ flash({x:cx,y:cy,r:2,age:0,col:'#ffb347'}); return; }
    missiles.crater(cx,cy,constants.bomber.radius,a.owner,{flat:10,pct:0.004,cap:60},a.owner); if(owner[t]>=0) mechanics.noteThreat(owner[t],t,'bomb',a.owner); if(a.owner===getMe().id||owner[t]===getMe().id) sound('bomb',cx,cy); return true; }
  function stepAir(){
    for(const st of structures){ if(st.type!=='airfield'||st.building||!st.aq||!st.aq.length) continue; const job=st.aq[0]; if(job.done<=clock.tickN){ st.aq.shift(); spawnAircraft(st,job.type); if(st.owner===getMe().id) log(`${job.type==='fighter'?'Stealth fighter':job.type==='carrier'?'Stealth troop transport':'Stealth bomber'} ready at the airfield.`,true); } }
    for(const a of aircraft){
      if(!structures.includes(a.home)){ a.dead=true; continue; }
      const F=constants[a.type]; const hx=a.home.t%W+.5, hy=(a.home.t-a.home.t%W)/W+.5;
      if(a.type==='fighter'){
        if(a.state==='out'){ if(fly(a,a.tx,a.ty,F.speed)){ a.state='patrol'; a.until=clock.tickN+F.endurance; a.ang=0; if(a.owner===getMe().id) log('Fighter on patrol.',true); } }
        else if(a.state==='patrol'){ a.ang=(a.ang||0)+0.028+0.012*Math.sin((a.ang||0)*2); const jink=(a.hitAt&&clock.tickN-a.hitAt<40)?Math.sin(clock.tickN*0.6)*4:0; const ex=F.patrol*0.75, ey=F.patrol*0.45; const rot=a.rot??(a.rot=random()*Math.PI); const lx=Math.cos(a.ang)*ex, ly=Math.sin(a.ang)*ey; a.x=a.tx+lx*Math.cos(rot)-ly*Math.sin(rot)+jink; a.y=a.ty+lx*Math.sin(rot)+ly*Math.cos(rot); a.hdg=Math.atan2(a.y-(a.py??a.y),a.x-(a.px??a.x)); a.px=a.x; a.py=a.y; if(a.until<=clock.tickN){ a.state='return'; if(a.owner===getMe().id) log('Fighter low on fuel, returning to base.',true); } }
        else if(a.state==='return'){ if(fly(a,hx,hy,F.speed)){ a.state=a.hp<F.hp?'heal':'refuel'; a.until=clock.tickN+(a.hp<F.hp?F.heal:F.refuel); } }
        else if(a.state==='refuel'){ if(a.until<=clock.tickN) a.state='hangar'; }
        else if(a.state==='heal'){ if(a.until<=clock.tickN){ a.hp++; if(a.hp>=F.hp){ a.hp=F.hp; a.state='hangar'; if(a.owner===getMe().id) log('Fighter repaired and ready.',true); } else a.until=clock.tickN+F.heal; } }
      } else if(a.type==='carrier'){ const C=constants.carrier;
        if(a.state==='out'){ if(fly(a,a.tx,a.ty,C.speed)){ const t=a.dropT, o=owner[t]; a.state='return'; const p=players[a.owner];
            if(!land[t]){ landCombat.addTroopsAt(p,a.home.t,a.troops); if(p===getMe()) log('Drop zone is water — troops brought home.',true); }
            else if(o===p.id){ landCombat.addTroopsAt(p,t,a.troops); if(p===getMe()) log(`${Math.round(a.troops)} paratroops landed on your land.`,true); }
            else { attacks.push({owner:p.id,target:o,troops:a.troops,front:new Set([t]),naval:true,age:0,origin:null,landAt:t,startTiles:o>=0?players[o].tiles:0}); log(`${p.name} dropped ${Math.round(a.troops)} paratroops on ${o>=0?players[o].name:'open land'}.`, p===getMe()||o===getMe().id); if(p===getMe()) sound('attack'); flash({x:a.tx,y:a.ty,r:3,age:0,col:'#fff'}); }
            a.troops=0; } }
        else if(a.state==='return'){ if(fly(a,hx,hy,C.speed)){ a.state='refuel'; a.until=clock.tickN+C.rearm; } }
        else if(a.state==='refuel'){ if(a.until<=clock.tickN) a.state='hangar'; }
      } else {
        const B=constants.bomber;
        if(a.state==='out'){ if(fly(a,a.tx,a.ty,B.speed)){ a.state='run'; a.hdg=a.runHdg; a.dropAt=0; } }
        else if(a.state==='run'){ a.x+=Math.cos(a.runHdg)*B.speed; a.y+=Math.sin(a.runHdg)*B.speed; a.dropAt+=B.speed; a.runLen=(a.runLen||0)+B.speed; if(a.dropAt>=B.spacing&&a.bombs>0){ a.dropAt=0; if(bomb(a,a.x,a.y)){ a.bombs--; fragment({x:a.x,y:a.y,vx:Math.cos(a.runHdg)*0.4,vy:Math.sin(a.runHdg)*0.4,age:0,life:8,col:'#222',bomb:true}); } } if(a.bombs<=0||a.runLen>B.bombs*B.spacing*2||!inb(Math.floor(a.x),Math.floor(a.y))) a.state='return'; }
        else if(a.state==='return'){ a.pull=Math.min(1,(a.pull||0)+0.08); if(fly(a,hx,hy,B.speed)){ a.state='refuel'; a.until=clock.tickN+B.rearm; } }
        else if(a.state==='refuel'){ if(a.until<=clock.tickN) a.state='hangar'; }
      }
    }
    for(const b of aircraft){ if(!(b.type==='bomber'||b.type==='carrier')||b.dead||!['out','run','return'].includes(b.state)) continue; const hunters=enemyPatrolAt(b.x,b.y,b.owner); if(hunters.length){ b.dead=true; if(b.owner===getMe().id) incrementStat('planesLost'); else if(hunters[0].owner===getMe().id) incrementStat('planesDown'); wreck('air',b.x,b.y,b.hdg,players[b.owner].color,b.type); if(b.type==='carrier'&&b.troops>0) log(`${Math.round(b.troops)} ${players[b.owner].name} paratroops were lost with the aircraft.`, b.owner===getMe().id); addShell({owner:hunters[0].owner,x:hunters[0].x,y:hunters[0].y,kind:'aam',target:{x:b.x,y:b.y,static:true},trail:[],speed:9,dmgDone:true}); flash({x:b.x,y:b.y,r:3,age:0,col:'#ffb347'}); log(`${players[hunters[0].owner].name}'s fighters shot down ${players[b.owner].name}'s ${b.type==='carrier'?'troop transport':'bomber'}.`, b.owner===getMe().id||hunters[0].owner===getMe().id); if(b.owner===getMe().id||hunters[0].owner===getMe().id) sound('intercept',b.x,b.y); diplomacy.markHostile(hunters[0].owner,b.owner); } }
    if(clock.tickN%constants.fighter.dog===0){
      for(const f of aircraft){ if(f.type!=='fighter'||f.dead||!['patrol','return'].includes(f.state)) continue; const foes=enemyPatrolAt(f.x,f.y,f.owner); if(!foes.length) continue;
        const friends=aircraft.filter(g=>g.type==='fighter'&&g.state==='patrol'&&g.owner===f.owner&&Math.hypot(g.x-f.x,g.y-f.y)<=constants.fighter.patrol*1.5).length;
        const outnumbered=foes.length>friends; const hit=random()<(outnumbered?0.85:0.6); if(hit){ f.hp--; f.hitAt=clock.tickN; addShell({owner:foes[0].owner,x:foes[0].x,y:foes[0].y,kind:'aam',target:f,trail:[],speed:9,dmgDone:true}); if(f.owner===getMe().id&&f.hp===2){ log('A fighter is down to 2 hit points — recall it!',true); sound('invaded'); } if(f.owner===getMe().id||foes[0].owner===getMe().id) sound('dogfight',f.x,f.y); diplomacy.markHostile(f.owner,foes[0].owner); }
        if(f.hp<=0){ f.dead=true; if(f.owner===getMe().id) incrementStat('planesLost'); else if(foes[0].owner===getMe().id) incrementStat('planesDown'); flash({x:f.x,y:f.y,r:3,age:0,col:'#ffb347'}); wreck('air',f.x,f.y,f.hdg,players[f.owner].color,'fighter'); log(`${players[f.owner].name} lost a fighter in a dogfight.`, f.owner===getMe().id||foes[0].owner===getMe().id); } }
    }
    engineState.retainActors('aircraft',a=>!a.dead&&players[a.owner].alive);
  }
  function flightOps(){
    if(clock.tickN%30) return;
    for(const p of players){ if(!p.alive||p.kind==='neutral'||p.airAuto===false) continue; const ops=p.kind==='bot'||structures.some(st=>st.type==='flightops'&&!st.building&&st.owner===p.id); if(!ops) continue;
      const fields=airfieldsOf(p); if(!fields.length) continue;
      for(const st of fields){ const own=aircraft.filter(a=>a.home===st); const q=st.aq||[]; const nf=own.filter(a=>a.type==='fighter').length+q.filter(j=>j.type==='fighter').length, nb=own.filter(a=>a.type==='bomber').length+q.filter(j=>j.type==='bomber').length;
        if(nf<2&&p.gold>=constants.fighter.cost+constants.reserve) buyAircraft(p,st,'fighter'); else if(nb<1&&p.gold>=constants.bomber.cost+constants.reserve) buyAircraft(p,st,'bomber'); }
      for(const f of aircraft){ if(f.owner!==p.id||f.type!=='fighter'||f.state!=='patrol') continue; const foes=enemyPatrolAt(f.x,f.y,f.owner); const friends=aircraft.filter(g=>g.type==='fighter'&&g.state==='patrol'&&g.owner===p.id&&Math.hypot(g.x-f.x,g.y-f.y)<=constants.fighter.patrol*1.5).length; if(f.hp<=2||(foes.length>friends&&f.hp<constants.fighter.hp)) recallAircraft(f); }
      const assets=structures.filter(st=>st.owner===p.id&&!st.building&&['sam','airfield','silo','battery','bertha','shield','command'].includes(st.type));
      const active=aircraft.filter(a=>a.owner===p.id&&a.type==='fighter'&&['out','patrol'].includes(a.state));
      for(const st of assets){ const x=st.t%W+.5,y=(st.t-st.t%W)/W+.5; if(active.some(a=>Math.hypot(a.tx-x,a.ty-y)<=constants.fighter.patrol*0.9)) continue; if(launchFighter(p,st.t)) active.push({tx:x,ty:y}); }
      const foes=players.filter(q=>q.alive&&q!==p&&q.kind!=='neutral'&&(p.cmdFocus===q.id||diplomacy.inConflict(p.id,q.id))); if(!foes.length) continue; const foeIds=new Set(foes.map(q=>q.id));
      let best=null,bs=0; for(const st of structures){ if(!foeIds.has(st.owner)||st.building) continue; if(fog.targetHidden(p,st.t)) continue; const x=st.t%W+.5,y=(st.t-st.t%W)/W+.5; if(enemyPatrolAt(x,y,p.id).length||missiles.domeFor(st.t,p.id)) continue;
        let sc={sam:6,silo:5,command:5,airfield:6,flightops:5,bertha:5,battery:4,shield:1,city:4,port:3,factory:2}[st.type]||1; sc*=0.85+random()*0.3; if(sc>bs){bs=sc;best=st;} }
      if(best) launchBomber(p,best.t);
    }
  }
  function botAir(p,now){ const L=ai.botLevel(p); if(L<4) return; if(now>360000&&p.gold>=structureOps.definitions.airfield.cost+300&&!airfieldsOf(p).length&&!structures.some(st=>st.owner===p.id&&st.type==='airfield')){ const own=landCombat.ownTilesOf(p.id).filter(t=>!struct[t]&&!structureOps.crowded(t)); if(own.length) structureOps.placeStructure(p,'airfield',ai.pick(own)); return; }
    if(L>=4&&random()<0.25){ const fld=airfieldsOf(p)[0]; if(fld&&(fld.level||1)<2&&!fld.upgrading&&p.gold>=structureOps.upgrades.airfield.cost+300) structureOps.upgradeStructure(p,fld); }
    const car=aircraft.find(a=>a.owner===p.id&&a.type==='carrier'&&a.state==='hangar'); if(car&&p.troops>landCombat.maxTroops(p)*0.5&&random()<0.3){ const foes=players.filter(q=>q.alive&&q!==p&&q.kind!=='neutral'&&!diplomacy.atPeace(p.id,q.id)&&(p.cmdFocus==null||q.id===p.cmdFocus)); if(foes.length){ const v=ai.pick(foes); const tiles=landCombat.ownTilesOf(v.id).filter(t=>((t%W-car.home.t%W)**2+((t-t%W)/W-(car.home.t-car.home.t%W)/W)**2)<=constants.carrier.range**2); if(tiles.length){ const t=ai.pick(tiles); const dl=landCombat.gOn(v)?landCombat.densityAt(v,t):landCombat.density(v); if(dl<landCombat.density(p)*0.5) launchParadrop(p,t,Math.min(constants.carrier.capacity,p.troops*0.2)); } } } }

  return Object.freeze({airfieldsOf,hangarMax,hangarCount,buyAircraft,spawnAircraft,idleAircraft,launchFighter,launchParadrop,launchBomber,recallAircraft,fly,enemyPatrolAt,bomb,stepAir,flightOps,botAir});
}
