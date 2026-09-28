export const STATE_ORACLE_VERSION='statefall-authoritative-state/v1';
export const RUNTIME_CHECKPOINT_VERSION='statefall-deterministic-runtime/v1';
import {assertCommand} from './command-schema.mjs';

const PUBLIC_REPLAY_KEYS=new Set(['on','cmds','i','speed','resume','toTick','hashes','hashv','mismatch','creditsMode','otherVersion','fileGame','saveId','requiresCanonicalCheckpoints','finalHash','finalDigest','final']);
const INTERNAL_REPLAY_KEYS=new Set([...PUBLIC_REPLAY_KEYS,'why','divTick','divRec','divNow','finalVerified','verifiedEvidence']);
const plain=value=>value!==null&&typeof value==='object'&&!Array.isArray(value)&&(Object.getPrototypeOf(value)===Object.prototype||Object.getPrototypeOf(value)===null);
const exact=(value,keys)=>plain(value)&&Object.keys(value).length===keys.length&&keys.every(key=>Object.hasOwn(value,key));
function assertHashes(hashes){
  if(!Array.isArray(hashes)||hashes.length>100_000) throw new TypeError('Replay hashes must be a bounded array.');
  let previous=-1;
  for(const item of hashes){
    if(!Array.isArray(item)||item.length<2||item.length>3||!Number.isSafeInteger(item[0])||item[0]<=previous||item[0]<=0||item[0]%100||item[0]>10_000_000||typeof item[1]!=='string'||!/^[0-9a-f]{8}$/.test(item[1])||(item.length===3&&!plain(item[2]))) throw new TypeError('Invalid replay hash checkpoint.');
    if(item.length===3){
      const detail=item[2],canonical=detail.canonical;
      const canonicalDetail=['canonical','rngDraws','commandCount','replayCursor'].every(key=>Object.hasOwn(detail,key))&&plain(canonical)&&canonical.version===STATE_ORACLE_VERSION&&typeof canonical.sha256==='string'&&/^[0-9a-f]{64}$/.test(canonical.sha256)&&Number.isSafeInteger(detail.rngDraws)&&detail.rngDraws>=0&&Number.isSafeInteger(detail.commandCount)&&detail.commandCount>=0&&(detail.replayCursor===null||Number.isSafeInteger(detail.replayCursor)&&detail.replayCursor>=0)&&Object.keys(detail).every(key=>['canonical','rngDraws','commandCount','replayCursor','rng','n'].includes(key)||/^\d+$/.test(key));
      const legacyDetail=Object.keys(detail).every(key=>key==='rng'||key==='n'||/^\d+$/.test(key))&&Number.isSafeInteger(detail.rng)&&detail.rng>=0&&Array.isArray(detail.n)&&detail.n.length===4&&detail.n.every(value=>Number.isSafeInteger(value)&&value>=0)&&Object.entries(detail).every(([key,value])=>key==='rng'||key==='n'||Array.isArray(value)&&value.length===3&&value.every(Number.isFinite));
      if(!canonicalDetail&&!legacyDetail) throw new TypeError('Invalid replay hash metadata.');
    }
    previous=item[0];
  }
}
const commandPhase=command=>command.phase||'pre-systems';
function assertCommandOrder(items,label){
  let previousTick=-1,previousPhase=-1;
  for(const command of items){
    assertCommand(command);
    const phase=commandPhase(command)==='pre-systems'?0:1;
    if(command.t<previousTick||command.t===previousTick&&phase<previousPhase) throw new TypeError(`${label} must be ordered by tick and phase.`);
    previousTick=command.t; previousPhase=phase;
  }
}
export function prepareReplayConfiguration(values,current={on:false,cmds:[],i:0,speed:1,resume:false,toTick:0}){
  const input=cloneRuntimeValue(values);
  if(!plain(input)) throw new TypeError('Replay configuration must be a plain object.');
  for(const key of Object.keys(input)) if(!PUBLIC_REPLAY_KEYS.has(key)) throw new TypeError(`Unsupported replay option: ${key}.`);
  const next={...current,...input};
  if(input.i===0&&(input.on===true||input.on===false&&Array.isArray(input.cmds))){
    for(const key of ['why','divTick','divRec','divNow','finalVerified','verifiedEvidence']) delete next[key];
    if(Object.hasOwn(input,'mismatch')) next.mismatch=input.mismatch; else delete next.mismatch;
    for(const key of ['finalHash','finalDigest','final']) if(!Object.hasOwn(input,key)) delete next[key];
  }
  if(typeof next.on!=='boolean'||!Array.isArray(next.cmds)||next.cmds.length>100_000||!Number.isSafeInteger(next.i)||next.i<0||next.i>next.cmds.length||!Number.isFinite(next.speed)||next.speed<=0||next.speed>100||typeof next.resume!=='boolean'||!Number.isSafeInteger(next.toTick)||next.toTick<0||next.toTick>10_000_000) throw new TypeError('Invalid replay control values.');
  assertCommandOrder(next.cmds,'Replay commands');
  if(next.hashes!=null) assertHashes(next.hashes);
  if(next.hashv!=null&&next.hashv!==1&&next.hashv!==2) throw new TypeError('Replay hash version must be 1 or 2.');
  for(const key of ['mismatch','creditsMode','otherVersion','requiresCanonicalCheckpoints']) if(next[key]!=null&&typeof next[key]!=='boolean') throw new TypeError(`Replay ${key} must be boolean.`);
  if(next.requiresCanonicalCheckpoints===true) for(const item of next.hashes||[]) if(item.length!==3||!Object.hasOwn(item[2],'canonical')) throw new TypeError('Replay requires canonical checkpoint metadata.');
  if(next.fileGame!=null&&(typeof next.fileGame!=='string'||next.fileGame.length>100)) throw new TypeError('Replay fileGame must be a short string.');
  if(next.saveId!=null&&(!Number.isSafeInteger(next.saveId)||next.saveId<0)) throw new TypeError('Replay saveId must be a non-negative integer or null.');
  if(next.finalHash!=null&&(typeof next.finalHash!=='string'||!/^[0-9a-f]{8}$/.test(next.finalHash))) throw new TypeError('Invalid replay final hash.');
  if(next.finalDigest!=null&&(!exact(next.finalDigest,['version','sha256'])||next.finalDigest.version!==STATE_ORACLE_VERSION||typeof next.finalDigest.sha256!=='string'||!/^[0-9a-f]{64}$/.test(next.finalDigest.sha256))) throw new TypeError('Invalid replay final digest.');
  if(next.final!=null){
    const final=next.final,canonical=final.canonical;
    if(!exact(final,['tick','legacyHash','canonical','rngDraws','commandCount','replayCursor'])||final.tick!==next.toTick||typeof final.legacyHash!=='string'||!/^[0-9a-f]{8}$/.test(final.legacyHash)||!exact(canonical,['version','sha256'])||canonical.version!==STATE_ORACLE_VERSION||typeof canonical.sha256!=='string'||!/^[0-9a-f]{64}$/.test(canonical.sha256)||!Number.isSafeInteger(final.rngDraws)||final.rngDraws<0||!Number.isSafeInteger(final.commandCount)||final.commandCount<0||final.commandCount>100_000||final.replayCursor!==null&&(!Number.isSafeInteger(final.replayCursor)||final.replayCursor<0||final.replayCursor>next.cmds.length)) throw new TypeError('Invalid replay final metadata.');
  }
  return next;
}

