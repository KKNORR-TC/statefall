const {test,expect}=require('@playwright/test');
test('runtime SAM preserves aim during reload, supports every bearing and freezes when paused',async({page})=>{
 await page.goto('/');
 const result=await page.evaluate(async()=>{
  const {loadSamArt,paintSam}=await import('/src/rendering/classic-sam-sequence.mjs');await loadSamArt();
  const {createClassicMotionLayer}=await import('/src/rendering/classic-motion-layer.mjs');const cv=document.createElement('canvas');cv.width=720;cv.height=440;const c=cv.getContext('2d');let bearings=true;
  for(let i=0;i<32;i++)for(const age of [0,1,3.8,4.2,5,7]){const heading=i*Math.PI/16;const q=paintSam(c,{age,target:heading,aimHeading:heading,projectile:age<4.2});bearings&&=q.heading===heading;}
  const st={owner:0,t:2525,type:'sam',cool:0},layer=createClassicMotionLayer(),input={art:{enabled:true},camera:{x:0,y:0,s:8},width:720,height:440,W:100,tick:1,now:1000,structures:[st],weaponMissiles:[],weaponInterceptors:[]};
  const render=(extra={})=>{c.clearRect(0,0,720,440);layer.render(c,{...input,...extra});return cv.toDataURL();};render();st.cool=26;render({tick:2,now:1100});const before=JSON.stringify(st),a=render({tick:2,now:1200,paused:true}),b=render({tick:2,now:1800,paused:true});render({fog:new Uint8Array(10000)});const hidden=layer.diagnostics().draws;const reduced=render({reducedMotion:true});return {bearings,paused:a===b,unchanged:JSON.stringify(st)===before,hidden,reduced:reduced.length>100};
 });expect(result).toEqual({bearings:true,paused:true,unchanged:true,hidden:0,reduced:true});
});
