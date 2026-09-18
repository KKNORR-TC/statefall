const N4=[[1,0],[-1,0],[0,1],[0,-1]];
const noop=()=>{};

export function createLogisticsSystem({
  W,H,engineState,settings,getMe,truck,provokeTicks,carrierCapacity,
  landCombat,structures:structureOps,diplomacy,naval,air,mechanics,effects={}
}){
  const clock=engineState.clock,map=engineState.map,garrison=engineState.garrison;
  const {land,owner}=map;
  const {players,attacks,structures,transports,aircraft,trucks}=engineState.actors;
  const idx=(x,y)=>y*W+x,inb=(x,y)=>x>=0&&y>=0&&x<W&&y<H;
  const log=effects.log||noop;

  function gOn(p){ return settings.garrison&&p&&p.kind!=='neutral'; }
  function areaById(id){ for(const p of players){ if(!p.areas) continue; for(const a of p.areas) if(a.id===id) return a; } return null; }
  function areaAt(t){ if(!settings.garrison||!garrison.areaOf||t<0||garrison.areaOf[t]<0) return null; return areaById(garrison.areaOf[t]); }
  function areaTouching(p,target){
    const count={}; for(let y=0;y<H;y++)for(let x=0;x<W;x++){ const t=idx(x,y); if(owner[t]!==p.id) continue; const id=garrison.areaOf[t]; for(const [dx,dy] of N4){ if(!inb(x+dx,y+dy)) continue; const n=idx(x+dx,y+dy); if(land[n]&&owner[n]===target){ count[id]=(count[id]||0)+1; break; } } }
    let best=null,bn=0; for(const k in count) if(count[k]>bn){ bn=count[k]; best=areaById(+k); } return best;
  }
  function syncTroops(p){ if(gOn(p)&&p.areas) p.troops=p.areas.reduce((s,a)=>s+a.troops,0); }
  function addTroopsAt(p,t,n){ if(!gOn(p)||!p.areas||!p.areas.length){ p.troops+=n; return; } const a=(t!=null&&areaAt(t))||p.areas[0]; if(a.owner!==p.id){ p.areas[0].troops+=n; } else a.troops+=n; syncTroops(p); }
  function takeTroopsFrom(p,a,n){ if(!gOn(p)||!a){ const k=Math.min(n,p.troops); p.troops-=k; return k; } const k=Math.min(n,a.troops); a.troops-=k; syncTroops(p); return k; }
  function loseTroopsAt(p,t,n){ if(!gOn(p)||!p.areas||!p.areas.length){ p.troops=Math.max(0,p.troops-n); return; } const a=areaAt(t)||p.areas[0]; a.troops=Math.max(0,a.troops-n); syncTroops(p); }
  function densityAt(p,t){ if(!gOn(p)||!p.areas) return landCombat.density(p); const a=areaAt(t); return a?a.troops/Math.max(1,a.tiles):landCombat.density(p); }

  function rebuildAreas(){
    if(!settings.garrison) return; if(!garrison.areaOf) garrison.areaOf=new Int32Array(W*H).fill(-1);
    const old={}; for(const p of players){ if(!gOn(p)||!p.areas) continue; for(const a of p.areas) old[a.id]=a; }
    const seen=new Uint8Array(W*H),q=new Int32Array(W*H),newAreaOf=new Int32Array(W*H).fill(-1),usedIds=new Set();
    for(const p of players){ if(!gOn(p)) continue; const areas=[];
      for(let t0=0;t0<W*H;t0++){ if(owner[t0]!==p.id||seen[t0]) continue; let h=0,tl=0; q[tl++]=t0; seen[t0]=1; const tally={}; let n=0,sx=0,sy=0; const id=garrison.nextAreaId++;
        while(h<tl){ const c=q[h++]; n++; sx+=c%W; sy+=(c-c%W)/W; newAreaOf[c]=id; const o=garrison.areaOf[c]; if(o>=0) tally[o]=(tally[o]||0)+1; const x=c%W,y=(c-x)/W; for(const [dx,dy] of N4){ if(!inb(x+dx,y+dy)) continue; const m=idx(x+dx,y+dy); if(!seen[m]&&owner[m]===p.id){ seen[m]=1; q[tl++]=m; } } }
        let troops=0,bestOld=-1,bestN=0; for(const k in tally){ const oa=old[k]; if(oa) troops+=oa.troops*tally[k]/Math.max(1,oa.tiles); if(tally[k]>bestN&&old[k]&&old[k].owner===p.id){ bestN=tally[k]; bestOld=+k; } }
        let useId=id; if(bestOld>=0&&!usedIds.has(bestOld)){ useId=bestOld; garrison.nextAreaId--; } usedIds.add(useId); for(let i=0;i<tl;i++) newAreaOf[q[i]]=useId;
        areas.push({id:useId,owner:p.id,tiles:n,troops,cx:sx/n,cy:sy/n,coast:false}); }
      areas.sort((a,b)=>b.tiles-a.tiles); { const cap=p.sx!=null?idx(Math.max(0,Math.min(W-1,Math.round(p.sx))),Math.max(0,Math.min(H-1,Math.round(p.sy)))):-1; const hid=cap>=0?newAreaOf[cap]:-1; const hi=areas.findIndex(a=>a.id===hid); if(hi>0){ const [home]=areas.splice(hi,1); areas.unshift(home); } }
      const have=areas.reduce((s,a)=>s+a.troops,0); if(areas.length&&p.troops>have+0.5) areas[0].troops+=p.troops-have;
      for(const a of areas) a.troops=Math.max(0,a.troops); p.areas=areas; p.troops=areas.reduce((s,a)=>s+a.troops,0); }
    garrison.areaOf=newAreaOf;
    for(let t=0;t<W*H;t+=2) if(garrison.areaOf[t]>=0&&land[t]&&landCombat.isCoast(t)){ const a=areaById(garrison.areaOf[t]); if(a) a.coast=true; }
  }

  function areaThreats(p){
    const th={}; for(const a of p.areas) th[a.id]={hostile:0,attacked:false};
    for(let y=0;y<H;y++)for(let x=0;x<W;x++){ const t=idx(x,y); if(owner[t]!==p.id) continue; const id=garrison.areaOf[t]; if(id<0||!th[id]) continue;
      for(const [dx,dy] of N4){ if(!inb(x+dx,y+dy)) continue; const n=idx(x+dx,y+dy),o=owner[n]; if(o<0||o===p.id) continue; const q=players[o]; if(!q.alive||diplomacy.atPeace(p.id,o)) continue;
        const hostile=q.kind==='neutral'?!!(q.grudge&&q.grudge[p.id]!=null&&clock.tickN-q.grudge[p.id]<provokeTicks):(diplomacy.inConflict(p.id,o)||landCombat.density(q)>0); if(hostile&&!th[id]['seen'+o]){ th[id]['seen'+o]=true; th[id].hostile+=gOn(q)?densityAt(q,n)*50:Math.min(q.troops,landCombat.density(q)*50); } } }
    for(const attack of attacks){ if(attack.target!==p.id) continue; for(const t of attack.front){ const id=garrison.areaOf[t]; if(id>=0&&th[id]){ th[id].attacked=true; th[id].hostile+=attack.troops; break; } } }
    return th;
  }

  const {repairNeed,repairOne}=structureOps;
  function landPath(p,a,b){
    const par=new Int32Array(W*H).fill(-1),q=new Int32Array(W*H); let h=0,tl=0; q[tl++]=a; par[a]=a;
    while(h<tl){ const c=q[h++]; if(c===b) break; const x=c%W,y=(c-x)/W; for(const [dx,dy] of N4){ if(!inb(x+dx,y+dy)) continue; const n=idx(x+dx,y+dy); if(owner[n]!==p.id||par[n]>=0) continue; par[n]=c; q[tl++]=n; } }
    if(par[b]<0) return null; const path=[]; for(let c=b;c!==a;c=par[c]) path.push(c); path.push(a); return path.reverse();
  }
  function engineering(){
    if(clock.tickN%20) return;
    for(const p of players){ if(!p.alive||p.kind==='neutral') continue; const cmds=structures.filter(st=>st.type==='engcmd'&&!st.building&&st.owner===p.id); if(!cmds.length) continue;
      const mine=trucks.filter(value=>value.owner===p.id); if(mine.length>=truck.max) continue;
      const busy=new Set(mine.map(value=>value.target)),jobs=structures.filter(st=>st.owner===p.id&&repairNeed(st)>0&&!busy.has(st)&&!st.repairing);
      for(const st of jobs){ if(trucks.filter(value=>value.owner===p.id).length>=truck.max) break; if(p.gold<truck.costPip*repairNeed(st)+truck.reserve) break;
        const base=cmds.sort((a,b)=>((a.t%W-st.t%W)**2+((a.t-a.t%W)/W-(st.t-st.t%W)/W)**2)-((b.t%W-st.t%W)**2+((b.t-b.t%W)/W-(st.t-st.t%W)/W)**2))[0];
        const path=landPath(p,base.t,st.t); if(!path) continue; trucks.push({owner:p.id,target:st,path,pos:0,x:base.t%W+.5,y:(base.t-base.t%W)/W+.5,hdg:0,state:'out',home:base}); if(p===getMe()) log(`Repair truck dispatched to ${mechanics.structureLabel(st.type).toLowerCase()}.`,true); }
    }
  }
  function stepTrucks(){
    for(const tr of trucks){ const p=players[tr.owner];
      if(!structures.includes(tr.target)||!structures.includes(tr.home)){ tr.dead=true; continue; }
      const drive=()=>{ tr.pos+=truck.speed; const i=Math.min(tr.path.length-1,Math.floor(tr.pos)),t=tr.path[i]; if(owner[t]!==p.id){ tr.dead=true; if(p===getMe()) log('A repair truck was lost on captured ground.',true); return false; } const nx=t%W+.5,ny=(t-t%W)/W+.5; if(Math.abs(nx-tr.x)+Math.abs(ny-tr.y)>0.01) tr.hdg=Math.atan2(ny-tr.y,nx-tr.x); tr.x=nx; tr.y=ny; return tr.pos>=tr.path.length-1; };
      const goHome=()=>{ tr.state='home'; const back=landPath(p,tr.target.t,tr.home.t); if(back){ tr.path=back; tr.pos=0; } else tr.dead=true; };
      if(tr.state==='out'){ if(drive()){ tr.state='work'; tr.workAt=clock.tickN+truck.repairTicks; } }
      else if(tr.state==='work'){ if(repairNeed(tr.target)<=0){ goHome; continue; } if(tr.target.flash&&tr.target.flash+150>clock.tickN) tr.workAt=Math.max(tr.workAt,clock.tickN+truck.repairTicks); if(tr.workAt<=clock.tickN){ if(p.gold<truck.costPip){ goHome; continue; } p.gold-=truck.costPip; repairOne(tr.target); tr.workAt=clock.tickN+truck.repairTicks; if(repairNeed(tr.target)<=0&&p===getMe()) log(`Repair truck restored the ${mechanics.structureLabel(tr.target.type).toLowerCase()}.`,true); } }
      else if(tr.state==='home'){ if(drive()) tr.dead=true; }
    }
    engineState.retainActors('trucks',value=>!value.dead&&players[value.owner].alive);
  }

  function troopLogistics(){
    if(clock.tickN%40||!settings.garrison) return;
    for(const p of players){ if(!p.alive||p.kind==='neutral'||!(p.troopcmds>0)||!p.areas||p.areas.length<2||p.logisticsAuto===false) continue;
      const home=p.areas[0],hd=home.troops/Math.max(1,home.tiles),reserve=landCombat.maxTroops(p)*0.3*(home.tiles/Math.max(1,p.tiles)),surplus=home.troops-reserve; if(surplus<50) continue;
      const th=areaThreats(p),inTransit=a=>transports.filter(tr=>!tr.done&&tr.owner===p.id&&tr.target===p.id&&garrison.areaOf[tr.seed]===a.id).reduce((sum,tr)=>sum+tr.troops,0)+aircraft.filter(ac=>ac.owner===p.id&&ac.type==='carrier'&&ac.state==='out'&&ac.dropT!=null&&garrison.areaOf[ac.dropT]===a.id).reduce((sum,ac)=>sum+(ac.troops||0),0);
      const cands=p.areas.filter(a=>a!==home&&a.tiles>=40&&(garrison.supplyAt[a.id]==null||garrison.supplyAt[a.id]+200<=clock.tickN)).map(a=>{ const dens=a.troops/a.tiles,t2=th[a.id]||{hostile:0,attacked:false},threatened=t2.attacked||t2.hostile>0,bare=dens<hd*0.2,want=(threatened?hd*0.6:hd*0.2)*a.tiles,need=Math.max(0,want-a.troops-inTransit(a)); return {a,need,threatened,bare,score:(t2.attacked?3:0)+(threatened?2:0)+(bare?1:0)+Math.min(1,t2.hostile/Math.max(1,a.troops))}; }).filter(c=>c.need>=50&&(c.threatened||c.bare)).sort((x,y)=>y.score-x.score);
      if(!cands.length) continue; const c=cands[0],send=Math.min(c.need,surplus,home.troops*0.15); if(send<50) continue;
      const dropT=idx(Math.round(c.a.cx),Math.round(c.a.cy)),plane=air.idleAircraft(p,'carrier',dropT); let ok=false;
      const risk=(home.coast&&c.a.coast)?naval.seaRisk(p,home,c.a):99;
      if(plane&&owner[dropT]===p.id&&(risk>0||send<=carrierCapacity)){ ok=air.launchParadrop(p,dropT,Math.min(send,carrierCapacity)); if(ok&&p===getMe()) log(`Troop command: paradropping ${Math.round(Math.min(send,carrierCapacity))} to ${mechanics.areaLabel(p,c.a)} (${c.threatened?'under threat':'bare garrison'}${risk>0?', sea lane contested':''}).`,true); }
      else if(home.coast&&c.a.coast){ if(risk>0&&!(th[c.a.id]&&th[c.a.id].attacked)){ if(p===getMe()&&(garrison.supplyAt['warn'+c.a.id]==null||garrison.supplyAt['warn'+c.a.id]+600<=clock.tickN)){ garrison.supplyAt['warn'+c.a.id]=clock.tickN; log(`Troop command: convoy to ${mechanics.areaLabel(p,c.a)} held — sea lane contested (${risk>=99?'no safe route':risk+' threats'}). Clear it or add escorts.`,true); } continue; }
        const amount=risk>0?send*0.5:send; ok=naval.reinforceArea(p,c.a,home,amount); if(ok&&p===getMe()) log(`Troop command: shipping ${Math.round(amount)} to ${mechanics.areaLabel(p,c.a)} (${c.threatened?'under threat':'bare garrison'}${risk>0?', running a contested lane':''}).`,true); }
      if(ok) garrison.supplyAt[c.a.id]=clock.tickN;
    }
  }

  return Object.freeze({gOn,areaById,areaAt,areaTouching,syncTroops,addTroopsAt,takeTroopsFrom,loseTroopsAt,densityAt,rebuildAreas,areaThreats,repairNeed,repairOne,landPath,engineering,stepTrucks,troopLogistics});
}
