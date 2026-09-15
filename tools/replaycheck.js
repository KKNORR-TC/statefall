'use strict';

const fs=require('fs');
const {createHash}=require('node:crypto');
const boot=require('./harness.js');

const FIXTURE_SCHEMA='statefall-replay-fixture/v1';
const DIFFICULTIES=new Set(['supereasy','easy','normal','hard','superhard','impossible']);
const MAPS=new Set(['random','land','islands_l','islands_m','islands_s','atoll','world','europe','americas','africa','asia','mideast']);
const COMMANDS=new Set(['menu','click','focus','airAuto','logAuto','autoFire','recall','recallAll','sat','accept','decline','decShare','decWar']);
const BOOLEAN_SETTINGS=['bots','noCap','quick','fog','instant','risky','endgame','billionaire','garrison','pauseBuild'];
const LIMITS={fileBytes:1024*1024,tick:10_000_000,commands:100_000,hashes:100_000,commandArgs:7,string:200};

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
    case 'sat': case 'decShare': case 'decWar': return a.length===0;
    case 'accept': return a.length===3&&id(a[0])&&['ally','nap','reqTroops','reqGold'].includes(a[1])&&finite(a[2],0,1_000_000_000);
    default: return false;
  }
}

function validateReplay(value){
  const errors=[];
  requireValue(isObject(value),'replay','must be an object',errors);
  if(!isObject(value)) return errors;
  requireValue(value.schema==null||value.schema===FIXTURE_SCHEMA,'schema',`must be ${FIXTURE_SCHEMA}`,errors);
  requireValue(value.v===1,'v','must be 1',errors);
  requireValue(typeof value.seed==='string'&&/^[A-Za-z0-9]{1,16}$/.test(value.seed),'seed','must be 1-16 ASCII letters or digits',errors);
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
    let previous=-1;
    if(value.cmds.length<=LIMITS.commands) value.cmds.forEach((command,index)=>{
      const path=`cmds[${index}]`;
      requireValue(isObject(command),path,'must be an object',errors);
      if(!isObject(command)) return;
      requireValue(Number.isSafeInteger(command.t)&&command.t>=0,path+'.t','must be a non-negative safe integer',errors);
      if(Number.isSafeInteger(command.t)){
        requireValue(command.t>=previous,path+'.t','must be in nondecreasing order',errors);
        previous=command.t;
      }
      requireValue(COMMANDS.has(command.k),path+'.k','is not a supported command',errors);
      requireValue(Array.isArray(command.a),path+'.a','must be an array',errors);
      if(COMMANDS.has(command.k)&&Array.isArray(command.a)) requireValue(validCommandArgs(command),path+'.a','has invalid arguments for '+command.k,errors);
    });
  }

  requireValue(Array.isArray(value.hashes),'hashes','must be an array',errors);
  if(Array.isArray(value.hashes)&&Number.isSafeInteger(value.tick)&&value.tick>=0){
    requireValue(value.hashes.length<=LIMITS.hashes,'hashes',`must contain at most ${LIMITS.hashes} checkpoints`,errors);
    const seen=new Set();
    if(value.hashes.length<=LIMITS.hashes) value.hashes.forEach((checkpoint,index)=>{
      const path=`hashes[${index}]`;
      requireValue(Array.isArray(checkpoint)&&checkpoint.length>=2,path,'must be [tick, hash, optional detail]',errors);
      if(!Array.isArray(checkpoint)||checkpoint.length<2) return;
      const tick=checkpoint[0];
      requireValue(Number.isSafeInteger(tick)&&tick>0&&tick%100===0&&tick<=value.tick,path+'[0]','must be a 100-tick checkpoint at or before the target',errors);
      requireValue(!seen.has(tick),path+'[0]','is duplicated',errors);
      seen.add(tick);
      requireValue(typeof checkpoint[1]==='string'&&/^[0-9a-f]{8}$/.test(checkpoint[1]),path+'[1]','must be an 8-character lowercase hex hash',errors);
      requireValue(checkpoint[2]==null||isObject(checkpoint[2]),path+'[2]','must be an object when provided',errors);
    });
    if(value.tick<=LIMITS.tick&&value.hashes.length<=LIMITS.hashes) for(let tick=100;tick<=value.tick;tick+=100) requireValue(seen.has(tick),'hashes',`is missing checkpoint ${tick}`,errors);
  }
  requireValue(value.finalHash==null||(typeof value.finalHash==='string'&&/^[0-9a-f]{8}$/.test(value.finalHash)),'finalHash','must be an 8-character lowercase hex hash',errors);
  requireValue(value.finalDigest==null||isObject(value.finalDigest),'finalDigest','must be an object when provided',errors);
  if(isObject(value.finalDigest)){
    requireValue(value.finalDigest.version==='statefall-authoritative-state/v1','finalDigest.version','must be statefall-authoritative-state/v1',errors);
    requireValue(typeof value.finalDigest.sha256==='string'&&/^[0-9a-f]{64}$/.test(value.finalDigest.sha256),'finalDigest.sha256','must be a 64-character lowercase hex digest',errors);
  }
  return errors;
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
    const game=boot({seed:replay.seed,diff:st.diff,country:null,quick:st.quick,instant:st.instant,noCap:st.noCap,garrison:st.garrison,map:st.map,countryIdx:st.country,customFlag:st.customFlag||null,customBots:st.customBots||null,allowed:st.allowed||null,troops:st.troops,gold:st.gold,teams:st.teams,bots:st.bots,fog:st.fog,risky:st.risky,endgame:st.endgame,billionaire:st.billionaire,pauseBuild:st.pauseBuild,render:false,...bootOptions});
    const S=game.S;
    S.REPLAY.on=true;
    S.REPLAY.hashv=replay.hashv;
    S.REPLAY.cmds=replay.cmds;
    S.REPLAY.i=0;
    S.REPLAY.hashes=replay.hashes;
    S.REPLAY.mismatch=false;
    S.REPLAY.speed=1;

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
      }
    }
    S.resolveReplayCommands();

    if(S.tickN!==replay.tick&&!errors.some(error=>error.startsWith('failed to reach target tick'))) errors.push(`failed to reach target tick ${replay.tick}; stopped at tick ${S.tickN}`);
    for(const tick of expected.keys()) if(!visited.has(tick)) errors.push(`checkpoint ${tick} was not reached`);
    if(commandException) errors.push(`replay command failed at tick ${commandException.command&&commandException.command.t}: ${commandException.error&&commandException.error.message||commandException.error}`);
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
    if(!errors.length) logger.log(`REPLAY MATCH ${replay.seed} ${S.tickN} ticks ${replay.cmds.length} commands ${replay.hashes.length} checkpoints final ${finalHash}`);
    return {ok:errors.length===0,errors,finalHash,tick:S.tickN,commandsApplied:S.REPLAY.i};
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

function main(argv=process.argv.slice(2)){
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
  try{ result=verifyReplay(replay,{diagnostic:args.diagnostic}); }
  catch(error){ console.error('replay verification failed: '+(error.stack||error)); return 1; }
  if(!result.ok){ console.error('REPLAY FAILED\n- '+result.errors.join('\n- ')); return 1; }
  return 0;
}

if(require.main===module) process.exitCode=main();
module.exports={FIXTURE_SCHEMA,LIMITS,parseArgs,usage,validateReplay,verifyReplay,main};
