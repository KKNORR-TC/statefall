'use strict';

const {createHash}=require('node:crypto');

function digest(S){
  return createHash('sha256').update(S.serializeCanonicalState()).digest('hex');
}

function ownTiles(S){
  const out=[];
  for(let tile=0;tile<S.W*S.H;tile++) if(S.owner[tile]===S.me.id) out.push(tile);
  return out;
}

function enemyTiles(S){
  const out=[];
  for(let tile=0;tile<S.W*S.H;tile++) if(S.land[tile]&&S.owner[tile]>=0&&S.owner[tile]!==S.me.id) out.push(tile);
  return out;
}

function borderTiles(S){
  return enemyTiles(S).filter(tile=>{
    const x=tile%S.W,y=(tile-x)/S.W;
    return [[1,0],[-1,0],[0,1],[0,-1]].some(([dx,dy])=>S.inb(x+dx,y+dy)&&S.owner[S.idx(x+dx,y+dy)]===S.me.id);
  });
}

function coastWater(S,tile){
  const x=tile%S.W,y=(tile-x)/S.W;
  for(let radius=1;radius<=8;radius++) for(let dy=-radius;dy<=radius;dy++) for(let dx=-radius;dx<=radius;dx++){
    if(!S.inb(x+dx,y+dy)) continue;
    const candidate=S.idx(x+dx,y+dy);
    if(!S.land[candidate]) return candidate;
  }
  return -1;
}

function issueScheduled(S,tick,coverage){
  const own=ownTiles(S),enemy=enemyTiles(S),border=borderTiles(S);
  if(tick===5) S.issue('focus',.37);
  if(tick===15&&border.length) S.issueClick(border[0],{ratio:34,pick:null,build:null});
  if(tick===25&&own.length) S.issueClick(own[Math.floor(own.length/3)],{ratio:50,pick:null,build:'city'});
  if(tick===35&&own.length) S.issueMenu({act:'build',type:'factory'},own[Math.floor(own.length/2)],[],-1,50,0,0);
  if(!coverage.includes('advanced')) return;
  if(tick===45&&own.length) S.issueMenu({act:'build',type:'port'},own[0],[],-1,50,0,0);
  if(tick===55&&own.length) S.issueMenu({act:'build',type:'silo'},own[Math.floor(own.length*.7)],[],-1,50,0,0);
  if(tick===65&&own.length) S.issueMenu({act:'build',type:'airfield'},own[Math.floor(own.length*.85)],[],-1,50,0,0);
  if(tick===75){ const site=S.structures.find(value=>value.owner===S.me.id&&!value.building&&['port','airfield'].includes(value.type)); if(site) S.issueMenu({act:'upgrade'},site.t,[],site.t,50,0,0); }
  if(tick===85){ const port=S.structures.find(value=>value.owner===S.me.id&&value.type==='port'&&!value.building); if(port){ const water=coastWater(S,port.t); if(water>=0) S.issueMenu({act:'warship',cls:'warship'},water,[],-1,50,0,0); } }
  if(tick===105&&enemy.length) S.issueMenu({act:'transport'},enemy[Math.floor(enemy.length/2)],[],-1,20,0,0);
  if(tick===125&&enemy.length) S.issueMenu({act:'nuke'},enemy[0],[],-1,50,0,0);
  if(tick===145){ const airfield=S.structures.find(value=>value.owner===S.me.id&&value.type==='airfield'&&!value.building); if(airfield) S.issueMenu({act:'buyf'},airfield.t,[],airfield.t,50,0,0); }
  if(tick===165&&enemy.length) S.issueMenu({act:'plane'},enemy[Math.floor(enemy.length*.7)],[],-1,50,0,0);
  if(tick===185&&enemy.length) S.issueMenu({act:'nap'},enemy[0],[],-1,50,0,0);
  if(tick===205&&enemy.length) S.issueMenu({act:'giveGold'},enemy[0],[],-1,50,75,0);
  if(tick===225&&enemy.length) S.issueMenu({act:'giveTroops'},enemy[0],[],-1,50,0,12);
  if(tick===245) S.issue('airAuto',false);
  if(tick===265) S.issue('logAuto',false);
  if(tick===285) S.issue('autoFire',false);
}

