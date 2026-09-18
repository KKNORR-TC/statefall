const noop=()=>{};

export function createDiplomacySystem({
  engineState,random,pick,getMe,
  napTicks,betrayTicks,proposalTtl,provokeTicks,
  botLevel,getBotDifficulty,neutralShare,maxTroops,density,
  sendGold,sendTroops,
  effects={}
}){
  const clock=engineState.clock,map=engineState.map;
  const {players,attacks}=engineState.actors;
  const {hostile,proposals}=engineState.diplomacy;
  const fail=effects.fail||noop,log=effects.log||noop,sound=effects.sound||noop;
  const incrementStat=effects.incrementStat||noop,timeline=effects.timeline||noop;
  const notice=effects.notice||noop,proposalNotice=effects.proposalNotice||noop;

  function relation(a,b){ if(a.team!=null&&a.team===b.team&&a!==b) return {type:'ally',until:Infinity,team:true}; const r=a.rel[b.id]; return r&&!(r.type==='nap'&&r.until<=clock.tickN)?r:null; }
  function atPeace(aId,bId){ if(aId<0||bId<0||aId===bId) return false; const a=players[aId],b=players[bId]; if(a.kind==='neutral'||b.kind==='neutral') return false; return !!relation(a,b); }
  function setRelation(a,b,type){ const r={type,until:type==='nap'?clock.tickN+napTicks:Infinity,since:clock.tickN}; a.rel[b.id]=r; b.rel[a.id]=r; if(a===getMe()||b===getMe()){ const o=a===getMe()?b:a; incrementStat(type==='ally'?'alliances':'pacts'); timeline(`${type==='ally'?'Alliance':'Pact'} with ${o.name}`,'diplo'); } if(a===getMe()||b===getMe()){ const other=a===getMe()?b:a; other.handshake=clock.tickN+120; }
    engineState.retainActors('attacks',x=>{ const hit=(x.owner===a.id&&x.target===b.id)||(x.owner===b.id&&x.target===a.id); if(hit) players[x.owner].troops+=x.troops*0.9; return !hit; });
    engineState.retainActors('transports',x=>{ const hit=(x.owner===a.id&&x.target===b.id)||(x.owner===b.id&&x.target===a.id); if(hit) players[x.owner].troops+=x.troops; return !hit; }); }
  function breakRelation(a,b){ const r=relation(a,b); if(!r) return false; if(r.team){ if(a===getMe()) fail('Teammates cannot go to war.'); return false; } delete a.rel[b.id]; delete b.rel[a.id];
    if(a===getMe()||b===getMe()){ const other=a===getMe()?b:a; other.heartbreak=clock.tickN+150; getMe().heartbreak=clock.tickN+150; if(a===getMe()){ incrementStat('betrayals'); timeline(`Broke with ${other.name}`,'diplo'); } else { incrementStat('betrayed'); timeline(`Betrayed by ${other.name}`,'diplo'); } }
    a.penaltyUntil=clock.tickN+betrayTicks*(r.type==='ally'?2:1); a.rep=Math.max(0,a.rep-(r.type==='ally'?0.4:0.25)); if(b.kind==='bot') b.rep=Math.min(1,b.rep+0.05);
    log(`${a.name} broke ${r.type==='ally'?'the alliance':'the pact'} with ${b.name}!`,a===getMe()||b===getMe()); if(a===getMe()||b===getMe()) sound('pushback'); return true; }
  function botConsider(bot,from,type){ if(botLevel(bot)>=3&&from.tiles/map.landCount>=0.45&&type==='nap') return false;
    if(relation(bot,from)) return false;
    const str=from.tiles/Math.max(1,bot.tiles); const busy=attacks.some(x=>x.owner===bot.id&&x.target!==from.id)||attacks.some(x=>x.target===bot.id&&x.owner!==from.id);
    let pr=0.15+from.rep*0.4+(str>1.2?0.3:str<0.6?-0.2:0)+(busy?0.25:0)-(neutralShare()<0.15?0.1:0);
    if(type==='ally') pr-=0.25; pr/=getBotDifficulty(bot).aggr; return random()<Math.max(0.03,Math.min(0.95,pr)); }
  function propose(from,to,type){
    if(from===getMe()){ const last=from.lastProposal[to.id]||-1e9; if(clock.tickN-last<300) return fail(`${to.name} isn't ready to talk again yet.`); from.lastProposal[to.id]=clock.tickN;
      if(botConsider(to,from,type)){ setRelation(from,to,type); log(`${to.name} accepted ${type==='ally'?'an alliance':'a non-aggression pact'}.`,true); sound('unified'); notice({kind:'good',flag:to.flag,title:`${to.name} accepted`,text:type==='ally'?'You are now allies.':'Non-aggression pact for three minutes.',ttl:8000}); }
      else { log(`${to.name} declined ${type==='ally'?'the alliance':'the pact'}.`,true); sound('error'); notice({kind:'warn',flag:to.flag,title:`${to.name} declined`,text:type==='ally'?'No alliance — they are not convinced yet.':'No pact — try again later.',ttl:8000}); } return; }
    if(to===getMe()){ if(proposals.some(q=>q.from===from.id)) return; proposals.push({from:from.id,type,until:clock.tickN+proposalTtl}); log(`${from.name} proposes ${type==='ally'?'an alliance':'a non-aggression pact'}.`,true); sound('foghorn');
      proposalNotice({from,type,ttl:proposalTtl*100,isPending:()=>proposals.some(q=>q.from===from.id)}); return; }
    if(botConsider(to,from,type)) setRelation(from,to,type);
  }
  function acceptFor(actor,fromId,type,amt){ const from=players[fromId]; engineState.retainProposals(q=>q.from!==from.id); if(type==='reqTroops') aidTroops(actor,from,amt); else if(type==='reqGold') aidGold(actor,from,amt); else { setRelation(actor,from,type); log(`${type==='ally'?'Alliance':'Pact'} with ${from.name}.`,true); sound('unified'); } }
  function accept(fromId,type,amt){ return acceptFor(getMe(),fromId,type,amt); }
  function declineFor(actor,fromId){ engineState.retainProposals(q=>q.from!==fromId); }
  function decline(fromId){ return declineFor(getMe(),fromId); }
  function aidTroops(from,to,amt){ return sendTroops(from,to,amt); }
  function aidGold(from,to,amt){ return sendGold(from,to,amt); }
  function stepDiplomacy(){
    for(const p of players) for(const key in p.rel){ const r=p.rel[key]; if(r.type==='nap'&&r.until<=clock.tickN){ delete p.rel[key]; const other=players[key]; if(other) delete other.rel[p.id]; } }
    engineState.retainProposals(q=>q.until>clock.tickN&&players[q.from].alive);
    if(clock.tickN%40) return;
    const ns=neutralShare();
    for(const p of players){ if(p.kind!=='bot'||!p.alive) continue;
      for(const a of attacks){ if(a.target!==p.id) continue; const from=players[a.owner]; if(from.kind==='neutral'||relation(p,from)) continue;
        if(from.tiles>p.tiles*1.3&&random()<0.12/getBotDifficulty(p).aggr) propose(p,from,'nap'); }
      for(const k in p.rel){ const q=players[k]; const r=relation(p,q); if(!r||r.type!=='ally'||q!==getMe()) continue;
        const under=attacks.some(a=>a.target===p.id&&players[a.owner].kind!=='neutral');
        if(under&&p.troops<maxTroops(p)*0.35&&random()<0.15&&!proposals.some(x=>x.from===p.id)){ proposals.push({from:p.id,type:'reqTroops',amt:Math.round(maxTroops(p)*0.25),until:clock.tickN+proposalTtl}); log(`${p.name} asks for ${Math.round(maxTroops(p)*0.25)} troops.`,true); sound('foghorn'); }
        else if(p.gold<120&&random()<0.06&&!proposals.some(x=>x.from===p.id)){ proposals.push({from:p.id,type:'reqGold',amt:200,until:clock.tickN+proposalTtl}); log(`${p.name} asks for 200 gold.`,true); } }
      if(random()<0.02){ const cand=players.filter(q=>q!==p&&q.alive&&q.kind!=='neutral'&&!relation(p,q)&&q.tiles>p.tiles*0.7); if(cand.length) propose(p,pick(cand),'nap'); }
      if(ns<0.15) for(const k in p.rel){ const q=players[k]; const r=relation(p,q); if(!r) continue;
        if(q.tiles<p.tiles*0.5&&density(q)<density(p)*0.6&&random()<0.02*getBotDifficulty(p).aggr) breakRelation(p,q); }
    }
  }
  function markHostile(a,b){ if(a<0||b<0||a===b) return; hostile[a+','+b]=clock.tickN; hostile[b+','+a]=clock.tickN; }
  function inConflict(a,b){ if(a===b) return false; if(atPeace(a,b)) return false; const h=hostile[a+','+b]; return h!=null&&clock.tickN-h<600; }
  function isProvokedBy(player,id,margin){ return player.grudge[id]!=null&&clock.tickN-player.grudge[id]<provokeTicks-margin; }
  function isProvoked(player){ for(const k in player.grudge) if(clock.tickN-player.grudge[k]<provokeTicks) return true; return false; }

  return Object.freeze({relation,atPeace,setRelation,breakRelation,botConsider,propose,accept,acceptFor,decline,declineFor,stepDiplomacy,aidTroops,aidGold,markHostile,inConflict,isProvokedBy,isProvoked});
}
