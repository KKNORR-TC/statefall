export function resetAuthoritativeState(engineState,runtime){
  engineState.resetActors();
  engineState.setPlayerId(null);
  engineState.resetIdentity();
  engineState.resetFog();
  engineState.resetMap();
  engineState.resetDiplomacy();
  engineState.resetGarrison();
  engineState.resetDraft();
  engineState.resetMatchFlow();
  engineState.resetClock();
  engineState.resetLifecycle();
  engineState.resetSetup();
  runtime.resetCommands();
}
