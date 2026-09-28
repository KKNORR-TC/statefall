const fs=require('fs'),assert=require('node:assert/strict'),pw=require('playwright');
(async()=>{const results=[];for(const name of ['chromium','firefox','webkit']){const browser=await pw[name].launch();try{const page=await browser.newPage();
await page.route('**/classic-battlefield.mjs?unculled',async route=>{const response=await route.fetch();const body=(await response.text()).replace('function outsideCanvas(ctx,x,y,radius){','function outsideCanvas(ctx,x,y,radius){return false;');await route.fulfill({response,body});});
await page.goto('http://127.0.0.1:4173/?browserTest=1');
const result=await page.evaluate(async()=>{
 const candidate=await(await import('/src/rendering/classic-battlefield.mjs')).createClassicBattlefield();
 const reference=await(await import('/src/rendering/classic-battlefield.mjs?unculled')).createClassicBattlefield();
 const units=['warship','battleship','cruiser','scout','sub','hunter','rship','privateer','transport','heavytransport','merchant','fighter','bomber','carrier','spy','truck'];
 const structures=['factory','radar','sam','battery','port','city','engcmd','airfield','silo','fort','command','shield','shore','bertha','flightops','subbase','troopcmd','lradar','jammer','satellite'];
 let differences=0,cases=0;
 try{for(const dpr of [1,1.5])for(const transformed of [false,true]){
 const canvases=[candidate,reference].map(()=>{const c=document.createElement('canvas');c.width=240*dpr;c.height=180*dpr;return c;});
 for(const [i,art]of [candidate,reference].entries()){const ctx=canvases[i].getContext('2d');ctx.scale(dpr,dpr);if(transformed){ctx.translate(20,-15);ctx.rotate(.2);}
 for(const [j,type]of [...units,...structures].entries()){
  const points=[[-120,80],[-28,40],[0,170],[235,175],[265,40],[380,80],[110,-22],[110,210],[120,90]];
  for(const [x,y]of points){if(j<units.length)art.paintShip(ctx,type,x,y,j*.43,17,'#5599dd',2,5);else art.paintStructure(ctx,type,x,y,17,'#5599dd');}
 }
 }
 const a=canvases[0].getContext('2d').getImageData(0,0,canvases[0].width,canvases[0].height).data,b=canvases[1].getContext('2d').getImageData(0,0,canvases[1].width,canvases[1].height).data;
 for(let i=0;i<a.length;i++)if(a[i]!==b[i])differences++;cases+=36*9;
 }
 return{differences,cases,culledDraws:candidate.diagnostics().spriteDraws,referenceDraws:reference.diagnostics().spriteDraws};
 }finally{candidate.destroy();reference.destroy();}
});
results.push({browser:name,...result});console.log(JSON.stringify(results.at(-1)));assert.equal(result.differences,0);assert.ok(result.culledDraws<result.referenceDraws);
}finally{await browser.close();}}fs.writeFileSync('docs/evidence/comprehensive/sprite-culling-regression.json',JSON.stringify(results,null,2));})().catch(e=>{console.error(e);process.exitCode=1;});
