const {test,expect}=require('@playwright/test');
test('large close-up terrain draws trees through the bottom of the view and reuses its cache',async({page})=>{
 await page.goto('/');
 const result=await page.evaluate(async()=>{
  const {createClassicBattlefield}=await import('/src/rendering/classic-battlefield.mjs');
  const art=await createClassicBattlefield({terrainOnly:true});
  const canvas=document.createElement('canvas');canvas.width=3840;canvas.height=1800;
  const context=canvas.getContext('2d'),W=720,H=420,N=W*H;
  const state={tick:0,width:3840,height:1800,W,H,camera:{x:0,y:0,s:6},land:new Uint8Array(N).fill(1),river:new Uint8Array(N),rough:new Float32Array(N),owner:new Int16Array(N).fill(-1),fog:null,players:[],structures:[],links:[],trucks:[],attacks:[]};
  const original=CanvasRenderingContext2D.prototype.translate,positions=[];
  CanvasRenderingContext2D.prototype.translate=function(x,y){if(x>300&&y>300)positions.push([x,y]);return original.call(this,x,y);};
  try{
   art.paintTerrain(context,state);const first=art.diagnostics(),count=positions.length;
   art.paintTerrain(context,state);const cached=art.diagnostics();
   return {trees:first.trees,bottom:positions.filter(([x,y])=>y>1500&&y<1800).length,extraDraws:positions.length-count,refreshes:[first.terrainRefreshes,cached.terrainRefreshes]};
  }finally{CanvasRenderingContext2D.prototype.translate=original;art.destroy();}
 });
 expect(result.trees).toBeGreaterThan(180);expect(result.bottom).toBeGreaterThan(10);expect(result.extraDraws).toBe(0);expect(result.refreshes).toEqual([1,1]);
});
