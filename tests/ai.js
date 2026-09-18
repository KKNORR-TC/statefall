const assert=require('node:assert/strict');
const path=require('node:path');
const {pathToFileURL}=require('node:url');

(async()=>{
  const protectedGlobals=['window','document','Image','HTMLCanvasElement','AudioContext','localStorage','sessionStorage','fetch','requestAnimationFrame','setTimeout','setInterval','performance'];
  const prior=new Map(protectedGlobals.map(name=>[name,Object.getOwnPropertyDescriptor(globalThis,name)]));
  for(const name of protectedGlobals) Object.defineProperty(globalThis,name,{configurable:true,get(){ throw new Error(`AI accessed browser global ${name}`); }});
  try{
    const root=path.resolve(__dirname,'..','game','src','sim');
    const [{createAuthoritativeState},{createDeterministicRuntime},{DIFFICULTY_PROFILES,createAiSystem}]=await Promise.all([
      import(pathToFileURL(path.join(root,'authoritative-state.mjs')).href),
      import(pathToFileURL(path.join(root,'deterministic-runtime.mjs')).href),
      import(pathToFileURL(path.join(root,'systems','ai.mjs')).href)
    ]);
    const W=6,H=4;
    const definitions=Object.fromEntries(['city','factory','port','sam','fort','shore','battery','shield','airfield','subbase','troopcmd','engcmd','silo','bertha','command'].map(type=>[type,{cost:type==='sam'?220:100,coast:type==='shore'||type==='battery'||type==='port'||type==='subbase'}]));
    const make=()=>{
      const settings={noCap:false};
      const state=createAuthoritativeState({tileCount:W*H,settings,allowed:[],difficulty:'hard'});
      const runtime=createDeterministicRuntime(); runtime.seed('AI-CONTRACT');
      state.map.land.fill(1); state.map.landCount=W*H;
      const bot={id:0,name:'Bot',kind:'bot',alive:true,tiles:8,troops:1000,gold:0,focus:.5,nextThink:0,nextBuildAt:1e9,ports:0,silos:0,factories:0,cities:0,sams:0,rel:{},threats:[],areas:[]};
      const neutral={id:1,name:'Neutral',kind:'neutral',alive:true,tiles:15,troops:1000,gold:0,nextThink:0,grudge:{2:1},warned:false,rel:{}};
      const human={id:2,name:'Human',kind:'human',alive:true,tiles:1,troops:1,gold:0,rel:{}};
      state.actors.players.push(bot,neutral,human); state.setPlayerId(2);
      for(let t=0;t<W*H;t++) state.map.owner[t]=t%W<2?0:(t===W-1?2:1);
      const calls=[],events=[];
      const random=()=>runtime.random(),rnd=(a,b)=>a+random()*(b-a),pick=values=>values[Math.floor(random()*values.length)];
      const ownTilesOf=id=>Array.from(state.map.owner).reduce((out,owner,t)=>{ if(owner===id) out.push(t); return out; },[]);
      const system=createAiSystem({W,H,engineState:state,settings,allowed:state.rules.allowed,random,rnd,pick,getMe:()=>human,profiles:DIFFICULTY_PROFILES,definitions,
        ships:{hunter:{cost:300},warship:{cost:200}},constants:{warshipCost:200,nukeCost:280,linkRange:34,provokeTicks:400,cruise:{cost:400,ticks:300}},
        landCombat:{ownTilesOf,coastTilesOf:()=>[],isCoast:()=>false,maxTroops:()=>100,density:p=>p.troops/Math.max(1,p.tiles),gOn:()=>false,areaById:()=>null,takeTroopsFrom:()=>0,launchAttack:(p,target,troops,seed)=>{ calls.push({kind:'attack',p,target,troops,seed}); return true; }},
        structures:{crowded:()=>false,placeStructure:(p,type,t)=>{ calls.push({kind:'build',p,type,t}); return true; },upgradeStructure:()=>false},
        diplomacy:{relation:()=>null,atPeace:()=>false,setRelation:()=>{},breakRelation:()=>false,inConflict:()=>false},missiles:{launchMissile:()=>false},naval:{waterNeighbor:()=>-1,orderWarship:()=>false},
        air:{airfieldsOf:()=>[],idleAircraft:()=>null,launchFighter:()=>false,botAir:(p,now)=>calls.push({kind:'air',p,now})},logistics:{reinforceArea:()=>false},fog:{targetHidden:()=>false},effects:{log:(...args)=>events.push(['log',...args]),sound:(...args)=>events.push(['sound',...args])}});
      return {state,runtime,system,bot,neutral,human,calls,events};
    };

    assert.equal(DIFFICULTY_PROFILES.impossible.brain,5);
    const left=make(),right=make();
    assert.notEqual(left.system,right.system);
    assert.equal(left.system.currentDifficulty(),DIFFICULTY_PROFILES.hard);
    left.bot.customNation={userId:7}; left.state.setDifficulty('normal');
    assert.equal(left.system.getBotDifficulty(left.bot),DIFFICULTY_PROFILES.superhard);
    left.bot.customNation=null; left.state.setDifficulty('hard');

    left.system.botThink(left.bot,0); right.system.botThink(right.bot,0);
    assert.equal(left.bot.nextThink,right.bot.nextThink,'seeded scheduling diverged');
    assert.equal(left.runtime.rngDraws,right.runtime.rngDraws,'seeded policy changed RNG order');
    assert.deepEqual(left.calls.map(call=>({...call,p:call.p.id})),right.calls.map(call=>({...call,p:call.p.id})),'seeded decisions diverged');
    assert.equal(left.calls[0].kind,'air','air policy command order changed');
    const attack=left.calls.find(call=>call.kind==='attack');
    assert.equal(attack.p,left.bot,'bot command lost actor identity');
    assert.equal(attack.target,1,'bot changed its deterministic target');
    assert.equal(right.bot.nextThink>0,true);

    left.system.noteThreat(0,7,'missile',2);
    assert.equal(left.bot.threats[0].at,0);
    left.bot.gold=500;
    assert.equal(left.system.botReact(left.bot),true);
    const build=left.calls.find(call=>call.kind==='build');
    assert.equal(build.p,left.bot,'reaction command lost actor identity');
    assert.equal(build.type,'sam');
    assert.equal(left.bot.threats.length,0);
    assert.equal(right.bot.threats.length,0,'threat state leaked between instances');

    left.system.neutralThink(left.neutral,0);
    const pushback=left.calls.find(call=>call.kind==='attack'&&call.p===left.neutral);
    assert.equal(pushback.target,2,'provoked neutral changed its target');
    assert.equal(left.neutral.warned,true);
    assert.equal(left.events.some(event=>event[0]==='sound'&&event[1]==='pushback'),true,'neutral sound was not routed through the adapter');
    assert.equal(right.neutral.warned,false,'neutral state leaked between instances');
    console.log('AI browser-free profiles, scheduling, seeded decisions, adapters, actor identity, and instance isolation contracts PASS');
  }finally{
    for(const [name,descriptor] of prior){ if(descriptor) Object.defineProperty(globalThis,name,descriptor); else delete globalThis[name]; }
  }
})().catch(error=>{ console.error(error.stack||error); process.exitCode=1; });
