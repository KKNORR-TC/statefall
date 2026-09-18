const assert=require('node:assert/strict');
const path=require('node:path');
const {pathToFileURL}=require('node:url');

(async()=>{
  const protectedGlobals=['window','document','Image','HTMLCanvasElement','AudioContext','localStorage','sessionStorage','fetch','requestAnimationFrame','setTimeout','setInterval','performance'];
  const prior=new Map(protectedGlobals.map(name=>[name,Object.getOwnPropertyDescriptor(globalThis,name)]));
  for(const name of protectedGlobals) Object.defineProperty(globalThis,name,{configurable:true,get(){ throw new Error(`economy accessed browser global ${name}`); }});
  try{
    const root=path.resolve(__dirname,'..','game','src','sim');
    const [{createAuthoritativeState},{createEconomySystem}]=await Promise.all([
      import(pathToFileURL(path.join(root,'authoritative-state.mjs')).href),
      import(pathToFileURL(path.join(root,'systems','economy.mjs')).href)
    ]);
    const W=6,H=4;
    const make=()=>{
      const settings={noCap:false,garrison:false};
      const state=createAuthoritativeState({tileCount:W*H,settings});
      const human={id:0,name:'Human',kind:'human',alive:true,tiles:4,troops:100,gold:100,focus:.5,cities:1,factories:1,ports:0,held:new Set(),claimed:new Set(),penaltyUntil:0,troopcmds:0,areas:[]};
      const bot={id:1,name:'Bot',kind:'bot',alive:true,tiles:3,troops:500,gold:700,focus:.5,cities:0,factories:0,ports:0,held:new Set(),claimed:new Set(),penaltyUntil:0,troopcmds:0,areas:[]};
      state.actors.players.push(human,bot); state.setPlayerId(0); state.map.landCount=10; state.map.NP=2;
      state.map.owner[0]=state.map.owner[1]=0; state.map.owner[2]=state.map.owner[3]=1;
      const region={id:0,name:'North',size:4,cx:1,cy:0,cont:true}; state.map.regions.push(region); state.map.regCount=new Int32Array([4,0]);
      const events=[];
      const logistics={gOn:p=>settings.garrison&&p.kind!=='neutral',takeTroopsFrom:(p,a,n)=>{p.troops-=n; return n;},addTroopsAt:(p,t,n)=>{p.troops+=n;},areaAt:()=>null,syncTroops:p=>{p.troops=p.areas.reduce((sum,area)=>sum+area.troops,0);}};
      const system=createEconomySystem({W,H,tickMs:100,engineState:state,settings,getMe:()=>human,getBotDifficulty:()=>({eco:1}),constants:{linkTroops:.1,linkGoldPer:.1,linkPortGold:.1,holdBonus:.02,captureBonus:2,regionMin:2,heavyHp:4},landCombat:{maxTroops:()=>1000,coastTilesOf:()=>[3]},diplomacy:{relation:()=>({type:'ally'}),isProvoked:()=>false},naval:{nearestCoastOf:()=>3,nearestCoast:()=>0,waterPath:()=>[6,7,8],waterNeighbor:t=>t+6,heavyFrom:()=>true},logistics,ai:{botThink:()=>events.push('bot'),neutralThink:()=>events.push('neutral')},effects:{log:(...v)=>events.push(['log',...v]),sound:v=>events.push(['sound',v]),cash:(...v)=>events.push(['cash',...v]),incrementStat:v=>events.push(['stat',v]),timeline:(...v)=>events.push(['timeline',...v]),badge:(...v)=>events.push(['badge',...v]),playerAccrued:()=>events.push('accrued')}});
      return {state,settings,human,bot,region,events,system};
    };

    const left=make(),right=make();
    assert.notEqual(left.system,right.system);
    const expectedTroops=(4+4*.0068+3)*(1+.4*(4/10))*(.3+.7*(1-100/1000));
    assert.ok(Math.abs(left.system.troopGrowth(left.human)-expectedTroops)<1e-12);
    assert.ok(Math.abs(left.system.goldGrowth(left.human)-(1.2+4*.00077+2.2))<1e-12);
    assert.equal(left.system.troopMult(left.human),1); assert.equal(left.system.goldMult(left.human),1);
    assert.equal(left.system.shareBorder(0,1),true);
    assert.equal(left.system.sendGold(left.bot,left.human,125.8),true);
    assert.equal(left.bot.gold,575); assert.equal(left.human.gold,225);
    assert.equal(right.bot.gold,700,'gold transfer leaked between instances');
    left.system.seizeTreasury(left.human,left.bot);
    assert.equal(left.bot.gold,0); assert.equal(left.human.gold,800);
    left.state.map.owner[1]=-1;
    assert.equal(left.system.sendTroops(left.human,left.bot,40),true);
    assert.deepEqual(left.state.actors.transports[0],{owner:0,target:1,troops:40,seed:3,path:[6,7,8],pos:0,hdg:0,wake:[],gift:true,heavy:true,hp:4});
    assert.equal(right.state.actors.transports.length,0,'transport leaked between instances');

    const held=left.human.held,claimed=left.human.claimed;
    left.system.checkRegions();
    assert.equal(left.human.held,held); assert.equal(left.human.claimed,claimed);
    assert.deepEqual([...held],[0]); assert.deepEqual([...claimed],[0]);
    assert.equal(left.human.troops,68,'capture bonus did not follow troop transfer');
    left.state.map.regCount[0]=3; left.system.checkRegions(); assert.equal(held.has(0),false);
    left.state.map.regCount[0]=4; left.system.checkRegions(); assert.equal(left.human.troops,68,'claimed region paid its bonus twice');

    const before={troops:right.human.troops,gold:right.human.gold};
    left.system.accruePlayers(100);
    assert.ok(left.human.troops>68&&left.human.gold>800);
    assert.deepEqual({troops:right.human.troops,gold:right.human.gold},before,'accrual leaked between instances');
    assert.ok(left.events.indexOf('accrued')<left.events.indexOf('bot'),'per-player accrual ordering changed');

    right.human.troops=1000; right.system.accruePlayer(right.human,200); assert.equal(right.human.troops,1000,'troop cap was exceeded');
    right.settings.garrison=true; right.human.troops=0; right.human.areas=[{tiles:1,troops:0},{tiles:3,troops:0}]; right.system.accruePlayer(right.human,300);
    assert.ok(Math.abs(right.human.areas[1].troops/right.human.areas[0].troops-3)<1e-12,'garrison growth did not retain tile-share distribution');
    console.log('Economy browser-free growth, aid, treasury/region identity, ordering, and instance isolation contracts PASS');
  }finally{
    for(const [name,descriptor] of prior){ if(descriptor) Object.defineProperty(globalThis,name,descriptor); else delete globalThis[name]; }
  }
})().catch(error=>{ console.error(error.stack||error); process.exitCode=1; });
