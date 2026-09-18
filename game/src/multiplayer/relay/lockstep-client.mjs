import {sha256} from '../../sim/sha256.mjs';

const plain=value=>value!==null&&typeof value==='object'&&!Array.isArray(value)&&(Object.getPrototypeOf(value)===Object.prototype||Object.getPrototypeOf(value)===null);
const exact=(value,keys)=>plain(value)&&Object.keys(value).length===keys.length&&keys.every(key=>Object.hasOwn(value,key));
const integer=value=>Number.isSafeInteger(value)&&value>=0;
const digest=value=>typeof value==='string'&&/^[0-9a-f]{64}$/.test(value);
const fail=message=>{ throw new TypeError(message); };
const RECOVERY_LIMITS=Object.freeze({checkpointBytes:32*1024*1024,batches:50_000,commands:100_000});

function normalizedOutcome(entry,status){ return status==='applied'?{seq:entry.seq,id:entry.id,status}:{seq:entry.seq,id:entry.id,status,code:'STATE_INVALID'}; }

export function createRelayCheckpointEvidence(engine){
  const checkpointBytes=JSON.stringify(engine.checkpoint()),metadata=engine.replayMetadata();
  const tick=engine.presentation().state.clock.tickN,legacyHash=engine.runtimeCheckpoint().commands.hashes.find(item=>item[0]===tick)?.[1]??(tick===0?metadata.legacyHash:null);
  if(typeof legacyHash!=='string') fail('Checkpoint evidence requires the engine checkpoint hash for its exact tick.');
  return Object.freeze({checkpointBytes,report:Object.freeze({digest:metadata.canonical,legacyHash,rngDraws:metadata.rngDraws,commandCount:metadata.commandCount,replayCursor:metadata.replayCursor,checkpointSha256:sha256(checkpointBytes)})});
}

export function deriveDuelResult(engine){
  const players=engine.presentation().state.actors.players.filter(player=>player.kind==='human');
  if(players.length!==2||engine.presentation().state.actors.players.some(player=>player.kind==='bot')) fail('Completion requires exactly two humans and no bots.');
  const ordered=[...players].sort((left,right)=>Number(right.alive)-Number(left.alive)||right.tiles-left.tiles||left.id-right.id);
  const standings=ordered.map((player,index)=>Object.freeze({seatId:player.id,rank:index+1,alive:player.alive,tiles:player.tiles}));
  const winnerSeatIds=standings.filter(item=>item.alive).map(item=>item.seatId);
  if(winnerSeatIds.length!==1) fail('Terminal duel state must have exactly one living winner.');
  return Object.freeze({standings:Object.freeze(standings),winnerSeatIds:Object.freeze(winnerSeatIds)});
}

export function createRelayCompletionEvidence(engine,terminalOutcomeDigest){
  if(!digest(terminalOutcomeDigest)||!engine.presentation().state.lifecycle.over) fail('Completion evidence requires a terminal engine and outcome digest.');
  const metadata=engine.replayMetadata(),result=deriveDuelResult(engine);
  return Object.freeze({tick:engine.presentation().state.clock.tickN,canonical:metadata.canonical,legacyHash:metadata.legacyHash,rngDraws:metadata.rngDraws,commandCount:metadata.commandCount,commandCursor:metadata.commandCount,standings:result.standings,winnerSeatIds:result.winnerSeatIds,terminalOutcomeDigest});
}

export function applyRelayBatch(engine,batch){
  const tick=engine.presentation().state.clock.tickN;
  if(tick!==batch.tick) throw new Error(`Relay batch tick ${batch.tick} does not match engine tick ${tick}.`);
  const outcomes=[];
  for(const entry of batch.commands){
    if(engine.presentation().state.lifecycle.over||engine.presentation().state.lifecycle.paused){ outcomes.push(normalizedOutcome(entry,'rejected')); continue; }
    try{ engine.issue(entry.command); outcomes.push(normalizedOutcome(entry,'applied')); }
    catch(error){
      if(error instanceof RangeError) outcomes.push(normalizedOutcome(entry,'rejected'));
      else throw new Error('Relay command application failed.');
    }
  }
  let advancedTicks=0;
  for(;advancedTicks<batch.turnTicks;advancedTicks++) if(!engine.tick()) break;
  const lifecycle=engine.presentation().state.lifecycle,status=lifecycle.over?'over':lifecycle.paused?'paused':'running';
  if(status==='running'&&advancedTicks!==batch.turnTicks) throw new Error(`Engine stopped without a deterministic lifecycle at relay tick ${batch.tick+advancedTicks}.`);
  const outcomeDigest=sha256(JSON.stringify(outcomes));
  return Object.freeze({tick:engine.presentation().state.clock.tickN,advancedTicks,outcomes:Object.freeze(outcomes.map(Object.freeze)),status,outcomeDigest});
}

