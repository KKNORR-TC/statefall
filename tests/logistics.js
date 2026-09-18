const assert=require('node:assert/strict');
const path=require('node:path');
const {pathToFileURL}=require('node:url');

(async()=>{
  const protectedGlobals=['window','document','Image','HTMLCanvasElement','AudioContext','localStorage','sessionStorage','fetch','requestAnimationFrame','setTimeout','setInterval','performance'];
  const prior=new Map(protectedGlobals.map(name=>[name,Object.getOwnPropertyDescriptor(globalThis,name)]));
  for(const name of protectedGlobals) Object.defineProperty(globalThis,name,{configurable:true,get(){ throw new Error(`logistics accessed browser global ${name}`); }});
  try{
    const root=path.resolve(__dirname,'..','game','src','sim');
    const [{createAuthoritativeState},{createLogisticsSystem}]=await Promise.all([
      import(pathToFileURL(path.join(root,'authoritative-state.mjs')).href),
      import(pathToFileURL(path.join(root,'systems','logistics.mjs')).href)
    ]);
    const W=8,H=4;
    const make=()=>{
      const settings={garrison:true};
      const state=createAuthoritativeState({tileCount:W*H,settings});
      const player={id:0,name:'Blue',kind:'human',alive:true,tiles:12,troops:120,gold:1000,sx:1,sy:1,troopcmds:1};
      state.actors.players.push(player); state.setPlayerId(0);
      for(const t of [0,1,2,8,9,10,16,17,18,6,7,14]){ state.map.land[t]=1; state.map.owner[t]=0; }
      const logs=[];
      const landCombat={density:p=>p.troops/Math.max(1,p.tiles),maxTroops:()=>500,isCoast:t=>!!state.map.land[t]&&[1,-1,W,-W].some(d=>t+d>=0&&t+d<W*H&&!state.map.land[t+d])};
      const repairNeed=st=>st.building?0:st.type==='shield'?10-st.hp:0;
      const system=createLogisticsSystem({W,H,engineState:state,settings,getMe:()=>player,truck:{max:4,speed:.4,repairTicks:80,costPip:15,reserve:150},provokeTicks:400,carrierCapacity:1500,landCombat,structures:{repairNeed,repairOne:st=>{st.hp++;}},diplomacy:{atPeace:()=>false,inConflict:()=>true},naval:{seaRisk:()=>0,reinforceArea:()=>false},air:{idleAircraft:()=>null,launchParadrop:()=>false},mechanics:{areaLabel:()=>'',structureLabel:type=>type==='shield'?'Shield generator':'Engineering command'},effects:{log:(...args)=>logs.push(args)}});
      return {state,player,system,logs};
    };

    const left=make(),right=make();
    assert.notEqual(left.system,right.system);
    left.system.rebuildAreas(); right.system.rebuildAreas();
    assert.equal(left.player.areas.length,2);
    assert.deepEqual(left.player.areas.map(a=>[a.id,a.tiles,a.troops]),right.player.areas.map(a=>[a.id,a.tiles,a.troops]));
    assert.deepEqual(left.state.garrison.areaOf,right.state.garrison.areaOf);
    const stableIds=left.player.areas.map(a=>a.id);
    left.system.rebuildAreas();
    assert.deepEqual(left.player.areas.map(a=>a.id),stableIds,'unchanged areas lost stable IDs');
    assert.equal(right.state.garrison.nextAreaId,3,'garrison ID allocation leaked between instances');

    const home=left.player.areas[0],other=left.player.areas[1];
    const beforeOther=other.troops;
    assert.equal(left.system.takeTroopsFrom(left.player,home,25),25);
    left.system.addTroopsAt(left.player,6,10);
    assert.equal(other.troops,beforeOther+10);
    assert.equal(left.player.troops,left.player.areas.reduce((sum,a)=>sum+a.troops,0));
    assert.equal(right.player.troops,120,'troop mutation leaked between instances');

    const command={type:'engcmd',owner:0,t:0,building:false},target={type:'shield',owner:0,t:18,building:false,hp:8};
    left.state.actors.structures.push(command,target); left.state.setClock(20,2000); left.system.engineering();
    assert.equal(left.state.actors.trucks.length,1);
    assert.equal(left.state.actors.trucks[0].target,target,'truck target reference changed');
    assert.equal(left.state.actors.trucks[0].home,command,'truck command reference changed');
    assert.equal(right.state.actors.trucks.length,0,'truck actor leaked between instances');
    left.state.map.owner[0]=1; left.system.stepTrucks();
    assert.equal(left.state.actors.trucks.length,0,'captured-ground truck cleanup failed');
    console.log('Logistics poisoned-global, stable garrison, troop synchronization, engineering, and instance isolation contracts PASS');
  }finally{
    for(const [name,descriptor] of prior){ if(descriptor) Object.defineProperty(globalThis,name,descriptor); else delete globalThis[name]; }
  }
})().catch(error=>{ console.error(error.stack||error); process.exitCode=1; });
