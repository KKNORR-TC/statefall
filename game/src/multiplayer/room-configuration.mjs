import {assertDifficulty,assertMultiplayerSeed,validateSettingsCandidate} from '../sim/configuration-schema.mjs';
import {sha256} from '../sim/sha256.mjs';

export const RELAY_PROTOCOL_VERSION='statefall-relay/v1';

const DEFAULT_SETTINGS={troops:120,gold:100,bots:false,teams:0,noCap:false,map:'random',quick:false,fog:false,instant:false,risky:false,endgame:false,billionaire:false,garrison:false,pauseBuild:false,seed:0};
const plain=value=>value!==null&&typeof value==='object'&&!Array.isArray(value)&&(Object.getPrototypeOf(value)===Object.prototype||Object.getPrototypeOf(value)===null);
const exact=(value,keys)=>plain(value)&&Object.keys(value).length===keys.length&&keys.every(key=>Object.hasOwn(value,key));

export function stableJson(value){
  if(value===null||typeof value!=='object') return JSON.stringify(value);
  if(Array.isArray(value)) return `[${value.map(stableJson).join(',')}]`;
  return `{${Object.keys(value).sort().map(key=>`${JSON.stringify(key)}:${stableJson(value[key])}`).join(',')}}`;
}

export function validateRoomConfiguration(value){
  if(!exact(value,['protocol','W','H','bots','tickMs','difficulty','settings','seats'])) throw new TypeError('Room configuration has unsupported or missing fields.');
  if(value.protocol!==RELAY_PROTOCOL_VERSION) throw new TypeError('Room configuration uses an unsupported relay protocol.');
  if(!Number.isSafeInteger(value.W)||value.W<16||value.W>4096||!Number.isSafeInteger(value.H)||value.H<16||value.H>4096||value.W*value.H>2_000_000) throw new TypeError('Room dimensions are outside supported ranges.');
  if(value.bots!==0) throw new TypeError('The Phase D2 completion proof requires exactly two humans and no bots.');
  if(!Number.isFinite(value.tickMs)||value.tickMs<=0||value.tickMs>60_000) throw new TypeError('Room tickMs is outside supported ranges.');
  const difficulty=assertDifficulty(value.difficulty);
  assertMultiplayerSeed(value.settings?.seed);
  const settings=validateSettingsCandidate(value.settings,DEFAULT_SETTINGS);
  if(settings.humanSeats!==2||settings.risky) throw new TypeError('The Phase D2 completion proof requires exactly two non-draft human seats.');
  if(!Array.isArray(value.seats)||value.seats.length!==2||value.seats[0]!==0||value.seats[1]!==1) throw new TypeError('The Phase D2 completion proof requires seats 0 and 1.');
  return Object.freeze({protocol:value.protocol,W:value.W,H:value.H,bots:0,tickMs:value.tickMs,difficulty,settings:Object.freeze({...settings}),seats:Object.freeze([0,1])});
}

export function roomConfigurationFingerprint(value){ return sha256(stableJson(validateRoomConfiguration(value))); }

export function roomConfigurationFromEngineOptions(options={}){
  if(!plain(options)) throw new TypeError('Engine options must be a plain object.');
  return validateRoomConfiguration({protocol:RELAY_PROTOCOL_VERSION,W:options.W??720,H:options.H??414,bots:options.roomBots??0,tickMs:options.tickMs??100,difficulty:options.difficulty??'normal',settings:options.settings??{},seats:options.seats??[0,1]});
}

export function engineOptionsFromRoomConfiguration(value){
  const room=validateRoomConfiguration(value);
  return Object.freeze({W:room.W,H:room.H,bots:room.seats.length+room.bots-1,tickMs:room.tickMs,difficulty:room.difficulty,settings:room.settings});
}
