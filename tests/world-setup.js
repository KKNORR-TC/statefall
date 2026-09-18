const assert=require('node:assert/strict');
const path=require('node:path');
const {pathToFileURL}=require('node:url');

(async()=>{
  const protectedGlobals=['window','document','Image','HTMLCanvasElement','AudioContext','localStorage','sessionStorage','fetch','requestAnimationFrame','setTimeout','setInterval','performance'];
  const prior=new Map(protectedGlobals.map(name=>[name,Object.getOwnPropertyDescriptor(globalThis,name)]));
  for(const name of protectedGlobals) Object.defineProperty(globalThis,name,{configurable:true,get(){ throw new Error(`world setup accessed browser global ${name}`); }});
  try{
    const root=path.resolve(__dirname,'..','game','src','sim');
    const [{createAuthoritativeState},{createDeterministicRuntime},{createWorldSetup}]=await Promise.all([
      import(pathToFileURL(path.join(root,'authoritative-state.mjs')).href),
      import(pathToFileURL(path.join(root,'deterministic-runtime.mjs')).href),
      import(pathToFileURL(path.join(root,'world-setup.mjs')).href)
    ]);
    const W=64,H=64;
    const make=()=>{
      const settings={troops:175,gold:225,bots:true,teams:2,noCap:false,map:'land',quick:false,fog:false,instant:false,risky:false,endgame:false,billionaire:false,garrison:false,pauseBuild:false};
      const state=createAuthoritativeState({tileCount:W*H,settings});
      const runtime=createDeterministicRuntime(); runtime.seed('WORLD-SETUP-MODULE');
      const random=()=>runtime.random(),rnd=(a,b)=>a+random()*(b-a),pick=values=>values[Math.floor(random()*values.length)];
      const mapGeneration={
        genMap(){ state.resetMap(); state.map.land.fill(1); state.map.region.fill(0); state.map.landCount=W*H; state.map.regions.push({id:0,size:W*H,cx:W/2,cy:H/2,cont:true,name:'Testland'}); },
        regionName(){ return 'Neutralia'; }
      };
      const setOwner=(t,o)=>{ const prev=state.map.owner[t]; if(prev===o) return; if(prev>=0){ state.actors.players[prev].tiles--; state.map.regCount[state.map.region[t]*state.map.NP+prev]--; } if(o>=0){ state.actors.players[o].tiles++; state.map.regCount[state.map.region[t]*state.map.NP+o]++; state.map.unclaimed.delete(t); } else state.map.unclaimed.add(t); state.map.owner[t]=o; };
      const selected={name:'Custom Republic',layers:[['rect','#123456',0,0,1,1]],idx:-1,custom:true,userId:7};
      state.setChosenFlag(selected);
      let completed=0;
      const countries=[['France',['v','#0055a4','#ffffff','#ef4135']]];
      const subsystem=createWorldSetup({W,H,engineState:state,settings,mapGeneration,random,rnd,pick,countries,countryAliases:{},colors:['#1','#2'],botNames:['Bot'],bots:1,tilesPerNeutral:10000,regionMin:120,quickTiles:2200,
        landCombat:{setOwner,claimBlob(p,cx,cy,r){ for(let y=cy-r;y<=cy+r;y++)for(let x=cx-r;x<=cx+r;x++) if(x>=0&&y>=0&&x<W&&y<H&&state.map.land[y*W+x]&&(state.map.owner[y*W+x]<0||state.actors.players[state.map.owner[y*W+x]].kind==='neutral')&&(x-cx)**2+(y-cy)**2<=r*r) setOwner(y*W+x,p.id); }},structuresSystem:{captureStructure(){}},logistics:{rebuildAreas(){}},startDraft(){},borderOwners(){ return {r:{},unclaimed:[]}; },onSetupComplete(){ completed++; }});
      return {state,runtime,selected,subsystem,get completed(){ return completed; }};
    };
    const left=make(),right=make();
    assert.notEqual(left.subsystem,right.subsystem);
    left.subsystem.setup();
    right.subsystem.setup();
    assert.equal(left.completed,1);
    assert.equal(left.state.actors.players[0].id,0);
    assert.equal(left.state.actors.players[1].id,1);
    assert.notEqual(left.state.actors.players[0].flag,left.selected);
    assert.deepEqual(left.state.actors.players[0].flag,left.selected);
    assert.equal(left.state.actors.players[0].name,left.selected.name);
    assert.equal(left.state.actors.players[0].troops,175);
    assert.equal(left.state.actors.players[1].gold,225);
    assert.equal(left.state.actors.players[0].team,0);
    assert.equal(left.state.actors.players[1].team,1);
    assert.equal(left.runtime.rngDraws,right.runtime.rngDraws);
    assert.deepEqual(left.state.map.owner,right.state.map.owner);
    assert.deepEqual(left.state.actors.players,right.state.actors.players);
    const flag=left.subsystem.countryByIdx(0);
    assert.deepEqual(flag,{name:'France',layers:[['v','#0055a4','#ffffff','#ef4135']],idx:0});
    flag.layers.push(['rect','#000000',0,0,1,1]);
    assert.equal(left.subsystem.countryByIdx(0).layers.length,1);
    console.log('World setup isolation and browser-free contracts PASS');
  }finally{
    for(const [name,descriptor] of prior){
      if(descriptor) Object.defineProperty(globalThis,name,descriptor);
      else delete globalThis[name];
    }
  }
})().catch(error=>{ console.error(error.stack||error); process.exitCode=1; });
