const assert=require('node:assert/strict');
const path=require('node:path');
const {pathToFileURL}=require('node:url');

function assertDeepFrozenAndTryMutations(value,seen=new Set()){
  if(value===null||typeof value!=='object'||seen.has(value)) return;
  seen.add(value);
  assert.equal(Object.isFrozen(value),true);
  for(const child of Object.values(value)) assertDeepFrozenAndTryMutations(child,seen);
  assert.equal(Reflect.set(value,'attemptedMutation',true),false);
  for(const key of Object.keys(value)) assert.equal(Reflect.set(value,key,null),false);
  if(Array.isArray(value)) assert.throws(()=>value.push(null),TypeError);
}

(async()=>{
  const protectedGlobals=['window','document','Image','HTMLCanvasElement','AudioContext','localStorage','sessionStorage','fetch','requestAnimationFrame'];
  const prior=new Map(protectedGlobals.map(name=>[name,Object.getOwnPropertyDescriptor(globalThis,name)]));
  for(const name of protectedGlobals) Object.defineProperty(globalThis,name,{configurable:true,get(){ throw new Error(`engine accessed browser global ${name}`); }});
  let runtimeModule;
  try{
    runtimeModule=await import(pathToFileURL(path.resolve(__dirname,'..','game','src','sim','deterministic-runtime.mjs')).href);
    const {serializeCanonicalV1,createCountedRng,createDeterministicRuntime,seedFrom,STATE_ORACLE_VERSION,RUNTIME_CHECKPOINT_VERSION}=runtimeModule;
    assert.equal(STATE_ORACLE_VERSION,'statefall-authoritative-state/v1');
    assert.equal(RUNTIME_CHECKPOINT_VERSION,'statefall-deterministic-runtime/v1');
    assert.equal(seedFrom('PHASED'),seedFrom('PHASED'));

    const legacyRng=seed=>{ let state=seedFrom(seed); return ()=>{ state|=0; state=state+0x6D2B79F5|0; let value=Math.imul(state^state>>>15,1|state); value=value+Math.imul(value^value>>>7,61|value)^value; return ((value^value>>>14)>>>0)/4294967296; }; };
    const expected=legacyRng('PHASED'),counted=createCountedRng('PHASED');
    for(let index=0;index<8;index++) assert.equal(counted.next(),expected());
    assert.equal(counted.draws,8);
    const rngSnapshot=counted.snapshot(),nextRandom=counted.next();
    counted.next();
    counted.restore(rngSnapshot);
    assert.equal(counted.next(),nextRandom);
    assert.equal(counted.draws,9);
    assert.throws(()=>counted.restore({state:-1,draws:0}),/Invalid deterministic RNG snapshot/);

    const cyclic={z:new Uint8Array([2,1]),a:new Set([3,1])};
    cyclic.self=cyclic;
    cyclic._ui='excluded';
    cyclic.labelDraw='excluded';
    const serialized=serializeCanonicalV1(cyclic);
    assert.equal(serialized,'{"$id":1,"a":{"$id":2,"$set":[1,3]},"self":{"$ref":1},"z":{"$id":3,"$typed":"Uint8Array","$values":[2,1]}}');
    assert.equal(serializeCanonicalV1(new Map([['b',undefined],['a',-0]])),'{"$id":1,"$map":[["a",{"$number":"-0"}],["b",{"$undefined":true}]]}');
    assert.throws(()=>serializeCanonicalV1(new Set([{}])),/sets must contain only primitive/i);
    assert.throws(()=>serializeCanonicalV1(new Map([[{},1]])),/map keys must be primitive/i);
    assert.equal(serializeCanonicalV1([NaN,Infinity,-Infinity,2n,()=>{},Symbol('x')]),'{"$id":1,"$array":[{"$number":"NaN"},{"$number":"Infinity"},{"$number":"-Infinity"},{"$bigint":"2"},{"$unsupported":"function"},{"$unsupported":"symbol"}]}');

    const left=createDeterministicRuntime(),right=createDeterministicRuntime();
    left.seed('SAME');
    right.seed('SAME');
    assert.equal(left.random(),right.random());
    const recordedArgs=[0.5];
    left.recordCommand(3,'focus',recordedArgs);
    recordedArgs[0]=99;
    assert.equal(left.commands.log.length,1);
    assert.equal(left.commands.log[0].a[0],0.5);
    assert.equal(right.commands.log.length,0);
    left.replay.on=true;
    left.replay.cmds.push({t:3,k:'focus',a:[0.5]});
    left.replay.i=1;
    assert.equal(right.replay.on,false);
    assert.deepEqual(right.replay.cmds,[]);
    assert.equal(right.replay.i,0);

    const commandContainer=left.commands,replayContainer=left.replay;
    const replayInput={on:true,cmds:[{t:1,k:'focus',a:[.1]},{t:2,k:'focus',a:[.2]}],i:1,hashes:[[100,'deadbeef']],resume:true};
    const configuredReplay=left.configureReplay(replayInput);
    const configuredRuntime=JSON.stringify(left.checkpoint());
    assertDeepFrozenAndTryMutations(configuredReplay);
    assert.equal(JSON.stringify(left.checkpoint()),configuredRuntime);
    assert.notEqual(configuredReplay,left.replay);
    assert.notEqual(configuredReplay.cmds,left.replay.cmds);
    assert.notEqual(configuredReplay.cmds[0].a,left.replay.cmds[0].a);
    replayInput.cmds[0].k='changed';
    assert.equal(left.replay.cmds[0].k,'focus');
    left.replay.why='old divergence'; left.replay.divTick=100; left.replay.divRec={old:true}; left.replay.divNow={old:true}; left.replay.finalVerified=true; left.replay.verifiedEvidence=true; left.replay.mismatch=true;
    left.configureReplay({on:true,cmds:[{t:4,k:'focus',a:[.4]}],i:0,toTick:4,resume:false,speed:1,mismatch:false,finalHash:'deadbeef'});
    assert.deepEqual(Object.keys(left.replay).filter(key=>['why','divTick','divRec','divNow','finalVerified','verifiedEvidence'].includes(key)),[]);
    assert.equal(left.replay.mismatch,false);
    assert.equal(left.replay.finalHash,'deadbeef');
    left.replay.why='second divergence'; left.replay.finalVerified=true; left.replay.verifiedEvidence=true; left.replay.finalDigest={version:STATE_ORACLE_VERSION,sha256:'0'.repeat(64)};
    left.configureReplay({on:true,cmds:[],i:0,toTick:0,resume:false,speed:1});
    assert.equal(left.replay.why,undefined);
    assert.equal(left.replay.finalVerified,undefined);
    assert.equal(left.replay.verifiedEvidence,undefined);
    assert.equal(left.replay.finalHash,undefined);
    assert.equal(left.replay.finalDigest,undefined);
    const configuredBytes=JSON.stringify(configuredReplay),configuredNextRandom=left.random();
    left.restoreCheckpoint(JSON.parse(configuredRuntime));
    assert.equal(left.random(),configuredNextRandom);
    assert.equal(JSON.stringify(configuredReplay),configuredBytes);
    assert.equal(left.replay.on,true);
    assert.equal(left.replay.i,1);
    assert.equal(left.replay.cmds[0].k,'focus');
    const runtimeCheckpoint=left.checkpoint(),expectedAfterCheckpoint=left.random();
    left.recordCommand(4,'changed',[9]);
    left.replay.i=2;
    left.restoreCheckpoint(runtimeCheckpoint);
    assert.equal(left.commands,commandContainer);
    assert.equal(left.replay,replayContainer);
    assert.equal(left.random(),expectedAfterCheckpoint);
    assert.deepEqual(left.commands.log,[{t:3,k:'focus',a:[0.5]}]);
    assert.equal(left.replay.i,1);
    runtimeCheckpoint.commands.log[0].a[0]=99;
    assert.equal(left.commands.log[0].a[0],0.5);
    const beforeRejectedRestore=left.checkpoint();
    assert.throws(()=>left.restoreCheckpoint({...runtimeCheckpoint,version:'unknown'}),/Invalid deterministic runtime checkpoint/);
    assert.throws(()=>left.restoreCheckpoint({...runtimeCheckpoint,commands:{log:[],hashes:[]}}),/Invalid deterministic runtime checkpoint/);
    assert.throws(()=>left.restoreCheckpoint({...runtimeCheckpoint,replay:{...runtimeCheckpoint.replay,unsupported:new Map()}}),/Runtime checkpoint values/);
    assert.throws(()=>left.restoreCheckpoint({...runtimeCheckpoint,extra:true}),/Invalid deterministic runtime checkpoint/);
    assert.throws(()=>left.restoreCheckpoint({...runtimeCheckpoint,replay:{...runtimeCheckpoint.replay,speed:101}}),/Invalid replay control values/);
    assert.throws(()=>left.restoreCheckpoint({...runtimeCheckpoint,replay:{...runtimeCheckpoint.replay,hashv:3}}),/hash version/);
    assert.throws(()=>left.restoreCheckpoint({...runtimeCheckpoint,replay:{...runtimeCheckpoint.replay,hashes:[[100,'bad']]}}),/hash checkpoint/);
    assert.throws(()=>left.restoreCheckpoint({...runtimeCheckpoint,replay:{...runtimeCheckpoint.replay,cmds:[{t:2,k:'focus',a:[.2]},{t:1,k:'focus',a:[.1]}],i:0}}),/ordered/);
    assert.throws(()=>left.restoreCheckpoint({...runtimeCheckpoint,commands:{...runtimeCheckpoint.commands,log:[{t:2,k:'focus',a:[.2]},{t:1,k:'focus',a:[.1]}]}}),/ordered/);
    const accessorCheckpoint={...runtimeCheckpoint}; Object.defineProperty(accessorCheckpoint,'version',{enumerable:true,get(){ left.random(); return runtimeCheckpoint.version; }});
    assert.throws(()=>left.restoreCheckpoint(accessorCheckpoint),/accessors/);
    assert.deepEqual(left.checkpoint(),beforeRejectedRestore);
    left.resetCommands();
    assert.equal(left.commands,commandContainer);
    assert.deepEqual(left.commands,{log:[],replaying:false,hashes:[]});
    assert.equal(left.replay,replayContainer);
    assert.equal(left.replay.on,true);
    const restoredLog=[{t:8,k:'focus',a:[1]}],restoredHashes=[[100,'deadbeef']];
    left.setCommandHistory(restoredLog,restoredHashes);
    restoredLog[0].a[0]=2;
    restoredHashes[0][1]='changed';
    assert.deepEqual(left.commands.log,[{t:8,k:'focus',a:[1]}]);
    assert.deepEqual(left.commands.hashes,[[100,'deadbeef']]);
    assert.throws(()=>left.setCommandHistory([{t:8,k:'continueAfterEnd',a:[true]}],[]),/post-systems phase/);
    assert.throws(()=>left.setCommandHistory([{t:8,k:'continueAfterEnd',a:[true],phase:'post-systems'},{t:8,k:'focus',a:[1]}],[]),/ordered by tick and phase/);
    assert.deepEqual(left.commands.log,[{t:8,k:'focus',a:[1]}],'rejected history replacement was not atomic');
    left.replay.i=1;
    const takenOver=left.takeOverReplay();
    const takeoverRuntime=JSON.stringify(left.checkpoint());
    assert.deepEqual(takenOver,[{t:1,k:'focus',a:[.1]}]);
    assertDeepFrozenAndTryMutations(takenOver);
    assert.equal(JSON.stringify(left.checkpoint()),takeoverRuntime);
    assert.notEqual(takenOver,left.commands.log);
    assert.notEqual(takenOver[0],left.commands.log[0]);
    assert.notEqual(takenOver[0].a,left.commands.log[0].a);
    assert.equal(left.replay.on,false);
    assert.notEqual(left.commands.log,left.replay.cmds);
    left.replay.cmds[0].k='changed';
    assert.equal(left.commands.log[0].k,'focus');
    left.recordCommand(9,'later',[3]);
    assert.deepEqual(takenOver,[{t:1,k:'focus',a:[.1]}],'retained takeover result changed with later command state');

    const order=[];
    let tick=99,simMs=9900;
    left.replay.on=true;
    left.replay.cmds=[{t:99,k:'focus',a:[0.25]}];
    left.replay.i=0;
    assert.deepEqual(left.advanceOneTick({
      getTick:()=>tick,
      applyReplayCommand:command=>order.push(`command:${command.k}`),
      advanceDraft:()=>order.push('draft'),
      isStopped:()=>false,
      setClock:(nextTick,nextSimMs)=>{ tick=nextTick; simMs=nextSimMs; order.push(`clock:${tick}`); },
      checkpoint:()=>order.push('checkpoint'),
      runSystems:now=>order.push(`systems:${now}`)
    }),{advanced:true,commandFailed:false,phase:null});
    assert.equal(tick,100);
    assert.equal(simMs,10000);
    assert.deepEqual(order,['command:focus','draft','clock:100','checkpoint','systems:10000']);

    const phased=createDeterministicRuntime(),phaseOrder=[];
    phased.configureReplay({on:true,cmds:[{t:1,k:'continueAfterEnd',a:[false],phase:'post-systems'}],i:0,toTick:1});
    let phaseTick=0;
    assert.deepEqual(phased.advanceOneTick({getTick:()=>phaseTick,applyReplayCommand:command=>phaseOrder.push(command.k),advanceDraft:()=>phaseOrder.push('draft'),isStopped:()=>false,setClock:tick=>{ phaseTick=tick; },checkpoint:()=>{},runSystems:()=>phaseOrder.push('systems')}),{advanced:true,commandFailed:false,phase:null});
    assert.deepEqual(phaseOrder,['draft','systems','continueAfterEnd']);

    const failedPost=createDeterministicRuntime(),failedPostOrder=[];
    failedPost.configureReplay({on:true,cmds:[{t:1,k:'continueAfterEnd',a:[false],phase:'post-systems'}],i:0,toTick:1});
    let failedPostTick=0;
    assert.deepEqual(failedPost.advanceOneTick({getTick:()=>failedPostTick,applyReplayCommand:()=>false,advanceDraft:()=>failedPostOrder.push('draft'),isStopped:()=>false,setClock:tick=>{ failedPostTick=tick; },checkpoint:()=>{},runSystems:()=>failedPostOrder.push('systems'),replayCommandFailed:(_command,phase)=>failedPostOrder.push(`failed:${phase}`)}),{advanced:true,commandFailed:true,phase:'post-systems'});
    assert.deepEqual(failedPostOrder,['draft','systems','failed:post-systems']);
    assert.equal(failedPostTick,1);

    const failedReplay=createDeterministicRuntime();
    assert.throws(()=>failedReplay.configureReplay({on:true,cmds:[{t:0,k:'bad',a:[]}],i:0}),/Unsupported command kind/);
    assert.equal(failedReplay.replay.i,0,'rejected replay command must not consume the cursor');
    assert.equal(failedReplay.replay.on,false,'rejected replay command must not start replay');

    const stopped=[];
    assert.deepEqual(right.advanceOneTick({
      getTick:()=>7,
      applyReplayCommand:()=>stopped.push('command'),
      advanceDraft:()=>stopped.push('draft'),
      isStopped:()=>true,
      setClock:()=>stopped.push('clock'),
      checkpoint:()=>stopped.push('checkpoint'),
      runSystems:()=>stopped.push('systems')
    }),{advanced:false,commandFailed:false,phase:null});
    assert.deepEqual(stopped,['draft']);
    assert.equal('S' in globalThis,false);
    console.log('Deterministic runtime contracts PASS');
  }finally{
    for(const [name,descriptor] of prior){
      if(descriptor) Object.defineProperty(globalThis,name,descriptor);
      else delete globalThis[name];
    }
  }
})().catch(error=>{ console.error(error.stack||error); process.exitCode=1; });
