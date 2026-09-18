import {createMultiplayerProofEngine} from './proof-engine.mjs';
import {roomConfigurationFingerprint,stableJson,validateRoomConfiguration,RELAY_PROTOCOL_VERSION} from './room-configuration.mjs';
import {applyRelayBatch,catchUpRelayRecovery,createRelayCheckpointEvidence,createRelayCompletionEvidence} from './relay/lockstep-client.mjs';

const plain=value=>value!==null&&typeof value==='object'&&!Array.isArray(value)&&(Object.getPrototypeOf(value)===Object.prototype||Object.getPrototypeOf(value)===null);
const exact=(value,keys)=>plain(value)&&Object.keys(value).length===keys.length&&keys.every(key=>Object.hasOwn(value,key));
const integer=(value,min=0)=>Number.isSafeInteger(value)&&value>=min;
const digest=value=>typeof value==='string'&&/^[0-9a-f]{64}$/.test(value);
const fail=message=>{ throw new TypeError(message); };

function validateRoom(room,expected){
  if(!plain(room)||room.v!==1||room.type!=='relay.room'||room.protocol!==RELAY_PROTOCOL_VERSION||room.roomId!==expected.roomId||room.settingsFingerprint!==expected.settingsFingerprint||stableJson(room.roomConfig)!==stableJson(expected.roomConfig)||!integer(room.turnTicks,1)||100%room.turnTicks||!integer(room.inputDelayTurns,1)||!integer(room.currentTurn)||!integer(room.currentTick)||!Array.isArray(room.seats)||!room.seats.some(item=>plain(item)&&item.id===expected.seat)) fail('Invalid relay room metadata.');
}

function validateBatch(batch,expected){
  if(!exact(batch,['v','type','roomId','turn','tick','turnTicks','commands'])||batch.v!==1||batch.type!=='relay.batch'||batch.roomId!==expected.roomId||batch.turn!==expected.turn||batch.tick!==expected.tick||batch.turnTicks!==expected.turnTicks||!Array.isArray(batch.commands)||batch.commands.length>256) fail('Duplicate, out-of-order, or malformed relay batch.');
  let priorSequence=expected.sequence;
  const ids=new Set();
  for(const entry of batch.commands){
    if(!exact(entry,['seq','id','seat','turn','tick','command'])||entry.seq!==priorSequence+1||typeof entry.id!=='string'||ids.has(entry.id)||!integer(entry.seat)||entry.turn!==batch.turn||entry.tick!==batch.tick||!exact(entry.command,['k','a','p'])||entry.command.p!==entry.seat) fail('Relay batch command order or schema is invalid.');
    priorSequence=entry.seq; ids.add(entry.id);
  }
  return priorSequence;
}

