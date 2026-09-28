const fs=require('fs'),assert=require('node:assert/strict'),playwright=require('playwright');
(async()=>{
 const results=[];
 for(const name of ['chromium','firefox','webkit']){
  const browser=await playwright[name].launch();
  try{
   const page=await browser.newPage();
   await page.goto('http://127.0.0.1:4173/?browserTest=1');
   const result=await page.evaluate(async()=>{
    const {createClassicBattlefield}=await import('/src/rendering/classic-battlefield.mjs'),art=await createClassicBattlefield();
    const NativePath=window.Path2D,canvas=document.createElement('canvas');canvas.width=600;canvas.height=400;
    const ctx=canvas.getContext('2d'),players=[{color:'#4499dd'}],front=new Set();
    for(let y=1;y<40;y++)for(let x=1;x<60;x++)if((x*17+y*13)%7<3)front.add(y*64+x);
    const camera={x:4.3,y:5.7,s:4.21};
    art.paintFronts(ctx,[{owner:0,front}],players,camera,64,44,null,193,1,600,400);
    const candidate=ctx.getImageData(0,0,600,400).data.slice();
    // Reference closes every preceding contour explicitly, matching the original fill-only geometry.
    window.Path2D=class extends NativePath{moveTo(x,y){if(this.started)super.closePath();this.started=true;super.moveTo(x,y);}};
    ctx.clearRect(0,0,600,400);
    try{art.paintFronts(ctx,[{owner:0,front}],players,camera,64,44,null,193,2,600,400);}finally{window.Path2D=NativePath;}
    const expected=ctx.getImageData(0,0,600,400).data;let differences=0;
    for(let i=0;i<expected.length;i++)if(expected[i]!==candidate[i])differences++;
    const fragmented=new Set();for(let y=1;y<413;y++)for(let x=1;x<719;x++)if((x+y)%2===0)fragmented.add(y*720+x);
    const times=[];
    for(let i=0;i<3;i++){const start=performance.now();art.paintFronts(ctx,[{owner:0,front:fragmented}],players,{x:0,y:0,s:.8},720,414,null,193,10+i,600,400);times.push(performance.now()-start);}
    const clipped=document.createElement('canvas');clipped.width=200;clipped.height=120;const clippedContext=clipped.getContext('2d'),visibility=Uint8Array.from({length:64*44},(_,i)=>i%5?1:0);let offscreenDifferences=0;
    for(const [index,cam]of [{x:-80.25,y:-60.5,s:7.5},{x:10,y:20,s:4.2},{x:-260,y:-170,s:10.25}].entries()){
      clippedContext.clearRect(0,0,200,120);art.paintFronts(clippedContext,[{owner:0,front}],players,cam,64,44,visibility,193,1000+index,200,120);const cropped=clippedContext.getImageData(0,0,200,120).data.slice();
      clippedContext.clearRect(0,0,200,120);clippedContext.save();clippedContext.translate(cam.x,cam.y);art.paintFronts(clippedContext,[{owner:0,front}],players,{x:0,y:0,s:cam.s},64,44,visibility,193,2000+index,64*cam.s,44*cam.s);clippedContext.restore();const entire=clippedContext.getImageData(0,0,200,120).data;
      for(let i=0;i<entire.length;i++)if(entire[i]!==cropped[i])offscreenDifferences++;
    }
    art.destroy();
    const groundCanvas=document.createElement('canvas');groundCanvas.width=400;groundCanvas.height=260;
    const groundContext=groundCanvas.getContext('2d'),W=80,H=55,count=W*H;
    const state={camera:{x:-7.3,y:-9.2,s:5.4},width:400,height:260,W,H,land:Uint8Array.from({length:count},(_,i)=>i%13?1:0),river:new Uint8Array(count),rough:new Uint8Array(count),owner:Int16Array.from({length:count},(_,i)=>(i+Math.floor(i/W))%2),fog:null,players:[{color:'#4499dd'},{color:'#dd6644'}],structures:[],links:[],trucks:[]};
    const groundArt=await createClassicBattlefield();groundArt.paintTerrain(groundContext,state);
    const groundCandidate=groundContext.getImageData(0,0,400,260).data.slice();groundArt.destroy();groundContext.clearRect(0,0,400,260);
    const referenceArt=await createClassicBattlefield(),proto=CanvasRenderingContext2D.prototype,originalFill=proto.fill,originalClip=proto.clip;
    window.Path2D=class extends NativePath{
      constructor(){super();this.ops=[];}
      moveTo(...a){this.ops.push(['moveTo',a]);super.moveTo(...a);}
      lineTo(...a){this.ops.push(['lineTo',a]);super.lineTo(...a);}
      rect(...a){this.ops.push(['rect',a]);super.rect(...a);}
    };
    const explicitlyClosed=path=>{
      if(!path?.ops)return path;const closed=new NativePath();let open=false;
      for(const [op,args]of path.ops){if((op==='moveTo'||op==='rect')&&open){closed.closePath();open=false;}closed[op](...args);if(op==='moveTo')open=true;}
      if(open)closed.closePath();return closed;
    };
    proto.fill=function(...args){if(args.length)args[0]=explicitlyClosed(args[0]);return originalFill.apply(this,args);};
    proto.clip=function(...args){if(args.length)args[0]=explicitlyClosed(args[0]);return originalClip.apply(this,args);};
    try{referenceArt.paintTerrain(groundContext,state);}finally{window.Path2D=NativePath;proto.fill=originalFill;proto.clip=originalClip;referenceArt.destroy();}
    const groundExpected=groundContext.getImageData(0,0,400,260).data;let terrainDifferences=0;
    for(let i=0;i<groundExpected.length;i++)if(groundExpected[i]!==groundCandidate[i])terrainDifferences++;
    return {differences,terrainDifferences,offscreenDifferences,frontTiles:fragmented.size,times};
   });
   results.push({browser:name,...result});console.log(JSON.stringify(results.at(-1)));
   assert.equal(result.offscreenDifferences,0,'viewport front culling changed pixels');
   assert.equal(result.differences,0,'implicit closure changed rendered pixels');
   assert.equal(result.terrainDifferences,0,'implicit closure changed terrain or ownership pixels');
   assert.ok(Math.max(...result.times)<1000,'fragmented attack front stalled for a second');
  }finally{await browser.close();}
 }
 fs.writeFileSync('docs/evidence/comprehensive/front-path-regression.json',JSON.stringify(results,null,2));
})().catch(e=>{console.error(e);process.exitCode=1;});
