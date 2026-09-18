import {calculateCentroid} from './geometry.mjs';
import {ownAuthorityValue} from './authority-value.mjs';

const N4=[[1,0],[-1,0],[0,1],[0,-1]];

export function createWorldSetup({
  W,H,engineState,settings,mapGeneration,random,rnd,pick,
  countries,countryAliases,
  colors,botNames,bots,tilesPerNeutral,regionMin,quickTiles,
  landCombat,structuresSystem,logistics,startDraft,borderOwners,
  onCustomBot=()=>{},onSetupComplete=()=>{}
}){
  const setupState=engineState.setup;
  const mapState=engineState.map;
  const {land,owner,struct,region,regions,unclaimed}=mapState;
  const {players,structures}=engineState.actors;
  const idx=(x,y)=>y*W+x;
  const inb=(x,y)=>x>=0&&y>=0&&x<W&&y<H;
  const {setOwner,claimBlob}=landCombat;

  const ownFlag=value=>ownAuthorityValue(value,{path:'actor flag'});
  function countryByIdx(i){ return ownFlag({name:countries[i][0],layers:countries[i].slice(1),idx:i}); }
  function resetCountryPool(){ engineState.replaceCountryPool(countries.map((c,i)=>i)); for(let i=setupState.countryPool.length-1;i>0;i--){ const j=Math.floor(random()*(i+1)); [setupState.countryPool[i],setupState.countryPool[j]]=[setupState.countryPool[j],setupState.countryPool[i]]; } }
  function takeCountry(){ if(!setupState.countryPool.length) return null; const i=setupState.countryPool.pop(); return countryByIdx(i); }
  function hslHex(h,sl,l){ const a=sl*Math.min(l,1-l)/100*100; const f=n=>{const k=(n+h/30)%12; const c=l*100-a*Math.max(-1,Math.min(k-3,9-k,1)); return Math.round(c*2.55).toString(16).padStart(2,'0');}; return '#'+f(0)+f(8)+f(4); }
  function flagFor(name){ const n=countryAliases[name]||name; const i=countries.findIndex(c=>c[0]===n); return i>=0?countryByIdx(i):{name,layers:[['rect','#8a8f86',0,0,1,1]],generic:true}; }
  function makePlayer(name,color,kind){
    const c=kind==='neutral'&&setupState.PRESET?null:takeCountry(); const p={id:players.length,name:c?c.name:name,color,kind,flag:c||{name,layers:[['rect',color,0,0,1,1]]},troops:120,gold:100,tiles:0,alive:true,
      cities:0,factories:0,ports:0,sams:0,silos:0,nextThink:rnd(2000,5000),held:new Set(),claimed:new Set(),grudge:{},focus:0.5,rel:{},rep:0.7,penaltyUntil:0,lastProposal:{}};
    players.push(p); return p;
  }
  function findSpawn(minDist){
    for(let tries=0;tries<400;tries++){
      const x=Math.floor(rnd(6,W-6)), y=Math.floor(rnd(6,H-6));
      if(!land[idx(x,y)]||regions[region[idx(x,y)]].size<(settings.map==='islands_s'?300:settings.map==='islands_m'?700:1500)) continue;
      let ok=true;
      for(const p of players){ if(p.sx==null) continue; if((p.sx-x)**2+(p.sy-y)**2<minDist*minDist){ok=false;break;} }
      if(ok) return [x,y];
    }
    return null;
  }
  function makeNeutrals(){
    if(setupState.PRESET){ const byC={}; for(let t=0;t<W*H;t++){ if(!land[t]||setupState.cid[t]<0) continue; (byC[setupState.cid[t]]??=[]).push(t); }
      const q=new Int32Array(W*H);
      const per=Math.max(tilesPerNeutral,mapState.landCount/75);
      for(const k in byC){ const tiles=byC[k]; if(tiles.length<80) continue; const name=setupState.PRESET.names[k]; const flag=flagFor(name);
        const parts=Math.max(1,Math.round(tiles.length/per));
        if(parts===1){ const p=makePlayer(name,hslHex(random()*360,18+random()*10,48+random()*12),'neutral'); p.flag=ownFlag(flag); p.name=name; p.country=+k; for(const t of tiles) setOwner(t,p.id); continue; }
        const seeds=[]; for(let tries=0;tries<400&&seeds.length<parts;tries++){ const t=pick(tiles); const x=t%W,y=(t-x)/W; if(seeds.every(sd=>(sd%W-x)**2+((sd-sd%W)/W-y)**2>(Math.sqrt(tiles.length/parts)*0.6)**2)) seeds.push(t); }
        const hue=random()*360; const ids=seeds.map((sd,i)=>{ const p=makePlayer(`${name} (${mapGeneration.regionName(true)})`,hslHex((hue+i*23)%360,18+random()*10,44+random()*16),'neutral'); p.flag=ownFlag(flag); p.name=`${name} (${mapGeneration.regionName(true)})`; p.country=+k; return p.id; });
        let h=0,tl=0; const mine=new Uint8Array(W*H); for(const t of tiles) mine[t]=1;
        seeds.forEach((sd,i)=>{ setOwner(sd,ids[i]); q[tl++]=sd; });
        while(h<tl){ const c=q[h++]; const x=c%W,y=(c-x)/W, o=owner[c]; for(const [dx,dy] of N4){ if(!inb(x+dx,y+dy)) continue; const nn=idx(x+dx,y+dy); if(mine[nn]&&owner[nn]<0){ setOwner(nn,o); q[tl++]=nn; } } }
      }
      for(let t0=0;t0<W*H;t0++){ if(!land[t0]||owner[t0]>=0) continue;
        let h=0,tl=0; q[tl++]=t0; const chunk=[t0]; const seen=new Set([t0]);
        while(h<tl){ const c=q[h++]; const x=c%W,y=(c-x)/W; for(const [dx,dy] of N4){ if(!inb(x+dx,y+dy)) continue; const n=idx(x+dx,y+dy); if(land[n]&&owner[n]<0&&!seen.has(n)){ seen.add(n); q[tl++]=n; chunk.push(n); } } }
        const cx=chunk[0]%W, cy=(chunk[0]-cx)/W; let best=-1,bd=1e12;
        for(let rr=2;rr<=60&&best<0;rr+=2){ for(let y=cy-rr;y<=cy+rr;y+=1)for(let x=cx-rr;x<=cx+rr;x+=1){ if(!inb(x,y)) continue; const t=idx(x,y); if(owner[t]<0) continue; const d=(x-cx)**2+(y-cy)**2; if(d<bd){bd=d;best=owner[t];} } }
        if(best>=0) for(const t of chunk) setOwner(t,best); else for(const t of chunk) owner[t]=-2; }
      for(let t=0;t<W*H;t++) if(owner[t]===-2) owner[t]=-1;
      for(const p of players) if(p.kind==='neutral'){ p.troops=p.tiles*0.05+15; p.nextThink=rnd(1000,3000); }
      return; }
    const seeds=[];
    for(const r of regions){ if(r.size<regionMin) continue;
      const per=Math.max(tilesPerNeutral,mapState.landCount/75);
      const k=Math.max(1,Math.round(r.size/per));
      const tiles=[]; for(let t=0;t<W*H;t+=3) if(region[t]===r.id&&land[t]) tiles.push(t);
      for(let i=0;i<k;i++){ const p=makePlayer(mapGeneration.regionName(true),hslHex(random()*360,18+random()*10,48+random()*12),'neutral'); seeds.push([pick(tiles),p.id]); }
    }
    const q=new Int32Array(W*H); let h=0,tl=0;
    for(const [t,id] of seeds){ if(owner[t]<0){ setOwner(t,id); q[tl++]=t; } }
    while(h<tl){ const c=q[h++]; const x=c%W,y=(c-x)/W, o=owner[c];
      for(const [dx,dy] of N4){ if(!inb(x+dx,y+dy)) continue; const n=idx(x+dx,y+dy); if(land[n]&&owner[n]<0){ setOwner(n,o); q[tl++]=n; } } }
    for(let t0=0;t0<W*H;t0++){ if(!land[t0]||owner[t0]>=0) continue;
      let h=0,tl=0; q[tl++]=t0; const chunk=[t0]; const seen=new Set([t0]);
      while(h<tl){ const c=q[h++]; const x=c%W,y=(c-x)/W; for(const [dx,dy] of N4){ if(!inb(x+dx,y+dy)) continue; const n=idx(x+dx,y+dy); if(land[n]&&owner[n]<0&&!seen.has(n)){ seen.add(n); q[tl++]=n; chunk.push(n); } } }
      if(chunk.length>=80&&players.length<mapState.NP-1){ const p=makePlayer(mapGeneration.regionName(true),hslHex(random()*360,18+random()*10,48+random()*12),'neutral'); for(const t of chunk) setOwner(t,p.id); }
      else {
        const cx=chunk[0]%W, cy=(chunk[0]-cx)/W; let best=-1,bd=1e12;
        for(let rr=2;rr<=40&&best<0;rr+=2){ for(let y=cy-rr;y<=cy+rr;y+=1)for(let x=cx-rr;x<=cx+rr;x+=1){ if(!inb(x,y)) continue; const t=idx(x,y); if(owner[t]<0) continue; const d=(x-cx)**2+(y-cy)**2; if(d<bd){bd=d;best=owner[t];} } }
        if(best>=0) for(const t of chunk) setOwner(t,best); else for(const t of chunk) owner[t]=-2;
      }
    }
    for(let t=0;t<W*H;t++) if(owner[t]===-2) owner[t]=-1;
    for(const p of players) if(p.kind==='neutral'){ p.troops=p.tiles*0.05+15; p.nextThink=rnd(1000,3000); }
  }
  function setup(){
    mapGeneration.genMap();
    resetCountryPool(); if(setupState.chosenFlag) engineState.replaceCountryPool(setupState.countryPool.filter(i=>i!==setupState.chosenFlag.idx));
    const humanSeats=settings.humanSeats??1,humans=[];
    { const player=makePlayer('You',colors[0],'human'); humans.push(player); engineState.setPlayerId(player.id); } if(setupState.chosenFlag){ players[engineState.match.playerId].flag=ownFlag(setupState.chosenFlag); } const human=players[engineState.match.playerId]; human.name=human.flag.name; human.sx=null;
    for(let i=1;i<humanSeats;i++) humans.push(makePlayer(`Player ${i+1}`,colors[i],'human'));
    for(let i=0;i<bots+1-humanSeats;i++) makePlayer(botNames[i],colors[humanSeats+i],'bot');
    if(settings.customBots) for(const cb of settings.customBots){ const botPlayers=players.filter(q=>q.kind==='bot'); const b=botPlayers[Math.min(botPlayers.length-1,cb.slot|0)]; if(b){ b.flag=ownFlag({name:cb.name,layers:cb.layers,idx:-1,custom:true,userId:cb.userId}); b.name=cb.name; b.customNation={userId:cb.userId,name:cb.name}; onCustomBot(b); } }
    mapState.NP=256; mapState.regCount=new Int32Array(regions.length*mapState.NP);
    makeNeutrals();
    if(settings.risky){ for(const p of players) if(p.kind!=='neutral'){ p.sx=W/2; p.sy=H/2; } }
    else if(setupState.PRESET){
      const free=(cap=3000)=>players.filter(q=>q.kind==='neutral'&&q.alive&&q.tiles>=250&&q.tiles<=cap);
      const takeover=(p,c)=>{ for(let t=0;t<W*H;t++) if(owner[t]===c.id) setOwner(t,p.id); c.alive=false; c.tiles=0; const siblings=players.filter(q=>q.country===c.country).length; if(!(p.flag&&p.flag.custom)){ p.name=(c.country!=null&&siblings===1)?setupState.PRESET.names[c.country]:c.name; p.flag=ownFlag(c.flag); } p.country=c.country; const ce=calculateCentroid(W,H,owner,p); p.sx=ce[0]; p.sy=ce[1]; };
      const want=setupState.chosenFlag?players.filter(q=>q.kind==='neutral'&&q.alive&&q.country!=null&&(setupState.PRESET.names[q.country]===setupState.chosenFlag.name||countryAliases[setupState.PRESET.names[q.country]]===setupState.chosenFlag.name)).sort((a,b)=>b.tiles-a.tiles)[0]:null;
      takeover(human, want&&want.tiles>=120?want:pick(free(4000).sort((a,b)=>b.tiles-a.tiles).slice(0,25)));
      for(const p of players){ if(p.kind==='neutral'||p===human) continue; const cands=free().filter(q=>{ const c=calculateCentroid(W,H,owner,q); return players.every(o=>o.sx==null||(o.sx-c[0])**2+(o.sy-c[1])**2>60*60); }).sort((a,b)=>b.tiles-a.tiles).slice(0,12); const c=cands.length?pick(cands):pick(free()); if(c) takeover(p,c); else { const s2=findSpawn(18)||[W>>1,H>>1]; p.sx=s2[0]; p.sy=s2[1]; claimBlob(p,s2[0],s2[1],9); } }
    } else for(const p of players){ if(p.kind==='neutral') continue;
      const s=findSpawn(settings.map.startsWith('islands')?36:60)||findSpawn(18)||[W>>1,H>>1];
      p.sx=s[0];p.sy=s[1]; claimBlob(p,s[0],s[1],9);
    }
    if(settings.endgame){
      const q=new Int32Array(W*H); let h=0,tl=0; for(let t=0;t<W*H;t++){ if(owner[t]>=0&&players[owner[t]].kind!=='neutral') q[tl++]=t; }
      while(h<tl){ const c=q[h++]; const x=c%W,y=(c-x)/W, o=owner[c]; for(const [dx,dy] of N4){ if(!inb(x+dx,y+dy)) continue; const n=idx(x+dx,y+dy); if(land[n]&&(owner[n]<0||players[owner[n]].kind==='neutral')){ if(struct[n]) structuresSystem.captureStructure(n,players[o]); setOwner(n,o); q[tl++]=n; } } }
      for(let t=0;t<W*H;t++){ if(!land[t]||(owner[t]>=0&&players[owner[t]].kind!=='neutral')) continue;
        const x=t%W,y=(t-x)/W; let best=-1,bd=1e12; for(const p of players){ if(p.kind==='neutral'||p.sx==null) continue; const d=(p.sx-x)**2+(p.sy-y)**2; if(d<bd){bd=d;best=p.id;} } if(best>=0) setOwner(t,best); }
      for(const p of players) if(p.kind==='neutral'){ p.alive=false; p.tiles=0; }
      for(const p of players) if(p.kind!=='neutral'){ const c=calculateCentroid(W,H,owner,p); p.sx=c[0]; p.sy=c[1]; }
    }
    if(settings.quick&&!settings.endgame&&!settings.risky){
      for(const p of players){ if(p.kind==='neutral') continue;
        for(let guard=0;guard<40&&p.tiles<quickTiles;guard++){ const {r}=borderOwners(p); const nb=Object.keys(r).map(Number).filter(o=>players[o].kind==='neutral'&&players[o].alive).sort((a,b)=>r[b]-r[a]);
          if(!nb.length) break; const c=players[nb[0]]; for(let t=0;t<W*H;t++) if(owner[t]===c.id) setOwner(t,p.id); for(const st of structures) if(st.owner===c.id) structuresSystem.captureStructure(st.t,p); c.alive=false; c.tiles=0; }
        const ce=calculateCentroid(W,H,owner,p); p.sx=ce[0]; p.sy=ce[1]; } }
    for(let t=0;t<W*H;t++) if(land[t]&&owner[t]<0) unclaimed.add(t);
    for(const p of players) if(p.kind==='neutral'&&p.tiles<=0) p.alive=false;
    for(const player of humans){ player.troops=settings.troops; player.gold=settings.gold; } if(settings.bots) for(const p of players) if(p.kind==='bot'){ p.troops=settings.troops; p.gold=settings.gold; }
    if(settings.quick&&!settings.endgame) for(const p of players) if(p.kind!=='neutral'){ p.troops*=4; p.gold*=5; }
    if(settings.endgame) for(const p of players) if(p.kind!=='neutral'){ p.troops=45000; p.gold=15000; }
    if(settings.billionaire) for(const player of humans){ player.troops=1e9; player.gold=1e9; }
    logistics.rebuildAreas();
    if(settings.risky) startDraft();
    if(settings.teams>0){ const ps=players.filter(q=>q.kind!=='neutral'); ps.forEach((q,i)=>{ q.team=i%settings.teams; }); }
    onSetupComplete();
  }

  return Object.freeze({setup,resetCountryPool,takeCountry,countryByIdx,makeNeutrals,makePlayer});
}
