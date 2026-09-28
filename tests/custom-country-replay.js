const assert=require('node:assert/strict');
(async()=>{
 const {validateReplaySchema}=await import('../game/src/sim/replay-schema.mjs');
 const {createEngine,ENGINE_TEST_DIAGNOSTICS}=await import('../game/src/sim/engine.mjs');
 const {validateReplay}=require('../tools/replaycheck.js');
 const replay=structuredClone(require('./fixtures/replays/public-v1.10.7-focus.json'));
 replay.settings.country=-1;replay.settings.customFlag={name:'Synthetic custom country',layers:[['h','#0038a8','#ffffff'],['emb','#ffffff','anchor',.5,.5,.2,null]],userId:123};
 replay.cmds=[];replay.hashes=[];replay.tick=0;
 for(const validate of [validateReplaySchema,validateReplay]){
  assert.deepEqual(validate(replay),[]);
  for(const country of [-2,-1.5]){const bad=structuredClone(replay);bad.settings.country=country;assert.match(validate(bad).join(' '),/settings.country/);}
  const bad=structuredClone(replay);bad.settings.customFlag=null;assert.match(validate(bad).join(' '),/settings.country/);
 }
 const engine=createEngine({W:120,H:70,[ENGINE_TEST_DIAGNOSTICS]:true});engine.loadReplay(replay);engine.setup();
 assert.equal(engine.compatibility.getMe().flag.idx,-1);assert.equal(engine.compatibility.getMe().flag.name,replay.settings.customFlag.name);
 console.log('PASS custom-country replay sentinel, negative controls and engine restoration');
})().catch(e=>{console.error(e);process.exitCode=1;});
