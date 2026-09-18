const assert=require('node:assert/strict');
const path=require('node:path');
const {pathToFileURL}=require('node:url');

(async()=>{
  const protectedGlobals=['window','document','Image','HTMLCanvasElement','AudioContext','localStorage','sessionStorage','fetch','requestAnimationFrame','setTimeout','setInterval','performance'];
  const prior=new Map(protectedGlobals.map(name=>[name,Object.getOwnPropertyDescriptor(globalThis,name)]));
  for(const name of protectedGlobals) Object.defineProperty(globalThis,name,{configurable:true,get(){ throw new Error(`structures accessed browser global ${name}`); }});
  try{
    const root=path.resolve(__dirname,'..','game','src','sim');
    const [{createAuthoritativeState},{createDeterministicRuntime},{createStructuresSystem}]=await Promise.all([
      import(pathToFileURL(path.join(root,'authoritative-state.mjs')).href),
      import(pathToFileURL(path.join(root,'deterministic-runtime.mjs')).href),
      import(pathToFileURL(path.join(root,'systems','structures.mjs')).href)
    ]);
    const W=24,H=12;
    const definitions={city:{label:'City',cost:120},factory:{label:'Factory',cost:110},port:{label:'Port',cost:160,coast:true},fort:{label:'Bastion',cost:90},sam:{label:'SAM site',cost:220},silo:{label:'Missile silo',cost:420},command:{label:'Missile command',cost:350},troopcmd:{label:'Troop command',cost:400},shield:{label:'Shield generator',cost:900}};
    const make=()=>{
      const settings={instant:false};
      const state=createAuthoritativeState({tileCount:W*H,settings,allowed:Object.keys(definitions)});
      const runtime=createDeterministicRuntime(); runtime.seed('STRUCTURES');
      state.map.land.fill(1); state.map.owner.fill(0);
      const player=(id,name,kind='human')=>({id,name,kind,alive:true,tiles:id?0:W*H,troops:100,gold:5000,cities:0,factories:0,ports:0,sams:0,silos:0,forts:0,commands:0,troopcmds:0,nextBuildAt:0});
      state.actors.players.push(player(0,'Left'),player(1,'Right'));
      state.setPlayerId(0);
      const events=[];
      const system=createStructuresSystem({W,H,engineState:state,settings,allowed:state.rules.allowed,getMe:()=>state.actors.players[0],botBuildDelay:()=>6000+runtime.random()*6000,
        definitions,buildTicks:{city:0,factory:2,port:2,fort:0,sam:2,silo:2,command:2,troopcmd:2,shield:2},upgrades:{port:{cost:500,ticks:3}},guns:{},shield:{hp:10},levelShield:{hp:6},
        constants:{fortRange:16,commandRange:45,samRange:40,linkRange:34,linkMaxPerFactory:4,linkMaxPerCity:3,linkMaxPerPort:2,structSpacing:3,cityPop:300},
        ownership:{isCoast:t=>t%W===0||t%W===W-1},mechanics:{pausedBlock:()=>false,garrisonOn:()=>false,addTroopsAt(){},domeRadius:()=>12,shipLabel:cls=>cls},
        queuedShipPath:()=>[1,2],launchQueuedShip:(st,job,p)=>events.push(['launch',st,job,p]),effects:{incrementStat:name=>events.push(['stat',name]),puff:(...args)=>events.push(['puff',...args]),scorch:(...args)=>events.push(['scorch',...args]),flash:value=>events.push(['flash',value]),wreck:value=>events.push(['wreck',value])}});
      return {state,runtime,system,events};
    };

    const left=make(),right=make(),p0=left.state.actors.players[0],p1=left.state.actors.players[1];
    assert.notEqual(left.system,right.system);
    assert.equal(left.system.placeStructure(p0,'city',25),true);
    const city=left.state.actors.structures[0];
    assert.equal(left.system.structAtT(city.t),city,'structure identity changed');
    assert.equal(left.state.map.struct[city.t],1); assert.equal(left.state.map.structOwner[city.t],0);
    assert.equal(p0.cities,1); assert.equal(p0.troops,400); assert.equal(p0.gold,4880);
    assert.equal(right.state.actors.structures.length,0,'structure list leaked between instances');
    assert.equal(right.state.map.struct[city.t],0,'structure index leaked between instances');

    const factory=left.system.addStructure({type:'factory',owner:0,t:31,cost:110,building:true,done:2,total:2});
    left.system.structCounts(p0); assert.equal(p0.factories,0);
    left.state.setClock(2,200); left.system.stepBuild();
    assert.equal(factory.building,false); assert.equal(p0.factories,1); assert.equal(left.system.structAtT(31),factory);

    left.state.map.owner[city.t]=1;
    left.system.captureStructure(city.t,p1);
    assert.equal(city.owner,1); assert.equal(left.state.map.structOwner[city.t],1);
    assert.equal(p0.cities,0); assert.equal(p1.cities,1);

    const fort=left.system.addStructure({type:'fort',owner:1,t:100,cost:90,building:false}); left.system.structCounts(p1);
    left.system.captureStructure(fort.t,p0);
    assert.equal(left.state.actors.structures.includes(fort),false); assert.equal(left.state.map.struct[fort.t],0); assert.equal(left.state.map.structOwner[fort.t],-1); assert.equal(p1.forts,0);

    const port=left.system.addStructure({type:'port',owner:0,t:120,cost:160,building:false}); left.system.structCounts(p0);
    assert.equal(left.system.upgradeStructure(p0,port),true); assert.equal(port.upgrading,true);
    left.state.setClock(5,500); left.system.finishUpgrades();
    assert.equal(port.level,2); assert.equal(port.gunHp,4); assert.equal(port.upgrading,false);

    assert.equal(left.system.enqueue(port,{cls:'scout',dest:200,total:4}),1);
    assert.equal(left.system.enqueue(port,{cls:'cruiser',dest:201,total:6}),2);
    assert.equal(port.queue[0].done,9); assert.equal(port.queue[1].done,0);
    left.state.setClock(9,900); left.system.stepBuild();
    assert.equal(left.events.some(event=>event[0]==='launch'&&event[1]===port&&event[3]===p0),true);
    assert.equal(port.queue.length,1); assert.equal(port.queue[0].done,15);
    assert.equal(left.system.cancelQueued(port).cls,'cruiser'); assert.equal(port.queue.length,0);

    const bot=right.state.actors.players[1]; bot.kind='bot'; right.state.map.owner.fill(1); bot.tiles=W*H;
    assert.equal(right.system.placeStructure(bot,'city',25),true);
    assert.equal(right.runtime.rngDraws,1,'bot compatibility RNG draw moved or disappeared');
    assert.equal(left.runtime.rngDraws,0,'RNG state leaked between instances');
    console.log('Structures browser-free placement, capture, destruction, index, counter, queue, and instance isolation contracts PASS');
  }finally{
    for(const [name,descriptor] of prior){ if(descriptor) Object.defineProperty(globalThis,name,descriptor); else delete globalThis[name]; }
  }
})().catch(error=>{ console.error(error.stack||error); process.exitCode=1; });
