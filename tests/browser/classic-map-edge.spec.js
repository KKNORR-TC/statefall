const {test,expect}=require('@playwright/test');
test('classic terrain preserves all four map edges across cache pans and worker output',async({page})=>{
 await page.goto('/');
 const results=await page.evaluate(async()=>{
  const {createClassicBattlefield}=await import('/src/rendering/classic-battlefield.mjs');
  const {attachClassicTerrainWorker}=await import('/src/rendering/classic-terrain-client.mjs');
  const results=[];
  for(const worker of [false,true])for(const dpr of [1,2]){
   let art=await createClassicBattlefield({terrainOnly:true});
   if(worker)art=attachClassicTerrainWorker(art);
   const canvas=document.createElement('canvas');canvas.width=320*dpr;canvas.height=280*dpr;
   const ctx=canvas.getContext('2d');
   for(const [s,x,y] of [[5,70,50],[8,40,35],[8,48,43],[5,70,50]]){
    const state={tick:0,width:320,height:280,W:20,H:20,camera:{s,x,y},land:new Uint8Array(400),river:new Uint8Array(400),rough:new Float32Array(400),owner:new Int16Array(400).fill(-1),fog:null,players:[],structures:[],links:[],trucks:[],attacks:[]};
    const paint=()=>{ctx.setTransform(1,0,0,1,0,0);ctx.clearRect(0,0,canvas.width,canvas.height);ctx.setTransform(dpr,0,0,dpr,0,0);return art.paintTerrain(ctx,state);};
    paint();if(worker){await art.terrainSettled();paint();}
    const alpha=(px,py)=>ctx.getImageData(Math.round(px*dpr),Math.round(py*dpr),1,1).data[3];
    results.push({worker,dpr,s,x,y,outside:[[x-3,y+20],[x+20*s+3,y+20],[x+20,y-3],[x+20,y+20*s+3]].map(([px,py])=>alpha(px,py)),inside:alpha(x+10,y+10),fallback:worker?art.diagnostics().terrainWorker.fallbackActive:false});
   }
   art.destroy();
  }
  return results;
 });
 for(const r of results){expect(r.outside,JSON.stringify(r)).toEqual([0,0,0,0]);expect(r.inside).toBe(255);expect(r.fallback).toBe(false);}
});
