const assert=require('node:assert/strict');
const path=require('node:path');
const {pathToFileURL}=require('node:url');

(async()=>{
  const protectedGlobals=['window','document','Image','HTMLCanvasElement','AudioContext','localStorage','sessionStorage','fetch','requestAnimationFrame','performance'];
  const prior=new Map(protectedGlobals.map(name=>[name,Object.getOwnPropertyDescriptor(globalThis,name)]));
  for(const name of protectedGlobals) Object.defineProperty(globalThis,name,{configurable:true,get(){ throw new Error(`match flow accessed browser global ${name}`); }});
  try{
    const root=path.resolve(__dirname,'..','game','src','sim');
    const [{createAuthoritativeState},{createMatchFlow},{createDeterministicRuntime},{createStateOracle}]=await Promise.all([
      import(pathToFileURL(path.join(root,'authoritative-state.mjs')).href),
      import(pathToFileURL(path.join(root,'match-flow.mjs')).href),
      import(pathToFileURL(path.join(root,'deterministic-runtime.mjs')).href),
      import(pathToFileURL(path.join(root,'state-oracle.mjs')).href)
    ]);

    function player(id,name,kind,tiles){ return {id,name,kind,tiles,alive:true,rep:.7,rel:{},nextThink:10,focus:.5}; }
    function fixture(tag,randomValues=[]){
      const state=createAuthoritativeState({tileCount:8,settings:{teams:0}}),human=player(0,tag+' Human','human',2),one=player(1,tag+' One','bot',1),two=player(2,tag+' Two','bot',1),neutral=player(3,tag+' Neutral','neutral',0);
      state.actors.players.push(human,one,two,neutral); state.setPlayerId(0); state.map.land.fill(1); state.map.landCount=8;
      const allianceOne={type:'ally',until:Infinity},allianceTwo={type:'ally',until:Infinity}; human.rel[1]=one.rel[0]=allianceOne; human.rel[2]=two.rel[0]=allianceTwo;
      const calls=[],breaks=[]; let draws=0;
      const random=()=>{ const value=randomValues[draws]??.5; draws++; return value; };
      const flow=createMatchFlow({W:4,H:2,engineState:state,random,pick:values=>values[0],getMe:()=>human,winShare:.72,teamNames:['Red','Blue'],
        landCombat:{setOwner(tile,id){ const old=state.map.owner[tile]; if(old>=0) state.actors.players[old].tiles--; state.map.owner[tile]=id; if(id>=0) state.actors.players[id].tiles++; }},structures:{captureStructure(){}},
        diplomacy:{relation:(a,b)=>a.rel[b.id]||null,breakRelation:(a,b)=>{ breaks.push([a.id,b.id]); delete a.rel[b.id]; delete b.rel[a.id]; }},
        borders:{borderOwners:()=>({r:{}}),calculateCentroid:()=>[1,1]},
        ports:{log:(...args)=>calls.push(['log',...args]),sound:name=>calls.push(['sound',name]),invalidateUi:()=>calls.push(['ui']),matchEnded:(...args)=>calls.push(['end',...args]),alliedDecisionRequested:value=>calls.push(['decision',value]),draftCompleted:()=>calls.push(['draft-complete'])}});
      return {state,human,one,two,neutral,flow,calls,breaks,get draws(){ return draws; }};
    }

    const left=fixture('Left',[.99,.1]),right=fixture('Right',[.2,.3]);
    assert.equal(left.flow.checkAlliedEndgame(),true);
    assert.deepEqual(left.state.pendingDecision,{type:'allied-endgame',rivalIds:[1,2]});
    assert.equal(JSON.parse(JSON.stringify(left.state.pendingDecision)).type,'allied-endgame');
    assert.equal(left.state.lifecycle.paused,true);
    assert.equal(right.state.pendingDecision,null,'allied decision leaked between instances');
    assert.equal(left.flow.resolveSharedVictory(),true);
    assert.equal(left.draws,2,'share response changed RNG draw count');
    assert.deepEqual(left.breaks,[[1,0]],'share refusal changed relationship direction or order');
    assert.equal(left.one.nextThink,0);
    assert.equal(left.one.focus,.85);
    assert.equal(left.state.pendingDecision,null);
    assert.equal(right.draws,0,'left decision consumed right instance RNG');

    assert.equal(right.flow.checkAlliedEndgame(),true);
    assert.equal(right.flow.continueWar(),true);
    assert.equal(right.draws,0,'continue-war command consumed RNG');
    assert.deepEqual(right.breaks,[[0,1],[0,2]],'continue-war relationship order changed');
    assert.equal(right.state.lifecycle.paused,false);

    const draftLeft=fixture('Draft left',[.9]),draftRight=fixture('Draft right',[.1]);
    draftLeft.human.tiles=0; draftLeft.one.tiles=0; draftLeft.neutral.tiles=4;
    draftLeft.state.map.owner.fill(draftLeft.neutral.id);
    draftLeft.flow.startDraft();
    assert.equal(draftLeft.state.lifecycle.paused,true);
    assert.equal(draftLeft.state.draft.draft.per,2);
    assert.equal(draftRight.state.draft.draft,null,'draft leaked between instances');
    draftLeft.flow.draftPick(draftLeft.human,draftLeft.neutral);
    assert.deepEqual(draftLeft.state.draft.draftPicks.map(value=>({owner:value.owner,n:value.n,at:value.at})),[{owner:0,n:1,at:0}]);
    assert.equal(draftLeft.neutral.alive,false);
    assert.equal(draftLeft.human.tiles,8);
    draftLeft.flow.draftAdvance();
    assert.equal(draftLeft.state.draft.draft.idx,1);

    const exhausted=fixture('Exhausted draft',[.99,.99]);
    exhausted.flow.startDraft();
    assert.equal(exhausted.state.draft.draft.order[0],exhausted.human);
    for(let tick=0;tick<60&&exhausted.state.draft.draft;tick++) exhausted.flow.advanceDraft();
    assert.equal(exhausted.state.draft.draft,null,'an empty human draft turn must not freeze the match');
    assert.equal(exhausted.state.lifecycle.paused,false);
    const waiting=fixture('Waiting draft',[.99,.99]);
    waiting.neutral.tiles=120;
    waiting.flow.startDraft();
    for(let tick=0;tick<12;tick++) waiting.flow.advanceDraft();
    assert.equal(waiting.state.draft.draft.idx,0,'a valid human pick must still wait for input');

    const canonicalState=createAuthoritativeState({tileCount:1}),runtime=createDeterministicRuntime({tickMs:100});
    canonicalState.actors.players.push(player(0,'Canonical','human',1)); canonicalState.setPlayerId(0); canonicalState.map.land[0]=1; canonicalState.map.owner[0]=0; canonicalState.map.landCount=1;
    const oracle=createStateOracle({engineState:canonicalState,runtime,W:1,H:1,ports:{replayDiverged(){} }});
    const before=oracle.canonicalState();
    canonicalState.setPendingDecision({type:'allied-endgame',rivalIds:[2]});
    assert.equal(oracle.canonicalState(),before,'pending decision changed canonical v1 bytes');

    const outcome=fixture('Outcome'); outcome.human.tiles=8; outcome.one.alive=false; outcome.two.alive=false;
    outcome.flow.evaluateOutcomes();
    assert.equal(outcome.state.lifecycle.over,true);
    assert.deepEqual(outcome.calls.find(call=>call[0]==='end'),['end','Total victory','The whole world is yours.']);
    assert.equal(outcome.flow.continueAfterEnd(true),true);
    assert.deepEqual({over:outcome.state.lifecycle.over,freeplay:outcome.state.lifecycle.freeplay,spectating:outcome.state.lifecycle.spectating},{over:false,freeplay:true,spectating:false});

    console.log('Match-flow poisoned-global, draft, allied decision, RNG, outcome, and isolation contracts PASS');
  }finally{
    for(const [name,descriptor] of prior){ if(descriptor) Object.defineProperty(globalThis,name,descriptor); else delete globalThis[name]; }
  }
})().catch(error=>{ console.error(error.stack||error); process.exitCode=1; });
