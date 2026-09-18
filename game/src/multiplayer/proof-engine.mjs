import {createEngine} from '../sim/engine.mjs';
import {assertReplaySchema} from '../sim/replay-schema.mjs';
import {MULTIPLAYER_PROOF} from './proof-capability.mjs';
import {engineOptionsFromRoomConfiguration,roomConfigurationFingerprint,validateRoomConfiguration} from './room-configuration.mjs';

export function createMultiplayerProofEngine(roomConfiguration,adapters={}){
  return createEngine(engineOptionsFromRoomConfiguration(roomConfiguration),{...adapters,[MULTIPLAYER_PROOF]:true});
}

export function multiplayerReplayEngineOptions(replay){
  assertReplaySchema(replay,{multiplayerProof:true});
  const metadata=replay.multiplayer,room=validateRoomConfiguration(metadata.roomConfig);
  if(metadata.roomFingerprint!==roomConfigurationFingerprint(room)) throw new TypeError('Multiplayer replay room fingerprint does not match its configuration.');
  return engineOptionsFromRoomConfiguration(room);
}

export function createMultiplayerReplayEngine(replay,adapters={}){
  const engine=createEngine(multiplayerReplayEngineOptions(replay),{...adapters,[MULTIPLAYER_PROOF]:true});
  engine.loadReplay(replay); return engine;
}