function prepareStoredReplay(value){
  if(!plain(value)) throw new TypeError('Invalid deterministic runtime checkpoint.');
  for(const key of Object.keys(value)) if(!INTERNAL_REPLAY_KEYS.has(key)) throw new TypeError(`Unsupported replay option: ${key}.`);
  const control=Object.fromEntries(Object.entries(value).filter(([key])=>PUBLIC_REPLAY_KEYS.has(key)));
  const next=prepareReplayConfiguration(control,{on:false,cmds:[],i:0,speed:1,resume:false,toTick:0});
  for(const key of ['why','divTick','divRec','divNow','finalVerified','verifiedEvidence']) if(Object.hasOwn(value,key)) next[key]=value[key];
  if(next.why!=null&&(typeof next.why!=='string'||next.why.length>1000)) throw new TypeError('Invalid replay divergence metadata.');
  if(next.divTick!=null&&(!Number.isSafeInteger(next.divTick)||next.divTick<0||next.divTick>10_000_000)) throw new TypeError('Invalid replay divergence metadata.');
  for(const key of ['divRec','divNow']) if(next[key]!=null&&!plain(next[key])) throw new TypeError('Invalid replay divergence metadata.');
  if(next.finalVerified!=null&&typeof next.finalVerified!=='boolean') throw new TypeError('Invalid replay final verification state.');
  if(next.verifiedEvidence!=null&&typeof next.verifiedEvidence!=='boolean') throw new TypeError('Invalid replay evidence state.');
  return next;
}

export function seedFrom(value){
  let hash=2166136261;
  for(const character of String(value)){
    hash^=character.charCodeAt(0);
    hash=Math.imul(hash,16777619);
  }
  return hash>>>0;
}

