const assert=require('node:assert/strict'),fs=require('fs'),{createHash}=require('crypto'),boot=require('../harness'),{replayScenario}=require('../parity-corpus-driver');
function campaign(options={}){
 let awaitingDecision=false;
 const settings={map:'random',diff:'normal',seed:'SOAK01',countryIdx:0,...options},limit=settings.ticks||3600,endings=[],game=boot({...settings,allowEnd:true,eventSink:event=>{if(event.type==='alliedDecisionRequested')awaitingDecision=true;if(event.type==='matchEnded')endings.push({tick:game.S.tickN,title:event.args?.[0]});}}),{S,engine}=game,checkpoints=[],durations=[],slowTicks=[],events=[],actors=engine.compatibility.state.actors;
 const observed={maxStructures:0,maxShips:0,maxAir:0,maxAttacks:0,maxTrucks:0},start=performance.now();
 const observe=()=>{for(const [key,list]of Object.entries({maxStructures:actors.structures,maxShips:actors.warships,maxAir:actors.aircraft,maxAttacks:actors.attacks,maxTrucks:actors.trucks}))observed[key]=Math.max(observed[key],list.length);};
 let draftAttempts=0;
 while(S.tickN<limit){
  if(S.over){if(!settings.continueMatches||endings.at(-1)?.title==='Total victory')break;S.issue('continueAfterEnd',S.me.alive);assert.equal(S.over,false,'continuation rejected');}
  if(settings.risky&&S.tickN===0){const available=S.players.filter(p=>p.kind==='neutral'&&p.alive&&p.tiles>=120).sort((a,b)=>b.tiles-a.tiles||a.id-b.id);if(S.draft&&S.draft.order[S.draft.idx]===S.me&&available.length)S.issueClick(S.owner.findIndex(id=>id===available[0].id),{ratio:50,pick:null,build:null});else game.tick();assert.ok(++draftAttempts<700,'draft stalled');continue;}
  if(awaitingDecision){S.issue('decWar');awaitingDecision=false;}
  if(S.me.alive&&S.tickN%30===0){
   const id=S.me.id,owner=S.owner,W=S.W,H=S.H,targets=new Map();
   for(let t=0;t<owner.length;t++){const target=owner[t];if(!S.land[t]||target===id||targets.has(target))continue;const x=t%W,y=Math.floor(t/W);if(x&&owner[t-1]===id||x<W-1&&owner[t+1]===id||y&&owner[t-W]===id||y<H-1&&owner[t+W]===id)targets.set(target,t);}
   const choice=[...targets].filter(([id])=>id<0||!engine.queries.atPeace(S.me.id,id)).sort(([a],[b])=>(S.players[a]?.troops/Math.max(1,S.players[a]?.tiles)||0)-(S.players[b]?.troops/Math.max(1,S.players[b]?.tiles)||0))[0];
   if(choice)S.issueClick(choice[1],{ratio:60,pick:null,build:null});
  }
  if(S.me.alive&&S.tickN%150===0){const own=S.ownTilesOf(S.me.id),types=['city','factory','port','airfield','sam','silo','fort','engcmd'],type=types[Math.floor(S.tickN/150)%types.length],t=own[(S.tickN*997)%Math.max(1,own.length)];if(t!==undefined)S.issueMenu({act:'build',type},t,[],-1,50,0,0);}
  const before=S.tickN,t=performance.now();game.tick();const tickMs=performance.now()-t;durations.push(tickMs);if(tickMs>50)slowTicks.push({tick:S.tickN,ms:tickMs,structures:actors.structures.length,ships:actors.warships.length,aircraft:actors.aircraft.length});assert.equal(S.tickN,before+1,'live match stalled');observe();
  if(S.tickN%1000===0)process.stderr.write(JSON.stringify({progressTick:S.tickN,map:settings.map,diff:settings.diff})+'\n');
  if(S.tickN%100===0){assert.deepEqual(engine.checkInvariants(),[]);const h=S.CMD.hashes.at(-1);checkpoints.push({tick:S.tickN,legacyHash:h[1],...h[2]});}
 }
 assert.deepEqual(engine.checkInvariants(),[]);
 const name='campaign-'+settings.map+'-'+settings.diff+'-'+settings.seed,canonical={version:S.stateOracleVersion,sha256:createHash('sha256').update(S.serializeCanonicalState()).digest('hex')};
 const fixture={name,seed:settings.seed,grid:{width:S.W,height:S.H},settings:{...S.START,diff:settings.diff,country:settings.countryIdx},controls:{},coverage:['autoplay','end-enabled'],hashv:2,tick:S.tickN,cmds:structuredClone(S.CMD.log),hashes:structuredClone(S.CMD.hashes),checkpoints,final:{tick:S.tickN,legacyHash:S.stateHash(),canonical,rngDraws:S.srandN,commandCount:S.CMD.log.length,replayCursor:null}};
 fs.mkdirSync('docs/evidence/comprehensive',{recursive:true});
 fs.writeFileSync('docs/evidence/comprehensive/'+name+'-replay.json',JSON.stringify(fixture));
 const replay=replayScenario(fixture,o=>boot({...o,allowEnd:true}));assert.deepEqual(replay.errors,[]);
 const ended=S.over;
 if(ended){S.issue('continueAfterEnd',S.me.alive);assert.equal(S.over,false);const tick=S.tickN;game.tick();assert.equal(S.tickN,tick+1,'endgame continuation stalled');}
 durations.sort((a,b)=>a-b);const result={name,options:settings,ticks:fixture.tick,ended,endings,alive:S.me.alive,commands:fixture.cmds.length,observed,p95TickMs:durations[Math.floor(durations.length*.95)],maxTickMs:durations.at(-1),slowTicks:slowTicks.sort((a,b)=>b.ms-a.ms).slice(0,20),elapsedMs:performance.now()-start,replay:'PASS'};
 fs.mkdirSync('docs/evidence/comprehensive',{recursive:true});fs.writeFileSync('docs/evidence/comprehensive/'+name+'.json',JSON.stringify(result,null,2));return result;
}
module.exports={campaign};
if(require.main===module){const options=process.argv.includes('--worker')?JSON.parse(fs.readFileSync(0,'utf8')):{map:process.argv[2]||'random',diff:process.argv[3]||'normal',ticks:Number(process.argv[4]||3600)};try{console.log(JSON.stringify({ok:true,...campaign(options)}));}catch(e){console.log(JSON.stringify({ok:false,options,error:e.stack}));process.exitCode=1;}}
