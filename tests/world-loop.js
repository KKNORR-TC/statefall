const assert=require('node:assert/strict');
const path=require('node:path');
const {pathToFileURL}=require('node:url');

(async()=>{
  const protectedGlobals=['window','document','Image','HTMLCanvasElement','CanvasRenderingContext2D','AudioContext','localStorage','sessionStorage','fetch','requestAnimationFrame','setTimeout','setInterval','performance'];
  const prior=new Map(protectedGlobals.map(name=>[name,Object.getOwnPropertyDescriptor(globalThis,name)]));
  for(const name of protectedGlobals) Object.defineProperty(globalThis,name,{configurable:true,get(){ throw new Error(`world loop accessed browser global ${name}`); }});
  try{
    const root=path.resolve(__dirname,'..','game','src','sim');
    const [{createAuthoritativeState},{createDeterministicRuntime},{createSimulationPorts},{createWorldLoop}]=await Promise.all([
      import(pathToFileURL(path.join(root,'authoritative-state.mjs')).href),
      import(pathToFileURL(path.join(root,'deterministic-runtime.mjs')).href),
      import(pathToFileURL(path.join(root,'simulation-ports.mjs')).href),
      import(pathToFileURL(path.join(root,'world-loop.mjs')).href)
    ]);

    const methodNames={
      economy:['accruePlayers','checkRegions'],structures:['rebuildLinks','stepBuild'],diplomacy:['stepDiplomacy'],
      landCombat:['reclaimLand','stepAttacks'],missiles:['missileCommand','stepInterceptors','stepShields','stepMissiles'],
      naval:['stepTrade','stepGuns','stepNaval'],fog:['stepPlanes','computeVision','updateKnownBorders'],air:['stepAir','flightOps'],
      logistics:['troopLogistics','engineering','stepTrucks','rebuildAreas'],matchFlow:['evaluateOutcomes','checkAlliedEndgame','advanceDraft']
    };
    function fixture(tag,{tick=4,garrison=true,checkpoint=false,otherVersion=false}={}){
      const events=[],state=createAuthoritativeState({tileCount:2,settings:{garrison}}),runtime=createDeterministicRuntime({tickMs:100});
      state.setClock(tick,tick*100);
      state.map.land.fill(1);
      state.map.owner.fill(0);
      const player={id:0,alive:true};
      state.actors.players.push(player);
      const systems={};
      for(const [group,names] of Object.entries(methodNames)){
        systems[group]={};
        for(const name of names) systems[group][name]=(...args)=>{ events.push(`${tag}:${name}${args.length?`:${args[0]}`:''}`); };
      }
      const ports=createSimulationPorts({invalidateMap:()=>events.push(`${tag}:map`),invalidateUi:()=>events.push(`${tag}:ui`),scheduleControllerTask:task=>events.push(`${tag}:schedule:${task}`)});
      const loop=createWorldLoop({W:2,H:1,engineState:state,runtime,settings:state.rules.settings,ports,
        applyReplayCommand:command=>events.push(`${tag}:command:${command.k}`),stateOracle:{checkpoint:()=>{ events.push(`${tag}:checkpoint`); return checkpoint; }},
        isReplayOtherVersion:()=>otherVersion,systems});
      return {events,state,runtime,systems,loop};
    }
    const names=(tag,tick,{ten=false,vision=false,areas=false,allied=false,ui=false,checkpoint=false,schedule=false}={})=>[
      `${tag}:draft`,
      ...(checkpoint?[`${tag}:checkpoint`,...(schedule?[`${tag}:schedule:showReplayDivergence`]:[])]:[]),
      `${tag}:accruePlayers:${tick*100}`,...(ten?[`${tag}:rebuildLinks`]:[]),`${tag}:stepDiplomacy`,`${tag}:reclaimLand`,`${tag}:stepBuild`,
      `${tag}:missileCommand`,`${tag}:stepTrade`,`${tag}:stepGuns`,`${tag}:stepPlanes`,`${tag}:stepAir`,`${tag}:flightOps`,`${tag}:troopLogistics`,`${tag}:engineering`,`${tag}:stepTrucks`,
      ...(vision?[`${tag}:computeVision`,`${tag}:updateKnownBorders`]:[]),`${tag}:stepAttacks`,`${tag}:stepInterceptors`,`${tag}:stepShields`,`${tag}:stepMissiles`,`${tag}:stepNaval`,
      ...(vision?[`${tag}:checkRegions`]:[]),`${tag}:map`,`${tag}:evaluateOutcomes`,...(areas?[`${tag}:rebuildAreas`]:[]),...(allied?[`${tag}:checkAlliedEndgame`]:[]),...(ui?[`${tag}:ui`]:[])
    ];

    const left=fixture('left'),right=fixture('right');
    left.systems.matchFlow.advanceDraft=()=>left.events.push('left:draft');
    right.systems.matchFlow.advanceDraft=()=>right.events.push('right:draft');
    assert.deepEqual(left.loop.tick(),{advanced:true,commandFailed:false,phase:null});
    assert.deepEqual(right.loop.tick(),{advanced:true,commandFailed:false,phase:null});
    assert.deepEqual(left.loop.tick(),{advanced:true,commandFailed:false,phase:null});
    assert.deepEqual(left.events,[...names('left',5,{vision:true,areas:true,ui:true}),...names('left',6)]);
    assert.deepEqual(right.events,names('right',5,{vision:true,areas:true,ui:true}));
    assert.equal(left.state.clock.tickN,6);
    assert.equal(right.state.clock.tickN,5);

    for(const [start,tick,options] of [[9,10,{ten:true,vision:true,ui:true}],[19,20,{ten:true,vision:true,allied:true,ui:true}],[29,30,{ten:true,vision:true,ui:true}]]){
      const item=fixture(`t${tick}`,{tick:start});
      item.systems.matchFlow.advanceDraft=()=>item.events.push(`t${tick}:draft`);
      assert.deepEqual(item.loop.tick(),{advanced:true,commandFailed:false,phase:null});
      assert.deepEqual(item.events,names(`t${tick}`,tick,options));
    }

    const hundred=fixture('hundred',{tick:99,checkpoint:true});
    hundred.systems.matchFlow.advanceDraft=()=>hundred.events.push('hundred:draft');
    assert.deepEqual(hundred.loop.tick(),{advanced:true,commandFailed:false,phase:null});
    assert.deepEqual(hundred.events,names('hundred',100,{ten:true,vision:true,allied:true,ui:true,checkpoint:true,schedule:true}));
    const oldReplay=fixture('old',{tick:99,checkpoint:true,otherVersion:true});
    oldReplay.systems.matchFlow.advanceDraft=()=>oldReplay.events.push('old:draft');
    oldReplay.loop.tick();
    assert.equal(oldReplay.events.includes('old:schedule:divergenceCard'),false);

    const stopped=fixture('stopped',{tick:7});
    stopped.runtime.configureReplay({on:true,cmds:[{t:7,k:'sat',a:[]}],i:0,speed:1,resume:false,toTick:0});
    stopped.systems.matchFlow.advanceDraft=()=>{ stopped.events.push('stopped:draft'); stopped.state.setLifecycle('paused',true); };
    assert.deepEqual(stopped.loop.tick(),{advanced:false,commandFailed:false,phase:null});
    assert.deepEqual(stopped.events,['stopped:command:sat','stopped:draft']);
    assert.equal(stopped.state.clock.tickN,7);
    assert.equal(right.state.clock.tickN,5,'stopped instance changed an interleaved peer');

    console.log('World-loop poisoned-global, ordering, cadence, stopped/draft, and instance isolation contracts PASS');
  }finally{
    for(const [name,descriptor] of prior){ if(descriptor) Object.defineProperty(globalThis,name,descriptor); else delete globalThis[name]; }
  }
})().catch(error=>{ console.error(error.stack||error); process.exitCode=1; });
