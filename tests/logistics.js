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
    const make=(ownerReads=null)=>{
      const settings={garrison:true};
      const state=createAuthoritativeState({tileCount:W*H,settings});
      const player={id:0,name:'Blue',kind:'human',alive:true,tiles:12,troops:120,gold:1000,sx:1,sy:1,troopcmds:1};
      state.actors.players.push(player); state.setPlayerId(0);
      for(const t of [0,1,2,8,9,10,16,17,18,6,7,14]){ state.map.land[t]=1; state.map.owner[t]=0; }
      const logs=[];
      const landCombat={density:p=>p.troops/Math.max(1,p.tiles),maxTroops:()=>500,isCoast:t=>!!state.map.land[t]&&[1,-1,W,-W].some(d=>t+d>=0&&t+d<W*H&&!state.map.land[t+d])};
      const repairNeed=st=>st.building?0:st.type==='shield'?10-st.hp:0;
      const systemState=ownerReads?{...state,map:{...state.map,owner:new Proxy(state.map.owner,{get(target,key){if(typeof key==='string'&&/^\d+$/.test(key))ownerReads.count++;return Reflect.get(target,key,target);}})}}:state;
      const system=createLogisticsSystem({W,H,engineState:systemState,settings,getMe:()=>player,truck:{max:4,speed:.4,repairTicks:80,costPip:15,reserve:150},provokeTicks:400,carrierCapacity:1500,landCombat,structures:{repairNeed,repairOne:st=>{st.hp++;}},diplomacy:{atPeace:()=>false,inConflict:()=>true},naval:{seaRisk:()=>0,reinforceArea:()=>false},air:{idleAircraft:()=>null,launchParadrop:()=>false},mechanics:{areaLabel:()=>'',structureLabel:type=>type==='shield'?'Shield generator':'Engineering command'},effects:{log:(...args)=>logs.push(args)}});
      return {state,player,system,logs};
    };

    const ownerReads={count:0},seedScan=make(ownerReads);
    for(let id=1;id<=20;id++)seedScan.state.actors.players.push({id,kind:'bot',alive:true,tiles:0,troops:0,areas:[]});
    seedScan.system.rebuildAreas();
    assert.ok(ownerReads.count<200,'garrison seed discovery rescanned the full map for every player');

    // Thousands of fragmented areas must be indexed, and authoritative replacements
    // must invalidate the derived lookup without retaining stale area identities.
    const indexed=make(); let idReads=0;
    indexed.player.areas=Array.from({length:5000},(_,i)=>({get id(){idReads++;return i+1;},owner:0,tiles:1,troops:i+.25}));
    indexed.state.garrison.areaOf=new Int32Array(W*H).fill(5000);
    const tail=indexed.player.areas.at(-1);
    for(let i=0;i<50;i++) assert.equal(indexed.system.areaById(5000),tail);
    assert.ok(idReads<5200,'repeated garrison lookup scanned every area');
    indexed.player.areas=[{id:5000,owner:0,tiles:1,troops:42}];
    assert.equal(indexed.system.areaById(5000),indexed.player.areas[0]);
    indexed.player.areas[0]={id:5000,owner:0,tiles:1,troops:43};
    assert.equal(indexed.system.areaById(5000).troops,43);
    indexed.state.garrison.areaOf=new Int32Array(W*H).fill(6000);
    indexed.player.areas=[{id:6000,owner:0,tiles:1,troops:44}];
    assert.equal(indexed.system.areaById(5000),null);
    assert.equal(indexed.system.areaAt(0).troops,44);
    indexed.state.actors.players[0]={...indexed.player,areas:[{id:6000,owner:0,tiles:1,troops:45}]};
    assert.equal(indexed.system.areaAt(0).troops,45);
    indexed.state.resetActors(); indexed.state.resetGarrison();
    assert.equal(indexed.system.areaById(6000),null);

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
    for(const reason of ['repaired','no-gold']){
      const test=make(),base={type:'engcmd',owner:0,t:0,building:false},site={type:'shield',owner:0,t:18,building:false,hp:9};
      test.state.actors.structures.push(base,site);test.state.setClock(20,2000);test.system.engineering();
      const repairTruck=test.state.actors.trucks[0];assert.ok(repairTruck);
      for(let tick=21;tick<45;tick++){test.state.setClock(tick,tick*100);test.system.stepTrucks();}
      assert.equal(repairTruck.state,'work');
      if(reason==='repaired')site.hp=10;else test.player.gold=0;
      test.state.setClock(200,20000);test.system.stepTrucks();
      assert.equal(repairTruck.state,'home',reason+' truck must return instead of occupying a repair slot forever');
      for(let tick=201;tick<230;tick++){test.state.setClock(tick,tick*100);test.system.stepTrucks();}
      assert.equal(test.state.actors.trucks.length,0,reason+' truck must finish its return route');
    }
    console.log('Logistics poisoned-global, stable garrison, troop synchronization, engineering, and instance isolation contracts PASS');
  }finally{
    for(const [name,descriptor] of prior){ if(descriptor) Object.defineProperty(globalThis,name,descriptor); else delete globalThis[name]; }
  }
})().catch(error=>{ console.error(error.stack||error); process.exitCode=1; });
