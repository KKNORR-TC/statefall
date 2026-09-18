import {assertCommandArguments,assertCommandKind} from '../../sim/command-schema.mjs';
import {inspectEngineCheckpointMetadata} from '../../sim/engine-checkpoint.mjs';
import {sha256} from '../../sim/sha256.mjs';
import replayConstraints from '../../sim/replay-constraints.json' with {type:'json'};
import {engineOptionsFromRoomConfiguration,RELAY_PROTOCOL_VERSION,roomConfigurationFingerprint,validateRoomConfiguration} from '../room-configuration.mjs';

export {RELAY_PROTOCOL_VERSION};
export const RELAY_CHECKPOINT_INTERVAL=100;
export const RELAY_LIMITS=Object.freeze({
  maxEnvelopeBytes:128*1024,maxDepth:32,maxArrayLength:10_000,maxProperties:20_000,
  maxCommandsPerTurn:256,maxPendingCommands:1_024,maxCommandLog:100_000,
  maxRetainedCheckpointBytes:32*1024*1024,maxEvents:256,maxCheckpointHistory:64,maxBatchHistory:6_400,
  maxReplayBytes:replayConstraints.maxFileBytes,maxReplayTicks:6_400,maxReplayCheckpointBytes:512
});

const plain=value=>value!==null&&typeof value==='object'&&!Array.isArray(value)&&(Object.getPrototypeOf(value)===Object.prototype||Object.getPrototypeOf(value)===null);
const exact=(value,keys)=>plain(value)&&Object.keys(value).length===keys.length&&keys.every(key=>Object.hasOwn(value,key));
const integer=(value,min=0,max=Number.MAX_SAFE_INTEGER)=>Number.isSafeInteger(value)&&value>=min&&value<=max;
const digest=value=>typeof value==='string'&&/^[0-9a-f]{64}$/.test(value);
const utf8Length=value=>new TextEncoder().encode(value).byteLength;

export class RelayProtocolError extends Error{
  constructor(code,message){ super(message); this.name='RelayProtocolError'; this.code=code; }
}

function fail(code,message){ throw new RelayProtocolError(code,message); }

function cloneJson(value,path='value',limits=RELAY_LIMITS){
  const ancestors=new Set(); let properties=0;
  function clone(item,itemPath,depth){
    if(depth>limits.maxDepth) fail('RESOURCE_LIMIT',`${itemPath} exceeds the nesting limit.`);
    if(item===null||typeof item==='string'||typeof item==='boolean') return item;
    if(typeof item==='number'){ if(Number.isFinite(item)) return item; fail('MALFORMED',`${itemPath} must be finite.`); }
    if(typeof item!=='object') fail('MALFORMED',`${itemPath} must be JSON-compatible.`);
    if(ancestors.has(item)) fail('MALFORMED',`${itemPath} must not contain cycles.`);
    if(!Array.isArray(item)&&!plain(item)) fail('MALFORMED',`${itemPath} must use plain objects and arrays.`);
    if(Object.getOwnPropertySymbols(item).length) fail('MALFORMED',`${itemPath} must not contain symbol properties.`);
    const descriptors=Object.getOwnPropertyDescriptors(item),keys=Object.keys(descriptors);
    if(Array.isArray(item)&&item.length>limits.maxArrayLength) fail('RESOURCE_LIMIT',`${itemPath} exceeds the array limit.`);
    properties+=keys.length;
    if(properties>limits.maxProperties) fail('RESOURCE_LIMIT',`${itemPath} exceeds the property limit.`);
    const result=Array.isArray(item)?[]:{}; ancestors.add(item);
    for(const key of keys){
      const descriptor=descriptors[key];
      if(!('value' in descriptor)) fail('MALFORMED',`${itemPath}.${key} must be a data property.`);
      result[key]=clone(descriptor.value,`${itemPath}.${key}`,depth+1);
    }
    ancestors.delete(item); return result;
  }
  const result=clone(value,path,0),bytes=utf8Length(JSON.stringify(result));
  if(bytes>limits.maxEnvelopeBytes) fail('RESOURCE_LIMIT',`${path} exceeds the payload byte limit.`);
  return result;
}

function freezeDeep(value){
  if(value===null||typeof value!=='object'||Object.isFrozen(value)) return value;
  for(const child of Object.values(value)) freezeDeep(child);
  return Object.freeze(value);
}

