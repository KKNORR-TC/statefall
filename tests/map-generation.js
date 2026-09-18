const assert=require('node:assert/strict');
const path=require('node:path');
const {pathToFileURL}=require('node:url');

(async()=>{
  const protectedGlobals=['window','document','Image','HTMLCanvasElement','AudioContext','localStorage','sessionStorage','fetch','requestAnimationFrame','setTimeout','setInterval'];
  const prior=new Map(protectedGlobals.map(name=>[name,Object.getOwnPropertyDescriptor(globalThis,name)]));
  for(const name of protectedGlobals) Object.defineProperty(globalThis,name,{configurable:true,get(){ throw new Error(`map generation accessed browser global ${name}`); }});
  try{
    const root=path.resolve(__dirname,'..','game','src','sim');
    const [{createAuthoritativeState},{createDeterministicRuntime},{createMapGeneration}]=await Promise.all([
      import(pathToFileURL(path.join(root,'authoritative-state.mjs')).href),
      import(pathToFileURL(path.join(root,'deterministic-runtime.mjs')).href),
      import(pathToFileURL(path.join(root,'map-generation.mjs')).href)
    ]);
    const W=720,H=414;
    const make=()=>{
      const state=createAuthoritativeState({tileCount:W*H,settings:{map:'land'}});
      const runtime=createDeterministicRuntime(); runtime.seed('MAP-MODULE');
      const random=()=>runtime.random(),rnd=(a,b)=>a+random()*(b-a),pick=values=>values[Math.floor(random()*values.length)];
      const inb=(x,y)=>x>=0&&y>=0&&x<W&&y<H,idx=(x,y)=>y*W+x;
      const isCoast=t=>{ const x=t%W,y=(t-x)/W; return state.map.land[t]&&[[1,0],[-1,0],[0,1],[0,-1]].some(([dx,dy])=>inb(x+dx,y+dy)&&!state.map.land[idx(x+dx,y+dy)]); };
      return {state,runtime,generator:createMapGeneration({W,H,engineState:state,settings:state.rules.settings,setup:state.setup,MAPS:{},random,rnd,pick,landCombat:{isCoast}})};
    };
    const left=make(),right=make();
    assert.notEqual(left.generator,right.generator);
    left.generator.genMap();
    right.generator.genMap();
    assert.equal(left.runtime.rngDraws,right.runtime.rngDraws);
    assert.equal(left.state.map.landCount,right.state.map.landCount);
    assert.deepEqual(left.state.map.land,right.state.map.land);
    assert.deepEqual(left.state.map.river,right.state.map.river);
    assert.deepEqual(left.state.map.region,right.state.map.region);
    assert.deepEqual(left.state.map.rough,right.state.map.rough);
    assert.deepEqual(left.state.map.regions,right.state.map.regions);
    assert.equal(left.state.map.land instanceof Uint8Array,true);
    assert.equal(left.state.map.region instanceof Int16Array,true);
    assert.equal(left.state.map.rough instanceof Float32Array,true);
    const rightFirst=right.state.map.land[0];
    left.state.map.land[0]=rightFirst?0:1;
    assert.equal(right.state.map.land[0],rightFirst);
    assert.equal(typeof left.generator.regionName(true),'string');
    console.log('Map generation isolation and browser-free contracts PASS');
  }finally{
    for(const [name,descriptor] of prior){
      if(descriptor) Object.defineProperty(globalThis,name,descriptor);
      else delete globalThis[name];
    }
  }
})().catch(error=>{ console.error(error.stack||error); process.exitCode=1; });
