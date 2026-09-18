const noop=()=>{};

function frozenPort(implementation){
  const target=typeof implementation==='function'?implementation:noop;
  return Object.freeze((...args)=>target(...args));
}

export function createSimulationPorts(adapters={}){
  const source=adapters&&typeof adapters==='object'?adapters:{};
  return Object.freeze({
    invalidateMap:frozenPort(source.invalidateMap),
    invalidateUi:frozenPort(source.invalidateUi),
    log:frozenPort(source.log),
    sound:frozenPort(source.sound),
    matchEnded:frozenPort(source.matchEnded),
    alliedDecisionRequested:frozenPort(source.alliedDecisionRequested),
    draftCompleted:frozenPort(source.draftCompleted),
    replayDiverged:frozenPort(source.replayDiverged),
    scheduleControllerTask:frozenPort(source.scheduleControllerTask)
  });
}