export function createCountedRng(seed){
  let state=seedFrom(seed),draws=0;
  return Object.freeze({
    next(){
      state|=0;
      state=state+0x6D2B79F5|0;
      let value=Math.imul(state^state>>>15,1|state);
      value=value+Math.imul(value^value>>>7,61|value)^value;
      draws++;
      return ((value^value>>>14)>>>0)/4294967296;
    },
    get draws(){ return draws; },
    snapshot(){ return {state:state>>>0,draws}; },
    restore(snapshot){
      if(!snapshot||!Number.isInteger(snapshot.state)||snapshot.state<0||snapshot.state>0xffffffff||!Number.isInteger(snapshot.draws)||snapshot.draws<0) throw new TypeError('Invalid deterministic RNG snapshot.');
      state=snapshot.state|0;
      draws=snapshot.draws;
    }
  });
}

function cloneRuntimeValue(value,ancestors=new Set()){
  if(value===null||['string','boolean','number','undefined'].includes(typeof value)) return value;
  if(typeof value!=='object') throw new TypeError('Runtime checkpoint values must be JSON-compatible.');
  if(ancestors.has(value)) throw new TypeError('Runtime checkpoint values must not contain cycles.');
  if(!Array.isArray(value)&&Object.getPrototypeOf(value)!==Object.prototype&&Object.getPrototypeOf(value)!==null) throw new TypeError('Runtime checkpoint values must use plain objects and arrays.');
  if(Object.getOwnPropertySymbols(value).length) throw new TypeError('Runtime checkpoint values must not contain symbol properties.');
  const copy=Array.isArray(value)?[]:{};
  ancestors.add(value);
  for(const [key,descriptor] of Object.entries(Object.getOwnPropertyDescriptors(value))){
    if(!('value' in descriptor)) throw new TypeError('Runtime checkpoint values must not contain accessors.');
    copy[key]=cloneRuntimeValue(descriptor.value,ancestors);
  }
  ancestors.delete(value);
  return copy;
}

function frozenRuntimeValue(value){
  const copy=cloneRuntimeValue(value),freeze=item=>{
    if(item===null||typeof item!=='object'||Object.isFrozen(item)) return item;
    for(const child of Object.values(item)) freeze(child);
    return Object.freeze(item);
  };
  return freeze(copy);
}

function replaceRecord(target,source){
  for(const key of Object.keys(target)) delete target[key];
  Object.assign(target,source);
}

export function serializeCanonicalV1(root,{derivedProperties=()=>null,canonicalAlias=()=>null,typedValues=()=>null,stringify=JSON.stringify}={}){
  let nextId=1;
  const seen=new Map();
  const normalize=input=>{
    const alias=input!==null&&(typeof input==='object'||typeof input==='function')?canonicalAlias(input):null;
    const value=alias??input;
    if(value===null||typeof value==='string'||typeof value==='boolean') return value;
    if(typeof value==='number'){
      if(Number.isNaN(value)) return {$number:'NaN'};
      if(value===Infinity) return {$number:'Infinity'};
      if(value===-Infinity) return {$number:'-Infinity'};
      if(Object.is(value,-0)) return {$number:'-0'};
      return value;
    }
    if(typeof value==='undefined') return {$undefined:true};
    if(typeof value==='bigint') return {$bigint:String(value)};
    if(typeof value==='function'||typeof value==='symbol') return {$unsupported:typeof value};
    if(seen.has(value)) return {$ref:seen.get(value)};
    const id=nextId++;
    seen.set(value,id);
    if(ArrayBuffer.isView(value)){
      const cached=typedValues(value);
      if(cached) return {$id:id,$typed:value.constructor.name,$values:cached};
      const values=new Array(value.length);
      for(let index=0;index<value.length;index++) values[index]=value[index];
      return {$id:id,$typed:value.constructor.name,$values:values};
    }
    if(value instanceof Set){
      for(const item of value) if(item!==null&&(typeof item==='object'||typeof item==='function')) throw new TypeError('Canonical sets must contain only primitive values.');
      const values=Array.from(value,normalize).map((item,index)=>({value:item,index,key:JSON.stringify(item)}));
      values.sort((a,b)=>a.key<b.key?-1:a.key>b.key?1:a.index-b.index);
      return {$id:id,$set:values.map(item=>item.value)};
    }
    if(value instanceof Map){
      for(const key of value.keys()) if(key!==null&&(typeof key==='object'||typeof key==='function')) throw new TypeError('Canonical map keys must be primitive values.');
      const entries=Array.from(value,([key,item],index)=>({entry:[normalize(key),normalize(item)],index}));
      entries.sort((a,b)=>{
        const left=JSON.stringify(a.entry[0]),right=JSON.stringify(b.entry[0]);
        return left<right?-1:left>right?1:a.index-b.index;
      });
      return {$id:id,$map:entries.map(item=>item.entry)};
    }
    if(Array.isArray(value)) return {$id:id,$array:value.map(normalize)};
    const result={$id:id},derived=derivedProperties(value);
    const keys=derived?new Set([...Object.keys(value),...Object.keys(derived)]):Object.keys(value);
    for(const key of Array.from(keys).sort()){
      if(!key.startsWith('_u')&&key!=='labelDraw') result[key]=normalize(derived&&Object.hasOwn(derived,key)?derived[key]:value[key]);
    }
    return result;
  };
  return stringify(normalize(root));
}

