import {copyRollbackGraph} from './rollback-copy.mjs';
import {encodeGraph,decodeGraph} from './graph-codec.mjs';
import {ownAuthorityValue} from './authority-value.mjs';
import {BOOLEAN_SETTING_NAMES,DIFFICULTY_IDS,MAP_IDS,RULE_IDS,validateSettingsCandidate} from './configuration-schema.mjs';

export const ENGINE_CHECKPOINT_VERSION='statefall-engine-checkpoint/v2';
export const CANONICAL_COMPATIBILITY_VERSION='statefall-canonical-compatibility/v1';
const HISTORICAL_ENGINE_CHECKPOINT_VERSION='statefall-engine-checkpoint/v1';
const ACTOR_NAMES=['players','attacks','missiles','structures','transports','warships','shots','interceptors','shells','links','traders','aircraft','trucks','planes'];
const MAP_ARRAYS={land:Uint8Array,owner:Int16Array,struct:Uint8Array,structOwner:Int16Array,region:Int16Array,river:Uint8Array,shelled:Int32Array,rough:Float32Array};
const LIFECYCLE_NAMES=['over','freeplay','spectating','decided','paused','userPaused'];
const DIFFICULTIES=new Set(DIFFICULTY_IDS);
const MAP_NAMES=new Set(MAP_IDS);
const RULE_ID_SET=new Set(RULE_IDS);
const PLAYER_KINDS=new Set(['human','bot','neutral']);
const RELATION_TYPES=new Set(['ally','nap']);
const COMMAND_KINDS=new Set(['menu','click','focus','airAuto','logAuto','autoFire','recall','recallAll','sat','accept','decline','decShare','decWar','continueAfterEnd']);
const isObject=value=>value!==null&&typeof value==='object'&&!Array.isArray(value)&&(Object.getPrototypeOf(value)===Object.prototype||Object.getPrototypeOf(value)===null);
const exact=(value,keys)=>isObject(value)&&Object.keys(value).length===keys.length&&keys.every(key=>Object.hasOwn(value,key));
const integer=value=>Number.isSafeInteger(value)&&value>=0;
const finite=value=>typeof value==='number'&&Number.isFinite(value);
const property=(value,name,test)=>Object.hasOwn(value,name)&&test(value[name]);

export function inspectEngineCheckpointMetadata(checkpoint){
  if(!exact(checkpoint,['version','payload'])||checkpoint.version!==ENGINE_CHECKPOINT_VERSION) throw new TypeError('Invalid engine checkpoint envelope.');
  const decoded=decodeGraph(checkpoint.payload,{maxNodes:100_000,maxValues:5_000_000,maxDepth:128,maxStringLength:1_000_000});
  if(!exact(decoded,['state','runtime','canonicalCompatibility'])||!exact(decoded.state?.clock,['tickN','simMs'])||!integer(decoded.state.clock.tickN)||!exact(decoded.runtime,['version','rng','commands','replay'])||!exact(decoded.runtime.rng,['state','draws'])||!integer(decoded.runtime.rng.draws)||!isObject(decoded.runtime.commands)||!Array.isArray(decoded.runtime.commands.log)||decoded.runtime.commands.log.length>100_000) throw new TypeError('Invalid engine checkpoint metadata.');
  return Object.freeze({tick:decoded.state.clock.tickN,rngDraws:decoded.runtime.rng.draws,commandCount:decoded.runtime.commands.log.length});
}

function replaceObject(target,source){
  for(const key of Object.keys(target)) delete target[key];
  for(const key of Object.keys(source)) Object.defineProperty(target,key,{value:source[key],writable:true,enumerable:true,configurable:true});
}

