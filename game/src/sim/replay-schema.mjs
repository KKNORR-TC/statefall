export const REPLAY_SCHEMA='statefall-replay-fixture/v1';
import {COMMAND_KINDS,assertCommand,assertCommandArguments} from './command-schema.mjs';
import {assertMultiplayerSeed,BOOLEAN_SETTING_NAMES,DIFFICULTY_IDS,MAP_IDS,RULE_IDS} from './configuration-schema.mjs';
import {RELAY_PROTOCOL_VERSION,engineOptionsFromRoomConfiguration,roomConfigurationFingerprint,stableJson,validateRoomConfiguration} from '../multiplayer/room-configuration.mjs';

const DIFFICULTIES=new Set(DIFFICULTY_IDS),MAPS=new Set(MAP_IDS),RULE_ID_SET=new Set(RULE_IDS);
const COMMANDS=new Set(COMMAND_KINDS),BOOLEAN_SETTINGS=BOOLEAN_SETTING_NAMES;
const LIMITS={tick:10_000_000,commands:100_000,hashes:100_000,commandArgs:7,string:200};
const isObject=value=>value!==null&&typeof value==='object'&&!Array.isArray(value)&&Object.getPrototypeOf(value)===Object.prototype;
const finite=(value,min=-Infinity,max=Infinity)=>Number.isFinite(value)&&value>=min&&value<=max;
const id=value=>Number.isSafeInteger(value)&&value>=0&&value<=1_000_000;

function validCommandArgs(command){
  try{ assertCommandArguments(command.k,command.a); return true; }catch{ return false; }
}

