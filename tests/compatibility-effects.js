const assert=require('node:assert/strict');
const path=require('node:path');
const {pathToFileURL}=require('node:url');

(async()=>{
  const protectedGlobals=['window','document','Image','HTMLCanvasElement','AudioContext','localStorage','sessionStorage','fetch','requestAnimationFrame','setTimeout','setInterval','performance'];
  const prior=new Map(protectedGlobals.map(name=>[name,Object.getOwnPropertyDescriptor(globalThis,name)]));
  for(const name of protectedGlobals) Object.defineProperty(globalThis,name,{configurable:true,get(){ throw new Error(`compatibility effects accessed browser global ${name}`); }});
  try{
    const root=path.resolve(__dirname,'..','game','src','sim');
    const {createCompatibilityEffectProducer}=await import(pathToFileURL(path.join(root,'compatibility-effects.mjs')).href);
    const draws=[0,.25,.5,.75,.1,.2,.3,.4,.6,.7,.8];
    const run=withSink=>{
      let index=0;
      const consumed=[];
      const events=[];
      const random=()=>{ const value=draws[index++]; consumed.push(value); return value; };
      const producer=createCompatibilityEffectProducer({random,sink:withSink?event=>events.push(event):undefined});
      producer.puff(2,3,1,'1,2,3');
      producer.wreck('ship',4,5,.5,'#abc','cruiser');
      producer.fragments(6,7,Math.PI/2,2,'#def');
      const dome={kind:'dome',x:8,y:9,r:4,age:0};
      const bomb={x:10,y:11,vx:.4,vy:0,age:0,life:8,col:'#222',bomb:true};
      producer.wreck(dome);
      producer.fragment(bomb);
      return {consumed,events,dome,bomb};
    };

    const silent=run(false),observed=run(true);
    assert.deepEqual(silent.consumed,draws,'a missing sink changed compatibility RNG draws');
    assert.deepEqual(observed.consumed,draws,'an installed sink changed compatibility RNG draws');
    assert.equal(observed.events.length,6);
    assert.deepEqual(observed.events.map(event=>event.type),['puff','wreck','fragment','fragment','wreck','fragment']);
    assert.deepEqual(observed.events[0].descriptor,{x:2.5,y:3.5,vx:-.125,vy:-.15000000000000002,r:1.75,age:0,life:48.75,col:'1,2,3'});
    assert.deepEqual(observed.events[1].descriptor,{kind:'ship',x:4,y:5,hdg:.5,col:'#abc',cls:'cruiser',age:0,spin:-.032});
    const a0=Math.PI/2+(.2-.5)*1.2,sp0=.6+.3*1.2;
    const a1=Math.PI/2+(.6-.5)*1.2,sp1=.6+.7*1.2;
    assert.deepEqual(observed.events[2].descriptor,{x:6,y:7,vx:Math.cos(a0)*sp0,vy:Math.sin(a0)*sp0,age:0,life:16,col:'#def'});
    assert.deepEqual(observed.events[3].descriptor,{x:6,y:7,vx:Math.cos(a1)*sp1,vy:Math.sin(a1)*sp1,age:0,life:20,col:'#def'});
    assert.equal(observed.events[4].descriptor,observed.dome,'non-random wreck descriptors changed identity');
    assert.equal(observed.events[5].descriptor,observed.bomb,'non-random fragment descriptors changed identity');
    assert.throws(()=>createCompatibilityEffectProducer().puff(0,0,1),/deterministic random source/);
    console.log('Compatibility effect RNG count, payload, order, sink independence, and browser-free contracts PASS');
  }finally{
    for(const [name,descriptor] of prior){ if(descriptor) Object.defineProperty(globalThis,name,descriptor); else delete globalThis[name]; }
  }
})().catch(error=>{ console.error(error.stack||error); process.exitCode=1; });
