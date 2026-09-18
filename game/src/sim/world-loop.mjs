export function createWorldLoop({
  W,H,engineState,runtime,settings,ports,applyReplayCommand,stateOracle,
  isReplayOtherVersion=()=>false,systems
}){
  const clock=engineState.clock,lifecycle=engineState.lifecycle;

  function checkpoint(){
    if(stateOracle.checkpoint()&&!isReplayOtherVersion()) ports.scheduleControllerTask('showReplayDivergence');
  }

  function runSimulationSystems(now){
    systems.economy.accruePlayers(now);
    if(clock.tickN%10===0) systems.structures.rebuildLinks();
    systems.diplomacy.stepDiplomacy();
    systems.landCombat.reclaimLand();
    systems.structures.stepBuild();
    systems.missiles.missileCommand();
    systems.naval.stepTrade();
    systems.naval.stepGuns();
    systems.fog.stepPlanes();
    systems.air.stepAir();
    systems.air.flightOps();
    systems.logistics.troopLogistics();
    systems.logistics.engineering();
    systems.logistics.stepTrucks();
    if(clock.tickN%5===0){
      systems.fog.computeVision();
      systems.fog.updateKnownBorders();
    }
    systems.landCombat.stepAttacks();
    systems.missiles.stepInterceptors();
    systems.missiles.stepShields();
    systems.missiles.stepMissiles();
    systems.naval.stepNaval();
    if(clock.tickN%5===0) systems.economy.checkRegions();
    ports.invalidateMap();
    systems.matchFlow.evaluateOutcomes();
    if(settings.garrison&&clock.tickN%10===5) systems.logistics.rebuildAreas();
    if(clock.tickN%20===0) systems.matchFlow.checkAlliedEndgame();
    if(clock.tickN%5===0) ports.invalidateUi();
  }

  const runtimePorts=Object.freeze({
    getTick:()=>clock.tickN,
    applyReplayCommand,
    advanceDraft:()=>systems.matchFlow.advanceDraft(),
    isStopped:()=>lifecycle.over||lifecycle.paused,
    setClock:(nextTick,nextSimMs)=>engineState.setClock(nextTick,nextSimMs),
    checkpoint,
    replayCommandFailed:(command,phase)=>stateOracle.replayCommandFailed(command,phase),
    runSystems:runSimulationSystems
  });

  return Object.freeze({tick:()=>runtime.advanceOneTick(runtimePorts)});
}
