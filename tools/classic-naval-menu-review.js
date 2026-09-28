const assert=require('node:assert/strict'),{chromium}=require('playwright');
(async()=>{const b=await chromium.launch();try{
const p=await b.newPage({viewport:{width:1600,height:1000}}),errors=[];p.on('pageerror',e=>{errors.push(e.message);console.log('BROWSER ERROR',e.stack);});
await p.addInitScript(()=>window.__STATEFALL_TEST_MODE__=true);
await p.goto('http://127.0.0.1:4173/?art=classic&scene=coast&browserTest=1');
await p.waitForFunction(()=>window.__STATEFALL_CLASSIC__);
const resources=await p.evaluate(()=>window.__STATEFALL_TEST__.snapshot().player);assert.ok(resources.troops>1e8&&resources.gold>1e8,'Coastal test grants ample player resources');
for(const standard of [false,true]){
if(standard)await p.locator('[data-action="compare"]').click();
await p.evaluate(()=>window.__STATEFALL_CLASSIC__.focus(10));
const points=await p.evaluate(()=>{const d=window.__STATEFALL_CLASSIC__.diagnostics(),c=window.__STATEFALL_TEST__.snapshot().camera,b=document.querySelector('#map').getBoundingClientRect(),st=d.structures.find(s=>s.type==='port'),w=d.destroyers[0];return {port:{x:b.x+c.x+(st.t%720+.5)*c.scale,y:b.y+c.y+(Math.floor(st.t/720)+.5)*c.scale},ship:{x:b.x+c.x+w.x*c.scale,y:b.y+c.y+w.y*c.scale}};});
const before=await p.evaluate(()=>window.__STATEFALL_TEST__.canonicalCheckpoint());
// Raised artwork must resolve to the port, even over a neighboring tile.
await p.mouse.click(points.port.x,points.port.y-(standard?0:25),{button:'right'});
await p.waitForSelector('#ctx',{state:'visible',timeout:5000});assert.match(await p.locator('#ctx').innerText(),/Upgrade port/i);
await p.keyboard.press('Escape');
await p.mouse.click(points.ship.x,points.ship.y,{button:'right'});
await p.waitForSelector('#ctx',{state:'visible'});assert.match(await p.locator('#ctx').innerText(),/Fleet orders/);assert.equal(await p.locator('#ctx [data-act="warship"]').count()>0,true);
assert.deepEqual(await p.evaluate(()=>window.__STATEFALL_TEST__.canonicalCheckpoint()),before,'Opening menus must not mutate the simulation');
const commandCount=await p.evaluate(()=>window.__STATEFALL_TEST__.snapshot().input.commands);
await p.locator('#ctx [data-act="move"]').click();
assert.equal(await p.evaluate(()=>window.__STATEFALL_TEST__.snapshot().input.commands),commandCount+1);await p.evaluate(()=>window.__STATEFALL_TEST__.renderRepeatedly(2));
if(!standard)assert.notDeepEqual(await p.evaluate(()=>window.__STATEFALL_TEST__.canonicalCheckpoint()),before,'Fleet menu dispatches a real movement command');
await p.mouse.click(points.ship.x,points.ship.y,{button:'right'});await p.locator('#ctx [data-act="warship"][data-cls="battleship"]').click();
await p.evaluate(()=>window.__STATEFALL_TEST__.renderRepeatedly(10));
assert.equal(await p.evaluate(()=>window.__STATEFALL_CLASSIC__.diagnostics().ships),standard?3:2,'Ship purchase succeeds from the restored menu');
}
await p.evaluate(()=>{window.__STATEFALL_TEST__.advance(10);window.__STATEFALL_TEST__.renderRepeatedly(10);});
const tick=await p.evaluate(()=>window.__STATEFALL_TEST__.status().tick);await p.locator('#pauseBtn').click();await p.waitForFunction(t=>window.__STATEFALL_TEST__.status().tick>=t+5,tick,{timeout:5000});await p.evaluate(()=>window.__STATEFALL_TEST__.pause());
assert.deepEqual(errors,[]);console.log('Naval menus PASS: raised port, direct ship selection, move and purchase commands, both art modes');
}finally{await b.close();}})().catch(e=>{console.error(e);process.exitCode=1;});
