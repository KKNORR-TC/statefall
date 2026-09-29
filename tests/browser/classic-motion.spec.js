const {test,expect}=require('@playwright/test');
test('classic motion covers roster, guards fog/offscreen/reduced motion and leaves state unchanged',async({page})=>{
 await page.goto('/');
 const result=await page.evaluate(async()=>{
  const {createClassicMotionLayer}=await import('/src/rendering/classic-motion-layer.mjs');const {createClassicBattlefield}=await import('/src/rendering/classic-battlefield.mjs');const {STRUCT,SHIPS}=await import('/src/sim/rules.mjs');
  const art=await createClassicBattlefield(),layer=createClassicMotionLayer(),cv=document.createElement('canvas');cv.width=900;cv.height=600;const c=cv.getContext('2d'),s={owner:0,t:25,type:'battery',level:1,cool:0,hp:6};
  const input={art,camera:{x:0,y:100,s:6},width:900,height:600,W:100,tick:1,now:1000,paused:false,reducedMotion:false,structures:[s],warships:[],transports:[],merchants:[],aircraft:[],planes:[],trucks:[]};
  const before=JSON.stringify(s);layer.render(c,input);const visible=layer.diagnostics().draws;c.clearRect(0,0,900,600);layer.render(c,{...input,fog:new Uint8Array(10000)});const hidden=layer.diagnostics().draws,alpha=c.getImageData(0,0,900,600).data.some((v,i)=>i%4===3&&v);
  layer.render(c,{...input,camera:{x:-10000,y:0,s:6}});const offscreen=layer.diagnostics().draws;layer.render(c,{...input,reducedMotion:true});const reduced=layer.diagnostics().draws;
  const roster=[];for(const key of Object.keys(STRUCT)){const source={...s,type:key,hp:10,lshield:6,gunHp:4};layer.render(c,{...input,structures:[source]});source.cool=20;layer.render(c,{...input,now:1100,tick:2,structures:[source],selectedStructure:source});roster.push(layer.diagnostics().draws);}
  for(const key of Object.keys(SHIPS)){const source={cls:key,owner:0,id:1,cool:0,path:[1,2],pos:0};for(let i=0;i<8;i++){const v={source,visible:true,cls:key,x:25,y:15,heading:i*Math.PI/4};layer.render(c,{...input,structures:[],warships:[v]});source.cool+=10;layer.render(c,{...input,now:1200,tick:3,structures:[],warships:[v]});roster.push(layer.diagnostics().draws);}}
  for(const key of ['fighter','bomber','carrier','spy'])for(let i=0;i<8;i++){const source={type:key,state:'out',owner:0};const v={source,type:key,state:'out',visible:true,x:25,y:15,heading:i*Math.PI/4};layer.render(c,{...input,structures:[],aircraft:[v]});roster.push(layer.diagnostics().draws);}
  for(const [collection,key,heavy] of [['transports','transport',false],['transports','heavytransport',true],['merchants','merchant',false],['trucks','truck',false]]){const source={owner:0,type:key,state:'work',path:[1,2],pos:0};const v={source,visible:true,x:25,y:15,heading:0,heavy,state:'work'};layer.render(c,{...input,structures:[],[collection]:[v]});roster.push(layer.diagnostics().draws);}
  art.destroy();return {visible,hidden,alpha,offscreen,reduced,unchanged:before===JSON.stringify(s),roster};
 });
 expect(result.visible).toBe(1);expect(result.hidden).toBe(0);expect(result.alpha).toBe(false);expect(result.offscreen).toBe(0);expect(result.reduced).toBe(0);expect(result.unchanged).toBe(true);expect(result.roster.every(n=>n===1)).toBe(true);
});
