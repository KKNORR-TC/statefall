const assert=require('node:assert/strict'),{chromium}=require('playwright');
(async()=>{const b=await chromium.launch();try{for(const loop of [false,true]){
const p=await b.newPage(),errors=[];p.on('pageerror',e=>errors.push(e.message));
await p.route('**/src/legacy-game.js*',async route=>{const r=await route.fetch();let source=await r.text();source=source.replace('function tick(){','window.__replayProbe={step:n=>{clearInterval(window.__tickTimer);for(let i=0;i<n;i++)tick();return canonicalState();}};\nfunction tick(){');await route.fulfill({response:r,body:source});});
await p.addInitScript(()=>window.__STATEFALL_TEST_MODE__=true);await p.goto('http://127.0.0.1:4173/?art=classic&scene=coast&browserTest=1');await p.waitForFunction(()=>window.__STATEFALL_CLASSIC__);
await p.locator(loop?'[data-action="sail"]':'#pauseBtn').click();
const original=await p.evaluate(()=>window.__replayProbe.step(301-window.__STATEFALL_TEST__.status().tick));
const identity=await p.evaluate(()=>({name:window.__STATEFALL_TEST__.me.name,flag:window.__STATEFALL_TEST__.me.flag.idx}));
const reset=await p.evaluate(()=>window.__STATEFALL_TEST__.creditsReplayResetContract());assert.ok(reset.scratchCleared&&reset.setupInstalled);
assert.deepEqual(await p.evaluate(()=>({name:window.__STATEFALL_TEST__.me.name,flag:window.__STATEFALL_TEST__.me.flag.idx})),identity);
const replayed=await p.evaluate(()=>window.__replayProbe.step(301-window.__STATEFALL_TEST__.status().tick));
const status=await p.evaluate(()=>window.__STATEFALL_TEST__.status());assert.equal(status.replay.mismatch,false,JSON.stringify(status.replay));assert.equal(status.tick,301);
assert.equal(replayed,original,'credits reconstruction must exactly match recorded canonical state');
assert.deepEqual(errors,[]);console.log('Credits replay PASS',JSON.stringify({loop,checkpoints:3,commands:status.replay.applied,identity}));await p.close();
}}finally{await b.close();}})().catch(e=>{console.error(e);process.exitCode=1;});
