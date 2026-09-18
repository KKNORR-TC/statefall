'use strict';

const assert=require('node:assert/strict');
const path=require('node:path');
const {pathToFileURL}=require('node:url');

(async()=>{
  const {createEngine,ENGINE_TEST_DIAGNOSTICS}=await import(pathToFileURL(path.resolve(__dirname,'..','game','src','sim','engine.mjs')).href);
  const {SIMPLE_COMMAND_KINDS,MENU_ACTIONS}=await import(pathToFileURL(path.resolve(__dirname,'..','game','src','sim','command-schema.mjs')).href);
  const options={W:120,H:70,bots:2,difficulty:'normal',settings:{seed:'BOUNDARY',map:'land'}};
  const make=()=>createEngine({...options,[ENGINE_TEST_DIAGNOSTICS]:true});
  const engine=make(); engine.start(); engine.drainEvents();
  const state=engine.compatibility.state,player=engine.compatibility.getMe(),tileCount=options.W*options.H;
  const foreignTile=state.map.owner.findIndex(owner=>owner>=0&&owner!==player.id);
  assert.ok(foreignTile>=0);

  function evidence(value=engine){
    const render=value.renderBuffers();
    return {
      checkpoint:JSON.stringify(value.checkpoint()),canonical:value.serializeCanonical(),hash:value.stateHash(),runtime:JSON.stringify(value.runtimeCheckpoint()),rng:value.presentation().runtime.rngDraws,
      interpolation:value.interpolationFrame(),interpolationBytes:JSON.stringify(value.interpolationFrame()),renderOwner:Array.from(render.map.owner),renderLand:Array.from(render.map.land)
    };
  }
  function atomicReject(label,operation,value=engine){
    value.drainEvents(); const before=evidence(value);
    assert.throws(operation,undefined,label);
    const after=evidence(value);
    assert.equal(after.checkpoint,before.checkpoint,`${label}: checkpoint changed`);
    assert.equal(after.canonical,before.canonical,`${label}: canonical state changed`);
    assert.equal(after.hash,before.hash,`${label}: hash changed`);
    assert.equal(after.runtime,before.runtime,`${label}: runtime changed`);
    assert.equal(after.rng,before.rng,`${label}: RNG changed`);
    assert.equal(after.interpolation,before.interpolation,`${label}: interpolation identity changed`);
    assert.equal(after.interpolationBytes,before.interpolationBytes,`${label}: interpolation changed`);
    assert.deepEqual(after.renderOwner,before.renderOwner,`${label}: render owner buffer changed`);
    assert.deepEqual(after.renderLand,before.renderLand,`${label}: render land buffer changed`);
    assert.deepEqual(value.drainEvents(),[],`${label}: emitted presentation events`);
  }

  const malformedDirect={focus:[NaN],airAuto:[1],logAuto:[null],autoFire:['true'],recall:[-1],recallAll:['near'],sat:[0],accept:[0,'bad',0],decline:[-1],decShare:[null],decWar:[null]};
  for(const kind of SIMPLE_COMMAND_KINDS) atomicReject(`direct ${kind}`,()=>engine.issue(kind,...malformedDirect[kind]));
  for(const act of MENU_ACTIONS) atomicReject(`menu ${act}`,()=>engine.issue({kind:'menu',args:[{act,unexpected:true},foreignTile,[],-1,50,0,0]}));
  // Proxy reflection may invoke traps; the contract is that traps cannot re-enter authority.
  for(const [label,operation] of [
    ['focus tile OOB',()=>engine.issue({kind:'menu',args:[{act:'focus'},tileCount,[],-1,50,0,0]})],
    ['click tile OOB',()=>engine.issue({kind:'click',args:[tileCount,{ratio:50,pick:null,build:null}]})],
    ['click pick OOB',()=>engine.issue({kind:'click',args:[0,{ratio:50,pick:{kind:'attack',t:tileCount},build:null}]})],
    ['unknown actor',()=>engine.issue({kind:'focus',args:[.5],actor:999999})],
    ['unknown aircraft',()=>engine.issue('recall',999999)],
    ['foreign diplomacy target',()=>engine.issue('accept',999999,'ally',0)],
    ['duplicate ship IDs',()=>engine.issue({kind:'menu',args:[{act:'move'},0,[1,1],-1,50,0,0]})],
    ['invalid build enum',()=>engine.issue({kind:'click',args:[0,{ratio:50,pick:null,build:'prototype'}]})],
    ['non-finite ratio',()=>engine.issue({kind:'click',args:[0,{ratio:Infinity,pick:null,build:null}]})]
  ]) atomicReject(label,operation);

  atomicReject('query callback',()=>engine.queries.cruiseTargets([],()=>.5));
  for(const [label,operation] of [
    ['query object player',()=>engine.queries.centroid(player)],
    ['query coercing player',()=>engine.queries.centroid({valueOf(){ engine.tick(); return player.id; }})],
    ['query coercing tile',()=>engine.queries.isCoast({toString(){ engine.tick(); return '0'; }})],
    ['query accessor',()=>engine.queries.cruiseTargets([{type:'shield',owner:0,get t(){ engine.tick(); return 0; }}])],
    ['query custom prototype',()=>engine.queries.cruiseTargets([Object.assign(Object.create({}),{type:'shield',owner:0,t:0})])],
    ['query function property',()=>engine.queries.cruiseTargets([{type:'shield',owner:0,t:0,callback(){}}])],
    ['query cyclic data',()=>{ const value={type:'shield',owner:0,t:0}; value.self=value; engine.queries.cruiseTargets([value]); }],
    ['query proxy reentry',()=>engine.queries.cruiseTargets([new Proxy({type:'shield',owner:0,t:0},{getPrototypeOf(target){ assert.throws(()=>engine.tick(),/re-entered/); return Object.getPrototypeOf(target); }})])]
  ]) atomicReject(label,operation);
  player.presentationProbe={map:new Map([['safe',{value:1}]]),set:new Set([1,2]),typed:new Uint8Array([3,4])};
  const probe=engine.presentation().state.actors.players[player.id].presentationProbe;
  assert.equal(probe.map.get('safe').value,1);
  assert.throws(()=>probe.map.set('escape',1),/read-only/);
  assert.throws(()=>probe.set.add(3),/read-only/);
  assert.throws(()=>probe.typed.fill(0),/read-only/);
  assert.deepEqual(Array.from(probe.typed),[3,4]);

  const configEngine=make(),configBefore=evidence(configEngine);
  const badConfigurations=[
    {settings:{map:'unknown'}},{difficulty:'nightmare'},{allowed:['city','unknown']},{settings:{teams:5}},{settings:{gold:Infinity}},{settings:{fog:1}},
    {settings:{customBots:new Map()}},{settings:{customBots:[{slot:0,name:'Bot',layers:new Set()}]}},{chosenFlag:{name:'Flag',layers:new Uint8Array([1])}},{unknown:true}
  ];
  for(const [index,value] of badConfigurations.entries()) atomicReject(`configuration poison ${index}`,()=>configEngine.configure(value),configEngine);
  assert.equal(evidence(configEngine).checkpoint,configBefore.checkpoint);
  configEngine.configure({settings:{map:'continents',teams:4,gold:0,troops:1},difficulty:'hard',allowed:['city','port']});
  assert.equal(configEngine.presentation().state.rules.settings.map,'random');
  const roundTrip=JSON.parse(JSON.stringify(configEngine.checkpoint())),roundTripBytes=JSON.stringify(roundTrip);
  configEngine.restoreCheckpoint(roundTrip);
  assert.equal(JSON.stringify(configEngine.checkpoint()),roundTripBytes,'accepted configuration did not checkpoint JSON-roundtrip');
  const acceptedConfigurations=[
    {settings:{troops:1}},{settings:{gold:0}},{settings:{bots:true}},{settings:{teams:4}},{settings:{noCap:true}},{settings:{map:'land'}},{settings:{quick:true}},{settings:{fog:true}},{settings:{instant:true}},{settings:{risky:true}},{settings:{endgame:true}},{settings:{billionaire:true}},{settings:{garrison:true}},{settings:{pauseBuild:true}},{settings:{seed:'ROUNDTRIP'}},{settings:{customBots:[]}},{difficulty:'easy'},{allowed:['city']},{chosenFlag:{name:'Test',layers:[['h','#fff','#000']]}},{seed:'TOPLEVEL'}
  ];
  for(const configuration of acceptedConfigurations){ const accepted=make(); accepted.configure(configuration); const saved=JSON.parse(JSON.stringify(accepted.checkpoint())); accepted.restoreCheckpoint(saved); assert.equal(JSON.stringify(accepted.checkpoint()),JSON.stringify(saved),'accepted configuration failed JSON checkpoint roundtrip'); }
  const mapBase={w:120,h:70,names:['Testland'],cont:['Test'],rle:[1,8400]};
  for(const [label,badMap] of [
    ['short RLE',{...mapBase,rle:[1,8399]}],['country range',{...mapBase,rle:[2,8400]}],['missing continent',{...mapBase,cont:[]}],['zero run',{...mapBase,rle:[1,0]}],['extra shape',{...mapBase,extra:true}],['all water',{...mapBase,rle:[0,8400]}]
  ]) assert.throws(()=>createEngine({...options,maps:{world:badMap}}),undefined,`malformed custom map ${label}`);
  assert.throws(()=>createEngine({...options,countries:[['Duplicate',['rect','#000',0,0,1,1]],['Duplicate',['rect','#fff',0,0,1,1]]]}),/invalid country/);
  const lateFaultMap={w:720,h:414,names:['Testland'],cont:['Test'],rle:[0,8400,1,720*414-8400]};
  for(const method of ['setup','start']){
    const transactional=createEngine({...options,settings:{...options.settings,map:'world'},maps:{world:lateFaultMap},[ENGINE_TEST_DIAGNOSTICS]:true});
    const before=evidence(transactional);
    assert.throws(()=>transactional[method](),undefined,`${method} late setup failure`);
    const after=evidence(transactional);
    assert.equal(after.checkpoint,before.checkpoint,`${method} failure changed checkpoint`); assert.equal(after.canonical,before.canonical,`${method} failure changed canonical authority`); assert.equal(after.runtime,before.runtime,`${method} failure changed runtime`); assert.equal(after.rng,before.rng,`${method} failure changed RNG`); assert.equal(after.interpolation,before.interpolation,`${method} failure changed interpolation identity`); assert.deepEqual(transactional.drainEvents(),[],`${method} failure retained events`);
  }
  const started=make(); started.start(); started.drainEvents();
  for(const [index,configuration] of acceptedConfigurations.entries()){
    atomicReject(`post-setup configuration ${index}`,()=>started.configure(configuration),started);
    atomicReject(`post-setup start configuration ${index}`,()=>started.start(configuration),started);
  }
  atomicReject('repeat setup',()=>started.setup(),started);
  assert.equal('restoreRuntimeCheckpoint' in started,false,'production API exposes runtime-only restore');

  const replayEngine=make(); replayEngine.start(); replayEngine.drainEvents();
  assert.equal('setLifecycle' in replayEngine,false,'production API exposes arbitrary lifecycle mutation');
  assert.throws(()=>replayEngine.beginReplayPlayback(),/loaded replay/);
  assert.throws(()=>replayEngine.pauseReplayPreview(),/loaded replay/);
  assert.throws(()=>replayEngine.pauseCreditsAtTarget(),/Credits/);
  const badReplayOptions=[
    {on:1},{i:-1},{speed:0},{speed:Infinity},{resume:1},{toTick:-1},{cmds:{}},{cmds:[{t:0,k:'focus',a:[.5]}],i:2},
    {cmds:[{t:2,k:'focus',a:[.5]},{t:1,k:'focus',a:[.4]}]},{hashv:3},{hashes:[[100,'bad']]},{fileGame:'x'.repeat(101)},{poison:true}
  ];
  for(const [index,value] of badReplayOptions.entries()) atomicReject(`configureReplay poison ${index}`,()=>replayEngine.configureReplay(value),replayEngine);
  const badReplayFiles=[
    null,{}, {cmds:[],v:2},{cmds:[],tick:-1},{cmds:[{t:0,k:'focus',a:[NaN]}]},{cmds:[],settings:{map:'unknown'}},{cmds:[],hashes:[[100,'bad']]},{cmds:[],unknown:true},
    {cmds:[],finalDigest:{version:'bad',sha256:'x'}},{cmds:[],final:{tick:0}}
  ];
  for(const [index,value] of badReplayFiles.entries()) atomicReject(`loadReplay poison ${index}`,()=>replayEngine.loadReplay(value),replayEngine);

  const failed=make(); failed.loadReplay({seed:'FAILED',settings:{seed:'FAILED',map:'land'},cmds:[{t:0,k:'accept',a:[999999,'ally',0]}],hashes:[],tick:1,hashv:2}); failed.start(); failed.drainEvents();
  const failedBefore=evidence(failed),logBefore=JSON.stringify(failed.runtimeCheckpoint().commands.log);
  assert.equal(failed.tick(),false);
  assert.equal(failed.serializeCanonical(),failedBefore.canonical,'failed replay command changed authority');
  assert.equal(failed.runtimeCheckpoint().replay.i,0,'failed replay command consumed cursor');
  assert.equal(failed.runtimeCheckpoint().replay.on,true,'failed replay command bypassed replay verification');
  assert.equal(failed.runtimeCheckpoint().replay.mismatch,true,'failed replay command was not recorded as divergence');
  assert.match(failed.runtimeCheckpoint().replay.why,/replay command failed in pre-systems/);
  assert.equal(JSON.stringify(failed.runtimeCheckpoint().commands.log),logBefore,'failed replay command changed command log');
  assert.equal(failed.interpolationFrame(),failedBefore.interpolation,'failed replay command changed interpolation');
  assert.ok(failed.drainEvents().some(event=>event.type==='replayDiverged'),'failed replay command did not surface divergence');
  assert.equal(failed.tick(),false,'failed pre-systems command incorrectly advanced the simulation');
  assert.equal(failed.presentation().state.clock.tickN,0);

  console.log(`Adversarial boundaries PASS: ${SIMPLE_COMMAND_KINDS.length} direct commands, ${MENU_ACTIONS.length} menu actions, command semantics, configuration, replay, queries, and readonly containers`);
})().catch(error=>{ console.error(error.stack||error); process.exitCode=1; });
