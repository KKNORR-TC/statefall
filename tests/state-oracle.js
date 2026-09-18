const assert=require('node:assert/strict');
const path=require('node:path');
const {pathToFileURL}=require('node:url');

(async()=>{
  const protectedGlobals=['window','document','Image','HTMLCanvasElement','AudioContext','localStorage','sessionStorage','fetch','requestAnimationFrame','setTimeout'];
  const prior=new Map(protectedGlobals.map(name=>[name,Object.getOwnPropertyDescriptor(globalThis,name)]));
  for(const name of protectedGlobals) Object.defineProperty(globalThis,name,{configurable:true,get(){ throw new Error(`state oracle accessed browser global ${name}`); }});
  try{
    const root=path.resolve(__dirname,'..','game','src','sim');
    const [{createAuthoritativeState},{createDeterministicRuntime,serializeCanonicalV1},{createSimulationPorts},{createStateOracle},{resetAuthoritativeState}]=await Promise.all([
      import(pathToFileURL(path.join(root,'authoritative-state.mjs')).href),
      import(pathToFileURL(path.join(root,'deterministic-runtime.mjs')).href),
      import(pathToFileURL(path.join(root,'simulation-ports.mjs')).href),
      import(pathToFileURL(path.join(root,'state-oracle.mjs')).href),
      import(pathToFileURL(path.join(root,'state-reset.mjs')).href)
    ]);
    const make=(name,troops)=>{
      const engineState=createAuthoritativeState({tileCount:2,settings:{seed:name,fog:false},allowed:['city'],difficulty:'hard'});
      const runtime=createDeterministicRuntime();
      const divergences=[];
      engineState.map.land.set([1,0]);
      engineState.map.owner.set([0,-1]);
      engineState.map.landCount=1;
      engineState.actors.players.push({id:0,name,kind:'human',alive:true,troops,gold:100,tiles:1,rel:{}});
      engineState.setPlayerId(0);
      runtime.seed(name);
      runtime.random();
      const oracle=createStateOracle({engineState,runtime,W:2,H:1,ports:createSimulationPorts({replayDiverged:value=>divergences.push(value)})});
      return {engineState,runtime,oracle,divergences};
    };
    const left=make('Left',120),right=make('Right',240);
    assert.equal(left.oracle.version,'statefall-authoritative-state/v1');
    assert.equal(left.oracle.canonicalState(),serializeCanonicalV1(left.oracle.authoritativeState()));
    assert.notEqual(left.oracle.canonicalState(),right.oracle.canonicalState());
    assert.notEqual(left.oracle.stateHash(),right.oracle.stateHash());
    assert.deepEqual(left.oracle.checkStateInvariants(),[]);
    assert.deepEqual(right.oracle.checkStateInvariants(),[]);
    assert.deepEqual(left.oracle.stateDetail(),{0:[120,100,1],rng:1,n:[0,0,0,0]});
    assert.equal(left.oracle.stateDiff({rng:2,0:[121,100,1],n:[1,0,0,0]},left.oracle.stateDetail()),'random draws recorded 2 vs 1; Left: recorded 121/100/1 vs 120/100/1; counts 1/0/0/0 vs 0/0/0/0');
    left.engineState.setClock(100,10000);
    left.oracle.checkpoint();
    assert.deepEqual(left.runtime.commands.hashes,[[100,left.oracle.stateHash(),left.oracle.stateDetail()]]);
    assert.deepEqual(right.runtime.commands.hashes,[]);
    const recorded=left.runtime.commands.hashes[0];
    left.runtime.configureReplay({on:true,hashv:2,hashes:[[100,'00000000',recorded[2]]],mismatch:false,otherVersion:false,fileGame:'1.0.0'});
    assert.equal(left.oracle.checkpoint(),true);
    assert.equal(left.runtime.replay.mismatch,true);
    assert.equal(left.runtime.replay.divTick,100);
    assert.equal(left.divergences.length,1);
    assert.deepEqual(left.divergences[0],{tick:100,recordedHash:'00000000',currentHash:left.oracle.stateHash(),reason:'',recorded:left.runtime.replay.hashes[0],current:left.runtime.replay.divNow,otherVersion:false,fileGame:'1.0.0'});
    left.engineState.actors.planes.push({id:1});
    left.engineState.diplomacy.hostile['0,1']=100;
    left.runtime.commands.log.push({t:1,k:'focus',a:[1]});
    const setup=left.engineState.setup,settings=left.engineState.rules.settings,replay=left.runtime.replay;
    resetAuthoritativeState(left.engineState,left.runtime);
    assert.equal(left.engineState.setup,setup);
    assert.equal(left.engineState.rules.settings,settings);
    assert.equal(left.runtime.replay,replay);
    assert.deepEqual(left.engineState.actors.planes,[]);
    assert.deepEqual(left.engineState.diplomacy.hostile,{});
    assert.deepEqual(left.runtime.commands,{log:[],replaying:false,hashes:[]});
    assert.equal(left.engineState.match.difficulty,'hard');
    assert.equal(right.engineState.actors.players.length,1);
    assert.equal(right.runtime.rngDraws,1);
    console.log('State oracle and authoritative reset isolation PASS');
  }finally{
    for(const [name,descriptor] of prior){
      if(descriptor) Object.defineProperty(globalThis,name,descriptor);
      else delete globalThis[name];
    }
  }
})().catch(error=>{ console.error(error.stack||error); process.exitCode=1; });
