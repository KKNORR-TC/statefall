const assert=require('node:assert/strict');
(async()=>{
 const {assertIdentity}=await import('../game/src/sim/configuration-schema.mjs');
 const {createEngine}=await import('../game/src/sim/engine.mjs');
 const flag={name:'Synthetic custom flag',layers:[['h','#0038a8','#ffffff'],['emb','#ffffff','anchor',0.5,0.5,0.2,null]],idx:-1,custom:true,userId:123};
 for(const accent of [null,'#ffcc00',undefined]){
  const f=structuredClone(flag); if(accent===undefined)f.layers[1].pop();else f.layers[1][6]=accent;
  assert.doesNotThrow(()=>assertIdentity(f));
 }
 for(const layer of [['h',null],['emb',null,'anchor',.5,.5,.2,null],['emb','#ffffff','anchor',null,.5,.2,null],['emb','#ffffff','anchor',.5,.5,.2,null,1],['tri','#ffffff',[null,.5],[0,0],[1,1]],['emb','#ffffff','anchor',.5,.5,.2,{}]]){
  assert.throws(()=>assertIdentity({...flag,layers:[layer]}),/invalid value/);
 }
 const settings={seed:'CUSTOMFLAGNULL',map:'land',customBots:[{name:'Synthetic bot',layers:flag.layers,userId:456,slot:0}]};
 const make=()=>createEngine({W:120,H:70,bots:2,difficulty:'normal',settings});
 const a=make(),b=make();
 for(const e of [a,b]){e.configure({chosenFlag:flag});e.start();}
 assert.equal(a.serializeCanonical(),b.serializeCanonical());
 const cp=a.checkpoint();b.restoreCheckpoint(cp);assert.equal(a.serializeCanonical(),b.serializeCanonical());
 assert.equal(flag.layers[1][6],null);
 console.log('PASS optional emblem accent, malformed values, player/bot start and checkpoint round-trip');
})().catch(error=>{console.error(error);process.exitCode=1;});
