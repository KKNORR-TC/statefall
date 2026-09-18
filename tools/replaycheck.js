'use strict';

const fs=require('fs');
const {createHash}=require('node:crypto');
const boot=require('./harness.js');
const REPLAY_CONSTRAINTS=require('../game/src/sim/replay-constraints.json');

const FIXTURE_SCHEMA='statefall-replay-fixture/v1';
const DIFFICULTIES=new Set(['supereasy','easy','normal','hard','superhard','impossible']);
const MAPS=new Set(['random','land','islands_l','islands_m','islands_s','atoll','world','europe','americas','africa','asia','mideast']);
const COMMANDS=new Set(['menu','click','focus','airAuto','logAuto','autoFire','recall','recallAll','sat','accept','decline','decShare','decWar','continueAfterEnd','surrender']);
const BOOLEAN_SETTINGS=['bots','noCap','quick','fog','instant','risky','endgame','billionaire','garrison','pauseBuild'];
const MULTIPLAYER_SEED_PATTERN=new RegExp(REPLAY_CONSTRAINTS.multiplayerSeedPattern);
const LIMITS={fileBytes:REPLAY_CONSTRAINTS.maxFileBytes,tick:10_000_000,commands:100_000,hashes:100_000,commandArgs:7,string:200};

function usage(){
  return 'Usage: node tools/replaycheck.js [--diagnostic] <replay.state>\n'+
    'Strictly verifies every command, 100-tick checkpoint, target tick, and optional final metadata.\n'+
    '  -d, --diagnostic  print recorded state details at the first mismatch\n'+
    '  -h, --help        show this help';
}

function isObject(value){ return value!==null&&typeof value==='object'&&!Array.isArray(value); }
function requireValue(ok,path,message,errors){ if(!ok) errors.push(path+' '+message); }
function finite(value,min=-Infinity,max=Infinity){ return Number.isFinite(value)&&value>=min&&value<=max; }
function validCommandArgs(command){
  const a=command.a;
  if(!Array.isArray(a)||a.length>LIMITS.commandArgs) return false;
  const id=value=>Number.isSafeInteger(value)&&value>=0&&value<=1_000_000;
  switch(command.k){
    case 'menu': return a.length===7&&isObject(a[0])&&typeof a[0].act==='string'&&a[0].act.length<=40&&id(a[1])&&Array.isArray(a[2])&&a[2].length<=10_000&&a[2].every(id)&&Number.isSafeInteger(a[3])&&a[3]>=-1&&a[3]<=1_000_000&&a.slice(4).every(x=>finite(x,0,1_000_000));
    case 'click': return a.length===2&&id(a[0])&&isObject(a[1])&&finite(a[1].ratio,0,100)&&(a[1].pick==null||isObject(a[1].pick))&&(a[1].build==null||typeof a[1].build==='string');
    case 'focus': return a.length===1&&finite(a[0],0,1);
    case 'airAuto': case 'logAuto': case 'autoFire': return a.length===1&&typeof a[0]==='boolean';
    case 'recall': case 'decline': return a.length===1&&id(a[0]);
    case 'recallAll': return a.length===1&&(a[0]==='all'||a[0]==='dmg');
    case 'sat': case 'decShare': case 'decWar': case 'surrender': return a.length===0;
    case 'continueAfterEnd': return a.length===1&&typeof a[0]==='boolean';
    case 'accept': return a.length===3&&id(a[0])&&['ally','nap','reqTroops','reqGold'].includes(a[1])&&finite(a[2],0,1_000_000_000);
    default: return false;
  }
}

