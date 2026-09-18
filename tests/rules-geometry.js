const assert=require('node:assert/strict');
const path=require('node:path');
const {pathToFileURL}=require('node:url');

(async()=>{
  const protectedGlobals=['window','document','Image','HTMLCanvasElement','AudioContext','localStorage','sessionStorage','fetch','requestAnimationFrame','setTimeout','setInterval','performance'];
  const prior=new Map(protectedGlobals.map(name=>[name,Object.getOwnPropertyDescriptor(globalThis,name)]));
  for(const name of protectedGlobals) Object.defineProperty(globalThis,name,{configurable:true,get(){ throw new Error(`rules or geometry accessed browser global ${name}`); }});
  try{
    const root=path.resolve(__dirname,'..','game','src','sim');
    const [rules,geometry,ai]=await Promise.all([
      import(pathToFileURL(path.join(root,'rules.mjs')).href),
      import(pathToFileURL(path.join(root,'geometry.mjs')).href),
      import(pathToFileURL(path.join(root,'systems','ai.mjs')).href)
    ]);
    assert.equal(rules.DIFFS,ai.DIFFICULTY_PROFILES);
    assert.equal(rules.DIFFS,rules.DIFFICULTY_PROFILES);
    assert.deepEqual(Object.keys(rules.STRUCT),['city','factory','port','sam','silo','fort','command','shield','battery','shore','bertha','airfield','flightops','subbase','engcmd','troopcmd','radar','lradar','jammer','satellite']);
    assert.deepEqual(Object.keys(rules.SHIPS),['sub','hunter','rship','privateer','scout','warship','cruiser','battleship']);
    assert.ok(Object.isFrozen(rules.STRUCT)&&Object.isFrozen(rules.STRUCT.city)&&Object.isFrozen(rules.AIR.fighter));

    const W=8,H=5,owner=new Int16Array(W*H).fill(-1),player={id:3,sx:12,sy:14};
    owner[0]=3; owner[7]=3; owner[14]=3; owner[21]=2; owner[28]=3;
    const expected=[4.75,1.5];
    assert.deepEqual(geometry.calculateCentroid(W,H,owner,player),expected);
    assert.deepEqual(geometry.calculateCentroid(W,H,owner,player),expected);
    owner.fill(-1);
    assert.deepEqual(geometry.calculateCentroid(W,H,owner,player),[12,14]);
    console.log('Immutable rules and deterministic geometry contracts PASS');
  }finally{
    for(const [name,descriptor] of prior){
      if(descriptor) Object.defineProperty(globalThis,name,descriptor);
      else delete globalThis[name];
    }
  }
})().catch(error=>{ console.error(error.stack||error); process.exitCode=1; });
