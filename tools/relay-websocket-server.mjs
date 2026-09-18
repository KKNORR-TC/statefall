import http from 'node:http';
import {WebSocketServer} from 'ws';
import {createRelayRoom,RelayProtocolError,RELAY_LIMITS,RELAY_PROTOCOL_VERSION} from '../game/src/multiplayer/relay/room.mjs';

export const RELAY_TRANSPORT_LIMITS=Object.freeze({
  maxPayload:RELAY_LIMITS.maxRetainedCheckpointBytes+RELAY_LIMITS.maxEnvelopeBytes,
  maxMessageBytes:RELAY_LIMITS.maxEnvelopeBytes,
  maxCheckpointMessageBytes:RELAY_LIMITS.maxRetainedCheckpointBytes+RELAY_LIMITS.maxEnvelopeBytes,
  messagesPerSecond:120,
  batchTimeoutMs:2_000,
  disconnectGraceMs:5_000
});

const plain=value=>value!==null&&typeof value==='object'&&!Array.isArray(value)&&(Object.getPrototypeOf(value)===Object.prototype||Object.getPrototypeOf(value)===null);
const exact=(value,keys)=>plain(value)&&Object.keys(value).length===keys.length&&keys.every(key=>Object.hasOwn(value,key));
const integer=(value,min=0)=>Number.isSafeInteger(value)&&value>=min;
const digest=value=>typeof value==='string'&&/^[0-9a-f]{64}$/.test(value);
const byteLength=value=>Buffer.byteLength(value,'utf8');

function boundedError(error){
  if(error instanceof RelayProtocolError) return {code:error.code,message:error.message.slice(0,240)};
  return {code:'INTERNAL',message:'Relay operation failed.'};
}

function rejectUpgrade(socket,status,message){
  const body=message.slice(0,120);
  socket.end(`HTTP/1.1 ${status}\r\nConnection: close\r\nContent-Type: text/plain\r\nContent-Length: ${Buffer.byteLength(body)}\r\n\r\n${body}`);
}

