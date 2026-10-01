// Presentation only: elapsed wall time never feeds simulation state or RNG.
export function createSituationModel(){
  let role='menu',changed=0,fightingSince=null,quietSince=null;
  return {
    reset(){role='menu';changed=0;fightingSince=quietSince=null;},
    update({now,playing,battle,critical=false,result=null,paused=false}){
      if(result){role=result;changed=now;return role;}
      if(!playing){role='menu';fightingSince=quietSince=null;return role;}
      if(role==='menu'||role==='victory'||role==='defeat'){role='building';changed=now;}
      if(paused){fightingSince=quietSince=null;return role;}
      if(battle){quietSince=null;fightingSince??=now;}
      else{fightingSince=null;quietSince??=now;}
      if(role!=='battle'&&(critical||(battle&&now-fightingSince>=2000))){role='battle';changed=now;}
      else if(role==='battle'&&!battle&&!critical&&now-quietSince>=15000&&now-changed>=30000){role='building';changed=now;}
      return role;
    }
  };
}

// A region counts only when the entire territory is held. Enemy presence is
// remembered during a campaign, including tiles absorbed in the final advance.
export function createTerritoryObserver(){
  let previous=null;
  return {
    reset(){previous=null;},
    update(regions,{silent=false}={}){
      const next=new Map(),cues=[];
      for(const r of regions){
        const old=previous?.get(r.id);
        const enemy=r.enemy||(!old?.held&&old?.enemy)||false;
        if(old&&!old.held&&r.held&&!silent)cues.push(enemy?'capture-enemy':'capture-neutral');
        next.set(r.id,{held:r.held,enemy:r.held?false:enemy});
      }
      previous=next;return cues;
    }
  };
}

export function battlePerspective(attacks,playerId,isVisible){
  let distant=false;
  for(const attack of attacks){
    if(attack.dead||!attack.front?.size)continue;
    if(attack.owner===playerId||attack.target===playerId)return 'player';
    for(const tile of attack.front){if(isVisible(tile)){distant=true;break;}}
  }
  return distant?'bots':null;
}