function validateReplay(value,{requireCanonicalCheckpoints=false}={}){
  const errors=[];
  requireValue(isObject(value),'replay','must be an object',errors);
  if(!isObject(value)) return errors;
  const canonicalCheckpointsRequired=requireCanonicalCheckpoints||value.requiresCanonicalCheckpoints===true;
  requireValue(value.requiresCanonicalCheckpoints==null||typeof value.requiresCanonicalCheckpoints==='boolean','requiresCanonicalCheckpoints','must be boolean when provided',errors);
  requireValue(value.schema==null||value.schema===FIXTURE_SCHEMA,'schema',`must be ${FIXTURE_SCHEMA}`,errors);
  requireValue(value.v===1,'v','must be 1',errors);
  requireValue(typeof value.seed==='string'&&(value.multiplayer?MULTIPLAYER_SEED_PATTERN:/^[A-Za-z0-9]{1,16}$/).test(value.seed),'seed',value.multiplayer?'must be a bounded multiplayer seed':'must be 1-16 ASCII letters or digits',errors);
  requireValue(value.hashv===1||value.hashv===2,'hashv','must be 1 or 2',errors);
  requireValue(Number.isSafeInteger(value.tick)&&value.tick>=0&&value.tick<=LIMITS.tick,'tick',`must be a non-negative safe integer no greater than ${LIMITS.tick}`,errors);

  const settings=value.settings;
  requireValue(isObject(settings),'settings','must be an object',errors);
  if(isObject(settings)){
    requireValue(DIFFICULTIES.has(settings.diff),'settings.diff','is not supported',errors);
    requireValue(MAPS.has(settings.map),'settings.map','is not supported',errors);
    requireValue(Number.isFinite(settings.troops)&&settings.troops>=1,'settings.troops','must be a positive number',errors);
    requireValue(Number.isFinite(settings.gold)&&settings.gold>=0,'settings.gold','must be a non-negative number',errors);
    requireValue(Number.isInteger(settings.teams)&&settings.teams>=0&&settings.teams<=4,'settings.teams','must be an integer from 0 to 4',errors);
    requireValue(settings.country===null||(Number.isInteger(settings.country)&&settings.country>=0),'settings.country','must be null or a non-negative integer',errors);
    for(const key of BOOLEAN_SETTINGS) requireValue(typeof settings[key]==='boolean','settings.'+key,'must be boolean',errors);
    requireValue(settings.allowed==null||(Array.isArray(settings.allowed)&&settings.allowed.length<=64&&settings.allowed.every(x=>typeof x==='string'&&x.length<=40)),'settings.allowed','must contain at most 64 short strings or be null',errors);
    requireValue(settings.customBots==null||(Array.isArray(settings.customBots)&&settings.customBots.length<=9),'settings.customBots','must contain at most 9 entries or be null',errors);
    requireValue(settings.customFlag==null||isObject(settings.customFlag),'settings.customFlag','must be an object or null',errors);
  }

  requireValue(Array.isArray(value.cmds),'cmds','must be an array',errors);
  if(Array.isArray(value.cmds)){
    requireValue(value.cmds.length<=LIMITS.commands,'cmds',`must contain at most ${LIMITS.commands} commands`,errors);
    let previous=-1,previousPhase=-1;
    if(value.cmds.length<=LIMITS.commands) value.cmds.forEach((command,index)=>{
      const path=`cmds[${index}]`;
      requireValue(isObject(command),path,'must be an object',errors);
      if(!isObject(command)) return;
      requireValue(Number.isSafeInteger(command.t)&&command.t>=0,path+'.t','must be a non-negative safe integer',errors);
      requireValue(!Number.isSafeInteger(value.tick)||!Number.isSafeInteger(command.t)||command.t<=value.tick,path+'.t','must not exceed the replay target',errors);
      if(Number.isSafeInteger(command.t)){
        const phase=command.phase==='post-systems'?1:0;
        requireValue(command.t>previous||command.t===previous&&phase>=previousPhase,path+'.t','must be in nondecreasing tick/phase order',errors);
        previous=command.t; previousPhase=phase;
      }
      requireValue(COMMANDS.has(command.k),path+'.k','is not a supported command',errors);
      requireValue(command.k!=='surrender'||isObject(value.multiplayer),path+'.k','surrender requires multiplayer metadata',errors);
      requireValue(command.p==null||(Number.isSafeInteger(command.p)&&command.p>=0&&command.p<=1_000_000),path+'.p','must be a non-negative actor ID when provided',errors);
      requireValue(Array.isArray(command.a),path+'.a','must be an array',errors);
      requireValue((command.k==='continueAfterEnd')===(command.phase==='post-systems'),path+'.phase','must be post-systems only for continueAfterEnd',errors);
      if(COMMANDS.has(command.k)&&Array.isArray(command.a)) requireValue(validCommandArgs(command),path+'.a','has invalid arguments for '+command.k,errors);
    });
  }

  requireValue(Array.isArray(value.hashes),'hashes','must be an array',errors);
  if(Array.isArray(value.hashes)&&Number.isSafeInteger(value.tick)&&value.tick>=0){
    requireValue(value.hashes.length<=LIMITS.hashes,'hashes',`must contain at most ${LIMITS.hashes} checkpoints`,errors);
    const seen=new Set();
    if(value.hashes.length<=LIMITS.hashes) value.hashes.forEach((checkpoint,index)=>{
      const path=`hashes[${index}]`;
      requireValue(Array.isArray(checkpoint)&&checkpoint.length>=2&&checkpoint.length<=3,path,'must be [tick, hash, optional detail]',errors);
      if(!Array.isArray(checkpoint)||checkpoint.length<2) return;
      const tick=checkpoint[0];
      requireValue(Number.isSafeInteger(tick)&&tick>0&&tick%100===0&&tick<=value.tick,path+'[0]','must be a 100-tick checkpoint at or before the target',errors);
      requireValue(!seen.has(tick),path+'[0]','is duplicated',errors);
      seen.add(tick);
      requireValue(typeof checkpoint[1]==='string'&&/^[0-9a-f]{8}$/.test(checkpoint[1]),path+'[1]','must be an 8-character lowercase hex hash',errors);
      requireValue(checkpoint[2]==null||isObject(checkpoint[2]),path+'[2]','must be an object when provided',errors);
      const detail=checkpoint[2],canonical=detail&&detail.canonical;
      if(canonicalCheckpointsRequired||canonical!=null||detail&&['rngDraws','commandCount','replayCursor'].some(key=>Object.hasOwn(detail,key))){
        requireValue(isObject(canonical),path+'[2].canonical','must be an object',errors);
        if(isObject(canonical)){
          requireValue(canonical.version==='statefall-authoritative-state/v1',path+'[2].canonical.version','must be statefall-authoritative-state/v1',errors);
          requireValue(typeof canonical.sha256==='string'&&/^[0-9a-f]{64}$/.test(canonical.sha256),path+'[2].canonical.sha256','must be a 64-character lowercase hex digest',errors);
        }
        requireValue(Number.isSafeInteger(detail&&detail.rngDraws)&&detail.rngDraws>=0,path+'[2].rngDraws','must be a non-negative safe integer',errors);
        requireValue(Number.isSafeInteger(detail&&detail.commandCount)&&detail.commandCount>=0,path+'[2].commandCount','must be a non-negative safe integer',errors);
        requireValue((detail&&detail.replayCursor===null)||(Number.isSafeInteger(detail&&detail.replayCursor)&&detail.replayCursor>=0),path+'[2].replayCursor','must be null or a non-negative safe integer',errors);
      }
    });
    if(value.tick<=LIMITS.tick&&value.hashes.length<=LIMITS.hashes) for(let tick=100;tick<=value.tick;tick+=100) requireValue(seen.has(tick),'hashes',`is missing checkpoint ${tick}`,errors);
  }
  requireValue(value.finalHash==null||(typeof value.finalHash==='string'&&/^[0-9a-f]{8}$/.test(value.finalHash)),'finalHash','must be an 8-character lowercase hex hash',errors);
  requireValue(value.finalDigest==null||isObject(value.finalDigest),'finalDigest','must be an object when provided',errors);
  if(isObject(value.finalDigest)){
    requireValue(value.finalDigest.version==='statefall-authoritative-state/v1','finalDigest.version','must be statefall-authoritative-state/v1',errors);
    requireValue(typeof value.finalDigest.sha256==='string'&&/^[0-9a-f]{64}$/.test(value.finalDigest.sha256),'finalDigest.sha256','must be a 64-character lowercase hex digest',errors);
  }
  if(value.final!=null){
    requireValue(isObject(value.final),'final','must be an object when provided',errors);
    if(isObject(value.final)){
      requireValue(value.final.tick===value.tick,'final.tick','must equal tick',errors);
      requireValue(typeof value.final.legacyHash==='string'&&/^[0-9a-f]{8}$/.test(value.final.legacyHash),'final.legacyHash','must be an 8-character lowercase hex hash',errors);
      requireValue(isObject(value.final.canonical)&&value.final.canonical.version==='statefall-authoritative-state/v1','final.canonical','must use statefall-authoritative-state/v1',errors);
      requireValue(isObject(value.final.canonical)&&typeof value.final.canonical.sha256==='string'&&/^[0-9a-f]{64}$/.test(value.final.canonical.sha256),'final.canonical.sha256','must be a 64-character lowercase hex digest',errors);
      requireValue(Number.isSafeInteger(value.final.rngDraws)&&value.final.rngDraws>=0,'final.rngDraws','must be a non-negative safe integer',errors);
      requireValue(Number.isSafeInteger(value.final.commandCount)&&value.final.commandCount>=0,'final.commandCount','must be a non-negative safe integer',errors);
      requireValue(value.final.replayCursor===null||Number.isSafeInteger(value.final.replayCursor)&&value.final.replayCursor>=0,'final.replayCursor','must be null or a non-negative safe integer',errors);
      requireValue(!Array.isArray(value.cmds)||value.final.commandCount===value.cmds.length,'final.commandCount','must equal the command count',errors);
      requireValue(value.final.replayCursor===null||!Array.isArray(value.cmds)||value.final.replayCursor<=value.cmds.length,'final.replayCursor','must not exceed the command count',errors);
    }
  }
  return errors;
}

