const assert=require('node:assert/strict'),fs=require('node:fs'),{chromium}=require('playwright');
(async()=>{const browser=await chromium.launch();try{
const page=await browser.newPage({viewport:{width:1600,height:1000}}),errors=[];page.on('pageerror',e=>errors.push(e.message));
await page.addInitScript(()=>window.__STATEFALL_TEST_MODE__=true);
await page.goto('http://127.0.0.1:4173/?art=classic&scene=coast&browserTest=1');await page.waitForFunction(()=>window.__STATEFALL_CLASSIC__);
const sheet=await page.evaluate(async()=>{
 const {createClassicBattlefield}=await import('/src/rendering/classic-battlefield.mjs'),art=await createClassicBattlefield(),canvas=document.createElement('canvas');canvas.width=1200;canvas.height=620;const c=canvas.getContext('2d'),rotations=[],rotate=c.rotate.bind(c);c.rotate=a=>{rotations.push(a);rotate(a);};
 c.fillStyle='#163748';c.fillRect(0,0,1200,620);c.fillStyle='#eee';c.font='20px system-ui';c.fillText('DESTROYER · FIXED CAMERA / EIGHT HEADINGS',22,32);
 const names=['EAST','SOUTHEAST','SOUTH','SOUTHWEST','WEST','NORTHWEST','NORTH','NORTHEAST'],indices=[];
 for(let i=0;i<8;i++){const x=150+(i%4)*300,y=180+Math.floor(i/4)*285;art.paintShip(c,'warship',x,y,i*Math.PI/4,72,'#4499dd',4,4);indices.push(art.diagnostics().shipHeading);c.fillStyle='#b8d1db';c.font='13px system-ui';c.fillText(names[i],x-42,y+105);}
 const data=canvas.toDataURL();art.destroy();return {data,rotations,indices};
});
assert.deepEqual(sheet.indices,[0,1,2,3,4,5,6,7]);assert.ok(sheet.rotations.every(a=>a===0),'directional images must never rotate in screen space');
fs.writeFileSync('prototypes/classic-battlefield-direction/destroyer-headings.png',Buffer.from(sheet.data.split(',')[1],'base64'));
await page.locator('[data-action="sail"]').click();
const smoothing=await page.evaluate(async()=>{
 const {interpolateShipHeading}=await import('/src/rendering/classic-battlefield.mjs');
 const wrap=interpolateShipHeading(170*Math.PI/180,-170*Math.PI/180,.5);
 let previous=null,subTickChanges=0,frames=0;const end=performance.now()+6500;
 await new Promise(resolve=>{function sample(){const art=window.__STATEFALL_CLASSIC__.diagnostics(),tick=window.__STATEFALL_TEST__.status().tick;frames++;
 if(previous&&previous.tick===tick&&Math.abs(art.shipDisplayAngle-previous.angle)>.00001)subTickChanges++;
 previous={tick,angle:art.shipDisplayAngle};if(performance.now()<end)requestAnimationFrame(sample);else resolve();}requestAnimationFrame(sample);});
 return {wrap,subTickChanges,frames};
});
assert.ok(Math.abs(smoothing.wrap-Math.PI)<1e-9,'heading wrap must take shortest path');
assert.ok(smoothing.subTickChanges>10,'heading must move between simulation ticks');
await page.evaluate(()=>window.__STATEFALL_TEST__.pause());
const targetOrders=await page.evaluate(()=>window.__STATEFALL_CLASSIC__.diagnostics().loop.orders+10);
const headings=new Set();let state;
for(let i=0;i<1500;i++){
 state=await page.evaluate(()=>{window.__STATEFALL_TEST__.advance(1);window.__STATEFALL_TEST__.renderRepeatedly(1);return window.__STATEFALL_CLASSIC__.diagnostics();});
 headings.add(state.shipHeading);if(state.loop?.orders>=targetOrders)break;
}
assert.ok(state.loop?.orders>=11,'destroyer must complete a commanded lap');
assert.equal(headings.size,8,'real loop must display all eight headings');assert.deepEqual(errors,[]);
await page.screenshot({path:'prototypes/classic-battlefield-direction/destroyer-loop.png'});
await page.locator('[data-action="sail"]').click();assert.equal(await page.evaluate(()=>window.__STATEFALL_CLASSIC__.diagnostics().loop),null);
fs.writeFileSync('prototypes/classic-battlefield-direction/destroyer-verification.json',JSON.stringify({orders:state.loop.orders,smoothing,headings:[...headings].sort(),errors,rotationCheck:'all artwork rotations are zero'},null,2));
console.log('Directional destroyer PASS',JSON.stringify({orders:state.loop.orders,headings:[...headings].sort()}));
}finally{await browser.close();}})().catch(e=>{console.error(e);process.exitCode=1;});
