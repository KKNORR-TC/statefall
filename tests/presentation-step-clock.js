const assert=require('node:assert/strict');
(async()=>{
 const {createPresentationStepClock}=await import('../game/src/rendering/presentation-step-clock.mjs');
 const {advanceGlobalEffectsPresentation}=await import('../game/src/rendering/global-effects-layer-model.mjs');
 for(const hz of [10,20,30,60,120,144]){
  const clock=createPresentationStepClock();let total=0;
  for(let i=0;i<=hz;i++)total+=clock.steps(i*1000/hz);
  assert.equal(total,61,'effect lifetime depends on display rate '+hz);
 }
 const clock=createPresentationStepClock();clock.steps(0);assert.equal(clock.steps(10000),15);assert.equal(clock.steps(10000),0);clock.reset();assert.equal(clock.steps(10000),1);assert.equal(clock.steps(10100,false),1);assert.equal(clock.steps(11000),1);
 const state={puffs:[{x:2,y:3,vx:.1,vy:-.05,r:1,age:0,life:25,col:'70,70,70'}],wrecks:[{kind:'air',x:3,y:4,hdg:.2,age:0}]};
 let reference=structuredClone(state);for(let i=0;i<6;i++)reference=advanceGlobalEffectsPresentation(reference,true).next;
 const batched=advanceGlobalEffectsPresentation(structuredClone(state),true,{steps:6}).next;
 assert.deepEqual(batched,reference,'batched presentation must retain exact age/motion/emission order');
 const frozen=structuredClone(state);advanceGlobalEffectsPresentation(frozen,true,{steps:0});assert.deepEqual(frozen,state);
 for(const steps of [-1,1.5,16,NaN])assert.throws(()=>advanceGlobalEffectsPresentation({},true,{steps}),/steps/);
 console.log('Effect clock 10–144 Hz, pause gap bound, exact batched aging and zero-step purity PASS');
})().catch(e=>{console.error(e);process.exitCode=1;});