function validateRecovery(recovery){
  const keys=['kind','tick','baseSequence','baseBatchCount','commandCount','checkpointBytes','report','suffix','targetTick','terminalSequence','terminalCommandCount','terminalBatchCount','unresolved'];
  if(!exact(recovery,keys)||!['genesis','checkpoint'].includes(recovery.kind)||!integer(recovery.tick)||!integer(recovery.targetTick)||recovery.targetTick<recovery.tick||!integer(recovery.baseSequence)||!integer(recovery.terminalSequence)||recovery.terminalSequence<recovery.baseSequence||!integer(recovery.baseBatchCount)||!integer(recovery.terminalBatchCount)||recovery.terminalBatchCount<recovery.baseBatchCount||!integer(recovery.commandCount)||recovery.commandCount>recovery.baseSequence||!integer(recovery.terminalCommandCount)||recovery.terminalCommandCount<recovery.commandCount||recovery.terminalCommandCount>recovery.commandCount+recovery.terminalSequence-recovery.baseSequence||!Array.isArray(recovery.suffix)||recovery.suffix.length!==recovery.terminalBatchCount-recovery.baseBatchCount||recovery.suffix.length>RECOVERY_LIMITS.batches) fail('Invalid recovery envelope.');
  if(recovery.kind==='checkpoint'){
    if(typeof recovery.checkpointBytes!=='string'||new TextEncoder().encode(recovery.checkpointBytes).byteLength>RECOVERY_LIMITS.checkpointBytes||!plain(recovery.report)||!plain(recovery.report.digest)||recovery.report.digest.version!=='statefall-authoritative-state/v1'||!digest(recovery.report.digest.sha256)||!integer(recovery.report.rngDraws)||recovery.report.commandCount!==recovery.commandCount||!digest(recovery.report.checkpointSha256)||sha256(recovery.checkpointBytes)!==recovery.report.checkpointSha256) fail('Invalid recovery checkpoint evidence.');
  }else if(recovery.checkpointBytes!==null||recovery.report!==null||recovery.tick!==0||recovery.baseSequence!==0||recovery.baseBatchCount!==0||recovery.commandCount!==0) fail('Invalid genesis recovery point.');
  let expectedTick=recovery.tick,expectedTurn=null,expectedSequence=recovery.baseSequence+1,sealedCount=0,appliedCount=0,turnTicks=null;
  const ids=new Set();
  for(const batch of recovery.suffix){
    if(!exact(batch,['v','type','roomId','turn','tick','turnTicks','commands','outcomes','outcomeDigest','advancedTicks','status'])||batch.v!==1||batch.type!=='relay.batch'||typeof batch.roomId!=='string'||!integer(batch.turn)||!integer(batch.tick)||!integer(batch.turnTicks)||100%batch.turnTicks!==0||batch.tick!==expectedTick||expectedTurn!==null&&batch.turn!==expectedTurn+1||turnTicks!==null&&batch.turnTicks!==turnTicks||!integer(batch.advancedTicks)||batch.advancedTicks>batch.turnTicks||!['running','paused','over'].includes(batch.status)||batch.status==='running'&&batch.advancedTicks!==batch.turnTicks||!Array.isArray(batch.commands)||!Array.isArray(batch.outcomes)||batch.commands.length!==batch.outcomes.length||sealedCount+batch.commands.length>RECOVERY_LIMITS.commands||!digest(batch.outcomeDigest)||sha256(JSON.stringify(batch.outcomes))!==batch.outcomeDigest) fail('Recovery suffix contains an invalid sealed batch.');
    turnTicks=batch.turnTicks;
    for(let index=0;index<batch.commands.length;index++){
      const entry=batch.commands[index],outcome=batch.outcomes[index];
      if(!exact(entry,['seq','id','seat','turn','tick','command'])||entry.seq!==expectedSequence++||typeof entry.id!=='string'||ids.has(entry.id)||entry.tick!==batch.tick||entry.turn!==batch.turn||!plain(entry.command)) fail('Recovery suffix command sequence is missing, duplicate, reordered, or out of range.');
      ids.add(entry.id);
      const outcomeKeys=outcome?.status==='applied'?['seq','id','status']:['seq','id','status','code'];
      if(!exact(outcome,outcomeKeys)||outcome.seq!==entry.seq||outcome.id!==entry.id||!['applied','rejected'].includes(outcome.status)||outcome.status==='rejected'&&outcome.code!=='STATE_INVALID') fail('Recovery suffix outcome does not match its command.');
      sealedCount++; if(outcome.status==='applied') appliedCount++;
    }
    expectedTick+=batch.advancedTicks; expectedTurn=batch.turn;
  }
  if(expectedTick!==recovery.targetTick||expectedSequence-1!==recovery.terminalSequence||sealedCount!==recovery.terminalSequence-recovery.baseSequence||appliedCount!==recovery.terminalCommandCount-recovery.commandCount) fail('Recovery suffix does not cover the declared sequence and applied-command ranges.');
}

export function catchUpRelayRecovery(engine,recovery){
  validateRecovery(recovery);
  const rollback=engine.checkpoint();
  try{
    if(recovery.kind==='checkpoint') engine.restoreCheckpoint(JSON.parse(recovery.checkpointBytes));
    let tick=engine.presentation().state.clock.tickN;
    if(tick!==recovery.tick) throw new Error('Recovery checkpoint tick does not match its declared base tick.');
    if(recovery.kind==='checkpoint'){
      const metadata=engine.replayMetadata(),expected=recovery.report;
      if(metadata.canonical.version!==expected.digest.version||metadata.canonical.sha256!==expected.digest.sha256||metadata.rngDraws!==expected.rngDraws||metadata.commandCount!==expected.commandCount) throw new Error('Restored checkpoint metadata differs from consensus.');
    }
    for(const batch of recovery.suffix){
      const applied=applyRelayBatch(engine,batch);
      if(applied.outcomeDigest!==batch.outcomeDigest||JSON.stringify(applied.outcomes)!==JSON.stringify(batch.outcomes)||applied.advancedTicks!==batch.advancedTicks||applied.status!==batch.status) throw new Error('Recovery batch result differs from consensus.');
      tick=applied.tick;
    }
    if(tick!==recovery.targetTick) throw new Error('Recovery did not reach its exact target tick.');
    return tick;
  }catch(error){
    engine.restoreCheckpoint(rollback);
    throw error;
  }
}
