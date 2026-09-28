const fs=require('node:fs'),assert=require('node:assert/strict'),{chromium}=require('playwright');
const fingerprint=require('./fingerprint')();
const fixturePath=process.argv[2]||'docs/evidence/comprehensive/campaign-atoll-impossible-SOAK5B-replay.json';
const fixture=JSON.parse(fs.readFileSync(fixturePath,'utf8'));
const map=String(fixture.settings.map).replace(/[^a-z0-9_-]/gi,'_');
const payload={...Object.fromEntries(['seed','settings','hashv','tick','cmds','hashes','final'].map(key=>[key,fixture[key]])),v:1,game:require('../../package.json').version,requiresCanonicalCheckpoints:true};
(async()=>{
 const browser=await chromium.launch();
 try{
  const page=await browser.newPage({viewport:{width:1600,height:1000}}),errors=[];
  page.on('console',m=>{if(m.type()==='error')errors.push(m.text());});page.on('response',r=>{if(r.status()>=400)errors.push(r.url()+': HTTP '+r.status());});
  page.on('pageerror',e=>errors.push(e.message));page.on('requestfailed',r=>errors.push(r.url()+': '+r.failure()?.errorText));
  if(process.argv.includes('--capture-diagnostics'))await page.route('**/src/legacy-game.js*',async route=>{const response=await route.fetch();const body=(await response.text()).replace('    snapshot,','    qualificationCheckpoint:()=>engine.checkpoint(), qualificationRendering:()=>({art:classicBattlefield?.diagnostics(),effects:{puffs:puffs.length,sparks:sparks.length,flashes:flashes.length},camera:{x:cam.x,y:cam.y,s:cam.s}}),\n    snapshot,');await route.fulfill({response,body});});
  await page.addInitScript(()=>{window.__STATEFALL_TEST_MODE__=true;localStorage.setItem('statefall-audio',JSON.stringify({master:0}));});
  await page.goto('http://127.0.0.1:4173/?art=classic&browserTest=1');
  await page.waitForFunction(()=>window.__STATEFALL_TEST__);
  await page.evaluate(value=>window.__STATEFALL_TEST__.loadReplay(value,'resume'),payload);
  const cdp=process.argv.includes('--profile')?await page.context().newCDPSession(page):null;
  if(cdp){await cdp.send('Profiler.enable');await cdp.send('Profiler.start');}
  const progress=[],catchupStart=Date.now();
  const monitor=setInterval(()=>page.evaluate(()=>window.__STATEFALL_TEST__.status()).then(status=>{const row={elapsedMs:Date.now()-catchupStart,...status};progress.push(row);console.log(JSON.stringify({map,catchup:row}));}).catch(()=>{}),20000);
  try{
   await page.waitForFunction(target=>{const s=window.__STATEFALL_TEST__.status();return s.tick>=target||s.replay.mismatch;},fixture.tick,{timeout:240000});
  }catch(error){
   const status=await page.evaluate(()=>window.__STATEFALL_TEST__.status()).catch(()=>null);
   fs.writeFileSync('docs/evidence/comprehensive/late-game-'+map+'-catchup-failure.json',JSON.stringify({fingerprint,fixture:fixturePath,pass:false,error:String(error),status,progress,errors},null,2));
   await page.screenshot({path:'docs/evidence/comprehensive/late-game-'+map+'-failure.png'}).catch(()=>{});throw error;
  }finally{
   clearInterval(monitor);
   if(cdp){const {profile}=await cdp.send('Profiler.stop');fs.writeFileSync('.artifacts/late-game-'+map+'.cpuprofile',JSON.stringify(profile));}
  }
  const status=await page.evaluate(()=>window.__STATEFALL_TEST__.status());
  assert.equal(status.replay.mismatch,false,JSON.stringify(status));
  if(process.argv.includes('--capture-diagnostics'))fs.writeFileSync('.artifacts/'+map+'-checkpoint.json',JSON.stringify(await page.evaluate(()=>window.__STATEFALL_TEST__.qualificationCheckpoint())));
  try{await page.locator('#cuPlay').waitFor({state:'visible',timeout:30000});}catch(error){fs.writeFileSync('.artifacts/'+map+'-ready-failure.json',JSON.stringify({errors,status:await page.evaluate(()=>window.__STATEFALL_TEST__.status()),modal:await page.locator('#modal').textContent()},null,2));throw error;}
  const readyUi=await page.evaluate(()=>({gold:document.querySelector('#gold').textContent,troops:document.querySelector('#troops').textContent,player:window.__STATEFALL_TEST__.snapshot().player}));
  assert.equal(readyUi.gold,String(Math.floor(readyUi.player.gold)));assert.ok(readyUi.troops.startsWith(String(Math.round(readyUi.player.troops))+' '),'sidebar must refresh when catch-up completes');
  await page.evaluate(()=>{document.querySelector('#cuPlay').click();window.__STATEFALL_TEST__.pause();window.__STATEFALL_TEST__.setCamera(10,'player');window.__STATEFALL_TEST__.renderRepeatedly(3);});
  await page.evaluate(()=>window.__STATEFALL_TEST__.terrainRasterSettled());
  const liveProfiler=process.argv.includes('--profile-live')?await page.context().newCDPSession(page):null;
  if(liveProfiler){await liveProfiler.send('Profiler.enable');await liveProfiler.send('Profiler.start');}
  const result=await page.evaluate(async()=>{
   const api=window.__STATEFALL_TEST__,tick=api.status().tick;
   if(api.status().paused)document.querySelector('#pauseBtn').click();
   const frames=[],start=performance.now();let last=start;
   await new Promise(resolve=>{function frame(now){frames.push(now-last);last=now;if(now-start<12000)requestAnimationFrame(frame);else resolve();}requestAnimationFrame(frame);});
   api.pause();frames.sort((a,b)=>a-b);
   return {elapsedMs:last-start,frames:frames.length,ticks:api.status().tick-tick,p95Ms:frames[Math.floor(frames.length*.95)],p99Ms:frames[Math.floor(frames.length*.99)],maxMs:frames.at(-1),stallsOver50ms:frames.filter(v=>v>50).length,status:api.status()};
  });
  if(process.argv.includes('--capture-diagnostics'))result.rendering=await page.evaluate(()=>window.__STATEFALL_TEST__.qualificationRendering());
  if(liveProfiler){const {profile}=await liveProfiler.send('Profiler.stop');fs.writeFileSync('.artifacts/live-game-'+map+'.cpuprofile',JSON.stringify(profile));}
  await page.screenshot({path:'docs/evidence/comprehensive/late-game-'+map+'.png'});
  fs.writeFileSync('docs/evidence/comprehensive/late-game-'+map+'-browser.json',JSON.stringify({fingerprint,fixture:fixturePath,pass:errors.length===0&&!result.status.replay.mismatch&&result.ticks>=90&&result.frames>=360,...result,errors},null,2));
  console.log(JSON.stringify({map,frames:result.frames,ticks:result.ticks,p95Ms:result.p95Ms,p99Ms:result.p99Ms,maxMs:result.maxMs,stallsOver50ms:result.stallsOver50ms,replay:result.status.replay.mismatch?'FAIL':'PASS'}));
  assert.deepEqual(errors,[]);assert.equal(result.status.replay.mismatch,false);
  assert.ok(result.ticks>=90,'late-game simulation fell behind real time');
  assert.ok(result.frames>=360,'late-game presentation fell below 30 FPS average');

 }finally{await browser.close();}
})().catch(error=>{console.error(error);process.exitCode=1;});
