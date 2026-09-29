const {test,expect}=require('@playwright/test');
test('silo uses one artwork projectile at the flight handoff',async({page})=>{
 await page.goto('/');const result=await page.evaluate(async()=>{
 const {loadSiloArt,paintSilo,paintSiloRocket}=await import('/src/rendering/classic-silo-runtime.mjs');await loadSiloArt();const {paintMissilesCanvas,missilePosition}=await import('/src/rendering/missile-layer-model.mjs');const {SILO_LIFTOFF}=await import('/src/rendering/silo-flight-path.mjs');
 const cv=document.createElement('canvas');cv.width=1000;cv.height=600;document.body.replaceChildren(cv);const c=cv.getContext('2d'),scale=2.4/62;let calls=0,restored=true;for(const [i,age] of [SILO_LIFTOFF-.001,SILO_LIFTOFF,SILO_LIFTOFF+.001,4,5,12].entries()){
 const x=80+i*160,y=450,m={from:5050,t:5090,flight:55,age,classicLaunchScale:scale,owned:true,visible:true};c.save();c.translate(x,y);c.scale(scale*6,scale*6);c.translate(-180,-166);paintSilo(c,{age:age*1.4,projectile:age<SILO_LIFTOFF});c.restore();
 if(age>=SILO_LIFTOFF)paintMissilesCanvas(c,{camera:{x:x-50.5*6,y:y-50.5*6,scale:6},viewport:{width:1000,height:600},mapWidth:100,now:0,nukeRadius:0,cruiseRadius:0,missiles:[m]},{onlySemantic:'missile-body',paintBody:(ctx,options)=>{calls++;const before=ctx.getTransform().toString();paintSiloRocket(ctx,options);restored&&=before===ctx.getTransform().toString();}});
 c.fillStyle='black';c.fillText(age.toFixed(3),x-20,490);
 }return {calls,restored};});await page.screenshot({path:'.artifacts/silo-flight-handoff.png'});expect(result).toEqual({calls:5,restored:true});
});
