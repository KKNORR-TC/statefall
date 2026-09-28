const assert=require('node:assert/strict'),{chromium}=require('playwright');
(async()=>{const b=await chromium.launch();try{
const p=await b.newPage({viewport:{width:1600,height:1000}}),errors=[];p.on('pageerror',e=>errors.push(e.message));
await p.route('**/src/legacy-game.js*',async route=>{const r=await route.fetch();let source=await r.text();const anchor='},navalCanvasStrokeState=navalLogisticsCanvasStrokeState(navalLogisticsState)';assert.ok(source.includes(anchor));source=source.replace(anchor,'},fogProbe=(window.__fogProbe=t=>({visible:!!renderState.fog.vis[t],opacity:fogTransition.update(renderState.fog.vis,clockState.tickN)[t]})),transportFogReview=(window.__transportFogReview=navalLogisticsState.transports.map(tr=>({x:tr.x,y:tr.y,owned:tr.source.owner===me().id,visible:tr.visible,inVision:visAt(tr.x,tr.y)}))),navalCanvasStrokeState=navalLogisticsCanvasStrokeState(navalLogisticsState)');await route.fulfill({response:r,body:source});});
await p.addInitScript(()=>window.__STATEFALL_TEST_MODE__=true);
await p.goto('http://127.0.0.1:4173/?art=classic&scene=coast&browserTest=1');await p.waitForFunction(()=>window.__STATEFALL_CLASSIC__);
await p.evaluate(()=>window.__STATEFALL_CLASSIC__.focus(2.2));await p.evaluate(()=>window.__STATEFALL_TEST__.terrainRasterSettled());
await p.evaluate(()=>{window.__STATEFALL_TEST__.advance(2);window.__STATEFALL_TEST__.renderRepeatedly(1);});
await p.mouse.click(1040,740,{button:'right'});await p.locator('#ctx [data-act="transport"]').click({timeout:5000});
const probe=180*720+590;
assert.equal((await p.evaluate(t=>window.__fogProbe(t),probe)).visible,false,'crossing starts hidden');
let revealed=false,lost=false;
for(let i=0;i<60;i++){
 const result=await p.evaluate(t=>{window.__STATEFALL_TEST__.advance(5);window.__STATEFALL_TEST__.renderRepeatedly(1);return {ships:window.__transportFogReview,probe:window.__fogProbe(t)};},probe);
 assert.ok(result.ships.every(tr=>tr.owned?tr.visible:tr.visible===tr.inVision));
 if(result.probe.visible)revealed=true;
 if(revealed&&!result.probe.visible){assert.ok(result.probe.opacity<255,'fog begins returning gradually');lost=true;break;}
}
assert.ok(revealed&&lost,'traveling transport reveals and then leaves the remote probe');
const middle=await p.evaluate(t=>{window.__STATEFALL_TEST__.advance(10);window.__STATEFALL_TEST__.renderRepeatedly(1);return window.__fogProbe(t);},probe);
assert.equal(middle.visible,false);assert.ok(middle.opacity>0&&middle.opacity<255,'halfway fade is partial');
const dark=await p.evaluate(t=>{window.__STATEFALL_TEST__.advance(10);window.__STATEFALL_TEST__.renderRepeatedly(1);return window.__fogProbe(t);},probe);
assert.equal(dark.opacity,255,'fog finishes returning');
const before=await p.evaluate(()=>window.__STATEFALL_TEST__.canonicalCheckpoint());await p.evaluate(()=>window.__STATEFALL_TEST__.renderRepeatedly(5));await p.locator('[data-action="compare"]').click();await p.evaluate(()=>window.__STATEFALL_TEST__.renderRepeatedly(5));assert.deepEqual(await p.evaluate(()=>window.__STATEFALL_TEST__.canonicalCheckpoint()),before);
assert.deepEqual(errors,[]);console.log('Transport traveling vision, gradual fog return and render purity PASS');
}finally{await b.close();}})().catch(e=>{console.error(e);process.exitCode=1;});