function validateState(state,W,H,tickMs){
  const top=['dimensions','identity','clock','rules','match','map','actors','fog','diplomacy','garrison','draft','lifecycle','setup','pendingDecision'];
  if(!exact(state,top)||!exact(state.dimensions,['W','H','tickMs'])||state.dimensions.W!==W||state.dimensions.H!==H||state.dimensions.tickMs!==tickMs) throw new TypeError('Checkpoint dimensions or tick duration do not match this engine.');
  if(!exact(state.identity,['uidSeq'])||!integer(state.identity.uidSeq)||!exact(state.clock,['tickN','simMs'])||!integer(state.clock.tickN)||!Number.isFinite(state.clock.simMs)||state.clock.simMs<0) throw new TypeError('Invalid checkpoint clock or identity.');
  if(!exact(state.rules,['settings','allowed'])||!isObject(state.rules.settings)||!(state.rules.allowed instanceof Set)) throw new TypeError('Invalid checkpoint rules.');
  if(Array.from(state.rules.allowed).some(value=>typeof value!=='string')) throw new TypeError('Invalid checkpoint allowed rule.');
  if(!exact(state.match,['playerId','difficulty'])||(state.match.playerId!==null&&!integer(state.match.playerId))||typeof state.match.difficulty!=='string'||!state.match.difficulty) throw new TypeError('Invalid checkpoint match state.');
  const mapKeys=[...Object.keys(MAP_ARRAYS),'landCount','regions','regCount','NP','unclaimed'];
  if(!exact(state.map,mapKeys)||!integer(state.map.landCount)||!integer(state.map.NP)||!Array.isArray(state.map.regions)||!(state.map.unclaimed instanceof Set)) throw new TypeError('Invalid checkpoint map.');
  for(const [name,Type] of Object.entries(MAP_ARRAYS)) if(!(state.map[name] instanceof Type)||state.map[name].length!==W*H) throw new TypeError(`Invalid checkpoint map buffer ${name}.`);
  if(state.map.regCount!==null&&!(state.map.regCount instanceof Int32Array)) throw new TypeError('Invalid checkpoint region index.');
  if(!exact(state.actors,ACTOR_NAMES)||ACTOR_NAMES.some(name=>!Array.isArray(state.actors[name]))) throw new TypeError('Invalid checkpoint actor collections.');
  for(const name of ACTOR_NAMES) if(state.actors[name].some(actor=>!isObject(actor))) throw new TypeError(`Invalid checkpoint actor in ${name}.`);
  state.actors.players.forEach((player,index)=>{ if(player.id!==index) throw new TypeError('Invalid checkpoint player index.'); if(Object.hasOwn(player,'labelPos')) throw new TypeError('Presentation label positions cannot enter checkpoints.'); });
  if(state.match.playerId!==null&&state.match.playerId>=state.actors.players.length) throw new TypeError('Invalid checkpoint player seat.');
  if(!exact(state.fog,['vis','radarLayer','satUntil','satCool','planeCool','myBorders'])||!(state.fog.myBorders instanceof Set)) throw new TypeError('Invalid checkpoint fog state.');
  for(const name of ['vis','radarLayer']) if(state.fog[name]!==null&&(!(state.fog[name] instanceof Uint8Array)||state.fog[name].length!==W*H)) throw new TypeError(`Invalid checkpoint fog buffer ${name}.`);
  for(const name of ['satUntil','satCool','planeCool']) if(!Number.isFinite(state.fog[name])) throw new TypeError(`Invalid checkpoint fog scalar ${name}.`);
  if(!exact(state.diplomacy,['hostile','proposals'])||!isObject(state.diplomacy.hostile)||!Array.isArray(state.diplomacy.proposals)) throw new TypeError('Invalid checkpoint diplomacy.');
  if(!exact(state.garrison,['areaOf','nextAreaId','supplyAt'])||(state.garrison.areaOf!==null&&(!(state.garrison.areaOf instanceof Int32Array)||state.garrison.areaOf.length!==W*H))||!integer(state.garrison.nextAreaId)||!isObject(state.garrison.supplyAt)) throw new TypeError('Invalid checkpoint garrison state.');
  if(!exact(state.draft,['draft','draftPicks','draftTicks'])||(state.draft.draft!==null&&!isObject(state.draft.draft))||!Array.isArray(state.draft.draftPicks)||!integer(state.draft.draftTicks)) throw new TypeError('Invalid checkpoint draft state.');
  if(!exact(state.lifecycle,LIFECYCLE_NAMES)||LIFECYCLE_NAMES.some(name=>typeof state.lifecycle[name]!=='boolean')) throw new TypeError('Invalid checkpoint lifecycle.');
  if(!exact(state.setup,['PRESET','cid','countryPool','chosenFlag'])||(state.setup.PRESET!==null&&!isObject(state.setup.PRESET))||(state.setup.cid!==null&&(!(state.setup.cid instanceof Int16Array)||state.setup.cid.length!==W*H))||!Array.isArray(state.setup.countryPool)||(state.setup.chosenFlag!==null&&!isObject(state.setup.chosenFlag))) throw new TypeError('Invalid checkpoint setup state.');
  if(state.pendingDecision!==null&&!isObject(state.pendingDecision)) throw new TypeError('Invalid checkpoint pending decision.');
}

function validateCanonicalCompatibility(value,state){
  const fail=message=>{ throw new TypeError(`Invalid checkpoint canonical compatibility: ${message}.`); };
  if(!exact(value,['version','lastRefreshTick','labelPositions'])||value.version!==CANONICAL_COMPATIBILITY_VERSION) fail('unsupported metadata');
  if(value.lastRefreshTick===null){ if(value.labelPositions!==null||state.clock.tickN>=30) fail('missing label refresh state'); return; }
  if(!integer(value.lastRefreshTick)||value.lastRefreshTick%30||value.lastRefreshTick>state.clock.tickN||state.clock.tickN-value.lastRefreshTick>=30) fail('invalid label refresh tick');
  if(!Array.isArray(value.labelPositions)||value.labelPositions.length>state.actors.players.length) fail('invalid label cache');
  for(let index=0;index<value.labelPositions.length;index++){
    const point=value.labelPositions[index];
    if(point!=null&&(!Array.isArray(point)||point.length!==2||!point.every(finite))) fail(`invalid label cache entry ${index}`);
  }
}

