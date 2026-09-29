const assert=require('node:assert/strict');
(async()=>{const {siloFlightPosition,SILO_LIFTOFF,SILO_JOIN}=await import('../game/src/rendering/silo-flight-path.mjs');const {missilePosition}=await import('../game/src/rendering/missile-layer-model.mjs');let checks=0;
for(const t of [5010,5090,1050,9050,1010,9090])for(const zoom of [1,2,6,20]){const m={from:5050,t,flight:55},scale=Math.max(6,zoom*2.4)/62/zoom,before=JSON.stringify(m),p=a=>siloFlightPosition(m,a,100,scale),eps=1e-5;
assert.deepEqual(p(SILO_LIFTOFF),[50.5,50.5-65*scale]);assert(Math.hypot(...p(SILO_LIFTOFF+eps).map((v,i)=>v-p(SILO_LIFTOFF)[i]))<.001);
const left=p(SILO_JOIN-eps),mid=p(SILO_JOIN),right=p(SILO_JOIN+eps);for(let i=0;i<2;i++){assert(Math.abs((mid[i]-left[i])/eps-(right[i]-mid[i])/eps)<.002,'join velocity');}assert.deepEqual(mid,missilePosition(m,SILO_JOIN,100));assert.deepEqual(p(55),missilePosition(m,55,100));assert.equal(JSON.stringify(m),before);checks++;}
console.log('Silo launch/flight position, tangent, target and purity PASS: '+checks+' cases');})().catch(e=>{console.error(e);process.exitCode=1;});