export function createDeterministicRuntime({tickMs=100}={}){
  let rng=createCountedRng(0);
  const commands={log:[],replaying:false,hashes:[]};
  const replay={on:false,cmds:[],i:0,speed:1,resume:false,toTick:0};
  const resolveReplayCommands=(tick,phase,apply)=>{
    if(!replay.on) return;
    while(replay.i<replay.cmds.length&&replay.cmds[replay.i].t<=tick&&commandPhase(replay.cmds[replay.i])===phase){
      if(apply(replay.cmds[replay.i])===false) return false;
      replay.i++;
    }
    return true;
  };
  const prepareCheckpoint=checkpoint=>{
    checkpoint=cloneRuntimeValue(checkpoint);
    const keys=(value,expected)=>plain(value)&&Object.keys(value).length===expected.length&&expected.every(key=>Object.hasOwn(value,key));
    const valid=keys(checkpoint,['version','rng','commands','replay'])&&checkpoint.version===RUNTIME_CHECKPOINT_VERSION&&keys(checkpoint.rng,['state','draws'])&&keys(checkpoint.commands,['log','replaying','hashes'])&&Array.isArray(checkpoint.commands.log)&&Array.isArray(checkpoint.commands.hashes)&&typeof checkpoint.commands.replaying==='boolean';
    if(!valid) throw new TypeError('Invalid deterministic runtime checkpoint.');
    const nextRng=createCountedRng(0),nextCommands=checkpoint.commands,nextReplay=prepareStoredReplay(checkpoint.replay);
    assertCommandOrder(nextCommands.log,'Recorded commands');
    assertHashes(nextCommands.hashes);
    nextRng.restore(checkpoint.rng);
    return {rng:nextRng,commands:nextCommands,replay:nextReplay};
  };
  return Object.freeze({
    commands,
    replay,
    seed(value){ rng=createCountedRng(value); },
    random(){ return rng.next(); },
    get rngDraws(){ return rng.draws; },
    recordCommand(tick,kind,args,phase){ commands.log.push({...{t:tick,k:kind,a:cloneRuntimeValue(args)},...(phase?{phase}:{})}); },
    resetCommands(){ commands.log=[]; commands.hashes=[]; commands.replaying=false; },
    setCommandHistory(log,hashes=commands.hashes){ const nextLog=cloneRuntimeValue(log),nextHashes=cloneRuntimeValue(hashes); if(!Array.isArray(nextLog)||nextLog.length>100_000) throw new TypeError('Command history must be a bounded array.'); assertCommandOrder(nextLog,'Command history'); assertHashes(nextHashes); commands.log=nextLog; commands.hashes=nextHashes; },
    validateReplayConfiguration(values){ return prepareReplayConfiguration(values,replay); },
    configureReplay(values){ const next=prepareReplayConfiguration(values,replay); replaceRecord(replay,next); return frozenRuntimeValue(replay); },
    takeOverReplay(){ replay.on=false; commands.log=cloneRuntimeValue(replay.cmds.slice(0,replay.i)); return frozenRuntimeValue(commands.log); },
    checkpoint(){ return {version:RUNTIME_CHECKPOINT_VERSION,rng:rng.snapshot(),commands:cloneRuntimeValue(commands),replay:cloneRuntimeValue(replay)}; },
    validateCheckpoint(checkpoint){ prepareCheckpoint(checkpoint); return true; },
    restoreCheckpoint(checkpoint){
      const next=prepareCheckpoint(checkpoint);
      rng=next.rng;
      replaceRecord(commands,next.commands);
      replaceRecord(replay,next.replay);
    },
    resolveReplayCommands,
    advanceOneTick(ports){
      if(resolveReplayCommands(ports.getTick(),'pre-systems',ports.applyReplayCommand)===false){ ports.replayCommandFailed?.(replay.cmds[replay.i],'pre-systems'); return {advanced:false,commandFailed:true,phase:'pre-systems'}; }
      ports.advanceDraft();
      if(ports.isStopped()) return {advanced:false,commandFailed:false,phase:null};
      const tick=ports.getTick()+1,simMs=tick*tickMs;
      ports.setClock(tick,simMs);
      if(tick%100===0) ports.checkpoint();
      ports.runSystems(simMs,tick);
      if(resolveReplayCommands(tick,'post-systems',ports.applyReplayCommand)===false){ ports.replayCommandFailed?.(replay.cmds[replay.i],'post-systems'); return {advanced:true,commandFailed:true,phase:'post-systems'}; }
      return {advanced:true,commandFailed:false,phase:null};
    }
  });
}
