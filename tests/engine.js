'use strict';

const assert=require('node:assert/strict');
const crypto=require('node:crypto');
const path=require('node:path');
const {pathToFileURL}=require('node:url');

function assertDeepFrozenAndTryMutations(value,seen=new Set()){
  if(value===null||typeof value!=='object'||seen.has(value)) return;
  seen.add(value);
  assert.equal(Object.isFrozen(value),true);
  for(const child of Object.values(value)) assertDeepFrozenAndTryMutations(child,seen);
  assert.equal(Reflect.set(value,'attemptedMutation',true),false);
  for(const key of Object.keys(value)) assert.equal(Reflect.set(value,key,null),false);
  if(Array.isArray(value)) assert.throws(()=>value.push(null),TypeError);
}

(async()=>{
  const {createEngine,ENGINE_TEST_DIAGNOSTICS}=await import(pathToFileURL(path.resolve(__dirname,'..','game','src','sim','engine.mjs')).href);
  const {encodeGraph,decodeGraph}=await import(pathToFileURL(path.resolve(__dirname,'..','game','src','sim','graph-codec.mjs')).href);
  const protectedGlobals=['window','document','navigator','location','localStorage','sessionStorage','AudioContext','Image','requestAnimationFrame','setTimeout','setInterval','fetch'];
  const descriptors=new Map(protectedGlobals.map(name=>[name,Object.getOwnPropertyDescriptor(globalThis,name)]));
  for(const name of protectedGlobals) Object.defineProperty(globalThis,name,{configurable:true,get(){ throw new Error(`engine accessed platform global ${name}`); }});

  const options={W:120,H:70,bots:2,difficulty:'hard',settings:{seed:'ENGINE-DIRECT',map:'land',troops:120,gold:100}};
  const diagnostics=values=>({...values,[ENGINE_TEST_DIAGNOSTICS]:true});
  try{
    const production=createEngine(options),view=production.presentation();
    assert.equal('compatibility' in production,false,'production engines must not expose mutable diagnostics');
    assert.equal(production.presentation(),view,'presentation identity must be stable');
    assert.equal(view.state.setLifecycle,undefined,'presentation must omit state mutation methods');
    assert.throws(()=>{ view.state.clock.tickN=99; },TypeError);
    assert.throws(()=>{ view.state.actors.players.push({}); },TypeError);
    assert.throws(()=>{ view.state.rules.allowed.add('test-only'); },TypeError);
    assert.throws(()=>{ view.state.map.owner.fill(9); },TypeError);
    production.start();
    const setupFrame=production.interpolationFrame();
    assert.ok(Object.isFrozen(setupFrame)&&Object.isFrozen(setupFrame.current)&&Object.isFrozen(setupFrame.current.actors));
    assert.equal(setupFrame.tickIntervalMs,100);
    assert.equal(setupFrame.previous,setupFrame.current,'setup frame must start without an interpolation gap');
    assert.equal(setupFrame.current.tickId,0);
    assert.throws(()=>{ setupFrame.current.tickId=99; },TypeError);
    assert.ok(production.presentation().state.actors.players.every(player=>!Object.hasOwn(player,'labelPos')),'authoritative players must not own label positions');
    const labelCanonical=production.serializeCanonical(),labelRuntime=JSON.stringify(production.runtimeCheckpoint());
    const labelPositions=production.queries.playerLabelPositions();
    assert.equal(production.queries.nearestPort(0,0),null);
    assert.throws(()=>production.queries.nearestPort(-1,0));
    assert.throws(()=>production.queries.nearestPort(0,-1));
    assert.throws(()=>production.queries.nearestPort(0,NaN));
    assert.ok(labelPositions.some(Boolean),'presentation label query returned no positions');
    assert.throws(()=>{ labelPositions[0][0]=999; },TypeError);
    assert.equal(production.serializeCanonical(),labelCanonical,'label layout query changed canonical state');
    assert.equal(JSON.stringify(production.runtimeCheckpoint()),labelRuntime,'label layout query changed deterministic runtime');
    const playerView=view.state.actors.players[0],ownerBefore=view.state.map.owner[0],ownerBuffer=new Int16Array(view.state.map.owner.buffer),renderBuffers=production.renderBuffers();
    ownerBuffer[0]=ownerBefore+1;
    assert.equal(view.state.map.owner[0],ownerBefore,'typed-array buffers must not expose mutable simulation storage');
    renderBuffers.map.owner[0]=ownerBefore+1;
    assert.equal(view.state.map.owner[0],ownerBefore,'detached render buffers must not mutate simulation storage');
    assert.equal(production.renderBuffers(),renderBuffers,'render buffer identity must be stable');
    assert.equal(renderBuffers.map.owner[0],ownerBefore,'render buffers must refresh from authoritative state');
    production.tick();
    assert.equal(view.state.clock.tickN,1,'presentation values must remain live');
    const tickFrame=production.interpolationFrame();
    assert.equal(tickFrame.previous.tickId,0);
    assert.equal(tickFrame.current.tickId,1);
    assert.equal(tickFrame.current.timeMs,100);
    assert.notEqual(tickFrame,setupFrame);
    production.togglePause();
    assert.equal(production.tick(),false);
    assert.equal(production.interpolationFrame(),tickFrame,'stopped ticks must not advance interpolation frames');
    production.togglePause();
    assert.equal(production.presentation().state.actors.players[0],playerView,'nested presentation identity must be stable');

    const direct=createEngine(diagnostics(options));
    direct.start();
    assert.ok(direct.compatibility.state.actors.players.length>=3);
    assert.equal(direct.tick(),true);
    assert.equal(direct.tick(),true);
    assert.equal(direct.compatibility.state.clock.tickN,2);
    assert.deepEqual(direct.checkInvariants(),[]);
    assert.match(direct.stateHash(),/^[0-9a-f]{8}$/);
    assert.equal(typeof direct.serializeCanonical(),'string');
    const queryCanonical=direct.serializeCanonical(),queryRuntime=JSON.stringify(direct.runtimeCheckpoint()),queryRng=direct.presentation().runtime.rngDraws;
    const queryCandidates=[{name:'late',type:'city',t:20,owner:1},{name:'sam',type:'sam',t:11,owner:1},{name:'shield-b',type:'shield',t:9,owner:1},{name:'shield-a',type:'shield',t:3,owner:1}];
    assert.deepEqual(direct.queries.cruiseTargets(queryCandidates).map(value=>value.name),['shield-a','shield-b']);
    assert.deepEqual(direct.queries.cruiseTargets(queryCandidates).map(value=>value.name),['shield-a','shield-b']);
    assert.equal(direct.presentation().runtime.rngDraws,queryRng,'presentation query advanced authoritative RNG');
    assert.equal(direct.serializeCanonical(),queryCanonical,'presentation query changed canonical state');
    assert.equal(JSON.stringify(direct.runtimeCheckpoint()),queryRuntime,'presentation query changed deterministic runtime');
    const startupEvents=direct.drainEvents();
    assert.ok(startupEvents.length>0,'headless engine should retain structured events without a sink');
    assert.ok(startupEvents.every(event=>Object.isFrozen(event)&&Object.isFrozen(event.args)),'queued events must be immutable copies');
    assert.deepEqual(startupEvents.map(event=>event.tick),[...startupEvents].map(event=>event.tick).sort((a,b)=>a-b),'events must retain emission order');
    direct.compatibility.emitEventForDiagnostics('containerProbe',new Set([1,2]),new Map([['safe',{value:3}]]));
    const containerEvent=direct.drainEvents()[0];
    assert.throws(()=>containerEvent.args[0].add(3),/immutable/);
    assert.throws(()=>containerEvent.args[1].set('escape',4),/immutable/);
    assert.deepEqual([...containerEvent.args[0]],[1,2]);
    assert.equal(containerEvent.args[1].get('safe').value,3);


    // High-frequency presentation events must not traverse a player's garrison.
    let garrisonReads=0;
    const eventPlayer={id:7,color:'#123456',peakTroops:1200,goldEarned:345,
      get areas(){ garrisonReads++; return Array.from({length:3000},(_,id)=>({id,troops:id,tiles:1})); }};
    direct.compatibility.emitEventForDiagnostics('tileCaptured',123,eventPlayer);
    direct.compatibility.emitEventForDiagnostics('playerAccrued',eventPlayer,.4);
    direct.compatibility.emitEventForDiagnostics('attackStarted',eventPlayer,2);
    const compactEvents=direct.drainEvents();
    assert.equal(garrisonReads,0,'visual events copied the complete garrison graph');
    assert.deepEqual(compactEvents.map(e=>e.args),[
      [123,{id:7,color:'#123456'}],[{id:7,peakTroops:1200,goldEarned:345},.4],[{id:7},2]
    ]);
    eventPlayer.color='#ffffff';eventPlayer.peakTroops=9999;
    assert.equal(compactEvents[0].args[1].color,'#123456');
    assert.equal(compactEvents[1].args[0].peakTroops,1200);
    compactEvents.forEach(event=>assertDeepFrozenAndTryMutations(event));
    eventPlayer.name='Snapshot';eventPlayer.flag=[['h','#ffffff','#000000']];
    direct.compatibility.emitEventForDiagnostics('tileCaptured',124,eventPlayer);
    direct.compatibility.emitEventForDiagnostics('tileCaptured',125,eventPlayer);
    direct.compatibility.emitEventForDiagnostics('invasion',eventPlayer,123,false);
    const repeatedEvents=direct.drainEvents();
    assert.equal(repeatedEvents[0].args[1],repeatedEvents[1].args[1],'identical tile events rebuilt player snapshots');
    assert.notEqual(repeatedEvents[0].args[1],compactEvents[0].args[1],'changed colors reused stale snapshots');
    assert.equal(garrisonReads,0,'invasion event copied the complete garrison graph');
    assert.deepEqual(repeatedEvents[2].args,[{id:7,name:'Snapshot',flag:[['h','#ffffff','#000000']]},123,false]);
    eventPlayer.flag[0][1]='#123456';
    assert.equal(repeatedEvents[2].args[0].flag[0][1],'#ffffff');
    repeatedEvents.forEach(event=>assertDeepFrozenAndTryMutations(event));


    const left=createEngine(diagnostics({...options,settings:{...options.settings,seed:'INTERLEAVED'}}));
    const right=createEngine(diagnostics({...options,settings:{...options.settings,seed:'INTERLEAVED'}}));
    left.start(); right.start();
    for(let index=0;index<12;index++){ left.tick(); right.tick(); }
    assert.equal(left.stateHash(),right.stateHash(),'interleaved engines shared mutable simulation state');
    assert.notEqual(left.compatibility.state,right.compatibility.state);

    const players=left.compatibility.state.actors.players;
    const human=players[left.compatibility.state.match.playerId],other=players.find(player=>player.id!==human.id&&player.kind==='bot');
    left.issue({kind:'focus',args:[0.23]});
    left.issue({kind:'focus',args:[0.81],actor:other.id});
    assert.equal(human.focus,0.23);
    assert.equal(other.focus,0.81);
    assert.equal(left.compatibility.runtime.commands.log.at(-1).p,other.id);

    const before=left.stateHash(),snapshot=left.snapshot();
    assert.ok(Object.isFrozen(snapshot)&&Object.isFrozen(snapshot.actors));
    assert.throws(()=>{ snapshot.clock.tickN=999; },TypeError);
    assert.throws(()=>{ snapshot.actors.players[0].name='snapshot only'; },TypeError);
    assert.notEqual(left.compatibility.state.actors.players[0].name,'snapshot only');
    assert.equal(left.stateHash(),before);

    const replay=createEngine(diagnostics({...options,settings:{...options.settings,seed:'REPLAY-ENGINE'}}));
    const loadedReplay=replay.loadReplay({seed:'REPLAY-ENGINE',settings:{...options.settings,seed:'REPLAY-ENGINE'},cmds:[{t:0,k:'focus',a:[0.44]}],hashes:[],tick:1,hashv:2});
    const loadedCanonical=replay.serializeCanonical(),loadedHash=replay.stateHash(),loadedRuntime=JSON.stringify(replay.runtimeCheckpoint()),loadedRng=replay.presentation().runtime.rngDraws;
    assertDeepFrozenAndTryMutations(loadedReplay);
    assert.equal(replay.serializeCanonical(),loadedCanonical);
    assert.equal(replay.stateHash(),loadedHash);
    assert.equal(JSON.stringify(replay.runtimeCheckpoint()),loadedRuntime);
    assert.equal(replay.presentation().runtime.rngDraws,loadedRng);
    assert.notEqual(loadedReplay,replay.compatibility.runtime.replay);
    assert.notEqual(loadedReplay.cmds,replay.compatibility.runtime.replay.cmds);
    assert.notEqual(loadedReplay.cmds[0].a,replay.compatibility.runtime.replay.cmds[0].a);
    replay.start();
    const dispatchCanonical=replay.serializeCanonical(),dispatchHash=replay.stateHash(),dispatchRuntime=JSON.stringify(replay.runtimeCheckpoint()),dispatchRng=replay.presentation().runtime.rngDraws;
    const replayDispatch=replay.dispatchEvents(()=>{
      assertDeepFrozenAndTryMutations(loadedReplay);
      assert.throws(()=>replay.configureReplay({on:false}),/cannot be re-entered/);
    });
    assert.deepEqual(replayDispatch.errors,[]);
    assert.equal(replay.serializeCanonical(),dispatchCanonical);
    assert.equal(replay.stateHash(),dispatchHash);
    assert.equal(JSON.stringify(replay.runtimeCheckpoint()),dispatchRuntime);
    assert.equal(replay.presentation().runtime.rngDraws,dispatchRng);
    assert.equal(replay.compatibility.runtime.replay.on,true);
    assert.equal(replay.compatibility.runtime.replay.i,0);
    replay.tick();
    assert.equal(replay.compatibility.getMe().focus,0.44);
    assert.equal(replay.compatibility.runtime.replay.i,1);
    assert.equal(loadedReplay.i,0,'retained load result changed with replay progress');
    assert.ok(replay.runtimeCheckpoint().rng);
    replay.checkpoint();
    assert.deepEqual(replay.checkInvariants(),[]);
    const takenOver=replay.takeOverReplay(),takeoverCanonical=replay.serializeCanonical(),takeoverHash=replay.stateHash(),takeoverRuntime=JSON.stringify(replay.runtimeCheckpoint()),takeoverRng=replay.presentation().runtime.rngDraws;
    assert.equal(takenOver.length,1);
    assertDeepFrozenAndTryMutations(takenOver);
    assert.notEqual(takenOver,replay.compatibility.runtime.commands.log);
    assert.notEqual(takenOver[0].a,replay.compatibility.runtime.commands.log[0].a);
    assert.equal(replay.serializeCanonical(),takeoverCanonical);
    assert.equal(replay.stateHash(),takeoverHash);
    assert.equal(JSON.stringify(replay.runtimeCheckpoint()),takeoverRuntime);
    assert.equal(replay.presentation().runtime.rngDraws,takeoverRng);
    replay.issue('focus',0.62);
    assert.equal(takenOver.length,1,'retained takeover result changed with later command state');
    const configuredReplay=replay.configureReplay({on:false,cmds:[],i:0,resume:false,toTick:0,speed:1});
    assertDeepFrozenAndTryMutations(configuredReplay);
    replay.configureReplay({speed:3});
    assert.equal(configuredReplay.speed,1,'retained replay result changed with later replay state');

    const finalSettings={...options.settings,seed:'FINAL-METADATA'},finalSource=createEngine(diagnostics({...options,settings:finalSettings}));
    finalSource.start(); finalSource.drainEvents(); finalSource.tick();
    const finalCanonical=crypto.createHash('sha256').update(finalSource.serializeCanonical()).digest('hex'),finalHash=finalSource.stateHash(),finalRng=finalSource.presentation().runtime.rngDraws;
    const finalMetadata={tick:1,legacyHash:finalHash,canonical:{version:'statefall-authoritative-state/v1',sha256:finalCanonical},rngDraws:finalRng,commandCount:0,replayCursor:0};
    const matchingFinal=createEngine(diagnostics({...options,settings:finalSettings})); matchingFinal.loadReplay({seed:finalSettings.seed,settings:finalSettings,cmds:[],hashes:[],tick:1,hashv:2,finalHash,finalDigest:finalMetadata.canonical,final:finalMetadata}); matchingFinal.start(); matchingFinal.drainEvents(); matchingFinal.tick();
    assert.equal(matchingFinal.runtimeCheckpoint().replay.mismatch,false,'matching final metadata was rejected');
    const forgedFinal=createEngine(diagnostics({...options,settings:finalSettings})); forgedFinal.loadReplay({seed:finalSettings.seed,settings:finalSettings,cmds:[],hashes:[],tick:1,hashv:2,finalHash:'00000000',finalDigest:{version:'statefall-authoritative-state/v1',sha256:'0'.repeat(64)},final:{...finalMetadata,legacyHash:'00000000'}}); forgedFinal.start(); forgedFinal.drainEvents(); forgedFinal.tick();
    assert.equal(forgedFinal.runtimeCheckpoint().replay.mismatch,true,'short replay accepted forged final metadata without periodic checkpoints');
    assert.ok(forgedFinal.drainEvents().some(event=>event.type==='replayDiverged'));

    const failedPostSettings={...options.settings,seed:'FAILED-POST-30'},failedPost=createEngine(diagnostics({...options,settings:failedPostSettings}));
    failedPost.loadReplay({seed:failedPostSettings.seed,settings:failedPostSettings,cmds:[{t:30,k:'continueAfterEnd',a:[false],phase:'post-systems'}],hashes:[],tick:30,hashv:2});
    failedPost.start(); failedPost.drainEvents();
    for(let index=0;index<29;index++) assert.equal(failedPost.tick(),true);
    assert.equal(failedPost.tick(),true,'post-systems failure hid an advanced tick');
    const failedPostRuntime=failedPost.runtimeCheckpoint(),failedPostFrame=failedPost.interpolationFrame(),failedPostCheckpoint=JSON.parse(JSON.stringify(failedPost.checkpoint()));
    assert.equal(failedPost.presentation().state.clock.tickN,30);
    assert.equal(failedPostFrame.current.tickId,30);
    assert.equal(failedPostRuntime.replay.on,true,'command failure disabled final verification');
    assert.equal(failedPostRuntime.replay.finalVerified,true);
    assert.equal(failedPostRuntime.replay.mismatch,true);
    assert.match(failedPostRuntime.replay.why,/replay command failed in post-systems/);
    assert.ok(failedPost.drainEvents().some(event=>event.type==='replayDiverged'));
    const failedPostGraph=decodeGraph(failedPostCheckpoint.payload);
    assert.equal(failedPostGraph.canonicalCompatibility.lastRefreshTick,30);
    const failedPostRestored=createEngine(diagnostics({...options,settings:failedPostSettings}));
    failedPostRestored.restoreCheckpoint(failedPostCheckpoint);
    assert.equal(failedPostRestored.presentation().state.clock.tickN,30);
    assert.equal(failedPostRestored.runtimeCheckpoint().replay.mismatch,true);
    assert.equal(failedPostRestored.interpolationFrame().current.tickId,30);

    const richSettings={...options.settings,seed:'RICH-CHECKPOINT'},richSource=createEngine(diagnostics({...options,settings:richSettings}));
    richSource.start(); richSource.drainEvents(); richSource.issue('focus',0.41);
    for(let index=0;index<100;index++) richSource.tick();
    const richHashes=structuredClone(richSource.runtimeCheckpoint().commands.hashes),richFinal={...richSource.replayMetadata(),replayCursor:1};
    assert.equal(richHashes.length,1);
    assert.ok(richHashes[0][2].canonical);
    assert.equal(richHashes[0][2].commandCount,1);
    const richFile={seed:richSettings.seed,settings:richSettings,cmds:[{t:0,k:'focus',a:[0.41]}],hashes:richHashes,tick:100,hashv:2,requiresCanonicalCheckpoints:true,final:richFinal};
    const replayRich=mutate=>{ const file=structuredClone(richFile); mutate?.(file); const instance=createEngine(diagnostics({...options,settings:richSettings})); instance.loadReplay(file); instance.start(); instance.drainEvents(); for(let index=0;index<100;index++) instance.tick(); return instance.runtimeCheckpoint().replay; };
    assert.equal(replayRich().mismatch,false);
    for(const [label,mutate] of Object.entries({canonical:file=>{ file.hashes[0][2].canonical.sha256='0'.repeat(64); },rng:file=>{ file.hashes[0][2].rngDraws++; },commandCount:file=>{ file.hashes[0][2].commandCount=0; },cursor:file=>{ file.hashes[0][2].replayCursor=0; }})){
      const result=replayRich(mutate); assert.equal(result.mismatch,true,`${label} checkpoint tamper was accepted`); assert.match(result.why,new RegExp(label==='rng'?'RNG':label==='commandCount'?'command count':label,'i'));
    }
    const historicalResult=replayRich(file=>{ file.requiresCanonicalCheckpoints=false; const detail=file.hashes[0][2]; file.hashes[0][2]=Object.fromEntries(Object.entries(detail).filter(([key])=>key==='rng'||key==='n'||/^\d+$/.test(key))); });
    assert.equal(historicalResult.mismatch,false,'historical optional checkpoint detail was rejected');

    const graphShared={value:-0},graphRoot={typed:new Float32Array([NaN,Infinity,-Infinity,-0]),set:new Set(),map:new Map()};
    graphRoot.self=graphRoot; graphRoot.set.add(graphShared); graphRoot.map.set(graphShared,graphRoot);
    const graphRoundTrip=decodeGraph(JSON.parse(JSON.stringify(encodeGraph(graphRoot))));
    assert.equal(graphRoundTrip.self,graphRoundTrip);
    assert.equal([...graphRoundTrip.set][0],[...graphRoundTrip.map.keys()][0]);
    assert.equal(graphRoundTrip.map.get([...graphRoundTrip.map.keys()][0]),graphRoundTrip);
    assert.ok(Number.isNaN(graphRoundTrip.typed[0])&&Object.is(graphRoundTrip.typed[3],-0));
    assert.throws(()=>decodeGraph({version:'statefall-graph/v1',root:null,nodes:[{kind:'Array',values:[]}]}),/unreachable/i);
    assert.throws(()=>decodeGraph({version:'statefall-graph/v1',root:{$ref:0},nodes:[{kind:'TypedArray',type:'BigInt64Array',values:[]}]}),/unsupported graph node/i);

    const checkpointOptions=diagnostics({...options,settings:{...options.settings,seed:'FULL-CHECKPOINT',fog:true,garrison:true}});
    const checkpointEngine=createEngine(checkpointOptions);
    checkpointEngine.start(); checkpointEngine.drainEvents();
    for(let index=0;index<35;index++) checkpointEngine.tick();
    checkpointEngine.issue('focus',0.37);
    const checkpointState=checkpointEngine.compatibility.state,checkpointRuntime=checkpointEngine.compatibility.runtime;
    const stable={
      settings:checkpointState.rules.settings,allowed:checkpointState.rules.allowed,regions:checkpointState.map.regions,unclaimed:checkpointState.map.unclaimed,
      hostile:checkpointState.diplomacy.hostile,proposals:checkpointState.diplomacy.proposals,borders:checkpointState.fog.myBorders,supplyAt:checkpointState.garrison.supplyAt,
      draftPicks:checkpointState.draft.draftPicks,countryPool:checkpointState.setup.countryPool,commands:checkpointRuntime.commands,replay:checkpointRuntime.replay,
      actors:Object.fromEntries(Object.entries(checkpointState.actors)),map:Object.fromEntries(['land','owner','struct','structOwner','region','river','shelled','rough'].map(name=>[name,checkpointState.map[name]]))
    };
    const fullCheckpoint=checkpointEngine.checkpoint(),jsonCheckpoint=JSON.parse(JSON.stringify(fullCheckpoint));
    assert.ok(checkpointEngine.compatibility.state.actors.players.every(player=>!Object.hasOwn(player,'labelPos')));
    assert.equal(fullCheckpoint.version,'statefall-engine-checkpoint/v2');
    const fullCheckpointGraph=decodeGraph(fullCheckpoint.payload);
    assert.deepEqual({version:fullCheckpointGraph.canonicalCompatibility.version,lastRefreshTick:fullCheckpointGraph.canonicalCompatibility.lastRefreshTick},{version:'statefall-canonical-compatibility/v1',lastRefreshTick:30});
    const checkpointCanonical=checkpointEngine.serializeCanonical(),checkpointHash=checkpointEngine.stateHash(),checkpointRuntimeBytes=JSON.stringify(checkpointEngine.runtimeCheckpoint()),checkpointBytes=JSON.stringify(fullCheckpoint);
    for(let index=0;index<17;index++) checkpointEngine.tick();
    checkpointEngine.issue('focus',0.91);
    assert.notEqual(checkpointEngine.serializeCanonical(),checkpointCanonical);
    assert.ok(checkpointEngine.drainEvents().length>=0);
    checkpointEngine.issue('focus',0.82);
    assert.ok(checkpointEngine.drainEvents().length>0);
    checkpointEngine.issue('focus',0.73);
    checkpointEngine.restoreCheckpoint(jsonCheckpoint);
    const restoredFrame=checkpointEngine.interpolationFrame();
    assert.equal(restoredFrame.previous,restoredFrame.current,'restore must discard pre-restore interpolation history');
    assert.equal(restoredFrame.current.tickId,35);
    assert.deepEqual(checkpointEngine.drainEvents(),[],'successful restore must clear presentation events');
    assert.equal(checkpointEngine.serializeCanonical(),checkpointCanonical);
    assert.equal(checkpointEngine.stateHash(),checkpointHash);
    assert.equal(JSON.stringify(checkpointEngine.runtimeCheckpoint()),checkpointRuntimeBytes);
    assert.equal(JSON.stringify(checkpointEngine.checkpoint()),checkpointBytes);
    for(const [name,ref] of Object.entries(stable.actors)) assert.equal(checkpointState.actors[name],ref,`actor collection ${name} identity changed`);
    for(const [name,ref] of Object.entries(stable.map)) assert.equal(checkpointState.map[name],ref,`map buffer ${name} identity changed`);
    for(const name of ['settings','allowed','regions','unclaimed','hostile','proposals','borders','supplyAt','draftPicks','countryPool']) assert.equal(name==='settings'?checkpointState.rules.settings:name==='allowed'?checkpointState.rules.allowed:name==='regions'?checkpointState.map.regions:name==='unclaimed'?checkpointState.map.unclaimed:name==='hostile'?checkpointState.diplomacy.hostile:name==='proposals'?checkpointState.diplomacy.proposals:name==='borders'?checkpointState.fog.myBorders:name==='supplyAt'?checkpointState.garrison.supplyAt:name==='draftPicks'?checkpointState.draft.draftPicks:checkpointState.setup.countryPool,stable[name],`${name} identity changed`);
    assert.equal(checkpointRuntime.commands,stable.commands); assert.equal(checkpointRuntime.replay,stable.replay);

    const cadence=createEngine(checkpointOptions); cadence.start(); cadence.drainEvents();
    for(let index=0;index<30;index++) cadence.tick();
    const cadenceState=cadence.compatibility.state,cadenceHuman=cadence.compatibility.getMe(),capturedAt30=cadence.serializeCanonical();
    const cadenceTile=cadenceState.map.owner.findIndex(value=>value>=0&&value!==cadenceHuman.id);
    cadence.compatibility.systems.landCombat.setOwner(cadenceTile,cadenceHuman.id);
    cadence.tick();
    assert.notEqual(cadence.serializeCanonical(),capturedAt30,'ownership change did not enter canonical authority');
    const cadenceCheckpoint=JSON.parse(JSON.stringify(cadence.checkpoint())),cadenceCanonical=cadence.serializeCanonical(),cadenceHash=cadence.stateHash(),cadenceRuntime=JSON.stringify(cadence.runtimeCheckpoint()),cadenceRng=cadence.presentation().runtime.rngDraws;
    const cadenceRestored=createEngine(checkpointOptions); cadenceRestored.restoreCheckpoint(cadenceCheckpoint);
    assert.equal(cadenceRestored.serializeCanonical(),cadenceCanonical);
    assert.equal(cadenceRestored.stateHash(),cadenceHash);
    assert.equal(JSON.stringify(cadenceRestored.runtimeCheckpoint()),cadenceRuntime);
    assert.equal(cadenceRestored.presentation().runtime.rngDraws,cadenceRng);
    for(let index=0;index<40;index++){ cadence.tick(); cadenceRestored.tick(); assert.equal(cadenceRestored.serializeCanonical(),cadence.serializeCanonical(),`canonical label cadence diverged at continuation ${index}`); }

    const restoredPeer=createEngine(checkpointOptions); restoredPeer.restoreCheckpoint(jsonCheckpoint);
    assert.equal(restoredPeer.serializeCanonical(),checkpointCanonical);
    assert.equal(JSON.stringify(restoredPeer.runtimeCheckpoint()),checkpointRuntimeBytes);
    assert.notEqual(restoredPeer.compatibility.state.actors.players[0],checkpointState.actors.players[0]);
    const invariantPeer=createEngine(checkpointOptions); invariantPeer.restoreCheckpoint(jsonCheckpoint); assert.equal(invariantPeer.tick(),true); assert.deepEqual(invariantPeer.checkInvariants(),[],'accepted checkpoint failed invariants on its next tick');
    checkpointState.actors.players[0].instanceProbe='left only';
    assert.equal(restoredPeer.compatibility.state.actors.players[0].instanceProbe,undefined,'restored engine instances shared graph objects');
    delete checkpointState.actors.players[0].instanceProbe;
    const continuous=createEngine(checkpointOptions); continuous.start(); continuous.drainEvents();
    for(let index=0;index<35;index++) continuous.tick();
    continuous.issue('focus',0.37);
    const continuousPlayer=continuous.compatibility.state.actors.players[continuous.compatibility.state.match.playerId],continuousOther=continuous.compatibility.state.actors.players.find(player=>player!==continuousPlayer);
    for(const engine of [checkpointEngine,restoredPeer]) engine.issue('focus',0.61);
    continuous.issue('focus',0.61);
    for(let index=0;index<65;index++){ checkpointEngine.tick(); restoredPeer.tick(); continuous.tick(); }
    assert.equal(restoredPeer.serializeCanonical(),checkpointEngine.serializeCanonical(),'restored engines diverged while continuing');
    assert.equal(continuous.serializeCanonical(),checkpointEngine.serializeCanonical(),'restored engine diverged from uninterrupted execution');
    assert.equal(JSON.stringify(restoredPeer.runtimeCheckpoint()),JSON.stringify(checkpointEngine.runtimeCheckpoint()),'restored runtime diverged while continuing');
    assert.equal(JSON.stringify(continuous.runtimeCheckpoint()),JSON.stringify(checkpointEngine.runtimeCheckpoint()),'restored runtime diverged from uninterrupted execution');

    const atomicBefore=JSON.stringify(checkpointEngine.checkpoint()),atomicCanonical=checkpointEngine.serializeCanonical(),atomicRuntime=JSON.stringify(checkpointEngine.runtimeCheckpoint());
    const rejects=[null,{...jsonCheckpoint,version:'statefall-engine-checkpoint/v999'},{...jsonCheckpoint,payload:{...jsonCheckpoint.payload,version:'statefall-graph/v999'}},{...jsonCheckpoint,payload:{...jsonCheckpoint.payload,root:{$ref:999999}}}];
    for(const invalid of rejects){ assert.throws(()=>checkpointEngine.restoreCheckpoint(invalid)); assert.equal(JSON.stringify(checkpointEngine.checkpoint()),atomicBefore); assert.equal(checkpointEngine.serializeCanonical(),atomicCanonical); }
    const badRuntime=decodeGraph(jsonCheckpoint.payload); badRuntime.runtime.version='statefall-deterministic-runtime/v999';
    const badPlayer=decodeGraph(jsonCheckpoint.payload); badPlayer.state.actors.players[0].id=99;
    const badClock=decodeGraph(jsonCheckpoint.payload); badClock.state.clock.simMs++;
    const badTerrain=decodeGraph(jsonCheckpoint.payload); badTerrain.state.map.land[0]=7;
    const badRules=decodeGraph(jsonCheckpoint.payload); badRules.state.rules.settings.map='unsupported-map';
    const badGarrison=decodeGraph(jsonCheckpoint.payload); badGarrison.state.garrison.areaOf[0]=999999;
    const badDiplomacy=decodeGraph(jsonCheckpoint.payload); badDiplomacy.state.actors.players[0].rel[1]={type:'ally',until:Infinity,since:0};
    const badStructureIndex=decodeGraph(jsonCheckpoint.payload); badStructureIndex.state.map.struct[0]=1; badStructureIndex.state.map.structOwner[0]=0;
    const badActorReference=decodeGraph(jsonCheckpoint.payload); badActorReference.state.actors.links.push({a:{},b:{},owner:0});
    const badCursor=decodeGraph(jsonCheckpoint.payload); badCursor.runtime.replay.i=badCursor.runtime.replay.cmds.length+1;
    const objectSet=decodeGraph(jsonCheckpoint.payload); objectSet.state.map.unclaimed.add({tile:1});
    const unsupportedRuntime=decodeGraph(jsonCheckpoint.payload); unsupportedRuntime.runtime.replay.unsupported=new Map();
    const aliasFogMap=decodeGraph(jsonCheckpoint.payload); aliasFogMap.state.fog.vis=aliasFogMap.state.map.land;
    const aliasOwnerIndex=decodeGraph(jsonCheckpoint.payload); aliasOwnerIndex.state.map.structOwner=aliasOwnerIndex.state.map.owner;
    const aliasGarrisonIndex=decodeGraph(jsonCheckpoint.payload); aliasGarrisonIndex.state.garrison.areaOf=aliasGarrisonIndex.state.map.shelled;
    const aliasCollections=decodeGraph(jsonCheckpoint.payload); aliasCollections.state.draft.draftPicks=aliasCollections.state.diplomacy.proposals;
    const aliasActorCollections=decodeGraph(jsonCheckpoint.payload); aliasActorCollections.state.actors.attacks=aliasActorCollections.state.actors.players;
    const aliasActorObject=decodeGraph(jsonCheckpoint.payload); aliasActorObject.state.actors.attacks.push(aliasActorObject.state.actors.players[0]);
    const aliasRuntimeArrays=decodeGraph(jsonCheckpoint.payload); aliasRuntimeArrays.runtime.replay.cmds=aliasRuntimeArrays.runtime.commands.log;
    const aliasPlayerAsArea=decodeGraph(jsonCheckpoint.payload); aliasPlayerAsArea.state.actors.players[0].areas=[aliasPlayerAsArea.state.actors.players[1]];
    const aliasActorWrongPath=decodeGraph(jsonCheckpoint.payload); aliasActorWrongPath.state.actors.players[0].arbitraryTarget=aliasActorWrongPath.state.actors.players[1];
    const aliasActorCrossCollection=decodeGraph(jsonCheckpoint.payload); aliasActorCrossCollection.state.actors.attacks.push(aliasActorCrossCollection.state.actors.players[1]);
    const aliasRelationElsewhere=decodeGraph(jsonCheckpoint.payload); aliasRelationElsewhere.state.actors.players[0].relProbe=aliasRelationElsewhere.state.actors.players[0].rel;
    const aliasPlayerFlags=decodeGraph(jsonCheckpoint.payload); aliasPlayerFlags.state.actors.players[1].flag=aliasPlayerFlags.state.actors.players[0].flag;
    const aliasFlagLayers=decodeGraph(jsonCheckpoint.payload); aliasFlagLayers.state.actors.players[1].flag.layers=aliasFlagLayers.state.actors.players[0].flag.layers;
    const aliasSetupFlag=decodeGraph(jsonCheckpoint.payload); aliasSetupFlag.state.setup.chosenFlag=aliasSetupFlag.state.actors.players[0].flag;
    const invalidCheckpoints={badRuntime,badPlayer,badClock,badTerrain,badRules,badGarrison,badDiplomacy,badStructureIndex,badActorReference,badCursor,objectSet,unsupportedRuntime,aliasFogMap,aliasOwnerIndex,aliasGarrisonIndex,aliasCollections,aliasActorCollections,aliasActorObject,aliasRuntimeArrays,aliasPlayerAsArea,aliasActorWrongPath,aliasActorCrossCollection,aliasRelationElsewhere,aliasPlayerFlags,aliasFlagLayers,aliasSetupFlag};
    for(const [label,invalid] of Object.entries(invalidCheckpoints)){
      assert.throws(()=>checkpointEngine.restoreCheckpoint({version:'statefall-engine-checkpoint/v2',payload:encodeGraph(invalid)}),undefined,label);
      assert.equal(JSON.stringify(checkpointEngine.checkpoint()),atomicBefore); assert.equal(checkpointEngine.serializeCanonical(),atomicCanonical);
      assert.equal(JSON.stringify(checkpointEngine.runtimeCheckpoint()),atomicRuntime);
    }
    for(const [actorName,index] of Object.keys(decodeGraph(jsonCheckpoint.payload).state.actors).map((name,index)=>[name,index])){
      for(const poison of [NaN,Infinity,-Infinity]){
        const invalid=decodeGraph(jsonCheckpoint.payload),collection=invalid.state.actors[actorName],probe={nested:[new Set([poison])]};
        if(actorName==='players') collection[0].numericPoison=probe; else collection.push(probe);
        assert.throws(()=>checkpointEngine.restoreCheckpoint({version:'statefall-engine-checkpoint/v2',payload:encodeGraph(invalid)}),undefined,`${actorName} non-finite poison ${index}`);
        assert.equal(JSON.stringify(checkpointEngine.checkpoint()),atomicBefore);
      }
    }
    const missingCompatibility={version:'statefall-engine-checkpoint/v2',payload:encodeGraph({state:decodeGraph(jsonCheckpoint.payload).state,runtime:decodeGraph(jsonCheckpoint.payload).runtime})};
    assert.throws(()=>checkpointEngine.restoreCheckpoint(missingCompatibility),/payload/);
    assert.throws(()=>checkpointEngine.restoreCheckpoint({version:'statefall-engine-checkpoint/v1',payload:jsonCheckpoint.payload}),/Historical engine checkpoint v1/);
    const wrongSize=createEngine(diagnostics({...options,W:121,settings:{...options.settings,seed:'WRONG-SIZE'}}));
    wrongSize.start(); const wrongSizeCheckpoint=wrongSize.checkpoint();
    assert.throws(()=>checkpointEngine.restoreCheckpoint(wrongSizeCheckpoint),/dimensions/);
    assert.equal(JSON.stringify(checkpointEngine.checkpoint()),atomicBefore);

    checkpointEngine.reset();
    const resetFrame=checkpointEngine.interpolationFrame();
    assert.equal(resetFrame.current.tickId,0);
    assert.equal(resetFrame.previous,resetFrame.current,'reset must expose one empty current frame');
    assert.ok(Object.values(resetFrame.current.actors).every(actors=>actors.length===0));

    const replayFile={seed:'CHECKPOINT-REPLAY',settings:{...options.settings,seed:'CHECKPOINT-REPLAY'},cmds:[{t:0,k:'focus',a:[0.31]},{t:20,k:'focus',a:[0.72]},{t:55,k:'focus',a:[0.46]}],hashes:[],tick:100,hashv:2};
    const uninterrupted=createEngine(diagnostics({...options,settings:replayFile.settings})),resumed=createEngine(diagnostics({...options,settings:replayFile.settings}));
    uninterrupted.loadReplay(replayFile); uninterrupted.start();
    for(let index=0;index<40;index++) uninterrupted.tick();
    const replayCheckpoint=JSON.parse(JSON.stringify(uninterrupted.checkpoint()));
    for(let index=40;index<100;index++) uninterrupted.tick();
    resumed.restoreCheckpoint(replayCheckpoint);
    for(let index=40;index<100;index++) resumed.tick();
    assert.equal(resumed.serializeCanonical(),uninterrupted.serializeCanonical(),'checkpointed replay diverged from uninterrupted replay');
    assert.equal(resumed.stateHash(),uninterrupted.stateHash());
    assert.equal(JSON.stringify(resumed.runtimeCheckpoint()),JSON.stringify(uninterrupted.runtimeCheckpoint()));

    const airOptions=diagnostics({...options,settings:{...options.settings,seed:'STATIC-AAM',map:'land'}}),airSource=createEngine(airOptions);
    airSource.start(); airSource.drainEvents();
    const airState=airSource.compatibility.state,airPlayers=airState.actors.players,airHuman=airPlayers[airState.match.playerId],airEnemy=airPlayers.find(player=>player.kind==='bot');
    const humanTile=airState.map.owner.findIndex(owner=>owner===airHuman.id),enemyTile=airState.map.owner.findIndex(owner=>owner===airEnemy.id);
    const humanField=airSource.compatibility.systems.structures.addStructure({type:'airfield',owner:airHuman.id,t:humanTile,building:false,level:1,aq:[]});
    const enemyField=airSource.compatibility.systems.structures.addStructure({type:'airfield',owner:airEnemy.id,t:enemyTile,building:false,level:1,aq:[]});
    const bomber=airSource.compatibility.systems.air.spawnAircraft(humanField,'bomber'),fighter=airSource.compatibility.systems.air.spawnAircraft(enemyField,'fighter');
    bomber.state='out'; bomber.x=30; bomber.y=30; bomber.tx=40; bomber.ty=30;
    fighter.state='patrol'; fighter.x=30; fighter.y=30; fighter.tx=30; fighter.ty=30; fighter.until=1000;
    airSource.compatibility.systems.air.stepAir();
    assert.equal(airState.actors.shells.length,1,'air interception did not create an AAM shell');
    assert.deepEqual(airState.actors.shells[0].target,{x:bomber.x,y:bomber.y,static:true});
    assert.equal(airState.actors.aircraft.includes(bomber),false,'AAM static target was not detached from the destroyed aircraft');
    const airCheckpoint=JSON.parse(JSON.stringify(airSource.checkpoint())),airCanonical=airSource.serializeCanonical(),airHash=airSource.stateHash(),airRuntime=JSON.stringify(airSource.runtimeCheckpoint());
    const airRestored=createEngine(airOptions); airRestored.restoreCheckpoint(airCheckpoint);
    assert.equal(airRestored.serializeCanonical(),airCanonical); assert.equal(airRestored.stateHash(),airHash); assert.equal(JSON.stringify(airRestored.runtimeCheckpoint()),airRuntime);
    const malformedStatic=decodeGraph(airCheckpoint.payload); malformedStatic.state.actors.shells[0].target={x:1,y:2,static:false};
    const aliasedStatic=decodeGraph(airCheckpoint.payload); aliasedStatic.state.actors.shells.push({...aliasedStatic.state.actors.shells[0],target:aliasedStatic.state.actors.shells[0].target});
    assert.throws(()=>airRestored.restoreCheckpoint({version:'statefall-engine-checkpoint/v2',payload:encodeGraph(malformedStatic)}),/shell target/i);
    assert.throws(()=>airRestored.restoreCheckpoint({version:'statefall-engine-checkpoint/v2',payload:encodeGraph(aliasedStatic)}),/multiple owners|prohibited alias/i);
    for(let guard=0;airRestored.compatibility.state.actors.shells.length&&guard<20;guard++){ airSource.tick(); airRestored.tick(); }
    assert.equal(airRestored.compatibility.state.actors.shells.length,0,'restored AAM shell did not expire');
    assert.equal(airRestored.serializeCanonical(),airSource.serializeCanonical(),'restored AAM continuation changed canonical bytes');
    assert.equal(airRestored.stateHash(),airSource.stateHash()); assert.equal(JSON.stringify(airRestored.runtimeCheckpoint()),JSON.stringify(airSource.runtimeCheckpoint()));

    for(const won of [true,false]){
      const phaseOptions=diagnostics({...options,settings:{...options.settings,seed:`CONTINUE-${won?'WIN':'LOSS'}`}});
      const arrangeEnd=engine=>{
        const state=engine.compatibility.state,human=engine.compatibility.getMe();
        if(won){
          for(let tile=0;tile<state.map.owner.length&&human.tiles/state.map.landCount<0.8;tile++) if(state.map.owner[tile]>=0&&state.map.owner[tile]!==human.id) engine.compatibility.systems.landCombat.setOwner(tile,human.id);
        }else human.alive=false;
      };
      const direct=createEngine(phaseOptions); direct.start(); direct.drainEvents(); arrangeEnd(direct);
      assert.equal(direct.tick(),true); assert.equal(direct.presentation().state.lifecycle.over,true);
      assert.equal(direct.continueAfterEnd(won),true);
      assert.deepEqual(direct.runtimeCheckpoint().commands.log,[{t:1,k:'continueAfterEnd',a:[won],phase:'post-systems'}]);
      const saved=JSON.parse(JSON.stringify(direct.checkpoint()));
      for(let tick=1;tick<5;tick++) assert.equal(direct.tick(),true);
      const restored=createEngine(phaseOptions); restored.restoreCheckpoint(saved); for(let tick=1;tick<5;tick++) restored.tick();
      const replayFile={seed:phaseOptions.settings.seed,settings:phaseOptions.settings,cmds:[{t:1,k:'continueAfterEnd',a:[won],phase:'post-systems'}],hashes:[],tick:5,hashv:2};
      const replayed=createEngine(phaseOptions); replayed.loadReplay(replayFile); replayed.start(); replayed.drainEvents(); arrangeEnd(replayed); for(let tick=0;tick<5;tick++) assert.equal(replayed.tick(),true);
      const restarted=createEngine(phaseOptions); restarted.start(); restarted.reset(); restarted.loadReplay(replayFile); restarted.start(); restarted.drainEvents(); arrangeEnd(restarted); for(let tick=0;tick<5;tick++) assert.equal(restarted.tick(),true);
      const lifecycle=direct.presentation().state.lifecycle;
      assert.equal(lifecycle.over,false); assert.equal(lifecycle.freeplay,true); assert.equal(lifecycle.spectating,!won);
      assert.equal(restored.serializeCanonical(),direct.serializeCanonical()); assert.equal(replayed.serializeCanonical(),direct.serializeCanonical()); assert.equal(restarted.serializeCanonical(),direct.serializeCanonical());
      assert.equal(restored.stateHash(),direct.stateHash()); assert.equal(replayed.stateHash(),direct.stateHash()); assert.equal(restarted.stateHash(),direct.stateHash());
      assert.equal(restored.presentation().runtime.rngDraws,direct.presentation().runtime.rngDraws); assert.equal(replayed.presentation().runtime.rngDraws,direct.presentation().runtime.rngDraws); assert.equal(restarted.presentation().runtime.rngDraws,direct.presentation().runtime.rngDraws);
      assert.equal(replayed.runtimeCheckpoint().replay.i,1); assert.equal(replayed.presentation().state.clock.tickN,5);
    }

    let guarded,delivered=0;
    guarded=createEngine(diagnostics({...options,settings:{...options.settings,seed:'SINK-GUARD'}}),{eventSink:event=>{
      delivered++;
      if(delivered===1) guarded.tick();
      if(delivered===2) throw new Error('adapter failure');
      assert.ok(Object.isFrozen(event)&&Object.isFrozen(event.args));
    }});
    guarded.start(); guarded.tick();
    const guardedBefore=guarded.serializeCanonical(),queued=guarded.drainEvents();
    assert.ok(queued.length>=2);
    // Put a fresh equivalent batch through the configured sink so delivery failures cannot reach the simulation operation.
    guarded.start(); guarded.tick();
    const result=guarded.dispatchEvents();
    assert.equal(delivered,result.events.length,'dispatch must attempt every queued event');
    assert.equal(result.errors.length,2,'reentrant and throwing sink failures should be reported separately');
    assert.equal(guarded.serializeCanonical(),guardedBefore,'sink failures or re-entry changed completed simulation state');

    const ending=createEngine({...options,settings:{...options.settings,seed:'END-EVENT'}});
    ending.start(); ending.drainEvents();
    const endBefore={canonical:ending.serializeCanonical(),runtime:JSON.stringify(ending.runtimeCheckpoint()),frame:ending.interpolationFrame(),events:ending.drainEvents(),lifecycle:{...ending.presentation().state.lifecycle}};
    let getterCalls=0;
    const poisonMetadata={}; Object.defineProperty(poisonMetadata,'poison',{enumerable:true,get(){ getterCalls++; throw new Error('poison getter ran'); }});
    const endPoisons=[poisonMetadata,new Proxy({},{getPrototypeOf(){ throw new Error('proxy trap'); }}),{callback(){}},{nested:new (class Metadata{})()}];
    for(const metadata of endPoisons){
      assert.throws(()=>ending.endMatch('Victory','rejected metadata',metadata));
      assert.equal(ending.serializeCanonical(),endBefore.canonical); assert.equal(JSON.stringify(ending.runtimeCheckpoint()),endBefore.runtime);
      assert.equal(ending.interpolationFrame(),endBefore.frame); assert.deepEqual(ending.drainEvents(),endBefore.events); assert.deepEqual({...ending.presentation().state.lifecycle},endBefore.lifecycle);
    }
    assert.equal(getterCalls,0,'endMatch evaluated a poison getter');
    assert.equal(ending.endMatch('Victory','test end'),true);
    const endedBytes=ending.serializeCanonical();
    const endDelivery=ending.dispatchEvents(event=>{
      if(event.type==='matchEnded') assert.throws(()=>{ event.args[0]='Changed'; },TypeError);
    });
    assert.ok(endDelivery.events.some(event=>event.type==='matchEnded'));
    assert.equal(ending.serializeCanonical(),endedBytes,'match-ended presentation changed canonical bytes');

    const sinkEvents=[];
    const sinkFreeEnd=createEngine({...options,settings:{...options.settings,seed:'END-EQUALITY'}});
    const sinkEnd=createEngine({...options,settings:{...options.settings,seed:'END-EQUALITY'}},{eventSink:event=>sinkEvents.push(event)});
    sinkFreeEnd.start(); sinkEnd.start(); sinkEnd.dispatchEvents(); sinkFreeEnd.drainEvents();
    for(let index=0;index<10;index++){ sinkFreeEnd.tick(); sinkEnd.tick(); sinkEnd.dispatchEvents(); if(index%3===0) sinkFreeEnd.drainEvents(); }
    sinkFreeEnd.endMatch('Victory','equal end');
    sinkEnd.endMatch('Victory','equal end');
    sinkEnd.dispatchEvents(); sinkFreeEnd.drainEvents();
    assert.equal(sinkEnd.presentation().state.lifecycle.over,true);
    assert.ok(sinkEvents.some(event=>event.type==='matchEnded'));
    assert.equal(sinkEnd.serializeCanonical(),sinkFreeEnd.serializeCanonical(),'sink/no-sink engines diverged through an end state');
  }finally{
    for(const [name,descriptor] of descriptors){ if(descriptor) Object.defineProperty(globalThis,name,descriptor); else delete globalThis[name]; }
  }
  console.log('Engine integration checks PASS');
})().catch(error=>{ console.error(error); process.exitCode=1; });