export function validateReplaySchema(value,{multiplayerProof=false}={}){
  const errors=[],requireValue=(ok,path,message)=>{ if(!ok) errors.push(`${path} ${message}`); };
  requireValue(isObject(value),'replay','must be a plain object');
  if(!isObject(value)) return errors;
  requireValue(value.schema==null||value.schema===REPLAY_SCHEMA,'schema',`must be ${REPLAY_SCHEMA}`);
  requireValue(value.requiresCanonicalCheckpoints==null||typeof value.requiresCanonicalCheckpoints==='boolean','requiresCanonicalCheckpoints','must be boolean when provided');
  requireValue(value.v===1,'v','must be 1');
  const multiplayer=isObject(value.multiplayer);
  let validSeed=typeof value.seed==='string'&&!multiplayer&&/^[A-Za-z0-9]{1,16}$/.test(value.seed);
  if(multiplayer) try{ assertMultiplayerSeed(value.seed); validSeed=true; }catch{}
  requireValue(validSeed,'seed',multiplayer?'must be 1-200 ASCII letters, digits, or hyphens':'must be 1-16 ASCII letters or digits');
  requireValue(value.hashv===1||value.hashv===2,'hashv','must be 1 or 2');
  requireValue(Number.isSafeInteger(value.tick)&&value.tick>=0&&value.tick<=LIMITS.tick,'tick',`must be a non-negative safe integer no greater than ${LIMITS.tick}`);
  const settings=value.settings;
  requireValue(isObject(settings),'settings','must be a plain object');
  if(isObject(settings)){
    requireValue(DIFFICULTIES.has(settings.diff),'settings.diff','is not supported');
    requireValue(MAPS.has(settings.map),'settings.map','is not supported');
    requireValue(finite(settings.troops,1,1_000_000_000),'settings.troops','must be between 1 and 1000000000');
    requireValue(finite(settings.gold,0,1_000_000_000),'settings.gold','must be between 0 and 1000000000');
    requireValue(Number.isInteger(settings.teams)&&settings.teams>=0&&settings.teams<=4,'settings.teams','must be an integer from 0 to 4');
    requireValue(settings.country===null||Number.isInteger(settings.country)&&settings.country>=0,'settings.country','must be null or a non-negative integer');
    for(const key of BOOLEAN_SETTINGS) requireValue(typeof settings[key]==='boolean',`settings.${key}`,'must be boolean');
    requireValue(settings.allowed==null||Array.isArray(settings.allowed)&&settings.allowed.length<=RULE_IDS.length&&settings.allowed.every(item=>RULE_ID_SET.has(item))&&new Set(settings.allowed).size===settings.allowed.length,'settings.allowed','must contain unique supported rule IDs or be null');
    requireValue(settings.customBots==null||Array.isArray(settings.customBots)&&settings.customBots.length<=9,'settings.customBots','must contain at most 9 entries or be null');
    requireValue(settings.customFlag==null||isObject(settings.customFlag),'settings.customFlag','must be a plain object or null');
    requireValue(settings.humanSeats==null||multiplayer&&settings.humanSeats===2,'settings.humanSeats','requires validated two-seat multiplayer metadata');
  }
  requireValue(Array.isArray(value.cmds),'cmds','must be an array');
  if(Array.isArray(value.cmds)){
    requireValue(value.cmds.length<=LIMITS.commands,'cmds',`must contain at most ${LIMITS.commands} commands`);
    let previous=-1,previousPhase=-1;
    if(value.cmds.length<=LIMITS.commands) value.cmds.forEach((command,index)=>{
      const path=`cmds[${index}]`;
      requireValue(isObject(command),path,'must be a plain object');
      if(!isObject(command)) return;
      try{ assertCommand(command); }catch(error){ requireValue(false,path,error.message); }
      requireValue(Number.isSafeInteger(command.t)&&command.t>=0,`${path}.t`,'must be a non-negative safe integer');
      requireValue(!Number.isSafeInteger(value.tick)||!Number.isSafeInteger(command.t)||command.t<=value.tick,`${path}.t`,'must not exceed the replay target');
      if(Number.isSafeInteger(command.t)){ const phase=command.phase==='post-systems'?1:0; requireValue(command.t>previous||command.t===previous&&phase>=previousPhase,`${path}.t`,'must be in nondecreasing tick/phase order'); previous=command.t; previousPhase=phase; }
      requireValue(COMMANDS.has(command.k),`${path}.k`,'is not a supported command');
      requireValue(command.k!=='surrender'||multiplayer,`${path}.k`,'surrender requires multiplayer metadata');
      requireValue(command.p==null||id(command.p),`${path}.p`,'must be a non-negative actor ID when provided');
      requireValue(Array.isArray(command.a),`${path}.a`,'must be an array');
      if(COMMANDS.has(command.k)&&Array.isArray(command.a)) requireValue(validCommandArgs(command),`${path}.a`,`has invalid arguments for ${command.k}`);
    });
  }
  requireValue(Array.isArray(value.hashes),'hashes','must be an array');
  if(Array.isArray(value.hashes)){
    requireValue(value.hashes.length<=LIMITS.hashes,'hashes',`must contain at most ${LIMITS.hashes} checkpoints`);
    const seen=new Set();
    if(value.hashes.length<=LIMITS.hashes) value.hashes.forEach((checkpoint,index)=>{
      const path=`hashes[${index}]`,tick=checkpoint&&checkpoint[0];
      requireValue(Array.isArray(checkpoint)&&checkpoint.length>=2&&checkpoint.length<=3,path,'must be [tick, hash, optional detail]');
      if(!Array.isArray(checkpoint)||checkpoint.length<2) return;
      requireValue(Number.isSafeInteger(tick)&&tick>0&&tick%100===0&&tick<=value.tick,`${path}[0]`,'must be a 100-tick checkpoint at or before the target');
      requireValue(!seen.has(tick),`${path}[0]`,'is duplicated'); seen.add(tick);
      requireValue(typeof checkpoint[1]==='string'&&/^[0-9a-f]{8}$/.test(checkpoint[1]),`${path}[1]`,'must be an 8-character lowercase hex hash');
      requireValue(checkpoint[2]==null||isObject(checkpoint[2]),`${path}[2]`,'must be a plain object when provided');
      const detail=checkpoint[2],canonical=detail&&detail.canonical;
      if(value.requiresCanonicalCheckpoints===true||canonical!=null||detail&&['rngDraws','commandCount','replayCursor'].some(key=>Object.hasOwn(detail,key))){
        requireValue(isObject(canonical),`${path}[2].canonical`,'must be a plain object');
        requireValue(isObject(canonical)&&canonical.version==='statefall-authoritative-state/v1',`${path}[2].canonical.version`,'must be statefall-authoritative-state/v1');
        requireValue(isObject(canonical)&&typeof canonical.sha256==='string'&&/^[0-9a-f]{64}$/.test(canonical.sha256),`${path}[2].canonical.sha256`,'must be a 64-character lowercase hex digest');
        requireValue(Number.isSafeInteger(detail&&detail.rngDraws)&&detail.rngDraws>=0,`${path}[2].rngDraws`,'must be a non-negative safe integer');
        requireValue(Number.isSafeInteger(detail&&detail.commandCount)&&detail.commandCount>=0,`${path}[2].commandCount`,'must be a non-negative safe integer');
        requireValue(detail&&detail.replayCursor===null||Number.isSafeInteger(detail&&detail.replayCursor)&&detail.replayCursor>=0,`${path}[2].replayCursor`,'must be null or a non-negative safe integer');
      }
    });
    if(Number.isSafeInteger(value.tick)&&value.tick<=LIMITS.tick&&value.hashes.length<=LIMITS.hashes) for(let tick=100;tick<=value.tick;tick+=100) requireValue(seen.has(tick),'hashes',`is missing checkpoint ${tick}`);
  }
  requireValue(value.finalHash==null||typeof value.finalHash==='string'&&/^[0-9a-f]{8}$/.test(value.finalHash),'finalHash','must be an 8-character lowercase hex hash');
  requireValue(value.multiplayer==null||isObject(value.multiplayer),'multiplayer','must be a plain object when provided');
  if(multiplayer){
    requireValue(multiplayerProof,'multiplayer','requires the multiplayer proof capability');
    const metadata=value.multiplayer,keys=['relayProtocol','roomConfig','roomFingerprint','seats','engineOptions'];
    requireValue(Object.keys(metadata).length===keys.length&&keys.every(key=>Object.hasOwn(metadata,key)),'multiplayer','has unsupported or missing fields');
    requireValue(metadata.relayProtocol===RELAY_PROTOCOL_VERSION,'multiplayer.relayProtocol','is not supported');
    let room=null;
    try{ room=validateRoomConfiguration(metadata.roomConfig); }catch(error){ requireValue(false,'multiplayer.roomConfig',error.message); }
    requireValue(typeof metadata.roomFingerprint==='string'&&/^[0-9a-f]{64}$/.test(metadata.roomFingerprint),'multiplayer.roomFingerprint','must be a lowercase SHA-256 digest');
    if(room){
      requireValue(metadata.roomFingerprint===roomConfigurationFingerprint(room),'multiplayer.roomFingerprint','does not match roomConfig');
      requireValue(Array.isArray(metadata.seats)&&JSON.stringify(metadata.seats)===JSON.stringify(room.seats),'multiplayer.seats','must match roomConfig seats');
      requireValue(isObject(metadata.engineOptions)&&stableJson(metadata.engineOptions)===stableJson(engineOptionsFromRoomConfiguration(room)),'multiplayer.engineOptions','must exactly match roomConfig');
      requireValue(value.seed===String(room.settings.seed),'seed','must match multiplayer room seed');
    }
  }
  requireValue(value.finalDigest==null||isObject(value.finalDigest),'finalDigest','must be a plain object when provided');
  if(isObject(value.finalDigest)){
    requireValue(value.finalDigest.version==='statefall-authoritative-state/v1','finalDigest.version','must be statefall-authoritative-state/v1');
    requireValue(typeof value.finalDigest.sha256==='string'&&/^[0-9a-f]{64}$/.test(value.finalDigest.sha256),'finalDigest.sha256','must be a 64-character lowercase hex digest');
  }
  if(value.final!=null){
    requireValue(isObject(value.final),'final','must be a plain object when provided');
    if(isObject(value.final)){
      requireValue(value.final.tick===value.tick,'final.tick','must equal tick');
      requireValue(typeof value.final.legacyHash==='string'&&/^[0-9a-f]{8}$/.test(value.final.legacyHash),'final.legacyHash','must be an 8-character lowercase hex hash');
      requireValue(isObject(value.final.canonical)&&value.final.canonical.version==='statefall-authoritative-state/v1','final.canonical','must use statefall-authoritative-state/v1');
      requireValue(isObject(value.final.canonical)&&typeof value.final.canonical.sha256==='string'&&/^[0-9a-f]{64}$/.test(value.final.canonical.sha256),'final.canonical.sha256','must be a 64-character lowercase hex digest');
      requireValue(Number.isSafeInteger(value.final.rngDraws)&&value.final.rngDraws>=0,'final.rngDraws','must be a non-negative safe integer');
      requireValue(Number.isSafeInteger(value.final.commandCount)&&value.final.commandCount>=0,'final.commandCount','must be a non-negative safe integer');
      requireValue(value.final.replayCursor===null||Number.isSafeInteger(value.final.replayCursor)&&value.final.replayCursor>=0,'final.replayCursor','must be null or a non-negative safe integer');
      requireValue(!Array.isArray(value.cmds)||value.final.commandCount===value.cmds.length,'final.commandCount','must equal the command count');
      requireValue(value.final.replayCursor===null||!Array.isArray(value.cmds)||value.final.replayCursor<=value.cmds.length,'final.replayCursor','must not exceed the command count');
    }
  }
  if(value.result!=null){
    const result=value.result,standings=multiplayer&&isObject(result)&&result.standings;
    const normalized=Array.isArray(standings)&&standings.length===2&&standings.every(item=>isObject(item)&&Object.keys(item).length===4&&['seatId','rank','alive','tiles'].every(key=>Object.hasOwn(item,key))&&id(item.seatId)&&[1,2].includes(item.rank)&&typeof item.alive==='boolean'&&Number.isSafeInteger(item.tiles)&&item.tiles>=0)&&new Set(standings.map(item=>item.seatId)).size===2&&new Set(standings.map(item=>item.rank)).size===2;
    const living=normalized?standings.filter(item=>item.alive).map(item=>item.seatId):[];
    requireValue(typeof result==='string'||multiplayer&&isObject(result)&&Object.keys(result).length===2&&normalized&&living.length===1&&Array.isArray(result.winnerSeatIds)&&result.winnerSeatIds.length===1&&result.winnerSeatIds[0]===living[0]&&standings.find(item=>item.rank===1)?.seatId===living[0],'result','must be a string or normalized multiplayer result');
  }
  return errors;
}

export function assertReplaySchema(value,options){
  const errors=validateReplaySchema(value,options);
  if(errors.length) throw new TypeError(`Invalid replay: ${errors.join('; ')}`);
  return value;
}
