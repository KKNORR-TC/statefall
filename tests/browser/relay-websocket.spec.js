const {test,expect}=require('@playwright/test');
const WebSocket=require('ws');

const ORIGIN='http://127.0.0.1:4173';
const SETTINGS={seed:'PHASE-D2-BROWSER',map:'land',humanSeats:2,troops:275,gold:725};
const ROOM_CONFIG={protocol:'statefall-relay/v1',W:120,H:72,bots:0,tickMs:100,difficulty:'hard',settings:SETTINGS,seats:[0,1]};
const HARNESS=`<!doctype html><meta charset="utf-8"><title>Relay source proof</title><pre id="status"></pre><script type="module">
const query=new URLSearchParams(location.search),seat=Number(query.get('seat')),output=document.querySelector('#status');
const roomConfig=${JSON.stringify(ROOM_CONFIG)};
let client,holdTick=null,holdCommandId=null,closeOnBatchTick=null;
const respond=(id,ok,value)=>document.dispatchEvent(new CustomEvent('relay-response',{detail:{id,ok,value}}));
document.addEventListener('relay-control',async event=>{const {id,action,data}=event.detail;try{let value;
  if(action==='status')value=client.status();
  else if(action==='snapshot')value=client.snapshot();
  else if(action==='submit')value=client.submit(data.id,{k:'focus',a:[data.value],p:seat});
  else if(action==='surrender')value=client.submit(data.id,{k:'surrender',a:[],p:seat});
  else if(action==='holdAt'){holdTick=data.tick;value=true;}
  else if(action==='holdCommand'){holdCommandId=data.id;value=true;}
  else if(action==='closeOnBatch'){closeOnBatchTick=data.tick;value=true;}
  else if(action==='auto'){client.setAutoAcknowledge(data.value);value=true;}
  else if(action==='ack')value=client.acknowledge();
  else if(action==='close'){client.close();value=true;}
  else if(action==='importReplay'){const {createMultiplayerReplayEngine}=await import('/src/multiplayer/proof-engine.mjs');const replay=JSON.parse(data.bytes),engine=createMultiplayerReplayEngine(replay);engine.start();while(engine.presentation().state.clock.tickN<replay.tick)engine.tick();engine.tick();value={metadata:engine.replayMetadata(),tick:engine.presentation().state.clock.tickN};}
  else throw new Error('Unknown harness action.');
  respond(id,true,value??null);
}catch(error){respond(id,false,error.message);}});
const {createRelayWebSocketClient}=await import('/src/multiplayer/relay-websocket-client.mjs');
client=createRelayWebSocketClient({url:query.get('url'),roomId:query.get('room'),seat,roomConfig,autoAcknowledge:query.get('auto')!=='0'});
client.subscribe(event=>{if(event.type==='batch'&&(event.tick===holdTick||event.commands.some(command=>command.id===holdCommandId)))client.setAutoAcknowledge(false);if(event.type==='batch'&&event.tick===closeOnBatchTick)client.close();output.textContent=JSON.stringify(client.status());});
document.body.dataset.ready='true';
</script>`;

function collectFailures(page){
  const failures=[];
  page.on('pageerror',error=>failures.push(`page error: ${error.stack||error.message}`));
  page.on('console',message=>{ if(message.type()==='error') failures.push(`console error: ${message.text()}`); });
  page.on('requestfailed',request=>failures.push(`request failed: ${request.url()} (${request.failure()?.errorText||'unknown'})`));
  page.on('response',response=>{ if(response.status()>=400) failures.push(`HTTP ${response.status()}: ${response.url()}`); });
  return failures;
}

async function control(page,action,data={}){
  return page.evaluate(({action,data})=>new Promise((resolve,reject)=>{
    const id=crypto.randomUUID();
    const listener=event=>{ if(event.detail.id!==id)return; document.removeEventListener('relay-response',listener); event.detail.ok?resolve(event.detail.value):reject(new Error(event.detail.value)); };
    document.addEventListener('relay-response',listener);
    document.dispatchEvent(new CustomEvent('relay-control',{detail:{id,action,data}}));
  }),{action,data});
}

