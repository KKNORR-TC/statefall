// Inject only in this local preview. Production source and simulation are untouched.
module.exports=function tutorialOrderGate(){return {
 name:'tutorial-order-gate',enforce:'pre',
 transform(source,id){
  if(!id.replaceAll('\\','/').endsWith('/src/legacy-game.js'))return null;
  const replacements=[
   ["function issueMenu(d,t,selIds,siteT,ratioV,aidGold,aidTroops,actorId){", " if(window.__STATEFALL_TUTORIAL_ALLOW_ORDER__?.('menu',d)===false)return false;"],
   ["function issueClick(t,env,actorId){", " if(window.__STATEFALL_TUTORIAL_ALLOW_ORDER__?.('click',{build:env?env.build:buildMode})===false)return false;"]
  ];
  for(const [signature,guard] of replacements){
   if(!source.includes(signature))throw new Error('Tutorial command hook changed: '+signature);
   source=source.replace(signature,signature+guard);
  }
  return {code:source,map:null};
 }
};};