function validateFiniteGraph(root,staticShellTargets){
  const visited=new Set();
  const visit=(value,path,parent,key)=>{
    if(typeof value==='number'){
      if(Number.isFinite(value)||value===Infinity&&key==='until'&&isObject(parent)&&parent.type==='ally') return;
      throw new TypeError(`Invalid checkpoint authority: non-finite number at ${path}.`);
    }
    if(value===null||typeof value!=='object'||visited.has(value)) return;
    visited.add(value);
    if(ArrayBuffer.isView(value)){ for(let index=0;index<value.length;index++) visit(value[index],`${path}[${index}]`,value,index); return; }
    if(isObject(value)&&Object.hasOwn(value,'static')&&!staticShellTargets.has(value)) throw new TypeError('Invalid checkpoint authority: static inline value is only valid as a shell target.');
    if(value instanceof Set){ let index=0; for(const item of value){ if(item!==null&&(typeof item==='object'||typeof item==='function')) throw new TypeError('Invalid checkpoint authority: canonical Set contains an object value.'); visit(item,`${path}<set:${index++}>`,value,null); } return; }
    if(value instanceof Map){ let index=0; for(const [mapKey,item] of value){ if(mapKey!==null&&(typeof mapKey==='object'||typeof mapKey==='function')) throw new TypeError('Invalid checkpoint authority: canonical Map has an object key.'); visit(mapKey,`${path}<key:${index}>`,value,null); visit(item,`${path}<value:${index++}>`,value,null); } return; }
    for(const childKey of Object.keys(value)) visit(value[childKey],`${path}.${childKey}`,value,childKey);
  };
  visit(root,'checkpoint',null,null);
}