export async function createRelayWebSocketServer(options={}){
  if(!plain(options)||typeof options.allowedOrigin!=='string'||new URL(options.allowedOrigin).origin!==options.allowedOrigin) throw new TypeError('allowedOrigin must be one exact URL origin.');
  const limits=Object.freeze({...RELAY_TRANSPORT_LIMITS,...options.limits});
  for(const name of ['maxPayload','maxMessageBytes','maxCheckpointMessageBytes','messagesPerSecond','batchTimeoutMs','disconnectGraceMs']) if(!integer(limits[name],1)) throw new TypeError(`limits.${name} must be a positive integer.`);
  if(limits.maxMessageBytes>limits.maxPayload||limits.maxCheckpointMessageBytes>limits.maxPayload) throw new TypeError('Wire message limits must not exceed maxPayload.');
  const room=createRelayRoom(options.room);
  const roomId=room.metadata().roomId;
  const socketsBySeat=new Map(),connections=new Set(),timers=new Set(),graceTimers=new Map();
  let currentBatch=null,lastRetained=null,roomClosed=false,closing=false,state='waiting';

  const server=http.createServer((_request,response)=>{ response.writeHead(426,{'content-type':'text/plain','connection':'close'}); response.end('WebSocket upgrade required.'); });
  const wss=new WebSocketServer({noServer:true,maxPayload:limits.maxPayload,perMessageDeflate:false});
  const schedule=(callback,delay)=>{ const timer=setTimeout(()=>{ timers.delete(timer); callback(); },delay); timers.add(timer); return timer; };
  const clearTimer=timer=>{ if(timer){ clearTimeout(timer); timers.delete(timer); } };
  const send=(connection,payload)=>{ if(connection.ws.readyState===connection.ws.OPEN) connection.ws.send(JSON.stringify(payload)); };
  const broadcast=payload=>{ for(const connection of connections) if(connection.bound) send(connection,payload); };
  const metadata=()=>room.metadata();
  const allReady=()=>metadata().seats.every(seat=>seat.connected&&socketsBySeat.get(seat.id)?.ready);
  const status=(nextState=state,reason=null)=>{
    state=nextState;
    const roomMeta=metadata();
    const payload={v:1,type:'relay.status',roomId,state,reason,currentTurn:roomMeta.currentTurn,currentTick:roomMeta.currentTick,inputTargetTurn:roomMeta.currentTurn+roomMeta.inputDelayTurns};
    broadcast(payload); return payload;
  };
  const stopBatchTimer=()=>{ if(currentBatch){ clearTimer(currentBatch.timeout); currentBatch.timeout=null; } };
  const terminalDesync=evidence=>{ stopBatchTimer(); state='desync'; broadcast({...evidence,roomId}); status('desync','consensus-mismatch'); };

  function maybeAdvance(){
    if(roomClosed||closing||['desync','paused','completing','completed'].includes(state)||currentBatch||!allReady()) return;
    state='running';
    let batch;
    try{ batch=room.advance(); }
    catch(error){
      if(error instanceof RelayProtocolError&&['OUTCOME_PENDING','CHECKPOINT_PENDING','ROOM_STALLED'].includes(error.code)){ status('stalled',error.code.toLowerCase().replaceAll('_','-')); return; }
      throw error;
    }
    currentBatch={batch,outcomes:new Set(),checkpoints:new Set(),checkpointBytes:new Map(),acks:new Set(),outcomesAgreed:false,checkpointAgreed:false,timeout:null};
    status('running',null);
    broadcast(batch);
    currentBatch.timeout=schedule(()=>{ if(currentBatch){ currentBatch.timeout=null; status('stalled','batch-timeout'); } },limits.batchTimeoutMs);
  }

  function completeBatchIfReady(){
    if(state==='completed'||state==='desync') return;
    if(!currentBatch||!currentBatch.outcomesAgreed||!currentBatch.checkpointAgreed||currentBatch.acks.size!==metadata().seats.length||!allReady()) return;
    if(currentBatch.status==='over'){
      stopBatchTimer(); state='completing'; status('completing',currentBatch.completionAgreed?'terminal-acks-complete':'completion-consensus');
      if(currentBatch.completionAgreed){ const completed=room.completeMatch(); currentBatch=null; state='completed'; broadcast(completed); status('completed',null); }
      return;
    }
    if(currentBatch.status==='paused'){ stopBatchTimer(); state='paused'; status('paused','deterministic-pause'); return; }
    stopBatchTimer(); currentBatch=null; status('running',null); schedule(maybeAdvance,options.turnIntervalMs??0);
  }

  function closeProofRoom(reason){
    if(roomClosed) return;
    roomClosed=true; stopBatchTimer();
    for(const timer of graceTimers.values()) clearTimer(timer);
    graceTimers.clear();
    try{ room.close(); }catch{}
    broadcast({v:1,type:'relay.closed',roomId,reason});
    socketsBySeat.clear();
    for(const connection of connections) connection.ws.close(1000,'Relay room closed.');
    state='closed';
  }

  function requireBound(connection,envelope,type,keys){
    if(!connection.bound) throw new RelayProtocolError('NOT_CONNECTED','Connect before sending relay messages.');
    if(!exact(envelope,keys)||envelope.v!==1||envelope.type!==type||envelope.roomId!==roomId||envelope.seat!==connection.seat||envelope.generation!==connection.generation) throw new RelayProtocolError('MALFORMED',`Invalid ${type} envelope.`);
  }

  function handleConnect(connection,envelope){
    if(connection.bound||!exact(envelope,['v','type','roomId','settingsFingerprint','seat'])||envelope.v!==1||envelope.type!=='relay.connect'||envelope.roomId!==roomId||envelope.settingsFingerprint!==metadata().settingsFingerprint||!integer(envelope.seat)) throw new RelayProtocolError('UNAUTHORIZED','Relay connection metadata is not authorized.');
    if(socketsBySeat.has(envelope.seat)) throw new RelayProtocolError('SEAT_OCCUPIED','Relay seat already has a live socket.');
    const connected=room.connect(envelope.seat);
    connection.bound=true; connection.seat=connected.seat; connection.generation=connected.generation; connection.recoveryTick=connected.recovery.targetTick; connection.recoveryBatchCount=connected.recovery.terminalBatchCount;
    const outgoing=currentBatch?{...connected,recovery:{...connected.recovery,unresolved:{...(connected.recovery.unresolved||{turn:currentBatch.batch.turn,tick:connection.recoveryTick,outcomeRequired:false,checkpointRequired:false,completionRequired:false,status:null}),ackRequired:!currentBatch.acks.has(connection.seat)}}}:connected;
    socketsBySeat.set(connection.seat,connection);
    const grace=graceTimers.get(connection.seat); clearTimer(grace); graceTimers.delete(connection.seat);
    const readyState=allReady()?(currentBatch?.status==='over'?'completing':'running'):'waiting';
    send(connection,outgoing); status(readyState,allReady()?null:'seats-not-ready');
  }

  function handleReady(connection,envelope){
    requireBound(connection,envelope,'relay.ready',['v','type','roomId','seat','generation','tick']);
    if(!integer(envelope.tick)||envelope.tick!==connection.recoveryTick) throw new RelayProtocolError('RECOVERY_MISMATCH','Ready tick does not match assigned recovery.');
    connection.ready=true;
    const readyState=allReady()?(currentBatch?.status==='over'?'completing':'running'):'waiting';
    status(readyState,allReady()?null:'seats-not-ready');
    if(currentBatch){
      const endTick=currentBatch.batch.tick+(currentBatch.advancedTicks??currentBatch.batch.turnTicks);
      if(connection.recoveryBatchCount>currentBatch.batch.turn) send(connection,{v:1,type:'relay.ack-required',roomId,turn:currentBatch.batch.turn,tick:endTick});
      else if(connection.recoveryTick===currentBatch.batch.tick) send(connection,currentBatch.batch);
      else if(connection.recoveryTick===endTick) send(connection,{v:1,type:'relay.ack-required',roomId,turn:currentBatch.batch.turn,tick:endTick});
      else throw new RelayProtocolError('RECOVERY_MISMATCH','Recovery does not align to the in-flight batch.');
    }else maybeAdvance();
  }

  function handleOutcome(connection,envelope){
    requireBound(connection,envelope,'relay.batch-outcome-report',['v','type','roomId','seat','generation','turn','advancedTicks','status','outcomes','outcomeDigest']);
    if(!currentBatch||envelope.turn!==currentBatch.batch.turn) throw new RelayProtocolError('UNEXPECTED_REPORT','No matching batch is in flight.');
    const accepted=room.reportBatchOutcomes(envelope); currentBatch.outcomes.add(connection.seat);
    send(connection,accepted);
    if(accepted.result?.type==='relay.desync'){ terminalDesync(accepted.result); return; }
    if(accepted.result){ currentBatch.outcomesAgreed=true; currentBatch.advancedTicks=accepted.result.advancedTicks; currentBatch.status=accepted.result.status; currentBatch.checkpointAgreed=accepted.result.tick+accepted.result.advancedTicks===0||(accepted.result.tick+accepted.result.advancedTicks)%100!==0; broadcast({...accepted.result,roomId}); }
    completeBatchIfReady();
  }

  function handleCheckpoint(connection,envelope){
    requireBound(connection,envelope,'relay.checkpoint-report',['v','type','roomId','seat','generation','tick','report','checkpointBytes']);
    if(!currentBatch||envelope.tick!==currentBatch.batch.tick+(currentBatch.advancedTicks??currentBatch.batch.turnTicks)||typeof envelope.checkpointBytes!=='string') throw new RelayProtocolError('UNEXPECTED_REPORT','No matching checkpoint is required.');
    const coreEnvelope={v:1,type:'relay.checkpoint-report',roomId,seat:connection.seat,generation:connection.generation,tick:envelope.tick,report:envelope.report};
    const accepted=room.reportCheckpoint(coreEnvelope); currentBatch.checkpoints.add(connection.seat); currentBatch.checkpointBytes.set(connection.seat,envelope.checkpointBytes);
    send(connection,accepted);
    if(accepted.result?.type==='relay.desync'){ terminalDesync(accepted.result); return; }
    if(accepted.result){
      const retaining=metadata().seats.map(seat=>socketsBySeat.get(seat.id)).find(candidate=>candidate&&currentBatch.checkpointBytes.has(candidate.seat));
      const checkpointBytes=currentBatch.checkpointBytes.get(retaining.seat);
      const retained=room.retainRecoveryCheckpoint({v:1,type:'relay.retain-checkpoint',roomId,seat:retaining.seat,generation:retaining.generation,tick:envelope.tick,checkpointBytes});
      lastRetained=Object.freeze({...retained,checkpointBytes});
      currentBatch.checkpointAgreed=true; broadcast({...accepted.result,roomId}); broadcast(retained);
    }
    completeBatchIfReady();
  }

  function handleAck(connection,envelope){
    requireBound(connection,envelope,'relay.ack',['v','type','roomId','seat','generation','turn','tick']);
    if(!currentBatch||envelope.turn!==currentBatch.batch.turn||envelope.tick!==currentBatch.batch.tick+(currentBatch.advancedTicks??currentBatch.batch.turnTicks)||!currentBatch.outcomes.has(connection.seat)||!currentBatch.checkpointAgreed&& !currentBatch.checkpoints.has(connection.seat)) throw new RelayProtocolError('UNEXPECTED_ACK','Ack does not match completed seat work for the in-flight batch.');
    if(currentBatch.acks.has(connection.seat)) throw new RelayProtocolError('DUPLICATE_ACK','Seat already acknowledged this batch.');
    currentBatch.acks.add(connection.seat);
    send(connection,{v:1,type:'relay.ack-accepted',roomId,seat:connection.seat,generation:connection.generation,turn:envelope.turn,tick:envelope.tick});
    completeBatchIfReady();
  }

  function handleCompletion(connection,envelope){
    requireBound(connection,envelope,'relay.completion-report',['v','type','roomId','seat','generation','evidence']);
    if(!currentBatch||currentBatch.status!=='over') throw new RelayProtocolError('UNEXPECTED_REPORT','No terminal batch awaits completion evidence.');
    const accepted=room.reportCompletion(envelope); send(connection,accepted);
    if(accepted.result?.type==='relay.desync'){ terminalDesync(accepted.result); return; }
    if(accepted.result?.type==='relay.completion-agreed'){ currentBatch.completionAgreed=true; completeBatchIfReady(); }
  }

  function handleMessage(connection,data,isBinary){
    if(isBinary){ send(connection,{v:1,type:'relay.error',code:'BINARY_UNSUPPORTED',message:'Relay accepts JSON text messages only.'}); connection.ws.close(1003,'Text messages required.'); return; }
    const text=data.toString(),bytes=byteLength(text);
    const now=Date.now();
    if(now-connection.rateStart>=1_000){ connection.rateStart=now; connection.rateCount=0; }
    if(++connection.rateCount>limits.messagesPerSecond){ send(connection,{v:1,type:'relay.error',code:'RATE_LIMIT',message:'Relay message rate exceeded.'}); connection.ws.close(1008,'Rate limit exceeded.'); return; }
    const checkpointCandidate=text.slice(0,512).includes('"type":"relay.checkpoint-report"');
    const allowedBytes=checkpointCandidate?limits.maxCheckpointMessageBytes:limits.maxMessageBytes;
    if(bytes>allowedBytes){ send(connection,{v:1,type:'relay.error',code:'MESSAGE_TOO_LARGE',message:'Relay message exceeds its byte limit.'}); connection.ws.close(1009,'Message too large.'); return; }
    let envelope;
    try{ envelope=JSON.parse(text); }catch{ send(connection,{v:1,type:'relay.error',code:'MALFORMED',message:'Relay message must be valid JSON.'}); connection.ws.close(1007,'Malformed JSON.'); return; }
    if(checkpointCandidate&&envelope?.type!=='relay.checkpoint-report'){ send(connection,{v:1,type:'relay.error',code:'MALFORMED',message:'Invalid checkpoint message envelope.'}); connection.ws.close(1007,'Malformed message.'); return; }
    try{
      if(roomClosed) throw new RelayProtocolError('CLOSED','Relay room is closed.');
      if(!connection.bound) handleConnect(connection,envelope);
      else if(envelope?.type==='relay.ready') handleReady(connection,envelope);
      else if(envelope?.type==='relay.command') send(connection,room.submit(envelope));
      else if(envelope?.type==='relay.batch-outcome-report') handleOutcome(connection,envelope);
      else if(envelope?.type==='relay.checkpoint-report') handleCheckpoint(connection,envelope);
      else if(envelope?.type==='relay.completion-report') handleCompletion(connection,envelope);
      else if(envelope?.type==='relay.ack') handleAck(connection,envelope);
      else throw new RelayProtocolError('MALFORMED','Unknown relay message type.');
    }catch(error){
      const safe=boundedError(error); send(connection,{v:1,type:'relay.error',...safe});
      if(safe.code==='INTERNAL') connection.ws.close(1011,'Relay operation failed.');
    }
  }

  function handleClose(connection){
    connections.delete(connection);
    if(roomClosed||closing||state==='completed'||state==='desync'){ if(socketsBySeat.get(connection.seat)===connection) socketsBySeat.delete(connection.seat); return; }
    if(!connection.bound||socketsBySeat.get(connection.seat)!==connection) return;
    socketsBySeat.delete(connection.seat);
    try{ room.disconnect({v:1,type:'relay.disconnect',roomId,seat:connection.seat,generation:connection.generation}); }catch{}
    status('stalled','seat-disconnected');
    const prior=graceTimers.get(connection.seat); clearTimer(prior);
    graceTimers.set(connection.seat,schedule(()=>{ graceTimers.delete(connection.seat); if(!socketsBySeat.has(connection.seat)) closeProofRoom('disconnect-grace-expired'); },limits.disconnectGraceMs));
  }

  server.on('upgrade',(request,socket,head)=>{
    let path;
    try{ path=new URL(request.url,'http://localhost').pathname; }catch{ rejectUpgrade(socket,'400 Bad Request','Invalid request.'); return; }
    if(path!=='/relay'){ rejectUpgrade(socket,'404 Not Found','Not found.'); return; }
    if(request.headers.origin!==options.allowedOrigin){ rejectUpgrade(socket,'403 Forbidden','Origin not allowed.'); return; }
    wss.handleUpgrade(request,socket,head,ws=>wss.emit('connection',ws,request));
  });
  wss.on('connection',ws=>{
    const connection={ws,bound:false,seat:null,generation:null,recoveryTick:null,recoveryBatchCount:null,ready:false,rateStart:Date.now(),rateCount:0};
    connections.add(connection);
    ws.on('message',(data,isBinary)=>handleMessage(connection,data,isBinary));
    ws.on('close',()=>handleClose(connection));
    ws.on('error',()=>{});
  });

  await new Promise((resolve,reject)=>{ server.once('error',reject); server.listen(options.port??0,'127.0.0.1',()=>{ server.off('error',reject); resolve(); }); });
  const address=server.address();
  return Object.freeze({
    url:`ws://127.0.0.1:${address.port}/relay`,
    origin:options.allowedOrigin,
    room,
    status:()=>Object.freeze({state,roomClosed,currentBatch:currentBatch?{turn:currentBatch.batch.turn,tick:currentBatch.batch.tick,acks:[...currentBatch.acks],pendingAcks:metadata().seats.length-currentBatch.acks.size}:null,pendingAcks:currentBatch?metadata().seats.length-currentBatch.acks.size:0,connections:connections.size,timers:timers.size}),
    audit:()=>Object.freeze({orderedLog:room.orderedLog(),retained:lastRetained}),
    close:async()=>{
      if(closing) return; closing=true; roomClosed=true;
      for(const timer of timers) clearTimeout(timer); timers.clear(); graceTimers.clear();
      try{ room.close(); }catch{}
      for(const connection of connections) connection.ws.terminate();
      connections.clear(); socketsBySeat.clear();
      await new Promise(resolve=>wss.close(()=>resolve()));
      await new Promise(resolve=>server.close(()=>resolve()));
      state='closed';
    }
  });
}

export {RELAY_PROTOCOL_VERSION};
