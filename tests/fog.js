const assert=require('node:assert/strict');
const path=require('node:path');
const {pathToFileURL}=require('node:url');

(async()=>{
  const protectedGlobals=['window','document','Image','HTMLCanvasElement','AudioContext','localStorage','sessionStorage','fetch','requestAnimationFrame','setTimeout','setInterval','performance'];
  const prior=new Map(protectedGlobals.map(name=>[name,Object.getOwnPropertyDescriptor(globalThis,name)]));
  for(const name of protectedGlobals) Object.defineProperty(globalThis,name,{configurable:true,get(){ throw new Error(`fog accessed browser global ${name}`); }});
  try{
    const root=path.resolve(__dirname,'..','game','src','sim');
    const [{createAuthoritativeState},{createFogSystem}]=await Promise.all([
      import(pathToFileURL(path.join(root,'authoritative-state.mjs')).href),
      import(pathToFileURL(path.join(root,'systems','fog.mjs')).href)
    ]);
    const W=40,H=24,constants={base:2,radar:5,lradar:9,rship:6,jam:3,plane:{r:4,dur:10,cd:20,cost:40,speed:6,grace:2,hit:1,maxShots:3},sat:{cost:400,dur:8,cd:12}};
    const make=()=>{
      const settings={fog:true},state=createAuthoritativeState({tileCount:W*H,settings});
      const players=[{id:0,name:'Left',alive:true,gold:1000,rel:{}},{id:1,name:'Right',alive:true,gold:1000,rel:{}}];
      state.actors.players.push(...players); state.setPlayerId(0); state.map.owner.fill(-1);
      for(let y=10;y<=12;y++) for(let x=4;x<=6;x++) state.map.owner[y*W+x]=0;
      const events=[];
      const system=createFogSystem({W,H,engineState:state,settings,random:()=>0,getMe:()=>players[0],constants,
        structures:{airfieldsOf:p=>state.actors.structures.filter(st=>st.type==='airfield'&&!st.building&&st.owner===p.id),satelliteSiteFor:p=>state.actors.structures.find(st=>st.type==='satellite'&&!st.building&&st.owner===p.id)},
        diplomacy:{relation:(a,b)=>a.rel[b.id]||null,atPeace:()=>false},fighters:{enemyPatrolAt:()=>[],patrolRadius:3,shipGunRange:()=>2},borders:{owners:()=>({r:{1:3}})},mechanics:{pausedBlock:()=>false},effects:{fail:value=>events.push(['fail',value]),log:value=>events.push(['log',value]),sound:value=>events.push(['sound',value]),flash:value=>events.push(['flash',value])}});
      return {state,players,system,events};
    };

    const left=make(),right=make();
    left.state.actors.structures.push({type:'radar',owner:0,t:11*W+15,building:false},{type:'jammer',owner:1,t:11*W+17,building:false});
    left.system.computeVision();
    assert.equal(left.state.fog.vis instanceof Uint8Array,true);
    assert.equal(left.state.fog.radarLayer instanceof Uint8Array,true);
    assert.equal(left.system.visAt(5,11),true,'owned land was not visible');
    assert.equal(left.system.visAt(12,11),true,'unjammed radar edge was not stamped');
    assert.equal(left.system.visAt(17,11),false,'jammer did not blank radar');
    assert.equal(left.system.hidden(11*W+17),true); assert.equal(left.system.targetHidden(left.players[0],11*W+17),true);
    assert.equal(left.system.targetHidden(left.players[1],11*W+17),false,'AI targeting incorrectly used local-player fog');
    assert.equal(right.state.fog.vis,null,'visibility buffer leaked to another instance');

    // Moving friendly actors reveal direct sight, including newly launched path-only transports.
    for(const [collection,actor] of [
      ['transports',{owner:0,path:[10*W+28],pos:0}],
      ['traders',{owner:0,x:28.5,y:10.5}],
      ['trucks',{owner:0,x:28.5,y:10.5}],
      ['aircraft',{owner:0,x:28.5,y:10.5,type:'bomber',state:'out'}],
      ['planes',{owner:0,x:28.5,y:10.5,phase:'out'}],
      ['warships',{owner:0,x:28.5,y:10.5,cls:'rship'}]
    ]){
      const moving=make();moving.state.actors[collection].push(actor);
      moving.state.actors.structures.push({type:'jammer',owner:1,t:10*W+28,building:false});
      moving.system.computeVision();assert.equal(moving.system.visAt(28,10),true,collection+' must reveal its position even under jamming');
      assert.equal(moving.system.visAt(29,10),true,collection+' must reveal nearby terrain');
      actor.owner=1;moving.system.computeVision();assert.equal(moving.system.visAt(28,10),false,collection+' enemy must not grant sight');
      moving.players[0].rel[1]={type:'ally'};moving.system.computeVision();assert.equal(moving.system.visAt(28,10),true,collection+' allied vision is shared');
      moving.state.actors[collection].length=0;moving.system.computeVision();assert.equal(moving.system.visAt(28,10),false,'vacated sight is not retained by gameplay');
    }
    const airfield={type:'airfield',owner:0,t:11*W+5,building:false},site={type:'satellite',owner:0,t:11*W+6,building:false};
    left.state.actors.structures.push(airfield,site);
    assert.equal(left.system.callPlane(left.players[0],11*W+20),true);
    assert.equal(left.state.fog.planeCool,20); assert.equal(left.players[0].gold,960); assert.equal(left.state.actors.planes.length,1);
    assert.equal(left.system.callPlane(left.players[0],11*W+20),false,'plane cooldown was ignored');
    assert.equal(right.state.fog.planeCool,0); assert.equal(right.state.actors.planes.length,0,'spy actor leaked to another instance');
    left.system.stepPlanes(); left.system.stepPlanes(); left.system.stepPlanes();
    assert.equal(left.state.actors.planes[0].phase,'orbit');

    const loss=make(); loss.state.actors.structures.push({type:'sam',owner:1,t:10*W+20,building:false});
    loss.state.actors.planes.push({owner:0,x:20.5,y:10.5,hx:5.5,hy:11.5,tx:20.5,ty:10.5,phase:'orbit',ang:0,onStation:0,until:100,hdg:0});
    loss.state.setClock(30,3000); loss.system.stepPlanes();
    assert.equal(loss.state.actors.planes.length,0,'shot-down spy plane was retained');
    assert.equal(loss.events.some(event=>event[0]==='flash'),true,'spy-plane loss effect was not adapted');

    assert.equal(left.system.launchSatellite(),undefined);
    assert.equal(left.state.fog.satUntil,8); assert.equal(left.state.fog.satCool,12); assert.equal(left.players[0].gold,560);
    left.system.launchSatellite(); assert.equal(left.players[0].gold,560,'satellite cooldown charged twice');
    left.system.computeVision(); assert.equal(left.state.fog.vis.every(Boolean),true,'active satellite did not reveal the map');
    left.system.updateKnownBorders(); assert.deepEqual([...left.state.fog.myBorders],[1]); assert.deepEqual([...right.state.fog.myBorders],[]);
    console.log('Fog browser-free visibility, cooldown, spy actor, and instance isolation contracts PASS');
  }finally{
    for(const [name,descriptor] of prior){ if(descriptor) Object.defineProperty(globalThis,name,descriptor); else delete globalThis[name]; }
  }
})().catch(error=>{ console.error(error.stack||error); process.exitCode=1; });