async function verifyMultiplayerReplay(replay,{logger=console}={}){
  const errors=[];
  try{
    const [{createMultiplayerReplayEngine},{deriveDuelResult}]=await Promise.all([import('../game/src/multiplayer/proof-engine.mjs'),import('../game/src/multiplayer/relay/lockstep-client.mjs')]);
    const engine=createMultiplayerReplayEngine(replay); engine.start();
    let stalled=0;
    while(engine.presentation().state.clock.tickN<replay.tick){ const before=engine.presentation().state.clock.tickN; engine.tick(); const after=engine.presentation().state.clock.tickN; stalled=after===before?stalled+1:0; if(stalled>=2){ errors.push(`failed to reach target tick ${replay.tick}; simulation stalled at tick ${after}`); break; } }
    engine.tick();
    const metadata=engine.replayMetadata(),runtime=engine.presentation().runtime.replay;
    if(metadata.legacyHash!==replay.final.legacyHash) errors.push(`final state mismatch: recorded ${replay.final.legacyHash}, replay ${metadata.legacyHash}`);
    if(metadata.canonical.sha256!==replay.final.canonical.sha256) errors.push(`final canonical digest mismatch: recorded ${replay.final.canonical.sha256}, replay ${metadata.canonical.sha256}`);
    if(metadata.rngDraws!==replay.final.rngDraws) errors.push(`final RNG count mismatch: recorded ${replay.final.rngDraws}, replay ${metadata.rngDraws}`);
    if(metadata.commandCount!==replay.final.commandCount||metadata.replayCursor!==replay.final.replayCursor) errors.push('final command count/cursor mismatch');
    if(runtime.mismatch) errors.push(runtime.why||'engine reported multiplayer replay divergence');
    const result=deriveDuelResult(engine);
    if(JSON.stringify(result.standings)!==JSON.stringify(replay.result.standings)||JSON.stringify(result.winnerSeatIds)!==JSON.stringify(replay.result.winnerSeatIds)) errors.push('final standings mismatch');
    if(!errors.length) logger.log(`REPLAY MATCH ${replay.seed} ${replay.tick} ticks ${replay.cmds.length} commands ${replay.hashes.length} checkpoints final ${metadata.legacyHash}`);
    return {ok:errors.length===0,errors,finalHash:metadata.legacyHash,finalDigest:metadata.canonical,rngDraws:metadata.rngDraws,tick:engine.presentation().state.clock.tickN,commandsApplied:metadata.replayCursor};
  }catch(error){ return {ok:false,errors:[error.stack||String(error)]}; }
}

