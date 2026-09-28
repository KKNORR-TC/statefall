const fs=require('fs'),assert=require('node:assert/strict'),{chromium}=require('playwright');
const fixture=JSON.parse(fs.readFileSync('docs/evidence/comprehensive/unit-campaign-islands_m-hard-replay.json'));
const payload={...Object.fromEntries(['seed','settings','hashv','tick','cmds','hashes','final'].map(k=>[k,fixture[k]])),v:1,game:require('../../package.json').version,requiresCanonicalCheckpoints:true};
(async()=>{const browser=await chromium.launch();try{
 const page=await browser.newPage(),errors=[];page.on('pageerror',e=>errors.push(e.message));
 await page.addInitScript(()=>{
  window.__STATEFALL_TEST_MODE__=true;
  const interval=window.setInterval,raf=window.requestAnimationFrame,cancel=window.cancelAnimationFrame,queued=new Map();let serial=1e9;
  window.setInterval=(fn,delay,...args)=>{if(delay===8){window.__qaNormalTick=fn;return interval(()=>{},delay);}return interval(fn,delay,...args);};
  window.requestAnimationFrame=fn=>{if(window.__qaHold){const id=++serial;queued.set(id,fn);return id;}return raf(fn);};
  window.cancelAnimationFrame=id=>{if(queued.has(id))queued.delete(id);else cancel(id);};
  window.__qaRelease=()=>{window.__qaHold=false;for(const fn of queued.values())raf(fn);queued.clear();};
 });
 await page.goto('http://127.0.0.1:4173/?browserTest=1');await page.waitForFunction(()=>window.__STATEFALL_TEST__);
 await page.evaluate(data=>{window.__qaHold=true;window.__STATEFALL_TEST__.loadReplay(data,'resume');},payload);
 await page.waitForTimeout(200);
 const result=await page.evaluate(()=>{const api=window.__STATEFALL_TEST__,before=api.status();window.__qaNormalTick();return {before,after:api.status()};});
 assert.equal(result.before.catchup.status,'running');assert.equal(result.after.tick,result.before.tick,'ordinary timer must not compete with modal catch-up');
 await page.evaluate(()=>window.__qaRelease());await page.locator('#cuPlay').waitFor({state:'visible',timeout:180000});
 const ready=await page.evaluate(()=>window.__STATEFALL_TEST__.status());assert.equal(ready.tick,fixture.tick);assert.equal(ready.replay.mismatch,false);assert.equal(ready.catchup.status,'ready');assert.deepEqual(errors,[]);
 fs.writeFileSync('docs/evidence/comprehensive/catchup-timer-regression.json',JSON.stringify({pass:true,result,ready,errors},null,2));console.log('Exclusive catch-up timer, exact target and visible Play now PASS');
}finally{await browser.close();}})().catch(e=>{console.error(e);process.exitCode=1;});
