// Inject only in this local preview. Production source and simulation are untouched.
module.exports=function tutorialOrderGate(){return {
 name:'tutorial-order-gate',enforce:'pre',
 transform(source,id){
  if(!id.replaceAll('\\','/').endsWith('/src/legacy-game.js'))return null;
  const replacements=[
   ["function issueMenu(d,t,selIds,siteT,ratioV,aidGold,aidTroops,actorId){", " if(window.__STATEFALL_TUTORIAL_ALLOW_ORDER__?.('menu',d)===false)return false;"],
   ["function issueClick(t,env,actorId){", " if(window.__STATEFALL_TUTORIAL_ALLOW_ORDER__?.('click',{tile:t,owner:owner[t],build:env?env.build:buildMode})===false)return false;"],
   ["function presentEngineEvent({type,args}){", " window.__STATEFALL_TUTORIAL_EVENT__?.(type,args);"]
  ];
  for(const [signature,guard] of replacements){
   if(!source.includes(signature))throw new Error('Tutorial command hook changed: '+signature);
   source=source.replace(signature,signature+guard);
  }
  source+=`\nwindow.__STATEFALL_TUTORIAL_BATTLE__={
   target(){const candidates=new Map();for(let t=0;t<W*H;t++){if(owner[t]!==me().id)continue;for(const n of [t-W,t+W,t%W?t-1:-1,t%W<W-1?t+1:-1]){if(n<0||n>=W*H||!land[n])continue;const p=players[owner[n]];if(p?.kind==='neutral'&&p.alive&&!candidates.has(p.id))candidates.set(p.id,{id:p.id,name:p.name,tile:n,tiles:p.tiles,troops:p.troops});}}return [...candidates.values()].sort((a,b)=>a.tiles-b.tiles)[0]||null;},
   read(id){const p=players[id];return {tiles:p?.tiles||0,alive:!!p?.alive,attacking:attacks.some(a=>a.owner===me().id&&a.target===id)};}
  };`;
  return {code:source,map:null};
 }
};};
