const assert=require('node:assert/strict'),boot=require('../tools/harness'),{decodeGraph,encodeGraph}=require('../game/src/sim/graph-codec.mjs');
const options={seed:'ORIGIN01',map:'land',diff:'normal',garrison:true,gridW:48,gridH:32};
const source=boot(options),state=source.engine.compatibility.state,me=source.S.me;
const retired=state.garrison.nextAreaId++;
const target=source.S.players.find(p=>p.id!==me.id);
state.actors.attacks.push({owner:me.id,target:target.id,troops:12,front:new Set(),naval:false,age:0,origin:retired,startTiles:target.tiles,dead:true});
const checkpoint=JSON.parse(JSON.stringify(source.engine.checkpoint())),before=source.engine.serializeCanonical();
const resumed=boot(options);
resumed.engine.restoreCheckpoint(checkpoint);
assert.equal(resumed.engine.serializeCanonical(),before,'retired origin changed checkpoint state');
for(let i=0;i<30;i++){source.tick();resumed.tick();assert.equal(resumed.engine.serializeCanonical(),source.engine.serializeCanonical(),'retired-origin continuation diverged');}
const unchanged=resumed.engine.serializeCanonical();
for(const origin of [-1,0,1.5,'0',state.garrison.nextAreaId,Number.MAX_SAFE_INTEGER]){
 const poisoned=decodeGraph(checkpoint.payload);poisoned.state.actors.attacks[0].origin=origin;
 assert.throws(()=>resumed.engine.restoreCheckpoint({version:checkpoint.version,payload:encodeGraph(poisoned)}),/attack references|attacks actor has invalid origin/);
 assert.equal(resumed.engine.serializeCanonical(),unchanged,'invalid origin partially changed authority');
}
console.log('Retired attack-origin checkpoint restore, continuation and rejection regressions PASS');

const transport=decodeGraph(checkpoint.payload);
transport.state.actors.transports.push({owner:me.id,target:target.id,troops:12,seed:0,path:[],pos:0,hdg:0,wake:[],origin:retired,heavy:false,hp:1});
const transportCheckpoint={version:checkpoint.version,payload:encodeGraph(transport)};
resumed.engine.restoreCheckpoint(transportCheckpoint);
const transportBefore=resumed.engine.serializeCanonical();
for(const origin of [-1,0,1.5,'0',state.garrison.nextAreaId,Number.MAX_SAFE_INTEGER]){
 const poisoned=decodeGraph(transportCheckpoint.payload);poisoned.state.actors.transports[0].origin=origin;
 assert.throws(()=>resumed.engine.restoreCheckpoint({version:checkpoint.version,payload:encodeGraph(poisoned)}),/invalid transport references/);
 assert.equal(resumed.engine.serializeCanonical(),transportBefore);
}
console.log('Retired transport-origin acceptance and invalid-origin atomic rejection PASS');