export function createRelayWebSocketClient(options={}){
  if(!plain(options)||typeof options.url!=='string'||typeof options.roomId!=='string'||!integer(options.seat)||!plain(options.roomConfig)) fail('Invalid relay client options.');
  const roomConfig=validateRoomConfiguration(options.roomConfig),settingsFingerprint=roomConfigurationFingerprint(roomConfig),expected={...options,roomConfig,settingsFingerprint};
  if(!roomConfig.seats.includes(options.seat)) fail('Relay seat is not present in the room configuration.');
  const engine=createMultiplayerProofEngine(roomConfig); engine.start(); engine.drainEvents();
  const listeners=new Set();
  let socket,generation=null,turnTicks=null,expectedTurn=0,expectedTick=0,terminalSequence=0,inputTargetTurn=null,pendingBatch=null,pendingAck=null,autoAcknowledge=options.autoAcknowledge!==false,closed=false;
  let currentStatus=Object.freeze({state:'connecting',reason:null,seat:options.seat,generation:null,tick:0,inputTargetTurn:null});
  const emit=(type,detail={})=>{ const event=Object.freeze({type,...detail}); for(const listener of listeners) listener(event); };
  const setStatus=(state,reason=currentStatus.reason,extra={})=>{ currentStatus=Object.freeze({...currentStatus,state,reason,...extra}); emit('status',{status:currentStatus}); };
  const send=payload=>{ if(!socket||socket.readyState!==WebSocket.OPEN) throw new Error('Relay socket is not open.'); socket.send(JSON.stringify(payload)); };
  const identity=type=>({v:1,type,roomId:options.roomId,seat:options.seat,generation});
  const sendAck=()=>{
    if(!pendingAck) return false;
    send({...identity('relay.ack'),turn:pendingAck.turn,tick:pendingAck.tick}); pendingAck=null; return true;
  };

  function handleConnected(message){
    if(generation!==null||!exact(message,['v','type','room','seat','generation','recovery'])||message.v!==1||message.type!=='relay.connected'||message.seat!==options.seat||!integer(message.generation,1)) fail('Invalid relay connected message.');
    validateRoom(message.room,expected); generation=message.generation; turnTicks=message.room.turnTicks;
    setStatus('recovering',null,{generation});
    catchUpRelayRecovery(engine,message.recovery);
    expectedTick=message.recovery.targetTick; expectedTurn=message.recovery.terminalBatchCount; terminalSequence=message.recovery.terminalSequence;
    if(message.recovery.unresolved?.checkpointRequired){
      if(message.recovery.unresolved.tick!==expectedTick) fail('Recovery checkpoint requirement does not match the recovered engine tick.');
      const evidence=createRelayCheckpointEvidence(engine);
      send({...identity('relay.checkpoint-report'),tick:expectedTick,report:evidence.report,checkpointBytes:evidence.checkpointBytes});
    }
    if(message.recovery.unresolved?.completionRequired) send({...identity('relay.completion-report'),evidence:createRelayCompletionEvidence(engine,message.recovery.unresolved.terminalOutcomeDigest)});
    send({...identity('relay.ready'),tick:expectedTick});
    setStatus('ready',null,{tick:expectedTick}); emit('ready',{tick:expectedTick,generation});
  }

  function handleStatus(message){
    if(!exact(message,['v','type','roomId','state','reason','currentTurn','currentTick','inputTargetTurn'])||message.v!==1||message.roomId!==options.roomId||!['waiting','running','stalled','paused','completing','completed','desync','closed'].includes(message.state)||message.reason!==null&&typeof message.reason!=='string'||!integer(message.currentTurn)||!integer(message.currentTick)||!integer(message.inputTargetTurn)) fail('Invalid relay status message.');
    inputTargetTurn=message.inputTargetTurn;
    setStatus(message.state,message.reason,{serverTurn:message.currentTurn,serverTick:message.currentTick,inputTargetTurn});
  }

  function handleBatch(batch){
    if(pendingBatch||pendingAck) fail('Received a second batch before acknowledging the first.');
    terminalSequence=validateBatch(batch,{roomId:options.roomId,turn:expectedTurn,tick:expectedTick,turnTicks,sequence:terminalSequence});
    const result=applyRelayBatch(engine,batch); expectedTurn++; expectedTick=result.tick;
    send({...identity('relay.batch-outcome-report'),turn:batch.turn,advancedTicks:result.advancedTicks,status:result.status,outcomes:result.outcomes,outcomeDigest:result.outcomeDigest});
    pendingBatch={turn:batch.turn,tick:expectedTick,advancedTicks:result.advancedTicks,status:result.status,outcomes:result.outcomes,outcomeDigest:result.outcomeDigest,evidence:expectedTick>0&&expectedTick%100===0?createRelayCheckpointEvidence(engine):null};
    setStatus(currentStatus.state,currentStatus.reason,{tick:expectedTick}); emit('batch',{turn:batch.turn,tick:expectedTick,commands:batch.commands});
  }

  function handleOutcomeAgreement(message){
    if(!exact(message,['v','type','turn','tick','advancedTicks','status','outcomes','outcomeDigest','seats','roomId'])||!pendingBatch||message.roomId!==options.roomId||message.turn!==pendingBatch.turn||message.tick+message.advancedTicks!==pendingBatch.tick||message.advancedTicks!==pendingBatch.advancedTicks||message.status!==pendingBatch.status||message.outcomeDigest!==pendingBatch.outcomeDigest||!digest(message.outcomeDigest)||!Array.isArray(message.seats)||JSON.stringify(message.outcomes)!==JSON.stringify(pendingBatch.outcomes)) fail('Batch outcome agreement does not match locally applied work.');
    if(pendingBatch.evidence) send({...identity('relay.checkpoint-report'),tick:pendingBatch.tick,report:pendingBatch.evidence.report,checkpointBytes:pendingBatch.evidence.checkpointBytes});
    if(pendingBatch.status==='over') send({...identity('relay.completion-report'),evidence:createRelayCompletionEvidence(engine,pendingBatch.outcomeDigest)});
    pendingAck={turn:pendingBatch.turn,tick:pendingBatch.tick}; pendingBatch=null; if(autoAcknowledge) sendAck();
  }

  function handleAckRequired(message){
    if(!exact(message,['v','type','roomId','turn','tick'])||message.roomId!==options.roomId||message.turn!==expectedTurn-1||message.tick!==expectedTick||pendingBatch||pendingAck) fail('Invalid relay recovery ack request.');
    pendingAck={turn:message.turn,tick:message.tick}; if(autoAcknowledge) sendAck();
  }

  function validateNotice(message){
    const common=message.roomId===options.roomId&&message.v===1;
    if(message.type==='relay.command-accepted') return common&&exact(message,['v','type','roomId','seat','generation','id','targetTurn','targetTick'])&&message.seat===options.seat&&message.generation===generation&&typeof message.id==='string'&&integer(message.targetTurn)&&integer(message.targetTick);
    if(message.type==='relay.batch-outcome-report-accepted') return common&&exact(message,['v','type','roomId','turn','seat','status','result'])&&message.seat===options.seat&&integer(message.turn)&&['pending','agreed','desync'].includes(message.status)&&(message.result===null||plain(message.result));
    if(message.type==='relay.checkpoint-report-accepted') return common&&exact(message,['v','type','roomId','tick','seat','status','result'])&&message.seat===options.seat&&integer(message.tick)&&['pending','agreed','desync'].includes(message.status)&&(message.result===null||plain(message.result));
    if(message.type==='relay.checkpoint-agreed') return common&&exact(message,['v','type','tick','baseSequence','baseBatchCount','report','seats','roomId'])&&integer(message.tick)&&integer(message.baseSequence)&&integer(message.baseBatchCount)&&plain(message.report)&&Array.isArray(message.seats);
    if(message.type==='relay.checkpoint-retained') return common&&exact(message,['v','type','roomId','tick','baseSequence','commandCount','checkpointSha256'])&&integer(message.tick)&&integer(message.baseSequence)&&integer(message.commandCount)&&digest(message.checkpointSha256);
    if(message.type==='relay.ack-accepted') return common&&exact(message,['v','type','roomId','seat','generation','turn','tick'])&&message.seat===options.seat&&message.generation===generation&&integer(message.turn)&&integer(message.tick);
    if(message.type==='relay.completion-report-accepted') return common&&exact(message,['v','type','roomId','seat','status','result'])&&message.seat===options.seat&&['pending','agreed','desync'].includes(message.status);
    if(message.type==='relay.lifecycle') return common&&exact(message,['v','type','roomId','state','turn','tick'])&&message.state==='paused';
    return false;
  }

  function handleMessage(event){
    if(typeof event.data!=='string') fail('Relay server message must be JSON text.');
    let message; try{ message=JSON.parse(event.data); }catch{ fail('Relay server sent malformed JSON.'); }
    if(!plain(message)||message.v!==1||typeof message.type!=='string') fail('Invalid relay server envelope.');
    if(message.type==='relay.connected') handleConnected(message);
    else if(message.type==='relay.status') handleStatus(message);
    else if(message.type==='relay.batch') handleBatch(message);
    else if(message.type==='relay.error'){
      if(!exact(message,['v','type','code','message'])||typeof message.code!=='string'||typeof message.message!=='string') fail('Invalid relay error message.');
      emit('error',{code:message.code,message:message.message});
    }else if(message.type==='relay.batch-outcomes-agreed') handleOutcomeAgreement(message);
    else if(message.type==='relay.ack-required') handleAckRequired(message);
    else if(message.type==='relay.desync'){
      if(message.roomId!==options.roomId||!['batch-outcomes','checkpoint','completion'].includes(message.scope)||!Array.isArray(message.reports)) fail('Invalid relay desync evidence.');
      setStatus('desync','consensus-mismatch',{evidence:message});
    }else if(message.type==='relay.match-completed'){
      if(!exact(message,['v','type','roomId','tick','result','replayBytes'])||message.roomId!==options.roomId||!integer(message.tick)||typeof message.replayBytes!=='string') fail('Invalid match completion message.');
      setStatus('completed',null,{tick:message.tick,result:message.result,replayBytes:message.replayBytes}); emit('completed',{replayBytes:message.replayBytes,result:message.result});
    }else if(message.type==='relay.closed'){
      if(!exact(message,['v','type','roomId','reason'])||message.roomId!==options.roomId||typeof message.reason!=='string') fail('Invalid relay close message.');
      setStatus('closed',message.reason);
    }else if(!validateNotice(message)) fail('Unknown or malformed relay server message.');
    else emit('message',{message});
  }

  socket=new WebSocket(options.url);
  socket.addEventListener('open',()=>send({v:1,type:'relay.connect',roomId:options.roomId,settingsFingerprint,seat:options.seat}));
  socket.addEventListener('message',event=>{ try{ handleMessage(event); }catch(error){ setStatus('error','invalid-server-message'); emit('error',{code:'INVALID_SERVER_MESSAGE',message:error.message}); socket.close(3002,'Invalid relay message.'); } });
  socket.addEventListener('close',event=>{ if(currentStatus.state!=='closed'&&currentStatus.state!=='desync') setStatus('disconnected',event.reason||'socket-closed'); emit('close',{code:event.code,reason:event.reason}); });
  socket.addEventListener('error',()=>emit('error',{code:'SOCKET_ERROR',message:'Relay socket failed.'}));

  return Object.freeze({
    subscribe(listener){ if(typeof listener!=='function') fail('Relay listener must be a function.'); listeners.add(listener); listener(Object.freeze({type:'status',status:currentStatus})); return ()=>listeners.delete(listener); },
    status:()=>currentStatus,
    submit(id,command){ if(typeof id!=='string'||!plain(command)||command.p!==options.seat||!integer(inputTargetTurn)) fail('Command must belong to this seat and have an advertised target turn.'); send({...identity('relay.command'),id,targetTurn:inputTargetTurn,command}); },
    setAutoAcknowledge(value){ autoAcknowledge=!!value; if(autoAcknowledge) sendAck(); },
    acknowledge:sendAck,
    snapshot:()=>Object.freeze({tick:engine.presentation().state.clock.tickN,players:engine.presentation().state.actors.players.filter(player=>player.kind!=='neutral').map(player=>({id:player.id,kind:player.kind})),canonical:engine.serializeCanonical(),stateHash:engine.stateHash(),metadata:engine.replayMetadata(),runtimeCommands:engine.runtimeCheckpoint().commands,checkpointBytes:JSON.stringify(engine.checkpoint())}),
    close(){ if(closed) return; closed=true; listeners.clear(); if(socket.readyState===WebSocket.OPEN||socket.readyState===WebSocket.CONNECTING) socket.close(1000,'Client closed.'); }
  });
}
