const assert=require('node:assert/strict'),math=require('../game/src/sim/strict-math.mjs');
let count=0;
function compare(name,...values){assert.ok(Object.is(math[name](...values),Math[name](...values)),name+' differs for '+values.join(','));count++;}
for(let i=0;i<100000;i++){const x=(i-50000)/137,y=(i%327-163)/41;for(const f of ['sin','cos','atan'])compare(f,x);compare('atan2',x,y);compare('hypot',x,y);}
const edges=[0,-0,NaN,Infinity,-Infinity,Number.MIN_VALUE,-Number.MIN_VALUE,Number.MAX_VALUE,-Number.MAX_VALUE,1e20,1e100,1e308,Math.PI/2,Math.PI,1e6,-1e7];
for(const x of edges){for(const f of ['sin','cos','atan'])compare(f,x);for(const y of edges){compare('atan2',x,y);compare('hypot',x,y);}}
for(let i=0;i<10000;i++){const x=(i%2?-1:1)*(1+i/997)*2**(i%2040-1020);for(const f of ['sin','cos','atan'])compare(f,x);}
compare('hypot');compare('hypot',3,4,12);compare('hypot',NaN,Infinity,5);
console.log('Portable math exact historical-runtime vectors PASS ('+count+' cases)');
