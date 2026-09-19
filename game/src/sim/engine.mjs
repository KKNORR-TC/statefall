import {MAPS,NE_ALIAS} from '../config/maps.js';
import {COUNTRIES} from '../config/flags.mjs';
import {createAuthoritativeState} from './authoritative-state.mjs';
import {createDeterministicRuntime} from './deterministic-runtime.mjs';
import {createStateOracle} from './state-oracle.mjs';
import {resetAuthoritativeState} from './state-reset.mjs';
import {createSimulationPorts} from './simulation-ports.mjs';
import {createCompatibilityEffectProducer} from './compatibility-effects.mjs';
import {createMapGeneration} from './map-generation.mjs';
import {createWorldSetup} from './world-setup.mjs';
import {createMatchFlow} from './match-flow.mjs';
import {createDiplomacySystem} from './systems/diplomacy.mjs';
import {createLandCombatSystem} from './systems/land-combat.mjs';
import {createStructuresSystem} from './systems/structures.mjs';
import {createMissilesSystem} from './systems/missiles.mjs';
import {createFogSystem} from './systems/fog.mjs';
import {createAirSystem} from './systems/air.mjs';
import {createNavalSystem} from './systems/naval.mjs';
import {createLogisticsSystem} from './systems/logistics.mjs';
import {createAiSystem} from './systems/ai.mjs';
import {createEconomySystem} from './systems/economy.mjs';
import {createCommandRouter} from './command-router.mjs';
import {createWorldLoop} from './world-loop.mjs';
import {createEngineCheckpointManager} from './engine-checkpoint.mjs';
import {calculateCentroid,calculatePlayerLabelPositions} from './geometry.mjs';
import * as R from './rules.mjs';
import {ownAuthorityValue} from './authority-value.mjs';
import {assertCommand} from './command-schema.mjs';
import {assertAllowedRules,assertDifficulty,assertIdentity,SETTING_NAMES,validateSettingsCandidate} from './configuration-schema.mjs';
import {assertReplaySchema} from './replay-schema.mjs';
import {MULTIPLAYER_PROOF} from '../multiplayer/proof-capability.mjs';

const DEFAULT_SETTINGS={troops:120,gold:100,bots:false,teams:0,noCap:false,map:'random',quick:false,fog:false,instant:false,risky:false,endgame:false,billionaire:false,garrison:false,pauseBuild:false,seed:0};
const DEFAULT_ALLOWED=['city','factory','port','sam','silo','fort','command','shield','battery','shore','bertha','airfield','flightops','subbase','troopcmd','engcmd','radar','lradar','satellite','jammer','scout','sub','hunter','rship','privateer','warship','cruiser','battleship','missile'];
const DEFAULT_TEAM_NAMES=['Red','Blue','Green','Gold'];
export const ENGINE_TEST_DIAGNOSTICS=Symbol('statefall.engine.testDiagnostics');

function createReadonlyView(){
  const views=new WeakMap(),sources=new WeakMap();
  const denied=()=>{ throw new TypeError('Engine presentation views are read-only.'); };
  const wrapIterator=iterator=>({next(){ const item=iterator.next(); return item.done?item:{done:false,value:wrap(item.value)}; },[Symbol.iterator](){ return this; }});
  function wrap(value){
    if(value===null||typeof value!=='object') return value;
    if(views.has(value)) return views.get(value);
    let proxy;
    if(value instanceof Set){
      proxy=new Proxy(value,{get(target,key){
        if(key==='add'||key==='delete'||key==='clear') return denied;
        if(key==='size') return target.size;
        if(key==='has') return item=>target.has(sources.get(item)||item);
        if(key==='values'||key==='keys'||key===Symbol.iterator) return ()=>wrapIterator(target.values());
        if(key==='entries') return ()=>wrapIterator(target.entries());
        if(key==='forEach') return callback=>target.forEach(item=>callback(wrap(item),wrap(item),proxy));
        return wrap(Reflect.get(target,key,target));
      },set:denied,defineProperty:denied,deleteProperty:denied,setPrototypeOf:denied});
    }else if(value instanceof Map){
      proxy=new Proxy(value,{get(target,key){
        if(key==='set'||key==='delete'||key==='clear') return denied;
        if(key==='size') return target.size;
        if(key==='has') return item=>target.has(sources.get(item)||item);
        if(key==='get') return item=>wrap(target.get(sources.get(item)||item));
        if(key==='keys'||key==='values'||key==='entries'||key===Symbol.iterator) return ()=>wrapIterator(target[key===Symbol.iterator?'entries':key]());
        if(key==='forEach') return callback=>target.forEach((item,mapKey)=>callback(wrap(item),wrap(mapKey),proxy));
        return wrap(Reflect.get(target,key,target));
      },set:denied,defineProperty:denied,deleteProperty:denied,setPrototypeOf:denied});
    }else if(ArrayBuffer.isView(value)){
      proxy=new Proxy(value,{get(target,key){
        if(key==='buffer') return target.buffer.slice(target.byteOffset,target.byteOffset+target.byteLength);
        if(['set','fill','copyWithin','reverse','sort'].includes(key)) return denied;
        const result=Reflect.get(target,key,target);
        if(typeof result==='function') return (...args)=>{ const output=result.apply(target,args.map(item=>sources.get(item)||item)); return [Symbol.iterator,'values','keys','entries'].includes(key)?wrapIterator(output):wrap(output); };
        return wrap(result);
      },set:denied,defineProperty:denied,deleteProperty:denied,setPrototypeOf:denied});
    }else{
      const target=Object.isFrozen(value)?(Array.isArray(value)?new Array(value.length):{}):value;
      proxy=new Proxy(target,{get(_target,key){ return wrap(Reflect.get(value,key,value)); },has(_target,key){ return key in value; },ownKeys(){ return Reflect.ownKeys(value); },getOwnPropertyDescriptor(_target,key){ const descriptor=Reflect.getOwnPropertyDescriptor(value,key); if(!descriptor) return descriptor; if(target===value) return 'value' in descriptor?{...descriptor,value:wrap(descriptor.value)}:descriptor; if(Array.isArray(target)&&key==='length') return Reflect.getOwnPropertyDescriptor(target,key); return {configurable:true,enumerable:descriptor.enumerable,writable:false,value:wrap(Reflect.get(value,key,value))}; },getPrototypeOf(){ return Reflect.getPrototypeOf(value); },set:denied,defineProperty:denied,deleteProperty:denied,setPrototypeOf:denied,preventExtensions:denied});
    }
    views.set(value,proxy); sources.set(proxy,value); return proxy;
  }
  return {wrap,unwrap:value=>sources.get(value)||value};
}

function copy(value,seen=new Map()){
  if(value===null||typeof value!=='object') return value;
  if(seen.has(value)) return seen.get(value);
  if(ArrayBuffer.isView(value)) return Array.from(value);
  if(value instanceof Set) return Array.from(value,item=>copy(item,seen));
  if(value instanceof Map) return Array.from(value,([key,item])=>[copy(key,seen),copy(item,seen)]);
  const target=Array.isArray(value)?[]:{}; seen.set(value,target);
  for(const key of Object.keys(value)) target[key]=copy(value[key],seen);
  return target;
}

function freezeDeep(value,seen=new Set()){
  if(value===null||typeof value!=='object'||seen.has(value)) return value;
  seen.add(value); for(const item of Object.values(value)) freezeDeep(item,seen);
  return Object.freeze(value);
}

function immutableEventCopy(value,seen=new Map()){
  if(value===null||typeof value!=='object') return value;
  if(seen.has(value)) return seen.get(value);
  const denied=()=>{ throw new TypeError('Simulation events are immutable.'); };
  if(value instanceof Set){ const target=new Set(),proxy=new Proxy(target,{get(item,key){ if(['add','delete','clear'].includes(key)) return denied; if(key==='size') return item.size; if(key==='has') return candidate=>item.has(candidate); if(key==='forEach') return callback=>item.forEach(entry=>callback(entry,entry,proxy)); if(key===Symbol.iterator||key==='values'||key==='keys') return item.values.bind(item); if(key==='entries') return item.entries.bind(item); return Reflect.get(item,key,item); },set:denied,defineProperty:denied,deleteProperty:denied}); seen.set(value,proxy); for(const item of value) target.add(immutableEventCopy(item,seen)); Object.freeze(target); return proxy; }
  if(value instanceof Map){ const target=new Map(),proxy=new Proxy(target,{get(item,key){ if(['set','delete','clear'].includes(key)) return denied; if(key==='size') return item.size; if(key==='has') return candidate=>item.has(candidate); if(key==='get') return candidate=>item.get(candidate); if(key==='forEach') return callback=>item.forEach((entry,mapKey)=>callback(entry,mapKey,proxy)); if(key===Symbol.iterator||key==='entries') return item.entries.bind(item); if(key==='values') return item.values.bind(item); if(key==='keys') return item.keys.bind(item); return Reflect.get(item,key,item); },set:denied,defineProperty:denied,deleteProperty:denied}); seen.set(value,proxy); for(const [key,item] of value) target.set(immutableEventCopy(key,seen),immutableEventCopy(item,seen)); Object.freeze(target); return proxy; }
  if(ArrayBuffer.isView(value)) return Object.freeze(Array.from(value));
  const result=Array.isArray(value)?[]:{}; seen.set(value,result); for(const key of Object.keys(value)) result[key]=immutableEventCopy(value[key],seen); return Object.freeze(result);
}

