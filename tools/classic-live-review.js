const assert=require('node:assert/strict'),fs=require('node:fs'),{chromium}=require('playwright');
(async()=>{const b=await chromium.launch();try{
const p=await b.newPage({viewport:{width:1600,height:1000}}),errors=[];p.on('pageerror',e=>errors.push(e.message));
await p.addInitScript(()=>window.__STATEFALL_TEST_MODE__=true);
await p.goto('http://127.0.0.1:4173/?art=classic&scene=coast&browserTest=1');await p.waitForFunction(()=>window.__STATEFALL_CLASSIC__);
await p.evaluate(()=>window.__STATEFALL_TEST__.terrainRasterSettled());
// Issue a real attack into the neighbouring territory visible north-east of the base.
await p.mouse.click(1000,210);await p.mouse.move(1310,980);
const result=await p.evaluate(async()=>{
const before=window.__STATEFALL_CLASSIC__.diagnostics(),start=window.__STATEFALL_TEST__.status(),frames=[];let last=performance.now(),until=last+5000;
document.querySelector('#pauseBtn').click();
await new Promise(resolve=>{function frame(now){frames.push(now-last);last=now;if(now<until)requestAnimationFrame(frame);else resolve();}requestAnimationFrame(frame);});
window.__STATEFALL_TEST__.pause();frames.sort((a,b)=>a-b);
const after=window.__STATEFALL_CLASSIC__.diagnostics();
return {sceneryRebuilds:after.terrainRefreshes-before.terrainRefreshes,overlayRebuilds:after.overlayRefreshes-before.overlayRefreshes,ticks:window.__STATEFALL_TEST__.status().tick-start.tick,frames:frames.length,p95Ms:frames[Math.floor(frames.length*.95)],maxMs:frames.at(-1),command:start.lastCommand};
});
await p.screenshot({path:'prototypes/classic-battlefield-direction/live-territory.png'});
assert.deepEqual(errors,[]);assert.equal(result.command.k,'click');assert.ok(result.ticks>=35,'simulation should advance in live wall-clock play');
fs.writeFileSync('prototypes/classic-battlefield-direction/live-verification.json',JSON.stringify(result,null,2));console.log(JSON.stringify(result));
}finally{await b.close();}})().catch(e=>{console.error(e);process.exitCode=1;});