function checkpoint(S,legacyHash,commandCount,replayCursor){
  return {tick:S.tickN,legacyHash,canonical:{version:S.stateOracleVersion,sha256:digest(S)},rngDraws:S.srandN,commandCount,replayCursor};
}

function bootOptions(scenario){
  return {...scenario.settings,seed:scenario.seed,diff:scenario.settings.diff,countryIdx:scenario.settings.country,gridW:scenario.grid.width,gridH:scenario.grid.height,render:false};
}

function performPauseProbe(game){
  const {S}=game,before=S.tickN;
  S.userPaused=true; S.paused=true;
  game.tick();
  if(S.tickN!==before) throw new Error(`pause probe advanced from ${before} to ${S.tickN}`);
  S.issue('focus',.62);
  S.userPaused=false; S.paused=false;
}

function recordScenario(scenario,boot){
  const game=boot(bootOptions(scenario)),{S}=game,checkpoints=[];
  const observed={structures:new Set(),maxWarships:0,maxTransports:0,maxMissiles:0,maxAircraft:0,maxAttacks:0};
  const observe=()=>{
    for(const structure of S.structures) if(structure.owner===S.me.id) observed.structures.add(structure.type);
    observed.maxWarships=Math.max(observed.maxWarships,S.warships.length);
    observed.maxTransports=Math.max(observed.maxTransports,S.transports.length);
    observed.maxMissiles=Math.max(observed.maxMissiles,S.missiles.length);
    observed.maxAircraft=Math.max(observed.maxAircraft,S.aircraft.length);
    observed.maxAttacks=Math.max(observed.maxAttacks,S.attacks.length);
  };
  let pauseDone=false,draftAttempts=0;
  while(S.tickN<scenario.ticks){
    if(scenario.settings.risky&&S.tickN===0){
      const available=S.players.filter(player=>player.kind==='neutral'&&player.alive&&player.tiles>=120);
      if(S.draft&&S.draft.order[S.draft.idx]===S.me&&available.length){
        const selected=available.sort((a,b)=>b.tiles-a.tiles||a.id-b.id)[0],tile=S.owner.findIndex(owner=>owner===selected.id);
        if(tile>=0) S.issueClick(tile,{ratio:50,pick:null,build:null});
      }else game.tick();
      if(++draftAttempts>500) throw new Error(`${scenario.name}: risky draft did not complete (${S.players.map(player=>`${player.id}:${player.kind}:${player.alive}:${player.tiles}`).join(',')})`);
      continue;
    }
    if(!pauseDone&&scenario.controls.pauseAtTick===S.tickN){ performPauseProbe(game); pauseDone=true; }
    issueScheduled(S,S.tickN,scenario.coverage);
    game.tick();
    observe();
    if(S.tickN>0&&S.tickN%100===0&&checkpoints.at(-1)?.tick!==S.tickN){
      const historical=S.CMD.hashes.find(value=>value[0]===S.tickN);
      if(!historical) throw new Error(`${scenario.name}: missing historical checkpoint ${S.tickN}`);
      checkpoints.push(checkpoint(S,historical[1],S.CMD.log.length,null));
    }
  }
  return {
    schema:'statefall-replay-fixture/v1',v:1,hashv:2,game:'1.10.9',name:scenario.name,seed:scenario.seed,requiresCanonicalCheckpoints:true,
    settings:{...scenario.settings,seed:scenario.seed,customBots:scenario.settings.customBots||null,customFlag:null,allowed:null},grid:scenario.grid,
    controls:scenario.controls,coverage:scenario.coverage,observations:{...observed,structures:[...observed.structures].sort()},cmds:S.CMD.log.map(value=>structuredClone(value)),
    hashes:checkpoints.map(value=>[value.tick,value.legacyHash,{canonical:value.canonical,rngDraws:value.rngDraws,commandCount:value.commandCount,replayCursor:value.replayCursor}]),
    checkpoints,tick:scenario.ticks,final:{...checkpoint(S,S.stateHash(),S.CMD.log.length,null),tick:S.tickN}
  };
}