function validateSemantics(state,runtime,canonicalCompatibility,W,H,tickMs){
  const fail=message=>{ throw new TypeError(`Invalid checkpoint authority: ${message}.`); },tileCount=W*H;
  const validPlayer=id=>Number.isInteger(id)&&id>=0&&id<state.actors.players.length;
  const validTile=tile=>Number.isInteger(tile)&&tile>=0&&tile<tileCount;
  // Origins are historical return hints: their areas may disappear while forces travel or fight.
  const validOrigin=id=>integer(id)&&id>0&&id<state.garrison.nextAreaId;
  const settings=state.rules.settings;
  if(!DIFFICULTIES.has(state.match.difficulty)) fail('unsupported difficulty');
  try{ validateSettingsCandidate(settings,settings); }catch(error){ fail(error.message); }
  if(!MAP_NAMES.has(settings.map)) fail('invalid rule settings');
  for(const name of BOOLEAN_SETTING_NAMES) if(typeof settings[name]!=='boolean') fail(`setting ${name} must be boolean`);
  for(const value of state.rules.allowed) if(!RULE_ID_SET.has(value)) fail(`unsupported allowed rule ${value}`);
  if(state.clock.simMs!==state.clock.tickN*tickMs) fail('clock tick and milliseconds differ');
  if(runtime.replay.i>runtime.replay.cmds.length) fail('replay cursor exceeds command count');
  if(runtime.replay.toTick>10_000_000) fail('replay target tick is out of range');
  const validateCommands=(commands,name,maxTick)=>{ let previous=-1,previousPhase=-1; for(const command of commands){ const phase=command.phase==null?0:command.phase==='post-systems'?1:-1; if(!isObject(command)||!integer(command.t)||command.t<previous||command.t===previous&&phase<previousPhase||command.t>maxTick||!COMMAND_KINDS.has(command.k)||!Array.isArray(command.a)||(command.p!=null&&!integer(command.p))||phase<0||(command.k==='continueAfterEnd')!==(phase===1)) fail(`invalid ${name} command`); previous=command.t; previousPhase=phase; } };
  validateCommands(runtime.commands.log,'recorded',state.clock.tickN);
  validateCommands(runtime.replay.cmds,'replay',10_000_000);
  for(const hashes of [runtime.commands.hashes,runtime.replay.hashes||[]]) for(const checkpoint of hashes) if(!Array.isArray(checkpoint)||checkpoint.length<2||!integer(checkpoint[0])||checkpoint[0]%100||typeof checkpoint[1]!=='string') fail('invalid runtime hash checkpoint');

  const {land,owner,struct,structOwner,region,regions,regCount,unclaimed}=state.map,players=state.actors.players;
  if(!Number.isInteger(state.map.NP)||state.map.NP<0||state.map.NP<players.length) fail('map player stride is too small');
  if(regCount!==null&&regCount.length!==regions.length*state.map.NP) fail('region count dimensions differ');
  regions.forEach((item,index)=>{ if(!isObject(item)||item.id!==index||!integer(item.size)) fail(`invalid region ${index}`); });
  const tileCounts=new Int32Array(players.length),regionCounts=new Int32Array(regCount?.length||0),regionSizes=new Int32Array(regions.length);
  let landCount=0,unclaimedCount=0;
  for(let tile=0;tile<tileCount;tile++){
    if(land[tile]!==0&&land[tile]!==1) fail(`invalid terrain at tile ${tile}`);
    if(owner[tile]<-1||owner[tile]>=players.length) fail(`invalid owner at tile ${tile}`);
    if(!land[tile]&&owner[tile]!==-1) fail(`water tile ${tile} is owned`);
    if(region[tile]<-1||region[tile]>=regions.length) fail(`invalid region index at tile ${tile}`);
    if(struct[tile]!==0&&struct[tile]!==1) fail(`invalid structure index at tile ${tile}`);
    if(structOwner[tile]<-1||structOwner[tile]>=players.length) fail(`invalid structure owner at tile ${tile}`);
    if(!struct[tile]&&structOwner[tile]!==-1) fail(`empty tile ${tile} has a structure owner`);
    if(land[tile]){ landCount++; if(region[tile]>=0) regionSizes[region[tile]]++; }
    if(owner[tile]>=0){ tileCounts[owner[tile]]++; if(region[tile]>=0&&regCount) regionCounts[region[tile]*state.map.NP+owner[tile]]++; }
    const isUnclaimed=!!land[tile]&&owner[tile]===-1;
    if(isUnclaimed) unclaimedCount++;
    if(unclaimed.has(tile)!==isUnclaimed) fail(`unclaimed index differs at tile ${tile}`);
  }
  for(const tile of unclaimed) if(!validTile(tile)) fail('unclaimed index contains an invalid tile');
  if(landCount!==state.map.landCount||unclaimedCount!==unclaimed.size) fail('map aggregate counts differ');
  for(let index=0;index<regions.length;index++) if(regions[index].size!==regionSizes[index]) fail(`region size differs at index ${index}`);
  if(regCount) for(let index=0;index<regCount.length;index++) if(regCount[index]!==regionCounts[index]) fail(`region count differs at index ${index}`);

  const areaIds=new Set();
  players.forEach((player,index)=>{
    if(!isObject(player.flag)||!Array.isArray(player.flag.layers)) fail(`player ${index} flag is invalid`);
    if(player.id!==index||!PLAYER_KINDS.has(player.kind)||typeof player.alive!=='boolean'||!finite(player.troops)||!finite(player.gold)||!integer(player.tiles)||player.tiles!==tileCounts[index]) fail(`invalid player ${index}`);
    if(!isObject(player.rel)||!isObject(player.grudge)||!(player.held instanceof Set)||!(player.claimed instanceof Set)) fail(`invalid player collections for ${index}`);
    for(const values of [player.held,player.claimed]) for(const tile of values) if(!validTile(tile)) fail(`player ${index} contains an invalid tile index`);
    for(const key of Object.keys(player.rel)){
      const otherId=Number(key),relation=player.rel[key],other=players[otherId];
      if(!validPlayer(otherId)||otherId===index||!isObject(relation)||!RELATION_TYPES.has(relation.type)||other.rel[index]!==relation) fail(`relationship ${index}/${key} is invalid or asymmetric`);
      if(relation.type==='nap'&&!finite(relation.until)||relation.since!=null&&!integer(relation.since)) fail(`relationship ${index}/${key} has invalid timing`);
    }
    if(player.areas!=null){
      if(!Array.isArray(player.areas)) fail(`player ${index} areas are invalid`);
      for(const area of player.areas){ if(!isObject(area)||!integer(area.id)||areaIds.has(area.id)||area.owner!==index||!integer(area.tiles)||!finite(area.troops)||!finite(area.cx)||!finite(area.cy)) fail(`invalid garrison area for player ${index}`); areaIds.add(area.id); }
    }
  });
  if(state.match.playerId!==null&&!validPlayer(state.match.playerId)) fail('invalid player seat');

  const structures=new Set(state.actors.structures),byTile=new Map(),uidIds=new Set(),actorObjects=new Set();
  for(const [name,collection] of Object.entries(state.actors)) for(const actor of collection){ if(actorObjects.has(actor)) fail(`actor appears more than once or in multiple collections (${name})`); actorObjects.add(actor); }
  for(const structure of structures){
    if(!validPlayer(structure.owner)||!validTile(structure.t)||typeof structure.type!=='string'||!RULE_ID_SET.has(structure.type)||byTile.has(structure.t)) fail('invalid or duplicate structure');
    byTile.set(structure.t,structure);
    if(!struct[structure.t]||structOwner[structure.t]!==structure.owner||owner[structure.t]!==structure.owner) fail(`structure index differs at tile ${structure.t}`);
  }
  for(let tile=0;tile<tileCount;tile++) if(!!struct[tile]!==byTile.has(tile)) fail(`structure membership differs at tile ${tile}`);
  for(const [name,collection] of Object.entries(state.actors)){
    if(name==='players') continue;
    for(const actor of collection){
      if(Object.hasOwn(actor,'owner')&&!validPlayer(actor.owner)) fail(`${name} actor has an invalid owner`);
      if(Object.hasOwn(actor,'id')){ if(!integer(actor.id)||actor.id===0||uidIds.has(actor.id)) fail(`${name} actor has an invalid or duplicate UID`); uidIds.add(actor.id); }
      if(Object.hasOwn(actor,'t')&&!validTile(actor.t)) fail(`${name} actor has an invalid tile`);
      if(Array.isArray(actor.path)&&actor.path.some(tile=>!validTile(tile))) fail(`${name} actor has an invalid path`);
    }
  }
  const actor=(name,value,required)=>{
    for(const [field,test] of required) if(!property(value,field,test)) fail(`${name} actor is missing or has invalid ${field}`);
  };
  const text=value=>typeof value==='string'&&value.length>0&&value.length<=200,boolean=value=>typeof value==='boolean',number=value=>finite(value),array=Array.isArray;
  for(const player of players) actor('players',player,[['id',integer],['name',text],['color',text],['kind',value=>PLAYER_KINDS.has(value)],['flag',isObject],['troops',number],['gold',number],['tiles',integer],['alive',boolean],['held',value=>value instanceof Set],['claimed',value=>value instanceof Set],['grudge',isObject],['focus',value=>finite(value)&&value>=0&&value<=1],['rel',isObject]]);
  for(const value of state.actors.attacks){ actor('attacks',value,[['owner',validPlayer],['target',target=>target===-1||validPlayer(target)],['troops',number],['front',front=>front instanceof Set],['naval',boolean],['age',integer],['startTiles',integer]]); if(value.spent!=null&&!finite(value.spent)) fail('attacks actor has invalid spent'); if(!Object.hasOwn(value,'origin')||value.origin!==null&&!integer(value.origin)) fail('attacks actor has invalid origin'); }
  for(const value of state.actors.structures) actor('structures',value,[['owner',validPlayer],['t',validTile],['type',type=>typeof type==='string'&&RULE_ID_SET.has(type)]]);
  for(const value of state.actors.missiles) actor('missiles',value,[['owner',validPlayer],['t',validTile],['from',validTile],['age',integer],['flight',value=>finite(value)&&value>=0]]);
  for(const value of state.actors.interceptors) actor('interceptors',value,[['owner',validPlayer],['target',target=>state.actors.missiles.includes(target)],['x',number],['y',number],['trail',array],['age',integer],['hit',number],['ship',boolean]]);
  for(const value of state.actors.aircraft) actor('aircraft',value,[['id',value=>integer(value)&&value>0],['owner',validPlayer],['type',text],['home',home=>structures.has(home)],['state',text],['x',number],['y',number],['hdg',number],['hp',number]]);
  for(const value of state.actors.warships) actor('warships',value,[['id',value=>integer(value)&&value>0],['owner',validPlayer],['cls',text],['path',array],['pos',value=>finite(value)&&value>=0],['dest',validTile],['hp',number],['cool',number],['hdg',number],['wake',array]]);
  for(const value of state.actors.transports) actor('transports',value,[['owner',validPlayer],['target',target=>target===-1||validPlayer(target)],['troops',number],['seed',validTile],['path',array],['pos',value=>finite(value)&&value>=0],['hdg',number],['wake',array],['hp',number]]);
  for(const value of state.actors.traders) actor('traders',value,[['owner',validPlayer],['from',from=>structures.has(from)],['to',to=>structures.has(to)],['path',array],['pos',value=>finite(value)&&value>=0],['hdg',number],['wake',array]]);
  for(const value of state.actors.trucks) actor('trucks',value,[['owner',validPlayer],['target',target=>structures.has(target)],['home',home=>structures.has(home)],['path',array],['pos',value=>finite(value)&&value>=0],['x',number],['y',number],['hdg',number],['state',text]]);
  for(const value of state.actors.shells) actor('shells',value,[['owner',validPlayer],['x',number],['y',number],['kind',text],['trail',array]]);
  if(uidIds.size&&state.identity.uidSeq<Math.max(...uidIds)) fail('UID cursor precedes an actor UID');
  for(const attack of state.actors.attacks){ if(!(attack.front instanceof Set)||[...attack.front].some(tile=>!validTile(tile))||attack.target!==-1&&!validPlayer(attack.target)||attack.origin!==null&&attack.origin!==undefined&&!validOrigin(attack.origin)) fail('invalid attack references'); }
  for(const transport of state.actors.transports) if(transport.target!==-1&&!validPlayer(transport.target)||!validTile(transport.seed)||(transport.origin!==null&&transport.origin!==undefined&&!validOrigin(transport.origin))||(transport.attacker!=null&&!structures.has(transport.attacker)&&!state.actors.warships.includes(transport.attacker))) fail('invalid transport references');
  for(const missile of state.actors.missiles) if(!validTile(missile.from)) fail('invalid missile origin');
  for(const interceptor of state.actors.interceptors) if(!state.actors.missiles.includes(interceptor.target)) fail('invalid interceptor target');
  for(const link of state.actors.links) if(!structures.has(link.a)||!structures.has(link.b)||link.a===link.b||!validPlayer(link.owner)) fail('invalid structure link');
  for(const aircraft of state.actors.aircraft) if(!structures.has(aircraft.home)) fail('invalid aircraft home');
  for(const trader of state.actors.traders) if(!structures.has(trader.from)||!structures.has(trader.to)) fail('invalid trader port reference');
  for(const truck of state.actors.trucks) if(!structures.has(truck.home)||!structures.has(truck.target)) fail('invalid truck structure reference');
  for(const warship of state.actors.warships) if(warship.boarding!=null&&!state.actors.traders.includes(warship.boarding)) fail('invalid warship boarding reference');
  const shellTargets=new Set([...state.actors.structures,...state.actors.transports,...state.actors.warships,...state.actors.traders,...state.actors.aircraft]),staticShellTargets=new Set();
  for(const shell of state.actors.shells){
    if(shell.target!=null&&!shellTargets.has(shell.target)){
      if(!exact(shell.target,['x','y','static'])||!finite(shell.target.x)||!finite(shell.target.y)||shell.target.static!==true) fail('invalid shell target');
      staticShellTargets.add(shell.target);
    }
    if(shell.from!=null&&!structures.has(shell.from)&&!state.actors.warships.includes(shell.from)) fail('invalid shell origin reference');
  }
  for(const player of players) if(player.cmdTarget!=null&&!structures.has(player.cmdTarget)) fail(`player ${player.id} has an invalid command target`);

  const hostile=state.diplomacy.hostile;
  for(const key of Object.keys(hostile)){
    const match=/^(\d+),(\d+)$/.exec(key),a=match&&+match[1],b=match&&+match[2];
    if(!match||!validPlayer(a)||!validPlayer(b)||a===b||!integer(hostile[key])||hostile[`${b},${a}`]!==hostile[key]) fail(`invalid or asymmetric hostility ${key}`);
  }
  for(const proposal of state.diplomacy.proposals) if(!isObject(proposal)||!validPlayer(proposal.from)||!['ally','nap','reqTroops','reqGold'].includes(proposal.type)||!integer(proposal.until)) fail('invalid diplomacy proposal');
  for(const tile of state.fog.myBorders) if(!validTile(tile)) fail('fog border index is invalid');
  if(state.garrison.areaOf){
    for(let tile=0;tile<tileCount;tile++){ const areaId=state.garrison.areaOf[tile]; if(areaId!==-1&&!areaIds.has(areaId)) fail(`unknown garrison area at tile ${tile}`); }
    if(areaIds.size&&state.garrison.nextAreaId<=Math.max(...areaIds)) fail('garrison area cursor is not ahead of IDs');
  }else if(settings.garrison&&players.length) fail('garrison map is missing');
  for(const key of Object.keys(state.garrison.supplyAt)){ const areaId=key.startsWith('warn')?+key.slice(4):+key; if(!areaIds.has(areaId)||!integer(state.garrison.supplyAt[key])) fail(`invalid garrison supply cursor ${key}`); }
  if(state.setup.cid!==null) for(const id of state.setup.cid) if(id<-1) fail('invalid setup country index');
  if(state.setup.countryPool.some(id=>!integer(id))) fail('invalid setup country pool');
  if(state.draft.draft){ const draft=state.draft.draft; if(!Array.isArray(draft.order)||!integer(draft.idx)||draft.idx>=draft.order.length||draft.order.some(player=>!players.includes(player))) fail('invalid draft cursor or player reference'); }
  for(const pick of state.draft.draftPicks) if(!isObject(pick)||!validPlayer(pick.owner)||!integer(pick.at)) fail('invalid draft pick');
  if(state.pendingDecision!==null&&(state.pendingDecision.type!=='allied-endgame'||!Array.isArray(state.pendingDecision.rivalIds)||state.pendingDecision.rivalIds.some(id=>!validPlayer(id)))) fail('invalid pending decision');

  validateFiniteGraph({state,runtime,canonicalCompatibility},staticShellTargets);
}

