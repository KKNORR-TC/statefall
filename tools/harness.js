'use strict';

// Synchronous CommonJS adapter for Node 22's require(ESM) support.
const {createEngine,ENGINE_TEST_DIAGNOSTICS}=require('../game/src/sim/engine.mjs');

const DEFAULT_FLAG=[['h','#ffffff','#0038a8']];

function replayName(value){
  return String(value||'').replace(/[<>&"]/g,'').replace(/[\u0000-\u001f\u007f]/g,'').replace(/\s+/g,' ').trim().slice(0,40)||'Unnamed nation';
}

function replayLayers(value){
  const layers=Array.isArray(value)&&value.length&&value.length<=8?value:null;
  const color=value=>typeof value==='string'&&/^#[0-9a-f]{6}$/i.test(value);
  const number=(value,min,max)=>Number.isFinite(+value)&&+value>=min&&+value<=max;
  const emblems=new Set(['anchor','warship','battleship','sub','fighter','bomber','missile','gun','city','factory','radar','satellite','shield','samstar','eagle','lion','sun','crescent','crown','sword','laurel','tree','mountain','tower','torch']);
  if(!layers) return DEFAULT_FLAG.map(layer=>layer.slice());
  const valid=layer=>{
    if(!Array.isArray(layer)||typeof layer[0]!=='string') return false;
    switch(layer[0]){
      case 'h': case 'v': return layer.length>=2&&layer.length<=4&&layer.slice(1).every(color);
      case 'diag': return layer.length===3&&color(layer[1])&&color(layer[2]);
      case 'rect': return layer.length===6&&color(layer[1])&&layer.slice(2).every(value=>number(value,0,1));
      case 'disc': return layer.length===5&&color(layer[1])&&layer.slice(2).every(value=>number(value,0,1));
      case 'ring': return layer.length===6&&color(layer[1])&&layer.slice(2).every(value=>number(value,0,1));
      case 'star': return (layer.length===5||layer.length===6)&&color(layer[1])&&number(layer[2],0,1)&&number(layer[3],0,1)&&number(layer[4],0,.6)&&(layer.length===5||number(layer[5],3,12));
      case 'cross': return layer.length===4&&color(layer[1])&&number(layer[2],0,.6)&&number(layer[3],0,1);
      case 'sal': return layer.length===3&&color(layer[1])&&number(layer[2],0,.6);
      case 'tri': return layer.length>=5&&layer.length<=8&&color(layer[1])&&layer.slice(2).every(point=>Array.isArray(point)&&point.length===2&&number(point[0],0,1)&&number(point[1],0,1));
      case 'emb': return (layer.length===6||layer.length===7)&&color(layer[1])&&emblems.has(layer[2])&&number(layer[3],0,1)&&number(layer[4],0,1)&&number(layer[5],.05,.6)&&(layer.length===6||layer[6]==null||color(layer[6]));
      default: return false;
    }
  };
  return layers.every(valid)?layers:DEFAULT_FLAG.map(layer=>layer.slice());
}

function replayIdentity(value,slot){
  const source=value&&typeof value==='object'?value:{};
  return {
    name:replayName(source.name),
    layers:replayLayers(source.layers),
    userId:Number.isInteger(+source.userId)?+source.userId:0,
    ...(slot==null?{}:{slot:Math.max(0,Math.min(8,Number.isInteger(+source.slot)?+source.slot:slot))})
  };
}

module.exports=function boot(opts={}){
  const sourceFile=opts.file||process.env.GAME;
  if(sourceFile) throw new Error('Custom simulation source files are unsupported; tools/harness.js loads game/src/sim/engine.mjs directly.');
  if(opts.render!==undefined&&opts.render!==false) throw new Error('Harness rendering is unsupported; use the browser/Playwright renderer capture path.');

  const W=opts.gridW??720,H=opts.gridH??414;
  const settings={
    troops:opts.troops??120,gold:opts.gold??100,bots:!!opts.bots,teams:opts.teams??0,
    noCap:!!opts.noCap,map:opts.map||'random',quick:!!opts.quick,fog:!!opts.fog,
    instant:!!opts.instant,risky:!!opts.risky,endgame:!!opts.endgame,
    billionaire:!!opts.billionaire,garrison:!!opts.garrison,pauseBuild:!!opts.pauseBuild,
    seed:opts.seed||'TRAILER',customBots:null
  };
  if(opts.customBots) settings.customBots=opts.customBots.slice(0,9).map((bot,index)=>replayIdentity(bot,index));

  let selectedFlag=null;
  const sink=event=>{
    if(event.type==='warn') console.warn(...event.args);
    if(typeof opts.eventSink==='function') opts.eventSink(event);
  };
  const engine=createEngine({
    W,H,tickMs:100,settings,difficulty:opts.diff||'hard',
    ...(opts.frenzy?{structureBuildDelay:1200,vehicleBuildDelay:900}:{}),
    ...(Array.isArray(opts.allowed)?{allowed:opts.allowed}:{}),
    endEnabled:!!opts.allowEnd,
    [ENGINE_TEST_DIAGNOSTICS]:true
  },{eventSink:sink});
  const {state,runtime,systems,rules}=engine.compatibility;
  const {map,actors,fog,diplomacy,lifecycle}=state;
  const countries=systems.worldSetup;

  if(opts.customFlag) selectedFlag={...replayIdentity(opts.customFlag),idx:-1,custom:true};
  else if(opts.countryIdx!=null&&opts.countryIdx>=0) selectedFlag=countries.countryByIdx(opts.countryIdx);
  else if(opts.country){
    const index=engine.compatibility.countries.findIndex(country=>country[0]===opts.country);
    if(index>=0) selectedFlag=countries.countryByIdx(index);
  }

  let buildMode=null;
  const applySettings=values=>{
    const next={};
    for(const key of ['garrison','quick','risky','endgame','fog','instant','billionaire','noCap','bots','pauseBuild']) if(Object.hasOwn(values,key)) next[key]=!!values[key];
    for(const key of ['troops','gold','teams','map']) if(Object.hasOwn(values,key)) next[key]=values[key];
    if(Object.hasOwn(values,'customBots')) next.customBots=Array.isArray(values.customBots)?values.customBots.slice(0,9).map((bot,index)=>replayIdentity(bot,index)):null;
    const config={settings:next};
    if(values.diff) config.difficulty=values.diff;
    if(Array.isArray(values.allowed)) config.allowed=values.allowed;
    if(values.customFlag&&values.customFlag.layers) selectedFlag={...replayIdentity(values.customFlag),idx:-1,custom:true};
    else if(values.country!=null) selectedFlag=countries.countryByIdx(values.country);
    if(selectedFlag) config.chosenFlag=selectedFlag;
    engine.reset();
    engine.configure(config);
    return S;
  };
  const dispatch=()=>engine.dispatchEvents();
  const run=operation=>{ try{ return operation(); }finally{ dispatch(); } };
  const issueClick=(tile,env,actorId)=>run(()=>engine.issue({kind:'click',args:[tile,env||{ratio:50,pick:null,build:buildMode}],actor:actorId}));
  const restart=()=>run(()=>engine.start({chosenFlag:selectedFlag}));

  const S={
    get me(){ return engine.compatibility.getMe(); },
    get players(){ return actors.players; }, get structures(){ return actors.structures; },
    get warships(){ return actors.warships; }, get transports(){ return actors.transports; },
    get missiles(){ return actors.missiles; }, get attacks(){ return actors.attacks; },
    get aircraft(){ return actors.aircraft; }, get W(){ return W; }, get H(){ return H; },
    get tickN(){ return state.clock.tickN; }, get owner(){ return map.owner; }, get land(){ return map.land; },
    get landCount(){ return map.landCount; }, get difficulty(){ return state.match.difficulty; },
    set difficulty(value){ state.setDifficulty(value); }, get START(){ return state.rules.settings; },
    get CMD(){ return runtime.commands; }, get REPLAY(){ return runtime.replay; },
    get srandN(){ return runtime.rngDraws; }, get STRUCT(){ return rules.STRUCT; },
    get SHIPS(){ return rules.SHIPS; }, get AIR(){ return rules.AIR; },
    get stateOracleVersion(){ return engine.compatibility.stateOracle.version; },
    get transientState(){ return {planes:actors.planes.length,satUntil:fog.satUntil,satCool:fog.satCool,planeCool:fog.planeCool,vis:fog.vis,radarLayer:fog.radarLayer,myBorders:[...fog.myBorders]}; },
    get diplomacyState(){ return {hostile:{...diplomacy.hostile},proposals:diplomacy.proposals.map(value=>({...value}))}; },
    get draft(){ return state.draft.draft; },
    get userPaused(){ return lifecycle.userPaused; }, set userPaused(value){ state.setLifecycle('userPaused',value); },
    get paused(){ return lifecycle.paused; }, set paused(value){ state.setLifecycle('paused',value); },
    get over(){ return lifecycle.over; }, set over(value){ state.setLifecycle('over',value); },
    idx:(x,y)=>y*W+x, inb:(x,y)=>x>=0&&y>=0&&x<W&&y<H,
    ownTilesOf:systems.landCombat.ownTilesOf, coastTilesOf:systems.landCombat.coastTilesOf,
    isCoast:systems.landCombat.isCoast, centroid:engine.compatibility.calculateCentroid,
    issue:(...args)=>run(()=>engine.issue(...args)), issueFor:(actorId,kind,...args)=>run(()=>engine.issue({kind,args,actor:actorId})),
    issueClick, issueMenu:(d,t,selIds,siteT,ratioV,aidGold,aidTroops,actorId)=>run(()=>engine.issue({kind:'menu',args:[d,t,selIds,siteT,ratioV,aidGold,aidTroops],actor:actorId})),
    replayApply:systems.commandRouter.replayApply, resolveReplayCommands:systems.commandRouter.resolveReplayCommands,
    stateHash:engine.stateHash, serializeCanonicalState:engine.serializeCanonical,
    checkStateInvariants:engine.checkInvariants, setBuild:value=>{ buildMode=value; },
    applySettings, resetWorld:engine.reset, restart,
    seededTierOrder:systems.naval.seededTierOrder, cruiseTargets:systems.naval.cruiseTargets,
    dirtyTransientState:()=>{ actors.planes.push({test:true}); state.setFogScalar('satUntil',11); state.setFogScalar('satCool',12); state.setFogScalar('planeCool',13); state.replaceFogBuffer('vis',new Uint8Array([1])); state.replaceFogBuffer('radarLayer',new Uint8Array([1])); state.replaceMyBorders([7]); },
    dirtyDiplomacyState:()=>{ diplomacy.hostile['0,1']=123; diplomacy.proposals.push({from:1,type:'nap',until:999}); },
    takeOverReplay:engine.takeOverReplay, drainEvents:engine.drainEvents
  };

  restart();
  return {S,engine,tick:(count=1)=>{ for(let index=0;index<count;index++) run(()=>engine.tick()); }};
};
