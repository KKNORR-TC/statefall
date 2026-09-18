const assert=require('node:assert/strict');
const path=require('node:path');
const {pathToFileURL}=require('node:url');

(async()=>{
  const protectedGlobals=['window','document','Image','HTMLCanvasElement','AudioContext','localStorage','sessionStorage','fetch','requestAnimationFrame','setTimeout'];
  const prior=new Map(protectedGlobals.map(name=>[name,Object.getOwnPropertyDescriptor(globalThis,name)]));
  for(const name of protectedGlobals) Object.defineProperty(globalThis,name,{configurable:true,get(){ throw new Error(`simulation ports accessed browser global ${name}`); }});
  try{
    const {createSimulationPorts}=await import(pathToFileURL(path.resolve(__dirname,'..','game','src','sim','simulation-ports.mjs')).href);
    const defaults=createSimulationPorts();
    assert.equal(Object.isFrozen(defaults),true);
    for(const name of ['invalidateMap','invalidateUi','log','sound','matchEnded','alliedDecisionRequested','draftCompleted','replayDiverged','scheduleControllerTask']){
      assert.equal(Object.isFrozen(defaults[name]),true,`${name} is not frozen`);
      assert.doesNotThrow(()=>defaults[name](()=>{ throw new Error('default invoked callback'); }));
    }

    const calls=[];
    const callback=()=>calls.push(['callback']);
    const ports=createSimulationPorts({
      invalidateMap:()=>calls.push(['map']),
      invalidateUi:()=>calls.push(['ui']),
      log:(message,mine)=>calls.push(['log',message,mine]),
      sound:name=>calls.push(['sound',name]),
      matchEnded:(title,text)=>calls.push(['end',title,text]),
      alliedDecisionRequested:decision=>calls.push(['decision',decision]),
      draftCompleted:()=>calls.push(['draft-complete']),
      replayDiverged:details=>calls.push(['diverged',details]),
      scheduleControllerTask:task=>calls.push(['schedule',task])
    });
    assert.deepEqual(calls,[],'factory creation invoked an adapter');
    const details={tick:100,recordedHash:'old',currentHash:'new',reason:'players'};
    ports.invalidateMap();
    ports.invalidateUi();
    ports.log('hello',true);
    ports.sound('unified');
    ports.matchEnded('Victory','The whole world is yours.');
    const decision={type:'allied-endgame',rivalIds:[1]};
    ports.alliedDecisionRequested(decision);
    ports.draftCompleted();
    ports.replayDiverged(details);
    ports.scheduleControllerTask(callback);
    assert.deepEqual(calls,[['map'],['ui'],['log','hello',true],['sound','unified'],['end','Victory','The whole world is yours.'],['decision',decision],['draft-complete'],['diverged',details],['schedule',callback]]);
    assert.doesNotThrow(()=>createSimulationPorts(null));
    console.log('Simulation presentation ports PASS');
  }finally{
    for(const [name,descriptor] of prior){
      if(descriptor) Object.defineProperty(globalThis,name,descriptor);
      else delete globalThis[name];
    }
  }
})().catch(error=>{ console.error(error.stack||error); process.exitCode=1; });
