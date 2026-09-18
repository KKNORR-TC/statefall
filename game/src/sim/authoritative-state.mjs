import {ownAuthorityValue} from './authority-value.mjs';

export function createAuthoritativeState({tileCount=0,settings={},allowed=[],difficulty='normal'}={}){
  settings=ownAuthorityValue(settings,{path:'authoritative settings'});
  allowed=ownAuthorityValue(allowed,{path:'authoritative allowed rules'});
  if(!Array.isArray(allowed)&&!(allowed instanceof Set)) throw new TypeError('authoritative allowed rules must be an array or Set');
  for(const value of allowed) if(typeof value!=='string') throw new TypeError('authoritative allowed rules must be strings');
  const land=new Uint8Array(tileCount);
  const owner=new Int16Array(tileCount);
  const struct=new Uint8Array(tileCount);
  const structOwner=new Int16Array(tileCount);
  const region=new Int16Array(tileCount);
  const river=new Uint8Array(tileCount);
  const shelled=new Int32Array(tileCount);
  const rough=new Float32Array(tileCount);
  const regions=[];
  const unclaimed=new Set();
  let landCount=0,regCount=null,NP=0,uidSeq=0,tickN=0,simMs=0,playerId=null,activeDifficulty=difficulty;
  let vis=null,radarLayer=null,satUntil=0,satCool=0,planeCool=0;
  const myBorders=new Set();
  let over=false,freeplay=false,spectating=false,decided=false,paused=false,userPaused=false,pendingDecision=null;
  owner.fill(-1);
  structOwner.fill(-1);
  region.fill(-1);
  const actors=Object.freeze(Object.fromEntries([
    'players','attacks','missiles','structures','transports','warships','shots',
    'interceptors','shells','links','traders','aircraft','trucks','planes'
  ].map(name=>[name,[]])));
  const rules=Object.freeze({settings:{...settings},allowed:new Set(allowed)});
  const match=Object.freeze({
    get playerId(){ return playerId; },
    get difficulty(){ return activeDifficulty; }
  });
  const hostile={};
  const proposals=[];
  let areaOf=null,nextAreaId=1;
  const supplyAt={};
  let draft=null,draftTicks=0;
  const draftPicks=[];
  const diplomacy=Object.freeze({hostile,proposals});
  let PRESET=null,cid=null,chosenFlag=null;
  const countryPool=[];
  const setup=Object.freeze({
    get PRESET(){ return PRESET; },
    get cid(){ return cid; },
    countryPool,
    get chosenFlag(){ return chosenFlag; }
  });
  const clock=Object.freeze({
    get tickN(){ return tickN; },
    get simMs(){ return simMs; }
  });
  const lifecycle=Object.freeze({
    get over(){ return over; },
    get freeplay(){ return freeplay; },
    get spectating(){ return spectating; },
    get decided(){ return decided; },
    get paused(){ return paused; },
    get userPaused(){ return userPaused; }
  });
  const fog=Object.freeze({
    get vis(){ return vis; },
    get radarLayer(){ return radarLayer; },
    get satUntil(){ return satUntil; },
    get satCool(){ return satCool; },
    get planeCool(){ return planeCool; },
    get myBorders(){ return myBorders; }
  });
  const map=Object.freeze({
    land,owner,struct,structOwner,region,river,shelled,rough,
    get landCount(){ return landCount; },
    set landCount(value){ landCount=value; },
    regions,
    get regCount(){ return regCount; },
    set regCount(value){ regCount=value; },
    get NP(){ return NP; },
    set NP(value){ NP=value; },
    unclaimed
  });
  const garrison=Object.freeze({
    get areaOf(){ return areaOf; },
    set areaOf(value){ areaOf=value; },
    get nextAreaId(){ return nextAreaId; },
    set nextAreaId(value){ nextAreaId=value; },
    supplyAt
  });
  const draftState=Object.freeze({
    get draft(){ return draft; },
    set draft(value){ draft=value; },
    draftPicks,
    get draftTicks(){ return draftTicks; },
    set draftTicks(value){ draftTicks=value; }
  });

  return Object.freeze({
    get uidSeq(){ return uidSeq; },
    clock,
    lifecycle,
    match,
    rules,
    map,
    actors,
    fog,
    diplomacy,
    garrison,
    draft:draftState,
    setup,
    get pendingDecision(){ return pendingDecision; },
    setPendingDecision(value){
      if(value!==null&&(typeof value!=='object'||Array.isArray(value))) throw new TypeError('pendingDecision must be an object or null');
      pendingDecision=value;
    },
    resetMatchFlow(){ pendingDecision=null; },
    retainProposals(predicate){
      const retained=proposals.filter(predicate);
      proposals.splice(0,proposals.length,...retained);
    },
    resetDiplomacy(){
      for(const key of Object.keys(hostile)) delete hostile[key];
      proposals.length=0;
    },
    resetMap(){
      land.fill(0);
      owner.fill(-1);
      struct.fill(0);
      structOwner.fill(-1);
      region.fill(-1);
      river.fill(0);
      shelled.fill(0);
      rough.fill(0);
      regions.length=0;
      unclaimed.clear();
      landCount=0;
      regCount=null;
      NP=0;
    },
    resetActors(){
      for(const values of Object.values(actors)) values.length=0;
    },
    setPlayerId(value){
      if(value!==null&&(!Number.isInteger(value)||value<0)) throw new TypeError('playerId must be a non-negative integer or null');
      playerId=value;
    },
    setDifficulty(value){
      if(typeof value!=='string'||!value) throw new TypeError('difficulty must be a non-empty string');
      activeDifficulty=value;
    },
    resetMatch(){
      playerId=null;
      activeDifficulty=difficulty;
    },
    replaceFogBuffer(name,value){
      if(name==='vis') vis=value;
      else if(name==='radarLayer') radarLayer=value;
      else throw new Error(`unknown fog buffer: ${name}`);
    },
    setFogScalar(name,value){
      if(name==='satUntil') satUntil=value;
      else if(name==='satCool') satCool=value;
      else if(name==='planeCool') planeCool=value;
      else throw new Error(`unknown fog scalar: ${name}`);
    },
    replaceMyBorders(values){
      const source=values===myBorders?[...values]:values;
      myBorders.clear();
      for(const value of source) myBorders.add(value);
    },
    resetFog(){
      vis=null;
      radarLayer=null;
      satUntil=0;
      satCool=0;
      planeCool=0;
      myBorders.clear();
    },
    setClock(nextTickN,nextSimMs){
      tickN=nextTickN;
      simMs=nextSimMs;
    },
    resetClock(){
      tickN=0;
      simMs=0;
    },
    setLifecycle(name,value){
      if(!Object.hasOwn(lifecycle,name)) throw new Error(`unknown lifecycle field: ${name}`);
      if(typeof value!=='boolean') throw new TypeError(`lifecycle field ${name} must be boolean`);
      if(name==='over') over=value;
      else if(name==='freeplay') freeplay=value;
      else if(name==='spectating') spectating=value;
      else if(name==='decided') decided=value;
      else if(name==='paused') paused=value;
      else userPaused=value;
    },
    resetLifecycle(){
      over=false;
      freeplay=false;
      spectating=false;
      decided=false;
      paused=false;
      userPaused=false;
    },
    replaceActors(name,values){
      const target=actors[name];
      if(!target) throw new Error(`unknown actor collection: ${name}`);
      const source=values===target?[...values]:values;
      target.length=0;
      for(const value of source) target.push(value);
    },
    retainActors(name,predicate){
      const target=actors[name];
      if(!target) throw new Error(`unknown actor collection: ${name}`);
      const retained=target.filter(predicate);
      target.length=0;
      for(const value of retained) target.push(value);
    },
    nextUid(){ return ++uidSeq; },
    restoreIdentity(value){ uidSeq=value; },
    resetIdentity(){ uidSeq=0; },
    resetGarrison(){
      areaOf=null;
      nextAreaId=1;
      for(const key of Object.keys(supplyAt)) delete supplyAt[key];
    },
    resetDraft(){
      draft=null;
      draftPicks.length=0;
      draftTicks=0;
    },
    setSetupMap(preset,countryIds){
      PRESET=preset===null?null:ownAuthorityValue(preset,{path:'setup map definition',freeze:true});
      cid=countryIds===null?null:ownAuthorityValue(countryIds,{path:'setup country buffer'});
    },
    setChosenFlag(value){ chosenFlag=value===null?null:ownAuthorityValue(value,{path:'chosen flag',freeze:true}); },
    replaceCountryPool(values){
      const source=values===countryPool?[...values]:values;
      countryPool.length=0;
      for(const value of source) countryPool.push(value);
    },
    resetSetup(){
      PRESET=null;
      cid=null;
      chosenFlag=null;
      countryPool.length=0;
    }
  });
}
