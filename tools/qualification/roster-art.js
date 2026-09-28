const assert=require('node:assert/strict'),fs=require('fs'),{chromium}=require('playwright');
(async()=>{const browser=await chromium.launch();try{const page=await browser.newPage({viewport:{width:1600,height:1000}}),errors=[];page.on('pageerror',e=>errors.push(e.message));page.on('requestfailed',r=>errors.push(r.url()+': '+r.failure()?.errorText));
await page.addInitScript(()=>window.__STATEFALL_TEST_MODE__=true);
await page.goto('http://127.0.0.1:4173/?art=classic&scene=coast&browserTest=1');await page.waitForFunction(()=>window.__STATEFALL_CLASSIC__);
await page.evaluate(()=>window.__STATEFALL_TEST__.pause());
const result=await page.evaluate(async()=>{
const {createClassicBattlefield}=await import('/src/rendering/classic-battlefield.mjs'),art=await createClassicBattlefield();
const types=['warship','battleship','cruiser','scout','sub','hunter','rship','privateer','transport','heavytransport','merchant','fighter','bomber','carrier','spy','truck'],canvas=document.createElement('canvas');canvas.width=1800;canvas.height=types.length*170+50;
const c=canvas.getContext('2d'),rotations=[],rotate=c.rotate.bind(c);c.rotate=a=>{rotations.push(a);rotate(a);};c.fillStyle='#163748';c.fillRect(0,0,canvas.width,canvas.height);const missing=[];
for(let row=0;row<types.length;row++){c.fillStyle='#eee';c.font='16px system-ui';c.fillText(types[row].toUpperCase(),10,row*170+25);for(let i=0;i<8;i++){if(!art.paintShip(c,types[row],110+i*220,100+row*170,i*Math.PI/4,58,'#4499dd',4,4))missing.push(types[row]);}}
// Exercise every blend and the bounded nation-color cache.
for(let t=0;t<types.length;t++)for(let angle=0;angle<64;angle++)art.paintShip(c,types[t],-1000,-1000,angle*Math.PI/32,30,'#'+(0x224400+t*0x10213).toString(16).padStart(6,'0'),4,4);
const data=canvas.toDataURL(),diagnostics=art.diagnostics();art.destroy();return {data,missing,rotations,diagnostics};
});
assert.deepEqual(result.missing,[]);assert.ok(result.rotations.every(a=>a===0));assert.ok(result.diagnostics.sourceBytes<=64*1024*1024);assert.deepEqual(errors,[]);
fs.mkdirSync('docs/evidence/comprehensive',{recursive:true});fs.writeFileSync('docs/evidence/comprehensive/naval-roster.png',Buffer.from(result.data.split(',')[1],'base64'));
const structures=await page.evaluate(async()=>{const {createClassicBattlefield}=await import('/src/rendering/classic-battlefield.mjs'),art=await createClassicBattlefield(),canvas=document.createElement('canvas');canvas.width=1200;canvas.height=1000;const c=canvas.getContext('2d'),types=['factory','radar','sam','battery','port','city','engcmd','airfield','silo','fort','command','shield','shore','bertha','flightops','subbase','troopcmd','lradar','jammer','satellite'],missing=[];c.fillStyle='#26382e';c.fillRect(0,0,1200,1000);types.forEach((type,i)=>{const x=120+i%5*240,y=210+Math.floor(i/5)*240;if(!art.paintStructure(c,type,x,y,62,'#4499dd'))missing.push(type);c.fillStyle='#eee';c.font='15px system-ui';c.fillText(type.toUpperCase(),x-65,y+30);});const data=canvas.toDataURL();art.destroy();return {data,missing};});assert.deepEqual(structures.missing,[]);fs.writeFileSync('docs/evidence/comprehensive/structure-roster.png',Buffer.from(structures.data.split(',')[1],'base64'));
delete result.data;fs.writeFileSync('docs/evidence/comprehensive/roster-art.json',JSON.stringify({...result,errors},null,2));console.log('Naval roster artwork PASS',result.diagnostics);
}finally{await browser.close();}})().catch(e=>{console.error(e);process.exitCode=1;});
