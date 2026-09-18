'use strict';

const assert=require('node:assert/strict');
const crypto=require('node:crypto');
const fs=require('node:fs');
const os=require('node:os');
const path=require('node:path');
const {spawnSync}=require('node:child_process');

(async()=>{
  const {createEngine}=await import('../game/src/sim/engine.mjs');
  const {createMultiplayerProofEngine,createMultiplayerReplayEngine}=await import('../game/src/multiplayer/proof-engine.mjs');
  const {RELAY_PROTOCOL_VERSION,roomConfigurationFingerprint,validateRoomConfiguration}=await import('../game/src/multiplayer/room-configuration.mjs');
  const {createRelayRoom,RelayProtocolError,RELAY_LIMITS}=await import('../game/src/multiplayer/relay/room.mjs');
  const {applyRelayBatch,catchUpRelayRecovery,createRelayCheckpointEvidence,createRelayCompletionEvidence}=await import('../game/src/multiplayer/relay/lockstep-client.mjs');
  const {inspectEngineCheckpointMetadata}=await import('../game/src/sim/engine-checkpoint.mjs');
  const {sha256}=await import('../game/src/sim/sha256.mjs');
  const sha=value=>crypto.createHash('sha256').update(value).digest('hex');
  const settings={seed:'PHASE-D2-LOCKSTEP',map:'land',humanSeats:2,troops:275,gold:725};
  const roomConfig=validateRoomConfiguration({protocol:RELAY_PROTOCOL_VERSION,W:120,H:72,bots:0,tickMs:100,difficulty:'hard',settings,seats:[0,1]});
  assert.equal(roomConfigurationFingerprint(roomConfig),roomConfigurationFingerprint({seats:[0,1],settings:{...roomConfig.settings},difficulty:'hard',tickMs:100,bots:0,H:72,W:120,protocol:RELAY_PROTOCOL_VERSION}),'fingerprint depends on property order');
  const makeEngine=(overrides={})=>{ const config=validateRoomConfiguration({...roomConfig,...overrides,settings:{...roomConfig.settings,...overrides.settings}}); const engine=createMultiplayerProofEngine(config); engine.start(); engine.drainEvents(); return engine; };
  const makeRoom=(id='D2ROOM',options={})=>createRelayRoom({roomId:id,roomConfig,...options});
  const envelope=(connection,id,targetTurn,seat,value)=>({v:1,type:'relay.command',roomId:connection.room.roomId,seat,generation:connection.generation,id,targetTurn,command:{k:'focus',a:[value],p:seat}});
  const expectCode=(code,operation)=>assert.throws(operation,error=>error instanceof RelayProtocolError&&error.code===code,`expected relay error ${code}`);
  const outcomeEnvelope=(connection,roomId,turn,result)=>({v:1,type:'relay.batch-outcome-report',roomId,seat:connection.seat,generation:connection.generation,turn,advancedTicks:result.advancedTicks,status:result.status,outcomes:result.outcomes,outcomeDigest:result.outcomeDigest});
  function settle(room,connections,engines){
    const batch=room.advance(),results=engines.map(engine=>applyRelayBatch(engine,batch));
    const accepted=connections.map((connection,index)=>room.reportBatchOutcomes(outcomeEnvelope(connection,room.metadata().roomId,batch.turn,results[index])));
    assert.equal(accepted.at(-1).status,'agreed');
    return {batch,results};
  }
  function checkpointEnvelope(connection,roomId,tick,report){ return {v:1,type:'relay.checkpoint-report',roomId,seat:connection.seat,generation:connection.generation,tick,report}; }

  {
    for(const [index,seed] of ['A','-','A'.repeat(200)].entries()) assert.doesNotThrow(()=>createRelayRoom({roomId:`SEED-${index}`,roomConfig:{...roomConfig,settings:{...roomConfig.settings,seed}}}));
    for(const [index,seed] of ['',`A_${1}`,'A\u0000B','Caf\u00e9','A'.repeat(201)].entries()) expectCode('MALFORMED',()=>createRelayRoom({roomId:`BAD-SEED-${index}`,roomConfig:{...roomConfig,settings:{...roomConfig.settings,seed}}}));
    assert.throws(()=>validateRoomConfiguration({...roomConfig,difficulty:'nightmare'}),/Unsupported difficulty/);
    expectCode('MALFORMED',()=>createRelayRoom({roomId:'BAD-DIFFICULTY',roomConfig:{...roomConfig,difficulty:'nightmare'}}));
  }

  {
    const engine=makeEngine(),players=engine.presentation().state.actors.players;
    assert.deepEqual(players.filter(player=>player.kind!=='neutral').map(player=>[player.id,player.kind]),[[0,'human'],[1,'human']]);
    engine.issue({k:'focus',a:[.123],p:1}); for(let tick=0;tick<150;tick++) engine.tick();
    assert.equal(players[1].focus,.123,'AI acted for a human seat');
    assert.throws(()=>createEngine({W:120,H:72,bots:1,difficulty:'hard',settings}),/multiplayer proof engine factory/);
    assert.throws(()=>makeEngine({settings:{humanSeats:2,risky:true}}),/multiplayer draft protocol|non-draft human seats/);
    assert.doesNotThrow(()=>createEngine({W:120,H:72,bots:1,difficulty:'hard',settings:{...settings,humanSeats:1,risky:true}}));
    expectCode('MALFORMED',()=>makeRoom('BADTICKS',{turnTicks:3}));
    const rejected=makeEngine(),control=makeEngine(),before=rejected.replayMetadata().rngDraws;
    assert.throws(()=>rejected.issue({k:'recall',a:[999999],p:0}),RangeError);
    assert.equal(rejected.replayMetadata().rngDraws,before,'rejected validation consumed RNG immediately');
    for(let tick=0;tick<100;tick++){ rejected.tick(); control.tick(); }
    assert.equal(rejected.serializeCanonical(),control.serializeCanonical(),'rejected validation changed future deterministic state');
    const mixed=makeEngine(),validOnly=makeEngine(); for(let tick=0;tick<4;tick++){ mixed.tick(); validOnly.tick(); }
    assert.throws(()=>mixed.issue({k:'recall',a:[999999],p:0}),RangeError); mixed.issue({k:'focus',a:[.31],p:0}); validOnly.issue({k:'focus',a:[.31],p:0});
    for(let tick=4;tick<100;tick++){ mixed.tick(); validOnly.tick(); }
    assert.equal(mixed.serializeCanonical(),validOnly.serializeCanonical(),'rejected command changed a following applied command');
  }

  {
    const left=makeRoom('ORDERLEFT'),right=makeRoom('ORDERRIGHT'),lc=[left.connect(0),left.connect(1)],rc=[right.connect(0),right.connect(1)],le=[makeEngine(),makeEngine()],re=[makeEngine(),makeEngine()];
    [envelope(lc[1],'seat-1',2,1,.8),envelope(lc[0],'seat-0',2,0,.2)].forEach(input=>left.submit(input));
    [envelope(rc[0],'seat-0',2,0,.2),envelope(rc[1],'seat-1',2,1,.8)].forEach(input=>right.submit(input));
    for(let turn=0;turn<3;turn++){ settle(left,lc,le); settle(right,rc,re); }
    assert.deepEqual(left.orderedLog(),right.orderedLog(),'arrival order changed deterministic relay order');
    assert.deepEqual(left.orderedLog().map(entry=>[entry.seq,entry.seat,entry.id,entry.state]),[[1,0,'seat-0','sealed'],[2,1,'seat-1','sealed']]);
  }

  {
    const room=makeRoom('REJECTS'),first=room.connect(0),second=room.connect(1),engines=[makeEngine(),makeEngine()],base=room.orderedLog();
    expectCode('UNKNOWN_SEAT',()=>room.submit({...envelope(first,'unknown-seat',2,0,.3),seat:9}));
    expectCode('UNAUTHORIZED',()=>room.submit({...envelope(first,'unauthorized',2,0,.3),command:{k:'focus',a:[.3],p:1}}));
    assert.deepEqual(room.orderedLog(),base,'rejected unauthorized input mutated the log');
    const mutable=envelope(first,'owned',2,0,.4); room.submit(mutable); mutable.command.a[0]=.9;
    expectCode('DUPLICATE_ID',()=>room.submit(envelope(first,'owned',2,0,.4)));
    expectCode('CONFLICTING_ID',()=>room.submit(envelope(second,'owned',2,1,.4)));
    expectCode('EARLY_INPUT',()=>room.submit(envelope(first,'too-soon',1,0,.4)));
    expectCode('OUT_OF_WINDOW',()=>room.submit(envelope(first,'too-far',3,0,.4)));
    expectCode('MALFORMED',()=>room.submit({...envelope(first,'bad',2,0,.4),extra:true}));
    const cyclic=envelope(first,'cyclic',2,0,.4); cyclic.command.a.push(cyclic.command);
    expectCode('MALFORMED',()=>room.submit(cyclic));
    const deep=envelope(first,'deep',2,0,.4); let nested=deep.command.a; for(let i=0;i<40;i++){ const child=[]; nested.push(child); nested=child; }
    expectCode('RESOURCE_LIMIT',()=>room.submit(deep));
    expectCode('RESOURCE_LIMIT',()=>room.submit(envelope(first,'oversize',2,0,'x'.repeat(RELAY_LIMITS.maxEnvelopeBytes))));
    settle(room,[first,second],engines); expectCode('LATE_INPUT',()=>room.submit(envelope(first,'late',0,0,.4)));
    const replacement=room.connect(0); expectCode('STALE_GENERATION',()=>room.submit(envelope(first,'stale',3,0,.4)));
    room.submit(envelope(replacement,'current',3,0,.5)); settle(room,[replacement,second],engines); const sealed=settle(room,[replacement,second],engines).batch;
    assert.equal(sealed.commands[0].command.a[0],.4,'accepted input retained caller-owned mutation');
    assert.ok(Object.isFrozen(sealed)&&Object.isFrozen(sealed.commands[0].command.a),'relay batch was not deeply frozen');
  }

  {
    const room=makeRoom('INVALID'),connections=[room.connect(0),room.connect(1)],engines=[makeEngine(),makeEngine()];
    room.submit({v:1,type:'relay.command',roomId:'INVALID',seat:0,generation:connections[0].generation,id:'a-invalid',targetTurn:2,command:{k:'recall',a:[999999],p:0}});
    room.submit(envelope(connections[0],'b-valid',2,0,.77));
    settle(room,connections,engines); settle(room,connections,engines); const {results}=settle(room,connections,engines);
    assert.deepEqual(results[0].outcomes.map(value=>[value.id,value.status,value.code]),[['a-invalid','rejected','STATE_INVALID'],['b-valid','applied',undefined]]);
    assert.deepEqual(results[0],results[1]); assert.equal(engines[0].presentation().state.actors.players[0].focus,.77);
    settle(room,connections,engines);
  }

  {
    const room=makeRoom('OUTCOME-DESYNC'),connections=[room.connect(0),room.connect(1)],engines=[makeEngine(),makeEngine()];
    room.submit({v:1,type:'relay.command',roomId:'OUTCOME-DESYNC',seat:0,generation:connections[0].generation,id:'invalid',targetTurn:2,command:{k:'recall',a:[999999],p:0}});
    settle(room,connections,engines); settle(room,connections,engines);
    const batch=room.advance(),results=engines.map(engine=>applyRelayBatch(engine,batch));
    room.reportBatchOutcomes(outcomeEnvelope(connections[0],'OUTCOME-DESYNC',batch.turn,results[0]));
    const dishonest=[{seq:batch.commands[0].seq,id:'invalid',status:'applied'}];
    const detected=room.reportBatchOutcomes({...outcomeEnvelope(connections[1],'OUTCOME-DESYNC',batch.turn,results[1]),outcomes:dishonest,outcomeDigest:sha256(JSON.stringify(dishonest))});
    assert.equal(detected.status,'desync'); expectCode('DESYNC',()=>room.advance());
  }

  const room=makeRoom(),connections=[room.connect(0),room.connect(1)],engines=[makeEngine(),makeEngine()],checkpoints=new Map();
  for(let turn=0;turn<210;turn++){
    if(turn%9===0){
      const target=turn+2,commands=[envelope(connections[0],`a-${turn}`,target,0,(turn%50)/50),envelope(connections[1],`b-${turn}`,target,1,1-(turn%50)/50)];
      (turn%18?commands:commands.reverse()).forEach(command=>room.submit(command));
    }
    settle(room,connections,engines);
    const tick=engines[0].presentation().state.clock.tickN;
    if(tick%100===0){
      const evidence=engines.map(createRelayCheckpointEvidence);
      assert.equal(engines[0].serializeCanonical(),engines[1].serializeCanonical(),`canonical state differs at tick ${tick}`);
      assert.deepEqual(evidence[0].report,evidence[1].report,`checkpoint evidence differs at tick ${tick}`);
      const reordered={commandCount:evidence[0].report.commandCount,checkpointSha256:evidence[0].report.checkpointSha256,replayCursor:null,rngDraws:evidence[0].report.rngDraws,legacyHash:evidence[0].report.legacyHash,digest:{sha256:evidence[0].report.digest.sha256,version:evidence[0].report.digest.version}};
      assert.equal(room.reportCheckpoint(checkpointEnvelope(connections[0],'D2ROOM',tick,reordered)).status,'pending');
      assert.equal(room.reportCheckpoint(checkpointEnvelope(connections[1],'D2ROOM',tick,evidence[1].report)).status,'agreed');
      checkpoints.set(tick,evidence[0]);
    }
  }
  assert.ok(engines[0].presentation().state.clock.tickN>=400,'lockstep proof did not run for 400 ticks');

  {
    const dishonest=makeRoom('DISHONEST'),dc=[dishonest.connect(0),dishonest.connect(1)],peers=[makeEngine(),makeEngine()],tickZero=createRelayCheckpointEvidence(peers[0]);
    for(let turn=0;turn<50;turn++) settle(dishonest,dc,peers);
    const real=createRelayCheckpointEvidence(peers[0]),report={...real.report,checkpointSha256:tickZero.report.checkpointSha256};
    dc.forEach(connection=>dishonest.reportCheckpoint(checkpointEnvelope(connection,'DISHONEST',100,report)));
    expectCode('CHECKPOINT_MISMATCH',()=>dishonest.retainRecoveryCheckpoint({v:1,type:'relay.retain-checkpoint',roomId:'DISHONEST',seat:0,generation:dc[0].generation,tick:100,checkpointBytes:tickZero.checkpointBytes}));
    const other=makeEngine({settings:{...settings,seed:'OTHER'}}); for(let i=0;i<100;i++) other.tick(); const wrong=createRelayCheckpointEvidence(other);
    expectCode('CHECKPOINT_MISMATCH',()=>dishonest.retainRecoveryCheckpoint({v:1,type:'relay.retain-checkpoint',roomId:'DISHONEST',seat:0,generation:dc[0].generation,tick:100,checkpointBytes:wrong.checkpointBytes}));
    expectCode('RESOURCE_LIMIT',()=>dishonest.retainRecoveryCheckpoint({v:1,type:'relay.retain-checkpoint',roomId:'DISHONEST',seat:0,generation:dc[0].generation,tick:100,checkpointBytes:'x'.repeat(RELAY_LIMITS.maxRetainedCheckpointBytes+1)}));
    const deepCheckpoint=JSON.stringify({version:'statefall-engine-checkpoint/v2',payload:{version:'statefall-graph/v1',root:Array.from({length:140},()=>0).reduceRight(value=>({value}),null),nodes:[]}});
    assert.throws(()=>inspectEngineCheckpointMetadata(JSON.parse(deepCheckpoint)));
    expectCode('CHECKPOINT_MISMATCH',()=>dishonest.retainRecoveryCheckpoint({v:1,type:'relay.retain-checkpoint',roomId:'DISHONEST',seat:0,generation:dc[0].generation,tick:100,checkpointBytes:deepCheckpoint}));
    const cyclicCheckpoint={v:1,type:'relay.retain-checkpoint',roomId:'DISHONEST',seat:0,generation:dc[0].generation,tick:100,checkpointBytes:null}; cyclicCheckpoint.checkpointBytes=cyclicCheckpoint;
    expectCode('MALFORMED',()=>dishonest.retainRecoveryCheckpoint(cyclicCheckpoint));
  }

  room.retainRecoveryCheckpoint({v:1,type:'relay.retain-checkpoint',roomId:'D2ROOM',seat:0,generation:connections[0].generation,tick:300,checkpointBytes:checkpoints.get(300).checkpointBytes});
  room.disconnect({v:1,type:'relay.disconnect',roomId:'D2ROOM',seat:1,generation:connections[1].generation});
  expectCode('ROOM_STALLED',()=>room.advance());
  const reconnect=room.connect(1),recovery=JSON.parse(JSON.stringify(reconnect.recovery)),fresh=makeEngine();
  assert.ok(recovery.suffix.length>0,'reconnect proof did not retain a suffix after the older checkpoint');
  catchUpRelayRecovery(fresh,recovery);
  assert.equal(fresh.serializeCanonical(),engines[0].serializeCanonical(),'checkpoint plus sealed batches did not recover canonical room state');
  assert.deepEqual(fresh.runtimeCheckpoint().commands,engines[0].runtimeCheckpoint().commands,'recovered command history differs');

  for(const mutate of [
    value=>value.suffix.find(batch=>batch.commands.length).commands.shift(),
    value=>{ const batch=value.suffix.find(item=>item.commands.length>1); batch.commands[1]=batch.commands[0]; },
    value=>value.suffix.find(batch=>batch.commands.length>1).commands.reverse(),
    value=>{ value.suffix.find(batch=>batch.commands.length).commands[0].seq=value.terminalSequence+1; }
  ]){
    const target=makeEngine(),before=target.serializeCanonical(),bad=JSON.parse(JSON.stringify(recovery)); mutate(bad);
    assert.throws(()=>catchUpRelayRecovery(target,bad)); assert.equal(target.serializeCanonical(),before,'invalid recovery mutated the engine');
  }

  {
    const rejected=makeRoom('REJECT-RECOVERY'),rc=[rejected.connect(0),rejected.connect(1)],peers=[makeEngine(),makeEngine()];
    rejected.submit({v:1,type:'relay.command',roomId:'REJECT-RECOVERY',seat:0,generation:rc[0].generation,id:'a-invalid-before',targetTurn:2,command:{k:'recall',a:[999999],p:0}});
    rejected.submit(envelope(rc[0],'b-valid-before',2,0,.31));
    for(let turn=0;turn<50;turn++) settle(rejected,rc,peers);
    const checkpoint=peers.map(createRelayCheckpointEvidence);
    rc.forEach((connection,index)=>rejected.reportCheckpoint(checkpointEnvelope(connection,'REJECT-RECOVERY',100,checkpoint[index].report)));
    rejected.retainRecoveryCheckpoint({v:1,type:'relay.retain-checkpoint',roomId:'REJECT-RECOVERY',seat:0,generation:rc[0].generation,tick:100,checkpointBytes:checkpoint[0].checkpointBytes});
    rejected.submit({v:1,type:'relay.command',roomId:'REJECT-RECOVERY',seat:0,generation:rc[0].generation,id:'c-invalid-after',targetTurn:52,command:{k:'recall',a:[999999],p:0}});
    rejected.submit(envelope(rc[0],'d-valid-after',52,0,.62));
    for(let turn=50;turn<=52;turn++) settle(rejected,rc,peers);
    rejected.disconnect({v:1,type:'relay.disconnect',roomId:'REJECT-RECOVERY',seat:1,generation:rc[1].generation});
    rc[1]=rejected.connect(1); const recovery=JSON.parse(JSON.stringify(rc[1].recovery)),fresh=makeEngine();
    assert.deepEqual({baseSequence:recovery.baseSequence,commandCount:recovery.commandCount,terminalSequence:recovery.terminalSequence,terminalCommandCount:recovery.terminalCommandCount},{baseSequence:2,commandCount:1,terminalSequence:4,terminalCommandCount:2});
    catchUpRelayRecovery(fresh,recovery);
    assert.equal(fresh.serializeCanonical(),peers[0].serializeCanonical());
    for(const mutate of [
      value=>value.suffix.find(batch=>batch.outcomes.some(outcome=>outcome.status==='rejected')).outcomes.shift(),
      value=>{ const batch=value.suffix.find(item=>item.outcomes.length>1); batch.outcomes.reverse(); batch.outcomeDigest=sha256(JSON.stringify(batch.outcomes)); },
      value=>{ const batch=value.suffix.find(item=>item.outcomes.some(outcome=>outcome.status==='rejected')),index=batch.outcomes.findIndex(outcome=>outcome.status==='rejected'); batch.outcomes[index]={seq:batch.outcomes[index].seq,id:batch.outcomes[index].id,status:'applied'}; batch.outcomeDigest=sha256(JSON.stringify(batch.outcomes)); }
    ]){
      const target=makeEngine(),before=target.serializeCanonical(),bad=structuredClone(recovery); mutate(bad);
      assert.throws(()=>catchUpRelayRecovery(target,bad)); assert.equal(target.serializeCanonical(),before,'rejection tamper mutated recovery target');
    }
    const recoveredPeers=[peers[0],fresh];
    rejected.submit({v:1,type:'relay.command',roomId:'REJECT-RECOVERY',seat:0,generation:rc[0].generation,id:'terminal-surrender',targetTurn:55,command:{k:'surrender',a:[],p:0}});
    settle(rejected,rc,recoveredPeers); settle(rejected,rc,recoveredPeers); const terminal=settle(rejected,rc,recoveredPeers);
    const completion=recoveredPeers.map(engine=>createRelayCompletionEvidence(engine,terminal.results[0].outcomeDigest));
    rejected.reportCompletion({v:1,type:'relay.completion-report',roomId:'REJECT-RECOVERY',seat:0,generation:rc[0].generation,evidence:completion[0]});
    assert.equal(rejected.reportCompletion({v:1,type:'relay.completion-report',roomId:'REJECT-RECOVERY',seat:1,generation:rc[1].generation,evidence:completion[1]}).status,'agreed');
    const replay=JSON.parse(rejected.completeMatch().replayBytes);
    assert.deepEqual(replay.cmds.map(command=>command.k),['focus','focus','surrender']);
    assert.equal(replay.final.commandCount,3); assert.equal(replay.cmds.some(command=>command.k==='recall'),false);
    assert.ok(Buffer.byteLength(JSON.stringify(replay))<=RELAY_LIMITS.maxReplayBytes);
    const imported=createMultiplayerReplayEngine(replay); imported.start(); while(imported.presentation().state.clock.tickN<replay.tick) imported.tick(); imported.tick();
    assert.equal(imported.presentation().runtime.replay.mismatch,false,JSON.stringify(imported.presentation().runtime.replay));
    const temp=fs.mkdtempSync(path.join(os.tmpdir(),'statefall-d2-rejections-')),file=path.join(temp,'rejections.state');
    try{ fs.writeFileSync(file,JSON.stringify(replay)); const checked=spawnSync(process.execPath,['tools/replaycheck.js',file],{cwd:path.resolve(__dirname,'..'),encoding:'utf8',timeout:120_000}); assert.equal(checked.status,0,checked.stdout+checked.stderr); }
    finally{ fs.rmSync(temp,{recursive:true,force:true}); }
  }

  {
    const pending=makeRoom('PENDING'),pc=[pending.connect(0),pending.connect(1)],peers=[makeEngine(),makeEngine()];
    const batch=pending.advance(),results=peers.map(engine=>applyRelayBatch(engine,batch));
    pending.reportBatchOutcomes(outcomeEnvelope(pc[0],'PENDING',batch.turn,results[0]));
    pending.disconnect({v:1,type:'relay.disconnect',roomId:'PENDING',seat:1,generation:pc[1].generation});
    expectCode('ROOM_STALLED',()=>pending.advance());
    const replacement=pending.connect(1);
    assert.equal(pending.reportBatchOutcomes(outcomeEnvelope(replacement,'PENDING',batch.turn,results[1])).status,'agreed');
    expectCode('DUPLICATE_REPORT',()=>pending.reportBatchOutcomes(outcomeEnvelope(pc[0],'PENDING',batch.turn,results[0])));
  }

  {
    const pending=makeRoom('CHECKPOINT-MEMBER'),pc=[pending.connect(0),pending.connect(1)],peers=[makeEngine(),makeEngine()];
    for(let turn=0;turn<50;turn++) settle(pending,pc,peers);
    const evidence=peers.map(createRelayCheckpointEvidence);
    assert.equal(pending.reportCheckpoint(checkpointEnvelope(pc[0],'CHECKPOINT-MEMBER',100,evidence[0].report)).status,'pending');
    expectCode('CHECKPOINT_PENDING',()=>pending.advance());
    pending.disconnect({v:1,type:'relay.disconnect',roomId:'CHECKPOINT-MEMBER',seat:1,generation:pc[1].generation});
    assert.equal(pending.drainEvents().some(event=>event.type==='relay.checkpoint-agreed'),false,'disconnect manufactured checkpoint consensus');
    const replacement=pending.connect(1);
    assert.deepEqual(replacement.recovery.unresolved,{turn:49,tick:100,outcomeRequired:false,checkpointRequired:true,completionRequired:false,status:'running'});
    assert.equal(pending.reportCheckpoint(checkpointEnvelope(replacement,'CHECKPOINT-MEMBER',100,evidence[1].report)).status,'agreed');
  }

  for(const surrenderedSeat of [0,1]){
    const duel=makeRoom(`COMPLETE-${surrenderedSeat}`),dc=[duel.connect(0),duel.connect(1)],peers=[makeEngine(),makeEngine()];
    duel.submit({v:1,type:'relay.command',roomId:`COMPLETE-${surrenderedSeat}`,seat:surrenderedSeat,generation:dc[surrenderedSeat].generation,id:`surrender-${surrenderedSeat}`,targetTurn:2,command:{k:'surrender',a:[],p:surrenderedSeat}});
    settle(duel,dc,peers); settle(duel,dc,peers); const terminal=settle(duel,dc,peers);
    assert.equal(terminal.results[0].status,'over'); assert.equal(terminal.results[0].advancedTicks,0);
    assert.equal(duel.metadata().currentTick,4); expectCode('COMPLETION_PENDING',()=>duel.advance());
    const evidence=peers.map(engine=>createRelayCompletionEvidence(engine,terminal.results[0].outcomeDigest));
    const first=duel.reportCompletion({v:1,type:'relay.completion-report',roomId:`COMPLETE-${surrenderedSeat}`,seat:dc[0].seat,generation:dc[0].generation,evidence:evidence[0]});
    const second=duel.reportCompletion({v:1,type:'relay.completion-report',roomId:`COMPLETE-${surrenderedSeat}`,seat:dc[1].seat,generation:dc[1].generation,evidence:evidence[1]});
    assert.equal(first.status,'pending'); assert.equal(second.status,'agreed');
    const completed=duel.completeMatch(),replayBytes=completed.replayBytes; assert.equal(replayBytes,duel.completedReplay());
    const replay=JSON.parse(replayBytes); assert.deepEqual(replay.result.winnerSeatIds,[1-surrenderedSeat]);
    assert.equal(replay.cmds.length,1); assert.deepEqual(replay.cmds[0],{t:4,k:'surrender',a:[],p:surrenderedSeat});
    for(let copy=0;copy<2;copy++){
      const imported=createMultiplayerReplayEngine(replay); imported.start();
      while(imported.presentation().state.clock.tickN<replay.tick) assert.equal(imported.tick(),true);
      imported.tick();
      const final=imported.replayMetadata();
      assert.equal(final.canonical.sha256,replay.final.canonical.sha256); assert.equal(final.legacyHash,replay.final.legacyHash);
      assert.equal(final.rngDraws,replay.final.rngDraws); assert.equal(final.commandCount,replay.final.commandCount); assert.equal(final.replayCursor,replay.final.replayCursor);
    }
    const production=createEngine(); assert.throws(()=>production.loadReplay(replay),/multiplayer replay factory/);
    if(surrenderedSeat===0){
      const temp=fs.mkdtempSync(path.join(os.tmpdir(),'statefall-d2-replay-')),file=path.join(temp,'duel.state');
      try{ fs.writeFileSync(file,replayBytes); const checked=spawnSync(process.execPath,['tools/replaycheck.js',file],{cwd:path.resolve(__dirname,'..'),encoding:'utf8',timeout:120_000}); assert.equal(checked.status,0,checked.stdout+checked.stderr); }
      finally{ fs.rmSync(temp,{recursive:true,force:true}); }
    }
    expectCode('COMPLETED',()=>duel.advance()); expectCode('COMPLETED',()=>duel.submit(envelope(dc[1-surrenderedSeat],'after-complete',4,1-surrenderedSeat,.5)));
  }

  {
    const paused=makeRoom('PAUSED'),pc=[paused.connect(0),paused.connect(1)],peers=[createMultiplayerProofEngine(roomConfig,{testBridge:true}),createMultiplayerProofEngine(roomConfig,{testBridge:true})];
    for(const engine of peers){ engine.start(); engine.drainEvents(); engine.setLifecycleForDiagnostics('paused',true); }
    const result=settle(paused,pc,peers); assert.equal(result.results[0].status,'paused'); assert.equal(result.results[0].advancedTicks,0); expectCode('PAUSED',()=>paused.advance());
    assert.equal(paused.drainEvents().some(event=>event.type==='relay.lifecycle'&&event.state==='paused'),true);
  }

  {
    const bad=makeRoom('BAD-COMPLETION'),bc=[bad.connect(0),bad.connect(1)],peers=[makeEngine(),makeEngine()];
    bad.submit({v:1,type:'relay.command',roomId:'BAD-COMPLETION',seat:0,generation:bc[0].generation,id:'surrender',targetTurn:2,command:{k:'surrender',a:[],p:0}});
    settle(bad,bc,peers); settle(bad,bc,peers); const terminal=settle(bad,bc,peers),evidence=peers.map(engine=>createRelayCompletionEvidence(engine,terminal.results[0].outcomeDigest));
    bad.reportCompletion({v:1,type:'relay.completion-report',roomId:'BAD-COMPLETION',seat:0,generation:bc[0].generation,evidence:evidence[0]});
    const forged={...evidence[1],canonical:{...evidence[1].canonical,sha256:'0'.repeat(64)}};
    assert.equal(bad.reportCompletion({v:1,type:'relay.completion-report',roomId:'BAD-COMPLETION',seat:1,generation:bc[1].generation,evidence:forged}).status,'desync');
    expectCode('DESYNC',()=>bad.advance());
  }

  {
    const flood=makeRoom('FLOOD'),fc=[flood.connect(0),flood.connect(1)];
    for(let index=0;index<RELAY_LIMITS.maxCommandsPerTurn;index++) flood.submit(envelope(fc[0],`f-${index}`,2,0,.5));
    expectCode('RESOURCE_LIMIT',()=>flood.submit(envelope(fc[0],'f-over',2,0,.5)));
    flood.close(); expectCode('CLOSED',()=>flood.advance());
  }

  {
    const bounded=makeRoom('REPLAY-BOUND'),connection=bounded.connect(0),selected=Array.from({length:10_000},(_,index)=>index);
    let accepted=0;
    for(;;){
      try{ bounded.submit({v:1,type:'relay.command',roomId:'REPLAY-BOUND',seat:0,generation:connection.generation,id:`large-${accepted}`,targetTurn:2,command:{k:'menu',a:[{act:'move'},0,selected,-1,1,0,0],p:0}}); accepted++; }
      catch(error){ assert.ok(error instanceof RelayProtocolError); assert.equal(error.code,'RESOURCE_LIMIT'); break; }
    }
    assert.ok(accepted>0&&accepted<RELAY_LIMITS.maxPendingCommands,'replay byte bound did not precede count bounds');
  }

  console.log('Phase D2 hardened relay consensus, recovery, bounds, and 400+ tick lockstep PASS');
})().catch(error=>{ console.error(error); process.exitCode=1; });
