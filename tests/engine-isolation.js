'use strict';

const assert=require('node:assert/strict');
const crypto=require('node:crypto');

(async()=>{
  const {createEngine,ENGINE_TEST_DIAGNOSTICS}=await import('../game/src/sim/engine.mjs');
  const scenarios={
    archipelago:{W:180,H:104,bots:3,difficulty:'hard',settings:{seed:'PHASE-D-ARCHIPELAGO',map:'islands_s',risky:true,fog:true,garrison:true,troops:260,gold:900}},
    continent:{W:168,H:96,bots:2,difficulty:'superhard',settings:{seed:'PHASE-D-CONTINENT',map:'land',quick:true,pauseBuild:true,troops:320,gold:1100}}
  };
  const diagnostic=options=>({...options,[ENGINE_TEST_DIAGNOSTICS]:true});
  const make=options=>createEngine(diagnostic(options));
  const view=engine=>engine.presentation();
  const sha=value=>crypto.createHash('sha256').update(value).digest('hex');
  const evidence=engine=>{
    const canonical=engine.serializeCanonical(),runtime=engine.runtimeCheckpoint();
    return {canonical,sha256:sha(canonical),hash:engine.stateHash(),rng:runtime.rng.draws,commands:runtime.commands,replay:runtime.replay};
  };
  const equal=(actual,expected,label)=>assert.deepEqual(evidence(actual),expected,label);
  const equalBuffer=(actual,expected,label)=>{
    assert.equal(actual.length,expected.length,label+' length');
    for(let index=0;index<actual.length;index++) assert.equal(actual[index],expected[index],`${label} at ${index}`);
  };

  function neutralDraftTile(engine){
    const state=view(engine).state,draft=state.draft.draft;
    if(!draft||draft.order[draft.idx].id!==state.match.playerId) return -1;
    const neutral=state.actors.players.find(player=>player.kind==='neutral'&&player.alive&&player.tiles>=120);
    return neutral?state.map.owner.findIndex(owner=>owner===neutral.id):-1;
  }
  function advance(engine){
    const tile=neutralDraftTile(engine);
    if(tile>=0) engine.issue({kind:'click',args:[tile,{ratio:50,pick:null,build:null}]});
    else engine.tick();
  }
  function resolveSetup(engine){
    for(let guard=0;view(engine).state.draft.draft&&guard<500;guard++) advance(engine);
    assert.equal(view(engine).state.draft.draft,null,'draft did not resolve');
  }
  function ownedBuildTile(engine,type='city'){
    const state=view(engine).state,me=state.actors.players[state.match.playerId];
    for(let tile=0;tile<state.map.owner.length;tile++) if(state.map.owner[tile]===me.id&&engine.queries.snapBuild(me.id,tile,type)>=0) return tile;
    return -1;
  }
  function foreignTile(engine){
    const state=view(engine).state,me=state.match.playerId;
    const bot=state.actors.players.find(player=>player.kind==='bot'&&player.alive);
    const botTile=bot?state.map.owner.findIndex(owner=>owner===bot.id):-1;
    return botTile>=0?botTile:state.map.owner.findIndex(owner=>owner>=0&&owner!==me&&state.actors.players[owner]?.alive);
  }
  function borderTarget(engine,width){
    const state=view(engine).state,{owner,land}=state.map,me=state.match.playerId;
    for(let tile=0;tile<owner.length;tile++){
      if(owner[tile]!==me) continue;
      const x=tile%width,y=(tile-x)/width;
      for(const [dx,dy] of [[1,0],[-1,0],[0,1],[0,-1]]){
        const nx=x+dx,ny=y+dy;
        if(nx<0||nx>=width||ny<0||ny>=land.length/width) continue;
        const target=ny*width+nx;
        if(land[target]&&owner[target]>=0&&owner[target]!==me) return target;
      }
    }
    return -1;
  }
  function exerciseCommands(engine,width){
    const state=view(engine).state,build=ownedBuildTile(engine),foreign=foreignTile(engine),border=borderTarget(engine,width);
    assert.ok(build>=0&&foreign>=0,`scenario lacks construction or diplomacy targets (${build}/${foreign})`);
    if(state.rules.settings.map==='land') assert.ok(border>=0,'land scenario lacks a border combat target');
    engine.issue('focus',0.37);
    assert.equal(engine.togglePause(),true);
    engine.issue({kind:'menu',args:[{act:'nap'},foreign,[],-1,50,0,0]});
    assert.equal(engine.togglePause(),true);
    const structures=state.actors.structures.length,attacks=state.actors.attacks.length;
    engine.issue({kind:'menu',args:[{act:'build',type:'city'},build,[],-1,50,0,0]});
    if(border>=0) engine.issue({kind:'click',args:[border,{ratio:35,pick:null,build:null}]});
    assert.equal(state.actors.structures.length,structures+1,'construction command produced no structure');
    if(border>=0) assert.ok(state.actors.attacks.length>attacks,'border combat command produced no attack');
    assert.ok(engine.runtimeCheckpoint().commands.log.length>=3,'meaningful commands were not recorded');
  }
  function tickTo(engine,target){ while(view(engine).state.clock.tickN<target) engine.tick(); }

  function runControl(options){
    const engine=make(options),points={};
    engine.start(); resolveSetup(engine); exerciseCommands(engine,options.W); tickTo(engine,90);
    points.beforeRestore=evidence(engine);
    const checkpoint=JSON.parse(JSON.stringify(engine.checkpoint()));
    tickTo(engine,145); engine.issue('focus',0.83); engine.restoreCheckpoint(checkpoint);
    tickTo(engine,145); engine.issue('focus',0.83); points.afterRestore=evidence(engine);
    tickTo(engine,360); points.final=evidence(engine);
    return points;
  }
  function runFreshControl(options){
    const engine=make(options),points={};
    engine.start(); resolveSetup(engine); exerciseCommands(engine,options.W); tickTo(engine,90);
    points.beforeRestore=evidence(engine); tickTo(engine,360); points.final=evidence(engine);
    return points;
  }

  const controls={archipelago:runControl(scenarios.archipelago),continent:runFreshControl(scenarios.continent)};
  const left=make(scenarios.archipelago),right=make(scenarios.continent);
  left.start(); right.start();
  for(let guard=0;(view(left).state.draft.draft||view(right).state.draft.draft)&&guard<1000;guard++){
    if(view(left).state.draft.draft) advance(left);
    if(view(right).state.draft.draft) advance(right);
  }
  resolveSetup(left); resolveSetup(right); exerciseCommands(left,scenarios.archipelago.W); exerciseCommands(right,scenarios.continent.W);
  while(view(left).state.clock.tickN<90||view(right).state.clock.tickN<90){
    if(view(left).state.clock.tickN<90) left.tick();
    if(view(right).state.clock.tickN<90) right.tick();
  }
  equal(left,controls.archipelago.beforeRestore,'archipelago diverged under setup/draft/tick interleaving');
  equal(right,controls.continent.beforeRestore,'continent diverged under setup/draft/tick interleaving');
  const leftCheckpoint=JSON.parse(JSON.stringify(left.checkpoint()));
  tickTo(left,145);
  for(let index=0;index<45;index++) right.tick();
  left.issue('focus',0.83); left.restoreCheckpoint(leftCheckpoint);
  for(let index=0;index<30;index++) right.tick();
  tickTo(left,145); left.issue('focus',0.83);
  equal(left,controls.archipelago.afterRestore,'checkpoint/restore diverged while the peer continued');

  right.start();
  for(let index=0;index<25;index++) left.tick();
  resolveSetup(right); exerciseCommands(right,scenarios.continent.W);
  for(let index=0;index<40;index++){ left.tick(); right.tick(); }
  right.reset();
  for(let index=0;index<20;index++) left.tick();
  right.start(); resolveSetup(right); exerciseCommands(right,scenarios.continent.W);
  while(view(right).state.clock.tickN<360){ if(view(left).state.clock.tickN<360) left.tick(); right.tick(); }
  tickTo(left,360);
  equal(left,controls.archipelago.final,'peer reset/restart contaminated the continuing engine');
  equal(right,controls.continent.final,'restarted engine differed from its fresh control');
  assert.deepEqual(left.checkInvariants(),[]); assert.deepEqual(right.checkInvariants(),[]);

  function collectObjects(root,result=new Set()){
    if(root===null||typeof root!=='object'||result.has(root)) return result;
    result.add(root);
    if(root instanceof Map) for(const [key,value] of root){ collectObjects(key,result); collectObjects(value,result); }
    else if(root instanceof Set) for(const value of root) collectObjects(value,result);
    else if(!ArrayBuffer.isView(root)) for(const key of Reflect.ownKeys(root)){ const descriptor=Object.getOwnPropertyDescriptor(root,key); if(descriptor&&'value' in descriptor) collectObjects(descriptor.value,result); }
    return result;
  }
  function assertDisjointGraphs(leftRoot,rightRoot,label){
    const leftObjects=collectObjects(leftRoot),rightObjects=collectObjects(rightRoot);
    for(const object of leftObjects) assert.equal(rightObjects.has(object),false,label);
  }
  const leftOwned=collectObjects(left.compatibility.state); collectObjects(left.compatibility.runtime,leftOwned);
  const rightOwned=collectObjects(right.compatibility.state); collectObjects(right.compatibility.runtime,rightOwned);
  assert.notEqual(left.compatibility.state,right.compatibility.state); assert.notEqual(left.compatibility.runtime,right.compatibility.runtime);
  for(const object of leftOwned) if(!Object.isFrozen(object)) assert.equal(rightOwned.has(object),false,'engines share mutable authoritative or runtime storage');

  // Public boundary: retained constructor/configure/start references cannot alter either engine or its peer.
  {
    const mapDefinition={w:120,h:70,names:['Westphalia'],cont:['Europe'],rle:new Int32Array([1,120*70])};
    const maps={world:mapDefinition};
    const countries=Array.from({length:16},(_,index)=>[`Nation ${index}`,['rect',index?'#334455':'#112233',0,0,1,1]]);
    const settings={seed:'OWNEDINPUT',map:'world',troops:180,gold:700,customBots:[{slot:0,userId:81,name:'Bot Nation',layers:[['rect','#445566',0,0,1,1],['star','#ffffff',.5,.5,.2,5]]}]};
    const chosenFlag={name:'Westphalia',idx:0,custom:true,userId:80,layers:[['rect','#123456',0,0,1,1],['tri','#abcdef',[0,0],[1,.5],[0,1]]]};
    const startInput={chosenFlag,settings:{quick:false}};
    const pristine=structuredClone({maps,countries,settings,startInput});
    const base=make({W:120,H:70,bots:2,maps:pristine.maps,countries:pristine.countries,settings:pristine.settings});
    const aliasLeft=make({W:120,H:70,bots:2,maps,countries,settings}),aliasRight=make({W:120,H:70,bots:2,maps,countries,settings});
    base.start(pristine.startInput); aliasLeft.start(startInput); aliasRight.start(startInput);
    settings.seed='MUTATED'; settings.customBots[0].name='Mutated Bot'; settings.customBots[0].layers[0][1]='#000000';
    maps.world.rle[1]=1; maps.world.names[0]='Mutated Map'; countries[0][0]='Mutated Country'; countries[0][1][1]='#ffffff';
    chosenFlag.name='Mutated Flag'; chosenFlag.layers[0][1]='#000000'; chosenFlag.layers[1][2][0]=.25; startInput.settings.quick=true;
    assert.equal(view(aliasLeft).state.actors.players[0].name,'Westphalia','start retained a WP nation flag object');
    assert.equal(view(aliasLeft).state.actors.players.find(player=>player.kind==='bot').name,'Bot Nation','start retained custom bot definitions or layers');
    equal(aliasLeft,evidence(base),'constructor/start input mutation changed authority, canonical bytes, RNG, or runtime');
    equal(aliasRight,evidence(base),'shared constructor/start input mutation contaminated a second engine');
    for(let index=0;index<30;index++){ base.tick(); aliasLeft.tick(); aliasRight.tick(); }
    equal(aliasLeft,evidence(base),'constructor/start alias changed continuation behavior');
    equal(aliasRight,evidence(base),'constructor/start alias changed peer continuation behavior');
  }

  // Actor flags are independently owned while canonical v1 retains its historical virtual aliases.
  {
    const mapDefinition={w:120,h:70,names:['Flagland'],cont:['Europe'],rle:new Int32Array([1,120*70])};
    const countries=Array.from({length:18},(_,index)=>[`Flag Nation ${index}`,['rect',index?'#334455':'#112233',0,0,1,1],['tri','#abcdef',[0,0],[1,.5],[0,1]]]);
    const customBots=[{slot:0,userId:201,name:'Owned Bot A',layers:[['rect','#445566',0,0,1,1]]},{slot:1,userId:202,name:'Owned Bot B',layers:[['star','#ffffff',.5,.5,.2,5]]}];
    const chosenFlag={name:'Owned Human',idx:0,custom:true,userId:200,layers:[['rect','#123456',0,0,1,1],['tri','#fedcba',[0,0],[1,.5],[0,1]]]};
    const options={W:120,H:70,bots:2,maps:{world:mapDefinition},countries,settings:{seed:'FLAG-GRAPH',map:'world',customBots}};
    const uninterrupted=make(options),restored=make(options);
    uninterrupted.start({chosenFlag});
    const state=uninterrupted.compatibility.state,players=state.actors.players;
    const definitions=[state.setup.chosenFlag,...state.rules.settings.customBots.map(bot=>bot.layers),...uninterrupted.compatibility.countries];
    for(let index=0;index<players.length;index++){
      assertDisjointGraphs(players[index].flag,definitions,`player ${index} flag shares setup/settings/country definition storage`);
      for(let other=index+1;other<players.length;other++) assertDisjointGraphs(players[index].flag,players[other].flag,`players ${index}/${other} share flag storage`);
    }
    const setupEvidence=evidence(uninterrupted),jsonCheckpoint=JSON.parse(JSON.stringify(uninterrupted.checkpoint()));
    restored.restoreCheckpoint(jsonCheckpoint);
    equal(restored,setupEvidence,'JSON checkpoint changed custom flag canonical/hash/RNG/runtime state');
    const restoredState=restored.compatibility.state;
    for(let index=0;index<restoredState.actors.players.length;index++){
      const player=restoredState.actors.players[index];
      assertDisjointGraphs(player.flag,[restoredState.setup.chosenFlag,...restoredState.rules.settings.customBots.map(bot=>bot.layers)],`restored player ${index} flag aliases a definition`);
      for(let other=index+1;other<restoredState.actors.players.length;other++) assertDisjointGraphs(player.flag,restoredState.actors.players[other].flag,`restored players ${index}/${other} share flag storage`);
    }
    assert.equal(restored.setCommandHistory([],[]),true);
    uninterrupted.setCommandHistory([],[]);
    const rollbackCheckpoint=JSON.stringify(restored.checkpoint()),rollbackEvidence=evidence(restored);
    assert.throws(()=>restored.setCommandHistory([{t:1,k:'focus',a:[.5]}],[]),/invalid recorded command/i);
    assert.equal(JSON.stringify(restored.checkpoint()),rollbackCheckpoint,'failed atomic command changed the ownership graph or values');
    equal(restored,rollbackEvidence,'failed atomic command changed canonical/hash/RNG/runtime state');
    for(let index=0;index<30;index++){ uninterrupted.tick(); restored.tick(); }
    equal(restored,evidence(uninterrupted),'custom flag checkpoint continuation diverged');
  }

  // Public boundary: configure and setup own WP-shaped flags, custom bot layers, Sets, and nested settings.
  {
    const config={settings:{seed:'CONFIGOWN',map:'land',customBots:[{slot:0,userId:91,name:'Configured Bot',layers:[['rect','#223344',0,0,1,1]]}]},allowed:new Set(['city','factory','port']),chosenFlag:{name:'Configured WP',idx:2,layers:[['h','#111111','#eeeeee']]}};
    const pristine=structuredClone(config),base=make({W:120,H:70,bots:2}),aliasLeft=make({W:120,H:70,bots:2}),aliasRight=make({W:120,H:70,bots:2});
    base.configure(pristine); aliasLeft.configure(config); aliasRight.configure(config);
    config.settings.seed='CHANGED'; config.settings.customBots[0].layers[0][1]='#ffffff'; config.allowed.clear(); config.chosenFlag.layers[0][1]='#ffffff';
    const setupInput={settings:{gold:333}},setupControl=structuredClone(setupInput);
    base.setup(setupControl); aliasLeft.setup(setupInput); aliasRight.setup(setupInput);
    setupInput.settings.gold=1;
    equal(aliasLeft,evidence(base),'configure/setup retained mutable settings, Set, nation flag, or custom bot layers');
    equal(aliasRight,evidence(base),'configure/setup aliases contaminated a second engine');
  }

  // Every canonical map selection must restart like a fresh seeded engine.
  for(const map of ['random','land','islands_l','islands_m','islands_s','atoll','world','europe','americas','africa','asia','mideast']){
    const mapOptions={W:120,H:70,bots:2,settings:{seed:`RESET-${map}`,map}};
    const restarted=make(mapOptions),fresh=make(mapOptions);
    restarted.setup(); restarted.reset(); restarted.setup(); fresh.setup();
    equal(restarted,evidence(fresh),`setup/reset/setup differs from fresh engine for map ${map}`);
  }

  // Every accepted setup alias must normalize to exactly the canonical setup.
  for(const [alias,canonical] of Object.entries({continents:'random',large_islands:'islands_l','large-islands':'islands_l',medium_islands:'islands_m','medium-islands':'islands_m',small_islands:'islands_s','small-islands':'islands_s',middle_east:'mideast','middle-east':'mideast'})){
    const seed=`ALIAS-${alias}`,aliased=make({W:120,H:70,bots:2,settings:{seed,map:alias}}),canonicalEngine=make({W:120,H:70,bots:2,settings:{seed,map:canonical}});
    aliased.setup(); canonicalEngine.setup();
    assert.equal(view(aliased).state.rules.settings.map,canonical,`map alias ${alias} was not normalized`);
    equal(aliased,evidence(canonicalEngine),`map alias ${alias} differs from ${canonical}`);
  }

  // Public boundary: nested command arguments are copied before command execution and history recording.
  {
    const engine=make(scenarios.continent); engine.start(); resolveSetup(engine);
    const target=foreignTile(engine),data={act:'nap'};
    engine.issue({kind:'menu',args:[data,target,[],-1,50,0,0]});
    data.act='war';
    const recorded=engine.runtimeCheckpoint().commands.log.at(-1);
    assert.equal(recorded.a[0].act,'nap');
  }

  // Public boundary: replay payloads and nested command args are owned before replay setup.
  {
    const payload={seed:'REPLAYOWN',settings:{seed:'REPLAYOWN',map:'land'},cmds:[{t:100,k:'click',a:[0,{ratio:50,pick:{kind:'attack',t:1},build:null}]}],hashes:[],tick:100,hashv:2};
    const control=structuredClone(payload),base=make({W:120,H:70,bots:2}),aliasLeft=make({W:120,H:70,bots:2}),aliasRight=make({W:120,H:70,bots:2});
    base.loadReplay(control); aliasLeft.loadReplay(payload); aliasRight.loadReplay(payload);
    payload.settings.seed='MUTATED'; payload.cmds[0].a[1].pick.t=2; payload.cmds.length=0; payload.hashes.push([100,'bad']);
    assert.deepEqual(aliasLeft.runtimeCheckpoint(),base.runtimeCheckpoint(),'loadReplay retained payload or nested command argument references');
    assert.deepEqual(aliasRight.runtimeCheckpoint(),base.runtimeCheckpoint(),'shared replay payload contaminated a second engine');
  }

  // Public boundary: restored checkpoints are decoded into engine-owned graphs and reject unsupported input atomically.
  {
    const source=make(scenarios.continent); source.start(); resolveSetup(source); for(let index=0;index<12;index++) source.tick();
    const checkpoint=source.checkpoint(),leftRestored=make(scenarios.continent),rightRestored=make(scenarios.continent);
    leftRestored.restoreCheckpoint(checkpoint); rightRestored.restoreCheckpoint(checkpoint);
    checkpoint.version='mutated'; checkpoint.payload.nodes.length=0;
    equal(leftRestored,evidence(source),'checkpoint mutation changed restored authority');
    equal(rightRestored,evidence(source),'checkpoint mutation contaminated a second restored engine');
    const before=evidence(leftRestored);
    for(const operation of [
      ()=>leftRestored.configure({settings:{bad:()=>1}}),
      ()=>leftRestored.start({settings:{bad:()=>1}}),
      ()=>leftRestored.setup({settings:{bad:()=>1}}),
      ()=>leftRestored.configure({chosenFlag:new (class Flag{})()}),
      ()=>leftRestored.issue('focus',()=>.5),
      ()=>leftRestored.configureReplay({on:true,cmds:[{t:0,k:'unknown',a:[]}],i:0}),
      ()=>leftRestored.loadReplay({cmds:[{t:0,k:'menu',a:[{act:'unknown'},0,[],-1,50,0,0]}]})
    ]){ assert.throws(operation); equal(leftRestored,before,'unsupported inbound object was not rejected atomically'); }
  }

  const cycling=make(scenarios.continent),publicView=cycling.presentation(),render=cycling.renderBuffers();
  const stable={presentation:publicView,state:publicView.state,map:publicView.state.map,actors:publicView.state.actors,players:publicView.state.actors.players,diplomacy:publicView.state.diplomacy,fog:publicView.state.fog,garrison:publicView.state.garrison,runtime:publicView.runtime,commands:publicView.runtime.commands,replay:publicView.runtime.replay,render,renderMap:render.map,renderFog:render.fog};
  for(let cycle=0;cycle<4;cycle++){
    cycling.start(); resolveSetup(cycling); exerciseCommands(cycling,scenarios.continent.W); tickTo(cycling,70);
    const oldActors=[...publicView.state.actors.players],oldEventCount=cycling.drainEvents().length;
    assert.ok(oldEventCount>0); cycling.renderBuffers(); stable.render.map.owner.fill(12345); stable.render.map.land.fill(255); cycling.reset(); cycling.renderBuffers();
    assert.equal(publicView.state.actors.players.length,0,'reset retained actors');
    assert.equal(publicView.state.clock.tickN,0); assert.equal(publicView.runtime.commands.log.length,0); assert.equal(publicView.runtime.replay.i,0);
    assert.deepEqual(cycling.drainEvents(),[],'reset retained stale events');
    assert.ok(stable.render.map.owner.every(owner=>owner===-1),'renderer owner cache retained the prior match');
    assert.ok(stable.render.map.land.every(land=>land===0),'renderer static cache retained the prior map');
    cycling.start(); resolveSetup(cycling);
    for(const actor of oldActors) assert.equal(publicView.state.actors.players.includes(actor),false,'restart retained a stale actor');
    assert.equal(cycling.presentation(),stable.presentation); assert.equal(publicView.state,stable.state); assert.equal(publicView.state.map,stable.map); assert.equal(publicView.state.actors,stable.actors); assert.equal(publicView.state.actors.players,stable.players);
    assert.equal(publicView.state.diplomacy,stable.diplomacy); assert.equal(publicView.state.fog,stable.fog); assert.equal(publicView.state.garrison,stable.garrison); assert.equal(publicView.runtime,stable.runtime); assert.equal(publicView.runtime.commands,stable.commands); assert.equal(publicView.runtime.replay,stable.replay);
    assert.equal(cycling.renderBuffers(),stable.render); assert.equal(stable.render.map,stable.renderMap); assert.equal(stable.render.fog,stable.renderFog);
    equalBuffer(stable.render.map.owner,publicView.state.map.owner,'renderer owner cache did not refresh for the new match');
    equalBuffer(stable.render.map.land,publicView.state.map.land,'renderer static cache did not refresh for the new map');
  }
  cycling.start(); resolveSetup(cycling); exerciseCommands(cycling,scenarios.continent.W); tickTo(cycling,360);
  equal(cycling,controls.continent.final,'repeated reset/start cycles changed fresh-engine output');
  assert.deepEqual(cycling.checkInvariants(),[]);
  console.log('Phase D direct-engine isolation, checkpoint, restart, ownership, and identity evidence PASS');
})().catch(error=>{ console.error(error.stack||error); process.exitCode=1; });
