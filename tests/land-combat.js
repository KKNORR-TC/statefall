const assert=require('node:assert/strict');
const path=require('node:path');
const {pathToFileURL}=require('node:url');

(async()=>{
  const protectedGlobals=['window','document','Image','HTMLCanvasElement','AudioContext','localStorage','sessionStorage','fetch','requestAnimationFrame','setTimeout','setInterval','performance'];
  const prior=new Map(protectedGlobals.map(name=>[name,Object.getOwnPropertyDescriptor(globalThis,name)]));
  for(const name of protectedGlobals) Object.defineProperty(globalThis,name,{configurable:true,get(){ throw new Error(`land combat accessed browser global ${name}`); }});
  try{
    const root=path.resolve(__dirname,'..','game','src','sim');
    const [{createAuthoritativeState},{createDeterministicRuntime},{createLandCombatSystem},{createLogisticsSystem}]=await Promise.all([
      import(pathToFileURL(path.join(root,'authoritative-state.mjs')).href),
      import(pathToFileURL(path.join(root,'deterministic-runtime.mjs')).href),
      import(pathToFileURL(path.join(root,'systems','land-combat.mjs')).href),
      import(pathToFileURL(path.join(root,'systems','logistics.mjs')).href)
    ]);
    const W=10,H=6;
    const make=(garrison=false,eager=false)=>{
      let deferredLosses=0,combatActive=false;
      const settings={garrison};
      const state=createAuthoritativeState({tileCount:W*H,settings});
      const runtime=createDeterministicRuntime(); runtime.seed('LAND-COMBAT');
      state.map.land.fill(1); state.map.region.fill(0); state.map.regions.push({id:0,size:W*H}); state.map.landCount=W*H; state.map.NP=256; state.map.regCount=new Int32Array(256);
      const player=(id,name,kind)=>({id,name,kind,alive:true,tiles:0,troops:300,gold:100,cities:0,grudge:{},warned:true});
      state.actors.players.push(player(0,'Attacker','human'),player(1,'Neutral','neutral'));
      state.setPlayerId(0);
      const captures=[];
      const random=()=>runtime.random();
      let logistics;
      const garrisonOps={gOn:(...args)=>logistics.gOn(...args),areaById:(...args)=>logistics.areaById(...args),areaAt:(...args)=>logistics.areaAt(...args),areaTouching:(...args)=>logistics.areaTouching(...args),syncTroops:(...args)=>{if(eager&&combatActive&&args[0].id===1)return;return logistics.syncTroops(...args);},addTroopsAt:(...args)=>logistics.addTroopsAt(...args),takeTroopsFrom:(...args)=>logistics.takeTroopsFrom(...args),loseTroopsAt:(...args)=>{if(args[3])deferredLosses++;if(eager)args.length=3;return logistics.loseTroopsAt(...args);},densityAt:(...args)=>logistics.densityAt(...args)};
      const system=createLandCombatSystem({W,H,engineState:state,settings,random,rnd:(a,b)=>a+random()*(b-a),getMe:()=>state.actors.players[0],constants:{suppressCost:0.5,wallToll:15,conquestGold:0.12,conquestEarly:3,conquestEarlyTicks:4800,provokeTicks:400},
        diplomacy:{atPeace:()=>false,relation:()=>null,markHostile(){},isProvokedBy:(p,id,margin)=>p.grudge[id]!=null&&state.clock.tickN-p.grudge[id]<400-margin},
        garrison:garrisonOps,
        mechanics:{pausedBlock:()=>false,nearestCoast:()=>-1,areaLabel:()=>'',launchTransport:()=>false,fortStack:()=>0,fortMult:()=>1,captureStructure(){},structCounts(){}},
        effects:{tileCaptured:(t,p)=>captures.push([t,p])}});
      logistics=createLogisticsSystem({W,H,engineState:state,settings,getMe:()=>state.actors.players[0],truck:{max:4,speed:.4,repairTicks:80,costPip:15,reserve:150},provokeTicks:400,carrierCapacity:1500,landCombat:system,structures:{repairNeed:()=>0,repairOne(){}},diplomacy:{atPeace:()=>false,inConflict:()=>true},naval:{seaRisk:()=>0,reinforceArea:()=>false},air:{idleAircraft:()=>null,launchParadrop:()=>false},mechanics:{areaLabel:()=>'',structureLabel:()=>''}});
      for(let t=0;t<W*H;t++) system.setOwner(t,t%W<2?0:1);
      return {state,runtime,system:{...system,stepAttacks(){combatActive=true;try{return system.stepAttacks();}finally{combatActive=false;}}},captures,deferredLossCount:()=>deferredLosses};
    };
    const left=make(),right=make();
    assert.notEqual(left.system,right.system);
    assert.equal(left.state.actors.players[0].tiles,12);
    assert.equal(left.state.map.regCount[0],12);
    assert.equal(left.system.ownTilesOf(0).length,12);
    left.system.setOwner(0,-1);
    assert.equal(left.state.map.unclaimed.has(0),true);
    assert.equal(right.state.map.owner[0],0,'ownership leaked between instances');
    left.system.setOwner(0,0);

    assert.equal(left.system.launchAttack(left.state.actors.players[0],1,120),true);
    assert.equal(right.system.launchAttack(right.state.actors.players[0],1,120),true);
    const attack=left.state.actors.attacks[0],front=attack.front;
    left.system.stepAttacks(); right.system.stepAttacks();
    assert.equal(left.state.actors.attacks[0],attack,'attack actor identity changed');
    assert.equal(left.state.actors.attacks[0].front,front,'frontier Set identity changed');
    assert.equal(left.runtime.rngDraws,right.runtime.rngDraws);
    assert.deepEqual(left.state.map.owner,right.state.map.owner);
    assert.deepEqual(left.state.actors.players,right.state.actors.players);
    assert.equal(left.state.actors.players[1].grudge[0],0,'neutral attack did not record provocation');
    assert.equal(left.captures.length,right.captures.length);
    assert.equal(left.captures[0][1],left.state.actors.players[0],'effect adapter did not retain player identity');
    const eliminated=make();
    for(let t=0;t<W*H-5;t++) eliminated.system.setOwner(t,0);
    eliminated.state.actors.players[1].troops=0;
    assert.equal(eliminated.system.launchAttack(eliminated.state.actors.players[0],1,20),true);
    eliminated.system.stepAttacks();
    assert.equal(eliminated.state.actors.players[1].alive,false,'conquered defender remained alive');
    assert.equal(eliminated.state.actors.players[1].tiles,0);
    assert.equal(eliminated.state.actors.players[0].gold>100,true,'neutral conquest plunder was not awarded');

    const garrison=make(true);
    const area={id:7,owner:0,tiles:12,troops:80}; garrison.state.actors.players[0].areas=[area]; garrison.state.actors.players[0].troops=80; garrison.state.garrison.areaOf=new Int32Array(W*H).fill(-1); garrison.state.garrison.areaOf[0]=7;
    assert.equal(garrison.system.takeTroopsFrom(garrison.state.actors.players[0],area,25),25);
    assert.equal(area.troops,55); assert.equal(garrison.state.actors.players[0].troops,55);
    garrison.system.addTroopsAt(garrison.state.actors.players[0],0,5);
    assert.equal(area.troops,60); assert.equal(garrison.state.actors.players[0].troops,60);

    // Compare batched combat against an eager, per-tile summation oracle.
    // Missing area mappings deliberately exercise reads of the global fallback.
    const batch=make(true),eager=make(true,true);
    for(const game of [batch,eager]){
      const [attacker,defender]=game.state.actors.players; defender.kind='bot';
      attacker.areas=[{id:100,owner:0,tiles:12,troops:900}];attacker.troops=900;
      defender.areas=[];
      game.state.garrison.areaOf=new Int32Array(W*H).fill(-1);
      for(let t=0;t<W*H;t++){
        if(game.state.map.owner[t]===0)game.state.garrison.areaOf[t]=100;
        else {defender.areas.push({id:t+1,owner:1,tiles:1,troops:1+t/100});if(t%4)game.state.garrison.areaOf[t]=t+1;}
      }
      game.system.syncTroops(defender);
      assert.equal(game.system.launchAttack(attacker,1,500,null,attacker.areas[0]),true);
    }
    for(let tick=0;tick<20;tick++){
      batch.system.stepAttacks();eager.system.stepAttacks();
      assert.deepEqual(batch.state.map.owner,eager.state.map.owner);
      assert.deepEqual(batch.state.actors.players,eager.state.actors.players,'batched garrison total changed floating-point results');
      assert.deepEqual(batch.state.actors.attacks,eager.state.actors.attacks);
      assert.equal(batch.runtime.rngDraws,eager.runtime.rngDraws);
    }
    assert.ok(batch.deferredLossCount()>0,'combat still summed all garrison areas for every local loss');

    const emptyBatch=make(true),emptyEager=make(true,true);
    for(const game of [emptyBatch,emptyEager]){
      const [attacker,defender]=game.state.actors.players;defender.kind='bot';defender.areas=[];
      attacker.areas=[{id:100,owner:0,tiles:12,troops:900}];attacker.troops=900;
      // Newly acquired tiles can still refer to another nation's previous area.
      game.state.garrison.areaOf=new Int32Array(W*H).fill(100);
      assert.equal(game.system.launchAttack(attacker,1,500,null,attacker.areas[0]),true);
      game.system.stepAttacks();
    }
    assert.deepEqual(emptyBatch.state.actors.players,emptyEager.state.actors.players,'an empty garrison lost its global fallback troop pool');
    assert.deepEqual(emptyBatch.state.map.owner,emptyEager.state.map.owner);

    const reclaim=make(); reclaim.system.setOwner(11,-1); reclaim.state.setClock(10,1000);
    for(let tick=10;tick<=400&&reclaim.state.map.owner[11]<0;tick+=10){ reclaim.state.setClock(tick,tick*100); reclaim.system.reclaimLand(); }
    assert.equal(reclaim.state.map.owner[11]>=0,true,'surrounded unclaimed land was not reclaimed');
    console.log('Land combat isolation, ownership, identity, garrison, and deterministic RNG contracts PASS');
  }finally{
    for(const [name,descriptor] of prior){ if(descriptor) Object.defineProperty(globalThis,name,descriptor); else delete globalThis[name]; }
  }
})().catch(error=>{ console.error(error.stack||error); process.exitCode=1; });
