const fs=require('node:fs'),assert=require('node:assert/strict'),{chromium}=require('playwright');
(async()=>{const b=await chromium.launch(),results=[];try{for(const scenario of [{scale:5},{scale:10,duration:20000},{scale:24},{scale:10,width:2200,height:1200,dpr:1.5,duration:12000},{scale:10,standard:true}]){const {scale}=scenario;
const p=await b.newPage({viewport:{width:scenario.width||1600,height:scenario.height||1000},deviceScaleFactor:scenario.dpr||1}),errors=[];p.on('pageerror',e=>errors.push(e.message));
await p.addInitScript(()=>window.__STATEFALL_TEST_MODE__=true);await p.goto('http://127.0.0.1:4173/?art=classic&scene=coast&browserTest=1&testResources=standard');await p.waitForFunction(()=>window.__STATEFALL_CLASSIC__);
if(scenario.width){await p.setViewportSize({width:1600,height:1000});}
await p.mouse.click(1000,210);
if(scenario.width){await p.setViewportSize({width:scenario.width,height:scenario.height});}
if(scenario.standard)await p.locator('[data-action="compare"]').click();await p.evaluate(s=>window.__STATEFALL_CLASSIC__.focus(s),scale);await p.locator('#pauseBtn').click();await p.mouse.move(1400,980);
const result=await p.evaluate(async duration=>{let last=performance.now(),start=last,frames=[];const tick=window.__STATEFALL_TEST__.status().tick;
await new Promise(resolve=>{function frame(now){frames.push(now-last);last=now;if(now-start<duration)requestAnimationFrame(frame);else resolve();}requestAnimationFrame(frame);});
window.__STATEFALL_TEST__.pause();frames.sort((a,b)=>a-b);return {elapsedMs:last-start,frames:frames.length,ticks:window.__STATEFALL_TEST__.status().tick-tick,p95Ms:frames[Math.floor(frames.length*.95)],maxMs:frames.at(-1),stallsOver50ms:frames.filter(n=>n>50).length};},scenario.duration||6000);
console.log('measured',JSON.stringify({...scenario,...result}));assert.deepEqual(errors,[]);assert.ok(result.frames>(scenario.duration||6000)*.03,'medium zoom must not collapse to single-digit FPS');assert.ok(result.ticks>=(scenario.duration||6000)*.0075,'attacking simulation must keep advancing');
await p.screenshot({path:'prototypes/classic-battlefield-direction/attack-zoom-'+scale+'.png'});results.push({...scenario,...result});console.log(JSON.stringify(results.at(-1)));await p.close();
}fs.writeFileSync('prototypes/classic-battlefield-direction/medium-attack-performance.json',JSON.stringify(results,null,2));}finally{await b.close();}})().catch(e=>{console.error(e);process.exitCode=1;});
