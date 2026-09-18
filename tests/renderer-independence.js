'use strict';

const assert=require('node:assert/strict');
const {createEngine,ENGINE_TEST_DIAGNOSTICS}=require('../game/src/sim/engine.mjs');

function run({risky=false,withSink=false,cadence=0}){
  const received=[];
  const engine=createEngine({W:240,H:138,difficulty:'hard',settings:{seed:risky?'RENDERDRAFT':'RENDERBASE',risky},[ENGINE_TEST_DIAGNOSTICS]:true},withSink?{eventSink:event=>received.push(event)}:{});
  const {state,systems}=engine.compatibility;
  engine.start({chosenFlag:systems.worldSetup.countryByIdx(35)});
  for(let i=0;i<300;i++){
    if(risky){
      const neutral=state.actors.players.find(player=>player.kind==='neutral'&&player.alive&&player.tiles>=120);
      if(neutral){
        const tile=state.map.owner.findIndex(owner=>owner===neutral.id);
        if(tile>=0) systems.commandRouter.issueClick(tile,{ratio:50,pick:null,build:null});
      }
    }
    engine.tick();
    assert.ok(state.actors.players.every(player=>!Object.hasOwn(player,'labelPos')),'renderer-independent actors must not own labelPos');
    if(cadence&&i%cadence===0){ engine.interpolationFrame(); engine.queries.playerLabelPositions(); engine.dispatchEvents(); }
  }
  if(withSink) engine.dispatchEvents();
  return {state:engine.serializeCanonical(),hash:engine.stateHash(),rng:engine.compatibility.runtime.rngDraws,tick:state.clock.tickN,eventCount:received.length};
}

for(const risky of [false,true]){
  const sinkFree=run({risky});
  const sinkAndCadence=run({risky,withSink:true,cadence:3});
  assert.ok(sinkAndCadence.eventCount>0,'event sink received no simulation events');
  delete sinkFree.eventCount;
  delete sinkAndCadence.eventCount;
  assert.deepEqual(sinkAndCadence,sinkFree,`${risky?'risky draft':'standard'} state changed with event sink/drain cadence`);
}

console.log('Headless event-delivery independence PASS (browser Canvas render purity is covered by Playwright)');