async function openClient(browser,server,seat,{auto=true,roomConfig=ROOM_CONFIG}={}){
  const context=await browser.newContext({permissions:['local-network-access']});
  await context.route('**/relay-proof.html*',route=>route.fulfill({status:200,contentType:'text/html',body:HARNESS.replace(JSON.stringify(ROOM_CONFIG),JSON.stringify(roomConfig))}));
  const page=await context.newPage(),failures=collectFailures(page);
  const params=new URLSearchParams({url:server.url,room:server.room.metadata().roomId,seat:String(seat),auto:auto?'1':'0'});
  await page.goto(`${ORIGIN}/relay-proof.html?${params}`,{waitUntil:'load'});
  await expect(page.locator('body')).toHaveAttribute('data-ready','true');
  return {context,page,failures};
}

function rawSocket(url,origin=ORIGIN){ return new WebSocket(url,{origin}); }
function waitOpen(socket){ return new Promise((resolve,reject)=>{ socket.once('open',resolve); socket.once('error',reject); }); }
function waitMessage(socket){ return new Promise((resolve,reject)=>{ socket.once('message',data=>resolve(JSON.parse(data.toString()))); socket.once('error',reject); }); }
function waitClose(socket){ return new Promise(resolve=>socket.once('close',(code,reason)=>resolve({code,reason:reason.toString()}))); }

