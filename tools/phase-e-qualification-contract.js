'use strict';

const MINIMUM_FRAMES=1800;
const MINIMUM_DURATION_MS=60000;
const STABLE_WINDOW_START_MS=49000;
const MINIMUM_STABLE_SAMPLES=5;
const MINIMUM_STABLE_DURATION_MS=10000;
const STABLE_COLLECTION_TARGET_MS=11000;
const REQUIRED_BROWSERS=Object.freeze(['Chrome','Edge']);
const REQUIRED_LAYERS=Object.freeze(['terrain','preStructures','structures','navalLogistics','warships','projectiles','missiles','aircraft','mapLabels','supportActors','floatingText','globalEffects','nationOverlays','worldAnnotations','notificationOverlays','interactionOverlays']);
const CPU_P95_MAXIMUM_MS=16.7;
const CPU_P99_MAXIMUM_MS=33;
const PLATEAU_EXCLUDED_PATHS=Object.freeze(['(?:rasterBuildCount|rasterUploadCount|rasterUpdates)$']);

function measurementComplete(frames,durationMs){
  return frames>=MINIMUM_FRAMES&&durationMs>=MINIMUM_DURATION_MS;
}

function simulateMeasurement(frameIntervalMs){
  let frames=0,durationMs=0;
  while(!measurementComplete(frames,durationMs)){
    frames++;
    durationMs=frames*frameIntervalMs;
  }
  return {frames,durationMs};
}

module.exports={MINIMUM_FRAMES,MINIMUM_DURATION_MS,STABLE_WINDOW_START_MS,MINIMUM_STABLE_SAMPLES,MINIMUM_STABLE_DURATION_MS,STABLE_COLLECTION_TARGET_MS,REQUIRED_BROWSERS,REQUIRED_LAYERS,CPU_P95_MAXIMUM_MS,CPU_P99_MAXIMUM_MS,PLATEAU_EXCLUDED_PATHS,measurementComplete,simulateMeasurement};
