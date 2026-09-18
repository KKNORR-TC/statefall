const N4=[[1,0],[-1,0],[0,1],[0,-1]];
const noop=()=>{};

export function createEconomySystem({
  W,H,tickMs,engineState,settings,getMe,getBotDifficulty,
  constants,landCombat,diplomacy,naval,logistics,ai,effects={}
}){
  const clock=engineState.clock,map=engineState.map;
  const {owner,regions}=map;
  const {players,transports}=engineState.actors;
  const idx=(x,y)=>y*W+x,inb=(x,y)=>x>=0&&y>=0&&x<W&&y<H;
  const log=effects.log||noop,fail=effects.fail||noop,sound=effects.sound||noop;
  const cash=effects.cash||noop,incrementStat=effects.incrementStat||noop;
  const timeline=effects.timeline||noop,badge=effects.badge||noop;
  const playerAccrued=effects.playerAccrued||noop;

  function troopMult(p){ return p.kind==='neutral'?1:(0.4+1.2*p.focus)*(p.kind==='bot'?getBotDifficulty(p).eco:1); }
  function goldMult(p){ return p.kind==='neutral'?1:(0.4+1.2*(1-p.focus))*(p.kind==='bot'?getBotDifficulty(p).eco:1); }
  function troopGrowth(p){
    const cap=landCombat.maxTroops(p),fill=settings.noCap&&p.kind!=='neutral'?1:Math.max(0,1-p.troops/cap);
    if(p.kind==='neutral') return (1+p.tiles*0.0015)*(diplomacy.isProvoked(p)?2:1)*fill;
    let held=0; for(const id of p.held) held+=regions[id].size;
    const empire=1+0.4*(p.tiles/Math.max(1,map.landCount));
    const pen=p.penaltyUntil>clock.tickN?0.5:1,tc=1+0.1*Math.min(4,p.troopcmds||0);
    return pen*tc*(4+p.tiles*0.0068+p.cities*3+(p.cityLinks||0)*constants.linkTroops+held*constants.holdBonus)*empire*(0.3+0.7*fill)*troopMult(p);
  }
  function goldGrowth(p){ return (1.2+p.tiles*0.00077+p.factories*2.2+(p.factoryLinks||0)*2.2*constants.linkGoldPer+p.ports*1.4+(p.portLinks||0)*constants.linkPortGold)*goldMult(p); }

  function shareBorder(a,b){ for(let y=0;y<H;y+=1)for(let x=0;x<W;x+=1){ const t=idx(x,y); if(owner[t]!==a) continue; for(const [dx,dy] of N4){ if(inb(x+dx,y+dy)&&owner[idx(x+dx,y+dy)]===b) return true; } } return false; }
  function sendGold(from,to,amt){ amt=Math.min(Math.floor(amt),Math.floor(from.gold)); if(amt<=0) return false; from.gold-=amt; to.gold+=amt; log(`${from.name} sent ${amt} gold to ${to.name}.`,from===getMe()||to===getMe()); if(to===getMe()){ sound('cash'); cash(to,amt); } else if(from===getMe()) sound('coin'); return true; }
  function sendTroops(from,to,amt){ amt=Math.min(Math.floor(amt),Math.floor(from.troops)); if(amt<10) return false;
    if(shareBorder(from.id,to.id)){ if(logistics.gOn(from)) logistics.takeTroopsFrom(from,from.areas[0],amt); else from.troops-=amt; if(logistics.gOn(to)) logistics.addTroopsAt(to,null,amt); else to.troops+=amt; log(`${from.name} sent ${amt} troops to ${to.name}.`,from===getMe()||to===getMe()); if(from===getMe()||to===getMe()) sound('foghorn'); return true; }
    const coast=landCombat.coastTilesOf(to.id); if(!coast.length){ if(from===getMe()) fail(`${to.name} has no coastline to land on.`); return false; }
    const seed=naval.nearestCoastOf(to.id,naval.nearestCoast(from,coast[0])>=0?naval.nearestCoast(from,coast[0]):coast[0],-1);
    const fromT=naval.nearestCoast(from,seed>=0?seed:coast[0]); if(fromT<0){ if(from===getMe()) fail('You need a coastline to embark from.'); return false; }
    const path=naval.waterPath(naval.waterNeighbor(fromT),naval.waterNeighbor(seed>=0?seed:coast[0])); if(!path){ if(from===getMe()) fail('No sea route to your ally.'); return false; }
    if(logistics.gOn(from)) logistics.takeTroopsFrom(from,from.areas.find(a=>a.coast)||from.areas[0],amt); else from.troops-=amt; { const hv=naval.heavyFrom(from,fromT,logistics.areaAt(fromT)); transports.push({owner:from.id,target:to.id,troops:amt,seed:seed>=0?seed:coast[0],path,pos:0,hdg:0,wake:[],gift:true,heavy:hv,hp:hv?constants.heavyHp:1}); }
    log(`${from.name} shipped ${amt} troops to ${to.name}.`,from===getMe()||to===getMe()); if(from===getMe()) sound('foghorn'); return true;
  }
  function botAnswerRequest(bot,from,kind,amt){ const relation=diplomacy.relation(bot,from); if(!relation||relation.type!=='ally') return false;
    if(kind==='gold'){ const spare=bot.gold-300; if(spare<50) return false; return sendGold(bot,from,Math.min(amt,spare*0.6)); }
    const spare=bot.troops-landCombat.maxTroops(bot)*0.45; if(spare<100) return false; return sendTroops(bot,from,Math.min(amt,spare*0.6));
  }
  function seizeTreasury(p,def){ if(!p||p.kind==='neutral'||def.kind==='neutral') return; const gold=Math.floor(def.gold); def.gold=0; if(gold>0){ p.gold+=gold; if(p===getMe()){ sound('cash'); cash(def,gold); } log(`${p.name} seized ${def.name}'s treasury: ${gold} gold.`,p===getMe()||def===getMe()); } }

  function accruePlayer(p,now){
    if(logistics.gOn(p)&&p.areas&&p.areas.length){ const growth=troopGrowth(p)*tickMs/1000,cap=landCombat.maxTroops(p); for(const area of p.areas){ const share=area.tiles/Math.max(1,p.tiles),areaCap=cap*share,areaGrowth=growth*share; if(settings.noCap||area.troops<areaCap) area.troops=settings.noCap?area.troops+areaGrowth:Math.min(areaCap,area.troops+areaGrowth); } logistics.syncTroops(p); }
    else if(settings.noCap&&p.kind!=='neutral') p.troops+=troopGrowth(p)*tickMs/1000;
    else { const cap=landCombat.maxTroops(p); if(p.troops<cap) p.troops=Math.min(cap,p.troops+troopGrowth(p)*tickMs/1000); }
    p.gold+=goldGrowth(p)*tickMs/1000*(p.kind==='neutral'?0:1);
    if(p.kind==='bot') ai.botThink(p,now); else if(p.kind==='neutral') ai.neutralThink(p,now);
    if(p.kind!=='neutral'&&p.troops>(p.peakTroops||0)) p.peakTroops=p.troops;
    if(p===getMe()){ const earned=goldGrowth(p)*tickMs/1000; p.goldEarned=(p.goldEarned||0)+earned; playerAccrued(p,p.tiles/map.landCount); }
  }
  function accruePlayers(now){ for(const p of players){ if(p.alive) accruePlayer(p,now); } }

  function checkRegions(){ const np=map.NP;
    for(const region of regions){ if(region.size<constants.regionMin) continue;
      for(const p of players){ if(!p.alive) continue; const full=map.regCount[region.id*np+p.id]===region.size;
        if(full&&!p.held.has(region.id)){ p.held.add(region.id);
          if(!p.claimed.has(region.id)){ p.claimed.add(region.id); const bonus=Math.round(region.size*constants.captureBonus); if(logistics.gOn(p)&&p.areas) logistics.addTroopsAt(p,idx(Math.round(region.cx),Math.round(region.cy)),bonus); else p.troops+=bonus;
            log(`${p.name} unified ${region.cont?'the continent of ':''}${region.name} and raised ${bonus} troops.`,p===getMe()||region.cont); if(p===getMe()){ sound('unified'); incrementStat(region.cont?'continents':'islands'); timeline(`Unified ${region.cont?'the continent of ':''}${region.name} (+${bonus} troops)`,'unify'); }
            if(region.cont||p===getMe()) badge(region,p,bonus); }
          else if(p===getMe()) log(`You hold all of ${region.name} again.`,true);
        } else if(!full&&p.held.has(region.id)){ p.held.delete(region.id); if(p===getMe()) log(`You no longer hold all of ${region.name}.`,true); }
      }
    }
  }

  return Object.freeze({troopGrowth,goldGrowth,troopMult,goldMult,shareBorder,sendGold,sendTroops,botAnswerRequest,seizeTreasury,accruePlayer,accruePlayers,checkRegions});
}
