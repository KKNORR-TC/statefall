const assert=require('node:assert/strict');
(async()=>{
const {copyRollbackGraph}=await import('../game/src/sim/rollback-copy.mjs'),{encodeGraph,decodeGraph}=await import('../game/src/sim/graph-codec.mjs');
const actor={id:1,values:new Float64Array([NaN,Infinity,-Infinity,-0,1.25])},root={actor,alias:actor,list:[actor,undefined],map:new Map(),set:new Set([actor]),dict:Object.create(null),land:new Uint8Array(300000)};
root.self=root;root.map.set(actor,root);root.dict.actor=actor;root.land[14]=9;
const actual=copyRollbackGraph(root),expected=decodeGraph(encodeGraph(root));
assert.deepEqual(encodeGraph(actual),encodeGraph(expected));
assert.equal(actual.actor,actual.alias);assert.equal(actual.self,actual);assert.equal(actual.map.get(actual.actor),actual);assert.equal(Object.getPrototypeOf(actual.dict),null);
actual.land[14]=2;actual.actor.values[4]=9;assert.equal(root.land[14],9);assert.equal(actor.values[4],1.25);
console.log('Rollback copy parity, aliases, cycles, numeric fidelity and isolation PASS');
})().catch(error=>{console.error(error);process.exitCode=1;});
