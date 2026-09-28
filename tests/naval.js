const assert=require('node:assert/strict');
const path=require('node:path');
const {pathToFileURL}=require('node:url');

(async()=>{
  const protectedGlobals=['window','document','Image','HTMLCanvasElement','AudioContext','localStorage','sessionStorage','fetch','requestAnimationFrame','setTimeout','setInterval','performance'];
  const prior=new Map(protectedGlobals.map(name=>[name,Object.getOwnPropertyDescriptor(globalThis,name)]));
  for(const name of protectedGlobals) Object.defineProperty(globalThis,name,{configurable:true,get(){ throw new Error(`naval accessed browser global ${name}`); }});
  try{
    const root=path.resolve(__dirname,'..','game','src','sim');
    const [{createAuthoritativeState},{createNavalSystem}]=await Promise.all([
      import(pathToFileURL(path.join(root,'authoritative-state.mjs')).href),
      import(pathToFileURL(path.join(root,'systems','naval.mjs')).href)
    ]);
    const W=16,H=10;
    const ships={
      scout:{label:'Scout boat',cost:10,hp:2,gun:0,dmg:0,sam:0,speed:3.2},
      warship:{label:'Destroyer',cost:20,hp:5,gun:8,dmg:1,sam:0,speed:1.4},
      cruiser:{label:'Cruiser',cost:30,hp:6,gun:8,dmg:1,sam:0,speed:1},
      battleship:{label:'Battleship',cost:40,hp:12,gun:8,dmg:2,sam:0,speed:.6}
    };
    const make=()=>{
      const settings={instant:true};
      const state=createAuthoritativeState({tileCount:W*H,settings,allowed:Object.keys(ships)});
      const players=[{id:0,name:'Blue',kind:'human',alive:true,tiles:1,troops:100,gold:100,areas:[]},{id:1,name:'Red',kind:'human',alive:true,tiles:1,troops:100,gold:100,areas:[]}];
      state.actors.players.push(...players); state.setPlayerId(0);
      const a=4*W+1,b=4*W+14; state.map.land[a]=state.map.land[b]=1; state.map.owner[a]=0; state.map.owner[b]=1;
      const events=[],selected=new Set();
      const isCoast=t=>!!state.map.land[t]&&[1,-1,W,-W,W+1,W-1,-W+1,-W-1].some(d=>t+d>=0&&t+d<W*H&&!state.map.land[t+d]);
      const system=createNavalSystem({W,H,engineState:state,settings,allowed:state.rules.allowed,random:()=>.25,rnd:(x,y)=>x+(y-x)*.25,pick:a2=>a2[0],getMe:()=>players[0],ships,definitions:{port:{label:'Port'},shore:{label:'Shore guns'}},guns:{shore:{range:4,dmg:1,cd:4,hp:3}},armor:{},heavy:{hp:4,speedMul:.75,gun:4,dmg:1,cd:5},cruise:{range:10,count:2,cd:20,speed:2},shipBuild:{scout:0},constants:{linkShipDiscount:.15,provokeTicks:400,tradeInterval:220,tradeGold:18,tradePerTile:.12,tradeSpeed:1.3,shipSpeed:1.1,shellSpeed:4,sinkBounty:.3},
        landCombat:{isCoast,gOn:()=>false,areaAt:()=>null,takeTroopsFrom:(p,o,n)=>{p.troops-=n; return n;},addTroopsAt:(p,t,n)=>{p.troops+=n;}},
        structures:{enqueue:()=>1,destroyStructure:()=>{},structCounts:()=>{}},missiles:{crater:()=>0},fog:{targetHidden:()=>false},diplomacy:{atPeace:()=>false,relation:()=>null,inConflict:()=>true,markHostile:(...args)=>events.push(['hostile',...args])},mechanics:{pausedBlock:()=>false,noteThreat:(...args)=>events.push(['threat',...args]),areaName:()=>''},ai:{botBuildDelay:()=>4000},effects:{cleanupSelection:active=>{for(const ship of selected) if(!active.includes(ship)) selected.delete(ship);},invasion:(...args)=>events.push(['invasion',...args])}});
      return {state,players,system,events,selected,a,b};
    };

    const left=make(),right=make();
    const route=left.system.waterPath(left.system.waterNeighbor(left.a),left.system.waterNeighbor(left.b));
    assert.ok(route&&route.length>1,'water path was not found');
    assert.equal(left.system.launchTransport(left.players[0],1,30,left.b,null),true);
    assert.equal(left.players[0].troops,70);
    assert.equal(right.players[0].troops,100,'transport launch leaked to another instance');
    for(let tick=1;tick<40&&!left.state.actors.attacks.length;tick++){ left.state.setClock(tick,tick*100); left.system.stepNaval(); }
    assert.equal(left.state.actors.attacks.length,1);
    assert.equal(left.state.actors.attacks[0].troops,30);
    assert.equal(right.state.actors.attacks.length,0,'landing leaked to another instance');

    const heavyCase=make(),heavyPort={type:'port',owner:0,t:heavyCase.a,building:false,level:1};heavyCase.state.actors.structures.push(heavyPort);
    assert.equal(heavyCase.system.launchTransport(heavyCase.players[0],1,10,heavyCase.b,null),true);assert.equal(heavyCase.state.actors.transports.at(-1).heavy,false);
    heavyPort.level=2;assert.equal(heavyCase.system.launchTransport(heavyCase.players[0],1,10,heavyCase.b,null),true);assert.equal(heavyCase.state.actors.transports.at(-1).heavy,true);assert.equal(heavyCase.state.actors.transports.at(-1).hp,4);
    const port={type:'port',owner:0,t:left.a,building:false,level:1}; left.state.actors.structures.push(port);
    const target=left.system.waterNeighbor(left.b);
    assert.equal(left.system.orderWarship(left.players[0],target,'scout'),true);
    const ship=left.state.actors.warships[0];
    assert.equal(ship.id,1); assert.equal(ship.owner,0); assert.equal(right.state.actors.warships.length,0,'warship leaked to another instance');
    ship.refit=1;left.state.setClock(1,100);left.system.stepNaval();assert.equal(ship.cruise,true,'refit becomes cruise capability at deadline');assert.equal(ship.refit,0);
    left.selected.add(ship); ship.hp=0; left.system.stepNaval();
    assert.equal(left.selected.size,0,'presentation selection cleanup was not injected');
    console.log('Naval browser-free pathing, transport, ordering, cleanup, and instance isolation contracts PASS');
  }finally{
    for(const [name,descriptor] of prior){ if(descriptor) Object.defineProperty(globalThis,name,descriptor); else delete globalThis[name]; }
  }
})().catch(error=>{ console.error(error.stack||error); process.exitCode=1; });