function verifyReplay(replay,{diagnostic=false,logger=console,bootOptions={}}={}){
  const errors=[];
  const st=replay.settings;
  const originalWarn=console.warn;
  let commandException=null;
  let divergence=null;
  console.warn=(...args)=>{
    if(args[0]==='[statefall] replay command failed'&&!commandException) commandException={command:args[1],error:args[2]};
    if(args[0]==='[statefall] replay diverged at tick'&&!divergence) divergence={tick:args[1],recorded:args[2],actual:args[3],why:args[4]};
    if(diagnostic) originalWarn.apply(console,args);
  };

  try{
    const game=boot({seed:replay.seed,diff:st.diff,country:null,quick:st.quick,instant:st.instant,noCap:st.noCap,garrison:st.garrison,map:st.map,countryIdx:st.country,customFlag:st.customFlag||null,customBots:st.customBots||null,allowed:st.allowed||null,troops:st.troops,gold:st.gold,teams:st.teams,bots:st.bots,fog:st.fog,risky:st.risky,endgame:st.endgame,billionaire:st.billionaire,pauseBuild:st.pauseBuild,allowEnd:true,render:false,...bootOptions});
    const S=game.S;
    S.REPLAY.on=true;
    S.REPLAY.hashv=replay.hashv;
    S.REPLAY.cmds=replay.cmds;
    S.REPLAY.i=0;
    S.REPLAY.hashes=replay.hashes;
    S.REPLAY.mismatch=false;
    S.REPLAY.speed=1;
    S.REPLAY.toTick=replay.tick;

    const expected=new Map(replay.hashes.map(checkpoint=>[checkpoint[0],checkpoint]));
    const visited=new Set();
    let stalled=0;
    while(S.tickN<replay.tick){
      const before=S.tickN;
      try{ game.tick(); }catch(error){ errors.push(`simulation exception before target tick: ${error.stack||error}`); break; }
      if(S.tickN===before){
        stalled++;
        if(stalled>=2){ errors.push(`failed to reach target tick ${replay.tick}; simulation stalled at tick ${S.tickN}`); break; }
      }else stalled=0;
      const checkpoint=expected.get(S.tickN);
      if(checkpoint){
        visited.add(S.tickN);
        const detail=checkpoint[2];
        if(detail&&detail.canonical){
          if(S.stateOracleVersion!==detail.canonical.version||typeof S.serializeCanonicalState!=='function') errors.push(`checkpoint ${S.tickN} canonical state oracle ${detail.canonical.version} is unavailable`);
          else {
            const digest=createHash('sha256').update(S.serializeCanonicalState()).digest('hex');
            if(digest!==detail.canonical.sha256) errors.push(`checkpoint ${S.tickN} canonical digest mismatch: recorded ${detail.canonical.sha256}, replay ${digest}`);
          }
          if(S.srandN!==detail.rngDraws) errors.push(`checkpoint ${S.tickN} RNG count mismatch: recorded ${detail.rngDraws}, replay ${S.srandN}`);
          if(S.REPLAY.i!==detail.commandCount) errors.push(`checkpoint ${S.tickN} command count mismatch: recorded ${detail.commandCount}, replay ${S.REPLAY.i}`);
          if(detail.replayCursor!=null&&S.REPLAY.i!==detail.replayCursor) errors.push(`checkpoint ${S.tickN} replay cursor mismatch: recorded ${detail.replayCursor}, replay ${S.REPLAY.i}`);
        }
      }
    }
    S.resolveReplayCommands();

    if(S.tickN!==replay.tick&&!errors.some(error=>error.startsWith('failed to reach target tick'))) errors.push(`failed to reach target tick ${replay.tick}; stopped at tick ${S.tickN}`);
    for(const tick of expected.keys()) if(!visited.has(tick)) errors.push(`checkpoint ${tick} was not reached`);
    if(commandException) errors.push(`replay command failed at tick ${commandException.command&&commandException.command.t}: ${commandException.error&&commandException.error.message||commandException.error}`);
    else if(!S.REPLAY.on&&S.REPLAY.i<replay.cmds.length) errors.push(`replay command failed at tick ${replay.cmds[S.REPLAY.i].t}`);
    if(S.REPLAY.i!==replay.cmds.length) errors.push(`unapplied commands: applied ${S.REPLAY.i} of ${replay.cmds.length}`);
    if(S.REPLAY.mismatch){
      let message=divergence?`checkpoint ${divergence.tick} diverged: recorded ${divergence.recorded}, replay ${divergence.actual}`:`engine reported replay divergence${S.REPLAY.divTick!=null?' at tick '+S.REPLAY.divTick:''}`;
      if(diagnostic&&(divergence&&divergence.why||S.REPLAY.why)) message+='; '+(divergence&&divergence.why||S.REPLAY.why);
      errors.push(message);
    }
    const finalHash=S.stateHash();
    if(replay.finalHash!=null&&finalHash!==replay.finalHash) errors.push(`final state mismatch: recorded ${replay.finalHash}, replay ${finalHash}`);
    if(replay.finalDigest!=null){
      if(S.stateOracleVersion!==replay.finalDigest.version||typeof S.serializeCanonicalState!=='function') errors.push(`canonical state oracle ${replay.finalDigest.version} is unavailable`);
      else {
        const digest=createHash('sha256').update(S.serializeCanonicalState()).digest('hex');
        if(digest!==replay.finalDigest.sha256) errors.push(`final canonical digest mismatch: recorded ${replay.finalDigest.sha256}, replay ${digest}`);
      }
    }
    if(replay.final!=null){
      if(finalHash!==replay.final.legacyHash) errors.push(`final state mismatch: recorded ${replay.final.legacyHash}, replay ${finalHash}`);
      if(S.stateOracleVersion!==replay.final.canonical.version||typeof S.serializeCanonicalState!=='function') errors.push(`canonical state oracle ${replay.final.canonical.version} is unavailable`);
      else {
        const digest=createHash('sha256').update(S.serializeCanonicalState()).digest('hex');
        if(digest!==replay.final.canonical.sha256) errors.push(`final canonical digest mismatch: recorded ${replay.final.canonical.sha256}, replay ${digest}`);
      }
      if(S.srandN!==replay.final.rngDraws) errors.push(`final RNG count mismatch: recorded ${replay.final.rngDraws}, replay ${S.srandN}`);
      if(replay.cmds.length!==replay.final.commandCount) errors.push(`final command count mismatch: recorded ${replay.final.commandCount}, replay ${replay.cmds.length}`);
      const expectedCursor=replay.final.replayCursor==null?replay.final.commandCount:replay.final.replayCursor;
      if(S.REPLAY.i!==expectedCursor) errors.push(`final replay cursor mismatch: recorded ${expectedCursor}, replay ${S.REPLAY.i}`);
    }
    if(!errors.length) logger.log(`REPLAY MATCH ${replay.seed} ${S.tickN} ticks ${replay.cmds.length} commands ${replay.hashes.length} checkpoints final ${finalHash}`);
    const finalDigest=S.stateOracleVersion&&typeof S.serializeCanonicalState==='function'?{version:S.stateOracleVersion,sha256:createHash('sha256').update(S.serializeCanonicalState()).digest('hex')}:null;
    return {ok:errors.length===0,errors,finalHash,finalDigest,rngDraws:S.srandN,tick:S.tickN,commandsApplied:S.REPLAY.i};
  }finally{
    console.warn=originalWarn;
  }
}