export function createEngine(options={},adapters={}){
  const W=options.W??720,H=options.H??414,tickMs=options.tickMs??100;
  if(!Number.isSafeInteger(W)||W<16||W>4096||!Number.isSafeInteger(H)||H<16||H>4096||W*H>2_000_000||!Number.isFinite(tickMs)||tickMs<=0||tickMs>60_000) throw new TypeError('Engine dimensions or tick duration are outside supported ranges.');
  if(adapters===null||typeof adapters!=='object'||Array.isArray(adapters)) throw new TypeError('Engine adapters must be an object.');
  if(adapters.eventSink!=null&&typeof adapters.eventSink!=='function') throw new TypeError('eventSink adapter must be a function.');
  if(adapters.testBridge!=null&&typeof adapters.testBridge!=='boolean'&&typeof adapters.testBridge!=='function') throw new TypeError('testBridge adapter must be boolean or a function.');
  for(const [name,value] of [['structureBuildDelay',options.structureBuildDelay],['vehicleBuildDelay',options.vehicleBuildDelay]]) if(value!=null&&(!Number.isFinite(value)||value<0)) throw new TypeError(`options.${name} must be a non-negative finite number.`);
  if(options.bots!=null&&(!Number.isSafeInteger(options.bots)||options.bots<0||options.bots>9)) throw new TypeError('options.bots must be an integer from 0 to 9.');
  const structureBuildDelay=options.structureBuildDelay,vehicleBuildDelay=options.vehicleBuildDelay,testBridge=!!adapters.testBridge,multiplayerProof=adapters[MULTIPLAYER_PROOF]===true;
  const settings=validateSettingsCandidate(ownAuthorityValue(options.settings||{},{path:'options.settings'}),DEFAULT_SETTINGS);
  if((settings.humanSeats??1)>1&&!multiplayerProof) throw new TypeError('Multiple human seats require the multiplayer proof engine factory.');
  if(settings.humanSeats!=null&&settings.humanSeats>(options.bots??R.BOTS)+1) throw new TypeError('settings.humanSeats exceeds the configured non-neutral seat count.');
  const allowed=assertAllowedRules(ownAuthorityValue(options.allowed||DEFAULT_ALLOWED,{path:'options.allowed'}));
  const maps=ownAuthorityValue(options.maps||MAPS,{path:'options.maps',freeze:true});
  const countries=ownAuthorityValue(options.countries||COUNTRIES,{path:'options.countries',freeze:true});
  const countryAliases=ownAuthorityValue(options.countryAliases||NE_ALIAS,{path:'options.countryAliases',freeze:true});
  const colors=ownAuthorityValue(options.colors||R.COLORS,{path:'options.colors',freeze:true});
  const botNames=ownAuthorityValue(options.botNames||R.BOT_NAMES,{path:'options.botNames',freeze:true});
  const teamNames=ownAuthorityValue(options.teamNames||DEFAULT_TEAM_NAMES,{path:'options.teamNames',freeze:true});
  for(const [name,value] of [['maps',maps],['countryAliases',countryAliases]]) if(value===null||typeof value!=='object'||Array.isArray(value)||value instanceof Map||value instanceof Set||ArrayBuffer.isView(value)) throw new TypeError(`options.${name} must be a plain object.`);
  for(const [name,value] of [['countries',countries],['colors',colors],['botNames',botNames],['teamNames',teamNames]]) if(!Array.isArray(value)) throw new TypeError(`options.${name} must be an array.`);
  const fixedMapIds=new Set(['world','europe','americas','africa','asia','mideast']);
  for(const [id,map] of Object.entries(maps)){
    const validObject=map&&typeof map==='object'&&!Array.isArray(map)&&!(map instanceof Map)&&!(map instanceof Set)&&(Object.getPrototypeOf(map)===Object.prototype||Object.getPrototypeOf(map)===null);
    if(!fixedMapIds.has(id)||!validObject||Object.keys(map).length!==5||!['w','h','names','cont','rle'].every(key=>Object.hasOwn(map,key))||!Number.isSafeInteger(map.w)||map.w<1||map.w>4096||!Number.isSafeInteger(map.h)||map.h<1||map.h>4096||map.w*map.h>2_000_000||!Array.isArray(map.names)||!map.names.length||map.names.length>10_000||map.names.some(name=>typeof name!=='string'||!name.length||name.length>100)||new Set(map.names).size!==map.names.length||!Array.isArray(map.cont)||map.cont.length!==map.names.length||map.cont.some(name=>typeof name!=='string'||!name.length||name.length>100)||!ArrayBuffer.isView(map.rle)&&!Array.isArray(map.rle)||map.rle.length%2||map.rle.length>map.w*map.h*2) throw new TypeError(`options.maps.${id} is invalid.`);
    let cells=0,landCells=0;
    for(let index=0;index<map.rle.length;index+=2){ const value=map.rle[index],count=map.rle[index+1]; if(!Number.isSafeInteger(value)||value<0||value>map.names.length||!Number.isSafeInteger(count)||count<=0) throw new TypeError(`options.maps.${id}.rle is invalid.`); cells+=count; if(value) landCells+=count; }
    if(cells!==map.w*map.h||!landCells) throw new TypeError(`options.maps.${id}.rle does not define a usable map.`);
  }
  if(fixedMapIds.has(settings.map)&&!maps[settings.map]) throw new TypeError(`options.maps does not define selected map ${settings.map}.`);
  if(!countries.length||countries.some(country=>!Array.isArray(country)||typeof country[0]!=='string'||country[0].length<1||country[0].length>100||country.length<2)||new Set(countries.map(country=>country[0])).size!==countries.length) throw new TypeError('options.countries contains an invalid country.');
  countries.forEach((country,index)=>assertIdentity({name:country[0],layers:country.slice(1)},`options.countries[${index}]`));
  if(Object.entries(countryAliases).some(([key,value])=>!key.length||key.length>100||typeof value!=='string'||!value.length||value.length>100)) throw new TypeError('options.countryAliases contains an invalid alias.');
  for(const [name,value] of [['colors',colors],['botNames',botNames],['teamNames',teamNames]]) if(value.some(item=>typeof item!=='string'||item.length<1||item.length>100)) throw new TypeError(`options.${name} contains an invalid value.`);
  if((options.bots??R.BOTS)>Math.min(botNames.length,colors.length-1)) throw new TypeError('options.bots exceeds configured bot names or colors.');
  const engineState=createAuthoritativeState({tileCount:W*H,settings,allowed,difficulty:assertDifficulty(options.difficulty||'normal')});
  const runtime=createDeterministicRuntime({tickMs});
  const events=[],eventSink=typeof adapters.eventSink==='function'?adapters.eventSink:null;
  let operating=false,dispatching=false;
  const emit=(type,...args)=>events.push(Object.freeze({type,args:immutableEventCopy(args),tick:engineState.clock.tickN}));
  const effect=name=>(...args)=>emit(name,...args);
  const ports=createSimulationPorts({
    invalidateMap:effect('invalidateMap'),invalidateUi:effect('invalidateUi'),log:effect('log'),sound:effect('sound'),
    matchEnded:effect('matchEnded'),alliedDecisionRequested:effect('alliedDecisionRequested'),draftCompleted:effect('draftCompleted'),
    replayDiverged:effect('replayDiverged'),scheduleControllerTask:effect('controllerTaskRequested')
  });
  const START=engineState.rules.settings,ALLOWED=engineState.rules.allowed;
  const setupState=engineState.setup,mapState=engineState.map,fogState=engineState.fog;
  const {players,structures,shells}=engineState.actors;
  const frameActorNames=['transports','warships','shells','traders','aircraft','trucks','planes','interceptors'];
  const capturePresentationSnapshot=()=>freezeDeep({tickId:engineState.clock.tickN,timeMs:engineState.clock.simMs,actors:Object.fromEntries(frameActorNames.map(name=>[name,engineState.actors[name].filter(actor=>Number.isFinite(actor.x)&&Number.isFinite(actor.y)).map((actor,index)=>({id:Number.isInteger(actor.id)?actor.id:index,x:actor.x,y:actor.y}))]))});
  let interpolationFrame;
  let canonicalLabelPositions=null,canonicalLabelRefreshTick=null;
  function resetInterpolationFrame(){ const snapshot=capturePresentationSnapshot(); interpolationFrame=freezeDeep({previous:snapshot,current:snapshot,tickIntervalMs:tickMs}); }
  function advanceInterpolationFrame(){ interpolationFrame=freezeDeep({previous:interpolationFrame.current,current:capturePresentationSnapshot(),tickIntervalMs:tickMs}); }
  resetInterpolationFrame();
  const me=()=>engineState.match.playerId==null?null:players[engineState.match.playerId]||null;
  const srand=()=>runtime.random(),rnd=(a,b)=>a+srand()*(b-a),pick=values=>values[Math.floor(srand()*values.length)];
  const idx=(x,y)=>y*W+x;
  const pausedBlock=player=>{ if(player===me()&&engineState.lifecycle.userPaused&&!START.pauseBuild&&!engineState.lifecycle.over){ emit('fail','Paused — unpause to give orders (or tick "Paused orders" on the start card).'); return true; } return false; };
  const eventEffects=names=>Object.fromEntries(names.map(name=>[name,effect(name)]));
  const compatibilityEffects=createCompatibilityEffectProducer({random:srand,sink:event=>emit('compatibilityEffect',event)});
  let diplomacySystem,landCombat,missilesSystem,fogSystem,airSystem,navalSystem,logisticsSystem,aiSystem,economySystem,matchFlow,checkpointManager;

  const areaLabel=(player,area)=>{
    if(!area) return '';
    const index=player.areas.indexOf(area); if(index===0) return 'Home';
    const regionId=mapState.region[idx(Math.round(area.cx),Math.round(area.cy))],region=mapState.regions[regionId];
    const base=region&&region.name&&region.size>=R.REGION_MIN?region.name:`Area ${index+1}`;
    const home=player.areas[0],twins=player.areas.filter(other=>other!==area&&player.areas.indexOf(other)!==0&&mapState.region[idx(Math.round(other.cx),Math.round(other.cy))]===regionId);
    if(!twins.length) return base;
    const dx=area.cx-home.cx,dy=area.cy-home.cy,dir=Math.abs(dx)>Math.abs(dy)?(dx>0?'E':'W'):(dy>0?'S':'N');
    const same=twins.some(other=>{ const bx=other.cx-home.cx,by=other.cy-home.cy; return (Math.abs(bx)>Math.abs(by)?(bx>0?'E':'W'):(by>0?'S':'N'))===dir; });
    return base+' '+dir+(same?' '+player.areas.filter(other=>player.areas.indexOf(other)<=index&&other!==home&&mapState.region[idx(Math.round(other.cx),Math.round(other.cy))]===regionId).length:'');
  };
  const areaName=(player,area)=>area?`${areaLabel(player,area)} (${Math.round(area.troops)})`:'';

  const structuresSystem=createStructuresSystem({W,H,engineState,settings:START,allowed:ALLOWED,getMe:me,botBuildDelay:player=>structureBuildDelay??rnd(6000,12000)/(aiSystem.getBotDifficulty(player).build||1),definitions:R.STRUCT,buildTicks:R.BUILD_TICKS,upgrades:R.UPGRADE,guns:R.GUNS,shield:R.SHIELD,levelShield:R.LSHIELD,
    constants:{fortRange:R.FORT_RANGE,commandRange:R.CMD_RANGE,samRange:R.SAM_RANGE,linkRange:R.LINK_RANGE,linkMaxPerFactory:R.LINK_MAX_PER_FACTORY,linkMaxPerCity:R.LINK_MAX_PER_CITY,linkMaxPerPort:R.LINK_MAX_PER_PORT,structSpacing:R.STRUCT_SPACING,cityPop:R.CITY_POP},
    ownership:{isCoast:tile=>landCombat.isCoast(tile)},mechanics:{pausedBlock,garrisonOn:player=>logisticsSystem.gOn(player),addTroopsAt:(...args)=>logisticsSystem.addTroopsAt(...args),domeRadius:structure=>missilesSystem.domeR(structure),shipLabel:cls=>R.SHIPS[cls].label},
    queuedShipPath:(structure,job)=>navalSystem.waterPath(navalSystem.waterNeighbor(structure.t),job.dest),launchQueuedShip:(...args)=>navalSystem.launchQueuedShip(...args),
    effects:{...eventEffects(['fail','log','sound','incrementStat','scorch','flash']),puff:compatibilityEffects.puff,wreck:compatibilityEffects.wreck}
  });
  landCombat=createLandCombatSystem({W,H,engineState,settings:START,random:srand,rnd,getMe:me,
    constants:{suppressCost:R.SUPPRESS_COST,wallToll:R.WALL_TOLL,conquestGold:R.CONQUEST_GOLD,conquestEarly:R.CONQUEST_EARLY,conquestEarlyTicks:R.CONQUEST_EARLY_TICKS,provokeTicks:R.PROVOKE_TICKS},
    diplomacy:{atPeace:(...args)=>diplomacySystem.atPeace(...args),relation:(...args)=>diplomacySystem.relation(...args),markHostile:(...args)=>diplomacySystem.markHostile(...args),isProvokedBy:(...args)=>diplomacySystem.isProvokedBy(...args)},
    garrison:Object.fromEntries(['gOn','areaById','areaAt','areaTouching','syncTroops','addTroopsAt','takeTroopsFrom','loseTroopsAt','densityAt'].map(name=>[name,(...args)=>logisticsSystem[name](...args)])),
    mechanics:{pausedBlock,nearestCoast:(...args)=>navalSystem.nearestCoast(...args),areaLabel,launchTransport:(...args)=>navalSystem.launchTransport(...args),fortStack:structuresSystem.fortStack,fortMult:structuresSystem.fortMult,captureStructure:structuresSystem.captureStructure,structCounts:structuresSystem.structCounts},
    effects:eventEffects(['fail','log','sound','attackStarted','invasion','tileCaptured','conquest','fell','badge','plunder','treasury'])
  });
  const mapGeneration=createMapGeneration({W,H,engineState,settings:START,setup:setupState,MAPS:maps,random:srand,rnd,pick,landCombat});
  diplomacySystem=createDiplomacySystem({engineState,random:srand,pick,getMe:me,napTicks:R.NAP_TICKS,betrayTicks:R.BETRAY_TICKS,proposalTtl:R.PROPOSAL_TTL,provokeTicks:R.PROVOKE_TICKS,
    botLevel:player=>aiSystem.botLevel(player),getBotDifficulty:player=>aiSystem.getBotDifficulty(player),neutralShare:()=>aiSystem.neutralShare(),maxTroops:landCombat.maxTroops,density:landCombat.density,sendGold:(...args)=>economySystem.sendGold(...args),sendTroops:(...args)=>economySystem.sendTroops(...args),
    effects:{...eventEffects(['fail','log','sound','incrementStat','timeline','notice']),proposalNotice:value=>emit('proposalNotice',{from:value.from,type:value.type,ttl:value.ttl})}});
  airSystem=createAirSystem({W,H,engineState,settings:START,random:srand,getMe:me,constants:R.AIR,diplomacy:diplomacySystem,
    missiles:{domeFor:(...args)=>missilesSystem.domeFor(...args),hitDome:(...args)=>missilesSystem.hitDome(...args),crater:(...args)=>missilesSystem.crater(...args)},landCombat,
    structureOps:{definitions:R.STRUCT,upgrades:R.UPGRADE,crowded:structuresSystem.crowded,placeStructure:structuresSystem.placeStructure,upgradeStructure:structuresSystem.upgradeStructure},fog:{targetHidden:(...args)=>fogSystem.targetHidden(...args)},mechanics:{pausedBlock,noteThreat:(...args)=>aiSystem.noteThreat(...args)},ai:{botBuildDelay:player=>vehicleBuildDelay??rnd(4000,8000)/(aiSystem.getBotDifficulty(player).build||1),botLevel:player=>aiSystem.botLevel(player),pick},
    effects:{...eventEffects(['fail','log','sound','incrementStat','flash']),fragment:compatibilityEffects.fragment,wreck:compatibilityEffects.wreck,addShell:value=>shells.push(value)}});
  fogSystem=createFogSystem({W,H,engineState,settings:START,random:srand,getMe:me,constants:R.FOG,structures:{airfieldsOf:airSystem.airfieldsOf,satelliteSiteFor:player=>structures.find(value=>value.owner===player.id&&value.type==='satellite'&&!value.building)},diplomacy:diplomacySystem,
    fighters:{enemyPatrolAt:airSystem.enemyPatrolAt,patrolRadius:R.AIR.fighter.patrol,shipGunRange:cls=>R.SHIPS[cls].gun},borders:{owners:player=>aiSystem.borderOwners(player)},mechanics:{pausedBlock},effects:eventEffects(['fail','log','sound','flash'])});
  missilesSystem=createMissilesSystem({W,H,engineState,settings:START,allowed:ALLOWED,random:srand,getMe:me,definitions:R.STRUCT,ships:R.SHIPS,shield:R.SHIELD,levelShield:R.LSHIELD,cruise:R.CRUISE,
    constants:{nukeCost:R.NUKE_COST,nukeRadius:R.NUKE_RADIUS,samRange:R.SAM_RANGE,samHit:R.SAM_HIT,samReact:R.SAM_REACT,interceptorSpeed:R.INTERCEPTOR_SPEED,samCooldown:R.SAM_COOLDOWN,siloCooldown:R.SILO_COOLDOWN,commandDiscount:R.CMD_DISCOUNT,commandDiscountMax:R.CMD_DISCOUNT_MAX,commandReserve:R.CMD_RESERVE,suppressTicks:R.SUPPRESS_TICKS,suppressRing:R.SUPPRESS_RING,barrageKillFlat:R.BARRAGE_KILL_FLAT,barrageKillPct:R.BARRAGE_KILL_PCT,barrageKillCap:R.BARRAGE_KILL_CAP},
    structures:{commandCover:structuresSystem.commandCover,coveringSam:structuresSystem.coveringSam,destroyStructure:structuresSystem.destroyStructure,structCounts:structuresSystem.structCounts},landCombat,diplomacy:diplomacySystem,visibility:{at:(...args)=>fogSystem.visAt(...args),hidden:(...args)=>fogSystem.hidden(...args)},mechanics:{pausedBlock,noteThreat:(...args)=>aiSystem.noteThreat(...args),seizeTreasury:(...args)=>economySystem.seizeTreasury(...args)},
    effects:{...eventEffects(['fail','log','sound','incrementStat','flash','tracer','floater','nuclearAlert','bigLoss']),fragments:compatibilityEffects.fragments,dudFragment:compatibilityEffects.fragment,puff:compatibilityEffects.puff,wreck:compatibilityEffects.wreck}});
  navalSystem=createNavalSystem({W,H,engineState,settings:START,allowed:ALLOWED,random:srand,rnd,pick,getMe:me,ships:R.SHIPS,definitions:R.STRUCT,guns:R.GUNS,armor:R.ARMOR,heavy:R.HEAVY,cruise:R.CRUISE,shipBuild:R.SHIP_BUILD,
    constants:{linkShipDiscount:R.LINK_SHIP_DISCOUNT,provokeTicks:R.PROVOKE_TICKS,tradeInterval:R.TRADE_INTERVAL,tradeGold:R.TRADE_GOLD,tradePerTile:R.TRADE_PER_TILE,tradeSpeed:R.TRADE_SPEED,shipSpeed:R.SHIP_SPEED,shellSpeed:R.SHELL_SPEED,sinkBounty:R.SINK_BOUNTY},landCombat,structures:structuresSystem,missiles:missilesSystem,fog:{targetHidden:(...args)=>fogSystem.targetHidden(...args)},diplomacy:diplomacySystem,
    mechanics:{pausedBlock,noteThreat:(...args)=>aiSystem.noteThreat(...args),areaName},ai:{botBuildDelay:player=>vehicleBuildDelay??rnd(4000,8000)/(aiSystem.getBotDifficulty(player).build||1)},
    effects:{...eventEffects(['fail','log','sound','incrementStat','flash','floater','tracer','cashFloat','invasion','barrageResolved','cleanupSelection']),puff:compatibilityEffects.puff,wreck:compatibilityEffects.wreck,onScreen:()=>true}});
  logisticsSystem=createLogisticsSystem({W,H,engineState,settings:START,getMe:me,truck:R.TRUCK,provokeTicks:R.PROVOKE_TICKS,carrierCapacity:R.AIR.carrier.capacity,landCombat,structures:{repairNeed:structuresSystem.repairNeed,repairOne:structuresSystem.repairOne},diplomacy:diplomacySystem,naval:{seaRisk:navalSystem.seaRisk,reinforceArea:navalSystem.reinforceArea},air:{idleAircraft:airSystem.idleAircraft,launchParadrop:airSystem.launchParadrop},mechanics:{areaLabel,structureLabel:type=>R.STRUCT[type].label},effects:eventEffects(['log'])});
  aiSystem=createAiSystem({W,H,engineState,settings:START,allowed:ALLOWED,random:srand,rnd,pick,getMe:me,profiles:R.DIFFS,definitions:R.STRUCT,ships:R.SHIPS,
    constants:{warshipCost:R.WARSHIP_COST,nukeCost:R.NUKE_COST,linkRange:R.LINK_RANGE,provokeTicks:R.PROVOKE_TICKS,cruise:R.CRUISE},landCombat,structures:structuresSystem,diplomacy:diplomacySystem,missiles:{launchMissile:missilesSystem.launchMissile},naval:{waterNeighbor:navalSystem.waterNeighbor,orderWarship:navalSystem.orderWarship},air:airSystem,logistics:{reinforceArea:navalSystem.reinforceArea},fog:{targetHidden:(...args)=>fogSystem.targetHidden(...args)},effects:eventEffects(['log','sound'])});
  let endEnabled=options.endEnabled!==false;
  matchFlow=createMatchFlow({W,H,engineState,random:srand,pick,getMe:me,winShare:R.WIN_SHARE,teamNames,canEnd:()=>endEnabled,landCombat,structures:structuresSystem,diplomacy:diplomacySystem,borders:{borderOwners:player=>aiSystem.borderOwners(player),calculateCentroid:player=>calculateCentroid(W,H,mapState.owner,player)},isReplay:()=>runtime.replay.on,isCreditsMode:()=>runtime.replay.creditsMode,ports});
  economySystem=createEconomySystem({W,H,tickMs,engineState,settings:START,getMe:me,getBotDifficulty:player=>aiSystem.getBotDifficulty(player),constants:{linkTroops:R.LINK_TROOPS,linkGoldPer:R.LINK_GOLD_PER,linkPortGold:R.LINK_PORT_GOLD,holdBonus:R.HOLD_BONUS,captureBonus:R.CAPTURE_BONUS,regionMin:R.REGION_MIN,heavyHp:R.HEAVY.hp},landCombat,diplomacy:diplomacySystem,naval:navalSystem,logistics:logisticsSystem,ai:{botThink:(...args)=>aiSystem.botThink(...args),neutralThink:(...args)=>aiSystem.neutralThink(...args)},effects:eventEffects(['fail','log','sound','cash','incrementStat','timeline','playerAccrued','badge'])});
  const worldSetup=createWorldSetup({W,H,engineState,settings:START,mapGeneration,random:srand,rnd,pick,countries,countryAliases,colors,botNames,bots:options.bots??R.BOTS,tilesPerNeutral:R.TILES_PER_NEUTRAL,regionMin:R.REGION_MIN,quickTiles:R.QUICK_TILES,landCombat,structuresSystem,logistics:logisticsSystem,startDraft:()=>matchFlow.startDraft(),borderOwners:player=>aiSystem.borderOwners(player),onCustomBot:effect('customBot'),onSetupComplete:effect('setupComplete')});
  const commandRouter=createCommandRouter({engineState,runtime,settings:START,definitions:R.STRUCT,ships:R.SHIPS,air:R.AIR,shield:R.SHIELD,levelShield:R.LSHIELD,cruise:R.CRUISE,constants:{W,linkRange:R.LINK_RANGE,cancelRefund:R.CANCEL_REFUND,nukeCost:R.NUKE_COST},queries:{structAtT:structuresSystem.structAtT},
    actions:{callPlane:fogSystem.callPlane,launchFighter:airSystem.launchFighter,launchBomber:airSystem.launchBomber,recallAircraft:airSystem.recallAircraft,upgradeStructure:structuresSystem.upgradeStructure,buyAircraft:airSystem.buyAircraft,garrisonOn:logisticsSystem.gOn,idleAircraft:airSystem.idleAircraft,areaAt:logisticsSystem.areaAt,launchParadrop:airSystem.launchParadrop,launchSatellite:actor=>fogSystem.launchSatellite(actor),moveShips:(...args)=>navalSystem.moveShips(...args),waterNeighbor:navalSystem.waterNeighbor,orderWarship:navalSystem.orderWarship,placeStructure:structuresSystem.placeStructure,snapBuild:structuresSystem.snapBuild,cancelQueued:structuresSystem.cancelQueued,destroyStructure:structuresSystem.destroyStructure,structCounts:structuresSystem.structCounts,launchMissile:missilesSystem.launchMissile,propose:diplomacySystem.propose,breakRelation:diplomacySystem.breakRelation,aidTroops:diplomacySystem.aidTroops,aidGold:diplomacySystem.aidGold,botAnswerRequest:economySystem.botAnswerRequest,maxTroops:landCombat.maxTroops,areaById:logisticsSystem.areaById,launchAttack:landCombat.launchAttack,areaName,atPeace:diplomacySystem.atPeace,areaTouching:logisticsSystem.areaTouching,reinforceArea:navalSystem.reinforceArea,frontierOf:landCombat.frontierOf,draftPick:matchFlow.draftPick,draftAdvance:matchFlow.draftAdvance,accept:(actor,...args)=>diplomacySystem.acceptFor(actor,...args),decline:(actor,...args)=>diplomacySystem.declineFor(actor,...args),resolveSharedVictory:matchFlow.resolveSharedVictory,continueWar:matchFlow.continueWar,continueAfterEnd:matchFlow.continueAfterEnd,surrender:actor=>{ const duel=players.filter(player=>player.kind==='human'); if(!multiplayerProof||duel.length!==2||players.some(player=>player.kind==='bot')||!actor.alive) throw new RangeError('Surrender requires an active two-human multiplayer proof duel.'); actor.alive=false; return matchFlow.endMatch('Surrender',`${actor.name} surrendered.`,{surrenderedSeat:actor.id}); }},
    adapters:{fail:effect('fail'),log:effect('log'),sound:effect('sound'),invalidateUi:effect('invalidateUi'),setPickMode:effect('setPickMode'),clearBuildMode:effect('clearBuildMode'),closeAlliedDecision:effect('closeAlliedDecision'),warn:effect('warn')}});
  const stateOracle=createStateOracle({engineState,runtime,W,H,ports,warn:(...args)=>emit('warn',...args),getCanonicalLabelPositions:()=>canonicalLabelPositions});
  const worldLoop=createWorldLoop({W,H,engineState,runtime,settings:START,ports,applyReplayCommand:command=>{ try{ commandRouter.validateReplay(command); }catch{ return false; } return atomicCommand(()=>commandRouter.replayApply(command),true); },stateOracle,isReplayOtherVersion:()=>runtime.replay.otherVersion,systems:{economy:economySystem,structures:structuresSystem,diplomacy:diplomacySystem,landCombat,missiles:missilesSystem,naval:navalSystem,fog:fogSystem,air:airSystem,logistics:logisticsSystem,matchFlow}});

  function prepareConfiguration(values={}){
    const next=ownAuthorityValue(values,{path:'engine configuration'});
    if(next===null||typeof next!=='object'||Array.isArray(next)) throw new TypeError('Engine configuration must be a plain object.');
    for(const key of Object.keys(next)) if(!['settings','difficulty','allowed','chosenFlag','seed'].includes(key)) throw new TypeError(`Unsupported configuration field: ${key}.`);
    next.settings=validateSettingsCandidate({...next.settings,...(Object.hasOwn(next,'seed')?{seed:next.seed}:{})},START);
    if((next.settings.humanSeats??1)>1&&!multiplayerProof) throw new TypeError('Multiple human seats require the multiplayer proof engine factory.');
    if(next.settings.humanSeats!=null&&next.settings.humanSeats>(options.bots??R.BOTS)+1) throw new TypeError('settings.humanSeats exceeds the configured non-neutral seat count.');
    if(fixedMapIds.has(next.settings.map)&&!maps[next.settings.map]) throw new TypeError(`No map definition is configured for ${next.settings.map}.`);
    if(next.settings.customBots?.some(bot=>bot.slot>=(options.bots??R.BOTS))) throw new TypeError('settings.customBots slot exceeds the configured bot count.');
    if(next.difficulty!=null) assertDifficulty(next.difficulty);
    if(next.allowed!=null) next.allowed=assertAllowedRules(next.allowed);
    if(Object.hasOwn(next,'chosenFlag')&&next.chosenFlag!==null){ assertIdentity(next.chosenFlag,'chosenFlag'); if(next.chosenFlag.idx!=null&&next.chosenFlag.idx>=countries.length) throw new TypeError('chosenFlag.idx does not identify a configured country.'); }
    return next;
  }
  const hasInstalledWorld=()=>mapState.landCount>0||mapState.regions.length>0||Object.values(engineState.actors).some(collection=>collection.length>0)||engineState.draft.draft!==null||setupState.PRESET!==null||setupState.cid!==null;
  function applyConfiguration(next){ Object.assign(START,next.settings); if(next.difficulty) engineState.setDifficulty(next.difficulty); if(next.allowed){ ALLOWED.clear(); for(const value of next.allowed) ALLOWED.add(value); } if(Object.hasOwn(next,'chosenFlag')) engineState.setChosenFlag(next.chosenFlag); return true; }
  function configure(values={}){ if(hasInstalledWorld()) throw new Error('Engine configuration is only available before world setup.'); return applyConfiguration(prepareConfiguration(values)); }
  function verifyReplayTarget(){
    if(runtime.replay.on&&!runtime.replay.finalVerified&&engineState.clock.tickN===runtime.replay.toTick&&commandRouter.resolveReplayCommands()===false) stateOracle.replayCommandFailed(runtime.replay.cmds[runtime.replay.i],'pre-systems');
    if(stateOracle.verifyReplayFinal()&&!runtime.replay.otherVersion) ports.scheduleControllerTask('showReplayDivergence');
  }
  function setup(values){ return atomicCommand(()=>{ if(hasInstalledWorld()) throw new Error('World setup has already been installed; reset or start a new match first.'); const next=values?prepareConfiguration(values):null; if(next) applyConfiguration(next); if(START.seed!=null) runtime.seed(START.seed); worldSetup.setup(); renderStaticDirty=true; canonicalLabelPositions=null; canonicalLabelRefreshTick=null; resetInterpolationFrame(); verifyReplayTarget(); return true; }); }
  function reset(){ resetAuthoritativeState(engineState,runtime); events.length=0; renderStaticDirty=true; canonicalLabelPositions=null; canonicalLabelRefreshTick=null; resetInterpolationFrame(); return true; }
  function start(values={}){ return atomicCommand(()=>{ const supplied=ownAuthorityValue(values,{path:'engine start configuration'}); if(hasInstalledWorld()&&supplied&&typeof supplied==='object'&&!Array.isArray(supplied)&&Object.keys(supplied).length) throw new Error('Structural start configuration is only available before world setup.'); const next=prepareConfiguration(supplied); reset(); applyConfiguration(next); runtime.seed(START.seed); worldSetup.setup(); canonicalLabelPositions=null; canonicalLabelRefreshTick=null; resetInterpolationFrame(); verifyReplayTarget(); return true; }); }
  function finalizeAdvancedTick(){
    if(engineState.clock.tickN%30===0){ canonicalLabelPositions=calculatePlayerLabelPositions(W,H,mapState.owner,players); canonicalLabelRefreshTick=engineState.clock.tickN; }
    advanceInterpolationFrame();
    const diverged=stateOracle.finalizeCheckpoint();
    verifyReplayTarget();
    if(diverged&&!runtime.replay.otherVersion) ports.scheduleControllerTask('showReplayDivergence');
  }
  function tick(){
    if(runtime.replay.on&&engineState.clock.tickN>=runtime.replay.toTick){ verifyReplayTarget(); return false; }
    const result=worldLoop.tick();
    if(result.advanced) finalizeAdvancedTick();
    return result.advanced;
  }
  function issue(command,...args){
    if(typeof command==='string') return commandRouter.issue(command,...args);
    command=ownAuthorityValue(command,{path:'command'});
    if(!command||typeof command!=='object') throw new TypeError('Command must be a command object or kind string.');
    const kind=command.kind??command.k,values=command.args??command.a??[],actor=command.actor??command.actorId??command.p;
    if(kind==='menu') return commandRouter.issueMenu(...values,actor);
    if(kind==='click') return commandRouter.issueClick(values[0],values[1],actor);
    return commandRouter.issueFor(actor,kind,...values);
  }
  function validateIssue(command,...args){
    if(typeof command==='string') return commandRouter.validateIssueFor(engineState.match.playerId,command,args);
    command=ownAuthorityValue(command,{path:'command'});
    if(!command||typeof command!=='object'||Array.isArray(command)||(Object.getPrototypeOf(command)!==Object.prototype&&Object.getPrototypeOf(command)!==null)) throw new TypeError('Command must be a command object or kind string.');
    const keys=Object.keys(command),long=Object.hasOwn(command,'kind')||Object.hasOwn(command,'args')||Object.hasOwn(command,'actor')||Object.hasOwn(command,'actorId'),allowedKeys=long?new Set(['kind','args','actor','actorId']):new Set(['k','a','p']);
    if(keys.some(key=>!allowedKeys.has(key))||long&&(!Object.hasOwn(command,'kind')||!Object.hasOwn(command,'args')||Object.hasOwn(command,'actor')&&Object.hasOwn(command,'actorId'))||!long&&(!Object.hasOwn(command,'k')||!Object.hasOwn(command,'a'))) throw new TypeError('Invalid command envelope.');
    const kind=command.kind??command.k,values=command.args??command.a??[],actor=command.actor??command.actorId??command.p;
    if(!Array.isArray(values)) throw new TypeError('Command arguments must be an array.');
    if(kind==='menu') return commandRouter.validateIssueMenu(...values,actor);
    if(kind==='click') return commandRouter.validateIssueClick(values[0],values[1],actor);
    return commandRouter.validateIssueFor(actor,kind,values);
  }
  function loadReplay(file={},values={}){
    file=ownAuthorityValue(file,{path:'replay payload'}); values=ownAuthorityValue(values,{path:'replay options'});
    const plain=value=>value!==null&&typeof value==='object'&&!Array.isArray(value)&&(Object.getPrototypeOf(value)===Object.prototype||Object.getPrototypeOf(value)===null);
    if(!plain(file)||!Array.isArray(file.cmds)) throw new TypeError('Replay payload must be a plain object with commands.');
    const fileKeys=new Set(['schema','requiresCanonicalCheckpoints','v','seed','hashv','tick','settings','cmds','hashes','game','result','when','finalHash','finalDigest','final','multiplayer']);
    for(const key of Object.keys(file)) if(!fileKeys.has(key)) throw new TypeError(`Unsupported replay field: ${key}.`);
    if(file.multiplayer&&!multiplayerProof) throw new TypeError('Multiplayer replay metadata requires the multiplayer replay factory.');
    if(file.v===1) assertReplaySchema(file,{multiplayerProof});
    if(file.v!=null&&file.v!==1) throw new TypeError('Unsupported replay version.');
    if(file.schema!=null&&file.schema!=='statefall-replay-fixture/v1') throw new TypeError('Unsupported replay schema.');
    if(file.requiresCanonicalCheckpoints!=null&&typeof file.requiresCanonicalCheckpoints!=='boolean') throw new TypeError('Invalid canonical checkpoint requirement.');
    if(file.seed!=null&&(!['string','number'].includes(typeof file.seed)||typeof file.seed==='number'&&!Number.isFinite(file.seed)||typeof file.seed==='string'&&file.seed.length>200)) throw new TypeError('Invalid replay seed.');
    if(file.tick!=null&&(!Number.isSafeInteger(file.tick)||file.tick<0||file.tick>10_000_000)) throw new TypeError('Invalid replay target tick.');
    if(file.game!=null&&(typeof file.game!=='string'||file.game.length>100)) throw new TypeError('Invalid replay game version.');
    if(file.when!=null&&(!Number.isSafeInteger(file.when)||file.when<0)) throw new TypeError('Invalid replay timestamp.');
    if(file.result!=null&&(typeof file.result!=='string'||file.result.length>200)&&!(multiplayerProof&&plain(file.result))) throw new TypeError('Invalid replay result metadata.');
    if(file.finalHash!=null&&(typeof file.finalHash!=='string'||!/^[0-9a-f]{8}$/.test(file.finalHash))) throw new TypeError('Invalid replay final hash.');
    if(file.finalDigest!=null&&(!plain(file.finalDigest)||file.finalDigest.version!=='statefall-authoritative-state/v1'||typeof file.finalDigest.sha256!=='string'||!/^[0-9a-f]{64}$/.test(file.finalDigest.sha256))) throw new TypeError('Invalid replay final digest.');
    if(file.final!=null&&(!plain(file.final)||file.final.tick!==(file.tick??0)||typeof file.final.legacyHash!=='string'||!/^[0-9a-f]{8}$/.test(file.final.legacyHash)||!plain(file.final.canonical)||file.final.canonical.version!=='statefall-authoritative-state/v1'||typeof file.final.canonical.sha256!=='string'||!/^[0-9a-f]{64}$/.test(file.final.canonical.sha256)||!Number.isSafeInteger(file.final.rngDraws)||file.final.rngDraws<0||!Number.isSafeInteger(file.final.commandCount)||file.final.commandCount<0||file.final.replayCursor!==null&&(!Number.isSafeInteger(file.final.replayCursor)||file.final.replayCursor<0))) throw new TypeError('Invalid replay final metadata.');
    const cmds=file.cmds; let previous=-1; for(const command of cmds){ assertCommand(command); if(command.t<previous) throw new TypeError('Replay commands must be ordered by tick.'); if(file.tick!=null&&command.t>file.tick) throw new TypeError('Replay command exceeds the target tick.'); previous=command.t; }
    let configuration=null;
    if(file.settings){
      if(!plain(file.settings)) throw new TypeError('Replay settings must be a plain object.');
      const replaySettings=ownAuthorityValue(file.settings,{path:'replay settings'}),meta=new Set(['diff','country','allowed','customFlag']);
      for(const key of Object.keys(replaySettings)) if(!SETTING_NAMES.includes(key)&&!meta.has(key)) throw new TypeError(`Unsupported replay setting: ${key}.`);
      const runtimeSettings=Object.fromEntries(Object.entries(replaySettings).filter(([key])=>SETTING_NAMES.includes(key)));
      let chosenFlag;
      if(replaySettings.customFlag!=null){ assertIdentity(replaySettings.customFlag,'replay settings.customFlag'); chosenFlag={...replaySettings.customFlag,idx:-1,custom:true}; }
      else if(replaySettings.country!=null){ if(!Number.isSafeInteger(replaySettings.country)||replaySettings.country<0||replaySettings.country>=countries.length) throw new TypeError('Invalid replay country.'); chosenFlag=worldSetup.countryByIdx(replaySettings.country); }
      configuration=prepareConfiguration({settings:runtimeSettings,...(replaySettings.allowed!=null?{allowed:replaySettings.allowed}:{}),...(replaySettings.diff!=null?{difficulty:replaySettings.diff}:{}),...(chosenFlag?{chosenFlag}:{})});
      if(file.seed!=null&&replaySettings.seed!=null&&file.seed!==replaySettings.seed) throw new TypeError('Replay seed and settings.seed must match.');
    }
    if(!plain(values)) throw new TypeError('Replay load options must be a plain object.');
    for(const key of Object.keys(values)) if(!['resume','otherVersion','speed','saveId'].includes(key)) throw new TypeError(`Unsupported replay load option: ${key}.`);
    const replayValues={on:true,cmds,i:0,resume:values.resume??false,toTick:file.tick??0,hashes:file.hashes??[],hashv:file.hashv??1,requiresCanonicalCheckpoints:file.requiresCanonicalCheckpoints??false,otherVersion:values.otherVersion??false,fileGame:file.game??'',speed:values.speed??1,mismatch:false,...(file.finalHash==null?{}:{finalHash:file.finalHash}),...(file.finalDigest==null?{}:{finalDigest:file.finalDigest}),...(file.final==null?{}:{final:file.final}),...values};
    const preparedReplay=runtime.validateReplayConfiguration(replayValues);
    if(hasInstalledWorld()&&(configuration||file.seed!=null)) throw new Error('Replay structural settings can only be loaded before world setup.');
    return atomicCommand(()=>{ runtime.configureReplay(preparedReplay); if(configuration) applyConfiguration(configuration); if(file.seed!=null) START.seed=file.seed; return ownAuthorityValue(runtime.replay,{path:'replay state',freeze:true}); });
  }
  function runOperation(operation){
    if(operating||dispatching) throw new Error('Engine operations cannot be re-entered.');
    operating=true;
    try{ return operation(); }finally{ operating=false; }
  }
  function runQuery(operation){
    if(operating) throw new Error('Engine operations cannot be re-entered.');
    operating=true;
    try{ return operation(); }finally{ operating=false; }
  }
  function atomicCommand(operation,rollbackFalse=false){
    const before=checkpointManager.captureRollback(),beforeEvents=events.slice(),beforeFrame=interpolationFrame,beforeLabels=canonicalLabelPositions,beforeRenderDirty=renderStaticDirty;
    const rollback=()=>{ checkpointManager.restoreRollback(before); events.splice(0,events.length,...beforeEvents); interpolationFrame=beforeFrame; canonicalLabelPositions=beforeLabels; renderStaticDirty=beforeRenderDirty; };
    try{
      const result=operation();
      if(!rollbackFalse||result!==false) return result;
      rollback(); return false;
    }catch(error){
      try{ rollback(); }catch(rollbackError){ throw new AggregateError([error,rollbackError],'Engine operation and rollback both failed.'); }
      throw error;
    }
  }
  function drainEvents(){
    if(operating) throw new Error('Simulation events cannot be drained during an engine operation.');
    return events.splice(0,events.length);
  }
  function dispatchEvents(sink=eventSink){
    if(operating||dispatching) throw new Error('Simulation events cannot be dispatched re-entrantly.');
    const batch=drainEvents(),errors=[];
    if(typeof sink!=='function') return {events:batch,errors};
    dispatching=true;
    try{
      for(const event of batch){
        try{ sink(event); }catch(error){ errors.push({event,error}); }
      }
    }finally{ dispatching=false; }
    return {events:batch,errors};
  }
  function flushEvents(sink=eventSink){
    const result=dispatchEvents(sink);
    if(result.errors.length) throw new AggregateError(result.errors.map(item=>item.error),'One or more simulation event adapters failed.');
    return result.events;
  }
  function setPauseState(paused,userPaused){ engineState.setLifecycle('userPaused',userPaused); engineState.setLifecycle('paused',paused); return true; }
  function pauseForReplayDivergence(){ return setPauseState(true,true); }
  function resumeAfterReplayDivergence(){ return setPauseState(false,false); }
  function beginControllerCatchUp(){ if(!hasInstalledWorld()) throw new Error('Catch-up requires an installed match.'); return setPauseState(false,false); }
  function finishControllerCatchUp(){ if(!hasInstalledWorld()) throw new Error('Catch-up requires an installed match.'); return setPauseState(true,true); }
  function beginReplayPlayback(){ if(!runtime.replay.on) throw new Error('Replay playback requires a loaded replay.'); return setPauseState(false,false); }
  function pauseReplayPreview(){ if(!runtime.replay.on) throw new Error('Replay preview requires a loaded replay.'); return setPauseState(true,true); }
  function enterCreditsEndState(){ if(!runtime.replay.creditsMode) throw new Error('Credits end state requires a credits replay.'); engineState.setLifecycle('over',true); return setPauseState(true,false); }
  function finishReplayWatch(){ if(!runtime.replay.on||engineState.clock.tickN!==runtime.replay.toTick) throw new Error('Replay completion requires the exact active replay target.'); if(stateOracle.verifyReplayFinal()&&!runtime.replay.otherVersion) ports.scheduleControllerTask('showReplayDivergence'); engineState.setLifecycle('over',true); return setPauseState(true,true); }
  function pauseCreditsAtTarget(){ if(!runtime.replay.creditsMode||engineState.clock.tickN!==runtime.replay.toTick) throw new Error('Credits can only pause at their exact replay target.'); engineState.setLifecycle('paused',true); return true; }
  function enterSpectatorEndState(){ if(!hasInstalledWorld()) throw new Error('Spectator end state requires an installed match.'); engineState.setLifecycle('spectating',true); engineState.setLifecycle('over',true); return setPauseState(false,true); }
  function prepareEndMatch(args){
    if(args.length<2||args.length>3) throw new TypeError('endMatch requires reason, text, and optional metadata.');
    const [reason,text,metadata]=args;
    if(typeof reason!=='string'||!reason.length||reason.length>200) throw new TypeError('endMatch reason must be a non-empty short string.');
    if(typeof text!=='string'||text.length>2000) throw new TypeError('endMatch text must be a short string.');
    if(metadata!==undefined&&(metadata===null||typeof metadata!=='object'||Array.isArray(metadata))) throw new TypeError('endMatch metadata must be a plain data object.');
    const owned=ownAuthorityValue({reason,text,...(metadata===undefined?{}:{metadata})},{path:'endMatch input'});
    if(metadata!==undefined){
      if(Object.getPrototypeOf(owned.metadata)!==Object.prototype&&Object.getPrototypeOf(owned.metadata)!==null) throw new TypeError('endMatch metadata must be a plain data object.');
      const validate=(value,path)=>{
        if(value===null||typeof value==='string'||typeof value==='boolean'||typeof value==='undefined') return;
        if(typeof value==='number'){ if(Number.isFinite(value)) return; throw new TypeError(`${path} must be finite.`); }
        if(typeof value!=='object'||!Array.isArray(value)&&(Object.getPrototypeOf(value)!==Object.prototype&&Object.getPrototypeOf(value)!==null)) throw new TypeError(`${path} must contain only primitive data, arrays, and plain objects.`);
        for(const [key,item] of Object.entries(value)) validate(item,`${path}.${key}`);
      };
      validate(owned.metadata,'endMatch metadata');
      try{ structuredClone(metadata); }catch{ throw new TypeError('endMatch metadata must not be a Proxy.'); }
    }
    return owned;
  }
  const readonly=createReadonlyView();
  const renderMap=Object.fromEntries(['land','owner','struct','structOwner','region','river','shelled','rough'].map(name=>[name,engineState.map[name].slice()]));
  let renderRegCount=null,renderVis=null,renderRadarLayer=null,renderStaticDirty=true;
  const renderBuffers=Object.freeze({
    map:Object.freeze({...renderMap,get regCount(){ return renderRegCount; }}),
    fog:Object.freeze({get vis(){ return renderVis; },get radarLayer(){ return renderRadarLayer; }})
  });
  function syncRenderBuffers(){
    for(const name of ['owner','struct','structOwner','shelled']) renderMap[name].set(engineState.map[name]);
    if(renderStaticDirty){ for(const name of ['land','region','river','rough']) renderMap[name].set(engineState.map[name]); renderStaticDirty=false; }
    const sync=(mirror,source)=>!source?null:mirror&&mirror.constructor===source.constructor&&mirror.length===source.length?(mirror.set(source),mirror):source.slice();
    renderRegCount=sync(renderRegCount,engineState.map.regCount);
    renderVis=sync(renderVis,engineState.fog.vis);
    renderRadarLayer=sync(renderRadarLayer,engineState.fog.radarLayer);
    return renderBuffers;
  }
  const presentation=readonly.wrap(Object.freeze({
    state:Object.freeze({clock:engineState.clock,lifecycle:engineState.lifecycle,match:engineState.match,rules:engineState.rules,map:engineState.map,actors:engineState.actors,fog:engineState.fog,diplomacy:engineState.diplomacy,garrison:engineState.garrison,draft:engineState.draft,setup:engineState.setup}),
    runtime:Object.freeze({commands:runtime.commands,replay:runtime.replay,get rngDraws(){ return runtime.rngDraws; }})
  }));
  const queryInteger=(value,name,min,max)=>{ if(typeof value!=='number'||!Number.isSafeInteger(value)||value<min||value>max) throw new TypeError(`${name} must be an integer from ${min} to ${max}.`); return value; };
  const queryNumber=(value,name)=>{ if(typeof value!=='number'||!Number.isFinite(value)) throw new TypeError(`${name} must be a finite number.`); return value; };
  const playerById=value=>players[queryInteger(value,'playerId',0,players.length-1)];
  const tile=value=>queryInteger(value,'tile',0,W*H-1);
  const structureByTile=value=>{ const at=tile(value),structure=structures.find(item=>item.t===at); if(!structure) throw new TypeError('structureTile does not identify a structure.'); return structure; };
  const cloneQueryData=(value,path='query argument',ancestors=new Set())=>{
    if(value===null||typeof value==='string'||typeof value==='boolean'||typeof value==='undefined') return value;
    if(typeof value==='number'){ if(!Number.isFinite(value)) throw new TypeError(`${path} must be finite.`); return value; }
    if(typeof value!=='object') throw new TypeError(`${path} must contain only inert data.`);
    if(ancestors.has(value)) throw new TypeError(`${path} must not contain cycles.`);
    if(!Array.isArray(value)&&(Object.getPrototypeOf(value)!==Object.prototype&&Object.getPrototypeOf(value)!==null)) throw new TypeError(`${path} must use plain objects and arrays.`);
    if(Object.getOwnPropertySymbols(value).length) throw new TypeError(`${path} must not contain symbol properties.`);
    const result=Array.isArray(value)?[]:{},descriptors=Object.getOwnPropertyDescriptors(value);
    if(!Array.isArray(value)&&Object.values(descriptors).every(descriptor=>'value' in descriptor&&(descriptor.value===null||typeof descriptor.value!=='object'))){ try{ structuredClone(value); }catch{ throw new TypeError(`${path} must not be a Proxy.`); } }
    ancestors.add(value);
    for(const key of Object.keys(descriptors)){ const descriptor=descriptors[key]; if(!('value' in descriptor)) throw new TypeError(`${path}.${key} must be a data property.`); result[key]=cloneQueryData(descriptor.value,`${path}.${key}`,ancestors); }
    ancestors.delete(value); return result;
  };
  const query=(operation,{min=operation.length,max=min}={})=>(...args)=>runQuery(()=>{ if(args.length<min||args.length>max) throw new TypeError('Invalid public query argument count.'); return readonly.wrap(operation(...args)); });
  const queries=Object.freeze({
    centroid:query(playerId=>calculateCentroid(W,H,mapState.owner,playerById(playerId))),countryByIndex:query(index=>worldSetup.countryByIdx(queryInteger(index,'country index',0,countries.length-1))),
    playerLabelPositions:query(()=>calculatePlayerLabelPositions(W,H,mapState.owner,players)),
    ownTiles:query(playerId=>landCombat.ownTilesOf(playerById(playerId).id)),coastTiles:query(playerId=>landCombat.coastTilesOf(playerById(playerId).id)),isCoast:query(value=>landCombat.isCoast(tile(value))),
    fortRange:query(structureTile=>structuresSystem.fortRange(structureByTile(structureTile))),fortMultiplier:query((value,playerId)=>structuresSystem.fortMult(tile(value),playerById(playerId).id)),commandCover:query(value=>structuresSystem.commandCover(tile(value))),crowded:query(value=>structuresSystem.crowded(tile(value))),snapBuild:query((playerId,value,type,radius=5)=>{ if(typeof type!=='string'||!Object.hasOwn(R.STRUCT,type)) throw new TypeError('structure type is invalid.'); return structuresSystem.snapBuild(playerById(playerId),tile(value),type,queryInteger(radius,'radius',0,100)); },{min:3,max:4}),structureCost:query((playerId,type)=>{ if(typeof type!=='string'||!Object.hasOwn(R.STRUCT,type)) throw new TypeError('structure type is invalid.'); return structuresSystem.structCost(playerById(playerId),type); }),
    maxTroops:query(playerId=>landCombat.maxTroops(playerById(playerId))),density:query(playerId=>landCombat.density(playerById(playerId))),troopGrowth:query(playerId=>economySystem.troopGrowth(playerById(playerId))),goldGrowth:query(playerId=>economySystem.goldGrowth(playerById(playerId))),garrisonEnabled:query(playerId=>logisticsSystem.gOn(playerById(playerId))),areaAt:query(value=>logisticsSystem.areaAt(tile(value))),areaTouching:query((playerId,targetId)=>logisticsSystem.areaTouching(playerById(playerId),queryInteger(targetId,'targetId',-1,players.length-1))),
    relation:query((leftId,rightId)=>diplomacySystem.relation(playerById(leftId),playerById(rightId))),atPeace:query((leftId,rightId)=>diplomacySystem.atPeace(playerById(leftId).id,playerById(rightId).id)),visibleAt:query((x,y)=>fogSystem.visAt(queryNumber(x,'x'),queryNumber(y,'y'))),airfields:query(playerId=>airSystem.airfieldsOf(playerById(playerId))),hangarCount:query(structureTile=>airSystem.hangarCount(structureByTile(structureTile))),hangarMax:query(structureTile=>airSystem.hangarMax(structureByTile(structureTile))),shipPosition:query(index=>navalSystem.shipXY(engineState.actors.transports[queryInteger(index,'transport index',0,engineState.actors.transports.length-1)])),subVisibleTo:query((shipId,viewerId)=>{ const ship=engineState.actors.warships.find(item=>item.id===queryInteger(shipId,'shipId',1,Number.MAX_SAFE_INTEGER)); if(!ship) throw new TypeError('shipId does not identify a warship.'); return navalSystem.subSeenBy(ship,playerById(viewerId).id); }),missilePosition:query((index,age)=>missilesSystem.missilePos(engineState.actors.missiles[queryInteger(index,'missile index',0,engineState.actors.missiles.length-1)],queryNumber(age,'age'))),
    siloReadyIn:query(playerId=>missilesSystem.siloReadyIn(playerById(playerId))),silosReady:query((playerId,commandOnly=false)=>{ if(typeof commandOnly!=='boolean') throw new TypeError('commandOnly must be boolean.'); return missilesSystem.silosReady(playerById(playerId),commandOnly); },{min:1,max:2}),missileCost:query((playerId,structureTile=null)=>missilesSystem.missileCost(playerById(playerId),structureTile===null?null:structureByTile(structureTile)),{min:1,max:2}),cruiseTargets:query(candidates=>{ const copy=cloneQueryData(candidates); if(!Array.isArray(copy)||copy.length>10000) throw new TypeError('cruise target candidates must be a bounded array.'); for(const candidate of copy) if(!candidate||typeof candidate!=='object'||Array.isArray(candidate)||typeof candidate.type!=='string'||typeof candidate.t!=='number'||!Number.isSafeInteger(candidate.t)||typeof candidate.owner!=='number'||!Number.isSafeInteger(candidate.owner)) throw new TypeError('Invalid cruise target candidate.'); return navalSystem.cruiseTargetsForPresentation(copy); })
  });
  function installTestFixture(name){
    if(name==='submission-failure-projectiles'){ installSubmissionFailureProjectiles(); return readonly.wrap({fixture:name,shells:engineState.actors.shells.length}); }
    if(name==='e10-support-truck'){
      if(!testBridge||!me()||!engineState.lifecycle.paused) throw new Error('E10 support fixture requires a paused test match');
      const owned=engineState.actors.structures.filter(value=>value.owner===me().id&&!value.building),home=owned[0],target=owned[1]||home; if(!home||!target) throw new Error('E10 support fixture requires owned structures'); const x=home.t%W+.5,y=(home.t-home.t%W)/W+.5; engineState.replaceActors('trucks',[{owner:me().id,target,path:[home.t],pos:0,x,y,hdg:0,state:'out',home}]); return readonly.wrap({fixture:name,x,y});
    }
    if(name==='e10-clear-support-truck'){ if(!testBridge) throw new Error('E10 support fixture requires the test bridge'); engineState.replaceActors('trucks',[]); return readonly.wrap({fixture:name}); }
    if(!testBridge) throw new Error('Engine fixtures require the test bridge.');
    if(name!=='dense-late-game') throw new Error(`Unknown engine fixture: ${name}`);
    const human=me(); if(!human||!engineState.lifecycle.paused) throw new Error('late-game scene requires a paused match');
    const rivals=players.filter(player=>player!==human&&player.kind!=='neutral').slice(0,2); if(rivals.length<2) throw new Error('late-game scene requires two rivals');
    let cx=Math.round(human.sx),cy=Math.round(human.sy),best=-1;
    for(let y=35;y<H-35;y+=8) for(let x=35;x<W-35;x+=8){ let landArea=0,waterArea=0; for(let yy=y-18;yy<=y+18;yy+=3) for(let xx=x-18;xx<=x+18;xx+=3) mapState.land[idx(xx,yy)]?landArea++:waterArea++; const score=Math.min(landArea,waterArea); if(score>best){ best=score; cx=x; cy=y; } }
    const ids=[human.id,rivals[0].id,rivals[1].id];
    for(let y=Math.max(0,cy-48);y<Math.min(H,cy+49);y++) for(let x=Math.max(0,cx-56);x<Math.min(W,cx+57);x++){ const tile=idx(x,y); if(mapState.land[tile]) mapState.owner[tile]=ids[x<cx-5?0:x>cx+9?1:2]; }
    const used=new Set(),near=(x,y,wantLand,ownerId)=>{ let found=-1,distance=Infinity; for(let yy=Math.max(0,y-28);yy<Math.min(H,y+29);yy++) for(let xx=Math.max(0,x-28);xx<Math.min(W,x+29);xx++){ const tile=idx(xx,yy); if(!!mapState.land[tile]!==wantLand||used.has(tile)||(ownerId!=null&&mapState.owner[tile]!==ownerId)) continue; const d=(xx-x)**2+(yy-y)**2; if(d<distance){ distance=d; found=tile; } } if(found<0&&wantLand&&ownerId!=null){ for(let yy=Math.max(0,cy-48);yy<Math.min(H,cy+49);yy++) for(let xx=Math.max(0,cx-56);xx<Math.min(W,cx+57);xx++){ const tile=idx(xx,yy); if(!mapState.land[tile]||used.has(tile)) continue; const d=(xx-x)**2+(yy-y)**2; if(d<distance){ distance=d; found=tile; } } if(found>=0) mapState.owner[found]=ownerId; } if(found<0) throw new Error('late-game fixture tile not found'); used.add(found); return found; };
    structuresSystem.clearStructures();
    const addStructure=(type,x,y,ownerId,extra={})=>structuresSystem.addStructure({type,owner:ownerId,t:near(x,y,true,ownerId),cost:0,building:false,...extra});
    const city=addStructure('city',cx-30,cy-13,human.id,{level:2,links:1}),factory=addStructure('factory',cx-22,cy-5,human.id,{links:1}),port=addStructure('port',cx-12,cy+5,human.id,{level:2,gunHp:3,queue:[{cls:'cruiser',done:engineState.clock.tickN+80,total:120}]});
    addStructure('fort',cx-8,cy-15,human.id,{level:3}); addStructure('sam',cx-19,cy+15,human.id,{cool:engineState.clock.tickN+12,hp:3});
    const silo=addStructure('silo',cx-29,cy+13,human.id,{cool:engineState.clock.tickN+70}); addStructure('command',cx-24,cy+4,human.id);
    const airfield=addStructure('airfield',cx-35,cy+3,human.id,{level:2,lshield:3,aq:[]}),enemyShield=addStructure('shield',cx+24,cy-10,rivals[0].id,{hp:4}),enemySam=addStructure('sam',cx+31,cy+8,rivals[0].id,{cool:0,hp:3}); addStructure('bertha',cx+2,cy+17,rivals[1].id,{hp:4});
    engineState.replaceActors('links',[{a:factory,b:city,owner:human.id},{a:factory,b:port,owner:human.id}]);
    const waters=[near(cx-8,cy+15,false),near(cx+2,cy+13,false),near(cx+13,cy+15,false),near(cx+22,cy+19,false)],point=tile=>[tile%W+.5,(tile-tile%W)/W+.5],ships=[];
    const makeShip=(cls,ownerId,t,path=[t],extra={})=>{ const [x,y]=point(t),ship={id:engineState.nextUid(),owner:ownerId,cls,path,pos:0,dest:path[path.length-1],x,y,hp:R.SHIPS[cls].hp,cool:0,ang:0,hdg:-.2,wake:[[x-4,y+1],[x-2,y+.5],[x,y]],barCool:0,...extra}; ships.push(ship); return ship; };
    const flagship=makeShip('battleship',human.id,waters[0],waters,{cruise:true,fireAt:engineState.clock.tickN,fireAng:-.3}); makeShip('cruiser',human.id,waters[1],waters.slice(1),{barCool:engineState.clock.tickN+80}); makeShip('warship',rivals[0].id,waters[2]); makeShip('scout',rivals[1].id,waters[3]); engineState.replaceActors('warships',ships);
    const [ax,ay]=point(airfield.t),[tx,ty]=point(enemyShield.t);
    engineState.replaceActors('aircraft',[{id:engineState.nextUid(),owner:human.id,type:'fighter',home:airfield,state:'patrol',x:ax+10,y:ay-9,tx:cx,ty:cy,hp:3,hdg:.2,until:engineState.clock.tickN+300},{id:engineState.nextUid(),owner:human.id,type:'bomber',home:airfield,state:'run',x:cx-3,y:cy-18,tx,ty,bombs:5,hdg:.1},{id:engineState.nextUid(),owner:rivals[0].id,type:'fighter',home:enemySam,state:'out',x:cx+15,y:cy-17,tx:cx,ty:cy,hp:2,hdg:2.8,until:engineState.clock.tickN+200}]);
    engineState.replaceActors('missiles',[{owner:human.id,t:enemyShield.t,from:silo.t,age:24,flight:55},{owner:rivals[0].id,t:city.t,from:enemySam.t,age:16,flight:55}]); engineState.replaceActors('shells',[{owner:rivals[1].id,x:cx+12,y:cy+11,kind:'land',tx:cx-7,ty:cy-8,radius:3,trail:[[cx+18,cy+15,0],[cx+15,cy+13,4]],delay:0,arc:true,missile:true,speed:3.2,rise:17,ox:cx+18,oy:cy+15}]); engineState.replaceActors('attacks',[{owner:human.id,target:rivals[1].id,front:new Set([near(cx-4,cy-3,true,rivals[1].id)])}]); mapState.shelled[enemySam.t]=engineState.clock.tickN+180;
    human.cmdFocus=rivals[0].id; human.cmdFocusT=enemyShield.t;
    if(START.fog){ if(!fogState.vis) engineState.replaceFogBuffer('vis',new Uint8Array(W*H)); fogState.vis.fill(1); for(let y=Math.max(0,cy-44);y<Math.min(H,cy+45);y++) for(let x=cx+38;x<Math.min(W,cx+64);x++) fogState.vis[idx(x,y)]=0; }
    for(const player of players) if(!ids.includes(player.id)) player.tiles=0;
    for(const player of [human,rivals[0],rivals[1]]) player.tiles=Math.max(1200,player.tiles);
    resetInterpolationFrame();
    return readonly.wrap({fixture:name,center:[cx,cy],flagshipId:flagship.id,labelPositions:[[human.id,[cx-27.5,cy-27.5]],[rivals[0].id,[cx+30.5,cy-26.5]],[rivals[1].id,[cx+2.5,cy+27.5]]],alert:{from:point(enemySam.t),at:point(city.t),owner:rivals[0].id}});
  }
  function installSubmissionFailureProjectiles(){
    if(!testBridge||!me()||!engineState.lifecycle.paused) throw new Error('submission fixture requires a paused test match');
    const base=engineState.actors.shells[0],cx=base?.x??me().sx,cy=base?.y??me().sy,owner=base?.owner??me().id;
    engineState.replaceActors('shells',[{owner,x:cx-40,y:cy-12,tx:cx-30,ty:cy-12,torpedo:true,trail:[[cx-58,cy-15],[cx-55,cy-18],[cx-55,cy-10],[cx-49,cy-18],[cx-43,cy-15]]},{owner,x:cx-20,y:cy+12,tx:cx-10,ty:cy+12,kind:'aam',trail:[[cx-34,cy+15],[cx-27,cy+13]]},{owner,x:cx,y:cy-12,tx:cx+10,ty:cy-12,kind:'land',arc:true,missile:true,tot:20,rise:14,trail:[[cx-14,cy-8,0],[cx-7,cy-10,3]]},{owner,x:cx+20,y:cy+12,tx:cx+30,ty:cy+12,kind:'land',arc:true,tot:20,rise:14,trail:[[cx+6,cy+15],[cx+13,cy+13]]},{owner,x:cx+40,y:cy-12,tx:cx+50,ty:cy-12,kind:'gun',trail:[[cx+26,cy-9],[cx+33,cy-11]]}]);
    const ship=engineState.actors.warships[0],tile=Math.max(0,Math.min(W*H-1,Math.floor(ship?.y??cy)*W+Math.floor(ship?.x??cx)));
    engineState.replaceActors('transports',[{owner:me().id,path:[tile],pos:0,troops:24,heavy:true,hp:R.HEAVY.hp,hdg:0,wake:[[tile%W-2,(tile-tile%W)/W+.5],[tile%W-1,(tile-tile%W)/W+.5]]}]);
    const [fighter,bomber,carrier]=engineState.actors.aircraft,home=fighter?.home;
    engineState.replaceActors('aircraft',[{...fighter,owner:me().id,type:'fighter',home,state:'patrol',x:cx-24,y:cy+30,tx:cx-24,ty:cy+30,hp:2,hdg:.2,until:engineState.clock.tickN+300},{...bomber,owner:me().id,type:'bomber',home,state:'return',x:cx,y:cy+30,tx:cx,ty:cy,pull:1,hp:1,hdg:1.1},{...carrier,owner:me().id,type:'carrier',home,state:'out',x:cx+24,y:cy+30,tx:cx+24,ty:cy+30,hp:1,hdg:2.2}]);
    resetInterpolationFrame();
  }
  const systems=Object.freeze({structures:structuresSystem,landCombat,mapGeneration,diplomacy:diplomacySystem,air:airSystem,fog:fogSystem,missiles:missilesSystem,naval:navalSystem,logistics:logisticsSystem,ai:aiSystem,economy:economySystem,matchFlow,worldSetup,commandRouter,worldLoop});
  checkpointManager=createEngineCheckpointManager({engineState,runtime,W,H,tickMs,
    captureCanonicalCompatibility:()=>({version:'statefall-canonical-compatibility/v1',lastRefreshTick:canonicalLabelRefreshTick,labelPositions:canonicalLabelPositions}),
    restoreCanonicalCompatibility:value=>{ canonicalLabelRefreshTick=value.lastRefreshTick; canonicalLabelPositions=value.labelPositions; },
    onRestore:()=>{ events.length=0; renderStaticDirty=true; resetInterpolationFrame(); }});
  const compatibility=Object.freeze({state:engineState,runtime,ports,systems,rules:R,countries,getMe:me,random:srand,rnd,pick,areaLabel,areaName,calculateCentroid:player=>calculateCentroid(W,H,mapState.owner,player),stateOracle,emitEventForDiagnostics:emit,setEndEnabled:value=>{ endEnabled=!!value; }});
  const api=Object.freeze({start:values=>runOperation(()=>start(values)),setup:values=>runOperation(()=>setup(values)),tick:()=>runOperation(tick),issue:(...args)=>runOperation(()=>{ validateIssue(...args); return atomicCommand(()=>issue(...args)); }),configure:values=>runOperation(()=>configure(values)),loadReplay:(...args)=>runOperation(()=>loadReplay(...args)),configureReplay:values=>runOperation(()=>runtime.configureReplay(values)),takeOverReplay:()=>runOperation(()=>runtime.takeOverReplay()),setCommandHistory:(log,hashes)=>runOperation(()=>atomicCommand(()=>{ runtime.setCommandHistory(log,hashes); checkpointManager.validateCheckpoint(checkpointManager.checkpoint()); return true; })),setLifecycle:(name,value)=>runOperation(()=>engineState.setLifecycle(name,value)),togglePause:()=>runOperation(()=>matchFlow.togglePause()),endMatch:(...args)=>runOperation(()=>{ const input=prepareEndMatch(args); return atomicCommand(()=>matchFlow.endMatch(input.reason,input.text,input.metadata)); }),continueAfterEnd:value=>runOperation(()=>atomicCommand(()=>commandRouter.continueAfterEnd(value))),reset:()=>runOperation(reset),pauseForReplayDivergence:()=>runOperation(pauseForReplayDivergence),resumeAfterReplayDivergence:()=>runOperation(resumeAfterReplayDivergence),presentation:()=>runQuery(()=>presentation),interpolationFrame:()=>runQuery(()=>interpolationFrame),renderBuffers:()=>runQuery(syncRenderBuffers),queries,snapshot:()=>runQuery(()=>freezeDeep(copy(stateOracle.authoritativeState()))),serializeCanonical:()=>runQuery(stateOracle.canonicalState),stateHash:()=>runQuery(stateOracle.stateHash),checkInvariants:()=>runQuery(stateOracle.checkStateInvariants),checkpoint:()=>runQuery(checkpointManager.checkpoint),restoreCheckpoint:value=>runOperation(()=>checkpointManager.restoreCheckpoint(value)),runtimeCheckpoint:()=>runQuery(()=>runtime.checkpoint()),drainEvents,dispatchEvents,flushEvents,...(testBridge?{installTestFixture:name=>runOperation(()=>installTestFixture(name))}:{}),...(options[ENGINE_TEST_DIAGNOSTICS]?{compatibility}: {})});
  const {setLifecycle,...safeApi}=api;
  return Object.freeze({...safeApi,replayMetadata:()=>runQuery(()=>freezeDeep(stateOracle.finalMetadata(runtime.replay.on?runtime.replay.i:null))),beginControllerCatchUp:()=>runOperation(beginControllerCatchUp),finishControllerCatchUp:()=>runOperation(finishControllerCatchUp),beginReplayPlayback:()=>runOperation(beginReplayPlayback),pauseReplayPreview:()=>runOperation(pauseReplayPreview),enterCreditsEndState:()=>runOperation(enterCreditsEndState),finishReplayWatch:()=>runOperation(finishReplayWatch),pauseCreditsAtTarget:()=>runOperation(pauseCreditsAtTarget),enterSpectatorEndState:()=>runOperation(enterSpectatorEndState),...(testBridge||options[ENGINE_TEST_DIAGNOSTICS]?{setLifecycleForDiagnostics:setLifecycle}:{})});
}