const message=value=>freezeDeep(cloneJson(value,'relay message',{...RELAY_LIMITS,maxEnvelopeBytes:RELAY_LIMITS.maxRetainedCheckpointBytes+RELAY_LIMITS.maxEnvelopeBytes,maxDepth:64,maxArrayLength:RELAY_LIMITS.maxCommandLog,maxProperties:RELAY_LIMITS.maxCommandLog*20}));
const seatSnapshot=seat=>({id:seat.id,connected:seat.connected,generation:seat.generation});
const normalizedReport=report=>({digest:{version:report.digest.version,sha256:report.digest.sha256},legacyHash:report.legacyHash,rngDraws:report.rngDraws,commandCount:report.commandCount,replayCursor:report.replayCursor,checkpointSha256:report.checkpointSha256});
const reportsEqual=(left,right)=>JSON.stringify(left)===JSON.stringify(right);
const outcomesEqual=(left,right)=>left.outcomeDigest===right.outcomeDigest&&left.advancedTicks===right.advancedTicks&&left.status===right.status&&JSON.stringify(left.outcomes)===JSON.stringify(right.outcomes);

function assertRoomId(value){ if(typeof value!=='string'||!/^[A-Za-z0-9][A-Za-z0-9_-]{0,63}$/.test(value)) fail('MALFORMED','roomId is invalid.'); }
function assertFingerprint(value){ if(!digest(value)) fail('MALFORMED','settingsFingerprint must be a lowercase SHA-256 digest.'); }
function assertGeneration(value){ if(!integer(value,1)) fail('MALFORMED','generation must be a positive integer.'); }
function assertCommandId(value){ if(typeof value!=='string'||!/^[A-Za-z0-9][A-Za-z0-9._:-]{0,127}$/.test(value)) fail('MALFORMED','command id is invalid.'); }
function validateOutcomes(outcomes,commands){
  if(!Array.isArray(outcomes)||outcomes.length!==commands.length) fail('MALFORMED','Batch outcomes must correspond exactly to sealed commands.');
  return outcomes.map((outcome,index)=>{
    const command=commands[index];
    if(!exact(outcome,outcome.status==='applied'?['seq','id','status']:['seq','id','status','code'])||outcome.seq!==command.seq||outcome.id!==command.id||!['applied','rejected'].includes(outcome.status)||outcome.status==='rejected'&&outcome.code!=='STATE_INVALID') fail('MALFORMED','Invalid normalized batch outcome.');
    return outcome.status==='applied'?{seq:outcome.seq,id:outcome.id,status:'applied'}:{seq:outcome.seq,id:outcome.id,status:'rejected',code:'STATE_INVALID'};
  });
}