function validateOwnershipGraph(state,runtime){
  const ownership=new Map(),references=new Map(),players=state.actors.players;
  const own=(value,type,path)=>{ if(ownership.has(value)) throw new TypeError(`Invalid checkpoint authority: object has multiple owners at ${ownership.get(value).path} and ${path}.`); ownership.set(value,{type,path}); };
  const reference=(value,path)=>{ let paths=references.get(value); if(!paths) references.set(value,paths=[]); paths.push(path); };
  for(const [name,collection] of Object.entries(state.actors)) collection.forEach((actor,index)=>own(actor,name,`state.actors.${name}.${index}`));
  state.actors.shells.forEach((shell,index)=>{ if(shell.target&&shell.target.static===true) own(shell.target,'shellStaticTarget',`state.actors.shells.${index}.target`); });
  players.forEach((player,index)=>{
    own(player.flag,'playerFlag',`state.actors.players.${index}.flag`);
    if(Array.isArray(player.areas)) player.areas.forEach((area,areaIndex)=>own(area,'area',`state.actors.players.${index}.areas.${areaIndex}`));
  });
  const relations=new Map();
  players.forEach((player,index)=>{ for(const [otherId,relation] of Object.entries(player.rel||{})){ let record=relations.get(relation); if(!record) relations.set(relation,record=[]); record.push(`state.actors.players.${index}.rel.${otherId}`); } });
  for(const [relation,paths] of relations){
    if(paths.length!==2) throw new TypeError(`Invalid checkpoint authority: relationship record must occur at its exact symmetric pair (${paths.join(', ')}).`);
    const pair=paths.map(path=>path.match(/players\.(\d+)\.rel\.(\d+)$/).slice(1).map(Number));
    if(pair[0][0]!==pair[1][1]||pair[0][1]!==pair[1][0]) throw new TypeError(`Invalid checkpoint authority: relationship record is not at a symmetric pair (${paths.join(', ')}).`);
    own(relation,'relation',paths[0]); reference(relation,paths[1]);
  }
  const seen=new Map(),visit=(value,path)=>{
    if(value===null||typeof value!=='object') return;
    if(seen.has(value)){ reference(value,path); return; }
    seen.set(value,path);
    if(ArrayBuffer.isView(value)) return;
    if(value instanceof Set){ let index=0; for(const item of value) visit(item,`${path}<set:${index++}>`); return; }
    if(value instanceof Map){ let index=0; for(const [key,item] of value){ visit(key,`${path}<key:${index}>`); visit(item,`${path}<value:${index++}>`); } return; }
    for(const key of Object.keys(value)) visit(value[key],`${path}.${key}`);
  };
  visit(state,'state'); visit(runtime,'runtime');
  for(const [value,owner] of ownership) if(seen.get(value)!==owner.path) throw new TypeError(`Invalid checkpoint authority: ${owner.type} must first appear at its owner ${owner.path}, not ${seen.get(value)}.`);
  const patterns={
    players:[/^state\.draft\.draft\.order\.\d+$/],
    structures:[/^state\.actors\.players\.\d+\.cmdTarget$/, /^state\.actors\.links\.\d+\.(a|b)$/, /^state\.actors\.transports\.\d+\.attacker$/, /^state\.actors\.(aircraft|trucks)\.\d+\.home$/, /^state\.actors\.trucks\.\d+\.target$/, /^state\.actors\.traders\.\d+\.(from|to)$/, /^state\.actors\.shells\.\d+\.(from|target)$/],
    missiles:[/^state\.actors\.interceptors\.\d+\.target$/],
    warships:[/^state\.actors\.transports\.\d+\.attacker$/, /^state\.actors\.shells\.\d+\.(from|target)$/],
    transports:[/^state\.actors\.shells\.\d+\.target$/], traders:[/^state\.actors\.(warships\.\d+\.boarding|shells\.\d+\.target)$/], aircraft:[/^state\.actors\.shells\.\d+\.target$/],
    area:[/^state\.actors\.attacks\.\d+\.origin$/]
  };
  for(const [value,paths] of references){
    const owner=ownership.get(value);
    if(owner){
      for(const path of paths){
        if(path===owner.path||owner.type==='relation'&&relations.get(value).includes(path)) continue;
        if(!(patterns[owner.type]||[]).some(pattern=>pattern.test(path))) throw new TypeError(`Invalid checkpoint authority: ${owner.type} owned at ${owner.path} is not a legal reference at ${path}.`);
      }
      continue;
    }
    throw new TypeError(`Invalid checkpoint authority: prohibited alias at ${paths.join(' and ')}.`);
  }
}

