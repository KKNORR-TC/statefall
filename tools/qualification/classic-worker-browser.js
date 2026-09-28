const fs=require('fs'),assert=require('node:assert/strict'),pw=require('playwright');
(async()=>{
 const results=[];
 for(const browserName of ['chromium','firefox','webkit']){
  const browser=await pw[browserName].launch();
  try{
   const page=await browser.newPage(),errors=[];page.on('pageerror',e=>errors.push(e.message));
   await page.goto('http://127.0.0.1:4173/?browserTest=1');
   const data=await page.evaluate(async()=>{
    const {createClassicBattlefield}=await import('/src/rendering/classic-battlefield.mjs');
    const {paintGlobalEffectsCanvas}=await import('/src/rendering/global-effects-layer-model.mjs');
    const art=await createClassicBattlefield({terrainOnly:true});
    if(typeof OffscreenCanvas==='undefined'){const {attachClassicTerrainWorker}=await import('/src/rendering/classic-terrain-client.mjs');const paint=art.paintTerrain;attachClassicTerrainWorker(art);const fallback=art.paintTerrain===paint;art.destroy();return {unsupported:true,fallback};}
    const worker=new Worker('/src/rendering/classic-terrain-worker.mjs',{type:'module'});
    const W=70,H=50,N=W*H,results=[];
    try{
     for(const dpr of [1,1.5]){
      const state={width:420,height:300,dpr,W,H,camera:{x:-3.5,y:-4.75,s:7.5},land:Uint8Array.from({length:N},(_,i)=>i%13?1:0),river:Uint8Array.from({length:N},(_,i)=>i%17===0?1:0),rough:Float32Array.from({length:N},(_,i)=>(i%7)/7),owner:Int16Array.from({length:N},(_,i)=>i%3),fog:Uint8Array.from({length:N},(_,i)=>i%5?1:0),fogOpacity:Uint8Array.from({length:N},(_,i)=>i%5?0:180),players:[{color:'#dd5533'},{color:'#3377dd'},{color:'#77bb33'}],structures:[{t:543,type:'city',owner:0},{t:700,type:'port',owner:1}],links:[],trucks:[],attacks:[{owner:0,front:Array.from({length:900},(_,i)=>80+i).filter(i=>i%3)},{owner:1,front:Array.from({length:700},(_,i)=>500+i).filter(i=>i%4)}]};
      const message=await new Promise((resolve,reject)=>{const timeout=setTimeout(()=>reject(new Error('worker timeout')),15000);worker.onmessage=e=>{clearTimeout(timeout);e.data.type==='failure'?reject(new Error(e.data.message)):resolve(e.data);};worker.onerror=e=>{clearTimeout(timeout);reject(new Error(e.message));};worker.postMessage({type:'build',generation:dpr,input:state});});
      const canvas=document.createElement('canvas');canvas.width=state.width*dpr;canvas.height=state.height*dpr;const context=canvas.getContext('2d');context.setTransform(dpr,0,0,dpr,0,0);art.paintTerrain(context,state);
      const expected=context.getImageData(0,0,canvas.width,canvas.height).data;let differences=0,maxDelta=0,totalDelta=0;
      for(let i=0;i<expected.length;i++)if(expected[i]!==message.pixels[i]){differences++;totalDelta+=Math.abs(expected[i]-message.pixels[i]);maxDelta=Math.max(maxDelta,Math.abs(expected[i]-message.pixels[i]));}
      results.push({dpr,differences,maxDelta,meanDelta:totalDelta/expected.length,reference:canvas.toDataURL()});context.putImageData(new ImageData(message.pixels,canvas.width,canvas.height),0,0);results.at(-1).worker=canvas.toDataURL();
      context.clearRect(0,0,state.width,state.height);art.paintFronts(context,state.attacks.map(a=>({...a,front:new Set(a.front)})),state.players,state.camera,W,H,state.fog,0,dpr,state.width,state.height,.44);
      const frontExpected=context.getImageData(0,0,canvas.width,canvas.height).data.slice();context.clearRect(0,0,state.width,state.height);
      for(const layer of message.frontLayers)context.drawImage(layer,0,0,state.width,state.height);
      const frontActual=context.getImageData(0,0,canvas.width,canvas.height).data;let frontTotal=0,frontMax=0,frontPixels=0;
      for(let i=0;i<frontActual.length;i++){const delta=Math.abs(frontActual[i]-frontExpected[i]);frontTotal+=delta;frontMax=Math.max(frontMax,delta);if(i%4===3&&frontActual[i])frontPixels++;}
      results.at(-1).front={layers:message.frontLayers.length,meanDelta:frontTotal/frontActual.length,maxDelta:frontMax,pixels:frontPixels,bytes:message.diagnostics.frontBytes};
      for(const layer of message.frontLayers)layer.close();
     }
     // Cull only particles whose complete bounds are beyond the viewport; preserve pixels and inherited state.
     const canvas=document.createElement('canvas');canvas.width=420;canvas.height=300;const ctx=canvas.getContext('2d');
     const effects={camera:{x:-10.25,y:-20.5,scale:7},viewport:{width:420,height:300},sparks:[],puffs:[]};
     for(let i=0;i<1200;i++){effects.sparks.push({x:i%150-50,y:Math.floor(i/150)*10-20,age:i%6});effects.puffs.push({x:i%150-50,y:Math.floor(i/150)*10-20,r:1+i%8,age:i%20,life:25,color:'70,70,70'});}
     const base=paintGlobalEffectsCanvas(ctx,effects,{roundSparks:true}),expected=ctx.getImageData(0,0,420,300).data.slice(),state=[ctx.fillStyle,ctx.globalAlpha];
     ctx.clearRect(0,0,420,300);const culled=paintGlobalEffectsCanvas(ctx,effects,{roundSparks:true,cullOffscreen:true}),actual=ctx.getImageData(0,0,420,300).data;let effectDifferences=0;
     for(let i=0;i<actual.length;i++)if(actual[i]!==expected[i])effectDifferences++;
     return {terrain:results,effectDifferences,baseDraws:base.length,culledDraws:culled.length,stateEqual:JSON.stringify(state)===JSON.stringify([ctx.fillStyle,ctx.globalAlpha])};
    }finally{worker.terminate();art.destroy();}
   });
   for(const r of data.terrain||[]){for(const key of ['reference','worker']){fs.writeFileSync('.artifacts/terrain-'+browserName+'-'+r.dpr+'-'+key+'.png',Buffer.from(r[key].split(',')[1],'base64'));delete r[key];}}results.push({browser:browserName,...data,errors});console.log(JSON.stringify(results.at(-1)));
   assert.deepEqual(errors,[]);if(data.unsupported){assert.ok(data.fallback);continue;}for(const r of data.terrain)assert.ok(r.meanDelta<=2&&r.maxDelta<=64,'worker raster differs beyond reviewed Chromium offscreen antialiasing tolerance');for(const r of data.terrain){assert.equal(r.front.layers,1);assert.ok(r.front.pixels>100);assert.ok(r.front.meanDelta<=2&&r.front.maxDelta<=64,'composited fronts changed color or geometry');assert.ok(r.front.bytes<=64*1024*1024);}assert.equal(data.effectDifferences,0);assert.ok(data.stateEqual);assert.ok(data.culledDraws<data.baseDraws/2);
  }finally{await browser.close();}
 }
 fs.writeFileSync('docs/evidence/comprehensive/classic-worker-regression.json',JSON.stringify(results,null,2));
})().catch(e=>{console.error(e);process.exitCode=1;});
