const assert=require('node:assert/strict');
const {serializeCanonicalV1}=require('../game/src/sim/deterministic-runtime.mjs');
const {createCanonicalTypedCache}=require('../game/src/sim/canonical-typed-cache.mjs');
const cached=createCanonicalTypedCache();
let checked=0;
function check(root,options={}){
 const reference=serializeCanonicalV1(root,options);
 assert.ok(serializeCanonicalV1(root,{...options,...cached})===reference,'canonical bytes differ at case '+checked);
 checked++;
}
for(const Type of [Uint8Array,Int8Array,Uint8ClampedArray,Uint16Array,Int16Array,Uint32Array,Int32Array,Float32Array,Float64Array]){
 for(const length of [0,255,256,257,1025]){
  const data=new Type(length);
  for(let i=0;i<length;i++)data[i]=i%2?-i:i*.25;
  const root={data,alias:data,set:new Set([undefined,NaN,-0,Infinity,'x']),map:new Map([[1,data],['a',undefined]])};root.self=root;
  check(root);check(root);
  for(const index of [0,Math.floor(length/2),length-1]){data[index]=123;check(root);}
  if(Type===Float32Array||Type===Float64Array)for(const value of [NaN,Infinity,-Infinity,-0]){data[0]=value;check(root);}
 }
}
const backing=new ArrayBuffer(4099);
for(const offset of [1,2,3]){
 const data=new Uint8Array(backing,offset,1025);check(data);data[1024]++;check(data);
}
const view=new Uint16Array(backing,2,1025);check(view);view[1024]++;check(view);
check({data:new DataView(backing),holes:new Array(5),unicode:'日本語\ud800',value:undefined,nan:NaN,negative:-0,fn:()=>0});
const a={x:1},b={x:2};check({a,b},{canonicalAlias:v=>v===b?a:null,derivedProperties:v=>v===a?{extra:new Int32Array(300)}:null});
for(const Type of [BigInt64Array,BigUint64Array])assert.throws(()=>serializeCanonicalV1(new Type(300),cached),TypeError);
const boot=require('../tools/harness'),game=boot({map:'world',seed:'CACHE01',fog:true,garrison:true});
for(let i=0;i<4;i++){game.tick(5);check(game.engine.compatibility.stateOracle.authoritativeState());}
game.engine.reset();game.S.restart();check(game.engine.compatibility.stateOracle.authoritativeState());
console.log('Canonical typed cache exact-byte, mutation, alias, unaligned-view and restart checks PASS ('+checked+' cases)');
