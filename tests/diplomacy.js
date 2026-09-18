const assert=require('node:assert/strict');
const path=require('node:path');
const {pathToFileURL}=require('node:url');

(async()=>{
  const protectedGlobals=['window','document','Image','HTMLCanvasElement','AudioContext','localStorage','sessionStorage','fetch','requestAnimationFrame','setTimeout','performance'];
  const prior=new Map(protectedGlobals.map(name=>[name,Object.getOwnPropertyDescriptor(globalThis,name)]));
  for(const name of protectedGlobals) Object.defineProperty(globalThis,name,{configurable:true,get(){ throw new Error(`diplomacy accessed browser global ${name}`); }});
  try{
    const root=path.resolve(__dirname,'..','game','src','sim');
    const [{createAuthoritativeState},{createDeterministicRuntime},{createDiplomacySystem}]=await Promise.all([
      import(pathToFileURL(path.join(root,'authoritative-state.mjs')).href),
      import(pathToFileURL(path.join(root,'deterministic-runtime.mjs')).href),
      import(pathToFileURL(path.join(root,'systems','diplomacy.mjs')).href)
    ]);
    const make=()=>{
      const state=createAuthoritativeState();
      const runtime=createDeterministicRuntime(); runtime.seed('DIPLOMACY');
      const player=(id,name,kind)=>({id,name,kind,alive:true,tiles:id?80:100,troops:100,gold:100,rep:0.7,rel:{},lastProposal:{},grudge:{},penaltyUntil:0});
      state.actors.players.push(player(0,'Human','human'),player(1,'Bot','bot'),player(2,'Other','bot'));
      state.setPlayerId(0); state.map.landCount=1000;
      const notices=[];
      const system=createDiplomacySystem({engineState:state,random:()=>runtime.random(),pick:values=>values[Math.floor(runtime.random()*values.length)],getMe:()=>state.actors.players[0],napTicks:1800,betrayTicks:600,proposalTtl:250,provokeTicks:400,
        botLevel:()=>2,getBotDifficulty:()=>({aggr:1}),neutralShare:()=>0.5,maxTroops:()=>400,density:p=>p.troops/Math.max(1,p.tiles),sendGold:()=>true,sendTroops:()=>true,effects:{proposalNotice:value=>notices.push(value)}});
      return {state,runtime,system,notices};
    };
    const left=make(),right=make();
    assert.notEqual(left.system,right.system);
    const relation=left.system.setRelation(left.state.actors.players[0],left.state.actors.players[1],'nap');
    const shared=left.state.actors.players[0].rel[1];
    assert.equal(left.state.actors.players[1].rel[0],shared,'both players must share the relationship object');
    assert.equal(right.state.actors.players[0].rel[1],undefined,'relationship leaked between instances');
    left.system.propose(left.state.actors.players[2],left.state.actors.players[0],'ally');
    assert.equal(left.state.diplomacy.proposals.length,1);
    assert.equal(right.state.diplomacy.proposals.length,0,'proposal leaked between instances');
    const proposal=left.state.diplomacy.proposals[0];
    left.state.setClock(1,100);
    left.system.stepDiplomacy();
    assert.equal(left.state.diplomacy.proposals[0],proposal,'proposal identity changed while retaining it');
    assert.equal(left.notices.length,1);
    assert.equal(typeof left.notices[0].isPending,'function');
    left.system.decline(2);
    assert.equal(left.notices[0].isPending(),false);
    left.state.actors.players[0].rel={}; left.state.actors.players[1].rel={};
    right.state.actors.players[0].rel={}; right.state.actors.players[1].rel={};
    assert.equal(left.system.botConsider(left.state.actors.players[1],left.state.actors.players[0],'ally'),right.system.botConsider(right.state.actors.players[1],right.state.actors.players[0],'ally'));
    assert.equal(left.runtime.rngDraws,right.runtime.rngDraws);
    left.state.setClock(40,4000); right.state.setClock(40,4000);
    left.system.stepDiplomacy(); right.system.stepDiplomacy();
    assert.equal(left.runtime.rngDraws,right.runtime.rngDraws,'diplomacy tick changed deterministic draw count');
    assert.deepEqual(left.state.diplomacy.proposals,right.state.diplomacy.proposals);
    console.log('Diplomacy isolation, browser-free, and deterministic RNG contracts PASS');
  }finally{
    for(const [name,descriptor] of prior){ if(descriptor) Object.defineProperty(globalThis,name,descriptor); else delete globalThis[name]; }
  }
})().catch(error=>{ console.error(error.stack||error); process.exitCode=1; });
