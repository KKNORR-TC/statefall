const {test,expect}=require('@playwright/test');
test('combat effects have distinct stages, restore Canvas state and respect lifecycle/visibility',async({page})=>{
 await page.goto('/');
 const result=await page.evaluate(async()=>{
  const {paintLaunch,paintMushroomCloud,createNuclearCloudLayer}=await import('/src/rendering/classic-combat-effects.mjs');
  const cv=document.createElement('canvas');cv.width=800;cv.height=600;const c=cv.getContext('2d'),shot=(fn)=>{c.clearRect(0,0,800,600);c.globalAlpha=.43;c.fillStyle='#123456';fn();if(c.globalAlpha<.42||c.globalAlpha>.44||c.fillStyle!=='#123456')throw Error('Canvas state leaked');return cv.toDataURL();};
  const stages=[.1,.6,1.8,3.2,6,8.7].map(age=>shot(()=>paintMushroomCloud(c,{x:400,y:400,radius:100,age})));
  const launch=['sam','silo'].map(kind=>shot(()=>paintLaunch(c,{kind,age:.3})));
  const blank=shot(()=>{}),layer=createNuclearCloudLayer(),input={now:0,tick:1,paused:false,camera:{x:100,y:300,s:4},width:800,height:600};
  for(let i=0;i<30;i++)layer.add({x:i,y:1,r:20});const bounded=layer.count();
  const hidden=shot(()=>layer.render(c,{...input,visible:()=>false}));
  const first=shot(()=>layer.render(c,input)),paused=shot(()=>layer.render(c,{...input,now:5000,paused:true}));
  for(let i=1;i<95;i++)layer.render(c,{...input,now:5000+i*100,tick:i+1,visible:()=>false});const expired=layer.count();
  layer.add({x:1,y:1,r:20});layer.render(c,{...input,tick:0});const rewind=layer.count();
  const reduced=shot(()=>paintMushroomCloud(c,{x:400,y:400,radius:100,age:1,reducedMotion:true}));
  return {unique:new Set(stages).size,launchDistinct:launch[0]!==launch[1],bounded,hidden:hidden===blank,pauseStable:first===paused,expired,rewind,reducedVisible:reduced!==blank};
 });
 expect(result).toEqual({unique:6,launchDistinct:true,bounded:16,hidden:true,pauseStable:true,expired:0,rewind:0,reducedVisible:true});
});
