const assert=require('node:assert/strict');
const path=require('node:path');
const {pathToFileURL}=require('node:url');

(async()=>{
  const protectedGlobals=['window','document','Image','HTMLCanvasElement','AudioContext','localStorage','sessionStorage','fetch','requestAnimationFrame','setTimeout','setInterval','performance'];
  const prior=new Map(protectedGlobals.map(name=>[name,Object.getOwnPropertyDescriptor(globalThis,name)]));
  for(const name of protectedGlobals) Object.defineProperty(globalThis,name,{configurable:true,get(){ throw new Error(`missiles accessed browser global ${name}`); }});
  try{
    const root=path.resolve(__dirname,'..','game','src','sim');
    const [{createAuthoritativeState},{createMissilesSystem}]=await Promise.all([
      import(pathToFileURL(path.join(root,'authoritative-state.mjs')).href),
      import(pathToFileURL(path.join(root,'systems','missiles.mjs')).href)
    ]);
    const W=30,H=20,target=10*W+20;
    const make=()=>{
      const settings={fog:false,garrison:false};
      const state=createAuthoritativeState({tileCount:W*H,settings,allowed:['missile']});
      state.map.land.fill(1); state.map.owner.fill(1);
      const players=[
        {id:0,name:'Launchers',kind:'human',alive:true,tiles:0,troops:100,gold:1000,silos:1},
        {id:1,name:'Defenders',kind:'human',alive:true,tiles:W*H,troops:600,gold:1000,silos:0}
      ];
      state.actors.players.push(...players); state.setPlayerId(0);
      const events=[];
      const setOwner=(t,o)=>{ const old=state.map.owner[t]; if(old===o) return; if(old>=0) players[old].tiles--; if(o>=0) players[o].tiles++; state.map.owner[t]=o; };
      const destroyStructure=t=>{ const i=state.actors.structures.findIndex(st=>st.t===t); if(i>=0) state.actors.structures.splice(i,1); state.map.struct[t]=0; };
      const landCombat={setOwner,gOn:()=>false,areaAt:()=>null,density:p=>p.troops/Math.max(1,p.tiles),densityAt:p=>p.troops/Math.max(1,p.tiles),loseTroopsAt:(p,t,n)=>{p.troops=Math.max(0,p.troops-n);}};
      const system=createMissilesSystem({W,H,engineState:state,settings,allowed:state.rules.allowed,random:()=>0,getMe:()=>players[0],definitions:{},ships:{},shield:{r:12,hp:10,hit:2,repairTicks:60},levelShield:{r:8,hp:6},cruise:{radius:3,samMul:0.6},
        constants:{nukeCost:280,nukeRadius:4,samRange:40,samHit:0.96,samReact:6,interceptorSpeed:9,samCooldown:25,siloCooldown:200,commandDiscount:0.15,commandDiscountMax:0.45,commandReserve:150,suppressTicks:300,suppressRing:3,barrageKillFlat:20,barrageKillPct:0.008,barrageKillCap:150},
        structures:{commandCover:()=>0,coveringSam:()=>null,destroyStructure,structCounts:()=>{}},landCombat,
        diplomacy:{atPeace:()=>false,relation:()=>null,inConflict:()=>false,markHostile:(a,b)=>events.push(['hostile',a,b])},visibility:{at:()=>true,hidden:()=>false},mechanics:{pausedBlock:()=>false,noteThreat:(...args)=>events.push(['threat',...args]),seizeTreasury:()=>{}},
        effects:{sound:(...args)=>events.push(['sound',...args]),flash:value=>events.push(['flash',value]),incrementStat:name=>events.push(['stat',name])}});
      return {state,players,system,events};
    };

    const left=make(),right=make();
    const silo={type:'silo',owner:0,t:2*W+2,building:false}; left.state.actors.structures.push(silo);
    assert.equal(left.system.launchMissile(left.players[0],target),true);
    assert.equal(left.players[0].gold,720); assert.equal(silo.cool,200);
    assert.equal(left.state.actors.missiles.length,1);
    assert.equal(right.state.actors.missiles.length,0,'launch leaked to another instance');
    assert.equal(right.players[0].gold,1000,'missile cost leaked to another instance');

    const missile=left.state.actors.missiles[0]; missile.age=6;
    left.state.actors.structures.push({type:'sam',owner:1,t:target,building:false,cool:0});
    for(let i=0;i<20&&left.state.actors.missiles.length;i++) left.system.stepInterceptors();
    assert.equal(left.state.actors.missiles.length,0,'interceptor did not resolve the missile');
    assert.equal(right.state.actors.interceptors.length,0,'interceptor leaked to another instance');

    const impact=make(),control=make();
    impact.state.actors.missiles.push({owner:0,t:target,from:2*W+2,age:54,flight:55});
    const before=impact.players[1].troops;
    impact.system.stepMissiles();
    assert.equal(impact.state.map.owner[target],-1);
    assert.ok(impact.players[1].troops<before,'blast did not damage defending troops');
    assert.equal(control.state.map.owner[target],1,'blast ownership leaked to another instance');
    assert.equal(control.players[1].troops,600,'blast damage leaked to another instance');
    assert.equal(impact.events.some(event=>event[0]==='threat'&&event[3]==='missile'),true);
    const upgraded=make(),building={type:'port',owner:1,t:target,level:2,lshield:4};
    upgraded.state.actors.structures.push(building);
    upgraded.state.map.struct[target]=1;
    upgraded.system.crater(target%W,Math.floor(target/W),1,0);
    assert.equal(building.level,1,'bombardment should remove one structure level');
    assert.equal(upgraded.state.map.owner[target],building.owner,'a surviving upgraded structure must retain its ground');
    upgraded.system.crater(target%W,Math.floor(target/W),1,0);
    assert.equal(upgraded.state.actors.structures.includes(building),false);
    assert.equal(upgraded.state.map.owner[target],-1,'a destroyed structure may lose its ground');
    console.log('Missiles browser-free launch, interception, blast damage, and instance isolation contracts PASS');
  }finally{
    for(const [name,descriptor] of prior){ if(descriptor) Object.defineProperty(globalThis,name,descriptor); else delete globalThis[name]; }
  }
})().catch(error=>{ console.error(error.stack||error); process.exitCode=1; });
