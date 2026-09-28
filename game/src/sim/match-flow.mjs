const noop=()=>{};

export function createMatchFlow({
  W,H,engineState,random,pick,getMe,winShare,teamNames,
  landCombat,structures,diplomacy,borders,isReplay=()=>false,isCreditsMode=()=>false,canEnd=()=>true,
  ports={}
}){
  const map=engineState.map,draft=engineState.draft,lifecycle=engineState.lifecycle;
  const {players}=engineState.actors;
  const setOwner=landCombat.setOwner,captureStructure=structures.captureStructure;
  const relation=diplomacy.relation,breakRelation=diplomacy.breakRelation;
  const borderOwners=borders.borderOwners,calculateCentroid=borders.calculateCentroid;
  const log=ports.log||noop,sound=ports.sound||noop,invalidateUi=ports.invalidateUi||noop;
  const matchEnded=ports.matchEnded||noop,alliedDecisionRequested=ports.alliedDecisionRequested||noop;
  const draftCompleted=ports.draftCompleted||noop;

  function endMatch(title,text,metadata){
    if(!canEnd()) return false;
    if(isCreditsMode()){ engineState.setLifecycle('over',true); return true; }
    if(lifecycle.over||(lifecycle.freeplay&&title!=='Overrun'&&title!=='Total victory')) return false;
    engineState.setLifecycle('over',true);
    matchEnded(title,text,...(metadata===undefined?[]:[metadata]));
    return true;
  }

  function continueAfterEnd(won){
    if(!lifecycle.over) return false;
    engineState.setLifecycle('over',false);
    engineState.setLifecycle('freeplay',true);
    if(!won) engineState.setLifecycle('spectating',true);
    log(won?'Victory declared — the war goes on.':'Spectating.',true);
    return true;
  }

  function startDraft(){
    const ps=players.filter(player=>player.kind!=='neutral');
    for(let i=ps.length-1;i>0;i--){ const j=Math.floor(random()*(i+1)); [ps[i],ps[j]]=[ps[j],ps[i]]; }
    const per=Math.max(2,Math.min(8,Math.round(map.landCount/12000)));
    draft.draft={order:ps,idx:0,per,round:0,timer:0,iv:null};
    draft.draftTicks=0;
    engineState.setLifecycle('paused',true);
    log(`Risky start: ${per} picks each, round robin. ${ps[0]===getMe()?'You pick first.':ps[0].name+' picks first.'}`,true);
  }

  function draftPick(player,country){
    let sx=0,sy=0,n=0;
    for(let tile=0;tile<W*H;tile++) if(map.owner[tile]===country.id){
      if(map.struct[tile]) captureStructure(tile,player);
      setOwner(tile,country===player?map.owner[tile]:player.id);
      sx+=tile%W; sy+=(tile-tile%W)/W; n++;
    }
    country.alive=false; country.tiles=0;
    const centroid=calculateCentroid(player); player.sx=centroid[0]; player.sy=centroid[1];
    if(n) draft.draftPicks.push({owner:player.id,x:sx/n+.5,y:sy/n+.5,name:country.name,n:draft.draftPicks.filter(value=>value.owner===player.id).length+1,at:engineState.clock.tickN});
    log(`${player===getMe()?'You':player.name} picked ${country.name}.`,player===getMe());
    if(player===getMe()) sound('conquered');
  }

  function draftAdvance(){
    if(!draft.draft) return false;
    draft.draft.idx++;
    if(draft.draft.idx>=draft.draft.order.length){ draft.draft.idx=0; draft.draft.round++; }
    if(draft.draft.round<draft.draft.per) return false;
    draft.draft=null;
    draftCompleted();
    engineState.setLifecycle('paused',lifecycle.userPaused);
    log('Draft complete — the war begins.',true);
    sound('unified');
    for(const player of players) if(player.kind==='neutral'&&player.tiles<=0) player.alive=false;
    invalidateUi();
    return true;
  }

  function draftStep(){
    if(!draft.draft) return;
    const player=draft.draft.order[draft.draft.idx];
    const free=players.filter(value=>value.kind==='neutral'&&value.alive&&value.tiles>=120);
    if(!free.length){ draftAdvance(); return; }
    if(player===getMe()) return;
    let country=null;
    if(player.tiles>0){
      const {r}=borderOwners(player);
      const adjacent=Object.keys(r).map(Number).map(id=>players[id]).filter(value=>value.kind==='neutral'&&value.alive&&value.tiles>=120).sort((a,b)=>b.tiles-a.tiles);
      if(adjacent.length) country=adjacent[0];
    }
    if(!country) country=pick(free.sort((a,b)=>b.tiles-a.tiles).slice(0,6));
    draftPick(player,country);
    draftAdvance();
  }

  function advanceDraft(){
    if(!draft.draft) return;
    draft.draftTicks++;
    if(draft.draftTicks%6===0) draftStep();
  }

  function togglePause(){
    if(lifecycle.over||!getMe()||draft.draft) return false;
    engineState.setLifecycle('userPaused',!lifecycle.userPaused);
    engineState.setLifecycle('paused',lifecycle.userPaused);
    return true;
  }

  function evaluateOutcomes(){
    const human=getMe();
    if(!human) return;
    if(!human.alive&&!lifecycle.spectating) endMatch('Overrun','Your nation has been erased from the map.');
    const teamTiles=team=>players.filter(value=>value.alive&&value.team===team).reduce((sum,value)=>sum+value.tiles,0);
    const share=(human.team!=null?teamTiles(human.team):human.tiles)/map.landCount;
    const rivalsLeft=players.some(value=>value.alive&&value.kind!=='neutral'&&value!==human&&!(human.team!=null&&value.team===human.team));
    if(human.alive&&(share>=0.999||(!rivalsLeft&&!players.some(value=>value.alive&&value.kind==='neutral')))) endMatch('Total victory',human.team!=null?`Team ${teamNames[human.team]} holds the entire world.`:'The whole world is yours.');
    if(share>=winShare) endMatch(human.team!=null?'Team victory':'Victory',(human.team!=null?`Team ${teamNames[human.team]} controls `:'You control ')+Math.round(share*100)+'% of the land.');
    if(human.team!=null){
      for(let team=0;team<engineState.rules.settings.teams;team++) if(team!==human.team){ const tiles=teamTiles(team); if(tiles/map.landCount>=winShare) endMatch('Defeat',`Team ${teamNames[team]} now controls ${Math.round(tiles/map.landCount*100)}% of the land.`); }
    }else{
      const leader=players.filter(player=>player.alive&&player!==human&&player.kind!=='neutral').find(player=>player.tiles/map.landCount>=winShare);
      if(leader) endMatch('Defeat',leader.name+' now controls '+Math.round(leader.tiles/map.landCount*100)+'% of the land.');
    }
  }

  function checkAlliedEndgame(){
    const human=getMe();
    if(lifecycle.decided||lifecycle.over||lifecycle.paused||!human.alive) return false;
    const rivals=players.filter(player=>player.alive&&player!==human&&player.kind!=='neutral');
    if(!rivals.length||!rivals.every(player=>relation(human,player)?.type==='ally')) return false;
    if(rivals.every(player=>player.team!=null&&player.team===human.team)){
      engineState.setLifecycle('decided',true);
      endMatch('Team victory',`Team ${teamNames[human.team]} is the last one standing.`);
      return true;
    }
    if(players.some(player=>player.alive&&player.kind==='neutral'&&player.tiles>200)) return false;
    engineState.setLifecycle('decided',true);
    if(!isReplay()) engineState.setLifecycle('paused',true);
    const decision={type:'allied-endgame',rivalIds:rivals.map(player=>player.id)};
    engineState.setPendingDecision(decision);
    alliedDecisionRequested(decision);
    return true;
  }

  function resolveSharedVictory(){
    const decision=engineState.pendingDecision;
    if(!decision||decision.type!=='allied-endgame') return false;
    const human=getMe(),rivals=decision.rivalIds.map(id=>players[id]).filter(Boolean);
    engineState.setPendingDecision(null);
    engineState.setLifecycle('paused',lifecycle.userPaused);
    const refuse=rivals.filter(player=>{ const ratio=human.tiles/Math.max(1,player.tiles); const chance=ratio>=1.2?0.9:ratio>=0.8?0.6:0.3; return random()>chance*Math.min(1,human.rep+0.3); });
    if(!refuse.length){
      engineState.setLifecycle('over',false); engineState.setLifecycle('freeplay',false);
      const names=rivals.map(player=>player.name).join(', ');
      endMatch('Shared victory',`You and ${names} end the war as allies, holding ${Math.round(players.filter(player=>player.alive&&player.kind!=='neutral').reduce((sum,player)=>sum+player.tiles,0)/map.landCount*100)}% of the land together.`);
    }else{
      for(const player of refuse){ log(`${player.name} refuses to share the world.`,true); breakRelation(player,human); player.nextThink=0; player.focus=0.85; }
      sound('pushback');
    }
    return true;
  }

  function continueWar(){
    const decision=engineState.pendingDecision;
    if(!decision||decision.type!=='allied-endgame') return false;
    const human=getMe(),rivals=decision.rivalIds.map(id=>players[id]).filter(Boolean);
    engineState.setPendingDecision(null);
    engineState.setLifecycle('paused',lifecycle.userPaused);
    for(const player of rivals) breakRelation(human,player);
    return true;
  }

  return Object.freeze({startDraft,draftPick,draftAdvance,draftStep,advanceDraft,togglePause,evaluateOutcomes,checkAlliedEndgame,resolveSharedVictory,continueWar,endMatch,continueAfterEnd});
}
