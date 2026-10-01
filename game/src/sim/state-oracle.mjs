import {createCanonicalTypedCache} from './canonical-typed-cache.mjs';
import {STATE_ORACLE_VERSION,serializeCanonicalV1} from './deterministic-runtime.mjs';
import {sha256} from './sha256.mjs';

export function createStateOracle({engineState,runtime,W,H,ports,warn=()=>{},getCanonicalLabelPositions=()=>null,allowPausedSaveCompatibility=false}){
  const {players,attacks,missiles,structures,transports,warships,shots,interceptors,shells,links,traders,aircraft,trucks,planes}=engineState.actors;
  const {land,owner,struct,structOwner,region,river,shelled,rough,regions,unclaimed}=engineState.map;
  const {hostile,proposals}=engineState.diplomacy;
  const {supplyAt}=engineState.garrison;
  const replay=runtime.replay,commands=runtime.commands;
  const typedCache=createCanonicalTypedCache();
  const me=()=>engineState.match.playerId==null?null:players[engineState.match.playerId]||null;

  function stateDetail(){
    const detail={rng:runtime.rngDraws};
    for(const player of players){
      if(player.kind==='neutral'||!player.alive) continue;
      detail[player.id]=[Math.round(player.troops),Math.round(player.gold),player.tiles];
    }
    detail.n=[warships.length,attacks.length,structures.length,transports.length];
    return detail;
  }

  function stateDiff(recorded,current){
    if(!recorded||!current) return '';
    const differences=[];
    if(recorded.rng!=null&&current.rng!=null&&recorded.rng!==current.rng) differences.push(`random draws recorded ${recorded.rng} vs ${current.rng}`);
    for(const key in recorded){
      if(key==='n'||key==='rng') continue;
      const left=recorded[key],right=current[key];
      if(!right){ differences.push(`${players[+key]?players[+key].name:key} missing`); continue; }
      if(left[0]!==right[0]||left[1]!==right[1]||left[2]!==right[2]) differences.push(`${players[+key]?players[+key].name:key}: recorded ${left.join('/')} vs ${right.join('/')}`);
    }
    if(recorded.n&&current.n&&recorded.n.join()!==current.n.join()) differences.push(`counts ${recorded.n.join('/')} vs ${current.n.join('/')}`);
    return differences.slice(0,6).join('; ');
  }

  function stateHash(full){
    if(full==null) full=!(replay.on&&replay.hashv!==2);
    let hash=2166136261;
    const mix=value=>{ hash^=(value|0)&0xffffffff; hash=Math.imul(hash,16777619); };
    const step=full?1:5;
    for(let tile=0;tile<W*H;tile+=step) mix(owner[tile]+2+(struct[tile]?100:0));
    for(const player of players){ if(!player.alive) continue; mix(player.id); mix(Math.round(player.troops*10)); mix(Math.round(player.gold*10)); mix(player.tiles); }
    mix(warships.length); for(const ship of warships) mix(Math.round(ship.x*4)+Math.round(ship.y*4)*4096+ship.hp*1e6);
    mix(attacks.length); for(const attack of attacks) mix(Math.round(attack.troops)+attack.front.size*1e5);
    mix(structures.length); mix(missiles.length); mix(transports.length); mix(aircraft.length);
    return (hash>>>0).toString(16).padStart(8,'0');
  }

  function authoritativeState(){
    const {clock,lifecycle,match,map,fog,draft,garrison,rules}=engineState;
    return {
      version:STATE_ORACLE_VERSION, clock:{tickN:clock.tickN,simMs:clock.simMs,uidSeq:engineState.uidSeq,srandN:runtime.rngDraws,over:lifecycle.over,freeplay:lifecycle.freeplay,spectating:lifecycle.spectating,decided:lifecycle.decided,paused:lifecycle.paused,userPaused:lifecycle.userPaused,draftTicks:draft.draftTicks,satUntil:fog.satUntil,satCool:fog.satCool,planeCool:fog.planeCool,nextAreaId:garrison.nextAreaId},
      rules:{W,H,settings:rules.settings,difficulty:match.difficulty,allowed:rules.allowed},
      map,
      // Canonical v1 historically includes shots, but visual shots are presentation-only.
      actors:{me:me()&&me().id,players,attacks,missiles,structures,transports,warships,shots:[],interceptors,shells,links,traders,aircraft,trucks,planes},
      fog:{vis:fog.vis,radarLayer:fog.radarLayer,myBorders:fog.myBorders}, diplomacy:{hostile,proposals}, garrison:{areaOf:garrison.areaOf,supplyAt}, draft:{draft:draft.draft,draftPicks:draft.draftPicks}
    };
  }

  function canonicalState(pauseOverride=null){
    const labelPositions=getCanonicalLabelPositions();
    const aliases=new Map(),customBots=engineState.rules.settings.customBots;
    if(Array.isArray(customBots)){
      const bots=players.filter(player=>player.kind==='bot'),lastByPlayer=new Map();
      for(const customBot of customBots){ const player=bots[Math.min(bots.length-1,customBot.slot|0)]; if(player) lastByPlayer.set(player,customBot); }
      for(const [player,customBot] of lastByPlayer) if(customBot.layers&&player.flag?.layers) aliases.set(customBot.layers,player.flag.layers);
    }
    const countryLayers=new Map();
    for(const player of players){
      if(!Number.isInteger(player.flag?.idx)||player.flag.idx<0) continue;
      let layers=countryLayers.get(player.flag.idx);
      if(!layers) countryLayers.set(player.flag.idx,layers=[]);
      player.flag.layers.forEach((layer,index)=>{ if(layers[index]) aliases.set(layer,layers[index]); else layers[index]=layer; });
    }
    if(engineState.setup.PRESET){
      const flagsByCountry=new Map();
      for(const player of players){
        if(player.country==null||player.flag?.custom) continue;
        if(flagsByCountry.has(player.country)) aliases.set(player.flag,flagsByCountry.get(player.country));
        else flagsByCountry.set(player.country,player.flag);
      }
    }
    const state=authoritativeState();
    if(pauseOverride)Object.assign(state.clock,pauseOverride);
    return serializeCanonicalV1(state,{...typedCache,derivedProperties:value=>{
      if(!labelPositions||!players.includes(value)) return null;
      const labelPos=labelPositions[value.id];
      return labelPos?{labelPos}:null;
    },canonicalAlias:value=>aliases.get(value)||null});
  }

  function checkStateInvariants(){
    const mapState=engineState.map,errors=[],tileCount=W*H,arrays={land,owner,struct,structOwner,region,river,shelled,rough};
    for(const [name,array] of Object.entries(arrays)) if(!array||array.length!==tileCount) errors.push(`${name} length ${array&&array.length} != ${tileCount}`);
    if(!players.length) errors.push('players is empty');
    if(me()&&players[me().id]!==me()) errors.push('human player is not indexed by id');
    const tileCounts=new Int32Array(players.length),regionCounts=new Int32Array(mapState.regCount?mapState.regCount.length:0); let countedLand=0,unclaimedCount=0;
    if(land&&owner) for(let tile=0;tile<tileCount;tile++){
      const playerId=owner[tile]; if(land[tile]) countedLand++; else if(playerId>=0) errors.push(`water tile ${tile} has owner ${playerId}`);
      if(playerId>=0){ if(playerId>=players.length) errors.push(`tile ${tile} has invalid owner ${playerId}`); else { tileCounts[playerId]++; const regionId=region&&region[tile]; if(regionId>=0&&regionId<regions.length&&regionId*mapState.NP+playerId<regionCounts.length) regionCounts[regionId*mapState.NP+playerId]++; } }
      if(land[tile]&&playerId<0){ unclaimedCount++; if(!unclaimed.has(tile)) errors.push(`unclaimed land tile ${tile} missing from index`); }
      else if(unclaimed.has(tile)) errors.push(`tile ${tile} incorrectly present in unclaimed index`);
      if(errors.length>=100) break;
    }
    if(countedLand!==mapState.landCount) errors.push(`landCount ${mapState.landCount} != ${countedLand}`);
    if(unclaimed.size!==unclaimedCount) errors.push(`unclaimed size ${unclaimed.size} != ${unclaimedCount}`);
    players.forEach((player,index)=>{ if(player.id!==index) errors.push(`player index ${index} has id ${player.id}`); if(player.tiles!==tileCounts[index]) errors.push(`player ${index} tiles ${player.tiles} != ${tileCounts[index]}`); for(const key in player.rel){ const other=players[+key]; if(!other||other.rel[index]!==player.rel[key]) errors.push(`relationship ${index}/${key} is not symmetric`); } });
    if(mapState.regCount&&regionCounts.length===mapState.regCount.length) for(let index=0;index<mapState.regCount.length;index++) if(mapState.regCount[index]!==regionCounts[index]){ errors.push(`regCount ${index} is ${mapState.regCount[index]} != ${regionCounts[index]}`); if(errors.length>=100) break; }
    const byTile=new Map(); for(const structure of structures){ if(!Number.isInteger(structure.t)||structure.t<0||structure.t>=tileCount) errors.push(`structure has invalid tile ${structure.t}`); else { if(byTile.has(structure.t)) errors.push(`duplicate structure at tile ${structure.t}`); byTile.set(structure.t,structure); if(!struct[structure.t]) errors.push(`structure at ${structure.t} missing from tile index`); if(structOwner[structure.t]!==structure.owner) errors.push(`structure owner index differs at ${structure.t}`); if(owner[structure.t]!==structure.owner) errors.push(`structure owner differs from land owner at ${structure.t}`); } if(!players[structure.owner]) errors.push(`structure has invalid owner ${structure.owner}`); }
    if(struct) for(let tile=0;tile<tileCount;tile++) if(!!struct[tile]!==byTile.has(tile)){ errors.push(`structure tile index differs at ${tile}`); if(errors.length>=100) break; }
    const visited=new Set(); const findBad=(value,path)=>{ if(errors.length>=100||value==null) return; if(typeof value==='number'){ if(Number.isNaN(value)) errors.push(`${path} is NaN`); return; } if(typeof value!=='object'||visited.has(value)) return; visited.add(value); if(ArrayBuffer.isView(value)) return; if(value instanceof Set){ let index=0; for(const item of value){ if(item!==null&&(typeof item==='object'||typeof item==='function')) errors.push(`${path}.set[${index}] is not primitive`); findBad(item,`${path}.set[${index++}]`); } return; } if(value instanceof Map){ let index=0; for(const [key,item] of value){ if(key!==null&&(typeof key==='object'||typeof key==='function')) errors.push(`${path}.map[${index}] key is not primitive`); findBad(item,`${path}.map[${index++}]`); } return; } for(const key of Object.keys(value)) findBad(value[key],`${path}.${key}`); };
    if(shots.length) errors.push(`authoritative shots must remain empty (found ${shots.length})`);
    findBad(authoritativeState(),'state'); return errors;
  }

  function checkpoint(){
    const hash=stateHash();
    if(replay.on){
      const reference=replay.hashes&&replay.hashes.find(value=>value[0]===engineState.clock.tickN);
      if(reference&&reference[1]!==hash&&!replay.mismatch){
        replay.mismatch=true;
        const reason=stateDiff(reference[2],stateDetail());
        warn('[statefall] replay diverged at tick',engineState.clock.tickN,reference[1],hash,reason);
        replay.why=reason;
        replay.divTick=engineState.clock.tickN;
        replay.divRec=reference;
        replay.divNow=stateDetail();
        ports.replayDiverged({tick:engineState.clock.tickN,recordedHash:reference[1],currentHash:hash,reason,recorded:reference,current:replay.divNow,otherVersion:replay.otherVersion,fileGame:replay.fileGame});
        return true;
      }
    }else commands.hashes.push([engineState.clock.tickN,hash,stateDetail()]);
    return false;
  }

  function diverge(reason,recorded,current,{final=false}={}){
    replay.mismatch=true; replay.why=reason; replay.divTick=engineState.clock.tickN; replay.divRec=recorded; replay.divNow=current;
    warn(final?'[statefall] replay final metadata diverged':'[statefall] replay checkpoint metadata diverged',reason);
    ports.replayDiverged({tick:engineState.clock.tickN,recordedHash:recorded?.legacyHash||recorded?.[1],currentHash:current?.legacyHash||current?.hash,reason,recorded,current,otherVersion:replay.otherVersion,fileGame:replay.fileGame,final});
    return true;
  }

  function replayCommandFailed(command,phase){
    const reason=`replay command failed in ${phase}: ${command?.k||'unknown'} at tick ${command?.t??engineState.clock.tickN}`;
    warn('[statefall] replay command failed',command,new Error(reason));
    const result=diverge(reason,command,{tick:engineState.clock.tickN,replayCursor:replay.i,phase});
    if(!replay.otherVersion) ports.scheduleControllerTask('showReplayDivergence');
    return result;
  }

  function finalizeCheckpoint(){
    if(engineState.clock.tickN<=0||engineState.clock.tickN%100) return false;
    const canonical={version:STATE_ORACLE_VERSION,sha256:sha256(canonicalState())},current={canonical,rngDraws:runtime.rngDraws,commandCount:replay.on?replay.i:commands.log.length,replayCursor:replay.on?replay.i:null};
    if(!replay.on){
      const record=commands.hashes.find(value=>value[0]===engineState.clock.tickN);
      if(record) record[2]={...(record[2]||{}),...current};
      return false;
    }
    const reference=replay.hashes&&replay.hashes.find(value=>value[0]===engineState.clock.tickN),detail=reference&&reference[2],failures=[];
    if(!reference) return false;
    if(replay.requiresCanonicalCheckpoints===true&&(!detail||!detail.canonical)) failures.push('required canonical checkpoint metadata is absent');
    if(detail?.canonical?.sha256!==undefined&&detail.canonical.sha256!==canonical.sha256) failures.push(`canonical digest recorded ${detail.canonical.sha256} vs current ${canonical.sha256}`);
    if(detail?.rngDraws!==undefined&&detail.rngDraws!==current.rngDraws) failures.push(`RNG draws recorded ${detail.rngDraws} vs current ${current.rngDraws}`);
    if(detail?.commandCount!==undefined&&detail.commandCount!==current.commandCount) failures.push(`command count recorded ${detail.commandCount} vs current ${current.commandCount}`);
    if(detail?.replayCursor!=null&&detail.replayCursor!==current.replayCursor) failures.push(`replay cursor recorded ${detail.replayCursor} vs current ${current.replayCursor}`);
    if(failures.length) return diverge(failures.join('; '),reference,{legacyHash:stateHash(),...current});
    if(replay.requiresCanonicalCheckpoints===true&&detail?.canonical) replay.verifiedEvidence=true;
    return false;
  }

  function verifyReplayFinal(){
    if(!replay.on||replay.finalVerified||engineState.clock.tickN<replay.toTick) return false;
    replay.finalVerified=true;
    const final=replay.final,failures=[],hash=stateHash(),canonical=()=>sha256(canonicalState());
    if(replay.finalHash!=null&&replay.finalHash!==hash) failures.push(`final hash recorded ${replay.finalHash} vs current ${hash}`);
    if(replay.finalDigest!=null&&!matchesReplayFinalDigest(replay.finalDigest.sha256)) failures.push(`final canonical digest recorded ${replay.finalDigest.sha256} vs current ${canonical()}`);
    if(final){
      if(final.tick!==engineState.clock.tickN) failures.push(`final tick recorded ${final.tick} vs current ${engineState.clock.tickN}`);
      if(final.legacyHash!==hash) failures.push(`final hash recorded ${final.legacyHash} vs current ${hash}`);
      if(!matchesReplayFinalDigest(final.canonical.sha256)) failures.push(`final canonical digest recorded ${final.canonical.sha256} vs current ${canonical()}`);
      if(replay.finalDigest&&replay.finalDigest.sha256!==final.canonical.sha256)failures.push('final canonical digest copies disagree');
      if(final.rngDraws!==runtime.rngDraws) failures.push(`final RNG draws recorded ${final.rngDraws} vs current ${runtime.rngDraws}`);
      if(final.commandCount!==replay.cmds.length) failures.push(`final command count recorded ${final.commandCount} vs current ${replay.cmds.length}`);
      if(final.replayCursor!=null&&final.replayCursor!==replay.i) failures.push(`final replay cursor recorded ${final.replayCursor} vs current ${replay.i}`);
    }
    if(!failures.length){ if(replay.finalHash!=null||replay.finalDigest!=null||final) replay.verifiedEvidence=true; return false; }
    return diverge(failures.join('; '),final||{finalHash:replay.finalHash,finalDigest:replay.finalDigest},{hash,canonical:{version:STATE_ORACLE_VERSION,sha256:canonical()},rngDraws:runtime.rngDraws,commandCount:replay.cmds.length,replayCursor:replay.i},{final:true});
  }

  function finalMetadata(replayCursor=null){ const canonical={version:STATE_ORACLE_VERSION,sha256:sha256(canonicalState())}; return {tick:engineState.clock.tickN,legacyHash:stateHash(),canonical,rngDraws:runtime.rngDraws,commandCount:replay.on?replay.cmds.length:commands.log.length,replayCursor}; }

  function matchesReplayFinalDigest(expected){
    if(expected===sha256(canonicalState()))return true;
    if(!allowPausedSaveCompatibility)return false;
    // Single-player pause is a controller action, absent from the command log.
    // Older Save & quit payloads included these flags. Compare exact canonical
    // states differing ONLY in those flags, without changing live authority.
    for(const paused of [false,true])for(const userPaused of [false,true]){
      if(paused===engineState.lifecycle.paused&&userPaused===engineState.lifecycle.userPaused)continue;
      if(expected===sha256(canonicalState({paused,userPaused})))return true;
    }
    return false;
  }

  Object.defineProperties(stateHash,{oracleVersion:{value:STATE_ORACLE_VERSION},serializeCanonical:{value:canonicalState},checkInvariants:{value:checkStateInvariants}});
  return Object.freeze({version:STATE_ORACLE_VERSION,stateDetail,stateDiff,stateHash,authoritativeState,canonicalState,checkStateInvariants,checkpoint,finalizeCheckpoint,replayCommandFailed,verifyReplayFinal,finalMetadata,matchesReplayFinalDigest});
}