function replayScenario(fixture,boot,{assertions=true}={}){
  const game=boot({...bootOptions(fixture),...fixture.grid&&{gridW:fixture.grid.width,gridH:fixture.grid.height}}),{S}=game;
  let drafting=!!fixture.settings.risky;
  S.REPLAY.on=!drafting; S.REPLAY.hashv=fixture.hashv; S.REPLAY.cmds=fixture.cmds; S.REPLAY.i=0;
  S.REPLAY.hashes=fixture.hashes; S.REPLAY.mismatch=false; S.REPLAY.speed=1; S.REPLAY.toTick=fixture.tick;
  const actual=[],errors=[];
  let pauseDone=false,takeoverDone=false;
  while(S.tickN<fixture.tick){
    if(drafting&&S.tickN===0){
      if(S.draft&&S.draft.order[S.draft.idx]===S.me){
        const command=fixture.cmds[S.REPLAY.i];
        if(!command||command.t!==0) throw new Error(`${fixture.name}: no recorded risky-draft pick for the human turn`);
        S.replayApply(command); S.REPLAY.i++;
      }else game.tick();
      if(S.tickN>0){ drafting=false; S.REPLAY.on=true; }
      continue;
    }
    if(!pauseDone&&fixture.controls.pauseAtTick===S.tickN){ performPauseProbe(game); pauseDone=true; }
    if(!takeoverDone&&fixture.controls.takeoverAtTick===S.tickN){
      if(typeof S.takeOverReplay==='function') S.takeOverReplay();
      else { S.REPLAY.on=false; S.CMD.log=S.REPLAY.cmds.slice(0,S.REPLAY.i); }
      takeoverDone=true;
    }
    game.tick();
    if(S.tickN>0&&S.tickN%100===0&&actual.at(-1)?.tick!==S.tickN){
      const expected=fixture.checkpoints.find(value=>value.tick===S.tickN);
      const recorded=S.CMD.hashes.find(value=>value[0]===S.tickN);
      actual.push(checkpoint(S,recorded?recorded[1]:expected.legacyHash,S.CMD.log.length,S.REPLAY.i));
      if(assertions){
        for(const key of ['legacyHash','rngDraws']) if(actual.at(-1)[key]!==expected[key]) errors.push(`${fixture.name} tick ${S.tickN} ${key}: expected ${expected[key]}, got ${actual.at(-1)[key]}`);
        if(actual.at(-1).canonical.sha256!==expected.canonical.sha256) errors.push(`${fixture.name} tick ${S.tickN} canonical: expected ${expected.canonical.sha256}, got ${actual.at(-1).canonical.sha256}`);
        if(actual.at(-1).replayCursor!==expected.commandCount) errors.push(`${fixture.name} tick ${S.tickN} cursor: expected ${expected.commandCount}, got ${actual.at(-1).replayCursor}`);
      }
    }
  }
  S.resolveReplayCommands();
  const final=checkpoint(S,S.stateHash(),S.CMD.log.length,S.REPLAY.i);
  if(assertions){
    if(S.REPLAY.mismatch) errors.push(`${fixture.name} legacy replay mismatch at ${S.REPLAY.divTick}`);
    if(final.legacyHash!==fixture.final.legacyHash) errors.push(`${fixture.name} final legacy hash mismatch`);
    if(final.canonical.sha256!==fixture.final.canonical.sha256) errors.push(`${fixture.name} final canonical digest mismatch`);
    if(final.rngDraws!==fixture.final.rngDraws) errors.push(`${fixture.name} final RNG count mismatch`);
    if(final.replayCursor!==fixture.cmds.length) errors.push(`${fixture.name} applied ${final.replayCursor}/${fixture.cmds.length} commands`);
  }
  return {actual,final,errors};
}

function worker(){
  const fs=require('node:fs'),boot=require(process.env.STATEFALL_PARITY_HARNESS);
  const request=JSON.parse(fs.readFileSync(0,'utf8'));
  const result=request.mode==='record'?recordScenario(request.scenario,boot):replayScenario(request.fixture,boot);
  process.stdout.write(JSON.stringify(result));
}

if(require.main===module) worker();
module.exports={recordScenario,replayScenario};
