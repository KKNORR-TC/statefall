import {assertCommand,assertCommandArguments,assertCommandKind,assertMenuAction} from './command-schema.mjs';
import {ownAuthorityValue} from './authority-value.mjs';

const noop=()=>{};
const PAUSED_MENU_ACTIONS=new Set(['focus','unfocus','pickattack','pickreinf','ally','nap','war','askGold','askTroops','giveGold','giveTroops']);

export function createCommandRouter({
  engineState,runtime,settings,definitions,ships,air,shield,levelShield,cruise,
  constants,
  queries,
  actions,
  adapters={}
}){
  const clock=engineState.clock,lifecycle=engineState.lifecycle,draft=engineState.draft,map=engineState.map;
  const {players,aircraft,structures,warships,attacks}=engineState.actors;
  const commands=runtime.commands,replay=runtime.replay;
  const fail=adapters.fail||noop,log=adapters.log||noop,sound=adapters.sound||noop;
  const invalidateUi=adapters.invalidateUi||noop,setPickMode=adapters.setPickMode||noop,clearBuildMode=adapters.clearBuildMode||noop;

  function currentActorId(){ return engineState.match.playerId; }
  function resolveActor(actorId){
    const id=actorId==null?currentActorId():actorId;
    const actor=Number.isInteger(id)?players[id]:null;
    if(!actor) throw new RangeError(`Unknown command actor: ${id}.`);
    return actor;
  }
  function shipById(id){ return warships.find(ship=>ship.id===id); }
  function structureByTile(tile){ return tile>=0?queries.structAtT(tile):null; }
  const validTile=tile=>Number.isSafeInteger(tile)&&tile>=0&&tile<map.land.length;
  function validateSimple(kind,args,actor){
    if(kind==='recall'&&!aircraft.some(value=>value.id===args[0]&&value.owner===actor.id)) throw new RangeError('Unknown or foreign aircraft.');
    if(['accept','decline'].includes(kind)&&(!players[args[0]]||args[0]===actor.id)) throw new RangeError('Unknown command target.');
    if(['decShare','decWar'].includes(kind)&&(!engineState.pendingDecision||engineState.pendingDecision.type!=='allied-endgame'||actor.id!==currentActorId())) throw new RangeError('No allied decision is pending for this actor.');
    if(kind==='continueAfterEnd'&&!lifecycle.over) throw new RangeError('The match has not ended.');
  }
  function validateMenu(data,tile,selectedIds,siteTile,ratioValue,aidGold,aidTroops,actor){
    if(!validTile(tile)) throw new RangeError(`Command tile is out of bounds: ${tile}.`);
    if(siteTile!==-1&&!validTile(siteTile)) throw new RangeError(`Command site tile is out of bounds: ${siteTile}.`);
    const selected=selectedIds.map(shipById);
    if(selected.some((ship,index)=>!ship||ship.owner!==actor.id||ship.id!==selectedIds[index])) throw new RangeError('Selected ship is unknown or foreign.');
    const siteActions=new Set(['upgrade','buyf','buyb','buyc','repair','repairstop','cancelship','cancel']),site=structureByTile(siteTile);
    if(siteActions.has(data.act)&&(!site||site.owner!==actor.id)) throw new RangeError('Command site is unknown or foreign.');
    const targetActions=new Set(['bstrike','blockade','focus','nap','ally','war','giveTroops','giveGold','askTroops','askGold','attackfrom','transportfrom','transport']);
    const ownerId=map.owner[tile];
    if(targetActions.has(data.act)&&ownerId>=players.length) throw new RangeError('Command target owner does not exist.');
    if(['focus','nap','ally','war','giveTroops','giveGold','askTroops','askGold'].includes(data.act)&&(!players[ownerId]||ownerId===actor.id)) throw new RangeError('Command target must be another player.');
    if(data.act==='blockade'&&!players[ownerId]) throw new RangeError('Blockade target does not exist.');
    if(data.act==='attackfrom'||data.act==='transportfrom'){
      const area=actions.areaById(data.area);
      if(!area||area.owner!==actor.id) throw new RangeError('Source area is unknown or foreign.');
    }
    return selected;
  }
  function validateClick(tile,env,actor){
    if(!validTile(tile)) throw new RangeError(`Command tile is out of bounds: ${tile}.`);
    if(env.pick&&!validTile(env.pick.t)) throw new RangeError(`Pick target tile is out of bounds: ${env.pick.t}.`);
    if(env.pick&&map.owner[tile]!==actor.id) throw new RangeError('Pick source must be owned by the command actor.');
  }
  function record(kind,args,actor){
    if(commands.replaying||replay.on) return;
    runtime.recordCommand(clock.tickN,kind,args);
    if(actor.id!==currentActorId()) commands.log[commands.log.length-1].p=actor.id;
  }
  function pausedMessage(){ fail('Paused — unpause to give orders (or tick "Paused orders" on the start card).'); }

  function applySimple(kind,args,actorId){
    assertCommandKind(kind);
    if(kind==='menu'||kind==='click') throw new TypeError(`Command kind ${kind} requires its dedicated route.`);
    const actor=resolveActor(actorId);
    switch(kind){
      case 'focus': actor.focus=args[0]; break;
      case 'airAuto': actor.airAuto=args[0]; break;
      case 'logAuto': actor.logisticsAuto=args[0]; break;
      case 'autoFire': actor.autoFire=args[0]; break;
      case 'recall': { const craft=aircraft.find(value=>value.id===args[0]&&value.owner===actor.id); if(craft) actions.recallAircraft(craft); break; }
      case 'recallAll': aircraft.filter(value=>value.owner===actor.id&&(args[0]==='dmg'?(value.type==='fighter'&&value.hp<=2):true)).forEach(actions.recallAircraft); break;
      case 'sat': actions.launchSatellite(actor); break;
      case 'accept': actions.accept(actor,args[0],args[1],args[2]); break;
      case 'decline': actions.decline(actor,args[0]); break;
      case 'decShare': adapters.closeAlliedDecision?.(); actions.resolveSharedVictory(actor); break;
      case 'decWar': adapters.closeAlliedDecision?.(); actions.continueWar(actor); break;
      case 'continueAfterEnd': actions.continueAfterEnd(args[0]); break;
    }
    if(!commands.replaying) invalidateUi();
  }

  function menuAction(data,tile,selectedIds,siteTile,ratioValue,aidGold,aidTroops,actorId){
    assertMenuAction(data);
    const actor=resolveActor(actorId);
    const selectedShips=selectedIds.map(shipById);
    const site=structureByTile(siteTile);
    if(data.act==='plane') actions.callPlane(actor,tile);
    else if(data.act==='fpatrol') actions.launchFighter(actor,tile);
    else if(data.act==='bstrike'){ const ownerId=map.owner[tile]; if(ownerId>=0&&actions.atPeace(actor.id,ownerId)) fail(`You're at peace with ${players[ownerId].name}.`); else actions.launchBomber(actor,tile); }
    else if(data.act==='recallnear') aircraft.filter(value=>value.owner===actor.id&&value.type==='fighter'&&['out','patrol'].includes(value.state)&&Math.hypot(value.tx-(tile%constants.W+.5),value.ty-((tile-tile%constants.W)/constants.W+.5))<=air.fighter.patrol+6).forEach(actions.recallAircraft);
    else if(data.act==='upgrade') actions.upgradeStructure(actor,site);
    else if(data.act==='buyf') actions.buyAircraft(actor,site,'fighter');
    else if(data.act==='buyb') actions.buyAircraft(actor,site,'bomber');
    else if(data.act==='buyc') actions.buyAircraft(actor,site,'carrier');
    else if(data.act==='paradrop'){ const idle=actions.garrisonOn(actor)&&actions.idleAircraft(actor,'carrier',tile); const source=idle?(actions.areaAt(idle.home.t)||actor.areas[0]):null; actions.launchParadrop(actor,tile,(source?source.troops:actor.troops)*ratioValue/100); }
    else if(data.act==='sat') actions.launchSatellite(actor);
    else if(data.act==='refit'){
      let count=0;
      for(const vessel of selectedShips){
        if(vessel.cls!=='battleship'||vessel.cruise||vessel.refit) continue;
        const inRange=structures.some(value=>value.type==='port'&&(value.level||1)>=2&&!value.building&&value.owner===actor.id&&((value.t%constants.W+.5-vessel.x)**2+((value.t-value.t%constants.W)/constants.W+.5-vessel.y)**2)<=constants.linkRange*constants.linkRange);
        if(!inRange||actor.gold<cruise.cost) continue;
        actor.gold-=cruise.cost; vessel.refit=clock.tickN+(settings.instant?0:cruise.ticks); count++;
      }
      if(count){ log(`${count} battleship${count>1?'s':''} refitting with cruise missiles — ${cruise.ticks/10} s.`,true); sound('build'); }
      else fail('No battleship in range of a level II port, or not enough gold.');
    }
    else if(data.act==='move'){ const count=actions.moveShips(tile,selectedShips); if(count) log(`${count} ship${count>1?'s':''} under way.`,true); else fail('No sea route to that spot.'); }
    else if(data.act==='blockade'){ const water=actions.waterNeighbor(tile),count=water>=0?actions.moveShips(water,selectedShips):0; if(count) log(`Blockading ${players[map.owner[tile]].name}'s port.`,true); else fail('No sea route to that port.'); }
    else if(data.act==='warship'){ const cls=data.cls||'warship'; if(actions.orderWarship(actor,tile,cls)) log(`${ships[cls].label} leaving port.`,true); else fail('No sea route from your ports to that spot.'); }
    else if(data.act==='build'){ const kind=data.type; if(actions.placeStructure(actor,kind,tile)) log(`Built a ${definitions[kind].label.toLowerCase()}.`,true); else fail('Could not build there.'); }
    else if(data.act==='focus'){ actor.cmdFocus=map.owner[tile]; actor.cmdFocusT=tile; actor.cmdTarget=null; log(`Missile command: concentrating on ${players[map.owner[tile]].name} around here.`,true); }
    else if(data.act==='unfocus'){ actor.cmdFocus=null; actor.cmdFocusT=null; actor.cmdTarget=null; log('Missile command: back to automatic targeting.',true); }
    else if(data.act==='repair'){
      if(site&&structures.includes(site)){ const need=site.type==='airfield'?levelShield.hp-(site.lshield||0):site.type==='port'?4-(site.gunHp||0):shield.hp-site.hp; if(need>0&&actor.gold>=shield.repairCost*need){ actor.gold-=shield.repairCost*need; site.repairing=true; site.repairAt=clock.tickN+shield.repairTicks; log(`Repairing shield: ${need} pip${need>1?'s':''}, ${shield.repairCost*need} gold.`,true); sound('build'); } else fail('Not enough gold for that repair.'); }
    }
    else if(data.act==='repairstop'){ if(site){ const left=site.type==='airfield'?levelShield.hp-(site.lshield||0):site.type==='port'?4-(site.gunHp||0):shield.hp-site.hp; site.repairing=false; actor.gold+=shield.repairCost*left; log('Repair stopped, remaining gold refunded.',true); } }
    else if(data.act==='cancelship'){ if(site&&site.queue&&site.queue.length){ const job=actions.cancelQueued(site); actor.gold+=Math.round(ships[job.cls].cost*constants.cancelRefund); log(`${ships[job.cls].label} cancelled.`,true); } }
    else if(data.act==='cancel'){ if(site&&structures.includes(site)&&site.building&&site.owner===actor.id){ actor.gold+=Math.round(site.cost*constants.cancelRefund); actions.destroyStructure(site.t); actions.structCounts(actor); log(`Construction cancelled, ${Math.round(site.cost*constants.cancelRefund)} gold refunded.`,true); sound('error'); } else fail('Nothing to cancel there.'); }
    else if(data.act==='nuke') actions.launchMissile(actor,tile);
    else if(data.act==='nap'||data.act==='ally') actions.propose(actor,players[map.owner[tile]],data.act);
    else if(data.act==='war') actions.breakRelation(actor,players[map.owner[tile]]);
    else if(data.act==='giveTroops'){ const recipient=players[map.owner[tile]]; if(!actions.aidTroops(actor,recipient,aidTroops)) fail('Could not send those troops.'); }
    else if(data.act==='giveGold'){ const recipient=players[map.owner[tile]]; if(!actions.aidGold(actor,recipient,aidGold)) fail('Not enough gold.'); }
    else if(data.act==='askTroops'){ const recipient=players[map.owner[tile]]; if(actions.botAnswerRequest(recipient,actor,'troops',Math.round(actions.maxTroops(actor)*0.3))) sound('unified'); else fail(`${recipient.name} has nothing to spare right now.`); }
    else if(data.act==='askGold'){ const recipient=players[map.owner[tile]]; if(actions.botAnswerRequest(recipient,actor,'gold',300)) sound('unified'); else fail(`${recipient.name} has no gold to spare right now.`); }
    else if(data.act==='pickreinf') setPickMode({kind:'reinforce',t:tile});
    else if(data.act==='pickattack') setPickMode({kind:'attack',t:tile});
    else if(data.act==='attackfrom'){ const ownerId=map.owner[tile],area=actions.areaById(+data.area); actions.launchAttack(actor,ownerId,area.troops*ratioValue/100,undefined,area); }
    else if(data.act==='transportfrom'){ const ownerId=map.owner[tile],area=actions.areaById(+data.area); if(actions.launchAttack(actor,ownerId,area.troops*ratioValue/100,tile,area)) log(`Transport embarking from ${actions.areaName(actor,area)} for ${ownerId>=0?players[ownerId].name:'unclaimed coast'}.`,true); }
    else if(data.act==='transport'){ const ownerId=map.owner[tile]; if(ownerId>=0&&actions.atPeace(actor.id,ownerId)) fail(`You're at peace with ${players[ownerId].name}.`); else if(actions.launchAttack(actor,ownerId,actor.troops*ratioValue/100,tile)) log(`Transport embarking for ${ownerId>=0?players[ownerId].name:'unclaimed coast'}.`,true); }
  }

  function canBuildAt(actor,tile,kind){ if(!map.land[tile]) return false; if(kind==='nuke') return map.owner[tile]!==actor.id; return actions.snapBuild(actor,tile,kind)>=0; }
  function clickTile(tile,env,actorId){
    const actor=resolveActor(actorId),ratioValue=env.ratio;
    if(env.pick){
      const pick=env.pick;
      if(tile<0||!map.land[tile]) return;
      if(map.owner[tile]!==actor.id) return fail('Click one of your own areas to send from.');
      const source=actions.areaAt(tile); if(!source) return;
      if(!commands.replaying) setPickMode(null);
      if(pick.kind==='reinforce'){ const destination=actions.areaAt(pick.t); if(destination===source) return fail('That is the same area.'); actions.reinforceArea(actor,destination,source,source.troops*ratioValue/100); return; }
      const ownerId=map.owner[pick.t],adjacent=actions.areaTouching(actor,ownerId);
      if(adjacent===source) actions.launchAttack(actor,ownerId,source.troops*ratioValue/100,undefined,source);
      else if(actions.launchAttack(actor,ownerId,source.troops*ratioValue/100,pick.t,source)) log(`Transport embarking for ${ownerId>=0?players[ownerId].name:'unclaimed coast'}.`,true);
      return;
    }
    if(draft.draft){
      if(tile<0||!map.land[tile]) return;
      const picking=draft.draft.order[draft.draft.idx];
      if(picking!==actor) return fail('Not your pick yet.');
      const ownerId=map.owner[tile];
      if(ownerId<0||players[ownerId].kind!=='neutral'||!players[ownerId].alive) return fail('Pick a neutral country.');
      actions.draftPick(actor,players[ownerId]); actions.draftAdvance(); return;
    }
    if(lifecycle.over||tile<0||!map.land[tile]) return;
    if(env.build){
      const kind=env.build;
      if(kind==='nuke'){ if(canBuildAt(actor,tile,kind)&&actions.launchMissile(actor,tile)) clearBuildMode(); else if(actor.silos<1) log('Build a missile silo first.',true); else if(actor.gold<constants.nukeCost) log('Not enough gold for a missile.',true); return; }
      if(map.owner[tile]===actor.id){
        if(actions.placeStructure(actor,kind,tile)){ log(`Built a ${definitions[kind].label.toLowerCase()}.`,true); clearBuildMode(); }
        else if(definitions[kind].coast) fail('No free coastline within 5 tiles of there.');
        else if(actions.snapBuild(actor,tile,kind)<0) fail('No room within 5 tiles — buildings need 6 tiles of clearance.');
        else fail('Not enough gold.');
        return;
      }
      clearBuildMode();
    }
    const ownerId=map.owner[tile]; if(ownerId===actor.id) return;
    let troops=actor.troops*ratioValue/100;
    if(actions.garrisonOn(actor)&&actor.areas&&actor.areas.length){ const adjacent=actions.areaTouching(actor,ownerId); if(adjacent) troops=adjacent.troops*ratioValue/100; }
    const shared=attacks.some(value=>value.owner===actor.id&&value.target===ownerId)||actions.frontierOf(actor.id,ownerId).size>0;
    if(shared) actions.launchAttack(actor,ownerId,troops);
    else fail(`You don't border ${ownerId>=0?players[ownerId].name:'that land'}. Right-click it to send a transport by sea.`);
  }

  function issueFor(actorId,kind,...args){
    if(kind==='continueAfterEnd'){
      if(actorId!==currentActorId()) throw new RangeError('Continuation belongs to the current player.');
      return continueAfterEnd(...args);
    }
    const prepared=validateIssueFor(actorId,kind,args),actor=prepared.actor; args=prepared.args;
    if(replay.on) return;
    applySimple(kind,args,actor.id); record(kind,args,actor); return true;
  }
  function issue(kind,...args){ return issueFor(currentActorId(),kind,...args); }
  function continueAfterEnd(won){
    const prepared=validateIssueFor(currentActorId(),'continueAfterEnd',[won]),actor=prepared.actor;
    if(replay.on) return false;
    applySimple('continueAfterEnd',prepared.args,actor.id);
    runtime.recordCommand(clock.tickN,'continueAfterEnd',prepared.args,'post-systems');
    return true;
  }
  function validateIssueFor(actorId,kind,args){
    assertCommandKind(kind);
    if(kind==='menu'||kind==='click') throw new TypeError(`Command kind ${kind} requires its dedicated route.`);
    args=ownAuthorityValue(args,{path:'command arguments'}); assertCommandArguments(kind,args);
    const actor=resolveActor(actorId); validateSimple(kind,args,actor); return {actor,args};
  }
  function validateIssueMenu(data,tile,selectedIds,siteTile,ratioValue,aidGold,aidTroops,actorId=currentActorId()){
    [data,selectedIds]=ownAuthorityValue([data,selectedIds],{path:'menu command arguments'}); assertMenuAction(data);
    const args=[data,tile,selectedIds,siteTile,ratioValue,aidGold,aidTroops]; assertCommandArguments('menu',args);
    const actor=resolveActor(actorId); validateMenu(...args,actor); return {actor,args};
  }
  function validateIssueClick(tile,env,actorId=currentActorId()){
    env=ownAuthorityValue(env,{path:'click command environment'}); const args=[tile,env]; assertCommandArguments('click',args);
    const actor=resolveActor(actorId); validateClick(tile,env,actor); return {actor,args};
  }
  function issueMenu(data,tile,selectedIds,siteTile,ratioValue,aidGold,aidTroops,actorId=currentActorId()){
    const prepared=validateIssueMenu(data,tile,selectedIds,siteTile,ratioValue,aidGold,aidTroops,actorId),args=prepared.args,actor=prepared.actor;
    if(replay.on) return;
    if(lifecycle.userPaused&&!settings.pauseBuild&&!lifecycle.over&&!PAUSED_MENU_ACTIONS.has(data.act)){ pausedMessage(); return; }
    menuAction(...args,actor.id); record('menu',args,actor); return true;
  }
  function issueClick(tile,env,actorId=currentActorId()){
    const prepared=validateIssueClick(tile,env,actorId),args=prepared.args,actor=prepared.actor;
    if(replay.on) return;
    if(lifecycle.userPaused&&!settings.pauseBuild&&!lifecycle.over&&!draft.draft){ pausedMessage(); return; }
    clickTile(tile,env,actor.id); record('click',args,actor); return true;
  }
  function replayApply(command){
    commands.replaying=true;
    try{
      command=ownAuthorityValue(command,{path:'replay command'}); assertCommand(command);
      const actor=resolveActor(command.p);
      if(command.k==='menu'){ validateMenu(...command.a,actor); menuAction(...command.a,actor.id); }
      else if(command.k==='click'){ validateClick(command.a[0],command.a[1],actor); clickTile(command.a[0],command.a[1],actor.id); }
      else { validateSimple(command.k,command.a,actor); applySimple(command.k,command.a,actor.id); }
      return true;
    }catch(error){ (adapters.warn||noop)('[statefall] replay command failed',command,error); return false; }
    finally{ commands.replaying=false; }
  }
  function validateReplay(command){
    command=ownAuthorityValue(command,{path:'replay command'}); assertCommand(command); const actor=resolveActor(command.p);
    if(command.k==='menu') validateMenu(...command.a,actor);
    else if(command.k==='click') validateClick(command.a[0],command.a[1],actor);
    else validateSimple(command.k,command.a,actor);
    return true;
  }
  function resolveReplayCommands(){ return runtime.resolveReplayCommands(clock.tickN,'pre-systems',replayApply); }

  return Object.freeze({resolveActor,validateIssueFor,validateIssueMenu,validateIssueClick,validateReplay,issue,issueFor,issueMenu,issueClick,continueAfterEnd,applySimple,menuAction,clickTile,replayApply,resolveReplayCommands});
}
