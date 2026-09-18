import {DIFFICULTY_PROFILES} from '../rules.mjs';
export {DIFFICULTY_PROFILES} from '../rules.mjs';

const N4=[[1,0],[-1,0],[0,1],[0,-1]];
const noop=()=>{};

export function createAiSystem({
  W,H,engineState,settings,allowed,random,rnd,pick,getMe,
  profiles=DIFFICULTY_PROFILES,definitions,ships,
  constants,
  landCombat,structures:structureOps,diplomacy,missiles,naval,air,logistics,fog,
  effects={}
}){
  const clock=engineState.clock,map=engineState.map;
  const {land,owner,struct}=map;
  const {players,attacks,structures,warships}=engineState.actors;
  const log=effects.log||noop,sound=effects.sound||noop;
  const idx=(x,y)=>y*W+x;
  const inb=(x,y)=>x>=0&&y>=0&&x<W&&y<H;
  const currentDifficulty=()=>profiles[engineState.match.difficulty];
  function getBotDifficulty(p){ return (p&&p.customNation&&(currentDifficulty().brain||2)<4)?profiles.superhard:currentDifficulty(); }
  function botLevel(p){ return p.kind==='bot'?(getBotDifficulty(p).brain||2):0; }
  function neutralShare(){ let n=0,a=0; for(const q of players){ if(q.kind==='neutral'){ a++; if(q.alive) n++; } } return a?n/a:0; }
  function noteThreat(o,t,kind,by){ const q=players[o]; if(!q||q.kind!=='bot') return; q.threats=(q.threats||[]).filter(x=>clock.tickN-x.at<1800); q.threats.push({t,kind,by,at:clock.tickN}); if(q.threats.length>30) q.threats.shift(); }
  function nearestTo(p,list,t){ let best=-1,bd=1e12; const x=t%W,y=(t-x)/W; for(const c of list){ const d=(c%W-x)**2+((c-c%W)/W-y)**2; if(d<bd){bd=d;best=c;} } return best; }
  function botReact(p){
    const L=botLevel(p); if(L<3||!p.threats||!p.threats.length) return false; const th=p.threats[p.threats.length-1]; const own=landCombat.ownTilesOf(p.id); if(!own.length) return false;
    const near=(type,R)=>{ const c=own.filter(t=>!struct[t]&&!structureOps.crowded(t)&&(!definitions[type].coast||landCombat.isCoast(t))&&((t%W-th.t%W)**2+((t-t%W)/W-(th.t-th.t%W)/W)**2)<=R*R); if(!c.length) return false; return structureOps.placeStructure(p,type,nearestTo(p,c,th.t)); };
    const has=(type,R)=>structures.some(st=>st.owner===p.id&&st.type===type&&((st.t%W-th.t%W)**2+((st.t-st.t%W)/W-(th.t-th.t%W)/W)**2)<=R*R);
    let done=false;
    if(th.kind==='missile'){ if(!has('sam',30)&&p.gold>=definitions.sam.cost+100) done=near('sam',14); else if(L>=4&&!has('shield',12)&&p.gold>=definitions.shield.cost+200&&structures.some(st=>st.owner===p.id&&(st.type==='silo'||st.type==='city')&&((st.t%W-th.t%W)**2+((st.t-st.t%W)/W-(th.t-th.t%W)/W)**2)<=144)) done=near('shield',8); }
    else if(th.kind==='landing'){ if(!has('shore',16)&&p.gold>=definitions.shore.cost+80) done=near('shore',12); else if(!has('battery',30)&&p.gold>=definitions.battery.cost+150) done=near('battery',16); }
    else if(th.kind==='bomb'){ const fld=air.airfieldsOf(p)[0]; if(fld&&air.idleAircraft(p,'fighter',th.t)) done=air.launchFighter(p,th.t); else if(!has('sam',30)&&p.gold>=definitions.sam.cost+100) done=near('sam',14); }
    else if(th.kind==='torpedo'){ const pens=structures.filter(st=>st.type==='subbase'&&!st.building&&st.owner===p.id); if(pens.length&&p.gold>=ships.hunter.cost+100){ const wn=naval.waterNeighbor(pens[0].t); if(wn>=0) done=naval.orderWarship(p,wn,'hunter'); } else if(p.ports>0&&p.gold>=ships.warship.cost+100&&!land[th.t]) done=naval.orderWarship(p,th.t,'warship'); }
    else if(th.kind==='blockade'){ if(p.ports>0&&p.gold>=ships.warship.cost+100&&!land[th.t]) done=naval.orderWarship(p,th.t,'warship'); }
    if(done){ p.threats.pop(); if(th.by===getMe().id) log(`${p.name} is reacting to your ${th.kind==='landing'?'landings':th.kind==='missile'?'missiles':th.kind==='bomb'?'bombing':th.kind==='torpedo'?'submarines':'blockade'}.`,true); }
    return done;
  }
  function botPlaceSmart(p,type,own){
    const L=botLevel(p); if(L<1) return -1;
    const dist=(a,b)=>(a%W-b%W)**2+((a-a%W)/W-(b-b%W)/W)**2;
    if(type==='sam'||type==='shield'){ const assets=structures.filter(st=>st.owner===p.id&&(st.type==='silo'||st.type==='city'||st.type==='airfield'||st.type==='command')); const uncovered=assets.filter(a=>!structures.some(st=>st.owner===p.id&&st.type===type&&dist(st.t,a.t)<=(type==='sam'?900:100))); if(!uncovered.length) return -1; const a=pick(uncovered); const c=own.filter(t=>!struct[t]&&!structureOps.crowded(t)&&dist(t,a.t)<=(type==='sam'?200:60)); return c.length?nearestTo(p,c,a.t):-1; }
    if(type==='shore'||type==='battery'){ const foesPorts=structures.filter(st=>st.type==='port'&&st.owner!==p.id&&players[st.owner].kind!=='neutral'&&!diplomacy.atPeace(p.id,st.owner)); const foeShips=warships.filter(w=>w.owner!==p.id&&!diplomacy.atPeace(p.id,w.owner)&&(w.cls==='cruiser'||w.cls==='battleship')); const refs=[...foesPorts.map(x=>x.t),...foeShips.map(w=>idx(Math.floor(w.x),Math.floor(w.y)))]; const coast=own.filter(t=>landCombat.isCoast(t)&&!struct[t]&&!structureOps.crowded(t)); if(!coast.length) return -1; if(!refs.length) return pick(coast); const r=pick(refs); return nearestTo(p,coast,r); }
    return -1;
  }
  function botElite(p,own,now){
    const L=botLevel(p); if(!own.length) return false; const cap=landCombat.maxTroops(p); const cities=structures.filter(st=>st.owner===p.id&&st.type==='city').length; const factories=p.factories||0;
    const cityCap=Math.max(2,Math.floor(p.tiles/(L>=5?40:150)));
    const opening=now<(L>=5?120000:60000); const reserve=L>=5?250:500;
    const canBuild=!(p.nextBuildAt>now)||(opening&&L>=5&&allowed.has('city'));
    const build=(type)=>{ if(!allowed.has(type)||p.gold<definitions[type].cost) return false; const smart=botPlaceSmart(p,type,own); if(smart>=0&&structureOps.placeStructure(p,type,smart)) return true; const cands=definitions[type].coast?own.filter(t=>landCombat.isCoast(t)&&!struct[t]):own.filter(t=>!struct[t]); for(let k=0;k<8&&cands.length;k++){ const t=pick(cands); if(!structureOps.crowded(t)&&structureOps.placeStructure(p,type,t)) return true; } return false; };
    if(!canBuild) return true;
    if(cities<cityCap&&p.troops<cap*0.9&&p.gold>=definitions.city.cost&&(opening||p.gold>=reserve+definitions.city.cost)){ if(build('city')){ if(opening) p.nextBuildAt=now+1500; return true; } }
    if(opening&&p.gold<definitions.city.cost) return true;
    const coastN=landCombat.coastTilesOf(p.id).length; const guns=structures.filter(st=>st.owner===p.id&&(st.type==='shore'||st.type==='battery')).length; const gunCap=Math.max(1,Math.floor(coastN/(L>=5?180:350)));
    if(now>=110000&&coastN>20&&guns<gunCap&&p.gold>=definitions.shore.cost+reserve*0.5){ if(build('shore')) return true; }
    if(now>=90000&&p.ports<1&&coastN>10&&p.gold>=definitions.port.cost+100){ if(build('port')) return true; }
    if(now>=180000&&p.gold>=500+reserve){ const up=structures.find(st=>st.owner===p.id&&st.type==='port'&&!st.building&&!st.upgrading&&(st.level||1)<2); if(up&&structureOps.upgradeStructure(p,up)) return true; }
    if(p.gold>=reserve+definitions.factory.cost&&factories<Math.max(1,Math.floor(p.tiles/300))&&build('factory')) return true;
    if(p.gold>=reserve+definitions.city.cost&&cities<cityCap&&build('city')) return true;
    if(p.gold>=reserve+definitions.sam.cost&&(p.sams||0)<Math.max(1,Math.floor(cities/3))&&p.silos+structures.filter(st=>st.owner!==p.id&&st.type==='silo').length>0&&build('sam')) return true;
    return false;
  }
  function botEconomy(p){ const L=botLevel(p); const cap=landCombat.maxTroops(p); const atWar=attacks.some(a=>a.owner===p.id||a.target===p.id); if(L<3){ p.focus=atWar||p.troops<cap*0.4?rnd(0.6,0.85):rnd(0.3,0.55); return; }
    if(p.troops>=cap*0.95&&!settings.noCap) p.focus=rnd(0.2,0.35); else if(atWar&&p.troops<cap*0.6) p.focus=rnd(0.75,0.9); else p.focus=rnd(0.45,0.6); }
  function botAttacks(p){ const L=botLevel(p); if(L<2) return;
    for(const a of attacks){ if(a.owner!==p.id||a.dead||a.target<0) continue; const def=players[a.target]; if(!def||!def.alive) continue; a.age=(a.age||0);
      a.hist=a.hist||[]; a.hist.push([clock.tickN,def.tiles]); a.hist=a.hist.filter(h=>clock.tickN-h[0]<=200);
      const gained=a.hist.length>1?a.hist[0][1]-def.tiles:0; const start=a.startTroops||(a.startTroops=a.troops);
      if(gained>0&&a.troops<start*0.4&&p.troops>landCombat.maxTroops(p)*0.25&&!a.reinforced){ const extra=p.troops*0.15; if(extra>50){ if(landCombat.gOn(p)){ const ar=a.origin!=null?landCombat.areaById(a.origin):null; if(ar&&ar.owner===p.id){ a.troops+=landCombat.takeTroopsFrom(p,ar,Math.min(extra,ar.troops*0.3)); } } else { p.troops-=extra; a.troops+=extra; } a.reinforced=true; } }
      if(L>=3&&a.hist.length>15&&gained<=0&&a.troops<start*0.6&&clock.tickN-(a.age||0)>200){ a.dead=true; } }
  }
  function borderOwners(p){
    const r={}; const unclaimed=[];
    for(let y=0;y<H;y+=1)for(let x=0;x<W;x+=1){
      const t=idx(x,y); if(owner[t]!==p.id) continue;
      for(const [dx,dy] of N4){ if(!inb(x+dx,y+dy)) continue; const n=idx(x+dx,y+dy); if(!land[n]) continue;
        const o=owner[n]; if(o===p.id) continue; if(o<0) unclaimed.push(n); else r[o]=(r[o]||0)+1; }
    }
    return {r,unclaimed};
  }
  function botFocus(p){ const L=botLevel(p); if(L<3) return; if(p.focusUntil>clock.tickN&&p.cmdFocus!=null&&players[p.cmdFocus].alive) return;
    const cands=players.filter(q=>q.alive&&q!==p&&q.kind!=='neutral'&&!diplomacy.atPeace(p.id,q.id)); if(!cands.length){ p.cmdFocus=null; return; }
    const {r}=borderOwners(p); const score=q=>(r[q.id]?3:0)+(diplomacy.inConflict(p.id,q.id)?4:0)+((p.threats||[]).filter(t=>t.by===q.id).length)+(q.tiles/map.landCount>0.45?5:0)-(q.kind==='human'&&neutralShare()>0.35?3:0);
    cands.sort((a,b)=>score(b)-score(a)); p.cmdFocus=cands[0].id; p.focusUntil=clock.tickN+1800; }
  function botCoalition(p){ const L=botLevel(p); if(L<3||clock.tickN%50) return; if(L>=4){ const lead=players.filter(q=>q.alive&&q.kind!=='neutral').sort((a,b)=>b.tiles-a.tiles)[0]; if(lead&&lead!==p&&lead.tiles/map.landCount>=(getBotDifficulty(p).coalition||0.45)) p.focusTarget=lead.id; else if(p.focusTarget===(lead&&lead.id)) p.focusTarget=null; } const leader=players.filter(q=>q.alive&&q.kind!=='neutral').sort((a,b)=>b.tiles-a.tiles)[0]; if(!leader||leader===p||leader.tiles/map.landCount<(getBotDifficulty(p).coalition||0.45)) return;
    for(const q of players){ if(q===p||!q.alive||q.kind!=='bot'||q===leader||diplomacy.relation(p,q)) continue; if(random()<0.15){ diplomacy.setRelation(p,q,'ally'); log(`${p.name} and ${q.name} allied against ${leader.name}.`, leader===getMe()); break; } }
    if(diplomacy.relation(p,leader)&&diplomacy.relation(p,leader).type==='nap'&&random()<0.02) diplomacy.breakRelation(p,leader); }
  function neutralThink(p,now){
    if(now<p.nextThink) return; p.nextThink=now+rnd(2500,5000);
    let tgt=-1,last=-1;
    for(const k in p.grudge){ const o=+k; if(clock.tickN-p.grudge[k]>=constants.provokeTicks){ delete p.grudge[k]; continue; } if(players[o].alive&&p.grudge[k]>last){ last=p.grudge[k]; tgt=o; } }
    if(tgt<0||attacks.some(a=>a.owner===p.id)) return;
    if(p.troops<100||landCombat.density(p)<landCombat.density(players[tgt])*1.3) return;
    if(landCombat.launchAttack(p,tgt,p.troops*0.35)&&!p.warned){ p.warned=true; if(tgt===getMe().id) sound('pushback'); log(`${p.name} is pushing back${tgt===getMe().id?' against you':' against '+players[tgt].name}!`,tgt===getMe().id); }
  }
  function botThink(p,now){
    if(now<p.nextThink) return;
    p.nextThink=now+rnd(1200,3000);
    const cap=landCombat.maxTroops(p);
    const busy=attacks.some(a=>a.owner===p.id);
    botEconomy(p); botAttacks(p); botFocus(p); botCoalition(p); air.botAir(p,now);
    if(botReact(p)) p.nextThink=now+rnd(800,1500);
    if(!busy&&p.troops>cap*rnd(0.3,0.5)/getBotDifficulty(p).aggr*Math.max(0.5,1-(now)/1500000)){
      const {r,unclaimed}=borderOwners(p);
      const send=p.troops*rnd(0.3,0.5);
      if(unclaimed.length>0&&random()<0.8) landCombat.launchAttack(p,-1,send);
      else{
        const opts=Object.keys(r).map(Number).filter(o=>players[o].alive&&!diplomacy.atPeace(p.id,o))
          .map(o=>({o,d:landCombat.density(players[o]),w:players[o].tiles,n:players[o].kind==='neutral'}));
        const neut=opts.filter(x=>x.n).sort((a,b)=>a.d-b.d);
        const lead=p.focusTarget!=null?opts.find(x=>x.o===p.focusTarget):null;
        if(lead&&botLevel(p)>=4&&random()<(botLevel(p)>=5?0.75:0.25)){ landCombat.launchAttack(p,lead.o,p.troops*rnd(0.45,0.65)); }
        else if(neut.length){ landCombat.launchAttack(p,neut[0].o,send); }
        else if(random()<0.5){
          const ns=players.filter(q=>q.alive&&q.kind==='neutral'&&q.tiles>=80); if(ns.length){ const v=pick(ns); const coast=landCombat.coastTilesOf(v.id); if(coast.length) landCombat.launchAttack(p,v.id,send,pick(coast)); }
        }
        else if(opts.length){ opts.sort((a,b)=>a.d-b.d); const foc=p.cmdFocus!=null?opts.find(x=>x.o===p.cmdFocus):(p.focusTarget!=null?opts.find(x=>x.o===p.focusTarget):null); const tgt=(foc&&botLevel(p)>=3)?foc:opts[0];
          const ns=neutralShare(); const restraint=(p.focusTarget===tgt.o)?1:ns>0.35?(players[tgt.o].kind==='human'?0.15:0.4):ns>0.15?0.7:1;
          const agg=(1+Math.min(1.6,(now)/500000))*getBotDifficulty(p).aggr*restraint;
          if(tgt.d<landCombat.density(p)*0.5*agg||random()<0.25*agg) landCombat.launchAttack(p,tgt.o,send);
        } else if(random()<0.5){
          const victims=players.filter(q=>q.alive&&q!==p&&q.kind!=='neutral'&&landCombat.density(q)<landCombat.density(p)&&!diplomacy.atPeace(p.id,q.id));
          if(victims.length){ const v=pick(victims); let coast=landCombat.coastTilesOf(v.id); if(coast.length&&botLevel(p)>=4){ const guns=structures.filter(st=>st.owner===v.id&&!st.building&&(st.type==='shore'||st.type==='battery')); if(guns.length){ const safe=coast.filter(t=>{ const x=t%W,y=(t-x)/W; return !guns.some(g=>{ const gx=g.t%W,gy=(g.t-gx)/W; const r=definitions[g.type].range; return (gx-x)*(gx-x)+(gy-y)*(gy-y)<=r*r; }); }); if(safe.length) coast=safe; } } if(coast.length) landCombat.launchAttack(p,v.id,send,pick(coast)); }
        }
      }
    }
    if(landCombat.gOn(p)&&p.areas&&p.areas.length>1&&random()<0.3){ const home=p.areas[0]; const thin=p.areas.filter(a=>a!==home&&a.coast&&a.tiles>=60&&a.troops/a.tiles<home.troops/Math.max(1,home.tiles)*0.4).sort((a,b)=>b.tiles-a.tiles)[0]; if(thin&&home.coast&&home.troops>400) logistics.reinforceArea(p,thin,home,home.troops*0.15); }
    const own=landCombat.ownTilesOf(p.id);
    if(botLevel(p)>=4&&botElite(p,own,now)) { /* elite manager acted this turn */ }
    else if(own.length&&p.gold>=110&&!(p.nextBuildAt>now)){
      const roll=random();
      let type= roll<0.32?'city':roll<0.54?'factory':roll<0.65?'port':roll<0.74?'sam':roll<0.84?'fort':roll<0.9?'shore':roll<0.91?'battery':roll<0.93?'shield':roll<0.94?'airfield':roll<0.95?'subbase':roll<0.96?'troopcmd':roll<0.97?'engcmd':roll<0.98?'silo':'bertha';
      if(type==='silo'&&p.silos>0) type='city';
      if(!allowed.has(type)){ const alt=['city','factory','port','sam','fort','silo','shore','battery'].filter(k=>allowed.has(k)); if(!alt.length) return; type=pick(alt); }
      if(p.gold>=definitions[type].cost){
        const smart=botPlaceSmart(p,type,own); if(smart>=0){ structureOps.placeStructure(p,type,smart); }
        else { const cands= definitions[type].coast?own.filter(t=>landCombat.isCoast(t)&&!struct[t]):own.filter(t=>!struct[t]);
        for(let k=0;k<6&&cands.length;k++){ const t=pick(cands); if(!structureOps.crowded(t)){ structureOps.placeStructure(p,type,t); break; } } }
      }
    }
    if(p.ports>0&&p.gold>=constants.warshipCost+120&&random()<0.15&&warships.filter(w=>w.owner===p.id).length<Math.min(6,p.ports)){
      const port=pick(structures.filter(st=>st.type==='port'&&st.owner===p.id)); if(port){ const px=port.t%W,py=(port.t-px)/W;
        let cls=p.gold>1400&&random()<0.25?'battleship':p.gold>700&&random()<0.4?'cruiser':random()<0.12?'privateer':random()<0.15?'scout':'warship'; { const pens=structures.filter(st=>st.type==='subbase'&&!st.building&&st.owner===p.id).length; if(pens&&random()<0.35){ const nSub=warships.filter(w=>w.owner===p.id&&w.cls==='sub').length, nHun=warships.filter(w=>w.owner===p.id&&w.cls==='hunter').length; const wantHun=(p.subLoss||0)>0||random()<0.35; if(wantHun&&nHun<2*pens) cls='hunter'; else if(nSub<3*pens) cls='sub'; } } if(!allowed.has(cls)){ const alt=['scout','warship','cruiser','battleship','privateer'].filter(k=>allowed.has(k)); if(!alt.length) return; cls=pick(alt); }
        for(let k=0;k<6;k++){ const x=Math.floor(px+rnd(-40,40)),y=Math.floor(py+rnd(-40,40)); if(inb(x,y)&&!land[idx(x,y)]){ naval.orderWarship(p,idx(x,y),cls); break; } } }
    }
    if(p.gold>1200&&random()<0.08){ const bb=warships.find(w=>w.owner===p.id&&w.cls==='battleship'&&!w.cruise&&!w.refit&&structures.some(st=>st.type==='port'&&(st.level||1)>=2&&!st.building&&st.owner===p.id&&((st.t%W+.5-w.x)**2+((st.t-st.t%W)/W+.5-w.y)**2)<=constants.linkRange*constants.linkRange)); if(bb){ p.gold-=constants.cruise.cost; bb.refit=clock.tickN+constants.cruise.ticks; } }
    if(clock.tickN>2400&&p.gold>1100&&random()<0.25&&!structures.some(st=>st.owner===p.id&&st.type==='port'&&(st.level||1)>=2)){ const up=structures.find(st=>st.owner===p.id&&st.type==='port'&&!st.building&&!st.upgrading); if(up) structureOps.upgradeStructure(p,up); }
    else if(p.gold>900&&random()<0.06&&structures.filter(st=>st.owner===p.id&&(st.level||1)>=2).length<3){ const up=structures.find(st=>st.owner===p.id&&(st.type==='port'||st.type==='airfield')&&!st.building&&!st.upgrading&&(st.level||1)<2); if(up) structureOps.upgradeStructure(p,up); }
    { const pens=structures.filter(st=>st.type==='subbase'&&!st.building&&st.owner===p.id); if(pens.length&&p.gold>=650&&random()<0.3){ const nSub=warships.filter(w=>w.owner===p.id&&w.cls==='sub').length, nHun=warships.filter(w=>w.owner===p.id&&w.cls==='hunter').length; let cls=null; if(((p.subLoss||0)>0||random()<0.35)&&nHun<2*pens.length) cls='hunter'; else if(nSub<3*pens.length) cls='sub'; if(cls&&allowed.has(cls)){ const base=pick(pens); const wn=naval.waterNeighbor(base.t); if(wn>=0){ let dest=wn; for(let k=0;k<12;k++){ const c=wn+Math.round((random()-.5)*30)+Math.round((random()-.5)*30)*W; if(c>=0&&c<W*H&&!land[c]){ dest=c; break; } } naval.orderWarship(p,dest,cls); } } } }
    { const p2=structures.find(st=>st.owner===p.id&&st.type==='port'&&(st.level||1)>=2&&!st.building); if(p2&&p.gold>700&&random()<0.25&&allowed.has('subbase')&&!structures.some(st=>st.owner===p.id&&st.type==='subbase')){ const cands=landCombat.coastTilesOf(p.id).filter(t=>!struct[t]&&!structureOps.crowded(t)&&((t%W-p2.t%W)**2+((t-t%W)/W-(p2.t-p2.t%W)/W)**2)<=constants.linkRange*constants.linkRange); if(cands.length) structureOps.placeStructure(p,'subbase',pick(cands)); } }
    if(p.silos>0&&p.gold>=constants.nukeCost+60&&random()<0.35){
      const victims=players.filter(q=>q.alive&&q!==p&&q.kind!=='neutral'&&!diplomacy.atPeace(p.id,q.id)).sort((a,b)=>b.tiles-a.tiles);
      if(victims.length){ const v=victims[0]; const cands=structures.filter(s=>s.owner===v.id);
        const t=cands.length?pick(cands).t:pick(landCombat.ownTilesOf(v.id)); if(t!=null) missiles.launchMissile(p,t); }
    }
  }

  // Fog policy remains delegated to the injected air and naval commands; retain the
  // narrow port so those systems need not become browser-facing dependencies here.
  void fog;
  return Object.freeze({currentDifficulty,getBotDifficulty,botLevel,neutralShare,noteThreat,nearestTo,botReact,botPlaceSmart,botEconomy,botAttacks,botFocus,botCoalition,borderOwners,neutralThink,botThink});
}
