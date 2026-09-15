const assert=require('node:assert/strict');
const boot=require('../tools/harness.js');

const {S}=boot({seed:'SEEDEDORDER',diff:'hard',render:false,gridW:120,gridH:69});
const candidates=[
  {name:'late',type:'other',t:40,owner:3},
  {name:'sam-b',type:'sam',t:22,owner:2},
  {name:'shield-b',type:'shield',t:12,owner:2},
  {name:'shield-a',type:'shield',t:8,owner:4},
  {name:'sam-a',type:'sam',t:22,owner:1}
];
const tier=value=>value.type==='shield'?0:value.type==='sam'?1:2;
let draws=0;
const ordered=S.seededTierOrder(candidates,tier,()=>{ draws++; return 0.5; });
let cruiseDraws=0;
const cruiseOrdered=S.cruiseTargets(candidates,()=>{ cruiseDraws++; return 0.5; });

assert.equal(draws,candidates.length,'must draw exactly one seeded key per candidate');
assert.deepEqual(ordered.map(value=>value.name),['shield-a','shield-b','sam-a','sam-b','late']);
assert.deepEqual(candidates.map(value=>value.name),['late','sam-b','shield-b','shield-a','sam-a'],'must not mutate candidate order');
assert.equal(cruiseDraws,candidates.length,'production cruise selection must draw exactly once per candidate');
assert.deepEqual(cruiseOrdered.map(value=>value.name),['shield-a','shield-b'],'production cruise selection must use seeded tier ordering and cruise count');
console.log('Seeded tier ordering PASS');
