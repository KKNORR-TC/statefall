'use strict';

const assert=require('node:assert/strict');
const {createAuthoritativeState}=require('../game/src/sim/authoritative-state.mjs');
const {createDeterministicRuntime}=require('../game/src/sim/deterministic-runtime.mjs');
const {createCommandRouter}=require('../game/src/sim/command-router.mjs');
const {validateReplaySchema}=require('../game/src/sim/replay-schema.mjs');

function createInstance(){
  const engineState=createAuthoritativeState({tileCount:4,settings:{pauseBuild:false}});
  const runtime=createDeterministicRuntime();
  const players=[0,1].map(id=>({id,name:'P'+id,kind:'human',gold:1000,troops:100,silos:1,areas:[],rel:{}}));
  engineState.actors.players.push(...players);
  engineState.setPlayerId(0);
  engineState.map.land.fill(1);
  engineState.map.owner.set([0,1,0,1]);
  const failures=[],moves=[];
  const nothing=()=>false;
  const actions={
    callPlane:nothing,launchFighter:nothing,launchBomber:nothing,recallAircraft:nothing,upgradeStructure:nothing,buyAircraft:nothing,
    garrisonOn:nothing,idleAircraft:nothing,areaAt:nothing,launchParadrop:nothing,launchSatellite:nothing,
    moveShips:(tile,ships)=>{ moves.push([tile,ships.map(ship=>ship.id)]); return ships.length; },waterNeighbor:nothing,orderWarship:nothing,
    placeStructure:nothing,snapBuild:nothing,cancelQueued:nothing,destroyStructure:nothing,structCounts:nothing,launchMissile:nothing,
    propose:nothing,breakRelation:nothing,aidTroops:nothing,aidGold:nothing,botAnswerRequest:nothing,maxTroops:()=>100,
    areaById:nothing,launchAttack:nothing,areaName:()=>'',atPeace:nothing,areaTouching:nothing,reinforceArea:nothing,frontierOf:()=>new Set(),
    draftPick:nothing,draftAdvance:nothing,accept:nothing,decline:nothing,resolveSharedVictory:nothing,continueWar:nothing
  };
  const router=createCommandRouter({
    engineState,runtime,settings:engineState.rules.settings,definitions:{city:{label:'City'},nuke:{label:'Missile'}},ships:{warship:{label:'Warship',cost:1}},air:{fighter:{patrol:1}},shield:{hp:1,repairCost:1,repairTicks:1},levelShield:{hp:1},cruise:{cost:1,ticks:1},
    constants:{W:2,linkRange:1,cancelRefund:.5,nukeCost:1},queries:{structAtT:tile=>engineState.actors.structures.find(value=>value.t===tile)||null},actions,
    adapters:{fail:message=>failures.push(message),warn:(...args)=>failures.push(args)}
  });
  return {engineState,runtime,players,router,failures,moves};
}

const saved={window:Object.getOwnPropertyDescriptor(global,'window'),document:Object.getOwnPropertyDescriptor(global,'document'),navigator:Object.getOwnPropertyDescriptor(global,'navigator')};
try{
  const poison=new Proxy({}, {get(){ throw new Error('browser global read'); }});
  Object.defineProperties(global,{window:{value:poison,writable:true,configurable:true},document:{value:poison,writable:true,configurable:true},navigator:{value:poison,writable:true,configurable:true}});

  const first=createInstance(),second=createInstance();
  first.router.issue('focus',.4);
  first.router.issueFor(1,'focus',.7);
  second.router.issue('focus',.2);
  assert.equal(first.players[0].focus,.4);
  assert.equal(first.players[1].focus,.7);
  assert.equal(second.players[0].focus,.2);
  assert.equal(second.players[1].focus,undefined);
  assert.deepEqual(first.runtime.commands.log,[{t:0,k:'focus',a:[.4]},{t:0,k:'focus',a:[.7],p:1}]);

  first.router.issueMenu({act:'focus'},1,[],-1,50,0,0);
  assert.equal(first.players[0].cmdFocus,1);
  assert.deepEqual(first.runtime.commands.log[2],{t:0,k:'menu',a:[{act:'focus'},1,[],-1,50,0,0]});

  first.engineState.actors.warships.push({id:10,owner:1,hp:1},{id:11,owner:0,hp:1});
  assert.throws(()=>first.router.issueMenu({act:'move'},0,[10,11],-1,50,0,0,1),/foreign/);
  first.router.issueMenu({act:'move'},0,[10],-1,50,0,0,1);
  assert.deepEqual(first.moves,[[0,[10]]]);
  assert.equal(first.runtime.commands.log[3].p,1);

  first.engineState.setLifecycle('userPaused',true);
  const before=first.runtime.commands.log.length;
  first.router.issueClick(1,{ratio:50,pick:null,build:null});
  assert.equal(first.runtime.commands.log.length,before);
  assert.match(first.failures[0],/^Paused/);

  const historical=createInstance();
  historical.router.replayApply({t:4,k:'focus',a:[.55]});
  assert.equal(historical.players[0].focus,.55,'historical command did not default to the current seat');
  historical.router.replayApply({t:5,k:'focus',a:[.8],p:1});
  assert.equal(historical.players[1].focus,.8,'actor-prefixed replay command used the wrong seat');
  assert.throws(()=>historical.router.issueFor(99,'focus',.1),/Unknown command actor/);
  const unknownBefore=historical.runtime.commands.log.length;
  assert.throws(()=>historical.router.issue('unknown-action'),/Unsupported command kind/,'unknown simple commands must throw before recording');
  assert.throws(()=>historical.router.issueMenu({act:'unknown-menu'},1,[],-1,50,0,0),/Unsupported menu action/,'unknown menu actions must throw before recording');
  assert.equal(historical.runtime.commands.log.length,unknownBefore,'rejected commands must not enter history');
  assert.equal(historical.router.replayApply({t:6,k:'menu',a:[{act:'unknown-menu'},1,[],-1,50,0,0]}),false,'unknown replay menu actions must fail');
  assert.equal(historical.router.replayApply({t:6,k:'unknown-action',a:[]}),false,'unknown replay command kinds must fail');
  const replayFixture={v:1,seed:'HISTORICAL',hashv:1,tick:0,settings:{diff:'normal',map:'land',troops:120,gold:100,teams:0,country:null,bots:false,noCap:false,quick:false,fog:false,instant:false,risky:false,endgame:false,billionaire:false,garrison:false,pauseBuild:false},cmds:[{t:0,k:'menu',a:[{act:'nap'},1,[],-1,50,0,0]}],hashes:[]};
  assert.deepEqual(validateReplaySchema(replayFixture),[],'historical supported menu fixture must remain valid');
  replayFixture.cmds[0].a[0].act='unknown-menu';
  assert.ok(validateReplaySchema(replayFixture).some(error=>error.includes('invalid arguments for menu')),'replay schema must reject unknown menu actions before setup');

  console.log('Command router browser-poisoning, isolation, actor, and historical replay contracts PASS');
}finally{
  for(const key of Object.keys(saved)){ if(saved[key]) Object.defineProperty(global,key,saved[key]); else delete global[key]; }
}
