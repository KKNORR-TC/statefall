import {createTerrainRasterModel} from './terrain-raster-model.mjs';

const model=createTerrainRasterModel({clock:()=>performance.now()});
let rasterRevision=0;

self.onmessage=event=>{
  const {type,generation,input}=event.data||{};
  if(type==='reset'){ model.reset(); rasterRevision=0; return; }
  if(type!=='build') return;
  try{
    const started=performance.now(),result=model.update(input),pixels=result.pixels.slice();
    if(result.changed||result.staticChanged) rasterRevision++;
    self.postMessage({type:'complete',generation,rasterRevision,changed:result.changed,staticChanged:result.staticChanged,pixels,width:result.diagnostics.pixelWidth,height:result.diagnostics.pixelHeight,diagnostics:result.diagnostics,workerMs:performance.now()-started},[pixels.buffer]);
  }catch(error){
    self.postMessage({type:'failure',generation,message:String(error?.message||error).slice(0,240)});
  }
};
