import {createClassicBattlefield} from './classic-battlefield.mjs';
let rendererPromise,canvas,revision=0;const frontCanvases=[];
self.onmessage=async({data})=>{
  if(data?.type!=='build')return;
  const {generation,input}=data,start=performance.now(),frontLayers=[];
  try{
    rendererPromise??=createClassicBattlefield({terrainOnly:true});
    const renderer=await rendererPromise,width=Math.round(input.width*input.dpr),height=Math.round(input.height*input.dpr);
    canvas??=new OffscreenCanvas(width,height);
    if(canvas.width!==width)canvas.width=width;if(canvas.height!==height)canvas.height=height;
    const context=canvas.getContext('2d');context.setTransform(1,0,0,1,0,0);context.clearRect(0,0,width,height);context.setTransform(input.dpr,0,0,input.dpr,0,0);
    renderer.paintTerrain(context,input);
    const pixels=context.getImageData(0,0,width,height).data;
    // Composite the contested colors once; pulse the completed overlay on the display thread.
    // This preserves the attack ordering without blending a full viewport for every attack each frame.
    const frontBytes=width*height*4,frontFallback=frontBytes>64*1024*1024;
    if(!frontFallback&&(input.attacks||[]).length){
      const layer=frontCanvases[0]??=new OffscreenCanvas(width,height);
      if(layer.width!==width)layer.width=width;if(layer.height!==height)layer.height=height;
      const layerContext=layer.getContext('2d',{willReadFrequently:true});layerContext.setTransform(1,0,0,1,0,0);layerContext.clearRect(0,0,width,height);layerContext.setTransform(input.dpr,0,0,input.dpr,0,0);
      renderer.paintFronts(layerContext,input.attacks.map(a=>({...a,front:new Set(a.front)})),input.players,input.camera,input.W,input.H,input.fog,0,generation,input.width,input.height,.44);
      frontLayers.push(layer.transferToImageBitmap());
    }else if(frontCanvases[0])frontCanvases[0].width=frontCanvases[0].height=0;
    self.postMessage({type:'complete',generation,rasterRevision:++revision,width,height,pixels,frontLayers:frontFallback?null:frontLayers,camera:input.camera,cssWidth:input.width,cssHeight:input.height,workerMs:performance.now()-start,diagnostics:{...renderer.diagnostics(),frontBytes,frontFallback}},[pixels.buffer,...frontLayers]);
  }catch(error){for(const layer of frontLayers)layer.close();self.postMessage({type:'failure',generation,message:String(error?.message||error)});}
};
