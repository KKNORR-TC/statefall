const assert=require('node:assert/strict');
const path=require('node:path');
const {pathToFileURL}=require('node:url');

(async()=>{
  const protectedGlobals=['window','document','Image','HTMLCanvasElement','AudioContext','localStorage','sessionStorage','fetch','requestAnimationFrame','setTimeout','setInterval','performance'];
  const prior=new Map(protectedGlobals.map(name=>[name,Object.getOwnPropertyDescriptor(globalThis,name)]));
  for(const name of protectedGlobals) Object.defineProperty(globalThis,name,{configurable:true,get(){ throw new Error(`air accessed browser global ${name}`); }});
  try{
    const root=path.resolve(__dirname,'..','game','src','sim');
    const [{createAuthoritativeState},{createAirSystem}]=await Promise.all([
      import(pathToFileURL(path.join(root,'authoritative-state.mjs')).href),
      import(pathToFileURL(path.join(root,'systems','air.mjs')).href)
    ]);
    const W=40,H=24;
    const constants={hangar:4,reserve:300,
      fighter:{cost:350,build:3,speed:6,range:160,patrol:25,endurance:60,refuel:12,hp:5,heal:2,dog:30},
      bomber:{cost:450,build:4,speed:5,range:260,bombs:8,spacing:4,radius:2,rearm:3},
      carrier:{cost:500,build:4,speed:5,range:200,capacity:1500,rearm:2}};
    const make=()=>{
      const settings={instant:false};
      const state=createAuthoritativeState({tileCount:W*H,settings,allowed:[]});
      state.map.land.fill(1); state.map.owner.fill(1);
      const players=[
        {id:0,name:'Blue',kind:'human',alive:true,tiles:100,troops:3000,gold:3000,airAuto:false,areas:[]},
        {id:1,name:'Red',kind:'human',alive:true,tiles:W*H-100,troops:3000,gold:3000,airAuto:false,areas:[]}
      ];
      state.actors.players.push(...players); state.setPlayerId(0);
      const events=[];
      const system=createAirSystem({W,H,engineState:state,settings,random:()=>0,getMe:()=>players[0],constants,
        diplomacy:{atPeace:()=>false,markHostile:(...args)=>events.push(['hostile',...args]),inConflict:()=>true},
        missiles:{domeFor:()=>null,hitDome:(...args)=>events.push(['dome',...args]),crater:(...args)=>{events.push(['crater',...args]); return 0;}},
        landCombat:{gOn:()=>false,areaAt:()=>null,takeTroopsFrom:(p,area,n)=>{p.troops-=n; return n;},addTroopsAt:(p,t,n)=>{p.troops+=n;},ownTilesOf:id=>state.map.owner.reduce((out,o,t)=>{if(o===id) out.push(t); return out;},[]),maxTroops:p=>p.troops*2,density:p=>p.troops/Math.max(1,p.tiles),densityAt:p=>p.troops/Math.max(1,p.tiles)},
        structureOps:{definitions:{airfield:{cost:600}},upgrades:{airfield:{cost:600}},crowded:()=>false,placeStructure:()=>false,upgradeStructure:()=>false},
        fog:{targetHidden:()=>false},mechanics:{pausedBlock:()=>false,noteThreat:(...args)=>events.push(['threat',...args])},ai:{botBuildDelay:()=>4000,botLevel:()=>0,pick:values=>values[0]},
        effects:{incrementStat:name=>events.push(['stat',name]),flash:value=>events.push(['flash',value]),fragment:value=>events.push(['fragment',value]),wreck:(...args)=>events.push(['wreck',...args]),addShell:value=>events.push(['shell',value])}});
      return {state,players,system,events};
    };

    const gate=make(),locked={type:'airfield',owner:0,t:164,building:false,level:1,aq:[]};gate.state.actors.structures.push(locked);
    assert.equal(gate.system.hangarMax(locked),4);assert.equal(gate.system.buyAircraft(gate.players[0],locked,'carrier'),false);assert.equal(gate.players[0].gold,3000);
    locked.level=2;assert.equal(gate.system.hangarMax(locked),6);assert.equal(gate.system.buyAircraft(gate.players[0],locked,'carrier'),true);assert.equal(gate.players[0].gold,2500);
    const left=make(),right=make();
    const field={type:'airfield',owner:0,t:4*W+4,building:false,level:2,aq:[]};
    left.state.actors.structures.push(field);
    assert.equal(left.system.airfieldsOf(left.players[0])[0],field);
    assert.equal(left.system.hangarMax(field),6);
    assert.equal(left.system.buyAircraft(left.players[0],field,'fighter'),true);
    assert.equal(left.players[0].gold,2650);
    assert.equal(right.players[0].gold,3000,'aircraft purchase leaked to another instance');
    left.state.setClock(3,300); left.system.stepAir();
    const fighter=left.state.actors.aircraft[0];
    assert.equal(fighter.id,1); assert.equal(fighter.state,'hangar');
    assert.equal(left.system.launchFighter(left.players[0],6*W+10),true);
    left.system.stepAir();
    assert.notEqual(fighter.x,4.5,'fighter did not move toward patrol');

    const bomber=left.system.spawnAircraft(field,'bomber');
    left.state.map.owner[8*W+12]=1;
    assert.equal(left.system.bomb(bomber,12.5,8.5),true);
    assert.equal(left.events.some(event=>event[0]==='crater'),true,'bomb did not delegate crater damage');
    assert.equal(left.events.some(event=>event[0]==='threat'&&event[3]==='bomb'),true,'bomb did not report its threat');

    const carrier=left.system.spawnAircraft(field,'carrier');
    const drop=8*W+14;
    assert.equal(left.system.launchParadrop(left.players[0],drop,600),true);
    carrier.x=carrier.tx; carrier.y=carrier.ty; left.system.stepAir();
    assert.equal(left.state.actors.attacks.length,1);
    assert.equal(left.state.actors.attacks[0].troops,600);

    bomber.state='out'; bomber.x=20; bomber.y=12; bomber.tx=25; bomber.ty=12;
    left.state.actors.aircraft.push({id:99,owner:1,type:'fighter',home:field,state:'patrol',x:20,y:12,tx:20,ty:12,hp:5,hdg:0,until:100});
    left.system.stepAir();
    assert.equal(left.state.actors.aircraft.includes(bomber),false,'intercepted bomber was not cleaned up');
    assert.equal(left.events.some(event=>event[0]==='shell'),true,'interception shell was not routed through effects');
    assert.equal(right.state.actors.aircraft.length,0,'aircraft state leaked to another instance');
    assert.equal(right.state.actors.attacks.length,0,'paradrop state leaked to another instance');
    console.log('Air browser-free operations, adapters, cleanup, and instance isolation contracts PASS');
  }finally{
    for(const [name,descriptor] of prior){ if(descriptor) Object.defineProperty(globalThis,name,descriptor); else delete globalThis[name]; }
  }
})().catch(error=>{ console.error(error.stack||error); process.exitCode=1; });