export function createRelayRoom(options={}){
  if(!plain(options)) fail('MALFORMED','Relay room options must be a plain object.');
  const roomId=options.roomId; let roomConfig;
  try{ roomConfig=validateRoomConfiguration(options.roomConfig); }catch(error){ fail('MALFORMED',error.message); }
  const settingsFingerprint=roomConfigurationFingerprint(roomConfig),seed=roomConfig.settings.seed;
  const engineOptions=engineOptionsFromRoomConfiguration(roomConfig);
  assertRoomId(roomId); assertFingerprint(settingsFingerprint);
  const turnTicks=options.turnTicks??2,inputDelayTurns=options.inputDelayTurns??2;
  if(!integer(turnTicks,1,100)||RELAY_CHECKPOINT_INTERVAL%turnTicks!==0||!integer(inputDelayTurns,1,100)) fail('MALFORMED','turnTicks must be a positive divisor of 100 and input delay must be 1-100 turns.');
  const seatIds=roomConfig.seats;
  if(!Array.isArray(seatIds)||!seatIds.length||seatIds.length>10||seatIds.some(id=>!integer(id,0,9))||new Set(seatIds).size!==seatIds.length) fail('MALFORMED','seatIds must contain 1-10 unique player IDs.');
  const seats=new Map([...seatIds].sort((a,b)=>a-b).map(id=>[id,{id,connected:false,generation:0}]));
  const pending=new Map(),commandIds=new Map(),commandLog=[],batches=[],checkpoints=new Map(),events=[];
  const replayBaseReserve=utf8Length(JSON.stringify({schema:'statefall-replay-fixture/v1',v:1,hashv:2,requiresCanonicalCheckpoints:true,game:'1.10.12',seed:String(seed),settings:{...roomConfig.settings,diff:roomConfig.difficulty,country:null,allowed:null,customFlag:null},cmds:[],hashes:[],result:{standings:[{seatId:0,rank:1,alive:true,tiles:2_000_000},{seatId:1,rank:2,alive:false,tiles:2_000_000}],winnerSeatIds:[0]},tick:RELAY_LIMITS.maxReplayTicks,finalHash:'0'.repeat(8),finalDigest:{version:'statefall-authoritative-state/v1',sha256:'0'.repeat(64)},final:{tick:RELAY_LIMITS.maxReplayTicks,legacyHash:'0'.repeat(8),canonical:{version:'statefall-authoritative-state/v1',sha256:'0'.repeat(64)},rngDraws:Number.MAX_SAFE_INTEGER,commandCount:RELAY_LIMITS.maxCommandLog,replayCursor:RELAY_LIMITS.maxCommandLog},multiplayer:{relayProtocol:RELAY_PROTOCOL_VERSION,roomConfig,roomFingerprint:settingsFingerprint,seats:roomConfig.seats,engineOptions}}))+4_096;
  if(replayBaseReserve+RELAY_LIMITS.maxCheckpointHistory*RELAY_LIMITS.maxReplayCheckpointBytes>RELAY_LIMITS.maxReplayBytes) fail('RESOURCE_LIMIT','Room configuration leaves no bounded replay export capacity.');
  let pendingCount=0,replayCommandBytes=0,currentTurn=0,settledTick=0,nextSequence=1,recovery=null,state='open',completion=null;

  const currentTick=()=>settledTick;
  const requiredSeats=()=>Array.from(seats.keys());
  function emit(event){ if(events.length>=RELAY_LIMITS.maxEvents) events.shift(); events.push(event); }
  function metadata(){
    return message({v:1,type:'relay.room',protocol:RELAY_PROTOCOL_VERSION,roomId,settingsFingerprint,roomConfig,seed,turnTicks,inputDelayTurns,currentTurn,currentTick:currentTick(),nextSequence,state,seats:Array.from(seats.values(),seatSnapshot)});
  }
  function requireSeat(id){ const seat=seats.get(id); if(!seat) fail('UNKNOWN_SEAT',`Unknown relay seat: ${id}.`); return seat; }
  function authenticate(id,generation){
    const seat=requireSeat(id); assertGeneration(generation);
    if(generation!==seat.generation) fail('STALE_GENERATION','Connection generation is stale.');
    if(!seat.connected) fail('DISCONNECTED','Seat is not connected.');
    return seat;
  }
  function requireOpen(){ if(state==='desync') fail('DESYNC','Room is terminally desynchronized.'); if(state==='closed') fail('CLOSED','Room is closed.'); if(state==='completed') fail('COMPLETED','Room is completed and immutable.'); }
  function recoveryPayload(seatId){
    const point=recovery||{kind:'genesis',tick:0,baseSequence:0,baseBatchCount:0,commandCount:0,checkpointBytes:null,report:null};
    let terminalBatchCount=point.baseBatchCount;
    while(terminalBatchCount<batches.length&&batches[terminalBatchCount].result?.type==='relay.batch-outcomes-agreed') terminalBatchCount++;
    const suffix=batches.slice(point.baseBatchCount,terminalBatchCount).map(batch=>batch.public);
    const terminalSequence=suffix.reduce((last,batch)=>batch.commands.at(-1)?.seq??last,point.baseSequence);
    const terminalCommandCount=point.commandCount+suffix.reduce((count,batch)=>count+batch.outcomes.filter(outcome=>outcome.status==='applied').length,0);
    const latest=batches.at(-1),checkpoint=Array.from(checkpoints.values()).find(record=>!record.result);
    const unresolved=latest&&!latest.result?{turn:latest.turn,tick:latest.tick,outcomeRequired:!latest.reports.has(seatId),checkpointRequired:false,completionRequired:false,status:null}:checkpoint?{turn:latest?.turn??null,tick:checkpoint.tick,outcomeRequired:false,checkpointRequired:!checkpoint.reports.has(seatId),completionRequired:false,status:latest?.result?.status??null}:state==='completing'?{turn:latest.turn,tick:settledTick,outcomeRequired:false,checkpointRequired:false,completionRequired:!completion?.reports.has(seatId),status:'over',terminalOutcomeDigest:latest.result.outcomeDigest}:null;
    return {kind:point.kind,tick:point.tick,baseSequence:point.baseSequence,baseBatchCount:point.baseBatchCount,commandCount:point.commandCount,checkpointBytes:point.checkpointBytes,report:point.report,suffix,targetTick:point.tick+suffix.reduce((ticks,batch)=>ticks+batch.advancedTicks,0),terminalSequence,terminalCommandCount,terminalBatchCount,unresolved};
  }
  function connect(seatId){
    requireOpen(); const seat=requireSeat(seatId); seat.generation++; seat.connected=true;
    return message({v:1,type:'relay.connected',room:metadata(),seat:seat.id,generation:seat.generation,recovery:recoveryPayload(seat.id)});
  }
  function finishCheckpoint(record){
    if(record.result||!record.required.every(id=>record.reports.has(id))) return record.result;
    const reports=record.required.map(id=>({seat:id,report:record.reports.get(id)})),first=reports[0]?.report;
    const expectedCommandCount=record.appliedCommandCount;
    const agreed=!!first&&reports.every(item=>reportsEqual(item.report,first))&&first.commandCount===expectedCommandCount;
    record.result=agreed
      ?message({v:1,type:'relay.checkpoint-agreed',tick:record.tick,baseSequence:record.baseSequence,baseBatchCount:record.baseBatchCount,report:first,seats:[...record.required]})
      :message({v:1,type:'relay.desync',scope:'checkpoint',tick:record.tick,expectedCommandCount,reports});
    if(!agreed) state='desync'; emit(record.result); return record.result;
  }
  function finishBatch(record){
    if(record.result||!record.required.every(id=>record.reports.has(id))) return record.result;
    const reports=record.required.map(id=>({seat:id,report:record.reports.get(id)})),first=reports[0]?.report;
    const agreed=!!first&&reports.every(item=>outcomesEqual(item.report,first))&&first.advancedTicks<=turnTicks&&(['paused','over'].includes(first.status)||first.advancedTicks===turnTicks);
    record.result=agreed
      ?message({v:1,type:'relay.batch-outcomes-agreed',turn:record.turn,tick:record.tick,advancedTicks:first.advancedTicks,status:first.status,outcomes:first.outcomes,outcomeDigest:first.outcomeDigest,seats:[...record.required]})
      :message({v:1,type:'relay.desync',scope:'batch-outcomes',turn:record.turn,tick:record.tick,reports});
    if(agreed){
      record.public.outcomes=first.outcomes; record.public.outcomeDigest=first.outcomeDigest; record.public.advancedTicks=first.advancedTicks; record.public.status=first.status; settledTick=record.tick+first.advancedTicks;
      for(let index=0;index<record.commands.length;index++) commandLog[record.logStart+index].outcome=first.outcomes[index];
      ensureCheckpoint(settledTick);
      if(first.status==='paused'){ state='paused'; emit(message({v:1,type:'relay.lifecycle',roomId,state:'paused',turn:record.turn,tick:settledTick})); }
      if(first.status==='over') state='completing';
    }else state='desync';
    emit(record.result); return record.result;
  }
  function disconnect(envelope){
    requireOpen(); envelope=cloneJson(envelope,'disconnect envelope');
    if(!exact(envelope,['v','type','roomId','seat','generation'])||envelope.v!==1||envelope.type!=='relay.disconnect'||envelope.roomId!==roomId) fail('MALFORMED','Invalid disconnect envelope.');
    const seat=authenticate(envelope.seat,envelope.generation); seat.connected=false;
    return message({v:1,type:'relay.disconnected',roomId,seat:seat.id,generation:seat.generation});
  }
  function submit(envelope){
    requireOpen(); envelope=cloneJson(envelope,'command envelope');
    if(state!=='open') fail(state==='paused'?'PAUSED':'COMPLETION_PENDING','Room does not accept commands in its current lifecycle.');
    if(!exact(envelope,['v','type','roomId','seat','generation','id','targetTurn','command'])||envelope.v!==1||envelope.type!=='relay.command'||envelope.roomId!==roomId) fail('MALFORMED','Invalid command envelope.');
    const seat=authenticate(envelope.seat,envelope.generation); assertCommandId(envelope.id);
    if(!integer(envelope.targetTurn,0,5_000_000)) fail('MALFORMED','targetTurn is invalid.');
    if(!exact(envelope.command,['k','a','p'])) fail('MALFORMED','Invalid relay command payload.');
    const command=cloneJson(envelope.command,'command');
    try{ assertCommandKind(command.k); assertCommandArguments(command.k,command.a); }catch{ fail('MALFORMED','Invalid relay command schema.'); }
    if(command.p!==seat.id) fail('UNAUTHORIZED','Only the assigned seat may submit commands for itself.');
    const fingerprint=JSON.stringify({seat:seat.id,targetTurn:envelope.targetTurn,command}),prior=commandIds.get(envelope.id);
    if(prior!=null) fail(prior===fingerprint?'DUPLICATE_ID':'CONFLICTING_ID','Command id has already been used.');
    const assignedTurn=currentTurn+inputDelayTurns;
    if(envelope.targetTurn<currentTurn) fail('LATE_INPUT','Command target turn has already passed.');
    if(envelope.targetTurn<assignedTurn) fail('EARLY_INPUT','Command does not satisfy the configured input delay.');
    if(envelope.targetTurn>assignedTurn) fail('OUT_OF_WINDOW','Command target turn is outside the current input window.');
    const turnItems=pending.get(envelope.targetTurn)||[];
    if(turnItems.length>=RELAY_LIMITS.maxCommandsPerTurn||pendingCount>=RELAY_LIMITS.maxPendingCommands||commandLog.length+pendingCount>=RELAY_LIMITS.maxCommandLog) fail('RESOURCE_LIMIT','Relay command capacity has been reached.');
    const replayCommand={t:envelope.targetTurn*turnTicks,k:command.k,a:command.a,p:command.p},commandBytes=utf8Length(JSON.stringify(replayCommand))+(replayCommandBytes?1:0);
    if(replayBaseReserve+RELAY_LIMITS.maxCheckpointHistory*RELAY_LIMITS.maxReplayCheckpointBytes+replayCommandBytes+commandBytes>RELAY_LIMITS.maxReplayBytes) fail('RESOURCE_LIMIT','Relay replay export capacity has been reached.');
    const accepted={seat:seat.id,id:envelope.id,targetTurn:envelope.targetTurn,command};
    commandIds.set(envelope.id,fingerprint); if(!pending.has(envelope.targetTurn)) pending.set(envelope.targetTurn,turnItems);
    turnItems.push(accepted); pendingCount++; replayCommandBytes+=commandBytes;
    return message({v:1,type:'relay.command-accepted',roomId,seat:seat.id,generation:seat.generation,id:envelope.id,targetTurn:envelope.targetTurn,targetTick:envelope.targetTurn*turnTicks});
  }
  function pruneCheckpoints(){ while(checkpoints.size>RELAY_LIMITS.maxCheckpointHistory){ const oldest=checkpoints.keys().next().value; if(!checkpoints.get(oldest).result) break; checkpoints.delete(oldest); } }
  function ensureCheckpoint(tick){
    if(!tick||tick%RELAY_CHECKPOINT_INTERVAL||checkpoints.has(tick)) return;
    const priorBatches=batches.filter(batch=>batch.tick<tick);
    if(priorBatches.some(batch=>batch.result?.type!=='relay.batch-outcomes-agreed')) fail('OUTCOME_PENDING','Checkpoint cannot be created before batch outcome consensus.');
    const appliedCommandCount=priorBatches.reduce((count,batch)=>count+batch.result.outcomes.filter(outcome=>outcome.status==='applied').length,0);
    checkpoints.set(tick,{tick,required:Object.freeze(requiredSeats()),reports:new Map(),result:null,baseSequence:nextSequence-1,baseBatchCount:batches.length,appliedCommandCount}); pruneCheckpoints();
  }
  function advance(){
    requireOpen();
    if(state==='paused') fail('PAUSED','Room is deterministically paused.');
    if(state==='completing') fail('COMPLETION_PENDING','Terminal completion evidence is pending.');
    if(Array.from(seats.values()).some(seat=>!seat.connected)) fail('ROOM_STALLED','Every required seat must be connected before advance.');
    if(batches.length&&batches[batches.length-1].result?.type!=='relay.batch-outcomes-agreed') fail('OUTCOME_PENDING','Previous batch outcomes are not agreed.');
    if(Array.from(checkpoints.values()).some(record=>!record.result)) fail('CHECKPOINT_PENDING','Checkpoint reports are not agreed.');
    if(batches.length>=RELAY_LIMITS.maxBatchHistory||settledTick+turnTicks>RELAY_LIMITS.maxReplayTicks||commandLog.length>=RELAY_LIMITS.maxCommandLog) fail('RESOURCE_LIMIT','Relay room history capacity has been reached.');
    const turn=currentTurn,tick=currentTick(),items=pending.get(turn)||[];
    items.sort((left,right)=>left.seat-right.seat||(left.id<right.id?-1:left.id>right.id?1:0));
    const logStart=commandLog.length,commands=items.map(item=>{
      const entry={seq:nextSequence++,id:item.id,seat:item.seat,turn,tick,command:{k:item.command.k,a:item.command.a,p:item.command.p}};
      commandLog.push({...entry,state:'sealed',outcome:null}); return entry;
    });
    pending.delete(turn); pendingCount-=items.length; currentTurn++;
    const publicBatch={v:1,type:'relay.batch',roomId,turn,tick,turnTicks,commands,outcomes:null,outcomeDigest:null};
    const record={turn,tick,required:Object.freeze(requiredSeats()),reports:new Map(),result:null,commands,logStart,public:publicBatch};
    batches.push(record);
    return message({v:1,type:'relay.batch',roomId,turn,tick,turnTicks,commands});
  }
  function reportBatchOutcomes(envelope){
    requireOpen(); envelope=cloneJson(envelope,'batch outcome report envelope');
    if(!exact(envelope,['v','type','roomId','seat','generation','turn','advancedTicks','status','outcomes','outcomeDigest'])||envelope.v!==1||envelope.type!=='relay.batch-outcome-report'||envelope.roomId!==roomId) fail('MALFORMED','Invalid batch outcome report envelope.');
    const seat=authenticate(envelope.seat,envelope.generation),record=batches[envelope.turn];
    if(!record||record.turn!==envelope.turn||!record.required.includes(seat.id)) fail('UNEXPECTED_REPORT','Seat is not required for this batch.');
    if(record.reports.has(seat.id)) fail('DUPLICATE_REPORT','Seat already reported this batch.');
    const outcomes=validateOutcomes(envelope.outcomes,record.commands);
    if(!digest(envelope.outcomeDigest)||sha256(JSON.stringify(outcomes))!==envelope.outcomeDigest) fail('MALFORMED','Batch outcome digest does not match normalized outcomes.');
    if(!integer(envelope.advancedTicks,0,record.public.turnTicks)||!['running','paused','over'].includes(envelope.status)) fail('MALFORMED','Invalid batch lifecycle result.');
    record.reports.set(seat.id,{outcomes,outcomeDigest:envelope.outcomeDigest,advancedTicks:envelope.advancedTicks,status:envelope.status});
    const result=finishBatch(record);
    return message({v:1,type:'relay.batch-outcome-report-accepted',roomId,turn:record.turn,seat:seat.id,status:result?(result.type==='relay.batch-outcomes-agreed'?'agreed':'desync'):'pending',result});
  }
  function reportCheckpoint(envelope){
    requireOpen(); envelope=cloneJson(envelope,'checkpoint report envelope');
    if(!exact(envelope,['v','type','roomId','seat','generation','tick','report'])||envelope.v!==1||envelope.type!=='relay.checkpoint-report'||envelope.roomId!==roomId) fail('MALFORMED','Invalid checkpoint report envelope.');
    const seat=authenticate(envelope.seat,envelope.generation);
    if(!integer(envelope.tick,RELAY_CHECKPOINT_INTERVAL,10_000_000)||envelope.tick%RELAY_CHECKPOINT_INTERVAL) fail('MALFORMED','Checkpoint tick is invalid.');
    if(envelope.tick>currentTick()) fail('EARLY_REPORT','Checkpoint tick has not been reached.');
    const record=checkpoints.get(envelope.tick);
    if(!record||!record.required.includes(seat.id)) fail('UNEXPECTED_REPORT','Seat is not required at this checkpoint.');
    if(record.reports.has(seat.id)) fail('DUPLICATE_REPORT','Seat already reported this checkpoint.');
    const report=envelope.report;
    if(!exact(report,['digest','legacyHash','rngDraws','commandCount','replayCursor','checkpointSha256'])||!exact(report.digest,['version','sha256'])||report.digest.version!=='statefall-authoritative-state/v1'||!digest(report.digest.sha256)||typeof report.legacyHash!=='string'||!/^[0-9a-f]{8}$/.test(report.legacyHash)||!integer(report.rngDraws)||!integer(report.commandCount,0,RELAY_LIMITS.maxCommandLog)||report.replayCursor!==null||!digest(report.checkpointSha256)) fail('MALFORMED','Invalid canonical checkpoint report.');
    record.reports.set(seat.id,normalizedReport(report));
    const result=finishCheckpoint(record);
    return message({v:1,type:'relay.checkpoint-report-accepted',roomId,tick:record.tick,seat:seat.id,status:result?(result.type==='relay.checkpoint-agreed'?'agreed':'desync'):'pending',result});
  }
  function retainRecoveryCheckpoint(envelope){
    requireOpen(); envelope=cloneJson(envelope,'retained checkpoint envelope',{...RELAY_LIMITS,maxEnvelopeBytes:RELAY_LIMITS.maxRetainedCheckpointBytes+RELAY_LIMITS.maxEnvelopeBytes});
    if(!exact(envelope,['v','type','roomId','seat','generation','tick','checkpointBytes'])||envelope.v!==1||envelope.type!=='relay.retain-checkpoint'||envelope.roomId!==roomId) fail('MALFORMED','Invalid retained checkpoint envelope.');
    const seat=authenticate(envelope.seat,envelope.generation),record=checkpoints.get(envelope.tick);
    if(!record||record.result?.type!=='relay.checkpoint-agreed'||!record.reports.has(seat.id)) fail('UNAGREED_CHECKPOINT','Checkpoint report is not agreed for this seat.');
    if(typeof envelope.checkpointBytes!=='string'||utf8Length(envelope.checkpointBytes)>RELAY_LIMITS.maxRetainedCheckpointBytes) fail('RESOURCE_LIMIT','Retained checkpoint exceeds the byte limit.');
    if(sha256(envelope.checkpointBytes)!==record.result.report.checkpointSha256) fail('CHECKPOINT_MISMATCH','Checkpoint bytes do not match the agreed report.');
    let checkpoint;
    try{ checkpoint=JSON.parse(envelope.checkpointBytes); }catch{ fail('MALFORMED','Checkpoint bytes are not valid JSON.'); }
    let inspected;
    try{ inspected=inspectEngineCheckpointMetadata(checkpoint); }catch{ fail('MALFORMED','Checkpoint bytes are not a recoverable checkpoint-v2 envelope.'); }
    if(inspected.tick!==record.tick||inspected.commandCount!==record.result.report.commandCount||inspected.rngDraws!==record.result.report.rngDraws) fail('CHECKPOINT_MISMATCH','Checkpoint metadata does not match the agreed recovery point.');
    recovery={kind:'checkpoint',tick:record.tick,baseSequence:record.baseSequence,baseBatchCount:record.baseBatchCount,commandCount:record.result.report.commandCount,checkpointBytes:envelope.checkpointBytes,report:record.result.report};
    return message({v:1,type:'relay.checkpoint-retained',roomId,tick:record.tick,baseSequence:record.baseSequence,commandCount:recovery.commandCount,checkpointSha256:record.result.report.checkpointSha256});
  }
  function reportCompletion(envelope){
    requireOpen(); envelope=cloneJson(envelope,'completion report envelope');
    if(!exact(envelope,['v','type','roomId','seat','generation','evidence'])||envelope.v!==1||envelope.type!=='relay.completion-report'||envelope.roomId!==roomId) fail('MALFORMED','Invalid completion report envelope.');
    const seat=authenticate(envelope.seat,envelope.generation),terminal=batches.at(-1);
    if(state!=='completing'||!terminal||terminal.result?.status!=='over') fail('UNEXPECTED_REPORT','No terminal batch awaits completion evidence.');
    if(!completion) completion={required:Object.freeze(requiredSeats()),reports:new Map(),result:null,replayBytes:null};
    if(completion.reports.has(seat.id)) fail('DUPLICATE_REPORT','Seat already reported completion evidence.');
    const evidence=envelope.evidence;
    const standingsValid=Array.isArray(evidence.standings)&&evidence.standings.length===2&&evidence.standings.every(item=>exact(item,['seatId','rank','alive','tiles'])&&roomConfig.seats.includes(item.seatId)&&integer(item.rank,1,2)&&typeof item.alive==='boolean'&&integer(item.tiles))&&new Set(evidence.standings.map(item=>item.seatId)).size===2&&new Set(evidence.standings.map(item=>item.rank)).size===2;
    const living=standingsValid?evidence.standings.filter(item=>item.alive).map(item=>item.seatId):[];
    if(!exact(evidence,['tick','canonical','legacyHash','rngDraws','commandCount','commandCursor','standings','winnerSeatIds','terminalOutcomeDigest'])||!exact(evidence.canonical,['version','sha256'])||evidence.canonical.version!=='statefall-authoritative-state/v1'||!digest(evidence.canonical.sha256)||typeof evidence.legacyHash!=='string'||!/^[0-9a-f]{8}$/.test(evidence.legacyHash)||evidence.tick!==settledTick||!integer(evidence.rngDraws)||!integer(evidence.commandCount,0,RELAY_LIMITS.maxCommandLog)||evidence.commandCursor!==evidence.commandCount||evidence.terminalOutcomeDigest!==terminal.result.outcomeDigest||!standingsValid||living.length!==1||!Array.isArray(evidence.winnerSeatIds)||evidence.winnerSeatIds.length!==1||evidence.winnerSeatIds[0]!==living[0]||evidence.standings.find(item=>item.rank===1)?.seatId!==living[0]) fail('MALFORMED','Invalid completion evidence.');
    const normalized=JSON.parse(JSON.stringify(evidence)); completion.reports.set(seat.id,normalized);
    if(completion.required.every(id=>completion.reports.has(id))){
      const reports=completion.required.map(id=>({seat:id,evidence:completion.reports.get(id)})),first=reports[0].evidence;
      if(!reports.every(item=>JSON.stringify(item.evidence)===JSON.stringify(first))){ state='desync'; completion.result=message({v:1,type:'relay.desync',scope:'completion',tick:settledTick,reports}); emit(completion.result); }
      else {
        const commands=commandLog.filter(entry=>entry.outcome?.status==='applied').map(entry=>({t:entry.tick,k:entry.command.k,a:entry.command.a,p:entry.command.p}));
        if(first.commandCount!==commands.length) fail('COMPLETION_MISMATCH','Completion command count differs from the consensus-applied log.');
        completion.consensus={first,commands};
        completion.result=message({v:1,type:'relay.completion-agreed',roomId,tick:settledTick,seats:[...completion.required]}); emit(completion.result);
      }
    }
    return message({v:1,type:'relay.completion-report-accepted',roomId,seat:seat.id,status:completion.result?(completion.result.type==='relay.completion-agreed'?'agreed':'desync'):'pending',result:completion.result});
  }
  function completeMatch(){
    requireOpen();
    if(state!=='completing'||completion?.result?.type!=='relay.completion-agreed'||!completion.consensus) fail('COMPLETION_PENDING','Matching completion evidence is pending.');
    const {first,commands}=completion.consensus;
    const hashes=Array.from(checkpoints.values()).filter(record=>record.result?.type==='relay.checkpoint-agreed'&&record.tick<=settledTick).map(record=>[record.tick,record.result.report.legacyHash,{canonical:record.result.report.digest,rngDraws:record.result.report.rngDraws,commandCount:record.result.report.commandCount,replayCursor:record.result.report.commandCount}]);
    const result={standings:first.standings,winnerSeatIds:first.winnerSeatIds};
    const replay={schema:'statefall-replay-fixture/v1',v:1,hashv:2,requiresCanonicalCheckpoints:true,game:'1.10.12',seed:String(seed),settings:{...roomConfig.settings,diff:roomConfig.difficulty,country:null,allowed:null,customFlag:null},cmds:commands,hashes,result,tick:settledTick,finalHash:first.legacyHash,finalDigest:first.canonical,final:{tick:settledTick,legacyHash:first.legacyHash,canonical:first.canonical,rngDraws:first.rngDraws,commandCount:first.commandCount,replayCursor:first.commandCursor},multiplayer:{relayProtocol:RELAY_PROTOCOL_VERSION,roomConfig,roomFingerprint:settingsFingerprint,seats:roomConfig.seats,engineOptions}};
    completion.replayBytes=JSON.stringify(replay);
    if(utf8Length(completion.replayBytes)>RELAY_LIMITS.maxReplayBytes) fail('RESOURCE_LIMIT','Completed replay exceeds the official checker byte limit.');
    state='completed'; completion.result=message({v:1,type:'relay.match-completed',roomId,tick:settledTick,result,replayBytes:completion.replayBytes}); emit(completion.result); return completion.result;
  }
  function close(){ if(state!=='desync') state='closed'; return message({v:1,type:'relay.closed',roomId}); }
  function drainEvents(){ return message(events.splice(0,events.length)); }
  function orderedLog(){ return message(commandLog); }

  return Object.freeze({metadata,connect,disconnect,submit,advance,reportBatchOutcomes,reportCheckpoint,retainRecoveryCheckpoint,reportCompletion,completeMatch,close,drainEvents,orderedLog,completedReplay:()=>completion?.replayBytes??null});
}
