const N4=[[1,0],[-1,0],[0,1],[0,-1]];
const noop=()=>{};

export function createLandCombatSystem({
  W,H,engineState,settings,random,rnd,getMe,
  constants,
  diplomacy,
  garrison,
  mechanics,
  effects={}
}){
  const clock=engineState.clock,map=engineState.map;
  const {land,owner,struct,region,shelled,rough,unclaimed}=map;
  const {players,attacks}=engineState.actors;
  const idx=(x,y)=>y*W+x;
  const inb=(x,y)=>x>=0&&y>=0&&x<W&&y<H;
  const fail=effects.fail||noop,log=effects.log||noop,sound=effects.sound||noop;
  const attackStarted=effects.attackStarted||noop,invasion=effects.invasion||noop;
  const tileCaptured=effects.tileCaptured||noop,conquest=effects.conquest||noop;
  const fell=effects.fell||noop,badge=effects.badge||noop,plunder=effects.plunder||noop;
  const treasury=effects.treasury||noop;

  function setOwner(t,o){
    const prev=owner[t]; if(prev===o) return;
    if(prev>=0){ players[prev].tiles--; map.regCount[region[t]*map.NP+prev]--; }
    if(o>=0){ players[o].tiles++; map.regCount[region[t]*map.NP+o]++; unclaimed.delete(t); } else if(land[t]) unclaimed.add(t);
    owner[t]=o;
  }
  function ownTilesOf(id){ const a=[]; for(let t=0;t<W*H;t++) if(owner[t]===id) a.push(t); return a; }
  function isCoast(t){
    const x=t%W,y=(t-x)/W;
    return land[t]&&N4.some(([dx,dy])=>inb(x+dx,y+dy)&&!land[idx(x+dx,y+dy)]);
  }
  function coastTilesOf(id){ return ownTilesOf(id).filter(isCoast); }
  function claimBlob(p,cx,cy,r){
    for(let y=cy-r;y<=cy+r;y++)for(let x=cx-r;x<=cx+r;x++){
      if(inb(x,y)&&land[idx(x,y)]&&(owner[idx(x,y)]<0||players[owner[idx(x,y)]].kind==='neutral')&&(x-cx)**2+(y-cy)**2<=r*r) setOwner(idx(x,y),p.id);
    }
  }
  function maxTroops(p){ if(p.kind==='neutral') return 60+p.tiles*0.15; return 120+p.tiles*0.34+p.cities*400; }
  function density(p){ return p.troops/Math.max(1,p.tiles); }
  const gOn=p=>garrison.gOn(p),areaById=id=>garrison.areaById(id),areaAt=t=>garrison.areaAt(t),areaTouching=(p,target)=>garrison.areaTouching(p,target);
  const syncTroops=p=>garrison.syncTroops(p),addTroopsAt=(p,t,n)=>garrison.addTroopsAt(p,t,n),takeTroopsFrom=(p,a,n)=>garrison.takeTroopsFrom(p,a,n),loseTroopsAt=(p,t,n,deferSync,localArea)=>garrison.loseTroopsAt(p,t,n,deferSync,localArea),densityAt=(p,t)=>garrison.densityAt(p,t);
  function frontierOf(att,target,areaId){
    const f=new Set();
    for(let y=0;y<H;y++)for(let x=0;x<W;x++){
      const t=idx(x,y); if(owner[t]!==att) continue; if(areaId!=null&&engineState.garrison.areaOf&&engineState.garrison.areaOf[t]!==areaId) continue;
      for(const [dx,dy] of N4){ if(!inb(x+dx,y+dy)) continue; const n=idx(x+dx,y+dy); if(land[n]&&owner[n]===target) f.add(n); }
    }
    return f;
  }
  function launchAttack(p,target,troops,seed,fromArea){ if(mechanics.pausedBlock(p)) return false;
    if(diplomacy.atPeace(p.id,target)){ if(p===getMe()) fail(`You have ${diplomacy.relation(p,players[target]).type==='ally'?'an alliance':'a pact'} with ${players[target].name}. Declare war first.`); return false; }
    let origin=null; if(gOn(p)&&p.areas&&p.areas.length){ origin=fromArea||(seed!=null?null:areaTouching(p,target)); if(seed!=null&&!origin){ const c=mechanics.nearestCoast(p,seed); origin=(c>=0&&areaAt(c))||p.areas.find(a=>a.coast)||p.areas[0]; } if(!origin){ if(p===getMe()) fail('None of your areas borders that nation — send a transport from one of them.'); return false; } troops=Math.min(troops,origin.troops); if(p===getMe()&&fromArea==null) p.lastOrigin=origin; }
    else troops=Math.min(troops,p.troops);
    if(troops<5){ if(p===getMe()) fail(origin?`${mechanics.areaLabel(p,origin)} has too few troops to attack with.`:'Need at least 5 troops to attack.'); return false; }
    const ex=attacks.find(a=>a.owner===p.id&&a.target===target);
    if(ex&&!seed&&(!origin||ex.origin===origin.id)){ ex.troops+=takeTroopsFrom(p,origin,troops); ex.spent=ex.spent||0; if(p===getMe()) sound('attack'); return true; }
    if(seed!=null) return mechanics.launchTransport(p,target,troops,seed,origin);
    const front=frontierOf(p.id,target,origin?origin.id:null);
    if(front.size===0){ if(p===getMe()&&origin) fail('That area does not border the target.'); return false; }
    troops=takeTroopsFrom(p,origin,troops);
    attackStarted(p,target);
    attacks.push({owner:p.id,target,troops,front,naval:false,age:0,origin:origin?origin.id:null,startTiles:target>=0?players[target].tiles:0});
    if(target===getMe().id&&p!==getMe()) invasion(p,[...front][0],false);
    if(p===getMe()) sound('attack');
    return true;
  }
  function tileCost(a,def,t,forts,localDensity){
    const dloc=localDensity!==undefined?localDensity:(def&&t!=null&&gOn(def))?densityAt(def,t):null;
    const terr=t!=null?0.65+0.7*rough[t]:1;
    if(def==null) return 0.38*terr;
    const d=Math.min(8,dloc!=null?dloc:density(def));
    return terr*(def.kind==='neutral'?0.3+d*1.2:0.38+d*2.8)*(a.naval?1.4:1)*(players[a.owner].kind==='neutral'?1.5:1)*(t!=null&&shelled[t]>clock.tickN?constants.suppressCost:(t!=null?(forts===undefined?mechanics.fortMult(t,def.id):forts?Math.min(64,Math.pow(2,forts)):1):1));
  }
  function absorbRemnant(def,p,force,front){
    if(!force&&(def===getMe()||def.tiles>=25)) return; if(def.tiles<=0||!def.alive) return;
    const seen=new Uint8Array(W*H),q=[]; const push=t=>{ if(t>=0&&t<W*H&&!seen[t]&&owner[t]===def.id){ seen[t]=1; q.push(t); } };
    if(front) for(const t of front) push(t);
    if(!q.length){ for(let t=0;t<W*H;t++){ if(owner[t]!==def.id) continue; const x=t%W,y=(t-x)/W; for(const [dx,dy] of N4){ if(inb(x+dx,y+dy)&&owner[idx(x+dx,y+dy)]===p.id){ push(t); break; } } } }
    for(let h=0;h<q.length;h++){ const c=q[h]; const x=c%W,y=(c-x)/W; for(const [dx,dy] of N4){ if(inb(x+dx,y+dy)) push(idx(x+dx,y+dy)); } }
    const keep=[]; for(const t of q){ if(def.kind!=='neutral'&&mechanics.fortStack(t,def.id)>0&&!(shelled[t]>clock.tickN)){ keep.push(t); continue; } setOwner(t,p.id); if(struct[t]) mechanics.captureStructure(t,p); }
    if(keep.length&&(p===getMe()||def===getMe())) log(`${def.name}'s fortified ground held — ${keep.length} tiles behind the bastions did not fall.`,true);
    const left=def.tiles;
    if(left>0&&def.kind!=='neutral') log(`${def.name} collapsed here; ${left} tiles of holdings elsewhere remain.`,p===getMe()||def===getMe());
    mechanics.structCounts(def);
  }
  function stepAttacks(){
    const fortStack=mechanics.combatFortQuery?mechanics.combatFortQuery():mechanics.fortStack,localPlayer=getMe();
    for(const a of attacks){
      a.age++;
      const p=players[a.owner],def=a.target>=0?players[a.target]:null,defGarrison=!!def&&gOn(def);
      if(!p.alive){ a.dead=true; continue; }
      const unit=tileCost(a,def,null),strength=a.troops/Math.max(1,a.front.size*unit);
      const pace=Math.min(3,Math.max(0.25,0.3+0.4*Math.sqrt(strength)));
      const take=Math.max(1,Math.ceil(a.front.size*0.22*pace));
      // Local losses do not read the national total. Preserve the original ordered
      // sum before a global fallback read and before leaving this attack.
      let n=0,needsTroopSync=false;
      const it=Array.from(a.front);
      for(let i=0;i<it.length;i++){ const j=i+Math.floor(random()*(it.length-i)); const swap=it[i];it[i]=it[j];it[j]=swap; }
      for(const t of it){
        if(n>=take) break;
        const x=t%W,y=(t-x)/W;
        { let k=0;if(x<W-1&&owner[t+1]===p.id)k++;if(x>0&&owner[t-1]===p.id)k++;if(y<H-1&&owner[t+W]===p.id)k++;if(y>0&&owner[t-W]===p.id)k++; if(k===0&&a.took){ a.front.delete(t); continue; } if(k===1&&a.took&&random()<0.4) continue; }
        a.front.delete(t);
        if(owner[t]!==a.target||!land[t]) continue;
        const localGarrison=defGarrison?areaAt(t):null;
        if(needsTroopSync&&!localGarrison){ syncTroops(def); needsTroopSync=false; }
        const tileForts=def&&!(shelled[t]>clock.tickN)?fortStack(t,def.id):undefined;
        const localDensity=defGarrison?(def.areas&&localGarrison?localGarrison.troops/Math.max(1,localGarrison.tiles):density(def)):undefined;
        let cost=def?tileCost(a,def,t,tileForts,localDensity):0;
        if(def){ const pool=defGarrison?(localGarrison?localGarrison.troops:def.troops):def.troops; const base=0.38*(0.65+0.7*rough[t]); const cap=base+Math.max(0,pool)*1.5/Math.max(1,a.front.size); cost=Math.min(cost,Math.max(base,cap)); if(def.kind!=='neutral'&&!(shelled[t]>clock.tickN)){ const forts=tileForts; if(forts) cost+=constants.wallToll*Math.pow(2,forts-1); } }
        if(a.troops<cost){ a.dead=true; break; }
        a.troops-=cost; a.spent=(a.spent||0)+cost;
        if(def){ if(defGarrison){ const defer=!!localGarrison&&!!def.areas?.length;loseTroopsAt(def,t,cost*0.55,defer,localGarrison);if(defer)needsTroopSync=true; } else def.troops=Math.max(0,def.troops-cost*0.55); if(def.kind==='neutral'&&p.kind!=='neutral'){ def.grudge[p.id]=clock.tickN; if(!diplomacy.isProvokedBy(def,p.id,1)) def.warned=false; } }
        setOwner(t,p.id); n++; a.took=(a.took||0)+1; tileCaptured(t,p); if(def&&n===1) diplomacy.markHostile(p.id,def.id); if(def===localPlayer) sound('invaded');
        if(struct[t]) mechanics.captureStructure(t,p);
        // Preserve east/west/south/north insertion order without a branch-heavy loop.
        if(x<W-1&&land[t+1]&&owner[t+1]===a.target)a.front.add(t+1);
        if(x>0&&land[t-1]&&owner[t-1]===a.target)a.front.add(t-1);
        if(y<H-1&&land[t+W]&&owner[t+W]===a.target)a.front.add(t+W);
        if(y>0&&land[t-W]&&owner[t-W]===a.target)a.front.add(t-W);
      }
      if(needsTroopSync) syncTroops(def);
      if(a.front.size===0) a.dead=true;
      if(def&&def.alive&&def.tiles>0&&n>0&&(def.tiles<25||def.troops<1)){ if(def.troops<1&&def.tiles>=25) log(`${def.name} has no army left — ${p.name} takes the rest.`,p===localPlayer||def===localPlayer); absorbRemnant(def,p,def.troops<1,a.front); }
      if(def&&def.tiles<=0&&def.alive){
        def.alive=false;
        if(p===localPlayer){ sound('conquered'); localPlayer.kills=(localPlayer.kills||0)+1; conquest(def); }
        if(def===localPlayer&&p.kind!=='neutral') fell(p);
        if(def.kind!=='neutral'){ def.killedBy=p.id; def.diedAt=clock.tickN; badge(def,p); }
        if(def.kind==='neutral'&&p.kind!=='neutral'){ const early=1+(constants.conquestEarly-1)*Math.max(0,1-clock.tickN/constants.conquestEarlyTicks); const g=Math.round(a.startTiles*constants.conquestGold*early); p.gold+=g; if(p===localPlayer) plunder(def,g,early); }
        else if(def.kind!=='neutral'&&p.kind!=='neutral'){ const g=Math.floor(def.gold); def.gold=0; if(g>0){ p.gold+=g; treasury(p,def,g); } }
        log(p.kind==='neutral'?`${def.name} overextended and was conquered by ${p.name}.`:`${p.name} wiped out ${def.name}.`,p===localPlayer||def===localPlayer);
      }
    }
    engineState.retainActors('attacks',a=>{ if(a.dead){ const p=players[a.owner]; const back=Math.max(0,a.troops-(a.target<0?0:(a.spent||0)*0.1)); if(gOn(p)){ const ar=a.origin!=null?areaById(a.origin):null; if(ar&&ar.owner===p.id){ ar.troops+=back; syncTroops(p); } else addTroopsAt(p,a.landAt!=null&&owner[a.landAt]===p.id?a.landAt:null,back); } else p.troops+=back; return false; } return true; });
  }
  function reclaimLand(){
    if(clock.tickN%10) return;
    for(const t of [...unclaimed]){ if(!land[t]||owner[t]>=0){ unclaimed.delete(t); continue; } if(random()>0.25) continue;
      const x=t%W,y=(t-x)/W,tally={}; for(const [dx,dy] of N4){ if(!inb(x+dx,y+dy)) continue; const o=owner[idx(x+dx,y+dy)]; if(o>=0&&players[o].alive) tally[o]=(tally[o]||0)+1; }
      let best=-1,bn=0,second=0; for(const k in tally){ if(tally[k]>bn){ second=bn; bn=tally[k]; best=+k; } else if(tally[k]>second) second=tally[k]; }
      if(best>=0&&bn>=2&&bn>second) setOwner(t,best);
    }
  }
  return Object.freeze({setOwner,ownTilesOf,coastTilesOf,isCoast,claimBlob,maxTroops,density,gOn,areaById,areaAt,areaTouching,syncTroops,addTroopsAt,takeTroopsFrom,loseTroopsAt,densityAt,frontierOf,launchAttack,tileCost,absorbRemnant,stepAttacks,reclaimLand});
}
