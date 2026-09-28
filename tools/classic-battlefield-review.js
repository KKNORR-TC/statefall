// Local candidate integration checks. Start npm run dev before running this file.
const assert=require('node:assert/strict');
const fs=require('node:fs');
const {chromium}=require('playwright');
(async()=>{
 const browser=await chromium.launch();
 try{
  const page=await browser.newPage({viewport:{width:1600,height:1000}});
  const errors=[];
  page.on('pageerror',e=>errors.push(e.message));
  page.on('console',m=>{if(m.type()==='error')errors.push(m.text());});
  page.on('response',r=>{if(r.status()>=400)errors.push('HTTP '+r.status()+' '+r.url());});
  await page.addInitScript(()=>{window.__STATEFALL_TEST_MODE__=true;localStorage.setItem('statefall-audio',JSON.stringify({master:0,sfx:0,alert:0,amb:0,music:0}));});
  await page.goto('http://127.0.0.1:4173/?art=classic&scene=coast&browserTest=1');
  await page.waitForFunction(()=>window.__STATEFALL_CLASSIC__&&window.__STATEFALL_TEST__?.status().ready);
  await page.evaluate(()=>window.__STATEFALL_TEST__.terrainRasterSettled());
  const diag=await page.evaluate(()=>window.__STATEFALL_CLASSIC__.diagnostics());
  assert.equal(diag.structures.length,8);assert.equal(diag.ships,1);
  const before=await page.evaluate(()=>window.__STATEFALL_TEST__.canonicalCheckpoint());
  const commands=await page.evaluate(()=>window.__STATEFALL_TEST__.replayPayload());
  fs.writeFileSync('prototypes/classic-battlefield-direction/commanded-example-replay.json',JSON.stringify(commands,null,2));
  await page.evaluate(()=>window.__STATEFALL_TEST__.renderRepeatedly(30));
  await page.locator('[data-action="compare"]').click();
  const original=await page.locator('#map').screenshot();
  await page.locator('[data-action="compare"]').click();
  const candidate=await page.locator('#map').screenshot();
  assert.notDeepEqual(original,candidate);
  for(const scale of [2.2,10,24]){await page.locator('[data-view="'+scale+'"]').click();await page.evaluate(()=>window.__STATEFALL_TEST__.renderRepeatedly(3));}
  const after=await page.evaluate(()=>window.__STATEFALL_TEST__.canonicalCheckpoint());
  assert.deepEqual(after,before,'Rendering, comparison and zoom must preserve canonical state and RNG');
  const target=await page.evaluate(()=>{
   const st=window.__STATEFALL_CLASSIC__.diagnostics().structures.find(s=>s.type==='factory');
   const c=window.__STATEFALL_TEST__.snapshot().camera,b=document.querySelector('#map').getBoundingClientRect();
   return {x:b.x+c.x+(st.t%720+.5)*c.scale,y:b.y+c.y+(Math.floor(st.t/720)+.5)*c.scale-30};
  });
  await page.mouse.click(target.x,target.y,{button:'right'});
  await page.waitForSelector('#ctx',{state:'visible'});
  assert.match(await page.locator('#ctx').innerText(),/factory/i);
  await page.keyboard.press('Escape');
  await page.mouse.move(1310,980);
  await page.evaluate(()=>window.__STATEFALL_TEST__.renderRepeatedly(1));
  await page.evaluate(()=>window.__STATEFALL_TEST__.terrainRasterSettled());
  await page.screenshot({path:'prototypes/classic-battlefield-direction/in-game-example.png'});
  // Advance the real simulation; rendering must remain valid with moving actors.
  await page.evaluate(()=>window.__STATEFALL_TEST__.advance(25));
  await page.evaluate(()=>window.__STATEFALL_TEST__.renderRepeatedly(10));
  assert.deepEqual(errors,[]);
  const final=await page.evaluate(()=>({art:window.__STATEFALL_CLASSIC__.diagnostics(),status:window.__STATEFALL_TEST__.status()}));
  fs.writeFileSync('prototypes/classic-battlefield-direction/verification.json',JSON.stringify({checks:['eight commanded buildings','commanded destroyer','render and RNG purity','compare changes pixels','three zoom bands','factory menu','25 simulation ticks','no browser errors'],...final},null,2));

  const cacheCheck=await page.evaluate(async()=>{
    const {createClassicBattlefield}=await import('/src/rendering/classic-battlefield.mjs');
    const art=await createClassicBattlefield(),canvas=document.createElement('canvas');canvas.width=canvas.height=128;
    const ctx=canvas.getContext('2d'),land=new Uint8Array(64).fill(1),fog=new Uint8Array(64).fill(1),owner=new Int16Array(64).fill(0);
    const state={camera:{x:0,y:0,s:16},width:128,height:128,W:8,H:8,land,fog,owner,river:new Uint8Array(64),rough:new Float32Array(64),players:[{color:'#4499dd'},{color:'#dd6644'}],structures:[],links:[],trucks:[]};
    art.paintTerrain(ctx,state);const first=canvas.toDataURL(),a=art.diagnostics().terrainRefreshes;
    art.paintTerrain(ctx,state);const b=art.diagnostics().terrainRefreshes;
    fog.fill(0);art.paintTerrain(ctx,state);const hidden=canvas.toDataURL(),c=art.diagnostics().terrainRefreshes;
    fog.fill(1);owner.fill(1);art.paintTerrain(ctx,state);const foreign=canvas.toDataURL(),d=art.diagnostics().terrainRefreshes;
    art.destroy();return {reused:a===b,fog:c===b&&hidden!==first,ownership:d===c&&foreign!==first};
  });
  assert.deepEqual(cacheCheck,{reused:true,fog:true,ownership:true});
  // Missing candidate assets fall back to the standard start screen.
  const fallback=await browser.newPage();
  await fallback.route('**/classic-assets/terrain.png',r=>r.abort());
  await fallback.goto('http://127.0.0.1:4173/?art=classic&scene=coast');
  await fallback.waitForSelector('#startBtn',{state:'visible'});
  assert.equal(await fallback.locator('#classic-review').count(),0);
  console.log('Classic battlefield integration PASS',JSON.stringify(final));
 }finally{await browser.close();}
})().catch(e=>{console.error(e);process.exitCode=1;});
