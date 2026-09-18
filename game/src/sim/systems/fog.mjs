const noop=()=>{};

export function createFogSystem({
  W,H,engineState,settings,random,getMe,constants,
  structures:structureQueries,
  diplomacy,
  fighters,
  borders,
  mechanics,
  effects={}
}){
  const clock=engineState.clock,map=engineState.map,fog=engineState.fog;
  const {owner,shelled}=map;
  const {players,structures,warships,aircraft,planes}=engineState.actors;
  const N4=[[1,0],[-1,0],[0,1],[0,-1]];
  const N8=[[1,0],[-1,0],[0,1],[0,-1],[1,1],[1,-1],[-1,1],[-1,-1]];
  const idx=(x,y)=>y*W+x;
  const inb=(x,y)=>x>=0&&y>=0&&x<W&&y<H;
  const fail=effects.fail||noop,log=effects.log||noop,sound=effects.sound||noop,flash=effects.flash||noop;

  function stampVis(cx,cy,r){ const R=Math.round(r); for(let y=Math.max(0,cy-R);y<=Math.min(H-1,cy+R);y++){ const dx=Math.floor(Math.sqrt(Math.max(0,R*R-(y-cy)*(y-cy)))); const x0=Math.max(0,cx-dx), x1=Math.min(W-1,cx+dx); fog.vis.fill(1,y*W+x0,y*W+x1+1); } }
  function computeVision(){
    if(!settings.fog){ engineState.replaceFogBuffer('vis',null); return; }
    if(!fog.vis) engineState.replaceFogBuffer('vis',new Uint8Array(W*H)); else fog.vis.fill(0);
    if(fog.satUntil>clock.tickN){ fog.vis.fill(1); return; }
    const friends=new Set([getMe().id]); for(const q of players) if(q!==getMe()&&q.alive&&diplomacy.relation(getMe(),q)?.type==='ally') friends.add(q.id);
    const q=new Int32Array(W*H); const d=new Uint8Array(W*H).fill(255); let h=0,tl=0;
    for(let t=0;t<W*H;t++){ if(owner[t]>=0&&friends.has(owner[t])){ const x=t%W,y=(t-x)/W; let edge=false; for(const [dx,dy] of N4){ if(!inb(x+dx,y+dy)||!friends.has(owner[idx(x+dx,y+dy)])){edge=true;break;} } fog.vis[t]=1; if(edge){ d[t]=0; q[tl++]=t; } } }
    while(h<tl){ const c=q[h++]; if(d[c]>=constants.base) continue; const x=c%W,y=(c-x)/W; for(const [dx,dy] of N8){ if(!inb(x+dx,y+dy)) continue; const n=idx(x+dx,y+dy); if(d[n]===255){ d[n]=d[c]+1; fog.vis[n]=1; q[tl++]=n; } } }
    // Radar is separate so jammers do not erase direct line of sight.
    const base=fog.vis; if(!fog.radarLayer) engineState.replaceFogBuffer('radarLayer',new Uint8Array(W*H)); engineState.replaceFogBuffer('vis',fog.radarLayer); fog.vis.fill(0);
    for(const st of structures){ if(st.building||!friends.has(st.owner)) continue; if(st.type==='radar') stampVis(st.t%W,(st.t-st.t%W)/W,constants.radar); else if(st.type==='lradar') stampVis(st.t%W,(st.t-st.t%W)/W,constants.lradar); }
    for(const w of warships){ if(!friends.has(w.owner)||w.x==null||w.cls!=='rship') continue; stampVis(Math.round(w.x),Math.round(w.y),constants.rship); }
    for(const st of structures){ if(st.type!=='jammer'||st.building||friends.has(st.owner)) continue; const cx=st.t%W,cy=(st.t-cx)/W,R=constants.jam; for(let y=Math.max(0,cy-R);y<=Math.min(H-1,cy+R);y++){ const dx=Math.floor(Math.sqrt(Math.max(0,R*R-(y-cy)*(y-cy)))); fog.vis.fill(0,y*W+Math.max(0,cx-dx),y*W+Math.min(W-1,cx+dx)+1); } }
    for(let t=0;t<W*H;t++) if(fog.vis[t]) base[t]=1; engineState.replaceFogBuffer('vis',base);
    for(const w of warships){ if(!friends.has(w.owner)||w.x==null||w.cls==='rship') continue; stampVis(Math.round(w.x),Math.round(w.y),Math.max(10,fighters.shipGunRange(w.cls))); }
    for(const pl of planes){ if(pl.owner===getMe().id&&pl.phase==='orbit') stampVis(Math.round(pl.tx),Math.round(pl.ty),constants.plane.r); }
    for(const a of aircraft){ if(friends.has(a.owner)&&a.type==='fighter'&&a.state==='patrol') stampVis(Math.round(a.tx),Math.round(a.ty),fighters.patrolRadius); }
  }
  function visAt(x,y){ if(!fog.vis) return true; const X=Math.floor(x),Y=Math.floor(y); if(!inb(X,Y)) return false; return fog.vis[Y*W+X]===1; }
  function hidden(t){ return !!fog.vis&&!fog.vis[t]; }
  function targetHidden(p,t){ return !!settings.fog&&p===getMe()&&!!fog.vis&&!fog.vis[t]; }
  function stepPlanes(){
    for(const pl of planes){
      if(pl.phase==='out'){ const dx=pl.tx-pl.x, dy=pl.ty-pl.y, dd=Math.hypot(dx,dy); if(dd<=constants.plane.speed){ pl.phase='orbit'; pl.until=clock.tickN+constants.plane.dur; pl.onStation=clock.tickN; pl.ang=Math.atan2(dy,dx); if(pl.owner===getMe().id) log('Spy plane on station.',true); } else { pl.x+=dx/dd*constants.plane.speed; pl.y+=dy/dd*constants.plane.speed; pl.hdg=Math.atan2(dy,dx); } }
      else if(pl.phase==='orbit'){ pl.ang+=0.045; pl.x=pl.tx+Math.cos(pl.ang)*12; pl.y=pl.ty+Math.sin(pl.ang)*12; pl.hdg=pl.ang+Math.PI/2;
        if(clock.tickN%30===0&&clock.tickN-(pl.onStation||0)>=constants.plane.grace&&(pl.shots||0)<constants.plane.maxShots) for(const st of structures){ if(st.type!=='sam'||st.building||st.owner===pl.owner||shelled[st.t]>clock.tickN||diplomacy.atPeace(st.owner,pl.owner)||pl.shot?.has(st.t)) continue; const sx=st.t%W,sy=(st.t-sx)/W; if((sx-pl.tx)**2+(sy-pl.ty)**2>constants.plane.r*constants.plane.r) continue;
          (pl.shot??=new Set()).add(st.t); pl.shots=(pl.shots||0)+1; if(pl.shots>constants.plane.maxShots) break; if(random()<constants.plane.hit){ pl.phase='down'; flash({x:pl.x,y:pl.y,r:3,age:0,col:'#ffb347'}); log(`${players[st.owner].name}'s SAM site shot down ${players[pl.owner].name}'s spy plane.`, pl.owner===getMe().id||st.owner===getMe().id); if(pl.owner===getMe().id) sound('intercept'); break; } }
        if(pl.phase==='orbit'&&clock.tickN-(pl.onStation||0)>=50&&fighters.enemyPatrolAt(pl.tx,pl.ty,pl.owner).length){ pl.phase='down'; flash({x:pl.x,y:pl.y,r:3,age:0,col:'#ffb347'}); log(`Fighters shot down ${players[pl.owner].name}'s spy plane.`, pl.owner===getMe().id); }
        if(pl.phase==='orbit'&&pl.until<=clock.tickN){ pl.phase='home'; }
      }
      else if(pl.phase==='home'){ const dx=pl.hx-pl.x, dy=pl.hy-pl.y, dd=Math.hypot(dx,dy); if(dd<=constants.plane.speed) pl.phase='done'; else { pl.x+=dx/dd*constants.plane.speed; pl.y+=dy/dd*constants.plane.speed; pl.hdg=Math.atan2(dy,dx); } }
    }
    engineState.retainActors('planes',pl=>pl.phase!=='done'&&pl.phase!=='down');
  }
  function callPlane(p,t){ if(mechanics.pausedBlock(p)) return false;
    if(!settings.fog) return false; const fld=structureQueries.airfieldsOf(p).sort((a,b)=>Math.hypot(a.t%W-t%W,(a.t-a.t%W)/W-(t-t%W)/W)-Math.hypot(b.t%W-t%W,(b.t-b.t%W)/W-(t-t%W)/W))[0]; if(!fld||Math.hypot(fld.t%W-t%W,(fld.t-fld.t%W)/W-(t-t%W)/W)>150){ if(p===getMe()) fail(fld?'That point is beyond 150 tiles of your nearest airfield.':'Spy planes need an airfield.'); return false; } if(p===getMe()&&fog.planeCool>clock.tickN){ fail(`Spy plane ready in ${Math.ceil((fog.planeCool-clock.tickN)/10)} s.`); return false; }
    if(p.gold<constants.plane.cost){ if(p===getMe()) fail('Not enough gold for a spy plane.'); return false; }
    const tx=t%W+.5, ty=(t-t%W)/W+.5; const hx=fld.t%W+.5, hy=(fld.t-fld.t%W)/W+.5;
    p.gold-=constants.plane.cost; if(p===getMe()) engineState.setFogScalar('planeCool',clock.tickN+constants.plane.cd);
    planes.push({owner:p.id,x:hx,y:hy,hx,hy,tx,ty,phase:'out',hdg:0}); if(p===getMe()){ log('Spy plane launched.',true); sound('interceptor'); } return true;
  }
  function launchSatellite(player=getMe()){ if(!settings.fog) return; const site=structureQueries.satelliteSiteFor(player); if(!site) return fail('You need a finished satellite launch site.');
    if(fog.satCool>clock.tickN) return fail(`Next launch window in ${Math.ceil((fog.satCool-clock.tickN)/10)} s.`); if(player.gold<constants.sat.cost) return fail('Not enough gold for a satellite launch.');
    player.gold-=constants.sat.cost; engineState.setFogScalar('satUntil',clock.tickN+constants.sat.dur); engineState.setFogScalar('satCool',clock.tickN+constants.sat.cd); log('Satellite in orbit — full map for 45 s.',true); sound('missile'); }
  function updateKnownBorders(){ if(settings.fog&&clock.tickN%20===0) engineState.replaceMyBorders(Object.keys(borders.owners(getMe()).r).map(Number)); }

  return Object.freeze({stampVis,computeVision,visAt,hidden,targetHidden,stepPlanes,callPlane,launchSatellite,updateKnownBorders});
}