test('real localhost relay coordinates isolated browser engines, recovery, desync, and wire bounds',async({browser},testInfo)=>{
  test.skip(testInfo.project.name!=='chromium-desktop','The bounded relay source proof runs only in chromium-desktop.');
  test.setTimeout(120_000);
  const {createRelayWebSocketServer}=await import('../../tools/relay-websocket-server.mjs');
  const resources=[],servers=[];
  const makeServer=async(roomId,extra={})=>{
    const server=await createRelayWebSocketServer({allowedOrigin:ORIGIN,turnIntervalMs:15,limits:{batchTimeoutMs:500,disconnectGraceMs:2_000,messagesPerSecond:500},room:{roomId,roomConfig:ROOM_CONFIG},...extra});
    servers.push(server); return server;
  };
  try{
    const server=await makeServer('BROWSERPROOF');
    const seat0=await openClient(browser,server,0),seat1=await openClient(browser,server,1,{auto:false}); resources.push(seat0,seat1);
    await expect.poll(async()=>(await control(seat0.page,'snapshot')).tick).toBe(2);
    await expect.poll(()=>server.status().state).toBe('stalled');
    const stalled0=await control(seat0.page,'snapshot'),stalled1=await control(seat1.page,'snapshot');
    await new Promise(resolve=>setTimeout(resolve,150));
    expect((await control(seat0.page,'snapshot')).tick).toBe(stalled0.tick);
    expect((await control(seat1.page,'snapshot')).tick).toBe(stalled1.tick);

    await control(seat1.page,'submit',{id:'seat-1-reverse',value:.8});
    await new Promise(resolve=>setTimeout(resolve,30));
    await control(seat0.page,'submit',{id:'seat-0-reverse',value:.2});
    await control(seat1.page,'holdAt',{tick:100});
    await control(seat1.page,'auto',{value:true});
    await expect.poll(async()=>(await control(seat0.page,'snapshot')).tick,{timeout:30_000}).toBe(100);
    await expect.poll(()=>server.status().state).toBe('stalled');
    const at100=[await control(seat0.page,'snapshot'),await control(seat1.page,'snapshot')],audit100=server.audit();
    expect(at100[0].players).toEqual([{id:0,kind:'human'},{id:1,kind:'human'}]);
    expect(at100[1].players).toEqual(at100[0].players);
    expect(at100[1].canonical).toBe(at100[0].canonical);
    expect(at100[1].stateHash).toBe(at100[0].stateHash);
    expect(at100[1].metadata).toEqual(at100[0].metadata);
    expect(at100[1].runtimeCommands).toEqual(at100[0].runtimeCommands);
    expect(audit100.retained.tick).toBe(100);
    expect(audit100.retained.checkpointBytes).toBe(at100[0].checkpointBytes);
    expect(at100[1].checkpointBytes).toBe(at100[0].checkpointBytes);
    expect(JSON.parse(audit100.retained.checkpointBytes).version).toBe('statefall-engine-checkpoint/v2');
    expect(audit100.orderedLog.map(entry=>[entry.seat,entry.id])).toEqual([[0,'seat-0-reverse'],[1,'seat-1-reverse']]);

    await control(seat1.page,'holdAt',{tick:120});
    await control(seat1.page,'auto',{value:true});
    await expect.poll(async()=>(await control(seat0.page,'snapshot')).tick).toBe(120);
    await expect.poll(()=>server.status().state).toBe('stalled');
    await control(seat1.page,'close');
    await expect.poll(()=>server.status().state).toBe('stalled');
    const replacement=await openClient(browser,server,1); resources.push(replacement);
    await control(replacement.page,'holdAt',{tick:140});
    await expect.poll(async()=>(await control(seat0.page,'snapshot')).tick,{timeout:30_000}).toBe(140);
    await expect.poll(()=>server.status().state).toBe('stalled');
    const recovered=[await control(seat0.page,'snapshot'),await control(replacement.page,'snapshot')];
    expect(recovered[1].canonical).toBe(recovered[0].canonical);
    expect(recovered[1].stateHash).toBe(recovered[0].stateHash);
    expect(recovered[1].metadata).toEqual(recovered[0].metadata);
    expect(recovered[1].runtimeCommands).toEqual(recovered[0].runtimeCommands);
    expect((await control(replacement.page,'status')).generation).toBeGreaterThan((await control(seat1.page,'status')).generation);

    const unresolved=await makeServer('UNRESOLVED-CHECKPOINT');
    const unresolved0=await openClient(browser,unresolved,0),unresolved1=await openClient(browser,unresolved,1); resources.push(unresolved0,unresolved1);
    await control(unresolved1.page,'closeOnBatch',{tick:100});
    await expect.poll(async()=>(await control(unresolved0.page,'snapshot')).tick,{timeout:30_000}).toBe(100);
    await expect.poll(()=>unresolved.status().state).toBe('stalled');
    expect(unresolved.audit().retained).toBe(null);
    const unresolvedReplacement=await openClient(browser,unresolved,1); resources.push(unresolvedReplacement);
    await expect.poll(()=>unresolved.audit().retained?.tick,{timeout:30_000}).toBe(100);
    await expect.poll(async()=>(await control(unresolvedReplacement.page,'snapshot')).tick,{timeout:30_000}).toBeGreaterThan(100);

    const completed=await makeServer('COMPLETED-DUEL');
    const winner=await openClient(browser,completed,1),loser=await openClient(browser,completed,0); resources.push(winner,loser);
    await expect.poll(async()=>Number.isInteger((await control(loser.page,'status')).inputTargetTurn)).toBe(true);
    await control(loser.page,'surrender',{id:'browser-surrender'});
    await expect.poll(()=>completed.status().state,{timeout:30_000}).toBe('completed');
    expect(completed.status().pendingAcks).toBe(0);
    const completed0=await control(loser.page,'status'),completed1=await control(winner.page,'status');
    expect(completed0.replayBytes).toBe(completed1.replayBytes);
    expect(completed0.result.winnerSeatIds).toEqual([1]);
    const imported0=await control(loser.page,'importReplay',{bytes:completed0.replayBytes}),imported1=await control(winner.page,'importReplay',{bytes:completed1.replayBytes});
    expect(imported0).toEqual(imported1);
    expect(imported0.metadata.canonical.sha256).toBe(JSON.parse(completed0.replayBytes).final.canonical.sha256);

    const ackGate=await makeServer('TERMINAL-ACK-GATE');
    const gateWinner=await openClient(browser,ackGate,1),gateLoser=await openClient(browser,ackGate,0); resources.push(gateWinner,gateLoser);
    await expect.poll(async()=>Number.isInteger((await control(gateLoser.page,'status')).inputTargetTurn)).toBe(true);
    await control(gateLoser.page,'holdCommand',{id:'held-terminal-ack'});
    await control(gateLoser.page,'surrender',{id:'held-terminal-ack'});
    await expect.poll(()=>ackGate.status().pendingAcks,{timeout:30_000}).toBe(1);
    await expect.poll(()=>ackGate.room.metadata().state).toBe('completing');
    expect(ackGate.status().state).not.toBe('completed'); expect(ackGate.room.completedReplay()).toBe(null);
    await control(gateLoser.page,'close');
    const gateReplacement=await openClient(browser,ackGate,0,{auto:false}); resources.push(gateReplacement);
    await expect.poll(()=>ackGate.status().pendingAcks).toBe(1);
    expect(ackGate.status().state).not.toBe('completed');
    await expect.poll(()=>control(gateReplacement.page,'ack')).toBe(true);
    await expect.poll(()=>ackGate.status().state).toBe('completed');
    expect(ackGate.status().pendingAcks).toBe(0); expect(ackGate.status().currentBatch).toBe(null);
    await expect.poll(async()=>(await control(gateReplacement.page,'status')).state).toBe('completed');

    const divergent=await makeServer('DIVERGENCE');
    const honest=await openClient(browser,divergent,0),dishonest=await openClient(browser,divergent,1,{roomConfig:{...ROOM_CONFIG,settings:{...SETTINGS,seed:'LOCAL-DIVERGENCE'}}}); resources.push(honest,dishonest);
    await expect.poll(()=>divergent.status().connections).toBe(2);
    await expect.poll(() => divergent.room.metadata().seats.filter(seat=>seat.connected).length).toBe(1);

    const security=await makeServer('WIREBOUNDS',{turnIntervalMs:1_000,limits:{maxPayload:2_048,maxMessageBytes:512,maxCheckpointMessageBytes:2_048,messagesPerSecond:3,batchTimeoutMs:500,disconnectGraceMs:500}});
    const badOrigin=rawSocket(security.url,'http://not-allowed.invalid');
    const rejected=new Promise(resolve=>badOrigin.once('unexpected-response',(_request,response)=>resolve(response.statusCode)));
    expect(await rejected).toBe(403);

    const unauthorized=rawSocket(security.url); await waitOpen(unauthorized); const unauthorizedMessage=waitMessage(unauthorized);
    unauthorized.send(JSON.stringify({v:1,type:'relay.connect',roomId:'WIREBOUNDS',settingsFingerprint:security.room.metadata().settingsFingerprint,seat:9}));
    expect((await unauthorizedMessage).code).toBe('UNKNOWN_SEAT'); unauthorized.close();

    const binary=rawSocket(security.url); await waitOpen(binary); const binaryClose=waitClose(binary); binary.send(Buffer.from([1,2,3])); expect((await binaryClose).code).toBe(1003);
    const malformed=rawSocket(security.url); await waitOpen(malformed); const malformedClose=waitClose(malformed); malformed.send('{'); expect((await malformedClose).code).toBe(1007);
    const oversized=rawSocket(security.url); await waitOpen(oversized); const oversizedClose=waitClose(oversized); oversized.send('x'.repeat(4_096)); expect((await oversizedClose).code).toBe(1009);

    const limited=rawSocket(security.url); await waitOpen(limited);
    const connected=waitMessage(limited); limited.send(JSON.stringify({v:1,type:'relay.connect',roomId:'WIREBOUNDS',settingsFingerprint:security.room.metadata().settingsFingerprint,seat:0}));
    const connection=await connected; expect(connection.type).toBe('relay.connected');
    const limitedClose=waitClose(limited);
    for(let index=0;index<5;index++) limited.send(JSON.stringify({v:1,type:'unknown',index}));
    expect((await limitedClose).code).toBe(1008);
    await expect.poll(()=>security.status().roomClosed).toBe(true);
  }finally{
    for(const resource of resources.reverse()) await resource.context.close().catch(()=>{});
    for(const server of servers.reverse()){ await server.close().catch(()=>{}); expect(server.status().timers).toBe(0); expect(server.status().connections).toBe(0); }
    for(const resource of resources) expect(resource.failures,resource.failures.join('\n')).toEqual([]);
  }
});