function parseArgs(argv){
  let diagnostic=false,file=null;
  for(const arg of argv){
    if(arg==='-h'||arg==='--help') return {help:true};
    if(arg==='-d'||arg==='--diagnostic') diagnostic=true;
    else if(arg.startsWith('-')) return {error:`unknown option: ${arg}`};
    else if(file) return {error:'only one replay file may be supplied'};
    else file=arg;
  }
  return file?{file,diagnostic}:{error:'missing replay file'};
}

async function main(argv=process.argv.slice(2)){
  const args=parseArgs(argv);
  if(args.help){ console.log(usage()); return 0; }
  if(args.error){ console.error(args.error+'\n'+usage()); return 2; }
  let replay;
  try{
    const stat=fs.statSync(args.file);
    if(!stat.isFile()||stat.size>LIMITS.fileBytes) throw new Error(`file must be at most ${LIMITS.fileBytes} bytes`);
    replay=JSON.parse(fs.readFileSync(args.file,'utf8'));
  }
  catch(error){ console.error(`could not read replay ${args.file}: ${error.message}`); return 2; }
  const schemaErrors=validateReplay(replay);
  if(schemaErrors.length){ console.error('invalid replay:\n- '+schemaErrors.join('\n- ')); return 2; }
  let result;
  try{ result=replay.multiplayer?await verifyMultiplayerReplay(replay):verifyReplay(replay,{diagnostic:args.diagnostic}); }
  catch(error){ console.error('replay verification failed: '+(error.stack||error)); return 1; }
  if(!result.ok){ console.error('REPLAY FAILED\n- '+result.errors.join('\n- ')); return 1; }
  return 0;
}

if(require.main===module) main().then(code=>{ process.exitCode=code; }).catch(error=>{ console.error(error); process.exitCode=1; });
module.exports={FIXTURE_SCHEMA,LIMITS,parseArgs,usage,validateReplay,verifyReplay,verifyMultiplayerReplay,main};