function remapGraph(root,replacements){
  const seen=new Set();
  function visit(value){
    if(value===null||typeof value!=='object'||ArrayBuffer.isView(value)) return replacements.get(value)||value;
    if(seen.has(value)) return replacements.get(value)||value;
    seen.add(value);
    if(value instanceof Set){ const items=Array.from(value,visit); value.clear(); for(const item of items) value.add(item); }
    else if(value instanceof Map){ const entries=Array.from(value,([key,item])=>[visit(key),visit(item)]); value.clear(); for(const [key,item] of entries) value.set(key,item); }
    else for(const key of Object.keys(value)) value[key]=visit(value[key]);
    return replacements.get(value)||value;
  }
  return visit(root);
}

export function createEngineCheckpointManager({engineState,runtime,W,H,tickMs,captureCanonicalCompatibility,restoreCanonicalCompatibility,onRestore=()=>{}}){
  function captureState(){
    const {map,actors,fog,diplomacy,garrison,draft,lifecycle,setup,rules,match,clock}=engineState;
    return {
      dimensions:{W,H,tickMs},identity:{uidSeq:engineState.uidSeq},clock:{tickN:clock.tickN,simMs:clock.simMs},
      rules:{settings:rules.settings,allowed:rules.allowed},match:{playerId:match.playerId,difficulty:match.difficulty},
      map:{land:map.land,owner:map.owner,struct:map.struct,structOwner:map.structOwner,region:map.region,river:map.river,shelled:map.shelled,rough:map.rough,landCount:map.landCount,regions:map.regions,regCount:map.regCount,NP:map.NP,unclaimed:map.unclaimed},
      actors:Object.fromEntries(ACTOR_NAMES.map(name=>[name,actors[name]])),
      fog:{vis:fog.vis,radarLayer:fog.radarLayer,satUntil:fog.satUntil,satCool:fog.satCool,planeCool:fog.planeCool,myBorders:fog.myBorders},
      diplomacy:{hostile:diplomacy.hostile,proposals:diplomacy.proposals},garrison:{areaOf:garrison.areaOf,nextAreaId:garrison.nextAreaId,supplyAt:garrison.supplyAt},
      draft:{draft:draft.draft,draftPicks:draft.draftPicks,draftTicks:draft.draftTicks},lifecycle:Object.fromEntries(LIFECYCLE_NAMES.map(name=>[name,lifecycle[name]])),
      setup:{PRESET:setup.PRESET,cid:setup.cid,countryPool:setup.countryPool,chosenFlag:setup.chosenFlag},pendingDecision:engineState.pendingDecision
    };
  }
  function checkpoint(){ return {version:ENGINE_CHECKPOINT_VERSION,payload:encodeGraph({state:captureState(),runtime:runtime.checkpoint(),canonicalCompatibility:captureCanonicalCompatibility()})}; }
  function prepareCheckpoint(checkpoint){
    checkpoint=ownAuthorityValue(checkpoint,{path:'engine checkpoint'});
    if(!exact(checkpoint,['version','payload'])) throw new TypeError('Invalid engine checkpoint envelope.');
    if(checkpoint.version===HISTORICAL_ENGINE_CHECKPOINT_VERSION) throw new TypeError('Historical engine checkpoint v1 lacks canonical compatibility metadata and cannot be restored exactly.');
    if(checkpoint.version!==ENGINE_CHECKPOINT_VERSION) throw new TypeError('Unsupported engine checkpoint version.');
    const decoded=decodeGraph(checkpoint.payload);
    if(!exact(decoded,['state','runtime','canonicalCompatibility'])) throw new TypeError('Invalid engine checkpoint payload.');
    validateState(decoded.state,W,H,tickMs);
    runtime.validateCheckpoint(decoded.runtime);
    validateCanonicalCompatibility(decoded.canonicalCompatibility,decoded.state);
    validateOwnershipGraph(decoded.state,decoded.runtime);
    validateSemantics(decoded.state,decoded.runtime,decoded.canonicalCompatibility,W,H,tickMs);
    return decoded;
  }
  function installCheckpoint(decoded){
    const state=decoded.state,{map,actors,fog,diplomacy,garrison,draft,setup,rules}=engineState,replacements=new Map(),copies=[];
    const preserve=(source,target)=>{ replacements.set(source,target); copies.push([source,target]); };
    preserve(state.rules.settings,rules.settings); preserve(state.rules.allowed,rules.allowed);
    for(const name of Object.keys(MAP_ARRAYS)) preserve(state.map[name],map[name]);
    preserve(state.map.regions,map.regions); preserve(state.map.unclaimed,map.unclaimed);
    for(const name of ACTOR_NAMES) preserve(state.actors[name],actors[name]);
    preserve(state.fog.myBorders,fog.myBorders); preserve(state.diplomacy.hostile,diplomacy.hostile); preserve(state.diplomacy.proposals,diplomacy.proposals);
    preserve(state.garrison.supplyAt,garrison.supplyAt); preserve(state.draft.draftPicks,draft.draftPicks); preserve(state.setup.countryPool,setup.countryPool);
    remapGraph(state,replacements);

    runtime.restoreCheckpoint(decoded.runtime);
    restoreCanonicalCompatibility(decoded.canonicalCompatibility);
    for(const [source,target] of copies){
      if(ArrayBuffer.isView(target)) target.set(source);
      else if(target instanceof Set){ target.clear(); for(const item of source) target.add(item); }
      else if(Array.isArray(target)){ target.length=0; for(const item of source) target.push(item); }
      else replaceObject(target,source);
    }
    map.landCount=state.map.landCount; map.regCount=state.map.regCount; map.NP=state.map.NP;
    engineState.setPlayerId(state.match.playerId); engineState.setDifficulty(state.match.difficulty); engineState.restoreIdentity(state.identity.uidSeq); engineState.setClock(state.clock.tickN,state.clock.simMs);
    engineState.replaceFogBuffer('vis',state.fog.vis); engineState.replaceFogBuffer('radarLayer',state.fog.radarLayer);
    for(const name of ['satUntil','satCool','planeCool']) engineState.setFogScalar(name,state.fog[name]);
    garrison.areaOf=state.garrison.areaOf; garrison.nextAreaId=state.garrison.nextAreaId; draft.draft=state.draft.draft; draft.draftTicks=state.draft.draftTicks;
    engineState.setSetupMap(state.setup.PRESET,state.setup.cid); engineState.setChosenFlag(state.setup.chosenFlag); engineState.setPendingDecision(state.pendingDecision);
    for(const name of LIFECYCLE_NAMES) engineState.setLifecycle(name,state.lifecycle[name]);
    onRestore();
  }
  function restoreCheckpoint(checkpoint){ installCheckpoint(prepareCheckpoint(checkpoint)); }
  function captureRollback(){ return copyRollbackGraph({state:captureState(),runtime:runtime.checkpoint(),canonicalCompatibility:captureCanonicalCompatibility()}); }
  function restoreRollback(decoded){ installCheckpoint(decoded); }
  return Object.freeze({checkpoint,validateCheckpoint:value=>(prepareCheckpoint(value),true),restoreCheckpoint,captureRollback,restoreRollback});
}
